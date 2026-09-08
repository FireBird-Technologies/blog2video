"""Shared constants (e.g. free premade voice IDs)."""

# Kristen, Hale, Samara X, Connor — free-tier shared-library voices (voiceover.VOICE_MAP / BlogUrlForm)
FREE_PREMADE_VOICE_IDS = frozenset(
    {"dfeOmy6Uay63tNhyO99j", "dXtC3XhB9GtPusIpNtQx", "19STyYD15bswVz51nqLf", "xtw8E1CXDMtNKx4sgP7u"}
)

# Fallback when prebuilt_voices table is empty: voice_id -> name
FREE_PREMADE_FALLBACK = [
    {"voice_id": "dfeOmy6Uay63tNhyO99j", "name": "Kristen"},
    {"voice_id": "dXtC3XhB9GtPusIpNtQx", "name": "Hale"},
    {"voice_id": "19STyYD15bswVz51nqLf", "name": "Samara X"},
    {"voice_id": "xtw8E1CXDMtNKx4sgP7u", "name": "Connor"},
]

# Old free-voice id -> new free-voice id. Single source of truth for the 2026-09
# Rachel/Bill/Alice/Daniel -> Kristen/Hale/Samara X/Connor migration, shared by
# scripts/update_prebuilt_voice_defaults.py and scripts/replace_saved_voice_defaults.py.
OLD_TO_NEW_VOICE_IDS = {
    "21m00Tcm4TlvDq8ikWAM": "dfeOmy6Uay63tNhyO99j",  # Janet/Rachel -> Kristen
    "pqHfZKP75CvOlQylNhV4": "dXtC3XhB9GtPusIpNtQx",  # Bill -> Hale
    "Xb7hH8MSUJpSbSDYk0k2": "19STyYD15bswVz51nqLf",  # Alice -> Samara X
    "onwK4e9ZLuTAKqWW03F9": "xtw8E1CXDMtNKx4sgP7u",  # Daniel -> Connor
}
