"""Shared constants (e.g. free premade voice IDs)."""

# Rachel, Bill, Alice, Daniel — free-tier premade voices (voiceover.VOICE_MAP / BlogUrlForm)
FREE_PREMADE_VOICE_IDS = frozenset(
    {"21m00Tcm4TlvDq8ikWAM", "pqHfZKP75CvOlQylNhV4", "Xb7hH8MSUJpSbSDYk0k2", "onwK4e9ZLuTAKqWW03F9"}
)

# Fallback when prebuilt_voices table is empty: voice_id -> name
FREE_PREMADE_FALLBACK = [
    {"voice_id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel"},
    {"voice_id": "pqHfZKP75CvOlQylNhV4", "name": "Bill"},
    {"voice_id": "Xb7hH8MSUJpSbSDYk0k2", "name": "Alice"},
    {"voice_id": "onwK4e9ZLuTAKqWW03F9", "name": "Daniel"},
]
