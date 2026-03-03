import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.saved_voice import SavedVoice
from app.models.custom_voice import CustomVoice
from app.schemas.schemas import SavedVoiceCreate, SavedVoiceOut, CustomVoiceCreate, CustomVoiceOut
from app.services.elevenlabs_voice_design import create_voice_from_preview

router = APIRouter(prefix="/api/voices", tags=["voices"])


@router.get("/saved", response_model=list[SavedVoiceOut])
def list_saved_voices(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current user's saved voices (for Step 3 and My Voices page)."""
    voices = db.query(SavedVoice).filter(SavedVoice.user_id == user.id).order_by(SavedVoice.created_at.desc()).all()
    return voices


@router.post("/saved", response_model=SavedVoiceOut)
def create_saved_voice(
    data: SavedVoiceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a voice for the current user (from My Voices add flow). Optionally link to a custom_voice."""
    voice = SavedVoice(
        user_id=user.id,
        voice_id=data.voice_id.strip(),
        name=(data.name or "").strip() or "My voice",
        preview_url=(data.preview_url or "").strip() or None,
        audio_base64=data.audio_base64 or None,
        source=(data.source or "custom").strip() or "custom",
        gender=(data.gender or "").strip() or None,
        accent=(data.accent or "").strip() or None,
        description=(data.description or "").strip() or None,
        custom_voice_id=data.custom_voice_id,
    )
    db.add(voice)
    db.commit()
    db.refresh(voice)
    return voice


def _custom_voice_description(data: CustomVoiceCreate) -> str:
    """Build a short description for ElevenLabs from prompt or form fields."""
    if (data.prompt_text or "").strip():
        return (data.prompt_text or "").strip()[:1000]
    parts = []
    if (data.form_gender or "").strip():
        parts.append(f"{data.form_gender.strip()} voice.")
    if (data.form_age or "").strip():
        parts.append(f"Age: {data.form_age.strip()}.")
    if (data.form_persona or "").strip():
        parts.append(f"Persona: {data.form_persona.strip()}.")
    if (data.form_speed or "").strip():
        parts.append(f"Speed: {data.form_speed.strip()}.")
    if (data.form_accent or "").strip():
        parts.append(f"Accent: {data.form_accent.strip()}.")
    return " ".join(parts).strip() or "Custom generated voice."


@router.post("/custom", response_model=CustomVoiceOut)
def create_custom_voice(
    data: CustomVoiceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a custom voice record (prompt/response or form). Adds the voice to the ElevenLabs library
    via create-voice-from-preview so we store a permanent voice_id. Name is generated as Generated 1, 2, ...
    """
    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")
    count = db.query(func.count(CustomVoice.id)).filter(CustomVoice.user_id == user.id).scalar() or 0
    name = f"Generated {count + 1}"
    description = _custom_voice_description(data)
    generated_voice_id = (data.voice_id or "").strip()
    if not generated_voice_id:
        raise HTTPException(status_code=400, detail="voice_id (generated_voice_id from preview) is required")
    try:
        permanent_voice_id = create_voice_from_preview(
            voice_name=name,
            voice_description=description,
            generated_voice_id=generated_voice_id,
        )
    except Exception as e:
        print(f"[VOICES] create-voice-from-preview failed: {e}")
        raise HTTPException(
            status_code=502,
            detail="Failed to add voice to library. The preview may have expired; try designing again.",
        ) from e
    response_json = json.dumps(data.response) if data.response is not None else None
    custom = CustomVoice(
        user_id=user.id,
        name=name,
        voice_id=permanent_voice_id,
        source=(data.source or "form").strip() or "form",
        prompt_text=(data.prompt_text or "").strip() or None,
        response_json=response_json,
        form_gender=(data.form_gender or "").strip() or None,
        form_age=(data.form_age or "").strip() or None,
        form_persona=(data.form_persona or "").strip() or None,
        form_speed=(data.form_speed or "").strip() or None,
        form_accent=(data.form_accent or "").strip() or None,
        preview_url=(data.preview_url or "").strip() or None,
        audio_base64=data.audio_base64 or None,
    )
    db.add(custom)
    db.commit()
    db.refresh(custom)
    return custom


@router.get("/custom", response_model=list[CustomVoiceOut])
def list_custom_voices(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the current user's custom voice creations (Generated 1, 2, ...)."""
    voices = db.query(CustomVoice).filter(CustomVoice.user_id == user.id).order_by(CustomVoice.created_at.desc()).all()
    return voices


@router.delete("/saved/{voice_id}")
def delete_saved_voice(
    voice_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a saved voice. Only the owner can delete."""
    voice = db.query(SavedVoice).filter(SavedVoice.id == voice_id, SavedVoice.user_id == user.id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Saved voice not found")
    db.delete(voice)
    db.commit()
    return {"ok": True}
