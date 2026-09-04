"""
Custom Templates Router — CRUD + theme extraction for user-created templates.
All users (incl. Free) can create/edit/delete AND use custom templates in projects.
Access is gated by video credits + the per-plan creation cap, not subscription tier.
"""

import asyncio
import json
import re
import time
import threading
from datetime import date, datetime, timedelta
from pydantic import BaseModel, Field, model_validator
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db, SessionLocal
from app.config import settings
from app.auth import get_current_user
from app.models.user import User
from app.models.custom_template import CustomTemplate, CustomTemplateGenRun
from app.models.template_rating import TemplateRating
from app.models.project import Project
from app.schemas.schemas import TemplateRatingSubmit, TemplateRatingOut
from app.services.access import can_use_ai_edit, consume_ai_edit, refund_ai_edit
from app.services.custom_prompt_builder import build_custom_prompt
from app.services.render_registry import FONT_IDS
from app.services.template_service import apply_blueprint_to_theme

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/custom-templates", tags=["custom-templates"])

# ─── Rate limiting ───────────────────────────────────────────
# Per-user, per-day AI call counter: user_id -> (date_str, count)
_ai_call_counts: dict[int, tuple[str, int]] = {}
AI_DAILY_LIMIT = 20


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


def _check_custom_template_quota(user: User) -> None:
    """Raise 403 when the user has hit their custom-template creation limit.

    The limit is a lifetime counter (``custom_templates_created``) vs the effective
    limit (plan base + purchased ``custom_template_bonus``). Deleting a template does
    NOT free a slot. The 403 detail is an object so the frontend can show the upgrade
    modal — callers/handlers must read ``detail.code``, not render it as a string.
    """
    if (user.custom_templates_created or 0) >= user.custom_template_limit:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "custom_template_limit",
                "message": "You've reached your custom-template creation limit.",
                "created": user.custom_templates_created or 0,
                "limit": user.custom_template_limit,
                "plan": user.plan.value,
            },
        )


def _refund_template_slot(db: Session, user_id: int) -> None:
    """Give back a consumed custom-template slot when generation fails.

    Charged up front by create (first-time generation) and by regenerate-code;
    both refund here so a template that never produced code costs nothing.
    Floors at 0 so a double-refund can't hand out free slots. Caller commits,
    so the refund lands in the same transaction as the failure-state write.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
    user.custom_templates_created = max(0, (user.custom_templates_created or 0) - 1)
    db.add(user)


def _render_and_store_thumbnail(template_id: int, user_id: int) -> None:
    """Background task: snapshot the real template preview and store its URL.

    Drives the puppeteer capture worker
    ({@link app.services.custom_template_snapshot.request_snapshot}), which
    screenshots the deployed frontend's `/_capture` route for this template,
    uploads the image to R2 and sets ``preview_image_url``. Falling back to the
    legacy Remotion-still renderer when the capture worker is unavailable keeps
    template creation from ever depending on a browser being reachable.
    """
    try:
        from app.services.custom_template_snapshot import request_snapshot

        if request_snapshot(template_id):
            return
    except Exception as e:
        logger.warning("Puppeteer snapshot failed for template %d: %s", template_id, e)

    # Fallback: legacy server-side Remotion still (mock intro scene).
    try:
        from app.services.thumbnail_renderer import render_template_thumbnail

        url = render_template_thumbnail(template_id, user_id)
        if url:
            db = SessionLocal()
            try:
                tpl = db.query(CustomTemplate).filter(CustomTemplate.id == template_id).first()
                if tpl:
                    tpl.preview_image_url = url
                    db.commit()
                    logger.info("Thumbnail stored for template %d: %s", template_id, url)
            finally:
                db.close()
    except Exception as e:
        logger.warning("Background thumbnail render failed for template %d: %s", template_id, e)


def _verify_capture_secret(x_capture_secret: str | None) -> None:
    """Guard the internal capture endpoints with the shared CAPTURE_SECRET."""
    secret = settings.CAPTURE_SECRET
    if not secret:
        raise HTTPException(status_code=404, detail="Capture endpoints are disabled")
    if not x_capture_secret or x_capture_secret != secret:
        raise HTTPException(status_code=401, detail="Invalid capture secret")


# ─── Pydantic schemas ────────────────────────────────────────


class ExtractThemeRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)


class ExtractThemeFromPromptRequest(BaseModel):
    prompt: str = Field(..., min_length=15, max_length=5000)
    name: str | None = Field(None, max_length=255)


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
    logo_urls: list[str] | None = None
    og_image: str | None = None
    screenshot_url: str | None = None
    reason: str | None = Field(None, max_length=2000)


class UpdateCustomTemplateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    theme: dict | None = None


class CustomTemplateOut(BaseModel):
    id: int
    name: str
    source_url: str | None
    category: str
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


def _get_my_rating(template_id: int, user_id: int, db: Session) -> tuple[int | None, str | None]:
    """Return the user's (rating, comment) for a template, or (None, None) if unrated."""
    row = (
        db.query(TemplateRating.rating, TemplateRating.suggestion)
        .filter(
            TemplateRating.user_id == user_id,
            TemplateRating.custom_template_id == template_id,
        )
        .first()
    )
    return (row[0], row[1]) if row else (None, None)


def _utc_iso(dt) -> str:
    """Serialize a naive-UTC datetime as a UTC-aware ISO string (with 'Z').

    Timestamp columns are stored via ``datetime.utcnow()`` (naive UTC). A bare
    ``.isoformat()`` has no timezone suffix, so JS ``Date.parse`` reads it as
    LOCAL time — making fresh rows look hours old to clients in a positive UTC
    offset. Emitting an explicit 'Z' keeps every client's parsing correct.
    """
    if not dt:
        return ""
    return dt.replace(microsecond=0).isoformat() + "Z" if dt.tzinfo is None else dt.isoformat()


def _serialize_template(
    tpl: CustomTemplate, my_rating: int | None = None, my_rating_comment: str | None = None
) -> dict:
    """Serialize a CustomTemplate to API response dict.

    ``my_rating`` / ``my_rating_comment`` are the current user's 1-5 star rating
    and optional feedback for this template (or None).
    """
    theme = json.loads(tpl.theme) if isinstance(tpl.theme, str) else tpl.theme
    # The template PREVIEW reads transitions and fonts off the theme, so the
    # blueprint's choices have to be folded in here too — otherwise the preview
    # shows the 3-bucket energy default (one transition repeated on every cut)
    # while the exported video uses the blueprint's family.
    _tpl_bp = json.loads(tpl.design_blueprint) if tpl.design_blueprint else None
    theme = apply_blueprint_to_theme(theme, _tpl_bp)
    colors = theme.get("colors", {})

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
        # Which generation drew this template. The list already carries the scene
        # CODE, and ProjectView hands that straight to the player as
        # `precompiledTemplateData` to skip a round-trip — so the version has to
        # travel WITH it. Without this the player fell back to 1 and overlaid the
        # built-in CTA on a v2 outro, discarding the ending the template designed.
        # Kept in step with GET /{id}/code and the project-scoped mirror.
        "design_version": _design_version(tpl),
        "current_version_id": tpl.current_version_id,
        "preview_image_url": tpl.preview_image_url,
        "logo_urls": logo_urls,
        "og_image": og_image,
        "generation_failed": bool(tpl.generation_failed),
        # Scenes that fell back to the stub design (§R Layer 3) — surfaced so a
        # degraded scene is visible in the UI rather than only in the video.
        "generation_warnings": (
            json.loads(tpl.generation_warnings) if tpl.generation_warnings else []
        ),
        "design_blueprint": (
            json.loads(tpl.design_blueprint) if tpl.design_blueprint else None
        ),
        "layout_prop_schemas": (
            json.loads(tpl.layout_prop_schemas) if tpl.layout_prop_schemas else None
        ),
        # Per-scene sample copy for the preview. NULL on templates generated
        # before this existed, which the frontend reads as "use the client-side
        # fallback" — see CustomPreview's sceneSampleProps.
        "scene_sample_content": (
            json.loads(tpl.scene_sample_content) if tpl.scene_sample_content else None
        ),
        # Per-scene default type sizes, indexed like scene_sample_content. NULL
        # on older templates, which fall through to the frontend's own defaults.
        "scene_font_defaults": (
            json.loads(tpl.scene_font_defaults) if tpl.scene_font_defaults else None
        ),
        # Each layout's image mode, so the project preview can tell a full-bleed
        # BACKGROUND image from a HALF one sitting beside the type.
        #
        # Returned by the two /code endpoints already, but ProjectView hands the
        # player a precompiled shortcut built from THIS payload, which skips that
        # fetch. Without the field the preview saw `undefined`, could not
        # distinguish "half" from the legacy null the scrim heuristic falls back
        # on, and blurred half-side clips that sit beside the copy — where a
        # scrim buys no readability and only mutes the picture.
        "image_modes": _image_modes_by_layout(tpl),
        "is_regenerating": bool(tpl.is_regenerating),
        "my_rating": my_rating,
        "my_rating_comment": my_rating_comment,
        "created_at": _utc_iso(tpl.created_at),
        "updated_at": _utc_iso(tpl.updated_at),
    }


def _validate_theme(theme: dict) -> dict:
    """Validate theme structure, raise 422 if invalid."""
    colors = theme.get("colors")
    if not isinstance(colors, dict):
        raise HTTPException(status_code=422, detail="theme.colors must be an object")
    for key in ("accent", "bg", "text"):
        if key not in colors:
            raise HTTPException(status_code=422, detail=f"theme.colors.{key} is required")

    # `bg2` is the gradient's second stop; absent means a solid background. It
    # reaches the renderer via brandColors.bg2 -> derivePalette -> backgroundCss,
    # and is now client-settable from the template editor's background control,
    # so it needs the shape check the rest of colors never gave it. Dropped
    # rather than rejected: a malformed second stop should fall back to solid,
    # not fail the whole save.
    if "bg2" in colors:
        bg2 = colors.get("bg2")
        if not (isinstance(bg2, str) and re.fullmatch(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})", bg2.strip())):
            colors.pop("bg2", None)
        else:
            colors["bg2"] = bg2.strip()

    fonts = theme.get("fonts")
    if not isinstance(fonts, dict):
        raise HTTPException(status_code=422, detail="theme.fonts must be an object")

    # Normalise the two typefaces the renderer reads to registry ids, so a font
    # picked in the template editor is one the renderer can actually resolve.
    #
    # DROP-DON'T-REJECT, the same posture as `bg2` above. Existing templates
    # store whatever free-form name the theme extractor guessed ("Cormorant
    # Garamond"), which is not a registry id — rejecting those would 422 every
    # save of a pre-existing template, including one that only changed a colour.
    # So a resolvable value is normalised and written back, and an unresolvable
    # one is left exactly as it was.
    for _key in ("heading", "body"):
        _val = fonts.get(_key)
        if not isinstance(_val, str) or not _val.strip():
            continue
        _norm = _val.strip().lower().replace(" ", "_").replace("-", "_")
        if _norm in FONT_IDS:
            fonts[_key] = _norm

    # Fill defaults for optional theme fields only if missing entirely
    # The AI extractor returns free-form values (e.g. "glass morphism SaaS", "bouncy playful spring")
    # which are passed to the code generator as brand context — do NOT restrict to an enum.
    if not isinstance(theme.get("style"), str) or not theme["style"].strip():
        theme["style"] = "minimal"

    if not isinstance(theme.get("animationPreset"), str) or not theme["animationPreset"].strip():
        theme["animationPreset"] = "fade"

    if not isinstance(theme.get("borderRadius"), (int, float)):
        theme["borderRadius"] = 12

    # `brief` carries the user's free-text prompt / uploaded-doc text so scene
    # generation can honor explicit requests ("add a testimonial scene"). It is
    # client-supplied here, so clamp it; drop non-string values entirely.
    brief = theme.get("brief")
    if isinstance(brief, str) and brief.strip():
        theme["brief"] = brief.strip()[:30_000]
    else:
        theme.pop("brief", None)

    # `brand_description` is the extractor's narrative design brief and the
    # primary input to the design-doc stage. Client-supplied on create (it round
    # trips through the extract response), so clamp it the same way as `brief`.
    brand_description = theme.get("brand_description")
    if isinstance(brand_description, str) and brand_description.strip():
        theme["brand_description"] = brand_description.strip()[:4_000]
    else:
        theme.pop("brand_description", None)

    # Validate patterns if present (fill defaults for missing sub-fields)
    patterns = theme.get("patterns")
    if patterns is not None:
        if not isinstance(patterns, dict):
            raise HTTPException(status_code=422, detail="theme.patterns must be an object")
        # Sub-field validation is handled by ThemeExtractor._validate_patterns
        # at extraction time; here we just ensure it's a dict structure

    return theme


