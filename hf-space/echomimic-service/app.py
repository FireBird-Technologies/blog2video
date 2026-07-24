"""
EchoMimic audio-driven EXPRESSIVE talking-head service, run as a Hugging Face
Docker Space.

Serves three endpoints on a stable Space URL:
  GET  /ping     - health check
  POST /prepare  - stage a source portrait photo (no model work; EchoMimic, like
                   MuseTalk, fuses face-crop and render into one inference call)
  POST /render   - source photo + audio -> expressive, lip-synced portrait mp4

Why EchoMimic (and not MuseTalk / LivePortrait / Sonic):
  - MuseTalk only REPAINTS the mouth region; the rest of the face is a frozen
    passthrough - it cannot add emotion.
  - LivePortrait is VIDEO-driven retargeting - it copies motion from a driving
    clip you already have; it does not derive expression from audio.
  - Sonic IS audio-driven + expressive, but its license is NON-COMMERCIAL.
  - EchoMimic (AAAI 2025, antgroup) is audio-driven AND expressive AND
    Apache-2.0 (commercial OK). Expression/head-motion emerge from the audio, so
    (avatar image + audio) -> an expressive lip-synced clip in one shot.

ACCELERATED mode: this service runs the acc pipeline (infer_audio2vid_acc.py,
~6 denoise steps, ~10x faster than the 30-step base path). See DEFAULT_STEPS.

GPU note: EchoMimic is a diffusion pipeline. Upstream tested V100(16G) as the
FLOOR. We currently target a 16GB T4 Space, so the defaults below are deliberately
T4-safe: 512x512 and a modest frame cap (DEFAULT_L) - the repo's own 1200-frame
default would OOM a 16GB card. Bump these once on a 24GB (L4/A10G) Space.

License: Apache-2.0 (commercial use permitted).

All EchoMimic dependency installation happens in the Dockerfile at build time
(Python 3.10). This script handles: one-time model weight download at container
startup (weights aren't available at Docker build time), and serving requests.
"""
import glob
import os
import subprocess
import sys
import time

import uvicorn
import yaml
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

ECHOMIMIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "echomimic-src")
WEIGHTS_DIR = os.path.join(ECHOMIMIC_DIR, "pretrained_weights")
# EchoMimic's inference script hardcodes its output under CWD/output/<date>/<time>...
OUTPUT_ROOT = os.path.join(ECHOMIMIC_DIR, "output")
AVATAR_CACHE_DIR = "/tmp/avatars"
SHARED_SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")

# ffmpeg-static path (EchoMimic's moviepy/ffmpeg-python path reads FFMPEG_PATH).
# Set in the Dockerfile; fall back to the system ffmpeg dir if unset.
FFMPEG_PATH = os.environ.get("FFMPEG_PATH", "/usr/bin")

# T4-safe render defaults. acc mode denoises in ~6 steps with cfg=1.0 (per the
# repo's animation_acc.yaml / infer_audio2vid_acc.py defaults). DEFAULT_L is a
# frame cap, NOT the repo's 1200 - 1200 frames at 512x512 OOMs a 16GB card.
DEFAULT_W = 512
DEFAULT_H = 512
DEFAULT_L = 240        # ~10s at 24fps; safe on T4. Raise on a 24GB Space.
DEFAULT_STEPS = 6      # acc pipeline default
DEFAULT_CFG = 1.0      # acc pipeline default
DEFAULT_FPS = 24
DEFAULT_SEED = 420

# EchoMimic weights live in one HF repo (BadToBest/EchoMimic, ~35GB total incl.
# pose + non-acc variants). We fetch ONLY the acc audio-driven path (~12GB) via
# allow_patterns. NOTE which files the ACC pipeline actually loads (from the
# repo's animation_acc.yaml): denoising_unet_acc.pth + motion_module_acc.pth are
# the acc variants, but reference_unet.pth + face_locator.pth are the NON-acc
# files. Getting this wrong = a silent wrong-weights load or a missing-file crash.
WEIGHTS_REPO_ID = "BadToBest/EchoMimic"
WEIGHTS_ALLOW_PATTERNS = [
    "denoising_unet_acc.pth",
    "motion_module_acc.pth",
    "reference_unet.pth",
    "face_locator.pth",
    "sd-vae-ft-mse/*",
    "sd-image-variations-diffusers/*",
    "audio_processor/*",
]

