"""
One-time script: upload template preview PNGs to R2 and print handler URLs.

Prerequisites:
  1. Run screenshot_templates.mjs first → /tmp/b2v-template-previews/*.png
     (templates without screenshots fall back to the committed frontend posters)
  2. R2 must be configured (R2_* env vars in .env)

Usage (from backend/):
  python mcp_server/upload_template_previews.py

Output:
  Prints the TEMPLATE_PREVIEW_URLS entries for template_preview_catalog.py.
"""
import io
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services import r2_storage

TEMPLATE_IDS = [
    'default', 'nightfall', 'gridcraft', 'spotlight', 'whiteboard',
    'newspaper', 'matrix', 'newscast', 'mosaic', 'blackswan', 'bloomberg', 'chronicle',
    'stickman_2', 'magazine', 'sakura', 'old-documentary-reel', 'starlit',
]

PNG_DIR = Path('/tmp/b2v-template-previews')
POSTER_DIR = Path(__file__).resolve().parents[2] / 'frontend' / 'public' / 'template-posters'


def preview_png(tid: str) -> bytes | None:
    """Return the generated PNG, or convert the committed poster fallback."""
    png = PNG_DIR / f'{tid}.png'
    if png.exists():
        return png.read_bytes()

    poster = POSTER_DIR / f'{tid}.webp'
    if not poster.exists():
        return None

    output = io.BytesIO()
    with Image.open(poster) as image:
        image.convert('RGB').save(output, 'PNG', optimize=True)
    return output.getvalue()

def main(template_ids: list[str] | None = None) -> int:
    selected_ids = template_ids or TEMPLATE_IDS
    unknown_ids = sorted(set(selected_ids) - set(TEMPLATE_IDS))
    if unknown_ids:
        print(f"ERROR: unknown template IDs: {', '.join(unknown_ids)}", file=sys.stderr)
        return 1

    if not PNG_DIR.exists() and not POSTER_DIR.exists():
        print(f"ERROR: neither {PNG_DIR} nor {POSTER_DIR} exists.", file=sys.stderr)
        print("Run screenshot_templates.mjs first or restore the committed posters.", file=sys.stderr)
        return 1

    if not r2_storage.is_r2_configured():
        print("ERROR: R2 is not configured. Check R2_* env vars in .env", file=sys.stderr)
        return 1

    print("Uploading template preview PNGs to R2…\n")
    urls: dict[str, str] = {}

    for tid in selected_ids:
        body = preview_png(tid)
        if body is None:
            print(f"  ⚠️  MISSING: {tid}.png and {tid}.webp — skipping", file=sys.stderr)
            continue
        key = f'mcp-ui/template-previews/{tid}.png'
        url = r2_storage.upload_bytes(key, body, 'image/png')
        if url:
            print(f"  ✅ {tid}: {url}")
            urls[tid] = url
        else:
            print(f"  ❌ {tid}: upload failed", file=sys.stderr)

    print(f"\n{len(urls)}/{len(selected_ids)} templates uploaded successfully.\n")
    print("=" * 70)
    print("Paste this into backend/app/services/template_preview_catalog.py:")
    print("=" * 70)
    print()
    print("TEMPLATE_PREVIEW_URLS: dict[str, str] = {")
    for tid in selected_ids:
        if tid in urls:
            print(f"    {tid!r}: {urls[tid]!r},")
        else:
            print(f"    # {tid!r}: '',  # upload failed — re-run script")
    print("}")
    return 0 if len(urls) == len(selected_ids) else 1


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