# ─── Endpoints ────────────────────────────────────────────────


@router.get("/public/featured")
def get_public_featured_templates(
    ids: str = Query(..., description="Comma-separated template IDs, e.g. 13,18,7"),
    db: Session = Depends(get_db)
):
    """Fetch specific custom templates publicly to showcase them."""
    id_list = [int(x.strip()) for x in ids.split(',') if x.strip().isdigit()]
    if not id_list:
         return []
    
    templates = (
        db.query(CustomTemplate)
        .options(joinedload(CustomTemplate.brand_kit))
        .filter(CustomTemplate.id.in_(id_list))
        .all()
    )
    
    tpl_map = {t.id: t for t in templates}
    results = []
    for tid in id_list:
        if tid in tpl_map:
            ser = _serialize_template(tpl_map[tid])
            ser["intro_code"] = tpl_map[tid].intro_code
            ser["content_codes"] = json.loads(tpl_map[tid].content_codes) if tpl_map[tid].content_codes else None
            ser["outro_code"] = tpl_map[tid].outro_code
            results.append(ser)
            
    return results


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


def _brief_response(result: dict) -> ExtractThemeResponse:
    """Map a ThemeExtractor brief result into the shared ExtractThemeResponse.
    Prompt/doc inputs have no scraped logo/og-image — those are added post-creation."""
    return ExtractThemeResponse(
        extractable=result["extractable"],
        reason=result["reason"],
        theme=result.get("theme"),
        template_name=result.get("template_name", ""),
        logo_urls=[],
        og_image="",
        screenshot_url="",
    )


@router.post("/extract-theme-from-prompt", response_model=ExtractThemeResponse)
async def extract_theme_from_prompt(
    data: ExtractThemeFromPromptRequest,
    user: User = Depends(get_current_user),
):
    """Build a visual theme from a free-text prompt describing the desired template."""
    from app.dspy_modules.theme_extractor import ThemeExtractor

    _check_ai_rate_limit(user.id)

    t0 = time.time()
    extractor = ThemeExtractor()
    result = await extractor.extract_theme_from_brief(data.prompt, (data.name or "").strip())
    dt = time.time() - t0

    theme = result.get("theme")
    if theme:
        # Preserve the raw prompt so scene generation can honor explicit scene
        # requests (e.g. "add a testimonial scene"). Persists on the theme JSON.
        theme["brief"] = data.prompt.strip()[:30_000]
        c = theme.get("colors", {})
        print(
            f"[F7-DEBUG] [EXTRACT-PROMPT] AI={dt:.1f}s | accent={c.get('accent')}, "
            f"bg={c.get('bg')}, style='{theme.get('style')}', category='{theme.get('category')}'"
        )
    else:
        print(f"[F7-DEBUG] [EXTRACT-PROMPT] AI={dt:.1f}s | FAILED: {result.get('reason', '')[:150]}")

    return _brief_response(result)


@router.post("/extract-theme-from-doc", response_model=ExtractThemeResponse)
async def extract_theme_from_doc(
    file: UploadFile = File(...),
    name: str = Form(""),
    user: User = Depends(get_current_user),
):
    """Build a visual theme from an uploaded brand/design document (PDF, DOCX, MD, TXT)."""
    from app.dspy_modules.theme_extractor import ThemeExtractor
    from app.services.doc_extractor import extract_text_from_upload

    _check_ai_rate_limit(user.id)

    # Size guard (Starlette exposes .size for spooled uploads).
    if getattr(file, "size", None) and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="That file's too large. Please keep it under 10 MB.")

    # extract_text_from_upload raises HTTPException(400) on empty/corrupt/binary input.
    brief_text = extract_text_from_upload(file)
    if len(brief_text) > 30_000:
        brief_text = brief_text[:30_000]

    t0 = time.time()
    extractor = ThemeExtractor()
    result = await extractor.extract_theme_from_brief(brief_text, (name or "").strip())
    dt = time.time() - t0

    theme = result.get("theme")
    if theme:
        # Preserve the uploaded doc text so scene generation can honor explicit
        # scene requests stated in the brand/design document.
        theme["brief"] = brief_text.strip()[:30_000]
        c = theme.get("colors", {})
        print(
            f"[F7-DEBUG] [EXTRACT-DOC] '{file.filename}' chars={len(brief_text)} AI={dt:.1f}s | "
            f"accent={c.get('accent')}, style='{theme.get('style')}', category='{theme.get('category')}'"
        )
    else:
        print(f"[F7-DEBUG] [EXTRACT-DOC] '{file.filename}' AI={dt:.1f}s | FAILED: {result.get('reason', '')[:150]}")

    return _brief_response(result)


