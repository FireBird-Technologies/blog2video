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
from sqlalchemy.exc import OperationalError

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
from app.services.table_extraction import build_table_context_hint, build_chartable_tables_payload, extract_tables_from_content
from app.services.chart_planner import (
    get_chartable_tables_from_visual_hint,
    get_line_chartable_tables_from_visual_hint,
    _build_chart_props_from_table,
    is_candlestick_table,
    is_ticker_snapshot_table,
    is_laduc_ticker_table,
    extract_ticker_items_from_blog,
)
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
    get_hero_layout,
    get_fallback_layout,
    get_script_style_hint,
    is_custom_template,
    is_crafted_template,
    _load_custom_template_data,
)
from app.services.crafted_template_service import validate_crafted_template_access
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

# Wealth Your Way ending scene is fully frozen — every video closes with the
# same title, narration, and two CTA pills (Substack + Amazon).
# Matches both the local-template id ("wealth_your_way") and the crafted/R2
# bundle's public_template_id ("crafted_wealth_your_way_bundle").
WEALTH_TEMPLATE_IDS = frozenset({
    "wealth_your_way",
    "crafted_wealth_your_way_bundle",
})
WEALTH_ENDING_TITLE = "Go Deeper. Start Now."
WEALTH_ENDING_NARRATION = (
    "Subscribe for monthly guidance on financial independence — "
    "or dive straight into Wealth Your Way, the book behind these insights."
)
WEALTH_ENDING_CTA_TEXT = "Subscribe on Substack"
WEALTH_SUBSTACK_URL = "https://www.cosmodestefano.com"
WEALTH_ENDING_SECONDARY_CTA_TEXT = "Buy the Book on Amazon"
WEALTH_AMAZON_URL = "https://geni.us/wealthyourwaypb"

# FJ Market Brief shares LaDuc's chart contract (market_annotation + ticker
# layouts, chartTable/tickerTable schemas). Matches the local built-in id AND
# the crafted/R2 bundle's public id.
FJ_TEMPLATE_IDS = frozenset({"fj_market_brief", "crafted_fj_market_brief_bundle"})


def _is_laduc_or_fj(template_id: str) -> bool:
    """True for LaDuc (any id variant), FJ Market Brief, or fj_research — the
    templates that share the market_annotation/ticker chart-binding pipeline."""
    tid = template_id or ""
    return ("laduc" in tid) or ("fj_research" in tid) or (tid in FJ_TEMPLATE_IDS)


def _descriptor_layout_name(template_id: str, descriptor: dict) -> str | None:
    """Extract effective layout from descriptor payload."""
    if is_custom_template(template_id):
        cfg = descriptor.get("layoutConfig") if isinstance(descriptor, dict) else None
        if isinstance(cfg, dict):
            name = cfg.get("arrangement")
            return name if isinstance(name, str) else None
        return None
    name = descriptor.get("layout") if isinstance(descriptor, dict) else None
    return name if isinstance(name, str) else None


def _normalize_layout_id(value: str | None) -> str:
    return (value or "").strip().lower().replace(" ", "_").replace("-", "_")


