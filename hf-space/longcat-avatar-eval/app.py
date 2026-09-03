"""
LongCat-Video-Avatar-1.5 on a Hugging Face Space (Docker SDK) — a STANDALONE evaluation
service. This is NOT wired into blog2video's backend/frontend and does not touch
modal-service/omniavatar/ or anything under backend/ or frontend/. It exists purely to let
docs/longcat-avatar.md be filled in with real numbers (weight size, render time, VRAM
behaviour, quality) via the CLI script `run_test.py`, before any decision is made about
whether this model is worth productionizing.

Endpoints: GET /ping, GET /lastlog, POST /render.

Modelled on modal-service/omniavatar/app.py's /render contract (single self-contained
request, no /prepare step, X-Render-* timing headers) so the two providers are easy to
compare — but the deployment mechanics are HF Spaces, not Modal: no Volume, no
scale-to-zero, no per-second billing. A Space's container stays up for as long as the
Space is running, so "cold start" here means "first request after the container boots",
not "first request after 2s of idle" the way it does on the Modal port.

GPU topology: this defaults to SINGLE-GPU (torchrun --nproc_per_node=1), which the
upstream script actually supports natively — run_demo_avatar_single_audio_to_video.py's
--context_parallel_size flag defaults to 1, and dist.init_process_group is called
regardless of world size, so a single-process run is not a hack, it's the documented
default that the README's --nproc_per_node=2 example simply doesn't use. See
docs/longcat-avatar.md for whether this held up on real hardware.

Usage:
    Push this directory to a Hugging Face Space with sdk: docker and a GPU hardware tier.
    The Space builds the Dockerfile, downloads weights on first boot (see download_weights
    in the Dockerfile's CMD), and serves this FastAPI app on port 7860 (HF Spaces' default).
"""
import glob
import json
import os
import shutil
import subprocess
import time
import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

REPO_DIR = "/root/LongCat-Video"
CHECKPOINT_DIR = "/root/weights/LongCat-Video-Avatar-1.5"
BASE_MODEL_DIR = "/root/weights/LongCat-Video"  # tokenizer/text_encoder/vae only, see download step
WORK_ROOT = "/tmp/longcat_avatar_renders"
SHARED_SECRET = os.environ.get("LONGCAT_SERVICE_SECRET", "changeme-dev-secret")

# Single-GPU by default (see module docstring). Override via Space env vars if the
# single-GPU benchmark (docs/longcat-avatar.md step 3) shows it does not hold up.
NPROC_PER_NODE = int(os.environ.get("LONGCAT_NPROC_PER_NODE", "1"))
CONTEXT_PARALLEL_SIZE = int(os.environ.get("LONGCAT_CONTEXT_PARALLEL_SIZE", "1"))
USE_INT8 = os.environ.get("LONGCAT_USE_INT8", "true").lower() != "false"
RESOLUTION = os.environ.get("LONGCAT_RESOLUTION", "480p")  # 480p | 720p

DEFAULT_PROMPT = (
    "A person looking at the camera and talking naturally, calm and friendly, "
    "with clear, expressive lip movements that match the audio."
)

app = FastAPI()
os.makedirs(WORK_ROOT, exist_ok=True)


def _safe_render_id(raw: str | None) -> str:
    keep = [c if (c.isalnum() or c in ("_", "-")) else "_" for c in (raw or "")]
    token = "".join(keep).strip("_") or f"r{int(time.time() * 1000)}"
    return token[:80]


@app.middleware("http")
async def check_secret(request, call_next):
    if request.headers.get("x-avatar-key") != SHARED_SECRET:
        return JSONResponse({"detail": "unauthorized"}, status_code=401)
    return await call_next(request)


@app.get("/ping")
def ping():
    return {"ok": True, "model": "LongCat-Video-Avatar-1.5", "provider": "hf-space"}


@app.get("/lastlog")
def lastlog():
    logs = sorted(
        glob.glob(os.path.join(WORK_ROOT, "*", "render_stdout.log")),
        key=os.path.getmtime,
    )
    last_stdout, last_path = "", None
    if logs:
        last_path = logs[-1]
        with open(last_path) as f:
            last_stdout = f.read()
    return {
        "nproc_per_node": NPROC_PER_NODE,
        "context_parallel_size": CONTEXT_PARALLEL_SIZE,
        "use_int8": USE_INT8,
        "resolution": RESOLUTION,
        "last_stdout_path": last_path,
        "last_stdout_tail": "\n".join(last_stdout.splitlines()[-80:]),
    }


