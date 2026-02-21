"""
TemplateService — Reads template metadata and prompts from backend/templates/.

All template-specific logic lives in meta.json and prompt.md. This service
is template-agnostic: it discovers templates from the registry and reads
their files. Unknown IDs fall back to "default".
"""

import json
import os
from pathlib import Path
from typing import Any

# Path to backend/templates/ (relative to this file: app/services/template_service.py)
_TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates"


def _load_registry() -> list[str]:
    """Load template IDs from registry.json."""
    path = _TEMPLATES_DIR / "registry.json"
    if not path.exists():
        return ["default"]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else ["default"]


def _load_meta(template_id: str) -> dict[str, Any] | None:
    """Load meta.json for a template. Returns None if not found."""
    path = _TEMPLATES_DIR / template_id / "meta.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _load_prompt(template_id: str) -> str:
    """Load prompt.md content for a template. Returns empty string if not found."""
    path = _TEMPLATES_DIR / template_id / "prompt.md"
    if not path.exists():
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read()


# ─── Public API ─────────────────────────────────────────────────────


def list_templates() -> list[dict[str, Any]]:
    """Return list of all templates (meta for each)."""
    registry = _load_registry()
    result = []
    for tid in registry:
        meta = _load_meta(tid)
        if meta:
            result.append(meta)
    return result


def get_meta(template_id: str) -> dict[str, Any] | None:
    """Get meta.json for one template."""
    return _load_meta(template_id)


def get_prompt(template_id: str) -> str:
    """Get prompt.md content for one template. Reads fresh on each call."""
    return _load_prompt(template_id)


def get_valid_layouts(template_id: str) -> set[str]:
    """Get the set of valid layout IDs for a template."""
    meta = _load_meta(template_id)
    if not meta:
        return set()
    layouts = meta.get("valid_layouts", [])
    return set(layouts) if isinstance(layouts, list) else set()


def get_hero_layout(template_id: str) -> str:
    """Get the hero layout ID (scene 0). Default: hero_image."""
    meta = _load_meta(template_id)
    if not meta:
        return "hero_image"
    return meta.get("hero_layout", "hero_image")


def get_fallback_layout(template_id: str) -> str:
    """Get the fallback layout when DSPy output is invalid."""
    meta = _load_meta(template_id)
    if not meta:
        return "text_narration"
    return meta.get("fallback_layout", "text_narration")


def get_composition_id(template_id: str) -> str:
    """Get the Remotion composition ID for rendering."""
    meta = _load_meta(template_id)
    if not meta:
        return "DefaultVideo"
    return meta.get("composition_id", "DefaultVideo")


def get_preview_colors(template_id: str) -> dict[str, str] | None:
    """Get preview_colors (accent, bg, text) for template. None = use request defaults."""
    meta = _load_meta(template_id)
    if not meta:
        return None
    pc = meta.get("preview_colors")
    if not isinstance(pc, dict):
        return None
    return pc


def validate_template_id(template_id: str | None) -> str:
    """Return template_id if valid, else 'default'."""
    if not template_id or not isinstance(template_id, str):
        return "default"
    tid = template_id.strip().lower()
    registry = _load_registry()
    if tid in registry:
        return tid
    return "default"
