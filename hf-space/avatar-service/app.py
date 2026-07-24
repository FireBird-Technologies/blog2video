"""
MuseTalk avatar-rendering service, run as a Hugging Face Docker Space.

Serves two endpoints on a stable Space URL (no rotating tunnel, unlike the
earlier Kaggle prototype this replaces):
  GET  /ping     - health check
  POST /prepare  - stage an avatar photo (face-prep happens together with
                   rendering in /render - MuseTalk doesn't separate the two)
  POST /render   - audio + avatar_id -> lip-synced mp4

All MuseTalk dependency installation happens in the Dockerfile at build time
(Python 3.10, matching MuseTalk's own target - see Dockerfile comments for
why this sidesteps every Python-3.12 compatibility bug hit on Kaggle). This
script only handles: one-time model weight download at container startup
(GPU/weights aren't available at Docker build time), and serving requests.
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

MUSETALK_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "musetalk-src")
AVATAR_CACHE_DIR = "/tmp/avatars"
OUTPUT_DIR = "/tmp/outputs"
SHARED_SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")


# All six weight files scripts/inference.py actually loads at startup. The
# script's own "download successful" message is NOT reliable - it has no
# `set -e`, so individual failed download commands (confirmed: two separate
# ones, see below) don't stop the script or its exit code. Check every file
# explicitly instead of trusting the script's stdout or a single marker.
REQUIRED_WEIGHT_FILES = [
    "musetalkV15/unet.pth",
    "sd-vae/diffusion_pytorch_model.bin",
    "whisper/pytorch_model.bin",
    "dwpose/dw-ll_ucoco_384.pth",
    "syncnet/latentsync_syncnet.pt",
    "face-parse-bisent/79999_iter.pth",
    "face-parse-bisent/resnet18-5c106cde.pth",
]


def _missing_weight_files():
    return [
        f for f in REQUIRED_WEIGHT_FILES
        if not os.path.exists(os.path.join(MUSETALK_DIR, "models", f))
    ]


def download_weights_if_needed():
    missing = _missing_weight_files()
    if not missing:
        print("MuseTalk weights already present, skipping download.", flush=True)
        return

    # download_weights.sh has several problems, all patched out before running:
    # 1. `pip install -U "huggingface_hub[cli]"` unconditionally upgrades
    #    huggingface_hub to latest (confirmed: landed on 1.24.0), breaking
    #    transformers==4.39.2's hard-coded `huggingface-hub<1.0,>=0.19.3`
    #    check at import time in scripts/inference.py. huggingface_hub is
    #    already installed via requirements.txt at the right version.
    # 2. `export HF_ENDPOINT=https://hf-mirror.com` points at a China-region
    #    mirror that's unreachable from this container (confirmed: every
    #    download attempt raised huggingface_hub.errors.FileMetadataError
    #    "Distant resource does not seem to be on huggingface.co"). Drop it
    #    to use the real huggingface.co directly.
    # 3. `gdown --id <id> -O <path>` uses gdown's old CLI syntax - current
    #    gdown takes the id as a positional arg, not --id (confirmed:
    #    "gdown: error: unrecognized arguments: --id"). Rewrite to
    #    `gdown <id> -O <path>`.
    # The script has no `set -e`, so both (3) and the missing-curl issue
    # (fixed in the Dockerfile - curl is now installed) failed silently
    # while the script still printed its own "success" message at the end.
    script_path = os.path.join(MUSETALK_DIR, "download_weights.sh")
    with open(script_path) as f:
        lines = f.readlines()
    patched = []
    for ln in lines:
        if 'pip install -U "huggingface_hub[cli]"' in ln:
            continue
        if "HF_ENDPOINT=https://hf-mirror.com" in ln:
            continue
        if ln.strip().startswith("gdown --id "):
            ln = ln.replace("gdown --id ", "gdown ", 1)
        patched.append(ln)
    with open(script_path, "w") as f:
        f.writelines(patched)

    print(f">>> Downloading MuseTalk model weights (missing: {missing}) ...", flush=True)
    subprocess.check_call(["sh", "./download_weights.sh"], cwd=MUSETALK_DIR)

    still_missing = _missing_weight_files()
    if still_missing:
        raise RuntimeError(
            f"download_weights.sh exited 0 but these files are still missing: "
            f"{still_missing} - refusing to start the server with incomplete weights."
        )
    print(">>> Weight download complete, all required files present.", flush=True)


os.makedirs(AVATAR_CACHE_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

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
    # MuseTalk doesn't separate "prepare a face" from "render with audio" -
    # one inference.py call does face-processing + inference together per
    # task. So /prepare here is file staging only: save the photo, no
    # MuseTalk invocation yet. The actual model work happens in /render.
    avatar_dir = os.path.join(AVATAR_CACHE_DIR, avatar_id)
    os.makedirs(avatar_dir, exist_ok=True)
    ext = (image.filename or "source.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    image_path = os.path.join(avatar_dir, f"source.{ext}")
    with open(image_path, "wb") as f:
        f.write(image.file.read())
    return {"ok": True, "avatar_id": avatar_id, "staged_image": image_path}


@app.post("/render")
def render(avatar_id: str = Form(...), audio: UploadFile = File(...)):
    avatar_dir = os.path.join(AVATAR_CACHE_DIR, avatar_id)
    if not os.path.isdir(avatar_dir):
        raise HTTPException(404, f"avatar {avatar_id} not prepared - call /prepare first")

    image_matches = glob.glob(os.path.join(avatar_dir, "source.*"))
    if not image_matches:
        raise HTTPException(404, f"no staged photo found for avatar {avatar_id}")
    image_path = image_matches[0]

    audio_path = os.path.join(avatar_dir, "input_audio.mp3")
    with open(audio_path, "wb") as f:
        f.write(audio.file.read())

    task_name = f"task_{avatar_id}_{int(time.time())}"
    result_dir = os.path.join(OUTPUT_DIR, task_name)
    os.makedirs(result_dir, exist_ok=True)

    config_path = os.path.join(avatar_dir, "render_config.yaml")
    with open(config_path, "w") as f:
        yaml.safe_dump({task_name: {"video_path": image_path, "audio_path": audio_path}}, f)

    cmd = [
        sys.executable, "-m", "scripts.inference",
        "--inference_config", config_path,
        "--result_dir", result_dir,
        "--unet_model_path", os.path.join(MUSETALK_DIR, "models/musetalkV15/unet.pth"),
        "--unet_config", os.path.join(MUSETALK_DIR, "models/musetalkV15/musetalk.json"),
        "--whisper_dir", os.path.join(MUSETALK_DIR, "models/whisper"),
        "--version", "v15",
        "--use_float16",
    ]
    print(f">>> Running MuseTalk inference: {' '.join(cmd)}", flush=True)
    try:
        subprocess.check_call(cmd, cwd=MUSETALK_DIR)
    except subprocess.CalledProcessError as e:
        raise HTTPException(502, f"MuseTalk inference failed: {e}") from e

    output_videos = glob.glob(os.path.join(result_dir, "**", "*.mp4"), recursive=True)
    if not output_videos:
        raise HTTPException(502, f"MuseTalk ran but produced no mp4 in {result_dir}")

    return FileResponse(output_videos[0], media_type="video/mp4", filename=f"{avatar_id}.mp4")


if __name__ == "__main__":
    download_weights_if_needed()
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
