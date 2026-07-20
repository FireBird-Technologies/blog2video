import asyncio
import base64
import json
import logging
import os
import shutil
import time
import requests
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, inspect, text, update, or_
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.auth import get_current_user
from app.config import settings
from app.models.user import User, PlanTier
from app.models.project import Project, ProjectStatus
from app.models.review import Review
from app.models.scene import Scene
from app.models.project_template_change_job import ProjectTemplateChangeJob
from app.models.project_regenerate_script_job import ProjectRegenerateScriptJob
from app.models.project_voice_change_job import ProjectVoiceChangeJob
from app.models.project_language_change_job import ProjectLanguageChangeJob
from app.services import stall_recovery
from app.services.stall_recovery import STALL_RETRY_MESSAGE
from app.models.crafted_template import CraftedTemplate
from app.models.crafted_template_entitlement import CraftedTemplateEntitlement
from app.models.custom_template import CustomTemplate
from app.schemas.schemas import (
    ProjectCreate, ProjectOut, ProjectListOut, ProjectLogoUpdate,
    BulkProjectItem, BulkCreateResponse,
    ReviewOut, ReviewStateOut, ReviewSubmit, ReviewSubmitResponse, SceneOut,
    SceneUpdate, ReorderScenesRequest, RegenerateSceneRequest,
    SceneTypographyBulkUpdate, ProjectUpdate, ProjectTemplateChangeRequest,
    ProjectTemplateChangeJobOut, ProjectVoiceChange, ProjectLanguageChange,
    ProjectRegenerateScriptJobOut,
    RegenerateScriptPreviewOut, RegenerateScriptPreviewScene,
)
from app.services import r2_storage
from app.services.remotion import (
    safe_remove_workspace,
    get_workspace_dir,
    cancel_running_render,
    render_still,
    write_remotion_data,
)
from app.services.doc_extractor import extract_from_documents
from app.services.email import email_service, EmailServiceError
from app.services.project_cleanup import (
    remove_failed_generation_project,
    PUBLIC_MSG_PIPELINE_FAILED,
)
from app.services.template_service import (
    validate_template_id,
    get_preview_colors,
    get_valid_layouts,
    get_hero_layout,
    get_layouts_without_image,
    is_custom_template,
    is_crafted_template,
    _load_custom_template_data,
    get_meta,
)
from app.services.crafted_template_service import validate_crafted_template_access
from app.services.crafted_template_service import is_crafted_templates_enabled
from app.services.edit_tracker import track_project_edit, track_scene_edit
from app.services.language_detection import normalize_preferred_language_code
from app.services.social_content_signals import detect_social_platforms_in_text
from app.scene_cta import strip_b2v_cta_from_visual
from app.observability.logging import get_logger

router = APIRouter(prefix="/api/projects", tags=["projects"])
logger = get_logger(__name__)


import threading as _threading

# URL → (expires_at_epoch, is_reachable). Avoids HEAD-ing the same brand-logo
# URL on every project serialization (_inject_custom_theme runs on every GET).
_BRAND_LOGO_URL_CHECK_TTL_S = 3600.0
_brand_logo_url_check: dict[str, tuple[float, bool]] = {}
_brand_logo_url_check_lock = _threading.Lock()


def _is_brand_logo_url_reachable(url: str) -> bool:
    """HEAD-check a brand-kit logo URL, cached for 1 hour.
    Falls back to a single-byte GET when servers reject HEAD (403/405/501).
    """
    if not url or not url.startswith(("http://", "https://")):
        return False
    now = time.time()
    with _brand_logo_url_check_lock:
        cached = _brand_logo_url_check.get(url)
        if cached and cached[0] > now:
            return cached[1]
    ok = False
    try:
        resp = requests.head(url, timeout=3, allow_redirects=True)
        ok = resp.status_code < 400
        if not ok and resp.status_code in (403, 405, 501):
            resp = requests.get(
                url, timeout=3, stream=True,
                headers={"Range": "bytes=0-0"},
            )
            ok = resp.status_code < 400
    except Exception:
        ok = False
    with _brand_logo_url_check_lock:
        _brand_logo_url_check[url] = (now + _BRAND_LOGO_URL_CHECK_TTL_S, ok)
    return ok


def _pick_reachable_brand_logo_url(logos: list) -> str | None:
    """Return the first brand-kit logo URL that is actually reachable, else None."""
    for entry in logos or []:
        url = (
            entry.get("url", "") if isinstance(entry, dict)
            else (entry if isinstance(entry, str) else "")
        )
        if url and _is_brand_logo_url_reachable(url):
            return url
    return None


def _seed_project_logo_from_brand_kit(project: Project, db: Session) -> None:
    """On creation of a custom-template project, copy the scraped brand-kit logo
    into the project's own (editable/removable) logo fields, so the Logo section
    in the editor starts pre-filled instead of empty.

    Scraped logo URLs point at the source website (or are inline data: URIs), so
    they're downloaded and re-hosted on R2 here rather than stored as-is — the
    source site could change or remove the asset later. Silently no-ops if R2
    isn't configured, no scraped logo is reachable, or the download fails; the
    user can still upload a logo manually afterward.
    """
    if project.logo_r2_url or not is_custom_template(project.template):
        return
    if not r2_storage.is_r2_configured():
        return
    data = _load_custom_template_data(project.template, db=db, user_id=project.user_id)
    bk = data.get("brand_kit") if data else None
    logo_url = _pick_reachable_brand_logo_url(bk.get("logos") or []) if bk else None
    if not logo_url:
        return
    try:
        if logo_url.startswith("data:"):
            header, b64_data = logo_url.split(",", 1)
            content_type = header.split(";")[0].removeprefix("data:") or "image/svg+xml"
            file_bytes = base64.b64decode(b64_data)
        else:
            resp = requests.get(logo_url, timeout=5)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "image/png").split(";")[0].strip()
            file_bytes = resp.content
        ext = (content_type.split("/")[-1] or "png").split("+")[0]
        if ext not in ("png", "jpeg", "jpg", "webp", "svg"):
            ext = "png"
        logo_filename = f"logo.{ext}"
        r2_key = r2_storage.image_key(project.user_id, project.id, logo_filename)
        r2_url = r2_storage.upload_bytes(r2_key, file_bytes, content_type=content_type)
        project.logo_r2_key = r2_key
        project.logo_r2_url = r2_url
    except Exception as e:
        logger.warning(
            "[PROJECTS] Brand-kit logo seed failed for project %s: %s",
            project.id, e, extra={"project_id": project.id, "user_id": project.user_id},
        )


def _inject_custom_theme(project: Project, db: Session | None = None) -> Project:
    """Attach custom_theme to a project so ProjectOut serialization includes it."""
    if is_custom_template(project.template) or is_crafted_template(project.template):
        data = _load_custom_template_data(project.template, db=db, user_id=project.user_id)
        project.custom_theme = data["theme"] if data else None
        project.custom_image_box_aspect_ratios = (
            data.get("image_box_aspect_ratios") if data else None
        )
        project.custom_template_missing = data is None
        # Expose BrandKit logo URL so the frontend preview can show it.
        # Skip entries that don't actually resolve — a scraped /favicon.ico
        # fallback often 404s on SPAs, and serving a broken URL to the
        # frontend just renders a broken-image icon in the preview.
        brand_logo_url = None
        if data:
            bk = data.get("brand_kit")
            if bk:
                brand_logo_url = _pick_reachable_brand_logo_url(bk.get("logos") or [])
        project.brand_logo_url = brand_logo_url or None
    else:
        project.custom_theme = None
        project.custom_image_box_aspect_ratios = None
        project.custom_template_missing = False
        project.brand_logo_url = None
    return project


def _is_preview_ready(project: Project) -> bool:
    return project.status in (ProjectStatus.GENERATED, ProjectStatus.DONE)


def _get_project_sequence(project: Project, user: User, db: Session) -> int:
    earlier_projects = (
        db.query(func.count(Project.id))
        .filter(
            Project.user_id == user.id,
            (
                (Project.created_at < project.created_at)
                | ((Project.created_at == project.created_at) & (Project.id < project.id))
            ),
        )
        .scalar()
        or 0
    )
    return int(earlier_projects) + 1


def _build_review_state(project: Project, user: User, db: Session) -> ReviewStateOut:
    has_review_for_project = (
        db.query(Review.id)
        .filter(Review.user_id == user.id, Review.project_id == project.id)
        .first()
        is not None
    )
    project_sequence = _get_project_sequence(project, user, db)

    return ReviewStateOut(
        project_sequence=project_sequence,
        has_review_for_project=has_review_for_project,
        should_show_inline=bool(
            _is_preview_ready(project)
            and not has_review_for_project
            and project_sequence > 1
        ),
    )


def _prepare_project_response(project: Project, user: User, db: Session) -> Project:
    from app.models.user import PlanTier
    _inject_custom_theme(project)
    project.review_state = _build_review_state(project, user, db)
    project.is_shared = _project_is_shared(project, db)
    # Expose the OWNER's paid-plan status so a collaborator gates Pro-only features
    # (custom/crafted templates, paid voices) on the owner's plan — the owner pays.
    # Also expose the owner's display name so a collaborator's settings pop-ups can
    # attribute the owner's templates/voices to them.
    owner = db.query(User).filter(User.id == project.user_id).first()
    project.owner_is_pro = bool(owner and owner.plan in (PlanTier.STANDARD, PlanTier.PRO))
    # Owner's per-user AI-edit credit pool — a FREE collaborator draws from it once
    # the free per-project allowance is spent, so the UI needs the owner's balance.
    project.owner_ai_edit_credits = (owner.ai_edit_credits or 0) if owner else 0
    project.owner_name = owner.name if owner else None
    return project


def _project_is_shared(project: Project, db: Session) -> bool:
    """True when the project has ≥1 member other than the owner.

    Counts any invited member regardless of status (pending or accepted), excluding
    the owner's own OWNER membership row, so the comment affordance appears as soon
    as someone is invited.
    """
    from app.models.project_member import ProjectMember, MemberRole, MemberStatus
    return (
        db.query(ProjectMember.id)
        .filter(
            ProjectMember.project_id == project.id,
            ProjectMember.role != MemberRole.OWNER,
            ProjectMember.status != MemberStatus.REVOKED,
        )
        .first()
        is not None
    )

# ─── Constants ────────────────────────────────────────────
_MAX_UPLOAD_FILES = 5
_MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
_ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",   # .docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
    "text/plain",  # .txt
    "text/markdown",  # .md
    "text/x-markdown",  # .md
    "text/vtt",  # .vtt (WebVTT captions/transcripts)
}
_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".md", ".markdown", ".txt", ".vtt"}
_VALID_VIDEO_STYLES = {"auto", "explainer", "promotional", "storytelling"}
_VALID_VIDEO_LENGTHS = {"auto", "short", "medium", "detailed", "mdetailed"}
_MIN_PLAYBACK_SPEED = 0.5
_MAX_PLAYBACK_SPEED = 2.5
_ACTIVE_TEMPLATE_CHANGE_STATUSES = {"queued", "running"}


@router.get("/template-availability")
def get_template_availability_signal(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lightweight signal for new-project UI.
    Returns whether this user has custom and/or crafted templates available,
    without loading full template payloads.
    """
    has_custom_templates = (
        db.query(CustomTemplate.id)
        .filter(CustomTemplate.user_id == user.id)
        .first()
        is not None
    )

    has_crafted_templates = False
    if is_crafted_templates_enabled():
        now = datetime.utcnow()
        has_crafted_templates = (
            db.query(CraftedTemplateEntitlement.id)
            .join(
                CraftedTemplate,
                CraftedTemplateEntitlement.crafted_template_id == CraftedTemplate.id,
            )
            .filter(
                CraftedTemplate.status == "active",
                CraftedTemplateEntitlement.user_id == user.id,
                CraftedTemplateEntitlement.status == "active",
                (CraftedTemplateEntitlement.starts_at.is_(None) | (CraftedTemplateEntitlement.starts_at <= now)),
                (CraftedTemplateEntitlement.expires_at.is_(None) | (CraftedTemplateEntitlement.expires_at >= now)),
            )
            .first()
            is not None
        )

    return {
        "has_custom_templates": has_custom_templates,
        "has_crafted_templates": has_crafted_templates,
    }


def _sanitize_descriptor_for_data_viz(descriptor: dict | None) -> dict:
    from app.services.chart_planner import sanitize_chart_descriptor

    return sanitize_chart_descriptor(descriptor)


def _normalize_video_style(video_style: str | None) -> str:
    """Normalize and validate video style.

    Accepts "auto" — the pipeline resolves it to explainer/promotional/storytelling
    between scraping and script generation.
    """
    style = (video_style or "").strip().lower()
    if not style:
        return "auto"
    if style not in _VALID_VIDEO_STYLES:
        raise HTTPException(
            status_code=422,
            detail="video_style must be one of: auto, explainer, promotional, storytelling",
        )
    return style


def _normalize_video_length(video_length: str | None) -> str:
    """Normalize and validate video_length stored on Project."""
    raw = (video_length or "").strip().lower()
    if not raw:
        return "auto"
    # Frontend label uses "more_detailed"; DB/domain uses compact "mdetailed"
    # (projects.video_length was introduced as VARCHAR(10)).
    aliases = {
        "more_detailed": "mdetailed",
        "more-detailed": "mdetailed",
        "more detailed": "mdetailed",
    }
    raw = aliases.get(raw, raw)
    if raw not in _VALID_VIDEO_LENGTHS:
        raise HTTPException(
            status_code=422,
            detail="video_length must be one of: auto, short, medium, detailed, more detailed",
        )
    return raw


def _normalize_playback_speed(playback_speed: float | None) -> float:
    if playback_speed is None:
        return 1.0
    value = round(float(playback_speed), 2)
    if value < _MIN_PLAYBACK_SPEED or value > _MAX_PLAYBACK_SPEED:
        raise HTTPException(
            status_code=422,
            detail="playback_speed must be between 0.5 and 2.5",
        )
    return value


def _normalize_voice_accent_for_db(voice_accent: str | None) -> str:
    """Normalize accent values to fit projects.voice_accent (VARCHAR(10))."""
    raw = (voice_accent or "").strip().lower()
    if not raw:
        return "american"

    # Common frontend/API variants
    aliases = {
        "en-american": "american",
        "en_us": "american",
        "en-us": "american",
        "us": "american",
        "en-british": "british",
        "en_uk": "british",
        "en-uk": "british",
        "uk": "british",
    }
    normalized = aliases.get(raw, raw)

    # Safety net: never exceed DB column length.
    return normalized[:10]


def _resolve_voice_tuning(voice_emotion: str | None, user: User) -> tuple[str | None, str | None]:
    """Validate + gate user voice tuning, sent as a JSON string array
    ["<stability>","<speed>","<emotion>","<style>","<enabled>"] in the voice_emotion field.

    Returns ``(project_value, preference_value)``:
      - ``project_value``    — 4-element canonical array stored on the Project, or ``None`` when the
        Advanced Options toggle is OFF (so that project narrates with plain defaults).
      - ``preference_value`` — 5-element canonical array (tuning + enabled flag) persisted as the
        user's remembered default, so the sliders keep their last-enabled values even while the
        toggle is off and the toggle state itself is remembered. ``None`` only when nothing was sent.

    Raises 403 if tuning is supplied by a non-paid user — mirrors the custom-template gate.
    """
    if voice_emotion is None:
        return None, None
    if user.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        raise HTTPException(
            status_code=403,
            detail="Voice tuning requires a Pro or Standard subscription.",
        )
    from app.services.voiceover import SUPPORTED_EMOTIONS, DEFAULT_EMOTION, DEFAULT_STYLE, VOICE_STYLE_RANGE

    try:
        values = json.loads(voice_emotion)
        stability = float(values[0])
        speed = float(values[1])
    except (ValueError, TypeError, IndexError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid voice tuning values.")
    # Emotion (3rd element) is optional. Legacy 2-element values default to [excited]; a
    # present-but-empty/invalid value is stored as "" (no emotion tag at synthesis).
    if isinstance(values, list) and len(values) >= 3:
        candidate = str(values[2]).strip().lower()
        emotion = candidate if candidate in SUPPORTED_EMOTIONS else ""
    else:
        emotion = DEFAULT_EMOTION
    # Style (4th element) is optional; missing/invalid → DEFAULT_STYLE, clamped to the safe range.
    style = DEFAULT_STYLE
    if isinstance(values, list) and len(values) >= 4:
        try:
            style = float(values[3])
        except (TypeError, ValueError):
            style = DEFAULT_STYLE
    # Enabled (5th element) — the Advanced Options toggle. Legacy values without it are treated as
    # enabled (old behaviour: sending tuning meant it was on).
    enabled = True
    if isinstance(values, list) and len(values) >= 5:
        enabled = str(values[4]).strip() == "1"
    style = max(VOICE_STYLE_RANGE[0], min(VOICE_STYLE_RANGE[1], style))
    stability = max(0.0, min(1.0, stability))
    speed = max(0.7, min(1.2, speed))
    tuning = json.dumps([f"{stability:.2f}", f"{speed:.2f}", emotion, f"{style:.2f}"])
    pref = json.dumps([f"{stability:.2f}", f"{speed:.2f}", emotion, f"{style:.2f}", "1" if enabled else "0"])
    # Project only carries tuning when the toggle is on; the preference always remembers values + flag.
    return (tuning if enabled else None), pref


def _crafted_template_pk(template_id: str, db: Session) -> int | None:
    if not is_crafted_template(template_id):
        return None
    row = (
        db.query(CraftedTemplate.id)
        .filter(CraftedTemplate.public_template_id == template_id, CraftedTemplate.status == "active")
        .first()
    )
    return int(row[0]) if row else None


def _extract_scene_layout_from_descriptor(scene: Scene, template_id: str) -> str | None:
    if not scene.remotion_code:
        return None
    try:
        descriptor = json.loads(scene.remotion_code)
    except Exception:
        return None
    return _extract_layout_from_descriptor_obj(descriptor, template_id)


def _extract_layout_from_descriptor_obj(descriptor: object, template_id: str) -> str | None:
    if is_custom_template(template_id):
        cfg = descriptor.get("layoutConfig") if isinstance(descriptor, dict) else None
        if isinstance(cfg, dict):
            arr = cfg.get("arrangement")
            return arr if isinstance(arr, str) else None
        return None
    layout = descriptor.get("layout") if isinstance(descriptor, dict) else None
    return layout if isinstance(layout, str) else None


def _clamp_image_focus(value: object | None) -> float:
    try:
        num = float(value)
    except Exception:
        return 50.0
    if num < 0:
        return 0.0
    if num > 100:
        return 100.0
    return round(num, 2)


def _clamp_image_zoom(value: object | None) -> float:
    try:
        num = float(value)
    except Exception:
        return 1.0
    if num < 0.1:
        return 0.1
    if num > 12:
        return 12.0
    return round(num, 2)


def _ensure_layout_props_dict(descriptor: dict) -> dict:
    lp = descriptor.get("layoutProps")
    if not isinstance(lp, dict):
        lp = {}
    descriptor["layoutProps"] = lp
    return lp


def _apply_default_focus(lp: dict) -> None:
    lp["imageFocusX"] = _clamp_image_focus(lp.get("imageFocusX", 50))
    lp["imageFocusY"] = _clamp_image_focus(lp.get("imageFocusY", 50))


def _clear_image_assignment(lp: dict) -> None:
    lp.pop("assignedImage", None)
    lp.pop("imageFocusX", None)
    lp.pop("imageFocusY", None)
    lp.pop("imageZoom", None)


def _build_ending_socials_props(project: Project, scene: Scene) -> dict:
    social_flags = detect_social_platforms_in_text(getattr(project, "blog_content", None) or "")
    socials = {
        "facebook": {"enabled": bool(social_flags.get("facebook")), "label": "Facebook"},
        "instagram": {"enabled": bool(social_flags.get("instagram")), "label": "Instagram"},
        "youtube": {"enabled": bool(social_flags.get("youtube")), "label": "YouTube"},
        "medium": {"enabled": bool(social_flags.get("medium")), "label": "Medium"},
        "substack": {"enabled": bool(social_flags.get("substack")), "label": "Substack"},
        "linkedin": {"enabled": bool(social_flags.get("linkedin")), "label": "LinkedIn"},
        "tiktok": {"enabled": bool(social_flags.get("tiktok")), "label": "TikTok"},
    }
    raw_blog_url = (getattr(project, "blog_url", None) or "").strip()
    source_link = raw_blog_url if raw_blog_url and not raw_blog_url.startswith("upload://") else ""

    existing_socials = None
    cta_from_visual, _ = strip_b2v_cta_from_visual(scene.visual_description or "")
    cta = (cta_from_visual or "").strip()
    try:
        if scene.remotion_code:
            old_desc = json.loads(scene.remotion_code)
            old_lp = old_desc.get("layoutProps") or {}
            old_socials = old_lp.get("socials")
            if isinstance(old_socials, dict):
                existing_socials = old_socials
            old_cta = old_lp.get("ctaButtonText")
            if isinstance(old_cta, str) and old_cta.strip():
                cta = old_cta.strip()
    except Exception:
        pass
    if not cta:
        cta = "Get started"

    return {
        "hideImage": True,
        "socials": existing_socials or socials,
        "showWebsiteButton": bool(source_link),
        "websiteLink": source_link,
        "ctaButtonText": cta,
    }


def _run_project_template_change_job(job_id: int) -> None:
    from app.dspy_modules.template_layout_planner import TemplateLayoutPlanner
    from app.dspy_modules.template_scene_gen import TemplateSceneGenerator
    from app.routers.pipeline import _normalize_layout_id, _sanitize_script_layouts

    db = SessionLocal()
    try:
        job = db.query(ProjectTemplateChangeJob).filter(ProjectTemplateChangeJob.id == job_id).first()
        if not job:
            return
        project = db.query(Project).filter(Project.id == job.project_id).first()
        if not project:
            job.status = "failed"
            job.error_message = "Project not found."
            job.completed_at = datetime.utcnow()
            db.commit()
            return

        job.status = "running"
        db.commit()

        scenes = db.query(Scene).filter(Scene.project_id == project.id).order_by(Scene.order).all()
        job.total_scenes = len(scenes)
        job.processed_scenes = 0
        # Snapshot the pre-relayout state so a reaped/failed run can be fully reverted.
        # Captured before the loop mutates scenes and before project.template flips below.
        job.scene_snapshot = json.dumps({
            "template": project.template,
            "crafted_template_id": project.crafted_template_id,
            "accent_color": project.accent_color,
            "bg_color": project.bg_color,
            "text_color": project.text_color,
            "scenes": [
                {"id": s.id, "remotion_code": s.remotion_code, "preferred_layout": s.preferred_layout}
                for s in scenes
            ],
        })
        db.commit()
        cancel_event = stall_recovery.arm("template", job.id)

        target_template = job.target_template
        layout_planner = TemplateLayoutPlanner(target_template)
        template_gen = TemplateSceneGenerator(target_template)
        target_valid_layouts = get_valid_layouts(target_template)
        supports_ending_socials = "ending_socials" in target_valid_layouts
        # Pre-compute the normalized hero layout for the new template so the
        # post-descriptor guard can detect when the generator produced something
        # outside the valid set and recover deterministically.
        target_hero_layout = (get_hero_layout(target_template) or "").strip().lower()
        if target_hero_layout and target_hero_layout not in target_valid_layouts:
            target_hero_layout = ""
        scenes_data = [
            {
                "title": s.title,
                "narration": s.narration_text,
                "visual_description": s.visual_description,
            }
            for s in scenes
        ]
        preferred_layouts = asyncio.run(
            layout_planner.plan_preferred_layouts(
                scenes_data=scenes_data,
                video_length=getattr(project, "video_length", "auto") or "auto",
                content_language=project.content_language or "English",
            )
        )
        # Mirror the script-stage policy exactly: this is the same sanitizer used
        # by the normal generation pipeline. It pins scene 0 to hero_layout,
        # pins the last scene to ending_socials (when supported), replaces
        # invalid / empty picks with diverse valid layouts, and avoids
        # consecutive duplicates. Without this pass, the planner's LLM output
        # could leave the first scene on a non-hero layout (or assign a layout
        # that isn't valid for the target template).
        sanitized_pairs = _sanitize_script_layouts(
            target_template,
            [
                {
                    "preferred_layout": (
                        preferred_layouts[i].strip()
                        if i < len(preferred_layouts) and isinstance(preferred_layouts[i], str)
                        else ""
                    )
                }
                for i in range(len(scenes))
            ],
            include_ending_socials=supports_ending_socials,
        )
        preferred_layouts = [
            (entry.get("preferred_layout") or "") if isinstance(entry, dict) else ""
            for entry in sanitized_pairs
        ]

        if is_custom_template(target_template):
            # Keep custom-template regeneration consistent with normal generation:
            # pipeline uses one batch extraction call and stores layoutConfig as {}.
            from app.services.content_classifier import extract_structured_content_batch

            custom_scenes_data = []
            for idx, scene in enumerate(scenes):
                preferred_layout = (
                    preferred_layouts[idx].strip()
                    if idx < len(preferred_layouts) and isinstance(preferred_layouts[idx], str)
                    else ""
                )
                custom_scenes_data.append(
                    {
                        "title": scene.title,
                        "narration": scene.narration_text,
                        "visual_description": scene.visual_description,
                        "preferred_layout": preferred_layout or None,
                    }
                )
                scene.preferred_layout = preferred_layout or None

            structured_contents = asyncio.run(
                extract_structured_content_batch(
                    custom_scenes_data,
                    content_language=project.content_language or "English",
                )
            )

            for idx, scene in enumerate(scenes):
                sc = structured_contents[idx] if idx < len(structured_contents) else {"contentType": "plain"}
                scene.remotion_code = json.dumps(
                    {
                        "structuredContent": sc,
                        "layoutConfig": {},
                    }
                )
                if cancel_event.is_set():
                    logger.warning("[PROJECT_TEMPLATE_CHANGE] job=%s superseded by reaper; aborting", job_id)
                    return
                job.processed_scenes = idx + 1
                db.commit()
        else:
            last_scene_idx = len(scenes) - 1
            for idx, scene in enumerate(scenes):
                preferred_layout = preferred_layouts[idx] if idx < len(preferred_layouts) else ""
                # Use fresh template logic with content preserved, and let the new template
                # enforce the planned preferred layouts (same 2-step flow as normal generation).
                new_descriptor = asyncio.run(
                    template_gen.generate_scene_descriptor(
                        scene_title=scene.title,
                        narration=scene.narration_text,
                        visual_description=scene.visual_description,
                        scene_index=idx,
                        total_scenes=len(scenes),
                        preferred_layout=preferred_layout or None,
                        content_language=project.content_language or "English",
                    )
                )

                # Match normal generation behavior for CTA ending scenes:
                # ensure ending_socials gets complete layoutProps payload.
                if (
                    supports_ending_socials
                    and idx == last_scene_idx
                    and preferred_layout == "ending_socials"
                ):
                    new_descriptor = {
                        "layout": "ending_socials",
                        "layoutProps": _build_ending_socials_props(project, scene),
                    }

                new_descriptor = _sanitize_descriptor_for_data_viz(new_descriptor)
                descriptor_layout = _extract_layout_from_descriptor_obj(
                    descriptor=new_descriptor,
                    template_id=target_template,
                )
                normalized_descriptor_layout = _normalize_layout_id(descriptor_layout or "")
                # Post-descriptor validity guard: if the generator drifted to a
                # layout that isn't part of the target template, snap back to
                # the sanitized preferred layout (which the sanitizer above
                # guarantees is in valid_layouts). Falls back to hero if even
                # that is somehow empty.
                if (
                    target_valid_layouts
                    and normalized_descriptor_layout not in target_valid_layouts
                ):
                    recovery_layout = preferred_layout or target_hero_layout
                    if recovery_layout in target_valid_layouts:
                        logger.warning(
                            "[PROJECT_TEMPLATE_CHANGE] job=%s scene=%s descriptor layout '%s' "
                            "not in valid_layouts for '%s'; coercing to '%s'",
                            job_id,
                            idx,
                            descriptor_layout,
                            target_template,
                            recovery_layout,
                        )
                        if recovery_layout == "ending_socials":
                            new_descriptor = {
                                "layout": "ending_socials",
                                "layoutProps": _build_ending_socials_props(project, scene),
                            }
                        else:
                            new_descriptor = {
                                "layout": recovery_layout,
                                "layoutProps": {},
                            }
                        descriptor_layout = recovery_layout

                scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(new_descriptor))
                scene.preferred_layout = descriptor_layout or (preferred_layout or None)
                if cancel_event.is_set():
                    logger.warning("[PROJECT_TEMPLATE_CHANGE] job=%s superseded by reaper; aborting", job_id)
                    return
                job.processed_scenes = idx + 1
                db.commit()

        if cancel_event.is_set():
            logger.warning("[PROJECT_TEMPLATE_CHANGE] job=%s superseded by reaper; aborting before finalize", job_id)
            return

        project.template = target_template
        project.crafted_template_id = _crafted_template_pk(target_template, db)
        template_colors = get_preview_colors(target_template) or {}
        if isinstance(template_colors, dict):
            project.accent_color = template_colors.get("accent") or project.accent_color
            project.bg_color = template_colors.get("bg") or project.bg_color
            project.text_color = template_colors.get("text") or project.text_color
        project.status = ProjectStatus.GENERATED
        project.r2_video_key = None
        project.r2_video_url = None
        db.commit()

        # Only finalize if a reaper hasn't already claimed (failed) this job.
        finalized = db.execute(
            update(ProjectTemplateChangeJob)
            .where(ProjectTemplateChangeJob.id == job_id, ProjectTemplateChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
            .values(status="completed", completed_at=datetime.utcnow())
        )
        db.commit()
        if not finalized.rowcount:
            logger.warning("[PROJECT_TEMPLATE_CHANGE] job=%s already reaped; skipping completion", job_id)
        else:
            # Done — everyone in the room reloads to see the finished template + layouts.
            # We can't exclude the actor here (the job stores the payer/owner, not the
            # collaborator who triggered it), and the actor's own client is polling the
            # job to completion anyway, so a redundant reload is harmless.
            from app.routers.collab_ws import broadcast_project_reload
            broadcast_project_reload(project.id)
    except Exception as e:
        logger.exception("[PROJECT_TEMPLATE_CHANGE] job=%s failed: %s", job_id, e)
        # Don't clobber a reaper that already failed/reverted this job.
        job = db.query(ProjectTemplateChangeJob).filter(
            ProjectTemplateChangeJob.id == job_id,
            ProjectTemplateChangeJob.status.in_(_JOB_ACTIVE_STATUSES),
        ).first()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            # Return the reserved video credit to the OWNER (job.user_id is the payer)
            # and revert the project to its pre-change template/scenes, so a failed
            # template change never leaves the owner charged for a video that wasn't
            # produced. Mirrors the reaper's revert+refund, which only fires for jobs
            # still in an active status (this one is now 'failed').
            try:
                _refund_video_credit(db, job.user_id)
                project = db.query(Project).filter(Project.id == job.project_id).first()
                if project is not None:
                    _restore_template_change_snapshot(db, project, job.scene_snapshot)
            except Exception:
                logger.exception(
                    "[PROJECT_TEMPLATE_CHANGE] job=%s refund/revert after failure failed", job_id
                )
            db.commit()
    finally:
        stall_recovery.clear("template", job_id)
        db.close()


@router.post("", response_model=ProjectOut)
def create_project(
    data: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project from a blog URL. Counts against video limit."""
    user.roll_video_period_if_due(db)
    user.sync_video_limit_bonus(db)
    if not user.can_create_video:
        raise HTTPException(
            status_code=403,
            detail=f"Video limit reached. Upgrade your subscription.",
        )

    if not data.blog_url:
        raise HTTPException(status_code=400, detail="blog_url is required for URL-based project creation.")

    name = data.name or _name_from_url(data.blog_url)
    template_id = validate_template_id(data.template, db=db, user_id=user.id)
    # Custom templates are usable on any plan (incl. Free). Access is gated solely by
    # video credits (checked above via can_create_video) and the per-plan template-
    # creation cap enforced at creation time — not by subscription tier.
    if is_crafted_template(template_id) and not validate_crafted_template_access(template_id, user.id, db):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this crafted template.",
        )
    crafted_pk = _crafted_template_pk(template_id, db)
    colors = get_preview_colors(template_id)
    normalized_video_style = _normalize_video_style(data.video_style)
    voice_tuning, voice_tuning_pref = _resolve_voice_tuning(data.voice_emotion, user)
    project = Project(
        user_id=user.id,
        name=name,
        blog_url=data.blog_url,
        template=template_id,
        crafted_template_id=crafted_pk,
        voice_gender=data.voice_gender or "female",
        voice_accent=_normalize_voice_accent_for_db(data.voice_accent),
        voice_emotion=voice_tuning,
        accent_color=data.accent_color or (colors.get("accent") if colors else None) or "#7C3AED",
        bg_color=data.bg_color or (colors.get("bg") if colors else None) or "#FFFFFF",
        text_color=data.text_color or (colors.get("text") if colors else None) or "#000000",
        font_family=data.font_family or None,
        animation_instructions=data.animation_instructions or None,
        logo_position=data.logo_position or "bottom_right",
        logo_opacity=data.logo_opacity if data.logo_opacity is not None else 0.9,
        custom_voice_id=data.custom_voice_id or None,
        aspect_ratio=data.aspect_ratio or "landscape",
        video_style=normalized_video_style,
        video_length=_normalize_video_length(getattr(data, "video_length", None)),
        playback_speed=_normalize_playback_speed(getattr(data, "playback_speed", None)),
        content_language=normalize_preferred_language_code(data.content_language),
        bgm_track_id=getattr(data, "bgm_track_id", None) or None,
        bgm_volume=getattr(data, "bgm_volume", None) or 0.10,
        captions_enabled=bool(getattr(data, "captions_enabled", False)),
        caption_position=getattr(data, "caption_position", None) or "bottom_center",
        caption_font_family=getattr(data, "caption_font_family", None) or "inter",
        caption_font_size=getattr(data, "caption_font_size", None) or "36",
        caption_offset=int(getattr(data, "caption_offset", 0) or 0),
        status=ProjectStatus.CREATED,
    )
    db.add(project)
    db.flush()  # assign project.id so the logo seed below can build an R2 key

    # Custom templates: pre-fill the project's own (editable/removable) logo from
    # the scraped brand-kit logo, so the editor's Logo section isn't empty by
    # default. Best-effort — failures here must never block project creation.
    _seed_project_logo_from_brand_kit(project, db)

    # Remember the voice tuning (values + enabled flag) so the toggle state and last-enabled slider
    # values both pre-fill next time. Disabling no longer wipes the saved values — the flag is part
    # of the stored preference.
    if voice_tuning_pref is not None:
        user.preferred_voice_emotion = voice_tuning_pref

    # Increment usage counter
    user.videos_used_this_period += 1
    db.commit()
    db.refresh(project)
    return _prepare_project_response(project, user, db)


