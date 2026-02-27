"""
TemplateService — Reads template metadata and prompts from backend/templates/.

All template-specific logic lives in meta.json and prompt.md. This service
is template-agnostic: it discovers templates from the registry and reads
their files. Unknown IDs fall back to "default".

Custom templates ("custom_N" format) are loaded from the database instead
of the filesystem, returning the same shapes as built-in templates.
"""

import json
import os
from pathlib import Path
from typing import Any

# Path to backend/templates/ (relative to this file: app/services/template_service.py)
_TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates"


# ─── Custom template helpers ──────────────────────────────────


def is_custom_template(template_id: str) -> bool:
    """Check if a template ID refers to a custom (DB-backed) template."""
    return isinstance(template_id, str) and template_id.startswith("custom_")


def _parse_custom_id(template_id: str) -> int | None:
    """Extract the numeric ID from 'custom_42'. Returns None if invalid."""
    try:
        return int(template_id.split("_", 1)[1])
    except (IndexError, ValueError):
        return None


# Simple in-memory cache for custom template data within a request lifecycle.
# Avoids repeated DB queries when write_remotion_data calls get_fallback_layout,
# get_hero_layout, get_layouts_without_image, etc. in a single request.
_custom_template_cache: dict[str, dict[str, Any] | None] = {}


def _load_custom_template_data(template_id: str) -> dict[str, Any] | None:
    """
    Load a custom template's theme + generated_prompt from DB.
    Returns a dict with keys: theme, generated_prompt, name, category.
    Returns None if not found. Results are cached for the process lifetime
    to avoid repeated DB queries within a single request.
    """
    if template_id in _custom_template_cache:
        return _custom_template_cache[template_id]

    custom_id = _parse_custom_id(template_id)
    if custom_id is None:
        return None

    # Lazy import to avoid circular dependencies
    from app.database import SessionLocal
    from app.models.custom_template import CustomTemplate

    db = SessionLocal()
    try:
        tpl = db.query(CustomTemplate).filter(CustomTemplate.id == custom_id).first()
        if not tpl:
            _custom_template_cache[template_id] = None
            return None
        theme = json.loads(tpl.theme) if isinstance(tpl.theme, str) else tpl.theme
        result = {
            "theme": theme,
            "generated_prompt": tpl.generated_prompt or "",
            "name": tpl.name,
            "category": tpl.category or "blog",
        }
        _custom_template_cache[template_id] = result
        return result
    finally:
        db.close()


def invalidate_custom_template_cache(template_id: str | None = None) -> None:
    """Clear the custom template cache. Call after template updates."""
    if template_id:
        _custom_template_cache.pop(template_id, None)
    else:
        _custom_template_cache.clear()


def _get_custom_meta(template_id: str) -> dict[str, Any] | None:
    """Build a meta.json equivalent for a custom template from DB data."""
    data = _load_custom_template_data(template_id)
    if not data:
        return None
    from app.services.custom_prompt_builder import build_custom_meta
    return build_custom_meta(data["theme"], data["name"])


def _get_custom_prompt(template_id: str) -> str:
    """Get the cached generated prompt for a custom template."""
    data = _load_custom_template_data(template_id)
    if not data:
        return ""
    # If prompt was cached, return it; otherwise generate on the fly
    if data["generated_prompt"]:
        return data["generated_prompt"]
    from app.services.custom_prompt_builder import build_custom_prompt
    return build_custom_prompt(data["theme"], data["name"])


# ─── Filesystem helpers ───────────────────────────────────────


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
    if is_custom_template(template_id):
        return _get_custom_meta(template_id)
    path = _TEMPLATES_DIR / template_id / "meta.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _load_prompt(template_id: str) -> str:
    """Load prompt.md content for a template. Returns empty string if not found."""
    if is_custom_template(template_id):
        return _get_custom_prompt(template_id)
    path = _TEMPLATES_DIR / template_id / "prompt.md"
    if not path.exists():
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read()


# ─── Public API ─────────────────────────────────────────────────────


def list_templates(video_style: str | None = None) -> list[dict[str, Any]]:
    """Return list of all templates (meta for each).
    If video_style is set, only return templates that support that style (meta.styles contains it).
    Templates without a 'styles' key are treated as supporting all styles."""
    registry = _load_registry()
    result = []
    for tid in registry:
        meta = _load_meta(tid)
        if not meta:
            continue
        styles = meta.get("styles")
        if video_style and styles is not None and isinstance(styles, list):
            if video_style.strip().lower() not in [s.strip().lower() for s in styles if isinstance(s, str)]:
                continue
        result.append(meta)
    return result


def get_meta(template_id: str) -> dict[str, Any] | None:
    """Get meta.json for one template (built-in or custom)."""
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


def get_layouts_without_image(template_id: str) -> set[str]:
    """Get the set of layout IDs that do not support/display images for a template."""
    meta = _load_meta(template_id)
    if not meta:
        return set()
    layouts = meta.get("layouts_without_image", [])
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
    """Return template_id if valid, else 'default'.
    Accepts both built-in IDs and 'custom_N' format."""
    if not template_id or not isinstance(template_id, str):
        return "default"
    tid = template_id.strip()

    # Custom templates: validate format and existence in DB
    if is_custom_template(tid):
        data = _load_custom_template_data(tid)
        if data is not None:
            return tid
        return "default"

    # Built-in templates
    tid = tid.lower()
    registry = _load_registry()
    if tid in registry:
        return tid
    return "default"