def _sanitize_script_layouts(
    template_id: str,
    scenes_raw: list[dict],
    *,
    include_ending_socials: bool,
) -> list[dict]:
    """Ensure script-stage preferred_layout is valid + diverse for template.

    - Keeps only template-valid layout IDs.
    - Forces hero layout on first scene and ending_socials only on last scene (when enabled).
    - Replaces invalid/random picks with diverse valid alternatives.
    """
    if not scenes_raw:
        return scenes_raw
    if is_custom_template(template_id):
        return scenes_raw

    valid = {x for x in get_valid_layouts(template_id) if isinstance(x, str) and x.strip()}
    if not valid:
        return scenes_raw

    hero_layout = _normalize_layout_id(get_hero_layout(template_id))
    fallback_layout = _normalize_layout_id(get_fallback_layout(template_id))
    if fallback_layout not in valid:
        fallback_layout = next(iter(valid))

    supports_ending = "ending_socials" in valid and include_ending_socials
    last_idx = len(scenes_raw) - 1
    usage: dict[str, int] = {}
    prev_layout: str | None = None

    def _pick_diverse(exclude: set[str] | None = None) -> str:
        banned = set(exclude or set())
        candidates = [l for l in valid if l not in banned]
        if not candidates:
            candidates = list(valid)
        # least-used first, deterministic tie-breaker by name
        candidates.sort(key=lambda l: (usage.get(l, 0), l))
        return candidates[0] if candidates else fallback_layout

    for i, scene in enumerate(scenes_raw):
        desired = _normalize_layout_id(scene.get("preferred_layout"))
        if i == 0 and hero_layout in valid:
            desired = hero_layout
        elif supports_ending and i == last_idx:
            desired = "ending_socials"
        elif desired not in valid:
            desired = ""
        elif desired == "ending_socials":
            # ending_socials is reserved for final scene only.
            desired = ""

        if not desired:
            excludes = set()
            if prev_layout:
                excludes.add(prev_layout)
            if supports_ending:
                excludes.add("ending_socials")
            desired = _pick_diverse(excludes)

        # Try to avoid consecutive duplicates even when valid was provided.
        # Data-bound scenes (data_table_index set) must keep their assigned layout — two
        # chartable tables legitimately produce two consecutive market_annotation scenes.
        is_data_bound = isinstance(scene.get("data_table_index"), int)
        if prev_layout and desired == prev_layout and i != 0 and not (supports_ending and i == last_idx) and not is_data_bound:
            alt = _pick_diverse({prev_layout, "ending_socials"} if supports_ending else {prev_layout})
            desired = alt or desired

        scene["preferred_layout"] = desired
        usage[desired] = usage.get(desired, 0) + 1
        prev_layout = desired

    return scenes_raw


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

            # Step 1.5: Resolve "auto" video_style now that we have scraped content.
            # The user picked "Auto" in the form → pick concrete style based on the article.
            if project.status in (ProjectStatus.CREATED, ProjectStatus.SCRAPED) \
                    and (project.video_style or "").strip().lower() == "auto":
                from app.dspy_modules.video_style_picker import resolve_auto_video_style
                resolved = await resolve_auto_video_style(project.blog_content or "")
                project.video_style = resolved
                db.commit()
                logger.info(
                    "[PIPELINE] Project %s: auto video_style resolved to %s",
                    project_id, resolved,
                )

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
    template_id = validate_template_id(
        project.template if project.template else "default",
        db=db,
        user_id=project.user_id,
    )
    try:
        layout_catalog = get_layout_prompt(template_id, db=db, user_id=project.user_id)
    except Exception:
        layout_catalog = ""

    # For bloomberg: extract tables once upfront — reused for both constraint-building and
    # table bindings below, avoiding a second parse of the same blog_content string.
    _bloomberg_pre_tables: list[dict] = []
    if template_id == "bloomberg":
        _blog_text = getattr(project, "blog_content", None) or ""
        _bloomberg_pre_tables = extract_tables_from_content(_blog_text) if _blog_text else []

    # For bloomberg: probe scraped content and append data-availability constraints so the
    # script generator only picks data-driven layouts when the underlying data actually exists.
    if template_id == "bloomberg" and layout_catalog:
        _ticker_items = extract_ticker_items_from_blog(_blog_text, max_items=2)
        _has_ohlcv = any(is_candlestick_table(t) for t in _bloomberg_pre_tables)
        _constraints: list[str] = []
        if not _ticker_items:
            _constraints.append(
                "- `terminal_ticker` MUST NOT be used: no ticker/price data was found in the scraped content."
            )
        if not _has_ohlcv:
            _constraints.append(
                "- `terminal_chart` MUST NOT be used: no OHLCV candlestick table was found in the scraped content."
            )
        if _constraints:
            layout_catalog = layout_catalog.rstrip() + (
                "\n\nData availability constraints (STRICT — do not override):\n"
                + "\n".join(_constraints)
            )

    content_language = get_content_language_for_project(project)
    requested_video_length = getattr(project, "video_length", "auto") or "auto"
    video_style = getattr(project, "video_style", "explainer") or "explainer"

    def _effective_video_length_for_content(
        blog_content: str | None, requested: str, style: str
    ) -> str:
        """Prevent hallucination: if content is short, downshift scene count.

        Word thresholds per tier (content must meet minimum to justify the length):
          short        — no minimum
          medium       — 5 00 words  (else → short)
          detailed     — 1 500 words  (else → medium or short)
          more_detailed— 2 000 words  (else → detailed, medium, or short)
        """
        req = (requested or "auto").strip().lower()
        if req not in {"mdetailed", "detailed", "medium", "short", "auto"}:
            return "auto"
        if req in {"auto", "short"}:
            return req

        text = (blog_content or "").strip()
        words = len([w for w in re.split(r"\s+", text) if w])

        if req == "medium":
            return "short" if words < 500 else "medium"

        if req == "detailed":
            if words < 500:
                return "short"
            if words < 1500:
                return "medium"
            return "detailed"

        # req == "more_detailed"
        if words < 500:
            return "short"
        if words < 1500:
            return "medium"
        if words < 2000:
            return "detailed"
        return "mdetailed"

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
    # For custom templates: enable CTA ending when the template has an "outro" archetype.
    if is_custom_template(template_id):
        include_ending_socials = True
    else:
        include_ending_socials = "ending_socials" in get_valid_layouts(template_id)

    # Pre-compute table bindings for templates that have dedicated data/table layouts.
    # Each template block builds `chartable_tables_json` (passed to ScriptGenerator) and
    # `_all_extracted_tables` (used in the scene-save loop to embed single-table hints).
    chartable_tables_json = ""
    _all_extracted_tables: list[dict] = []

    if template_id == "newscast":
        # newscast: dedicate scenes to data_visualization for any chartable table (line/bar/histogram).
        # Requires ≥2 chartable tables; caps at 3 scenes.
        _all_extracted_tables = extract_tables_from_content(
            getattr(project, "blog_content", None) or ""
        )
        if len(_all_extracted_tables) >= 2:
            _tmp_hint = build_table_context_hint(_all_extracted_tables, max_tables=len(_all_extracted_tables))
            _chartable = get_chartable_tables_from_visual_hint(_tmp_hint)
            _capped = _chartable[: min(3, len(_chartable))]
            if len(_capped) >= 2:
                _chart_type_by_idx = {
                    orig_idx: (_build_chart_props_from_table(t) or {}).get("chartType", "auto")
                    for orig_idx, t in _capped
                }
                chartable_tables_json = build_chartable_tables_payload(
                    _capped, chart_type_by_index=_chart_type_by_idx
                )

    elif template_id == "bloomberg":
        # bloomberg: one scene per qualifying table — layout depends on table type:
        #   terminal_chart   → OHLCV candlestick tables only
        #   terminal_dataviz → non-OHLCV time-series / line-chartable tables
        #   terminal_ticker  → multi-symbol snapshot tables
        #   terminal_table   → all remaining tables with headers + ≥1 row
        # Reuse the tables already extracted during the constraint-check above.
        _all_extracted_tables = _bloomberg_pre_tables
        if _all_extracted_tables:
            _tmp_hint = build_table_context_hint(
                _all_extracted_tables, max_tables=len(_all_extracted_tables)
            )

            # The three classification passes are independent — run them concurrently
            # in the thread pool so CPU-bound numeric parsing doesn't serialize.
            _loop = asyncio.get_event_loop()

            def _classify_candlestick() -> list[tuple[int, dict]]:
                return [
                    (idx, t) for idx, t in enumerate(_all_extracted_tables)
                    if is_candlestick_table(t)
                ]

            def _classify_dataviz(hint: str) -> list[tuple[int, dict]]:
                return get_line_chartable_tables_from_visual_hint(hint)

            def _classify_ticker(tables: list[dict]) -> list[tuple[int, dict]]:
                return [
                    (idx, t) for idx, t in enumerate(tables)
                    if is_ticker_snapshot_table(t)
                ]

            (
                _candlestick_tables,
                _dataviz_tables_raw,
                _ticker_tables_all,
            ) = await asyncio.gather(
                _loop.run_in_executor(None, _classify_candlestick),
                _loop.run_in_executor(None, _classify_dataviz, _tmp_hint),
                _loop.run_in_executor(None, _classify_ticker, _all_extracted_tables),
            )

            _candlestick_indices = {idx for idx, _ in _candlestick_tables}

            # terminal_dataviz: non-OHLCV tables that produce a line chart
            _dataviz_tables: list[tuple[int, dict]] = [
                (idx, t) for idx, t in _dataviz_tables_raw
                if idx not in _candlestick_indices
            ]
            _dataviz_indices = {idx for idx, _ in _dataviz_tables}

            _used_indices = _candlestick_indices | _dataviz_indices

            # terminal_ticker: filter out already-claimed indices
            _ticker_tables: list[tuple[int, dict]] = [
                (idx, t) for idx, t in _ticker_tables_all
                if idx not in _used_indices
            ]
            _ticker_indices = {idx for idx, _ in _ticker_tables}
            _used_indices |= _ticker_indices

            # terminal_table: every remaining table with headers + ≥1 row gets its own scene.
            # Exclude tables where every row has only a single cell (e.g. HTML scraper dropped
            # all value columns, leaving only a date/label column with no data to show).
            def _table_has_multi_col_rows(t: dict) -> bool:
                rows = t.get("rows") or []
                return any(isinstance(r, list) and len(r) >= 2 for r in rows)

            _table_tables: list[tuple[int, dict]] = [
                (idx, t)
                for idx, t in enumerate(_all_extracted_tables)
                if idx not in _used_indices
                and (t.get("headers") or [])
                and len(t.get("rows") or []) >= 1
                and _table_has_multi_col_rows(t)
            ]

            # Cap total table-bound scenes at 4 (candlestick first, then dataviz, ticker, table).
            # Prevents token bloat and keeps scene count reasonable for table-heavy blogs.
            _MAX_BLOOMBERG_TABLE_SCENES = 4
            _bindings = (
                _candlestick_tables + _dataviz_tables + _ticker_tables + _table_tables
            )[:_MAX_BLOOMBERG_TABLE_SCENES]

            if _bindings:
                # Rebuild index sets from the capped list so layout mapping stays correct.
                _bound_candlestick = {idx for idx, _ in _bindings if idx in _candlestick_indices}
                _bound_dataviz = {idx for idx, _ in _bindings if idx in _dataviz_indices}
                _bound_ticker = {idx for idx, _ in _bindings if idx in _ticker_indices}

                _chart_type_by_idx = {
                    orig_idx: (_build_chart_props_from_table(t) or {}).get("chartType", "auto")
                    for orig_idx, t in _bindings
                }
                _layout_by_idx = {
                    orig_idx: (
                        "terminal_chart" if orig_idx in _bound_candlestick
                        else "terminal_dataviz" if orig_idx in _bound_dataviz
                        else "terminal_ticker" if orig_idx in _bound_ticker
                        else "terminal_table"
                    )
                    for orig_idx, _ in _bindings
                }
                chartable_tables_json = build_chartable_tables_payload(
                    _bindings,
                    chart_type_by_index=_chart_type_by_idx,
                    preferred_layout_by_index=_layout_by_idx,
                    max_rows=20,
                )

    elif _is_laduc_or_fj(template_id):
        # laduc / FJ Market Brief / fj_research: classify chartable tables once upfront (bloomberg-style).
        # Run extraction + classification in the thread pool so CPU-bound
        # HTML parsing doesn't block the event loop.
        _laduc_blog_text = getattr(project, "blog_content", None) or ""

        def _laduc_classify_tables() -> tuple[list, str]:
            tables = extract_tables_from_content(_laduc_blog_text)
            if not tables:
                return tables, ""
            tmp_hint = build_table_context_hint(tables, max_tables=len(tables))
            # Chartable candidates (line/bar/histogram) → market_annotation
            chartable_all = get_chartable_tables_from_visual_hint(tmp_hint)
            # Ticker-like tables → ticker layout (excluded from chartable set so we
            # don't double-bind the same table to two scenes).
            ticker_tables_all: list[tuple[int, dict]] = [
                (idx, t) for idx, t in enumerate(tables)
                if isinstance(t, dict) and is_laduc_ticker_table(t)
            ]
            ticker_indices = {idx for idx, _ in ticker_tables_all}
            # If a table matches both, prefer ticker (user wants ticker classification strict).
            chartable = [(idx, t) for idx, t in chartable_all if idx not in ticker_indices][:2]
            ticker_tables = ticker_tables_all[:2]
            if not chartable and not ticker_tables:
                return tables, ""
            chart_type_by_idx = {
                orig_idx: (_build_chart_props_from_table(t) or {}).get("chartType", "auto")
                for orig_idx, t in chartable
            }
            preferred_layout_by_idx: dict[int, str] = {}
            for orig_idx, _ in chartable:
                preferred_layout_by_idx[orig_idx] = "market_annotation"
            for orig_idx, _ in ticker_tables:
                preferred_layout_by_idx[orig_idx] = "ticker"
            bindings = chartable + ticker_tables
            payload = build_chartable_tables_payload(
                bindings,
                chart_type_by_index=chart_type_by_idx,
                preferred_layout_by_index=preferred_layout_by_idx,
                max_rows=20,
            )
            return tables, payload

        _laduc_loop = asyncio.get_event_loop()
        _all_extracted_tables, chartable_tables_json = await _laduc_loop.run_in_executor(
            None, _laduc_classify_tables
        )

    # Release the DB connection during the long-running DSPy/LLM calls below.
    # Neon (serverless PostgreSQL) closes idle connections, and pool_pre_ping
    # only verifies liveness on checkout — a session already holding a
    # connection through a 30-60s LLM await can't be re-pinged, so the next
    # commit fails with "server closed the connection unexpectedly". We
    # capture the values we'll need post-LLM, drop the connection, run both
    # LLM calls cold, then re-attach the project to a fresh connection.
    _project_id = project.id
    _project_aspect_ratio = getattr(project, "aspect_ratio", "landscape") or "landscape"
    _project_blog_content = project.blog_content
    db.close()

    _template_style_hint = get_script_style_hint(template_id) if template_id else ""

    result = await generator.generate(
        blog_content=_project_blog_content,
        blog_images=image_paths,
        hero_image=hero_image,
        aspect_ratio=_project_aspect_ratio,
        video_style=video_style,
        video_length=effective_video_length,
        layout_catalog=layout_catalog,
        content_language=content_language,
        include_ending_socials=include_ending_socials,
        chartable_tables_json=chartable_tables_json,
        template_id=template_id or "",
        template_style_hint=_template_style_hint,
    )

    # Template-aware display text generation (second LLM call — still no DB held)
    scenes_raw: list[dict] = result["scenes"]
    scenes_raw = _sanitize_script_layouts(
        template_id,
        scenes_raw,
        include_ending_socials=include_ending_socials,
    )
    display_gen = DisplayTextGenerator(template_id, video_style=video_style, content_language=content_language)
    display_texts = await display_gen.generate_for_scenes(scenes_raw)

    # Re-attach the original project instance to a fresh connection.
    # add() on a detached-but-previously-persistent instance issues UPDATE on
    # next flush (not INSERT), and pool_pre_ping verifies the new checkout.
    db.add(project)
    project.name = result["title"]

    # Clear existing scenes for this project (moved here so it runs in the
    # same fresh transaction as the new scene inserts).
    db.query(Scene).filter(Scene.project_id == project.id).delete()
    db.flush()

    is_custom = is_custom_template(template_id)
    for i, (scene_data, display_text) in enumerate(zip(scenes_raw, display_texts)):
        vd = scene_data["visual_description"]
        preferred = scene_data.get("preferred_layout")
        if preferred == "ending_socials":
            cta = (scene_data.get("cta_button_text") or "").strip()
            if cta:
                vd = prepend_b2v_cta_to_visual(cta, vd)
            # Custom templates don't have an ending_socials layout — clear it so
            # archetype matching assigns the outro slot during scene generation.
            if is_custom:
                preferred = None
        elif (
            scene_data.get("preferred_layout") in {
                "data_visualization", "terminal_chart", "terminal_table",
                "terminal_dataviz", "market_annotation", "ticker",
            }
            and _all_extracted_tables
        ):
            # Embed only the single bound table so scene_gen has exactly one table to use.
            bound_idx = scene_data.get("data_table_index")
            # For terminal_chart with no bound index, auto-find the first OHLCV table.
            if scene_data.get("preferred_layout") == "terminal_chart" and not isinstance(bound_idx, int):
                for _ci, _ct in enumerate(_all_extracted_tables):
                    if is_candlestick_table(_ct):
                        bound_idx = _ci
                        break
            # For laduc/FJ market_annotation with no bound index, auto-find the first chartable table.
            if (
                _is_laduc_or_fj(template_id)
                and scene_data.get("preferred_layout") == "market_annotation"
                and not isinstance(bound_idx, int)
            ):
                for _ci, _ct in enumerate(_all_extracted_tables):
                    if not is_candlestick_table(_ct):
                        bound_idx = _ci
                        break
            if isinstance(bound_idx, int) and 0 <= bound_idx < len(_all_extracted_tables):
                _bound_table = _all_extracted_tables[bound_idx]
                _mr = 60 if is_candlestick_table(_bound_table) else 20
                hint = build_table_context_hint([_bound_table], max_tables=1, max_rows=_mr)
                if hint:
                    vd = (vd.rstrip() + "\n\n" + hint).strip()
        elif (
            # Recovery: LLM wrote a non-data layout but data_table_index is still bound —
            # the table binding was supposed to force a data layout.
            # Embed the table hint so scene_gen has the data and can produce the right chart.
            (template_id == "bloomberg" or _is_laduc_or_fj(template_id))
            and scene_data.get("data_table_index") is not None
            and _all_extracted_tables
        ):
            _fallback_idx = scene_data.get("data_table_index")
            if isinstance(_fallback_idx, int) and 0 <= _fallback_idx < len(_all_extracted_tables):
                _fb_table = _all_extracted_tables[_fallback_idx]
                _fb_hint = build_table_context_hint([_fb_table], max_tables=1, max_rows=20)
                if _fb_hint:
                    vd = (vd.rstrip() + "\n\n" + _fb_hint).strip()
                # Upgrade preferred_layout so scene_gen uses the right component.
                if template_id == "bloomberg":
                    if not is_candlestick_table(_fb_table):
                        scene_data["preferred_layout"] = "terminal_dataviz"
                    else:
                        scene_data["preferred_layout"] = "terminal_chart"
                elif _is_laduc_or_fj(template_id):
                    scene_data["preferred_layout"] = (
                        "ticker" if is_laduc_ticker_table(_fb_table) else "market_annotation"
                    )
        elif scene_data.get("preferred_layout") == "terminal_ticker":
            # Inject real scraped ticker data so scene_gen overrides LLM-hallucinated values.
            _blog_text = getattr(project, "blog_content", None) or ""
            _ticker_items = extract_ticker_items_from_blog(_blog_text, max_items=10)
            if _ticker_items:
                hint = "═══ SCRAPED_TICKER_ROWS ═══\n" + "\n".join(_ticker_items) + "\n═══ END_SCRAPED_TICKER_ROWS ═══"
                vd = (vd.rstrip() + "\n\n" + hint).strip()
        # Re-read preferred_layout: the recovery elif above may have upgraded it
        # (e.g. data_impact → market_annotation). The local `preferred` captured at
        # the top of this loop was set before that upgrade, so it would be stale.
        preferred = scene_data.get("preferred_layout")
        scene = Scene(
            project_id=project.id,
            order=i + 1,
            title=scene_data["title"],
            narration_text=scene_data["narration"],
            visual_description=vd,
            duration_seconds=scene_data.get("duration_seconds", 10),
            display_text=display_text,
            preferred_layout=preferred,
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
    # Force a fresh DB checkout at the start of this step. Pipeline-step
    # boundaries (script → scenes) leave a connection that may have been
    # silently dropped by Neon during the previous LLM call. pool_pre_ping
    # can miss SSL/Windows-10053 failures because they manifest mid-query
    # rather than on the SELECT-1 probe. Closing here releases any stale
    # connection back to the pool; the next query checks out a fresh one.
    _project_id = project.id
    try:
        db.close()
    except OperationalError as close_err:
        logger.warning(
            "[PIPELINE] Project %s: transient DB disconnect on db.close() before scene generation; invalidating session and retrying query: %s",
            _project_id,
            close_err,
        )
        try:
            db.invalidate()
        except Exception:
            pass

    try:
        project = db.query(Project).filter(Project.id == _project_id).first()
    except OperationalError as query_err:
        logger.warning(
            "[PIPELINE] Project %s: transient DB disconnect on pre-scenes reload; invalidating and retrying once: %s",
            _project_id,
            query_err,
        )
        db.invalidate()
        project = db.query(Project).filter(Project.id == _project_id).first()

    if project is None:
        raise RuntimeError(f"Project {_project_id} disappeared before scene generation")

    scenes = project.scenes

    # Wealth Your Way: freeze the ending scene's narration + title BEFORE the
    # voiceover task reads them, so TTS speaks the locked client copy. The
    # descriptor override later in this function locks the on-screen text and
    # CTAs separately; this just makes sure the audio matches.
    _is_wealth = project.template in WEALTH_TEMPLATE_IDS
    if _is_wealth and scenes:
        for s in scenes:
            if getattr(s, "preferred_layout", None) == "ending_socials":
                s.title = WEALTH_ENDING_TITLE
                s.narration_text = WEALTH_ENDING_NARRATION
                s.voiceover_path = None
        db.commit()
        db.refresh(project)
        scenes = project.scenes

    # Build scenes_data BEFORE launching concurrent tasks (captures immutable fields).
    # Each data_visualization scene already carries its single bound TABLE_DATA_HINT_JSON
    # (embedded during _generate_script); no blanket append needed here.
    scenes_data = []
    for s in scenes:
        _, vis = strip_b2v_cta_from_visual(s.visual_description or "")
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
    template_id = validate_template_id(
        project.template if project.template else "default",
        db=db,
        user_id=project.user_id,
    )
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
            # Note: imageBoxAspectRatio is injected per-scene later in remotion.py once
            # the actual content variant index is known (via match_scenes_to_archetypes).
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

    # Force a fresh DB checkout. The descriptor task is a long LLM call that
    # runs concurrently with the voiceover task — if voiceovers finish first,
    # the main session sits idle through the rest of the descriptor await and
    # Neon may silently drop the connection. Closing here releases any stale
    # connection back to the pool; the next query checks out a fresh one.
    # On Windows + SSL this close can itself raise OperationalError if the TCP
    # socket is already severed; handle it and invalidate the session so we can
    # continue with a fresh checkout instead of aborting the whole pipeline.
    _pid = project.id
    try:
        db.close()
    except OperationalError as close_err:
        logger.warning(
            "[PIPELINE] Project %s: transient DB disconnect on db.close() after scene tasks; invalidating session and retrying query: %s",
            _pid,
            close_err,
        )
        try:
            db.invalidate()
        except Exception:
            pass

    try:
        project = db.query(Project).filter(Project.id == _pid).first()
    except OperationalError as query_err:
        logger.warning(
            "[PIPELINE] Project %s: transient DB disconnect on post-close reload; invalidating and retrying once: %s",
            _pid,
            query_err,
        )
        db.invalidate()
        project = db.query(Project).filter(Project.id == _pid).first()

    if project is None:
        raise RuntimeError(f"Project {_pid} disappeared during scene generation")

    # Re-load scenes to pick up voiceover changes from per-thread DB sessions.
    # expire_all is now redundant (db.close already cleared the identity map),
    # but kept as a no-op safeguard in case future code re-fetches before this.
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
            if template_id in WEALTH_TEMPLATE_IDS:
                # Client-locked ending: every wealth_your_way video closes with the
                # same headline, sub-copy, and Subscribe/Buy pills. No LLM input.
                descriptor = {
                    "layout": "ending_socials",
                    "layoutProps": {
                        "hideImage": True,
                        "socials": ending_socials_default,
                        "showWebsiteButton": True,
                        "ctaButtonText": WEALTH_ENDING_CTA_TEXT,
                        "websiteLink": WEALTH_SUBSTACK_URL,
                        "secondaryCtaButtonText": WEALTH_ENDING_SECONDARY_CTA_TEXT,
                        "secondaryWebsiteLink": WEALTH_AMAZON_URL,
                    },
                }
                scene.title = WEALTH_ENDING_TITLE
                scene.narration_text = WEALTH_ENDING_NARRATION
            else:
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
        resolved_layout = _descriptor_layout_name(template_id, descriptor)
        if resolved_layout:
            scene.preferred_layout = resolved_layout
        if has_layout_config:
            lc = descriptor["layoutConfig"]
            logger.info(
                "[PIPELINE] Scene %s stored: layoutConfig.arrangement=%s, elements=%s, decorations=%s",
                i, lc.get("arrangement"), len(lc.get("elements", [])), lc.get("decorations"),
            )
        else:
            lp_keys = list(descriptor.get("layoutProps", {}).keys())
            logger.info(
                "[PIPELINE] Scene %s stored: legacy layout=%s, layoutProps keys=%s",
                i, descriptor.get("layout"), lp_keys,
            )
            if descriptor.get("layout") == "terminal_dataviz":
                logger.info(
                    "[PIPELINE] Scene %s terminal_dataviz full layoutProps=%s",
                    i, json.dumps(descriptor.get("layoutProps", {})),
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

    if (is_custom_template(project.template) or is_crafted_template(project.template)) and _load_custom_template_data(
        project.template,
        db=db,
        user_id=project.user_id,
    ) is None:
        raise HTTPException(
            status_code=409,
            detail="This project uses a missing template. Rendering is blocked because the template is unavailable.",
        )
    if is_crafted_template(project.template) and not validate_crafted_template_access(project.template, project.user_id, db):
        raise HTTPException(
            status_code=403,
            detail="This project no longer has access to its crafted template.",
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
    if is_crafted_template(project.template) and not validate_crafted_template_access(project.template, user_id, db):
        raise HTTPException(
            status_code=403,
            detail="Access to this project's crafted template has been revoked.",
        )
    return project
