import asyncio
import base64
import json
import logging
import os
import shutil
import time
import uuid
import requests
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Request, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, inspect, select, text, update, or_
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.auth import get_current_user
from app.config import settings
from app.models.user import User, PlanTier, PAID_TIERS
from app.models.project import Project, ProjectStatus
from app.models.review import Review
from app.models.avatar_review import AvatarReview
from app.models.scene import Scene
from app.models.project_template_change_job import ProjectTemplateChangeJob
from app.models.project_regenerate_script_job import ProjectRegenerateScriptJob
from app.models.project_voice_change_job import ProjectVoiceChangeJob
from app.models.project_language_change_job import ProjectLanguageChangeJob
from app.models.project_add_scene_job import ProjectAddSceneJob
from app.models.scene_avatar_job import SceneAvatarJob
from app.services import stall_recovery
from app.services.stall_recovery import STALL_RETRY_MESSAGE
from app.models.crafted_template import CraftedTemplate
from app.models.crafted_template_entitlement import CraftedTemplateEntitlement
from app.models.custom_template import CustomTemplate
from app.schemas.schemas import (
    ProjectCreate, ProjectOut, ProjectListOut, ProjectLogoUpdate,
    BulkProjectItem, BulkCreateResponse,
    ReviewOut, ReviewStateOut, ReviewSubmit, ReviewSubmitResponse, SceneOut,
    AvatarReviewOut, AvatarReviewSubmit,
    AvatarReviewOut, AvatarReviewSubmit,
    SceneUpdate, ReorderScenesRequest, RegenerateSceneRequest, AddSceneRequest, AddSceneJobOut,
    SceneAvatarAppearanceUpdate,
    SceneAvatarFocusUpdate,
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
    get_composition_duration_frames,
    _prepare_still_workspace,
    _render_still_frame,
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
    get_layout_variants,
    get_variant_to_base,
    get_all_renderable_layouts,
    resolve_base_layout,
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
from datetime import timedelta as _timedelta

# How far back create_project looks for an identical in-flight request before
# treating a call as a retry rather than a new video. Sized to comfortably cover
# a full generation (the MCP generate poll tops out at 300s) so a client that
# times out and retries mid-generation reuses the project it already paid for.
_DUPLICATE_CREATE_WINDOW = _timedelta(minutes=10)

# Statuses that mean "this project is still mid-pipeline". Deliberately excludes
# GENERATED/DONE/ERROR: those are settled outcomes, and asking for the same URL
# again afterwards is a genuine new video that must create and charge normally.
# Only an unfinished run is treated as the target of a retry.
_IN_FLIGHT_STATUSES = (
    ProjectStatus.CREATED,
    ProjectStatus.SCRAPED,
    ProjectStatus.SCRIPTED,
)

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


def _build_avatar_review(project: Project, user: User, db: Session) -> Optional[AvatarReviewOut]:
    """This user's avatar rating for this project, or None when they have not rated.

    Carried on the project payload rather than fetched by the Avatar tab: that tab
    unmounts on every tab switch, so a fetch-on-mount would re-flash the rating
    form each time before the saved rating arrived.
    """
    row = (
        db.query(AvatarReview)
        .filter(AvatarReview.user_id == user.id, AvatarReview.project_id == project.id)
        .first()
    )
    return AvatarReviewOut.model_validate(row) if row else None


def _build_avatar_review(project: Project, user: User, db: Session) -> Optional[AvatarReviewOut]:
    """This user's avatar rating for this project, or None when they have not rated.

    Carried on the project payload rather than fetched by the Avatar tab: that tab
    unmounts on every tab switch, so a fetch-on-mount would re-flash the rating
    form each time before the saved rating arrived.
    """
    row = (
        db.query(AvatarReview)
        .filter(AvatarReview.user_id == user.id, AvatarReview.project_id == project.id)
        .first()
    )
    return AvatarReviewOut.model_validate(row) if row else None


def _prepare_project_response(project: Project, user: User, db: Session) -> Project:
    from app.models.user import PAID_TIERS
    _inject_custom_theme(project)
    project.review_state = _build_review_state(project, user, db)
    project.avatar_review = _build_avatar_review(project, user, db)
    project.is_shared = _project_is_shared(project, db)
    # Expose the OWNER's paid-plan status so a collaborator gates premium features
    # (custom/crafted templates, paid voices) on the owner's plan — the owner pays.
    # Also expose the owner's display name so a collaborator's settings pop-ups can
    # attribute the owner's templates/voices to them.
    owner = db.query(User).filter(User.id == project.user_id).first()
    project.owner_is_pro = bool(owner and owner.plan in PAID_TIERS)
    # Owner's AI-edit budget — a collaborator's gating draws from the owner's
    # balance once their own is spent, so the UI needs both pools.
    project.owner_ai_edit_credits = (owner.ai_edit_credits or 0) if owner else 0
    project.owner_ai_edit_allowance_remaining = (owner.ai_edit_allowance_remaining or 0) if owner else 0
    project.owner_name = owner.name if owner else None
    _mark_refunded_scenes(project, db)
    return project


def _mark_refunded_scenes(project: Project, db: Session) -> None:
    """Stamp ``avatar_credits_refunded`` onto this project's scenes.

    A refunded scene is permanently closed to avatar generation (see
    SceneAvatarJob.credits_refunded), but that fact lives on the JOB table, so
    without this the client cannot see it and keeps offering the scene — the
    picker lists it, the "N scenes still don't have an avatar" banner counts it,
    and authorize_avatar_batch then either drops it from a paid batch or rejects
    the whole request for falling under the minimum.

    ONE query for the whole project, not one per scene: this runs on every
    project response.
    """
    scenes = project.scenes or []
    if not scenes:
        return
    refunded = {
        sid
        for (sid,) in db.query(SceneAvatarJob.scene_id)
        .filter(
            SceneAvatarJob.project_id == project.id,
            SceneAvatarJob.credits_refunded.is_(True),
        )
        .distinct()
    }
    for scene in scenes:
        scene.avatar_credits_refunded = scene.id in refunded


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
# Long-form options reserved for paid plans; FREE users top out at "medium".
_PAID_ONLY_VIDEO_LENGTHS = {"detailed", "mdetailed"}
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


def _default_avatar_size(aspect_ratio: str | None) -> float:
    """New-project avatar_size default: portrait frames are much narrower, so
    the same fraction of composition width reads far smaller on-screen than
    it does in landscape — portrait gets a bigger default to compensate.
    """
    return 0.30 if aspect_ratio == "portrait" else 0.16


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


def _normalize_video_length(video_length: str | None, user: User | None = None) -> str:
    """Normalize and validate video_length stored on Project.

    ``user`` gates the long options: "detailed" and "more detailed" require a
    Pro or Standard subscription, so FREE users top out at "medium". Passed at
    every project-creation/update entry point; omitted only where the value is
    already-normalized data being re-read rather than user input.
    """
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
    if (
        raw in _PAID_ONLY_VIDEO_LENGTHS
        and user is not None
        and user.plan not in PAID_TIERS
    ):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "video_length_requires_paid",
                "message": "Detailed and More detailed videos require a paid subscription.",
            },
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
    if user.plan not in PAID_TIERS:
        raise HTTPException(
            status_code=403,
            detail="Voice tuning requires a paid subscription.",
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


def _clear_video_assignment(lp: dict) -> None:
    """Drop a stock-footage assignment, leaving image framing keys alone.

    Framing (imageFocusX/Y, imageZoom) is deliberately SHARED between stills and
    clips so the existing Adjust-framing UI works on both; it is therefore not
    cleared here — only by _clear_image_assignment.
    """
    lp.pop("assignedVideo", None)
    lp.pop("videoMuted", None)
    lp.pop("videoVolume", None)
    lp.pop("videoStartSeconds", None)


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

        # Add the system-owned documentary leader BEFORE rebuilding Remotion
        # data. Otherwise the new row misses that rebuild and its absent
        # descriptor is rendered as the template's hero layout.
        countdown_scene = None
        countdown_added = False
        try:
            from app.routers.pipeline import ensure_docreel_countdown_scene

            countdown_added = ensure_docreel_countdown_scene(
                db, project.id, target_template
            )
            if countdown_added:
                countdown_scene = (
                    db.query(Scene)
                    .filter(
                        Scene.project_id == project.id,
                        Scene.preferred_layout == "docreel_countdown",
                    )
                    .order_by(Scene.order)
                    .first()
                )
                logger.info(
                    "[PROJECT_TEMPLATE_CHANGE] job=%s: added docreel countdown leader",
                    job_id,
                )
        except Exception:
            logger.warning(
                "[PROJECT_TEMPLATE_CHANGE] job=%s: countdown leader injection failed",
                job_id,
                exc_info=True,
            )

        # Record the fixed countdown with the project's selected voice before
        # rebuilding Remotion data, so the refreshed preview includes its audio.
        # Existing scenes kept their old filenames while their orders shifted,
        # so use a unique name rather than overwriting former scene-1 audio.
        if countdown_added and countdown_scene is not None and project.voice_gender != "none":
            try:
                from app.services.voiceover import generate_voiceover

                generate_voiceover(
                    countdown_scene,
                    db,
                    output_filename=f"scene_docreel_countdown_{countdown_scene.id}.mp3",
                )
            except Exception:
                logger.warning(
                    "[PROJECT_TEMPLATE_CHANGE] job=%s: countdown voiceover failed",
                    job_id,
                    exc_info=True,
                )

        # Re-run visual assignment against the NEW template. The descriptors were
        # rebuilt above with empty layoutProps, so this is what actually fills each
        # scene's visual slot — images first, then clips the project already owns
        # into whatever no image covered (see write_remotion_data). Must run AFTER
        # project.template flips so it uses the target template's layout rules.
        try:
            from app.services.remotion import write_remotion_data

            fresh_scenes = (
                db.query(Scene)
                .filter(Scene.project_id == project.id, Scene.is_active.is_(True))
                .order_by(Scene.order)
                .all()
            )
            write_remotion_data(project, fresh_scenes, db, redistribute_images=True)
            db.commit()
        except Exception:
            # Non-fatal: the template change itself succeeded. The workspace is
            # rewritten on the next render anyway.
            logger.warning(
                "[PROJECT_TEMPLATE_CHANGE] job=%s: visual reassignment failed", job_id,
                exc_info=True,
            )

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


def _resolve_stock_footage_flag(requested: bool, user: User, template_id: str) -> bool:
    """Whether generation should pause for stock-footage review.

    Available on every plan and every template — free users get a clip on a
    single scene (capped by ``_stock_footage_scene_cap`` in the pipeline), paid
    users on all image-capable scenes.
    """
    return bool(requested)


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

    # Idempotency guard. A client that times out waiting for this endpoint (the
    # MCP connector gives up well before a long generation finishes) retries the
    # same request — and every retry used to create another project AND charge
    # another video credit, while the original kept generating server-side.
    # Return the in-flight project instead of duplicating it. Scoped tightly:
    # same user, same URL, only recently, and only while it is still progressing
    # — a finished or failed project must not block a deliberate re-run.
    duplicate = (
        db.query(Project)
        .filter(
            Project.user_id == user.id,
            Project.blog_url == data.blog_url,
            Project.created_at >= datetime.utcnow() - _DUPLICATE_CREATE_WINDOW,
            Project.status.in_(_IN_FLIGHT_STATUSES),
        )
        .order_by(Project.id.desc())
        .first()
    )
    if duplicate is not None:
        logger.info(
            "[PROJECTS] Reusing in-flight project %s for user %s (duplicate create for %s)",
            duplicate.id, user.id, data.blog_url,
            extra={"project_id": duplicate.id, "user_id": user.id},
        )
        return _prepare_project_response(duplicate, user, db)

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
        avatar_size=(
            data.avatar_size
            if data.avatar_size is not None
            else _default_avatar_size(data.aspect_ratio or "landscape")
        ),
        video_style=normalized_video_style,
        video_length=_normalize_video_length(getattr(data, "video_length", None), user),
        playback_speed=_normalize_playback_speed(getattr(data, "playback_speed", None)),
        content_language=normalize_preferred_language_code(data.content_language),
        bgm_track_id=getattr(data, "bgm_track_id", None) or None,
        bgm_volume=getattr(data, "bgm_volume", None) or 0.10,
        captions_enabled=bool(getattr(data, "captions_enabled", False)),
        caption_position=getattr(data, "caption_position", None) or "bottom_center",
        caption_font_family=getattr(data, "caption_font_family", None) or "inter",
        caption_font_size=getattr(data, "caption_font_size", None) or "36",
        caption_offset=int(getattr(data, "caption_offset", 0) or 0),
        stock_footage_enabled=_resolve_stock_footage_flag(
            getattr(data, "stock_footage_enabled", False), user, template_id
        ),
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
        if field in ("font_family", "bgm_track_id", "avatar_bg"):
            # avatar_bg: NULL is a MEANINGFUL value ("keep the portrait's own
            # background"), not "unchanged" — so it must bypass the drop-nulls
            # branch below or the user could never turn a custom background off.
            update_data[field] = value  # allow nulling or changing
        elif field == "content_language":
            update_data[field] = normalize_preferred_language_code(value) if value is not None else None
        elif field == "video_length":
            # Entitlement follows the OWNER, not the acting collaborator — same
            # rule as the AI-edit/stock-footage gates, so a FREE collaborator on
            # a PRO owner's project can still pick a long length (and vice versa).
            from app.services.access import project_owner as _project_owner
            update_data[field] = _normalize_video_length(value, _project_owner(project, db))
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

    # aspect_ratio changed and the caller did NOT also send avatar_size in this
    # same PATCH: the overlay's project-level size is a single float with no
    # per-aspect-ratio memory, so a landscape-appropriate 0.16 stays frozen
    # after switching to portrait — where the frame is much narrower and 16%
    # of its width reads as a barely-visible sliver. _default_avatar_size is
    # already the right number for a NEW project; apply it here too, but ONLY
    # when the current value still equals one of the two known defaults
    # (0.16/0.30) — a value the user actually chose must never be silently
    # overwritten just because they changed the frame shape.
    if "aspect_ratio" in update_data and "avatar_size" not in update_data:
        _known_defaults = (0.16, 0.30)
        if any(abs(project.avatar_size - d) < 1e-9 for d in _known_defaults):
            new_default = _default_avatar_size(update_data["aspect_ratio"])
            if abs(project.avatar_size - new_default) > 1e-9:
                update_data["avatar_size"] = new_default
                project.avatar_size = new_default

    # The avatar overlay settings are GLOBAL: saving them in the Avatar tab
    # pushes the values onto every scene, overwriting per-scene edits. Without
    # this, a scene the user had customised earlier was the one scene a later
    # global change could not reach — `scene.avatar_* ?? project.avatar_*` meant
    # its non-null value kept winning, which is exactly the bug this fixes.
    #
    # Keyed off update_data (NOT the constant below, and NOT the schema fields):
    # update_project honours model_fields_set, so a PATCH sending only, say,
    # bgm_volume puts no avatar key here and must leave scene overlays alone.
    # Values are already normalised/clamped by the field validators.
    #
    # Scene-only framing (avatar_focus_x/_y/_zoom) is deliberately absent: it
    # describes a region of THAT clip and has no project-level counterpart.
    _AVATAR_SCENE_FIELDS = (
        "avatar_shape", "avatar_size", "avatar_position",
        "avatar_bg", "avatar_opacity",
    )
    stamped = {f: update_data[f] for f in _AVATAR_SCENE_FIELDS if f in update_data}
    if stamped:
        # Not gated on avatar_video_path (unlike the matte sweep, which is gated
        # because matting is expensive work that is pointless without a clip):
        # writing five columns is cheap, and a scene that generates an avatar
        # LATER must already carry these values or it would silently resolve
        # against whatever the project says at render time.
        #
        # No edit-history rows — same reasoning as update_scene_avatar_appearance,
        # which documents overlay presentation as "not editorial" and bypasses the
        # revertible change-sets. A bulk update also avoids N x 5 history rows per
        # save, which prune_project_history does not prune.
        db.query(Scene).filter(
            Scene.project_id == project.id,
            Scene.is_active.is_(True),
        ).update(stamped, synchronize_session=False)

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

    if stamped:
        # broadcast_project_edit only carries PROJECT fields, so a collaborator's
        # scene rows would stay stale after the stamp above. Reload instead —
        # the sync helper, since this endpoint is a plain def (the async
        # endpoints await collab_manager.broadcast directly).
        from app.routers.collab_ws import broadcast_project_reload
        broadcast_project_reload(project.id, exclude_user_id=user.id)

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
    if (
        project
        and project.status in (ProjectStatus.GENERATED, ProjectStatus.AWAITING_STOCK_FOOTAGE_REVIEW)
        and project.template == job.target_template
    ):
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
    if (
        not is_delete
        and project
        and project.status in (ProjectStatus.GENERATED, ProjectStatus.AWAITING_STOCK_FOOTAGE_REVIEW)
    ):
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
    if project and project.status in (ProjectStatus.GENERATED, ProjectStatus.AWAITING_STOCK_FOOTAGE_REVIEW):
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
            avatar_size=(
                data.avatar_size
                if data.avatar_size is not None
                else _default_avatar_size(data.aspect_ratio or "landscape")
            ),
            video_style=normalized_video_style,
            video_length=_normalize_video_length(getattr(data, "video_length", None), user),
            playback_speed=_normalize_playback_speed(getattr(data, "playback_speed", None)),
            content_language=normalize_preferred_language_code(data.content_language),
            bgm_track_id=getattr(data, "bgm_track_id", None) or None,
            bgm_volume=getattr(data, "bgm_volume", None) or 0.10,
            captions_enabled=bool(getattr(data, "captions_enabled", False)),
            caption_position=getattr(data, "caption_position", None) or "bottom_center",
            caption_font_family=getattr(data, "caption_font_family", None) or "inter",
            caption_font_size=getattr(data, "caption_font_size", None) or "36",
            caption_offset=int(getattr(data, "caption_offset", 0) or 0),
            stock_footage_enabled=_resolve_stock_footage_flag(
                getattr(data, "stock_footage_enabled", False), user, template_id
            ),
            is_bulk=True,
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
    stock_footage_enabled: Optional[bool] = Form(False),
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
        avatar_size=_default_avatar_size(aspect_ratio or "landscape"),
        video_style=normalized_video_style,
        video_length=_normalize_video_length(video_length, user),
        playback_speed=_normalize_playback_speed(None),
        content_language=normalize_preferred_language_code(content_language),
        bgm_track_id=bgm_track_id or None,
        bgm_volume=bgm_volume if bgm_volume is not None else 0.10,
        stock_footage_enabled=_resolve_stock_footage_flag(
            stock_footage_enabled, user, template_id
        ),
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


class RenderStillsRequest(BaseModel):
    """One frame per exported slide, in slide order."""
    frames: list[int] = Field(..., min_length=1, max_length=60)


@router.post("/{project_id}/render-stills")
def render_project_stills(
    project_id: int,
    payload: RenderStillsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Render one PNG per requested frame through Remotion — the same pipeline that
    produces the MP4 — streaming each slide as it completes.

    This backs PDF/PPTX/PNG slide export. The previous approach screenshotted the
    live Remotion Player with html-to-image, which cannot rasterize some templates
    (the magazine cover exported as a blank page because its layers never painted
    into the SVG foreignObject) and also had to work around canvas tainting and
    <video> elements. Rendering server-side removes that whole class of failure.

    Response is NDJSON — one JSON object per line:
        {"index": 0, "total": 5, "image": "data:image/png;base64,..."}
        {"error": "..."}                      (terminal, if a frame fails)

    Streaming rather than returning one JSON blob because each frame is a real
    render (~3-4s). The client needs to show which slide it is on, and doing that
    with one HTTP request per slide instead would re-run the workspace sync and
    re-bundle every time — measured at ~89% slower end to end.
    """
    if any(f < 0 for f in payload.frames):
        raise HTTPException(status_code=400, detail="frames must be >= 0")
    project = _get_user_project(project_id, user.id, db)

    # Prepare the workspace ONCE, before streaming starts, so a setup failure is
    # still a clean HTTP error rather than a half-written stream.
    try:
        write_remotion_data(project, list(project.scenes), db)
        workspace, composition_id, preset = _prepare_still_workspace(project)
    except Exception as exc:
        logger.exception("render-stills setup failed project=%s", project_id)
        raise HTTPException(status_code=500, detail=f"Could not prepare render: {exc}") from exc

    # Clamp bound. The frontend derives each slide's frame from the composition's own
    # timeline, but templates whose schedule is not yet transition-aware still sum
    # scene durations back to back, which overshoots a TransitionSeries and made the
    # last slide fail with a RangeError. Best-effort: None means no clamp.
    duration_frames = get_composition_duration_frames(workspace, composition_id)
    total = len(payload.frames)

    def stream():
        for i, frame in enumerate(payload.frames):
            safe_frame = (
                min(frame, duration_frames - 1) if duration_frames else frame
            )
            try:
                path = _render_still_frame(project.id, workspace, composition_id, preset, safe_frame)
                with open(path, "rb") as fh:
                    b64 = base64.b64encode(fh.read()).decode("ascii")
            except Exception as exc:
                logger.exception(
                    "render-stills failed project=%s frame=%s", project_id, safe_frame
                )
                yield json.dumps({"error": f"Could not render slide {i + 1}: {exc}"}) + "\n"
                return
            yield json.dumps({
                "index": i,
                "total": total,
                "image": "data:image/png;base64," + b64,
            }) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")


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


@router.post("/{project_id}/avatar-review", response_model=AvatarReviewOut)
def submit_avatar_review(
    project_id: int,
    payload: AvatarReviewSubmit,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upsert this user's star rating + message for the project's avatars.

    Editor role, so a collaborator can rate the avatars on a project they were
    invited to — the unique key is (user_id, project_id), so each collaborator
    gets their own row. Re-rating updates in place rather than inserting.

    Unlike ``submit_project_review`` this sends no low-rating alert email.
    """
    project = _get_user_project(project_id, user.id, db)

    review = (
        db.query(AvatarReview)
        .filter(AvatarReview.user_id == user.id, AvatarReview.project_id == project.id)
        .first()
    )
    if review is None:
        review = AvatarReview(user_id=user.id, project_id=project.id)
        db.add(review)

    review.rating = payload.rating
    review.suggestion = payload.suggestion

    db.commit()
    db.refresh(review)

    return AvatarReviewOut.model_validate(review)


@router.post("/{project_id}/avatar-review", response_model=AvatarReviewOut)
def submit_avatar_review(
    project_id: int,
    payload: AvatarReviewSubmit,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upsert this user's star rating + message for the project's avatars.

    Editor role, so a collaborator can rate the avatars on a project they were
    invited to — the unique key is (user_id, project_id), so each collaborator
    gets their own row. Re-rating updates in place rather than inserting.

    Unlike ``submit_project_review`` this sends no low-rating alert email.
    """
    project = _get_user_project(project_id, user.id, db)

    review = (
        db.query(AvatarReview)
        .filter(AvatarReview.user_id == user.id, AvatarReview.project_id == project.id)
        .first()
    )
    if review is None:
        review = AvatarReview(user_id=user.id, project_id=project.id)
        db.add(review)

    review.rating = payload.rating
    review.suggestion = payload.suggestion

    db.commit()
    db.refresh(review)

    return AvatarReviewOut.model_validate(review)


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

    # A stock clip is stored as TWO files: the silent one that normally renders,
    # plus an AAC sibling used when the scene unmutes it. Delete both, or the
    # audio variant is orphaned on disk and in R2 forever.
    audio_variant_local: str | None = None
    audio_variant_r2_key: str | None = None
    audio_variant_name = getattr(asset, "audio_variant_filename", None)
    if audio_variant_name:
        audio_variant_local = os.path.join(os.path.dirname(local_path), audio_variant_name)
        if r2_key:
            audio_variant_r2_key = r2_key.rsplit("/", 1)[0] + "/" + audio_variant_name

    # If this is an image, clear assignedImage from scenes that reference it
    # and mark those scenes as hideImage=true so they won't get a new generic
    # image auto-assigned later.
    if asset.asset_type.value in ("image", "video"):
        deleted_filename = asset.filename
        is_video_asset = asset.asset_type.value == "video"
        scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
        for scene in scenes:
            if not scene.remotion_code:
                continue
            try:
                desc = json.loads(scene.remotion_code)
                layout_props = desc.get("layoutProps", {}) or {}
                key = "assignedVideo" if is_video_asset else "assignedImage"
                if layout_props.get(key) != deleted_filename:
                    continue
                if is_video_asset:
                    _clear_video_assignment(layout_props)
                else:
                    _clear_image_assignment(layout_props)
                # hideImage stops the auto-assign cascade in services/remotion.py
                # from dropping a generic scraped image into the slot we just
                # emptied. It gates clips as well as stills.
                layout_props["hideImage"] = True
                desc["layoutProps"] = layout_props
                scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(desc))
            except (json.JSONDecodeError, TypeError):
                continue

    db.delete(asset)
    db.commit()

    for path in (local_path, audio_variant_local):
        if path and os.path.isfile(path):
            try:
                os.remove(path)
            except OSError as e:
                logger.warning(
                    "[PROJECTS] Failed to remove local file %s: %s",
                    path,
                    e,
                    extra={"project_id": project_id, "user_id": user.id},
                )
    for key in (r2_key, audio_variant_r2_key):
        if key:
            try:
                # NB: the helper is delete_object. This previously called a
                # non-existent delete_file, so every R2 delete silently failed
                # into the except below and objects were never removed.
                r2_storage.delete_object(key)
            except Exception as e:
                logger.warning(
                    "[PROJECTS] R2 delete failed for %s: %s",
                    key,
                    e,
                    extra={"project_id": project_id, "user_id": user.id},
                )

    # The asset row is gone and referencing scenes were rewritten — collaborators
    # must refetch or they keep rendering a clip/image that no longer exists.
    from app.routers.collab_ws import broadcast_project_reload
    broadcast_project_reload(project_id, exclude_user_id=user.id)

    return {"detail": "Asset deleted"}


# Mirrors the `scenes.title` column width (String(255) in app/models/scene.py).
# Every other editable scene text field is unbounded TEXT, so only the title
# needs a length guard.
SCENE_TITLE_MAX_LENGTH = 255

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
    # Clip trim offset. Only meaningful when the scene carries a stock clip;
    # 0 (or None) clears it so the clip plays from its start.
    video_start_seconds: float | None = Field(default=None, ge=0)


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

    # `scenes.title` is VARCHAR(255) while the other editable text fields are
    # unbounded TEXT. Reject an over-long title up front with a clear 400 —
    # otherwise it reaches the DB and surfaces as an unhandled 500
    # (psycopg2 StringDataRightTruncation) with no usable message for the UI.
    _title = update_data.get("title")
    if isinstance(_title, str) and len(_title) > SCENE_TITLE_MAX_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Scene title is too long ({len(_title)} characters). "
                f"Maximum is {SCENE_TITLE_MAX_LENGTH}."
            ),
        )

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
    "We couldn't generate your image. Try again with a clearer, more descriptive "
    "prompt."
    "You were not charged for this attempt."
)

# AI image generation costs this many AI-edit credits for FREE owners; PRO/STANDARD
# owners are unlimited (see can_use_ai_edit). Charged to the project OWNER.
GENERATE_IMAGE_CREDIT_COST = 3

# Regenerating a scene's voiceover is the most expensive AI edit (TTS + re-timing);
# every other AI edit costs 1. Mirrored by voiceoverEditCost in SceneEditModal.tsx.
VOICEOVER_EDIT_CREDIT_COST = 5


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
    PRO/STANDARD owners generate for free (unlimited); FREE owners spend
    ``GENERATE_IMAGE_CREDIT_COST`` AI-edit credits, charged only on a successful
    generation. Aspect ratio follows the scene layout."""
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

    # Owner pays: gate/charge the OWNER, so a FREE collaborator inherits a PRO owner's
    # entitlement on a shared project (and a PRO collaborator draws on the FREE owner's
    # credit pool): the monthly plan allowance first, then the purchased pool.
    from app.services.access import project_owner, can_use_ai_edit, consume_ai_edit

    payer = project_owner(project, db)
    if not can_use_ai_edit(payer, project, cost=GENERATE_IMAGE_CREDIT_COST):
        if payer.id == user.id:
            detail = (
                f"AI editing limit reached. Generating an image costs "
                f"{GENERATE_IMAGE_CREDIT_COST} AI edits. Buy a video for +20 AI edits, "
                "or upgrade for a larger monthly allowance."
            )
        else:
            detail = (
                "The project owner is out of AI edit credits, so AI image generation isn't "
                "available now. Ask the owner to buy more credits or upgrade."
            )
        raise HTTPException(status_code=403, detail=detail)

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

    # Provider returned without raising but produced no image — treat as a failure
    # so we never charge for an empty result.
    if not image_base64:
        logger.error("[GENERATE_IMAGE] Provider returned no image data.")
        raise HTTPException(status_code=502, detail=_IMAGE_GEN_ERROR_MESSAGE)

    # Charge only on success, from the owner's plan allowance then purchased pool.
    consume_ai_edit(payer, project, cost=GENERATE_IMAGE_CREDIT_COST)
    db.commit()

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

    # Trust the actual bytes, not the client-supplied filename/content-type. AI-generated
    # images (e.g. GLM/z.ai) can come back JPEG-encoded while the client names/labels them
    # .png — Remotion renders via headless Chromium, which rejects files whose bytes don't
    # match the filename extension, so a mismatch here silently drops the scene's image at
    # render time even though it looks fine in a browser <img> tag. Same failure mode
    # _download_logo_normalized() already guards against for logos.
    ext = "png"
    try:
        from io import BytesIO
        from PIL import Image as PILImage

        with PILImage.open(BytesIO(file_bytes)) as probe:
            fmt = (probe.format or "").upper()
        ext = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp", "GIF": "gif"}.get(fmt, "png")
    except Exception:
        pass

    image_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/images")
    os.makedirs(image_dir, exist_ok=True)

    image_filename = f"scene_{scene_id}_{int(time.time())}.{ext}"
    local_path = os.path.join(image_dir, image_filename)

    with open(local_path, "wb") as f:
        f.write(file_bytes)

    r2_key_val = None
    r2_url_val = None
    real_content_type = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp", "gif": "image/gif"}.get(ext, "image/png")
    if r2_storage.is_r2_configured():
        try:
            r2_key_val = r2_storage.image_key(user.id, project_id, image_filename)
            r2_url_val = r2_storage.upload_file(local_path, r2_key_val, content_type=real_content_type)
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
    # A scene holds either a still or a clip, never both — assigning an image
    # clears any stock clip that occupied the same visual slot.
    _clear_video_assignment(layout_props)
    layout_props["assignedImage"] = image_filename
    layout_props.pop("hideImage", None)
    _apply_default_focus(layout_props)
    scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))

    # Keep project.status and r2_video_* as-is: the exported MP4 stays available until the user
    # runs a new render (render pipeline replaces URLs/keys on success).

    db.commit()
    db.refresh(scene)

    # Push the new/replaced image live to collaborators. project_reloaded (not a field
    # edit) because the change spans a new asset URL and the scene descriptor's
    # assignedImage/focus — too much to sync field-by-field. Matches update_scene_voiceover.
    from app.routers.collab_ws import collab_manager
    await collab_manager.broadcast(
        project_id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )

    return scene


# ─── Stock footage (Pexels / Pixabay) ────────────────────────────────
# Supported on every template (builtin, custom, and crafted).

# AI-edit credits charged per clip added. Like image generation, this is charged
# to the project OWNER and only on success.
STOCK_FOOTAGE_CREDIT_COST = 3


class StockFootageAssignRequest(BaseModel):
    provider: str
    clip_id: str
    download_url: str
    width: int = 0
    height: int = 0
    duration: float = 0.0
    author: str = ""
    page_url: str = ""


@router.get("/{project_id}/stock-footage/search")
def search_stock_footage(
    project_id: int,
    q: str,
    provider: str = "all",
    page: int = 1,
    per_page: int = 6,
    box_w: float | None = None,
    box_h: float | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search Pexels/Pixabay for clips. Read-only; no credit charge.

    ``box_w`` / ``box_h`` describe the target scene's image box in pixels on the
    1080p render canvas (the frontend computes them from LAYOUT_IMAGE_BOX_DIMS).
    They steer two things: which Pexels rendition to download, and — since a
    scene's box can be landscape inside a portrait project or vice-versa — which
    orientation to ask for.
    """
    from app.services import stock_footage

    project = _get_user_project(project_id, user.id, db)

    if provider not in ("all", "pexels", "pixabay"):
        raise HTTPException(status_code=400, detail="Unknown provider.")

    if not (settings.PEXELS_API_KEY or settings.PIXABAY_API_KEY):
        raise HTTPException(
            status_code=503,
            detail="Stock footage search is not configured on this server.",
        )

    # Prefer the SCENE BOX's shape — a portrait project can still have a
    # landscape image box (and vice-versa), and the box is what the clip is
    # actually cropped into. Fall back to the project's aspect ratio.
    if box_w and box_h and box_w > 0 and box_h > 0:
        ratio = box_w / box_h
        if ratio > 1.15:
            orientation = "landscape"
        elif ratio < 0.87:
            orientation = "portrait"
        else:
            orientation = "square"
    else:
        orientation = (
            "portrait"
            if (getattr(project, "aspect_ratio", "landscape") or "").lower() == "portrait"
            else "landscape"
        )

    clips = stock_footage.search(
        q,
        provider=provider,
        per_page=per_page,
        page=page,
        orientation=orientation,
        box_w=box_w,
        box_h=box_h,
    )
    return {"clips": [c.to_dict() for c in clips]}


@router.post("/{project_id}/scenes/{scene_id}/stock-footage")
async def upload_stock_footage(
    project_id: int,
    scene_id: int,
    body: StockFootageAssignRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a chosen clip and normalise it to CFR 30 fps, creating a VIDEO asset.

    This does NOT link the clip to the scene — that happens later, through the
    normal scene descriptor Save, so the whole choice can be staged and cancelled
    in the editor. The clip must still be downloaded and transcoded here because
    the editor needs a real file to preview (audio included) before the user
    commits, and both Newscast compositions run at a fixed 30 fps — a clip at any
    other rate lands between source frames when Remotion samples it and judders.
    See services/stock_footage.py.

    Returns the created asset's filename + playable URLs so the editor can stage
    it. The scene descriptor is untouched until Save writes ``assignedVideo``.
    """
    from concurrent.futures import ThreadPoolExecutor
    from app.models.asset import Asset, AssetType
    from app.services import stock_footage

    project = _get_user_project(project_id, user.id, db)

    template = (getattr(project, "template", "") or "").strip().lower()

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    layout = _extract_scene_layout_from_descriptor(scene, template)
    if layout and layout in get_layouts_without_image(template):
        raise HTTPException(
            status_code=400, detail="This layout does not support a background clip."
        )

    if is_custom_template(template) or is_crafted_template(template):
        # Dataviz scenes render a bound chart/table (GeneratedVideo's dedicated
        # kit components), not an image/clip slot — same priority order as the
        # sceneType assignment in remotion.py's write_remotion_data. Custom and
        # crafted templates both render through GeneratedVideo.
        override_type = None
        if scene.remotion_code:
            try:
                override_type = json.loads(scene.remotion_code).get("sceneTypeOverride")
            except (json.JSONDecodeError, TypeError):
                pass
        scene_type = override_type or scene.scene_type
        if scene_type in ("dataviz_chart", "dataviz_table"):
            raise HTTPException(
                status_code=400, detail="This layout does not support a background clip."
            )

    if not body.download_url.lower().startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid clip URL.")

    # Owner pays: gate/charge the OWNER, so a FREE collaborator inherits a PRO
    # owner's entitlement on a shared project (and vice versa). PRO/STANDARD
    # owners are unlimited; FREE owners spend AI-edit credits. Gate BEFORE the
    # download so we never do the work we cannot charge for.
    from app.services.access import project_owner, can_use_ai_edit, consume_ai_edit

    payer = project_owner(project, db)
    if not can_use_ai_edit(payer, project, cost=STOCK_FOOTAGE_CREDIT_COST):
        if payer.id == user.id:
            detail = (
                f"AI editing limit reached. Adding stock footage costs "
                f"{STOCK_FOOTAGE_CREDIT_COST} AI edits. Buy a video for +20 AI edits, "
                "or upgrade for a larger monthly allowance."
            )
        else:
            detail = (
                "The project owner is out of AI edit credits, so adding stock footage isn't "
                "available now. Ask the owner to buy more credits or upgrade."
            )
        raise HTTPException(status_code=403, detail=detail)

    ts = int(time.time())
    video_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/videos")

    loop = asyncio.get_running_loop()
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            ingested = await loop.run_in_executor(
                pool,
                stock_footage.ingest_clip,
                body.download_url,
                video_dir,
                f"scene_{scene_id}_{ts}",
            )
    except stock_footage.StockFootageError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.error(
            "[STOCK] upload failed for project %s scene %s",
            project_id, scene_id, exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Could not process that clip.")

    filename = ingested.filename
    audio_filename = ingested.audio_filename
    local_path = ingested.local_path
    audio_local_path = ingested.audio_local_path
    info = {
        "duration_seconds": ingested.duration_seconds,
        "width": ingested.width,
        "height": ingested.height,
    }

    r2_key_val = None
    r2_url_val = None
    audio_r2_url = None
    audio_r2_uploaded = False
    if r2_storage.is_r2_configured():
        try:
            r2_key_val = r2_storage.stock_video_key(user.id, project_id, filename)
            r2_url_val = r2_storage.upload_file(local_path, r2_key_val, content_type="video/mp4")
            if audio_filename and audio_local_path:
                audio_r2_url = r2_storage.upload_file(
                    audio_local_path,
                    r2_storage.stock_video_key(user.id, project_id, audio_filename),
                    content_type="video/mp4",
                )
                audio_r2_uploaded = True
        except Exception as e:
            logger.warning("[STOCK] R2 upload failed for %s: %s", filename, e)

    has_audio = bool(
        audio_filename
        and (audio_r2_uploaded or not r2_storage.is_r2_configured())
    )

    asset = Asset(
        project_id=project_id,
        asset_type=AssetType.VIDEO,
        original_url=body.page_url or body.download_url,
        local_path=local_path,
        filename=filename,
        r2_key=r2_key_val,
        r2_url=r2_url_val,
        excluded=False,
        duration_seconds=info.get("duration_seconds"),
        width=info.get("width"),
        height=info.get("height"),
        source_provider=body.provider,
        source_id=body.clip_id,
        source_author=body.author,
        source_page_url=body.page_url,
        audio_variant_filename=audio_filename if has_audio else None,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    # Build playable URLs for the editor to stage the clip (video + optional audio
    # variant). Prefer R2; fall back to the local media path the frontend proxies.
    def _media_url(fn: str) -> str:
        return f"/media/projects/{project_id}/videos/{fn}"

    video_url = r2_url_val or _media_url(filename)
    audio_url = None
    if has_audio:
        audio_url = audio_r2_url or _media_url(audio_filename)

    # Charge only on success (the asset exists and is playable), from the
    # owner's plan allowance then purchased pool.
    consume_ai_edit(payer, project, cost=STOCK_FOOTAGE_CREDIT_COST)
    db.commit()

    # A new VIDEO asset is now in the project. Collaborators must refetch so the
    # clip appears in their media lists (and so the scene link that follows
    # resolves against an asset they know about). project_reloaded rather than a
    # field edit: this adds an asset row, not a single scene field.
    from app.routers.collab_ws import collab_manager
    await collab_manager.broadcast(
        project_id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )

    return {
        "asset_id": asset.id,
        "filename": filename,
        "video_url": video_url,
        "audio_variant_url": audio_url,
        "has_audio": has_audio,
        "duration_seconds": info.get("duration_seconds"),
        "width": info.get("width"),
        "height": info.get("height"),
        "source_author": body.author,
        "source_provider": body.provider,
    }


@router.post("/{project_id}/scenes/{scene_id}/voiceover", response_model=SceneOut)
async def update_scene_voiceover(
    project_id: int,
    scene_id: int,
    audio: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace a scene's voiceover with a user-recorded audio clip.

    The browser records WebM/Opus (Chrome) or MP4/AAC (Safari); we transcode to
    MP3 with ffmpeg so it matches the existing ``scene_{order}.mp3`` convention,
    R2 audio keys, and the mutagen duration probe. A new AUDIO asset row is
    created (the frontend picks the latest by id), replacing the scene's existing
    voiceover. The project's voice settings are left unchanged.
    """
    import subprocess
    import tempfile
    from app.models.scene import Scene
    from app.models.asset import Asset, AssetType
    from app.services.voiceover import _get_audio_duration, DURATION_PAD

    project = _get_user_project(project_id, user.id, db)

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    allowed_types = {
        "audio/webm",
        "audio/ogg",
        "audio/mp4",
        "audio/mpeg",
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
    }
    # Some browsers append codecs (e.g. "audio/webm;codecs=opus"); match the base type.
    base_type = (audio.content_type or "").split(";")[0].strip().lower()
    if base_type and base_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Recording must be a WebM, OGG, MP4, WAV, or MP3 audio file.",
        )

    MAX_AUDIO_SIZE = 15 * 1024 * 1024
    file_bytes = await audio.read()
    if len(file_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=400, detail="Audio file too large. Maximum size is 15 MB."
        )
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload.")

    audio_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/audio")
    os.makedirs(audio_dir, exist_ok=True)

    filename = f"scene_{scene.order}.mp3"
    output_path = os.path.join(audio_dir, filename)

    # Write the raw recording to a temp file, then transcode to MP3 via ffmpeg.
    src_suffix = ".webm"
    if "mp4" in base_type:
        src_suffix = ".mp4"
    elif "ogg" in base_type:
        src_suffix = ".ogg"
    elif "wav" in base_type or "wave" in base_type:
        src_suffix = ".wav"
    elif "mpeg" in base_type:
        src_suffix = ".mp3"

    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=src_suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        result = subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                tmp_path,
                "-vn",
                "-ar",
                "44100",
                "-ac",
                "1",
                "-b:a",
                "128k",
                output_path,
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            logging.getLogger(__name__).error(
                "[VOICEOVER_RECORD] ffmpeg transcode failed for scene %s: %s",
                scene_id,
                result.stderr or result.stdout,
            )
            raise HTTPException(
                status_code=500, detail="Failed to process the recorded audio."
            )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    audio_duration = _get_audio_duration(output_path)
    scene.duration_seconds = round(
        max(settings.MIN_SCENE_DURATION_SECONDS, audio_duration + DURATION_PAD), 1
    )
    scene.voiceover_path = output_path

    r2_key_val = None
    r2_url_val = None
    if r2_storage.is_r2_configured():
        try:
            r2_url_val = r2_storage.upload_project_audio(
                user.id, project_id, output_path, filename
            )
            r2_key_val = r2_storage.audio_key(user.id, project_id, filename)
        except Exception as e:
            print(f"[VOICEOVER_RECORD] R2 upload failed for {filename}: {e}")

    asset = Asset(
        project_id=project_id,
        asset_type=AssetType.AUDIO,
        original_url=None,
        local_path=output_path,
        filename=filename,
        r2_key=r2_key_val,
        r2_url=r2_url_val,
    )
    db.add(asset)

    db.commit()
    db.refresh(scene)

    # Push the new voiceover live to collaborators, matching delete/regen/voice-change,
    # which all broadcast project_reloaded on completion. This endpoint is synchronous
    # (not a background job) so the broadcast has to be inline rather than job-completion.
    # project_reloaded (not a field edit) because the change spans both a new asset URL
    # and a recomputed duration_seconds.
    from app.routers.collab_ws import collab_manager
    await collab_manager.broadcast(
        project_id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )

    return scene


# ─── Per-scene talking-head avatar (on demand) ─────────────────────────────────
#
# Jobs are a real server-side FIFO queue (see services/avatar_queue.py): every
# request below just inserts a "queued" row and returns immediately. A single
# in-process dispatcher claims the oldest queued rows across ALL projects and
# scenes, up to AVATAR_CONCURRENCY renders at once, so there is no per-project
# concurrency to reason about here anymore (no batch-start bookkeeping, no
# project-level 409 — that reject-and-retry pattern is what this queue
# replaces).

_ACTIVE_AVATAR_STATUSES = ("queued", "running")


def _assert_can_generate_avatar(payer: User, project: Project, db: Session) -> None:
    """Entitlement gate for per-scene avatar generation.

    Intentionally a no-op today: avatar generation is currently free. This exists
    as the single seam where a charge (e.g. $2/scene) would be enforced, so adding
    billing later touches one call site rather than reshaping the endpoint.
    """
    return None


def _scene_has_voiceover(scene: Scene, db: Session) -> bool:
    """Does this scene have narration an avatar could be lip-synced to?

    True when the mp3 is on local disk OR still in R2. The R2 half matters
    because MEDIA_DIR is container-local and ephemeral: after a restart the DB
    still records a /tmp path whose file is gone, and a disk-only check reads
    that as "no voiceover" for every scene in the project. The render path
    rehydrates from R2 anyway (services/avatar.ensure_local_voiceover), so
    refusing here would reject work that would in fact succeed.
    """
    from app.services.avatar import voiceover_r2_url

    if not scene.voiceover_path:
        return False
    if os.path.exists(scene.voiceover_path):
        return True
    return bool(voiceover_r2_url(scene, db))


def _normalise_portrait(raw: bytes) -> bytes:
    """Make an uploaded presenter photo look like a bundled roster preset.

    The presets render reliably because of WHAT THEY ARE — opaque sRGB JPEGs at a
    sane size — not because anything processes them. A custom upload reached the
    render service completely untouched (this endpoint wrote `raw` straight to
    disk, and the render service just writes the bytes it receives), so a phone
    photo arrived tagged Display P3, possibly with an alpha channel and 4000px
    wide. The render service reads raw pixels and assumes sRGB, which is why a
    custom avatar's colour drifts through the clip while a preset never does.

    Four things, in this order — the order is the substance:

      1. EXIF rotation, FIRST. A phone stores a portrait shot as landscape plus an
         orientation tag; every step below works on pixels, so the rotation has to
         be baked in before them or the avatar renders sideways.
      2. ICC -> sRGB, BEFORE convert("RGB"). `convert` drops the profile without
         applying it, so a P3 image would keep its wrong numbers and merely lose
         the metadata saying they were wrong.
      3. Flatten alpha onto white. Pillow's RGB conversion leaves transparent
         regions BLACK, which is worse than the fringing being fixed. (A
         1920x1080 RGBA png did exactly this once: white fringing and a yellow
         smear baked into the mp4 before matting ever ran.)
      4. Cap the size and re-encode as JPEG. One predictable format is the point.

    Raises on an undecodable image — the caller turns that into a 400. Storing it
    anyway would just move the failure to a render six minutes later.
    """
    from io import BytesIO

    from PIL import Image, ImageCms, ImageOps

    img = Image.open(BytesIO(raw))
    img = ImageOps.exif_transpose(img)

    icc = img.info.get("icc_profile")
    if icc:
        try:
            img = ImageCms.profileToProfile(
                img, ImageCms.ImageCmsProfile(BytesIO(icc)),
                ImageCms.createProfile("sRGB"), outputMode="RGB",
            )
        except Exception:
            # A corrupt or exotic profile must not fail the upload — falling
            # through untagged is exactly what happened before this existed.
            logger.warning("[AVATAR] Could not convert portrait ICC profile to sRGB")

    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        flat = Image.new("RGB", img.size, (255, 255, 255))
        flat.paste(img, mask=img.split()[-1])
        img = flat
    else:
        img = img.convert("RGB")

    # Presets are ~1200px; the model renders at 720x400, so anything larger is
    # thrown away downstream anyway — and the portrait is re-uploaded with EVERY
    # scene's render, so this also shrinks each of those requests.
    img.thumbnail((1280, 1280), Image.LANCZOS)

    # Embed sRGB explicitly. Pillow writes NO icc_profile unless asked, so
    # without this the output is UNTAGGED — which is not what a preset is. Every
    # bundled preset carries the 3144-byte "sRGB IEC61966-2.1" profile, and the
    # stated goal here is for a custom photo to be indistinguishable from one.
    # An untagged JPEG is merely *assumed* sRGB by whatever opens it; a tagged
    # one says so.
    out = BytesIO()
    img.save(
        out, "JPEG", quality=92, optimize=True,
        icc_profile=ImageCms.ImageCmsProfile(
            ImageCms.createProfile("sRGB")
        ).tobytes(),
    )
    return out.getvalue()


def _avatar_generic_failure() -> str:
    """The only failure text a user ever sees for an avatar render.

    Imported lazily to match how the rest of this module reaches into
    services/avatar (which pulls in the render client at import time).
    """
    from app.services.avatar import AVATAR_GENERIC_FAILURE

    return AVATAR_GENERIC_FAILURE


def _active_avatar_job(scene_id: int, db: Session) -> SceneAvatarJob | None:
    """The scene's in-flight job, or None. A job whose heartbeat has gone stale is
    treated as dead so a stuck render can never permanently block the button.
    This is the only per-scene guard left: it stops a double-click from
    enqueueing the same scene twice, not a queue-position concern."""
    job = (
        db.query(SceneAvatarJob)
        .filter(
            SceneAvatarJob.scene_id == scene_id,
            SceneAvatarJob.status.in_(_ACTIVE_AVATAR_STATUSES),
        )
        .order_by(SceneAvatarJob.id.desc())
        .first()
    )
    if job and _seconds_since(job.updated_at) < settings.STALL_THRESHOLD_AVATAR_SECONDS:
        return job
    return None


def _queue_position(job: SceneAvatarJob, db: Session) -> int | None:
    """0-based position among still-queued jobs ("0" = next up), or None once
    the job is no longer queued. Cheap indexed COUNT — used so the UI can show
    real queue depth instead of an unchanging spinner."""
    if job.status != "queued":
        return None
    return (
        db.query(SceneAvatarJob)
        .filter(
            SceneAvatarJob.status == "queued",
            or_(
                SceneAvatarJob.created_at < job.created_at,
                (SceneAvatarJob.created_at == job.created_at)
                & (SceneAvatarJob.id < job.id),
            ),
        )
        .count()
    )


def reap_orphaned_avatar_jobs() -> None:
    """Boot sweep: any active avatar job is orphaned (its process is gone).

    With --workers 1, a `queued`/`running` row at boot means the process that
    owned it crashed or was restarted — nothing else could be running it.

    A restart is OUR fault, not the user's, so the goal is to deliver the avatar
    they paid for rather than to hand the money back. The two statuses are very
    different losses and are treated differently:

      queued  — never started. No GPU time was spent and the row is still a
                perfectly good queue entry, so it is LEFT ALONE: the dispatcher
                claims it on its next tick (it only looks for status='queued')
                and the render happens as if nothing had occurred. Failing these
                was pure loss — a batch of five with one rendering lost the four
                behind it to a restart that never touched them.

      running — the render itself was lost. If the scene still has attempts left
                it goes BACK TO 'queued' to resume, spending one of them, which
                is exactly what the retry budget exists for. Only a scene that
                has genuinely exhausted its attempts is failed, which lets the
                refund sweep below close it out.

    attempt_count is never fabricated here. It used to be slammed to
    AVATAR_MAX_ATTEMPTS purely so the refund sweep would pick the row up, which
    laundered "we restarted" into "you used all three attempts" — a scene killed
    mid-first-render was stamped 3/3 and reported as having failed three times
    without ever finishing one. The count now only ever records attempts that
    really happened, and the refund follows from it honestly.

    DISABLED 2026-08-10. This sweep cannot tell a dead render from a live one:
    since renders moved to Modal the GPU job runs in a container that OUTLIVES
    this process, so a restart kills the HTTP request waiting on the result, not
    the render. Marking those rows failed refunded scenes that then completed
    normally minutes later — 11 avatars across projects 1146/1155/1156 were
    delivered AND refunded, and users were told "we couldn't generate" for
    videos sitting on disk.

    Leaving the rows untouched is strictly safer than guessing: a `queued` row
    is still claimed by the dispatcher on its next tick, and a `running` row
    whose render lands completes itself through the normal terminal path. The
    only thing lost is cleanup of genuinely-dead rows, which now stay `running`
    until someone clears them by hand — a stale row, not a wrong refund.

    Refunds now happen ONLY through refund_exhausted_avatar_failures, i.e. when
    a scene has really burned all AVATAR_MAX_ATTEMPTS attempts or died on a
    terminal (retryable=False) error.

    TO RE-ENABLE: delete the early return below. Do not re-enable without a way
    to test whether a render is actually still alive (a Modal status endpoint,
    or a heartbeat that stamps the job row — the current one only runs SELECT 1
    to keep the connection pool warm and never touches the row).
    """
    logger.info(
        "[AVATAR_QUEUE] boot sweep: DISABLED — leaving any active avatar jobs "
        "untouched (a Modal render outlives a restart; reaping them refunded "
        "scenes that went on to succeed)."
    )
    return

    db = SessionLocal()
    try:
        jobs = (
            db.query(SceneAvatarJob)
            .filter(SceneAvatarJob.status.in_(_ACTIVE_AVATAR_STATUSES))
            .all()
        )
        max_attempts = int(settings.AVATAR_MAX_ATTEMPTS)
        resumed = 0
        exhausted: list[SceneAvatarJob] = []
        # Wall-clock at sweep time, so every line below can report how old a row
        # was when this boot decided its fate. Renders now run on Modal, whose
        # container outlives THIS process — a restart kills the HTTP request
        # waiting on the result, not the render — so "how long had this been
        # going?" is the fact needed to tell an orphan from a live job.
        boot_time = datetime.utcnow()
        logger.info(
            "[AVATAR_QUEUE] boot sweep: START at %s — %d active job(s) to inspect: %s",
            boot_time, len(jobs), [j.id for j in jobs] or "none",
        )
        for job in jobs:
            try:
                age_min = (
                    (boot_time - job.created_at).total_seconds() / 60
                    if job.created_at else float("nan")
                )
                # Log EVERY row before deciding, including its age relative to
                # this boot, so the transcript answers "was this job created
                # before or after the restart?" without a debugger.
                logger.info(
                    "[AVATAR_QUEUE] boot sweep: INSPECT job %s scene=%s project=%s "
                    "status=%s kind=%s attempts=%s/%s created=%s (%.1f min before "
                    "this boot) refunded=%s",
                    job.id, job.scene_id, job.project_id, job.status, job.kind,
                    job.attempt_count, max_attempts, job.created_at, age_min,
                    job.credits_refunded,
                )
                # Never started — leave it queued and let the dispatcher take it.
                if job.status == "queued":
                    logger.info(
                        "[AVATAR_QUEUE] boot sweep: LEFT QUEUED job %s (scene=%s) "
                        "— never started, dispatcher will claim it",
                        job.id, job.scene_id,
                    )
                    continue
                # Mid-render, but the scene has budget left: resume it. The count
                # already includes the attempt that just died (the dispatcher
                # persists it BEFORE each try, see _set_attempt), so no adjustment
                # is needed here — this is simply the next attempt starting.
                if (job.attempt_count or 0) < max_attempts:
                    job.status = "queued"
                    job.phase = None
                    job.error_message = None
                    job.retryable = None
                    resumed += 1
                    logger.info(
                        "[AVATAR_QUEUE] boot sweep: RE-QUEUED job %s (scene=%s "
                        "project=%s) — was running %.1f min, attempts %s/%s left",
                        job.id, job.scene_id, job.project_id, age_min,
                        job.attempt_count, max_attempts,
                    )
                    continue
                # Out of attempts for real. Close it so the refund sweep pays out.
                #
                # WARNING not INFO: this is the decision a credit refund hangs
                # off, and it is the one that has been wrong in practice — a
                # Modal render that outlives the restart gets marked failed here
                # and then completes minutes later, leaving the scene both
                # delivered and refunded. Log what it was based on.
                logger.warning(
                    "[AVATAR_QUEUE] boot sweep: FAILING job %s (scene=%s project=%s) "
                    "— was running %.1f min, attempts %s/%s exhausted. Marking "
                    "failed; refund sweep will follow. If a Modal render is still "
                    "in flight for this scene it will complete AFTER this point.",
                    job.id, job.scene_id, job.project_id, age_min,
                    job.attempt_count, max_attempts,
                )
                job.status = "failed"
                job.phase = None
                job.error_message = "Server restarted during processing."
                # DIAGNOSTIC: this string appears on jobs killed 75s into a
                # render on a server that never restarted, while this function
                # logged nothing — so confirm the write really originates here
                # and record who called it.
                import traceback as _tb
                logger.warning(
                    "[AVATAR_REAP_TRACE] job %s stamped 'Server restarted' from:\n%s",
                    job.id, "".join(_tb.format_stack(limit=12)[:-1]),
                )
                # A restart IS a transient error class, and with the budget gone
                # `attempt_count >= max` is what the refund sweep matches on, so
                # this stays an honest diagnostic rather than being repurposed as
                # a "row is closed" marker.
                job.retryable = True
                job.completed_at = datetime.utcnow()
                exhausted.append(job)
            except Exception:
                logger.exception("[AVATAR_QUEUE] boot recovery failed for job=%s", job.id)
        db.commit()
        # One line naming every row this sweep actually wrote to, so the effect of
        # a restart is greppable after the fact instead of having to diff the table.
        logger.info(
            "[AVATAR_QUEUE] boot sweep: DONE at %s — inspected %d, re-queued %d, "
            "failed %d. Failed job ids=%s scene ids=%s",
            boot_time, len(jobs), resumed, len(exhausted),
            [j.id for j in exhausted] or "none",
            [j.scene_id for j in exhausted] or "none",
        )
        if resumed:
            logger.info("[AVATAR_QUEUE] boot sweep: resumed %d interrupted render(s)", resumed)
        # Only the EXHAUSTED ones are owed anything — a resumed job is still going
        # to run, and refunding it would pay the user back for an avatar they are
        # about to receive.
        if exhausted:
            logger.info(
                "[AVATAR_QUEUE] boot sweep: closed %d exhausted job(s)", len(exhausted)
            )

            # Refund what the reap just killed for good.
            #
            # This is the ONE terminal path with no dispatcher running to notice
            # the batch ended — the process that owned those jobs is gone, so
            # nothing else will ever come back to them. Without this they would
            # sit failed and paid-for indefinitely, since nothing else sweeps a
            # project whose last job died with the process that owned it.
            #
            # Only the projects just touched, and the sweep no-ops on anything
            # already refunded, so a restart with nothing owed costs one query
            # per affected project.
            from app.services.avatar_queue import refund_exhausted_avatar_failures

            for pid in {j.project_id for j in exhausted}:
                try:
                    refund_exhausted_avatar_failures(pid, db)
                    db.commit()
                except Exception:
                    logger.exception(
                        "[AVATAR_QUEUE] boot refund failed for project=%s", pid
                    )
                    db.rollback()
    except Exception:
        logger.exception("[AVATAR_QUEUE] boot sweep failed")
        db.rollback()
    finally:
        db.close()


@router.post("/{project_id}/avatar-batch/authorize")
def authorize_avatar_batch(
    project_id: int,
    scene_ids: list[int] = Body(..., embed=True),
    avatar_preset: Optional[str] = Body(None, embed=True),
    # subtle | natural | expressive | None — chosen alongside the presenter in
    # AvatarBatchWizard's pick step. Unlike `provider` this IS persisted: it
    # updates project.avatar_motion_style so it round-trips back to the wizard
    # (and is what a later retry inherits via SceneAvatarJob.motion_style).
    # None keeps whatever the project already has.
    avatar_motion_style: Optional[str] = Body(None, embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Charge for a batch of avatars and unlock generation for this project.

    Billed against the payer's COMBINED AI-edit budget: the monthly plan
    allowance (``ai_edits_used_this_period`` against PLAN_AI_EDIT_ALLOWANCE)
    first, then the purchased ``ai_edit_credits`` pool for any remainder — same
    split as a regular AI edit (see can_afford_avatars/consume_avatar_credits).
    A payer whose combined budget cannot cover the whole batch is refused —
    there is no partial batch. FREE users can still generate avatars as long as
    they hold enough purchased ``ai_edit_credits``.

    ONE charge for the whole batch, deliberately — not per scene. The wizard
    fans out N parallel POSTs to the per-scene endpoint, and consume_* is a
    non-atomic read-modify-write, so charging there would let concurrent
    requests read the same balance and systematically under-charge. Worse, a
    user could be charged for scenes 1-3 and rejected on 4-10, left with a
    part-finished batch and spent credits. Authorizing once removes both.

    Also deliberately: the deduction happens BEFORE the work, unlike
    add_scene/regenerate_scene which deduct after theirs succeeds. Those are
    synchronous — a mid-flight raise aborts before the deduction, which is why
    they need no refund path. Avatar renders are queued and asynchronous, so
    there is no single request whose success we could hang the charge on.

    Retries are NOT charged again (see avatar-retry-failed): the user already
    paid for that scene.
    """
    from app.services.access import (
        AVATAR_BATCH_MAX_SCENES,
        AVATAR_CREDIT_COST_PER_SCENE,
        avatar_batch_min_scenes,
        can_afford_avatars,
        consume_avatar_credits,
        project_owner,
    )
    from app.services.avatar_motion_styles import normalize_motion_style
    from app.services.avatar_presets import normalize_preset

    project = _get_user_project(project_id, user.id, db)
    # An explicit choice from the wizard's pick step updates the project's
    # setting (so it round-trips back and future batches/retries default to
    # it); omitted, this batch simply uses whatever the project already has.
    motion_style = normalize_motion_style(avatar_motion_style or project.avatar_motion_style)
    if avatar_motion_style:
        project.avatar_motion_style = motion_style

    # Only scenes that could actually render: active, with narration to lip-sync
    # to, and no clip yet. Recomputed here rather than trusted from the client —
    # the UI gate must not be the only gate.
    # Scenes whose credits were already given back are OUT. They have no clip, so
    # the filter below would happily re-offer them — and the charge is
    # len(requested) * COST, so the user would pay a second time for a scene every
    # other gate refuses to render. Excluded HERE, before eligible_ids, so
    # `requested` is filtered too and the money is never taken.
    refunded_scene_ids = {
        sid
        for (sid,) in db.query(SceneAvatarJob.scene_id)
        .filter(
            SceneAvatarJob.project_id == project_id,
            SceneAvatarJob.credits_refunded.is_(True),
        )
        .distinct()
    }
    # Scenes whose MOST RECENT job failed for good (exhausted attempts, or a
    # terminal error) but has NOT been refunded YET are also OUT — same reason
    # as refunded_scene_ids, one step earlier. Without this, a second
    # authorize call landing before the refund sweep has processed the first
    # batch's failure re-charges a scene that is already dead, stacking a
    # second charge on a scene that was never going to render either time.
    # Confirmed live: this is exactly how project 1242 ended up charged twice
    # for 5 scenes and refunded zero — see avatar_queue.py's
    # _failed_for_good_predicate / _on_batch_settled docstring.
    from app.services.avatar_queue import _failed_for_good_predicate, _max_attempts

    latest_job_ids_subq = (
        db.query(func.max(SceneAvatarJob.id))
        .filter(SceneAvatarJob.project_id == project_id, SceneAvatarJob.kind == "render")
        .group_by(SceneAvatarJob.scene_id)
        .subquery()
    )
    awaiting_refund_scene_ids = {
        sid
        for (sid,) in db.query(SceneAvatarJob.scene_id)
        .filter(
            SceneAvatarJob.id.in_(select(latest_job_ids_subq)),
            _failed_for_good_predicate(_max_attempts()),
        )
        .distinct()
    }
    eligible = (
        db.query(Scene)
        .filter(
            Scene.project_id == project_id,
            Scene.is_active.is_(True),
            Scene.voiceover_path.isnot(None),
            Scene.avatar_video_path.is_(None),
        )
        .all()
    )
    if refunded_scene_ids:
        eligible = [s for s in eligible if s.id not in refunded_scene_ids]
    if awaiting_refund_scene_ids:
        eligible = [s for s in eligible if s.id not in awaiting_refund_scene_ids]
    # …and whose audio is actually reachable. A path column that points at a
    # file no container still has is not something we may charge for: that is
    # exactly how a paid batch used to end up with zero renders.
    eligible = [s for s in eligible if _scene_has_voiceover(s, db)]
    eligible_ids = {s.id for s in eligible}
    requested = [sid for sid in dict.fromkeys(scene_ids) if sid in eligible_ids]

    min_scenes = avatar_batch_min_scenes(len(eligible_ids))
    if len(requested) < min_scenes:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Select at least {min_scenes} scene"
                f"{'' if min_scenes == 1 else 's'} to generate avatars for."
            ),
        )
    if len(requested) > AVATAR_BATCH_MAX_SCENES:
        raise HTTPException(
            status_code=400,
            detail=f"You can generate avatars for at most {AVATAR_BATCH_MAX_SCENES} scenes at a time.",
        )

    # Owner pays — a collaborator's batch is charged to the project owner, the
    # same convention as every other credit-consuming action here.
    payer = project_owner(project, db)
    cost = len(requested) * AVATAR_CREDIT_COST_PER_SCENE
    if not can_afford_avatars(payer, len(requested)):
        # Combined-budget check failed: allowance + purchased ai_edit_credits
        # together don't cover the batch. The frontend branches this into
        # "upgrade" (free payer) vs "buy a video" (paid payer, allowance spent)
        # — see AvatarBatchWizard's payerIsFree/needsUpgrade/needsVideoPurchase
        # — this message is only the fallback for the stale-balance race where
        # the client's local check let the request through anyway.
        remaining = payer.ai_edit_credits_available
        raise HTTPException(
            status_code=403,
            detail={
                "code": "avatar_allowance_exhausted",
                "message": (
                    f"This needs {cost} AI credits ({AVATAR_CREDIT_COST_PER_SCENE} per scene) "
                    f"and you have {remaining} left."
                ),
            },
        )

    # The charge and the work it pays for are ONE transaction. They used to be
    # separate requests — this endpoint charged, and the browser then fanned out
    # a POST per scene to create the rows. Any failure in that second step (a
    # stale MEDIA_DIR path 400ing every scene, a closed laptop, a dropped
    # connection) left the user charged with nothing queued and no way to tell,
    # because the boolean below is the only thing the UI resumes from. Creating
    # the rows here removes the window: the credits cannot land without them.
    # One id for every row this call creates — see SceneAvatarJob.batch_id.
    # Lets _on_batch_settled / refund_exhausted_avatar_failures ask "is THIS
    # run done" instead of guessing from project-wide state.
    batch_id = str(uuid.uuid4())
    scene_by_id = {s.id: s for s in eligible}
    jobs = []
    for sid in requested:
        # A scene already in flight keeps its existing job rather than gaining a
        # duplicate — same guard the per-scene endpoint applies.
        if _active_avatar_job(sid, db):
            continue
        scene = scene_by_id[sid]
        scene.avatar_preset = normalize_preset(avatar_preset or scene.avatar_preset)
        jobs.append(SceneAvatarJob(
            project_id=project_id,
            scene_id=sid,
            user_id=user.id,
            status="queued",
            kind="render",
            avatar_preset=scene.avatar_preset,
            motion_style=motion_style,
            batch_id=batch_id,
            # An explicit, paid-for request starts with a full retry budget.
            attempt_count=0,
        ))

    # Charge for the jobs actually CREATED, not for everything requested. The loop
    # above skips any scene already in flight, and that scene was paid for when it
    # was queued — billing it again here charged the user twice for one render.
    # The affordability gate above deliberately stays on len(requested): it runs
    # before the loop and is the conservative bound.
    charged_scenes = len(jobs)
    cost = charged_scenes * AVATAR_CREDIT_COST_PER_SCENE
    consume_avatar_credits(payer, charged_scenes)
    # Persisted so a mid-batch reload doesn't re-show the paywall.
    project.avatar_batch_unlocked = True
    db.add_all(jobs)
    db.commit()
    # The in-process dispatcher (services/avatar_queue) claims queued rows on its
    # own ~2s tick, so nothing further has to be triggered from here.

    return {
        "authorized": True,
        "scene_ids": requested,
        "job_ids": [j.id for j in jobs],
        "credits_charged": cost,
        # Combined pool — consume_avatar_credits may have spent from either or
        # both, so this is the only figure that reflects what's left to spend.
        "credits_remaining": payer.ai_edit_credits_available,
    }


@router.post("/{project_id}/scenes/{scene_id}/avatar")
def generate_scene_avatar(
    project_id: int,
    scene_id: int,
    avatar_preset: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enqueue an on-demand talking-head render for ONE scene.

    This also serves as the RETRY action for a scene whose last job failed —
    there is no separate retry endpoint, a fresh request is exactly the same
    thing as a first-time one. Returns immediately; the server-side queue (see
    services/avatar_queue.py) processes it in FIFO order alongside every other
    project's pending jobs.

    Being an EXPLICIT user action, this resets the scene's attempt budget. The
    bulk ``avatar-retry-failed`` endpoint inherits it instead, so unattended
    retries stay bounded while a human can always ask again.
    """
    project = _get_user_project(project_id, user.id, db)
    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    # An avatar is lip-synced to the scene's voiceover — no audio, nothing to sync.
    # Checked against R2 as well as disk: MEDIA_DIR is ephemeral, so a bare
    # os.path.exists rejects scenes whose audio is merely not cached on THIS
    # container (see services/avatar.ensure_local_voiceover).
    if not _scene_has_voiceover(scene, db):
        raise HTTPException(
            status_code=400,
            detail="This scene has no voiceover yet. Add narration audio first.",
        )

    if _active_avatar_job(scene_id, db):
        raise HTTPException(
            status_code=409,
            detail="An avatar is already being generated for this scene.",
        )

    from app.services.access import project_owner
    from app.services.avatar_motion_styles import normalize_motion_style
    from app.services.avatar_presets import normalize_preset

    _assert_can_generate_avatar(project_owner(project, db), project, db)

    # A refunded scene is closed. This endpoint is the only remaining place that
    # RESETS attempt_count to 0, so without this gate it is a free-render hole:
    # the credits went back, and a fresh budget would render it for nothing.
    latest_job = (
        db.query(SceneAvatarJob)
        .filter(SceneAvatarJob.scene_id == scene_id)
        .order_by(SceneAvatarJob.id.desc())
        .first()
    )
    if latest_job is not None and latest_job.credits_refunded:
        raise HTTPException(
            status_code=409,
            detail=(
                "We couldn't generate an avatar for this scene and have returned "
                "your credits. This scene can't be generated again."
            ),
        )

    preset = normalize_preset(avatar_preset or scene.avatar_preset)
    scene.avatar_preset = preset

    job = SceneAvatarJob(
        project_id=project_id,
        scene_id=scene_id,
        user_id=user.id,
        status="queued",
        avatar_preset=preset,
        motion_style=normalize_motion_style(project.avatar_motion_style),
        # A batch of one — see SceneAvatarJob.batch_id.
        batch_id=str(uuid.uuid4()),
        # A deliberate human click RESETS the per-scene attempt budget (unlike
        # the bulk retry endpoint, which inherits it). The service being down an
        # hour ago must never refuse a render that would succeed now.
        attempt_count=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return {
        "started": True,
        "queued": True,
        "job_id": job.id,
        "avatar_preset": preset,
        "queue_position": _queue_position(job, db),
    }


@router.get("/{project_id}/scenes/{scene_id}/avatar-status")
def get_scene_avatar_status(
    project_id: int,
    scene_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll one scene's avatar render.

    A plain ``def`` (not ``async``) on purpose: it does only blocking DB work and
    is polled every ~1.2s, so running it on the event loop would stall the app.
    """
    _get_user_project(project_id, user.id, db)
    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    job = (
        db.query(SceneAvatarJob)
        .filter(SceneAvatarJob.scene_id == scene_id)
        .order_by(SceneAvatarJob.id.desc())
        .first()
    )
    active = _active_avatar_job(scene_id, db) is not None
    stalled = bool(
        job and job.status in _ACTIVE_AVATAR_STATUSES and not active
    )
    kind = getattr(job, "kind", "render") if job else None
    return {
        "active": active,
        # A stalled job is reported as done-with-an-error rather than spinning forever.
        "done": bool(job and (job.status in ("completed", "failed") or stalled)),
        "error": (
            (
                "Background removal timed out. Please try again."
                if kind == "matte"
                else "The avatar render timed out. Please try again."
            )
            if stalled
            # Never the raw reason — that is a diagnostic, not a message. It
            # stays in the DB and the logs; see AVATAR_GENERIC_FAILURE.
            else (
                _avatar_generic_failure()
                if job and job.status == "failed"
                else None
            )
        ),
        "status": job.status if job else None,
        "phase": job.phase if job else None,
        # Which operation the polled job is: lets one polling loop drive both the
        # "Generating avatar…" and "Removing background…" messages.
        "kind": kind,
        "duration_seconds": job.duration_seconds if job else None,
        "has_avatar": bool(scene.avatar_video_path),
        "has_matte": bool(scene.avatar_matte_path),
        # Why the cutout is missing on a scene that DID render. The render job is
        # `completed` in that case — only the transparent twin failed — so this is
        # the one place the UI can learn that a background change is unavailable
        # and offer the manual "Remove them now" retry instead of silently
        # ignoring the user's colour choice.
        "matte_error": scene.avatar_matte_error,
        "avatar_preset": scene.avatar_preset,
        # None once running/terminal — only meaningful while still queued.
        "queue_position": _queue_position(job, db) if job else None,
        # Whether a `failed` job is worth an automatic/manual retry. None
        # while not failed (nothing to retry) or on legacy rows predating
        # this column.
        "retryable": job.retryable if job else None,
        # Attempts this SCENE has burned (carried across job rows) and the
        # ceiling, so the UI can say "attempt 2 of 3" live rather than only
        # reporting a bare failure at the end.
        "attempt_count": job.attempt_count if job else None,
        "max_attempts": int(settings.AVATAR_MAX_ATTEMPTS),
    }


@router.delete("/{project_id}/scenes/{scene_id}/avatar", response_model=SceneOut)
async def delete_scene_avatar(
    project_id: int,
    scene_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove the avatar overlay from a scene (the rendered file/asset is left in
    place — clearing the path is what takes it out of the composition)."""
    _get_user_project(project_id, user.id, db)
    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    scene.avatar_video_path = None
    # The matte is derived from the clip we just detached, so it must go too —
    # leaving it would make a later background change silently reuse a stale cutout
    # of an avatar the scene no longer has.
    scene.avatar_matte_path = None
    # ...and so must the record of WHY a cutout is missing, for the same reason:
    # it describes a clip that no longer exists. Left set, avatar-status would
    # report has_matte=false beside an error about the deleted avatar, and
    # avatar_matte_failed_at would keep this scene out of the automatic matte
    # sweeps even after a fresh, healthy render.
    scene.avatar_matte_error = None
    scene.avatar_matte_failed_at = None
    db.commit()
    db.refresh(scene)

    from app.routers.collab_ws import collab_manager

    await collab_manager.broadcast(
        project_id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )
    return scene


def _queue_matte(project_id: int, scene: Scene, user_id: int, db: Session) -> int | None:
    """Create a queued matte job for a scene, or None if it doesn't need one.

    Skips scenes with no avatar, scenes already matted, and scenes with a job in
    flight — so "apply to all" is idempotent and safe to press twice.
    """
    if not scene.avatar_video_path or scene.avatar_matte_path:
        return None
    if _active_avatar_job(scene.id, db):
        return None
    job = SceneAvatarJob(
        project_id=project_id,
        scene_id=scene.id,
        user_id=user_id,
        status="queued",
        kind="matte",
        avatar_preset=scene.avatar_preset,
    )
    db.add(job)
    db.flush()
    return job.id


@router.post("/{project_id}/scenes/{scene_id}/avatar-matte")
def matte_scene_avatar(
    project_id: int,
    scene_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enqueue cutting the presenter out of ONE scene's existing avatar clip.

    Needed before a custom background can show through, because the roster
    portraits have their rooms baked in. Does NOT re-render: it reads the mp4 this
    scene already has. Returns started=False when the scene is already matted, so
    the UI can treat "nothing to do" as success rather than an error. Enqueues
    onto the same system-wide FIFO queue as render jobs (see
    services/avatar_queue.py) — it will run once every earlier job has.
    """
    # BG-REMOVAL-DISABLED: the route stays REGISTERED but does nothing. Deleting it
    # would 404 a stale frontend bundle still holding the old code; answering
    # started=False is a shape the UI already treats as "nothing to do, not an
    # error" (same as the already_matted case below).
    # TO RE-ENABLE: delete this block.
    return {"started": False, "disabled": True}

    _get_user_project(project_id, user.id, db)
    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if not scene.avatar_video_path:
        raise HTTPException(
            status_code=400,
            detail="This scene has no avatar yet. Generate one first.",
        )
    if scene.avatar_matte_path:
        return {"started": False, "already_matted": True}
    if _active_avatar_job(scene_id, db):
        raise HTTPException(
            status_code=409,
            detail="This scene's avatar is already being processed.",
        )

    # Clear any recorded failure as the retry is enqueued. BOTH columns, not just
    # the message: avatar_matte_failed_at is what the automatic sweeps back off
    # on (see _scene_needs_matte), so leaving it set would exclude this scene from
    # them forever even after the retry succeeds. Clearing it here is also what
    # stops the UI showing the previous error while the new job sits queued.
    #
    # This endpoint is the ONE deliberately unfiltered matte path: a user asking
    # for a specific scene again must never be refused because it failed before.
    scene.avatar_matte_error = None
    scene.avatar_matte_failed_at = None
    job_id = _queue_matte(project_id, scene, user.id, db)
    db.commit()
    return {"started": True, "queued": True, "job_id": job_id}


@router.post("/{project_id}/avatar-matte-all")
def matte_all_scene_avatars(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enqueue a matte for every scene that has an avatar but no cutout yet.

    This is what the Background control's "Apply to N scenes" calls. Each scene is
    an independent job — a failure on one leaves the others alone, and the project
    still renders (un-matted scenes just keep their original background). All
    enqueued jobs share the same system-wide FIFO queue as render jobs, so they
    run one at a time rather than all at once.
    """
    # BG-REMOVAL-DISABLED: registered but inert, for the same reason as the
    # single-scene endpoint above. started=0 is the shape the wizard already reads
    # as "no cutouts were owed", so a stale bundle degrades cleanly instead of
    # hanging on a matte phase that will never report progress.
    # TO RE-ENABLE: delete this block.
    return {"started": 0, "queued": False, "job_ids": [], "disabled": True}

    from app.services.avatar_queue import scene_needs_matte_filters

    _get_user_project(project_id, user.id, db)
    # Same predicate the post-render chain uses, so the two automatic sweeps can
    # never disagree about which scenes are owed a cutout. Notably this EXCLUDES
    # scenes whose inline matte already failed (avatar_matte_failed_at set) —
    # those are deterministic failures and re-running them in bulk just burns
    # queue slots. The per-scene "Remove them now" button stays unfiltered for
    # exactly that case. See avatar_queue.scene_needs_matte_filters.
    scenes = (
        db.query(Scene)
        .filter(
            Scene.project_id == project_id,
            Scene.is_active.is_(True),
            *scene_needs_matte_filters(),
        )
        .order_by(Scene.order)
        .all()
    )

    # `started` counts what was actually ENQUEUED, not what was swept: _queue_matte
    # returns None for a scene that already has an active job, so the number the
    # UI shows never claims work that was skipped.
    job_ids = [
        job_id
        for scene in scenes
        if (job_id := _queue_matte(project_id, scene, user.id, db)) is not None
    ]
    db.commit()
    return {"started": len(job_ids), "queued": True, "job_ids": job_ids}


@router.post("/{project_id}/avatar-retry-failed")
def retry_failed_scene_avatars(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-enqueue every scene in this project whose most recent avatar job
    failed. This is THE project-wide retry action — it re-enters the back of
    the same system-wide FIFO queue as a fresh request, so a retried scene
    doesn't jump ahead of anything already waiting.

    Idempotent and safe to press repeatedly: a scene whose latest job is
    already queued/running is left alone (matches _queue_matte's skip logic),
    and a scene whose latest job is `completed` is not re-run. Skips
    non-retryable failures — retrying "voiceover missing" would just fail
    again identically, so only jobs marked retryable=True (or legacy rows
    predating that column, where retryable is NULL) are retried.
    """
    _get_user_project(project_id, user.id, db)

    # Latest job per scene, for every scene in this project that has ever had one.
    scene_ids_with_jobs = (
        db.query(SceneAvatarJob.scene_id)
        .filter(SceneAvatarJob.project_id == project_id)
        .distinct()
        .all()
    )
    max_attempts = int(settings.AVATAR_MAX_ATTEMPTS)
    retried: list[dict] = []
    skipped_exhausted = 0
    # Scenes closed out by a refund — reported separately so the UI can say
    # "we returned your credits" instead of "try again".
    blocked_refunded = 0
    # One id for every row THIS call creates — its own coherent run, not
    # inherited from whichever original batch(es) each retried scene came
    # from (there may be several, so there is no single "original" to
    # attribute to). See SceneAvatarJob.batch_id.
    batch_id = str(uuid.uuid4())
    for (scene_id,) in scene_ids_with_jobs:
        latest = (
            db.query(SceneAvatarJob)
            .filter(SceneAvatarJob.scene_id == scene_id)
            .order_by(SceneAvatarJob.id.desc())
            .first()
        )
        if not latest or latest.status != "failed":
            continue
        # Refunded means closed: the user's money is back, so re-running this
        # would be free GPU work. Checked BEFORE `retryable`, which stays true on
        # a refunded row (it records that the error class was transient — a
        # diagnostic, not a permission).
        if latest.credits_refunded:
            blocked_refunded += 1
            continue
        if latest.retryable is False:
            continue
        # The attempt ceiling is per SCENE and carried across job rows, so this
        # bulk/unattended path can never burn more than max_attempts renders for
        # one scene however often it is called. `retryable` alone is not enough:
        # a scene that just exhausted its budget against a service that is down
        # is still retryable=True (the error CLASS is transient), and without
        # this check it would be re-enqueued indefinitely. An explicit per-scene
        # Generate click resets the count, so the user is never locked out.
        if (latest.attempt_count or 0) >= max_attempts:
            skipped_exhausted += 1
            continue
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            continue
        job = SceneAvatarJob(
            project_id=project_id,
            scene_id=scene_id,
            user_id=user.id,
            status="queued",
            kind=latest.kind,
            avatar_preset=latest.avatar_preset,
            # INHERIT the failed job's own style, not the project's current
            # setting — a retry must reproduce the original render, not
            # silently switch styles if the project default changed since.
            motion_style=latest.motion_style,
            batch_id=batch_id,
            # INHERIT the tally — the dispatcher resumes counting from here
            # rather than restarting at 1.
            attempt_count=latest.attempt_count or 0,
        )
        db.add(job)
        db.flush()
        retried.append({"scene_id": scene_id, "job_id": job.id, "kind": latest.kind})
    db.commit()
    return {
        "retried": len(retried),
        "jobs": retried,
        # Lets the UI say "3 scenes have failed too many times — open the scene
        # to try again" instead of silently retrying nothing.
        "skipped_exhausted": skipped_exhausted,
        "blocked_refunded": blocked_refunded,
    }


@router.get("/{project_id}/avatar-progress")
def get_avatar_progress(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Project-wide rollup of every scene's avatar job — replaces client-side
    progress tracking (e.g. the batch wizard counting its own sequential
    awaits) with server-computed truth. One scene appears at most once, keyed
    by its MOST RECENT job.

    ``batch_status`` is the authoritative answer to "is this project's avatar
    run finished?", so the client never has to derive settledness by comparing
    array lengths — a scene whose enqueue POST silently failed has no job row,
    which used to make that comparison never come true and spin forever.
    """
    project = _get_user_project(project_id, user.id, db)

    scene_ids_with_jobs = (
        db.query(SceneAvatarJob.scene_id)
        .filter(SceneAvatarJob.project_id == project_id)
        .distinct()
        .all()
    )

    # Which scenes belong to the MOST RECENT run, as opposed to every scene this
    # project has ever generated an avatar for.
    #
    # The client cannot work this out for itself. It used to remember the
    # selection in a React ref, which a page refresh wipes — so a reload fell back
    # to the wizard's default first-N and a 7-scene batch rendered as 5. Seeding
    # from `scenes` instead swaps that for the opposite error: on a project with an
    # earlier run, a NEW 7-scene batch renders as 14 with the previous 7 already
    # "Done". Only the server can tell the two runs apart.
    #
    # authorize_avatar_batch inserts every job of a run in ONE transaction, so a
    # run lands inside a few hundred MICROSECONDS while separate runs are minutes
    # or hours apart. Grouping by a short window off the newest row therefore
    # isolates a run with no extra column.
    #
    # It is a WINDOW and not an equality test because created_at is a per-row
    # server_default: rows in the same INSERT differ in the microseconds, so
    # `created_at == max(created_at)` matches exactly one job and reported a
    # 7-scene batch as 1. The window only has to be wider than one transaction
    # and narrower than the gap between two runs; a minute clears both by orders
    # of magnitude. Rows from other sources (a per-scene retry, a fallback matte)
    # get their own timestamp and correctly form a run of one.
    latest_created = (
        db.query(func.max(SceneAvatarJob.created_at))
        .filter(SceneAvatarJob.project_id == project_id)
        .scalar()
    )
    latest_batch_scene_ids = (
        [
            sid
            for (sid,) in db.query(SceneAvatarJob.scene_id)
            .filter(
                SceneAvatarJob.project_id == project_id,
                SceneAvatarJob.created_at >= latest_created - timedelta(minutes=1),
            )
            .distinct()
            .all()
        ]
        if latest_created
        else []
    )

    # Scenes that COULD have an avatar (an avatar is lip-synced to narration, so
    # a scene with no voiceover is never eligible).
    #
    # Deliberately mirrors authorize_avatar_batch's own eligibility filter, which
    # is the only thing that can actually enqueue a render. This used to test the
    # voiceover alone, so it counted SOFT-DELETED scenes and scenes that ALREADY
    # have an avatar — on a 25-scene project it reported 25 where authorize would
    # have accepted a handful. A number the client could show as a denominator but
    # that no endpoint would honour is worse than no number at all.
    #
    # `_scene_has_voiceover`'s R2 reachability check is NOT applied: it touches
    # storage per scene, which is far too expensive for an endpoint the UI polls
    # about once a second. This stays a cheap upper bound on what authorize would
    # take.
    # NOTE: eligible_total is computed further down, AFTER latest_jobs — it has to
    # exclude refunded scenes, and those are already in that result. Doing it here
    # would need a second query on an endpoint polled about once a second.

    max_attempts = int(settings.AVATAR_MAX_ATTEMPTS)
    scenes_out = []
    counts = {"queued": 0, "running": 0, "completed": 0, "failed": 0}

    # THREE QUERIES, NOT ~2N+1. This loop used to run a query per scene for the
    # latest job, another per scene via _active_avatar_job, and a COUNT per queued
    # scene via _queue_position — 41 queries for a 20-scene project, on an endpoint
    # the UI polls about once a second. With a DB pool of 5 + 10 overflow shared
    # with renders that hold a connection for minutes, that is the same exhaustion
    # which once recorded a clip already paid for on the GPU as a failed attempt.
    #
    # 1. Latest job per scene in ONE grouped query. Equivalent to the old
    #    `order_by(id.desc()).first()` because MAX(id) is that same tiebreak.
    latest_job_ids = (
        db.query(func.max(SceneAvatarJob.id))
        .filter(SceneAvatarJob.project_id == project_id)
        .group_by(SceneAvatarJob.scene_id)
        .subquery()
    )
    latest_jobs = (
        db.query(SceneAvatarJob)
        .filter(SceneAvatarJob.id.in_(select(latest_job_ids)))
        .all()
    )
    from app.services.access import AVATAR_CREDIT_COST_PER_SCENE

    # Refunded scenes are closed — authorize_avatar_batch refuses them, so the
    # "N scenes still don't have an avatar" banner must not advertise them either.
    # Read off latest_jobs, which is already in memory: no extra query.
    refunded_scene_ids = {j.scene_id for j in latest_jobs if j.credits_refunded}
    eligible_total = (
        db.query(Scene)
        .filter(
            Scene.project_id == project_id,
            Scene.is_active.is_(True),
            Scene.voiceover_path.isnot(None),
            Scene.voiceover_path != "",
            Scene.avatar_video_path.is_(None),
            *([Scene.id.notin_(refunded_scene_ids)] if refunded_scene_ids else []),
        )
        .count()
    )
    # 2. Queue position is a GLOBAL FIFO rank, so it is one ordered read for the
    #    whole response instead of a COUNT per queued job.
    queued_rank = {
        jid: idx
        for idx, (jid,) in enumerate(
            db.query(SceneAvatarJob.id)
            .filter(SceneAvatarJob.status == "queued")
            .order_by(SceneAvatarJob.created_at.asc(), SceneAvatarJob.id.asc())
            .all()
        )
    }

    for job in latest_jobs:
        # 3. _active_avatar_job is not needed here. Its only use was this
        #    staleness downgrade, and updated_at is already on the row — so the
        #    same answer costs zero extra queries.
        active = (
            job.status in _ACTIVE_AVATAR_STATUSES
            and _seconds_since(job.updated_at)
            < settings.STALL_THRESHOLD_AVATAR_SECONDS
        )
        effective_status = job.status if (job.status != "running" or active) else "failed"
        counts[effective_status] = counts.get(effective_status, 0) + 1
        scenes_out.append({
            "scene_id": job.scene_id,
            "job_id": job.id,
            "status": effective_status,
            "kind": job.kind,
            # Which stage a running job is in, so a per-scene batch view can say
            # "warming up" vs "rendering" without N separate avatar-status calls.
            "phase": job.phase,
            "queue_position": queued_rank.get(job.id) if job.status == "queued" else None,
            # Generic on purpose (same rule as /avatar-status). Nothing in the
            # batch UI renders this today; keeping it sanitised means a future
            # consumer cannot leak the raw reason by accident.
            "error": (
                _avatar_generic_failure() if job.status == "failed" else None
            ),
            "retryable": job.retryable,
            "attempt_count": job.attempt_count,
            # True once this SCENE has burned its whole per-scene budget: the
            # bulk retry endpoint will skip it, though an explicit per-scene
            # Generate still resets and works.
            "attempts_exhausted": (job.attempt_count or 0) >= max_attempts,
            # Closed out by a refund: no retry anywhere, and the wizard
            # names these in its apology.
            "credits_refunded": bool(job.credits_refunded),
        })

    # "running" if anything is still queued or in flight; "settled" once every
    # scene that has a job has reached a terminal state; "idle" before anything
    # has been enqueued at all.
    if counts["queued"] or counts["running"]:
        batch_status = "running"
    elif scenes_out:
        batch_status = "settled"
    else:
        batch_status = "idle"

    # ── The complete, client-renderable answer ────────────────────────────────
    #
    # Everything below exists so the CLIENT NEVER DERIVES THE VIEW. It used to,
    # from ~16 separate guesses — a module-level cache that survives a tab switch
    # but not a refresh, a stale `avatar_batch_unlocked` latch, a default
    # first-5 scene selection — which is why the same server state produced a
    # different screen on every reload: the appearance sliders painted over five
    # rendering scenes, or "Scene 1..5" listed while scenes 18 and 20 were the
    # ones actually on the GPU.
    #
    # Modelled on get_pipeline_status (routers/pipeline.py): the server resolves
    # a coherent answer from the DB and the client just renders it.
    batch_rows = [r for r in scenes_out if r["scene_id"] in set(latest_batch_scene_ids)]
    # Scene ORDER travels with each row. The client used to fall back to an array
    # index, so a finished scene — which drops out of the "eligible" list — showed
    # as "Scene ?". Sorting here also means the client never has to sort from a
    # list the scene may no longer be in.
    order_by_scene = dict(
        db.query(Scene.id, Scene.order)
        .filter(Scene.id.in_(latest_batch_scene_ids))
        .all()
    ) if latest_batch_scene_ids else {}
    for r in batch_rows:
        r["order"] = order_by_scene.get(r["scene_id"])
    batch_rows.sort(key=lambda r: (r["order"] is None, r["order"] or 0))

    batch_live = any(r["status"] in ("queued", "running") for r in batch_rows)
    # The user's rule, stated exactly: show progress while any scene in the most
    # recent batch is not done; otherwise show the editing options (and, if
    # scenes still lack avatars, the "Generate N scenes" banner).
    view = "progress" if batch_live else "settings"

    # Release the paywall latch once nothing is in flight. The flag exists so a
    # mid-batch reload doesn't re-show the paywall, but it used to be set and
    # never cleared — so every later page load resumed into the "generating"
    # view, which is why a batch that produced no rows showed a spinner forever.
    # Clearing it on a quiet project makes the flag mean "a batch is live" again.
    if batch_status != "running" and project.avatar_batch_unlocked:
        project.avatar_batch_unlocked = False
        db.commit()

    return {
        "scenes": scenes_out,
        "counts": counts,
        "total": len(scenes_out),
        "batch_status": batch_status,
        "eligible_total": eligible_total,
        # PROJECT-WIDE list of scenes closed out by a refund — deliberately not
        # `batch.rows`, which only covers the most recent run while a refunded
        # scene can come from any earlier one.
        #
        # The wizard needs this to show those scenes as unselectable. Without it
        # the UI happily walks the user to a priced Generate button for scenes
        # authorize_avatar_batch will refuse (400, no charge — safe, but a dead
        # end). Free: read off latest_jobs, already in memory.
        "refunded_scene_ids": sorted(refunded_scene_ids),
        # WHICH VIEW TO RENDER. Not a hint — the answer. See the block above.
        "view": view,
        # The most recent run, resolved: its rows in scene order, with the
        # numerator and denominator already counted. `total` is the BATCH's size,
        # not the project's — the client used to use a project-wide job count and
        # reported a 6-scene batch as "of 20".
        "batch": {
            "scene_ids": [r["scene_id"] for r in batch_rows],
            "rows": batch_rows,
            "total": len(batch_rows),
            # A failed scene is finished for progress purposes: it will not move
            # again on its own, so counting it as outstanding spins forever.
            "done": sum(
                1 for r in batch_rows if r["status"] in ("completed", "failed")
            ),
            "all_terminal": not batch_live,
            # What the apology modal needs, derived from rows already in memory.
            # `refunded_credits` is computed from the LIVE constant, matching how
            # the sweep pays — there is no per-row cost column by design.
            "refunded_scene_orders": [
                r["order"]
                for r in batch_rows
                if r.get("credits_refunded") and r.get("order") is not None
            ],
            "refunded_credits": (
                sum(1 for r in batch_rows if r.get("credits_refunded"))
                * AVATAR_CREDIT_COST_PER_SCENE
            ),
        },
        "max_attempts": max_attempts,
    }


@router.post("/{project_id}/avatar-portrait")
def upload_avatar_portrait(
    project_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a presenter portrait to use instead of the built-in roster.

    Stored per PROJECT (not per scene): a video with two different faces
    presenting it would be odd, and scenes already choose per-scene whether to use
    the custom presenter via avatar_preset == "custom".

    The photo is NOT sent to the avatar Space here — it is staged at generate time
    (services/avatar.py uploads the bytes with /prepare), so uploading costs
    nothing and can be re-done freely before committing to a ~2.6-min render.
    """
    project = _get_user_project(project_id, user.id, db)

    allowed = {"image/png", "image/jpeg"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400, detail="Photo must be a PNG or JPEG image."
        )
    raw = file.file.read()
    MAX_PORTRAIT_SIZE = 8 * 1024 * 1024
    if len(raw) > MAX_PORTRAIT_SIZE:
        raise HTTPException(
            status_code=400, detail="Photo is too large. Maximum size is 8 MB."
        )
    if not raw:
        raise HTTPException(status_code=400, detail="That file appears to be empty.")

    # Normalise before anything is stored, so the local copy, the R2 copy and
    # every render all see the same prepared image. See _normalise_portrait for
    # why an untouched upload made a custom avatar's colour drift.
    try:
        raw = _normalise_portrait(raw)
    except Exception:
        logger.warning("[AVATAR] Could not read uploaded portrait", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail="That image couldn't be read. Please try a different photo.",
        )

    # Always .jpg now — normalisation re-encodes every input to JPEG, and the
    # extension is what upload_project_avatar's mimetypes.guess_type reads to
    # label the object in R2.
    ext = "jpg"
    # Versioned filename (like video_key_versioned) so each re-upload/re-crop gets
    # a distinct R2 URL — a fixed name would let the browser keep serving its
    # cached copy of the OLD photo at the same URL after a new one is uploaded.
    filename = f"custom_presenter_{int(time.time())}.{ext}"
    avatar_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/avatars")
    os.makedirs(avatar_dir, exist_ok=True)
    local_path = os.path.join(avatar_dir, filename)
    with open(local_path, "wb") as f:
        f.write(raw)

    # R2 is the durable copy: Cloud Run containers are ephemeral, so the local
    # file may well be gone by the time a render actually needs it.
    r2_url = None
    if r2_storage.is_r2_configured():
        try:
            r2_url = r2_storage.upload_project_avatar(
                user.id, project_id, local_path, filename
            )
        except Exception as e:
            logger.warning(
                "[AVATAR] R2 upload failed for custom portrait: %s", e,
                extra={"project_id": project_id},
            )

    project.avatar_custom_image_path = local_path
    project.avatar_custom_image_url = r2_url
    db.commit()
    db.refresh(project)
    return {
        "ok": True,
        "avatar_custom_image_url": project.avatar_custom_image_url,
        "has_custom_portrait": True,
    }


@router.delete("/{project_id}/avatar-portrait")
def delete_avatar_portrait(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Forget the uploaded presenter photo.

    Scenes whose avatar_preset is "custom" are reset to the default roster
    presenter, so a later Generate cannot fail on a portrait that no longer
    exists. Clips ALREADY rendered from the old photo are left alone — they are
    finished videos, and silently discarding them would lose real work.
    """
    project = _get_user_project(project_id, user.id, db)

    from app.services.avatar_presets import CUSTOM_PRESET_ID, DEFAULT_PRESET_ID

    project.avatar_custom_image_path = None
    project.avatar_custom_image_url = None
    (
        db.query(Scene)
        .filter(Scene.project_id == project_id, Scene.avatar_preset == CUSTOM_PRESET_ID)
        .update({Scene.avatar_preset: DEFAULT_PRESET_ID}, synchronize_session=False)
    )
    db.commit()
    return {"ok": True, "has_custom_portrait": False}


@router.patch(
    "/{project_id}/scenes/{scene_id}/avatar-focus", response_model=SceneOut
)
async def update_scene_avatar_focus(
    project_id: int,
    scene_id: int,
    data: SceneAvatarFocusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Choose which part of the rendered avatar frame to keep.

    Stored as a focal point + zoom and applied as CSS by AvatarOverlay, so it is
    instant and re-adjustable and the mp4 is never re-encoded. Reuses the same
    clamps as scene-image framing, which is the identical problem one level up.

    Requires an avatar: there is no frame to reframe otherwise.
    """
    _get_user_project(project_id, user.id, db)
    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if not scene.avatar_video_path:
        raise HTTPException(
            status_code=400,
            detail="This scene has no avatar yet. Generate one first.",
        )

    scene.avatar_focus_x = _clamp_image_focus(data.avatar_focus_x)
    scene.avatar_focus_y = _clamp_image_focus(data.avatar_focus_y)
    if data.avatar_zoom is not None:
        scene.avatar_zoom = _clamp_image_zoom(data.avatar_zoom)
    db.commit()
    db.refresh(scene)

    from app.routers.collab_ws import collab_manager

    await collab_manager.broadcast(
        project_id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )
    return scene


@router.patch(
    "/{project_id}/scenes/{scene_id}/avatar-appearance", response_model=SceneOut
)
async def update_scene_avatar_appearance(
    project_id: int,
    scene_id: int,
    data: SceneAvatarAppearanceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set (or clear) this scene's overrides of the project avatar presentation.

    Separate from PUT /scenes/{id} because that path routes everything through
    MANUAL_TRACKED_FIELDS and the revertible edit-history change-sets, which exist
    for editorial content. Overlay presentation is not editorial.

    Reads ``model_fields_set`` rather than dropping nulls: an EXPLICIT null means
    "stop overriding, inherit the project setting again", while an omitted field
    means "leave as-is". Collapsing those two would make Reset-to-project a no-op.
    """
    _get_user_project(project_id, user.id, db)
    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    for field in data.model_fields_set:
        setattr(scene, field, getattr(data, field))
    db.commit()
    db.refresh(scene)

    from app.routers.collab_ws import collab_manager

    await collab_manager.broadcast(
        project_id, {"type": "project_reloaded"}, exclude_user_id=user.id
    )
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
    # Framing (imageFocusX/Y, imageZoom) is shared between a still and a stock
    # clip — either occupies the same visual slot — so accept a scene that has
    # one of them assigned.
    if not lp.get("assignedImage") and not lp.get("assignedVideo"):
        raise HTTPException(status_code=400, detail="No image or clip assigned to this scene")

    lp["imageFocusX"] = _clamp_image_focus(data.image_focus_x)
    lp["imageFocusY"] = _clamp_image_focus(data.image_focus_y)
    if data.image_zoom is not None:
        lp["imageZoom"] = _clamp_image_zoom(data.image_zoom)
    # Clip trim travels with the framing, but only for a scene that has a clip —
    # writing it onto a still would leave a field the renderer ignores.
    if data.video_start_seconds is not None and lp.get("assignedVideo"):
        if data.video_start_seconds > 0:
            lp["videoStartSeconds"] = round(data.video_start_seconds, 2)
        else:
            lp.pop("videoStartSeconds", None)
    scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))
    db.commit()
    db.refresh(scene)

    # Image framing lives inside the scene descriptor's layoutProps, so push a reload
    # rather than a field edit (thread-safe; sync endpoint).
    from app.routers.collab_ws import broadcast_project_reload
    broadcast_project_reload(project_id, exclude_user_id=user.id)

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

    # Two scene descriptors changed → reload broadcast (thread-safe; sync endpoint).
    from app.routers.collab_ws import broadcast_project_reload
    broadcast_project_reload(project_id, exclude_user_id=user.id)

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

    # Two scene descriptors changed → reload broadcast (thread-safe; sync endpoint).
    from app.routers.collab_ws import broadcast_project_reload
    broadcast_project_reload(project_id, exclude_user_id=user.id)

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

    # Target scene descriptor changed → reload broadcast (thread-safe; sync endpoint).
    from app.routers.collab_ws import broadcast_project_reload
    broadcast_project_reload(project_id, exclude_user_id=user.id)

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

    # A still and a clip are mutually exclusive in the visual slot.
    _clear_video_assignment(target_lp)
    target_lp["assignedImage"] = source_asset.filename
    target_lp["hideImage"] = False
    target_lp["imageFocusX"] = 50
    target_lp["imageFocusY"] = 50
    target_scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(target_desc))

    db.commit()

    # Sync endpoint (no event loop) → thread-safe reload broadcast. project_reloaded
    # because the scene descriptor's assignedImage/hideImage/focus all changed.
    from app.routers.collab_ws import broadcast_project_reload
    broadcast_project_reload(project_id, exclude_user_id=user.id)

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
    # Visual variants of a layout (`news_headline__v2`). Not in valid_layouts —
    # the layout planner must never pick one — but the renderer dispatches on
    # them, so they belong in `layouts` (see below).
    layout_variants = get_layout_variants(project.template)
    variant_to_base = get_variant_to_base(project.template)
    renderable_layouts = get_all_renderable_layouts(project.template)

    # Convert layout IDs to human-readable names
    meta = get_meta(project.template)
    schema = meta.get("layout_prop_schema", {}) if meta else {}
    variant_labels = meta.get("layout_variant_labels", {}) if meta else {}

    # Custom templates with generated code embed layout_names directly in meta
    meta_layout_names = meta.get("layout_names", {}) if meta else {}
    layout_names = {}
    for layout_id in renderable_layouts:
        base_id = variant_to_base.get(layout_id, layout_id)
        if base_id in meta_layout_names:
            base_name = meta_layout_names[base_id]
        else:
            # Prefer schema label, fallback to Title Case
            layout_schema = schema.get(base_id, {})
            base_name = layout_schema.get("label") or base_id.replace("_", " ").title()
        # Variants read as "News Headline — Broadsheet" so a scene sitting on one
        # still shows a meaningful name wherever a raw layout ID is labelled.
        variant_label = variant_labels.get(layout_id)
        if variant_label and layout_id != base_id:
            layout_names[layout_id] = f"{base_name} — {variant_label}"
        else:
            layout_names[layout_id] = base_name

    return {
        # Every layout the RENDERER understands, variants included. The preview
        # coerces any layout missing from this list to the fallback layout, so
        # omitting variants here would make preview and export disagree.
        "layouts": sorted(renderable_layouts),
        # The subset a layout PICKER may offer: base layouts only. Variants are
        # switched via the variant strip, not the layout dropdown.
        "selectable_layouts": sorted(valid_layouts),
        "layout_names": layout_names,
        # Both of these stay keyed by BASE layout; clients resolve a variant to
        # its base before looking up either.
        "layouts_without_image": sorted(list(no_image_layouts)),
        "layout_prop_schema": schema,
        "layout_variants": layout_variants,
        "layout_variant_labels": variant_labels,
    }


def _sync_audio_filenames_to_order(db: Session, project: Project) -> None:
    """Rename each scene's ``scene_{order}.mp3`` audio to match its CURRENT ``order``.

    Audio files are named by ``scene.order`` (``scene_{order}.mp3``), and both the
    frontend preview and the renderer resolve a scene's voiceover from the filename
    embedded in ``voiceover_path``. When ``order`` is renumbered (add-scene, reorder)
    the files and paths are left pointing at the OLD order, so scenes end up playing
    each other's audio — and a freshly generated ``scene_{order}.mp3`` can overwrite a
    file another scene still owns. This resyncs disk + DB to the current order.

    Playback resolves a scene's audio by FILENAME and then serves the matching Asset's
    ``r2_url`` when R2 is configured, so a correct rename must move BOTH the local file
    AND the R2 object (and update ``r2_url``/``r2_key``) — renaming the local file alone
    leaves production serving stale remote audio under the old name.

    Call AFTER every scene's ``scene.order`` is set to its final value and flushed, and
    BEFORE generating any new voiceover for the current order (so the new file can't
    clobber an existing scene's audio). Renames go through a temp name first so a cyclic
    remap (e.g. 2↔3) can't overwrite a file/object that hasn't been moved yet. Best-effort:
    a per-file failure is logged and skipped rather than aborting the whole operation.
    """
    import re
    from app.models.asset import Asset, AssetType

    audio_dir = os.path.join(
        settings.MEDIA_DIR, f"projects/{project.id}/audio"
    )

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project.id, Scene.voiceover_path.isnot(None))
        .all()
    )

    # Current on-disk filename (from the path — the source of truth) → desired filename
    # for this scene's current order. Only scenes whose audio is misnamed need moving.
    plans: list[tuple[Scene, str, str]] = []  # (scene, old_filename, new_filename)
    for s in scenes:
        m = re.search(r"scene_(\d+)\.mp3", s.voiceover_path or "", re.IGNORECASE)
        if not m:
            continue
        old_filename = f"scene_{m.group(1)}.mp3"
        new_filename = f"scene_{s.order}.mp3"
        if old_filename != new_filename:
            plans.append((s, old_filename, new_filename))

    if not plans:
        return

    # Index audio assets by their current filename so we can update the matching row.
    audio_assets = (
        db.query(Asset)
        .filter(Asset.project_id == project.id, Asset.asset_type == AssetType.AUDIO)
        .all()
    )
    assets_by_filename: dict[str, list[Asset]] = {}
    for a in audio_assets:
        assets_by_filename.setdefault(a.filename, []).append(a)

    # Two-phase rename on disk (old → unique temp → new) so cyclic swaps don't collide.
    tmp_suffix = f".reorder_{int(time.time() * 1000)}.tmp"
    staged: list[tuple[Scene, str, str, str]] = []  # (scene, old, new, temp_path)
    for s, old_filename, new_filename in plans:
        old_path = os.path.join(audio_dir, old_filename)
        temp_path = os.path.join(audio_dir, old_filename + tmp_suffix)
        try:
            if os.path.exists(old_path):
                os.rename(old_path, temp_path)
                staged.append((s, old_filename, new_filename, temp_path))
            else:
                # No local file (e.g. R2-only) — still resync DB paths below.
                staged.append((s, old_filename, new_filename, ""))
        except OSError as e:
            print(f"[PROJECTS] audio resync: stage failed for {old_filename}: {e}")

    # Two-phase R2 move: copy every source object to a UNIQUE temp key first, then copy
    # temp → final. This mirrors the local temp-rename so a cyclic remap can't overwrite an
    # object still owned by another scene. Only runs when R2 is configured.
    r2_on = False
    try:
        r2_on = r2_storage.is_r2_configured()
    except Exception:
        r2_on = False
    r2_tmp_keys: dict[str, str] = {}  # old_filename -> temp key it was staged to
    if r2_on:
        tmp_prefix = f"tmp_reorder_{int(time.time() * 1000)}_"
        for s, old_filename, new_filename in plans:
            old_key = r2_storage.audio_key(project.user_id, project.id, old_filename)
            tmp_key = r2_storage.audio_key(
                project.user_id, project.id, tmp_prefix + old_filename
            )
            if r2_storage.copy_object(old_key, tmp_key) is not None:
                r2_tmp_keys[old_filename] = tmp_key

    for s, old_filename, new_filename, temp_path in staged:
        new_path = os.path.join(audio_dir, new_filename)
        if temp_path:
            try:
                os.replace(temp_path, new_path)
            except OSError as e:
                print(f"[PROJECTS] audio resync: rename to {new_filename} failed: {e}")
                continue

        # Update the scene's stored path to the new filename.
        s.voiceover_path = new_path

        # Move the R2 object (temp → final key) and capture the new public URL so playback,
        # which serves the Asset's r2_url, points at the right audio.
        new_r2_url: Optional[str] = None
        new_r2_key = r2_storage.audio_key(project.user_id, project.id, new_filename) if r2_on else None
        if r2_on and old_filename in r2_tmp_keys and new_r2_key:
            new_r2_url = r2_storage.copy_object(r2_tmp_keys[old_filename], new_r2_key)

        # Update the matching Asset row(s): filename, local_path, and R2 key/url.
        for a in assets_by_filename.get(old_filename, []):
            a.filename = new_filename
            a.local_path = new_path
            if r2_on and new_r2_key and new_r2_url:
                a.r2_key = new_r2_key
                a.r2_url = new_r2_url

    # Clean up the temp R2 objects and the now-orphaned OLD-named objects. An old key is
    # only safe to delete if no scene's FINAL filename still maps to it (i.e. it wasn't a
    # no-op destination). Since misnamed sources are all being remapped, delete each old
    # key unless it is also some scene's new_filename.
    if r2_on:
        final_filenames = {new_filename for (_s, _old, new_filename) in plans}
        # Also include filenames of scenes that did NOT need moving (already correct) so we
        # never delete an object a correctly-named scene still uses.
        for s in scenes:
            m = re.search(r"scene_(\d+)\.mp3", s.voiceover_path or "", re.IGNORECASE)
            if m:
                final_filenames.add(os.path.basename(s.voiceover_path))
        for old_filename, tmp_key in r2_tmp_keys.items():
            r2_storage.delete_object(tmp_key)
            if old_filename not in final_filenames:
                old_key = r2_storage.audio_key(project.user_id, project.id, old_filename)
                r2_storage.delete_object(old_key)

    db.flush()


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
    db.flush()

    # Audio files are named by ``scene.order``; renumbering above left each scene's file
    # and ``voiceover_path`` pointing at its OLD order, so without this resync scenes play
    # each other's voiceover after a reorder.
    _sync_audio_filenames_to_order(db, project)

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
    from app.models.user import PlanTier, AI_EDIT_CREDITS_PER_VIDEO
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

    # Cost of this edit: regenerating the voiceover is the expensive path,
    # everything else (layout swap, text rewrite) costs 1. Computed up front from the
    # request flag so the gate below can reject an unaffordable voiceover regen before
    # any work is done. Reused for the actual deduction later in this function.
    should_regenerate_voiceover = regenerate_voiceover.lower() == "true"
    edit_cost = VOICEOVER_EDIT_CREDIT_COST if should_regenerate_voiceover else 1

    # Check usage limits against the owner's per-user AI-edit credit pool (shared
    # across all their projects); PRO/STANDARD owners are unlimited (see can_use_ai_edit).
    if not can_use_ai_edit(payer, project, cost=edit_cost):
        raise HTTPException(
            status_code=403,
            detail=(
                f"AI editing limit reached. Regenerating the voiceover costs "
                f"{VOICEOVER_EDIT_CREDIT_COST} AI edits; other edits cost 1. Buy a video "
                f"for +{AI_EDIT_CREDITS_PER_VIDEO} AI edits, or upgrade for a larger "
                f"monthly allowance."
            )
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
        # Renderable, not just plannable: the scene-style strip posts visual
        # variant IDs (`news_headline__v2`) through this same field.
        valid_layouts = get_all_renderable_layouts(project.template)

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

    # When an AI instruction is given, the scene is fully regenerated according to it:
    # rewrite the narration and the title so the whole scene (not just the visuals)
    # reflects the instruction. Done BEFORE visual_description / descriptor regen so
    # those downstream calls read the updated title + narration as source of truth.
    if has_description:
        new_narration = await rewrite_narration_if_requested(
            current_narration=scene.narration_text or "",
            user_instruction=description,
            scene_title=scene.title,
        )
        if new_narration and new_narration.strip() and new_narration.strip() != (scene.narration_text or "").strip():
            old_nt = scene.narration_text
            scene.narration_text = new_narration.strip()
            track_scene_edit(
                db,
                project_id=project_id,
                scene_id=scene.id,
                field_name="narration_text",
                old_value=old_nt,
                new_value=scene.narration_text,
                is_ai_assisted=True,
                user_instruction=description,
                user_id=user.id,
                change_set_id=_regen_change_set,
            )

        from app.dspy_modules.title_edit import rewrite_title_if_requested
        new_title = await rewrite_title_if_requested(
            current_title=scene.title or "",
            narration=scene.narration_text or "",
            user_instruction=description,
        )
        if new_title and new_title.strip() and new_title.strip() != (scene.title or "").strip():
            old_title = scene.title
            scene.title = new_title.strip()
            track_scene_edit(
                db,
                project_id=project_id,
                scene_id=scene.id,
                field_name="title",
                old_value=old_title,
                new_value=scene.title,
                is_ai_assisted=True,
                user_instruction=description,
                user_id=user.id,
                change_set_id=_regen_change_set,
            )

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
        _prev_layout = descriptor.get("layout") if isinstance(descriptor, dict) else None
        # Switching between visual variants of the SAME layout (Classic ↔
        # Broadsheet) is a style toggle, not an edit: the props are unchanged
        # because variants share a schema, and no LLM call is made. Only a real
        # layout change is metered below.
        _is_style_only_switch = bool(
            isinstance(_prev_layout, str)
            and resolve_base_layout(project.template, _prev_layout)
            == resolve_base_layout(project.template, normalized_layout)
            and _prev_layout != normalized_layout
        )
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
            is_ai_assisted=not _is_style_only_switch,
            user_instruction=(
                f"Scene style switch to {normalized_layout}"
                if _is_style_only_switch
                else f"Layout switch to {normalized_layout}"
            ),
                        user_id=user.id,
                        change_set_id=_regen_change_set,
                    )
        # A layout change counts as an AI-assisted edit even though no LLM call is made.
        # Metered against the OWNER, who pays (see the gate at the top of this function).
        # A style-only switch between variants of one layout is free — nothing is
        # generated and the props are untouched.
        if not _is_style_only_switch:
            consume_ai_edit(payer, project)
        db.commit()
        print(
            f"[REGENERATE] {'Scene style' if _is_style_only_switch else 'Layout'} switch → "
            f"{normalized_layout}"
            f"{'' if _is_style_only_switch else ' (counts as AI edit)'}"
        )

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

    # With an AI instruction, regenerate a concise on-screen display text from the
    # freshly rewritten narration + visual description (reusing the same generator the
    # main pipeline uses). hide_narration still wins (blank), and a hand-typed
    # narration_text with no instruction keeps its current display_text behavior.
    if has_description and not hide_narration:
        from app.dspy_modules.display_text_gen import DisplayTextGenerator
        from app.services.language_detection import get_content_language_for_project
        try:
            dt_gen = DisplayTextGenerator(
                template_id=project.template,
                content_language=get_content_language_for_project(project),
            )
            dt_results = await dt_gen.generate_for_scenes([
                {
                    "title": scene.title or "",
                    "narration": scene.narration_text or "",
                    "visual_description": new_visual_description or "",
                }
            ])
            if dt_results and dt_results[0] and dt_results[0].strip():
                new_display_text = dt_results[0].strip()
        except Exception as e:
            print(f"[REGENERATE] display_text generation failed, keeping fallback: {e}")

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
        # The generator validates this against the plannable layout set, which has
        # no variant IDs in it — pass the base so a variant scene isn't dropped to
        # "no preferred layout". The variant itself is restored after generation.
        _preserve_variant_layout = (
            effective_layout
            if isinstance(effective_layout, str)
            and not is_custom_template(project.template)
            and resolve_base_layout(project.template, effective_layout) != effective_layout
            else None
        )
        if _preserve_variant_layout:
            effective_layout = resolve_base_layout(project.template, effective_layout)

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
        elif image and image_filename:
            # A new image was uploaded in this AI regen — bind it to the scene so the
            # descriptor actually points at it (previously the Asset was created but
            # assignedImage was never set, silently dropping the upload).
            if "layoutProps" not in descriptor:
                descriptor["layoutProps"] = {}
            lp = descriptor["layoutProps"]
            lp["assignedImage"] = image_filename
            lp["hideImage"] = False
            lp.pop("imageUrl", None)
            lp["imageFocusX"] = _clamp_image_focus((current_descriptor or {}).get("layoutProps", {}).get("imageFocusX", 50))
            lp["imageFocusY"] = _clamp_image_focus((current_descriptor or {}).get("layoutProps", {}).get("imageFocusY", 50))
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

        # Restore the scene's visual variant if the model stayed in the same
        # layout family. A regenerate is a request for new CONTENT, so the style
        # the user is looking at shouldn't shuffle underneath them. If the model
        # genuinely moved to a different layout, its choice stands.
        if _preserve_variant_layout and isinstance(descriptor.get("layout"), str):
            if descriptor["layout"] == resolve_base_layout(
                project.template, _preserve_variant_layout
            ):
                descriptor["layout"] = _preserve_variant_layout

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

    # Regenerate voiceover only if requested (should_regenerate_voiceover was
    # computed up front, alongside edit_cost, so the credit gate could pre-check it).
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
    if used_ai:
        # Voiceover regen is the expensive path, other AI edits cost 1 (see edit_cost above).
        consume_ai_edit(payer, project, cost=edit_cost)

    db.commit()

    db.refresh(scene)
    _broadcast_scene_regen(project_id, user.id)
    return scene


# Adding a scene is a heavier AI operation than an edit (it writes a whole new scene:
# narration, visuals, layout and voiceover), so it costs more AI-edit credits.
ADD_SCENE_CREDIT_COST = 5


@router.post("/{project_id}/scenes/add", response_model=AddSceneJobOut)
async def add_scene(
    project_id: int,
    data: AddSceneRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enqueue background generation of a new AI scene at a chosen position.

    The heavy generation (narration + visuals + descriptor + voiceover) runs off the
    request in a threadpool runner with up to 3 retries, so the HTTP call returns
    immediately with a job the frontend polls. Credits are reserved on enqueue and
    refunded if all attempts fail. Only one add-scene job may run per project at a
    time. Costs ``ADD_SCENE_CREDIT_COST`` AI edits, charged to the project OWNER
    (PRO/STANDARD owners are unlimited).
    """
    from app.services.access import project_owner, can_use_ai_edit, consume_ai_edit

    prompt = (data.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Please describe the scene you want to add.")

    project = _get_user_project(project_id, user.id, db)

    # One add-scene job per project at a time (avoids position/order races).
    existing = (
        db.query(ProjectAddSceneJob)
        .filter(
            ProjectAddSceneJob.project_id == project_id,
            ProjectAddSceneJob.status.in_(("queued", "running")),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="A scene is already being added to this project.")

    # Owner pays (a FREE collaborator inherits the owner's plan on a shared project).
    payer = project_owner(project, db)
    if not can_use_ai_edit(payer, project, cost=ADD_SCENE_CREDIT_COST):
        raise HTTPException(
            status_code=403,
            detail=(
                f"AI editing limit reached. Adding a scene costs {ADD_SCENE_CREDIT_COST} AI edits. "
                "Buy a video for +20 AI edits, or upgrade for a larger monthly allowance."
            ),
        )

    # Reserve the credits upfront (refunded by the runner if all attempts fail).
    consume_ai_edit(payer, project, cost=ADD_SCENE_CREDIT_COST)

    job = ProjectAddSceneJob(
        project_id=project_id,
        user_id=payer.id,
        initiated_by_user_id=user.id,
        status="queued",
        current_step="queued",
        prompt=prompt,
        position=data.position,
        cost=ADD_SCENE_CREDIT_COST,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Dispatch the sync runner on the default threadpool (pattern shared with the
    # regenerate-script / template-change / pipeline jobs).
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run_add_scene_job, job.id)

    return job


async def _generate_and_insert_scene(
    db: Session,
    project: Project,
    prompt: str,
    position: Optional[int],
    initiated_by_user_id: int,
) -> Scene:
    """Generate a new scene from ``prompt`` and insert it at ``position``.

    The full generation pipeline (outline → narration/visuals → display text →
    layout descriptor → voiceover) plus insertion + renumber. Raises on hard failure
    so the caller's retry loop can re-attempt. Does NOT charge credits or commit —
    the runner owns the transaction and credit accounting.
    """
    import json
    from app.services.edit_tracker import new_change_set_id, prune_project_history
    from app.services.language_detection import get_content_language_for_project
    from app.dspy_modules.script_gen import SceneExpander, PromptToSceneOutline
    from app.dspy_modules.display_text_gen import DisplayTextGenerator
    from app.dspy_modules.template_scene_gen import TemplateSceneGenerator
    from app.services.voiceover import generate_voiceover
    from app.services.template_service import get_hero_layout
    from app.dspy_modules import ensure_dspy_configured
    import dspy

    project_id = project.id

    # Sibling scenes for continuity context + the insert position.
    all_scenes = (
        db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.order).all()
    )
    active_scenes = [s for s in all_scenes if s.is_active]

    # Clamp the requested position into [1, active_count + 1]; default = append.
    # Re-evaluated here (not at enqueue) so it's correct against the CURRENT scene set.
    active_count = len(active_scenes)
    if position is None:
        position = active_count + 1
    else:
        position = max(1, min(int(position), active_count + 1))

    content_language = get_content_language_for_project(project)
    video_style = (getattr(project, "video_style", None) or "explainer")
    aspect_ratio = (getattr(project, "aspect_ratio", None) or "landscape")

    # Build an outline of the existing scenes so the new scene stays on-thread. Keep
    # the full narration (trimmed) so the generator can match the siblings' voice.
    outline = [
        {"title": s.title or "", "key_point": (s.narration_text or "")[:280]}
        for s in active_scenes
    ]
    # 0-based index the new scene will occupy among active scenes.
    scene_index = position - 1

    # Target narration length + duration from the siblings so the new scene matches.
    sibling_word_counts = [
        len((s.narration_text or "").split())
        for s in active_scenes
        if (s.narration_text or "").strip()
    ]
    if sibling_word_counts:
        _sorted = sorted(sibling_word_counts)
        target_words = _sorted[len(_sorted) // 2]  # median
    else:
        target_words = 20
    target_words = max(6, min(target_words, 60))  # keep within a sane band
    sibling_durations = [
        float(s.duration_seconds) for s in active_scenes
        if getattr(s, "duration_seconds", None)
    ]
    target_duration = (
        sorted(sibling_durations)[len(sibling_durations) // 2] if sibling_durations else 10
    )

    # A one-line narrative summary from the sibling titles keeps the new scene coherent
    # with the overall arc (better than just the project title).
    sibling_titles = [s.title for s in active_scenes if (s.title or "").strip()]
    narrative_summary = (
        f"{project.name or 'This video'} — covers: " + "; ".join(sibling_titles[:12])
    ).strip()

    # The user's prompt is a HARD instruction. Combine it with an explicit length target
    # (matching the siblings) so SceneExpander honours both — it treats
    # ``user_instruction_summary`` as a hard constraint.
    instruction = (
        f"{prompt}\n\n"
        f"Write the narration to roughly {target_words} words (±30%), matching the length, "
        f"tone and vocabulary of the surrounding scenes. Follow the user's request above precisely."
    )

    ensure_dspy_configured()
    blog_content = (project.blog_content or "")[:3000]

    # 1a. Turn the user's prompt (an INSTRUCTION) into a real scene title + key point.
    #     The prompt must NOT become the title or narration verbatim.
    outline_gen = dspy.asyncify(dspy.Predict(PromptToSceneOutline))
    scene_title = ""
    key_point = prompt
    try:
        o = await outline_gen(
            user_prompt=prompt,
            blog_content=blog_content,
            full_outline=json.dumps(outline),
            video_style=video_style,
            content_language=content_language,
        )
        scene_title = (getattr(o, "scene_title", "") or "").strip().rstrip(".")
        key_point = (getattr(o, "key_point", "") or "").strip() or prompt
    except Exception as e:
        print(f"[ADD_SCENE] PromptToSceneOutline failed: {e}")
    if not scene_title:
        # Last-resort title: first few words of the key point, not the raw prompt.
        scene_title = " ".join(key_point.split()[:8]).rstrip(".,") or "New scene"

    # Now include the resolved outline entry for continuity when expanding.
    outline.insert(scene_index, {"title": scene_title, "key_point": key_point})

    # 1b. Generate narration + visual description from the resolved title/key point.
    expander = dspy.asyncify(dspy.Predict(SceneExpander))
    narration = key_point
    visual_description = key_point
    try:
        res = await expander(
            blog_content=blog_content,
            full_outline=json.dumps(outline),
            narrative_summary=narrative_summary,
            scene_index=scene_index,
            total_scenes=active_count + 1,
            hero_image="",
            video_style=video_style,
            aspect_ratio=aspect_ratio,
            content_language=content_language,
            scene_title=scene_title,
            scene_key_point=key_point,
            assigned_layout="",
            is_hero=False,
            is_ending=False,
            social_platforms_detected="",
            user_instruction_summary=instruction,
            must_include="",
            must_avoid="",
        )
        narration = (getattr(res, "narration", "") or "").strip() or key_point
        visual_description = (getattr(res, "visual_description", "") or "").strip() or key_point
    except Exception as e:
        print(f"[ADD_SCENE] SceneExpander failed, falling back to key point: {e}")

    # 2. display_text (falls back to narration internally on failure).
    display_text = narration
    try:
        dt = await DisplayTextGenerator(
            project.template, video_style=video_style, content_language=content_language
        ).generate_for_scenes(
            [{"title": scene_title, "narration": narration, "visual_description": visual_description}]
        )
        if dt and dt[0]:
            display_text = dt[0]
    except Exception as e:
        print(f"[ADD_SCENE] DisplayTextGenerator failed, using narration: {e}")

    # 3. Insert the new row and renumber the whole set (active + inactive) uniquely,
    #    mirroring reorder_scenes so ``order`` stays 1..N with no collisions. The new
    #    scene is spliced into the ACTIVE sequence at ``position``; inactive scenes keep
    #    their relative position by anchoring to the active scene they currently follow.
    new_scene = Scene(
        project_id=project.id,
        order=0,  # set below during renumber
        title=scene_title,
        narration_text=narration,
        visual_description=visual_description,
        display_text=display_text,
        # Seed with the siblings' typical duration; generate_voiceover overwrites this
        # with the real audio length when the project has voiceover enabled.
        duration_seconds=target_duration,
        preferred_layout=None,
        scene_type="content",
        is_active=True,
    )
    db.add(new_scene)
    db.flush()  # assign an id so it can be referenced/anchored

    anchor_after: dict[int, list[Scene]] = {}
    last_active_id = 0
    for s in all_scenes:
        if s.is_active:
            last_active_id = s.id
        else:
            anchor_after.setdefault(last_active_id, []).append(s)

    active_ordered = list(active_scenes)
    active_ordered.insert(scene_index, new_scene)

    sequenced: list[Scene] = list(anchor_after.get(0, []))
    for a in active_ordered:
        sequenced.append(a)
        sequenced.extend(anchor_after.get(a.id, []))
    for i, s in enumerate(sequenced, 1):
        s.order = i
    db.flush()

    # Renumbering shifted existing scenes' ``order`` but their audio files/paths still
    # carry the OLD order. Resync them BEFORE generating the new scene's voiceover so its
    # ``scene_{order}.mp3`` can't overwrite an existing scene's audio (the new scene has
    # no voiceover_path yet, so it is untouched here).
    _sync_audio_filenames_to_order(db, project)

    # A manually added scene is always a CONTENT scene — it must never get the
    # hero/opening layout or a CTA/ending-socials layout, even when inserted at
    # position 1 or last. But rather than always forcing the same fallback layout,
    # let the AI CHOOSE a layout that fits the content AND differs from the sibling
    # scenes (variety), then reject any excluded pick.
    def _is_excluded_layout(template_id: str, name: str) -> bool:
        n = (name or "").strip().lower()
        if not n or n == "unknown":
            return True
        hero = None
        try:
            hero = (get_hero_layout(template_id) or "").strip().lower()
        except Exception:
            hero = None
        if hero and n == hero:
            return True
        return any(tok in n for tok in ("hero", "intro", "outro", "ending", "cta", "social", "opening"))

    def _content_layout_candidates(template_id: str) -> list[str]:
        """Valid, non-excluded content layouts (normalized lowercase)."""
        try:
            valid = get_valid_layouts(template_id)
        except Exception:
            valid = set()
        return sorted(
            {v.strip().lower() for v in valid if not _is_excluded_layout(template_id, v)}
        )

    def _fallback_content_layout(template_id: str, avoid: set[str]) -> str | None:
        """A safe content layout, preferring one not in ``avoid`` (the neighbours)."""
        candidates = _content_layout_candidates(template_id)
        if not candidates:
            return None
        for c in candidates:
            if c not in avoid:
                return c
        return candidates[0]

    # Never let the descriptor generator treat this as scene 0 (hero). Use max(1, index).
    descriptor_scene_index = max(1, new_scene.order - 1)

    # Layouts already used by the OTHER scenes — so the AI (and the fallback) can avoid
    # repeating them. Also track the immediate neighbours to enforce local variety.
    def _layout_of(s: Scene) -> str:
        if not s.remotion_code:
            return "unknown"
        try:
            d = json.loads(s.remotion_code)
        except (json.JSONDecodeError, TypeError):
            return "unknown"
        if "layoutConfig" in d:
            return (d["layoutConfig"].get("arrangement") or "unknown")
        return (d.get("layout") or "unknown")

    other_layout_parts = []
    neighbour_layouts: set[str] = set()
    for s in active_ordered:
        if s.id == new_scene.id:
            continue
        ln = _layout_of(s)
        other_layout_parts.append(f"scene {s.order}: {ln}")
        # Immediate neighbours of the new scene (one before / one after).
        if abs((s.order or 0) - new_scene.order) == 1:
            neighbour_layouts.add((ln or "").strip().lower())
    other_scenes_layouts = ", ".join(other_layout_parts)

    # 4. Build the layout descriptor (custom templates re-extract structured content;
    #    built-in templates let the AI pick a varied, content-appropriate layout).
    template_gen = TemplateSceneGenerator(project.template)
    try:
        if is_custom_template(project.template):
            # Custom templates: let the AI pick an ARRANGEMENT that fits the content and
            # avoids repeating the siblings (variety), rather than leaving layoutConfig
            # empty (which made every added scene default to the same renderer layout).
            from app.dspy_modules.template_scene_gen import VALID_ARRANGEMENTS
            descriptor = await template_gen.generate_regenerate_descriptor(
                scene_title=scene_title,
                narration=narration,
                visual_description=visual_description,
                scene_index=descriptor_scene_index,
                total_scenes=len(active_ordered),
                other_scenes_layouts=other_scenes_layouts,
                preferred_layout=None,
                current_descriptor=None,
                content_language=content_language,
            )
            # Guardrail: if the AI repeated a neighbour's arrangement (or returned none),
            # force an arrangement the neighbours aren't using.
            lc = descriptor.get("layoutConfig") if isinstance(descriptor, dict) else None
            chosen_arr = ((lc or {}).get("arrangement") or "").strip().lower()
            if not chosen_arr or chosen_arr in neighbour_layouts:
                alt = next(
                    (a for a in sorted(VALID_ARRANGEMENTS) if a not in neighbour_layouts),
                    None,
                )
                if alt:
                    if not isinstance(descriptor, dict):
                        descriptor = {}
                    descriptor.setdefault("layoutConfig", {})
                    descriptor["layoutConfig"]["arrangement"] = alt
        else:
            # preferred_layout empty → the regenerate signature chooses the best layout
            # that fits the content and avoids repeating other_scenes_layouts.
            descriptor = await template_gen.generate_regenerate_descriptor(
                scene_title=scene_title,
                narration=narration,
                visual_description=visual_description,
                scene_index=descriptor_scene_index,
                total_scenes=len(active_ordered),
                other_scenes_layouts=other_scenes_layouts,
                preferred_layout=None,
                current_descriptor=None,
                content_language=content_language,
            )
            # Guardrail: the AI may still return an excluded (hero/intro/outro/cta) or a
            # neighbour-duplicate layout. In that case force a varied content layout.
            chosen = (descriptor.get("layout") or "").strip().lower() if isinstance(descriptor, dict) else ""
            if (
                not chosen
                or _is_excluded_layout(project.template, chosen)
                or chosen in neighbour_layouts
            ):
                forced = _fallback_content_layout(project.template, neighbour_layouts)
                if forced:
                    descriptor = await template_gen.generate_scene_descriptor(
                        scene_title=scene_title,
                        narration=narration,
                        visual_description=visual_description,
                        scene_index=descriptor_scene_index,
                        total_scenes=len(active_ordered),
                        preferred_layout=forced,
                        content_language=content_language,
                    )
        new_scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))
    except Exception as e:
        print(f"[ADD_SCENE] descriptor generation failed: {e}")
        # Leave remotion_code null; the renderer falls back to a default layout.

    # 5. Voiceover — only when the project has audio enabled. generate_voiceover names
    #    the file scene_{order}.mp3; the new scene's order is unique, and existing
    #    scenes read their own stored voiceover_path, so no audio is disturbed.
    if getattr(project, "voice_gender", None) != "none":
        try:
            generate_voiceover(new_scene, db)
        except Exception as e:
            print(f"[ADD_SCENE] voiceover generation failed (scene still added): {e}")

    # History: a project-level "scene_added" entry (mirrors "scene_deleted") so it
    # shows in Global Edits and can be reverted (revert soft-deletes the added scene).
    # Credits, commit and broadcast are the runner's responsibility.
    _add_change_set = new_change_set_id()
    track_project_edit(
        db,
        project_id=project_id,
        field_name="scene_added",
        old_value=json.dumps({"scene_id": new_scene.id, "is_active": False, "title": scene_title}),
        new_value=json.dumps({"scene_id": new_scene.id, "is_active": True, "title": scene_title}),
        user_id=initiated_by_user_id,
        change_set_id=_add_change_set,
    )
    prune_project_history(db, project.id)

    return new_scene


# Number of times the background add-scene generation is retried before giving up.
ADD_SCENE_MAX_ATTEMPTS = 3


def _run_add_scene_job(job_id: int) -> None:
    """Threadpool runner: generate + insert a scene for a queued add-scene job.

    Retries the whole generation up to ``ADD_SCENE_MAX_ATTEMPTS`` times. On success
    the scene is committed and the job marked completed. If every attempt fails, the
    reserved credits are refunded and the job is marked failed (guarded so a repeated
    call can't double-refund). Opens its own DB session — never shares the request's.
    """
    import time

    db = SessionLocal()
    try:
        job = db.query(ProjectAddSceneJob).filter(ProjectAddSceneJob.id == job_id).first()
        if not job or job.status not in ("queued", "running"):
            return
        project = db.query(Project).filter(Project.id == job.project_id).first()
        if not project:
            _finalize_add_scene_failure(db, job, "Project not found")
            return

        # Read scalars into locals — commit()/rollback() across asyncio.run() can
        # expire the ORM objects in this executor-thread context.
        job_project_id = job.project_id
        job_prompt = job.prompt
        job_position = job.position
        job_initiated_by = job.initiated_by_user_id or job.user_id

        job.status = "running"
        job.current_step = "generating"
        db.commit()

        last_error: Optional[Exception] = None
        for attempt in range(1, ADD_SCENE_MAX_ATTEMPTS + 1):
            # Re-fetch fresh each attempt; a prior failed attempt was rolled back.
            job = db.query(ProjectAddSceneJob).filter(ProjectAddSceneJob.id == job_id).first()
            project = db.query(Project).filter(Project.id == job_project_id).first()
            if not job or not project:
                return
            job.attempts = attempt
            db.commit()
            try:
                new_scene = asyncio.run(
                    _generate_and_insert_scene(
                        db, project, job_prompt, job_position, job_initiated_by,
                    )
                )
                db.commit()
                new_scene_id = new_scene.id

                job = db.query(ProjectAddSceneJob).filter(ProjectAddSceneJob.id == job_id).first()
                job.status = "completed"
                job.current_step = "completed"
                job.new_scene_id = new_scene_id
                job.completed_at = datetime.utcnow()
                db.commit()

                # Structural change — collaborators re-sync their scene list.
                try:
                    from app.routers.collab_ws import broadcast_project_reload
                    broadcast_project_reload(job_project_id, exclude_user_id=job_initiated_by)
                except Exception as e:
                    print(f"[ADD_SCENE] broadcast failed for project {job_project_id}: {e}")
                return
            except Exception as e:  # noqa: BLE001 — retry on any generation failure
                last_error = e
                print(f"[ADD_SCENE] attempt {attempt}/{ADD_SCENE_MAX_ATTEMPTS} failed for job {job_id}: {e}")
                db.rollback()
                if attempt < ADD_SCENE_MAX_ATTEMPTS:
                    time.sleep(2 * attempt)  # brief backoff

        job = db.query(ProjectAddSceneJob).filter(ProjectAddSceneJob.id == job_id).first()
        if job:
            _finalize_add_scene_failure(db, job, str(last_error) if last_error else "Scene generation failed")
    except Exception as e:  # noqa: BLE001 — never let the runner crash silently
        print(f"[ADD_SCENE] runner crashed for job {job_id}: {e}")
        try:
            db.rollback()
            job = db.query(ProjectAddSceneJob).filter(ProjectAddSceneJob.id == job_id).first()
            if job:
                _finalize_add_scene_failure(db, job, str(e))
        except Exception:
            pass
    finally:
        db.close()


def _finalize_add_scene_failure(db: Session, job: ProjectAddSceneJob, message: str) -> None:
    """Mark an add-scene job failed and refund its reserved credits (once).

    Guarded on ``status != "failed"`` so a crash-recovery re-entry can't double-refund
    (mirrors ``_mark_regenerate_script_failed``).
    """
    from app.services.access import refund_ai_edit

    if job.status == "failed":
        return
    job.status = "failed"
    job.current_step = "failed"
    job.error_message = (message or "Scene generation failed")[:2000]
    job.completed_at = datetime.utcnow()

    # Refund the reserved AI-edit credits to the payer (no-op for PRO/STANDARD).
    try:
        payer = db.query(User).filter(User.id == job.user_id).first()
        project = db.query(Project).filter(Project.id == job.project_id).first()
        if payer is not None and project is not None and (job.cost or 0) > 0:
            refund_ai_edit(payer, project, cost=job.cost)
    except Exception as e:
        print(f"[ADD_SCENE] refund failed for job {job.id}: {e}")

    db.commit()

    # Tell collaborators to re-sync (the placeholder disappears).
    try:
        from app.routers.collab_ws import broadcast_project_reload
        broadcast_project_reload(job.project_id, exclude_user_id=job.initiated_by_user_id)
    except Exception:
        pass


@router.get("/{project_id}/scenes/add-status", response_model=Optional[AddSceneJobOut])
async def get_add_scene_status(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Latest add-scene job for this project (for the frontend poller). None if never run."""
    _get_user_project(project_id, user.id, db)
    job = (
        db.query(ProjectAddSceneJob)
        .filter(ProjectAddSceneJob.project_id == project_id)
        .order_by(ProjectAddSceneJob.id.desc())
        .first()
    )
    return job


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
