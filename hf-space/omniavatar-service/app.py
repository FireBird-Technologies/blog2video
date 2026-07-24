"""
OmniAvatar audio-driven + prompt-driven talking-avatar service, run as a Hugging
Face Docker Space.

Serves three endpoints on a stable Space URL:
  GET  /ping     - health check
  POST /prepare  - stage a source portrait photo (no model work; OmniAvatar, like
                   EchoMimic, fuses face handling and render into one inference call)
  POST /render   - source photo + audio (+ optional text prompt) -> lip-synced,
                   expressive mp4 with adaptive body/gesture motion

Why OmniAvatar (and how it differs from EchoMimic / MuseTalk):
  - MuseTalk only REPAINTS the mouth region - the rest of the face is frozen.
  - EchoMimic is audio-driven + expressive, but head/face motion only.
  - OmniAvatar (built on Wan2.1-T2V diffusion) is audio-driven AND lets a text
    PROMPT steer behavior, producing lip-sync + adaptive BODY/gesture motion.
    Apache-2.0 (commercial OK), like EchoMimic - so it clears the same bar Sonic
    failed.

Model: the 1.3B variant (configs/inference_1.3B.yaml). Inference is launched via
`torchrun --standalone --nproc_per_node=1` because OmniAvatar's scripts/inference.py
calls dist.init_process_group('nccl') - it requires a distributed rendezvous even
on a single GPU.

GPU note: this is a Wan2.1 diffusion pipeline. We target a 16GB T4 Space, so the
render invocation below is deliberately T4-safe:
  - num_persistent_param_in_dit=0  (stream DiT params instead of resident)
  - tea_cache_l1_thresh=0.14       (TeaCache step-skipping)
  - reduced num_steps + a max_tokens cap
The upstream 36/21/8GB VRAM figures are for the 14B model, NOT this 1.3B path.
Raise these on a 24GB (L4) Space.

License: Apache-2.0 (commercial use permitted).

All OmniAvatar dependency installation happens in the Dockerfile at build time
(Python 3.10). This script handles: one-time model weight download at container
startup (weights aren't available at Docker build time), and serving requests.
"""
import glob
import os
import subprocess
import sys
import threading
import time

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

OMNIAVATAR_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "omniavatar-src")
# inference_1.3B.yaml references every model path relative to CWD as
# pretrained_models/<name>/..., and OmniAvatar's inference writes its output under
# CWD/demo_out/<exp_name>/... - so the CWD for the subprocess is OMNIAVATAR_DIR.
WEIGHTS_DIR = os.path.join(OMNIAVATAR_DIR, "pretrained_models")
OUTPUT_ROOT = os.path.join(OMNIAVATAR_DIR, "demo_out")
AVATAR_CACHE_DIR = "/tmp/avatars"
SHARED_SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")

FFMPEG_PATH = os.environ.get("FFMPEG_PATH", "/usr/bin")

# --- T4-safe render defaults ---------------------------------------------------
# The 1.3B config ships num_steps=50 and no VRAM cap. On a 16GB T4 we lower steps
# and force the low-VRAM knobs via --hp. Raise on a 24GB Space.
DEFAULT_PROMPT = "A person looking at the camera and talking naturally, calm and friendly."
DEFAULT_STEPS = 10           # config default is 50; lowered to 10 as a SPEED test
                             # (measured: ~390s fixed overhead + ~9s/step, so 10 steps
                             #  ≈ ~480s. Diminishing returns below this; quality drops.)
DEFAULT_GUIDANCE = 4.5        # matches the config
DEFAULT_MAX_TOKENS = 30000    # config default; lower if T4 OOMs
DEFAULT_TEA_CACHE = 0.14      # TeaCache step-skip (config default is 0 = off)
DEFAULT_SEED = 42
# num_persistent_param_in_dit=0 streams DiT params -> the key T4 memory saver.
NUM_PERSISTENT_PARAM_IN_DIT = 0

