from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.project import Project, ProjectStatus
from app.models.scene import Scene
from app.schemas.schemas import (
    ProjectOut,
    GenerateScriptRequest,
    StudioResponse,
    RenderResponse,
)
from app.services.scraper import scrape_blog
from app.services.voiceover import generate_all_voiceovers
from app.services.remotion import (
    write_remotion_data,
    write_scene_components,
    launch_studio,
    render_video,
)
from app.dspy_modules.script_gen import ScriptGenerator
from app.dspy_modules.scene_gen import SceneCodeGenerator

router = APIRouter(prefix="/api/projects/{project_id}", tags=["pipeline"])


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
def generate_script(
    project_id: int,
    body: GenerateScriptRequest = GenerateScriptRequest(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a video script from the scraped blog content using DSPy."""
    project = _get_project(project_id, user.id, db)

    if not project.blog_content:
        raise HTTPException(
            status_code=400,
            detail="Blog content not yet scraped. Call /scrape first.",
        )

    # Get image paths
    image_paths = [a.local_path for a in project.assets if a.asset_type.value == "image"]

    try:
        generator = ScriptGenerator()
        result = generator.generate(
            blog_content=project.blog_content,
            blog_images=image_paths,
            target_duration_minutes=body.target_duration_minutes,
        )

        # Update project name with generated title
        project.name = result["title"]

        # Delete existing scenes and create new ones
        db.query(Scene).filter(Scene.project_id == project_id).delete()
        db.flush()

        for i, scene_data in enumerate(result["scenes"]):
            scene = Scene(
                project_id=project_id,
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

    except Exception as e:
        project.status = ProjectStatus.ERROR
        db.commit()
        raise HTTPException(
            status_code=500, detail=f"Script generation failed: {str(e)}"
        )

    return project


@router.post("/generate-scenes", response_model=ProjectOut)
def generate_scenes(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate Remotion code for each scene and voiceover audio.
    Writes output files to the Remotion project directory.
    """
    project = _get_project(project_id, user.id, db)
    scenes = project.scenes

    if not scenes:
        raise HTTPException(
            status_code=400,
            detail="No scenes found. Call /generate-script first.",
        )

    image_paths = [a.local_path for a in project.assets if a.asset_type.value == "image"]
    total_scenes = len(scenes)

    try:
        # Generate Remotion code for each scene
        scene_gen = SceneCodeGenerator()
        for scene in scenes:
            code = scene_gen.generate_scene_code(
                scene_title=scene.title,
                narration=scene.narration_text,
                visual_description=scene.visual_description,
                available_images=image_paths,
                scene_index=scene.order - 1,
                total_scenes=total_scenes,
            )
            scene.remotion_code = code

        db.commit()

        # Generate voiceovers
        generate_all_voiceovers(scenes, db)

        # Write files to Remotion project
        write_remotion_data(project, scenes, db)
        write_scene_components(scenes)

        project.status = ProjectStatus.GENERATED
        db.commit()
        db.refresh(project)

    except Exception as e:
        project.status = ProjectStatus.ERROR
        db.commit()
        raise HTTPException(
            status_code=500, detail=f"Scene generation failed: {str(e)}"
        )

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
        return StudioResponse(
            studio_url=f"http://localhost:{port}",
            port=port,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to launch studio: {str(e)}"
        )


@router.post("/render", response_model=RenderResponse)
def render_video_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Render the final video using Remotion CLI."""
    project = _get_project(project_id, user.id, db)

    project.status = ProjectStatus.RENDERING
    db.commit()

    try:
        output_path = render_video(project)
        project.status = ProjectStatus.DONE
        db.commit()
        return RenderResponse(output_path=output_path, status="completed")
    except Exception as e:
        project.status = ProjectStatus.ERROR
        db.commit()
        raise HTTPException(
            status_code=500, detail=f"Render failed: {str(e)}"
        )


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
