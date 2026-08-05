#!/usr/bin/env python
"""Refresh the committed template-preview thumbnails in src/previews/.

Why these are committed
-----------------------
claude.ai does not honour `_meta.ui.csp.resourceDomains` — a known open bug
(anthropics/claude-ai-mcp#40) where declared CSP domains are dropped and a
hardcoded policy is applied instead. Every `<img>` pointing at our R2 bucket is
therefore blocked inside the widget sandbox and the cards render as
broken-image icons.

The fix is to inline the images in the bundle: Vite turns small assets into
`data:` URIs, which carry no origin and so cannot be blocked. Downscaling to
card size (320px WebP) keeps all 11 to roughly 50 KB.

The thumbnails live in the repo so that `npm run build` needs no network and
works in CI. This script is only run by hand when a preview is re-uploaded to
R2 (see mcp_server/upload_template_previews.py for the source pipeline).

Usage (from mcp_server/ui_src/):
    python scripts/fetch_preview_thumbs.py
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import requests
from PIL import Image

BASE = "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews"

# Mirrors mcp_server.handlers.TEMPLATE_PREVIEW_URLS (minus the dead `default`
# entry, which the backend no longer serves). Templates absent here render the
# widget's letter placeholder — currently stickman_football, stickman_2,
# magazine and sakura, whose PNGs 404 on R2.
TEMPLATE_IDS = [
    "nightfall",
    "gridcraft",
    "spotlight",
    "whiteboard",
    "newspaper",
    "matrix",
    "newscast",
    "mosaic",
    "blackswan",
    "bloomberg",
    "chronicle",
]

MAX_SIZE = (320, 180)  # card thumbnails; anything larger is wasted bytes
WEBP_QUALITY = 72
OUT_DIR = Path(__file__).resolve().parent.parent / "src" / "previews"


def fetch_one(tid: str) -> int | None:
    """Fetch, downscale and write one thumbnail. Returns bytes written."""
    try:
        resp = requests.get(f"{BASE}/{tid}.png", timeout=20)
    except requests.RequestException as exc:
        print(f"  {tid:<20} FETCH FAILED ({exc})", file=sys.stderr)
        return None
    if resp.status_code != 200:
        print(f"  {tid:<20} HTTP {resp.status_code} — skipped", file=sys.stderr)
        return None

    img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    img.thumbnail(MAX_SIZE, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=WEBP_QUALITY, method=6)
    data = buf.getvalue()
    (OUT_DIR / f"{tid}.webp").write_bytes(data)
    print(f"  {tid:<20} {img.size[0]}x{img.size[1]}  {len(data) / 1024:6.1f} KB")
    return len(data)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Refreshing {len(TEMPLATE_IDS)} thumbnails into {OUT_DIR}")
    sizes = [n for tid in TEMPLATE_IDS if (n := fetch_one(tid)) is not None]
    if not sizes:
        print("ERROR: nothing fetched — leaving existing files alone", file=sys.stderr)
        return 1
    print(f"\n{len(sizes)}/{len(TEMPLATE_IDS)} written, {sum(sizes) / 1024:.0f} KB total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
