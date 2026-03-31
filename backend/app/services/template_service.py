"""
TemplateService — Reads template metadata and prompts from backend/templates/.

All template-specific logic lives in meta.json and prompt.md. This service
is template-agnostic: it discovers templates from the registry and reads
their files. Unknown IDs fall back to "default".

Custom templates ("custom_N" format) are loaded from the database instead
of the filesystem, returning the same shapes as built-in templates.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

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


def _build_template_result(tpl) -> dict[str, Any]:
    """Build the template data dict from a CustomTemplate ORM object."""
    theme = json.loads(tpl.theme) if isinstance(tpl.theme, str) else tpl.theme
    style = (getattr(tpl, "supported_video_style", None) or "").strip().lower()
    if style not in {"explainer", "promotional", "storytelling"}:
        style = "explainer"
    # Load brand kit data if linked
    brand_kit_data = None
    if tpl.brand_kit_id and tpl.brand_kit:
        bk = tpl.brand_kit
        brand_kit_data = {
            "colors": json.loads(bk.colors) if bk.colors else {},
            "fonts": json.loads(bk.fonts) if bk.fonts else {},
            "logos": json.loads(bk.logos) if bk.logos else [],
            "design_language": json.loads(bk.design_language) if bk.design_language else {},
            "images": json.loads(bk.images) if bk.images else [],
        }

    # Parse content_codes JSON if present
    content_codes = None
    if tpl.content_codes:
        try:
            content_codes = json.loads(tpl.content_codes)
        except (json.JSONDecodeError, TypeError):
            content_codes = None

    return {
        "theme": theme,
        "generated_prompt": tpl.generated_prompt or "",
        "name": tpl.name,
        "category": tpl.category or "blog",
        "supported_video_style": style,
        "has_generated_code": bool(content_codes),
        "intro_code": tpl.intro_code,
        "outro_code": tpl.outro_code,
        "content_codes": content_codes,
        "content_archetype_ids": json.loads(tpl.content_archetype_ids) if getattr(tpl, "content_archetype_ids", None) else [],
        "brand_kit": brand_kit_data,
    }


def _load_custom_template_data(
    template_id: str, db: Session | None = None
) -> dict[str, Any] | None:
    """
    Load a custom template's theme + generated_prompt from DB.
    Returns a dict with keys: theme, generated_prompt, name, category, supported_video_style.
    Returns None if not found.

    If a `db` session is provided, it is used directly (no new connection).
    Otherwise a short-lived SessionLocal is created and closed automatically.
    """
    custom_id = _parse_custom_id(template_id)
    if custom_id is None:
        return None

    from app.models.custom_template import CustomTemplate

    if db is not None:
        tpl = db.query(CustomTemplate).filter(CustomTemplate.id == custom_id).first()
        if not tpl:
            return None
        return _build_template_result(tpl)

    # No session provided — create a short-lived one
    from app.database import SessionLocal

    own_db = SessionLocal()
    try:
        tpl = own_db.query(CustomTemplate).filter(CustomTemplate.id == custom_id).first()
        if not tpl:
            return None
        return _build_template_result(tpl)
    finally:
        own_db.close()


def _get_custom_meta(template_id: str, db: Session | None = None) -> dict[str, Any] | None:
    """Build a meta.json equivalent for a custom template from DB data."""
    data = _load_custom_template_data(template_id, db=db)
    if not data:
        return None
    from app.services.custom_prompt_builder import build_custom_meta
    content_codes = data.get("content_codes") or []
    return build_custom_meta(
        data["theme"],
        data["name"],
        supported_video_style=data.get("supported_video_style", "explainer"),
        content_codes_count=len(content_codes),
    )


def _get_custom_prompt(template_id: str, db: Session | None = None) -> str:
    """Get the generated prompt for a custom template."""
    data = _load_custom_template_data(template_id, db=db)
    if not data:
        return ""
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


def _load_meta(template_id: str, db: Session | None = None) -> dict[str, Any] | None:
    """Load meta.json for a template. Returns None if not found."""
    if is_custom_template(template_id):
        return _get_custom_meta(template_id, db=db)
    path = _TEMPLATES_DIR / template_id / "meta.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _load_prompt(template_id: str, db: Session | None = None) -> str:
    """Load prompt.md content for a template. Returns empty string if not found."""
    if is_custom_template(template_id):
        return _get_custom_prompt(template_id, db=db)
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


def get_layout_prompt(template_id: str) -> str:
    """
    Get layout_prompt.md content for one template.

    - For built-in templates, tries backend/templates/<id>/layout_prompt.md first,
      falling back to prompt.md when not present.
    - For custom templates (custom_N), falls back to the generated prompt
      (the full template prompt already contains the layout/arrangement catalog).
    """
    if is_custom_template(template_id):
        # Custom templates do not have layout_prompt.md files on disk; use their full prompt.
        return _get_custom_prompt(template_id)

    layout_path = _TEMPLATES_DIR / template_id / "layout_prompt.md"
    if layout_path.exists():
        with open(layout_path, encoding="utf-8") as f:
            return f.read()

    # Fallback: use full prompt.md
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


def validate_template_id(template_id: str | None, db: Session | None = None) -> str:
    """Return template_id if valid, else 'default'.
    Accepts both built-in IDs and 'custom_N' format."""
    if not template_id or not isinstance(template_id, str):
        return "default"
    tid = template_id.strip()

    # Custom templates: validate format and existence in DB
    if is_custom_template(tid):
        data = _load_custom_template_data(tid, db=db)
        if data is not None:
            return tid
        return "default"

    # Built-in templates
    tid = tid.lower()
    if tid == "newsreport":
        tid = "newscast"
    registry = _load_registry()
    if tid in registry:
        return tid
    return "default"