# A load-bearing file per download, checked explicitly so a truncated/interrupted
# snapshot is caught at startup rather than surfacing as a cryptic mid-render
# failure. Paths are relative to pretrained_weights/.
REQUIRED_WEIGHT_FILES = [
    "denoising_unet_acc.pth",
    "motion_module_acc.pth",
    "reference_unet.pth",
    "face_locator.pth",
    "audio_processor/whisper_tiny.pt",
    "sd-vae-ft-mse/diffusion_pytorch_model.safetensors",
    "sd-image-variations-diffusers/unet/diffusion_pytorch_model.bin",
]


def _missing_weight_files():
    return [
        f for f in REQUIRED_WEIGHT_FILES
        if not os.path.exists(os.path.join(WEIGHTS_DIR, f))
    ]


def download_weights_if_needed():
    missing = _missing_weight_files()
    if not missing:
        print("EchoMimic weights already present, skipping download.", flush=True)
        return

    print(f">>> Downloading EchoMimic weights (missing: {missing}) ...", flush=True)
    from huggingface_hub import snapshot_download

    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    # snapshot_download resumes partial downloads and verifies file hashes, so
    # it's safe to re-run on an interrupted first boot. allow_patterns keeps us
    # to the ~12GB acc audio path instead of the full ~35GB repo.
    snapshot_download(
        repo_id=WEIGHTS_REPO_ID,
        local_dir=WEIGHTS_DIR,
        allow_patterns=WEIGHTS_ALLOW_PATTERNS,
    )

    still_missing = _missing_weight_files()
    if still_missing:
        raise RuntimeError(
            f"snapshot_download completed but these files are still missing: "
            f"{still_missing} - refusing to start the server with incomplete weights."
        )
    print(">>> Weight download complete, all required files present.", flush=True)


os.makedirs(AVATAR_CACHE_DIR, exist_ok=True)

app = FastAPI()


@app.middleware("http")
async def check_secret(request, call_next):
    if request.headers.get("x-avatar-key") != SHARED_SECRET:
        return JSONResponse({"detail": "unauthorized"}, status_code=401)
    return await call_next(request)


@app.get("/ping")
def ping():
    return {"ok": True}


