"""
OmniAvatar-1.3B on Modal serverless GPU — an alternative INFERENCE PROVIDER to the
HuggingFace Space at hf-space/omniavatar-service/.

Endpoints: GET /ping, POST /render, GET /lastlog. (/prepare is gone — see the note
above the /render handler.)

/render RETURNS THE CUTOUTS TOO. Matting used to run on the app server's CPU after
the render came back, as a second job the user waited for separately. It now runs
HERE, in this container, immediately after inference — so one call returns the mp4
plus its transparent ProRes .mov and WebM .webm twins, and a scene's cutout exists
the moment its render lands. Three reasons it belongs here rather than on the
backend:

  - the backend's matte was the only heavy CPU/memory work in the API process, and
    it OOM-killed a 16GB box mid-batch, taking every user's requests with it;
  - it was capped at AVATAR_MATTE_CONCURRENCY=1, so five scenes matted one after
    another (~5 min) instead of in parallel;
  - this container already has the mp4 on local disk and ffmpeg installed, so
    there is no second dispatch, no second cold start and no R2 round trip.

The cost is honest and accepted: the L40S stays billed through ~30-60s of matte
work it cannot accelerate (only rembg uses the GPU — NVENC encodes neither ProRes
nor VP9), roughly +18% per scene. See the `inline_matte` form field for the
off-switch, and _matte_mp4 for the pipeline.

backend/app/services/avatar_matte.py stays as the FALLBACK path: re-mattes, clips
rendered before this existed, and scenes whose inline matte failed.

Two structural differences from the Space version, both deliberate:

  1. WEIGHTS LIVE ON A MODAL VOLUME. The Space has ephemeral disk, so it re-downloads
     ~20GB on every single boot (~2.5 min) — the dominant cold-start cost. Here the
     weights are downloaded ONCE by `modal run app.py::download_weights` and then
     mounted read-only at every cold start. The Space's R2 mirroring block is dropped
     entirely; the Volume replaces it.

  2. NO GPU POOL — MODAL'S AUTOSCALER IS THE POOL. The Space ran a 4-slot queue.Queue
     pinning CUDA_VISIBLE_DEVICES per render, because it had a fixed set of cards to
     ration. Here each render gets its OWN container and its OWN L40S, created on
     demand and destroyed after, so `max_containers` alone bounds concurrency and
     idle cards cost nothing. A 5-scene batch renders on 5 GPUs at once and finishes
     in the time of its slowest scene rather than the sum of all of them, for the
     same total cost (billing is per GPU-second).

Cost (L40S @ $0.000542/s): ~$0.087 per 160s render. The scaledown window IS billed
(Modal: "you will be billed for any resources used while the container is idle"), so
SCALEDOWN_WINDOW is env-tunable to benchmark the idle-tail tradeoff. Volume storage is
$0.09/GiB/mo with 1 TiB free → our ~20GB costs $0.00.

Usage:
    modal run    app.py::download_weights    # one time, ~20GB -> Volume
    modal deploy app.py                      # prints the https://...modal.run URL
    modal serve  app.py                      # ephemeral, hot-reloading, for iteration
"""
import os

import modal

APP_NAME = "omniavatar"

# Where the OmniAvatar repo is cloned inside the image, and where its config expects
# weights. inference_1.3B.yaml resolves EVERY model path relative to CWD as
# pretrained_models/<name>/..., and inference writes output to CWD/demo_out/... — so
# the render subprocess must run with cwd=OMNIAVATAR_DIR.
OMNIAVATAR_DIR = "/root/omniavatar-src"
WEIGHTS_MOUNT = "/weights"                              # the Volume
WEIGHTS_DIR = f"{OMNIAVATAR_DIR}/pretrained_models"     # what the config reads
PRESETS_DIR = "/root/avatar_presets"

# Idle tail before the GPU is released. This time IS BILLED, so it is a direct cost
# knob (Modal: "you will be billed for any resources used while the container is idle").
#
# Default is the MINIMUM Modal allows (2s): release the card essentially the moment a
# render finishes, so an idle GPU is never billed. This is the right default here
# because OmniAvatar runs inference as a `torchrun` SUBPROCESS that exits after every
# render — the model is reloaded from scratch each time regardless of whether the
# container is warm. So holding the container buys very little, while a 300s window
# would add ~$0.163 of idle billing per burst (more than a $0.099 render itself).
#
# Raise it only if benchmarking shows warm renders are meaningfully faster than cold
# ones (i.e. the Volume page-cache effect outweighs the idle cost).
SCALEDOWN_WINDOW = int(os.environ.get("MODAL_SCALEDOWN_WINDOW", "2"))
GPU_TYPE = os.environ.get("MODAL_GPU", "L40S")

