"""
Voice Router — on-demand voice preview for the paid Advanced Options panel.

Synthesizes a short fixed sample with the user's selected voice + tuning (stability/style/emotion/
speed) so they can audition before creating a project. Paid-gated and rate-limited to cap credits.
"""

import io
import logging
import threading
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth import get_current_user
from app.models.user import PlanTier, User
from app.services.voiceover import synthesize_voice_preview

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

# ─── Rate limiting (in-memory, per process) ──────────────────────────────────
# Each preview is a paid ElevenLabs call, so cap both burst (cooldown) and volume (daily).
_PREVIEW_COOLDOWN_SECONDS = 3.0
_PREVIEW_DAILY_LIMIT = 80
_lock = threading.Lock()
_last_call: dict[int, float] = {}          # user_id -> last monotonic timestamp
_daily_counts: dict[int, tuple[float, int]] = {}  # user_id -> (window_start, count)


def _check_preview_rate_limit(user_id: int) -> None:
    now = time.monotonic()
    with _lock:
        last = _last_call.get(user_id)
        if last is not None and (now - last) < _PREVIEW_COOLDOWN_SECONDS:
            raise HTTPException(status_code=429, detail="Please wait a moment before previewing again.")
        window_start, count = _daily_counts.get(user_id, (now, 0))
        if (now - window_start) > 86400:
            window_start, count = now, 0
        if count >= _PREVIEW_DAILY_LIMIT:
            raise HTTPException(status_code=429, detail="Voice preview limit reached. Try again later.")
        _last_call[user_id] = now
        _daily_counts[user_id] = (window_start, count + 1)


class VoicePreviewIn(BaseModel):
    voice_gender: str | None = None
    voice_accent: str | None = None
    custom_voice_id: str | None = None
    # Same serialized tuning array used on projects: ["<stability>","<speed>","<emotion>","<style>"].
    voice_emotion: str | None = None
    video_style: str | None = None


@router.post("/preview")
def preview_voice(data: VoicePreviewIn, user: User = Depends(get_current_user)) -> StreamingResponse:
    """Return a short mp3 sample synthesized with the given voice + tuning. Paid + rate-limited."""
    if user.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        raise HTTPException(status_code=403, detail="Voice preview requires a Pro or Standard subscription.")
    if (data.voice_gender or "female") == "none":
        raise HTTPException(status_code=400, detail="Select a voice to preview.")

    _check_preview_rate_limit(user.id)

    try:
        audio = synthesize_voice_preview(
            gender=data.voice_gender,
            accent=data.voice_accent,
            custom_voice_id=data.custom_voice_id,
            voice_emotion=data.voice_emotion,
            video_style=data.video_style,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("[VOICE] Preview synthesis failed for user=%s: %s", user.id, e)
        raise HTTPException(status_code=502, detail="Voice preview failed. Please try again.")

    return StreamingResponse(
        io.BytesIO(audio),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store"},
    )
