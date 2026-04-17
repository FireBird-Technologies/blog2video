import os
import json
import asyncio
import logging
import traceback
import re
import time
import requests
from datetime import timedelta

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from opentelemetry.metrics import get_meter_provider

from app.observability.logging import get_logger

logger = get_logger(__name__)
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.auth import get_current_user
from app.models.user import User, PlanTier
from app.models.project import Project, ProjectStatus
from app.models.scene import Scene
from app.schemas.schemas import (
    ProjectOut,
    StudioResponse,
    RenderResponse,
)
from app.config import settings
from app.services.scraper import scrape_blog
from app.services.table_extraction import build_table_context_hint, extract_tables_from_content
from app.services.scraper import scrape_blog, BlogScrapeFailed
from app.services.project_cleanup import (
    remove_failed_generation_project,
    PUBLIC_MSG_PIPELINE_FAILED,
    format_scrape_failed_public_message,
)
from app.services.language_detection import get_content_language_for_project
from app.services.voiceover import generate_all_voiceovers
from app.services.remotion import (
    write_remotion_data,
    rebuild_workspace,
    launch_studio,
    create_studio_zip,
    render_video,
    start_render_async,
    get_render_progress,
    get_render_progress_from_r2,
    seed_render_progress,
    set_render_phase_message,
    fail_render_start,
    cancel_running_render,
    get_workspace_dir,
    safe_remove_workspace,
)
from app.services import r2_storage
from app.scene_cta import prepend_b2v_cta_to_visual, strip_b2v_cta_from_visual
from app.services.social_content_signals import detect_social_platforms_in_text
from app.dspy_modules.script_gen import ScriptGenerator
from app.dspy_modules.template_scene_gen import TemplateSceneGenerator
from app.dspy_modules.display_text_gen import DisplayTextGenerator
from app.services.template_service import (
    validate_template_id,
    get_layout_prompt,
    get_valid_layouts,
    is_custom_template,
    _load_custom_template_data,
)
from app.services.email import email_service, EmailServiceError

router = APIRouter(prefix="/api/projects/{project_id}", tags=["pipeline"])

# In-memory pipeline progress tracker: project_id -> { step, error }
_pipeline_progress: dict[int, dict] = {}

_tracer = trace.get_tracer("app.pipeline")
_meter = get_meter_provider().get_meter("app.pipeline")

_pipelines_started = _meter.create_counter(
    "pipelines_started",
    unit="1",
    description="Number of pipelines started",
)
_pipelines_succeeded = _meter.create_counter(
    "pipelines_succeeded",
    unit="1",
    description="Number of pipelines completed successfully",
)
_pipelines_failed = _meter.create_counter(
    "pipelines_failed",
    unit="1",
    description="Number of pipelines that failed",
)


# ─── Single async generate endpoint ──────────────────────────

@router.post("/generate")
async def generate_video(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kick off the full pipeline (scrape -> script -> scenes -> done).
    Returns immediately. Poll /status for progress.
    """
    project = _get_project(project_id, user.id, db)

    # Don't restart if already running
    if project_id in _pipeline_progress and _pipeline_progress[project_id].get("running"):
        return {"detail": "Pipeline already running", "step": _pipeline_progress[project_id].get("step", 0)}

    # Don't restart if already complete
    if project.status in (ProjectStatus.GENERATED, ProjectStatus.DONE):
        return {"detail": "Already generated", "status": project.status.value}

    # Initialize progress
    _pipeline_progress[project_id] = {"step": 0, "running": True, "error": None, "notice": None}

    # Run pipeline in a thread pool so the event loop is not blocked (scrape, voiceover, write_remotion_data are sync).
    # Other API requests remain responsive while generation runs.
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run_pipeline_sync, project_id, user.id)

    return {"detail": "Pipeline started", "step": 0}


@router.get("/status")
def get_pipeline_status(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll this endpoint to get pipeline progress."""
    progress = _pipeline_progress.get(project_id, {})
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user.id)
        .first()
    )

    if not project:
        # Generation failed and DB row was removed; show last error once for this user.
        if progress.get("project_removed") and progress.get("user_id") == user.id:
            return {
                "status": "failed",
                "step": progress.get("step", 0),
                "running": False,
                "error": progress.get("error"),
                "error_code": progress.get("error_code"),
                "notice": progress.get("notice"),
                "studio_port": None,
                "project_removed": True,
            }
        raise HTTPException(status_code=404, detail="Project not found")

    running = progress.get("running", False)
    step = progress.get("step", 0)

    # If in-memory progress is lost (e.g. Cloud Run cold start / new container)
    # but the project is still mid-generation, infer the step from project status
    # so the frontend keeps showing the loading screen.
    if not running and project.status in (
        ProjectStatus.CREATED,
        ProjectStatus.SCRAPED,
        ProjectStatus.SCRIPTED,
    ):
        _STATUS_TO_STEP = {
            ProjectStatus.CREATED: 1,   # about to scrape or scraping
            ProjectStatus.SCRAPED: 2,   # about to generate script
            ProjectStatus.SCRIPTED: 3,  # about to generate scenes
        }
        step = max(step, _STATUS_TO_STEP.get(project.status, 0))

    return {
        "status": project.status.value,
        "step": step,
        "running": running,
        "error": progress.get("error"),
        "error_code": progress.get("error_code"),
        "notice": progress.get("notice"),
        "studio_port": project.studio_port,
        "project_removed": progress.get("project_removed", False),
    }


