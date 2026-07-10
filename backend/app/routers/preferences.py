from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.preference import Preference
from app.schemas.schemas import PreferenceOut, PreferenceSummaryOut, PreferenceUpdate
from app.observability.logging import get_logger

router = APIRouter(prefix="/api/preferences", tags=["preferences"])
logger = get_logger(__name__)

# Uploaded guides are plain text/markdown. Cap matches the regenerate-script
# modal's client-side limit (25 KB) so a preference is never larger than a
# guide typed directly into that flow.
_ALLOWED_CONTENT_TYPES = {"text/plain", "text/markdown", "text/x-markdown"}
_ALLOWED_EXTENSIONS = {"txt", "md", "markdown"}
_MAX_PREFERENCE_BYTES = 25 * 1024  # 25 KB


def _assert_name_available(
    db: Session, user_id: int, name: str, *, exclude_id: int | None = None
) -> None:
    """Reject a style name the user already used.

    Names are unique per user (uq_preferences_user_id_style_name), so a different
    user holding the same name is fine. ``exclude_id`` lets a rename keep its own
    name. Matching is case-insensitive so "Brand Voice" and "brand voice" collide,
    which is what a user renaming by hand expects.
    """
    q = db.query(Preference.id).filter(
        Preference.user_id == user_id,
        func.lower(Preference.style_name) == name.lower(),
    )
    if exclude_id is not None:
        q = q.filter(Preference.id != exclude_id)
    if q.first() is not None:
        raise HTTPException(
            status_code=409,
            detail=f'You already have a preference named "{name}".',
        )


@router.get("", response_model=list[PreferenceOut])
def list_preferences(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current user's saved style preferences, including content.

    Used by the My Preferences dashboard tab (which shows a content snippet and an
    inline editor) and the blog-URL form's style row. Content is small (≤25 KB) and
    scoped to the requesting user, so returning it inline avoids a per-row fetch.
    """
    return (
        db.query(Preference)
        .filter(Preference.user_id == user.id)
        .order_by(Preference.created_at.desc())
        .all()
    )


@router.post("", response_model=PreferenceOut)
def create_preference(
    style_name: str = Form(..., min_length=1, max_length=255),
    content: str | None = Form(None),
    file: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a style guide under a style name.

    The guide text may be either typed directly (``content`` form field) or
    uploaded as a .txt/.md file. Typed text takes precedence when both are sent.
    """
    name = (style_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="A style name is required.")
    _assert_name_available(db, user.id, name)

    typed = (content or "").strip()
    if typed:
        guide_text = content or ""
        if len(guide_text.encode("utf-8")) > _MAX_PREFERENCE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Guide text must be under {_MAX_PREFERENCE_BYTES // 1024} KB.",
            )
    elif file is not None and file.filename:
        content_type = (file.content_type or "").strip().lower()
        ext = (file.filename or "").split(".")[-1].lower()
        # Accept by MIME when specific, otherwise fall back to extension (generic
        # uploads often report application/octet-stream).
        if content_type and content_type not in _ALLOWED_CONTENT_TYPES:
            if ext not in _ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail="File must be a text or markdown file (.txt, .md).",
                )
        elif not content_type and ext not in _ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="File must be a text or markdown file (.txt, .md).",
            )

        file_bytes = file.file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="File is empty.")
        if len(file_bytes) > _MAX_PREFERENCE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File must be under {_MAX_PREFERENCE_BYTES // 1024} KB.",
            )
        try:
            guide_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="File must be valid UTF-8 text.",
            )
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide guide text or upload a .txt/.md file.",
        )

    if not guide_text.strip():
        raise HTTPException(status_code=400, detail="Guide has no readable text.")

    pref = Preference(user_id=user.id, style_name=name, content=guide_text)
    db.add(pref)
    try:
        db.commit()
    except IntegrityError:
        # Lost a race against a concurrent save of the same name.
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f'You already have a preference named "{name}".',
        )
    db.refresh(pref)
    return pref


@router.put("/{preference_id}", response_model=PreferenceOut)
def update_preference(
    preference_id: int,
    data: PreferenceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a style preference's name and/or content. Only the owner can update."""
    pref = (
        db.query(Preference)
        .filter(Preference.id == preference_id, Preference.user_id == user.id)
        .first()
    )
    if not pref:
        raise HTTPException(status_code=404, detail="Preference not found")

    # Held for the IntegrityError message below, which cannot read pref after rollback.
    effective_name = pref.style_name

    if data.style_name is not None:
        name = data.style_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="A style name is required.")
        if len(name) > 255:
            raise HTTPException(status_code=400, detail="Style name is too long.")
        _assert_name_available(db, user.id, name, exclude_id=pref.id)
        pref.style_name = name
        effective_name = name

    if data.content is not None:
        if len(data.content.encode("utf-8")) > _MAX_PREFERENCE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Guide text must be under {_MAX_PREFERENCE_BYTES // 1024} KB.",
            )
        if not data.content.strip():
            raise HTTPException(status_code=400, detail="Guide has no readable text.")
        pref.content = data.content

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f'You already have a preference named "{effective_name}".',
        )
    db.refresh(pref)
    return pref


@router.delete("/{preference_id}")
def delete_preference(
    preference_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a style preference. Only the owner can delete."""
    pref = (
        db.query(Preference)
        .filter(Preference.id == preference_id, Preference.user_id == user.id)
        .first()
    )
    if not pref:
        raise HTTPException(status_code=404, detail="Preference not found")
    db.delete(pref)
    db.commit()
    return {"ok": True}
