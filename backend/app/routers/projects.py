import asyncio
import json
import logging
import os
import shutil
import time
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.auth import get_current_user
from app.config import settings
from app.models.user import User, PlanTier
from app.models.project import Project, ProjectStatus
from app.models.review import Review
from app.models.scene import Scene
from app.models.project_template_change_job import ProjectTemplateChangeJob
from app.schemas.schemas import (
    ProjectCreate, ProjectOut, ProjectListOut, ProjectLogoUpdate,
    BulkProjectItem, BulkCreateResponse,
    ReviewOut, ReviewStateOut, ReviewSubmit, ReviewSubmitResponse, SceneOut,
    SceneUpdate, ReorderScenesRequest, RegenerateSceneRequest,
    SceneTypographyBulkUpdate, ProjectUpdate, ProjectTemplateChangeRequest,
    ProjectTemplateChangeJobOut,
)
from app.services import r2_storage
from app.services.remotion import (
    safe_remove_workspace,
    get_workspace_dir,
    cancel_running_render,
)
from app.services.doc_extractor import extract_from_documents
from app.services.template_service import validate_template_id, get_preview_colors, get_valid_layouts, get_layouts_without_image, is_custom_template, _load_custom_template_data, get_meta
from app.services.edit_tracker import track_project_edit, track_scene_edit
from app.services.language_detection import normalize_preferred_language_code
from app.services.social_content_signals import detect_social_platforms_in_text
from app.scene_cta import strip_b2v_cta_from_visual
from app.observability.logging import get_logger

router = APIRouter(prefix="/api/projects", tags=["projects"])
logger = get_logger(__name__)


def _inject_custom_theme(project: Project, db: Session | None = None) -> Project:
    """Attach custom_theme to a project so ProjectOut serialization includes it."""
    if is_custom_template(project.template):
        data = _load_custom_template_data(project.template, db=db)
        project.custom_theme = data["theme"] if data else None
        project.custom_template_missing = data is None
    else:
        project.custom_theme = None
        project.custom_template_missing = False
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
    _inject_custom_theme(project)
    project.review_state = _build_review_state(project, user, db)
    return project

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
}
_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".md", ".markdown", ".txt"}
_VALID_VIDEO_STYLES = {"explainer", "promotional", "storytelling"}
_VALID_VIDEO_LENGTHS = {"auto", "short", "medium", "detailed"}
_ACTIVE_TEMPLATE_CHANGE_STATUSES = {"queued", "running"}


def _sanitize_data_viz_layout_props(layout: str | None, layout_props: dict | None) -> dict:
    props = dict(layout_props or {})
    if (layout or "").strip().lower().replace("-", "_") != "data_visualization":
        return props
    for key in ("lineChartLabels", "lineChartDatasets", "barChartRows", "histogramRows"):
        props.pop(key, None)
    return props


def _sanitize_descriptor_for_data_viz(descriptor: dict | None) -> dict:
    out = dict(descriptor or {})
    layout = out.get("layout")
    layout_props = out.get("layoutProps") if isinstance(out.get("layoutProps"), dict) else {}
    out["layoutProps"] = _sanitize_data_viz_layout_props(
        layout=str(layout) if layout is not None else "",
        layout_props=layout_props,
    )
    return out


def _normalize_video_style(video_style: str | None) -> str:
    """Normalize and validate video style."""
    style = (video_style or "").strip().lower()
    if not style:
        return "explainer"
    if style not in _VALID_VIDEO_STYLES:
        raise HTTPException(
            status_code=422,
            detail="video_style must be one of: explainer, promotional, storytelling",
        )
    return style


