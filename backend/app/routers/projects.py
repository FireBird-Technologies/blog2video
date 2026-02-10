import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.config import settings
from app.models.user import User
from app.models.project import Project, ProjectStatus
from app.schemas.schemas import ProjectCreate, ProjectOut, ProjectListOut, SceneOut, SceneUpdate
from app.services import r2_storage
from app.services.remotion import safe_remove_workspace, get_workspace_dir

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectOut)
def create_project(
    data: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project from a blog URL. Counts against video limit."""
    if not user.can_create_video:
        raise HTTPException(
            status_code=403,
            detail=f"Video limit reached ({user.video_limit}). Upgrade to Pro for 100 videos/month.",
        )

    name = data.name or _name_from_url(data.blog_url)
    project = Project(
        user_id=user.id,
        name=name,
        blog_url=data.blog_url,
        voice_gender=data.voice_gender or "female",
        voice_accent=data.voice_accent or "american",
        accent_color=data.accent_color or "#7C3AED",
        bg_color=data.bg_color or "#FFFFFF",
        text_color=data.text_color or "#000000",
        animation_instructions=data.animation_instructions or None,
        logo_position=data.logo_position or "bottom_right",
        custom_voice_id=data.custom_voice_id or None,
        aspect_ratio=data.aspect_ratio or "landscape",
        status=ProjectStatus.CREATED,
    )
    db.add(project)

    # Increment usage counter
    user.videos_used_this_period += 1
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/logo")
def upload_logo(
    project_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a logo image for the project. Stored in R2."""
    project = _get_user_project(project_id, user.id, db)

    # Validate file type
    allowed_types = {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Logo must be PNG, JPEG, WebP, or SVG.")

    # Read file content and enforce size limit (2 MB max)
    MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB
    file_bytes = file.file.read()
    if len(file_bytes) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=400, detail="Logo file too large. Maximum size is 2 MB.")

    # Save locally first
    logo_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}")
    os.makedirs(logo_dir, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "png"
    logo_filename = f"logo.{ext}"
    local_path = os.path.join(logo_dir, logo_filename)

    with open(local_path, "wb") as f:
        f.write(file_bytes)

    # Upload to R2
    if r2_storage.is_r2_configured():
        try:
            r2_key = f"users/{user.id}/projects/{project_id}/{logo_filename}"
            r2_url = r2_storage.upload_file(local_path, r2_key, content_type=file.content_type)
            project.logo_r2_key = r2_key
            project.logo_r2_url = r2_url
        except Exception as e:
            print(f"[PROJECTS] Logo R2 upload failed: {e}")
            # Still keep the local file path
            project.logo_r2_url = None
            project.logo_r2_key = None

    db.commit()
    db.refresh(project)
    return {"logo_url": project.logo_r2_url, "logo_position": project.logo_position}


@router.get("", response_model=list[ProjectListOut])
def list_projects(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all projects for the current user."""
    projects = (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    result = []
    for p in projects:
        item = ProjectListOut(
            id=p.id,
            name=p.name,
            blog_url=p.blog_url,
            status=p.status.value,
            created_at=p.created_at,
            updated_at=p.updated_at,
            scene_count=len(p.scenes),
        )
        result.append(item)
    return result


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single project with all its scenes and assets."""
    project = _get_user_project(project_id, user.id, db)
    return project


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a project and all related data (local + R2 storage)."""
    project = _get_user_project(project_id, user.id, db)

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
    _get_user_project(project_id, user.id, db)

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(scene, key, value)

    db.commit()
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