# OmniAvatar-1.3B needs THREE HF repos under pretrained_models/, laid out exactly
# as configs/inference_1.3B.yaml expects (text_encoder_path / dit_path / vae_path
# all under Wan2.1-T2V-1.3B/, exp_path = OmniAvatar-1.3B/, wav2vec_path =
# wav2vec2-base-960h/). ~20GB total.
WEIGHT_REPOS = [
    # (repo_id, local subdir under pretrained_models/, allow_patterns or None)
    ("Wan-AI/Wan2.1-T2V-1.3B", "Wan2.1-T2V-1.3B", [
        "models_t5_umt5-xxl-enc-bf16.pth",
        "diffusion_pytorch_model.safetensors",
        "Wan2.1_VAE.pth",
        "config.json",
        "google/*",            # umt5 tokenizer assets the T5 encoder loads
    ]),
    ("OmniAvatar/OmniAvatar-1.3B", "OmniAvatar-1.3B", None),  # small; take all
    ("facebook/wav2vec2-base-960h", "wav2vec2-base-960h", None),  # ~360MB; take all
]

# A load-bearing file per repo, checked explicitly so a truncated/interrupted
# snapshot is caught at startup rather than as a cryptic mid-render failure.
# Paths are relative to pretrained_models/.
REQUIRED_WEIGHT_FILES = [
    "Wan2.1-T2V-1.3B/models_t5_umt5-xxl-enc-bf16.pth",
    "Wan2.1-T2V-1.3B/diffusion_pytorch_model.safetensors",
    "Wan2.1-T2V-1.3B/Wan2.1_VAE.pth",
    "wav2vec2-base-960h/config.json",
]


def _missing_weight_files():
    return [
        f for f in REQUIRED_WEIGHT_FILES
        if not os.path.exists(os.path.join(WEIGHTS_DIR, f))
    ]


def download_weights_if_needed():
    if not _missing_weight_files():
        print("OmniAvatar weights already present, skipping download.", flush=True)
        return

    from huggingface_hub import snapshot_download

    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    for repo_id, subdir, allow in WEIGHT_REPOS:
        local_dir = os.path.join(WEIGHTS_DIR, subdir)
        print(f">>> Downloading {repo_id} -> {local_dir} ...", flush=True)
        # snapshot_download resumes partial downloads and verifies hashes, so it's
        # safe to re-run on an interrupted first boot.
        kwargs = {"repo_id": repo_id, "local_dir": local_dir}
        if allow is not None:
            kwargs["allow_patterns"] = allow
        snapshot_download(**kwargs)

    still_missing = _missing_weight_files()
    if still_missing:
        raise RuntimeError(
            f"snapshot_download completed but these files are still missing: "
            f"{still_missing} - refusing to start with incomplete weights."
        )
    print(">>> Weight download complete, all required files present.", flush=True)


os.makedirs(AVATAR_CACHE_DIR, exist_ok=True)

MEMLOG_PATH = "/tmp/omniavatar_memlog.txt"


def _start_memory_sampler(stop_event, out_path):
    """
    Background thread that polls `nvidia-smi` every 5s and appends to out_path.
    This exists because a T4 OOM-kill is a hard SIGKILL on the torchrun child -
    subprocess.run() returns NOTHING when that happens (no stdout, no traceback),
    which is exactly the silent-crash-restart pattern seen without this. Sampling
    from OUTSIDE the render subprocess means the log survives even if the render
    process is killed - this file is what tells us whether it's really VRAM.
    """
    def _loop():
        with open(out_path, "a") as f:
            f.write(f"=== memory sampler started {time.strftime('%H:%M:%S')} ===\n")
            f.flush()
            while not stop_event.is_set():
                try:
                    out = subprocess.run(
                        ["nvidia-smi", "--query-gpu=memory.used,memory.total,utilization.gpu",
                         "--format=csv,noheader,nounits"],
                        capture_output=True, text=True, timeout=5,
                    )
                    f.write(f"{time.strftime('%H:%M:%S')} {out.stdout.strip()}\n")
                except Exception as e:
                    f.write(f"{time.strftime('%H:%M:%S')} sampler-error: {e}\n")
                f.flush()
                stop_event.wait(5)
    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    return t


app = FastAPI()


@app.middleware("http")
async def check_secret(request, call_next):
    if request.headers.get("x-avatar-key") != SHARED_SECRET:
        return JSONResponse({"detail": "unauthorized"}, status_code=401)
    return await call_next(request)


@app.get("/ping")
def ping():
    return {"ok": True}


