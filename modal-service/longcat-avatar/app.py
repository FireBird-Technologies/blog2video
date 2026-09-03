"""
LongCat-Video-Avatar-1.5 on Modal serverless GPU — the second avatar rendering provider
(alongside modal-service/omniavatar/, OmniAvatar-1.3B) being integrated into blog2video as
an opt-in "Premium" tier. See docs/longcat-avatar.md for the standalone eval this grew out
of (real render-time/VRAM/cost numbers) and the plan this integration follows.

Bundles the same two-person roster as modal-service/omniavatar/ (avatar_presets/), so a
roster preset choice behaves identically on either provider — only a `custom` portrait needs
its bytes sent inline. See PRESET_IMAGE_FILE below.

Endpoints: GET /ping, GET /lastlog, POST /render. Modelled on
modal-service/omniavatar/app.py's /render contract (single self-contained request, no
/prepare step, X-Render-* timing headers) so the two are easy to compare.

BACKGROUND: this was first attempted on a Hugging Face Space
(hf-space/longcat-avatar-eval/, repurposing the paused firebird-technologies/
echomimic-service Space). That path got the Docker image building correctly (after
fixing three upstream packaging bugs — see the Dockerfile-equivalent comments below,
which carry over unchanged) but then stalled in APP_STARTING with hardware.current still
null for an extended period — HF's L40S provisioning queue, not anything in this code.
Moved to Modal per instruction, reusing the OmniAvatar Modal app's proven image-build
pattern and the exact same dependency fixes already discovered on HF.

GPU: LongCat-Video-Avatar-1.5 needs ~44GB of weights (see WEIGHT_REPOS below) plus
activation memory for a 13.6B-param DiT (INT8) + UMT5 text encoder (bf16) + Whisper-large-v3.
Starting on A100-80GB for headroom; L40S (48GB, OmniAvatar's card) is the fallback if 80GB
proves unnecessary once real numbers exist.

Usage:
    modal run    app.py::download_weights    # one time, ~44GB -> Volume (filtered, see fn)
    modal deploy app.py                      # prints the https://...modal.run URL
    modal serve  app.py                      # ephemeral, hot-reloading, for iteration
"""
import os

import modal

APP_NAME = "longcat-avatar-eval"

REPO_DIR = "/root/LongCat-Video"
WEIGHTS_MOUNT = "/weights"                                    # the Volume
CHECKPOINT_DIR = f"{WEIGHTS_MOUNT}/LongCat-Video-Avatar-1.5"   # avatar-specific weights
BASE_MODEL_DIR = f"{WEIGHTS_MOUNT}/LongCat-Video"              # tokenizer/text_encoder/vae only
PRESETS_DIR = "/root/avatar_presets"

# Bundled roster presets — SAME two people, same ids, as
# modal-service/omniavatar/app.py's PRESET_IMAGE_FILE, so a preset choice behaves
# identically regardless of which provider a project uses. Every id here must have its
# .jpg committed under avatar_presets/ (copied into the image wholesale below) — an id
# with no committed portrait resolves to a missing path on a clean deploy, exactly the
# failure mode OmniAvatar's app.py warns about for the same reason.
PRESET_IMAGE_FILE = {
    "woman_red": "candidate_woman1.jpg",
    "man_beard": "candidate_man2.jpg",
}

# Scale-to-zero idle tail. Unlike OmniAvatar's tuned 2s (that model reloads from scratch
# every render regardless of container warmth, so holding a container buys nothing), this
# model's much larger weight set makes container reuse worth exploring — TODO once real
# render-time numbers exist: is a warm container meaningfully faster than a cold one here.
# Starting conservative at Modal's minimum until that's measured.
SCALEDOWN_WINDOW = int(os.environ.get("MODAL_SCALEDOWN_WINDOW", "60"))
# Hardcoded to H100 for this testing round (text_guidance_scale experiment,
# 2026-09-03) — the MODAL_GPU env var did not take effect through `modal deploy`
# (deploy still resolved A100-80GB despite MODAL_GPU=H100 being set in the
# invoking shell), so this is a deliberate override rather than the env-var
# indirection. Revert to A100-80GB (or restore the env var pattern) once this
# testing round is done, unless H100 is kept intentionally.
GPU_TYPE = "H100"

