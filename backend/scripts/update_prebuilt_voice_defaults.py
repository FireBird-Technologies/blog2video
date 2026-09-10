"""
One-off: swap the 4 free premade voices in prebuilt_voices from
Rachel/Bill/Alice/Daniel to Kristen/Hale/Samara X/Connor.

Scope is deliberately narrow -- this table only seeds a NEW user's saved_voices
via voice_seed.ensure_free_voices_for_user() (see app/services/voice_seed.py).
It does NOT touch saved_voices, projects, or any existing user's voice picker.
Old projects keep working: voiceover_path stores already-synthesized audio, and
regeneration resolves voice_id straight against ElevenLabs regardless of what
this table contains.

Usage:
    python3 scripts/update_prebuilt_voice_defaults.py --dry-run
    python3 scripts/update_prebuilt_voice_defaults.py
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
from app.services.elevenlabs_voice_design import get_voice_metadata

OLD_VOICE_IDS = {
    "21m00Tcm4TlvDq8ikWAM",  # Rachel
    "pqHfZKP75CvOlQylNhV4",  # Bill
    "Xb7hH8MSUJpSbSDYk0k2",  # Alice
    "onwK4e9ZLuTAKqWW03F9",  # Daniel
}

NEW_VOICES = [
    {"voice_id": "dfeOmy6Uay63tNhyO99j", "name": "Kristen"},
    {"voice_id": "dXtC3XhB9GtPusIpNtQx", "name": "Hale"},
    {"voice_id": "19STyYD15bswVz51nqLf", "name": "Samara X"},
    {"voice_id": "xtw8E1CXDMtNKx4sgP7u", "name": "Connor"},
]


def run(dry_run: bool) -> None:
    db = SessionLocal()
    try:
        deleted = 0
        old_rows = db.query(PrebuiltVoice).filter(PrebuiltVoice.voice_id.in_(OLD_VOICE_IDS)).all()
        for row in old_rows:
            print(f"[update-prebuilt] delete voice_id={row.voice_id} name={row.name!r}")
            if not dry_run:
                db.delete(row)
            deleted += 1

        inserted = 0
        updated = 0
        for item in NEW_VOICES:
            vid = item["voice_id"]
            existing = db.query(PrebuiltVoice).filter(PrebuiltVoice.voice_id == vid).first()
            meta = get_voice_metadata(vid) or {}
            preview_url = meta.get("preview_url")
            labels = meta.get("labels", {})
            description = meta.get("description")

            if existing:
                print(f"[update-prebuilt] update voice_id={vid} name={item['name']!r} -> plan=free")
                if not dry_run:
                    existing.name = item["name"]
                    existing.plan = "free"
                    if preview_url:
                        existing.preview_url = preview_url
                    if labels:
                        existing.labels = str(labels)
                    if description:
                        existing.description = description
                updated += 1
            else:
                print(f"[update-prebuilt] insert voice_id={vid} name={item['name']!r} plan=free")
                if not dry_run:
                    db.add(
                        PrebuiltVoice(
                            voice_id=vid,
                            name=item["name"],
                            preview_url=preview_url,
                            labels=str(labels) if labels else "{}",
                            description=description,
                            plan="free",
                        )
                    )
                inserted += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()

        print(
            f"[update-prebuilt] done: deleted={deleted} inserted={inserted} "
            f"updated={updated} dry_run={int(dry_run)}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print planned changes without writing to DB.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
