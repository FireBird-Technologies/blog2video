"""
One-time script: upload template preview PNGs to R2 and print handler URLs.

Prerequisites:
  1. Run screenshot_templates.mjs first → /tmp/b2v-template-previews/*.png
  2. R2 must be configured (R2_* env vars in .env)

Usage (from backend/):
  python mcp_server/upload_template_previews.py

Output:
  Prints the TEMPLATE_PREVIEW_URLS dict to paste into handlers.py.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services import r2_storage

TEMPLATE_IDS = [
    'default', 'nightfall', 'gridcraft', 'spotlight', 'whiteboard',
    'newspaper', 'matrix', 'newscast', 'mosaic', 'blackswan', 'bloomberg', 'chronicle',
]

PNG_DIR = Path('/tmp/b2v-template-previews')

if not PNG_DIR.exists():
    print(f"ERROR: {PNG_DIR} does not exist.", file=sys.stderr)
    print("Run screenshot_templates.mjs first.", file=sys.stderr)
    sys.exit(1)

if not r2_storage.is_r2_configured():
    print("ERROR: R2 is not configured. Check R2_* env vars in .env", file=sys.stderr)
    sys.exit(1)

print("Uploading template preview PNGs to R2…\n")
urls: dict[str, str] = {}

for tid in TEMPLATE_IDS:
    png = PNG_DIR / f'{tid}.png'
    if not png.exists():
        print(f"  ⚠️  MISSING: {tid}.png — skipping", file=sys.stderr)
        continue
    key = f'mcp-ui/template-previews/{tid}.png'
    url = r2_storage.upload_bytes(key, png.read_bytes(), 'image/png')
    if url:
        print(f"  ✅ {tid}: {url}")
        urls[tid] = url
    else:
        print(f"  ❌ {tid}: upload failed", file=sys.stderr)

print(f"\n{len(urls)}/12 templates uploaded successfully.\n")
print("=" * 70)
print("Paste this into backend/mcp_server/handlers.py → TEMPLATE_PREVIEW_URLS:")
print("=" * 70)
print()
print("TEMPLATE_PREVIEW_URLS: dict[str, str] = {")
for tid in TEMPLATE_IDS:
    if tid in urls:
        print(f"    {tid!r}: {urls[tid]!r},")
    else:
        print(f"    # {tid!r}: '',  # upload failed — re-run script")
print("}")
print()
print("Then restart uvicorn and test in Claude.")