# Single-GPU by default. Upstream's README only documents
# `--nproc_per_node=2 --context_parallel_size=2`, but reading
# run_demo_avatar_single_audio_to_video.py directly shows `--context_parallel_size`
# defaults to 1 in its own argparse definition, and dist.init_process_group is called
# unconditionally regardless of world size — a single-process run is a real, supported
# code path, not a hack. See docs/longcat-avatar.md for whether this holds up in practice.
NPROC_PER_NODE = int(os.environ.get("LONGCAT_NPROC_PER_NODE", "1"))
CONTEXT_PARALLEL_SIZE = int(os.environ.get("LONGCAT_CONTEXT_PARALLEL_SIZE", "1"))
USE_INT8 = os.environ.get("LONGCAT_USE_INT8", "true").lower() != "false"
RESOLUTION = os.environ.get("LONGCAT_RESOLUTION", "480p")  # 480p | 720p

# ── Image ─────────────────────────────────────────────────────────────────────────
# Ubuntu 22.04 + CUDA 12.4 runtime (NOT devel — see the flash-attn step below for why
# that's deliberate). Version pins mirror what's documented in meituan-longcat/LongCat-
# Video's own README, plus three fixes discovered the hard way on the HF Spaces attempt
# at this same deployment (see hf-space/longcat-avatar-eval/Dockerfile's history / this
# file's module docstring) — do not "simplify" these away without re-verifying a build.
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04", add_python="3.10"
    )
    .apt_install("git", "wget", "curl", "ffmpeg", "build-essential", "pkg-config", "libsndfile1")
    .run_commands(
        f"git clone --depth 1 https://github.com/meituan-longcat/LongCat-Video.git {REPO_DIR}"
    )
    .workdir(REPO_DIR)
    # FIX #4: run_demo_avatar_single_audio_to_video.py hardcodes
    # text_guidance_scale=audio_guidance_scale=1.0 whenever use_distill and
    # model_type=="avatar-v1.5" are both set — which is EVERY render this service
    # makes (--use_distill is required for v1.5 per upstream's own README). This
    # strips the hardcoded 1.0 overwrite for text_guidance_scale ONLY, letting the
    # --text_guidance_scale CLI flag actually take effect (leaves
    # audio_guidance_scale's override alone — that governs lip-sync, not motion
    # style/the experiment below).
    #
    # TESTED 2026-09-03 at text_guidance_scale=4.0 (the script's own un-distilled
    # default) — motion output was STILL frame-identical to guidance=1.0 across
    # every prompt tried, so this alone is NOT the fix for prompt-driven motion
    # control (kept anyway: it is a real, correctly-functioning knob per the
    # pipeline's CFG math, just not the bottleneck here). See FIX #5 below for the
    # actual suspect, found via meituan-longcat/LongCat-Video#120.
    .run_commands(
        "sed -i "
        "'/if use_distill and model_type == \"avatar-v1.5\":/,+2{/text_guidance_scale = 1.0/d}' "
        "run_demo_avatar_single_audio_to_video.py"
    )
    # FIX #5: the REAL suspect for "prompt doesn't affect motion", per
    # meituan-longcat/LongCat-Video#120 — a GitHub issue reporting this EXACT
    # symptom ("Excessive facial expression and motion in v1.5"), where the
    # maintainer (yzhang2016) confirms it is a known, unfixed bug in the public
    # v1.5 checkpoint, and a community member traces it to the DMD distillation
    # LoRA (dmd_lora.safetensors) being loaded at a HARDCODED multiplier=1.0 with
    # no CLI override — applied to every matching Linear layer across the whole
    # DiT (see LongCatVideoAvatarTransformer3DModel.load_lora), not scoped to
    # anything motion-specific, so it can plausibly override/dominate whatever
    # fine-grained conditioning (including text) would otherwise shape the output.
    #
    # This makes the multiplier a real CLI flag (default 1.0 = unchanged
    # behavior) so it can be swept without an image rebuild per attempt. UNTESTED
    # as of this comment — the community's suggested starting point is a low
    # value (~0.1) increased from there; --use_distill (fast, 8-step, LoRA-based)
    # stays the only supported way to run avatar-v1.5 per upstream's README, so
    # this tunes the LoRA's strength rather than disabling distillation outright.
    # Python-based patch, not sed: the insertion needs a literal newline inside a
    # multi-line `a\` append, which is a well-known cross-platform sed footgun
    # (BSD vs GNU sed disagree on the exact escaping) — verified failing under
    # local (BSD) sed during development, so this uses unambiguous str.replace
    # instead of trusting the same quoting to also work under the container's
    # GNU sed untested. Each replace() asserts its target appears EXACTLY once
    # first, so a silent no-op (old text already gone, e.g. upstream renamed
    # something) fails the image build loudly instead of shipping unpatched.
    .run_commands(
        "python3 -c \""
        "path = 'run_demo_avatar_single_audio_to_video.py'; "
        "src = open(path).read(); "
        "old_p = 'parser = argparse.ArgumentParser()'; "
        "assert src.count(old_p) == 1, src.count(old_p); "
        "src = src.replace(old_p, old_p + chr(10) + "
        "    '    parser.add_argument(' + chr(39) + '--dmd_lora_multiplier' + chr(39) + "
        "    ', type=float, default=1.0)', 1); "
        "old_m = 'multiplier=1.0, lora_network_dim=128'; "
        "assert src.count(old_m) == 1, src.count(old_m); "
        "src = src.replace(old_m, 'multiplier=args.dmd_lora_multiplier, lora_network_dim=128', 1); "
        "open(path, 'w').write(src)"
        "\""
    )
    # cu124 torch FIRST from PyTorch's own index — PyPI's default `torch` wheel is CPU-only.
    .pip_install(
        "torch==2.6.0", "torchvision==0.21.0", "torchaudio==2.6.0",
        index_url="https://download.pytorch.org/whl/cu124",
    )
    # FIX #1 (found on the HF Spaces attempt): `pip install flash_attn==2.7.4.post1`
    # tries to build from source, and its setup.py needs BOTH `import torch` at build
    # time (which fails under pip's isolated build env — "ModuleNotFoundError: No
    # module named 'torch'" — hence --no-build-isolation is not even enough on its own)
    # AND nvcc, the CUDA *compiler*, which a cudnn-RUNTIME image deliberately doesn't
    # ship (only the .so runtime libs) — "FileNotFoundError: /usr/local/cuda/bin/nvcc".
    # Switching to a cudnn-DEVEL base just to compile this one package would roughly
    # double image size/build time. Using Dao-AILab's own prebuilt wheel sidesteps both
    # problems entirely. Pinned to the exact torch/python/CUDA/ABI combination installed
    # above; if any of those change, look up the matching wheel name again at
    # https://github.com/Dao-AILab/flash-attention/releases.
    .pip_install("ninja", "psutil", "packaging")
    .run_commands(
        "pip install "
        "\"https://github.com/Dao-AILab/flash-attention/releases/download/"
        "v2.7.4.post1/flash_attn-2.7.4.post1+cu12torch2.6cxx11abiFALSE-"
        "cp310-cp310-linux_x86_64.whl\""
    )
    # FIX #2: upstream's requirements.txt re-lists `torch==2.6.0` and
    # `flash-attn==2.7.4.post1` — a plain `pip install -r requirements.txt` would
    # silently re-pin torch to PyPI's CPU-only default (undoing the cu124 install
    # above) and would try to rebuild flash-attn from source (hitting FIX #1's error
    # again). Both lines are stripped before installing the rest of the file as-is.
    .run_commands(
        "grep -vE '^(torch|flash-attn)==' requirements.txt > requirements.fixed.txt "
        "&& pip install -r requirements.fixed.txt"
    )
    # FIX #3: upstream's requirements_avatar.txt has two bogus/non-existent PyPI pins:
    #   - `libsndfile1==0.0.1` is the Debian/Ubuntu APT package name for the C library
    #     soundfile/librosa link against (already installed via apt above), not a real
    #     PyPI package — "No matching distribution found for libsndfile1==0.0.1".
    #   - `tritonserverclient==0.0.6` does not exist on PyPI under that name (the real
    #     NVIDIA Triton client package is `tritonclient`) and is not imported by either
    #     avatar demo script — dropped rather than guessing at a replacement nothing
    #     here actually calls.
    .run_commands(
        "grep -vE '^(libsndfile1|tritonserverclient)==' requirements_avatar.txt "
        "> requirements_avatar.fixed.txt && pip install -r requirements_avatar.fixed.txt"
    )
    .pip_install("fastapi", "uvicorn", "python-multipart", "huggingface_hub", "hf_transfer")
    # numpy re-pin LAST: requirements_avatar.txt's tree (scikit-learn, scikit-image,
    # scipy, onnxruntime) can upgrade numpy past what requirements.txt pinned. Same
    # defensive re-pin modal-service/omniavatar/app.py applies for the identical reason.
    .pip_install("numpy==1.26.4")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
    .add_local_dir(
        os.path.join(os.path.dirname(__file__), "avatar_presets"),
        PRESETS_DIR,
        copy=True,
    )
)