@router.patch("/{project_id}/update-project", response_model=ProjectOut)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_user_project(project_id, user.id, db)

    raw_data = data.model_dump()
    fields_set = data.model_fields_set

    update_data: dict[str, object] = {}
    for field, value in raw_data.items():
        if field not in fields_set:
            continue
        if field in ("font_family", "bgm_track_id"):
            update_data[field] = value  # allow nulling or changing
        elif field == "content_language":
            update_data[field] = normalize_preferred_language_code(value) if value is not None else None
        elif field == "video_length":
            update_data[field] = _normalize_video_length(value)
        elif field == "playback_speed":
            update_data[field] = _normalize_playback_speed(value)
        else:
            if value is not None:
                update_data[field] = value

    # Captions require a voiceover to sync to — block enabling them on a muted project.
    if update_data.get("captions_enabled") is True:
        has_voiceover = (
            db.query(Scene)
            .filter(Scene.project_id == project.id, Scene.voiceover_path.isnot(None))
            .first()
            is not None
        )
        if not has_voiceover:
            raise HTTPException(
                status_code=400,
                detail="Captions require a voiceover. Add a voice to this video first.",
            )

    from app.services.edit_tracker import new_change_set_id
    _proj_change_set = new_change_set_id()
    for field, value in update_data.items():
        old_value = getattr(project, field)

        track_project_edit(
            db,
            project_id=project.id,
            field_name=field,
            old_value=old_value,
            new_value=value,
            is_ai_assisted=False,
            user_id=user.id,
            change_set_id=_proj_change_set,
        )

        setattr(project, field, value)

    from app.services.edit_tracker import prune_project_history
    prune_project_history(db, project.id)

    db.commit()
    db.refresh(project)

    # Push each change live to any collaborators connected on this project.
    from app.routers.collab_ws import broadcast_project_edit
    from app.services.collab_draft import PROJECT_EDITABLE_FIELDS
    for field, value in update_data.items():
        if field in PROJECT_EDITABLE_FIELDS:
            broadcast_project_edit(
                project.id, field, value,
                user_id=user.id, name=user.name, change_set_id=_proj_change_set,
            )

    return _prepare_project_response(project, user, db)


@router.post(
    "/{project_id}/change-template-regenerate-layouts",
    response_model=ProjectTemplateChangeJobOut,
)
async def change_project_template_regenerate_layouts(
    project_id: int,
    body: ProjectTemplateChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_user_project(project_id, user.id, db)
    # Only one long-running job per project across all types (another user may have
    # started a template change, script/voice regen, or render).
    _assert_no_active_job(project.id, db)
    # Owner pays: on a shared project the video-credit quota is charged to the
    # OWNER, not the acting collaborator (a FREE collaborator regenerating a PRO
    # owner's video consumes the owner's allotment).
    from app.services.access import project_owner, video_limit_message
    payer = project_owner(project, db)
    payer.roll_video_period_if_due(db)
    payer.sync_video_limit_bonus(db)
    if not payer.can_create_video:
        raise HTTPException(
            status_code=403,
            detail=video_limit_message(payer, user, "change the template"),
        )
    # Custom/crafted templates are OWNER-scoped. On a shared project the collaborator
    # picks from the OWNER's templates (that's what the picker shows), so resolve the
    # target against the OWNER, not the acting user.
    #
    # A custom/crafted template the owner does NOT own must FAIL loudly here rather
    # than silently downgrade to "default": validate_template_id() returns "default"
    # for an inaccessible custom template, which would otherwise (a) change the
    # project to the wrong template and (b) leave the owner charged a video credit.
    # This check runs BEFORE the credit is deducted below, so a rejection charges
    # nothing — the owner's video count is preserved.
    requested_template = (body.template or "").strip()
    if is_custom_template(requested_template) or is_crafted_template(requested_template):
        owns_requested = (
            _load_custom_template_data(requested_template, db=db, user_id=project.user_id)
            is not None
        )
        if not owns_requested:
            raise HTTPException(
                status_code=403,
                detail="This project's owner does not have access to the selected template.",
            )
    target_template = validate_template_id(body.template, db=db, user_id=project.user_id)
    if target_template == project.template:
        raise HTTPException(status_code=400, detail="Project is already using this template.")
    # Belt-and-suspenders: crafted templates additionally gate on an active entitlement.
    if is_crafted_template(target_template) and not validate_crafted_template_access(target_template, project.user_id, db):
        raise HTTPException(
            status_code=403,
            detail="This project's owner does not have access to this crafted template.",
        )

    active_job = (
        db.query(ProjectTemplateChangeJob)
        .filter(
            ProjectTemplateChangeJob.project_id == project.id,
            ProjectTemplateChangeJob.status.in_(_ACTIVE_TEMPLATE_CHANGE_STATUSES),
        )
        .order_by(ProjectTemplateChangeJob.id.desc())
        .first()
    )
    if active_job:
        raise HTTPException(
            status_code=409,
            detail="A template-change regeneration job is already running for this project.",
        )

    total_scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project.id, Scene.is_active == True)  # noqa: E712
        .count()
    )
    job = ProjectTemplateChangeJob(
        project_id=project.id,
        # The job's user is the PAYER (project owner). Charge and refund both key off
        # this, so a collaborator's edits consume the owner's allotment, and any
        # refund on failure returns to the owner.
        user_id=payer.id,
        target_template=target_template,
        status="queued",
        total_scenes=total_scenes,
        processed_scenes=0,
    )
    db.add(job)
    payer.videos_used_this_period += 1
    # Surface "generating" state during relayout via existing status pipeline.
    project.status = ProjectStatus.GENERATING
    # Log a non-revertable history entry for the template change (visibility only).
    from app.services.edit_tracker import log_project_event, prune_project_history
    log_project_event(
        db, project_id=project.id,
        label=f"Template changed to {target_template}",
        user_id=user.id,
    )
    prune_project_history(db, project.id)
    db.commit()
    db.refresh(job)

    # Tell live collaborators to refetch so they see the "generating" state as the
    # template regeneration begins (it rewrites colors + every scene's layout).
    # Exclude the acting user — they already transitioned locally. This endpoint is
    # async (runs on the event loop), so await the broadcast directly rather than via
    # the sync helper (run_coroutine_threadsafe is for calls from OTHER threads).
    from app.routers.collab_ws import collab_manager
    await collab_manager.broadcast(
        project.id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )

    # Match pipeline behavior: run in asyncio-managed executor.
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run_project_template_change_job, job.id)
    return job