def _run_pipeline_sync(project_id: int, user_id: int) -> None:
    """Run the async pipeline in a dedicated event loop (called from thread pool).
    Keeps the main server event loop free so other API requests are served."""
    asyncio.run(_run_pipeline(project_id, user_id))


async def _run_pipeline(project_id: int, user_id: int):
    """Full async pipeline running in background."""
    db = SessionLocal()
    attributes = {
        "pipeline.project_id": project_id,
        "pipeline.user_id": user_id,
    }
    _pipelines_started.add(1, attributes=attributes)

    with _tracer.start_as_current_span("pipeline.run", attributes=attributes) as span:
        try:
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                logger.warning("[PIPELINE] Project %s not found", project_id)
                span.set_status(Status(StatusCode.ERROR, "Project not found"))
                return
            if project.user_id != user_id:
                logger.warning(
                    "[PIPELINE] Project %s user mismatch (expected %s, got %s)",
                    project_id,
                    user_id,
                    project.user_id,
                )
                span.set_status(Status(StatusCode.ERROR, "User mismatch"))
                return

            logger.info("[PIPELINE] Starting pipeline for project %s (user %s)", project_id, user_id)

            # Step 1: Scrape (skip for upload-based projects)
            if project.status in (ProjectStatus.CREATED,):
                if project.blog_url and project.blog_url.startswith("upload://"):
                    # Upload project without pending files — wait for documents
                    _set_error(project_id, project, db, "Documents not yet uploaded. Please upload files first.")
                    span.set_status(Status(StatusCode.ERROR, "Documents not uploaded"))
                    return
                _pipeline_progress[project_id]["step"] = 1
                with _tracer.start_as_current_span(
                    "pipeline.scrape_blog",
                    attributes={**attributes, "pipeline.stage": "scrape"},
                ):
                    try:
                        scrape_blog(project, db)
                    except BlogScrapeFailed as e:
                        span.record_exception(e)
                        span.set_status(Status(StatusCode.ERROR, "Scraping failed"))
                        _abort_generation_pipeline(
                            db,
                            project_id,
                            user_id,
                            public_message=format_scrape_failed_public_message(project.blog_url),
                            error_code="scrape_failed",
                            exc=e,
                        )
                        return
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(Status(StatusCode.ERROR, "Scraping failed"))
                        _abort_generation_pipeline(
                            db,
                            project_id,
                            user_id,
                            public_message=format_scrape_failed_public_message(project.blog_url),
                            error_code="scrape_failed",
                            exc=e,
                        )
                        return

            # Step 2: Generate script (async DSPy)
            if project.status in (ProjectStatus.CREATED, ProjectStatus.SCRAPED):
                _pipeline_progress[project_id]["step"] = 2
                with _tracer.start_as_current_span(
                    "pipeline.generate_script",
                    attributes={**attributes, "pipeline.stage": "generate_script"},
                ):
                    try:
                        await _generate_script(project, db)
                        logger.info("[PIPELINE] Project %s: script generation completed", project_id)
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(Status(StatusCode.ERROR, "Script generation failed"))
                        _abort_generation_pipeline(
                            db,
                            project_id,
                            user_id,
                            public_message=PUBLIC_MSG_PIPELINE_FAILED,
                            error_code="pipeline_failed",
                            exc=e,
                        )
                        return

            # Step 3: Generate scene descriptors + voiceovers
            if project.status in (ProjectStatus.CREATED, ProjectStatus.SCRAPED, ProjectStatus.SCRIPTED):
                _pipeline_progress[project_id]["step"] = 3
                with _tracer.start_as_current_span(
                    "pipeline.generate_scenes",
                    attributes={**attributes, "pipeline.stage": "generate_scenes"},
                ):
                    try:
                        await _generate_scenes(project, db)
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(Status(StatusCode.ERROR, "Scene generation failed"))
                        _abort_generation_pipeline(
                            db,
                            project_id,
                            user_id,
                            public_message=PUBLIC_MSG_PIPELINE_FAILED,
                            error_code="pipeline_failed",
                            exc=e,
                        )
                        return

            # Step 4: Done (no more studio launch — frontend handles preview)
            _pipeline_progress[project_id]["step"] = 4
            _pipeline_progress[project_id]["running"] = False
            _pipelines_succeeded.add(1, attributes=attributes)
            span.set_status(Status(StatusCode.OK))
            logger.info("[PIPELINE] Project %s: pipeline completed successfully", project_id)

        except Exception as e:
            logger.exception("[PIPELINE] Pipeline error for project %s: %s", project_id, e)
            span.record_exception(e)
            span.set_status(Status(StatusCode.ERROR, "Pipeline run error"))
            try:
                db.rollback()
            except Exception:
                pass
            proj = (
                db.query(Project)
                .filter(Project.id == project_id, Project.user_id == user_id)
                .first()
            )
            if proj:
                _abort_generation_pipeline(
                    db,
                    project_id,
                    user_id,
                    public_message=PUBLIC_MSG_PIPELINE_FAILED,
                    error_code="pipeline_failed",
                    exc=e,
                )
            else:
                _pipelines_failed.add(1, attributes=attributes)
                step = (_pipeline_progress.get(project_id) or {}).get("step", 0)
                _pipeline_progress[project_id] = {
                    "step": step,
                    "running": False,
                    "error": PUBLIC_MSG_PIPELINE_FAILED,
                    "error_code": "pipeline_failed",
                    "notice": None,
                    "project_removed": True,
                    "user_id": user_id,
                }
        finally:
            db.close()


