"""
Benchmark runner for the LongCat-Video-Avatar-1.5 eval Space. Structured after
modal-service/omniavatar/run_test.py so the two providers produce directly comparable
manifest rows, with one deliberate difference: HF Spaces don't scale to zero mid-session
the way Modal containers do, so `ping_s` here measures "first request after container
boot" (mostly model load into VRAM, which happens lazily inside app.py's first /render —
see the note below), not a true per-request cold start. Read the two numbers with that
distinction in mind rather than assuming they're the same cost shape.

Usage:
    export LONGCAT_SPACE_URL=https://<org-or-user>-longcat-avatar-eval.hf.space
    export LONGCAT_SERVICE_SECRET=<same value as the Space secret>
    python run_test.py <case_name> <image_path> <audio_path> "<prompt>" [stage_1]

`stage_1` is optional, defaults to ai2v (image-driven). Use at2v for text-framed generation.
"""
import json
import os
import sys
import time

import requests

BASE_URL = os.environ.get("LONGCAT_SPACE_URL", "").rstrip("/")
SECRET = os.environ.get("LONGCAT_SERVICE_SECRET", "changeme-dev-secret")

HEADERS = {"x-avatar-key": SECRET}

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs")
MANIFEST_PATH = os.path.join(OUT_DIR, "manifest.jsonl")
RENDER_TIMEOUT_S = 3600      # generous: this is a much bigger model than OmniAvatar
PING_TIMEOUT_S = 1200        # first request after a Space (re)boot can be slow


def main():
    if not BASE_URL:
        sys.exit("LONGCAT_SPACE_URL is not set (the Space's https://...hf.space URL)")
    if len(sys.argv) < 4:
        sys.exit('usage: run_test.py <case_name> <image_path> <audio_path> "<prompt>" [stage_1]')

    case_name, image_path, audio_path = sys.argv[1:4]
    prompt = sys.argv[4] if len(sys.argv) > 4 else (
        "A person looking at the camera and talking naturally, calm and friendly, "
        "with clear, expressive lip movements that match the audio."
    )
    stage_1 = sys.argv[5] if len(sys.argv) > 5 else "ai2v"

    if not os.path.exists(image_path):
        sys.exit(f"missing image file: {image_path}")
    if not os.path.exists(audio_path):
        sys.exit(f"missing audio file: {audio_path}")

    os.makedirs(OUT_DIR, exist_ok=True)

    # ── 1. /ping — first-request timing. On a freshly (re)started Space this is mostly
    # the container boot + weight-mount cost; VRAM model load happens lazily on the
    # first /render inside app.py, so /ping alone will NOT capture that — it is timed
    # separately in step 2 by comparing this render's total time against a second,
    # warm render (run this script twice back to back to see the difference).
    print(f"[{case_name}] /ping (first-request timer)")
    t_ping = time.time()
    r = requests.get(f"{BASE_URL}/ping", headers=HEADERS, timeout=PING_TIMEOUT_S)
    ping_s = time.time() - t_ping
    r.raise_for_status()
    print(f"[{case_name}] Space responding in {ping_s:.1f}s")

    # ── 2. /render — the actual inference call.
    render_data = {"render_id": case_name, "prompt": prompt, "stage_1": stage_1}
    print(f"[{case_name}] /render image={os.path.basename(image_path)} "
          f"audio={os.path.basename(audio_path)} stage_1={stage_1}")
    t0 = time.time()
    with open(image_path, "rb") as imgf, open(audio_path, "rb") as af:
        files = {
            "image": (os.path.basename(image_path), imgf.read(), "image/jpeg"),
            "audio": (os.path.basename(audio_path), af.read(), "audio/mpeg"),
        }
        r = requests.post(
            f"{BASE_URL}/render", headers=HEADERS,
            data=render_data,
            files=files,
            timeout=RENDER_TIMEOUT_S,
        )
    render_s = time.time() - t0

    result = {
        "provider": "hf-space-longcat-avatar-1.5",
        "case_name": case_name,
        "image": os.path.basename(image_path),
        "audio": os.path.basename(audio_path),
        "prompt": prompt,
        "stage_1": stage_1,
        "ping_s": round(ping_s, 1),
        "render_s": round(render_s, 1),
        "status_code": r.status_code,
        "server_total_s": r.headers.get("X-Render-Seconds"),
        "nproc_per_node": r.headers.get("X-Render-Nproc"),
        "context_parallel_size": r.headers.get("X-Render-Context-Parallel"),
        "use_int8": r.headers.get("X-Render-Int8"),
        "resolution": r.headers.get("X-Render-Resolution"),
        "content_type": r.headers.get("Content-Type", ""),
    }

    if r.status_code != 200:
        result["error"] = r.text[:2000]
        print(f"[{case_name}] FAILED {r.status_code} ({render_s:.0f}s): {r.text[:500]}")
    elif not r.content.startswith(b"\x00\x00\x00") and b"ftyp" not in r.content[:64]:
        result["error"] = (
            f"response was not mp4 (content_type={result['content_type']}, "
            f"first bytes={r.content[:64]!r})"
        )
        print(f"[{case_name}] BAD PAYLOAD: {result['error']}")
    else:
        out_path = os.path.join(OUT_DIR, f"{case_name}.mp4")
        with open(out_path, "wb") as out:
            out.write(r.content)
        result["output_path"] = out_path
        result["bytes"] = len(r.content)
        print(
            f"[{case_name}] OK ping={ping_s:.0f}s render={render_s:.0f}s "
            f"int8={result['use_int8']} nproc={result['nproc_per_node']} "
            f"-> {out_path} ({len(r.content)} bytes)"
        )

    with open(MANIFEST_PATH, "a") as mf:
        mf.write(json.dumps(result) + "\n")


if __name__ == "__main__":
    main()
