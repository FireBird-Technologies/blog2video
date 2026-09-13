"""
One-off: replace the long, raw ElevenLabs descriptions (100+ words) for the 4 new
voices (Kristen/Hale/Samara X/Connor) with a single descriptive sentence each, in
prebuilt_voices AND saved_voices. Matches the length/style of the old Bill
description ("Friendly and comforting voice ready to narrate your stories.") --
one sentence, no marketing language ("great for" / "perfect for" / "ideal for"),
accent and gender folded into the sentence itself.

Description column only -- no other field touched.

Usage:
    python3 scripts/shorten_new_voice_descriptions.py --dry-run
    python3 scripts/shorten_new_voice_descriptions.py
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

SHORT_DESCRIPTIONS = {
    "dfeOmy6Uay63tNhyO99j": "Upbeat and engaging American female voice with a natural, focused tone.",  # Kristen
    "dXtC3XhB9GtPusIpNtQx": "Confident and persuasive American male voice with a smooth, expressive delivery.",  # Hale
    "19STyYD15bswVz51nqLf": "Smooth and classy British female voice with an elegant, relaxed tone.",  # Samara X
    "xtw8E1CXDMtNKx4sgP7u": "Energetic and dynamic British male voice with a bright, punchy delivery.",  # Connor
}


def run(dry_run: bool) -> None:
    db = SessionLocal()
    try:
        pb_updated = 0
        for row in db.query(PrebuiltVoice).filter(PrebuiltVoice.voice_id.in_(SHORT_DESCRIPTIONS.keys())).all():
            new_desc = SHORT_DESCRIPTIONS[row.voice_id]
            if row.description == new_desc:
                continue
            print(f"[shorten-desc] prebuilt_voices id={row.id} {row.name!r}: {row.description!r} -> {new_desc!r}")
            if not dry_run:
                row.description = new_desc
            pb_updated += 1

        sv_updated = 0
        for row in db.query(SavedVoice).filter(SavedVoice.voice_id.in_(SHORT_DESCRIPTIONS.keys())).all():
            new_desc = SHORT_DESCRIPTIONS[row.voice_id]
            if row.description == new_desc:
                continue
            print(f"[shorten-desc] saved_voices id={row.id} user_id={row.user_id} {row.name!r}: {row.description!r} -> {new_desc!r}")
            if not dry_run:
                row.description = new_desc
            sv_updated += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()

        print(f"[shorten-desc] done: prebuilt_voices_updated={pb_updated} saved_voices_updated={sv_updated} dry_run={int(dry_run)}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print planned changes without writing to DB.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