@app.get("/lastlog")
def lastlog():
    """
    Debug endpoint: returns the GPU-memory sampler log (written OUTSIDE the
    render subprocess, so it survives a SIGKILL) plus the most recent render's
    streamed stdout. Exists to diagnose the container silently restarting
    mid-render with no traceback (the OOM-kill signature) without having to
    catch the failure in the same request/response cycle.
    """
    mem = ""
    if os.path.exists(MEMLOG_PATH):
        with open(MEMLOG_PATH) as f:
            mem = f.read()
    stdout_logs = sorted(
        glob.glob(os.path.join(AVATAR_CACHE_DIR, "*", "render_stdout.log")),
        key=os.path.getmtime,
    )
    last_stdout = ""
    last_stdout_path = None
    if stdout_logs:
        last_stdout_path = stdout_logs[-1]
        with open(last_stdout_path) as f:
            last_stdout = f.read()
    return {
        "memlog_path": MEMLOG_PATH,
        "memlog": mem,
        "last_stdout_path": last_stdout_path,
        "last_stdout_tail": "\n".join(last_stdout.splitlines()[-80:]),
    }


@app.post("/prepare")
def prepare(avatar_id: str = Form(...), image: UploadFile = File(...)):
    # OmniAvatar (like EchoMimic) fuses face handling + generation into a single
    # inference call, so /prepare is file staging only: save the source portrait,
    # no model invocation. The model work happens in /render.
    avatar_dir = os.path.join(AVATAR_CACHE_DIR, avatar_id)
    os.makedirs(avatar_dir, exist_ok=True)
    ext = (image.filename or "source.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    image_path = os.path.join(avatar_dir, f"source.{ext}")
    with open(image_path, "wb") as f:
        f.write(image.file.read())
    return {"ok": True, "avatar_id": avatar_id, "staged_image": image_path}


def _write_input_file(input_path, prompt, image_path, audio_path):
    """
    OmniAvatar's inference reads an --input_file whose each line is
    `prompt@@img_path@@audio_path` (@@-separated). Paths are relative to the CWD
    the script runs in (OMNIAVATAR_DIR), matching how the config uses
    ./pretrained_models. A single line = our one render.
    """
    def rel(p):
        return os.path.relpath(p, OMNIAVATAR_DIR)

    # Strip @@ and newlines from the prompt so they can't break the line format.
    safe_prompt = prompt.replace("@@", " ").replace("\n", " ").strip()
    line = f"{safe_prompt}@@{rel(image_path)}@@{rel(audio_path)}"
    with open(input_path, "w") as f:
        f.write(line + "\n")


@app.post("/render")
def render(
    avatar_id: str = Form(...),
    audio: UploadFile = File(...),
    prompt: str = Form(DEFAULT_PROMPT),
    steps: int = Form(DEFAULT_STEPS),
    guidance_scale: float = Form(DEFAULT_GUIDANCE),
    max_tokens: int = Form(DEFAULT_MAX_TOKENS),
    tea_cache: float = Form(DEFAULT_TEA_CACHE),
    seed: int = Form(DEFAULT_SEED),
):
    """
    audio + avatar_id (+ optional prompt) -> lip-synced, expressive mp4
    (OmniAvatar-1.3B). The prompt steers behavior/expression - OmniAvatar's edge
    over EchoMimic. steps/max_tokens/tea_cache default T4-safe; raise on 24GB+.
    """
    avatar_dir = os.path.join(AVATAR_CACHE_DIR, avatar_id)
    if not os.path.isdir(avatar_dir):
        raise HTTPException(404, f"avatar {avatar_id} not prepared - call /prepare first")

    image_matches = glob.glob(os.path.join(avatar_dir, "source.*"))
    if not image_matches:
        raise HTTPException(404, f"no staged photo found for avatar {avatar_id}")
    image_path = image_matches[0]

    # OmniAvatar's audio path resamples to 16kHz internally (wav2vec). Accept
    # whatever the caller sends; name by extension.
    audio_ext = (audio.filename or "input.wav").rsplit(".", 1)[-1].lower()
    if audio_ext not in ("wav", "mp3", "m4a", "flac", "ogg"):
        audio_ext = "wav"
    audio_path = os.path.join(avatar_dir, f"input_audio.{audio_ext}")
    with open(audio_path, "wb") as f:
        f.write(audio.file.read())

    # Record the newest-mtime boundary so we can pick THIS render's output out of
    # OmniAvatar's demo_out/ tree (multiple renders accumulate).
    render_start = time.time()

    input_path = os.path.join(avatar_dir, "infer_input.txt")
    _write_input_file(input_path, prompt, image_path, audio_path)

    # --hp overrides the YAML config (comma-separated key=value). These force the
    # T4-safe low-VRAM path + reduced steps.
    hp = (
        f"num_persistent_param_in_dit={NUM_PERSISTENT_PARAM_IN_DIT},"
        f"tea_cache_l1_thresh={tea_cache},"
        f"guidance_scale={guidance_scale},"
        f"num_steps={steps},"
        f"max_tokens={max_tokens},"
        f"seed={seed},"
        f"sp_size=1"
    )

    # OmniAvatar's inference calls dist.init_process_group('nccl') -> it MUST be
    # launched under torchrun, even for a single GPU. --standalone sets up the
    # single-node rendezvous; --nproc_per_node=1 = one process on the one GPU.
    cmd = [
        "torchrun", "--standalone", "--nproc_per_node=1",
        "scripts/inference.py",
        "--config", "configs/inference_1.3B.yaml",
        "--input_file", os.path.relpath(input_path, OMNIAVATAR_DIR),
        f"--hp={hp}",
    ]
    # MASTER_ADDR/PORT give the nccl rendezvous a target even in single-proc mode.
    env = {
        **os.environ,
        "FFMPEG_PATH": FFMPEG_PATH,
        "MASTER_ADDR": "127.0.0.1",
        "MASTER_PORT": "29500",
    }
    print(f">>> Running OmniAvatar inference: {' '.join(cmd)}", flush=True)

    # Reset the memlog for this render and start a background nvidia-smi sampler.
    # This runs OUTSIDE the render subprocess so it survives a SIGKILL of the
    # torchrun child (an OOM-kill leaves subprocess.run() with NOTHING - no
    # stdout, no traceback - which is why earlier crashes looked silent).
    with open(MEMLOG_PATH, "w") as f:
        f.write(f"render_start={render_start}\n")
    stop_sampler = threading.Event()
    _start_memory_sampler(stop_sampler, MEMLOG_PATH)

    # Stream (not buffer) subprocess output to a file line-by-line, so a kill
    # leaves partial output on disk instead of losing everything.
    stdout_log_path = os.path.join(avatar_dir, "render_stdout.log")
    try:
        with open(stdout_log_path, "w") as logf:
            proc = subprocess.Popen(cmd, cwd=OMNIAVATAR_DIR, env=env,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    text=True, bufsize=1)
            for line in proc.stdout:
                logf.write(line)
                logf.flush()
            proc.wait()
            returncode = proc.returncode
    finally:
        stop_sampler.set()

    if returncode != 0:
        with open(stdout_log_path) as f:
            tail = "\n".join(f.read().splitlines()[-40:])
        with open(MEMLOG_PATH) as f:
            mem_tail = "\n".join(f.read().splitlines()[-10:])
        print(f">>> OmniAvatar FAILED (rc={returncode}):\n{tail}\n--- mem ---\n{mem_tail}", flush=True)
        raise HTTPException(
            502,
            f"OmniAvatar inference failed (rc={returncode}):\n{tail}\n\n--- last GPU mem samples ---\n{mem_tail}",
        )

    # Output lands under demo_out/<exp_name>/res_.../ - when audio is present
    # OmniAvatar writes a muxed *_wav.mp4 (h264 + aac) and DELETES the silent one.
    # Glob every mp4 produced at/after render start and take the newest.
    candidates = [
        p for p in glob.glob(os.path.join(OUTPUT_ROOT, "**", "*.mp4"), recursive=True)
        if os.path.getmtime(p) >= render_start - 1
    ]
    if not candidates:
        raise HTTPException(502, f"OmniAvatar ran but produced no mp4 under {OUTPUT_ROOT}")
    output_path = max(candidates, key=os.path.getmtime)

    return FileResponse(output_path, media_type="video/mp4", filename=f"{avatar_id}.mp4")


if __name__ == "__main__":
    download_weights_if_needed()
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
