"""Seed free premade voices into a user's saved list when they have none (e.g. on login)."""
from sqlalchemy.orm import Session

from app.constants import FREE_PREMADE_VOICE_IDS, FREE_PREMADE_FALLBACK
from app.models.saved_voice import SavedVoice
from app.models.prebuilt_voice import PrebuiltVoice


def ensure_free_voices_for_user(db: Session, user_id: int) -> None:
    """
    If the user has zero saved voices, add the four free premade voices (Rachel, Bill, Alice, Daniel)
    from PrebuiltVoice, or from FREE_PREMADE_FALLBACK if the prebuilt_voices table is empty.
    Idempotent: only runs when saved count is 0.
    """
    count = db.query(SavedVoice).filter(SavedVoice.user_id == user_id).count()
    if count > 0:
        return

    rows = (
        db.query(PrebuiltVoice)
        .filter(PrebuiltVoice.voice_id.in_(FREE_PREMADE_VOICE_IDS))
        .order_by(PrebuiltVoice.name)
        .all()
    )
    row_by_id = {r.voice_id: r for r in rows}

    # Always seed exactly the 4 configured free IDs in fallback-defined order.
    for item in FREE_PREMADE_FALLBACK:
        vid = item["voice_id"]
        row = row_by_id.get(vid)
        db.add(
            SavedVoice(
                user_id=user_id,
                voice_id=vid,
                name=(row.name if row else item["name"]),
                preview_url=(row.preview_url if row else None),
                source="prebuilt",
                plan="free",
                description=(row.description if row else None),
            )
        )

    db.commit()
