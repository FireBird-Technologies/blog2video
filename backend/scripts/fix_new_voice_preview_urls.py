"""
One-off: fix preview_url for the 4 new free voices (Kristen/Hale/Samara X/Connor) in
BOTH prebuilt_voices and saved_voices.

Why this is needed: the preview_url ElevenLabs returns for these shared-library voices
is broken for browser playback --
  - Kristen/Hale/Samara X: a storage.googleapis.com URL served with
    Content-Type: text/plain (confirmed via curl -I), so `new Audio(url).play()`
    silently fails in the browser.
  - Connor: a signed/expiring api.us.elevenlabs.io URL (confirmed by re-fetching
    minutes apart and seeing the embedded timestamp change), so even a fresh copy
    goes stale quickly.

Workaround (same one used when this was first hit for Connor alone): synthesize a
short sample line via TTS once per voice and host it permanently on R2 with the
correct audio/mpeg content-type. See docs/default-voice-migration.md Step 2 for the
synth+upload commands; the resulting URLs are hardcoded below.

Why both tables: saved_voices.preview_url is a COPY taken at seed time from
prebuilt_voices.preview_url (see app/services/voice_seed.py's
ensure_free_voices_for_user) -- it is not a live reference, so fixing prebuilt_voices
alone does not fix any already-seeded user's saved_voices rows. Both need the same
fix independently.

Usage:
    python3 scripts/fix_new_voice_preview_urls.py --dry-run
    python3 scripts/fix_new_voice_preview_urls.py
"""
import os
import sys
from argparse import ArgumentParser

CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.database import SessionLocal
from app.models.prebuilt_voice import PrebuiltVoice
from app.models.saved_voice import SavedVoice

NEW_PREVIEW_URLS = {
    "dfeOmy6Uay63tNhyO99j": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/marketing/voice-previews/kristen.mp3",
    "dXtC3XhB9GtPusIpNtQx": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/marketing/voice-previews/hale.mp3",
    "19STyYD15bswVz51nqLf": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/marketing/voice-previews/samara-x.mp3",
    "xtw8E1CXDMtNKx4sgP7u": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/marketing/voice-previews/connor.mp3",
}


def run(dry_run: bool) -> None:
    db = SessionLocal()
    try:
        pb_updated = 0
        pb_rows = db.query(PrebuiltVoice).filter(PrebuiltVoice.voice_id.in_(NEW_PREVIEW_URLS.keys())).all()
        for row in pb_rows:
            new_url = NEW_PREVIEW_URLS[row.voice_id]
            if row.preview_url == new_url:
                continue
            print(f"[fix-preview] prebuilt_voices id={row.id} voice_id={row.voice_id} name={row.name!r}: {row.preview_url!r} -> {new_url!r}")
            if not dry_run:
                row.preview_url = new_url
            pb_updated += 1

        sv_updated = 0
        sv_rows = db.query(SavedVoice).filter(SavedVoice.voice_id.in_(NEW_PREVIEW_URLS.keys())).all()
        for row in sv_rows:
            new_url = NEW_PREVIEW_URLS[row.voice_id]
            if row.preview_url == new_url:
                continue
            print(f"[fix-preview] saved_voices id={row.id} user_id={row.user_id} voice_id={row.voice_id}: {row.preview_url!r} -> {new_url!r}")
            if not dry_run:
                row.preview_url = new_url
            sv_updated += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()

        print(f"[fix-preview] done: prebuilt_voices_updated={pb_updated} saved_voices_updated={sv_updated} dry_run={int(dry_run)}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print planned changes without writing to DB.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