@router.get(
    "/{project_id}/template-change-status",
    response_model=ProjectTemplateChangeJobOut | None,
)
def get_project_template_change_status(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = _get_user_project(project_id, user.id, db)
    job = (
        db.query(ProjectTemplateChangeJob)
        .filter(ProjectTemplateChangeJob.project_id == project_id)
        .order_by(ProjectTemplateChangeJob.id.desc())
        .first()
    )
    # Stall recovery: if this job is active but its heartbeat is stale, this poll
    # reverts the project + refunds, then we return the now-failed job so the UI
    # surfaces the retry popup.
    if maybe_reap_stale_template_change(db, job):
        db.refresh(job)
    return job



# "awaiting_review" is the paused state between the script and scene stages — treat it as
# active so the duplicate-job guard blocks starting a fresh regeneration while one is parked.
_ACTIVE_REGENERATE_SCRIPT_STATUSES = {"queued", "running", "awaiting_review"}


def _set_regenerate_script_step(job_id: int, step: str) -> None:
    db = SessionLocal()
    try:
        job = db.query(ProjectRegenerateScriptJob).filter(ProjectRegenerateScriptJob.id == job_id).first()
        if not job:
            return
        job.current_step = step
        db.commit()
    except Exception:
        logger.exception("[REGENERATE_SCRIPT_JOB] failed to update current_step for job=%s", job_id)
        db.rollback()
    finally:
        db.close()


def _regenerate_audio_dir(project_id: int) -> str:
    return os.path.join(settings.MEDIA_DIR, f"projects/{project_id}", "audio")


def _regenerate_audio_backup_dir(project_id: int, job_id: int) -> str:
    return os.path.join(settings.MEDIA_DIR, f"projects/{project_id}", f"audio_bak_{job_id}")


def _ensure_local_audio_from_r2(project_id: int, db: Session) -> None:
    """Pull each scene's original audio down from R2 if it's missing locally.

    Voiceover audio is durably stored in R2 (the local MEDIA_DIR copy is a cache that
    may be cold on a fresh checkout/redeploy). Without this, _backup_project_audio
    would snapshot an empty dir and a later rollback couldn't restore the originals.
    Best-effort.
    """
    if not r2_storage.is_r2_configured():
        return
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return
    audio_dir = _regenerate_audio_dir(project_id)
    os.makedirs(audio_dir, exist_ok=True)
    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    for s in scenes:
        if not s.voiceover_path:
            continue
        filename = os.path.basename(s.voiceover_path)
        local = os.path.join(audio_dir, filename)
        if os.path.exists(local):
            continue
        try:
            key = r2_storage.audio_key(project.user_id, project_id, filename)
            data = r2_storage.download_bytes(key)
            if data:
                with open(local, "wb") as f:
                    f.write(data)
        except Exception:
            logger.exception(
                "[AUDIO-BACKUP] failed to pull original audio %s from R2 for project=%s",
                filename, project_id,
            )


def _reupload_audio_to_r2(project_id: int, db: Session) -> None:
    """Re-upload the local audio files to R2 (stable keys) so the durable store matches
    the restored originals. R2 audio keys are overwritten in place during regeneration,
    so a local-only restore would still leave R2 (and thus the workspace's R2 fallback)
    holding the new voice. Best-effort.
    """
    if not r2_storage.is_r2_configured():
        return
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return
    audio_dir = _regenerate_audio_dir(project_id)
    if not os.path.isdir(audio_dir):
        return
    for fn in sorted(os.listdir(audio_dir)):
        if not fn.lower().endswith(".mp3"):
            continue
        try:
            r2_storage.upload_project_audio(
                project.user_id, project_id, os.path.join(audio_dir, fn), fn
            )
        except Exception:
            logger.exception(
                "[AUDIO-RESTORE] failed to re-upload %s to R2 for project=%s",
                fn, project_id,
            )


def _backup_project_audio(project_id: int, job_id: int) -> None:
    """Snapshot the project's voiceover audio before scene generation overwrites it.

    Stage B regenerates every scene's MP3 in place (scene_N.mp3); the DB snapshot only
    captures voiceover_path strings, so without this copy a rollback would leave the
    paths pointing at the new (failed-run) audio. Best-effort — failures are logged.
    """
    src = _regenerate_audio_dir(project_id)
    dst = _regenerate_audio_backup_dir(project_id, job_id)
    try:
        if os.path.isdir(dst):
            shutil.rmtree(dst, ignore_errors=True)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
    except Exception:
        logger.exception(
            "[REGENERATE_SCRIPT_JOB] failed to back up audio for project=%s job=%s",
            project_id, job_id,
        )


def _restore_project_audio(project_id: int, job_id: int) -> None:
    src = _regenerate_audio_backup_dir(project_id, job_id)
    dst = _regenerate_audio_dir(project_id)
    try:
        if os.path.isdir(src):
            if os.path.isdir(dst):
                shutil.rmtree(dst, ignore_errors=True)
            shutil.copytree(src, dst)
    except Exception:
        logger.exception(
            "[REGENERATE_SCRIPT_JOB] failed to restore audio for project=%s job=%s",
            project_id, job_id,
        )


def _cleanup_audio_backup(project_id: int, job_id: int) -> None:
    dst = _regenerate_audio_backup_dir(project_id, job_id)
    try:
        if os.path.isdir(dst):
            shutil.rmtree(dst, ignore_errors=True)
    except Exception:
        logger.exception(
            "[REGENERATE_SCRIPT_JOB] failed to clean up audio backup for project=%s job=%s",
            project_id, job_id,
        )


def _rollback_regenerate_script(
    db,
    job_project_id: int | None,
    scene_snapshot_raw: str,
    job_id: int | None = None,
    restore_audio: bool = False,
) -> None:
    """Restore the project to its pre-regeneration state after a failure.

    Restores all scene rows from the snapshot, optionally restores on-disk voiceover
    audio from the stage-B backup. Never deducts a credit.
    """
    if job_project_id is None:
        return
    # This runs from a job's except-handler, where the triggering failure was
    # usually a db.commit() that left the session in a failed-transaction state.
    # Without rolling back first, the very next statement (the DELETE below)
    # raises PendingRollbackError and the restore silently fails — leaving the
    # project with the half-written (or zero) scenes from the aborted run.
    try:
        db.rollback()
    except Exception:
        pass
    try:
        snapshot = json.loads(scene_snapshot_raw)
        db.query(Scene).filter(Scene.project_id == job_project_id).delete()
        db.flush()
        for s in snapshot:
            db.add(Scene(
                project_id=job_project_id,
                order=s["order"],
                title=s["title"],
                narration_text=s["narration_text"],
                display_text=s.get("display_text"),
                visual_description=s["visual_description"],
                remotion_code=s.get("remotion_code"),
                voiceover_path=s.get("voiceover_path"),
                duration_seconds=s.get("duration_seconds", 10.0),
                extra_hold_seconds=s.get("extra_hold_seconds"),
                preferred_layout=s.get("preferred_layout"),
                scene_type=s.get("scene_type"),
            ))
        project = db.query(Project).filter(Project.id == job_project_id).first()
        if project:
            project.status = ProjectStatus.GENERATED
        db.commit()

        # Restore the original voiceover audio that stage B overwrote (req 4).
        if restore_audio and job_id is not None:
            _restore_project_audio(job_project_id, job_id)
            # R2 holds audio durably and was overwritten in place — push the restored
            # originals back so the workspace's R2 fallback serves them too.
            _reupload_audio_to_r2(job_project_id, db)

    except Exception as restore_err:
        logger.exception(
            "[REGENERATE_SCRIPT_JOB] restore failed for project=%s: %s",
            job_project_id, restore_err,
        )
        try:
            db.rollback()
            project = db.query(Project).filter(Project.id == job_project_id).first()
            if project:
                project.status = ProjectStatus.GENERATED
                db.commit()
        except Exception:
            pass


def _mark_regenerate_script_failed(db, job_id: int, error: Exception) -> None:
    """Mark a regenerate-script job failed and refund its reserved credit (once).

    The credit is reserved upfront when the job is created, so every failure path must
    refund it. Guarded on the prior status so a repeated call (e.g. crash recovery running
    after the job was already failed) can't refund twice.
    """
    try:
        job = db.query(ProjectRegenerateScriptJob).filter(ProjectRegenerateScriptJob.id == job_id).first()
        if not job:
            return
        if job.status != "failed":
            # Atomic decrement (mirrors project_cleanup) so concurrent refunds don't lose updates.
            db.execute(
                update(User)
                .where(User.id == job.user_id, User.videos_used_this_period > 0)
                .values(videos_used_this_period=User.videos_used_this_period - 1)
            )
        job.status = "failed"
        job.error_message = str(error)
        job.completed_at = datetime.utcnow()
        db.commit()
    except Exception:
        pass


def recover_orphaned_regenerate_script_jobs() -> None:
    """Roll back regenerate-script jobs left mid-run by a server crash/restart.

    The job executes in a background thread (``loop.run_in_executor``); if the process
    dies the thread is gone but the DB row stays ``queued``/``running``, so the project is
    stuck in ``script_regenerating`` forever and the UI keeps showing the loader. The
    in-process try/except can't catch process death, so we recover at boot: treat any such
    job as failed and restore the original scenes + audio + workspace (no credit charged).

    The ``awaiting_review`` pause is intentional and fully recoverable across restarts
    (scenes persist; the user can still Proceed/Regenerate), so it is left untouched.
    """
    db = SessionLocal()
    try:
        orphaned = (
            db.query(ProjectRegenerateScriptJob)
            .filter(ProjectRegenerateScriptJob.status.in_(["queued", "running"]))
            .all()
        )
        if not orphaned:
            return
        logger.warning(
            "[REGENERATE_SCRIPT_JOB] recovering %d orphaned job(s) after restart",
            len(orphaned),
        )
        # Snapshot the identifiers first — rollback commits will expire the ORM rows.
        targets = [(j.id, j.project_id, j.scene_snapshot or "[]") for j in orphaned]
        for job_id, job_project_id, scene_snapshot_raw in targets:
            try:
                _rollback_regenerate_script(
                    db, job_project_id, scene_snapshot_raw, job_id=job_id, restore_audio=True
                )
                _mark_regenerate_script_failed(
                    db,
                    job_id,
                    RuntimeError(
                        "Server restarted during regeneration; previous version restored."
                    ),
                )
                _cleanup_audio_backup(job_project_id, job_id)
            except Exception:
                logger.exception(
                    "[REGENERATE_SCRIPT_JOB] failed to recover orphaned job=%s", job_id
                )
    except Exception:
        logger.exception("[REGENERATE_SCRIPT_JOB] orphaned-job recovery sweep failed")
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Stall recovery — reap stuck background jobs via the status-polling API + boot.
#
# Each job heartbeats its ``updated_at`` as it progresses. When a status poll (or
# the boot sweep) finds an active job whose heartbeat is stale past its threshold,
# the owning recover_stalled_* function best-effort cancels the worker, atomically
# flips the job to "failed", reverts the project, and refunds the credit. The
# atomic status claim guarantees exactly one of any concurrent pollers reverts +
# refunds; the rest are no-ops.
# ─────────────────────────────────────────────────────────────────────────────

_JOB_ACTIVE_STATUSES = ("queued", "running")


def _seconds_since(dt: datetime | None) -> float:
    if dt is None:
        return float("inf")
    return (datetime.utcnow() - dt).total_seconds()


def _assert_no_active_job(project_id: int, db: Session, *, include_render: bool = True) -> None:
    """Enforce one long-running job per project across ALL job types.

    Only one of {template change, script regeneration, voice change / voiceover
    delete, render} may run for a project at a time. If any is currently active
    (and not stalled past its threshold), reject the new request with 409 so a
    second collaborator's concurrent start is refused rather than clobbering the
    first. Stale/orphaned jobs (no heartbeat past the stall threshold) are treated
    as inactive — the boot/stall reapers clean those up.

    ``include_render=False`` skips the render-in-progress check — used by the render
    endpoint itself, which owns its own re-render/already-rendering handling and must
    not be blocked by its own RENDERING status.
    """
    # Template change
    tpl = (
        db.query(ProjectTemplateChangeJob)
        .filter(
            ProjectTemplateChangeJob.project_id == project_id,
            ProjectTemplateChangeJob.status.in_(_ACTIVE_TEMPLATE_CHANGE_STATUSES),
        )
        .order_by(ProjectTemplateChangeJob.id.desc())
        .first()
    )
    if tpl and _seconds_since(tpl.updated_at) < settings.STALL_THRESHOLD_TEMPLATE_SECONDS:
        raise HTTPException(status_code=409, detail="A job is already running for this project.")

    # Script regeneration (includes the awaiting_review pause — still an open job)
    script = (
        db.query(ProjectRegenerateScriptJob)
        .filter(
            ProjectRegenerateScriptJob.project_id == project_id,
            ProjectRegenerateScriptJob.status.in_(_ACTIVE_REGENERATE_SCRIPT_STATUSES),
        )
        .order_by(ProjectRegenerateScriptJob.id.desc())
        .first()
    )
    if script:
        # awaiting_review has no worker heartbeat, so it never "stalls" — always block.
        if script.status == "awaiting_review" or _seconds_since(script.updated_at) < settings.STALL_THRESHOLD_SCRIPT_SECONDS:
            raise HTTPException(status_code=409, detail="A job is already running for this project.")

    # Voice change / voiceover delete (shared ProjectVoiceChangeJob table + in-memory bar)
    voice = (
        db.query(ProjectVoiceChangeJob)
        .filter(
            ProjectVoiceChangeJob.project_id == project_id,
            ProjectVoiceChangeJob.status.in_(_JOB_ACTIVE_STATUSES),
        )
        .order_by(ProjectVoiceChangeJob.id.desc())
        .first()
    )
    if voice and _seconds_since(voice.updated_at) < settings.STALL_THRESHOLD_VOICE_SECONDS:
        raise HTTPException(status_code=409, detail="A job is already running for this project.")
    from app.services import voice_change_progress
    vprog = voice_change_progress.get(project_id)
    if vprog and not vprog.get("done", True):
        raise HTTPException(status_code=409, detail="A job is already running for this project.")

    # Language change (translate all copy + regenerate all voiceovers)
    language = (
        db.query(ProjectLanguageChangeJob)
        .filter(
            ProjectLanguageChangeJob.project_id == project_id,
            ProjectLanguageChangeJob.status.in_(_JOB_ACTIVE_STATUSES),
        )
        .order_by(ProjectLanguageChangeJob.id.desc())
        .first()
    )
    if language and _seconds_since(language.updated_at) < settings.STALL_THRESHOLD_LANGUAGE_SECONDS:
        raise HTTPException(status_code=409, detail="A job is already running for this project.")
    from app.services import language_change_progress
    lprog = language_change_progress.get(project_id)
    if lprog and not lprog.get("done", True):
        raise HTTPException(status_code=409, detail="A job is already running for this project.")

    # Render
    if include_render:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project is not None and project.status == ProjectStatus.RENDERING and not project.r2_video_url:
            raise HTTPException(status_code=409, detail="A job is already running for this project.")


def _refund_video_credit(db: Session, user_id: int) -> None:
    """Atomic decrement of the reserved video credit (never goes below zero)."""
    db.execute(
        update(User)
        .where(User.id == user_id, User.videos_used_this_period > 0)
        .values(videos_used_this_period=User.videos_used_this_period - 1)
    )


def recover_stalled_template_change_job(db: Session, job: ProjectTemplateChangeJob) -> bool:
    """Reap a stuck template-change job: cancel, revert scenes/template, refund.

    Returns True if it reverted. False if the work had already landed (finalized as
    completed instead) or another caller claimed the job first.
    """
    project = db.query(Project).filter(Project.id == job.project_id).first()

    # Completion-race guard: the substantive work already landed (scenes written,
    # template switched) and only the heartbeat-free rebuild tail was outstanding.
    # Finalize as completed — do NOT revert or refund.
    if project and project.status == ProjectStatus.GENERATED and project.template == job.target_template:
        db.execute(
            update(ProjectTemplateChangeJob)
            .where(ProjectTemplateChangeJob.id == job.id, ProjectTemplateChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
            .values(status="completed", completed_at=datetime.utcnow())
        )
        db.commit()
        stall_recovery.clear("template", job.id)
        return False

    stall_recovery.request_cancel("template", job.id)
    snapshot_raw = job.scene_snapshot
    user_id = job.user_id

    claimed = db.execute(
        update(ProjectTemplateChangeJob)
        .where(ProjectTemplateChangeJob.id == job.id, ProjectTemplateChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
        .values(status="failed", error_message=STALL_RETRY_MESSAGE, completed_at=datetime.utcnow())
    )
    if not claimed.rowcount:
        db.rollback()
        return False

    _refund_video_credit(db, user_id)
    if project:
        _restore_template_change_snapshot(db, project, snapshot_raw)
    db.commit()

    stall_recovery.clear("template", job.id)
    logger.warning("[STALL] reverted stalled template-change job=%s project=%s", job.id, job.project_id)
    return True


def _restore_template_change_snapshot(db: Session, project: Project, snapshot_raw: str | None) -> None:
    """Restore project template fields + scene descriptors from the job snapshot."""
    try:
        snap = json.loads(snapshot_raw or "{}")
    except Exception:
        snap = {}
    if snap:
        if snap.get("template"):
            project.template = snap["template"]
        project.crafted_template_id = snap.get("crafted_template_id")
        if snap.get("accent_color"):
            project.accent_color = snap["accent_color"]
        if snap.get("bg_color"):
            project.bg_color = snap["bg_color"]
        if snap.get("text_color"):
            project.text_color = snap["text_color"]
        scene_snaps = {s["id"]: s for s in snap.get("scenes", []) if "id" in s}
        if scene_snaps:
            for sc in db.query(Scene).filter(Scene.project_id == project.id).all():
                ss = scene_snaps.get(sc.id)
                if ss is not None:
                    sc.remotion_code = ss.get("remotion_code")
                    sc.preferred_layout = ss.get("preferred_layout")
    project.status = ProjectStatus.GENERATED


def _restore_voice_snapshot(project: Project | None, snapshot_raw: str | None) -> None:
    """Restore the project's prior voice settings (gender/accent/custom_voice_id).

    voice_gender / voice_accent are non-nullable (column defaults female/american), so a
    null in the snapshot (legacy rows) falls back to the default rather than violating
    NOT NULL. custom_voice_id is nullable — a null legitimately means "prebuilt voice".
    """
    if not project:
        return
    try:
        snap = json.loads(snapshot_raw or "{}")
    except Exception:
        return
    if "voice_gender" in snap:
        project.voice_gender = snap["voice_gender"] or "female"
    if "voice_accent" in snap:
        project.voice_accent = snap["voice_accent"] or "american"
    if "custom_voice_id" in snap:
        project.custom_voice_id = snap["custom_voice_id"]
    if "voice_emotion" in snap:
        project.voice_emotion = snap["voice_emotion"]


def _rollback_delete_voiceover(
    db: Session,
    project_id: int,
    snapshot_raw: str | None,
    *,
    audio_backed_up: bool,
    backup_id: int,
) -> None:
    """Fully restore a project after a failed/reaped 'delete voiceover' run.

    Delete nulls scene.voiceover_path, recomputes durations, deletes the AUDIO Asset
    rows + files and rebuilds the workspace mute — so this puts ALL of that back from
    the job snapshot: voice settings, per-scene voiceover_path/duration, the AUDIO
    Asset rows, the audio files (local + R2), and the rebuilt workspace. Never refunds
    a credit (delete never charges one).
    """
    from app.models.asset import Asset, AssetType

    try:
        snap = json.loads(snapshot_raw or "{}")
    except Exception:
        snap = {}
    if not isinstance(snap, dict):
        snap = {}

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return
    try:
        # 1. Voice settings.
        _restore_voice_snapshot(project, snapshot_raw)

        # 2. Per-scene voiceover_path + duration_seconds.
        for srow in snap.get("scenes", []) or []:
            sid = srow.get("id")
            if sid is None:
                continue
            db.execute(
                update(Scene)
                .where(Scene.id == sid)
                .values(
                    voiceover_path=srow.get("voiceover_path"),
                    duration_seconds=srow.get("duration_seconds")
                    or settings.MIN_SCENE_DURATION_SECONDS,
                )
            )

        # 3. AUDIO asset rows: clear any current ones, recreate from the snapshot.
        db.query(Asset).filter(
            Asset.project_id == project_id, Asset.asset_type == AssetType.AUDIO
        ).delete()
        db.flush()
        for arow in snap.get("assets", []) or []:
            db.add(
                Asset(
                    project_id=project_id,
                    asset_type=AssetType.AUDIO,
                    original_url=None,
                    local_path=arow.get("local_path"),
                    filename=arow.get("filename"),
                    r2_key=arow.get("r2_key"),
                    r2_url=arow.get("r2_url"),
                )
            )
        db.commit()

        # 4. Audio files (local) + push back to R2 so the workspace fallback serves them.
        if audio_backed_up:
            _restore_project_audio(project_id, backup_id)
            _reupload_audio_to_r2(project_id, db)

    except Exception:
        logger.exception("[DELETE-VOICEOVER] rollback failed for project=%s", project_id)
        try:
            db.rollback()
        except Exception:
            pass


def _purge_project_audio(db: Session, project: Project) -> None:
    """Delete every AUDIO asset (R2 objects + DB rows) and local .mp3 file for a project."""
    from app.models.asset import Asset, AssetType

    audio_assets = (
        db.query(Asset)
        .filter(Asset.project_id == project.id, Asset.asset_type == AssetType.AUDIO)
        .all()
    )
    for asset in audio_assets:
        if r2_storage.is_r2_configured():
            try:
                key = asset.r2_key or r2_storage.audio_key(project.user_id, project.id, asset.filename)
                r2_storage.delete_object(key)
            except Exception:
                logger.exception(
                    "[VOICEOVER-CLEANUP] failed to delete R2 audio for project=%s file=%s",
                    project.id, asset.filename,
                )
        db.delete(asset)
    db.commit()

    audio_dir = _regenerate_audio_dir(project.id)
    if os.path.isdir(audio_dir):
        for fn in os.listdir(audio_dir):
            if fn.lower().endswith(".mp3"):
                try:
                    os.remove(os.path.join(audio_dir, fn))
                except Exception:
                    logger.exception(
                        "[VOICEOVER-CLEANUP] failed to delete local audio %s for project=%s",
                        fn, project.id,
                    )


def _reset_scenes_to_muted(db: Session, project_id: int) -> None:
    """Null every scene's voiceover_path and re-estimate its duration from the narration
    word count (mirrors the no-audio path in voiceover.generate_voiceover)."""
    from app.services.voiceover import WORDS_PER_SECOND, DURATION_PAD

    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    for s in scenes:
        text = (s.narration_text or "").strip()
        if text:
            wc = len(text.split())
            est = max(5.0, wc / WORDS_PER_SECOND)
            s.duration_seconds = round(
                max(settings.MIN_SCENE_DURATION_SECONDS, est + DURATION_PAD), 1
            )
        s.voiceover_path = None
    # Captions ride on the voiceover; once muted there's nothing to sync to.
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is not None:
        project.captions_enabled = False
    db.commit()


def _snapshot_is_add(snapshot_raw: str | None) -> bool:
    """A voice-change snapshot whose prior voice was 'none' represents an ADD (the
    project was muted before). A failed add must roll back to muted — deleting the
    partial audio — rather than restoring originals that never existed.
    """
    try:
        snap = json.loads(snapshot_raw or "{}")
        return isinstance(snap, dict) and snap.get("voice_gender") == "none"
    except Exception:
        return False


def _rollback_added_voiceover(db: Session, project_id: int, snapshot_raw: str | None) -> None:
    """Roll a failed/reaped 'add voiceover' back to the muted state.

    Add starts from a muted project (no audio), so on failure we restore the prior
    voice settings ("none"), delete any partial audio the run created (assets + files),
    null every scene's voiceover_path + re-estimate durations, and rebuild the workspace
    mute. There is no audio backup to restore (none existed). Never refunds here — the
    caller handles the credit refund.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return
    try:
        _restore_voice_snapshot(project, snapshot_raw)  # -> voice_gender "none", custom None
        db.commit()
        _purge_project_audio(db, project)
        _reset_scenes_to_muted(db, project_id)
        db.commit()
    except Exception:
        logger.exception("[VOICE-ADD] rollback failed for project=%s", project_id)
        try:
            db.rollback()
        except Exception:
            pass


def _is_delete_job(job: "ProjectVoiceChangeJob | None") -> bool:
    """Whether a voice-change job row actually represents a 'delete voiceover' op.

    Delete reuses ProjectVoiceChangeJob (so the same heartbeat + stall-recovery
    machinery applies) but is tagged via the voice_snapshot JSON ("_op": "delete")
    so the reaper skips the credit refund and the status reset — deletes never
    charge a credit and never change the project status.
    """
    if job is None:
        return False
    try:
        snap = json.loads(job.voice_snapshot or "{}")
        return isinstance(snap, dict) and snap.get("_op") == "delete"
    except Exception:
        return False


def recover_stalled_voice_change_job(db: Session, job: ProjectVoiceChangeJob) -> bool:
    """Reap a stuck voice-change (or delete) job: cancel, restore audio, refund.

    For a delete job the refund and status reset are skipped (deletes don't charge
    a credit and leave the project status/render untouched).
    """
    project = db.query(Project).filter(Project.id == job.project_id).first()
    is_delete = _is_delete_job(job)

    # Completion-race guard (voice-change only): voiceovers already regenerated and
    # project finalized. Delete leaves the status untouched, so it relies on the
    # claim rowcount below instead.
    if not is_delete and project and project.status == ProjectStatus.GENERATED:
        db.execute(
            update(ProjectVoiceChangeJob)
            .where(ProjectVoiceChangeJob.id == job.id, ProjectVoiceChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
            .values(status="completed", completed_at=datetime.utcnow())
        )
        db.commit()
        stall_recovery.clear("voice", job.id)
        return False

    stall_recovery.request_cancel("voice", job.id)
    user_id, project_id, job_id, backed_up = job.user_id, job.project_id, job.id, job.audio_backed_up
    voice_snapshot_raw = job.voice_snapshot

    claimed = db.execute(
        update(ProjectVoiceChangeJob)
        .where(ProjectVoiceChangeJob.id == job.id, ProjectVoiceChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
        .values(status="failed", error_message=STALL_RETRY_MESSAGE, completed_at=datetime.utcnow())
    )
    if not claimed.rowcount:
        db.rollback()
        return False

    # Delete: no refund, no status reset — fully restore scenes/assets/audio/workspace.
    if is_delete:
        db.commit()
        _rollback_delete_voiceover(
            db, project_id, voice_snapshot_raw,
            audio_backed_up=backed_up, backup_id=job_id,
        )
        _cleanup_audio_backup(project_id, job_id)
        stall_recovery.clear("voice", job_id)
        logger.warning("[STALL] reverted stalled delete-voiceover job=%s project=%s", job_id, project_id)
        return True

    # Add and change both reserved a credit — refund it.
    _refund_video_credit(db, user_id)

    # Add: roll back to muted, deleting the partial audio (no originals existed).
    if _snapshot_is_add(voice_snapshot_raw):
        if project:
            project.status = ProjectStatus.GENERATED
        db.commit()
        _rollback_added_voiceover(db, project_id, voice_snapshot_raw)
        _cleanup_audio_backup(project_id, job_id)
        stall_recovery.clear("voice", job_id)
        logger.warning("[STALL] reverted stalled add-voiceover job=%s project=%s", job_id, project_id)
        return True

    # Change: restore the prior voice settings + original audio in place.
    if project:
        project.status = ProjectStatus.GENERATED
        _restore_voice_snapshot(project, voice_snapshot_raw)
    db.commit()

    if backed_up:
        _restore_project_audio(project_id, job_id)
        # Push the restored originals back to R2 (overwriting the new-voice objects),
        # otherwise the workspace's R2 fallback would still serve the new voice.
        _reupload_audio_to_r2(project_id, db)
    _cleanup_audio_backup(project_id, job_id)
    stall_recovery.clear("voice", job_id)
    logger.warning("[STALL] reverted stalled voice-change job=%s project=%s", job_id, project_id)
    return True


def recover_stalled_regenerate_script_job(db: Session, job: ProjectRegenerateScriptJob) -> bool:
    """Reap a stuck regenerate-script job: cancel, restore scenes/audio, refund.

    ``awaiting_review`` is intentionally NOT reaped (it only matches active statuses).
    """
    stall_recovery.request_cancel("script", job.id)
    job_id, project_id, user_id = job.id, job.project_id, job.user_id
    snapshot_raw = job.scene_snapshot or "[]"

    claimed = db.execute(
        update(ProjectRegenerateScriptJob)
        .where(ProjectRegenerateScriptJob.id == job_id, ProjectRegenerateScriptJob.status.in_(_JOB_ACTIVE_STATUSES))
        .values(status="failed", error_message=STALL_RETRY_MESSAGE, completed_at=datetime.utcnow())
    )
    if not claimed.rowcount:
        db.rollback()
        return False

    _refund_video_credit(db, user_id)
    db.commit()

    # Restore scenes + audio + workspace (never refunds; we already did).
    _rollback_regenerate_script(db, project_id, snapshot_raw, job_id=job_id, restore_audio=True)
    _cleanup_audio_backup(project_id, job_id)
    stall_recovery.clear("script", job_id)
    logger.warning("[STALL] reverted stalled regenerate-script job=%s project=%s", job_id, project_id)
    return True


def maybe_reap_stale_template_change(db: Session, job: ProjectTemplateChangeJob | None) -> bool:
    if job is None or job.status not in _JOB_ACTIVE_STATUSES:
        return False
    if _seconds_since(job.updated_at) < settings.STALL_THRESHOLD_TEMPLATE_SECONDS:
        return False
    return recover_stalled_template_change_job(db, job)


def maybe_reap_stale_voice_change(db: Session, job: ProjectVoiceChangeJob | None) -> bool:
    if job is None or job.status not in _JOB_ACTIVE_STATUSES:
        return False
    if _seconds_since(job.updated_at) < settings.STALL_THRESHOLD_VOICE_SECONDS:
        return False
    return recover_stalled_voice_change_job(db, job)


def _restore_content_snapshot(db: Session, project: Project | None, snapshot_raw: str | None) -> None:
    """Restore every scene's pre-change copy/descriptor and the project's language.

    Counterpart of the snapshot taken in ``change_project_language``. Scenes are looked
    up by id (order can't be trusted — the snapshot predates nothing else, but ids are
    stable), and only the four fields the job touches are written back.
    """
    if not snapshot_raw:
        return
    try:
        snap = json.loads(snapshot_raw)
    except (json.JSONDecodeError, TypeError):
        logger.warning("[LANG-CHANGE] unreadable content snapshot; cannot revert copy")
        return

    if project is not None:
        project.content_language = snap.get("content_language")

    for row in snap.get("scenes", []) or []:
        scene = db.query(Scene).filter(Scene.id == row.get("id")).first()
        if scene is None:
            continue
        scene.title = row.get("title")
        scene.display_text = row.get("display_text")
        scene.narration_text = row.get("narration_text")
        scene.remotion_code = row.get("remotion_code")


def recover_stalled_language_change_job(db: Session, job: ProjectLanguageChangeJob) -> bool:
    """Reap a stuck language-change job: cancel, restore copy + audio, refund the owner."""
    project = db.query(Project).filter(Project.id == job.project_id).first()

    # Completion-race guard: the worker already finalized (status back to GENERATED).
    if project and project.status == ProjectStatus.GENERATED:
        db.execute(
            update(ProjectLanguageChangeJob)
            .where(ProjectLanguageChangeJob.id == job.id, ProjectLanguageChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
            .values(status="completed", completed_at=datetime.utcnow())
        )
        db.commit()
        stall_recovery.clear("language", job.id)
        return False

    stall_recovery.request_cancel("language", job.id)
    user_id, project_id, job_id = job.user_id, job.project_id, job.id
    backed_up = job.audio_backed_up
    snapshot_raw = job.content_snapshot

    claimed = db.execute(
        update(ProjectLanguageChangeJob)
        .where(ProjectLanguageChangeJob.id == job.id, ProjectLanguageChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
        .values(status="failed", error_message=STALL_RETRY_MESSAGE, completed_at=datetime.utcnow())
    )
    if not claimed.rowcount:
        db.rollback()
        return False

    # job.user_id IS the payer (project owner) — charge and refund key off the same column.
    _refund_video_credit(db, user_id)
    project = db.query(Project).filter(Project.id == project_id).first()
    _restore_content_snapshot(db, project, snapshot_raw)
    if project and project.status == ProjectStatus.LANGUAGE_REGENERATING:
        project.status = ProjectStatus.GENERATED
    db.commit()

    if backed_up:
        try:
            _restore_project_audio(project_id, job_id)
            _reupload_audio_to_r2(project_id, db)
        except Exception:
            logger.exception("[STALL] language-change audio restore failed for project=%s", project_id)
    _cleanup_audio_backup(project_id, job_id)

    logger.warning("[STALL] reverted stalled language-change job=%s project=%s", job_id, project_id)
    return True


def maybe_reap_stale_language_change(db: Session, job: ProjectLanguageChangeJob | None) -> bool:
    if job is None or job.status not in _JOB_ACTIVE_STATUSES:
        return False
    if _seconds_since(job.updated_at) < settings.STALL_THRESHOLD_LANGUAGE_SECONDS:
        return False
    return recover_stalled_language_change_job(db, job)


def maybe_reap_stale_regenerate_script(db: Session, job: ProjectRegenerateScriptJob | None) -> bool:
    if job is None or job.status not in _JOB_ACTIVE_STATUSES:
        return False
    if _seconds_since(job.updated_at) < settings.STALL_THRESHOLD_SCRIPT_SECONDS:
        return False
    return recover_stalled_regenerate_script_job(db, job)


def reap_orphaned_template_change_jobs() -> None:
    """Boot sweep: any active template-change job is orphaned (its process is gone)."""
    db = SessionLocal()
    try:
        jobs = db.query(ProjectTemplateChangeJob).filter(
            ProjectTemplateChangeJob.status.in_(_JOB_ACTIVE_STATUSES)
        ).all()
        for job in jobs:
            try:
                recover_stalled_template_change_job(db, job)
            except Exception:
                logger.exception("[STALL] boot recovery failed for template-change job=%s", job.id)
    except Exception:
        logger.exception("[STALL] template-change boot sweep failed")
    finally:
        db.close()


def reap_orphaned_voice_change_jobs() -> None:
    """Boot sweep: any active voice-change job is orphaned (its process is gone)."""
    db = SessionLocal()
    try:
        jobs = db.query(ProjectVoiceChangeJob).filter(
            ProjectVoiceChangeJob.status.in_(_JOB_ACTIVE_STATUSES)
        ).all()
        for job in jobs:
            try:
                recover_stalled_voice_change_job(db, job)
            except Exception:
                logger.exception("[STALL] boot recovery failed for voice-change job=%s", job.id)
    except Exception:
        logger.exception("[STALL] voice-change boot sweep failed")
    finally:
        db.close()


def reap_orphaned_language_change_jobs() -> None:
    """Boot sweep: any active language-change job is orphaned (its process is gone)."""
    db = SessionLocal()
    try:
        jobs = db.query(ProjectLanguageChangeJob).filter(
            ProjectLanguageChangeJob.status.in_(_JOB_ACTIVE_STATUSES)
        ).all()
        for job in jobs:
            try:
                recover_stalled_language_change_job(db, job)
            except Exception:
                logger.exception("[STALL] boot recovery failed for language-change job=%s", job.id)
    except Exception:
        logger.exception("[STALL] language-change boot sweep failed")
    finally:
        db.close()


def _run_regenerate_script_stage_a(job_id: int) -> None:
    """Stage A: regenerate the script + re-plan layouts, then PAUSE for user review.

    Deletes the existing scenes and creates new ones (with planned ``preferred_layout``
    but no ``remotion_code`` yet), then parks the job in ``awaiting_review`` so the user
    can verify the new script before the expensive scene/voiceover stage runs. Re-run on
    "Regenerate" (reject); advanced to stage B on "Proceed" (verify).
    """
    from app.routers.pipeline import _generate_script, _sanitize_script_layouts
    from app.dspy_modules.template_layout_planner import TemplateLayoutPlanner

    db = SessionLocal()
    job_project_id = None
    scene_snapshot_raw = "[]"
    try:
        job = db.query(ProjectRegenerateScriptJob).filter(ProjectRegenerateScriptJob.id == job_id).first()
        if not job:
            return
        project = db.query(Project).filter(Project.id == job.project_id).first()
        if not project:
            # Refund the reserved credit — the project is gone, so the regeneration can't run.
            _mark_regenerate_script_failed(db, job_id, RuntimeError("Project not found."))
            return

        # Read scalar fields into plain locals before db.commit() expires the object
        # and before asyncio.run() can detach the session in the executor thread context.
        job_project_id = job.project_id
        job_user_id = job.user_id
        scene_snapshot_raw = job.scene_snapshot or "[]"
        job_user_instruction = job.user_instruction or ""

        job.status = "running"
        job.current_step = "analyzing_instruction"
        # Reset the pause/scene counters in case this is a re-run after a rejection.
        job.total_scenes = 0
        job.processed_scenes = 0
        db.commit()

        # Phase 1: Regenerate script — deletes existing scenes and creates new ones.
        # _generate_script returns the analyzer's distilled summary so we can
        # hand it to the layout planner below without re-running the analyzer.
        user_instruction_summary = asyncio.run(
            _generate_script(
                project,
                db,
                user_instruction=job_user_instruction,
                progress_callback=lambda step: _set_regenerate_script_step(job_id, step),
            )
        ) or ""

        # Re-fetch job after the async call — asyncio.run() inside a thread executor
        # can leave pre-loaded ORM objects detached from the session.
        job = db.query(ProjectRegenerateScriptJob).filter(ProjectRegenerateScriptJob.id == job_id).first()

        # _generate_script() sets status to SCRIPTED internally; override it back to the
        # dedicated regenerating state so a reload mid-job doesn't auto-start the pipeline.
        project = db.query(Project).filter(Project.id == job_project_id).first()
        if project:
            project.status = ProjectStatus.SCRIPT_REGENERATING
            db.commit()

        # Reload the freshly generated scenes (new titles / narration / visuals produced by
        # _generate_script).
        new_scenes = (
            db.query(Scene)
            .filter(Scene.project_id == job_project_id)
            .order_by(Scene.order)
            .all()
        )
        db.refresh(project)

        # Phase 2.5: Re-plan layouts so they actually change on every regeneration.
        # _generate_script derives layouts (partly) deterministically from the unchanged blog —
        # for data-driven / crafted templates that yields the SAME layout sequence every run.
        # Mirror the (crafted-proven) template-change job: re-plan preferred layouts with the
        # variety-aware planner + sanitizer for ALL template types, then _generate_scenes honors
        # the fresh assignments. No template-type check — every template is treated the same.
        replan_template_id = validate_template_id(
            project.template or "default", db=db, user_id=job_user_id
        )
        replan_supports_ending = "ending_socials" in get_valid_layouts(replan_template_id)
        layout_planner = TemplateLayoutPlanner(
            replan_template_id,
            db=db,
            user_id=job_user_id,
            user_instruction_summary=user_instruction_summary,
        )
        planner_scenes_data = [
            {
                "title": s.title,
                "narration": s.narration_text,
                "visual_description": s.visual_description,
            }
            for s in new_scenes
        ]
        planned_layouts = asyncio.run(
            layout_planner.plan_preferred_layouts(
                scenes_data=planner_scenes_data,
                video_length=getattr(project, "video_length", "auto") or "auto",
                content_language=project.content_language or "English",
            )
        )
        sanitized_pairs = _sanitize_script_layouts(
            replan_template_id,
            [
                {
                    "preferred_layout": (
                        planned_layouts[i].strip()
                        if i < len(planned_layouts) and isinstance(planned_layouts[i], str)
                        else ""
                    )
                }
                for i in range(len(planner_scenes_data))
            ],
            include_ending_socials=replan_supports_ending,
        )
        # Re-load the scenes from the DB right before mutating them. The DSPy
        # planner above runs the model in a worker thread (dspy.asyncify) and
        # _generate_script earlier closed/re-opened this session and bulk-deleted
        # + re-inserted scenes — both can leave the `new_scenes` objects loaded
        # above stale in the identity map. A bulk delete with the default
        # synchronize_session does NOT evict those rows from the session, so a
        # later UPDATE flush can target PKs that no longer exist and raise
        # StaleDataError ("expected to update N row(s); 0 were matched"). Expiring
        # the session and re-querying guarantees the mutation hits live rows.
        db.expire_all()
        fresh_scenes = (
            db.query(Scene)
            .filter(Scene.project_id == job_project_id)
            .order_by(Scene.order)
            .all()
        )
        for i, scene in enumerate(fresh_scenes):
            entry = sanitized_pairs[i] if i < len(sanitized_pairs) else None
            new_layout = (entry.get("preferred_layout") or "") if isinstance(entry, dict) else ""
            if new_layout:
                scene.preferred_layout = new_layout
        db.commit()
        new_scenes = fresh_scenes

        # Phase 2.6: Re-embed TABLE_DATA_HINT_JSON for scenes that Phase 2.5 assigned
        # to a data-viz layout. _generate_script embeds the hint during scene creation,
        # but Phase 2.5 may change which scenes carry a data-viz layout — those scenes
        # won't have the hint yet, and _generate_scenes (stage B) relies on it being
        # present in visual_description. Without this, data-viz scenes get no real chart
        # data and fall back to prose/example data.
        from app.services.table_extraction import (
            classify_chart_tables_for_template,
            build_table_context_hint,
        )
        from app.services.template_service import (
            CHART_TICKER_TEMPLATE_LAYOUTS,
            is_builtin_chart_layout,
            is_builtin_ticker_layout,
        )

        _blog_text = getattr(project, "blog_content", None) or ""
        _all_regen_tables: list[dict] = []
        if replan_template_id in CHART_TICKER_TEMPLATE_LAYOUTS and _blog_text:
            _chart_layout, _ticker_layout = CHART_TICKER_TEMPLATE_LAYOUTS[replan_template_id]
            _all_regen_tables, _ = classify_chart_tables_for_template(
                _blog_text,
                chart_layout=_chart_layout,
                ticker_layout=_ticker_layout,
            )

        if _all_regen_tables:
            # Assign tables round-robin to scenes that carry a data-viz layout but lack
            # the hint. Scenes that already contain TABLE_DATA_HINT_JSON (written by
            # _generate_script for scenes that were already data-viz) keep theirs.
            _TABLE_HINT_MARKER = "TABLE_DATA_HINT_JSON"
            _table_idx = 0
            db.expire_all()
            fresh_scenes_dv = (
                db.query(Scene)
                .filter(Scene.project_id == job_project_id)
                .order_by(Scene.order)
                .all()
            )
            hint_written = False
            for scene in fresh_scenes_dv:
                layout = scene.preferred_layout or ""
                is_dv = is_builtin_chart_layout(layout) or is_builtin_ticker_layout(layout)
                if not is_dv:
                    continue
                vd = scene.visual_description or ""
                if _TABLE_HINT_MARKER in vd:
                    _table_idx += 1
                    continue
                if _table_idx < len(_all_regen_tables):
                    hint = build_table_context_hint(
                        [_all_regen_tables[_table_idx]], max_tables=1, max_rows=20
                    )
                    if hint:
                        scene.visual_description = (vd.rstrip() + "\n\n" + hint).strip()
                        hint_written = True
                    _table_idx += 1
            if hint_written:
                db.commit()
                new_scenes = (
                    db.query(Scene)
                    .filter(Scene.project_id == job_project_id)
                    .order_by(Scene.order)
                    .all()
                )

        logger.info(
            "[REGENERATE_SCRIPT_JOB] job=%s re-planned layouts for template=%s: %s",
            job_id,
            replan_template_id,
            [s.preferred_layout for s in new_scenes],
        )

        # Pause for verification. The new script (with planned layouts) is now in the DB;
        # the frontend reloads the project and shows it for review with Proceed / Regenerate.
        job = db.query(ProjectRegenerateScriptJob).filter(ProjectRegenerateScriptJob.id == job_id).first()
        if job:
            job.status = "awaiting_review"
            job.current_step = "verify"
            db.commit()

    except Exception as e:
        logger.exception("[REGENERATE_SCRIPT_JOB] stage A job=%s failed: %s", job_id, e)
        # Script-gen only touched the DB (audio untouched); restore scenes + workspace.
        _rollback_regenerate_script(db, job_project_id, scene_snapshot_raw, job_id=job_id, restore_audio=False)
        _mark_regenerate_script_failed(db, job_id, e)
    finally:
        db.close()


def _run_regenerate_script_stage_b(job_id: int) -> None:
    """Stage B: generate scene descriptors + voiceovers, finalize, and charge one credit.

    Runs only after the user verifies the regenerated script. On any failure the project
    is fully rolled back — scene rows, on-disk voiceover audio, and the workspace — and no
    credit is deducted.
    """
    from app.routers.pipeline import _generate_scenes

    db = SessionLocal()
    job_project_id = None
    scene_snapshot_raw = "[]"
    audio_backed_up = False
    try:
        job = db.query(ProjectRegenerateScriptJob).filter(ProjectRegenerateScriptJob.id == job_id).first()
        if not job:
            return
        project = db.query(Project).filter(Project.id == job.project_id).first()
        if not project:
            # Refund the reserved credit — the project is gone, so the regeneration can't run.
            _mark_regenerate_script_failed(db, job_id, RuntimeError("Project not found."))
            return

        job_project_id = job.project_id
        scene_snapshot_raw = job.scene_snapshot or "[]"

        new_scenes = (
            db.query(Scene)
            .filter(Scene.project_id == job_project_id)
            .order_by(Scene.order)
            .all()
        )
        job.status = "running"
        job.current_step = "generating_scenes"
        job.total_scenes = len(new_scenes)
        job.processed_scenes = 0
        db.commit()

        # Back up the original voiceover audio BEFORE _generate_scenes overwrites it (req 4).
        # Pull originals from R2 first in case the local cache is cold.
        _ensure_local_audio_from_r2(job_project_id, db)
        _backup_project_audio(job_project_id, job_id)
        audio_backed_up = True

        # Phase 3: Regenerate scene descriptors + layouts AND voiceovers for ALL templates
        # uniformly via the canonical pipeline function (it handles custom/builtin/crafted
        # internally and writes the Remotion workspace data). This is a complete regeneration —
        # voiceover is regenerated from the freshly written narration.
        asyncio.run(
            _generate_scenes(
                project,
                db,
                preserve_image_assignments=False,
                redistribute_images=True,
                # Raise on partial TTS failure so the except branch restores the
                # backed-up original audio instead of shipping silent scenes.
                strict_voiceover=True,
            )
        )

        # _generate_scenes closes/re-checks out the session internally; reload the job,
        # project, and scene handles for the finalize phase.
        job = db.query(ProjectRegenerateScriptJob).filter(ProjectRegenerateScriptJob.id == job_id).first()
        project = db.query(Project).filter(Project.id == job_project_id).first()
        new_scenes = (
            db.query(Scene)
            .filter(Scene.project_id == job_project_id)
            .order_by(Scene.order)
            .all()
        )
        job.processed_scenes = len(new_scenes)
        db.commit()

        # Phase 4: Finalize. The previously rendered video is now stale — drop its R2
        # object (best-effort) and clear the DB pointers so the UI no longer offers the
        # old download.
        old_r2_key = project.r2_video_key
        if old_r2_key:
            try:
                from app.services import r2_storage
                r2_storage.delete_object(old_r2_key)
            except Exception as cleanup_err:
                logger.warning(
                    "[REGENERATE_SCRIPT_JOB] failed to delete stale R2 video %s: %s",
                    old_r2_key,
                    cleanup_err,
                )

        project.status = ProjectStatus.GENERATED
        project.r2_video_key = None
        project.r2_video_url = None
        db.commit()

        # The video credit was already reserved when the job was created; nothing to charge
        # here. Just mark the job complete (the reserved credit is now kept) — unless a
        # stall reaper already claimed (failed/reverted) this job.
        finalized = db.execute(
            update(ProjectRegenerateScriptJob)
            .where(ProjectRegenerateScriptJob.id == job_id, ProjectRegenerateScriptJob.status.in_(_JOB_ACTIVE_STATUSES))
            .values(status="completed", completed_at=datetime.utcnow())
        )
        db.commit()
        if not finalized.rowcount:
            logger.warning("[REGENERATE_SCRIPT_JOB] stage B job=%s already reaped; skipping completion", job_id)
        else:
            # Done — everyone in the room reloads to see the regenerated script + audio.
            # We can't exclude the actor (the job stores the payer/owner, not the
            # collaborator who triggered it), and the actor is polling to completion
            # anyway, so a redundant reload is harmless.
            from app.routers.collab_ws import broadcast_project_reload
            broadcast_project_reload(project.id)

        # Success — the new audio is committed, drop the backup.
        _cleanup_audio_backup(job_project_id, job_id)

    except Exception as e:
        logger.exception("[REGENERATE_SCRIPT_JOB] stage B job=%s failed: %s", job_id, e)
        # Full rollback: scenes + on-disk audio + workspace; do NOT deduct credit.
        _rollback_regenerate_script(
            db, job_project_id, scene_snapshot_raw, job_id=job_id, restore_audio=audio_backed_up
        )
        _mark_regenerate_script_failed(db, job_id, e)
        if job_project_id is not None:
            _cleanup_audio_backup(job_project_id, job_id)
    finally:
        db.close()


async def _assert_instruction_in_context(instruction: str, project: Project) -> None:
    """Raise 422 if the regeneration instruction is completely out of context.

    Lenient: only clearly-unrelated instructions are rejected; valid tone/structure/
    wording feedback always passes. Fails open if there's no blog text to judge against
    or if the classifier errors.
    """
    from app.dspy_modules.instruction_relevance_checker import InstructionRelevanceChecker

    blog_summary = (project.blog_content or "")[:2000]
    if not blog_summary.strip():
        return  # nothing to judge against — accept
    result = await InstructionRelevanceChecker().check(
        user_instruction=instruction, blog_summary=blog_summary
    )
    if not result.get("in_context", True):
        raise HTTPException(
            status_code=422,
            detail=result.get("reason")
            or (
                "This instruction doesn't seem related to your blog or video. Please give "
                "feedback about the script — tone, focus, structure, wording, or what to add or remove."
            ),
        )


class RegenerateScriptRequest(BaseModel):
    user_instruction: str | None = None


@router.post(
    "/{project_id}/regenerate-script",
    response_model=ProjectRegenerateScriptJobOut,
)
async def regenerate_script(
    project_id: int,
    body: RegenerateScriptRequest = RegenerateScriptRequest(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Regenerate the video script with user-supplied instructions.

    The popup captures free-form text plus optional .txt/.md content merged in
    client-side. The instruction is required (validated below) and is fed through
    a DSPy analyzer into the script generator + layout planner.
    """
    instruction = (body.user_instruction or "").strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="user_instruction is required")
    if len(instruction) > 25_000:
        raise HTTPException(
            status_code=400, detail="user_instruction is too long (max 25,000 characters)"
        )

    project = _get_user_project(project_id, user.id, db)

    # Only one long-running job per project across all types (another user may have
    # started a template change, voice regen, or render).
    _assert_no_active_job(project.id, db)

    active_job = (
        db.query(ProjectRegenerateScriptJob)
        .filter(
            ProjectRegenerateScriptJob.project_id == project.id,
            ProjectRegenerateScriptJob.status.in_(_ACTIVE_REGENERATE_SCRIPT_STATUSES),
        )
        .order_by(ProjectRegenerateScriptJob.id.desc())
        .first()
    )
    if active_job:
        raise HTTPException(status_code=409, detail="A script regeneration job is already running for this project.")

    # Owner pays: on a shared project the video credit is charged to the OWNER, not
    # the acting collaborator.
    from app.services.access import project_owner, video_limit_message
    payer = project_owner(project, db)
    payer.roll_video_period_if_due(db)
    payer.sync_video_limit_bonus(db)
    if not payer.can_create_video:
        raise HTTPException(
            status_code=403,
            detail=video_limit_message(payer, user, "regenerate the script"),
        )

    # Snapshot only ACTIVE scenes — soft-deleted scenes are hidden from the user, so the
    # awaiting-review comparison must show them on neither side (the "new" scenes come
    # from the active-only project.scenes relationship).
    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project.id, Scene.is_active == True)  # noqa: E712
        .order_by(Scene.order)
        .all()
    )
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found. Generate the video first.")

    # Reject instructions that are completely unrelated to the blog/script before doing any
    # destructive work or reserving a credit. Fails open on classifier error.
    await _assert_instruction_in_context(instruction, project)

    scene_snapshot = [
        {
            "order": s.order,
            "title": s.title,
            "narration_text": s.narration_text,
            "display_text": s.display_text,
            "visual_description": s.visual_description,
            "remotion_code": s.remotion_code,
            "voiceover_path": s.voiceover_path,
            "duration_seconds": s.duration_seconds,
            "extra_hold_seconds": s.extra_hold_seconds,
            "preferred_layout": s.preferred_layout,
            "scene_type": s.scene_type,
        }
        for s in scenes
    ]

    job = ProjectRegenerateScriptJob(
        project_id=project.id,
        # Payer = project owner. Charge and refund both key off this.
        user_id=payer.id,
        # The collaborator who initiated the regen — only they may approve/regenerate.
        initiated_by_user_id=user.id,
        status="queued",
        current_step="analyzing_instruction",
        total_scenes=0,
        processed_scenes=0,
        scene_snapshot=json.dumps(scene_snapshot),
        user_instruction=instruction,
    )
    db.add(job)
    project.status = ProjectStatus.SCRIPT_REGENERATING
    # Reserve the video credit upfront (same as new-project creation) so a concurrent
    # generation can't double-spend the last credit. Refunded on any failure (in-job
    # exception or crash recovery); kept once the regeneration succeeds.
    payer.videos_used_this_period += 1
    # Log a non-revertable history entry for the script regeneration.
    from app.services.edit_tracker import log_project_event, prune_project_history
    log_project_event(
        db, project_id=project.id, label="Script regenerated", user_id=user.id,
    )
    prune_project_history(db, project.id)
    db.commit()
    db.refresh(job)

    # Tell live collaborators to refetch so they see the script regeneration start.
    # Exclude the acting user — they already transitioned locally. Async endpoint →
    # await the broadcast directly (see change_project_template_regenerate_layouts).
    from app.routers.collab_ws import collab_manager
    await collab_manager.broadcast(
        project.id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run_regenerate_script_stage_a, job.id)
    return job


