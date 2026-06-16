"""Background music track registry."""

from app.config import settings

BGM_TRACKS = [
    {"track_id": "corporate_upbeat",   "display_name": "Corporate Upbeat",   "mood": "Motivational"},
    {"track_id": "trending_reels",     "display_name": "Trending Reels",     "mood": "Energetic"},
    {"track_id": "documentary_sad",    "display_name": "Documentary Sad",    "mood": "Emotional"},
    {"track_id": "podcast_intro",      "display_name": "Podcast Intro",      "mood": "Professional"},
    {"track_id": "ambient_background", "display_name": "Ambient Background", "mood": "Calm"},
    {"track_id": "chasing_success",    "display_name": "Chasing Success",    "mood": "Inspirational"},
    {"track_id": "relaxed_narrative",  "display_name": "Relaxed Narrative",  "mood": "Relaxed"},
    {"track_id": "sad_violin",         "display_name": "Sad Violin",         "mood": "Emotional"},
]

_TRACK_MAP = {t["track_id"]: t for t in BGM_TRACKS}


def _r2_key(track_id: str) -> str:
    prefix = settings.R2_KEY_PREFIX.strip().strip("/")
    key_prefix = f"{prefix}/" if prefix else ""
    return f"{key_prefix}background-music/{track_id}.mp3"


def get_track_by_id(track_id: str) -> dict | None:
    return _TRACK_MAP.get(track_id)


def get_track_r2_url(track_id: str) -> str | None:
    if track_id not in _TRACK_MAP:
        print(f"[F7-DEBUG] get_track_r2_url: unknown track_id={track_id!r}")
        return None
    url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{_r2_key(track_id)}"
    print(f"[F7-DEBUG] get_track_r2_url: track_id={track_id!r} -> {url}")
    return url


def get_all_tracks() -> list[dict]:
    result = []
    for t in BGM_TRACKS:
        result.append({
            **t,
            "r2_url": f"{settings.R2_PUBLIC_URL.rstrip('/')}/{_r2_key(t['track_id'])}",
        })
    return result
