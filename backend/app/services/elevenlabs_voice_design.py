"""ElevenLabs Voice Design API helpers. See https://elevenlabs.io/docs/eleven-api/guides/cookbooks/voices/voice-design"""

import base64
import json
import logging
import requests

from app.config import settings

logger = logging.getLogger(__name__)

# Short TTS clip used as preview for cloned voices (70–150 chars recommended by ElevenLabs)
CLONE_PREVIEW_TEXT = (
    "Hello! This is a short preview of my cloned voice. "
    "You can use it for narration in your videos."
)


def create_voice_from_preview(
    voice_name: str,
    voice_description: str,
    generated_voice_id: str,
) -> tuple[str, str | None]:
    """Add a designed voice to the ElevenLabs library.

    Per the docs, the preview's generated_voice_id is temporary; this endpoint creates a
    permanent voice that can be used with text-to-speech and other APIs.

    Returns:
        (voice_id, preview_url): permanent voice_id for TTS and optional preview URL from the API.
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
    resp.raise_for_status()
    data = resp.json()
    # Log full ElevenLabs response so you can see what the API returns when saving a voice
    print("[VOICES] ElevenLabs create-voice-from-preview full response:")
    print(json.dumps(data, indent=2, default=str))
    logger.info(
        "[VOICES] create-voice-from-preview response status=%s body=%s",
        resp.status_code,
        resp.text[:500] if resp.text else "",
    )
    voice_id = (data.get("voice_id") or data.get("id") or "").strip()
    preview_url = (data.get("preview_url") or "").strip() or None
    logger.info("[VOICES] create-voice-from-preview permanent voice_id=%s preview_url=%s", voice_id, bool(preview_url))
    return voice_id, preview_url


def create_voice_ivc(
    name: str,
    file_bytes: bytes,
    filename: str,
    remove_background_noise: bool = True,
) -> tuple[str, bool]:
    """Create an Instant Voice Clone via ElevenLabs IVC API.

    POST https://api.elevenlabs.io/v1/voices/add (multipart/form-data).
    See https://elevenlabs.io/docs/api-reference/voices/ivc/create

    Returns:
        (voice_id, requires_verification) from the API response.
    """
    url = "https://api.elevenlabs.io/v1/voices/add"
    headers = {"xi-api-key": settings.ELEVENLABS_API_KEY}
    # API expects files as array; send one file under the same field name
    files = [("files", (filename, file_bytes))]
    data = {
        "name": (name or "").strip() or "Cloned voice",
        "remove_background_noise": "true" if remove_background_noise else "false",
    }
    resp = requests.post(url, headers=headers, data=data, files=files, timeout=120)
    resp.raise_for_status()
    result = resp.json()
    voice_id = (result.get("voice_id") or result.get("id") or "").strip()
    requires_verification = result.get("requires_verification", False)
    logger.info(
        "[VOICES] IVC created voice_id=%s requires_verification=%s",
        voice_id,
        requires_verification,
    )
    return voice_id, requires_verification


def generate_voice_preview_audio(voice_id: str) -> bytes | None:
    """Generate a short TTS clip with the given voice and return audio bytes.

    Cloned voices often have no preview_url until at least one TTS generation exists.
    This creates that first clip so we can store it as the custom voice preview.

    POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
    """
    if not (voice_id or "").strip():
        return None
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id.strip()}"
    headers = {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    # Keep preview synthesis aligned with final project voiceover generation:
    # do not override per-voice defaults via hardcoded voice_settings.
    body = {
        "text": CLONE_PREVIEW_TEXT,
        "model_id": "eleven_multilingual_v2",
    }
    resp = requests.post(url, json=body, headers=headers, timeout=30)
    resp.raise_for_status()
    # Response is raw audio bytes (e.g. mp3)
    audio_bytes = resp.content
    if not audio_bytes:
        return None
    logger.info("[VOICES] generated preview TTS for voice_id=%s, size=%s bytes", voice_id, len(audio_bytes))
    return audio_bytes


def get_voice_preview_url(voice_id: str) -> str | None:
    """Fetch voice metadata from Eleven Labs and return preview_url if present.

    GET https://api.elevenlabs.io/v1/voices/{voice_id}
    See https://elevenlabs.io/docs/api-reference/voices/get
    """
    if not (voice_id or "").strip():
        return None
    url = f"https://api.elevenlabs.io/v1/voices/{voice_id.strip()}"
    headers = {"xi-api-key": settings.ELEVENLABS_API_KEY}
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    print("[VOICES] ElevenLabs get voice metadata response:")
    print(json.dumps(data, indent=2, default=str))
    preview_url = (data.get("preview_url") or "").strip() or None
    logger.info("[VOICES] get voice preview_url=%s for voice_id=%s", bool(preview_url), voice_id)
    return preview_url


def get_voice_metadata(voice_id: str) -> dict | None:
    """Fetch full voice metadata from ElevenLabs for a voice_id.

    Returns None when unavailable.
    """
    if not (voice_id or "").strip():
        return None
    url = f"https://api.elevenlabs.io/v1/voices/{voice_id.strip()}"
    headers = {"xi-api-key": settings.ELEVENLABS_API_KEY}
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, dict):
        return None
    return data