@app.post("/prepare")
def prepare(avatar_id: str = Form(...), image: UploadFile = File(...)):
    # EchoMimic doesn't separate "prepare a face" from "render with audio" - one
    # inference call does face-detect/crop (MTCNN) + generation together. So
    # /prepare here is file staging only: save the source portrait, no model
    # invocation yet. The actual model work happens in /render.
    avatar_dir = os.path.join(AVATAR_CACHE_DIR, avatar_id)
    os.makedirs(avatar_dir, exist_ok=True)
    ext = (image.filename or "source.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    image_path = os.path.join(avatar_dir, f"source.{ext}")
    with open(image_path, "wb") as f:
        f.write(image.file.read())
    return {"ok": True, "avatar_id": avatar_id, "staged_image": image_path}


def _build_render_config(config_path, image_path, audio_path):
    """
    EchoMimic is CONFIG-driven, not CLI-arg-driven: infer_audio2vid_acc.py reads
    image->audio pairs from a YAML `test_cases:` map plus all the weight paths.
    We write a per-render YAML that mirrors the repo's animation_acc.yaml (so the
    acc `_acc` weights load) but with a single test case = our staged image and
    the uploaded audio. Paths must be relative to ECHOMIMIC_DIR (the CWD we run
    the script in), matching how the repo's own config uses ./pretrained_weights.
    """
    def rel(p):
        return os.path.relpath(p, ECHOMIMIC_DIR)

    w = "./pretrained_weights"
    cfg = {
        "pretrained_base_model_path": f"{w}/sd-image-variations-diffusers/",
        "pretrained_vae_path": f"{w}/sd-vae-ft-mse/",
        "audio_model_path": f"{w}/audio_processor/whisper_tiny.pt",
        # acc variants for the two the acc pipeline accelerates:
        "denoising_unet_path": f"{w}/denoising_unet_acc.pth",
        "motion_module_path": f"{w}/motion_module_acc.pth",
        # non-acc for these two (matches the repo's animation_acc.yaml exactly):
        "reference_unet_path": f"{w}/reference_unet.pth",
        "face_locator_path": f"{w}/face_locator.pth",
        "inference_config": "./configs/inference/inference_v2.yaml",
        "weight_dtype": "fp16",
        "test_cases": {rel(image_path): [rel(audio_path)]},
    }
    with open(config_path, "w") as f:
        yaml.safe_dump(cfg, f)


@app.post("/render")
def render(
    avatar_id: str = Form(...),
    audio: UploadFile = File(...),
    L: int = Form(DEFAULT_L),
    W: int = Form(DEFAULT_W),
    H: int = Form(DEFAULT_H),
    steps: int = Form(DEFAULT_STEPS),
    cfg: float = Form(DEFAULT_CFG),
    fps: int = Form(DEFAULT_FPS),
    seed: int = Form(DEFAULT_SEED),
):
    """
    audio + avatar_id -> expressive lip-synced mp4 (EchoMimic acc pipeline).

    L is the frame cap (defaults T4-safe at 240 ~= 10s@24fps). W/H default 512.
    steps/cfg default to the acc pipeline's 6/1.0. Raise L / resolution only on a
    24GB+ Space.
    """
    avatar_dir = os.path.join(AVATAR_CACHE_DIR, avatar_id)
    if not os.path.isdir(avatar_dir):
        raise HTTPException(404, f"avatar {avatar_id} not prepared - call /prepare first")

    image_matches = glob.glob(os.path.join(avatar_dir, "source.*"))
    if not image_matches:
        raise HTTPException(404, f"no staged photo found for avatar {avatar_id}")
    image_path = image_matches[0]

    # EchoMimic's audio path expects a .wav (whisper feature extraction). Accept
    # whatever the caller sends and let EchoMimic/ffmpeg handle it; name by ext.
    audio_ext = (audio.filename or "input.wav").rsplit(".", 1)[-1].lower()
    if audio_ext not in ("wav", "mp3", "m4a", "flac", "ogg"):
        audio_ext = "wav"
    audio_path = os.path.join(avatar_dir, f"input_audio.{audio_ext}")
    with open(audio_path, "wb") as f:
        f.write(audio.file.read())

    # Record the newest-mtime boundary so we can pick out THIS render's output
    # from EchoMimic's timestamped output/ tree (multiple renders accumulate).
    render_start = time.time()

    config_path = os.path.join(avatar_dir, "render_config.yaml")
    _build_render_config(config_path, image_path, audio_path)

    cmd = [
        sys.executable, "-u", "infer_audio2vid_acc.py",
        "--config", config_path,
        "-W", str(W), "-H", str(H), "-L", str(L),
        "--steps", str(steps), "--cfg", str(cfg),
        "--fps", str(fps), "--seed", str(seed),
    ]
    env = {**os.environ, "FFMPEG_PATH": FFMPEG_PATH}
    print(f">>> Running EchoMimic inference: {' '.join(cmd)}", flush=True)
    # Capture stdout+stderr so a failing render returns the actual Python
    # traceback in the HTTP 502 body (the HF run-log stream truncates before the
    # subprocess output, making failures un-diagnosable otherwise).
    proc = subprocess.run(cmd, cwd=ECHOMIMIC_DIR, env=env,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if proc.returncode != 0:
        tail = "\n".join((proc.stdout or "").splitlines()[-40:])
        print(f">>> EchoMimic FAILED (rc={proc.returncode}):\n{tail}", flush=True)
        raise HTTPException(502, f"EchoMimic inference failed (rc={proc.returncode}):\n{tail}")

    # Output dir is output/<date>/<time>--seed_...-WxH/ - glob every mp4 produced
    # at/after this render's start and take the newest.
    candidates = [
        p for p in glob.glob(os.path.join(OUTPUT_ROOT, "**", "*.mp4"), recursive=True)
        if os.path.getmtime(p) >= render_start - 1
    ]
    if not candidates:
        raise HTTPException(502, f"EchoMimic ran but produced no mp4 under {OUTPUT_ROOT}")
    output_path = max(candidates, key=os.path.getmtime)

    return FileResponse(output_path, media_type="video/mp4", filename=f"{avatar_id}.mp4")


if __name__ == "__main__":
    download_weights_if_needed()
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
