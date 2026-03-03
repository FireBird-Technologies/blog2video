"""ElevenLabs Voice Design API helpers. See https://elevenlabs.io/docs/eleven-api/guides/cookbooks/voices/voice-design"""

import logging
import requests

from app.config import settings

logger = logging.getLogger(__name__)


def create_voice_from_preview(
    voice_name: str,
    voice_description: str,
    generated_voice_id: str,
) -> str:
    """Add a designed voice to the ElevenLabs library. Returns the permanent voice_id for TTS.

    Per the docs, the preview's generated_voice_id is temporary; this endpoint creates a
    permanent voice that can be used with text-to-speech and other APIs.
    """
    url = "https://api.elevenlabs.io/v1/text-to-voice/create-voice-from-preview"
    headers = {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    body = {
        "voice_name": voice_name,
        "voice_description": (voice_description or voice_name)[:1000],
        "generated_voice_id": generated_voice_id,
    }
    resp = requests.post(url, json=body, headers=headers, timeout=30)
    logger.info(
        "[VOICES] create-voice-from-preview response status=%s body=%s",
        resp.status_code,
        resp.text[:500] if resp.text else "",
    )
    resp.raise_for_status()
    data = resp.json()
    voice_id = (data.get("voice_id") or data.get("id") or "").strip()
    logger.info("[VOICES] create-voice-from-preview permanent voice_id=%s", voice_id)
    return voice_id