# ── Image ─────────────────────────────────────────────────────────────────────────
# Port of hf-space/omniavatar-service/Dockerfile. The version pins below are
# LOAD-BEARING — they encode three separately-diagnosed runtime crashes (see that
# Dockerfile's comments at lines 75-91). Order matters; do not "tidy" these.
#
# Dropped vs the Dockerfile: boto3 + the R2 mirror (Volume replaces it), the
# ffmpeg-static download (apt ffmpeg provides the /usr/bin/ffmpeg that OmniAvatar
# hardcodes for muxing), and the HF `useradd -u 1000` block (an HF Spaces convention).
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04", add_python="3.10"
    )
    .apt_install(
        "git", "wget", "curl", "ffmpeg", "xz-utils",
        "build-essential", "pkg-config",
        "libavformat-dev", "libavcodec-dev", "libavdevice-dev", "libavutil-dev",
        "libavfilter-dev", "libswscale-dev", "libswresample-dev",
    )
    .run_commands(
        f"git clone --depth 1 https://github.com/Omni-Avatar/OmniAvatar.git {OMNIAVATAR_DIR}"
    )
    .workdir(OMNIAVATAR_DIR)
    # cu124 torch FIRST from PyTorch's index (PyPI default is CPU-only). This does NOT
    # survive the requirements.txt step below — it is re-pinned at the end.
    .pip_install(
        "torch==2.4.0", "torchvision==0.19.0", "torchaudio==2.4.0",
        index_url="https://download.pytorch.org/whl/cu124",
    )
    # OmniAvatar's own requirements. peft's unbounded `torch>=1.13.0` drags in a bogus
    # torch 2.13.0/CUDA-13 here; fixed by the final re-pin.
    .run_commands("pip install --no-cache-dir -r requirements.txt")
    # hf_transfer is listed EXPLICITLY, not via the huggingface_hub[hf_transfer]
    # extra — the extra did not actually pull it, and HF_HUB_ENABLE_HF_TRANSFER=1
    # (set below) hard-errors rather than falling back when the package is absent.
    .pip_install(
        "fastapi", "uvicorn", "python-multipart", "pyyaml", "huggingface_hub",
        "hf_transfer",
        "imageio", "imageio-ffmpeg", "omegaconf", "opencv-python-headless", "soundfile",
    )
    # LOAD-BEARING FINAL PINS. Three crashes these fix:
    #   1. requirements.txt replaced cu124 torch -> transformers failed importing
    #      BloomPreTrainedModel against the wrong torch.
    #   2. the extras step upgraded numpy past OmniAvatar's 1.26.4 pin.
    #   3. diffusers arrived transitively at 0.36.0, which demands peft>=0.17.0 while
    #      OmniAvatar pins peft==0.15.1 -> ImportError at render. 0.33.1 is the
    #      Wan2.1-era release and only wants peft>=0.6.0.
    # --no-deps on torch stops it dragging its own resolver back in.
    .pip_install(
        "torch==2.4.0", "torchvision==0.19.0", "torchaudio==2.4.0",
        index_url="https://download.pytorch.org/whl/cu124",
        extra_options="--force-reinstall --no-deps",
    )
    .pip_install("numpy==1.26.4", "diffusers==0.33.1")
    # OmniAvatar's attention has a native FA3 -> FA2 -> SageAttention -> SDPA fallback
    # chain. Without this it lands on SDPA, the slowest option. Plain pip, no CUDA build.
    .pip_install("sageattention")
    # ── Matting (see _matte_mp4) ──────────────────────────────────────────────────
    # rembg cuts the presenter out of the rendered mp4 IN THIS CONTAINER, so the
    # backend never runs it.
    #
    # VERSION IS NOT THE SAME AS THE BACKEND'S, and cannot be: the backend pins
    # rembg[cpu]==2.0.77, but every rembg >=2.0.70 declares Requires-Python >=3.11
    # while this image is Python 3.10 — fixed by OmniAvatar's cu124 torch stack, not
    # a free choice. 2.0.69 is the newest release that installs here. Both versions
    # run the SAME u2netp ONNX weights through the same `remove()` call, so mattes
    # from the two paths are equivalent in practice; if that ever stops being true,
    # this pin is the first thing to check.
    #
    # onnxruntime-GPU, not the [cpu] extra the backend uses: the L40S is already
    # attached and paid for, and rembg is the ONE matte stage that can use it
    # (ffmpeg explode / ProRes / VP9 are all CPU-bound — NVENC encodes neither
    # ProRes nor VP9). --no-deps on rembg keeps its own `onnxruntime` requirement
    # from pulling the CPU build back in on top of the GPU one.
    #
    # 1.19.2, NOT 1.18.x. This pin is CUDA-VERSION-SENSITIVE and gets no error if
    # you get it wrong — onnxruntime-gpu <=1.18 links against CUDA 11, so on this
    # CUDA 12.4 image it fails to load libonnxruntime_providers_cuda.so
    # ("libcublasLt.so.11: cannot open shared object file") and rembg SILENTLY
    # FALLS BACK TO CPU. Everything still works, just at ~0.1s/frame instead of
    # ~0.01s, which is exactly the cost this whole block exists to avoid. 1.19 is
    # the first release built against CUDA 12.
    #
    # This is unrelated to OmniAvatar itself, which runs on torch and never
    # touches onnxruntime — the only shared surface is numpy, re-pinned below.
    # _get_rembg_session asserts the CUDA provider actually loaded, so a future
    # mismatch fails loudly instead of quietly halving the matte's speed.
    .pip_install("onnxruntime-gpu==1.19.2")
    .pip_install("rembg==2.0.69", extra_options="--no-deps")
    # rembg's runtime deps, minus onnxruntime (installed above as the GPU build).
    # Listed explicitly BECAUSE of --no-deps: pooch/pymatting/jsonschema are
    # imported at `from rembg import ...` time, so a missing one is an ImportError
    # on the first matte, not a warning.
    .pip_install("pooch", "pymatting", "jsonschema", "scikit-image")
    # numpy LAST and re-pinned: rembg's dependency tree (opencv, scikit-image,
    # pymatting) will happily upgrade past OmniAvatar's 1.26.4 pin, which is the
    # exact class of breakage the comment block above documents. Same defensive
    # re-pin, same reason.
    .pip_install("numpy==1.26.4")
    # Bake the u2netp weights (~4.6MB) INTO the image. rembg otherwise fetches them
    # from GitHub into ~/.u2net on first use — and with scaledown_window=2s /
    # min_containers=0 essentially EVERY render is a cold container, so that would
    # be a network round trip per render plus a hard failure whenever GitHub is
    # unreachable. Downloading once at build time removes both.
    # DOWNLOAD the weights only — do NOT construct a session here. Image builds run
    # on a CPU-only builder with no GPU driver, and onnxruntime-gpu SEGFAULTS
    # (exit 139) trying to initialise its CUDA provider there rather than failing
    # over cleanly. Fetching the file with pooch is all this step needs to do; the
    # session is built at runtime by _get_rembg_session, on a container that does
    # have the L40S.
    .run_commands(
        "python -c \"import pooch, os; "
        "os.makedirs('/root/.u2net', exist_ok=True); "
        "pooch.retrieve("
        "'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx', "
        "None, fname='u2netp.onnx', path='/root/.u2net')\""
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1", "U2NET_HOME": "/root/.u2net"})
    .add_local_dir(
        os.path.join(os.path.dirname(__file__), "avatar_presets"),
        PRESETS_DIR,
        copy=True,
    )
)