@router.get(
    "/{project_id}/regenerate-script-status",
    response_model=ProjectRegenerateScriptJobOut | None,
)
def get_regenerate_script_status(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll the status of the latest script regeneration job for a project."""
    _ = _get_user_project(project_id, user.id, db)
    job = (
        db.query(ProjectRegenerateScriptJob)
        .filter(ProjectRegenerateScriptJob.project_id == project_id)
        .order_by(ProjectRegenerateScriptJob.id.desc())
        .first()
    )
    # Stall recovery: reap a stuck job (awaiting_review is never reaped — it only
    # matches active statuses), then return the now-failed job for the retry popup.
    if maybe_reap_stale_regenerate_script(db, job):
        db.refresh(job)
    return job


def _get_awaiting_review_job(project_id: int, user_id: int, db: Session) -> ProjectRegenerateScriptJob:
    """Fetch the latest regenerate-script job for the project, asserting it is paused for review.

    Only the collaborator who INITIATED the regeneration may approve/regenerate it, so
    other collaborators viewing the review can't act on someone else's pending script.
    """
    _ = _get_user_project(project_id, user_id, db)
    job = (
        db.query(ProjectRegenerateScriptJob)
        .filter(ProjectRegenerateScriptJob.project_id == project_id)
        .order_by(ProjectRegenerateScriptJob.id.desc())
        .first()
    )
    if not job or job.status != "awaiting_review":
        raise HTTPException(
            status_code=409,
            detail="No script regeneration is awaiting review for this project.",
        )
    # Enforce actor-only review. Legacy jobs (created before this column existed) have
    # a null initiator — fall back to allowing any editor so they aren't permanently stuck.
    if job.initiated_by_user_id is not None and job.initiated_by_user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Only the collaborator who started this script regeneration can review it.",
        )
    return job


@router.get(
    "/{project_id}/regenerate-script/preview",
    response_model=RegenerateScriptPreviewOut,
)
def get_regenerate_script_preview(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the previous (pre-regeneration) scenes for the verify-step before/after comparison.

    The original scenes live only in the paused job's snapshot — the live Scene rows now hold the
    newly regenerated script. Only valid while the job is awaiting review.
    """
    job = _get_awaiting_review_job(project_id, user.id, db)
    try:
        snapshot = json.loads(job.scene_snapshot or "[]")
    except Exception:
        snapshot = []
    previous = [
        RegenerateScriptPreviewScene(
            order=s.get("order", i),
            title=s.get("title", "") or "",
            display_text=s.get("display_text"),
            narration_text=s.get("narration_text", "") or "",
            visual_description=s.get("visual_description", "") or "",
            remotion_code=s.get("remotion_code"),
            preferred_layout=s.get("preferred_layout"),
        )
        for i, s in enumerate(snapshot)
        if isinstance(s, dict)
    ]
    previous.sort(key=lambda p: p.order)
    return RegenerateScriptPreviewOut(previous_scenes=previous)


@router.post(
    "/{project_id}/regenerate-script/verify",
    response_model=ProjectRegenerateScriptJobOut,
)
async def verify_regenerate_script(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve the regenerated script and resume into scene/voiceover generation (stage B)."""
    job = _get_awaiting_review_job(project_id, user.id, db)
    job.status = "running"
    job.current_step = "generating_scenes"
    db.commit()
    db.refresh(job)

    # Tell live collaborators to refetch as scene/voiceover generation begins.
    # Exclude the acting user — they already transitioned locally. Async endpoint →
    # await the broadcast directly.
    from app.routers.collab_ws import collab_manager
    await collab_manager.broadcast(
        project_id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run_regenerate_script_stage_b, job.id)
    return job


class RegenerateScriptRetryRequest(BaseModel):
    user_instruction: str | None = None


@router.post(
    "/{project_id}/regenerate-script/regenerate",
    response_model=ProjectRegenerateScriptJobOut,
)
async def reject_regenerate_script(
    project_id: int,
    body: RegenerateScriptRetryRequest = RegenerateScriptRetryRequest(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Discard the regenerated script and re-run stage A (optionally with a new instruction).

    No credit is charged — only the final verify -> stage B finalize charges one credit.
    """
    job = _get_awaiting_review_job(project_id, user.id, db)
    project = db.query(Project).filter(Project.id == project_id).first()

    new_instruction = (body.user_instruction or "").strip()
    if new_instruction:
        if len(new_instruction) > 25_000:
            raise HTTPException(
                status_code=400, detail="user_instruction is too long (max 25,000 characters)"
            )
        # Only the newly-provided instruction needs validating — the existing one was already
        # accepted when the job was created. Reject up front before re-running stage A.
        if project:
            await _assert_instruction_in_context(new_instruction, project)
        job.user_instruction = new_instruction

    job.status = "queued"
    job.current_step = "analyzing_instruction"
    if project:
        project.status = ProjectStatus.SCRIPT_REGENERATING
    db.commit()
    db.refresh(job)

    if project:
        # Exclude the acting user — they already transitioned locally. Async endpoint →
        # await the broadcast directly.
        from app.routers.collab_ws import collab_manager
        await collab_manager.broadcast(
            project.id, {"type": "project_reloaded"}, exclude_user_id=user.id
        )

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run_regenerate_script_stage_a, job.id)
    return job


def _apply_logo_to_project(
    project_id: int,
    user_id: int,
    file_bytes: bytes,
    content_type: str,
    filename: str | None,
    request: Request,
    db: Session,
) -> None:
    """Save logo file for a project (local + R2) and update project. Caller must commit."""
    project = _get_user_project(project_id, user_id, db)
    logo_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}")
    os.makedirs(logo_dir, exist_ok=True)
    ext = filename.rsplit(".", 1)[-1] if filename and "." in filename else "png"
    logo_filename = f"logo.{ext}"
    local_path = os.path.join(logo_dir, logo_filename)
    with open(local_path, "wb") as f:
        f.write(file_bytes)
    if r2_storage.is_r2_configured():
        try:
            r2_key = r2_storage.image_key(user_id, project_id, logo_filename)
            r2_url = r2_storage.upload_file(local_path, r2_key, content_type=content_type)
            project.logo_r2_key = r2_key
            project.logo_r2_url = r2_url
        except Exception as e:
            logger.error(
                "[PROJECTS] Logo R2 upload failed for project %s: %s",
                project_id,
                e,
                extra={"project_id": project_id, "user_id": user_id},
            )
            project.logo_r2_key = None
            project.logo_r2_url = None
    if not project.logo_r2_url:
        base = str(request.base_url).rstrip("/")
        project.logo_r2_url = f"{base}/media/projects/{project_id}/{logo_filename}"
    db.commit()
    db.refresh(project)


