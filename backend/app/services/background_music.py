"""Background music track registry."""

from app.config import settings

# `duration_seconds` is measured from the actual R2 files (ffprobe, rounded to the
# nearest second) rather than computed at request time — resolving it per request
# would mean a network round-trip per track on every catalog fetch. Re-measure and
# update these by hand if a track is ever re-uploaded.
#
# Durations vary enormously (6s stings through 2.5-minute beds), which is exactly
# what the picker surfaces: a short sting loops audibly under a long video, so the
# number is the main thing a user needs in order to choose well.
#
# `description` says *when to reach for the track*, not what it sounds like.
BGM_TRACKS = [
    {"track_id": "corporate_upbeat",   "display_name": "Corporate Upbeat",   "mood": "Motivational",
     "duration_seconds": 20,  "description": "Bright and busy — product demos and launch clips"},
    {"track_id": "trending_reels",     "display_name": "Trending Reels",     "mood": "Energetic",
     "duration_seconds": 6,   "description": "Very short sting for fast social cuts"},
    {"track_id": "documentary_sad",    "display_name": "Documentary Sad",    "mood": "Emotional",
     "duration_seconds": 46,  "description": "Sombre and reflective — serious storytelling"},
    {"track_id": "podcast_intro",      "display_name": "Podcast Intro",      "mood": "Professional",
     "duration_seconds": 16,  "description": "Clean opener for talking-head intros"},
    {"track_id": "ambient_background", "display_name": "Ambient Background", "mood": "Calm",
     "duration_seconds": 8,   "description": "Neutral pad that stays out of the way of narration"},
    {"track_id": "chasing_success",    "display_name": "Chasing Success",    "mood": "Inspirational",
     "duration_seconds": 9,   "description": "Uplifting build for short motivational cuts"},
    {"track_id": "relaxed_narrative",  "display_name": "Relaxed Narrative",  "mood": "Relaxed",
     "duration_seconds": 10,  "description": "Easy-going bed for explainers and how-tos"},
    {"track_id": "sad_violin",         "display_name": "Sad Violin",         "mood": "Emotional",
     "duration_seconds": 44,  "description": "Solo strings for slow, heartfelt moments"},
    {"track_id": "dramatic_trailer",     "display_name": "Dramatic Trailer",     "mood": "Dramatic",
     "duration_seconds": 132, "description": "Big cinematic build for reveals and announcements"},
    {"track_id": "powerful_percussion",  "display_name": "Powerful Percussion",  "mood": "Energetic",
     "duration_seconds": 69,  "description": "Driving drums for momentum and countdowns"},
    {"track_id": "dark_cyberpunk",       "display_name": "Dark Cyberpunk",       "mood": "Dark",
     "duration_seconds": 119, "description": "Moody synth for tech, crypto, and security topics"},
    {"track_id": "wonders_of_the_earth", "display_name": "Wonders of the Earth", "mood": "Epic",
     "duration_seconds": 150, "description": "Sweeping orchestral for nature and big-picture stories"},
    {"track_id": "action_race_rock",     "display_name": "Action Race Rock",     "mood": "Action",
     "duration_seconds": 126, "description": "High-energy rock for sport and fast montages"},
    {"track_id": "moment_of_peace",      "display_name": "Moment of Peace",      "mood": "Calm",
     "duration_seconds": 152, "description": "Gentle and unhurried — long, quiet narration"},
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