@app.post("/render")
def render(
    image: UploadFile = File(...),
    audio: UploadFile = File(...),
    render_id: str = Form(None),
    prompt: str = Form(DEFAULT_PROMPT),
    stage_1: str = Form("ai2v"),          # ai2v (image-driven) | at2v (text-driven framing)
    resolution: str = Form(None),          # overrides RESOLUTION env default when set
    num_segments: int = Form(1),
    ref_img_index: int = Form(10),
    mask_frame_range: int = Form(3),
    use_int8: bool = Form(None),           # overrides USE_INT8 env default when set
):
    """image + audio (+ prompt) -> lip-synced mp4, single self-contained request.

    Mirrors modal-service/omniavatar/app.py's /render contract: no /prepare step, the
    portrait and audio travel WITH the render, response is a bare video/mp4 with
    X-Render-* timing headers. There is no matte/cutout stage in this eval service.
    """
    rid = _safe_render_id(render_id or f"render_{int(time.time() * 1000)}")
    work_dir = os.path.join(WORK_ROOT, rid)
    os.makedirs(work_dir, exist_ok=True)

    image_ext = (image.filename or "source.png").rsplit(".", 1)[-1].lower()
    if image_ext not in ("jpg", "jpeg", "png", "webp"):
        image_ext = "png"
    image_path = os.path.join(work_dir, f"source.{image_ext}")
    with open(image_path, "wb") as f:
        f.write(image.file.read())

    audio_ext = (audio.filename or "input.wav").rsplit(".", 1)[-1].lower()
    if audio_ext not in ("wav", "mp3", "m4a", "flac", "ogg"):
        audio_ext = "wav"
    audio_path = os.path.join(work_dir, f"input_audio.{audio_ext}")
    with open(audio_path, "wb") as f:
        f.write(audio.file.read())

    input_json_path = os.path.join(work_dir, "input.json")
    with open(input_json_path, "w") as f:
        json.dump(
            {
                "prompt": prompt,
                "cond_image": image_path,
                "cond_audio": {"person1": audio_path},
            },
            f,
        )

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
        "--model_type=avatar-v1.5",
        "--use_distill",
    ]
    if resolved_use_int8:
        cmd.append("--use_int8")

    print(f">>> [render] REQUEST rid={rid!r} stage_1={stage_1} "
          f"resolution={resolved_resolution} int8={resolved_use_int8} "
          f"nproc={NPROC_PER_NODE} cp={CONTEXT_PARALLEL_SIZE}", flush=True)
    print(f">>> [render] cmd: {' '.join(cmd)}", flush=True)

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
    render_s = time.time() - render_start

    if returncode != 0:
        with open(stdout_log_path) as f:
            tail = "\n".join(f.read().splitlines()[-60:])
        print(f">>> [render] FAILED rc={returncode} rid={rid} after={render_s:.1f}s\n{tail}",
              flush=True)
        raise HTTPException(502, f"LongCat-Video-Avatar inference failed (rc={returncode}):\n{tail}")

    candidates = glob.glob(os.path.join(output_dir, "**", "*.mp4"), recursive=True)
    if not candidates:
        raise HTTPException(502, f"Inference ran but produced no mp4 under {output_dir}")
    output_path = max(candidates, key=os.path.getmtime)

    total_s = time.time() - render_start
    print(
        f">>> [render] TIMING rid={rid} total={total_s:.1f}s "
        f"size={os.path.getsize(output_path)}B",
        flush=True,
    )

    headers = {
        "X-Render-Seconds": f"{total_s:.1f}",
        "X-Render-Id": rid,
        "X-Render-Provider": "hf-space-longcat-avatar-1.5",
        "X-Render-Nproc": str(NPROC_PER_NODE),
        "X-Render-Context-Parallel": str(CONTEXT_PARALLEL_SIZE),
        "X-Render-Int8": str(resolved_use_int8).lower(),
        "X-Render-Resolution": resolved_resolution,
    }
    return FileResponse(
        output_path, media_type="video/mp4", filename=f"{rid}.mp4", headers=headers
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
