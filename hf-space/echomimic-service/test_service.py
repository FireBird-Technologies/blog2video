"""
End-to-end smoke test for the EchoMimic Space.

Runs the full contract against a deployed Space: /ping -> /prepare (portrait) ->
/render (audio) -> saves the returned mp4. This is the only way to validate the
service - it CANNOT run on a non-NVIDIA machine (EchoMimic needs CUDA), so point
it at the deployed HF Space (or any CUDA host running the container).

Usage:
    export ECHOMIMIC_URL="https://<user>-echomimic-service.hf.space"
    export AVATAR_SERVICE_SECRET="<the Space secret>"
    python test_service.py [image_path] [audio_path]

Defaults reuse the shared MuseTalk fixtures in
../avatar-service/musetalk_test_inputs/ (a portrait jpg + a short mp3), so a bare
`python test_service.py` works once the two env vars are set.

Renders are slow on a T4 - the client timeout below is deliberately generous.
"""
import os
import sys

import requests

BASE_URL = os.environ.get("ECHOMIMIC_URL", "http://localhost:7860").rstrip("/")
SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")
HEADERS = {"x-avatar-key": SECRET}

_FIXTURES = os.path.join(os.path.dirname(__file__), "..", "avatar-service", "musetalk_test_inputs")
DEFAULT_IMAGE = os.path.join(_FIXTURES, "img1_obama.jpg")
DEFAULT_AUDIO = os.path.join(_FIXTURES, "biden_AUDIO_ONLY.mp3")

AVATAR_ID = "smoketest"
# Generous: acc render on a T4 for ~240 frames can take minutes.
RENDER_TIMEOUT_S = 1200


def main():
    image_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_IMAGE
    audio_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_AUDIO
    for p in (image_path, audio_path):
        if not os.path.exists(p):
            sys.exit(f"missing input file: {p}")

    print(f"[1/3] GET {BASE_URL}/ping")
    r = requests.get(f"{BASE_URL}/ping", headers=HEADERS, timeout=30)
    r.raise_for_status()
    print("      ->", r.json())

    print(f"[2/3] POST /prepare  (image={os.path.basename(image_path)})")
    with open(image_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/prepare",
            headers=HEADERS,
            data={"avatar_id": AVATAR_ID},
            files={"image": (os.path.basename(image_path), f, "image/jpeg")},
            timeout=120,
        )
    r.raise_for_status()
    print("      ->", r.json())

    print(f"[3/3] POST /render   (audio={os.path.basename(audio_path)})  [up to {RENDER_TIMEOUT_S}s]")
    with open(audio_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/render",
            headers=HEADERS,
            data={"avatar_id": AVATAR_ID},
            files={"audio": (os.path.basename(audio_path), f, "audio/mpeg")},
            timeout=RENDER_TIMEOUT_S,
        )
    if r.status_code != 200:
        sys.exit(f"render failed: {r.status_code} {r.text[:500]}")

    out_path = os.path.join(os.path.dirname(__file__), f"{AVATAR_ID}_out.mp4")
    with open(out_path, "wb") as out:
        out.write(r.content)
    print(f"      -> saved {len(r.content)} bytes to {out_path}")
    print("\nOK. Open the mp4 and check: (a) lips match the audio, and (b) the")
    print("face shows expression/head-motion that tracks the audio (vs MuseTalk's")
    print("frozen upper face) - that expressiveness is the whole point of EchoMimic.")


if __name__ == "__main__":
    main()
