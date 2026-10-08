"""Public video API (/api/v1) for apps that create videos on blog2video.

Callers authenticate with a blog2video API key (services/public_api_auth.py).
Every handler resolves the caller to the key holder, who owns and pays for the
videos, and then calls the same router functions the web app uses, the way
extension_integration.py does, so behaviour and live collaboration broadcasts
stay identical.

Access is by ``ApiProjectLink`` only: a caller can reach just the projects it
created through this API. An app serving its own users does so with one key,
so all of its users share one owner here; it tags each video with its user's
id (``external_user_id``) and does its own per-user access control and billing.

Progress is polled (``GET /videos/{id}/status``); ``GET /videos/{id}`` returns
the full project, scenes (with voiceover URLs), assets and a live preview link.
"""

import asyncio
import os
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field, ValidationError, model_validator
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.asset import AssetType
from app.models.project import Project, ProjectStatus
from app.models.public_api import ApiProjectLink
from app.models.user import User
from app.routers import pipeline, projects, video_styles
from app.schemas.schemas import (
    AddSceneRequest,
    ProjectCreate,
    ProjectLanguageChange,
    ProjectOut,
    ProjectTemplateChangeRequest,
    ProjectUpdate,
    ProjectVoiceChange,
    ReorderScenesRequest,
    SceneUpdate,
)
from app.services import embed_player
from app.services.public_api_auth import ApiPrincipal, get_api_principal
from app.services.template_preview_catalog import build_catalog

router = APIRouter(prefix="/api/v1", tags=["public-api"])

MAX_CONTENT_CHARS = 250_000
MAX_METADATA_CHARS = 4_000


# ─── Schemas ────────────────────────────────────────────────────────────────

class VideoCreateIn(BaseModel):
    url: Optional[str] = Field(default=None, max_length=2048)
    content: Optional[str] = Field(default=None, max_length=MAX_CONTENT_CHARS)
    title: Optional[str] = Field(default=None, max_length=255)
    # A built-in id, a crafted template id, or "custom_<id>" for your own.
    template: str = "default"
    video_style: str = "auto"
    video_length: str = "auto"
    aspect_ratio: str = "landscape"
    content_language: Optional[str] = None
    voice_gender: str = "female"
    voice_accent: str = "american"
    custom_voice_id: Optional[str] = Field(default=None, max_length=100)
    accent_color: Optional[str] = None
    bg_color: Optional[str] = None
    text_color: Optional[str] = None
    font_family: Optional[str] = None
    captions_enabled: bool = False
    stock_footage_enabled: bool = False
    # Pause at awaiting_script_review; finish with the script-review endpoints.
    script_review_enabled: bool = False
    # The rest of the web form's options, with ProjectCreate's defaults (which
    # also validates them).
    voice_emotion: Optional[str] = None
    playback_speed: Optional[float] = 1.0
    animation_instructions: Optional[str] = Field(default=None, max_length=4000)
    bgm_track_id: Optional[str] = None
    bgm_volume: Optional[float] = 0.10
    caption_position: Optional[str] = "bottom_center"
    caption_font_family: Optional[str] = "inter"
    caption_font_size: Optional[str] = "36"
    caption_offset: Optional[int] = 0
    logo_position: Optional[str] = "bottom_right"
    logo_opacity: Optional[float] = 0.9
    logo_size: Optional[float] = 100.0
    avatar_shape: Optional[str] = "circle"
    avatar_size: Optional[float] = 0.16
    avatar_position: Optional[str] = "bottom_left"
    avatar_bg: Optional[str] = None
    avatar_opacity: Optional[float] = 1.0
    avatar_shadow: Optional[float] = 0.4
    avatar_motion_style: Optional[str] = "natural"
    # Your own end user's id, to tag the video and filter GET /videos by.
    external_user_id: Optional[str] = Field(default=None, max_length=255)
    metadata: Optional[dict[str, Any]] = None
    idempotency_key: Optional[str] = Field(default=None, min_length=8, max_length=255)

    @model_validator(mode="after")
    def valid_source(self):
        if not self.url and not self.content:
            raise ValueError("Provide url or content")
        if self.url:
            parsed = urlparse(self.url.strip())
            if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError("url must be a valid HTTP or HTTPS URL")
            self.url = self.url.strip()
        if self.content is not None and len(self.content.strip()) < 50:
            raise ValueError("content must contain at least 50 characters")
        if self.content and not self.title:
            raise ValueError("title is required when content is given")
        if self.aspect_ratio not in {"landscape", "portrait"}:
            raise ValueError("aspect_ratio must be landscape or portrait")
        if self.metadata is not None and len(str(self.metadata)) > MAX_METADATA_CHARS:
            raise ValueError("metadata is too large")
        return self