def _rollback_project_after_endpoint_failure(db: Session, project_id: int, user_id: int) -> None:
    """Used by legacy /scrape, /generate-script, /generate-scenes when they fail."""
    try:
        db.rollback()
    except Exception:
        pass
    proj = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .first()
    )
    if not proj:
        return
    try:
        remove_failed_generation_project(db, proj, decrement_user_video_quota=True)
    except Exception as e:
        logger.exception(
            "[PIPELINE] Endpoint rollback failed for project %s: %s",
            project_id,
            e,
            extra={"project_id": project_id, "user_id": user_id},
        )
        try:
            db.rollback()
        except Exception:
            pass


def _abort_generation_pipeline(
    db: Session,
    project_id: int,
    user_id: int,
    *,
    public_message: str,
    error_code: str,
    exc: BaseException | None = None,
) -> None:
    """Remove project + storage, decrement quota, expose a user-safe error on /status."""
    if exc is not None:
        logger.error(
            "[PIPELINE] Aborting generation for project %s (%s): %s",
            project_id,
            error_code,
            exc,
            exc_info=exc,
            extra={"project_id": project_id, "user_id": user_id},
        )
    else:
        logger.error(
            "[PIPELINE] Aborting generation for project %s (%s)",
            project_id,
            error_code,
            extra={"project_id": project_id, "user_id": user_id},
        )

    step = (_pipeline_progress.get(project_id) or {}).get("step", 0)

    try:
        db.rollback()
    except Exception:
        pass

    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .first()
    )
    if project:
        try:
            remove_failed_generation_project(
                db,
                project,
                decrement_user_video_quota=True,
            )
        except Exception as cleanup_err:
            logger.exception(
                "[PIPELINE] Failed to remove project %s after error: %s",
                project_id,
                cleanup_err,
                extra={"project_id": project_id, "user_id": user_id},
            )
            try:
                db.rollback()
            except Exception:
                pass

    _pipelines_failed.add(
        1,
        attributes={
            "pipeline.project_id": project_id,
            "pipeline.error_code": error_code,
        },
    )

    _pipeline_progress[project_id] = {
        "step": step,
        "running": False,
        "error": public_message,
        "error_code": error_code,
        "notice": None,
        "user_id": user_id,
        "project_removed": True,
    }


def _set_error(project_id: int, project, db: Session, msg: str):
    """Set pipeline error state."""
    attributes = {"pipeline.project_id": project_id}
    _pipelines_failed.add(1, attributes=attributes)

    logger.error(
        "[PIPELINE] Error for project %s: %s",
        project_id,
        msg,
    )
    _pipeline_progress[project_id]["error"] = msg
    _pipeline_progress[project_id]["running"] = False
    if project:
        try:
            db.rollback()  # clear any broken transaction state first
            project.status = ProjectStatus.ERROR
            db.commit()
        except Exception as e:
            logger.error(
                "[PIPELINE] Failed to persist error status for project %s: %s",
                project_id,
                e,
            )


async def _generate_script(project: Project, db: Session):
    """Async script generation using DSPy."""
    image_paths = [a.local_path for a in project.assets if a.asset_type.value == "image"]
    hero_image = image_paths[0] if image_paths else ""

    # Determine template and load its layout prompt (layout-only catalog).
    template_id = validate_template_id(project.template if project.template else "default")
    try:
        layout_catalog = get_layout_prompt(template_id)
    except Exception:
        layout_catalog = ""

    content_language = get_content_language_for_project(project)
    requested_video_length = getattr(project, "video_length", "auto") or "auto"
    video_style = getattr(project, "video_style", "explainer") or "explainer"

    def _effective_video_length_for_content(
        blog_content: str | None, requested: str, style: str
    ) -> str:
        """Prevent hallucination: if content is short, downshift scene count.

        Only applies when user explicitly requests a longer video length.
        """
        req = (requested or "auto").strip().lower()
        if req not in {"detailed", "medium", "short", "auto"}:
            return "auto"
        if req in {"auto", "short"}:
            return req

        text = (blog_content or "").strip()
        # Count words in prose-ish content; keep it simple and robust.
        words = len([w for w in re.split(r"\s+", text) if w])

        # Heuristic thresholds:
        # - Very short posts can't support 15–20 distinct scenes without invention.
        # - This keeps output grounded in the actual source.
        if req == "medium":
            return "short" if words < 250 else "medium"

        # req == "detailed"
        if words < 250:
            return "short"
        if words < 600:
            return "medium"
        return "detailed"

    effective_video_length = _effective_video_length_for_content(
        getattr(project, "blog_content", None), requested_video_length, video_style
    )

    if effective_video_length != requested_video_length:
        try:
            if project.id in _pipeline_progress:
                _pipeline_progress[project.id]["notice"] = {
                    "code": "video_shortened",
                    "message": "We shortened the video because the scraped/uploaded content was too short for your selected length.",
                    "requested_video_length": requested_video_length,
                    "effective_video_length": effective_video_length,
                    "video_style": video_style,
                }
        except Exception:
            pass
        logger.info(
            "[PIPELINE] Project %s: content too short for video_length=%s (style=%s). Using effective video_length=%s for script generation.",
            project.id,
            requested_video_length,
            video_style,
            effective_video_length,
            extra={"project_id": project.id, "user_id": project.user_id},
        )
        
    generator = ScriptGenerator()
    # Only append an ending / follow-along scene when the template declares `ending_socials`
    # in meta.json (e.g. newscast has no EndingSocials layout — forcing it would map to a fallback).
    include_ending_socials = (
        not is_custom_template(template_id)
        and "ending_socials" in get_valid_layouts(template_id)
    )
    result = await generator.generate(
        blog_content=project.blog_content,
        blog_images=image_paths,
        hero_image=hero_image,
        aspect_ratio=getattr(project, "aspect_ratio", "landscape") or "landscape",
        video_style=video_style,
        video_length=effective_video_length,
        layout_catalog=layout_catalog,
        content_language=content_language,
        include_ending_socials=include_ending_socials,
    )

    project.name = result["title"]

    # Clear existing scenes for this project
    db.query(Scene).filter(Scene.project_id == project.id).delete()
    db.flush()

    # Template-aware display text generation
    video_style = getattr(project, "video_style", None) or "explainer"
    scenes_raw: list[dict] = result["scenes"]

    display_gen = DisplayTextGenerator(template_id, video_style=video_style, content_language=content_language)
    display_texts = await display_gen.generate_for_scenes(scenes_raw)

    for i, (scene_data, display_text) in enumerate(zip(scenes_raw, display_texts)):
        vd = scene_data["visual_description"]
        if scene_data.get("preferred_layout") == "ending_socials":
            cta = (scene_data.get("cta_button_text") or "").strip()
            if cta:
                vd = prepend_b2v_cta_to_visual(cta, vd)
        scene = Scene(
            project_id=project.id,
            order=i + 1,
            title=scene_data["title"],
            narration_text=scene_data["narration"],
            visual_description=vd,
            duration_seconds=scene_data.get("duration_seconds", 10),
            display_text=display_text,
            preferred_layout=scene_data.get("preferred_layout"),
        )
        db.add(scene)

    project.status = ProjectStatus.SCRIPTED
    db.commit()
    db.refresh(project)