app = modal.App(APP_NAME, image=image)
weights_volume = modal.Volume.from_name("omniavatar-weights", create_if_missing=True)

# ── Weights ───────────────────────────────────────────────────────────────────────
# Same three repos as the Space (app.py:123-134), laid out exactly as
# inference_1.3B.yaml expects: text_encoder/dit/vae under Wan2.1-T2V-1.3B/,
# exp_path = OmniAvatar-1.3B/, wav2vec_path = wav2vec2-base-960h/. ~20GB total.
WEIGHT_REPOS = [
    ("Wan-AI/Wan2.1-T2V-1.3B", "Wan2.1-T2V-1.3B", [
        "models_t5_umt5-xxl-enc-bf16.pth",
        "diffusion_pytorch_model.safetensors",
        "Wan2.1_VAE.pth",
        "config.json",
        "google/*",            # umt5 tokenizer assets the T5 encoder loads
    ]),
    ("OmniAvatar/OmniAvatar-1.3B", "OmniAvatar-1.3B", None),      # small; take all
    ("facebook/wav2vec2-base-960h", "wav2vec2-base-960h", None),  # ~360MB; take all
]

# One load-bearing file per repo, checked explicitly so a truncated snapshot fails at
# startup rather than as a cryptic mid-render error. Relative to the weights root.
REQUIRED_WEIGHT_FILES = [
    "Wan2.1-T2V-1.3B/models_t5_umt5-xxl-enc-bf16.pth",
    "Wan2.1-T2V-1.3B/diffusion_pytorch_model.safetensors",
    "Wan2.1-T2V-1.3B/Wan2.1_VAE.pth",
    "wav2vec2-base-960h/config.json",
]

# Bundled roster presets. The backend picks a presenter by id and never uploads a face.
# Ids MUST stay in sync with backend/app/services/avatar_presets.py.
#
# EVERY id here must have its .jpg committed under avatar_presets/ — that dir is
# copied into the image wholesale by add_local_dir, so an entry whose portrait is
# only on someone's laptop resolves to a missing path on a clean deploy. That is
# exactly why Maya/Priya/Daniel were cut on 2026-08-07.
PRESET_IMAGE_FILE = {
    "woman_red": "candidate_woman1.jpg",
    "man_beard": "candidate_man2.jpg",
}

# ── Render defaults (identical to the Space's tuned L40S values) ───────────────────
DEFAULT_PROMPT = "A person looking at the camera and talking naturally, calm and friendly."
DEFAULT_STEPS = 10          # config default is 50; 10 is the tuned speed/quality point —
                            # denoising steps are the dominant cost, so expect render time
                            # (and per-render GPU spend) to scale roughly with this.
DEFAULT_GUIDANCE = 4.5
DEFAULT_MAX_TOKENS = 30000
DEFAULT_TEA_CACHE = 0.14    # TeaCache step-skip
DEFAULT_SEED = 42
DEFAULT_FPS = 30            # matches the 30fps Remotion composition
# 48GB L40S keeps the whole DiT resident (fast path). Setting this to a number forces
# CPU offload — only needed if downgrading to a smaller card.
_np_env = os.environ.get("AVATAR_NUM_PERSISTENT_PARAM_IN_DIT", "").strip()
NUM_PERSISTENT_PARAM_IN_DIT = int(_np_env) if _np_env else None

# ── Matting defaults ──────────────────────────────────────────────────────────────
# u2netp is the lightweight u2net variant, chosen on MEASURED evidence in the
# backend (see backend/app/services/avatar_matte.py's _REMBG_MODEL comment for the
# numbers): 4.9x faster and 1.6x lighter than u2net_human_seg with no visible
# difference in hair/beard/collar edges at the size an avatar overlay renders.
# Keep this in sync with that constant — the inline matte and the fallback matte
# job must produce identical output.
REMBG_MODEL = "u2netp"

# libvpx-vp9 speed knobs for the PREVIEW twin only.
#   row-mt=1  — row-based multithreading. WITHOUT it libvpx can only split work
#               across TILE COLUMNS, and at avatar resolution there is exactly one
#               tile column, so the encode runs single-threaded no matter how many
#               cores the container has.
#   cpu-used=4 — speed/quality dial (0-8). The default 0 does an exhaustive motion
#               search; 4 is the usual "good enough, much faster" point.
#   threads    — row-mt cannot use cores libvpx does not know exist.
# Safe here specifically because this file is preview-only (see _matte_mp4 step 4):
# the ProRes that actually gets rendered is untouched by these.
VP9_ROW_MT = "1"
VP9_CPU_USED = os.environ.get("MATTE_VP9_CPU_USED", "4")
VP9_THREADS = os.environ.get("MATTE_VP9_THREADS", "4")


@app.function(
    volumes={WEIGHTS_MOUNT: weights_volume},
    timeout=3600,
)
def download_weights(force: bool = False):
    """
    ONE-TIME: pull ~20GB into the Volume. Run with `modal run app.py::download_weights`.

    This is the whole point of the Modal port: the HF Space repeats this download on
    every boot because its disk is ephemeral. Here it happens once and every later cold
    start just mounts it.
    """
    from huggingface_hub import snapshot_download

    missing = [
        f for f in REQUIRED_WEIGHT_FILES
        if not os.path.exists(os.path.join(WEIGHTS_MOUNT, f))
    ]
    if not missing and not force:
        print(f"weights already present in Volume ({WEIGHTS_MOUNT}); nothing to do")
        return

    print(f"missing {len(missing)} required file(s); downloading -> {WEIGHTS_MOUNT}")
    for repo_id, subdir, allow_patterns in WEIGHT_REPOS:
        target = os.path.join(WEIGHTS_MOUNT, subdir)
        os.makedirs(target, exist_ok=True)
        print(f"  {repo_id} -> {target}")
        snapshot_download(
            repo_id=repo_id,
            local_dir=target,
            allow_patterns=allow_patterns,
            token=os.environ.get("HF_TOKEN") or None,
        )

    weights_volume.commit()

    still_missing = [
        f for f in REQUIRED_WEIGHT_FILES
        if not os.path.exists(os.path.join(WEIGHTS_MOUNT, f))
    ]
    if still_missing:
        raise RuntimeError(f"download finished but files are still missing: {still_missing}")

    total = sum(
        os.path.getsize(os.path.join(root, f))
        for root, _, files in os.walk(WEIGHTS_MOUNT) for f in files
    )
    print(f"OK — weights in Volume, {total / 1e9:.1f} GB")