app = modal.App(APP_NAME, image=image)
weights_volume = modal.Volume.from_name("longcat-avatar-weights", create_if_missing=True)

# ── Weights ───────────────────────────────────────────────────────────────────────
# A FILTERED subset of both upstream HF repos — a naive full mirror would be ~158GB
# (74.9GB LongCat-Video-Avatar-1.5 + 83.3GB LongCat-Video), most of which avatar
# inference never touches. See docs/longcat-avatar.md §3 for the full accounting; the
# short version:
#   - LongCat-Video's dit/ (~49GB) is the text/image-to-video model, unused here — only
#     tokenizer/, text_encoder/, vae/ (~22.5GB) are read, via
#     run_demo_avatar_single_audio_to_video.py's
#     os.path.join(checkpoint_dir, '..', 'LongCat-Video') lookup.
#   - LongCat-Video-Avatar-1.5 ships base_model/ (bf16, ~30GB) AND base_model_int8/
#     (~16GB) — only one loads per run, selected by --use_int8. base_model_int8 only,
#     since USE_INT8 defaults True.
#   - whisper-large-v3/ ships the SAME weights four times over (flax, two-part fp32
#     safetensors, two-part fp32 .bin, plus the standard model.safetensors) — only the
#     last (~3.1GB) is needed; transformers picks it up automatically.
# Net: ~44GB instead of ~158GB.
AVATAR_ALLOW_PATTERNS = [
    "base_model_int8/*",
    "lora/*",
    "scheduler/*",
    "vocal_separator/*",
    "whisper-large-v3/config.json",
    "whisper-large-v3/model.safetensors",
    "whisper-large-v3/preprocessor_config.json",
    "whisper-large-v3/tokenizer_config.json",
    "whisper-large-v3/tokenizer.json",
    "whisper-large-v3/vocab.json",
    "whisper-large-v3/merges.txt",
    "whisper-large-v3/normalizer.json",
    "whisper-large-v3/added_tokens.json",
    "whisper-large-v3/special_tokens_map.json",
    "whisper-large-v3/generation_config.json",
    "config.json",
    "model_index.json",
]
BASE_ALLOW_PATTERNS = ["tokenizer/*", "text_encoder/*", "vae/*"]