async def _generate_scenes(project: Project, db: Session):
    """Generate voiceovers and scene layout descriptors concurrently, then write Remotion data.

    Voiceovers and scene descriptors are independent — descriptors only need
    title/narration/visual_description which don't change during TTS generation.
    Running them concurrently via asyncio.gather cuts wall-clock time significantly.
    """
    scenes = project.scenes
    extracted_tables = extract_tables_from_content(getattr(project, "blog_content", None) or "")
    # Provide up to 3 tables so newscast can build 2-3 data visualization scenes.
    table_context_hint = build_table_context_hint(extracted_tables, max_tables=3)

    # Build scenes_data BEFORE launching concurrent tasks (captures immutable fields)
    scenes_data = []
    for s in scenes:
        _, vis = strip_b2v_cta_from_visual(s.visual_description or "")
        if table_context_hint:
            vis = (vis.rstrip() + "\n\n" + table_context_hint).strip()
        scenes_data.append(
            {
                "title": s.title,
                "narration": s.narration_text,
                "visual_description": vis,
                "preferred_layout": getattr(s, "preferred_layout", None),
            }
        )

    # Prepare scene descriptor generator
    db.refresh(project)
    template_id = validate_template_id(project.template if project.template else "default")
    logger.info("[PIPELINE] Project %s: template='%s', validated='%s'", project.id, project.template, template_id)
    supports_ending_socials = "ending_socials" in get_valid_layouts(template_id)
    scene_gen = TemplateSceneGenerator(template_id)
    image_filenames = [
        a.filename for a in project.assets if a.asset_type.value == "image"
    ]

    # ── Task 1: Voiceovers ───────────────────────────────────────
    async def _voiceover_task():
        if getattr(project, "voice_gender", None) == "none":
            logger.info("[PIPELINE] Skipping voiceover — no-audio mode for project %s", project.id)
            for scene in scenes:
                if scene.narration_text:
                    word_count = len(scene.narration_text.split())
                    scene.duration_seconds = round(
                        max(settings.MIN_SCENE_DURATION_SECONDS, max(5.0, word_count / 2.5) + 1.0),
                        1,
                    )
                else:
                    scene.duration_seconds = round(max(settings.MIN_SCENE_DURATION_SECONDS, 5.0), 1)
                scene.voiceover_path = None
            db.commit()
        else:
            content_lang = get_content_language_for_project(project)
            await generate_all_voiceovers(
                scenes, db,
                video_style=getattr(project, "video_style", None) or "explainer",
                content_language=content_lang,
            )

    # ── Task 2: Scene descriptors (pure LLM, no DB writes) ──────
    async def _descriptor_task():
        content_lang = get_content_language_for_project(project)

        if is_custom_template(template_id):
            # NEW: Single batch call replaces 16 per-scene DSPy calls
            from app.services.content_classifier import extract_structured_content_batch
            structured_contents = await extract_structured_content_batch(
                scenes_data,
                content_language=content_lang,
            )

            # Build descriptors in the format the rest of the pipeline expects
            # layoutConfig must be present so downstream checks detect custom template scenes
            descriptors = []
            for sc in structured_contents:
                descriptors.append({
                    "structuredContent": sc,
                    "layoutConfig": {},
                })

            print(f"[F7-DEBUG] [PIPELINE] Custom template: extracted structured content for {len(descriptors)} scenes in 1 call")
            return descriptors
        else:
            # Built-in templates: keep existing DSPy per-scene generation (works well)
            result = await scene_gen.generate_all_scenes(
                scenes_data,
                image_filenames,
                accent_color=project.accent_color or "#7C3AED",
                bg_color=project.bg_color or "#FFFFFF",
                text_color=project.text_color or "#000000",
                animation_instructions=project.animation_instructions or "",
                content_language=content_lang,
            )
            return result

    # Run both concurrently
    _, descriptors = await asyncio.gather(_voiceover_task(), _descriptor_task())

    # Re-load scenes to pick up voiceover changes from per-thread DB sessions
    # CRITICAL: We MUST explicitly expire the existing Scene objects in the Identity Map, 
    # otherwise SQLAlchemy will return the stale `duration_seconds` (e.g. 10.0 or 5.0) 
    # instead of the newly calculated audio lengths, overwriting them when we commit `remotion_code`.
    db.expire_all()
    scenes = project.scenes

    # Ending scene social icons: only enable platforms that appear in scraped content.
    social_flags = detect_social_platforms_in_text(getattr(project, "blog_content", None) or "")
    ending_socials_default = {
        "facebook": {"enabled": bool(social_flags.get("facebook")), "label": "Facebook"},
        "instagram": {"enabled": bool(social_flags.get("instagram")), "label": "Instagram"},
        "youtube": {"enabled": bool(social_flags.get("youtube")), "label": "YouTube"},
        "medium": {"enabled": bool(social_flags.get("medium")), "label": "Medium"},
        "substack": {"enabled": bool(social_flags.get("substack")), "label": "Substack"},
        "linkedin": {"enabled": bool(social_flags.get("linkedin")), "label": "LinkedIn"},
        "tiktok": {"enabled": bool(social_flags.get("tiktok")), "label": "TikTok"},
    }

    raw_blog_url = (getattr(project, "blog_url", None) or "").strip()
    source_link = (
        raw_blog_url
        if raw_blog_url and not raw_blog_url.startswith("upload://")
        else ""
    )

    # Store descriptors as JSON in remotion_code, preserving existing image assignments
    for i, (scene, descriptor) in enumerate(zip(scenes, descriptors)):
        # DSPy appends an ending scene with preferred_layout="ending_socials" when the template supports it.
        # We override the descriptor here so Remotion can render the themed ending consistently.
        if getattr(scene, "preferred_layout", None) == "ending_socials" and supports_ending_socials:
            cta_from_visual, _ = strip_b2v_cta_from_visual(scene.visual_description or "")
            cta = (cta_from_visual or "").strip()
            try:
                if scene.remotion_code:
                    old_desc = json.loads(scene.remotion_code)
                    old_lp = old_desc.get("layoutProps") or {}
                    old_cta = old_lp.get("ctaButtonText")
                    if isinstance(old_cta, str) and old_cta.strip():
                        cta = old_cta.strip()
            except (json.JSONDecodeError, TypeError):
                pass
            if not cta:
                cta = "Get started"
            descriptor = {
                "layout": "ending_socials",
                "layoutProps": {
                    "hideImage": True,
                    "socials": ending_socials_default,
                    "showWebsiteButton": bool(source_link),
                    "websiteLink": source_link,
                    "ctaButtonText": cta,
                },
            }

        # Custom templates: inject CTA props into the last (outro) scene
        if is_custom_template(template_id) and i == len(scenes) - 1 and len(scenes) > 1:
            cta_from_visual, _ = strip_b2v_cta_from_visual(scene.visual_description or "")
            cta = (cta_from_visual or "").strip()
            try:
                if scene.remotion_code:
                    old_desc = json.loads(scene.remotion_code)
                    old_cta_props = old_desc.get("ctaProps") or {}
                    old_cta = old_cta_props.get("ctaButtonText")
                    if isinstance(old_cta, str) and old_cta.strip():
                        cta = old_cta.strip()
            except (json.JSONDecodeError, TypeError):
                pass
            if not cta:
                cta = "Get started"
            descriptor["ctaProps"] = {
                "socials": ending_socials_default,
                "showWebsiteButton": bool(source_link),
                "websiteLink": source_link,
                "ctaButtonText": cta,
            }

        has_layout_config = "layoutConfig" in descriptor
        if scene.remotion_code:
            try:
                old_desc = json.loads(scene.remotion_code)
                old_lp = old_desc.get("layoutProps") or {}
                old_assigned = old_lp.get("assignedImage")
                old_hide = old_lp.get("hideImage")
                if old_assigned or old_hide:
                    if "layoutProps" not in descriptor:
                        descriptor["layoutProps"] = {}
                    if old_assigned:
                        descriptor["layoutProps"]["assignedImage"] = old_assigned
                    if old_hide:
                        descriptor["layoutProps"]["hideImage"] = True
            except (json.JSONDecodeError, TypeError):
                pass
        scene.remotion_code = json.dumps(descriptor)
        if has_layout_config:
            lc = descriptor["layoutConfig"]
            logger.info(
                "[PIPELINE] Scene %s stored: layoutConfig.arrangement=%s, elements=%s, decorations=%s",
                i, lc.get("arrangement"), len(lc.get("elements", [])), lc.get("decorations"),
            )
        else:
            logger.info(
                "[PIPELINE] Scene %s stored: legacy layout=%s, layoutProps keys=%s",
                i, descriptor.get("layout"), list(descriptor.get("layoutProps", {}).keys()),
            )
    db.commit()
    logger.info("[PIPELINE] All %s scene descriptors committed to DB", len(scenes))

    # Write data.json + assets to per-project Remotion workspace
    write_remotion_data(project, scenes, db)

    project.status = ProjectStatus.GENERATED
    user = db.query(User).filter(User.id == project.user_id).first()
    db.commit()
    db.refresh(project)

    # Notify the user that their video is ready to preview
    try:
        if user:
            
            project_url = f"{settings.FRONTEND_URL}/project/{project.id}"
            # email_service.send_preview_ready_email(
            #     user_email=user.email,
            #     user_name=user.name,
            #     project_name=project.name,
            #     project_url=project_url,
            # )
            
            # Schedule follow-up email 30 min before 7-day deletion (6d 23h 30m after creation)
            scheduled_at = project.created_at + timedelta(days=6, hours=23, minutes=30)
            # Only schedule follow-up email for unpaid users
            if user.plan == PlanTier.FREE:
                email_service.schedule_followup_email(
                    user_email=user.email,
                    user_name=user.name,
                    project_name=project.name,
                    project_url=project_url,
                    scheduled_at=scheduled_at,
                )
                logger.info(f"[PIPELINE] Project {project.id}: follow-up email scheduled at {scheduled_at}")
            
        else:
            logger.error(f"[PIPELINE] Project {project.id}: no user found, skipping preview + follow-up emails")
    except EmailServiceError as e:
        logger.error(f"[PIPELINE] Preview-ready email failed for project {project.id}: {e}")
    except Exception as e:
        logger.error(f"[PIPELINE] Unexpected error sending preview email for project {project.id}: {e}", exc_info=True)


