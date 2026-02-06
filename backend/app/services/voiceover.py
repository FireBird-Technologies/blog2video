import os
from elevenlabs import ElevenLabs
from sqlalchemy.orm import Session

from app.config import settings
from app.models.scene import Scene
from app.models.asset import Asset, AssetType


def generate_voiceover(scene: Scene, db: Session) -> str:
    """
    Generate voiceover audio for a scene using ElevenLabs TTS.

    Returns:
        str: Local path to the generated audio file
    """
    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

    # Create output directory
    audio_dir = os.path.join(
        settings.MEDIA_DIR, f"projects/{scene.project_id}/audio"
    )
    os.makedirs(audio_dir, exist_ok=True)

    filename = f"scene_{scene.order}.mp3"
    output_path = os.path.join(audio_dir, filename)

    # Generate audio
    audio_generator = client.text_to_speech.convert(
        text=scene.narration_text,
        voice_id=settings.ELEVENLABS_VOICE_ID,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )

    # Write audio to file (the SDK returns a generator)
    with open(output_path, "wb") as f:
        for chunk in audio_generator:
            f.write(chunk)

    # Update scene record
    scene.voiceover_path = output_path
    db.commit()

    # Create asset record
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


def generate_all_voiceovers(scenes: list[Scene], db: Session) -> list[str]:
    """Generate voiceover audio for all scenes in a project."""
    paths = []
    for scene in scenes:
        try:
            path = generate_voiceover(scene, db)
            paths.append(path)
        except Exception as e:
            print(f"Failed to generate voiceover for scene {scene.order}: {e}")
            paths.append("")
    return paths
