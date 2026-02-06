import os
import asyncio
import traceback
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.auth import get_current_user
from app.models.user import User
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
    write_scene_components,
    launch_studio,
    render_video,
    start_render_async,
    get_render_progress,
)
from app.dspy_modules.script_gen import ScriptGenerator
from app.dspy_modules.scene_gen import SceneCodeGenerator

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
    Kick off the full pipeline (scrape -> script -> scenes -> studio).
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
    return {
        "status": project.status.value,
        "step": progress.get("step", 0),
        "running": progress.get("running", False),
        "error": progress.get("error"),
        "studio_port": project.studio_port,
        "player_port": project.player_port,
    }


async def _run_pipeline(project_id: int, user_id: int):
    """Full async pipeline running in background."""
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return

        # Step 1: Scrape
        if project.status in (ProjectStatus.CREATED,):
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

        # Step 3: Generate scene code + voiceovers (async DSPy for code, sync for voiceovers)
        if project.status in (ProjectStatus.CREATED, ProjectStatus.SCRAPED, ProjectStatus.SCRIPTED):
            _pipeline_progress[project_id]["step"] = 3
            try:
                await _generate_scenes(project, db)
            except Exception as e:
                _set_error(project_id, project, db, f"Scene generation failed: {e}")
                return

        # Step 4: Launch studio
        _pipeline_progress[project_id]["step"] = 4
        try:
            launch_studio(project, db)
        except Exception as e:
            print(f"[PIPELINE] Studio launch failed (non-fatal): {e}")

        # Done
        _pipeline_progress[project_id]["step"] = 5
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
        project.status = ProjectStatus.ERROR
        db.commit()


async def _generate_script(project: Project, db: Session):
    """Async script generation using DSPy."""
    image_paths = [a.local_path for a in project.assets if a.asset_type.value == "image"]
    hero_image = image_paths[0] if image_paths else ""

    generator = ScriptGenerator()
    result = await generator.generate(
        blog_content=project.blog_content,
        blog_images=image_paths,
        hero_image=hero_image,
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
    """Generate voiceovers first, then scene code (async), then write Remotion files."""
    scenes = project.scenes
    image_paths = [a.local_path for a in project.assets if a.asset_type.value == "image"]

    # Step 1: Generate voiceovers FIRST (sync, runs in thread)
    # Voiceovers must be done before writing Remotion data so audio files
    # are available when data.json is built.
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, generate_all_voiceovers, scenes, db)

    # Refresh scenes to pick up voiceover_path set by generate_all_voiceovers
    for scene in scenes:
        db.refresh(scene)

    # Step 2: Generate all Remotion scene code concurrently with async DSPy
    # IMPORTANT: Pass image FILENAMES (not absolute paths) — these resolve
    # via staticFile() in Remotion's public/ folder.
    scene_gen = SceneCodeGenerator()
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
    codes = await scene_gen.generate_all_scenes(
        scenes_data,
        image_filenames,
        accent_color=project.accent_color or "#7C3AED",
        bg_color=project.bg_color or "#0A0A0A",
        text_color=project.text_color or "#FFFFFF",
        animation_instructions=project.animation_instructions or "",
    )

    for scene, code in zip(scenes, codes):
        scene.remotion_code = code
    db.commit()

    # Step 3: Write files to per-project Remotion workspace (data.json + scene components)
    write_remotion_data(project, scenes, db)
    write_scene_components(project, scenes)

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
    """Generate Remotion code + voiceovers for each scene (async)."""
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
    """Launch Remotion Studio for this project."""
    project = _get_project(project_id, user.id, db)
    try:
        port = launch_studio(project, db)
        return StudioResponse(studio_url=f"http://localhost:{port}", port=port)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to launch studio: {str(e)}")


@router.post("/render")
def render_video_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kick off async video render. Poll /render-status for progress."""
    project = _get_project(project_id, user.id, db)

    # Don't restart if already rendering
    prog = get_render_progress(project_id)
    if prog and not prog.get("done", True):
        return {"detail": "Render already running", "progress": prog.get("progress", 0)}

    project.status = ProjectStatus.RENDERING
    db.commit()

    start_render_async(project)
    return {"detail": "Render started", "progress": 0}


@router.get("/render-status")
def render_status_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll this endpoint to get render progress."""
    project = _get_project(project_id, user.id, db)
    prog = get_render_progress(project_id)

    if not prog:
        return {
            "progress": 0,
            "rendered_frames": 0,
            "total_frames": 0,
            "done": project.status == ProjectStatus.DONE,
            "error": None,
            "time_remaining": None,
        }

    # If render just finished, update project status
    if prog.get("done") and not prog.get("error") and project.status == ProjectStatus.RENDERING:
        project.status = ProjectStatus.DONE
        db.commit()

    return {
        "progress": prog.get("progress", 0),
        "rendered_frames": prog.get("rendered_frames", 0),
        "total_frames": prog.get("total_frames", 0),
        "done": prog.get("done", False),
        "error": prog.get("error"),
        "time_remaining": prog.get("time_remaining"),
    }


@router.get("/download")
def download_video(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download the rendered MP4 video file."""
    project = _get_project(project_id, user.id, db)
    output_path = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}/output/video.mp4")
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Video not rendered yet.")
    safe_name = project.name.replace(" ", "_")[:50] if project.name else "video"
    return FileResponse(path=output_path, media_type="video/mp4", filename=f"{safe_name}.mp4")


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