# ─── Legacy individual endpoints (kept for compatibility) ────

@router.post("/scrape", response_model=ProjectOut)
def scrape_blog_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Scrape blog content and images from the project's URL."""
    project = _get_project(project_id, user.id, db)
    try:
        return scrape_blog(project, db)
    except BlogScrapeFailed as e:
        logger.warning("[SCRAPE_ENDPOINT] BlogScrapeFailed project=%s: %s", project_id, e)
        _rollback_project_after_endpoint_failure(db, project_id, user.id)
        raise HTTPException(
            status_code=410,
            detail=format_scrape_failed_public_message(project.blog_url),
        )
    except Exception as e:
        logger.exception("[SCRAPE_ENDPOINT] project=%s", project_id)
        _rollback_project_after_endpoint_failure(db, project_id, user.id)
        raise HTTPException(
            status_code=410,
            detail=format_scrape_failed_public_message(project.blog_url),
        )


@router.post("/generate-script", response_model=ProjectOut)
async def generate_script_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a video script from the scraped blog content using DSPy (async)."""
    project = _get_project(project_id, user.id, db)
    if not project.blog_content:
        raise HTTPException(status_code=400, detail="Blog content not yet scraped.")
    try:
        await _generate_script(project, db)
    except Exception as e:
        logger.exception("[GENERATE_SCRIPT_ENDPOINT] project=%s", project_id)
        _rollback_project_after_endpoint_failure(db, project_id, user.id)
        raise HTTPException(status_code=410, detail=PUBLIC_MSG_PIPELINE_FAILED)
    return project


@router.post("/generate-scenes", response_model=ProjectOut)
async def generate_scenes_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate Remotion layout descriptors + voiceovers for each scene (async)."""
    project = _get_project(project_id, user.id, db)
    if not project.scenes:
        raise HTTPException(status_code=400, detail="No scenes found.")
    try:
        await _generate_scenes(project, db)
    except Exception as e:
        logger.exception("[GENERATE_SCENES_ENDPOINT] project=%s", project_id)
        _rollback_project_after_endpoint_failure(db, project_id, user.id)
        raise HTTPException(status_code=410, detail=PUBLIC_MSG_PIPELINE_FAILED)
    return project


