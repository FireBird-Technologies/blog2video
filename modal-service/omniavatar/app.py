"""
OmniAvatar-1.3B on Modal serverless GPU — an alternative INFERENCE PROVIDER to the
HuggingFace Space at hf-space/omniavatar-service/.

Endpoint contract is IDENTICAL to the Space (GET /ping, POST /prepare, POST /render,
GET /lastlog), so backend/app/services/avatar.py works against either host with no
code change — only AVATAR_SERVICE_URL differs. This file exists to measure cold-start
and generation time against the Space's recorded baseline; the app integration is
deliberately untouched.

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
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
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
        print(f">>> [setup] weights ready via {WEIGHTS_MOUNT} -> {WEIGHTS_DIR}", flush=True)

    @modal.asgi_app()
    def web(self):
        import glob
        import shutil
        import subprocess
        import time

        from fastapi import FastAPI, File, Form, HTTPException, UploadFile
        from fastapi.responses import FileResponse, JSONResponse

        AVATAR_CACHE_DIR = "/tmp/avatars"
        RENDER_WORK_DIR = os.path.join(AVATAR_CACHE_DIR, "renders")
        OUTPUT_ROOT = os.path.join(OMNIAVATAR_DIR, "demo_out")
        SHARED_SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")

        web_app = FastAPI()

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
        ):
            """audio + avatar_id (+ optional inline portrait) -> lip-synced mp4 bytes."""
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

            # Same headers as the Space, so the CLI test and any caller read timings
            # identically across providers. queue is always 0 here: Modal gives each
            # render its own container rather than queueing for a GPU slot.
            return FileResponse(
                output_path,
                media_type="video/mp4",
                filename=f"{rid}.mp4",
                headers={
                    "X-Render-Seconds": f"{total_s:.1f}",
                    "X-Render-Queue-Seconds": "0.0",
                    "X-Render-Gpu-Seconds": f"{gpu_s:.1f}",
                    "X-Render-Audio-Seconds": f"{audio_s:.1f}",
                    "X-Render-Id": rid,
                    "X-Render-Provider": f"modal-{GPU_TYPE}",
                },
            )

        return web_app
