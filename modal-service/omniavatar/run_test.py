"""
Benchmark runner for the OmniAvatar service on MODAL. Adapted from
hf-space/omniavatar-service/test_sets/run_test.py so the two providers produce
comparable manifest rows.

What this adds over the HF version — the reason the port exists:

  COLD START IS TIMED SEPARATELY FROM THE RENDER. The HF script folded container
  wake-up into the single /render number, which is exactly the quantity we're trying
  to compare. Here, /ping is timed on its own (it is what wakes a scaled-to-zero
  container), then /render is timed, and the server-reported X-Render-Gpu-Seconds
  isolates pure inference. So each row answers three separate questions:

      ping_s  - how long the container took to exist and be ready (cold start)
      render_s- wall-clock of the render request as a client sees it
      gpu_s   - the torchrun inference itself, server-measured

  On a warm container ping_s is ~0.1s and render_s ≈ gpu_s. On a cold one, ping_s is
  the whole cold-start cost — the number to compare against HF's ~2.5min weight
  re-download plus 2.5-12min GPU wait.

Also verifies the ONE design risk in this port: Modal caps a single HTTP request at
150s and then 303-redirects to a result URL. A render takes 160-400s, so every render
crosses that boundary. `requests` follows 303 by default; this script asserts that the
final response really is mp4 bytes and reports the redirect chain, so a silent failure
of that assumption can't be mistaken for a successful run.

Usage:
    export MODAL_AVATAR_URL=https://<workspace>--omniavatar-omniavatarservice-web.modal.run
    export AVATAR_SERVICE_SECRET=<secret>
    python run_test.py <case_name> <preset_or_image> <audio_path> "<prompt>" [steps]

`preset_or_image` may be a bundled roster id (woman_red, man_beard) or a path to
a portrait file.
"""
import json
import os
import sys
import time

import requests

BASE_URL = os.environ.get("MODAL_AVATAR_URL", "").rstrip("/")
SECRET = os.environ.get("AVATAR_SERVICE_SECRET", "changeme-dev-secret")
GPU = os.environ.get("MODAL_GPU", "L40S")
SCALEDOWN = os.environ.get("MODAL_SCALEDOWN_WINDOW", "300")

HEADERS = {"x-avatar-key": SECRET}

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs")
MANIFEST_PATH = os.path.join(OUT_DIR, "manifest.jsonl")
RENDER_TIMEOUT_S = 1800
PING_TIMEOUT_S = 900  # a cold start can take minutes; this is the wake budget

PRESET_IDS = {"woman_red", "man_beard"}


def main():
    if not BASE_URL:
        sys.exit("MODAL_AVATAR_URL is not set (get it from `modal deploy app.py`)")
    if len(sys.argv) < 5:
        sys.exit('usage: run_test.py <case_name> <preset_or_image> <audio_path> "<prompt>" [steps]')

    case_name, portrait, audio_path, prompt = sys.argv[1:5]
    steps = sys.argv[5] if len(sys.argv) > 5 else None
    is_preset = portrait in PRESET_IDS

    if not is_preset and not os.path.exists(portrait):
        sys.exit(f"portrait is neither a known preset id nor an existing file: {portrait}")
    if not os.path.exists(audio_path):
        sys.exit(f"missing audio file: {audio_path}")

    os.makedirs(OUT_DIR, exist_ok=True)
    avatar_id = portrait if is_preset else f"test_{case_name}"

    # ── 1. /ping — times the COLD START. On a scaled-to-zero app this request is
    # what forces Modal to schedule a container, pull the image, mount the weights
    # Volume and run @modal.enter(). That whole cost lands here, isolated.
    print(f"[{case_name}] /ping (cold-start timer)")
    t_ping = time.time()
    r = requests.get(f"{BASE_URL}/ping", headers=HEADERS, timeout=PING_TIMEOUT_S)
    ping_s = time.time() - t_ping
    r.raise_for_status()
    print(f"[{case_name}] container ready in {ping_s:.1f}s")

    # ── 2. /render — the inference itself, and the ONLY call after /ping.
    #
    # There is no /prepare step: it staged a portrait to container-local disk for
    # a later render, which scale-to-zero made unreliable (the two calls routinely
    # landed on different containers). A roster preset resolves from its id — the
    # file ships inside the service image — and an uploaded portrait travels with
    # the render as an `image` part.
    render_data = {"avatar_id": avatar_id, "prompt": prompt, "render_id": case_name}
    if steps is not None:
        render_data["steps"] = steps
    src_label = f"preset={portrait}" if is_preset else f"image={os.path.basename(portrait)}"
    print(f"[{case_name}] /render {src_label} audio={os.path.basename(audio_path)} "
          f"steps={steps or 'default'}")
    t0 = time.time()
    with open(audio_path, "rb") as f:
        files = {"audio": (os.path.basename(audio_path), f.read(), "audio/mpeg")}
        if not is_preset:
            with open(portrait, "rb") as pf:
                files["image"] = (os.path.basename(portrait), pf.read(), "image/jpeg")
        r = requests.post(
            f"{BASE_URL}/render", headers=HEADERS,
            data=render_data,
            files=files,
            timeout=RENDER_TIMEOUT_S,
        )
    render_s = time.time() - t0

    result = {
        "provider": f"modal-{GPU}",
        "gpu": GPU,
        "scaledown_window": SCALEDOWN,
        "case_name": case_name,
        "portrait": portrait,
        "audio": os.path.basename(audio_path),
        "prompt": prompt,
        "steps": steps or "default",
        "ping_s": round(ping_s, 1),          # cold start, isolated
        "render_s": round(render_s, 1),      # client wall-clock
        "status_code": r.status_code,
        # Server-side timings (same header names as the HF Space).
        "server_total_s": r.headers.get("X-Render-Seconds"),
        "server_gpu_s": r.headers.get("X-Render-Gpu-Seconds"),
        "server_audio_s": r.headers.get("X-Render-Audio-Seconds"),
        # The 150s-redirect check: >0 hops means the sync-endpoint design held up.
        "redirect_hops": len(r.history),
        "content_type": r.headers.get("Content-Type", ""),
    }

    if r.status_code != 200:
        result["error"] = r.text[:2000]
        print(f"[{case_name}] FAILED {r.status_code} ({render_s:.0f}s): {r.text[:500]}")
    elif not r.content.startswith(b"\x00\x00\x00") and b"ftyp" not in r.content[:64]:
        # Guard the 303 assumption: a redirect that degraded into an HTML page or a
        # JSON error would otherwise be written out as a ".mp4" and look like success.
        result["error"] = (
            f"response was not mp4 (content_type={result['content_type']}, "
            f"first bytes={r.content[:64]!r}) — the 150s redirect likely did not "
            f"resolve to the file; switch to the spawn+poll pattern"
        )
        print(f"[{case_name}] BAD PAYLOAD: {result['error']}")
    else:
        out_path = os.path.join(OUT_DIR, f"{case_name}.mp4")
        with open(out_path, "wb") as out:
            out.write(r.content)
        result["output_path"] = out_path
        result["bytes"] = len(r.content)
        gpu_s = result["server_gpu_s"] or "?"
        print(
            f"[{case_name}] OK cold={ping_s:.0f}s render={render_s:.0f}s gpu={gpu_s}s "
            f"redirects={result['redirect_hops']} -> {out_path} ({len(r.content)} bytes)"
        )

    with open(MANIFEST_PATH, "a") as mf:
        mf.write(json.dumps(result) + "\n")


if __name__ == "__main__":
    main()