@router.post("/launch-studio", response_model=StudioResponse)
def launch_studio_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Launch Remotion Studio for this project (local dev only)."""
    project = _get_project(project_id, user.id, db)
    try:
        # Ensure workspace has latest data before launching studio
        rebuild_workspace(project, project.scenes, db)
        port = launch_studio(project, db)
        return StudioResponse(studio_url=f"http://localhost:{port}", port=port)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to launch studio: {str(e)}")


@router.get("/download-studio")
def download_studio_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download the project's Remotion workspace as a zip (Pro or per-video paid)."""
    project = _get_project(project_id, user.id, db)
    if user.plan not in (PlanTier.PRO, PlanTier.STANDARD) and not project.studio_unlocked:
        raise HTTPException(status_code=403, detail="Studio requires Pro plan or per-video purchase")

    try:
        zip_path = create_studio_zip(project.id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Workspace not found. Generate the video first.")

    safe_name = project.name.replace(" ", "_")[:50] if project.name else "project"
    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=f"{safe_name}_studio.zip",
    )


def _rebuild_workspace_sync(project_id: int) -> None:
    """Rebuild workspace in a thread (uses its own DB session). Avoids blocking the event loop."""
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return
        # Start from a clean workspace so canceled/previous runs cannot leave stale files behind.
        safe_remove_workspace(get_workspace_dir(project_id))
        scenes = (
            db.query(Scene)
            .filter(Scene.project_id == project_id)
            .order_by(Scene.order)
            .all()
        )
        if not scenes:
            raise ValueError("No scenes found")
        rebuild_workspace(project, scenes, db)
    finally:
        db.close()


