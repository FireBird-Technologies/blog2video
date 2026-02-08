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

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries
SCENE_DELAY = 2  # seconds between scenes to avoid rate limits
DURATION_PAD = 1.0  # extra seconds added to voiceover duration for scene

# ElevenLabs voices -- documentary narrator style
# These are deep, authoritative voices ideal for explainer/documentary content
VOICE_MAP = {
    ("female", "american"): "EXAVITQu4vr4xnSDxMaL",  # Bella  -- warm, narrative
    ("male", "american"): "onwK4e9ZLuTAKqWW03F9",    # Daniel -- deep, documentary
    ("female", "british"): "XB0fDUnXU5powFXDhCwa",    # Charlotte -- authoritative
    ("male", "british"): "N2lVS1w4EtoT3dr4eOWO",     # Callum -- calm narrator
}

# Fallback: Daniel (deep male documentary voice) if no match
DEFAULT_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"


def _get_voice_id(project: Project) -> str:
    """Pick an ElevenLabs voice ID based on project preferences."""
    key = (
        getattr(project, "voice_gender", "male"),
        getattr(project, "voice_accent", "american"),
    )
    return VOICE_MAP.get(key, DEFAULT_VOICE_ID)


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


def generate_voiceover(scene: Scene, db: Session) -> str:
    """
    Generate voiceover audio for a scene using ElevenLabs TTS.
    After generation, updates scene.duration_seconds to audio length + 1s.
    Retries on connection errors.

    Returns:
        str: Local path to the generated audio file
    """
    # Skip scenes with no narration (e.g. hero opening)
    if not scene.narration_text or not scene.narration_text.strip():
        return ""

    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

    audio_dir = os.path.join(
        settings.MEDIA_DIR, f"projects/{scene.project_id}/audio"
    )
    os.makedirs(audio_dir, exist_ok=True)

    filename = f"scene_{scene.order}.mp3"
    output_path = os.path.join(audio_dir, filename)

    # Determine voice from project preferences
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    voice_id = _get_voice_id(project) if project else DEFAULT_VOICE_ID

    # Retry loop for connection issues
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            audio_generator = client.text_to_speech.convert(
                text=scene.narration_text,
                voice_id=voice_id,
                model_id="eleven_multilingual_v2",
                output_format="mp3_44100_128",
            )

            with open(output_path, "wb") as f:
                for chunk in audio_generator:
                    f.write(chunk)

            # Measure audio duration and set scene duration = audio + pad
            audio_duration = _get_audio_duration(output_path)
            scene.duration_seconds = round(audio_duration + DURATION_PAD, 1)

            # Success -- update DB
            scene.voiceover_path = output_path
            db.commit()

            # Upload to R2 if configured
            r2_key_val = None
            r2_url_val = None
            if r2_storage.is_r2_configured():
                try:
                    r2_url_val = r2_storage.upload_project_audio(
                        scene.project_id, output_path, filename
                    )
                    r2_key_val = r2_storage.audio_key(scene.project_id, filename)
                except Exception as e:
                    print(f"[VOICEOVER] R2 upload failed for {filename}: {e}")

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

            print(f"[VOICEOVER] Scene {scene.order}: audio={audio_duration:.1f}s, scene={scene.duration_seconds}s")
            return output_path

        except Exception as e:
            last_error = e
            print(f"[VOICEOVER] Scene {scene.order} attempt {attempt}/{MAX_RETRIES} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)  # Exponential-ish backoff

    raise last_error  # type: ignore


def generate_all_voiceovers(scenes: list[Scene], db: Session) -> list[str]:
    """Generate voiceover audio for all scenes with delays between each."""
    paths = []
    for i, scene in enumerate(scenes):
        try:
            path = generate_voiceover(scene, db)
            paths.append(path)
            # Wait between scenes to avoid rate limits
            if i < len(scenes) - 1 and path:
                time.sleep(SCENE_DELAY)
        except Exception as e:
            print(f"[VOICEOVER] Failed to generate voiceover for scene {scene.order} after {MAX_RETRIES} retries: {e}")
            paths.append("")
    return paths