REQUIRED_WEIGHT_FILES = [
    os.path.join(CHECKPOINT_DIR, "base_model_int8", "config.json"),
    os.path.join(CHECKPOINT_DIR, "lora", "dmd_lora.safetensors"),
    os.path.join(CHECKPOINT_DIR, "scheduler", "scheduler_config.json"),
    os.path.join(CHECKPOINT_DIR, "whisper-large-v3", "model.safetensors"),
    os.path.join(CHECKPOINT_DIR, "vocal_separator", "Kim_Vocal_2.onnx"),
    os.path.join(BASE_MODEL_DIR, "vae", "diffusion_pytorch_model.safetensors"),
]


@app.function(volumes={WEIGHTS_MOUNT: weights_volume}, timeout=3600)
def download_weights(force: bool = False):
    """ONE-TIME: pull the filtered ~44GB into the Volume. Run with
    `modal run app.py::download_weights`."""
    from huggingface_hub import snapshot_download

    missing = [f for f in REQUIRED_WEIGHT_FILES if not os.path.exists(f)]
    if not missing and not force:
        print(f"weights already present in Volume ({WEIGHTS_MOUNT}); nothing to do")
        return

    print(f"missing {len(missing)} required file(s); downloading -> {WEIGHTS_MOUNT}")
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    snapshot_download(
        repo_id="meituan-longcat/LongCat-Video-Avatar-1.5",
        local_dir=CHECKPOINT_DIR,
        allow_patterns=AVATAR_ALLOW_PATTERNS,
    )
    os.makedirs(BASE_MODEL_DIR, exist_ok=True)
    snapshot_download(
        repo_id="meituan-longcat/LongCat-Video",
        local_dir=BASE_MODEL_DIR,
        allow_patterns=BASE_ALLOW_PATTERNS,
    )

    weights_volume.commit()

    still_missing = [f for f in REQUIRED_WEIGHT_FILES if not os.path.exists(f)]
    if still_missing:
        raise RuntimeError(f"download finished but files are still missing: {still_missing}")

    total = sum(
        os.path.getsize(os.path.join(root, f))
        for base in (CHECKPOINT_DIR, BASE_MODEL_DIR)
        for root, _, files in os.walk(base) for f in files
    )
    print(f"OK — weights in Volume, {total / 1e9:.1f} GB")


