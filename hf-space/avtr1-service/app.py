"""
AVTR-1 (avaturn-live/avtr-1) offline talking-avatar service — HF Docker Space.

AVTR-1 is a live-dialogue avatar model: a BUILT-IN avatar + audio -> a lip-synced
(and optionally "active-listening") mp4 at 25fps. We host the OFFLINE render path
(scripts/generate_offline.py) behind the same API as our other avatar services:
  GET  /ping      - health check
  GET  /avatars   - list the built-in avatar ids + backgrounds
  POST /render    - avatar id + audio -> lip-synced mp4

Differences vs the EchoMimic service:
  - No /prepare + no arbitrary photo upload: you pick a BUILT-IN avatar by id
    (maria, elena, marcus, ...) — AVTR-1 ships a fixed avatar set.
  - Audio-driven lip-sync via --speech; optional 2nd "listener" track via --listen
    drives active-listening reactions. We expose --speech; --listen optional.
  - Heavy startup: downloads GATED weights (needs HF_TOKEN) then BUILDS
    GPU-specific TensorRT engines (minutes). Both are cached under
    AVTR1_LOCAL_STORAGE (point at HF persistent /data so cold starts skip them).

Runs INSIDE the repo's pixi env (see Dockerfile CMD) so it can shell out to the
repo's own pixi tasks, which manage all internal artifact paths.

License: AVTR-1 Renderer+Streamer are PolyForm NONCOMMERCIAL — internal eval only.
"""
import glob
import os
import subprocess
import sys
import time

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

AVTR1_DIR = os.path.dirname(os.path.abspath(__file__))  # .../avtr1-src (CMD workdir)
STORAGE = os.environ.get("AVTR1_LOCAL_STORAGE", os.path.join(AVTR1_DIR, "artifacts"))
WORK_DIR = "/tmp/avtr1"
SHARED_SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")

# Built-in avatars + backgrounds (from the avaturn-live/avtr-1 HF repo file list).
AVATARS = [
    "arnold", "ben", "camila", "caroline", "clara", "elena", "gordon", "jack",
    "john", "kate", "marcus", "maria", "may", "ming", "mozart", "oliver",
    "olivia", "trevor",
]
BACKGROUNDS = [
    "plain_white", "minimal_office", "bright_loft", "sunlit_bedroom", "study_desk",
    "beige_sofa", "jungle_window", "aloe_window", "lounge_chairs", "framed_art",
]
DEFAULT_AVATAR = "maria"
DEFAULT_BG = "plain_white"

# Marker file proving the one-time startup setup (download + TRT engine build)
# finished, so we skip it on warm restarts when storage is persistent.
_SETUP_MARKER = os.path.join(STORAGE, ".avtr1_setup_complete")


def _run(cmd, capture=False, **kw):
    """
    Run a pixi task. By default STREAM output to our stdout so long-running setup
    (download, TRT build) is visible in the HF container log in real time. When
    capture=True, capture stdout and return it (used by /render so a failed render
    can put the traceback tail in the HTTP 502 body).
    """
    print(f">>> {' '.join(cmd)}", flush=True)
    if capture:
        proc = subprocess.run(cmd, cwd=AVTR1_DIR, stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT, text=True, **kw)
        if proc.returncode != 0:
            tail = "\n".join((proc.stdout or "").splitlines()[-40:])
            raise RuntimeError(f"command failed (rc={proc.returncode}):\n{tail}")
        return proc.stdout or ""
    # streaming mode: inherit our stdout/stderr so pixi progress shows live
    proc = subprocess.run(cmd, cwd=AVTR1_DIR, **kw)
    if proc.returncode != 0:
        raise RuntimeError(f"command failed (rc={proc.returncode}) — see logs above")
    return ""


