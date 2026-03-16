import asyncio
import os
import time
from mutagen.mp3 import MP3
from elevenlabs import ElevenLabs
from sqlalchemy.orm import Session

from app.config import settings
from app.models.scene import Scene
from app.models.project import Project
from app.models.asset import Asset, AssetType
from app.services import r2_storage
from app.observability.logging import get_logger

logger = get_logger(__name__)

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries
SCENE_DELAY = 2  # seconds between scenes to avoid rate limits
DURATION_PAD = 1.0  # extra seconds added to voiceover duration for scene

# ElevenLabs premade voices -- narrator / documentary style
# Verified against the official premade voice list:
# https://elevenlabs-sdk.mintlify.app/voices/premade-voices
VOICE_MAP = {
    ("female", "american"): "21m00Tcm4TlvDq8ikWAM",  # Rachel  -- american, calm, narration
    ("male", "american"): "pqHfZKP75CvOlQylNhV4",    # Bill    -- american, strong, documentary
    ("female", "british"): "Xb7hH8MSUJpSbSDYk0k2",   # Alice   -- british, confident, news
    ("male", "british"): "onwK4e9ZLuTAKqWW03F9",     # Daniel  -- british, deep, news presenter
}

# Fallback: Bill (american male documentary voice) if no match
DEFAULT_VOICE_ID = "pqHfZKP75CvOlQylNhV4"


def _get_voice_id(project: Project) -> str | None:
    custom = getattr(project, "custom_voice_id", None)
    if custom:
        return custom

    gender = getattr(project, "voice_gender", "female")
    accent = getattr(project, "voice_accent", "american")
    return VOICE_MAP.get((gender, accent), DEFAULT_VOICE_ID)


def _get_audio_duration(filepath: str) -> float:
    """Get the duration of an MP3 file in seconds."""
    try:
        audio = MP3(filepath)
        return audio.info.length
    except Exception:
        # Fallback: estimate from file size (~16KB per second at 128kbps)
        try:
            size = os.path.getsize(filepath)
            return size / 16000
        except Exception:
            return 10.0


WORDS_PER_SECOND = 2.5  # average speaking pace for duration estimation


def generate_voiceover(scene: Scene, db: Session, use_expanded: bool = False) -> str:
    """
    Generate voiceover audio for a scene using ElevenLabs TTS.
    After generation, updates scene.duration_seconds to audio length + 1s.
    If voice_gender is "none", skips TTS and estimates duration from word count.
    Retries on connection errors.
    
    If use_expanded is True, expands narration_text into detailed voiceover before generating audio.

    Returns:
        str: Local path to the generated audio file (empty string if no audio)
    """
    # Skip scenes with no narration (e.g. hero opening)
    if not scene.narration_text or not scene.narration_text.strip():
        return ""

    # Determine voice from project preferences
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    voice_id = _get_voice_id(project) if project else None

    # Use narration_text directly (it should already be expanded if needed)
    voiceover_text = scene.narration_text
    if not voiceover_text or not voiceover_text.strip():
        return ""

    # No-audio mode: estimate duration from word count, skip TTS
    if voice_id is None:
        word_count = len(voiceover_text.split())
        estimated_duration = max(5.0, word_count / WORDS_PER_SECOND)
        scene.duration_seconds = round(estimated_duration + DURATION_PAD, 1)
        scene.voiceover_path = None
        db.commit()
        logger.info(
            "[VOICEOVER] Scene %s: no-audio mode, estimated %ss from %s words",
            scene.order,
            scene.duration_seconds,
            word_count,
            extra={"project_id": scene.project_id},
        )
        return ""

    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

    audio_dir = os.path.join(
        settings.MEDIA_DIR, f"projects/{scene.project_id}/audio"
    )
    os.makedirs(audio_dir, exist_ok=True)

    filename = f"scene_{scene.order}.mp3"
    output_path = os.path.join(audio_dir, filename)

    def _try_tts(vid: str) -> None:
        """Run TTS with given voice_id; writes to output_path and updates scene. Raises on failure."""
        audio_generator = client.text_to_speech.convert(
            text=voiceover_text,
            voice_id=vid,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
            voice_settings={
                "stability": 0.75,
                "similarity_boost": 0.85,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        )
        with open(output_path, "wb") as f:
            for chunk in audio_generator:
                f.write(chunk)
        audio_duration = _get_audio_duration(output_path)
        scene.duration_seconds = round(audio_duration + DURATION_PAD, 1)
        scene.voiceover_path = output_path
        db.commit()
        r2_key_val = None
        r2_url_val = None
        if r2_storage.is_r2_configured():
            try:
                uid = scene.project.user_id
                r2_url_val = r2_storage.upload_project_audio(
                    uid, scene.project_id, output_path, filename
                )
                r2_key_val = r2_storage.audio_key(uid, scene.project_id, filename)
            except Exception as e:
                logger.warning(
                    "[VOICEOVER] R2 upload failed for %s: %s",
                    filename,
                    e,
                    extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
                )
        asset = Asset(
            project_id=scene.project_id,
            asset_type=AssetType.AUDIO,
            original_url=None,
            local_path=output_path,
            filename=filename,
            r2_key=r2_key_val,
            r2_url=r2_url_val,
        )
        db.add(asset)
        db.commit()
        logger.info(
            "[VOICEOVER] Scene %s: audio=%.1fs, scene=%ss",
            scene.order,
            audio_duration,
            scene.duration_seconds,
            extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
        )

    def _is_voice_not_found(err: Exception) -> bool:
        s = str(err).lower()
        return "voice_not_found" in s or ("404" in s and "voice" in s)

    last_error = None
    used_custom = bool(project and getattr(project, "custom_voice_id", None))
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            _try_tts(voice_id)
            return output_path
        except Exception as e:
            last_error = e
            logger.warning(
                "[VOICEOVER] Scene %s attempt %s/%s failed: %s",
                scene.order,
                attempt,
                MAX_RETRIES,
                e,
                extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
            )
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)

    # If custom voice was not found (404), retry once with premade fallback
    if last_error and used_custom and _is_voice_not_found(last_error):
        fallback_id = DEFAULT_VOICE_ID
        if project:
            key = (
                getattr(project, "voice_gender", "male"),
                getattr(project, "voice_accent", "american"),
            )
            fallback_id = VOICE_MAP.get(key, DEFAULT_VOICE_ID)
        logger.warning(
            "[VOICEOVER] Scene %s: custom voice not found, falling back to premade (%s)",
            scene.order,
            fallback_id,
            extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
        )
        try:
            _try_tts(fallback_id)
            return output_path
        except Exception as fallback_err:
            logger.error(
                "[VOICEOVER] Scene %s fallback TTS failed: %s",
                scene.order,
                fallback_err,
                extra={"project_id": scene.project_id, "user_id": scene.project.user_id if scene.project else None},
            )
            raise fallback_err from last_error

    raise last_error  # type: ignore