@router.post("")
def create_custom_template(
    data: CreateCustomTemplateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new custom template from an extracted/edited theme."""
    from app.models.brand_kit import BrandKit

    # Enforce the per-plan creation quota before doing any work.
    _check_custom_template_quota(user)

    theme = _validate_theme(data.theme)
    category = theme.get("category", "blog")

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
        theme=json.dumps(theme),
        generated_prompt=generated_prompt,
        brand_kit_id=brand_kit.id,
    )
    db.add(tpl)
    # Consume one lifetime slot. Same commit as the template insert → atomic, and
    # only runs on a successful create (validation/brand-kit failures raise earlier).
    user.custom_templates_created = (user.custom_templates_created or 0) + 1
    db.add(user)
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
    # Batch-load this user's ratings so each card can show its current star value + comment.
    ratings = (
        db.query(
            TemplateRating.custom_template_id,
            TemplateRating.rating,
            TemplateRating.suggestion,
        )
        .filter(TemplateRating.user_id == user.id)
        .all()
    )
    rating_by_template = {tid: (r, s) for tid, r, s in ratings}
    return [
        _serialize_template(
            t,
            my_rating=rating_by_template.get(t.id, (None, None))[0],
            my_rating_comment=rating_by_template.get(t.id, (None, None))[1],
        )
        for t in templates
    ]


# ─── Internal capture endpoints (shared-secret; no per-user auth) ──────────
# Used by the puppeteer snapshot pipeline to (1) list templates to snapshot,
# (2) read a template's data to render its real preview, and (3) store the
# resulting image. Guarded by the CAPTURE_SECRET shared secret, not user auth,
# so a backfill can run across every user's templates.


# ─── Scene-capture jobs (visual verification) ────────────────────────────────
#
# A scene's code is 200-400 lines, far too large for a query string, so the
# capture page fetches it by job id. These are EPHEMERAL — seconds old, consumed
# once, never needed again — so they live in a process-local TTL dict rather than
# the DB, where a row per scene attempt would be pointless churn.
#
# CAVEAT: this makes the visual check single-process-affine. Under multiple
# uvicorn workers the shot server may hit a different process than the one that
# stored the job, and the check will fail open (returning None) rather than
# misbehave. Promote to Redis if the deployment goes multi-worker.
_SCENE_CAPTURE_JOBS: dict[str, tuple[float, dict]] = {}
_SCENE_JOB_TTL_S = 120.0
_SCENE_JOB_MAX = 64


def put_scene_capture_job(job_id: str, payload: dict) -> None:
    """Store a scene payload for the capture page to fetch."""
    now = time.time()
    # Evict expired entries, then oldest-first if still over the cap, so a
    # crashed shot server cannot leak memory.
    for k in [k for k, (ts, _) in _SCENE_CAPTURE_JOBS.items() if now - ts > _SCENE_JOB_TTL_S]:
        _SCENE_CAPTURE_JOBS.pop(k, None)
    while len(_SCENE_CAPTURE_JOBS) >= _SCENE_JOB_MAX:
        oldest = min(_SCENE_CAPTURE_JOBS, key=lambda k: _SCENE_CAPTURE_JOBS[k][0])
        _SCENE_CAPTURE_JOBS.pop(oldest, None)
    _SCENE_CAPTURE_JOBS[job_id] = (now, payload)


@router.get("/internal/scene-capture-job/{job_id}")
def get_scene_capture_job(
    job_id: str,
    x_capture_secret: str | None = Header(default=None),
):
    """The scene payload for `/_capture?scene=1&job=<id>`."""
    _verify_capture_secret(x_capture_secret)
    entry = _SCENE_CAPTURE_JOBS.get(job_id)
    if not entry:
        raise HTTPException(status_code=404, detail="No such scene-capture job")
    ts, payload = entry
    if time.time() - ts > _SCENE_JOB_TTL_S:
        _SCENE_CAPTURE_JOBS.pop(job_id, None)
        raise HTTPException(status_code=404, detail="Scene-capture job expired")
    return payload


@router.get("/internal/ids")
def list_template_ids_for_capture(
    only_missing: bool = Query(False, description="Only templates without a preview image"),
    x_capture_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """List custom-template ids (+ owner) for the snapshot backfill."""
    _verify_capture_secret(x_capture_secret)
    q = db.query(CustomTemplate.id, CustomTemplate.user_id)
    if only_missing:
        q = q.filter(
            (CustomTemplate.preview_image_url.is_(None))
            | (CustomTemplate.preview_image_url == "")
        )
    return [{"id": tid, "user_id": uid} for tid, uid in q.all()]


@router.get("/internal/capture-data/{template_id}")
def get_template_capture_data(
    template_id: int,
    x_capture_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Return a template's render data (theme/codes/etc.) for capture.

    Same shape as the authenticated detail endpoint (reuses ``_serialize_template``),
    but keyed by the shared capture secret so the snapshot worker can render any
    user's template. Read-only.
    """
    _verify_capture_secret(x_capture_secret)
    tpl = (
        db.query(CustomTemplate)
        .options(joinedload(CustomTemplate.brand_kit))
        .filter(CustomTemplate.id == template_id)
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Custom template not found")
    return _serialize_template(tpl)


@router.post("/internal/preview-image/{template_id}")
async def store_template_preview_image(
    template_id: int,
    file: UploadFile = File(...),
    x_capture_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Upload a captured preview snapshot to R2 and set ``preview_image_url``."""
    from app.services import r2_storage

    _verify_capture_secret(x_capture_secret)
    tpl = db.query(CustomTemplate).filter(CustomTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Custom template not found")

    body = await file.read()
    if not body:
        raise HTTPException(status_code=400, detail="Empty image upload")

    ext = "webp" if (file.content_type or "").endswith("webp") else "png"
    content_type = file.content_type or ("image/webp" if ext == "webp" else "image/png")
    key = r2_storage.custom_template_preview_key(tpl.user_id, tpl.id, ext)
    url = r2_storage.upload_bytes(key, body, content_type=content_type)
    if not url:
        raise HTTPException(status_code=503, detail="R2 not configured")

    # Cache-bust: the R2 object key is stable, so replacing the image leaves the
    # URL unchanged and browsers/CDN keep serving the old bytes for the full
    # 7-day max-age. A version param makes each re-capture a distinct URL.
    versioned_url = f"{url}?v={int(time.time())}"

    tpl.preview_image_url = versioned_url
    db.commit()
    logger.info("Stored captured preview for template %d: %s", template_id, versioned_url)
    return {"preview_image_url": versioned_url}


@router.get("/{template_id}")
def get_custom_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single custom template by ID."""
    tpl = _get_user_template(template_id, user.id, db)
    my_rating, my_comment = _get_my_rating(template_id, user.id, db)
    return _serialize_template(tpl, my_rating=my_rating, my_rating_comment=my_comment)


@router.post("/{template_id}/rating", response_model=TemplateRatingOut)
def rate_custom_template(
    template_id: int,
    payload: TemplateRatingSubmit,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upsert the current user's 1-5 star rating for a custom template."""
    # Ownership / existence check (raises 404 if not the user's template).
    _get_user_template(template_id, user.id, db)

    rating = (
        db.query(TemplateRating)
        .filter(
            TemplateRating.user_id == user.id,
            TemplateRating.custom_template_id == template_id,
        )
        .first()
    )
    if rating is None:
        rating = TemplateRating(user_id=user.id, custom_template_id=template_id)
        db.add(rating)

    rating.rating = payload.rating
    rating.suggestion = payload.suggestion

    db.commit()
    db.refresh(rating)

    return TemplateRatingOut.model_validate(rating)


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

        # Mirror an explicit font choice into the blueprint's identity.
        #
        # The render path resolves headingFont as
        #     project.font_family or _first_renderable(
        #         blueprint.identity.heading_font, theme.fonts.heading
        #     ) or DEFAULT
        # (see remotion.write_remotion_data). identity is checked FIRST and is
        # always a valid registry id, so a font edited only in theme.fonts is
        # ALWAYS shadowed — the preview would change and the exported video
        # would not. Writing both keeps that precedence intact (so templates
        # nobody has edited are unaffected, which is why identity was put first)
        # while making a deliberate edit actually take effect.
        #
        # A project's own font_family still outranks both, which is the
        # "unless the project sets one itself" half of the requirement.
        _fonts = theme.get("fonts") or {}
        _heading = _fonts.get("heading")
        _body = _fonts.get("body")

        def _apply_fonts(bp: dict) -> bool:
            ident = bp.get("identity")
            if not isinstance(ident, dict):
                return False
            changed = False
            for _key, _val in (("heading_font", _heading), ("body_font", _body)):
                # Only registry ids: an unresolvable extractor string in
                # identity would reintroduce the silent system-sans fallback
                # that putting identity first was meant to prevent.
                if isinstance(_val, str) and _val in FONT_IDS and ident.get(_key) != _val:
                    ident[_key] = _val
                    changed = True
            return changed

        _update_blueprint(tpl, _apply_fonts)

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


def _persist_generated_variants(tpl: "CustomTemplate", variants: dict) -> None:
    """Write a generate_component_code() result onto a CustomTemplate row.

    Extracted from the two byte-identical blocks that used to live in
    _run_codegen_background and _run_regen_background — they had to be kept in
    lockstep by hand, and every new field doubled the chance of drift.
    Caller commits.
    """
    _default_ar = {"landscape": "16 / 9", "portrait": "9 / 16"}

    tpl.component_code = None
    tpl.intro_code = variants["intro_code"]
    tpl.outro_code = variants["outro_code"]
    tpl.content_codes = (
        json.dumps(variants["content_codes"]) if variants.get("content_codes") else None
    )
    tpl.content_archetype_ids = json.dumps(variants.get("archetype_ids", []))
    tpl.image_box_aspect_ratios = json.dumps({
        "intro": variants.get("intro_aspect_ratio") or _default_ar,
        "content": variants.get("content_aspect_ratios") or [],
        "outro": variants.get("outro_aspect_ratio") or _default_ar,
    })
    # Scenes that fell back to the deterministic stub (§R Layer 3). Cleared on a
    # clean run so a previously-warned template stops warning once regenerated.
    warnings = variants.get("generation_warnings") or []
    tpl.generation_warnings = json.dumps(warnings) if warnings else None
    # The design law this template was built from (P2). NULL when the blueprint
    # path is disabled, which keeps legacy behaviour intact.
    bp = variants.get("design_blueprint")
    tpl.design_blueprint = json.dumps(bp, ensure_ascii=False) if bp else None
    # Per-layout editable props (P3).
    #
    # `if schemas` alone was a truthiness test on the OUTER dict, which is always
    # truthy — so a run where every scene produced an empty field list stored
    # {"intro": [], "content": [[], []...], "outro": []} as if it were real data.
    # Downstream that is indistinguishable from a populated schema until the
    # scene editor renders no fields at all, with nothing logged anywhere.
    # Store NULL for that case, and say so, so it cannot pass unnoticed again.
    schemas = variants.get("layout_prop_schemas")
    if schemas and _any_prop_fields(schemas):
        tpl.layout_prop_schemas = json.dumps(schemas, ensure_ascii=False)
    else:
        if schemas:
            print(
                f"[F7-DEBUG] [PROP-SCHEMA] template {tpl.id}: every scene declared zero "
                "layout props — storing NULL. The scene editor will show no per-layout "
                "fields for this template."
            )
        tpl.layout_prop_schemas = None
    tpl.design_system = variants.get("design_system") or None
    # Per-scene sample copy, indexed exactly like image_box_aspect_ratios above.
    _samples = variants.get("scene_sample_content")
    tpl.scene_sample_content = (
        json.dumps(_samples, ensure_ascii=False) if _samples else None
    )
    # Per-scene default type sizes, computed from that copy and indexed the same.
    _fonts = variants.get("scene_font_defaults")
    tpl.scene_font_defaults = (
        json.dumps(_fonts, ensure_ascii=False) if _fonts else None
    )
    if warnings:
        print(f"[F7-DEBUG] [CODEGEN] {len(warnings)} generation warning(s): {warnings}")


def _design_version(tpl: "CustomTemplate") -> int:
    """Which generation drew this template's design (design_blueprint.version).

    1 for anything without a blueprint or with an unreadable one — the legacy
    behaviour, in which the built-in CTA overlay replaces the generated outro.
    """
    if not tpl.design_blueprint:
        return 1
    try:
        bp = json.loads(tpl.design_blueprint)
        if not isinstance(bp, dict):
            return 1
        return int(bp.get("version", 1) or 1)
    except (json.JSONDecodeError, TypeError, ValueError):
        return 1


def _image_modes_by_layout(tpl: "CustomTemplate") -> dict[str, str | None]:
    """Each layout's image mode, keyed intro / content_N / outro.

    "background" means the image fills the frame behind the type, so the render
    path lays a scrim over it or the copy is unreadable on a photograph; "half"
    puts the image beside the type, where a scrim would only mute the picture.

    Keyed by ROLE and content position — the same convention as
    image_box_aspect_ratios and layout_prop_schemas — so the project preview can
    look a scene's mode up by the variant that actually renders it. Empty for a
    template with no design blueprint; the preview then applies no scrim, which
    is the pre-existing behaviour.
    """
    if not tpl.design_blueprint:
        return {}
    try:
        bp = json.loads(tpl.design_blueprint)
    except (json.JSONDecodeError, TypeError):
        return {}
    scenes = bp.get("scenes") if isinstance(bp, dict) else None
    if not isinstance(scenes, list):
        return {}

    out: dict[str, str | None] = {}
    content_idx = 0
    for entry in scenes:
        if not isinstance(entry, dict):
            continue
        mode = entry.get("image_mode")
        mode = mode if mode in ("background", "half") else None
        role = entry.get("role")
        if role == "intro":
            out["intro"] = mode
        elif role == "outro":
            out["outro"] = mode
        else:
            out[f"content_{content_idx}"] = mode
            content_idx += 1
    return out


def _write_scene_indexed_field(
    tpl: "CustomTemplate", field: str, role: str, index: int, value
) -> None:
    """Write ONE scene's entry into a {intro, content[], outro} JSON column.

    Every per-scene column on a custom template shares this shape and this
    indexing convention — scene_sample_content, scene_font_defaults, and
    layout_prop_schemas all address `content` by the same index as
    `content_codes`. The padding loop matters: a sparse edit (regenerating
    content_4 on a template whose column is short) must grow the list rather
    than raise or silently write to the wrong slot.

    Extracted so that logic lives once. Caller commits.
    """
    raw = getattr(tpl, field, None)
    try:
        data = json.loads(raw) if raw else {}
    except (json.JSONDecodeError, TypeError):
        data = {}
    if not isinstance(data, dict):
        data = {}

    if role == "content":
        entries = list(data.get("content") or [])
        while len(entries) <= index:
            entries.append({})
        entries[index] = value
        data["content"] = entries
    else:
        data[role] = value

    setattr(tpl, field, json.dumps(data, ensure_ascii=False))


def _update_blueprint(tpl: "CustomTemplate", mutate) -> bool:
    """Read-modify-write the template's design_blueprint JSON. Caller commits.

    `mutate` receives the parsed blueprint dict and edits it in place; returning
    False from it aborts the write. Returns True when the column was rewritten.

    Everything that touches the blueprint goes through here because more than
    one code path now does (a font edit writes `identity`, a scene edit writes
    that scene's sample content). Two blind `json.dumps(...)` writers on the
    same column would silently clobber each other's field.

    Never CREATES a blueprint: a template generated before the design-doc stage
    has NULL here, and synthesising a partial one would make it look like a real
    design to every reader that checks for presence.
    """
    if not tpl.design_blueprint:
        return False
    try:
        bp = json.loads(tpl.design_blueprint)
    except (json.JSONDecodeError, TypeError):
        return False
    if not isinstance(bp, dict):
        return False
    if mutate(bp) is False:
        return False
    tpl.design_blueprint = json.dumps(bp, ensure_ascii=False)
    return True


def _any_prop_fields(schemas: dict) -> bool:
    """True when at least one scene in the schema bundle declares a layout prop.

    The bundle is {"intro": [...], "content": [[...], ...], "outro": [...]} — a
    mix of flat lists and a list of lists, so a plain any() over values would
    report a list-of-empty-lists as non-empty.
    """
    for role in ("intro", "outro"):
        if schemas.get(role):
            return True
    return any(fields for fields in (schemas.get("content") or []))


def _save_version(tpl: "CustomTemplate", label: str, db: "Session") -> int:
    """Snapshot the current code fields as a new TemplateVersion. Returns version id."""
    from app.models.template_version import TemplateVersion

    version = TemplateVersion(
        template_id=tpl.id,
        component_code=tpl.component_code,
        intro_code=tpl.intro_code,
        outro_code=tpl.outro_code,
        content_codes=tpl.content_codes,
        # Metadata that must travel WITH the code — see rollback_to_version.
        content_archetype_ids=tpl.content_archetype_ids,
        image_box_aspect_ratios=tpl.image_box_aspect_ratios,
        design_blueprint=tpl.design_blueprint,
        layout_prop_schemas=tpl.layout_prop_schemas,
        scene_sample_content=tpl.scene_sample_content,
        scene_font_defaults=tpl.scene_font_defaults,
        label=label,
    )
    db.add(version)
    db.flush()  # populate version.id
    tpl.current_version_id = version.id
    return version.id


# ─── In-memory code generation progress tracker ─────────────
# Same pattern as _pipeline_progress in pipeline.py
#
# This is a CACHE, not the source of truth: it is lost on restart, invisible to
# other workers, and was previously unsynchronised and unbounded. The durable
# record is the CustomTemplateGenRun row; get_generation_status reads that first
# and falls back to this for step-level detail while a tab stays open.
_codegen_progress: dict[int, dict] = {}
_codegen_progress_lock = threading.Lock()
# A run older than this is finished one way or another; its entry is dead weight.
_PROGRESS_TTL_S = 3600.0


def _set_progress(template_id: int, **fields) -> None:
    """Merge fields into a template's progress entry, evicting stale ones.

    Mutated from background threads and read from request handlers, so every
    write goes through the lock. Entries were never evicted before, so the dict
    grew for the life of the process.
    """
    now = time.time()
    with _codegen_progress_lock:
        entry = _codegen_progress.get(template_id) or {}
        entry.update(fields)
        entry["_touched"] = now
        _codegen_progress[template_id] = entry
        if len(_codegen_progress) > 32:
            for tid in [
                t
                for t, e in _codegen_progress.items()
                if now - (e.get("_touched") or 0) > _PROGRESS_TTL_S
            ]:
                _codegen_progress.pop(tid, None)


def _get_progress(template_id: int) -> dict | None:
    with _codegen_progress_lock:
        entry = _codegen_progress.get(template_id)
        return dict(entry) if entry else None


# ─── Staged generation runs ─────────────────────────────────
#
# A run row is written at each stage boundary and after every scene, so a crash
# during scene 7 of 9 keeps the blueprint and the six finished scenes instead of
# discarding the whole ~370s of work.


def _run_write(run_id: int | None, **fields) -> None:
    """Update one run row in its own short-lived session.

    Each write opens and closes its own connection, matching the pattern the
    long-running codegen path already uses — NeonDB drops an SSL link held open
    across a multi-minute LLM call.

    Never raises: persistence of progress must not be able to kill a generation.
    """
    if not run_id:
        return
    db = SessionLocal()
    try:
        run = db.query(CustomTemplateGenRun).filter(CustomTemplateGenRun.id == run_id).first()
        if not run:
            return
        for k, v in fields.items():
            setattr(run, k, v)
        run.updated_at = datetime.utcnow()
        db.commit()
    except Exception as e:  # noqa: BLE001
        print(f"[F7-DEBUG] [GEN-RUN] write failed for run {run_id}: {e}")
    finally:
        db.close()


def _run_create(template_id: int, user_id: int, kind: str) -> int | None:
    """Open a run and point the template at it. Returns the run id."""
    db = SessionLocal()
    try:
        run = CustomTemplateGenRun(
            template_id=template_id, user_id=user_id, kind=kind, stage="blueprint", status="running"
        )
        db.add(run)
        db.flush()
        run_id = run.id
        tpl = db.query(CustomTemplate).filter(CustomTemplate.id == template_id).first()
        if tpl:
            tpl.active_gen_run_id = run_id
        db.commit()
        return run_id
    except Exception as e:  # noqa: BLE001
        print(f"[F7-DEBUG] [GEN-RUN] create failed for template {template_id}: {e}")
        return None
    finally:
        db.close()


def _run_finish(run_id: int | None, template_id: int, *, status: str, error: str | None = None) -> None:
    """Close a run and clear the template's pointer."""
    if not run_id:
        return
    _run_write(
        run_id,
        status=status,
        stage="done" if status == "complete" else "failed",
        error=error,
    )
    db = SessionLocal()
    try:
        tpl = db.query(CustomTemplate).filter(CustomTemplate.id == template_id).first()
        if tpl and tpl.active_gen_run_id == run_id:
            tpl.active_gen_run_id = None
            db.commit()
    except Exception as e:  # noqa: BLE001
        print(f"[F7-DEBUG] [GEN-RUN] finish failed for run {run_id}: {e}")
    finally:
        db.close()


def _run_hooks(run_id: int | None, template_id: int):
    """The (on_plan_ready, on_scene_done, on_scene_count, on_verify_start) hooks
    for one staged run.

    on_plan_ready persists the blueprint and design system BEFORE the ~300s of
    scene work, so a later crash costs the scenes and not the 60-90s blueprint
    call as well. on_scene_done rewrites the scene_results slot list as each
    scene lands, which is what a resume reads. on_scene_count publishes the
    provisional scene total as soon as scene types are chosen, so the progress
    UI can show "Scenes 0/9" from the start of the run instead of only once the
    blueprint lands ~50s later.
    """
    scenes: dict[int, dict] = {}

    def on_scene_count(total: int) -> None:
        """Publish an early, provisional scene total.

        Writes the same scene_plan slot on_plan_ready uses (with no labels yet,
        which nothing reads before the plan exists) so the status endpoint —
        which sources scenes_total from the run row — reports it immediately.
        on_plan_ready overwrites this with the authoritative count.
        """
        if not total:
            return
        _run_write(run_id, scene_plan=json.dumps({"labels": [], "total": total}))
        _set_progress(template_id, scenes_total=total)

    def on_plan_ready(plan: dict) -> None:
        _run_write(
            run_id,
            stage="scenes",
            blueprint_json=json.dumps(plan.get("blueprint"), ensure_ascii=False)
            if plan.get("blueprint")
            else None,
            design_system=plan.get("design_system") or None,
            scene_plan=json.dumps(
                {
                    "labels": plan.get("scene_labels") or [],
                    "total": plan.get("total_scenes") or 0,
                },
                ensure_ascii=False,
            ),
        )
        # Also land them on the TEMPLATE row, not just the run row.
        #
        # design_blueprint and design_system are finished, immutable products of
        # stage A — nothing later in the run changes them. Holding them back
        # until _persist_generated_variants meant a run that died during scenes
        # threw away a blueprint that had succeeded 5 minutes earlier, and the
        # gallery could not show a template's real design while it generated.
        #
        # Only these two: the scene CODE columns stay end-only on purpose, since
        # a half-written set of scenes would be rendered as if complete.
        _bp = plan.get("blueprint")
        _ds = plan.get("design_system")
        if _bp or _ds:
            db = SessionLocal()
            try:
                tpl = (
                    db.query(CustomTemplate).filter(CustomTemplate.id == template_id).first()
                )
                if tpl:
                    if _bp:
                        tpl.design_blueprint = json.dumps(_bp, ensure_ascii=False)
                    if _ds:
                        tpl.design_system = _ds
                    db.commit()
            except Exception as e:  # noqa: BLE001
                print(f"[F7-DEBUG] [GEN-RUN] early blueprint persist failed: {e}")
            finally:
                db.close()

        _set_progress(template_id, step="generating_scenes", scenes_total=plan.get("total_scenes") or 0)

    def on_scene_done(result) -> None:
        scenes[result.index] = {
            "index": result.index,
            "code": result.code,
            "aspect_ratios": result.aspect_ratios,
            "prop_schema": result.prop_schema,
            "error": result.error,
            "attempts": result.attempts,
        }
        _run_write(
            run_id,
            scene_results=json.dumps(
                [scenes[k] for k in sorted(scenes)], ensure_ascii=False
            ),
        )
        _set_progress(template_id, scenes_done=len(scenes))

    def on_verify_start() -> None:
        """Every scene is generated; the validation + repair pass is starting.

        A distinct stage because it is a distinct wait — a failing scene is
        re-generated here up to MAX_SCENE_RETRIES times. Without it the UI sat on
        "Scenes" with the counter already reading N/N, which looks stalled.
        """
        _run_write(run_id, stage="examine")
        _set_progress(template_id, step="examine")

    return on_plan_ready, on_scene_done, on_scene_count, on_verify_start


def _run_codegen_background(template_id: int, user_id: int) -> None:
    """Run code generation in a background thread, updating _codegen_progress."""
    import asyncio as _asyncio
    from app.services.code_generator import generate_component_code

    loop = _asyncio.new_event_loop()
    _asyncio.set_event_loop(loop)

    run_id = _run_create(template_id, user_id, "initial")
    _on_plan, _on_scene, _on_count, _on_verify = _run_hooks(run_id, template_id)

    try:
        _set_progress(
            template_id,
            status="generating",
            step="design_system",
            running=True,
            error=None,
            run_id=run_id,
        )

        # Fetch template before the long LLM call, then close the connection
        # so NeonDB doesn't drop the SSL link during the ~370s codegen.
        _db_pre = SessionLocal()
        try:
            tpl = (
                _db_pre.query(CustomTemplate)
                .options(joinedload(CustomTemplate.brand_kit))
                .filter(CustomTemplate.id == template_id, CustomTemplate.user_id == user_id)
                .first()
            )
            if not tpl:
                _set_progress(
                    template_id,
                    status="error",
                    step="init",
                    running=False,
                    error="Template not found",
                )
                _run_finish(run_id, template_id, status="failed", error="Template not found")
                return
            # Detach from session so attributes remain accessible after close
            _db_pre.expunge_all()
        finally:
            _db_pre.close()

        t_start = time.time()
        _set_progress(template_id, step="generating_scenes")
        variants = loop.run_until_complete(
            generate_component_code(
                tpl,
                on_plan_ready=_on_plan,
                on_scene_done=_on_scene,
                on_scene_count=_on_count,
                on_verify_start=_on_verify,
            )
        )

        # Open a fresh connection to save — avoids SSL drop from long idle
        db = SessionLocal()
        try:
            tpl = (
                db.query(CustomTemplate)
                .filter(CustomTemplate.id == template_id, CustomTemplate.user_id == user_id)
                .first()
            )

            _persist_generated_variants(tpl, variants)
            print(f"[F7-DEBUG] [CODEGEN] Stored {len(variants.get('content_codes', []))} content archetypes: {variants.get('archetype_ids', [])}")

            _set_progress(template_id, step="saving")
            _run_write(run_id, stage="persist")
            _save_version(tpl, "Initial generation", db)
            db.commit()

            elapsed = time.time() - t_start
            print(f"[F7-DEBUG] [GENERATE-CODE] '{tpl.name}' completed in {elapsed:.1f}s (background)")

            _set_progress(
                template_id, status="complete", step="done", running=False, error=None
            )
            _run_finish(run_id, template_id, status="complete")

            # Render thumbnail
            try:
                _render_and_store_thumbnail(template_id, user_id)
            except Exception:
                pass

        finally:
            db.close()
    except Exception as e:
        print(f"[F7-DEBUG] [GENERATE-CODE] FAILED for template {template_id}: {e}")
        _set_progress(
            template_id, status="error", step="failed", running=False, error=str(e)
        )
        _run_finish(run_id, template_id, status="failed", error=str(e))
        # Persist failure state so frontend knows without time-based guessing,
        # and refund the slot charged at create time — a template that never
        # produced any code shouldn't consume one.
        #
        # Only refund ONCE per template: a retry (generate-code) reuses the
        # original charge rather than charging again, so refunding on every
        # failed attempt would hand out a free slot per retry. generation_failed
        # can't serve as the guard — the retry endpoint clears it before
        # relaunching — so track the refund separately.
        try:
            _db = SessionLocal()
            _tpl = _db.query(CustomTemplate).filter(CustomTemplate.id == template_id).first()
            if _tpl:
                _tpl.generation_failed = True
                if not _tpl.slot_refunded:
                    _tpl.slot_refunded = True
                    _refund_template_slot(_db, user_id)
            _db.commit()
            _db.close()
        except Exception:
            pass
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
    if not ((settings.CUSTOM_ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY or "").strip()):
        raise HTTPException(
            status_code=400,
            detail="CUSTOM_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY is required for AI template code generation.",
        )
    tpl = _get_user_template(template_id, user.id, db)

    # Check if already running
    progress = _codegen_progress.get(template_id, {})
    if progress.get("running"):
        return JSONResponse(
            status_code=202,
            content={"detail": "Code generation already in progress", "template_id": template_id},
        )

    # Clear any previous failure state before retrying. Always touch the row so
    # updated_at moves forward: the frontend treats a codeless template whose
    # updated_at is older than STUCK_GENERATION_MS as stalled, so without this a
    # retry would keep rendering the "Generation stalled" card instead of a
    # spinner (the original updated_at never changes on its own).
    tpl.generation_failed = False
    tpl.updated_at = datetime.utcnow()
    db.commit()

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

    # The DURABLE record is the run row; the in-memory dict is a cache that adds
    # step-level detail while a tab stays open. Reading the run first means a
    # server restart no longer loses scene-level progress.
    #
    # The four legacy keys (status/step/running/error) and the existing `step`
    # vocabulary are preserved exactly — the frontend poller reads them, and the
    # new fields are purely additive.
    progress = _get_progress(template_id) or {}
    progress.pop("_touched", None)

    tpl = _get_user_template(template_id, user.id, db)
    run = (
        db.query(CustomTemplateGenRun)
        .filter(CustomTemplateGenRun.id == tpl.active_gen_run_id)
        .first()
        if tpl.active_gen_run_id
        else None
    )
    if run:
        total = 0
        # `labels` distinguishes the two writers of this slot: on_scene_count
        # publishes a PROVISIONAL total ~8s in with no labels, and on_plan_ready
        # overwrites it with the authoritative count once the blueprint has
        # authored its own layouts — which can change the number (a seeded 6-8
        # content layouts, so 8-10 total). Surfacing which one this is lets the
        # UI avoid showing a count that then visibly changes.
        total_is_final = False
        try:
            _plan = json.loads(run.scene_plan or "{}")
            total = int(_plan.get("total") or 0)
            total_is_final = bool(_plan.get("labels"))
        except (ValueError, TypeError):
            pass
        done = 0
        try:
            done = len([s for s in json.loads(run.scene_results or "[]") if s.get("code")])
        except (ValueError, TypeError):
            pass
        return {
            "status": progress.get("status") or ("generating" if run.status == "running" else run.status),
            "step": progress.get("step") or run.stage,
            "running": run.status == "running",
            "error": run.error,
            "stage": run.stage,
            "run_id": run.id,
            "scenes_done": done,
            "scenes_total": total,
            "scenes_total_final": total_is_final,
        }

    # A FINISHED run is unreachable through tpl.active_gen_run_id, because
    # _run_finish clears that pointer as its last act. So by the time the run is
    # complete this function has no run row to read, and the in-memory progress
    # dict below is the only thing left — but nothing ever writes status="complete"
    # into it. Returning it verbatim therefore reported a payload with NO status
    # at all, forever, and the creator modal (which closes on status ==
    # "complete") polled until the tab was closed.
    #
    # The DB is the authority for the terminal state, so check it BEFORE falling
    # back to the progress cache. is_regenerating is checked first: during a
    # regeneration intro_code still holds the OLD code, so testing intro_code
    # first would report a running regen as already complete.
    if not tpl.is_regenerating and tpl.intro_code:
        return {
            "status": "complete",
            "step": "done",
            "running": False,
            "error": None,
            "stage": "done",
            # Keep the counter pinned at its final value rather than dropping to
            # 0/0 on the last poll, which read as progress going backwards.
            "scenes_done": progress.get("scenes_done") or 0,
            "scenes_total": progress.get("scenes_total") or 0,
            # A finished run's total IS the authoritative one — the blueprint
            # ran long ago. The rail hides the counter on a completed step
            # anyway, but reporting False here would be simply untrue.
            "scenes_total_final": True,
        }

    # Same reasoning for a FAILED first-time generation: the run row is
    # unreachable, intro_code was never written, and the leftover progress dict
    # would otherwise report an in-flight run forever.
    if not tpl.is_regenerating and tpl.generation_failed:
        return {
            "status": "error",
            "step": "failed",
            "running": False,
            "error": "Generation failed",
            "stage": "failed",
        }

    if progress:
        return progress

    # No run row and no in-memory progress (a template generated before staging,
    # or a run whose process died without closing it). is_regenerating is
    # DB-persisted so it still reports "running" here even though the process
    # that was tracking it in _codegen_progress is gone — the frontend keeps
    # polling instead of reading the stale pre-regeneration code as "done".
    if tpl.is_regenerating:
        return {"status": "generating", "step": "unknown", "running": True, "error": None}

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
        # Per-scene editable-prop schema, so the PREVIEW can fill each scene's
        # declared defaults the same way the render path does. Without it a
        # scene reading props.layoutProps.<key> shows an empty slot in the
        # preview while the MP4 renders the default — the two must agree.
        "layout_prop_schemas": (
            json.loads(tpl.layout_prop_schemas) if tpl.layout_prop_schemas else None
        ),
        # Which generation drew this template. The project player needs it to
        # decide who renders the ENDING: a v1 outro is replaced by the built-in
        # CTA overlay (it was built expecting that and draws no CTA of its own),
        # while a v2 outro composes the CTA itself and must render normally.
        # Mirrors GeneratedVideoData.templateDesignVersion so the preview and
        # the exported video agree. Defaults to 1, the pre-v2 behaviour.
        "design_version": _design_version(tpl),
        # Per-layout image mode, so the project preview can scrim a background
        # image exactly where the exported video does.
        "image_modes": _image_modes_by_layout(tpl),
        # Per-scene DEFAULT type sizes, so the project preview resolves the same
        # number the MP4 does.
        #
        # This endpoint is what the project player compiles a custom template
        # from, and it did not return these — so the preview fell through to the
        # literal baked into the generated code (`?? (isPortrait ? 52 : 76)`)
        # while services/remotion.py injected the STORED default into the render.
        # Preview and export disagreed about type size on every template that
        # has them, and the editor's "(default)" readout, computed from a third
        # source again, agreed with neither.
        "scene_font_defaults": (
            json.loads(tpl.scene_font_defaults) if tpl.scene_font_defaults else None
        ),
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


def _run_regen_background(template_id: int, user_id: int) -> None:
    """Run code regeneration in a background thread, mirroring
    _run_codegen_background — same _codegen_progress tracker (polled by
    /generation-status) plus the durable is_regenerating DB flag, which
    survives a page refresh/tab-switch (unlike the in-memory-only progress
    dict, which is still useful for step-level detail while the tab stays
    open, but can't answer "is this still running" after a fresh page load
    on its own).
    """
    import asyncio as _asyncio
    from app.services.code_generator import generate_component_code

    loop = _asyncio.new_event_loop()
    _asyncio.set_event_loop(loop)

    run_id = _run_create(template_id, user_id, "regenerate")
    _on_plan, _on_scene, _on_count, _on_verify = _run_hooks(run_id, template_id)

    try:
        _set_progress(
            template_id,
            status="generating",
            step="design_system",
            running=True,
            error=None,
            run_id=run_id,
        )

        _db_pre = SessionLocal()
        try:
            tpl = (
                _db_pre.query(CustomTemplate)
                .options(joinedload(CustomTemplate.brand_kit))
                .filter(CustomTemplate.id == template_id, CustomTemplate.user_id == user_id)
                .first()
            )
            if not tpl:
                _set_progress(
                    template_id,
                    status="error",
                    step="init",
                    running=False,
                    error="Template not found",
                )
                _run_finish(run_id, template_id, status="failed", error="Template not found")
                _refund_template_slot(_db_pre, user_id)
                _db_pre.commit()
                return
            # Snapshot current state before overwriting.
            _save_version(tpl, "Before regeneration", _db_pre)
            # _save_version sets tpl.current_version_id AFTER its own flush, so
            # that assignment is still pending here. The expunge below detaches
            # `tpl` before the commit, which would drop it — the version row was
            # created but the template kept pointing at the previous one. Flush
            # it explicitly while the instance is still attached.
            _db_pre.flush()
            # Detach BEFORE commit: commit() expires all attributes by default
            # (expire_on_commit=True), and an expired attribute on an already-
            # detached instance can't be refreshed — accessing tpl.brand_kit
            # inside generate_component_code() would then raise "not bound to
            # a Session". Expunging first just removes it from the identity
            # map; the flushed SQL from _save_version still commits normally.
            _db_pre.expunge_all()
            _db_pre.commit()
        finally:
            _db_pre.close()

        t_start = time.time()
        _set_progress(template_id, step="generating_scenes")
        # A single scene exhausting its own internal retries (see
        # generate_component_code) fails the whole batch — often a transient
        # LLM flake rather than a real problem with the brand/prompt. Retry
        # the entire regeneration once before surfacing an error, so the user
        # doesn't have to notice the failure and manually click Regenerate
        # again for what's usually a one-off hiccup.
        try:
            variants = loop.run_until_complete(
                generate_component_code(
                    tpl,
                    on_plan_ready=_on_plan,
                    on_scene_done=_on_scene,
                    on_scene_count=_on_count,
                    on_verify_start=_on_verify,
                )
            )
        except Exception as first_error:
            print(f"[F7-DEBUG] [REGEN-CODE] first attempt failed for template {template_id}, retrying once: {first_error}")
            _set_progress(template_id, step="retrying")
            # Reset the STAGE too, not just the step.
            #
            # By the time a first attempt fails, on_verify_start has already
            # advanced stage to "examine". The retry runs a whole fresh
            # generation (blueprint -> scenes -> examine, another 5-10 minutes),
            # but stage stayed at "examine" and the progress rail takes
            # max(stage, step) — so it sat pinned on "Verifying" for the entire
            # second attempt while the work quietly proceeded. That is the
            # "stuck on verify, completes in the background" report.
            _run_write(run_id, attempt=1, error=str(first_error), stage="blueprint")
            variants = loop.run_until_complete(
                generate_component_code(
                    tpl,
                    on_plan_ready=_on_plan,
                    on_scene_done=_on_scene,
                    on_scene_count=_on_count,
                    on_verify_start=_on_verify,
                )
            )

        db = SessionLocal()
        try:
            tpl = (
                db.query(CustomTemplate)
                .filter(CustomTemplate.id == template_id, CustomTemplate.user_id == user_id)
                .first()
            )

            _persist_generated_variants(tpl, variants)

            _set_progress(template_id, step="saving")
            _run_write(run_id, stage="persist")
            _save_version(tpl, "Regenerated", db)
            db.commit()

            elapsed = time.time() - t_start
            print(f"[F7-DEBUG] [REGEN-CODE] '{tpl.name}' completed in {elapsed:.1f}s (background)")

            # Mark the run finished BEFORE clearing is_regenerating.
            #
            # The template list poller treats is_regenerating as "still working"
            # and unmounts the progress card the moment it flips false — and
            # that card is the only live poller of the run. Clearing the flag
            # first meant a list poll landing in the gap tore the card down
            # before it ever observed status="complete", so its completion
            # handler never fired and the rail's last painted frame stuck.
            _set_progress(
                template_id, status="complete", step="done", running=False, error=None
            )
            _run_finish(run_id, template_id, status="complete")

            # Targeted UPDATE rather than `tpl.is_regenerating = False`.
            #
            # _run_finish just wrote active_gen_run_id on its OWN session, so the
            # ORM instance here is stale for that column; a plain attribute set
            # plus commit would flush this session's older value back over it.
            # Updating the single column by query touches nothing else.
            db.query(CustomTemplate).filter(
                CustomTemplate.id == template_id
            ).update({"is_regenerating": False}, synchronize_session=False)
            db.commit()

            try:
                _render_and_store_thumbnail(template_id, user_id)
            except Exception:
                pass
        finally:
            db.close()
    except Exception as e:
        print(f"[F7-DEBUG] [REGEN-CODE] FAILED for template {template_id}: {e}")
        _set_progress(
            template_id, status="error", step="failed", running=False, error=str(e)
        )
        _run_finish(run_id, template_id, status="failed", error=str(e))
        try:
            _db = SessionLocal()
            _tpl = _db.query(CustomTemplate).filter(CustomTemplate.id == template_id).first()
            if _tpl:
                _tpl.is_regenerating = False
                # regenerate-code resets slot_refunded to False when it charges,
                # so this refunds exactly the charge for THIS run.
                if not _tpl.slot_refunded:
                    _tpl.slot_refunded = True
                    _refund_template_slot(_db, user_id)
            _db.commit()
            _db.close()
        except Exception:
            pass
    finally:
        loop.close()


@router.post("/{template_id}/regenerate-code")
def regenerate_code(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Launch full code regeneration in the background. Returns 202 immediately.

    Costs one custom-template slot (a regeneration is a fresh AI design, same
    cost as creating one), charged up front and refunded by the background
    worker if generation fails. No daily AI rate limit. Old versions are kept
    for rollback via /versions.
    """
    if not ((settings.CUSTOM_ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY or "").strip()):
        raise HTTPException(
            status_code=400,
            detail="CUSTOM_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY is required for AI template code generation.",
        )
    tpl = _get_user_template(template_id, user.id, db)

    if not tpl.intro_code:
        raise HTTPException(status_code=400, detail="No code to regenerate — run generate-code first.")

    if tpl.is_regenerating:
        return JSONResponse(
            status_code=202,
            content={"detail": "Regeneration already in progress", "template_id": template_id},
        )

    # Charge before starting — raises 403 (custom_template_limit) when the user
    # is out of slots, so the frontend can show the upgrade modal. Refunded in
    # _run_regen_background if generation fails.
    _check_custom_template_quota(user)
    user.custom_templates_created = (user.custom_templates_created or 0) + 1
    db.add(user)

    tpl.is_regenerating = True
    # Fresh charge → fresh refund budget for this run.
    tpl.slot_refunded = False
    db.commit()

    thread = threading.Thread(
        target=_run_regen_background,
        args=(template_id, user.id),
        daemon=True,
    )
    thread.start()

    return JSONResponse(
        status_code=202,
        content={"detail": "Regeneration started", "template_id": template_id},
    )


# A run whose row has not been touched for this long is not running any more:
# the process died without closing it. Matches the frontend's own stall notion.
_RUN_STALL_S = 20 * 60


@router.post("/{template_id}/resume-generation")
def resume_generation(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restart a stalled run, keeping the work it already finished.

    The point of staging: a run that died at scene 7 of 9 has its blueprint and
    six scenes on the run row, so resuming regenerates three scenes rather than
    paying for the whole ~370s again. Free — it does not charge a slot, because
    the original run already did.
    """
    tpl = _get_user_template(template_id, user.id, db)
    run = (
        db.query(CustomTemplateGenRun)
        .filter(CustomTemplateGenRun.id == tpl.active_gen_run_id)
        .first()
        if tpl.active_gen_run_id
        else None
    )
    if not run or run.status != "running":
        raise HTTPException(status_code=400, detail="No generation run to resume.")

    age = (datetime.utcnow() - (run.updated_at or run.started_at)).total_seconds()
    if age < _RUN_STALL_S:
        return JSONResponse(
            status_code=202,
            content={
                "detail": "Generation is still running",
                "template_id": template_id,
                "run_id": run.id,
            },
        )

    done = 0
    try:
        done = len([s for s in json.loads(run.scene_results or "[]") if s.get("code")])
    except (ValueError, TypeError):
        pass
    print(
        f"[F7-DEBUG] [GEN-RUN] resuming run {run.id} for template {template_id} "
        f"— {done} scene(s) already done, stalled {age:.0f}s"
    )
    run.attempt = (run.attempt or 0) + 1
    run.stage = "scenes"
    db.commit()

    threading.Thread(
        target=_run_regen_background, args=(template_id, user.id), daemon=True
    ).start()
    return JSONResponse(
        status_code=202,
        content={
            "detail": "Generation resumed",
            "template_id": template_id,
            "run_id": run.id,
            "scenes_already_done": done,
        },
    )


def fail_orphaned_gen_runs() -> int:
    """Mark runs left 'running' by a dead process as failed.

    Called at startup. Without it a deploy mid-generation strands every affected
    template in a permanent "generating..." state, because the flag that says
    otherwise only ever gets cleared by the thread that died.
    """
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(seconds=_RUN_STALL_S)
        orphans = (
            db.query(CustomTemplateGenRun)
            .filter(
                CustomTemplateGenRun.status == "running",
                CustomTemplateGenRun.updated_at < cutoff,
            )
            .all()
        )
        for run in orphans:
            run.status = "failed"
            run.stage = "failed"
            run.error = run.error or "process ended before the run completed"
            tpl = (
                db.query(CustomTemplate)
                .filter(CustomTemplate.id == run.template_id)
                .first()
            )
            if tpl and tpl.active_gen_run_id == run.id:
                tpl.active_gen_run_id = None
                tpl.is_regenerating = False
        # Templates flagged regenerating with NO live run at all.
        #
        # The sweep above only reaches templates that have a run row, but a run
        # row is not guaranteed: _run_create returns None on a DB blip, and
        # templates that predate staging never had one. Either way the flag is
        # only ever cleared by the thread that set it, so a crash strands the
        # template in "Regenerating..." permanently — with no way back except a
        # manual DB edit. Sweep those too.
        stale = (
            db.query(CustomTemplate)
            .filter(
                CustomTemplate.is_regenerating.is_(True),
                CustomTemplate.active_gen_run_id.is_(None),
                CustomTemplate.updated_at < cutoff,
            )
            .all()
        )
        for tpl in stale:
            tpl.is_regenerating = False
        if orphans or stale:
            db.commit()
            print(
                f"[F7-DEBUG] [GEN-RUN] marked {len(orphans)} orphaned run(s) failed, "
                f"cleared {len(stale)} stranded regenerating flag(s)"
            )
        return len(orphans) + len(stale)
    except Exception as e:  # noqa: BLE001
        print(f"[F7-DEBUG] [GEN-RUN] orphan sweep failed: {e}")
        return 0
    finally:
        db.close()


@router.get("/{template_id}/versions")
def list_versions(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all saved versions for a template (newest first)."""
    from app.models.template_version import TemplateVersion

    tpl = _get_user_template(template_id, user.id, db)

    # Exclude pending scene-edit drafts: they hold a SINGLE scene's code, so
    # offering them as restorable versions would let a rollback wipe the other
    # scenes. Drafts are reached through the per-scene draft endpoints instead.
    versions = (
        db.query(TemplateVersion)
        .filter(
            TemplateVersion.template_id == tpl.id,
            TemplateVersion.is_draft.is_(False),
        )
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
    # A scene-edit draft holds only ONE scene's code, so restoring it wholesale
    # would blank the others. Drafts are applied via the per-scene apply
    # endpoint; they are never a rollback target.
    if version.is_draft or version.kind == "scene_edit":
        raise HTTPException(
            status_code=400,
            detail="This is a single-scene draft, not a full version. Apply it from the scene editor.",
        )

    # Snapshot current state before rollback (so users can undo the rollback)
    if tpl.intro_code:
        _save_version(tpl, "Before rollback", db)

    # Restore code from the target version
    tpl.component_code = None
    tpl.intro_code = version.intro_code
    tpl.outro_code = version.outro_code
    tpl.content_codes = version.content_codes

    # Restore the metadata that describes that code. Without this, a rollback
    # left content_archetype_ids / image_box_aspect_ratios pointing at a
    # DIFFERENT generation: content scenes matched to the wrong variants and the
    # image-adjust modal showed the wrong aspect ratio.
    #
    # NULL-guarded on purpose: versions created before these columns existed
    # have NULL here, and blindly assigning would ERASE the template's current
    # metadata. Skipping leaves it in place, which is the safe direction.
    for _field in (
        "content_archetype_ids",
        "image_box_aspect_ratios",
        "design_blueprint",
        "layout_prop_schemas",
        "scene_sample_content",
        "scene_font_defaults",
    ):
        _value = getattr(version, _field, None)
        if _value is not None:
            setattr(tpl, _field, _value)

    tpl.current_version_id = version.id

    db.commit()
    db.refresh(tpl)


    return _serialize_template(tpl)


# ─── Per-scene AI editing (P4) ────────────────────────────────
#
# State model: draft-on-the-version-table. The PUBLISHED scene lives on
# CustomTemplate; a DRAFT is a TemplateVersion row with kind="scene_edit",
# is_draft=True and scene_role set. That gives history, preview and
# finalize/discard from one table and reuses _save_version.
#
# Preview needs no new render infrastructure: the frontend compiles the draft
# with compileComponentCode, the same JIT path the template gallery already uses.

# edit_id -> progress. Same in-memory pattern (and same restart caveat) as
# _codegen_progress above.
_scene_edit_progress: dict[str, dict] = {}

# A scene edit costs one AI-edit credit, from the same pool as the project-side
# edits (see app.services.access).
#
# An earlier version of this file charged nothing, because "a scene that kept
# failing validation burned the user's daily allowance for nothing". That
# objection is answered here rather than avoided, by two rules:
#
#   1. A FALLBACK scene is free. If generation gave up and shipped a stub, the
#      bad scene is our output, and charging to fix it would bill the user for
#      our failure. See _scene_is_fallback.
#   2. A FAILED edit is refunded. The charge is taken when the edit starts and
#      returned by _run_scene_edit_background on any failure path, so a broken
#      generation still costs nothing.
#
# So the user only ever pays for an edit that ran on a scene we generated
# correctly. Concurrency is still bounded by the one-edit-per-scene guard in
# ai_edit_scene.
SCENE_AI_EDIT_CREDIT_COST = 1


def _refund_scene_edit(edit_id: str, user_id: int, cost: int) -> None:
    """Give back the credit taken for an edit that did not produce a draft.

    Idempotent via the `refunded` flag on the progress entry: the failure paths
    in _run_scene_edit_background must be safe to reach more than once, and a
    double refund would mint credits.

    LIMITATION — this only survives within the process. There is no durable job
    row for scene edits (unlike ProjectAddSceneJob), so the charge is recorded
    in the DB while the intent-to-refund lives only in `_scene_edit_progress`.
    A restart between the charge and the failure therefore keeps the credit.
    Fixing that properly means persisting the job; charging on APPLY instead of
    on start would avoid it entirely. Both are out of scope here.
    """
    if cost <= 0:
        return
    progress = _scene_edit_progress.get(edit_id)
    if progress is not None:
        if progress.get("refunded"):
            return
        # Set BEFORE the write, so a concurrent reader cannot start a second
        # refund while this one is in flight.
        progress["refunded"] = True
    _db = SessionLocal()
    try:
        _u = _db.query(User).filter(User.id == user_id).first()
        if _u:
            refund_ai_edit(_u, None, cost=cost)
            _db.commit()
    except Exception:
        # Never let a refund failure mask the original error the caller is
        # reporting — it is logged and the edit still surfaces as failed.
        logger.exception("Failed to refund scene-edit credit for user %s", user_id)
        if progress is not None:
            progress["refunded"] = False
    finally:
        _db.close()


class SceneAiEditRequest(BaseModel):
    """A scene edit, either user-directed or a clean rebuild.

    `prompt` is optional ONLY when from_blueprint is set: a rebuild has no
    instruction to follow, it re-derives the scene from the stored blueprint.
    Every other edit still requires one.
    """

    prompt: str = Field("", max_length=2000)
    keep_geometry: bool = False
    # Regenerate the scene from its blueprint layout instead of editing the
    # existing code. This is what the "regenerate" control on a fallback scene
    # calls: a stubbed scene's code is a generic placeholder, so seeding an edit
    # from it would carry that placeholder forward.
    from_blueprint: bool = False

    @model_validator(mode="after")
    def _require_prompt_unless_rebuilding(self) -> "SceneAiEditRequest":
        if not self.from_blueprint and len(self.prompt.strip()) < 3:
            raise ValueError("prompt must be at least 3 characters")
        return self


def _content_code_count(tpl: "CustomTemplate") -> int:
    try:
        return len(json.loads(tpl.content_codes) or []) if tpl.content_codes else 0
    except (json.JSONDecodeError, TypeError):
        return 0


def _scene_warning_index(tpl: "CustomTemplate", scene_key: str) -> int | None:
    """The generation-warning index for ``scene_key``, or None if unparseable.

    Warnings are authored as ``Scene {i} ({label}) ...`` in code_generator, where
    ``i`` is the position in the generated BATCH: index 0 is the intro, 1..N the
    content scenes, and the last is the outro. That prefix is the only link back
    to a scene, so this mapping is what both the warning-clearing and the
    fallback-detection paths depend on — hence one implementation, not two.
    """
    num_content = _content_code_count(tpl)
    if scene_key == "intro":
        return 0
    if scene_key == "outro":
        return num_content + 1
    m = re.match(r"^content_(\d+)$", scene_key or "")
    if not m:
        return None
    return int(m.group(1)) + 1  # +1: the intro occupies index 0


def _scene_is_fallback(tpl: "CustomTemplate", scene_key: str) -> bool:
    """Whether this scene shipped a STUB because generation failed validation.

    A stub scene has no flag of its own — the only persisted marker is the
    warning `code_generator` appends when it gives up on a scene and substitutes
    `_build_stub_scene_code` ("...uses a simplified fallback design"). So the
    presence of a warning addressed to this scene IS the fallback signal.

    Used to WAIVE the AI-edit charge: a stub is our bad output, and asking the
    user to spend a credit fixing it would be charging them for our failure.
    """
    if not tpl.generation_warnings:
        return False
    try:
        warnings = json.loads(tpl.generation_warnings) or []
    except (json.JSONDecodeError, TypeError):
        return False

    target = _scene_warning_index(tpl, scene_key)
    if target is None:
        return False
    prefix = f"Scene {target} ("
    return any(str(w).startswith(prefix) for w in warnings)


def _clear_scene_warning(tpl: "CustomTemplate", scene_key: str) -> None:
    """Drop the generation warning for ONE scene, once that scene is rewritten.

    Addressed by `_scene_warning_index` — see there for the index convention.

    Without this the banner was permanent: applying a draft rewrote the scene's
    code but left `generation_warnings` untouched, so a template kept reporting a
    "simplified fallback design" for a scene the user had already fixed.

    Only the warning for THIS scene is removed — a template with two bad scenes
    still warns about the other one.
    """
    if not tpl.generation_warnings:
        return
    try:
        warnings = json.loads(tpl.generation_warnings) or []
    except (json.JSONDecodeError, TypeError):
        return

    target = _scene_warning_index(tpl, scene_key)
    if target is None:
        return

    prefix = f"Scene {target} ("
    remaining = [w for w in warnings if not str(w).startswith(prefix)]
    if len(remaining) != len(warnings):
        tpl.generation_warnings = json.dumps(remaining) if remaining else None


def _run_scene_edit_background(
    edit_id: str, template_id: int, user_id: int, scene_key: str,
    prompt: str, keep_geometry: bool, from_blueprint: bool = False,
    cost: int = 0,
) -> None:
    """Regenerate one scene and store the result as a DRAFT version.

    ``cost`` is the credit already charged by ``ai_edit_scene``. Every path that
    ends without a usable draft refunds it — the user pays for a result, not for
    an attempt.
    """
    import asyncio as _asyncio

    from app.models.template_version import TemplateVersion
    from app.services.code_generator import regenerate_single_scene

    loop = _asyncio.new_event_loop()
    _asyncio.set_event_loop(loop)
    try:
        _scene_edit_progress[edit_id] = {
            "status": "generating", "step": "editing", "running": True,
            "error": None, "draft_version_id": None,
            "cost": cost, "refunded": False,
        }

        # Load and detach before the long LLM call so the connection is not held
        # open across it (same reason as _run_codegen_background).
        _db = SessionLocal()
        try:
            tpl = (
                _db.query(CustomTemplate)
                .options(joinedload(CustomTemplate.brand_kit))
                .filter(CustomTemplate.id == template_id, CustomTemplate.user_id == user_id)
                .first()
            )
            if not tpl:
                _scene_edit_progress[edit_id] = {
                    "status": "error", "step": "init", "running": False,
                    "error": "Template not found", "draft_version_id": None,
                    "cost": cost, "refunded": False,
                }
                _refund_scene_edit(edit_id, user_id, cost)
                return
            _db.expunge_all()
        finally:
            _db.close()

        result = loop.run_until_complete(
            regenerate_single_scene(
                tpl, scene_key, prompt, keep_geometry, from_blueprint=from_blueprint
            )
        )

        db = SessionLocal()
        try:
            # One draft per (template, scene): supersede any earlier one so the
            # user is never choosing between stale drafts.
            db.query(TemplateVersion).filter(
                TemplateVersion.template_id == template_id,
                TemplateVersion.kind == "scene_edit",
                TemplateVersion.is_draft.is_(True),
                TemplateVersion.scene_role == scene_key,
            ).delete(synchronize_session=False)

            draft = TemplateVersion(
                template_id=template_id,
                kind="scene_edit",
                scene_role=scene_key,
                is_draft=True,
                label=f"Draft: {prompt[:80]}",
                # Only the edited scene's code is stored; apply routes it to the
                # right field using scene_role.
                intro_code=result["code"] if result["role"] == "intro" else None,
                outro_code=result["code"] if result["role"] == "outro" else None,
                content_codes=(
                    json.dumps({
                        "index": result["content_index"],
                        "code": result["code"],
                        "aspect_ratio": result["aspect_ratio"],
                        "prop_schema": result["prop_schema"],
                        "sample_content": result.get("sample_content"),
                        "font_defaults": result.get("font_defaults"),
                    })
                    if result["role"] == "content"
                    else json.dumps({
                        "aspect_ratio": result["aspect_ratio"],
                        "prop_schema": result["prop_schema"],
                        "sample_content": result.get("sample_content"),
                        "font_defaults": result.get("font_defaults"),
                    })
                ),
            )
            db.add(draft)
            db.commit()
            db.refresh(draft)

            _scene_edit_progress[edit_id] = {
                "status": "complete", "step": "done", "running": False,
                "error": None, "draft_version_id": draft.id,
                # Kept so a later reader cannot mistake a charged-and-delivered
                # edit for an unrefunded one. Nothing refunds on success.
                "cost": cost, "refunded": False,
            }
        finally:
            db.close()

    except Exception as e:
        logger.exception("Scene edit failed for template %s scene %s", template_id, scene_key)
        from app.services.code_generator import SceneEditExhausted

        # What reaches the USER is plain language. str(e) on an exhausted edit is
        # a validator trace ("palette.text is used as BOTH a background and a
        # text colour") — a pipeline internal that was being rendered verbatim
        # into the UI. The trace stays in the log above, and on `detail` for
        # support; `error` is what the modal shows.
        exhausted = isinstance(e, SceneEditExhausted)
        # Rebuilt wholesale, so carry the refund bookkeeping across — otherwise
        # _refund_scene_edit would read a dict with no `refunded` key and could
        # pay out twice if this entry were revisited.
        _prev = _scene_edit_progress.get(edit_id) or {}
        _scene_edit_progress[edit_id] = {
            "status": "error",
            "step": "exhausted" if exhausted else "failed",
            "running": False,
            "error": (
                "Retry failed due to unforeseen issues. Please try again, and "
                "contact support if the issue persists."
                if exhausted
                else str(e)
            ),
            "detail": str(e),
            "exhausted": exhausted,
            "draft_version_id": None,
            "cost": cost,
            "refunded": bool(_prev.get("refunded")),
        }
        # The edit produced nothing usable, so it costs nothing.
        _refund_scene_edit(edit_id, user_id, cost)
    finally:
        loop.close()


@router.post("/{template_id}/scenes/{scene_key}/ai-edit", status_code=202)
def ai_edit_scene(
    template_id: int,
    scene_key: str,
    body: SceneAiEditRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start an AI edit of ONE scene. Returns 202 + an edit_id to poll.

    Costs SCENE_AI_EDIT_CREDIT_COST, unless the scene is a FALLBACK stub — see
    the note on that constant for both rules and why they are shaped this way.
    403 when the balance will not cover it. The charge is taken only after every
    other rejection, and refunded by the worker if the edit fails.

    Only one edit may run per scene at a time (409 otherwise).
    """
    from app.services.code_generator import parse_scene_key

    tpl = _get_user_template(template_id, user.id, db)
    if not tpl.intro_code:
        raise HTTPException(status_code=400, detail="Template has no generated code to edit")
    if tpl.is_regenerating or (_codegen_progress.get(template_id) or {}).get("running"):
        raise HTTPException(
            status_code=409, detail="This template is being regenerated — try again shortly."
        )

    try:
        parse_scene_key(scene_key, _content_code_count(tpl))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # One edit per scene at a time.
    #
    # There was no such check, so closing the modal (which loses the edit_id —
    # it lived only in a closure) and reopening let the user start a SECOND
    # thread for the same scene. Both write the same draft row, and
    # _run_scene_edit_background deletes any existing draft before inserting,
    # so the loser's work was silently discarded after paying for it.
    #
    # The edit_id is `{template_id}:{scene_key}:{ns}`, so a prefix scan finds a
    # live job without needing any new bookkeeping.
    _prefix = f"{template_id}:{scene_key}:"
    for _eid, _p in list(_scene_edit_progress.items()):
        if _eid.startswith(_prefix) and _p.get("running"):
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "This scene is already being regenerated.",
                    "edit_id": _eid,
                },
            )

    # Charge AFTER every rejection above, so a 404/409 never takes a credit.
    #
    # A fallback scene is free — see the note on SCENE_AI_EDIT_CREDIT_COST. The
    # template is single-owner (_get_user_template filters on user_id), so the
    # acting user IS the payer; there is no project and no collaborator case.
    cost = 0 if _scene_is_fallback(tpl, scene_key) else SCENE_AI_EDIT_CREDIT_COST
    if cost:
        if not can_use_ai_edit(user, None, cost=cost):
            raise HTTPException(
                status_code=403,
                detail=(
                    "You don't have enough AI edit credits to edit this scene. "
                    "Upgrade your plan or buy more credits to continue."
                ),
            )
        consume_ai_edit(user, None, cost=cost)
        db.commit()

    edit_id = f"{template_id}:{scene_key}:{time.time_ns()}"
    _scene_edit_progress[edit_id] = {
        "status": "queued", "step": "queued", "running": True,
        "error": None, "draft_version_id": None,
        # What was charged, so the worker knows what to give back, and whether
        # it already has. See _refund_scene_edit.
        "cost": cost, "refunded": False,
    }
    threading.Thread(
        target=_run_scene_edit_background,
        args=(
            edit_id, template_id, user.id, scene_key,
            body.prompt, body.keep_geometry, body.from_blueprint, cost,
        ),
        daemon=True,
    ).start()

    return {"edit_id": edit_id, "template_id": template_id, "scene_key": scene_key}


@router.get("/{template_id}/scenes/{scene_key}/ai-edit/status")
def get_scene_edit_status(
    template_id: int,
    scene_key: str,
    edit_id: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll a scene edit. Same shape as get_generation_status.

    `edit_id` is OPTIONAL. Without one, the newest live job for this
    template+scene is resolved instead — which is what lets a reopened modal
    re-attach to a retry it started before it was closed. The id used to live
    only in a closure, so closing the modal orphaned the job: the spinner reset
    and a duplicate could be started.
    """
    _get_user_template(template_id, user.id, db)
    if not edit_id:
        _prefix = f"{template_id}:{scene_key}:"
        # Keys carry a ns timestamp, so the lexicographically greatest matching
        # key is the most recent job.
        _live = sorted(
            (k for k, v in _scene_edit_progress.items()
             if k.startswith(_prefix) and v.get("running")),
        )
        edit_id = _live[-1] if _live else ""
    progress = _scene_edit_progress.get(edit_id) if edit_id else None
    if not progress:
        # Lost to a restart, or already consumed — fall back to whether a draft
        # exists rather than reporting a spurious failure.
        from app.models.template_version import TemplateVersion

        draft = (
            db.query(TemplateVersion)
            .filter(
                TemplateVersion.template_id == template_id,
                TemplateVersion.kind == "scene_edit",
                TemplateVersion.is_draft.is_(True),
                TemplateVersion.scene_role == scene_key,
            )
            .first()
        )
        if draft:
            return {
                "status": "complete", "step": "done", "running": False,
                "error": None, "draft_version_id": draft.id,
            }
        return {
            "status": "unknown", "step": "unknown", "running": False,
            "error": None, "draft_version_id": None,
        }
    # Echo the id back: a client that polled WITHOUT one (re-attaching after the
    # modal was closed) needs it to keep polling the same job.
    return {**progress, "edit_id": edit_id}


def _draft_payload(draft) -> dict:
    """Unpack a scene-edit draft row into code + metadata."""
    meta: dict = {}
    if draft.content_codes:
        try:
            meta = json.loads(draft.content_codes) or {}
        except (json.JSONDecodeError, TypeError):
            meta = {}
    code = draft.intro_code or draft.outro_code or meta.get("code") or ""
    return {
        "version_id": draft.id,
        "scene_key": draft.scene_role,
        "label": draft.label,
        "code": code,
        "aspect_ratio": meta.get("aspect_ratio"),
        "prop_schema": meta.get("prop_schema") or [],
        "sample_content": meta.get("sample_content") or None,
        "font_defaults": meta.get("font_defaults") or None,
        "created_at": _utc_iso(draft.created_at),
    }


def _get_draft_or_404(db: Session, template_id: int, scene_key: str):
    from app.models.template_version import TemplateVersion

    draft = (
        db.query(TemplateVersion)
        .filter(
            TemplateVersion.template_id == template_id,
            TemplateVersion.kind == "scene_edit",
            TemplateVersion.is_draft.is_(True),
            TemplateVersion.scene_role == scene_key,
        )
        .order_by(TemplateVersion.created_at.desc())
        .first()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="No draft for this scene")
    return draft


@router.get("/{template_id}/scenes/{scene_key}/draft")
def get_scene_draft(
    template_id: int,
    scene_key: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The pending draft for a scene, for side-by-side preview before applying."""
    _get_user_template(template_id, user.id, db)
    return _draft_payload(_get_draft_or_404(db, template_id, scene_key))


@router.get("/{template_id}/scene-drafts")
def list_scene_drafts(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Which scenes have a pending draft, and which are mid-regeneration.

    The editor needs this for EVERY scene the moment it opens, to put a status
    dot on each row in the scene list. Asking `/scenes/{key}/draft` once per
    scene would be N requests that mostly 404, so this answers for the whole
    template in one.

    `running` comes from the in-process progress dict, so it is empty after a
    restart. That degrades correctly: a job lost to a restart still leaves its
    draft row behind once it finishes, so `drafts` keeps driving the dot — the
    same fallback `get_scene_edit_status` already makes for a single scene.
    """
    from app.models.template_version import TemplateVersion

    _get_user_template(template_id, user.id, db)

    drafts = [
        row[0]
        for row in db.query(TemplateVersion.scene_role)
        .filter(
            TemplateVersion.template_id == template_id,
            TemplateVersion.kind == "scene_edit",
            TemplateVersion.is_draft.is_(True),
            TemplateVersion.scene_role.isnot(None),
        )
        .distinct()
        .all()
    ]

    # edit_id is "{template_id}:{scene_key}:{ns}", so the scene key is field 1.
    prefix = f"{template_id}:"
    running = sorted(
        {
            key.split(":")[1]
            for key, prog in list(_scene_edit_progress.items())
            if key.startswith(prefix) and prog.get("running") and ":" in key[len(prefix):]
        }
    )

    return {"drafts": sorted(drafts), "running": running}


@router.post("/{template_id}/scenes/{scene_key}/draft/apply")
def apply_scene_draft(
    template_id: int,
    scene_key: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Publish a draft: snapshot the current state, then write the scene."""
    from app.services.code_generator import parse_scene_key

    tpl = _get_user_template(template_id, user.id, db)
    draft = _get_draft_or_404(db, template_id, scene_key)
    payload = _draft_payload(draft)
    if not payload["code"]:
        raise HTTPException(status_code=422, detail="Draft has no code")

    role, index = parse_scene_key(scene_key, _content_code_count(tpl))

    # Undo point for the apply itself.
    _save_version(tpl, f"Before AI edit: {scene_key}", db)

    if role == "intro":
        tpl.intro_code = payload["code"]
    elif role == "outro":
        tpl.outro_code = payload["code"]
    else:
        codes = json.loads(tpl.content_codes) if tpl.content_codes else []
        codes[index] = payload["code"]
        tpl.content_codes = json.dumps(codes)

    # Keep the per-scene metadata consistent with the code it describes.
    if payload["aspect_ratio"]:
        ars = json.loads(tpl.image_box_aspect_ratios) if tpl.image_box_aspect_ratios else {}
        if role == "content":
            content_ars = list(ars.get("content") or [])
            while len(content_ars) <= index:
                content_ars.append({"landscape": "16 / 9", "portrait": "9 / 16"})
            content_ars[index] = payload["aspect_ratio"]
            ars["content"] = content_ars
        else:
            ars[role] = payload["aspect_ratio"]
        tpl.image_box_aspect_ratios = json.dumps(ars)

    schemas = json.loads(tpl.layout_prop_schemas) if tpl.layout_prop_schemas else {}
    if role == "content":
        content_schemas = list(schemas.get("content") or [])
        while len(content_schemas) <= index:
            content_schemas.append([])
        content_schemas[index] = payload["prop_schema"]
        schemas["content"] = content_schemas
    else:
        schemas[role] = payload["prop_schema"]
    tpl.layout_prop_schemas = json.dumps(schemas)

    # Same for the scene's showcase copy: an edit can change what the scene
    # renders, so its sample must travel with the code it describes. Only THIS
    # scene's entry is touched — its siblings keep the copy they were generated
    # with, which is what makes a single-scene edit a single-scene write.
    if payload.get("sample_content"):
        _write_scene_indexed_field(
            tpl, "scene_sample_content", role, index, payload["sample_content"]
        )
    # The type sizes are computed FROM that copy, so they must be rewritten with
    # it — a longer rewrite of one scene needs smaller type, and leaving the old
    # sizes would overflow the block the new copy fills.
    if payload.get("font_defaults"):
        _write_scene_indexed_field(
            tpl, "scene_font_defaults", role, index, payload["font_defaults"]
        )

    # This scene has just been rewritten, so whatever was wrong with the
    # generated version no longer describes what is stored.
    _clear_scene_warning(tpl, scene_key)

    draft.is_draft = False
    draft.label = f"AI edit: {scene_key}"
    db.commit()
    db.refresh(tpl)

    # The gallery thumbnail is a screenshot of the template's FIRST scene, so
    # only an intro edit can change it. This used to re-capture after EVERY
    # apply, which meant editing content_5 paid a full puppeteer round trip
    # (browser launch + page load, up to the worker's 180s timeout) to re-shoot
    # a frame that had not changed.
    #
    # It also ran INLINE, holding the request open for the whole capture. As a
    # background task the apply returns as soon as the scene is written. A
    # failed snapshot must never fail an apply — the scene is already committed
    # above, and _render_and_store_thumbnail swallows its own exceptions and
    # opens its own session.
    if role == "intro":
        background_tasks.add_task(_render_and_store_thumbnail, template_id, user.id)

    return _serialize_template(tpl)


class SceneFontDefaultsRequest(BaseModel):
    """Per-orientation type sizes for ONE scene. Omitted keys are left alone."""

    title: dict | None = None
    description: dict | None = None


@router.patch("/{template_id}/scenes/{scene_key}/font-defaults")
def set_scene_font_defaults(
    template_id: int,
    scene_key: str,
    body: SceneFontDefaultsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set one scene's DEFAULT type sizes.

    A dedicated route rather than a field on PUT /custom-templates/{id}: that
    request carries template-level identity (name, theme), and folding per-scene
    indexed data into it would round-trip the whole array on every rename, with
    a chance of clobbering it.

    Values are CLAMPED rather than rejected — a slider that refuses to move is
    worse than one that stops at the edge.

    Clamped to the USER bands, not the generation bands. This route backs the
    template editor's per-scene sliders, so its input is a size a PERSON chose
    while looking at the frame; the generation bands bound what the MODEL may
    bake into code, which is checked at generation time. Clamping a deliberate
    140px title back to the generator's 88px ceiling is what made the slider
    look broken.
    """
    from app.services.code_generator import _USER_BANDS
    from app.services.code_generator import parse_scene_key

    tpl = _get_user_template(template_id, user.id, db)
    try:
        role, index = parse_scene_key(scene_key, _content_code_count(tpl))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Start from what is stored so a partial update (one orientation, one axis)
    # does not blank the rest.
    try:
        current = json.loads(tpl.scene_font_defaults) if tpl.scene_font_defaults else {}
    except (json.JSONDecodeError, TypeError):
        current = {}
    if role == "content":
        entry = (current.get("content") or [])
        entry = entry[index] if index < len(entry) else {}
    else:
        entry = current.get(role) or {}
    if not isinstance(entry, dict):
        entry = {}
    merged = {k: dict(v) for k, v in entry.items() if isinstance(v, dict)}

    for prop, incoming in (("title", body.title), ("description", body.description)):
        if not isinstance(incoming, dict):
            continue
        slot = merged.setdefault(prop, {})
        for orientation in ("landscape", "portrait"):
            raw = incoming.get(orientation)
            if raw is None:
                continue
            try:
                value = int(raw)
            except (TypeError, ValueError):
                continue
            lo, hi = _USER_BANDS[prop][orientation]
            slot[orientation] = max(lo, min(hi, value))

    if not merged:
        raise HTTPException(status_code=422, detail="No usable font sizes supplied")

    _write_scene_indexed_field(tpl, "scene_font_defaults", role, index, merged)
    db.commit()
    db.refresh(tpl)
    return _serialize_template(tpl)


@router.post("/{template_id}/scenes/{scene_key}/draft/discard")
def discard_scene_draft(
    template_id: int,
    scene_key: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Throw away a pending draft, leaving the published scene untouched."""
    _get_user_template(template_id, user.id, db)
    draft = _get_draft_or_404(db, template_id, scene_key)
    db.delete(draft)
    db.commit()
    return {"detail": "Draft discarded"}
