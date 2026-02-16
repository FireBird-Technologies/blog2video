import os
import json
import asyncio
import traceback
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
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
from app.services.voiceover import generate_all_voiceovers
from app.services.remotion import (
    write_remotion_data,
    rebuild_workspace,
    launch_studio,
    create_studio_zip,
    render_video,
    start_render_async,
    get_render_progress,
    get_workspace_dir,
)
from app.services import r2_storage
from app.dspy_modules.script_gen import ScriptGenerator
from app.dspy_modules.template_scene_gen import TemplateSceneGenerator
from app.services.template_service import validate_template_id

router = APIRouter(prefix="/api/projects/{project_id}", tags=["pipeline"])

# In-memory pipeline progress tracker: project_id -> { step, error }
_pipeline_progress: dict[int, dict] = {}


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
    _pipeline_progress[project_id] = {"step": 0, "running": True, "error": None}

    # Launch background task
    asyncio.create_task(_run_pipeline(project_id, user.id))

    return {"detail": "Pipeline started", "step": 0}


@router.get("/status")
def get_pipeline_status(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll this endpoint to get pipeline progress."""
    project = _get_project(project_id, user.id, db)

    progress = _pipeline_progress.get(project_id, {})
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
        "studio_port": project.studio_port,
    }


async def _run_pipeline(project_id: int, user_id: int):
    """Full async pipeline running in background."""
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return

        # Step 1: Scrape (skip for upload-based projects)
        if project.status in (ProjectStatus.CREATED,):
            if project.blog_url and project.blog_url.startswith("upload://"):
                # Upload project without pending files — wait for documents
                _set_error(project_id, project, db, "Documents not yet uploaded. Please upload files first.")
                return
            _pipeline_progress[project_id]["step"] = 1
            try:
                scrape_blog(project, db)
            except Exception as e:
                _set_error(project_id, project, db, f"Scraping failed: {e}")
                return

        # Step 2: Generate script (async DSPy)
        if project.status in (ProjectStatus.CREATED, ProjectStatus.SCRAPED):
            _pipeline_progress[project_id]["step"] = 2
            try:
                await _generate_script(project, db)
            except Exception as e:
                _set_error(project_id, project, db, f"Script generation failed: {e}")
                return

        # Step 3: Generate scene descriptors + voiceovers
        if project.status in (ProjectStatus.CREATED, ProjectStatus.SCRAPED, ProjectStatus.SCRIPTED):
            _pipeline_progress[project_id]["step"] = 3
            try:
                await _generate_scenes(project, db)
            except Exception as e:
                _set_error(project_id, project, db, f"Scene generation failed: {e}")
                return

        # Step 4: Done (no more studio launch — frontend handles preview)
        _pipeline_progress[project_id]["step"] = 4
        _pipeline_progress[project_id]["running"] = False

    except Exception as e:
        traceback.print_exc()
        _set_error(project_id, None, db, f"Pipeline error: {e}")
    finally:
        db.close()


def _set_error(project_id: int, project, db: Session, msg: str):
    """Set pipeline error state."""
    print(f"[PIPELINE] Error for project {project_id}: {msg}")
    _pipeline_progress[project_id]["error"] = msg
    _pipeline_progress[project_id]["running"] = False
    if project:
        try:
            db.rollback()  # clear any broken transaction state first
            project.status = ProjectStatus.ERROR
            db.commit()
        except Exception as e:
            print(f"[PIPELINE] Failed to persist error status for project {project_id}: {e}")


async def _generate_script(project: Project, db: Session):
    """Async script generation using DSPy."""
    image_paths = [a.local_path for a in project.assets if a.asset_type.value == "image"]
    hero_image = image_paths[0] if image_paths else ""

    generator = ScriptGenerator()
    result = await generator.generate(
        blog_content=project.blog_content,
        blog_images=image_paths,
        hero_image=hero_image,
        aspect_ratio=getattr(project, "aspect_ratio", "landscape") or "landscape",
    )

    project.name = result["title"]

    db.query(Scene).filter(Scene.project_id == project.id).delete()
    db.flush()

    for i, scene_data in enumerate(result["scenes"]):
        scene = Scene(
            project_id=project.id,
            order=i + 1,
            title=scene_data["title"],
            narration_text=scene_data["narration"],
            visual_description=scene_data["visual_description"],
            duration_seconds=scene_data.get("duration_seconds", 10),
        )
        db.add(scene)

    project.status = ProjectStatus.SCRIPTED
    db.commit()
    db.refresh(project)


async def _generate_scenes(project: Project, db: Session):
    """Generate voiceovers first, then scene layout descriptors, then write Remotion data."""
    scenes = project.scenes
    image_paths = [a.local_path for a in project.assets if a.asset_type.value == "image"]

    # Step 1: Generate voiceovers FIRST (sync, runs in thread)
    # Skip entirely when user chose "no voiceover"
    if getattr(project, "voice_gender", None) == "none":
        print(f"[PIPELINE] Skipping voiceover — no-audio mode for project {project.id}")
        for scene in scenes:
            if scene.narration_text:
                word_count = len(scene.narration_text.split())
                scene.duration_seconds = round(max(5.0, word_count / 2.5) + 1.0, 1)
            else:
                scene.duration_seconds = 5.0
            scene.voiceover_path = None
        db.commit()
    else:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, generate_all_voiceovers, scenes, db)

    # Re-load scenes so we have fresh voiceover_path / duration from the voiceover thread
    db.expire(project)
    scenes = project.scenes

    # Step 2: Generate layout descriptors with TemplateSceneGenerator
    template_id = validate_template_id(getattr(project, "template", "default"))
    scene_gen = TemplateSceneGenerator(template_id)
    image_filenames = [
        a.filename for a in project.assets if a.asset_type.value == "image"
    ]
    scenes_data = [
        {
            "title": s.title,
            "narration": s.narration_text,
            "visual_description": s.visual_description,
        }
        for s in scenes
    ]
    descriptors = await scene_gen.generate_all_scenes(
        scenes_data,
        image_filenames,
        accent_color=project.accent_color or "#7C3AED",
        bg_color=project.bg_color or "#FFFFFF",
        text_color=project.text_color or "#000000",
        animation_instructions=project.animation_instructions or "",
    )

    # Store descriptors as JSON in remotion_code
    for scene, descriptor in zip(scenes, descriptors):
        scene.remotion_code = json.dumps(descriptor)
    db.commit()

    # Step 3: Write data.json + assets to per-project Remotion workspace
    write_remotion_data(project, scenes, db)

    project.status = ProjectStatus.GENERATED
    db.commit()
    db.refresh(project)


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
        project = scrape_blog(project, db)
    except Exception as e:
        project.status = ProjectStatus.ERROR
        db.commit()
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")
    return project


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
        project.status = ProjectStatus.ERROR
        db.commit()
        raise HTTPException(status_code=500, detail=f"Script generation failed: {str(e)}")
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
        project.status = ProjectStatus.ERROR
        db.commit()
        raise HTTPException(status_code=500, detail=f"Scene generation failed: {str(e)}")
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
    if user.plan != PlanTier.PRO and not project.studio_unlocked:
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


@router.post("/render")
def render_video_endpoint(
    project_id: int,
    resolution: str = "1080p",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kick off async video render. Poll /render-status for progress.

    All videos render at 1080p.
    """
    project = _get_project(project_id, user.id, db)

    # Always render at 1080p
    resolution = "1080p"

    # Already rendered and available in R2 — skip re-render
    if project.r2_video_url:
        return {
            "detail": "Already rendered",
            "progress": 100,
            "r2_video_url": project.r2_video_url,
        }

    # Don't restart if already rendering
    prog = get_render_progress(project_id)
    if prog and not prog.get("done", True):
        return {"detail": "Render already running", "progress": prog.get("progress", 0)}

    # Ensure workspace exists (may be missing on Cloud Run if a different
    # container handled the pipeline, or if it was cleaned up after a
    # previous render).
    workspace = get_workspace_dir(project.id)
    if not os.path.exists(os.path.join(workspace, "public", "data.json")):
        scenes = project.scenes
        if not scenes:
            raise HTTPException(status_code=400, detail="No scenes found. Generate the video first.")
        rebuild_workspace(project, scenes, db)

    project.status = ProjectStatus.RENDERING
    db.commit()

    try:
        start_render_async(project, resolution=resolution)
        return {"detail": "Render started", "progress": 0, "resolution": resolution}
    except Exception as e:
        # If render start fails, reset status and return error
        print(f"[RENDER] Failed to start render for project {project_id}: {e}")
        import traceback
        traceback.print_exc()
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

    # If no progress dict exists, check project status to determine state
    if not prog:
        # If project is marked as RENDERING but no progress exists, the render
        # process likely crashed or was lost (e.g. Cloud Run instance restart).
        # Reset status to allow retry.
        if project.status == ProjectStatus.RENDERING:
            print(f"[RENDER] Project {project_id} is RENDERING but no progress found — render was lost, resetting status")
            project.status = ProjectStatus.GENERATED  # Back to pre-render state
            db.commit()
            return {
                "progress": 0,
                "rendered_frames": 0,
                "total_frames": 0,
                "done": False,
                "error": "Render process was lost. Please try rendering again.",
                "time_remaining": None,
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
        "r2_video_url": project.r2_video_url,
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