async def generate_all_voiceovers(
    scenes: list[Scene], db: Session, video_style: str | None = None
) -> list[str]:
    """Generate voiceover audio for all scenes concurrently.

    Phase A: Expand narration texts in parallel (Claude LLM calls, semaphore=4).
    Phase B: Generate TTS audio concurrently (ElevenLabs, semaphore=2, each in
             its own DB session via run_in_executor since the SDK is sync).

    video_style (explainer | promotional | storytelling) shapes expansion tone.
    """
    from app.dspy_modules.voiceover_expand import expand_narration_to_voiceover
    from app.database import SessionLocal

    style = (video_style or "explainer").strip().lower() or "explainer"

    # ── Phase A: Parallel LLM expansion ──────────────────────────
    expand_sem = asyncio.Semaphore(4)

    async def _expand(scene: Scene) -> str:
        if not scene.narration_text or not scene.narration_text.strip():
            return scene.narration_text or ""
        async with expand_sem:
            return await expand_narration_to_voiceover(
                scene.narration_text, scene.title, video_style=style
            )

    expanded_texts = await asyncio.gather(
        *[_expand(s) for s in scenes], return_exceptions=True
    )
    # Replace exceptions with original text
    for i, result in enumerate(expanded_texts):
        if isinstance(result, Exception):
            logger.warning(
                "[VOICEOVER] Expand failed for scene %s: %s",
                scenes[i].order,
                result,
                extra={"project_id": scenes[i].project_id},
            )
            expanded_texts[i] = scenes[i].narration_text or ""

    # ── Phase B: Concurrent TTS (semaphore=2, per-thread DB session) ─
    tts_sem = asyncio.Semaphore(2)
    loop = asyncio.get_event_loop()

    def _tts_in_thread(scene_id: int, expanded_text: str, scene_order: int) -> str:
        """Run TTS in a thread with its own DB session."""
        tts_db = SessionLocal()
        try:
            scene = tts_db.query(Scene).filter(Scene.id == scene_id).first()
            if not scene:
                return ""
            original = scene.narration_text
            scene.narration_text = expanded_text
            tts_db.commit()

            path = generate_voiceover(scene, tts_db, use_expanded=False)

            # Restore original narration_text
            scene.narration_text = original
            tts_db.commit()
            return path
        except Exception as e:
            logger.error(
                "[VOICEOVER] TTS failed for scene %s: %s",
                scene_order,
                e,
            )
            try:
                tts_db.rollback()
            except Exception:
                pass
            return ""
        finally:
            tts_db.close()

    async def _bounded_tts(scene: Scene, expanded_text: str) -> str:
        async with tts_sem:
            return await loop.run_in_executor(
                None, _tts_in_thread, scene.id, expanded_text, scene.order
            )

    paths_raw = await asyncio.gather(
        *[_bounded_tts(s, t) for s, t in zip(scenes, expanded_texts)],
        return_exceptions=True,
    )

    # ── Collect results ──────────────────────────────────────────
    paths: list[str] = []
    for i, p in enumerate(paths_raw):
        if isinstance(p, Exception):
            logger.error(
                "[VOICEOVER] Scene %s TTS error: %s",
                scenes[i].order,
                p,
                extra={"project_id": scenes[i].project_id},
            )
            paths.append("")
        else:
            paths.append(p or "")

    return paths