def _normalize_video_length(video_length: str | None) -> str:
    """Normalize and validate video_length stored on Project."""
    raw = (video_length or "").strip().lower()
    if not raw:
        return "auto"
    if raw not in _VALID_VIDEO_LENGTHS:
        raise HTTPException(
            status_code=422,
            detail="video_length must be one of: auto, short, medium, detailed",
        )
    return raw


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
    from app.services.remotion import rebuild_workspace

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
        db.commit()

        target_template = job.target_template
        layout_planner = TemplateLayoutPlanner(target_template)
        template_gen = TemplateSceneGenerator(target_template)
        supports_ending_socials = "ending_socials" in get_valid_layouts(target_template)
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
                job.processed_scenes = idx + 1
                db.commit()
        else:
            last_scene_idx = len(scenes) - 1
            for idx, scene in enumerate(scenes):
                preferred_layout = (
                    preferred_layouts[idx].strip()
                    if idx < len(preferred_layouts) and isinstance(preferred_layouts[idx], str)
                    else ""
                )
                if supports_ending_socials and idx == last_scene_idx:
                    preferred_layout = "ending_socials"
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
                if supports_ending_socials and idx == last_scene_idx:
                    new_descriptor = {
                        "layout": "ending_socials",
                        "layoutProps": _build_ending_socials_props(project, scene),
                    }

                new_descriptor = _sanitize_descriptor_for_data_viz(new_descriptor)
                scene.remotion_code = json.dumps(new_descriptor)
                descriptor_layout = _extract_layout_from_descriptor_obj(
                    descriptor=new_descriptor,
                    template_id=target_template,
                )
                scene.preferred_layout = descriptor_layout or (preferred_layout or None)
                job.processed_scenes = idx + 1
                db.commit()

        project.template = target_template
        template_colors = get_preview_colors(target_template) or {}
        if isinstance(template_colors, dict):
            project.accent_color = template_colors.get("accent") or project.accent_color
            project.bg_color = template_colors.get("bg") or project.bg_color
            project.text_color = template_colors.get("text") or project.text_color
        project.status = ProjectStatus.GENERATED
        project.r2_video_key = None
        project.r2_video_url = None
        db.commit()

        # Rebuild workspace with updated descriptors.
        rebuild_workspace(project, scenes, db)

        job.status = "completed"
        job.completed_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        logger.exception("[PROJECT_TEMPLATE_CHANGE] job=%s failed: %s", job_id, e)
        job = db.query(ProjectTemplateChangeJob).filter(ProjectTemplateChangeJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


@router.post("", response_model=ProjectOut)
def create_project(
    data: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project from a blog URL. Counts against video limit."""
    user.sync_video_limit_bonus(db)
    if not user.can_create_video:
        raise HTTPException(
            status_code=403,
            detail=f"Video limit reached. Upgrade your subscription.",
        )

    if not data.blog_url:
        raise HTTPException(status_code=400, detail="blog_url is required for URL-based project creation.")

    name = data.name or _name_from_url(data.blog_url)
    template_id = validate_template_id(data.template)
    if is_custom_template(template_id) and user.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        raise HTTPException(
            status_code=403,
            detail="Custom templates require a Pro or Standard subscription. Upgrade to use your custom theme.",
        )
    colors = get_preview_colors(template_id)
    normalized_video_style = _normalize_video_style(data.video_style)
    project = Project(
        user_id=user.id,
        name=name,
        blog_url=data.blog_url,
        template=template_id,
        voice_gender=data.voice_gender or "female",
        voice_accent=_normalize_voice_accent_for_db(data.voice_accent),
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
        content_language=normalize_preferred_language_code(data.content_language),
        status=ProjectStatus.CREATED,
    )
    db.add(project)

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
        if field == "font_family":
            update_data[field] = value  # allow nulling or changing
        elif field == "content_language":
            update_data[field] = normalize_preferred_language_code(value) if value is not None else None
        elif field == "video_length":
            update_data[field] = _normalize_video_length(value)
        else:
            if value is not None:
                update_data[field] = value

    for field, value in update_data.items():
        old_value = getattr(project, field)

        track_project_edit(
            db,
            project_id=project.id,
            field_name=field,
            old_value=old_value,
            new_value=value,
            is_ai_assisted=False,
        )

        setattr(project, field, value)

    db.commit()
    db.refresh(project)
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
    user.sync_video_limit_bonus(db)
    if not user.can_create_video:
        raise HTTPException(
            status_code=403,
            detail=f"Video limit reached ({user.video_limit}). Upgrade to continue regenerating videos.",
        )
    target_template = validate_template_id(body.template)
    if target_template == project.template:
        raise HTTPException(status_code=400, detail="Project is already using this template.")
    if is_custom_template(target_template) and user.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        raise HTTPException(
            status_code=403,
            detail="Custom templates require a Pro or Standard subscription.",
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

    total_scenes = db.query(Scene).filter(Scene.project_id == project.id).count()
    job = ProjectTemplateChangeJob(
        project_id=project.id,
        user_id=user.id,
        target_template=target_template,
        status="queued",
        total_scenes=total_scenes,
        processed_scenes=0,
    )
    db.add(job)
    user.videos_used_this_period += 1
    # Surface "generating" state during relayout via existing status pipeline.
    project.status = ProjectStatus.GENERATING
    db.commit()
    db.refresh(job)

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
    if user.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        for data in items:
            tid = getattr(data, "template", None) or ""
            if tid and str(tid).strip().startswith("custom_"):
                raise HTTPException(
                    status_code=403,
                    detail="Custom templates require a Pro or Standard subscription. Upgrade to use your custom theme.",
                )
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
        template_id = validate_template_id(data.template)
        colors = get_preview_colors(template_id)
        normalized_video_style = _normalize_video_style(data.video_style)
        project = Project(
            user_id=user.id,
            name=name,
            blog_url=data.blog_url.strip(),
            template=template_id,
            voice_gender=data.voice_gender or "female",
            voice_accent=_normalize_voice_accent_for_db(data.voice_accent),
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
            content_language=normalize_preferred_language_code(data.content_language),
            status=ProjectStatus.CREATED,
        )
        db.add(project)
        db.flush()
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
    aspect_ratio: Optional[str] = Form("landscape"),
    template: Optional[str] = Form(None),
    video_style: Optional[str] = Form("explainer"),
    video_length: Optional[str] = Form("auto"),
    content_language: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project from uploaded documents (PDF, DOCX, PPTX, MD, TXT). Counts against video limit."""
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
                detail=f"File '{f.filename}' is not supported. Accepted formats: PDF, DOCX, PPTX, MD, TXT.",
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
    template_id = validate_template_id(template)
    if is_custom_template(template_id) and user.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        raise HTTPException(
            status_code=403,
            detail="Custom templates require a Pro or Standard subscription. Upgrade to use your custom theme.",
        )
    colors = get_preview_colors(template_id)
    normalized_video_style = _normalize_video_style(video_style)
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
        voice_gender=voice_gender or "female",
        voice_accent=_normalize_voice_accent_for_db(voice_accent),
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
        content_language=normalize_preferred_language_code(content_language),
        status=ProjectStatus.CREATED,
    )
    db.add(project)
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
        project.status = ProjectStatus.ERROR
        db.commit()
        raise HTTPException(status_code=500, detail=f"Document extraction failed: {str(e)}")

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
                detail=f"File '{f.filename}' is not supported. Accepted formats: PDF, DOCX, PPTX, MD, TXT.",
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
        project.status = ProjectStatus.ERROR
        db.commit()
        raise HTTPException(status_code=500, detail=f"Document extraction failed: {str(e)}")

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


@router.get("", response_model=list[ProjectListOut])
def list_projects(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all projects for the current user. Single query with scene count subquery."""
    scene_counts = (
        db.query(Scene.project_id, func.count(Scene.id).label("cnt"))
        .group_by(Scene.project_id)
        .subquery()
    )
    rows = (
        db.query(
            Project,
            func.coalesce(scene_counts.c.cnt, 0).label("scene_count"),
        )
        .outerjoin(scene_counts, Project.id == scene_counts.c.project_id)
        .filter(Project.user_id == user.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    return [
        ProjectListOut(
            id=p.id,
            name=p.name,
            blog_url=p.blog_url,
            status=p.status.value,
            created_at=p.created_at,
            updated_at=p.updated_at,
            scene_count=int(scene_count),
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
    """Delete a project and all related data (local + R2 storage)."""
    project = _get_user_project(project_id, user.id, db)

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

    # Delete R2 files
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

    # If this is an image, clear assignedImage from scenes that reference it
    # and mark those scenes as hideImage=true so they won't get a new generic
    # image auto-assigned later.
    if asset.asset_type.value == "image":
        deleted_filename = asset.filename
        scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
        scenes_updated = False
        
        for scene in scenes:
            if not scene.remotion_code:
                continue
            
            try:
                desc = json.loads(scene.remotion_code)
                layout_props = desc.get("layoutProps", {}) or {}
                assigned_image = layout_props.get("assignedImage")
                
                # If this scene has the deleted image assigned, clear it and lock it to no image
                if assigned_image == deleted_filename:
                    layout_props.pop("assignedImage", None)
                    layout_props["hideImage"] = True
                    desc["layoutProps"] = layout_props
                    scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(desc))
                    scenes_updated = True
            except (json.JSONDecodeError, TypeError):
                continue
        
        if scenes_updated:
            db.commit()

    local_path = asset.local_path
    r2_key = asset.r2_key

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

    # Rebuild workspace so data.json reflects the deleted asset and
    # updated hideImage flags immediately.
    try:
        from app.services.remotion import rebuild_workspace
        project = _get_user_project(project_id, user.id, db)
        all_scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.order)
            .all()
        )
        rebuild_workspace(project, all_scenes, db)
    except Exception as e:
        logger.warning(
            "[PROJECTS] Warning: workspace rebuild after asset deletion failed for project %s: %s",
            project_id,
            e,
            extra={"project_id": project_id, "user_id": user.id},
        )

    return {"detail": "Asset deleted"}


MANUAL_TRACKED_FIELDS = {
    "title",
    "display_text",
    "remotion_code",
    "narration_text",
    "extra_hold_seconds",
}


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
    from app.services.remotion import write_remotion_data

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
    for key, value in update_data.items():
        if key not in MANUAL_TRACKED_FIELDS:
            continue

        if key == "remotion_code" and isinstance(value, str) and value.strip():
            try:
                parsed_descriptor = json.loads(value)
                if isinstance(parsed_descriptor, dict):
                    value = json.dumps(_sanitize_descriptor_for_data_viz(parsed_descriptor))
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
        )

        setattr(scene, key, value)

    db.commit()
    db.refresh(scene)

    # Keep remotion-workspace in sync so preview/render use latest props
    try:
        scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.order)
            .all()
        )
        write_remotion_data(project, scenes, db)
    except Exception as e:
        print(f"[PROJECTS] Warning: Failed to write remotion data after scene update: {e}")

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
    from app.services.remotion import write_remotion_data
    import json

    project = _get_user_project(project_id, user.id, db)

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order)
        .all()
    )

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
                    )
        scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))

    db.commit()

    # Refresh and sync remotion workspace once after all updates
    for scene in scenes:
        db.refresh(scene)

    try:
        write_remotion_data(project, scenes, db)
    except Exception as e:
        print(f"[PROJECTS] Warning: Failed to write remotion data after bulk typography update: {e}")

    return scenes


@router.delete("/{project_id}/scenes/{scene_id}", status_code=204)
def delete_scene(
    project_id: int,
    scene_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a scene and renumber remaining scenes. Rebuilds Remotion workspace."""
    from app.services.remotion import rebuild_workspace

    project = _get_user_project(project_id, user.id, db)

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    db.delete(scene)
    db.commit()

    remaining = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order)
        .all()
    )
    for i, s in enumerate(remaining, 1):
        s.order = i
    db.commit()
    for s in remaining:
        db.refresh(s)

    try:
        rebuild_workspace(project, remaining, db)
    except Exception as e:
        print(f"[PROJECTS] Warning: Failed to rebuild workspace after scene delete for project {project_id}: {e}")

    return None