@app.cls(
    gpu=GPU_TYPE,
    volumes={WEIGHTS_MOUNT: weights_volume},
    secrets=[modal.Secret.from_name("longcat-avatar-secret")],  # provides LONGCAT_SERVICE_SECRET
    timeout=3600,                        # this model is much bigger/slower than OmniAvatar
    scaledown_window=SCALEDOWN_WINDOW,
    min_containers=0,
    # Matches OmniAvatar's default ceiling (modal-service/omniavatar/app.py) now
    # that this is the app's one and only avatar provider — a 5-scene batch
    # renders on 5 separate GPUs in parallel instead of queuing sequentially.
    max_containers=int(os.environ.get("MODAL_MAX_CONTAINERS", "5")),
)
@modal.concurrent(max_inputs=1)
class LongCatAvatarService:
    @modal.enter()
    def setup(self):
        missing = [f for f in REQUIRED_WEIGHT_FILES if not os.path.exists(f)]
        if missing:
            raise RuntimeError(
                f"weights missing from Volume: {missing}. "
                f"Run `modal run app.py::download_weights` first."
            )
        print(f">>> [setup] weights ready via {WEIGHTS_MOUNT}", flush=True)

    @modal.asgi_app()
    def web(self):
        import glob
        import json as json_mod
        import subprocess
        import time

        from fastapi import FastAPI, File, Form, HTTPException, UploadFile
        from fastapi.responses import FileResponse, JSONResponse

        RENDER_WORK_DIR = "/tmp/longcat_renders"
        SHARED_SECRET = os.environ.get("LONGCAT_SERVICE_SECRET", "changeme-dev-secret")
        os.makedirs(RENDER_WORK_DIR, exist_ok=True)

        web_app = FastAPI()

        @web_app.middleware("http")
        async def check_secret(request, call_next):
            if request.headers.get("x-avatar-key") != SHARED_SECRET:
                return JSONResponse({"detail": "unauthorized"}, status_code=401)
            return await call_next(request)

        def _safe_render_id(raw):
            keep = [c if (c.isalnum() or c in ("_", "-")) else "_" for c in (raw or "")]
            token = "".join(keep).strip("_") or f"r{int(time.time() * 1000)}"
            return token[:80]

        def _gpu_memory_gb():
            """Peak/current VRAM usage on this container's GPU, via nvidia-smi —
            evidence for whether a smaller GPU tier could work, since neither Modal's
            CLI nor the render subprocess reports this on its own."""
            try:
                out = subprocess.run(
                    ["nvidia-smi", "--query-gpu=memory.used,memory.total",
                     "--format=csv,noheader,nounits"],
                    capture_output=True, text=True, timeout=10,
                ).stdout.strip()
                used_mb, total_mb = (int(x) for x in out.split(","))
                return {"used_gb": round(used_mb / 1024, 2), "total_gb": round(total_mb / 1024, 2)}
            except Exception as e:
                return {"error": str(e)}

        @web_app.get("/ping")
        def ping():
            return {
                "ok": True, "model": "LongCat-Video-Avatar-1.5", "provider": f"modal-{GPU_TYPE}",
                "gpu_memory": _gpu_memory_gb(),
            }

        @web_app.get("/lastlog")
        def lastlog():
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
                "nproc_per_node": NPROC_PER_NODE,
                "context_parallel_size": CONTEXT_PARALLEL_SIZE,
                "use_int8": USE_INT8,
                "resolution": RESOLUTION,
                "last_stdout_path": last_path,
                "last_stdout_tail": "\n".join(last_stdout.splitlines()[-80:]),
            }

        def _preset_image_path(preset_id):
            fname = PRESET_IMAGE_FILE.get(preset_id)
            if not fname:
                return None
            path = os.path.join(PRESETS_DIR, fname)
            return path if os.path.exists(path) else None

        @web_app.post("/render")
        def render(
            audio: UploadFile = File(...),
            # avatar_id resolves a bundled roster preset (see PRESET_IMAGE_FILE) —
            # matches modal-service/omniavatar/app.py's contract, so the backend
            # sends the SAME request shape to either provider for a roster choice.
            avatar_id: str = Form(None),
            # Optional inline portrait, sent WITH the render — required for a
            # `custom` portrait (no bundled file for it to self-stage), optional
            # otherwise. Exactly one of avatar_id/image must resolve to a real
            # portrait or the request 404s below.
            image: UploadFile = File(None),
            render_id: str = Form(None),
            prompt: str = Form(
                "A person looking at the camera and talking naturally, calm and "
                "friendly, with clear, expressive lip movements that match the audio."
            ),
            stage_1: str = Form("ai2v"),
            resolution: str = Form(None),
            num_segments: int = Form(1),
            ref_img_index: int = Form(10),
            mask_frame_range: int = Form(3),
            use_int8: bool = Form(None),
            # Overrides run_demo_avatar_single_audio_to_video.py's hardcoded
            # text_guidance_scale=1.0 (see FIX #4 in this file's image build).
            # TESTED 2026-09-03 at 4.0 (the script's own un-distilled default):
            # motion output was frame-identical to guidance=1.0 regardless of
            # prompt wording, so this alone does NOT fix prompt-driven motion
            # control. Kept as a real, correctly-functioning CFG knob (confirmed
            # via the pipeline's math) — just not the bottleneck. See
            # dmd_lora_multiplier below for the actual suspect.
            text_guidance_scale: float = Form(4.0),
            # Overrides run_demo_avatar_single_audio_to_video.py's hardcoded
            # DMD distillation LoRA multiplier=1.0 (see FIX #5 in this file's
            # image build) — per meituan-longcat/LongCat-Video#120, this LoRA is
            # applied at full strength across every matching layer in the DiT
            # whenever --use_distill is set (always, for us — required for
            # v1.5), and a maintainer confirms v1.5's motion output has a known,
            # unfixed bug where it does not respond to fine-grained conditioning
            # the way expected. 1.0 = unchanged (full LoRA) behavior; the
            # community's suggested experiment is a low value (~0.1) increased
            # from there. UNTESTED as of this comment.
            dmd_lora_multiplier: float = Form(1.0),
        ):
            """(avatar_id | image) + audio (+ prompt) -> lip-synced mp4. Single
            self-contained request, no /prepare step — same reasoning as
            modal-service/omniavatar/app.py's /render (scale-to-zero makes a
            two-call design unreliable; everything a render needs travels with it)."""
            rid = _safe_render_id(render_id or f"render_{int(time.time() * 1000)}")
            work_dir = os.path.join(RENDER_WORK_DIR, rid)
            os.makedirs(work_dir, exist_ok=True)

            # Resolve the portrait — exactly two sources, both self-contained, same
            # precedence as OmniAvatar's app.py: an uploaded `image` wins if present
            # (covers `custom`), else fall back to a bundled roster preset by id.
            image_path = None
            if image is not None:
                image_ext = (image.filename or "source.png").rsplit(".", 1)[-1].lower()
                if image_ext not in ("jpg", "jpeg", "png", "webp"):
                    image_ext = "png"
                image_path = os.path.join(work_dir, f"source.{image_ext}")
                with open(image_path, "wb") as f:
                    f.write(image.file.read())

            if image_path is None and avatar_id:
                bundled = _preset_image_path(avatar_id)
                if bundled:
                    image_path = bundled

            if image_path is None:
                raise HTTPException(
                    404,
                    f"no portrait for avatar_id={avatar_id!r}: it is not a bundled "
                    f"preset (known: {sorted(PRESET_IMAGE_FILE)}) and no 'image' was "
                    f"sent with this render",
                )

            audio_ext = (audio.filename or "input.wav").rsplit(".", 1)[-1].lower()
            if audio_ext not in ("wav", "mp3", "m4a", "flac", "ogg"):
                audio_ext = "wav"
            audio_path = os.path.join(work_dir, f"input_audio.{audio_ext}")
            with open(audio_path, "wb") as f:
                f.write(audio.file.read())

            input_json_path = os.path.join(work_dir, "input.json")
            with open(input_json_path, "w") as f:
                json_mod.dump(
                    {"prompt": prompt, "cond_image": image_path,
                     "cond_audio": {"person1": audio_path}},
                    f,
                )
            # Logs the EXACT prompt string this render actually conditions on —
            # written from `input.json` right after it lands on disk, so this is
            # ground truth for what the model receives, not what the caller
            # claims to have sent. Added after a caller asked "are you sure
            # you're sending different prompts?" and there was no server-side
            # way to answer that beyond re-deriving it from client-side logs.
            print(f">>> [render] rid={rid!r} prompt={prompt!r}", flush=True)

            resolved_resolution = resolution or RESOLUTION
            resolved_use_int8 = USE_INT8 if use_int8 is None else use_int8
            output_dir = os.path.join(work_dir, "output")
            os.makedirs(output_dir, exist_ok=True)

            cmd = [
                "torchrun", "--standalone", f"--nproc_per_node={NPROC_PER_NODE}",
                os.path.join(REPO_DIR, "run_demo_avatar_single_audio_to_video.py"),
                f"--context_parallel_size={CONTEXT_PARALLEL_SIZE}",
                f"--checkpoint_dir={CHECKPOINT_DIR}",
                f"--stage_1={stage_1}",
                f"--input_json={input_json_path}",
                f"--output_dir={output_dir}",
                f"--resolution={resolved_resolution}",
                f"--num_segments={num_segments}",
                f"--ref_img_index={ref_img_index}",
                f"--mask_frame_range={mask_frame_range}",
                f"--text_guidance_scale={text_guidance_scale}",
                f"--dmd_lora_multiplier={dmd_lora_multiplier}",
                "--model_type=avatar-v1.5",
                "--use_distill",
            ]
            if resolved_use_int8:
                cmd.append("--use_int8")

            print(f">>> [render] REQUEST rid={rid!r} stage_1={stage_1} "
                  f"resolution={resolved_resolution} int8={resolved_use_int8} "
                  f"nproc={NPROC_PER_NODE} cp={CONTEXT_PARALLEL_SIZE} gpu={GPU_TYPE}",
                  flush=True)
            print(f">>> [render] cmd: {' '.join(cmd)}", flush=True)

            # Peak VRAM sampler — polls nvidia-smi on a background thread WHILE the
            # render subprocess runs, since PyTorch may free memory before the process
            # exits (post-render /ping's reading would then undercount). This is the
            # actual evidence for "could a smaller GPU tier hold this model" — Modal's
            # CLI/dashboard doesn't surface per-container peak memory directly.
            import threading
            peak_used_mb = [0]
            stop_sampling = threading.Event()

            def _sample_vram():
                while not stop_sampling.is_set():
                    try:
                        out = subprocess.run(
                            ["nvidia-smi", "--query-gpu=memory.used",
                             "--format=csv,noheader,nounits"],
                            capture_output=True, text=True, timeout=5,
                        ).stdout.strip()
                        used = int(out.splitlines()[0])
                        peak_used_mb[0] = max(peak_used_mb[0], used)
                    except Exception:
                        pass
                    stop_sampling.wait(2.0)

            sampler_thread = threading.Thread(target=_sample_vram, daemon=True)
            sampler_thread.start()

            render_start = time.time()
            stdout_log_path = os.path.join(work_dir, "render_stdout.log")
            with open(stdout_log_path, "w") as logf:
                proc = subprocess.Popen(
                    cmd, cwd=REPO_DIR,
                    env={**os.environ, "MASTER_ADDR": "127.0.0.1"},
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, bufsize=1,
                )
                for line in proc.stdout:
                    logf.write(line)
                    logf.flush()
                proc.wait()
                returncode = proc.returncode
            total_s = time.time() - render_start
            stop_sampling.set()
            sampler_thread.join(timeout=5)
            peak_used_gb = round(peak_used_mb[0] / 1024, 2)
            print(f">>> [render] PEAK VRAM rid={rid} {peak_used_gb}GB", flush=True)

            if returncode != 0:
                with open(stdout_log_path) as f:
                    tail = "\n".join(f.read().splitlines()[-60:])
                print(f">>> [render] FAILED rc={returncode} rid={rid} after={total_s:.1f}s\n{tail}",
                      flush=True)
                raise HTTPException(502, f"LongCat-Video-Avatar inference failed (rc={returncode}):\n{tail}")

            candidates = glob.glob(os.path.join(output_dir, "**", "*.mp4"), recursive=True)
            if not candidates:
                raise HTTPException(502, f"Inference ran but produced no mp4 under {output_dir}")
            output_path = max(candidates, key=os.path.getmtime)

            print(f">>> [render] TIMING rid={rid} total={total_s:.1f}s "
                  f"size={os.path.getsize(output_path)}B", flush=True)

            headers = {
                "X-Render-Seconds": f"{total_s:.1f}",
                "X-Render-Id": rid,
                "X-Render-Provider": f"modal-{GPU_TYPE}",
                "X-Render-Nproc": str(NPROC_PER_NODE),
                "X-Render-Context-Parallel": str(CONTEXT_PARALLEL_SIZE),
                "X-Render-Int8": str(resolved_use_int8).lower(),
                "X-Render-Resolution": resolved_resolution,
                "X-Render-Peak-Vram-Gb": str(peak_used_gb),
            }
            return FileResponse(
                output_path, media_type="video/mp4", filename=f"{rid}.mp4", headers=headers
            )

        return web_app