# VideoCreateIn fields passed straight through to ProjectCreate under the same name.
_PROJECT_OPTIONS = frozenset(VideoCreateIn.model_fields) - {
    "url", "content", "title", "external_user_id", "metadata", "idempotency_key",
}
# ProjectCreate fields that _build_project does not store (see create_video).
_POST_CREATE_OPTIONS = frozenset({
    "logo_size", "avatar_shape", "avatar_position", "avatar_bg",
    "avatar_opacity", "avatar_shadow", "avatar_motion_style",
})


class SceneRegenerateIn(BaseModel):
    description: Optional[str] = None
    narration_text: Optional[str] = None
    regenerate_voiceover: bool = False
    layout: Optional[str] = None


# ─── Helpers ────────────────────────────────────────────────────────────────

def _scope(query, principal: ApiPrincipal):
    return query.filter(ApiProjectLink.user_id == principal.owner.id)


def _link(principal: ApiPrincipal, video_id: int, db: Session) -> ApiProjectLink:
    link = _scope(db.query(ApiProjectLink), principal).filter(ApiProjectLink.project_id == video_id).first()
    if link is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return link


def _linked_project(principal: ApiPrincipal, video_id: int, db: Session) -> Project:
    _link(principal, video_id, db)
    project = db.query(Project).filter(Project.id == video_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return project


def _reserve_video(owner: User, db: Session) -> bool:
    """Count one video against the owner's quota, if any is left (uncommitted).

    A conditional UPDATE rather than check-then-increment: one key often serves
    many end users at once, and two concurrent creates must not both take the
    last video. Committed or rolled back together with the new project.
    """
    owner.roll_video_period_if_due(db)
    owner.sync_video_limit_bonus(db)
    limit = owner.video_limit
    taken = db.execute(
        update(User)
        .where(User.id == owner.id, User.videos_used_this_period < limit)
        .values(videos_used_this_period=User.videos_used_this_period + 1)
        .execution_options(synchronize_session=False)
    ).rowcount
    db.expire(owner, ["videos_used_this_period"])
    return bool(taken)


def _voiceover_urls(project: Project) -> dict[str, str]:
    """audio filename -> R2 URL; the latest asset wins after a voiceover redo."""
    urls: dict[str, str] = {}
    for asset in sorted(project.assets or [], key=lambda a: a.id):
        if asset.asset_type == AssetType.AUDIO and asset.r2_url:
            urls[asset.filename] = asset.r2_url
    return urls


def _video_summary(link: ApiProjectLink, project: Optional[Project]) -> dict:
    return {
        "video_id": link.project_id,
        "name": project.name if project else None,
        "status": project.status.value if project else "failed",
        "video_url": project.r2_video_url if project else None,
        "external_user_id": link.external_user_id,
        "metadata": link.metadata_json,
        "created_at": link.created_at,
    }


# ─── Account & catalog ──────────────────────────────────────────────────────

@router.get("/me")
def me(principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db)):
    user = principal.owner
    user.roll_video_period_if_due(db)
    user.sync_video_limit_bonus(db)
    return {
        "type": "api_key",
        "email": user.email,
        "plan": user.plan.value if hasattr(user.plan, "value") else str(user.plan),
        "videos_used": user.videos_used_this_period,
        "video_limit": user.video_limit,
        # Purchased per-video credits, already included in video_limit.
        "video_credits": user.video_limit_bonus or 0,
        "videos_remaining": max(0, user.video_limit - user.videos_used_this_period),
        "can_create_video": user.can_create_video,
    }


@router.get("/catalog")
def catalog(principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db)):
    response = build_catalog(principal.owner.id, db)
    response["video_styles"] = video_styles.video_styles_response(principal.owner, db)
    return response


# ─── Create & read ──────────────────────────────────────────────────────────