@router.post("/bulk", response_model=BulkCreateResponse)
def create_projects_bulk(
    request: Request,
    projects_json: str = Form(..., alias="projects"),
    logo_indices_json: Optional[str] = Form(None, alias="logo_indices"),
    logos: Optional[list[UploadFile]] = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create multiple projects from URLs. Per-project logos via logo_indices + logos[]."""
    import json
    try:
        raw = json.loads(projects_json)
        if not isinstance(raw, list):
            raise ValueError("projects must be an array")
        items = [BulkProjectItem(**x) for x in raw]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid projects JSON: {e}")
    if not items:
        raise HTTPException(status_code=400, detail="At least one project is required.")
    needed = len(items)
    remaining = user.video_limit - user.videos_used_this_period
    if user.plan == PlanTier.FREE and needed > max(1, remaining):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "upgrade_required_bulk",
                "message": "That many videos at once exceeds your remaining free quota. Create fewer links now, or upgrade for higher limits and bulk creation.",
            },
        )
    if user.videos_used_this_period + needed > user.video_limit:
        raise HTTPException(
            status_code=403,
            detail=f"Sorry, your video limit has been reached. Please upgrade your plan or buy more credits.",
        )
    # Custom templates are usable on any plan (incl. Free) — gated by video credits
    # (checked above) and the template-creation cap, not subscription tier.
    logo_indices: list[int] = []
    if logo_indices_json:
        try:
            logo_indices = json.loads(logo_indices_json)
            if not isinstance(logo_indices, list):
                logo_indices = []
            else:
                logo_indices = [int(x) for x in logo_indices if isinstance(x, (int, float))]
        except Exception:
            logo_indices = []
    logo_files: list[UploadFile] = list(logos) if logos else []
    if len(logo_indices) != len(logo_files):
        logo_indices = []
        logo_files = []
    allowed = {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}
    MAX_LOGO_SIZE = 2 * 1024 * 1024
    logo_payloads: list[tuple[int, bytes, str, Optional[str]]] = []
    for j, idx in enumerate(logo_indices):
        if j >= len(logo_files) or idx < 0:
            continue
        f = logo_files[j]
        if not f or not f.filename:
            continue
        if f.content_type not in allowed:
            raise HTTPException(status_code=400, detail="Logo must be PNG, JPEG, WebP, or SVG.")
        raw_bytes = f.file.read()
        if len(raw_bytes) > MAX_LOGO_SIZE:
            raise HTTPException(status_code=400, detail="Logo file too large. Maximum size is 2 MB.")
        logo_payloads.append((idx, raw_bytes, f.content_type or "image/png", f.filename))
    created: list[Project] = []
    for data in items:
        if not (data.blog_url and data.blog_url.strip()):
            continue
        name = (data.name or "").strip() or _name_from_url(data.blog_url)
        template_id = validate_template_id(data.template, db=db, user_id=user.id)
        if is_crafted_template(template_id) and not validate_crafted_template_access(template_id, user.id, db):
            raise HTTPException(
                status_code=403,
                detail="You do not have access to one or more crafted templates in this bulk request.",
            )
        colors = get_preview_colors(template_id)
        normalized_video_style = _normalize_video_style(data.video_style)
        voice_tuning, voice_tuning_pref = _resolve_voice_tuning(data.voice_emotion, user)
        if voice_tuning_pref is not None:
            user.preferred_voice_emotion = voice_tuning_pref
        project = Project(
            user_id=user.id,
            name=name,
            blog_url=data.blog_url.strip(),
            template=template_id,
            crafted_template_id=_crafted_template_pk(template_id, db),
            voice_gender=data.voice_gender or "female",
            voice_accent=_normalize_voice_accent_for_db(data.voice_accent),
            voice_emotion=voice_tuning,
            accent_color=data.accent_color or (colors.get("accent") if colors else None) or "#7C3AED",
            bg_color=data.bg_color or (colors.get("bg") if colors else None) or "#FFFFFF",
            text_color=data.text_color or (colors.get("text") if colors else None) or "#000000",
            font_family=data.font_family or None,
            animation_instructions=data.animation_instructions or None,
            logo_position=data.logo_position or "bottom_right",
            logo_opacity=data.logo_opacity if data.logo_opacity is not None else 0.9,
            custom_voice_id=data.custom_voice_id or None,
            aspect_ratio=data.aspect_ratio or "landscape",
            video_style=normalized_video_style,
            video_length=_normalize_video_length(getattr(data, "video_length", None)),
            playback_speed=_normalize_playback_speed(getattr(data, "playback_speed", None)),
            content_language=normalize_preferred_language_code(data.content_language),
            bgm_track_id=getattr(data, "bgm_track_id", None) or None,
            bgm_volume=getattr(data, "bgm_volume", None) or 0.10,
            captions_enabled=bool(getattr(data, "captions_enabled", False)),
            caption_position=getattr(data, "caption_position", None) or "bottom_center",
            caption_font_family=getattr(data, "caption_font_family", None) or "inter",
            caption_font_size=getattr(data, "caption_font_size", None) or "36",
            caption_offset=int(getattr(data, "caption_offset", 0) or 0),
            status=ProjectStatus.CREATED,
        )
        db.add(project)
        db.flush()
        _seed_project_logo_from_brand_kit(project, db)
        created.append(project)
        user.videos_used_this_period += 1
    if not created:
        raise HTTPException(status_code=400, detail="No valid project URLs provided.")
    db.commit()
    for p in created:
        db.refresh(p)
    project_ids = [p.id for p in created]
    for idx, raw_bytes, content_type, filename in logo_payloads:
        if idx >= len(created):
            continue
        p = created[idx]
        try:
            _apply_logo_to_project(p.id, user.id, raw_bytes, content_type, filename, request, db)
        except Exception as e:
            logger.error(
                "[PROJECTS] Bulk logo apply failed for project %s: %s",
                p.id,
                e,
                extra={"project_id": p.id, "user_id": user.id},
            )
    return BulkCreateResponse(project_ids=project_ids)


@router.post("/upload", response_model=ProjectOut)
def create_project_from_upload(
    request: Request,
    files: list[UploadFile] = File(...),
    name: Optional[str] = Form(None),
    voice_gender: Optional[str] = Form("female"),
    voice_accent: Optional[str] = Form("american"),
    accent_color: Optional[str] = Form(None),
    bg_color: Optional[str] = Form(None),
    text_color: Optional[str] = Form(None),
    animation_instructions: Optional[str] = Form(None),
    logo_position: Optional[str] = Form("bottom_right"),
    logo_opacity: Optional[float] = Form(0.9),
    custom_voice_id: Optional[str] = Form(None),
    voice_emotion: Optional[str] = Form(None),
    aspect_ratio: Optional[str] = Form("landscape"),
    template: Optional[str] = Form(None),
    video_style: Optional[str] = Form("explainer"),
    video_length: Optional[str] = Form("auto"),
    content_language: Optional[str] = Form(None),
    bgm_track_id: Optional[str] = Form(None),
    bgm_volume: Optional[float] = Form(0.10),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project from uploaded documents (PDF, DOCX, PPTX, MD, TXT). Counts against video limit."""
    user.roll_video_period_if_due(db)
    if not user.can_create_video:
        raise HTTPException(
            status_code=403,
            detail=f"Video limit reached ({user.video_limit}). Upgrade to Pro for 100 videos/month.",
        )

    # ── Validate files ────────────────────────────────────
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="At least one file is required.")
    if len(files) > _MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"Maximum {_MAX_UPLOAD_FILES} files allowed.")

    for f in files:
        # Check by extension (MIME types can be unreliable for Office files)
        file_ext = os.path.splitext(f.filename or "")[1].lower() if f.filename else ""
        if file_ext not in _ALLOWED_EXTENSIONS and f.content_type not in _ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' is not supported. Accepted formats: PDF, DOCX, PPTX, MD, TXT, VTT.",
            )
        # Check file size (read content to measure, then reset)
        content = f.file.read()
        if len(content) > _MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' exceeds the 5 MB size limit.",
            )
        f.file.seek(0)  # Reset for later reading

    # ── Create project ────────────────────────────────────
    project_name = name or _name_from_files(files)
    template_id = validate_template_id(template, db=db, user_id=user.id)
    # Custom templates are usable on any plan (incl. Free) — gated by video credits and
    # the template-creation cap, not subscription tier. See create_project.
    if is_crafted_template(template_id) and not validate_crafted_template_access(template_id, user.id, db):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this crafted template.",
        )
    colors = get_preview_colors(template_id)
    normalized_video_style = _normalize_video_style(video_style)
    resolved_voice_tuning, resolved_voice_tuning_pref = _resolve_voice_tuning(voice_emotion, user)
    logger.info(
        "[PROJECTS] Creating project from upload: template='%s', validated='%s'",
        template,
        template_id,
        extra={"user_id": user.id},
    )
    project = Project(
        user_id=user.id,
        name=project_name,
        blog_url="upload://documents",
        template=template_id,
        crafted_template_id=_crafted_template_pk(template_id, db),
        voice_gender=voice_gender or "female",
        voice_accent=_normalize_voice_accent_for_db(voice_accent),
        voice_emotion=resolved_voice_tuning,
        accent_color=accent_color or (colors.get("accent") if colors else None) or "#7C3AED",
        bg_color=bg_color or (colors.get("bg") if colors else None) or "#FFFFFF",
        text_color=text_color or (colors.get("text") if colors else None) or "#000000",
        animation_instructions=animation_instructions or None,
        logo_position=logo_position or "bottom_right",
        logo_opacity=logo_opacity if logo_opacity is not None else 0.9,
        custom_voice_id=custom_voice_id or None,
        aspect_ratio=aspect_ratio or "landscape",
        video_style=normalized_video_style,
        video_length=_normalize_video_length(video_length),
        playback_speed=_normalize_playback_speed(None),
        content_language=normalize_preferred_language_code(content_language),
        bgm_track_id=bgm_track_id or None,
        bgm_volume=bgm_volume if bgm_volume is not None else 0.10,
        status=ProjectStatus.CREATED,
    )
    db.add(project)
    db.flush()
    _seed_project_logo_from_brand_kit(project, db)
    if resolved_voice_tuning_pref is not None:
        user.preferred_voice_emotion = resolved_voice_tuning_pref
    user.videos_used_this_period += 1
    db.commit()
    db.refresh(project)
    logger.info(
        "[PROJECTS] Project %s created with template='%s', video_style='%s'",
        project.id,
        project.template,
        project.video_style,
        extra={"project_id": project.id, "user_id": user.id},
    )

    # ── Extract text + images from documents ────────────────
    try:
        project = extract_from_documents(project, files, db)
    except Exception as e:
        logger.error(
            "[PROJECTS] Document extraction failed for project %s: %s",
            project.id,
            e,
            extra={"project_id": project.id, "user_id": user.id},
        )
        pid = project.id
        try:
            db.rollback()
        except Exception:
            pass
        proj = db.query(Project).filter(Project.id == pid, Project.user_id == user.id).first()
        if proj:
            try:
                remove_failed_generation_project(db, proj, decrement_user_video_quota=True)
            except Exception as cleanup_err:
                logger.exception(
                    "[PROJECTS] Failed to roll back project %s after extraction error: %s",
                    pid,
                    cleanup_err,
                    extra={"project_id": pid, "user_id": user.id},
                )
                try:
                    db.rollback()
                except Exception:
                    pass
        raise HTTPException(status_code=500, detail=PUBLIC_MSG_PIPELINE_FAILED)

    return _prepare_project_response(project, user, db)