@router.post("/render")
async def render_video_endpoint(
    project_id: int,
    resolution: str = "1080p",
    force_render: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kick off async video render. Poll /render-status for progress.

    Whiteboard and newspaper templates render at 720p; all others at 1080p.
    Workspace rebuild runs in a thread so the server stays responsive.
    When force_render=True, re-render even if already rendered (rebuilds workspace with latest DB data).
    """
    project = _get_project(project_id, user.id, db)

    # Render at 720p for whiteboard (stickman) and newspaper templates
    resolution = "720p" if project.template in ("whiteboard", "newspaper","newscast") else "1080p"

    # Already rendered and available in R2 — skip re-render unless force_render (re-render with latest changes)
    if project.r2_video_url and not force_render:
        return {
            "detail": "Already rendered",
            "progress": 100,
            "r2_video_url": project.r2_video_url,
        }

    if is_custom_template(project.template) and _load_custom_template_data(project.template, db=db) is None:
        raise HTTPException(
            status_code=409,
            detail="This project uses a deleted custom template. Rendering is blocked because the template no longer exists.",
        )

    # Align per-video credits with Stripe (same as project creation) before any limit check.
    user_row = db.query(User).filter(User.id == user.id).first()
    if not user_row:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_row.sync_video_limit_bonus(db)
    user_row = db.query(User).filter(User.id == user.id).first()
    if not user_row:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Re-render: deduct a video count (same as creating a new video)
    if force_render:
        if not user_row.can_create_video:
            raise HTTPException(
                status_code=403,
                detail="Video limit reached. Re-rendering counts as a new video. Upgrade your plan or buy more credits to continue."
            )
        user_row.videos_used_this_period += 1
        db.commit()

    # Don't restart if already rendering (guard by DB status so stale shared payloads
    # from a previous run don't block a fresh render after cancellation).
    is_rendering_state = project.status == ProjectStatus.RENDERING
    prog = get_render_progress(project_id)
    if is_rendering_state and prog and not prog.get("done", True):
        return {
            "detail": "Render already running",
            "progress": prog.get("progress", 0),
            "render_run_id": prog.get("_run_id"),
        }
    shared_prog = get_render_progress_from_r2(project_id, user.id)
    if is_rendering_state and shared_prog and not shared_prog.get("done", True):
        return {
            "detail": "Render already running",
            "progress": int(shared_prog.get("progress", 0) or 0),
            "render_run_id": shared_prog.get("render_run_id"),
        }
    # If DB says not rendering but we still see an active shared payload, treat it as stale.
    if (not is_rendering_state) and shared_prog and not shared_prog.get("done", True):
        try:
            r2_storage.delete_render_progress_json(user.id, project_id)
        except Exception:
            pass

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order)
        .all()
    )
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found. Generate the video first.")

    # Mark as rendering immediately so status polling can show startup phases
    # while workspace prep is still running.
    project.status = ProjectStatus.RENDERING
    db.commit()
    render_run_id = seed_render_progress(project_id, user.id, phase_message="Preparing workspace...")

    # Rebuild workspace in thread pool so the event loop is not blocked (file I/O, copy, etc.).
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _rebuild_workspace_sync, project_id)
    except Exception as e:
        msg = f"Failed to prepare workspace: {str(e)}. Please try again."
        fail_render_start(project_id, msg)
        project.status = ProjectStatus.GENERATED
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=msg,
        )
    set_render_phase_message(project_id, "Preparing render bundle...")

    try:
        start_render_async(project, resolution=resolution, run_id=render_run_id)
        return {
            "detail": "Render started",
            "progress": 0,
            "resolution": resolution,
            "render_run_id": render_run_id,
        }
    except Exception as e:
        logger.exception("[RENDER] Failed to start render for project %s: %s", project_id, e)
        fail_render_start(project_id, f"Failed to start render: {str(e)}. Please try again.")
        project.status = ProjectStatus.GENERATED
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start render: {str(e)}. Please try again.",
        )


@router.get("/render-status")
def render_status_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll this endpoint to get render progress."""
    project = _get_project(project_id, user.id, db)
    prog = get_render_progress(project_id)

    # If no progress dict exists, try shared progress payload first (R2).
    if not prog:
        shared = get_render_progress_from_r2(project_id, user.id)
        if shared:
            try:
                is_rendering = project.status == ProjectStatus.RENDERING
                shared_done = bool(shared.get("done", False))
                updated_at = float(shared.get("updated_at_epoch") or 0.0)
                stale_after = max(60, int(getattr(settings, "RENDER_PROGRESS_STALE_SECONDS", 360)))
                is_stale = updated_at > 0 and (time.time() - updated_at) > stale_after

                # Owner instance likely died: shared progress stopped heartbeating while DB still says RENDERING.
                if is_rendering and (not shared_done) and is_stale:
                    project.status = ProjectStatus.GENERATED
                    db.commit()
                    # Best effort cleanup of stale progress payload.
                    try:
                        r2_storage.delete_render_progress_json(user.id, project_id)
                    except Exception:
                        pass
                    return {
                        "progress": int(shared.get("progress", 0) or 0),
                        "rendered_frames": int(shared.get("rendered_frames", 0) or 0),
                        "total_frames": int(shared.get("total_frames", 0) or 0),
                        "done": True,
                        "error": "Render failed because the render worker became unavailable. Please try rendering again.",
                        "time_remaining": None,
                        "eta_seconds": None,
                        "progress_unknown": False,
                        "render_attempt": shared.get("render_attempt", None),
                        "render_run_id": shared.get("render_run_id", None),
                        "r2_video_url": project.r2_video_url,
                    }
            except Exception:
                # Fall back to returning shared payload if stale detection fails.
                pass
            
            return {
                "progress": int(shared.get("progress", 0) or 0),
                "rendered_frames": int(shared.get("rendered_frames", 0) or 0),
                "total_frames": int(shared.get("total_frames", 0) or 0),
                "done": bool(shared.get("done", False)),
                "error": shared.get("error"),
                "time_remaining": shared.get("time_remaining"),
                "eta_seconds": shared.get("eta_seconds"),
                "progress_unknown": bool(shared.get("progress_unknown", False)),
                "render_attempt": shared.get("render_attempt", None),
                "render_run_id": shared.get("render_run_id", None),
                "r2_video_url": shared.get("r2_video_url") or project.r2_video_url,
            }

        # If no shared progress exists, check project status to determine state.
        # Project is RENDERING but this worker has no in-memory progress: another
        # server instance may be rendering, or the render just started. Do NOT reset
        # DB status — that caused false "lost render" and 0% when load-balanced
        # polls hit a cold instance.
        if project.status == ProjectStatus.RENDERING:
            logger.warning(
                "[RENDER] Project %s is RENDERING but no progress dict on this worker — "
                "continuing (another instance may hold progress, or render is starting)",
                project_id,
            )
            return {
                "progress": 0,
                "rendered_frames": 0,
                "total_frames": 0,
                "done": False,
                "error": None,
                "time_remaining": None,
                "eta_seconds": None,
                "progress_unknown": True,
                "render_attempt": None,
                "render_run_id": None,
                "r2_video_url": project.r2_video_url,
            }

        # Project is not rendering — return default state
        return {
            "progress": 0,
            "rendered_frames": 0,
            "total_frames": 0,
            "done": project.status == ProjectStatus.DONE,
            "error": None,
            "time_remaining": None,
            "eta_seconds": None,
            "progress_unknown": False,
            "render_attempt": None,
            "render_run_id": None,
            "r2_video_url": project.r2_video_url,
        }

    # If render just finished, update project status
    if prog.get("done") and not prog.get("error") and project.status == ProjectStatus.RENDERING:
        project.status = ProjectStatus.DONE
        db.commit()
        db.refresh(project)


    return {
        "progress": prog.get("progress", 0),
        "rendered_frames": prog.get("rendered_frames", 0),
        "total_frames": prog.get("total_frames", 0),
        "done": prog.get("done", False),
        "error": prog.get("error"),
        "time_remaining": prog.get("time_remaining"),
        "eta_seconds": prog.get("eta_seconds"),
        "progress_unknown": False,
        "render_attempt": prog.get("_attempt", 1),
        "render_run_id": prog.get("_run_id"),
        "r2_video_url": project.r2_video_url,
    }


@router.post("/cancel-render")
def cancel_render_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel an active render process for this project."""
    project = _get_project(project_id, user.id, db)
    cancelled = cancel_running_render(project_id, reason="Render cancelled by user.")
    # If cancelling a re-render and an older video already exists, keep DONE.
    # Otherwise fall back to GENERATED.
    if project.status == ProjectStatus.RENDERING:
        has_existing_video = bool(project.r2_video_url)
        project.status = (
            ProjectStatus.DONE if has_existing_video else ProjectStatus.GENERATED
        )
        db.commit()
    if cancelled:
        return {"detail": "Render cancelled", "cancelled": True}
    # Even if this instance didn't own the subprocess, forcing status to GENERATED
    # triggers cross-instance worker self-termination via periodic DB health check.
    return {
        "detail": "Cancel requested; render worker will stop after next health check",
        "cancelled": True,
    }


@router.get("/download-url")
def get_download_url(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the download URL for the rendered video (R2 public URL or local fallback)."""
    project = _get_project(project_id, user.id, db)

    # Prefer R2 URL
    if project.r2_video_url:
        return {"url": project.r2_video_url}

    # Fallback: check if a local rendered file exists (R2 upload may still be in progress)
    local_path = os.path.join(
        settings.MEDIA_DIR, f"projects/{project.id}/output/video.mp4"
    )
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        return {"url": f"/media/projects/{project.id}/output/video.mp4"}

    # Check if render is still in progress
    prog = get_render_progress(project_id)
    if prog and not prog.get("done", True):
        raise HTTPException(status_code=202, detail="Video is still rendering.")

    raise HTTPException(status_code=404, detail="Video not rendered yet.")


@router.get("/download")
def download_video_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Directs the client to the video file. 
    1. Checks if the video is on R2 and redirects.
    2. Falls back to local storage if R2 is not available.
    3. Returns 202 if still rendering or 404 if missing.
    """
    # 1. Fetch project and verify ownership
    project = db.query(Project).filter(
        Project.id == project_id, 
        Project.user_id == user.id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. Case A: Video is stored on Cloudflare R2
    if project.r2_video_url:
        # Generate Cache-buster based on project update time
        sep = "&" if "?" in project.r2_video_url else "?"
        ts = int(project.updated_at.timestamp()) if project.updated_at else 0
        redirect_url = f"{project.r2_video_url}{sep}v={ts}"
        
        # 307 Temporary Redirect: Hands off the request to the R2 CDN
        return RedirectResponse(url=redirect_url, status_code=307)

    # 3. Case B: Fallback to Local Storage
    local_path = os.path.join(
        settings.MEDIA_DIR, f"projects/{project.id}/output/video.mp4"
    )
    
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        # Sanitized filename for the browser save dialog
        safe_name = (project.name or "video").replace(" ", "_")[:50]
        return FileResponse(
            path=local_path,
            media_type="video/mp4",
            filename=f"{safe_name}.mp4",
        )

    # 4. Case C: Check rendering progress before giving up
    prog = get_render_progress(project_id)
    if prog and not prog.get("done", True):
        raise HTTPException(
            status_code=202, 
            detail="Video is still rendering. Please wait."
        )

    raise HTTPException(status_code=404, detail="Video file not found.")



def _get_project(project_id: int, user_id: int, db: Session) -> Project:
    """Helper to get a project owned by the user, or raise 404."""
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
