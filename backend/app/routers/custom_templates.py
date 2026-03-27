"""
Custom Templates Router — CRUD + theme extraction for user-created templates.
All users can create/edit/delete custom templates. Pro required to use them in projects.
"""

import asyncio
import json
import time
import threading
from datetime import date
from pydantic import BaseModel, Field
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db, SessionLocal
from app.config import settings
from app.auth import get_current_user
from app.models.user import User
from app.models.custom_template import CustomTemplate
from app.models.project import Project
from app.services.custom_prompt_builder import build_custom_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/custom-templates", tags=["custom-templates"])

VALID_VIDEO_STYLES = {"explainer", "promotional", "storytelling"}

# ─── Rate limiting ───────────────────────────────────────────
# Per-user, per-day AI call counter: user_id -> (date_str, count)
_ai_call_counts: dict[int, tuple[str, int]] = {}
AI_DAILY_LIMIT = 5


def _check_ai_rate_limit(user_id: int) -> None:
    """Enforce daily AI generation limit. Raises 429 if exceeded."""
    today = date.today().isoformat()
    date_str, count = _ai_call_counts.get(user_id, (today, 0))
    if date_str != today:
        date_str, count = today, 0
    if count >= AI_DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"AI generation limit reached ({AI_DAILY_LIMIT}/day). Try again tomorrow.",
        )
    _ai_call_counts[user_id] = (date_str, count + 1)


def _render_and_store_thumbnail(template_id: int, user_id: int) -> None:
    """Background task: render a preview thumbnail and store URL in DB."""
    try:
        from app.services.thumbnail_renderer import render_template_thumbnail
        from app.database import SessionLocal
        from app.models.custom_template import CustomTemplate as CT

        url = render_template_thumbnail(template_id, user_id)
        if url:
            db = SessionLocal()
            try:
                tpl = db.query(CT).filter(CT.id == template_id).first()
                if tpl:
                    tpl.preview_image_url = url
                    db.commit()
                    logger.info("Thumbnail stored for template %d: %s", template_id, url)
            finally:
                db.close()
    except Exception as e:
        logger.warning("Background thumbnail render failed for template %d: %s", template_id, e)


# ─── Pydantic schemas ────────────────────────────────────────


class ExtractThemeRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)


class ExtractThemeResponse(BaseModel):
    extractable: bool
    reason: str
    theme: dict | None = None
    template_name: str = ""
    logo_urls: list[str] = []
    og_image: str = ""
    screenshot_url: str = ""


class CreateCustomTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    source_url: str | None = Field(None, max_length=2048)
    theme: dict
    supported_video_style: str | None = None
    logo_urls: list[str] | None = None
    og_image: str | None = None
    screenshot_url: str | None = None
    reason: str | None = Field(None, max_length=2000)


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
    component_code: str | None = None
    intro_code: str | None = None
    outro_code: str | None = None
    content_codes: list[str] | None = None
    content_archetype_ids: list[dict | str] | None = None
    current_version_id: int | None = None
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

    # Pull logo_urls and og_image from linked BrandKit (if any)
    logo_urls: list[str] = []
    og_image: str = ""
    if tpl.brand_kit:
        bk = tpl.brand_kit
        try:
            logos_raw = json.loads(bk.logos) if isinstance(bk.logos, str) else (bk.logos or [])
            logo_urls = []
            for u in logos_raw:
                if isinstance(u, str) and u:
                    logo_urls.append(u)
                elif isinstance(u, dict) and u.get("url"):
                    logo_urls.append(u["url"])
        except (json.JSONDecodeError, TypeError):
            pass
        try:
            images_raw = json.loads(bk.images) if isinstance(bk.images, str) else (bk.images or [])
            if images_raw and isinstance(images_raw[0], str):
                og_image = images_raw[0]
        except (json.JSONDecodeError, TypeError, IndexError):
            pass

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
        "component_code": None,
        "intro_code": tpl.intro_code,
        "outro_code": tpl.outro_code,
        "content_codes": json.loads(tpl.content_codes) if tpl.content_codes else None,
        "content_archetype_ids": json.loads(tpl.content_archetype_ids) if tpl.content_archetype_ids else None,
        "current_version_id": tpl.current_version_id,
        "preview_image_url": tpl.preview_image_url,
        "logo_urls": logo_urls,
        "og_image": og_image,
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

    # Fill defaults for optional theme fields only if missing entirely
    # The AI extractor returns free-form values (e.g. "glass morphism SaaS", "bouncy playful spring")
    # which are passed to the code generator as brand context — do NOT restrict to an enum.
    if not isinstance(theme.get("style"), str) or not theme["style"].strip():
        theme["style"] = "minimal"

    if not isinstance(theme.get("animationPreset"), str) or not theme["animationPreset"].strip():
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

    t_step1_start = time.time()
    try:
        scraped = scrape_for_theme(data.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    t_step1 = time.time() - t_step1_start

    t_step2_start = time.time()
    extractor = ThemeExtractor()
    result = await extractor.extract_theme(scraped)
    t_step2 = time.time() - t_step2_start
    t_total = t_step1 + t_step2

    # Phase summary: one clean log per extract-theme call
    theme = result.get("theme")
    if theme:
        c = theme.get("colors", {})
        f = theme.get("fonts", {})
        print(
            f"[F7-DEBUG] [EXTRACT-THEME] {data.url} — "
            f"scrape={t_step1:.1f}s + AI={t_step2:.1f}s = {t_total:.1f}s total | "
            f"accent={c.get('accent')}, bg={c.get('bg')}, fonts={f.get('heading')}/{f.get('body')}, "
            f"style='{theme.get('style')}', category='{theme.get('category')}'"
        )
    else:
        print(f"[F7-DEBUG] [EXTRACT-THEME] {data.url} — scrape={t_step1:.1f}s + AI={t_step2:.1f}s = {t_total:.1f}s | FAILED: {result.get('reason', '')[:150]}")

    return ExtractThemeResponse(
        extractable=result["extractable"],
        reason=result["reason"],
        theme=result.get("theme"),
        template_name=result.get("template_name", ""),
        logo_urls=scraped.logo_urls or [],
        og_image=scraped.og_image or "",
        screenshot_url=scraped.screenshot_url or "",
    )


@router.post("")
def create_custom_template(
    data: CreateCustomTemplateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new custom template from an extracted/edited theme."""
    from app.models.brand_kit import BrandKit

    theme = _validate_theme(data.theme)
    category = theme.get("category", "blog")
    if data.supported_video_style is not None:
        supported_video_style = _validate_supported_video_style(data.supported_video_style)
    else:
        supported_video_style = "explainer"

    # Generate prompt and cache it
    generated_prompt = build_custom_prompt(theme, data.name)

    # Create BrandKit from theme data
    brand_kit = BrandKit(
        user_id=user.id,
        source_url=data.source_url,
        brand_name=data.name,
        colors=json.dumps(theme.get("colors", {})),
        fonts=json.dumps(theme.get("fonts", {})),
        design_language=json.dumps({
            "style": theme.get("style"),
            "animationPreset": theme.get("animationPreset"),
            "borderRadius": theme.get("borderRadius"),
            "category": theme.get("category"),
            "patterns": theme.get("patterns"),
            "personality": data.reason or "",
        }),
        logos=json.dumps(data.logo_urls or []),
        images=json.dumps([data.og_image] if data.og_image else []),
    )
    db.add(brand_kit)
    db.flush()
    tpl = CustomTemplate(
        user_id=user.id,
        name=data.name,
        source_url=data.source_url,
        category=category,
        supported_video_style=supported_video_style,
        theme=json.dumps(theme),
        generated_prompt=generated_prompt,
        brand_kit_id=brand_kit.id,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)

    print(f"[F7-DEBUG] [CREATE] Template '{data.name}' created: id={tpl.id}, category='{category}', brandKit={brand_kit.id}")
    return _serialize_template(tpl)


@router.get("")
def list_custom_templates(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all custom templates for the current user."""
    templates = (
        db.query(CustomTemplate)
        .options(joinedload(CustomTemplate.brand_kit))
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

    return _serialize_template(tpl)


@router.delete("/{template_id}")
def delete_custom_template(
    template_id: int,
    force: bool = Query(False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a custom template."""
    tpl = _get_user_template(template_id, user.id, db)
    project_count = (
        db.query(Project)
        .filter(
            Project.user_id == user.id,
            Project.template == f"custom_{template_id}",
        )
        .count()
    )
    if project_count > 0 and not force:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "template_in_use",
                "project_count": project_count,
                "message": "This template is used by existing projects. Deleting it will block future renders and re-renders for those projects.",
            },
        )
    db.delete(tpl)
    db.commit()

    return {"detail": "Custom template deleted"}


def _save_version(tpl: "CustomTemplate", label: str, db: "Session") -> int:
    """Snapshot the current code fields as a new TemplateVersion. Returns version id."""
    from app.models.template_version import TemplateVersion

    version = TemplateVersion(
        template_id=tpl.id,
        component_code=tpl.component_code,
        intro_code=tpl.intro_code,
        outro_code=tpl.outro_code,
        content_codes=tpl.content_codes,
        label=label,
    )
    db.add(version)
    db.flush()  # populate version.id
    tpl.current_version_id = version.id
    return version.id


# ─── In-memory code generation progress tracker ─────────────
# Same pattern as _pipeline_progress in pipeline.py
_codegen_progress: dict[int, dict] = {}


def _run_codegen_background(template_id: int, user_id: int) -> None:
    """Run code generation in a background thread, updating _codegen_progress."""
    import asyncio as _asyncio
    from app.services.code_generator import generate_component_code

    loop = _asyncio.new_event_loop()
    _asyncio.set_event_loop(loop)

    try:
        _codegen_progress[template_id] = {
            "status": "generating",
            "step": "design_system",
            "running": True,
            "error": None,
        }

        db = SessionLocal()
        try:
            tpl = (
                db.query(CustomTemplate)
                .filter(CustomTemplate.id == template_id, CustomTemplate.user_id == user_id)
                .first()
            )
            if not tpl:
                _codegen_progress[template_id] = {
                    "status": "error",
                    "step": "init",
                    "running": False,
                    "error": "Template not found",
                }
                return

            t_start = time.time()
            _codegen_progress[template_id]["step"] = "generating_scenes"
            variants = loop.run_until_complete(generate_component_code(tpl))

            # Expire and re-fetch to avoid stale SSL connections
            db.expire_all()
            tpl = (
                db.query(CustomTemplate)
                .filter(CustomTemplate.id == template_id, CustomTemplate.user_id == user_id)
                .first()
            )

            tpl.component_code = None
            tpl.intro_code = variants["intro_code"]
            tpl.outro_code = variants["outro_code"]
            tpl.content_codes = json.dumps(variants["content_codes"]) if variants.get("content_codes") else None
            tpl.content_archetype_ids = json.dumps(variants.get("archetype_ids", []))
            print(f"[F7-DEBUG] [CODEGEN] Stored {len(variants.get('content_codes', []))} content archetypes: {variants.get('archetype_ids', [])}")

            _codegen_progress[template_id]["step"] = "saving"
            _save_version(tpl, "Initial generation", db)
            db.commit()

            elapsed = time.time() - t_start
            print(f"[F7-DEBUG] [GENERATE-CODE] '{tpl.name}' completed in {elapsed:.1f}s (background)")

            _codegen_progress[template_id] = {
                "status": "complete",
                "step": "done",
                "running": False,
                "error": None,
            }

            # Render thumbnail
            try:
                _render_and_store_thumbnail(template_id, user_id)
            except Exception:
                pass

        finally:
            db.close()
    except Exception as e:
        print(f"[F7-DEBUG] [GENERATE-CODE] FAILED for template {template_id}: {e}")
        _codegen_progress[template_id] = {
            "status": "error",
            "step": "failed",
            "running": False,
            "error": str(e),
        }
    finally:
        loop.close()


@router.post("/{template_id}/generate-code")
async def generate_code(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Launch AI code generation in the background. Returns 202 immediately."""
    _check_ai_rate_limit(user.id)
    if not (settings.ANTHROPIC_API_KEY or "").strip():
        raise HTTPException(
            status_code=400,
            detail="ANTHROPIC_API_KEY is required for AI template code generation.",
        )
    tpl = _get_user_template(template_id, user.id, db)

    # Check if already running
    progress = _codegen_progress.get(template_id, {})
    if progress.get("running"):
        return JSONResponse(
            status_code=202,
            content={"detail": "Code generation already in progress", "template_id": template_id},
        )

    # Launch in background thread
    thread = threading.Thread(
        target=_run_codegen_background,
        args=(template_id, user.id),
        daemon=True,
    )
    thread.start()

    return JSONResponse(
        status_code=202,
        content={"detail": "Code generation started", "template_id": template_id},
    )


@router.get("/{template_id}/generation-status")
def get_generation_status(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll code generation progress."""
    # Verify ownership
    _get_user_template(template_id, user.id, db)

    progress = _codegen_progress.get(template_id)
    if progress:
        return progress

    # No in-memory progress — check if template already has code (e.g. after restart)
    tpl = _get_user_template(template_id, user.id, db)
    if tpl.intro_code:
        return {"status": "complete", "step": "done", "running": False, "error": None}

    return {"status": "unknown", "step": "unknown", "running": False, "error": None}


@router.get("/{template_id}/code")
def get_template_code(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get just the code fields for a template (lightweight)."""
    tpl = _get_user_template(template_id, user.id, db)
    return {
        "component_code": None,
        "intro_code": tpl.intro_code,
        "outro_code": tpl.outro_code,
        "content_codes": json.loads(tpl.content_codes) if tpl.content_codes else None,
    }


# ─── Brand asset upload endpoints ────────────────────────────


@router.post("/{template_id}/upload-logo")
async def upload_template_logo(
    template_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a brand logo for a custom template."""
    from app.models.brand_kit import BrandKit
    from app.services import r2_storage

    tpl = _get_user_template(template_id, user.id, db)

    # Validate file
    if file.content_type not in ("image/png", "image/jpeg", "image/webp", "image/svg+xml"):
        raise HTTPException(422, "Logo must be PNG, JPEG, WebP, or SVG")
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(422, "Logo must be under 2MB")

    # Ensure brand kit exists
    if not tpl.brand_kit_id:
        brand_kit = BrandKit(user_id=user.id, brand_name=tpl.name)
        db.add(brand_kit)
        db.flush()
        tpl.brand_kit_id = brand_kit.id

    bk = tpl.brand_kit

    # Upload to R2
    filename = f"logo_{file.filename}"
    key = r2_storage.brand_asset_key(user.id, bk.id, filename)
    url = r2_storage.upload_bytes(key, contents, content_type=file.content_type)

    # Update brand kit logos
    logos = json.loads(bk.logos) if bk.logos else []
    if isinstance(logos, list) and logos and isinstance(logos[0], str):
        # Migrate old format (list of URL strings) to new format (list of dicts)
        logos = [{"url": l, "type": "scraped"} for l in logos]
    logos = [l for l in logos if isinstance(l, dict) and l.get("type") != "primary"]
    logos.insert(0, {"url": url, "type": "primary", "filename": filename})
    bk.logos = json.dumps(logos)

    db.commit()
    db.refresh(tpl)


    return {"logo_url": url, "template": _serialize_template(tpl)}



# ─── Regenerate + versioning endpoints ──────────────────────


@router.post("/{template_id}/regenerate-code")
async def regenerate_code(
    template_id: int,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Regenerate all code variants from scratch (keeps old versions for rollback)."""
    from app.services.code_generator import generate_component_code

    _check_ai_rate_limit(user.id)
    if not (settings.ANTHROPIC_API_KEY or "").strip():
        raise HTTPException(
            status_code=400,
            detail="ANTHROPIC_API_KEY is required for AI template code generation.",
        )
    tpl = _get_user_template(template_id, user.id, db)

    if not tpl.intro_code:
        raise HTTPException(status_code=400, detail="No code to regenerate — run generate-code first.")

    # Snapshot current state before overwriting
    _save_version(tpl, "Before regeneration", db)

    try:
        variants = await generate_component_code(tpl)
    except RuntimeError as e:
        print(f"[F7-DEBUG] [REGEN-CODE] FAILED for '{tpl.name}': {e}")
        raise HTTPException(status_code=502, detail=str(e))

    content_codes_list = variants.get("content_codes", [])

    # Expire all cached state so the next query hits the DB fresh
    # (avoids stale SSL connections after long LLM calls)
    db.expire_all()
    tpl = _get_user_template(template_id, user.id, db)

    tpl.component_code = None
    tpl.intro_code = variants["intro_code"]
    tpl.outro_code = variants["outro_code"]
    tpl.content_codes = json.dumps(variants["content_codes"]) if variants.get("content_codes") else None
    tpl.content_archetype_ids = json.dumps(variants.get("archetype_ids", []))

    _save_version(tpl, "Regenerated", db)
    db.commit()
    db.refresh(tpl)


    # Render preview thumbnail in background (non-blocking)
    background_tasks.add_task(_render_and_store_thumbnail, tpl.id, user.id)

    return _serialize_template(tpl)


@router.get("/{template_id}/versions")
def list_versions(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all saved versions for a template (newest first)."""
    from app.models.template_version import TemplateVersion

    tpl = _get_user_template(template_id, user.id, db)

    versions = (
        db.query(TemplateVersion)
        .filter(TemplateVersion.template_id == tpl.id)
        .order_by(TemplateVersion.created_at.desc())
        .all()
    )

    # Self-heal: if current_version_id doesn't match any version, fix it
    if versions and tpl.current_version_id not in {v.id for v in versions}:
        tpl.current_version_id = versions[0].id  # newest
        db.commit()

    return {
        "current_version_id": tpl.current_version_id,
        "versions": [
            {
                "id": v.id,
                "label": v.label,
                "created_at": v.created_at.isoformat() if v.created_at else "",
            }
            for v in versions
        ],
    }


@router.post("/{template_id}/versions/{version_id}/rollback")
def rollback_to_version(
    template_id: int,
    version_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rollback a template to a previously saved version."""
    from app.models.template_version import TemplateVersion

    tpl = _get_user_template(template_id, user.id, db)

    version = (
        db.query(TemplateVersion)
        .filter(TemplateVersion.id == version_id, TemplateVersion.template_id == tpl.id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Snapshot current state before rollback (so users can undo the rollback)
    if tpl.intro_code:
        _save_version(tpl, "Before rollback", db)

    # Restore code from the target version
    tpl.component_code = None
    tpl.intro_code = version.intro_code
    tpl.outro_code = version.outro_code
    tpl.content_codes = version.content_codes
    tpl.current_version_id = version.id

    db.commit()
    db.refresh(tpl)


    return _serialize_template(tpl)
