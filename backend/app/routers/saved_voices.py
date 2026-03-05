import json
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.saved_voice import SavedVoice
from app.models.custom_voice import CustomVoice
from app.schemas.schemas import SavedVoiceCreate, SavedVoiceOut, CustomVoiceCreate, CustomVoiceOut
from app.services.elevenlabs_voice_design import (
    create_voice_from_preview,
    create_voice_ivc,
    generate_voice_preview_audio,
    get_voice_preview_url,
)
from app.services import r2_storage

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
    """Save a voice for the current user (from My Voices add flow). Optionally link to a custom_voice.
    When linking to a custom_voice, use its preview_url.
    """
    preview_url = (data.preview_url or "").strip() or None
    voice_id = data.voice_id.strip()
    custom = None
    if data.custom_voice_id:
        custom = (
            db.query(CustomVoice)
            .filter(CustomVoice.id == data.custom_voice_id, CustomVoice.user_id == user.id)
            .first()
        )
        if custom:
            voice_id = custom.voice_id  # use permanent voice_id for TTS
            if custom.preview_url:
                preview_url = custom.preview_url
    voice = SavedVoice(
        user_id=user.id,
        voice_id=voice_id,
        name=(data.name or "").strip() or "My voice",
        preview_url=preview_url,
        source=(data.source or "custom").strip() or "custom",
        plan=(data.plan or "").strip() or None,
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
        parts.append(f"Country: {data.form_accent.strip()}.")
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
    name = (data.name or "").strip() or f"Generated {count + 1}"
    description = _custom_voice_description(data)
    generated_voice_id = (data.voice_id or "").strip()
    if not generated_voice_id:
        raise HTTPException(status_code=400, detail="voice_id (generated_voice_id from preview) is required")
    try:
        permanent_voice_id, preview_url_from_api = create_voice_from_preview(
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
    preview_url = preview_url_from_api or (data.preview_url or "").strip() or None
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
        preview_url=preview_url,
    )
    db.add(custom)
    db.commit()
    db.refresh(custom)
    return custom


# Allowed MIME types for IVC: audio and video (Eleven Labs accepts both)
_CLONE_ALLOWED_CONTENT_TYPES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
    "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/webm", "audio/ogg",
    "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
}
_MAX_CLONE_FILE_BYTES = 50 * 1024 * 1024  # 50MB


@router.post("/clone", response_model=CustomVoiceOut)
def create_custom_voice_clone(
    name: str = Form(..., min_length=1, max_length=255),
    remove_background_noise: str = Form("true"),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a custom voice via Instant Voice Clone (Eleven Labs IVC). Accepts one audio or video file."""
    remove_bg = (remove_background_noise or "true").strip().lower() in ("true", "1", "yes")
    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")
    if not file.filename:
        raise HTTPException(status_code=400, detail="A file is required")
    content_type = (file.content_type or "").strip().lower()
    if content_type and content_type not in _CLONE_ALLOWED_CONTENT_TYPES:
        # Allow by extension if content_type is generic (e.g. application/octet-stream)
        ext = (file.filename or "").split(".")[-1].lower()
        if ext not in {"mp3", "wav", "m4a", "mp4", "webm", "ogg", "mov", "avi"}:
            raise HTTPException(
                status_code=400,
                detail="File must be an audio or video type (e.g. mp3, wav, mp4, m4a, webm).",
            )
    file_bytes = file.file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File is empty.")
    if len(file_bytes) > _MAX_CLONE_FILE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File size must be under {_MAX_CLONE_FILE_BYTES // (1024*1024)}MB.",
        )
    try:
        voice_id, _ = create_voice_ivc(
            name=name.strip(),
            file_bytes=file_bytes,
            filename=file.filename or "audio.mp3",
            remove_background_noise=remove_bg,
        )
    except Exception as e:
        print(f"[VOICES] IVC failed: {e}")
        raise HTTPException(
            status_code=502,
            detail="Failed to create voice clone. Check the file format and try again.",
        ) from e
    preview_url = None
    try:
        preview_audio = generate_voice_preview_audio(voice_id)
        if preview_audio:
            r2_url = r2_storage.upload_voice_preview(user.id, voice_id, preview_audio)
            if r2_url:
                preview_url = r2_url
            else:
                try:
                    preview_url = get_voice_preview_url(voice_id)
                except Exception as e:
                    print(f"[VOICES] Get voice preview failed (non-fatal): {e}")
    except Exception as e:
        print(f"[VOICES] Generate preview TTS failed (non-fatal): {e}")
    if not preview_url:
        try:
            preview_url = get_voice_preview_url(voice_id)
        except Exception as e:
            print(f"[VOICES] Get voice preview failed (non-fatal): {e}")
    custom = CustomVoice(
        user_id=user.id,
        name=name.strip(),
        voice_id=voice_id,
        source="ivc",
        prompt_text=None,
        response_json=None,
        form_gender=None,
        form_age=None,
        form_persona=None,
        form_speed=None,
        form_accent=None,
        preview_url=preview_url,
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


@router.get("/custom/{custom_voice_id}/preview")
def get_or_refresh_custom_voice_preview(
    custom_voice_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get preview URL for a custom voice. If not stored, fetch from Eleven Labs and update DB. Returns { preview_url, ready }."""
    custom = (
        db.query(CustomVoice)
        .filter(CustomVoice.id == custom_voice_id, CustomVoice.user_id == user.id)
        .first()
    )
    if not custom:
        raise HTTPException(status_code=404, detail="Custom voice not found")
    if custom.preview_url:
        return {"preview_url": custom.preview_url, "ready": True}
    if not settings.ELEVENLABS_API_KEY:
        return {"preview_url": None, "ready": False}
    try:
        preview_url = get_voice_preview_url(custom.voice_id)
        if preview_url:
            custom.preview_url = preview_url
            db.commit()
            db.refresh(custom)
            return {"preview_url": preview_url, "ready": True}
    except Exception as e:
        print(f"[VOICES] get_voice_preview_url failed: {e}")
    return {"preview_url": None, "ready": False}


@router.delete("/custom/{custom_voice_id}", response_model=dict)
def delete_custom_voice(
    custom_voice_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a custom voice. Only the owner can delete. If it was in saved_voices, those rows are unlinked (custom_voice_id set to null)."""
    custom = (
        db.query(CustomVoice)
        .filter(CustomVoice.id == custom_voice_id, CustomVoice.user_id == user.id)
        .first()
    )
    if not custom:
        raise HTTPException(status_code=404, detail="Custom voice not found")
    if r2_storage.is_r2_configured():
        try:
            r2_storage.delete_voice_preview(user.id, custom.voice_id)
        except Exception as e:
            print(f"[VOICES] R2 delete voice preview failed (non-fatal): {e}")
    db.delete(custom)
    db.commit()
    return {"ok": True}


@router.delete("/saved/{voice_id}")
def delete_saved_voice(
    voice_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a saved voice. Only the owner can delete. At least one voice must remain."""
    voice = db.query(SavedVoice).filter(SavedVoice.id == voice_id, SavedVoice.user_id == user.id).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Saved voice not found")
    count = db.query(SavedVoice).filter(SavedVoice.user_id == user.id).count()
    if count <= 1:
        raise HTTPException(
            status_code=400,
            detail="At least one voice must remain in your list. Add more voices before removing this one.",
        )
    db.delete(voice)
    db.commit()
    return {"ok": True}
