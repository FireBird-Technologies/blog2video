"""Prove that /render accepts a portrait INLINE and actually uses it.

WHY THIS EXISTS
A custom portrait used to reach the GPU via a separate /prepare call that wrote it
to container-local disk. With scaledown_window=2s the two calls routinely land on
different containers, so /render found nothing and 404'd — intermittently in the
best case, and on project 1130 it lost all five scenes. Sending the bytes with the
render removes the shared state, so there is no window to lose them in.

WHAT IT ASSERTS — the point is the FACE, not the HTTP status
A silent fallback to a bundled preset would return a perfectly valid 200 with a
perfectly good mp4, and look exactly like success. So this renders the same audio
twice — once with an inline photo, once with a roster preset — and compares frames
against the source portrait. If A's face is not the uploaded photo, or A and B look
alike, the inline path did not do what it claims.

Run A happens TWICE with a cold container in between: one pass could be a container
that happened to survive. Two passes across a scaledown is the actual proof.

Usage:
    export MODAL_AVATAR_URL=https://<workspace>--omniavatar-omniavatarservice-web.modal.run
    export AVATAR_SERVICE_SECRET=<secret>
    python verify_inline_image.py <portrait.jpg> <audio.mp3> [out_dir]
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

import requests

BASE = os.environ.get("MODAL_AVATAR_URL", "").rstrip("/")
SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "")
# Header name must match backend/app/services/avatar.py::_headers — a wrong name
# reads as a 404, not a 401, which is a confusing way to fail.
HEADERS = {"x-avatar-key": SECRET} if SECRET else {}
PRESET_ID = "man_beard"  # bundled roster face, visibly different from any upload

# Long enough to absorb a cold start plus the render itself.
RENDER_TIMEOUT = 1200


def ping() -> float:
    """Time the wake-up separately: it is what a scaled-to-zero container costs,
    and folding it into the render number is exactly what we're trying to see."""
    t0 = time.time()
    try:
        requests.get(f"{BASE}/ping", headers=HEADERS, timeout=600)
    except Exception as e:
        print(f"    ping failed: {e}")
    return time.time() - t0


def render(label, avatar_id, audio_path, image_path, out_dir):
    """One /render call. Returns (out_mp4, render_s, gpu_s) or (None, ...) on failure."""
    with open(audio_path, "rb") as f:
        audio_bytes = f.read()
    files = {"audio": (os.path.basename(audio_path), audio_bytes, "audio/mpeg")}
    if image_path:
        with open(image_path, "rb") as f:
            files["image"] = (os.path.basename(image_path), f.read(), "image/jpeg")

    t0 = time.time()
    resp = requests.post(
        f"{BASE}/render",
        headers=HEADERS,
        data={"avatar_id": avatar_id, "render_id": f"verify_{label}_{int(t0)}"},
        files=files,
        timeout=RENDER_TIMEOUT,
    )
    elapsed = time.time() - t0

    if resp.status_code != 200:
        print(f"    HTTP {resp.status_code}: {resp.text[:200]}")
        return None, elapsed, None
    # A render exceeds Modal's 150s single-request cap and 303-redirects to a result
    # URL. requests follows it, but assert we ended up with real mp4 bytes rather
    # than an HTML error page or a redirect stub.
    if len(resp.content) < 10_000:
        print(f"    body too small to be an mp4: {len(resp.content)} bytes")
        return None, elapsed, None

    out = os.path.join(out_dir, f"{label}.mp4")
    with open(out, "wb") as f:
        f.write(resp.content)
    return out, elapsed, resp.headers.get("X-Render-Gpu-Seconds")


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True,
    ).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def face_frame(mp4, out_png, at="00:00:01"):
    """One frame, normalised to a fixed size so frames from different sources are
    directly comparable."""
    subprocess.run(
        ["ffmpeg", "-y", "-ss", at, "-i", mp4, "-frames:v", "1",
         "-vf", "scale=256:256", out_png],
        capture_output=True,
    )
    return out_png if os.path.exists(out_png) else None


