"""Canonical talking-head avatar roster.

A small, fixed set of curated presenter portraits the user can pick from when
enabling "add avatar" on a project. Kept in ONE place so the three consumers
never drift:
  - the backend validator (schemas.py restricts avatar_preset to these ids),
  - the avatar render service (services/avatar.py stages the chosen portrait),
  - the frontend picker (frontend/public/avatars/<id>.jpg thumbnails mirror these).

The portrait image bytes live inside the render service's image (bundled from
modal-service/omniavatar/avatar_presets/), so the backend only sends the preset
id — the service resolves it to the bundled file via its own preset map (the
same ids as PRESET_IMAGE_FILE below). See services/avatar.py.

THE ROSTER IS DELIBERATELY TWO PEOPLE. It was five; Maya (woman_blueeyes),
Priya (woman_freckles) and Daniel (man_denim) were cut on 2026-08-07. Two of
their portraits were never committed, so `add_local_dir` shipped an image
advertising five presets while containing three files — a clean deploy resolved
those ids to a path that did not exist. Maya was also DEFAULT_PRESET_ID (this
list's first entry), so every unspecified/invalid preset fell back to a missing
portrait. Only ids whose portrait is committed belong here.

Source portraits are Unsplash (free, model-released) neutral studio-style
photos — deliberately not the Obama/Biden fixtures (public figures) or the
"Lena" CV test image.
"""
from __future__ import annotations

from typing import TypedDict


class AvatarPreset(TypedDict):
    id: str
    label: str
    # Filename inside the Space's bundled test_sets/images/ dir.
    image_file: str


# Ordered — this is also the order the frontend picker shows them in.
AVATAR_PRESETS: list[AvatarPreset] = [
    {"id": "woman_red", "label": "Elena", "image_file": "candidate_woman1.jpg"},
    {"id": "man_beard", "label": "Marcus", "image_file": "candidate_man2.jpg"},
]

# id -> bundled image filename (used by the Space preset map + backend fallback).
PRESET_IMAGE_FILE: dict[str, str] = {p["id"]: p["image_file"] for p in AVATAR_PRESETS}

VALID_PRESET_IDS: set[str] = set(PRESET_IMAGE_FILE)

# Named explicitly rather than taken as AVATAR_PRESETS[0]: this is the portrait
# every unspecified OR INVALID preset falls back to (see normalize_preset), so
# reordering the roster for display reasons must never silently change it.
DEFAULT_PRESET_ID: str = "woman_red"

# Sentinel meaning "use the portrait this user uploaded" rather than a bundled
# roster photo. Deliberately NOT in AVATAR_PRESETS / PRESET_IMAGE_FILE: the Space
# cannot resolve it to a bundled file, so the backend must upload the image bytes
# instead of sending a preset id. See services/avatar.py.
CUSTOM_PRESET_ID: str = "custom"


def is_custom_preset(preset: str | None) -> bool:
    return preset == CUSTOM_PRESET_ID


def normalize_preset(preset: str | None) -> str:
    """Coerce an incoming preset id to a valid one, falling back to the default.

    ``custom`` passes through: it is a legitimate choice, just one the CALLER must
    back with an uploaded portrait (the Space has no bundled file for it).
    """
    if preset and (preset in VALID_PRESET_IDS or preset == CUSTOM_PRESET_ID):
        return preset
    return DEFAULT_PRESET_ID
