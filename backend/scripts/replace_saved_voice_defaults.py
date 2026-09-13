"""
One-off: replace the old 4 free voices (Rachel/Bill/Alice/Daniel) with the new 4
(Kristen/Hale/Samara X/Connor) in every existing user's saved_voices rows.

This is the saved_voices counterpart to update_prebuilt_voice_defaults.py (which only
fixed the prebuilt_voices catalog table). prebuilt_voices does not drive the actual
"choose a voice" pickers in the product -- Step 3 (BlogUrlForm.tsx) and the
existing-project voice-change picker (ProjectVoiceSettingsCard.tsx) both read
saved_voices directly (GET /api/voices/saved, GET /api/projects/{id}/voices). Every
user who signed up before the prebuilt_voices fix still has 4 saved_voices rows
pointing at the old ids, which is why they kept seeing the old names.

Deliberately an UPDATE-in-place, not delete+reinsert (unlike scripts/sync_prebuilt_
voices.py, which was investigated and NOT used for this because it force-replaces
every user's saved voices on every run by design -- a bigger blast radius than
wanted). This script only touches the 4 old-id rows that already exist, preserves
each row's id/created_at, and does not touch projects.custom_voice_id, scenes, or
any rendered audio/video at all.

Usage:
    python3 scripts/replace_saved_voice_defaults.py --dry-run
    python3 scripts/replace_saved_voice_defaults.py
"""
import os
import sys
from argparse import ArgumentParser

CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.database import SessionLocal
from app.constants import OLD_TO_NEW_VOICE_IDS, FREE_PREMADE_FALLBACK
from app.models.saved_voice import SavedVoice
from app.services.elevenlabs_voice_design import get_voice_metadata

NEW_NAME_BY_ID = {item["voice_id"]: item["name"] for item in FREE_PREMADE_FALLBACK}


def run(dry_run: bool) -> None:
    db = SessionLocal()
    try:
        updated = 0
        deleted_dupes = 0

        rows = (
            db.query(SavedVoice)
            .filter(SavedVoice.voice_id.in_(OLD_TO_NEW_VOICE_IDS.keys()))
            .all()
        )

        meta_cache: dict[str, dict] = {}

        for row in rows:
            new_id = OLD_TO_NEW_VOICE_IDS[row.voice_id]

            # If this user already has the new id saved too (e.g. manually added),
            # updating this row in place would create a visible duplicate -- delete
            # the stale old-id row instead and leave the existing new-id row alone.
            already_has_new = (
                db.query(SavedVoice)
                .filter(
                    SavedVoice.user_id == row.user_id,
                    SavedVoice.source == row.source,
                    SavedVoice.voice_id == new_id,
                )
                .first()
            )
            if already_has_new:
                print(
                    f"[replace-saved] user_id={row.user_id} already has {new_id} saved; "
                    f"deleting stale row id={row.id} (voice_id={row.voice_id})"
                )
                if not dry_run:
                    db.delete(row)
                deleted_dupes += 1
                continue

            if new_id not in meta_cache:
                meta_cache[new_id] = get_voice_metadata(new_id) or {}
            meta = meta_cache[new_id]

            print(
                f"[replace-saved] user_id={row.user_id} row id={row.id}: "
                f"{row.voice_id} ({row.name!r}) -> {new_id} ({NEW_NAME_BY_ID.get(new_id)!r})"
            )
            if not dry_run:
                row.voice_id = new_id
                row.name = NEW_NAME_BY_ID.get(new_id, row.name)
                if meta.get("preview_url"):
                    row.preview_url = meta["preview_url"]
                if meta.get("description"):
                    row.description = meta["description"]
            updated += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()

        print(
            f"[replace-saved] done: updated={updated} deleted_dupes={deleted_dupes} "
            f"dry_run={int(dry_run)}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print planned changes without writing to DB.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
