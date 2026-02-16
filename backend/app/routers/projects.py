import os
import shutil
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.config import settings
from app.models.user import User
from app.models.project import Project, ProjectStatus
from app.schemas.schemas import (
    ProjectCreate, ProjectOut, ProjectListOut, SceneOut, SceneUpdate,
    ReorderScenesRequest, RegenerateSceneRequest
)
from app.services import r2_storage
from app.services.remotion import safe_remove_workspace, get_workspace_dir
from app.services.doc_extractor import extract_from_documents
from app.services.template_service import validate_template_id, get_preview_colors, get_valid_layouts

router = APIRouter(prefix="/api/projects", tags=["projects"])

# ─── Constants ────────────────────────────────────────────
_MAX_UPLOAD_FILES = 5
_MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
_ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",   # .docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
}
_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx"}


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

    if not data.blog_url:
        raise HTTPException(status_code=400, detail="blog_url is required for URL-based project creation.")

    name = data.name or _name_from_url(data.blog_url)
    template_id = validate_template_id(data.template)
    colors = get_preview_colors(template_id)
    project = Project(
        user_id=user.id,
        name=name,
        blog_url=data.blog_url,
        template=template_id,
        voice_gender=data.voice_gender or "female",
        voice_accent=data.voice_accent or "american",
        accent_color=data.accent_color or (colors.get("accent") if colors else None) or "#7C3AED",
        bg_color=data.bg_color or (colors.get("bg") if colors else None) or "#FFFFFF",
        text_color=data.text_color or (colors.get("text") if colors else None) or "#000000",
        animation_instructions=data.animation_instructions or None,
        logo_position=data.logo_position or "bottom_right",
        logo_opacity=data.logo_opacity if data.logo_opacity is not None else 0.9,
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


@router.post("/upload", response_model=ProjectOut)
def create_project_from_upload(
    request: Request,
    files: list[UploadFile] = File(...),
    name: Optional[str] = Form(None),
    voice_gender: Optional[str] = Form("female"),
    voice_accent: Optional[str] = Form("american"),
    accent_color: Optional[str] = Form("#7C3AED"),
    bg_color: Optional[str] = Form("#FFFFFF"),
    text_color: Optional[str] = Form("#000000"),
    animation_instructions: Optional[str] = Form(None),
    logo_position: Optional[str] = Form("bottom_right"),
    logo_opacity: Optional[float] = Form(0.9),
    custom_voice_id: Optional[str] = Form(None),
    aspect_ratio: Optional[str] = Form("landscape"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project from uploaded documents (PDF, DOCX, PPTX). Counts against video limit."""
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
                detail=f"File '{f.filename}' is not supported. Accepted formats: PDF, DOCX, PPTX.",
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
    project = Project(
        user_id=user.id,
        name=project_name,
        blog_url="upload://documents",
        voice_gender=voice_gender or "female",
        voice_accent=voice_accent or "american",
        accent_color=accent_color or "#7C3AED",
        bg_color=bg_color or "#FFFFFF",
        text_color=text_color or "#000000",
        animation_instructions=animation_instructions or None,
        logo_position=logo_position or "bottom_right",
        logo_opacity=logo_opacity if logo_opacity is not None else 0.9,
        custom_voice_id=custom_voice_id or None,
        aspect_ratio=aspect_ratio or "landscape",
        status=ProjectStatus.CREATED,
    )
    db.add(project)
    user.videos_used_this_period += 1
    db.commit()
    db.refresh(project)

    # ── Extract text + images from documents ────────────────
    try:
        project = extract_from_documents(project, files, db)
    except Exception as e:
        print(f"[PROJECTS] Document extraction failed for project {project.id}: {e}")
        project.status = ProjectStatus.ERROR
        db.commit()
        raise HTTPException(status_code=500, detail=f"Document extraction failed: {str(e)}")

    return project


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
                detail=f"File '{f.filename}' is not supported. Accepted formats: PDF, DOCX, PPTX.",
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
        print(f"[PROJECTS] Document extraction failed for project {project.id}: {e}")
        project.status = ProjectStatus.ERROR
        db.commit()
        raise HTTPException(status_code=500, detail=f"Document extraction failed: {str(e)}")

    return project


@router.post("/{project_id}/logo")
def upload_logo(
    project_id: int,
    request: Request,
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
            r2_key = r2_storage.image_key(user.id, project_id, logo_filename)
            r2_url = r2_storage.upload_file(local_path, r2_key, content_type=file.content_type)
            project.logo_r2_key = r2_key
            project.logo_r2_url = r2_url
        except Exception as e:
            print(f"[PROJECTS] Logo R2 upload failed: {e}")
            project.logo_r2_key = None
            project.logo_r2_url = None

    # Fallback: if R2 isn't configured or upload failed, use local serving URL
    if not project.logo_r2_url:
        base = str(request.base_url).rstrip("/")
        project.logo_r2_url = f"{base}/media/projects/{project_id}/{logo_filename}"

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


@router.get("/{project_id}/layouts")
def get_project_layouts(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get valid layouts for a project's template."""
    project = _get_user_project(project_id, user.id, db)
    
    valid_layouts = get_valid_layouts(project.template)
    
    # Convert layout IDs to human-readable names
    layout_names = {}
    for layout_id in valid_layouts:
        # Convert snake_case to Title Case
        name = layout_id.replace("_", " ").title()
        layout_names[layout_id] = name
    
    return {
        "layouts": sorted(list(valid_layouts)),
        "layout_names": layout_names,
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
    
    return sorted_scenes


@router.post("/{project_id}/scenes/{scene_id}/regenerate", response_model=SceneOut)
async def regenerate_scene(
    project_id: int,
    scene_id: int,
    description: str = Form(...),
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
    from app.services.voiceover import generate_voiceover
    from app.services.remotion import rebuild_workspace
    
    project = _get_user_project(project_id, user.id, db)
    
    # Check usage limits
    if user.plan != PlanTier.PRO:
        if project.ai_assisted_editing_count >= 3:
            raise HTTPException(
                status_code=403,
                detail="AI editing limit reached (3 uses per project). Upgrade to Pro for unlimited AI edits."
            )
    
    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    # Validate layout if provided
    normalized_layout = None
    if layout:
        valid_layouts = get_valid_layouts(project.template)
        normalized_layout = layout.strip().lower().replace(" ", "_").replace("-", "_")
        if normalized_layout not in valid_layouts:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid layout '{layout}'. Valid layouts: {', '.join(sorted(valid_layouts))}"
            )
    
    # Handle image upload if provided
    image_filename = None
    if image:
        # Validate file type
        allowed_types = {"image/png", "image/jpeg", "image/webp", "image/jpg"}
        if image.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Image must be PNG, JPEG, or WebP.")
        
        # Read file content
        MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
        file_bytes = image.file.read()
        if len(file_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="Image file too large. Maximum size is 5 MB.")
        
        # Save locally
        image_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project_id}/images")
        os.makedirs(image_dir, exist_ok=True)
        
        ext = image.filename.rsplit(".", 1)[-1] if image.filename and "." in image.filename else "png"
        image_filename = f"scene_{scene_id}_{int(time.time())}.{ext}"
        local_path = os.path.join(image_dir, image_filename)
        
        with open(local_path, "wb") as f:
            f.write(file_bytes)
        
        # Upload to R2 if configured
        r2_key_val = None
        r2_url_val = None
        if r2_storage.is_r2_configured():
            try:
                r2_key_val = r2_storage.image_key(user.id, project_id, image_filename)
                r2_url_val = r2_storage.upload_file(local_path, r2_key_val, content_type=image.content_type)
            except Exception as e:
                print(f"[REGENERATE] R2 upload failed for {image_filename}: {e}")
        
        # Create Asset record
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
    
    # Parse description for removal instructions
    description_lower = description.lower()
    remove_image = any(phrase in description_lower for phrase in [
        "remove image", "no image", "don't show image", "hide image",
        "without image", "no picture", "remove picture"
    ])
    hide_narration = any(phrase in description_lower for phrase in [
        "no narration", "don't show narration", "hide narration",
        "without narration", "remove narration", "no text",
        "don't display narration", "visualization only"
    ])
    
    # Regenerate scene using DSPy
    template_gen = TemplateSceneGenerator(project.template)
    
    # Generate new narration (for now, use description as visual_description enhancement)
    # In a full implementation, you might want a separate DSPy signature for narration regeneration
    new_visual_description = description
    
    # If hiding narration, set it to empty string
    new_narration = "" if hide_narration else scene.narration_text
    
    # Generate layout descriptor
    descriptor = await template_gen.generate_scene_descriptor(
        scene_title=scene.title,
        narration=new_narration,
        visual_description=new_visual_description,
        scene_index=scene.order - 1,
        total_scenes=len(project.scenes),
        preferred_layout=normalized_layout,
    )
    
    # Set hideImage flag in layoutProps if image should be removed
    if remove_image:
        if "layoutProps" not in descriptor:
            descriptor["layoutProps"] = {}
        descriptor["layoutProps"]["hideImage"] = True
        descriptor["layoutProps"].pop("imageUrl", None)
    
    # Update scene
    scene.visual_description = new_visual_description
    scene.narration_text = new_narration
    scene.remotion_code = json.dumps(descriptor)
    
    # Regenerate voiceover
    generate_voiceover(scene, db)
    
    # Increment usage count (only for free users)
    if user.plan != PlanTier.PRO:
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
