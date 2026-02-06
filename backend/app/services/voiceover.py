import os
import time
from elevenlabs import ElevenLabs
from sqlalchemy.orm import Session

from app.config import settings
from app.models.scene import Scene
from app.models.project import Project
from app.models.asset import Asset, AssetType

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries
SCENE_DELAY = 2  # seconds between scenes to avoid rate limits

# ElevenLabs pre-made voice IDs mapped by gender + accent
VOICE_MAP = {
    ("female", "american"): "21m00Tcm4TlvDq8ikWAM",  # Rachel
    ("male", "american"): "pNInz6obpgDQGcFmaJgB",    # Adam
    ("female", "british"): "XB0fDUnXU5powFXDhCwa",    # Charlotte
    ("male", "british"): "N2lVS1w4EtoT3dr4eOWO",     # Callum
}


def _get_voice_id(project: Project) -> str:
    """Pick an ElevenLabs voice ID based on project preferences."""
    key = (
        getattr(project, "voice_gender", "female"),
        getattr(project, "voice_accent", "american"),
    )
    return VOICE_MAP.get(key, settings.ELEVENLABS_VOICE_ID)


def generate_voiceover(scene: Scene, db: Session) -> str:
    """
    Generate voiceover audio for a scene using ElevenLabs TTS.
    Retries on connection errors.

    Returns:
        str: Local path to the generated audio file
    """
    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

    audio_dir = os.path.join(
        settings.MEDIA_DIR, f"projects/{scene.project_id}/audio"
    )
    os.makedirs(audio_dir, exist_ok=True)

    filename = f"scene_{scene.order}.mp3"
    output_path = os.path.join(audio_dir, filename)

    # Determine voice from project preferences
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    voice_id = _get_voice_id(project) if project else settings.ELEVENLABS_VOICE_ID

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

            # Success -- update DB
            scene.voiceover_path = output_path
            db.commit()

            asset = Asset(
                project_id=scene.project_id,
                asset_type=AssetType.AUDIO,
                original_url=None,
                local_path=output_path,
                filename=filename,
            )
            db.add(asset)
            db.commit()

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
            if i < len(scenes) - 1:
                time.sleep(SCENE_DELAY)
        except Exception as e:
            print(f"[VOICEOVER] Failed to generate voiceover for scene {scene.order} after {MAX_RETRIES} retries: {e}")
            paths.append("")
    return paths
