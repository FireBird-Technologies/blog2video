"""
Custom Templates Router — CRUD + theme extraction for user-created templates.
All users can create/edit/delete custom templates. Pro required to use them in projects.
"""

import json
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.custom_template import CustomTemplate
from app.services.custom_prompt_builder import build_custom_prompt
from app.services.template_service import invalidate_custom_template_cache

router = APIRouter(prefix="/api/custom-templates", tags=["custom-templates"])

VALID_VIDEO_STYLES = {"explainer", "promotional", "storytelling"}


# ─── Pydantic schemas ────────────────────────────────────────


class ExtractThemeRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)


class ExtractThemeResponse(BaseModel):
    extractable: bool
    reason: str
    theme: dict | None = None
    template_name: str = ""


class CreateCustomTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    source_url: str | None = Field(None, max_length=2048)
    theme: dict
    supported_video_style: str | None = None


class UpdateCustomTemplateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    theme: dict | None = None
    supported_video_style: str | None = None


class CustomTemplateOut(BaseModel):
    id: int
    name: str
    source_url: str | None
    category: str
    supported_video_style: str
    theme: dict
    preview_colors: dict
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


# ─── Helpers ──────────────────────────────────────────────────


def _get_user_template(template_id: int, user_id: int, db: Session) -> CustomTemplate:
    """Get a custom template owned by the given user, or raise 404."""
    tpl = (
        db.query(CustomTemplate)
        .filter(CustomTemplate.id == template_id, CustomTemplate.user_id == user_id)
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Custom template not found")
    return tpl


def _serialize_template(tpl: CustomTemplate) -> dict:
    """Serialize a CustomTemplate to API response dict."""
    theme = json.loads(tpl.theme) if isinstance(tpl.theme, str) else tpl.theme
    colors = theme.get("colors", {})
    style = (getattr(tpl, "supported_video_style", None) or "").strip().lower()
    if style not in VALID_VIDEO_STYLES:
        style = "explainer"
    return {
        "id": tpl.id,
        "name": tpl.name,
        "source_url": tpl.source_url,
        "category": tpl.category or "blog",
        "supported_video_style": style,
        "theme": theme,
        "preview_colors": {
            "accent": colors.get("accent", "#7C3AED"),
            "bg": colors.get("bg", "#FFFFFF"),
            "text": colors.get("text", "#1A1A2E"),
        },
        "created_at": tpl.created_at.isoformat() if tpl.created_at else "",
        "updated_at": tpl.updated_at.isoformat() if tpl.updated_at else "",
    }


def _validate_theme(theme: dict) -> dict:
    """Validate theme structure, raise 422 if invalid."""
    colors = theme.get("colors")
    if not isinstance(colors, dict):
        raise HTTPException(status_code=422, detail="theme.colors must be an object")
    for key in ("accent", "bg", "text"):
        if key not in colors:
            raise HTTPException(status_code=422, detail=f"theme.colors.{key} is required")

    fonts = theme.get("fonts")
    if not isinstance(fonts, dict):
        raise HTTPException(status_code=422, detail="theme.fonts must be an object")

    # Fill defaults for optional theme fields if missing
    valid_styles = {"minimal", "glass", "bold", "neon", "soft"}
    if theme.get("style") not in valid_styles:
        theme["style"] = "minimal"

    valid_anims = {"fade", "slide", "spring", "typewriter"}
    if theme.get("animationPreset") not in valid_anims:
        theme["animationPreset"] = "fade"

    if not isinstance(theme.get("borderRadius"), (int, float)):
        theme["borderRadius"] = 12

    # Validate patterns if present (fill defaults for missing sub-fields)
    patterns = theme.get("patterns")
    if patterns is not None:
        if not isinstance(patterns, dict):
            raise HTTPException(status_code=422, detail="theme.patterns must be an object")
        # Sub-field validation is handled by ThemeExtractor._validate_patterns
        # at extraction time; here we just ensure it's a dict structure

    return theme


def _validate_supported_video_style(style: str | None) -> str:
    normalized = (style or "").strip().lower()
    if normalized not in VALID_VIDEO_STYLES:
        raise HTTPException(
            status_code=422,
            detail="supported_video_style must be one of: explainer, promotional, storytelling",
        )
    return normalized


# ─── Endpoints ────────────────────────────────────────────────


@router.post("/extract-theme", response_model=ExtractThemeResponse)
async def extract_theme(
    data: ExtractThemeRequest,
    user: User = Depends(get_current_user),
):
    """Scrape a URL and extract its visual theme using AI."""
    # Lazy imports to avoid loading heavy modules at startup
    from app.services.theme_scraper import scrape_for_theme
    from app.dspy_modules.theme_extractor import ThemeExtractor

    try:
        scraped = scrape_for_theme(data.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    extractor = ThemeExtractor()
    result = await extractor.extract_theme(scraped)

    return ExtractThemeResponse(
        extractable=result["extractable"],
        reason=result["reason"],
        theme=result.get("theme"),
        template_name=result.get("template_name", ""),
    )


@router.post("")
def create_custom_template(
    data: CreateCustomTemplateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new custom template from an extracted/edited theme."""
    theme = _validate_theme(data.theme)
    category = theme.get("category", "blog")
    if data.supported_video_style is not None:
        supported_video_style = _validate_supported_video_style(data.supported_video_style)
    else:
        supported_video_style = "explainer"

    # Generate prompt and cache it
    generated_prompt = build_custom_prompt(theme, data.name)

    tpl = CustomTemplate(
        user_id=user.id,
        name=data.name,
        source_url=data.source_url,
        category=category,
        supported_video_style=supported_video_style,
        theme=json.dumps(theme),
        generated_prompt=generated_prompt,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)

    return _serialize_template(tpl)


@router.get("")
def list_custom_templates(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all custom templates for the current user."""
    templates = (
        db.query(CustomTemplate)
        .filter(CustomTemplate.user_id == user.id)
        .order_by(CustomTemplate.created_at.desc())
        .all()
    )
    return [_serialize_template(t) for t in templates]


@router.get("/{template_id}")
def get_custom_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single custom template by ID."""
    tpl = _get_user_template(template_id, user.id, db)
    return _serialize_template(tpl)


@router.put("/{template_id}")
def update_custom_template(
    template_id: int,
    data: UpdateCustomTemplateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a custom template's name and/or theme. Regenerates prompt if theme changes."""
    tpl = _get_user_template(template_id, user.id, db)

    if data.name is not None:
        tpl.name = data.name

    if data.theme is not None:
        theme = _validate_theme(data.theme)
        tpl.category = theme.get("category", "blog")
        tpl.theme = json.dumps(theme)
        # Regenerate prompt with updated theme
        tpl.generated_prompt = build_custom_prompt(theme, tpl.name)

    if data.supported_video_style is not None:
        tpl.supported_video_style = _validate_supported_video_style(data.supported_video_style)

    db.commit()
    db.refresh(tpl)
    invalidate_custom_template_cache(f"custom_{template_id}")
    return _serialize_template(tpl)


@router.delete("/{template_id}")
def delete_custom_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a custom template."""
    tpl = _get_user_template(template_id, user.id, db)
    db.delete(tpl)
    db.commit()
    invalidate_custom_template_cache(f"custom_{template_id}")
    return {"detail": "Custom template deleted"}