@router.post("/{project_id}/scenes/{scene_id}/generate-image")
def generate_scene_image(
    project_id: int,
    scene_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate an AI image for the scene from its title + narration. Returns base64 image and refined prompt.
    No DB write; use POST .../image to upload the image when the user chooses to keep it.
    Pro plan only. Image size/aspect is chosen from the scene's layout so the image fits without clipping."""
    import json
    from app.models.scene import Scene
    from app.models.user import PlanTier
    from app.dspy_modules.image_prompt import refine_image_prompt
    from app.services.image_gen import get_image_provider
    from app.services.image_dimensions import (
        get_image_aspect_for_layout,
        get_openai_size,
        get_gemini_image_config,
    )
    from app.services.template_service import get_fallback_layout

    if user.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        raise HTTPException(
            status_code=403,
            detail="AI image generation is available on the Pro or Standard plan. Upgrade to unlock.",
        )

    project = _get_user_project(project_id, user.id, db)
    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    scene_text = f"{scene.title or ''} {scene.narration_text or ''}".strip()
    if not scene_text:
        raise HTTPException(
            status_code=400,
            detail="Scene has no title or narration text to use as prompt.",
        )

    try:
        provider = get_image_provider()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not provider:
        raise HTTPException(
            status_code=503,
            detail="Image generation not configured. Set IMAGE_PROVIDER and the corresponding API key (OPENAI_API_KEY or GEMINI_API_KEY)",
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
    else:
        gemini_config = get_gemini_image_config(aspect_ratio)
        gen_kwargs = {"generation_config": gemini_config}
        logger.info(
            "[GENERATE_IMAGE] provider=gemini layout=%r template=%r project_aspect=%r image_aspect=%r aspect_ratio=%s image_size=%s",
            layout_id, project.template, project_aspect, aspect_ratio,
            gemini_config.get("aspect_ratio"), gemini_config.get("image_size"),
        )

    refined_prompt = refine_image_prompt(scene_text)
    try:
        image_base64 = provider.generate(refined_prompt, **gen_kwargs)
    except Exception as e:
        print(f"[GENERATE_IMAGE] Provider error: {e}")
        raise HTTPException(status_code=502, detail=f"Image generation failed: {e}") from e

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
    If the scene already had an image assigned (generic or scene-specific), that asset
    is deleted so it does not remain in the project."""
    import json
    from app.models.scene import Scene
    from app.models.asset import Asset, AssetType
    from app.services.remotion import rebuild_workspace

    project = _get_user_project(project_id, user.id, db)

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    # If scene already has an image assigned, delete that asset (generic or scene-specific)
    old_assigned = None
    if scene.remotion_code:
        try:
            desc = json.loads(scene.remotion_code)
            old_assigned = (desc.get("layoutProps") or {}).get("assignedImage")
        except (json.JSONDecodeError, TypeError):
            pass
    if old_assigned and isinstance(old_assigned, str):
        old_asset = (
            db.query(Asset)
            .filter(Asset.project_id == project_id, Asset.filename == old_assigned)
            .first()
        )
        if old_asset:
            local_path = old_asset.local_path
            r2_key = old_asset.r2_key
            db.delete(old_asset)
            db.flush()
            if local_path and os.path.isfile(local_path):
                try:
                    os.remove(local_path)
                except OSError as e:
                    print(f"[IMAGE_UPDATE] Failed to remove old file {local_path}: {e}")
            if r2_key:
                try:
                    r2_storage.delete_file(r2_key)
                except Exception as e:
                    print(f"[IMAGE_UPDATE] R2 delete failed for {r2_key}: {e}")

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

    if "layoutProps" not in descriptor:
        descriptor["layoutProps"] = {}
    descriptor["layoutProps"]["assignedImage"] = image_filename
    descriptor["layoutProps"].pop("hideImage", None)
    scene.remotion_code = json.dumps(_sanitize_descriptor_for_data_viz(descriptor))

    # Keep project.status and r2_video_* as-is: the exported MP4 stays available until the user
    # runs a new render (render pipeline replaces URLs/keys on success).

    db.commit()
    db.refresh(scene)

    try:
        rebuild_workspace(project, list(project.scenes), db)
    except Exception as e:
        print(f"[IMAGE_UPDATE] Warning: Failed to rebuild workspace: {e}")

    return scene


@router.get("/{project_id}/layouts")
def get_project_layouts(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get valid layouts for a project's template."""
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
    """Reorder scenes by updating their order values."""
    from app.models.scene import Scene
    from app.services.remotion import rebuild_workspace
    
    project = _get_user_project(project_id, user.id, db)
    
    # Get all scenes for this project
    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    scene_map = {s.id: s for s in scenes}
    
    # Validate all scene_ids belong to project
    for item in data.scene_orders:
        if item.scene_id not in scene_map:
            raise HTTPException(status_code=404, detail=f"Scene {item.scene_id} not found")
    
    # Update orders
    for item in data.scene_orders:
        scene_map[item.scene_id].order = item.order
    
    # Ensure sequential ordering (1, 2, 3...)
    sorted_scenes = sorted(scenes, key=lambda s: s.order)
    for i, scene in enumerate(sorted_scenes, 1):
        scene.order = i
    
    db.commit()
    
    # Refresh all scenes
    for scene in sorted_scenes:
        db.refresh(scene)

    # Ensure the per-project Remotion workspace reflects the new order
    # (rendering uses the workspace files; without this, renders can use stale data.json/audio copies)
    try:
        rebuild_workspace(project, sorted_scenes, db)
    except Exception as e:
        # Don't fail the reorder if workspace rebuild fails; UI can still reflect DB order.
        print(f"[PROJECTS] Warning: Failed to rebuild workspace after reorder for project {project_id}: {e}")
    
    return sorted_scenes


@router.post("/{project_id}/scenes/{scene_id}/regenerate", response_model=SceneOut)
async def regenerate_scene(
    project_id: int,
    scene_id: int,
    description: Optional[str] = Form(None),
    narration_text: Optional[str] = Form(None),
    regenerate_voiceover: str = Form("false"),
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
    from app.services.remotion import rebuild_workspace
    
    project = _get_user_project(project_id, user.id, db)
    
    # Check usage limits
    if user.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        if project.ai_assisted_editing_count >= 3:
            raise HTTPException(
                status_code=403,
                detail="AI editing limit reached (3 uses per project). Upgrade to Pro or Standard for unlimited AI edits."
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

    # Detect variant switch for custom templates (intro/content_N/outro)
    # Pure variant switches skip the AI call entirely — instant layout change.
    is_variant_switch = False
    if is_custom_template(project.template) and normalized_layout:
        import re as _re
        if normalized_layout in ("intro", "outro") or _re.match(r"content_\d+$", normalized_layout):
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
            is_ai_assisted=False,
            user_instruction=f"Variant switch to {normalized_layout}",
        )
        db.commit()
        print(f"[REGENERATE] Variant switch → {normalized_layout} (no AI call)")

        # Rebuild workspace and return
        scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.order).all()
        rebuild_workspace(project, scenes, db)
        db.refresh(scene)
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

        print(f"[REGENERATE] template={project.template}, is_custom={is_custom_template(project.template)}")
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
            descriptor["layoutProps"]["hideImage"] = True
            descriptor["layoutProps"].pop("imageUrl", None)
            descriptor["layoutProps"].pop("assignedImage", None)
        elif not image and current_descriptor:
            old_lp = current_descriptor.get("layoutProps") or {}
            if "layoutProps" not in descriptor:
                descriptor["layoutProps"] = {}
            old_assigned = old_lp.get("assignedImage")
            if old_assigned:
                descriptor["layoutProps"]["assignedImage"] = old_assigned
            if old_lp.get("hideImage"):
                descriptor["layoutProps"]["hideImage"] = True

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
                        )
        db.commit()

    # Regenerate voiceover only if requested
    should_regenerate_voiceover = regenerate_voiceover.lower() == "true"
    # Voiceover should continue to be based on the underlying narration_text script,
    # not the shorter display_text.
    narration_source = (scene.narration_text or "").strip()
    if should_regenerate_voiceover and narration_source:
        from app.dspy_modules.voiceover_expand import expand_narration_to_voiceover
        from app.services.language_detection import get_content_language_for_project
        video_style = getattr(project, "video_style", None) or "explainer"
        content_language = get_content_language_for_project(project)
        expanded_voiceover = await expand_narration_to_voiceover(
            narration_source, scene.title, video_style=video_style, content_language=content_language
        )

        original_narration = scene.narration_text
        scene.narration_text = expanded_voiceover
        db.commit()

        generate_voiceover(scene, db, use_expanded=False)
        
        track_scene_edit(
                        db,
                        project_id=project.id,
                        scene_id=scene.id,
                        field_name="voiceover",
                        old_value=None, 
                        new_value="regenerated",
                        is_ai_assisted=True,
                        user_instruction="Regenerated voiceover via API",
                    )

        scene.narration_text = original_narration
        db.commit()

    # Increment usage count only when AI was actually used
    used_ai = needs_layout_regen or should_regenerate_voiceover
    if used_ai and user.plan not in (PlanTier.PRO, PlanTier.STANDARD):
        project.ai_assisted_editing_count += 1

    db.commit()
    
    # Rebuild Remotion workspace
    scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.order).all()
    rebuild_workspace(project, scenes, db)
    
    db.refresh(scene)
    return scene


def _get_user_project(project_id: int, user_id: int, db: Session) -> Project:
    """Get a project owned by the given user, or raise 404."""
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


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
