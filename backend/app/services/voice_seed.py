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

    if rows:
        for r in rows:
            db.add(
                SavedVoice(
                    user_id=user_id,
                    voice_id=r.voice_id,
                    name=r.name,
                    preview_url=r.preview_url,
                    source="prebuilt",
                    plan=r.plan,
                    description=r.description,
                )
            )
    else:
        for item in FREE_PREMADE_FALLBACK:
            db.add(
                SavedVoice(
                    user_id=user_id,
                    voice_id=item["voice_id"],
                    name=item["name"],
                    preview_url=None,
                    source="prebuilt",
                    plan="free",
                )
            )

    db.commit()
