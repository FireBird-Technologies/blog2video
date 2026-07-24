"""
Test-set runner for the OmniAvatar Space: one (image, audio, prompt) case ->
one uniquely-named saved mp4 + a JSON manifest entry. Unlike test_service.py
(which always writes to a fixed smoketest_out.mp4 and overwrites), this keeps
every test's output.

Usage:
    export OMNIAVATAR_URL / AVATAR_SERVICE_SECRET / HF_TOKEN (same as test_service.py)
    python run_test.py <case_name> <image_path> <audio_path> "<prompt>"

Saves to outputs/<case_name>.mp4 and appends a row to outputs/manifest.jsonl.
"""
import json
import os
import sys
import time

import requests

BASE_URL = os.environ.get("OMNIAVATAR_URL", "http://localhost:7860").rstrip("/")
SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")
HF_TOKEN = os.environ.get("HF_TOKEN", "")

HEADERS = {"x-avatar-key": SECRET}
if HF_TOKEN:
    HEADERS["Authorization"] = f"Bearer {HF_TOKEN}"

OUT_DIR = os.path.join(os.path.dirname(__file__), "outputs")
MANIFEST_PATH = os.path.join(OUT_DIR, "manifest.jsonl")
RENDER_TIMEOUT_S = 1800


def main():
    if len(sys.argv) < 5:
        sys.exit("usage: run_test.py <case_name> <image_path> <audio_path> \"<prompt>\"")
    case_name, image_path, audio_path, prompt = sys.argv[1:5]
    steps = sys.argv[5] if len(sys.argv) > 5 else None  # optional per-request step override
    for p in (image_path, audio_path):
        if not os.path.exists(p):
            sys.exit(f"missing input file: {p}")

    os.makedirs(OUT_DIR, exist_ok=True)
    avatar_id = f"test_{case_name}"

    print(f"[{case_name}] /ping")
    r = requests.get(f"{BASE_URL}/ping", headers=HEADERS, timeout=30)
    r.raise_for_status()

    print(f"[{case_name}] /prepare image={os.path.basename(image_path)}")
    with open(image_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/prepare", headers=HEADERS,
            data={"avatar_id": avatar_id},
            files={"image": (os.path.basename(image_path), f, "image/jpeg")},
            timeout=120,
        )
    r.raise_for_status()

    render_data = {"avatar_id": avatar_id, "prompt": prompt}
    if steps is not None:
        render_data["steps"] = steps
    print(f"[{case_name}] /render audio={os.path.basename(audio_path)} steps={steps or 'default'} prompt={prompt!r}")
    t0 = time.time()
    with open(audio_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/render", headers=HEADERS,
            data=render_data,
            files={"audio": (os.path.basename(audio_path), f, "audio/mpeg")},
            timeout=RENDER_TIMEOUT_S,
        )
    elapsed = time.time() - t0

    result = {
        "case_name": case_name,
        "image": os.path.basename(image_path),
        "audio": os.path.basename(audio_path),
        "prompt": prompt,
        "steps": steps or "default",
        "elapsed_s": round(elapsed, 1),
        "status_code": r.status_code,
    }
    if r.status_code != 200:
        result["error"] = r.text[:2000]
        print(f"[{case_name}] FAILED {r.status_code} ({elapsed:.0f}s): {r.text[:500]}")
    else:
        out_path = os.path.join(OUT_DIR, f"{case_name}.mp4")
        with open(out_path, "wb") as out:
            out.write(r.content)
        result["output_path"] = out_path
        result["bytes"] = len(r.content)
        print(f"[{case_name}] OK ({elapsed:.0f}s) -> {out_path} ({len(r.content)} bytes)")

    with open(MANIFEST_PATH, "a") as mf:
        mf.write(json.dumps(result) + "\n")


if __name__ == "__main__":
    main()