@app.cls(
    gpu=GPU_TYPE,
    volumes={WEIGHTS_MOUNT: weights_volume},
    secrets=[modal.Secret.from_name("omniavatar-secret")],  # provides AVATAR_SERVICE_SECRET
    timeout=1800,                       # Modal's 300s default is far below a render
    scaledown_window=SCALEDOWN_WINDOW,  # default 2s (Modal's min): never bill idle GPU
    min_containers=0,                   # true scale-to-zero: $0 between renders
    # One container == one L40S == one render. Raising this lets a multi-scene
    # batch render N scenes on N SEPARATE GPUs simultaneously, so the batch takes
    # as long as its SLOWEST scene instead of the SUM of all of them (measured:
    # 5 scenes = 26 min sequential vs ~6 min parallel). Total cost is unchanged —
    # billing is per GPU-second, so 5 GPUs x 5 min == 1 GPU x 25 min — apart from
    # each container paying its own ~6s cold start and ~14s idle tail (~$0.05).
    # This is a hard cost ceiling: at most this many L40S can ever bill at once.
    # MUST be >= backend AVATAR_CONCURRENCY, or the extra jobs just queue here.
    max_containers=int(os.environ.get("MODAL_MAX_CONTAINERS", "5")),
)
@modal.concurrent(max_inputs=1)         # one render at a time per container
class OmniAvatarService:
    @modal.enter()
    def setup(self):
        """
        Point the config's expected weights path at the mounted Volume. Runs once per
        container, before any request is routed here — so a cold start pays this, not
        the first render's latency measurement.
        """
        import shutil

        os.makedirs(os.path.dirname(WEIGHTS_DIR), exist_ok=True)
        # The config wants pretrained_models/ inside the repo; the Volume is mounted
        # elsewhere. A symlink avoids copying 20GB on every boot.
        if os.path.islink(WEIGHTS_DIR) or os.path.exists(WEIGHTS_DIR):
            if os.path.islink(WEIGHTS_DIR):
                os.unlink(WEIGHTS_DIR)
            elif os.path.isdir(WEIGHTS_DIR):
                shutil.rmtree(WEIGHTS_DIR)
        os.symlink(WEIGHTS_MOUNT, WEIGHTS_DIR)

        missing = [
            f for f in REQUIRED_WEIGHT_FILES
            if not os.path.exists(os.path.join(WEIGHTS_DIR, f))
        ]
        if missing:
            raise RuntimeError(
                f"weights missing from Volume: {missing}. "
                f"Run `modal run app.py::download_weights` first."
            )
        # numpy is the ONE package OmniAvatar and rembg both depend on, and
        # OmniAvatar's 1.26.4 pin is load-bearing (see the image build comments).
        # rembg's tree — opencv, scikit-image, pymatting — will happily upgrade
        # past it, which is why the image re-pins numpy AFTER installing them.
        # Asserting the result at boot rather than trusting the ordering: the
        # CUDA-provider fallback already proved that a silent regression here is
        # the expensive kind, costing a full render to notice.
        import numpy

        if numpy.__version__ != "1.26.4":
            raise RuntimeError(
                f"numpy is {numpy.__version__}, expected 1.26.4 — something in the "
                f"rembg dependency tree upgraded it past OmniAvatar's pin. Check the "
                f"pip_install ordering in this file's `image` definition."
            )
        print(
            f">>> [setup] weights ready via {WEIGHTS_MOUNT} -> {WEIGHTS_DIR} "
            f"(numpy {numpy.__version__})",
            flush=True,
        )

    @modal.asgi_app()
    def web(self):
        import glob
        import shutil
        import subprocess
        import time
        import uuid

        from fastapi import FastAPI, File, Form, HTTPException, UploadFile
        from fastapi.responses import FileResponse, JSONResponse

        AVATAR_CACHE_DIR = "/tmp/avatars"
        RENDER_WORK_DIR = os.path.join(AVATAR_CACHE_DIR, "renders")
        OUTPUT_ROOT = os.path.join(OMNIAVATAR_DIR, "demo_out")
        SHARED_SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")

        web_app = FastAPI()

        # Built lazily and reused for the container's lifetime. Constructing a
        # session loads the ONNX weights; doing that per frame (or even per render)
        # would dominate the matte's runtime. A list is used as the cell because
        # this closes over web()'s scope rather than module scope.
        _rembg_session_cell = []

        def _get_rembg_session():
            if not _rembg_session_cell:
                from rembg import new_session
                t = time.time()
                session = new_session(REMBG_MODEL)
                _rembg_session_cell.append(session)

                # Report which execution provider ACTUALLY got used, not which one
                # we asked for. onnxruntime falls back to CPU silently when the
                # CUDA provider cannot load (a CUDA 11 build on this CUDA 12 image
                # does exactly that — see the onnxruntime-gpu pin), so without this
                # line a matte quietly running ~10x slower looks identical in the
                # logs to one on the GPU. It cost a full render to notice once.
                try:
                    providers = session.inner_session.get_providers()
                except Exception:
                    providers = ["<unknown>"]
                on_gpu = any("CUDA" in p for p in providers)
                print(
                    f">>> [matte] rembg session ready ({REMBG_MODEL}) "
                    f"in {time.time() - t:.1f}s providers={providers} "
                    f"{'GPU' if on_gpu else 'CPU (!! CUDA provider did not load)'}",
                    flush=True,
                )
            return _rembg_session_cell[0]

        @web_app.middleware("http")
        async def check_secret(request, call_next):
            if request.headers.get("x-avatar-key") != SHARED_SECRET:
                return JSONResponse({"detail": "unauthorized"}, status_code=401)
            return await call_next(request)

        def _preset_image_path(preset_id):
            fname = PRESET_IMAGE_FILE.get(preset_id)
            if not fname:
                return None
            path = os.path.join(PRESETS_DIR, fname)
            return path if os.path.exists(path) else None

        def _write_input_file(input_path, prompt, image_path, audio_path):
            """OmniAvatar reads an --input_file whose line is
            `prompt@@img_path@@audio_path`, paths relative to the CWD it runs in."""
            def rel(p):
                return os.path.relpath(p, OMNIAVATAR_DIR)

            safe_prompt = prompt.replace("@@", " ").replace("\n", " ").strip()
            with open(input_path, "w") as f:
                f.write(f"{safe_prompt}@@{rel(image_path)}@@{rel(audio_path)}\n")

        def _audio_duration_seconds(path):
            """Best-effort ffprobe duration — only enriches timing logs, must never
            fail a render."""
            try:
                out = subprocess.run(
                    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                     "-of", "default=nw=1:nk=1", path],
                    capture_output=True, text=True, timeout=20,
                )
                return float(out.stdout.strip())
            except Exception:
                return 0.0

        def _multipart_response(parts, headers):
            """Build a multipart/form-data body carrying several files.

            Hand-rolled rather than pulling in requests_toolbelt: the body is a few
            lines of well-specified framing (RFC 7578), and this image's dependency
            list is load-bearing enough already (see the pin comments on `image`).
            The backend parses it with the stdlib `email` package for the same
            reason.

            Files are read fully into memory. That is fine at these sizes — an mp4
            plus its two cutouts for a ~10s clip — and the container is discarded
            immediately after the response anyway.
            """
            from fastapi.responses import Response

            boundary = f"----omniavatar{uuid.uuid4().hex}"
            chunks = []
            for name, filename, content_type, path in parts:
                with open(path, "rb") as f:
                    body = f.read()
                chunks.append(
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="{name}"; '
                    f'filename="{filename}"\r\n'
                    f"Content-Type: {content_type}\r\n\r\n".encode()
                )
                chunks.append(body)
                chunks.append(b"\r\n")
            chunks.append(f"--{boundary}--\r\n".encode())
            return Response(
                content=b"".join(chunks),
                media_type=f"multipart/form-data; boundary={boundary}",
                headers=headers,
            )

        def _probe_fps(src):
            """Source frame rate, so the matte plays at the same speed as the mp4.

            Falls back to 25 rather than raising — a slightly wrong fps beats
            losing the whole matte."""
            try:
                out = subprocess.run(
                    ["ffprobe", "-v", "error", "-select_streams", "v:0",
                     "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", src],
                    capture_output=True, text=True, timeout=30,
                ).stdout.strip()
                # ffprobe reports a rational like "25/1"; ffmpeg accepts it as-is.
                if out and "/" in out and not out.startswith("0"):
                    return out
            except Exception:
                pass
            return "25"

        def _matte_mp4(mp4_path, work_dir, rid):
            """Cut the presenter out of a rendered mp4 -> transparent .mov + .webm.

            Returns (mov_path, webm_path, timings). RAISES on failure — the caller
            wraps this so a matte failure never costs the render that already paid
            for a GPU.

            WHY TWO OUTPUT FILES. They are not redundant:

              - RENDER needs ProRes 4444. VP9/WebM alpha does NOT survive a real
                decode: confirmed with system ffmpeg (`-vf alphaextract` yields a
                flat, non-varying mask even though the container claims
                `alpha_mode=1`), and separately confirmed inside Remotion's own
                compositor via a real render (solid black box, whatever WebM
                encoding trick was used). ProRes 4444 is the only format verified
                in this codebase to carry a REAL, VARYING alpha channel through an
                encode -> decode round trip. It also requires `transparent` on the
                `<OffthreadVideo>` that reads it (remotion-video/src/components/
                AvatarOverlay.tsx) — without that prop even correct ProRes renders
                as an opaque box, because Remotion's global config
                (`Config.setVideoImageFormat("jpeg")`) has no alpha by default.

              - PREVIEW needs WebM. Chromium's <video> element (used by the editor
                Player, frontend/src/components/remotion/AvatarOverlay.tsx) has no
                ProRes decoder at all. This twin is NOT expected to composite
                pixel-perfectly with the ProRes render — it only has to look right
                in a browser <video> tag.

            Ported from backend/app/services/avatar_matte.py, which remains the
            fallback path for re-mattes and for clips rendered before this existed.
            """
            from rembg import remove

            fps = _probe_fps(mp4_path)
            frames_dir = os.path.join(work_dir, "frames_in")
            cut_dir = os.path.join(work_dir, "frames_out")
            os.makedirs(frames_dir, exist_ok=True)
            os.makedirs(cut_dir, exist_ok=True)

            # 1. Explode to PNG frames.
            t = time.time()
            subprocess.run(
                ["ffmpeg", "-y", "-i", mp4_path, os.path.join(frames_dir, "%06d.png")],
                capture_output=True, timeout=600, check=True,
            )
            explode_s = time.time() - t
            names = sorted(n for n in os.listdir(frames_dir) if n.endswith(".png"))
            if not names:
                raise RuntimeError("ffmpeg produced no frames from the rendered mp4")
            # PNG is lossless: a few hundred frames is easily hundreds of MB, which
            # matters as much as memory on a container with finite disk.
            frames_mb = sum(
                os.path.getsize(os.path.join(frames_dir, n)) for n in names
            ) / (1024 * 1024)

            # 2. Cut the presenter out of every frame. The session is built ONCE
            #    (loading the ONNX weights per frame would dominate the runtime)
            #    and reused for the container's lifetime.
            t = time.time()
            session = _get_rembg_session()
            for name in names:
                with open(os.path.join(frames_dir, name), "rb") as f:
                    data = f.read()
                cut = remove(data, session=session)
                with open(os.path.join(cut_dir, name), "wb") as f:
                    f.write(cut)
            rembg_s = time.time() - t

            # 3. ProRes 4444 — the file the final video render actually uses.
            mov_path = os.path.join(work_dir, f"{rid}.mov")
            t = time.time()
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-framerate", fps,
                    "-i", os.path.join(cut_dir, "%06d.png"),
                    "-c:v", "prores_ks",
                    "-profile:v", "4444",
                    "-pix_fmt", "yuva444p10le",
                    # Without this, prores_ks defaults to NEAR-LOSSLESS, which is
                    # enormously wasteful here: the clip is 720x400, renders at
                    # 16-32% of frame width, and the pipeline's final output is
                    # h264 anyway — so the preserved detail is thrown away one
                    # step later. The file, not the GPU, is the bottleneck: a 57.7MB
                    # ProRes took ~890s to transfer against 370s of actual compute.
                    #
                    # MEASURED on a real 358-frame clip, re-encoding the lossless
                    # original at several quantisers:
                    #
                    #   qscale   size     alpha PSNR   RGB PSNR
                    #   (none)   57.7MB   —            —
                    #   7        26.9MB   inf          59.2 dB
                    #   9        24.8MB   inf          57.5 dB
                    #   11       23.4MB   inf          56.0 dB   <- chosen
                    #   13       22.3MB   inf          54.9 dB
                    #
                    # ALPHA IS BIT-IDENTICAL AT EVERY SETTING (mse 0.00, psnr inf
                    # across all 300 compared frames): ProRes 4444 keeps the alpha
                    # plane mathematically lossless and quantises only the colour
                    # planes. So the obvious worry — quantisation fraying the hair
                    # and collar edges into a halo — cannot happen here. Only the
                    # colour is touched, and 56 dB is far past the ~40 dB usually
                    # called visually lossless.
                    #
                    # 11 rather than 13 because the curve has flattened by then:
                    # 13 saves ~1MB more for another 1 dB. Lower the number if the
                    # roster ever gains a preset where colour fidelity matters more.
                    "-qscale:v", "11",
                    mov_path,
                ],
                capture_output=True, timeout=900, check=True,
            )
            prores_s = time.time() - t

            # 4. WebM — browser-preview twin only.
            #    -auto-alt-ref 0 is REQUIRED: with alt-ref frames enabled
            #    libvpx-vp9 silently discards the alpha plane in some players.
            webm_path = os.path.join(work_dir, f"{rid}.webm")
            t = time.time()
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-framerate", fps,
                    "-i", os.path.join(cut_dir, "%06d.png"),
                    "-c:v", "libvpx-vp9",
                    "-pix_fmt", "yuva420p",
                    "-auto-alt-ref", "0",
                    "-b:v", "0", "-crf", "30",
                    "-row-mt", VP9_ROW_MT,
                    "-cpu-used", VP9_CPU_USED,
                    "-threads", VP9_THREADS,
                    webm_path,
                ],
                capture_output=True, timeout=900, check=True,
            )
            webm_s = time.time() - t

            # The PNG working set is the largest thing on disk by far and is dead
            # the moment both encodes are done. Drop it before the response streams
            # the two videos back.
            shutil.rmtree(frames_dir, ignore_errors=True)
            shutil.rmtree(cut_dir, ignore_errors=True)

            timings = {
                "frames": len(names),
                "frames_mb": frames_mb,
                "explode_s": explode_s,
                "rembg_s": rembg_s,
                "prores_s": prores_s,
                "webm_s": webm_s,
                "total_s": explode_s + rembg_s + prores_s + webm_s,
            }
            print(
                f">>> [matte] TIMING rid={rid} total={timings['total_s']:.1f}s "
                f"explode={explode_s:.1f}s ({len(names)} frames, {frames_mb:.0f}MB) "
                f"rembg={rembg_s:.1f}s ({rembg_s / max(len(names), 1):.3f}s/frame) "
                f"prores={prores_s:.1f}s webm={webm_s:.1f}s "
                f"size={os.path.getsize(mov_path)}B/{os.path.getsize(webm_path)}B",
                flush=True,
            )
            return mov_path, webm_path, timings

        def _safe_render_id(raw):
            """Filesystem-safe token. Becomes the work-dir name AND the input-file
            basename, which OmniAvatar echoes into its output dir (res_<basename>_...),
            giving a collision-free output path."""
            keep = [c if (c.isalnum() or c in ("_", "-")) else "_" for c in (raw or "")]
            token = "".join(keep).strip("_") or f"r{int(time.time() * 1000)}"
            return token[:80]

        @web_app.get("/ping")
        def ping():
            return {"ok": True}

        @web_app.get("/lastlog")
        def lastlog():
            """Debug: the most recent render's streamed stdout."""
            logs = sorted(
                glob.glob(os.path.join(RENDER_WORK_DIR, "*", "render_stdout.log")),
                key=os.path.getmtime,
            )
            last_stdout, last_path = "", None
            if logs:
                last_path = logs[-1]
                with open(last_path) as f:
                    last_stdout = f.read()
            return {
                "gpu": GPU_TYPE,
                "scaledown_window": SCALEDOWN_WINDOW,
                "last_stdout_path": last_path,
                "last_stdout_tail": "\n".join(last_stdout.splitlines()[-80:]),
            }

        # NOTE: there is no /prepare endpoint. It used to stage a portrait to
        # container-local disk for a later /render, which is unsound here: with
        # scaledown_window=2s and min_containers=0 the two requests routinely land
        # on different containers, so the staged file was gone by render time. A
        # portrait now arrives WITH the render (see the `image` param below), and
        # bundled presets are resolved from the image itself — neither needs state
        # to survive between requests.

        @web_app.post("/render")
        def render(
            avatar_id: str = Form(...),
            audio: UploadFile = File(...),
            # The portrait, sent WITH the render. Optional so an older backend that
            # still calls /prepare first is unaffected.
            #
            # This exists because /prepare -> /render is not survivable at
            # scaledown_window=2s: the two calls routinely land on different
            # containers, and a `custom` portrait staged on the first is gone by the
            # time the second runs (bundled presets are immune — they ship in the
            # image). Carrying the bytes inline removes the shared state entirely,
            # so there is no window to lose them in.
            image: UploadFile = File(None),
            render_id: str = Form(None),
            prompt: str = Form(DEFAULT_PROMPT),
            steps: int = Form(DEFAULT_STEPS),
            guidance_scale: float = Form(DEFAULT_GUIDANCE),
            max_tokens: int = Form(DEFAULT_MAX_TOKENS),
            tea_cache: float = Form(DEFAULT_TEA_CACHE),
            seed: int = Form(DEFAULT_SEED),
            fps: int = Form(DEFAULT_FPS),
            # Cut the presenter out in THIS container, right after inference, and
            # return the transparent twins alongside the mp4. Defaults to on; the
            # backend sends it explicitly (settings.AVATAR_INLINE_MATTE) so matting
            # can be switched off without redeploying this service.
            inline_matte: bool = Form(True),
        ):
            """audio + avatar_id (+ optional inline portrait) -> lip-synced mp4.

            RESPONSE SHAPE. With inline_matte off (or when matting fails) this
            returns the mp4 alone as video/mp4, exactly as it always did. With a
            successful matte it returns multipart/form-data with three parts:

                video   video/mp4         the render          (ALWAYS present)
                matte   video/quicktime   ProRes 4444 cutout
                preview video/webm        browser-preview cutout

            Bytes, never paths: this container's filesystem is destroyed ~2s after
            the response (scaledown_window), so a path here would be meaningless to
            the caller. The backend constructs its own paths and uploads to R2.
            """
            print(
                f">>> [render] REQUEST avatar={avatar_id!r} render_id={render_id!r} "
                f"steps={steps} fps={fps} gpu={GPU_TYPE} inline_image={image is not None}",
                flush=True,
            )

            rid = _safe_render_id(render_id or f"{avatar_id}_{int(time.time() * 1000)}")
            work_dir = os.path.join(RENDER_WORK_DIR, rid)
            os.makedirs(work_dir, exist_ok=True)

            # Resolve the portrait — exactly two sources, both self-contained:
            #
            #   1. an uploaded `image`, written into THIS render's work_dir
            #   2. a bundled roster preset, self-staged from the container image
            #
            # (1) goes to work_dir (unique per rid) rather than the shared
            # /tmp/avatars/<id>/ slot ON PURPOSE. Every custom portrait arrives as
            # avatar_id="custom", so that slot is one path shared by every project —
            # writing there would let a reused container serve SOMEONE ELSE'S face.
            # Per-render means that cannot happen, and it self-cleans with the render.
            #
            # (2) is why bundled presets need no upload at all: re-copying a file
            # that already ships in the image is free.
            image_path = None
            if image is not None:
                ext = (image.filename or "source.jpg").rsplit(".", 1)[-1].lower()
                if ext not in ("jpg", "jpeg", "png", "webp"):
                    ext = "jpg"
                image_path = os.path.join(work_dir, f"source.{ext}")
                with open(image_path, "wb") as f:
                    f.write(image.file.read())
                print(f">>> [render] using inline portrait for {avatar_id!r}", flush=True)

            if image_path is None:
                bundled = _preset_image_path(avatar_id)
                if bundled:
                    avatar_dir = os.path.join(AVATAR_CACHE_DIR, avatar_id)
                    os.makedirs(avatar_dir, exist_ok=True)
                    ext = bundled.rsplit(".", 1)[-1].lower()
                    if ext not in ("jpg", "jpeg", "png", "webp"):
                        ext = "jpg"
                    staged = os.path.join(avatar_dir, f"source.{ext}")
                    shutil.copyfile(bundled, staged)
                    print(f">>> [render] re-staged bundled portrait for {avatar_id!r}", flush=True)
                    image_path = staged

            if image_path is None:
                # A non-roster id with no portrait attached. Nothing to fall back
                # to: /prepare is gone, so there is no staged-file lookup left.
                raise HTTPException(
                    404,
                    f"no portrait for avatar {avatar_id}: it is not a bundled preset "
                    f"(known: {sorted(PRESET_IMAGE_FILE)}) and no 'image' was sent "
                    f"with this render",
                )

            audio_ext = (audio.filename or "input.wav").rsplit(".", 1)[-1].lower()
            if audio_ext not in ("wav", "mp3", "m4a", "flac", "ogg"):
                audio_ext = "wav"
            audio_path = os.path.join(work_dir, f"input_audio.{audio_ext}")
            with open(audio_path, "wb") as f:
                f.write(audio.file.read())

            render_start = time.time()

            input_path = os.path.join(work_dir, f"infer_{rid}.txt")
            _write_input_file(input_path, prompt, image_path, audio_path)

            # --hp overrides the YAML config (comma-separated key=value).
            hp_parts = [
                f"tea_cache_l1_thresh={tea_cache}",
                f"guidance_scale={guidance_scale}",
                f"num_steps={steps}",
                f"max_tokens={max_tokens}",
                f"seed={seed}",
                f"fps={fps}",
                "sp_size=1",
            ]
            # Omitted entirely on 48GB so the config default (DiT resident) wins.
            if NUM_PERSISTENT_PARAM_IN_DIT is not None:
                hp_parts.insert(0, f"num_persistent_param_in_dit={NUM_PERSISTENT_PARAM_IN_DIT}")
            hp = ",".join(hp_parts)

            # torchrun is REQUIRED even on one GPU: OmniAvatar's inference calls
            # dist.init_process_group('nccl') and needs a rendezvous regardless.
            cmd = [
                "torchrun", "--standalone", "--nproc_per_node=1",
                "scripts/inference.py",
                "--config", "configs/inference_1.3B.yaml",
                "--input_file", os.path.relpath(input_path, OMNIAVATAR_DIR),
                f"--hp={hp}",
            ]
            print(f">>> [render] inference (rid={rid}): {' '.join(cmd)}", flush=True)

            gpu_start = time.time()
            stdout_log_path = os.path.join(work_dir, "render_stdout.log")
            with open(stdout_log_path, "w") as logf:
                proc = subprocess.Popen(
                    cmd, cwd=OMNIAVATAR_DIR,
                    env={**os.environ, "MASTER_ADDR": "127.0.0.1"},
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, bufsize=1,
                )
                for line in proc.stdout:
                    logf.write(line)
                    logf.flush()
                proc.wait()
                returncode = proc.returncode
            gpu_s = time.time() - gpu_start

            if returncode != 0:
                with open(stdout_log_path) as f:
                    tail = "\n".join(f.read().splitlines()[-40:])
                print(f">>> [render] FAILED rc={returncode} rid={rid} gpu={gpu_s:.1f}s\n{tail}",
                      flush=True)
                raise HTTPException(502, f"OmniAvatar inference failed (rc={returncode}):\n{tail}")

            # Output lands under demo_out/<exp>/res_infer_<rid>_.../ — scoped to this
            # rid so nothing else can be picked up.
            scoped = glob.glob(
                os.path.join(OUTPUT_ROOT, "**", f"res_infer_{rid}_*", "**", "*.mp4"),
                recursive=True,
            )
            candidates = scoped or [
                p for p in glob.glob(os.path.join(OUTPUT_ROOT, "**", "*.mp4"), recursive=True)
                if os.path.getmtime(p) >= render_start - 1
            ]
            if not candidates:
                raise HTTPException(502, f"OmniAvatar ran but produced no mp4 under {OUTPUT_ROOT}")
            output_path = max(candidates, key=os.path.getmtime)

            total_s = time.time() - render_start
            audio_s = _audio_duration_seconds(audio_path)
            ratio = f"{gpu_s / audio_s:.1f}x" if audio_s else "n/a"
            print(
                f">>> [render] TIMING rid={rid} total={total_s:.1f}s gpu={gpu_s:.1f}s "
                f"audio={audio_s:.1f}s realtime={ratio} steps={steps} "
                f"size={os.path.getsize(output_path)}B",
                flush=True,
            )

            # ── Matte, in this same container ─────────────────────────────────────
            # WRAPPED, and deliberately WITHOUT a retry. The render above has
            # already cost real GPU money; a matte that blows up must never take it
            # down with it, so every failure degrades to "mp4 only" plus an
            # X-Matte-Error the backend records against the scene.
            #
            # No retry because matte failures are DETERMINISTIC (a bad frame, a
            # missing codec, an ffmpeg crash) — unlike render failures, which are
            # usually transient cold-start/5xx and DO get retried by the caller.
            # Retrying here would just hold an L40S for another ~30-60s to fail
            # identically.
            mov_path = webm_path = None
            matte_timings = None
            matte_error = None
            matte_s = 0.0
            if inline_matte:
                t_matte = time.time()
                try:
                    mov_path, webm_path, matte_timings = _matte_mp4(
                        output_path, work_dir, rid
                    )
                except Exception as e:
                    mov_path = webm_path = None
                    matte_error = f"{type(e).__name__}: {e}"[:400]
                    print(
                        f">>> [matte] FAILED rid={rid} after={time.time() - t_matte:.1f}s "
                        f"{matte_error}",
                        flush=True,
                    )
                matte_s = time.time() - t_matte

            wall_s = time.time() - render_start
            # gpu_billed is the HONEST number: the L40S is attached for the whole
            # request, including the matte stages that cannot use it (ffmpeg and
            # both encodes). Logging it separately is what makes the cost of
            # inlining the matte visible rather than theoretical.
            print(
                f">>> [render] TOTAL rid={rid} render={total_s:.1f}s "
                f"matte={matte_s:.1f}s wall={wall_s:.1f}s gpu_billed={wall_s:.1f}s"
                + (" matte=SKIPPED" if not inline_matte else "")
                + (" matte=FAILED" if matte_error else ""),
                flush=True,
            )

            # Same X-Render-* headers as the Space, so the CLI test and any caller
            # read timings identically across providers. queue is always 0 here:
            # Modal gives each render its own container rather than queueing for a
            # GPU slot.
            headers = {
                "X-Render-Seconds": f"{total_s:.1f}",
                "X-Render-Queue-Seconds": "0.0",
                "X-Render-Gpu-Seconds": f"{gpu_s:.1f}",
                "X-Render-Audio-Seconds": f"{audio_s:.1f}",
                "X-Render-Id": rid,
                "X-Render-Provider": f"modal-{GPU_TYPE}",
                "X-Render-Wall-Seconds": f"{wall_s:.1f}",
            }
            if matte_timings:
                headers.update({
                    "X-Matte-Seconds": f"{matte_s:.1f}",
                    "X-Matte-Explode-Seconds": f"{matte_timings['explode_s']:.1f}",
                    "X-Matte-Rembg-Seconds": f"{matte_timings['rembg_s']:.1f}",
                    "X-Matte-Prores-Seconds": f"{matte_timings['prores_s']:.1f}",
                    "X-Matte-Webm-Seconds": f"{matte_timings['webm_s']:.1f}",
                    "X-Matte-Frames": str(matte_timings["frames"]),
                })
            if matte_error:
                headers["X-Matte-Error"] = matte_error

            # No matte (disabled or failed) -> the ORIGINAL single-file contract,
            # byte for byte. An older backend that has not learned multipart yet
            # keeps working, and so does the CLI test.
            if not (mov_path and webm_path):
                return FileResponse(
                    output_path,
                    media_type="video/mp4",
                    filename=f"{rid}.mp4",
                    headers=headers,
                )

            return _multipart_response(
                [
                    ("video", f"{rid}.mp4", "video/mp4", output_path),
                    ("matte", f"{rid}.mov", "video/quicktime", mov_path),
                    ("preview", f"{rid}.webm", "video/webm", webm_path),
                ],
                headers,
            )

        return web_app
