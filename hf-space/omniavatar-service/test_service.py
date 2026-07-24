"""
End-to-end smoke test for the OmniAvatar Space.

Runs the full contract against a deployed Space: /ping -> /prepare (portrait) ->
/render (audio + optional prompt) -> saves the returned mp4. This is the only way
to validate the service - it CANNOT run on a non-NVIDIA machine (OmniAvatar needs
CUDA), so point it at the deployed HF Space (or any CUDA host running the container).

Usage:
    export OMNIAVATAR_URL="https://<user>-omniavatar-service.hf.space"
    export AVATAR_SERVICE_SECRET="<the Space secret>"
    # For a PRIVATE Space, also send the HF bearer so the HF proxy lets you in:
    export HF_TOKEN="<hf token>"
    python test_service.py [image_path] [audio_path] ["prompt"]

Defaults reuse the shared MuseTalk fixtures in
../avatar-service/musetalk_test_inputs/ (a portrait jpg + a short mp3), so a bare
`python test_service.py` works once the env vars are set.

Renders are slow on a T4 - the client timeout below is deliberately generous.
"""
import os
import sys

import requests

BASE_URL = os.environ.get("OMNIAVATAR_URL", "http://localhost:7860").rstrip("/")
SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")
HF_TOKEN = os.environ.get("HF_TOKEN", "")

# App auth is X-Avatar-Key. For a PRIVATE Space, HF's proxy also needs the bearer
# token BEFORE the request reaches the app - send both (harmless if public).
HEADERS = {"x-avatar-key": SECRET}
if HF_TOKEN:
    HEADERS["Authorization"] = f"Bearer {HF_TOKEN}"

_FIXTURES = os.path.join(os.path.dirname(__file__), "..", "avatar-service", "musetalk_test_inputs")
DEFAULT_IMAGE = os.path.join(_FIXTURES, "img1_obama.jpg")
DEFAULT_AUDIO = os.path.join(_FIXTURES, "biden_AUDIO_ONLY.mp3")
DEFAULT_PROMPT = "A person looking at the camera and talking naturally, calm and friendly."

AVATAR_ID = "smoketest"
# Generous: a 1.3B diffusion render on a T4 can take several minutes.
RENDER_TIMEOUT_S = 1800


def main():
    image_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_IMAGE
    audio_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_AUDIO
    prompt = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_PROMPT
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
    print(f"      prompt: {prompt!r}")
    with open(audio_path, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/render",
            headers=HEADERS,
            data={"avatar_id": AVATAR_ID, "prompt": prompt},
            files={"audio": (os.path.basename(audio_path), f, "audio/mpeg")},
            timeout=RENDER_TIMEOUT_S,
        )
    if r.status_code != 200:
        sys.exit(f"render failed: {r.status_code} {r.text[:1000]}")

    out_path = os.path.join(os.path.dirname(__file__), f"{AVATAR_ID}_out.mp4")
    with open(out_path, "wb") as out:
        out.write(r.content)
    print(f"      -> saved {len(r.content)} bytes to {out_path}")
    print("\nOK. Open the mp4 and check: (a) lips match the audio, (b) the face")
    print("shows expression AND (c) there is adaptive body/gesture motion that")
    print("tracks the audio + follows the prompt - that body motion is OmniAvatar's")
    print("edge over EchoMimic's head-only expressiveness.")


if __name__ == "__main__":
    main()