@router.post("/{project_id}/upload-documents", response_model=ProjectOut)
def upload_documents_to_project(
    project_id: int,
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload documents to an existing project and extract text + images."""
    project = _get_user_project(project_id, user.id, db)

    if project.status != ProjectStatus.CREATED:
        raise HTTPException(status_code=400, detail="Project already has content.")

    # Validate files
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="At least one file is required.")
    if len(files) > _MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"Maximum {_MAX_UPLOAD_FILES} files allowed.")

    for f in files:
        file_ext = os.path.splitext(f.filename or "")[1].lower() if f.filename else ""
        if file_ext not in _ALLOWED_EXTENSIONS and f.content_type not in _ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' is not supported. Accepted formats: PDF, DOCX, PPTX, MD, TXT, VTT.",
            )
        content = f.file.read()
        if len(content) > _MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' exceeds the 5 MB size limit.",
            )
        f.file.seek(0)

    try:
        project = extract_from_documents(project, files, db)
    except Exception as e:
        logger.error(
            "[PROJECTS] Document extraction failed for project %s: %s",
            project.id,
            e,
            extra={"project_id": project.id, "user_id": user.id},
        )
        pid = project.id
        try:
            db.rollback()
        except Exception:
            pass
        proj = db.query(Project).filter(Project.id == pid, Project.user_id == user.id).first()
        if proj:
            try:
                remove_failed_generation_project(db, proj, decrement_user_video_quota=True)
            except Exception as cleanup_err:
                logger.exception(
                    "[PROJECTS] Failed to roll back project %s after upload-documents error: %s",
                    pid,
                    cleanup_err,
                    extra={"project_id": pid, "user_id": user.id},
                )
                try:
                    db.rollback()
                except Exception:
                    pass
        raise HTTPException(status_code=500, detail=PUBLIC_MSG_PIPELINE_FAILED)

    return _prepare_project_response(project, user, db)


@router.post("/{project_id}/logo")
def upload_logo(
    project_id: int,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a logo image for the project. Stored in R2."""
    _get_user_project(project_id, user.id, db)
    allowed_types = {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Logo must be PNG, JPEG, WebP, or SVG.")
    MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB
    file_bytes = file.file.read()
    if len(file_bytes) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=400, detail="Logo file too large. Maximum size is 2 MB.")
    _apply_logo_to_project(
        project_id, user.id, file_bytes, file.content_type or "image/png",
        file.filename, request, db,
    )
    project = _get_user_project(project_id, user.id, db)
    return {"logo_url": project.logo_r2_url, "logo_position": project.logo_position}


@router.delete("/{project_id}/logo")
def delete_logo(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove the project's uploaded logo (clears R2 object + local file + refs)."""
    project = _get_user_project(project_id, user.id, db)

    if r2_storage.is_r2_configured() and project.logo_r2_key:
        try:
            r2_storage.delete_object(project.logo_r2_key)
        except Exception as e:
            logger.error(
                "[PROJECTS] Logo R2 delete failed for project %s: %s",
                project_id,
                e,
                extra={"project_id": project_id, "user_id": user.id},
            )

    logo_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}")
    if os.path.isdir(logo_dir):
        for name in os.listdir(logo_dir):
            if name.startswith("logo."):
                try:
                    os.remove(os.path.join(logo_dir, name))
                except OSError:
                    pass

    project.logo_r2_key = None
    project.logo_r2_url = None
    db.commit()
    return {"detail": "Logo removed"}


@router.get("", response_model=list[ProjectListOut])
def list_projects(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List projects the user owns OR collaborates on. Scene count via subquery."""
    from app.models.project_member import ProjectMember, MemberStatus
    from app.models.user import User as _User

    scene_counts = (
        db.query(Scene.project_id, func.count(Scene.id).label("cnt"))
        .filter(Scene.is_active == True)  # noqa: E712  exclude soft-deleted scenes
        .group_by(Scene.project_id)
        .subquery()
    )

    # Project ids where the user is an accepted collaborator (excludes their own
    # OWNER rows, which are covered by the ownership filter below).
    shared_ids = {
        pid
        for (pid,) in db.query(ProjectMember.project_id).filter(
            ProjectMember.user_id == user.id,
            ProjectMember.status == MemberStatus.ACCEPTED,
        )
    }

    rows = (
        db.query(
            Project,
            func.coalesce(scene_counts.c.cnt, 0).label("scene_count"),
        )
        .outerjoin(scene_counts, Project.id == scene_counts.c.project_id)
        .filter(
            Project.is_active == True,  # noqa: E712
            or_(Project.user_id == user.id, Project.id.in_(shared_ids) if shared_ids else False),
        )
        .order_by(Project.created_at.desc())
        .all()
    )

    # Resolve owner display names for shared projects (for "Shared by X" labels).
    owner_ids = {p.user_id for p, _ in rows if p.user_id != user.id}
    owner_names = {
        u.id: u.name
        for u in db.query(_User).filter(_User.id.in_(owner_ids)).all()
    } if owner_ids else {}

    return [
        ProjectListOut(
            id=p.id,
            name=p.name,
            blog_url=p.blog_url,
            status=p.status.value,
            created_at=p.created_at,
            updated_at=p.updated_at,
            scene_count=int(scene_count),
            role="owner" if p.user_id == user.id else "editor",
            owner_name=None if p.user_id == user.id else owner_names.get(p.user_id),
        )
        for p, scene_count in rows
    ]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single project with all its scenes and assets."""
    project = _get_user_project(project_id, user.id, db)
    return _prepare_project_response(project, user, db)


@router.get("/{project_id}/render-still")
def render_project_still(
    project_id: int,
    frame: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Render and return a single PNG frame via Remotion for pixel-perfect slide exports."""
    if frame < 0:
        raise HTTPException(status_code=400, detail="frame must be >= 0")
    project = _get_user_project(project_id, user.id, db)
    try:
        # Keep still-render workspace in sync with the latest DB scene state.
        write_remotion_data(project, list(project.scenes), db)
        output_path = render_still(project, frame)
    except Exception as exc:
        logger.exception("render-still failed project=%s frame=%s", project_id, frame)
        raise HTTPException(status_code=500, detail=f"Could not render still frame: {exc}") from exc

    return FileResponse(
        output_path,
        media_type="image/png",
        filename=f"project_{project_id}_frame_{frame}.png",
    )


@router.post("/{project_id}/review", response_model=ReviewSubmitResponse)
def submit_project_review(
    project_id: int,
    payload: ReviewSubmit,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_user_project(project_id, user.id, db)
    project_sequence = _get_project_sequence(project, user, db)

    review = (
        db.query(Review)
        .filter(Review.user_id == user.id, Review.project_id == project.id)
        .first()
    )
    if review is None:
        review = Review(user_id=user.id, project_id=project.id)
        db.add(review)

    review.rating = payload.rating
    review.suggestion = payload.suggestion
    review.source = payload.source
    review.trigger_event = payload.trigger_event
    review.project_sequence = project_sequence
    review.plan_at_submission = user.plan.value if hasattr(user.plan, "value") else str(user.plan)

    db.commit()
    db.refresh(review)

    if review.rating < 2:
        try:
            email_service.send_low_rating_alert_email(
                user_name=user.name,
                user_email=user.email,
                project_id=project.id,
                project_name=project.name,
                rating=review.rating,
                suggestion=review.suggestion,
                plan=review.plan_at_submission,
            )
        except EmailServiceError:
            logger.exception("Failed to send low-rating alert email for review %s", review.id)

    return ReviewSubmitResponse(
        review=ReviewOut.model_validate(review),
        review_state=_build_review_state(project, user, db),
    )


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually delete a project row from DB and remove all project storage."""
    # Owner-only: collaborators may edit but must not delete a shared project.
    project = _get_user_project(project_id, user.id, db, required_role="owner")

    # Ensure any active render subprocess is terminated before deleting files/DB row.
    try:
        cancel_running_render(project.id, reason="Render cancelled because project was deleted.")
    except Exception as e:
        logger.warning(
            "[PROJECTS] Failed to cancel active render for project %s before delete: %s",
            project.id,
            e,
            extra={"project_id": project.id, "user_id": user.id},
        )

    # Delete all project files from R2 (images/audio/video/logo)
    if r2_storage.is_r2_configured():
        try:
            r2_storage.delete_project_files(project.user_id, project.id)
        except Exception as e:
            print(f"[PROJECTS] R2 cleanup failed for project {project.id}: {e}")

    # Delete local files
    project_media = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}")
    if os.path.exists(project_media):
        safe_remove_workspace(get_workspace_dir(project.id))
        shutil.rmtree(project_media, ignore_errors=True)

    db.delete(project)
    db.commit()
    return {"detail": "Project deleted"}


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project_logo(
    project_id: int,
    data: ProjectLogoUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update project logo settings (position, size, opacity)."""
    project = _get_user_project(project_id, user.id, db)
    if data.logo_position is not None:
        project.logo_position = data.logo_position
    if data.logo_size is not None:
        project.logo_size = data.logo_size
    if data.logo_opacity is not None:
        project.logo_opacity = data.logo_opacity
    db.commit()
    db.refresh(project)
    return _prepare_project_response(project, user, db)


@router.patch("/{project_id}/assets/{asset_id}/exclude")
def toggle_asset_exclusion(
    project_id: int,
    asset_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle an image's excluded status (paid users only)."""
    from app.models.asset import Asset

    if user.plan == "free":
        raise HTTPException(
            status_code=403,
            detail="Image editing is a Pro feature. Upgrade to exclude images.",
        )

    _get_user_project(project_id, user.id, db)

    asset = (
        db.query(Asset)
        .filter(Asset.id == asset_id, Asset.project_id == project_id)
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset.excluded = not asset.excluded
    db.commit()
    db.refresh(asset)
    return {"id": asset.id, "excluded": asset.excluded}


@router.delete("/{project_id}/assets/{asset_id}")
def delete_asset(
    project_id: int,
    asset_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an asset (image) from the project. Removes from DB and optionally from R2.
    Also clears assignedImage from any scenes that reference this image."""
    from app.models.asset import Asset
    from app.models.scene import Scene
    import json

    _get_user_project(project_id, user.id, db)

    asset = (
        db.query(Asset)
        .filter(Asset.id == asset_id, Asset.project_id == project_id)
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    local_path = asset.local_path
    r2_key = asset.r2_key

    # If this is an image, clear assignedImage from scenes that reference it
    # and mark those scenes as hideImage=true so they won't get a new generic
    # image auto-assigned later.
    if asset.asset_type.value == "image":
        deleted_filename = asset.filename
        scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
        for scene in scenes:
            if not scene.remotion_code:
                continue
            try:
                desc = json.loads(scene.remotion_code)
                layout_props = desc.get("layoutProps", {}) or {}
                assigned_image = layout_props.get("assignedImage")
                if assigned_image == deleted_filename:
                    _clear_image_assignment(layout_props)
                    layout_props["hideImage"] = True
                    desc["layoutProps"] = layout_props
                    scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(desc))
            except (json.JSONDecodeError, TypeError):
                continue

    db.delete(asset)
    db.commit()

    if local_path and os.path.isfile(local_path):
        try:
            os.remove(local_path)
        except OSError as e:
            logger.warning(
                "[PROJECTS] Failed to remove local file %s: %s",
                local_path,
                e,
                extra={"project_id": project_id, "user_id": user.id},
            )
    if r2_key:
        try:
            r2_storage.delete_file(r2_key)
        except Exception as e:
            logger.warning(
                "[PROJECTS] R2 delete failed for %s: %s",
                r2_key,
                e,
                extra={"project_id": project_id, "user_id": user.id},
            )

    return {"detail": "Asset deleted"}


MANUAL_TRACKED_FIELDS = {
    "title",
    "display_text",
    "remotion_code",  # carries per-scene font sizes, colors, and layout in its descriptor JSON
    "narration_text",
    "visual_description",
    "duration_seconds",
    "extra_hold_seconds",
    "bgm_volume",
    "preferred_layout",
}


class SceneImageFocusUpdate(BaseModel):
    image_focus_x: float = Field(default=50, ge=0, le=100)
    image_focus_y: float = Field(default=50, ge=0, le=100)
    image_zoom: float | None = Field(default=None, ge=0.1, le=12)


class SceneImageMoveRequest(BaseModel):
    from_scene_id: int
    to_scene_id: int


class SceneImageSwapRequest(BaseModel):
    first_scene_id: int
    second_scene_id: int


class SceneImageDuplicateRequest(BaseModel):
    source_scene_id: int
    target_scene_id: int


class SceneImageAssignExistingRequest(BaseModel):
    scene_id: int
    asset_id: int


class GenerateSceneImageRequest(BaseModel):
    image_description: str = Field(min_length=3, max_length=4000)


def _parse_scene_descriptor(scene: Scene) -> dict:
    if not scene.remotion_code:
        return {}
    try:
        parsed = json.loads(scene.remotion_code)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _scene_supports_images(project: Project, scene: Scene) -> bool:
    descriptor = _parse_scene_descriptor(scene)
    layout = _extract_layout_from_descriptor_obj(descriptor, project.template) or ""
    return layout not in get_layouts_without_image(project.template)


@router.put("/{project_id}/scenes/{scene_id}", response_model=SceneOut)
def update_scene(
    project_id: int,
    scene_id: int,
    data: SceneUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually update a scene."""
    from app.models.scene import Scene

    # Verify ownership
    project = _get_user_project(project_id, user.id, db)

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    update_data = data.model_dump(exclude_unset=True)
    # Group every field changed by this one request into a single change-set so
    # they preview and revert atomically, attributed to the acting user.
    from app.services.edit_tracker import new_change_set_id
    change_set_id = new_change_set_id()
    _broadcast_changes: list[tuple[str, object]] = []
    for key, value in update_data.items():
        if key not in MANUAL_TRACKED_FIELDS:
            continue

        if key == "remotion_code" and isinstance(value, str) and value.strip():
            try:
                parsed_descriptor = json.loads(value)
                if isinstance(parsed_descriptor, dict):
                    value = json.dumps(_sanitize_descriptor_for_data_viz(parsed_descriptor))
                    # Skip when the descriptor is semantically unchanged: the frontend
                    # always re-sends remotion_code even for a title-only edit, and
                    # re-serialization (key order / whitespace / sanitization) can
                    # differ from the stored string. Compare parsed dicts, not strings,
                    # so we don't record a spurious remotion_code edit.
                    old_raw = getattr(scene, key)
                    try:
                        old_parsed = json.loads(old_raw) if old_raw else None
                    except Exception:
                        old_parsed = None
                    new_parsed = json.loads(value)
                    if old_parsed == new_parsed:
                        continue
            except Exception:
                pass

        old_value = getattr(scene, key)

        track_scene_edit(
            db,
            project_id=project.id,
            scene_id=scene.id,
            field_name=key,
            old_value=old_value,
            new_value=value,
            is_ai_assisted=False,
            user_id=user.id,
            change_set_id=change_set_id,
        )

        setattr(scene, key, value)
        _broadcast_changes.append((key, value))

    from app.services.edit_tracker import prune_project_history
    prune_project_history(db, project.id)

    db.commit()
    db.refresh(scene)

    # Push each change live to any collaborators connected on this project.
    from app.routers.collab_ws import broadcast_scene_edit
    from app.services.collab_draft import SCENE_EDITABLE_FIELDS
    for key, value in _broadcast_changes:
        if key in SCENE_EDITABLE_FIELDS:
            broadcast_scene_edit(
                project.id, scene.id, key, value,
                user_id=user.id, name=user.name, change_set_id=change_set_id,
            )

    return scene

@router.put("/{project_id}/bulk-update-scenes", response_model=list[SceneOut])
def bulk_update_scene_typography(
    project_id: int,
    data: SceneTypographyBulkUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update titleFontSize and descriptionFontSize for all scenes in a project."""
    from app.models.scene import Scene
    import json

    project = _get_user_project(project_id, user.id, db)

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order)
        .all()
    )

    from app.services.edit_tracker import new_change_set_id
    _typo_change_set = new_change_set_id()
    for scene in scenes:
        if not scene.remotion_code:
            continue
        try:
            descriptor = json.loads(scene.remotion_code)
        except Exception:
            continue

        # Custom templates use layoutConfig; built-in templates (e.g. newscast) use layoutProps.
        if is_custom_template(project.template):
            layout_config = descriptor.get("layoutConfig") or {}
            if data.title_font_size is not None:
                layout_config["titleFontSize"] = data.title_font_size
            if data.description_font_size is not None:
                layout_config["descriptionFontSize"] = data.description_font_size
            descriptor["layoutConfig"] = layout_config
        else:
            # Merge into existing layoutProps — scenes already have layoutProps, so the old
            # "only if both missing" branch never ran and global typography did not apply.
            layout_props = dict(descriptor.get("layoutProps") or {})
            if data.title_font_size is not None:
                layout_props["titleFontSize"] = data.title_font_size
            if data.description_font_size is not None:
                layout_props["descriptionFontSize"] = data.description_font_size
            descriptor["layoutProps"] = layout_props
        track_scene_edit(
                        db,
                        project_id=project.id,
                        scene_id=scene.id,
                        field_name="remotion_code",
                        old_value=scene.remotion_code,
                        new_value=json.dumps(_sanitize_descriptor_for_data_viz(descriptor)),
                        is_ai_assisted=False,
                        user_id=user.id,
                        change_set_id=_typo_change_set,
                    )
        scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))

    db.commit()

    for scene in scenes:
        db.refresh(scene)

    return scenes


@router.delete("/{project_id}/scenes/{scene_id}", status_code=204)
def delete_scene(
    project_id: int,
    scene_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete a scene (mark inactive), tracked so it can be reverted/redone.

    The scene row and its voiceover/image assets are kept in the DB; the deletion is
    recorded in the edit history as an ``is_active`` True→False change, so it shows in
    the history panel and un-delete is a normal one-field revert. ``order`` is left
    untouched (gaps allowed) so a revert restores the scene to its original position.
    """
    from app.services.edit_tracker import new_change_set_id, prune_project_history

    project = _get_user_project(project_id, user.id, db)

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id, Scene.is_active == True)  # noqa: E712
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    scene.is_active = False
    # Track the deletion in the GLOBAL (project) history, not the scene's own history —
    # a deleted scene has no reachable scene tab, so its restore control must live in
    # Global Edits. The scene_id it targets is carried in the JSON value (ProjectEditHistory
    # has no scene_id column); the revert engine restores is_active from it. old/new encode
    # active→deleted so revert un-deletes and redo re-deletes.
    from app.services.edit_tracker import track_project_edit
    track_project_edit(
        db,
        project_id=project_id,
        field_name="scene_deleted",
        old_value=json.dumps({"scene_id": scene_id, "is_active": True, "title": scene.title}),
        new_value=json.dumps({"scene_id": scene_id, "is_active": False, "title": scene.title}),
        user_id=user.id,
        change_set_id=new_change_set_id(),
    )
    prune_project_history(db, project.id)
    db.commit()

    # A soft-delete removes the scene from every collaborator's list — a structural
    # change the field-level edit broadcast can't express, so trigger a re-sync.
    try:
        from app.routers.collab_ws import broadcast_project_reload
        broadcast_project_reload(project_id, exclude_user_id=user.id)
    except Exception as e:
        print(f"[PROJECTS] Warning: delete broadcast failed for project {project_id}: {e}")

    return None


# Shown to the user for any image-generation failure. Provider SDKs can raise
# errors whose string form is a full HTML error page — that must never reach
# the client, so every failure surfaces this single message instead.
_IMAGE_GEN_ERROR_MESSAGE = (
    "Image generation faced some issues, please try again. "
    "If the issue persists, contact support."
)


@router.post("/{project_id}/scenes/{scene_id}/generate-image")
def generate_scene_image(
    project_id: int,
    scene_id: int,
    payload: GenerateSceneImageRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate an AI image from the user's image description (+ optional scene context).

    Returns base64 image and refined prompt. No DB write; use POST .../image when the user keeps it.
    Requires the project OWNER to be on Pro/Standard. Aspect ratio follows the scene layout."""
    import json
    from app.models.scene import Scene
    from app.models.user import PlanTier
    from app.dspy_modules.image_prompt import refine_image_prompt
    from app.services.image_gen import get_image_provider
    from app.services.image_dimensions import (
        get_image_aspect_for_layout,
        get_openai_size,
        get_gemini_image_config,
        get_glm_size,
    )
    from app.services.scene_image_context import build_scene_context_for_image
    from app.services.template_service import get_fallback_layout

    project = _get_user_project(project_id, user.id, db)

    # Owner pays: gate on the OWNER's plan, so a FREE collaborator inherits a PRO
    # owner's entitlement on a shared project (and a PRO collaborator gains nothing
    # on a FREE owner's project).
    from app.services.access import project_owner, feature_owner_gate_message

    payer = project_owner(project, db)
    if payer.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        raise HTTPException(
            status_code=403,
            detail=feature_owner_gate_message(payer, user, "AI image generation"),
        )

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    image_description = (payload.image_description or "").strip()
    if len(image_description) < 3:
        raise HTTPException(
            status_code=400,
            detail="Image description must be at least 3 characters.",
        )

    try:
        provider = get_image_provider()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not provider:
        raise HTTPException(
            status_code=503,
            detail="Image generation not configured. Set IMAGE_PROVIDER and the corresponding API key (OPENAI_API_KEY, GEMINI_API_KEY, or ZAI_API_KEY)",
        )

    layout_id = get_fallback_layout(project.template)
    if scene.remotion_code:
        try:
            desc = json.loads(scene.remotion_code)
            if desc.get("layout"):
                layout_id = desc["layout"]
        except (json.JSONDecodeError, TypeError):
            pass
    project_aspect = getattr(project, "aspect_ratio", None) or "landscape"
    aspect_ratio = get_image_aspect_for_layout(
        project.template or "default",
        layout_id,
        project_aspect,
    )
    provider_name = (settings.IMAGE_PROVIDER or "openai").strip().lower()
    if provider_name == "openai":
        openai_size = get_openai_size(aspect_ratio)
        gen_kwargs = {
            "size": openai_size,
            "quality": "high",
            "n": 1,
        }
        logger.info(
            "[GENERATE_IMAGE] provider=openai layout=%r template=%r project_aspect=%r image_aspect=%r size=%s",
            layout_id, project.template, project_aspect, aspect_ratio, openai_size,
        )
    elif provider_name == "glm":
        glm_size = get_glm_size(aspect_ratio)
        gen_kwargs = {"size": glm_size}
        logger.info(
            "[GENERATE_IMAGE] provider=glm layout=%r template=%r project_aspect=%r image_aspect=%r size=%s",
            layout_id, project.template, project_aspect, aspect_ratio, glm_size,
        )
    else:
        gemini_config = get_gemini_image_config(aspect_ratio)
        gen_kwargs = {"generation_config": gemini_config}
        logger.info(
            "[GENERATE_IMAGE] provider=gemini layout=%r template=%r project_aspect=%r image_aspect=%r aspect_ratio=%s image_size=%s",
            layout_id, project.template, project_aspect, aspect_ratio,
            gemini_config.get("aspect_ratio"), gemini_config.get("image_size"),
        )

    try:
        scene_context = build_scene_context_for_image(scene)
        refined_prompt = refine_image_prompt(image_description, scene_context)
        image_base64 = provider.generate(refined_prompt, **gen_kwargs)
    except Exception as e:
        logger.error("[GENERATE_IMAGE] Image generation error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=_IMAGE_GEN_ERROR_MESSAGE) from e

    return {"image_base64": image_base64, "refined_prompt": refined_prompt}


@router.post("/{project_id}/scenes/{scene_id}/image", response_model=SceneOut)
async def update_scene_image(
    project_id: int,
    scene_id: int,
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload/replace scene image without regenerating the scene layout.
    Any previous image assigned to this scene is only cleared from the scene;
    the old asset row and files remain (delete explicitly via the asset API if needed)."""
    import json
    from app.models.scene import Scene
    from app.models.asset import Asset, AssetType

    project = _get_user_project(project_id, user.id, db)

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    allowed_types = {"image/png", "image/jpeg", "image/webp", "image/jpg"}
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Image must be PNG, JPEG, or WebP.")

    MAX_IMAGE_SIZE = 5 * 1024 * 1024
    file_bytes = image.file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image file too large. Maximum size is 5 MB.")

    image_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/images")
    os.makedirs(image_dir, exist_ok=True)

    ext = image.filename.rsplit(".", 1)[-1] if image.filename and "." in image.filename else "png"
    image_filename = f"scene_{scene_id}_{int(time.time())}.{ext}"
    local_path = os.path.join(image_dir, image_filename)

    with open(local_path, "wb") as f:
        f.write(file_bytes)

    r2_key_val = None
    r2_url_val = None
    if r2_storage.is_r2_configured():
        try:
            r2_key_val = r2_storage.image_key(user.id, project_id, image_filename)
            r2_url_val = r2_storage.upload_file(local_path, r2_key_val, content_type=image.content_type)
        except Exception as e:
            print(f"[IMAGE_UPDATE] R2 upload failed for {image_filename}: {e}")

    asset = Asset(
        project_id=project_id,
        asset_type=AssetType.IMAGE,
        local_path=local_path,
        filename=image_filename,
        r2_key=r2_key_val,
        r2_url=r2_url_val,
        excluded=False,
    )
    db.add(asset)
    db.flush()

    # Update the scene's layoutProps.assignedImage without changing anything else
    descriptor = {}
    if scene.remotion_code:
        try:
            descriptor = json.loads(scene.remotion_code)
        except (json.JSONDecodeError, TypeError):
            descriptor = {}

    layout_props = _ensure_layout_props_dict(descriptor)
    layout_props["assignedImage"] = image_filename
    layout_props.pop("hideImage", None)
    _apply_default_focus(layout_props)
    scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))

    # Keep project.status and r2_video_* as-is: the exported MP4 stays available until the user
    # runs a new render (render pipeline replaces URLs/keys on success).

    db.commit()
    db.refresh(scene)

    return scene


@router.patch("/{project_id}/scenes/{scene_id}/image-focus", response_model=SceneOut)
def update_scene_image_focus(
    project_id: int,
    scene_id: int,
    data: SceneImageFocusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_user_project(project_id, user.id, db)
    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if not _scene_supports_images(project, scene):
        raise HTTPException(status_code=400, detail="This layout does not support images")

    descriptor = _parse_scene_descriptor(scene)
    lp = _ensure_layout_props_dict(descriptor)
    if lp.get("hideImage"):
        raise HTTPException(status_code=400, detail="Cannot set image focus while image is hidden")
    if not lp.get("assignedImage"):
        raise HTTPException(status_code=400, detail="No assigned image found for this scene")

    lp["imageFocusX"] = _clamp_image_focus(data.image_focus_x)
    lp["imageFocusY"] = _clamp_image_focus(data.image_focus_y)
    if data.image_zoom is not None:
        lp["imageZoom"] = _clamp_image_zoom(data.image_zoom)
    scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))
    db.commit()
    db.refresh(scene)

    return scene


@router.post("/{project_id}/images/move")
def move_scene_image(
    project_id: int,
    data: SceneImageMoveRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_user_project(project_id, user.id, db)
    from_scene = db.query(Scene).filter(Scene.project_id == project_id, Scene.id == data.from_scene_id).first()
    to_scene = db.query(Scene).filter(Scene.project_id == project_id, Scene.id == data.to_scene_id).first()
    if not from_scene or not to_scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if not _scene_supports_images(project, to_scene):
        raise HTTPException(status_code=400, detail="Target scene layout does not support images")

    from_desc = _parse_scene_descriptor(from_scene)
    to_desc = _parse_scene_descriptor(to_scene)
    from_lp = _ensure_layout_props_dict(from_desc)
    to_lp = _ensure_layout_props_dict(to_desc)
    assigned = from_lp.get("assignedImage")
    if not assigned:
        raise HTTPException(status_code=400, detail="Source scene has no assigned image")

    to_lp["assignedImage"] = assigned
    to_lp["hideImage"] = False
    to_lp["imageFocusX"] = _clamp_image_focus(from_lp.get("imageFocusX", 50))
    to_lp["imageFocusY"] = _clamp_image_focus(from_lp.get("imageFocusY", 50))
    _clear_image_assignment(from_lp)
    from_lp["hideImage"] = True

    from_scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(from_desc))
    to_scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(to_desc))
    db.commit()
    return {"detail": "Image moved"}


@router.post("/{project_id}/images/swap")
def swap_scene_images(
    project_id: int,
    data: SceneImageSwapRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_user_project(project_id, user.id, db)
    first = db.query(Scene).filter(Scene.project_id == project_id, Scene.id == data.first_scene_id).first()
    second = db.query(Scene).filter(Scene.project_id == project_id, Scene.id == data.second_scene_id).first()
    if not first or not second:
        raise HTTPException(status_code=404, detail="Scene not found")
    if not _scene_supports_images(project, first) or not _scene_supports_images(project, second):
        raise HTTPException(status_code=400, detail="Both scenes must support images to swap")

    first_desc = _parse_scene_descriptor(first)
    second_desc = _parse_scene_descriptor(second)
    first_lp = _ensure_layout_props_dict(first_desc)
    second_lp = _ensure_layout_props_dict(second_desc)
    first_assigned = first_lp.get("assignedImage")
    second_assigned = second_lp.get("assignedImage")
    if not first_assigned and not second_assigned:
        raise HTTPException(status_code=400, detail="Neither scene has an assigned image")

    first_focus = (
        _clamp_image_focus(first_lp.get("imageFocusX", 50)),
        _clamp_image_focus(first_lp.get("imageFocusY", 50)),
    )
    second_focus = (
        _clamp_image_focus(second_lp.get("imageFocusX", 50)),
        _clamp_image_focus(second_lp.get("imageFocusY", 50)),
    )

    if second_assigned:
        first_lp["assignedImage"] = second_assigned
        first_lp["hideImage"] = False
        first_lp["imageFocusX"], first_lp["imageFocusY"] = second_focus
    else:
        _clear_image_assignment(first_lp)
        first_lp["hideImage"] = True

    if first_assigned:
        second_lp["assignedImage"] = first_assigned
        second_lp["hideImage"] = False
        second_lp["imageFocusX"], second_lp["imageFocusY"] = first_focus
    else:
        _clear_image_assignment(second_lp)
        second_lp["hideImage"] = True

    first.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(first_desc))
    second.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(second_desc))
    db.commit()
    return {"detail": "Images swapped"}


@router.post("/{project_id}/images/duplicate")
def duplicate_scene_image(
    project_id: int,
    data: SceneImageDuplicateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.asset import Asset, AssetType

    project = _get_user_project(project_id, user.id, db)
    source_scene = db.query(Scene).filter(Scene.project_id == project_id, Scene.id == data.source_scene_id).first()
    target_scene = db.query(Scene).filter(Scene.project_id == project_id, Scene.id == data.target_scene_id).first()
    if not source_scene or not target_scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if not _scene_supports_images(project, target_scene):
        raise HTTPException(status_code=400, detail="Target scene layout does not support images")

    source_desc = _parse_scene_descriptor(source_scene)
    source_lp = _ensure_layout_props_dict(source_desc)
    source_filename = source_lp.get("assignedImage")
    if not source_filename:
        raise HTTPException(status_code=400, detail="Source scene has no assigned image")

    source_asset = (
        db.query(Asset)
        .filter(Asset.project_id == project_id, Asset.filename == source_filename, Asset.asset_type == AssetType.IMAGE)
        .first()
    )
    if not source_asset:
        raise HTTPException(status_code=404, detail="Source image asset not found")

    target_desc = _parse_scene_descriptor(target_scene)
    target_lp = _ensure_layout_props_dict(target_desc)

    target_lp["assignedImage"] = source_filename
    target_lp["hideImage"] = False
    target_lp["imageFocusX"] = _clamp_image_focus(source_lp.get("imageFocusX", 50))
    target_lp["imageFocusY"] = _clamp_image_focus(source_lp.get("imageFocusY", 50))
    target_scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(target_desc))
    db.commit()

    return {"detail": "Image duplicated to target scene"}


@router.post("/{project_id}/images/assign-existing")
def assign_existing_image_to_scene(
    project_id: int,
    data: SceneImageAssignExistingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.asset import Asset, AssetType

    project = _get_user_project(project_id, user.id, db)
    target_scene = (
        db.query(Scene)
        .filter(Scene.project_id == project_id, Scene.id == data.scene_id)
        .first()
    )
    if not target_scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if not _scene_supports_images(project, target_scene):
        raise HTTPException(status_code=400, detail="Target scene layout does not support images")

    source_asset = (
        db.query(Asset)
        .filter(
            Asset.project_id == project_id,
            Asset.id == data.asset_id,
            Asset.asset_type == AssetType.IMAGE,
        )
        .first()
    )
    if not source_asset:
        raise HTTPException(status_code=404, detail="Source image asset not found")

    target_desc = _parse_scene_descriptor(target_scene)
    target_lp = _ensure_layout_props_dict(target_desc)

    target_lp["assignedImage"] = source_asset.filename
    target_lp["hideImage"] = False
    target_lp["imageFocusX"] = 50
    target_lp["imageFocusY"] = 50
    target_scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(target_desc))

    db.commit()
    return {"detail": "Image assigned to scene"}


@router.get("/{project_id}/layouts")
def get_project_layouts(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get valid layouts for a project's template."""
    import json as _json
    project = _get_user_project(project_id, user.id, db)

    valid_layouts = get_valid_layouts(project.template)
    no_image_layouts = get_layouts_without_image(project.template)

    # Convert layout IDs to human-readable names
    meta = get_meta(project.template)
    schema = meta.get("layout_prop_schema", {}) if meta else {}

    # Custom templates with generated code embed layout_names directly in meta
    meta_layout_names = meta.get("layout_names", {}) if meta else {}
    layout_names = {}
    for layout_id in valid_layouts:
        if layout_id in meta_layout_names:
            layout_names[layout_id] = meta_layout_names[layout_id]
        else:
            # Prefer schema label, fallback to Title Case
            layout_schema = schema.get(layout_id, {})
            name = layout_schema.get("label") or layout_id.replace("_", " ").title()
            layout_names[layout_id] = name

    return {
        "layouts": sorted(list(valid_layouts)),
        "layout_names": layout_names,
        "layouts_without_image": sorted(list(no_image_layouts)),
        "layout_prop_schema": schema,
    }


@router.post("/{project_id}/scenes/reorder", response_model=list[SceneOut])
def reorder_scenes(
    project_id: int,
    data: ReorderScenesRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reorder scenes by updating their order values.

    The client only knows about ACTIVE scenes and sends their new positions. To keep
    ``order`` globally unique across ALL scenes (active + soft-deleted) — required
    because renders key audio files on ``scene.order`` (``audio_scene_{order}.mp3``)
    and a soft-deleted scene must never collide with an active one — we renumber the
    FULL scene set. Each inactive scene keeps its relative position (it stays wedged
    just after the scene it currently follows), so a reverted scene reappears in place.
    """
    from app.models.scene import Scene
    from app.services.edit_tracker import (
        track_project_edit,
        new_change_set_id,
        prune_project_history,
    )

    project = _get_user_project(project_id, user.id, db)

    # ALL scenes (active + inactive) — we renumber the whole set to keep order unique.
    all_scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    scene_map = {s.id: s for s in all_scenes}

    # Snapshot the current global order (all scenes, keyed by id) so the reorder can be
    # tracked and reverted back to exactly this ordering. Titles are captured too so the
    # history UI can show which scene moved where (titles don't change on reorder).
    old_order_map = {s.id: s.order for s in all_scenes}
    title_map = {s.id: (s.title or "") for s in all_scenes}
    # Which scenes are active — the history UI lists only active scenes (soft-deleted
    # ones are hidden), while orders still cover ALL scenes for an accurate revert.
    active_map = {s.id: bool(s.is_active) for s in all_scenes}

    # Validate every requested id is an ACTIVE scene of this project (the client only
    # reorders active scenes; inactive ones are not addressable).
    for item in data.scene_orders:
        target = scene_map.get(item.scene_id)
        if target is None or not target.is_active:
            raise HTTPException(status_code=404, detail=f"Scene {item.scene_id} not found")

    # New rank for each active scene from the request (its position among active
    # scenes only, 1..N in the client's requested order).
    active_new_rank = {item.scene_id: item.order for item in data.scene_orders}

    # Build the new active order (list of active scene ids, best-first).
    active_scenes = [s for s in all_scenes if s.is_active]
    active_ordered = sorted(active_scenes, key=lambda s: active_new_rank.get(s.id, s.order))

    # Anchor each inactive scene to the active scene it currently follows, so it keeps
    # its relative position across the reorder. Using the OLD global order, find, for
    # each inactive scene, the nearest active scene that precedes it; the inactive
    # scene will be re-inserted right after that same active scene's new position
    # (inactive scenes before any active one go to the front).
    old_global = sorted(all_scenes, key=lambda s: s.order)
    anchor_after: dict[int, list[Scene]] = {}  # active scene id (or 0=front) -> inactive scenes
    last_active_id = 0
    for s in old_global:
        if s.is_active:
            last_active_id = s.id
        else:
            anchor_after.setdefault(last_active_id, []).append(s)

    # Interleave: front-anchored inactive scenes, then each active scene followed by
    # the inactive scenes anchored to it, then renumber the whole sequence uniquely.
    sequenced: list[Scene] = list(anchor_after.get(0, []))
    for a in active_ordered:
        sequenced.append(a)
        sequenced.extend(anchor_after.get(a.id, []))
    for i, scene in enumerate(sequenced, 1):
        scene.order = i

    # Track the reorder as a single revertable project-level history entry. old/new hold
    # {"orders": {scene_id: order}, "titles": {scene_id: title}} over ALL scenes; revert
    # restores the old orders and the UI uses titles to show which scene moved where. This
    # is project-scoped (not tied to one scene) so it survives as long as the project does
    # and reverts every scene's order together. No-op reorders are skipped (old == new) —
    # titles are identical on both sides, so only the orders differing triggers a record.
    new_order_map = {s.id: s.order for s in all_scenes}
    track_project_edit(
        db,
        project_id=project_id,
        field_name="scene_order",
        old_value=json.dumps({"orders": old_order_map, "titles": title_map, "active": active_map}),
        new_value=json.dumps({"orders": new_order_map, "titles": title_map, "active": active_map}),
        user_id=user.id,
        change_set_id=new_change_set_id(),
    )
    prune_project_history(db, project.id)

    db.commit()
    for scene in sequenced:
        db.refresh(scene)

    active_sorted = [s for s in sequenced if s.is_active]

    # Reordering only updates the scenes' `order` in the DB. The Remotion workspace is
    # rebuilt from the DB at render time, so we deliberately do NOT rebuild it here.

    # Broadcast the structural change so collaborators re-sync their scene list.
    try:
        from app.routers.collab_ws import broadcast_project_reload
        broadcast_project_reload(project_id, exclude_user_id=user.id)
    except Exception as e:
        print(f"[PROJECTS] Warning: reorder broadcast failed for project {project_id}: {e}")

    return active_sorted


def _broadcast_scene_regen(project_id: int, actor_user_id: int) -> None:
    """Tell live collaborators to refetch after an AI scene regeneration.

    A regen rewrites the scene descriptor (layout), narration and/or voiceover at
    once — too much to reconcile field-by-field the way a manual ``update_scene``
    edit is, so collaborators reload authoritative state. The acting user is
    excluded: they already have the response body.

    Called from every exit path of ``regenerate_scene`` (variant switch, layout
    switch, and the full AI path), which each ``return`` separately.
    """
    from app.routers.collab_ws import broadcast_project_reload

    broadcast_project_reload(project_id, exclude_user_id=actor_user_id)


@router.post("/{project_id}/scenes/{scene_id}/regenerate", response_model=SceneOut)
async def regenerate_scene(
    project_id: int,
    scene_id: int,
    description: Optional[str] = Form(None),
    narration_text: Optional[str] = Form(None),
    regenerate_voiceover: str = Form("false"),
    voiceover_verbatim: str = Form("true"),
    layout: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Regenerate a scene using AI with optional layout selection and image upload."""
    import json
    from app.models.scene import Scene
    from app.models.asset import Asset, AssetType
    from app.models.user import PlanTier
    from app.dspy_modules.template_scene_gen import TemplateSceneGenerator
    from app.dspy_modules.narration_edit import rewrite_narration_if_requested
    from app.services.voiceover import generate_voiceover
    
    project = _get_user_project(project_id, user.id, db)

    # Owner pays: the AI-editing entitlement/limit is charged to the project OWNER,
    # so a FREE collaborator inherits the owner's plan on a shared project.
    from app.services.access import project_owner, can_use_ai_edit, consume_ai_edit
    from app.services.edit_tracker import new_change_set_id
    payer = project_owner(project, db)
    # Group every field this AI regeneration touches into one change-set, attributed
    # to the acting user, so the whole regen previews and reverts as a single unit.
    _regen_change_set = new_change_set_id()

    # Check usage limits: free per-project allowance, then the owner's purchased
    # AI-edit credit pool; PRO/STANDARD owners are unlimited (see can_use_ai_edit).
    if not can_use_ai_edit(payer, project):
        raise HTTPException(
            status_code=403,
            detail="AI editing limit reached. Buy a video for +20 AI edits, or upgrade to Pro or Standard for unlimited AI edits."
        )

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    old_visual_description = scene.visual_description
    old_display_text = getattr(scene, "display_text", None)
    old_narration_text = scene.narration_text
    old_remotion_code = scene.remotion_code
    
    keep_layout = layout == "__keep__"
    normalized_layout = None
    if layout and not keep_layout:
        valid_layouts = get_valid_layouts(project.template)

        if is_custom_template(project.template):
            normalized_layout = layout.strip().lower().replace(" ", "-")
        else:
            normalized_layout = layout.strip().lower().replace(" ", "_").replace("-", "_")
        if normalized_layout not in valid_layouts:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid layout '{layout}'. Valid layouts: {', '.join(sorted(valid_layouts))}"
            )
    
    image_filename = None
    if image:
        
        allowed_types = {"image/png", "image/jpeg", "image/webp", "image/jpg"}
        if image.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Image must be PNG, JPEG, or WebP.")
        
        MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
        file_bytes = image.file.read()
        if len(file_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="Image file too large. Maximum size is 5 MB.")
        
        image_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/images")
        os.makedirs(image_dir, exist_ok=True)
        
        ext = image.filename.rsplit(".", 1)[-1] if image.filename and "." in image.filename else "png"
        image_filename = f"scene_{scene_id}_{int(time.time())}.{ext}"
        local_path = os.path.join(image_dir, image_filename)
        
        with open(local_path, "wb") as f:
            f.write(file_bytes)
        
        r2_key_val = None
        r2_url_val = None
        if r2_storage.is_r2_configured():
            try:
                r2_key_val = r2_storage.image_key(user.id, project_id, image_filename)
                r2_url_val = r2_storage.upload_file(local_path, r2_key_val, content_type=image.content_type)
            except Exception as e:
                print(f"[REGENERATE] R2 upload failed for {image_filename}: {e}")
        
        asset = Asset(
            project_id=project_id,
            asset_type=AssetType.IMAGE,
            local_path=local_path,
            filename=image_filename,
            r2_key=r2_key_val,
            r2_url=r2_url_val,
            excluded=False,
        )
        db.add(asset)
        db.flush()
    
    description_lower = (description or "").lower()
    remove_image = any(phrase in description_lower for phrase in [
        "remove image", "no image", "don't show image", "hide image",
        "without image", "no picture", "remove picture"
    ])
    hide_narration = any(phrase in description_lower for phrase in [
        "no display text", "don't show text", "hide text",
        "without texts", "remove texts", "no text",
        "don't display text", "visualization only"
    ])

    if hide_narration:
        new_display_text = ""
    elif narration_text and narration_text.strip():
        new_display_text = narration_text.strip()
        scene.narration_text = narration_text.strip()
        track_scene_edit(
                        db,
                        project_id=project_id,
                        scene_id=scene.id,
                        field_name="narration_text",
                        old_value=old_narration_text,
                        new_value=scene.narration_text,
                        is_ai_assisted=True,
                        user_instruction=narration_text,
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
    else:
        # Prefer existing display_text when present; otherwise fall back to narration_text.
        new_display_text = getattr(scene, "display_text", None) or (scene.narration_text or "")
    
    # Parse current descriptor
    current_descriptor = None
    if scene.remotion_code:
        try:
            current_descriptor = json.loads(scene.remotion_code)
        except (json.JSONDecodeError, TypeError):
            pass

    has_description = bool(description and description.strip())
    needs_layout_regen = not keep_layout or has_description

    # Detect variant switch for custom templates (intro/content_N/outro/data-viz)
    # Pure variant switches skip the AI call entirely — instant layout change.
    is_variant_switch = False
    if is_custom_template(project.template) and normalized_layout:
        import re as _re
        if (
            normalized_layout in ("intro", "outro", "custom_chart", "custom_table")
            or _re.match(r"content_\d+$", normalized_layout)
        ):
            is_variant_switch = True

    if is_variant_switch and not has_description:
        # Pure variant switch: update remotion_code with override, skip AI
        descriptor = current_descriptor if current_descriptor else {}
        if normalized_layout == "intro":
            descriptor["sceneTypeOverride"] = "intro"
            descriptor.pop("contentVariantIndex", None)
        elif normalized_layout == "outro":
            descriptor["sceneTypeOverride"] = "outro"
            descriptor.pop("contentVariantIndex", None)
        elif normalized_layout in ("custom_chart", "custom_table"):
            # Convert the scene into a dedicated data-viz scene. The renderer routes
            # by sceneType (see GeneratedVideo.getSceneComponent), so the override
            # must carry the dataviz_* type. Seed a chartTable when none exists so it
            # never renders blank.
            descriptor["sceneTypeOverride"] = (
                "dataviz_chart" if normalized_layout == "custom_chart" else "dataviz_table"
            )
            descriptor.pop("contentVariantIndex", None)
            from app.routers.pipeline import _CUSTOM_DATAVIZ_SEED
            lp = descriptor.get("layoutProps") if isinstance(descriptor.get("layoutProps"), dict) else {}
            existing_table = lp.get("chartTable")
            has_data = (
                isinstance(existing_table, dict)
                and isinstance(existing_table.get("rows"), list)
                and len(existing_table["rows"]) > 0
            )
            if not has_data:
                lp = dict(lp)
                lp["chartTable"] = _CUSTOM_DATAVIZ_SEED
                if normalized_layout == "custom_chart":
                    lp.setdefault("chartType", "line")
                descriptor["layoutProps"] = lp
        else:
            # content_N → extract N
            variant_idx = int(normalized_layout.split("_")[1])
            descriptor["sceneTypeOverride"] = "content"
            descriptor["contentVariantIndex"] = variant_idx

        scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))
        if hasattr(scene, "display_text"):
            scene.display_text = new_display_text
        track_scene_edit(
            db,
            project_id=project_id,
            scene_id=scene.id,
            field_name="remotion_code",
            old_value=old_remotion_code,
            new_value=scene.remotion_code,
            is_ai_assisted=True,
            user_instruction=f"Variant switch to {normalized_layout}",
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
        # A layout change counts as an AI-assisted edit even though no LLM call is made.
        # Metered against the OWNER, who pays (see the gate at the top of this function).
        if payer.plan not in (PlanTier.PRO, PlanTier.STANDARD):
            consume_ai_edit(payer, project)
        db.commit()
        print(f"[REGENERATE] Variant switch → {normalized_layout} (counts as AI edit)")

        db.refresh(scene)
        _broadcast_scene_regen(project_id, user.id)
        return scene

    # Pure layout switch for built-in templates: no description → skip AI, just swap layout
    is_builtin_layout_switch = (
        not is_custom_template(project.template)
        and normalized_layout
        and not has_description
    )
    if is_builtin_layout_switch:
        descriptor = current_descriptor if current_descriptor else {}
        descriptor["layout"] = normalized_layout
        # Seed example chart data when switching into a chart layout with no existing chartTable
        _chart_layouts = {"data_visualization", "terminal_dataviz"}
        if normalized_layout in _chart_layouts:
            lp = descriptor.get("layoutProps") if isinstance(descriptor.get("layoutProps"), dict) else {}
            existing_table = lp.get("chartTable")
            has_data = (
                isinstance(existing_table, dict)
                and isinstance(existing_table.get("rows"), list)
                and len(existing_table["rows"]) > 0
            )
            if not has_data:
                lp = dict(lp)
                lp["chartType"] = "bar"
                lp["chartTable"] = {
                    "headers": ["Sector", "Close", "Flow index", "Positioning"],
                    "rows": [
                        ["Tech", "324", "72", "41"],
                        ["Energy", "308", "55", "36"],
                        ["Healthcare", "315", "61", "39"],
                        ["Financials", "298", "68", "44"],
                        ["Semis", "318", "59", "33"],
                    ],
                }
                descriptor["layoutProps"] = lp
        scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))
        if hasattr(scene, "display_text"):
            scene.display_text = new_display_text
        track_scene_edit(
            db,
            project_id=project_id,
            scene_id=scene.id,
            field_name="remotion_code",
            old_value=old_remotion_code,
            new_value=scene.remotion_code,
            is_ai_assisted=True,
            user_instruction=f"Layout switch to {normalized_layout}",
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
        # A layout change counts as an AI-assisted edit even though no LLM call is made.
        # Metered against the OWNER, who pays (see the gate at the top of this function).
        if payer.plan not in (PlanTier.PRO, PlanTier.STANDARD):
            consume_ai_edit(payer, project)
        db.commit()
        print(f"[REGENERATE] Layout switch → {normalized_layout} (counts as AI edit)")

        db.refresh(scene)
        _broadcast_scene_regen(project_id, user.id)
        return scene

    # Regenerate visual_description only if description is provided
    if has_description:
        from app.dspy_modules.visual_description import regenerate_visual_description
        new_visual_description = await regenerate_visual_description(
            current_visual_description=scene.visual_description or "",
            user_instruction=description,
            scene_title=scene.title,
            display_text=new_display_text,
        )
    else:
        new_visual_description = scene.visual_description or ""

    if needs_layout_regen:
        # Regenerate scene layout using AI
        template_gen = TemplateSceneGenerator(project.template)
        all_scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.order)
            .all()
        )

        other_layout_parts = []
        for s in all_scenes:
            if s.id == scene.id:
                continue
            layout_name = "unknown"
            if s.remotion_code:
                try:
                    desc = json.loads(s.remotion_code)
                    if "layoutConfig" in desc:
                        layout_name = desc["layoutConfig"].get("arrangement", "unknown")
                    else:
                        layout_name = desc.get("layout", "unknown")
                except (json.JSONDecodeError, TypeError):
                    pass
            other_layout_parts.append(f"scene {s.order}: {layout_name}")
        other_scenes_layouts = ", ".join(other_layout_parts)

        # If keep_layout + description: force the current layout as preferred
        effective_layout = normalized_layout
        if keep_layout and has_description and current_descriptor:
            if "layoutConfig" in current_descriptor:
                effective_layout = current_descriptor["layoutConfig"].get("arrangement")
            else:
                effective_layout = current_descriptor.get("layout")

        print(
            f"[REGENERATE] template={project.template}, "
            f"is_custom={is_custom_template(project.template)}"
        )
        print(f"[REGENERATE] keep_layout={keep_layout}, normalized_layout={normalized_layout}, effective_layout={effective_layout}")
        print(f"[REGENERATE] other_scenes: {other_scenes_layouts}")
        if current_descriptor:
            has_lc = "layoutConfig" in current_descriptor
            print(f"[REGENERATE] current descriptor: has_layoutConfig={has_lc}, keys={list(current_descriptor.keys())}")

        from app.services.language_detection import get_content_language_for_project
        content_language = get_content_language_for_project(project)

        if is_custom_template(project.template):
            # Custom templates: re-extract structured content for this single scene
            from app.services.content_classifier import extract_structured_content_batch
            single_result = await extract_structured_content_batch(
                [{"title": scene.title, "narration": scene.narration_text or ""}],
                content_language=content_language,
            )
            descriptor = current_descriptor.copy() if current_descriptor else {"layoutConfig": {}}
            if "layoutConfig" not in descriptor:
                descriptor["layoutConfig"] = {}
            if single_result:
                descriptor["structuredContent"] = single_result[0]
        else:
            descriptor = await template_gen.generate_regenerate_descriptor(
                scene_title=scene.title,
                narration=scene.narration_text or "",
                visual_description=new_visual_description,
                scene_index=scene.order - 1,
                total_scenes=len(all_scenes),
                other_scenes_layouts=other_scenes_layouts,
                preferred_layout=effective_layout,
                current_descriptor=current_descriptor,
                content_language=content_language,
            )

        # Preserve image assignment from old descriptor into the new one.
        # Applies to all templates. Custom templates use layoutConfig for
        # arrangement but still use layoutProps for image tracking.
        if remove_image:
            if "layoutProps" not in descriptor:
                descriptor["layoutProps"] = {}
            lp = descriptor["layoutProps"]
            lp["hideImage"] = True
            lp.pop("imageUrl", None)
            _clear_image_assignment(lp)
        elif not image and current_descriptor:
            old_lp = current_descriptor.get("layoutProps") or {}
            if "layoutProps" not in descriptor:
                descriptor["layoutProps"] = {}
            new_lp = descriptor["layoutProps"]
            old_assigned = old_lp.get("assignedImage")
            if old_assigned:
                new_lp["assignedImage"] = old_assigned
                new_lp["imageFocusX"] = _clamp_image_focus(old_lp.get("imageFocusX", 50))
                new_lp["imageFocusY"] = _clamp_image_focus(old_lp.get("imageFocusY", 50))
            if old_lp.get("hideImage"):
                new_lp["hideImage"] = True

        # Preserve custom font sizes from old layoutConfig into the new descriptor
        if is_custom_template(project.template) and "layoutConfig" in descriptor and current_descriptor:
            old_lc = current_descriptor.get("layoutConfig") or {}
            new_lc = descriptor["layoutConfig"]
            if "titleFontSize" in old_lc and "titleFontSize" not in new_lc:
                new_lc["titleFontSize"] = old_lc["titleFontSize"]
            if "descriptionFontSize" in old_lc and "descriptionFontSize" not in new_lc:
                new_lc["descriptionFontSize"] = old_lc["descriptionFontSize"]

        # Debug: log the final descriptor that will be stored
        if "layoutConfig" in descriptor:
            lc = descriptor["layoutConfig"]
            print(f"[REGENERATE] RESULT: layoutConfig → arrangement={lc.get('arrangement')}, elements={len(lc.get('elements', []))}")
        else:
            print(f"[REGENERATE] RESULT: legacy → layout={descriptor.get('layout')}, layoutProps keys={list(descriptor.get('layoutProps', {}).keys())}")
        
        scene.visual_description = new_visual_description
        track_scene_edit(
                        db,
                        project_id=project_id,
                        scene_id=scene.id,
                        field_name="visual_description",
                        old_value=old_visual_description,
                        new_value=new_visual_description,
                        is_ai_assisted=True,
                        user_instruction=description,
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
        
        # Update display_text only; narration_text remains the narration script.
        if hasattr(scene, "display_text"):
            scene.display_text = new_display_text
            track_scene_edit(
                            db,
                            project_id=project_id,
                            scene_id=scene.id,
                            field_name="display_text",
                            old_value=old_display_text,
                            new_value=new_display_text,
                            is_ai_assisted=True,
                            user_instruction=narration_text,
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
        # If variant switch + description: stamp the variant override after AI regen
        if is_variant_switch and normalized_layout:
            if normalized_layout == "intro":
                descriptor["sceneTypeOverride"] = "intro"
                descriptor.pop("contentVariantIndex", None)
            elif normalized_layout == "outro":
                descriptor["sceneTypeOverride"] = "outro"
                descriptor.pop("contentVariantIndex", None)
            else:
                variant_idx = int(normalized_layout.split("_")[1])
                descriptor["sceneTypeOverride"] = "content"
                descriptor["contentVariantIndex"] = variant_idx

        scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))
        track_scene_edit(
                        db,
                        project_id=project_id,
                        scene_id=scene.id,
                        field_name="remotion_code",
                        old_value=old_remotion_code,
                        new_value=scene.remotion_code,
                        is_ai_assisted=True,
                        user_instruction=description,
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
        db.commit()
    else:
        # Keep layout: no AI layout call — just preserve existing descriptor
        scene.visual_description = new_visual_description
        track_scene_edit(
                        db,
                        project_id=project_id,
                        scene_id=scene.id,
                        field_name="visual_description",
                        old_value=old_visual_description,
                        new_value=new_visual_description,
                        is_ai_assisted=True,
                        user_instruction=description,
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
        if hasattr(scene, "display_text"):
            scene.display_text = new_display_text
            track_scene_edit(
                            db,
                            project_id=project_id,
                            scene_id=scene.id,
                            field_name="display_text",
                            old_value=old_display_text,
                            new_value=new_display_text,
                            is_ai_assisted=True,
                            user_instruction=narration_text,
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
        db.commit()

    # Regenerate voiceover only if requested
    should_regenerate_voiceover = regenerate_voiceover.lower() == "true"
    # When verbatim, the narration_text is sent to TTS word-for-word, skipping
    # the DSPy expansion step (so the spoken voiceover matches the edited script).
    verbatim = voiceover_verbatim.lower() == "true"
    # Voiceover should continue to be based on the underlying narration_text script,
    # not the shorter display_text.
    narration_source = (scene.narration_text or "").strip()
    if should_regenerate_voiceover and narration_source:
        if verbatim:
            # scene.narration_text already holds the user's edited script.
            generate_voiceover(scene, db)
        else:
            from app.dspy_modules.voiceover_expand import expand_narration_to_voiceover
            from app.services.language_detection import get_content_language_for_project
            video_style = getattr(project, "video_style", None) or "explainer"
            content_language = get_content_language_for_project(project)
            expanded_voiceover = await expand_narration_to_voiceover(
                narration_source, scene.title, video_style=video_style,
                content_language=content_language,
                expressive=bool(getattr(project, "voice_emotion", None)),
            )

            # Persist the AI-expanded text so the narration shown in the scene
            # always matches the spoken voiceover (do not revert to the original).
            old_narration = scene.narration_text
            scene.narration_text = expanded_voiceover
            db.commit()

            generate_voiceover(scene, db, use_expanded=False)

            track_scene_edit(
                db,
                project_id=project.id,
                scene_id=scene.id,
                field_name="narration_text",
                old_value=old_narration,
                new_value=expanded_voiceover,
                is_ai_assisted=True,
                user_instruction="AI-expanded narration for voiceover",
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
            db.commit()

        track_scene_edit(
                        db,
                        project_id=project.id,
                        scene_id=scene.id,
                        field_name="voiceover",
                        old_value=None,
                        new_value="regenerated",
                        is_ai_assisted=not verbatim,
                        user_instruction="Regenerated voiceover via API",
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
        db.commit()

    # Increment usage count only when AI was actually used. The limit is charged to
    # the OWNER (see the gate above), so meter on the payer's plan — not the acting
    # collaborator's, or a Free collaborator would burn the counter on a Pro project.
    used_ai = needs_layout_regen or should_regenerate_voiceover
    if used_ai and payer.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        consume_ai_edit(payer, project)

    db.commit()

    db.refresh(scene)
    _broadcast_scene_regen(project_id, user.id)
    return scene


def _get_user_project(project_id: int, user_id: int, db: Session, *, required_role: str = "editor") -> Project:
    """Get a project the user may access (owner or accepted collaborator), or 404.

    Delegates to the membership-aware access resolver so all ~35 call sites gain
    collaborator support. ``required_role="owner"`` for owner-only actions.
    """
    from app.services.access import get_accessible_project
    from app.models.user import User as _User

    user = db.query(_User).filter(_User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_accessible_project(project_id, user, db, required_role=required_role)


async def _run_voice_change(project_id: int, job_id: int) -> None:
    """Background worker: regenerate every scene's voiceover in the new voice.

    Runs in its own DB session (the request's session is closed once the response
    is sent). Heartbeats ``ProjectVoiceChangeJob.updated_at`` one step per scene so
    a stalled run can be reaped + reverted via the status-polling API.
    """
    from app.database import SessionLocal
    from app.services.voiceover import generate_all_voiceovers
    from app.services.language_detection import get_content_language_for_project
    from app.services import voice_change_progress

    # Register this coroutine so a stall reaper can cancel it for real.
    try:
        stall_recovery.register_task("voice", job_id, asyncio.current_task())
    except Exception:
        pass

    db = SessionLocal()
    job_user_id = None
    audio_backed_up = False
    voice_snapshot_raw = None
    try:
        job = db.query(ProjectVoiceChangeJob).filter(ProjectVoiceChangeJob.id == job_id).first()
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project or not job:
            voice_change_progress.finish(project_id, error="Project not found.")
            if job:
                job.status = "failed"
                job.error_message = "Project not found."
                job.completed_at = datetime.utcnow()
                db.commit()
            return
        job_user_id = job.user_id
        voice_snapshot_raw = job.voice_snapshot
        scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.order)
            .all()
        )

        # Back up existing voiceover audio BEFORE generate overwrites scene_N.mp3 in place,
        # so a reaped/failed run can restore the originals. Pull originals from R2 first
        # in case the local cache is cold (otherwise the backup would be empty).
        _ensure_local_audio_from_r2(project_id, db)
        _backup_project_audio(project_id, job_id)
        audio_backed_up = True
        job.status = "running"
        job.total_scenes = len(scenes)
        job.processed_scenes = 0
        job.audio_backed_up = True
        db.commit()

        def _advance() -> None:
            voice_change_progress.advance(project_id)
            # Heartbeat in a separate short-lived session so we never disturb the
            # worker's session mid-generation.
            hb = SessionLocal()
            try:
                hb.execute(
                    update(ProjectVoiceChangeJob)
                    .where(ProjectVoiceChangeJob.id == job_id)
                    .values(
                        processed_scenes=ProjectVoiceChangeJob.processed_scenes + 1,
                        updated_at=datetime.utcnow(),
                    )
                )
                hb.commit()
            except Exception:
                hb.rollback()
            finally:
                hb.close()

        content_language = get_content_language_for_project(project)
        new_paths = await generate_all_voiceovers(
            scenes,
            db,
            video_style=getattr(project, "video_style", None) or "explainer",
            content_language=content_language,
            verbatim=True,
            progress_cb=_advance,
        )

        # generate_all_voiceovers swallows per-scene TTS failures (returns "" for a
        # failed scene). A scene legitimately has no audio only when its narration is
        # empty — so any scene WITH narration but WITHOUT a new path means a partial
        # failure. Don't accept it as success (which would delete the originals);
        # raise so the except branch restores the backed-up audio and refunds.
        # Skipped in no-audio mode (voice_gender == "none"), where every scene
        # legitimately returns an empty path.
        if getattr(project, "voice_gender", None) != "none":
            failed_scenes = [
                scenes[i].order
                for i in range(len(scenes))
                if (scenes[i].narration_text or "").strip()
                and not (new_paths[i] if i < len(new_paths) else "")
            ]
            if failed_scenes:
                raise RuntimeError(
                    f"Voiceover regeneration failed for {len(failed_scenes)} scene(s): {failed_scenes}"
                )

        # Clear the stale rendered video and reset status so the user can re-render.
        project.r2_video_url = None
        project.status = ProjectStatus.GENERATED
        # Finalize only if a reaper hasn't already claimed (failed/reverted) this job.
        finalized = db.execute(
            update(ProjectVoiceChangeJob)
            .where(ProjectVoiceChangeJob.id == job_id, ProjectVoiceChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
            .values(status="completed", completed_at=datetime.utcnow())
        )
        db.commit()
        if finalized.rowcount:
            _cleanup_audio_backup(project_id, job_id)
            # Read the acting user BEFORE finish() so we can exclude them from the reload
            # (their progress modal already soft-reloads on completion; a hard reload
            # races their auth re-check and can spuriously log them out).
            actor_id = (voice_change_progress.get(project_id) or {}).get("user_id")
            voice_change_progress.finish(project_id)
            # Other collaborators reload to see the regenerated audio. Async background
            # task (runs on the loop) → await the broadcast directly.
            from app.routers.collab_ws import collab_manager
            await collab_manager.broadcast(
                project_id, {"type": "project_reloaded"}, exclude_user_id=actor_id
            )
        else:
            logger.warning("[VOICE-CHANGE] job=%s already reaped; skipping completion", job_id)
            voice_change_progress.finish(project_id, error=STALL_RETRY_MESSAGE)
    except asyncio.CancelledError:
        # A stall reaper cancelled us; it owns the revert + refund. Leave state alone.
        logger.warning("[VOICE-CHANGE] job=%s cancelled by reaper", job_id)
        voice_change_progress.finish(project_id, error=STALL_RETRY_MESSAGE)
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("[VOICE-CHANGE] Failed for project %s: %s", project_id, e)
        try:
            claimed = db.execute(
                update(ProjectVoiceChangeJob)
                .where(ProjectVoiceChangeJob.id == job_id, ProjectVoiceChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
                .values(status="failed", error_message=STALL_RETRY_MESSAGE, completed_at=datetime.utcnow())
            )
            if claimed.rowcount and job_user_id is not None:
                _refund_video_credit(db, job_user_id)
            project = db.query(Project).filter(Project.id == project_id).first()
            if project and project.status in (ProjectStatus.GENERATING, ProjectStatus.VOICE_REGENERATING):
                project.status = ProjectStatus.GENERATED
            db.commit()
            if claimed.rowcount:
                if _snapshot_is_add(voice_snapshot_raw):
                    # ADD failed: there were no originals — roll back to muted and
                    # delete the partial audio (assets + files) the run created.
                    _rollback_added_voiceover(db, project_id, voice_snapshot_raw)
                else:
                    # CHANGE failed: restore the prior voice + original audio in place.
                    project = db.query(Project).filter(Project.id == project_id).first()
                    _restore_voice_snapshot(project, voice_snapshot_raw)
                    db.commit()
                    if audio_backed_up:
                        _restore_project_audio(project_id, job_id)
                        _reupload_audio_to_r2(project_id, db)
            _cleanup_audio_backup(project_id, job_id)
        except Exception:
            db.rollback()
        voice_change_progress.finish(project_id, error=STALL_RETRY_MESSAGE)
    finally:
        stall_recovery.clear("voice", job_id)
        db.close()


@router.post("/{project_id}/change-voice")
async def change_project_voice(
    project_id: int,
    body: ProjectVoiceChange,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the project voice and regenerate every scene's voiceover.

    The narration is spoken verbatim (same-to-same) in the new voice. Changing
    the voice counts as a new video, so it deducts one video credit. Regeneration
    runs in the background (status -> regenerating); poll ``/voice-change-status``
    for scene-by-scene progress. On completion the stale render is cleared and the
    project returns to GENERATED so the user can re-render freely.
    """
    from app.services import voice_change_progress

    project = _get_user_project(project_id, user.id, db)

    # Only one long-running job per project across all types (another user may have
    # started a template change, script regen, or render).
    _assert_no_active_job(project_id, db)

    # Don't start a second regeneration while one is already running. Check the DB job
    # (survives worker restarts) as well as the in-memory bar.
    active_job = (
        db.query(ProjectVoiceChangeJob)
        .filter(
            ProjectVoiceChangeJob.project_id == project_id,
            ProjectVoiceChangeJob.status.in_(_JOB_ACTIVE_STATUSES),
        )
        .order_by(ProjectVoiceChangeJob.id.desc())
        .first()
    )
    if active_job and _seconds_since(active_job.updated_at) < settings.STALL_THRESHOLD_VOICE_SECONDS:
        raise HTTPException(status_code=409, detail="A voice change is already in progress.")
    existing = voice_change_progress.get(project_id)
    if existing and not existing.get("done", True):
        raise HTTPException(status_code=409, detail="A voice change is already in progress.")

    user_row = db.query(User).filter(User.id == user.id).first()
    if not user_row:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Owner pays: bill the OWNER's quota, not the acting collaborator's. ``user_row``
    # (the actor) is still used below for voice-tuning gating + preference.
    from app.services.access import project_owner, video_limit_message
    payer = project_owner(project, db)
    # Align per-video credits with Stripe before the limit check (same as render).
    payer.roll_video_period_if_due(db)
    payer.sync_video_limit_bonus(db)
    db.refresh(payer)
    if not payer.can_create_video:
        raise HTTPException(
            status_code=403,
            detail=video_limit_message(payer, user, "change the voice"),
        )

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order)
        .all()
    )
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found. Generate the video first.")

    # Snapshot the prior voice settings BEFORE applying the new ones, so a reaped/failed
    # run can restore them (otherwise the project would show the new voice with old audio).
    voice_snapshot = json.dumps({
        "voice_gender": project.voice_gender,
        "voice_accent": project.voice_accent,
        "custom_voice_id": project.custom_voice_id,
        "voice_emotion": project.voice_emotion,
    })

    # Apply the new voice selection. gender/accent are display-only metadata —
    # the actual TTS voice is driven by custom_voice_id (or the VOICE_MAP fallback).
    # Adding a voiceover to a previously-muted project ("none") via a voice that
    # carries no gender/accent must not leave voice_gender == "none" (that would
    # skip TTS), so coerce empty/"none" to the defaults.
    if body.voice_gender is not None:
        g = body.voice_gender.strip()
        project.voice_gender = g if g and g != "none" else "female"
    if body.voice_accent is not None:
        a = body.voice_accent.strip()
        project.voice_accent = a if a and a != "none" else "american"
    # custom_voice_id may be intentionally cleared (empty string) when picking a prebuilt voice.
    if body.custom_voice_id is not None:
        project.custom_voice_id = body.custom_voice_id.strip() or None
    # Apply voice tuning when provided (Pro/Standard only; _resolve_voice_tuning raises 403 otherwise).
    # Gate on the PAYER (owner) — on a shared project the owner's plan decides whether paid voice
    # features are available, so a Free collaborator can use them on a paid owner's project.
    voice_tuning, voice_tuning_pref = _resolve_voice_tuning(body.voice_emotion, payer)
    project.voice_emotion = voice_tuning
    if voice_tuning_pref is not None:
        user_row.preferred_voice_emotion = voice_tuning_pref

    # Deduct one video credit from the OWNER and mark the project as voice-regenerating.
    payer.videos_used_this_period += 1
    project.status = ProjectStatus.VOICE_REGENERATING
    job = ProjectVoiceChangeJob(
        project_id=project_id,
        # Payer = project owner. Charge and refund both key off this.
        user_id=payer.id,
        status="queued",
        total_scenes=len(scenes),
        processed_scenes=0,
        voice_snapshot=voice_snapshot,
    )
    db.add(job)
    # Log a non-revertable history entry for the audio regeneration (attributed to actor).
    from app.services.edit_tracker import log_project_event, prune_project_history
    log_project_event(
        db, project_id=project_id, label="Audio regenerated (voice change)", user_id=user.id,
    )
    prune_project_history(db, project_id)
    db.commit()
    db.refresh(job)

    # Tell live collaborators to refetch so they see the voice regeneration start.
    # Exclude the acting user — they already transitioned locally. Async endpoint →
    # await the broadcast directly.
    from app.routers.collab_ws import collab_manager
    await collab_manager.broadcast(
        project_id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )

    # Seed progress and kick off regeneration in the background. Record the acting
    # user so the completion reload can exclude them (their modal handles completion).
    voice_change_progress.start(project_id, len(scenes), user_id=user.id)
    background_tasks.add_task(_run_voice_change, project_id, job.id)

    return {"started": True, "total": len(scenes)}


@router.get("/{project_id}/voice-change-status")
def voice_change_status(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll the progress of a running voice change (scene-by-scene).

    Plain ``def`` for the same reason as ``language_change_status``: it does only
    blocking work (sync DB queries + a stall reap that can hit R2 and rebuild the
    workspace) and is polled every 1.2s, so running it on the event loop stalls the app.
    """
    from app.services import voice_change_progress

    project = _get_user_project(project_id, user.id, db)

    # Stall recovery: if the latest voice-change job is active but its heartbeat is
    # stale, this poll reverts + refunds. The reaped job surfaces the retry copy.
    latest_job = (
        db.query(ProjectVoiceChangeJob)
        .filter(ProjectVoiceChangeJob.project_id == project_id)
        .order_by(ProjectVoiceChangeJob.id.desc())
        .first()
    )
    if maybe_reap_stale_voice_change(db, latest_job):
        db.refresh(project)
        voice_change_progress.finish(project_id, error=STALL_RETRY_MESSAGE)
        status_value = project.status.value if hasattr(project.status, "value") else str(project.status)
        return {
            "active": False,
            "done": True,
            "error": STALL_RETRY_MESSAGE,
            "total": 0,
            "completed": 0,
            "progress": 100,
            "status": status_value,
            "r2_video_url": project.r2_video_url,
            "kind": "voice_change",
        }

    prog = voice_change_progress.get(project_id)
    status_value = project.status.value if hasattr(project.status, "value") else str(project.status)

    if not prog:
        # No in-memory record on this worker (e.g. after a refresh or on another
        # worker): fall back to the DB. Prefer the job row — it carries durable
        # progress and its kind ("delete" vs voice change). A delete leaves the
        # project status untouched, so the status==GENERATING fallback only covers
        # voice changes.
        if latest_job and latest_job.status in _JOB_ACTIVE_STATUSES:
            j_total = int(latest_job.total_scenes or 0)
            j_completed = int(latest_job.processed_scenes or 0)
            j_progress = int(min(j_completed / j_total, 1.0) * 100) if j_total > 0 else 0
            return {
                "active": True,
                "done": False,
                "error": None,
                "total": j_total,
                "completed": j_completed,
                "progress": j_progress,
                "status": status_value,
                "r2_video_url": project.r2_video_url,
                "kind": "delete" if _is_delete_job(latest_job) else "voice_change",
            }
        regenerating = project.status == ProjectStatus.VOICE_REGENERATING
        return {
            "active": regenerating,
            "done": not regenerating,
            "error": None,
            "total": 0,
            "completed": 0,
            "progress": 0 if regenerating else 100,
            "status": status_value,
            "r2_video_url": project.r2_video_url,
            "kind": "voice_change",
        }

    total = int(prog.get("total") or 0)
    completed = int(prog.get("completed") or 0)
    done = bool(prog.get("done"))
    if total > 0:
        progress = int(min(completed / total, 1.0) * 100)
    else:
        progress = 100 if done else 0
    return {
        "active": not done,
        "done": done,
        "error": prog.get("error"),
        "total": total,
        "completed": completed,
        "progress": progress,
        "status": status_value,
        "r2_video_url": project.r2_video_url,
        "kind": prog.get("kind") or "voice_change",
    }


async def _run_delete_voiceover(project_id: int, job_id: int) -> None:
    """Background worker: strip the project's voiceover and make the video mute.

    Switches the project to no-audio mode (voice_gender="none", custom_voice_id=None),
    re-estimates each scene's duration (no TTS), deletes the audio (files, R2 objects,
    Asset rows) and rebuilds the workspace so the composition drops its <Audio> tags.

    Progress is tracked durably on the ProjectVoiceChangeJob row (heartbeat per scene
    via ``updated_at``/``processed_scenes``) — like a voice change — so it survives a
    page refresh and is reapable if stalled. Does NOT deduct a credit and does NOT
    clear the existing render — the user re-renders (a paid re-render) to materialize
    the muted video. On failure the prior voice settings + audio are restored.
    """
    from app.database import SessionLocal
    from app.services.voiceover import generate_all_voiceovers
    from app.services.language_detection import get_content_language_for_project
    from app.services import voice_change_progress

    # Register so a stall reaper can cancel this run for real.
    try:
        stall_recovery.register_task("voice", job_id, asyncio.current_task())
    except Exception:
        pass

    db = SessionLocal()
    backup_id = job_id
    audio_backed_up = False
    voice_snapshot_raw = None
    try:
        job = db.query(ProjectVoiceChangeJob).filter(ProjectVoiceChangeJob.id == job_id).first()
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project or not job:
            voice_change_progress.finish(project_id, error="Project not found.")
            if job:
                job.status = "failed"
                job.error_message = "Project not found."
                job.completed_at = datetime.utcnow()
                db.commit()
            return
        voice_snapshot_raw = job.voice_snapshot
        scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.order)
            .all()
        )

        # Back up existing audio so a failure can roll back, then switch to no-audio mode.
        _ensure_local_audio_from_r2(project_id, db)
        _backup_project_audio(project_id, backup_id)
        audio_backed_up = True
        job.status = "running"
        job.total_scenes = len(scenes)
        job.processed_scenes = 0
        job.audio_backed_up = True
        db.commit()

        def _advance() -> None:
            voice_change_progress.advance(project_id)
            # Heartbeat the job row in a short-lived session so the progress survives
            # refreshes/worker restarts and a stall reaper can detect liveness.
            hb = SessionLocal()
            try:
                hb.execute(
                    update(ProjectVoiceChangeJob)
                    .where(ProjectVoiceChangeJob.id == job_id)
                    .values(
                        processed_scenes=ProjectVoiceChangeJob.processed_scenes + 1,
                        updated_at=datetime.utcnow(),
                    )
                )
                hb.commit()
            except Exception:
                hb.rollback()
            finally:
                hb.close()

        # With voice_gender == "none", _get_voice_id() returns None, so
        # generate_all_voiceovers skips TTS, nulls voiceover_path and re-estimates each
        # scene's duration from its narration word count.
        project.voice_gender = "none"
        project.custom_voice_id = None
        # Captions ride on the voiceover; with no audio there's nothing to sync to, so
        # disable them when the project is muted.
        project.captions_enabled = False
        db.commit()

        content_language = get_content_language_for_project(project)
        await generate_all_voiceovers(
            scenes,
            db,
            video_style=getattr(project, "video_style", None) or "explainer",
            content_language=content_language,
            verbatim=True,
            progress_cb=_advance,
        )

        # Delete the now-orphaned audio: R2 objects, Asset rows, and local files.
        _purge_project_audio(db, project)

        # Deliberately keep r2_video_url and the project status — the prior render stays
        # available; re-rendering to apply the mute is a paid re-render.
        # Finalize only if a reaper hasn't already claimed (failed/reverted) this job.
        finalized = db.execute(
            update(ProjectVoiceChangeJob)
            .where(ProjectVoiceChangeJob.id == job_id, ProjectVoiceChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
            .values(status="completed", completed_at=datetime.utcnow())
        )
        db.commit()
        if finalized.rowcount:
            _cleanup_audio_backup(project_id, backup_id)
            # Read the acting user BEFORE finish() so we can exclude them from the reload
            # (their progress modal already soft-reloads; a hard reload races their auth
            # re-check and can spuriously log them out).
            actor_id = (voice_change_progress.get(project_id) or {}).get("user_id")
            voice_change_progress.finish(project_id)
            # Other collaborators reload to see the voiceover removed. Async background
            # task (runs on the loop) → await the broadcast directly.
            from app.routers.collab_ws import collab_manager
            await collab_manager.broadcast(
                project_id, {"type": "project_reloaded"}, exclude_user_id=actor_id
            )
        else:
            logger.warning("[DELETE-VOICEOVER] job=%s already reaped; skipping completion", job_id)
            voice_change_progress.finish(project_id, error=STALL_RETRY_MESSAGE)
    except asyncio.CancelledError:
        # A stall reaper cancelled us; it owns the revert. Leave state alone.
        logger.warning("[DELETE-VOICEOVER] job=%s cancelled by reaper", job_id)
        voice_change_progress.finish(project_id, error=STALL_RETRY_MESSAGE)
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("[DELETE-VOICEOVER] Failed for project %s: %s", project_id, e)
        try:
            claimed = db.execute(
                update(ProjectVoiceChangeJob)
                .where(ProjectVoiceChangeJob.id == job_id, ProjectVoiceChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
                .values(status="failed", error_message=STALL_RETRY_MESSAGE, completed_at=datetime.utcnow())
            )
            db.commit()
            # Full restore: scenes, AUDIO assets, audio files, voice settings, workspace.
            if claimed.rowcount:
                _rollback_delete_voiceover(
                    db, project_id, voice_snapshot_raw,
                    audio_backed_up=audio_backed_up, backup_id=backup_id,
                )
            _cleanup_audio_backup(project_id, backup_id)
        except Exception:
            db.rollback()
        voice_change_progress.finish(project_id, error=STALL_RETRY_MESSAGE)
    finally:
        stall_recovery.clear("voice", job_id)
        db.close()


@router.post("/{project_id}/delete-voiceover")
async def delete_project_voiceover(
    project_id: int,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove the project's voiceover and make the video mute.

    Runs in the background as a ProjectVoiceChangeJob tagged "_op: delete" (poll the
    shared ``/voice-change-status`` for scene-by-scene progress — it reports the job
    kind). Does NOT deduct a video credit and does NOT clear the existing render —
    re-rendering to apply the mute is a normal (paid) re-render.
    """
    from app.services import voice_change_progress

    project = _get_user_project(project_id, user.id, db)

    # Already muted — nothing to do.
    if getattr(project, "voice_gender", None) == "none":
        return {"started": False, "total": 0}

    # Only one long-running job per project across all types (another user may have
    # started a template change, script/voice regen, or render).
    _assert_no_active_job(project_id, db)

    # Don't strip audio while a voice change or another delete is running.
    active_job = (
        db.query(ProjectVoiceChangeJob)
        .filter(
            ProjectVoiceChangeJob.project_id == project_id,
            ProjectVoiceChangeJob.status.in_(_JOB_ACTIVE_STATUSES),
        )
        .order_by(ProjectVoiceChangeJob.id.desc())
        .first()
    )
    if active_job and _seconds_since(active_job.updated_at) < settings.STALL_THRESHOLD_VOICE_SECONDS:
        raise HTTPException(status_code=409, detail="A voice change is already in progress.")
    existing = voice_change_progress.get(project_id)
    if existing and not existing.get("done", True):
        raise HTTPException(status_code=409, detail="An operation is already in progress.")

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order)
        .all()
    )
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found. Generate the video first.")

    # Snapshot the FULL pre-delete state so a failed/reaped run can fully roll back —
    # delete nulls scene.voiceover_path, recomputes durations, removes AUDIO assets and
    # rebuilds the workspace mute, so restoring only the voice settings would leave a
    # broken/muted project. We capture voice settings + per-scene paths/durations + the
    # AUDIO asset rows (the audio files themselves are restored from the on-disk backup
    # the worker takes). The "_op": "delete" marker reuses ProjectVoiceChangeJob but
    # tells the stall-reaper this is a delete (no refund, no status reset).
    from app.models.asset import Asset as _Asset, AssetType as _AssetType

    audio_assets = (
        db.query(_Asset)
        .filter(_Asset.project_id == project_id, _Asset.asset_type == _AssetType.AUDIO)
        .all()
    )
    voice_snapshot = json.dumps({
        "voice_gender": project.voice_gender,
        "voice_accent": project.voice_accent,
        "custom_voice_id": project.custom_voice_id,
        "_op": "delete",
        "scenes": [
            {
                "id": s.id,
                "voiceover_path": s.voiceover_path,
                "duration_seconds": s.duration_seconds,
            }
            for s in scenes
        ],
        "assets": [
            {
                "filename": a.filename,
                "local_path": a.local_path,
                "r2_key": a.r2_key,
                "r2_url": a.r2_url,
            }
            for a in audio_assets
        ],
    })
    job = ProjectVoiceChangeJob(
        project_id=project_id,
        user_id=user.id,
        status="queued",
        total_scenes=len(scenes),
        processed_scenes=0,
        voice_snapshot=voice_snapshot,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Tell live collaborators to refetch so they see the voiceover removal start.
    # Exclude the acting user — they already transitioned locally. Async endpoint →
    # await the broadcast directly.
    from app.routers.collab_ws import collab_manager
    await collab_manager.broadcast(
        project_id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )

    # Record the acting user so the completion reload can exclude them.
    voice_change_progress.start(project_id, len(scenes), kind="delete", user_id=user.id)
    background_tasks.add_task(_run_delete_voiceover, project_id, job.id)
    return {"started": True, "total": len(scenes)}


def _name_from_url(url: str) -> str:
    """Generate a project name from a URL."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    path = parsed.path.strip("/").split("/")[-1] if parsed.path.strip("/") else parsed.netloc
    return path.replace("-", " ").replace("_", " ").title()[:100] or "Untitled Project"


def _name_from_files(files: list[UploadFile]) -> str:
    """Generate a project name from uploaded file names."""
    if files and files[0].filename:
        # Use the first file's name without extension
        base = os.path.splitext(files[0].filename)[0]
        name = base.replace("-", " ").replace("_", " ").title()[:100]
        if name:
            return name
    return "Uploaded Document"


# ═══════════════════════════════════════════════════════════════════════════
# Change language: translate every scene's copy, then regenerate every voiceover.
# Any editor may trigger it; the project OWNER pays (one video credit, refunded
# on failure). Layouts, image assignments, colors, chart data and links are
# preserved byte-for-byte — only prose changes language.
# ═══════════════════════════════════════════════════════════════════════════


def _scene_content_snapshot(scenes: list[Scene], prior_language: str | None) -> str:
    """Serialize the pre-change copy so a failed/reaped run can restore it."""
    return json.dumps({
        "content_language": prior_language,
        "scenes": [
            {
                "id": s.id,
                "title": s.title,
                "display_text": s.display_text,
                "narration_text": s.narration_text,
                "remotion_code": s.remotion_code,
            }
            for s in scenes
        ],
    })


async def _translate_project_scenes(
    project: Project,
    scenes: list[Scene],
    target_language: str,
    db: Session,
    on_scene_done,
    *,
    cancel_event=None,
) -> None:
    """Phase A: translate title / display_text / narration_text / layoutProps per scene.

    One LLM call per scene keeps the whole scene's copy in a single context (so a
    heading and its body agree) and bounds cost. The scene's descriptor keys, layout,
    image assignment, numbers and links are never touched — see services/translation.

    ``cancel_event`` is the cooperative-cancel ``threading.Event`` from stall_recovery;
    we check it per scene so a reaped run stops promptly instead of translating on.
    Already-translated scenes stay committed — the caller's revert restores them.
    """
    from app.dspy_modules.translate_content import ContentTranslator
    from app.services.template_service import get_meta
    from app.services.translation import (
        apply_translations,
        collect_translatable_props,
        get_values_at,
    )

    translator = ContentTranslator(target_language=target_language)
    # get_meta returns None for crafted/custom templates; the collector falls back to a
    # prose heuristic when a layout has no declared schema.
    meta = get_meta(project.template) or {}
    schema = meta.get("layout_prop_schema") or {}

    for scene in scenes:
        if cancel_event is not None and cancel_event.is_set():
            logger.warning("[LANG-CHANGE] translate phase cancelled at scene=%s", scene.id)
            return

        # ── scene-level text columns ──────────────────────────────────────
        fields: list[tuple[str, str]] = []
        if (scene.title or "").strip():
            fields.append(("title", scene.title))
        if (scene.display_text or "").strip():
            fields.append(("display_text", scene.display_text))
        if (scene.narration_text or "").strip():
            fields.append(("narration_text", scene.narration_text))

        context = f"Scene {scene.order} of a short explainer video."

        if fields:
            translated = await translator.translate([v for _, v in fields], context=context)
            for (attr, original), new_value in zip(fields, translated):
                setattr(scene, attr, new_value if (new_value or "").strip() else original)

        # ── descriptor layoutProps ────────────────────────────────────────
        if scene.remotion_code:
            try:
                descriptor = json.loads(scene.remotion_code)
            except (json.JSONDecodeError, TypeError):
                descriptor = None

            if isinstance(descriptor, dict) and descriptor.get("layoutProps"):
                layout = str(descriptor.get("layout") or "")
                props = descriptor.get("layoutProps") or {}
                paths = collect_translatable_props(layout, props, schema)
                if paths:
                    originals = get_values_at(props, paths)
                    new_values = await translator.translate(originals, context=context)
                    safe = [
                        t if isinstance(t, str) and t.strip() else o
                        for t, o in zip(new_values, originals)
                    ]
                    try:
                        new_props = apply_translations(props, paths, safe)
                        out = dict(descriptor)
                        out["layoutProps"] = new_props
                        scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(out))
                    except ValueError:
                        logger.exception(
                            "[LANG-CHANGE] prop apply failed for scene=%s; keeping original", scene.id
                        )

        db.commit()
        on_scene_done()


def _run_language_change(project_id: int, job_id: int) -> None:
    """Background worker: translate all scene copy, then regenerate every voiceover.

    Runs in a thread-pool executor (like the template-change and script-regeneration
    jobs) rather than as a coroutine on the event loop. The run mixes long awaited work
    (LLM + TTS) with blocking work (R2 audio download, per-scene DB commits, workspace
    rebuild); off-loading the whole thing keeps every blocking call away from the loop
    so the rest of the app stays responsive. The async phases are driven with
    ``asyncio.run`` inside this thread.

    Uses its own DB session (the request's session closes once the response is sent) and
    heartbeats ``ProjectLanguageChangeJob.updated_at`` once per scene per phase so a
    stalled run can be reaped + reverted via the status-polling API.
    """
    from app.database import SessionLocal
    from app.services.voiceover import generate_all_voiceovers
    from app.services.language_detection import get_content_language_for_project
    from app.services import language_change_progress

    # Cooperative cancellation: a sync worker can't be `task.cancel()`ed, so the reaper
    # sets this Event and we bail at the next checkpoint (same as the template job).
    cancel_event = stall_recovery.arm("language", job_id)

    db = SessionLocal()
    job_user_id = None
    audio_backed_up = False
    snapshot_raw = None
    try:
        job = db.query(ProjectLanguageChangeJob).filter(ProjectLanguageChangeJob.id == job_id).first()
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project or not job:
            language_change_progress.finish(project_id, error="Project not found.")
            if job:
                job.status = "failed"
                job.error_message = "Project not found."
                job.completed_at = datetime.utcnow()
                db.commit()
            return

        job_user_id = job.user_id
        snapshot_raw = job.content_snapshot
        scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.order)
            .all()
        )

        # Back up existing audio BEFORE generate overwrites scene_N.mp3 in place, so a
        # reaped/failed run can restore the originals. Pull from R2 first in case the
        # local cache is cold (otherwise the backup would be empty).
        _ensure_local_audio_from_r2(project_id, db)
        _backup_project_audio(project_id, job_id)
        audio_backed_up = True
        job.status = "running"
        job.total_scenes = 2 * len(scenes)
        job.processed_scenes = 0
        job.audio_backed_up = True
        db.commit()

        def _advance() -> None:
            language_change_progress.advance(project_id)
            # Heartbeat in a separate short-lived session so we never disturb the
            # worker's session mid-generation.
            hb = SessionLocal()
            try:
                hb.execute(
                    update(ProjectLanguageChangeJob)
                    .where(ProjectLanguageChangeJob.id == job_id)
                    .values(
                        processed_scenes=ProjectLanguageChangeJob.processed_scenes + 1,
                        updated_at=datetime.utcnow(),
                    )
                )
                hb.commit()
            except Exception:
                hb.rollback()
            finally:
                hb.close()

        # ── Phase A: translate every scene's copy ─────────────────────────
        # project.content_language was set to the target by the endpoint, so this
        # resolves to the NEW language name (e.g. 'Spanish').
        target_language = get_content_language_for_project(project)
        asyncio.run(
            _translate_project_scenes(
                project, scenes, target_language, db, _advance, cancel_event=cancel_event
            )
        )

        if cancel_event.is_set():
            logger.warning("[LANG-CHANGE] job=%s superseded by reaper; aborting after translate", job_id)
            return

        # ── Phase B: regenerate every voiceover in the new language ───────
        language_change_progress.set_phase(project_id, language_change_progress.PHASE_VOICEOVER)
        # Re-fetch after asyncio.run() — running a loop inside the executor thread can
        # leave pre-loaded ORM objects detached from this session.
        project = db.query(Project).filter(Project.id == project_id).first()
        scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.order)
            .all()
        )
        new_paths = asyncio.run(
            generate_all_voiceovers(
                scenes,
                db,
                video_style=getattr(project, "video_style", None) or "explainer",
                content_language=target_language,
                # Speak the translated narration as-is; do not re-expand it (that would
                # re-write the copy we just carefully translated).
                verbatim=True,
                progress_cb=_advance,
            )
        )

        # generate_all_voiceovers swallows per-scene TTS failures (returns "" for a
        # failed scene). A scene legitimately has no audio only when its narration is
        # empty — so narration WITHOUT a new path means a partial failure. Don't accept
        # it as success (that would delete the originals); raise so the except branch
        # restores the backed-up audio + copy and refunds.
        if getattr(project, "voice_gender", None) != "none":
            failed_scenes = [
                scenes[i].order
                for i in range(len(scenes))
                if (scenes[i].narration_text or "").strip()
                and not (new_paths[i] if i < len(new_paths) else "")
            ]
            if failed_scenes:
                raise RuntimeError(
                    f"Voiceover regeneration failed for {len(failed_scenes)} scene(s): {failed_scenes}"
                )

        if cancel_event.is_set():
            logger.warning("[LANG-CHANGE] job=%s superseded by reaper; aborting before finalize", job_id)
            return

        # Clear the stale rendered video and reset status so the user can re-render.
        project.r2_video_url = None
        project.status = ProjectStatus.GENERATED
        # Finalize only if a reaper hasn't already claimed (failed/reverted) this job.
        finalized = db.execute(
            update(ProjectLanguageChangeJob)
            .where(ProjectLanguageChangeJob.id == job_id, ProjectLanguageChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
            .values(status="completed", completed_at=datetime.utcnow())
        )
        db.commit()
        if finalized.rowcount:
            _cleanup_audio_backup(project_id, job_id)
            actor_id = (language_change_progress.get(project_id) or {}).get("user_id")
            language_change_progress.finish(project_id)
            # Sync worker (no event loop here) → use the thread-safe broadcast helper.
            from app.routers.collab_ws import broadcast_project_reload
            broadcast_project_reload(project_id, exclude_user_id=actor_id)
        else:
            logger.warning("[LANG-CHANGE] job=%s already reaped; skipping completion", job_id)
            language_change_progress.finish(project_id, error=STALL_RETRY_MESSAGE)

    except Exception as e:  # noqa: BLE001
        logger.exception("[LANG-CHANGE] Failed for project %s: %s", project_id, e)
        try:
            claimed = db.execute(
                update(ProjectLanguageChangeJob)
                .where(ProjectLanguageChangeJob.id == job_id, ProjectLanguageChangeJob.status.in_(_JOB_ACTIVE_STATUSES))
                .values(status="failed", error_message=STALL_RETRY_MESSAGE, completed_at=datetime.utcnow())
            )
            # Refund only if WE claimed the job — otherwise a reaper already refunded.
            if claimed.rowcount and job_user_id is not None:
                _refund_video_credit(db, job_user_id)
            project = db.query(Project).filter(Project.id == project_id).first()
            if claimed.rowcount:
                _restore_content_snapshot(db, project, snapshot_raw)
            if project and project.status == ProjectStatus.LANGUAGE_REGENERATING:
                project.status = ProjectStatus.GENERATED
            db.commit()
            if claimed.rowcount and audio_backed_up:
                _restore_project_audio(project_id, job_id)
                _reupload_audio_to_r2(project_id, db)
            _cleanup_audio_backup(project_id, job_id)
        except Exception:
            db.rollback()
        language_change_progress.finish(project_id, error=STALL_RETRY_MESSAGE)
    finally:
        stall_recovery.clear("language", job_id)
        db.close()


@router.post("/{project_id}/change-language")
async def change_project_language(
    project_id: int,
    body: ProjectLanguageChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Translate the whole project into a new language and regenerate its voiceovers.

    Every scene's title, display text, narration and on-screen layout text is translated
    in place; layouts, image assignments, colors, chart data and links are untouched.
    Counts as a new video, so it deducts one video credit from the project OWNER (a
    collaborator may trigger it — the owner pays). Runs in the background (status ->
    language_regenerating); poll ``/language-change-status`` for progress.
    """
    from app.services import language_change_progress
    from app.services.language_detection import (
        get_language_for_prompt,
        normalize_preferred_language_code,
    )
    from app.services.access import project_owner, video_limit_message

    # Editor role: any accepted collaborator may trigger a language change.
    project = _get_user_project(project_id, user.id, db)

    # Only one long-running job per project across all types.
    _assert_no_active_job(project_id, db)

    new_code = normalize_preferred_language_code(body.content_language)
    if not new_code:
        raise HTTPException(status_code=400, detail="A target language is required.")
    if new_code == (project.content_language or "").strip().lower():
        raise HTTPException(status_code=400, detail="Project is already in that language.")

    # Owner pays: bill the OWNER's quota, not the acting collaborator's.
    payer = project_owner(project, db)
    # Align per-video credits with Stripe before the limit check (same as render).
    payer.roll_video_period_if_due(db)
    payer.sync_video_limit_bonus(db)
    db.refresh(payer)
    if not payer.can_create_video:
        raise HTTPException(
            status_code=403,
            detail=video_limit_message(payer, user, "change the language"),
        )

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order)
        .all()
    )
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found. Generate the video first.")

    # Snapshot the prior copy BEFORE translating, so a reaped/failed run can restore it.
    content_snapshot = _scene_content_snapshot(scenes, project.content_language)

    project.content_language = new_code
    # Deduct one video credit from the OWNER and mark the project as language-regenerating.
    payer.videos_used_this_period += 1
    project.status = ProjectStatus.LANGUAGE_REGENERATING
    job = ProjectLanguageChangeJob(
        project_id=project_id,
        # Payer = project owner. Charge and refund both key off this.
        user_id=payer.id,
        status="queued",
        total_scenes=2 * len(scenes),
        processed_scenes=0,
        target_language=new_code,
        content_snapshot=content_snapshot,
    )
    db.add(job)
    # Log a non-revertable history entry, attributed to the ACTOR (not the payer).
    # Show the human-readable language ("Urdu"), not the ISO code ("ur") — the history
    # modal renders this label verbatim. Unknown codes fall through to the code itself.
    from app.services.edit_tracker import log_project_event, prune_project_history
    log_project_event(
        db,
        project_id=project_id,
        label=f"Language changed to {get_language_for_prompt(new_code)}",
        user_id=user.id,
    )
    prune_project_history(db, project_id)
    db.commit()
    db.refresh(job)

    # Tell live collaborators to refetch so they see the language change start.
    from app.routers.collab_ws import collab_manager
    await collab_manager.broadcast(
        project_id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )

    language_change_progress.start(
        project_id, 2 * len(scenes), user_id=user.id, target_language=new_code
    )
    # Off-load to the thread pool (like the template-change / script-regen jobs) so the
    # run's blocking work (R2 audio pull, per-scene commits, workspace rebuild) never
    # touches the event loop.
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run_language_change, project_id, job.id)

    return {"started": True, "total": 2 * len(scenes), "content_language": new_code}


@router.get("/{project_id}/language-change-status")
def language_change_status(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll the progress of a running language change (scene-by-scene, two phases).

    Deliberately a plain ``def`` (like ``get_regenerate_script_status``), NOT ``async``:
    every call here is blocking — synchronous SQLAlchemy queries, and a stall reap that
    can pull audio from R2 and rebuild the Remotion workspace. As an ``async def`` those
    would run straight on the event loop, and the frontend polls this every 1.2s while a
    translation runs, stalling the whole app. FastAPI runs sync handlers in its
    threadpool, keeping the loop free.
    """
    from app.services import language_change_progress

    project = _get_user_project(project_id, user.id, db)

    # Stall recovery: if the latest job is active but its heartbeat is stale, this poll
    # reverts + refunds. The reaped job surfaces the retry copy.
    latest_job = (
        db.query(ProjectLanguageChangeJob)
        .filter(ProjectLanguageChangeJob.project_id == project_id)
        .order_by(ProjectLanguageChangeJob.id.desc())
        .first()
    )
    if maybe_reap_stale_language_change(db, latest_job):
        db.refresh(project)
        language_change_progress.finish(project_id, error=STALL_RETRY_MESSAGE)
        status_value = project.status.value if hasattr(project.status, "value") else str(project.status)
        return {
            "active": False,
            "done": True,
            "error": STALL_RETRY_MESSAGE,
            "total": 0,
            "completed": 0,
            "progress": 100,
            "status": status_value,
            "r2_video_url": project.r2_video_url,
            "kind": "language_change",
            "content_language": project.content_language,
        }

    prog = language_change_progress.get(project_id)
    status_value = project.status.value if hasattr(project.status, "value") else str(project.status)

    if not prog:
        # No in-memory record on this worker (after a refresh, or on another worker):
        # fall back to the durable job row.
        if latest_job and latest_job.status in _JOB_ACTIVE_STATUSES:
            j_total = int(latest_job.total_scenes or 0)
            j_completed = int(latest_job.processed_scenes or 0)
            j_progress = int(min(j_completed / j_total, 1.0) * 100) if j_total > 0 else 0
            return {
                "active": True,
                "done": False,
                "error": None,
                "total": j_total,
                "completed": j_completed,
                "progress": j_progress,
                "status": status_value,
                "r2_video_url": project.r2_video_url,
                "kind": "language_change",
                "content_language": project.content_language,
            }
        regenerating = project.status == ProjectStatus.LANGUAGE_REGENERATING
        return {
            "active": regenerating,
            "done": not regenerating,
            "error": None,
            "total": 0,
            "completed": 0,
            "progress": 0 if regenerating else 100,
            "status": status_value,
            "r2_video_url": project.r2_video_url,
            "kind": "language_change",
            "content_language": project.content_language,
        }

    total = int(prog.get("total") or 0)
    completed = int(prog.get("completed") or 0)
    done = bool(prog.get("done"))
    if total > 0:
        progress = int(min(completed / total, 1.0) * 100)
    else:
        progress = 100 if done else 0
    return {
        "active": not done,
        "done": done,
        "error": prog.get("error"),
        "total": total,
        "completed": completed,
        "progress": progress,
        "phase": prog.get("phase"),
        "status": status_value,
        "r2_video_url": project.r2_video_url,
        "kind": "language_change",
        "content_language": project.content_language,
    }