@router.post("/videos", status_code=status.HTTP_202_ACCEPTED)
async def create_video(
    data: VideoCreateIn,
    idempotency_header: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    principal: ApiPrincipal = Depends(get_api_principal),
    db: Session = Depends(get_db),
):
    owner = principal.owner
    key = idempotency_header or data.idempotency_key

    if key:
        existing = (
            db.query(ApiProjectLink)
            .filter(ApiProjectLink.user_id == owner.id, ApiProjectLink.idempotency_key == key)
            .first()
        )
        if existing is not None:
            return {"video_id": existing.project_id, "state": "existing"}

    # Validate the options before charging anything.
    try:
        create = ProjectCreate(
            **data.model_dump(include=_PROJECT_OPTIONS),
            blog_url=data.url,
            name=data.title,
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors(include_url=False, include_context=False))

    # Charge first, so two concurrent requests cannot both take the last video.
    if not _reserve_video(owner, db):
        db.rollback()
        raise HTTPException(status_code=402, detail={"error": "quota_exceeded", "video_limit": owner.video_limit})

    try:
        # _build_project rather than projects.create_project: the latter reuses
        # any in-flight project with the same URL for the same owner, and all of
        # an API caller's end users share one owner, so it would hand one end
        # user another's video.
        project = projects._build_project(
            create,
            owner,
            db,
            name=data.title or projects._name_from_url(data.url),
            blog_url=data.url,
        )
        # _build_project leaves these to a later PATCH (the web app sets them from
        # the editor); an API caller sends them up front. Only the ones it sent.
        for field in _POST_CREATE_OPTIONS & data.model_fields_set:
            setattr(project, field, getattr(create, field))
        if data.content:
            # The caller supplied the text, so skip the scrape stage.
            project.blog_content = data.content
            project.status = ProjectStatus.SCRAPED
        db.add(
            ApiProjectLink(
                project_id=project.id,
                user_id=owner.id,
                api_key_id=principal.api_key.id,
                external_user_id=data.external_user_id,
                metadata_json=data.metadata,
                idempotency_key=key,
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        duplicate = (
            db.query(ApiProjectLink)
            .filter(ApiProjectLink.user_id == owner.id, ApiProjectLink.idempotency_key == key)
            .first()
            if key
            else None
        )
        if duplicate is not None:
            return {"video_id": duplicate.project_id, "state": "existing"}
        raise HTTPException(status_code=409, detail="Could not create video")
    except Exception:
        db.rollback()
        raise

    pipeline.start_pipeline_background(project.id, owner.id, asyncio.get_running_loop())
    return {"video_id": project.id, "state": "queued"}


@router.get("/videos")
def list_videos(
    external_user_id: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    before_id: Optional[int] = None,
    principal: ApiPrincipal = Depends(get_api_principal),
    db: Session = Depends(get_db),
):
    query = _scope(db.query(ApiProjectLink), principal)
    if external_user_id:
        query = query.filter(ApiProjectLink.external_user_id == external_user_id)
    if before_id:
        query = query.filter(ApiProjectLink.project_id < before_id)
    links = query.order_by(ApiProjectLink.project_id.desc()).limit(limit).all()
    projects_by_id = {
        p.id: p for p in db.query(Project).filter(Project.id.in_([l.project_id for l in links])).all()
    } if links else {}
    items = [_video_summary(l, projects_by_id.get(l.project_id)) for l in links]
    return {"items": items, "next_before_id": links[-1].project_id if len(links) == limit else None}


@router.get("/videos/{video_id}/status")
def video_status(video_id: int, principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db)):
    _link(principal, video_id, db)
    project = db.query(Project).filter(Project.id == video_id).first()
    if project is None:
        # The pipeline deletes a failed project's row outright.
        return {"video_id": video_id, "status": "failed", "running": False, "error": "Video generation failed"}
    result = pipeline.get_pipeline_status(video_id, user=principal.owner, db=db)
    result["video_id"] = video_id
    result["video_url"] = project.r2_video_url
    result["ready"] = project.status in (ProjectStatus.GENERATED, ProjectStatus.DONE)
    return result


@router.get("/videos/{video_id}")
def get_video(video_id: int, principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db)):
    """The full video: project, scenes (with voiceover URLs), assets and preview."""
    link = _link(principal, video_id, db)
    project = db.query(Project).filter(Project.id == video_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Video generation failed and the video was removed")

    prepared = projects.get_project(video_id, user=principal.owner, db=db)
    payload = ProjectOut.model_validate(prepared).model_dump(mode="json")
    audio = _voiceover_urls(project)
    for scene in payload.get("scenes") or []:
        path = scene.get("voiceover_path")
        scene["voiceover_url"] = audio.get(os.path.basename(path.replace("\\", "/"))) if path else None

    token = embed_player.ensure_embed_token(project, db)
    return {
        "video_id": video_id,
        "status": project.status.value,
        "ready": project.status in (ProjectStatus.GENERATED, ProjectStatus.DONE),
        "preview_url": embed_player.preview_url(token),
        "embed_html": embed_player.embed_iframe_html(token, project.aspect_ratio),
        "video_url": project.r2_video_url,
        "external_user_id": link.external_user_id,
        "metadata": link.metadata_json,
        "project": payload,
    }


# ─── Edits ──────────────────────────────────────────────────────────────────
# Each wraps the web app's own endpoint, so edits broadcast to the live preview.

@router.patch("/videos/{video_id}")
def update_video(
    video_id: int, data: ProjectUpdate,
    principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    updated = projects.update_project(video_id, data, user=principal.owner, db=db)
    return ProjectOut.model_validate(updated).model_dump(mode="json")


@router.patch("/videos/{video_id}/scenes/{scene_id}")
def update_scene(
    video_id: int, scene_id: int, data: SceneUpdate,
    principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return projects.update_scene(video_id, scene_id, data, user=principal.owner, db=db)


@router.delete("/videos/{video_id}/scenes/{scene_id}", status_code=204)
def delete_scene(
    video_id: int, scene_id: int,
    principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    projects.delete_scene(video_id, scene_id, user=principal.owner, db=db)


@router.post("/videos/{video_id}/scenes/reorder")
def reorder_scenes(
    video_id: int, data: ReorderScenesRequest,
    principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return projects.reorder_scenes(video_id, data, user=principal.owner, db=db)


@router.post("/videos/{video_id}/scenes/{scene_id}/regenerate")
async def regenerate_scene(
    video_id: int, scene_id: int, data: SceneRegenerateIn,
    principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return await projects.regenerate_scene(
        video_id,
        scene_id,
        description=data.description,
        narration_text=data.narration_text,
        regenerate_voiceover="true" if data.regenerate_voiceover else "false",
        voiceover_verbatim="true",
        layout=data.layout,
        image=None,
        user=principal.owner,
        db=db,
    )


@router.post("/videos/{video_id}/scenes", status_code=202)
async def add_scene(
    video_id: int, data: AddSceneRequest,
    principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return await projects.add_scene(video_id, data, user=principal.owner, db=db)


@router.get("/videos/{video_id}/scenes/add-status")
async def add_scene_status(
    video_id: int, principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return await projects.get_add_scene_status(video_id, user=principal.owner, db=db)


@router.post("/videos/{video_id}/template", status_code=202)
async def change_template(
    video_id: int, body: ProjectTemplateChangeRequest,
    principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return await projects.change_project_template_regenerate_layouts(video_id, body, user=principal.owner, db=db)


@router.get("/videos/{video_id}/template")
def template_change_status(
    video_id: int, principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return projects.get_project_template_change_status(video_id, user=principal.owner, db=db)


@router.post("/videos/{video_id}/voice", status_code=202)
async def change_voice(
    video_id: int, body: ProjectVoiceChange, background_tasks: BackgroundTasks,
    principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return await projects.change_project_voice(video_id, body, background_tasks, user=principal.owner, db=db)


@router.get("/videos/{video_id}/voice")
def voice_change_status(
    video_id: int, principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return projects.voice_change_status(video_id, user=principal.owner, db=db)


@router.post("/videos/{video_id}/language", status_code=202)
async def change_language(
    video_id: int, body: ProjectLanguageChange,
    principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return await projects.change_project_language(video_id, body, user=principal.owner, db=db)


@router.get("/videos/{video_id}/language")
def language_change_status(
    video_id: int, principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return projects.language_change_status(video_id, user=principal.owner, db=db)


@router.post("/videos/{video_id}/stock-footage/approve")
async def approve_stock_footage(
    video_id: int, principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    """Accept the auto-picked clips of a video parked at awaiting_stock_footage_review."""
    _linked_project(principal, video_id, db)
    return await pipeline.approve_stock_footage(video_id, user=principal.owner, db=db)


# ─── Render ─────────────────────────────────────────────────────────────────

@router.post("/videos/{video_id}/render", status_code=202)
async def render_video(
    video_id: int, resolution: str = "1080p",
    principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return await pipeline.render_video_endpoint(
        video_id, resolution=resolution, force_render=True, user=principal.owner, db=db
    )


@router.get("/videos/{video_id}/render")
def render_status(
    video_id: int, principal: ApiPrincipal = Depends(get_api_principal), db: Session = Depends(get_db),
):
    _linked_project(principal, video_id, db)
    return pipeline.render_status_endpoint(video_id, user=principal.owner, db=db)
