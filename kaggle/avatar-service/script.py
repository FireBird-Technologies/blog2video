"""
MuseTalk avatar-rendering service, run as a Kaggle kernel.

Serves two endpoints over a Cloudflare Quick Tunnel:
  POST /prepare  - one-time per avatar: face detect/parse/encode, cached to disk
  POST /render   - audio + avatar_id -> lip-synced mp4

This is a PROTOTYPE endpoint (see kaggle-avatar-service memory / plan doc):
  - URL changes every kernel restart (grab it from the kernel's Logs tab)
  - Session caps at 12h, ~30h/week GPU quota shared across all Kaggle usage
  - No auth beyond the X-Avatar-Key shared-secret header
Not for production traffic - see Phase 4 (RunPod) for that.

Deploy:
  kaggle kernels push -p <push-dir-with-this-as-script.py> --accelerator NvidiaTeslaT4
  (grab tunnel URL from https://www.kaggle.com/code/<user>/avatar-service/log)
"""
import glob
import os
import re
import subprocess
import sys
import threading
import time

try:
    import yaml
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "pyyaml"])
    import yaml

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

MUSETALK_DIR = "/kaggle/working/MuseTalk"
AVATAR_CACHE_DIR = "/kaggle/working/avatars"
OUTPUT_DIR = "/kaggle/working/outputs"
SHARED_SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")

# MuseTalk's README targets Python 3.10 + torch==2.0.1+cu118. Kaggle's base
# kernel runs Python 3.12 with NO conda installed anywhere on the image
# (confirmed empirically: `conda` missing from PATH and from every usual
# install location searched). So install directly onto the base Python 3.12,
# patching each 3.12-specific incompatibility found by actually running this
# on Kaggle: (1) torch==2.0.1 has no cu118 wheel anymore -> use 2.2.0+cu118,
# (2) numpy==1.23.5/tensorflow==2.12.0 have no cp312 wheels -> relax numpy,
# drop unused tensorflow, (3) mim's old setuptools hits pkgutil.ImpImporter,
# removed in 3.12 -> upgrade setuptools first. This combination got past
# `mim install` and into weight download on a prior run before being cut off
# for an (ultimately unavailable) conda experiment - proceeding with this
# proven path.
CONDA_ENV_PY = sys.executable


def install_musetalk():
    if os.path.isdir(MUSETALK_DIR):
        print("MuseTalk already present, skipping clone/install.")
        return
    subprocess.check_call(
        ["git", "clone", "--depth", "1", "https://github.com/TMElyralab/MuseTalk.git", MUSETALK_DIR]
    )
    os.chdir(MUSETALK_DIR)

    print(">>> Installing torch 2.2.0+cu118 (2.0.1 no longer available on the cu118 index) ...", flush=True)
    subprocess.check_call([
        sys.executable, "-m", "pip", "install", "-q",
        "torch==2.2.0", "torchvision==0.17.0", "torchaudio==2.2.0",
        "--index-url", "https://download.pytorch.org/whl/cu118",
    ])

    print(">>> Patching requirements.txt for Python 3.12 compatibility (numpy/tensorflow pins predate 3.12 wheels) ...", flush=True)
    with open("requirements.txt") as f:
        req_lines = f.readlines()
    patched_lines = []
    for line in req_lines:
        stripped = line.strip()
        if stripped.startswith("tensorflow==") or stripped.startswith("tensorboard=="):
            continue  # unused for inference (grepped: no imports anywhere), no cp312 wheel at this pin
        if stripped.startswith("numpy=="):
            patched_lines.append("numpy>=1.26,<2.0\n")
            continue
        patched_lines.append(line)
    with open("requirements.txt", "w") as f:
        f.writelines(patched_lines)

    print(">>> Installing requirements.txt ...", flush=True)
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "-r", "requirements.txt"])

    # `mim install X` fails on this kernel: its `import setuptools` pulls in
    # an old system copy at /usr/local/lib/python3.12/dist-packages/setuptools
    # that still calls the removed pkgutil.ImpImporter, even after
    # `pip install -U setuptools` (the upgrade lands in a different
    # site-packages dir that doesn't take import precedence over the system
    # one - confirmed empirically, not just theorized). Skip mim entirely:
    # it's just a convenience wrapper that resolves package name -> the mmlab
    # OpenMMLab wheel index and calls pip, so call that index directly.
    print(">>> Installing mmlab packages via pip + openmmlab wheel index (bypassing mim/pkg_resources bug) ...", flush=True)
    mmlab_index = "https://download.openmmlab.com/mmcv/dist/cu118/torch2.2/index.html"
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "mmengine"])
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "mmcv==2.0.1", "-f", mmlab_index])
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "mmdet==3.1.0"])
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "mmpose==1.1.0"])

    # NOTE: do NOT `pip install -e ./musetalk/whisper` - editable installs fail
    # on Kaggle's build env (missing build backends). Use sys.path instead.
    sys.path.insert(0, os.path.join(MUSETALK_DIR, "musetalk", "whisper"))

    print(">>> Downloading MuseTalk model weights (multi-GB, be patient) ...", flush=True)
    subprocess.check_call(["sh", "./download_weights.sh"])
    print(">>> MuseTalk install complete.", flush=True)


def start_tunnel():
    cloudflared_path = "/kaggle/working/cloudflared"
    if not os.path.exists(cloudflared_path):
        subprocess.check_call(
            [
                "wget", "-q",
                "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
                "-O", cloudflared_path,
            ]
        )
        subprocess.check_call(["chmod", "+x", cloudflared_path])
    proc = subprocess.Popen(
        [cloudflared_path, "tunnel", "--url", "http://localhost:8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    def watch():
        for line in proc.stdout:
            print(line, end="")
            m = re.search(r"https://[a-zA-Z0-9\-]+\.trycloudflare\.com", line)
            if m:
                print(f"\n>>> TUNNEL URL: {m.group(0)}\n", flush=True)
                with open("/kaggle/working/tunnel_url.txt", "w") as f:
                    f.write(m.group(0))

    threading.Thread(target=watch, daemon=True).start()
    return proc


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
        CONDA_ENV_PY, "-m", "scripts.inference",
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
    install_musetalk()
    start_tunnel()
    time.sleep(3)
    uvicorn.run(app, host="0.0.0.0", port=8000)