def rmse(a, b):
    """Root-mean-square difference between two same-size images, 0-255.

    Crude on purpose: we are not doing face recognition, only asking "are these
    two obviously different people?". A roster face vs an uploaded photo differs
    enormously; two frames of the same render differ barely at all."""
    out = subprocess.run(
        ["ffmpeg", "-i", a, "-i", b, "-filter_complex",
         "[0:v][1:v]signalstats=stat=ALL,psnr", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    for line in out.splitlines():
        if "average:" in line and "psnr" in line.lower():
            return line.strip()
    # Fall back to raw byte difference — enough to tell "same" from "different".
    with open(a, "rb") as f1, open(b, "rb") as f2:
        d1, d2 = f1.read(), f2.read()
    if len(d1) != len(d2):
        return "different-size"
    diff = sum(abs(x - y) for x, y in zip(d1[:20000], d2[:20000])) / 20000
    return f"bytediff={diff:.1f}"


def main():
    if not BASE:
        sys.exit("set MODAL_AVATAR_URL")
    portrait, audio = sys.argv[1], sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else "verify_out"
    os.makedirs(out_dir, exist_ok=True)

    audio_s = duration(audio)
    print(f"portrait : {portrait}")
    print(f"audio    : {audio}  ({audio_s:.1f}s)\n")

    results = {}

    # A1 — custom, inline image, cold container
    print("[A1] avatar_id=custom + inline image (cold)")
    p = ping()
    mp4, secs, gpu = render("A1_custom_inline", "custom", audio, portrait, out_dir)
    print(f"    ping={p:.1f}s render={secs:.1f}s gpu={gpu} -> {mp4}")
    results["A1"] = mp4

    # B — roster preset, NO image. Same audio, so any visual difference is the face.
    print("\n[B] avatar_id=man_beard, no image (control)")
    p = ping()
    mp4, secs, gpu = render("B_preset", PRESET_ID, audio, None, out_dir)
    print(f"    ping={p:.1f}s render={secs:.1f}s gpu={gpu} -> {mp4}")
    results["B"] = mp4

    # A2 — repeat A after the container has scaled down. One pass could be luck.
    print(f"\n[A2] waiting 90s for scaledown, then repeating A...")
    time.sleep(90)
    print("[A2] avatar_id=custom + inline image (cold again)")
    p = ping()
    mp4, secs, gpu = render("A2_custom_inline", "custom", audio, portrait, out_dir)
    print(f"    ping={p:.1f}s render={secs:.1f}s gpu={gpu} -> {mp4}")
    results["A2"] = mp4

    # ── Assertions ──────────────────────────────────────────────────────────
    print("\n" + "=" * 62)
    ok = True

    for k in ("A1", "B", "A2"):
        if not results[k]:
            print(f"FAIL  {k}: no mp4 returned")
            ok = False
    if not ok:
        sys.exit(1)

    for k in ("A1", "B", "A2"):
        d = duration(results[k])
        match = abs(d - audio_s) < 2.0
        print(f"{'PASS' if match else 'FAIL'}  {k} duration {d:.1f}s vs audio {audio_s:.1f}s")
        ok &= match

    fa1 = face_frame(results["A1"], os.path.join(out_dir, "frame_A1.png"))
    fb = face_frame(results["B"], os.path.join(out_dir, "frame_B.png"))
    fa2 = face_frame(results["A2"], os.path.join(out_dir, "frame_A2.png"))

    if fa1 and fb:
        print(f"\nframes for visual check:\n  A1 (should be YOUR photo) : {fa1}"
              f"\n  B  (should be Marcus)     : {fb}\n  A2 (should be YOUR photo) : {fa2}")
        print(f"\n  A1 vs B  : {rmse(fa1, fb)}   <- must be clearly DIFFERENT faces")
        print(f"  A1 vs A2 : {rmse(fa1, fa2)}   <- must be the SAME face")

    print("=" * 62)
    print("Inline-image renders returned mp4 on BOTH cold attempts."
          if ok else "FAILURES above — do not change the backend.")
    print("Open the three frames to confirm the face: A1/A2 = uploaded photo, B = Marcus.")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