def setup_if_needed():
    """One-time: download GATED weights, then build GPU-specific TRT engines."""
    os.makedirs(STORAGE, exist_ok=True)
    if os.path.exists(_SETUP_MARKER):
        print("AVTR-1 setup already complete (marker present), skipping.", flush=True)
        return

    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        raise RuntimeError(
            "HF_TOKEN is not set. AVTR-1 weights are GATED — set an HF_TOKEN Space "
            "secret whose account accepted the avaturn-live/avtr-1 license.")

    # The artifact manager triggers an INTERACTIVE `getpass` login if no saved HF
    # credential exists (confirmed: EOFError from getpass in a non-tty container).
    # Do a NON-INTERACTIVE token login first so a credential file exists on disk;
    # then the download runs silently. Uses huggingface_hub.login (available in
    # the pixi env) rather than the `hf auth login` CLI prompt.
    print(">>> Logging into HuggingFace non-interactively (token) ...", flush=True)
    try:
        from huggingface_hub import login as hf_login
        hf_login(token=hf_token, add_to_git_credential=False)
    except Exception as e:
        # fall back to the CLI form if the import path differs
        print(f"    hf_login import/login issue ({e!r}); trying CLI ...", flush=True)
        _run(["pixi", "run", "hf", "auth", "login", "--token", hf_token], capture=True)

    # IMPORTANT: call the download SCRIPT directly, NOT `pixi run download`.
    # The `download` pixi task has `depends-on = ["hf-login"]`, and `hf-login`
    # runs the INTERACTIVE `hf auth login` (getpass) — which EOFErrors in a
    # non-tty container even though we already logged in above. Invoking the
    # script via `pixi run python ...` runs it in the pixi env but skips the
    # task-dependency chain, so no interactive login is triggered.
    print(">>> Downloading AVTR-1 artifacts (gated) ...", flush=True)
    _run(["pixi", "run", "-e", "renderer", "python", "scripts/download_artifacts.py"])

    # Build TensorRT engines ON THIS GPU (arch-specific). Minutes on first boot.
    # Same reasoning: call the build script directly to avoid any task deps.
    print(">>> Building TensorRT engines (GPU-specific, one-time) ...", flush=True)
    _run(["pixi", "run", "-e", "renderer", "python", "scripts/build_engines.py"])

    with open(_SETUP_MARKER, "w") as f:
        f.write(str(time.time()))
    print(">>> AVTR-1 setup complete.", flush=True)


os.makedirs(WORK_DIR, exist_ok=True)
app = FastAPI()


@app.middleware("http")
async def check_secret(request, call_next):
    if request.headers.get("x-avatar-key") != SHARED_SECRET:
        return JSONResponse({"detail": "unauthorized"}, status_code=401)
    return await call_next(request)


@app.get("/ping")
def ping():
    return {"ok": True}


@app.get("/avatars")
def list_avatars():
    return {"avatars": AVATARS, "backgrounds": BACKGROUNDS,
            "default_avatar": DEFAULT_AVATAR, "default_background": DEFAULT_BG}


@app.post("/render")
def render(
    audio: UploadFile = File(...),
    avatar: str = Form(DEFAULT_AVATAR),
    bg: str = Form(DEFAULT_BG),
    listen: UploadFile = File(None),
):
    """
    audio + avatar id -> lip-synced mp4 (AVTR-1 offline render).

    generate_offline.py args used:
      --speech <audio>  (the spoken track -> lip-sync)
      --avatar <id>     (built-in avatar; default maria)
      --bg <id>         (REQUIRED background; default plain_white)
      --listen <audio>  (OPTIONAL 2nd track -> active-listening reactions)
      --out <mp4>
    """
    if avatar not in AVATARS:
        raise HTTPException(400, f"unknown avatar '{avatar}'. Options: {AVATARS}")
    if bg not in BACKGROUNDS:
        raise HTTPException(400, f"unknown bg '{bg}'. Options: {BACKGROUNDS}")

    task = f"task_{avatar}_{int(time.time())}"
    task_dir = os.path.join(WORK_DIR, task)
    os.makedirs(task_dir, exist_ok=True)

    speech_ext = (audio.filename or "speech.wav").rsplit(".", 1)[-1].lower()
    if speech_ext not in ("wav", "mp3", "ogg", "m4a", "flac"):
        speech_ext = "wav"
    speech_path = os.path.join(task_dir, f"speech.{speech_ext}")
    with open(speech_path, "wb") as f:
        f.write(audio.file.read())

    out_path = os.path.join(task_dir, f"{avatar}.mp4")

    # Call the script directly via the pixi env (consistent with setup; avoids any
    # task-dependency surprises).
    cmd = [
        "pixi", "run", "-e", "renderer", "python", "scripts/generate_offline.py",
        "--speech", speech_path,
        "--avatar", avatar,
        "--bg", bg,
        "--out", out_path,
    ]
    if listen is not None:
        listen_path = os.path.join(task_dir, "listen.wav")
        with open(listen_path, "wb") as f:
            f.write(listen.file.read())
        cmd += ["--listen", listen_path]

    try:
        _run(cmd, capture=True)
    except RuntimeError as e:
        raise HTTPException(502, f"AVTR-1 render failed: {e}") from e

    if not os.path.exists(out_path):
        found = glob.glob(os.path.join(task_dir, "**", "*.mp4"), recursive=True)
        if not found:
            raise HTTPException(502, f"AVTR-1 ran but produced no mp4 in {task_dir}")
        out_path = found[0]

    return FileResponse(out_path, media_type="video/mp4", filename=f"{avatar}.mp4")


if __name__ == "__main__":
    setup_if_needed()
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
