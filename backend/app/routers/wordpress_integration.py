"""Public WordPress connector API.

The plugin uses an OAuth-device-style handshake: it starts a pending connection,
the account owner approves a short code in the Blog2Video web app, and the
plugin retrieves a site-scoped opaque token exactly once.
"""

import asyncio
import hashlib
import re
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.project import Project, ProjectStatus
from app.models.project_member import MemberStatus, ProjectMember
from app.models.saved_voice import SavedVoice
from app.models.scene import Scene
from app.models.user import User
from app.models.wordpress_integration import WordPressConnection, WordPressProjectLink
from app.routers import embed, pipeline, projects
from app.schemas.schemas import (
    AddSceneRequest,
    ProjectCreate,
    ProjectLogoUpdate,
    ProjectUpdate,
    ReorderScenesRequest,
    SceneUpdate,
)
from app.services.background_music import get_all_tracks
from app.services.language_detection import normalize_preferred_language_code
from app.services.template_preview_catalog import build_catalog

router = APIRouter(prefix="/api/integrations/wordpress/v1", tags=["wordpress-integration"])
optional_bearer = HTTPBearer(auto_error=False)

CONNECTION_TTL_MINUTES = 15
MAX_CONTENT_CHARS = 250_000


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _normalize_site_url(raw: str) -> str:
    value = raw.strip().rstrip("/")
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").lower()
    # LocalWP uses reserved *.local hostnames. Permit plain HTTP only for these
    # development-only names and explicit loopback/Docker hosts; every public
    # WordPress origin must still use HTTPS.
    local = hostname in {"localhost", "127.0.0.1", "host.docker.internal"} or hostname.endswith(".local")
    if parsed.scheme != "https" and not (local and parsed.scheme == "http"):
        raise ValueError("site_url must use HTTPS")
    if not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("site_url must be a valid public WordPress origin")
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ValueError("site_url must contain only the site origin")
    return value


def _user_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


class ConnectionBeginIn(BaseModel):
    site_url: str
    site_name: str = Field(default="WordPress site", max_length=255)

    @field_validator("site_url")
    @classmethod
    def valid_site_url(cls, value: str) -> str:
        return _normalize_site_url(value)


class ConnectionTokenIn(BaseModel):
    connection_id: int
    device_code: str = Field(min_length=32, max_length=255)


class ConnectionApproveIn(BaseModel):
    user_code: str = Field(min_length=8, max_length=16)


class WordPressProjectIn(BaseModel):
    external_post_id: str = Field(min_length=1, max_length=100)
    idempotency_key: str = Field(min_length=8, max_length=255)
    content_hash: str = Field(min_length=16, max_length=80)
    title: str = Field(min_length=1, max_length=255)
    canonical_url: str = Field(min_length=1, max_length=2048)
    source_type: str = "post"
    source_url: str | None = Field(default=None, max_length=2048)
    content: str | None = Field(default=None, max_length=MAX_CONTENT_CHARS)
    template: str = "default"
    video_style: str = "auto"
    video_length: str = "auto"
    aspect_ratio: str = "landscape"
    voice_gender: str = "female"
    voice_accent: str = "american"
    custom_voice_id: str | None = Field(default=None, max_length=100)
    content_language: str | None = None
    captions_enabled: bool = False
    stock_footage_enabled: bool = False

    @model_validator(mode="after")
    def valid_source(self):
        if self.source_type not in {"post", "url"}:
            raise ValueError("source_type must be post or url")
        if self.source_type == "post":
            if not self.content or len(self.content.strip()) < 50:
                raise ValueError("content must contain at least 50 characters for post source")
            self.source_url = None
            return self

        value = (self.source_url or "").strip()
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("source_url must be a valid HTTP or HTTPS URL")
        self.source_url = value
        self.content = None
        return self

    @field_validator("aspect_ratio")
    @classmethod
    def valid_aspect_ratio(cls, value: str) -> str:
        if value not in {"landscape", "portrait"}:
            raise ValueError("aspect_ratio must be landscape or portrait")
        return value


class WordPressSceneRegenerateIn(BaseModel):
    description: str | None = Field(default=None, max_length=4000)
    narration_text: str | None = Field(default=None, max_length=20_000)
    layout: str | None = Field(default=None, max_length=100)
    regenerate_voiceover: bool = False
    voiceover_verbatim: bool = True


class WordPressScriptRegenerateIn(BaseModel):
    user_instruction: str = Field(min_length=1, max_length=25_000)


class WordPressProjectSettingsIn(BaseModel):
    """Narrow, WordPress-facing subset of ProjectUpdate.

    Deliberately excludes avatar_*/playback_speed/aspect_ratio/video_length —
    the plugin only surfaces colors, font, captions and background music.
    """

    accent_color: str | None = None
    bg_color: str | None = None
    text_color: str | None = None
    font_family: str | None = None
    captions_enabled: bool | None = None
    caption_font_family: str | None = None
    caption_font_size: str | int | None = None
    caption_offset: int | None = None
    bgm_track_id: str | None = None
    bgm_volume: float | None = None


class WordPressProjectLinkIn(BaseModel):
    external_post_id: str = Field(min_length=1, max_length=100)


def get_wordpress_connection(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
    db: Session = Depends(get_db),
) -> WordPressConnection:
    if credentials is None or not credentials.credentials.startswith("b2v_wp_"):
        raise HTTPException(status_code=401, detail="Invalid WordPress connection token")
    row = (
        db.query(WordPressConnection)
        .filter(
            WordPressConnection.access_token_hash == _hash(credentials.credentials),
            WordPressConnection.status == "active",
        )
        .first()
    )
    if row is None or row.user_id is None:
        raise HTTPException(status_code=401, detail="Invalid WordPress connection token")
    row.last_used_at = datetime.utcnow()
    db.commit()
    return row


def _connection_user(connection: WordPressConnection, db: Session) -> User:
    user = db.query(User).filter(User.id == connection.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Connected Blog2Video account is unavailable")
    return user


def _belongs_to_site(url: str, site_url: str) -> bool:
    """Keep a site token from attributing another site's URL to its projects."""
    candidate = urlparse(url)
    site = urlparse(site_url)
    return (
        candidate.scheme in {"http", "https"}
        and candidate.scheme == site.scheme
        and candidate.hostname == site.hostname
        and (candidate.port or (443 if candidate.scheme == "https" else 80))
        == (site.port or (443 if site.scheme == "https" else 80))
        and not candidate.username
        and not candidate.password
    )


def _linked_project(connection: WordPressConnection, project_id: int, db: Session) -> tuple[Project, User]:
    link = (
        db.query(WordPressProjectLink)
        .filter(
            WordPressProjectLink.connection_id == connection.id,
            WordPressProjectLink.project_id == project_id,
        )
        .first()
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Project not found")
    project = db.query(Project).filter(Project.id == project_id, Project.is_active.is_(True)).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project, _connection_user(connection, db)


@router.post("/connections/begin", status_code=201)
def begin_connection(data: ConnectionBeginIn, db: Session = Depends(get_db)):
    device_code = secrets.token_urlsafe(48)
    code = _user_code()
    while db.query(WordPressConnection).filter(WordPressConnection.user_code == code).first():
        code = _user_code()
    row = WordPressConnection(
        site_url=data.site_url,
        site_name=data.site_name.strip() or "WordPress site",
        device_code_hash=_hash(device_code),
        user_code=code,
        status="pending",
        expires_at=datetime.utcnow() + timedelta(minutes=CONNECTION_TTL_MINUTES),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    frontend = (settings.FRONTEND_URL.split(",")[0] or "http://localhost:5173").rstrip("/")
    return {
        "connection_id": row.id,
        "device_code": device_code,
        "user_code": code,
        "verification_url": f"{frontend}/wordpress-connect?code={code}",
        "expires_in": CONNECTION_TTL_MINUTES * 60,
    }


@router.post("/connections/approve")
def approve_connection(
    data: ConnectionApproveIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code = re.sub(r"[^A-Z0-9]", "", data.user_code.upper())
    row = db.query(WordPressConnection).filter(WordPressConnection.user_code == code).first()
    if row is None or row.status != "pending":
        raise HTTPException(status_code=404, detail="Connection code not found")
    if row.expires_at < datetime.utcnow():
        row.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Connection code expired")
    token = "b2v_wp_" + secrets.token_urlsafe(48)
    row.user_id = user.id
    row.access_token_hash = _hash(token)
    row.pending_access_token = token
    row.status = "approved"
    row.approved_at = datetime.utcnow()
    db.commit()
    return {"connected": True, "site_url": row.site_url, "site_name": row.site_name}


@router.get("/connections/pending/{user_code}")
def pending_connection(user_code: str, db: Session = Depends(get_db)):
    """Show the site identity before the account owner grants access."""
    code = re.sub(r"[^A-Z0-9]", "", user_code.upper())
    row = db.query(WordPressConnection).filter(WordPressConnection.user_code == code).first()
    if row is None or row.status != "pending":
        raise HTTPException(status_code=404, detail="Connection code not found")
    if row.expires_at < datetime.utcnow():
        row.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Connection code expired")
    return {"site_url": row.site_url, "site_name": row.site_name, "expires_at": row.expires_at}


@router.post("/connections/token")
def exchange_connection_token(data: ConnectionTokenIn, db: Session = Depends(get_db)):
    row = db.query(WordPressConnection).filter(WordPressConnection.id == data.connection_id).first()
    if row is None or not secrets.compare_digest(row.device_code_hash, _hash(data.device_code)):
        raise HTTPException(status_code=401, detail="Invalid connection request")
    if row.expires_at < datetime.utcnow() and row.status == "pending":
        row.status = "expired"
        db.commit()
    if row.status == "pending":
        return {"status": "authorization_pending"}
    if row.status == "expired":
        raise HTTPException(status_code=410, detail="Connection code expired")
    if row.status not in {"approved", "active"} or not row.pending_access_token:
        raise HTTPException(status_code=409, detail="Connection token was already collected")
    token = row.pending_access_token
    row.pending_access_token = None
    row.status = "active"
    db.commit()
    return {"status": "connected", "access_token": token, "connection_id": row.id}


@router.get("/account")
def account(
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    user = _connection_user(connection, db)
    user.roll_video_period_if_due(db)
    user.sync_video_limit_bonus(db)
    return {
        "email": user.email,
        "name": user.name,
        "plan": user.plan.value if hasattr(user.plan, "value") else str(user.plan),
        "videos_used": user.videos_used_this_period,
        "video_limit": user.video_limit,
        "can_create_video": user.can_create_video,
        "site_url": connection.site_url,
        "ai_edit_credits_available": user.ai_edit_credits_available,
    }


@router.get("/catalog")
def catalog(
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    return build_catalog(connection.user_id, db)


@router.get("/library/projects")
def wordpress_project_library(
    page: int = 1,
    per_page: int = 20,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    """Paginated project list for the WordPress "Choose a video" picker.

    Deliberately does NOT reuse projects.list_projects(): that helper filters
    on `Project.id.in_(shared_ids)` where shared_ids can be a large Python set
    (every accepted collaboration across every project), which is fast as raw
    SQL but measured 50s+ through the ORM for accounts with 100+ projects —
    comfortably over WordPress's 30s wp_safe_remote_request() timeout. This
    endpoint paginates at the DB level and only resolves scene counts for the
    current page's project ids, so the "IN" list stays small regardless of
    how many total projects/collaborations the account has.
    """
    user = _connection_user(connection, db)
    page = max(1, page)
    per_page = max(1, min(50, per_page))

    shared_ids_query = db.query(ProjectMember.project_id).filter(
        ProjectMember.user_id == user.id,
        ProjectMember.status == MemberStatus.ACCEPTED,
    )
    ownership_filter = or_(Project.user_id == user.id, Project.id.in_(shared_ids_query))

    base_query = db.query(Project).filter(Project.is_active == True, ownership_filter)  # noqa: E712
    total = base_query.count()
    rows = (
        base_query.order_by(Project.created_at.desc())
        .limit(per_page)
        .offset((page - 1) * per_page)
        .all()
    )

    page_ids = [row.id for row in rows]
    scene_counts = dict(
        db.query(Scene.project_id, func.count(Scene.id))
        .filter(Scene.project_id.in_(page_ids), Scene.is_active == True)  # noqa: E712
        .group_by(Scene.project_id)
        .all()
    ) if page_ids else {}
    linked_ids = {
        project_id
        for (project_id,) in db.query(WordPressProjectLink.project_id).filter(
            WordPressProjectLink.connection_id == connection.id,
            WordPressProjectLink.project_id.in_(page_ids),
        )
    } if page_ids else set()
    owner_ids = {row.user_id for row in rows if row.user_id != user.id}
    owner_names = {
        u.id: u.name for u in db.query(User).filter(User.id.in_(owner_ids)).all()
    } if owner_ids else {}

    items = [
        {
            "id": row.id,
            "name": row.name,
            "status": row.status.value if hasattr(row.status, "value") else str(row.status),
            "scene_count": scene_counts.get(row.id, 0),
            "updated_at": row.updated_at,
            "aspect_ratio": row.aspect_ratio,
            "has_video": bool(row.r2_video_url),
            "linked_to_site": row.id in linked_ids,
            "role": "owner" if row.user_id == user.id else "editor",
            "owner_name": None if row.user_id == user.id else owner_names.get(row.user_id),
        }
        for row in rows
    ]
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.post("/library/projects/{project_id}/link")
def wordpress_link_library_project(
    project_id: int,
    data: WordPressProjectLinkIn,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    """Authorize this WordPress connection to use an existing account project."""
    user = _connection_user(connection, db)
    project = projects._get_user_project(project_id, user.id, db)
    existing = db.query(WordPressProjectLink).filter(WordPressProjectLink.project_id == project_id).first()
    if existing and existing.connection_id != connection.id:
        raise HTTPException(status_code=409, detail="This project is linked to another WordPress site")
    if existing is None:
        fingerprint = _hash(f"library|{connection.id}|{data.external_post_id}|{project_id}")
        existing = WordPressProjectLink(
            connection_id=connection.id,
            project_id=project_id,
            external_post_id=data.external_post_id,
            content_hash=fingerprint,
            idempotency_key=f"wp-library-{fingerprint}",
        )
        db.add(existing)
        db.commit()
    return {
        "project_id": project.id,
        "name": project.name,
        "status": project.status.value if hasattr(project.status, "value") else str(project.status),
        "aspect_ratio": project.aspect_ratio,
        "has_video": bool(project.r2_video_url),
    }


@router.post("/projects", status_code=status.HTTP_202_ACCEPTED)
async def create_wordpress_project(
    data: WordPressProjectIn,
    idempotency_header: str | None = Header(default=None, alias="Idempotency-Key"),
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    user = _connection_user(connection, db)
    key = idempotency_header or data.idempotency_key
    if not _belongs_to_site(data.canonical_url, connection.site_url):
        raise HTTPException(status_code=400, detail="canonical_url must belong to the connected WordPress site")
    if data.custom_voice_id:
        saved_voice = (
            db.query(SavedVoice)
            .filter(SavedVoice.user_id == user.id, SavedVoice.voice_id == data.custom_voice_id)
            .first()
        )
        if saved_voice is None:
            raise HTTPException(status_code=400, detail="Selected voice is not available to this account")
    existing = db.query(WordPressProjectLink).filter(WordPressProjectLink.idempotency_key == key).first()
    if existing:
        if existing.connection_id != connection.id:
            raise HTTPException(status_code=409, detail="Idempotency key already used")
        return {"project_id": existing.project_id, "state": "existing"}
    # A video is generated for a given WordPress post exactly once. Any prior
    # link for this post on this connection — regardless of whether the post's
    # content has since changed — means generation already happened; hand back
    # that same project instead of ever creating a second one. To make a
    # different video, the user creates a new post/project rather than
    # "regenerating" this one in place.
    existing_revision = (
        db.query(WordPressProjectLink)
        .filter(
            WordPressProjectLink.connection_id == connection.id,
            WordPressProjectLink.external_post_id == data.external_post_id,
        )
        .order_by(WordPressProjectLink.id.desc())
        .first()
    )
    if existing_revision:
        return {"project_id": existing_revision.project_id, "state": "existing"}

    project_source_url = data.source_url if data.source_type == "url" else data.canonical_url
    created = projects.create_project(
        ProjectCreate(
            blog_url=project_source_url,
            name=data.title,
            template=data.template,
            video_style=data.video_style,
            video_length=data.video_length,
            aspect_ratio=data.aspect_ratio,
            voice_gender=data.voice_gender,
            voice_accent=data.voice_accent,
            custom_voice_id=data.custom_voice_id,
            content_language=normalize_preferred_language_code(data.content_language),
            captions_enabled=data.captions_enabled,
            stock_footage_enabled=data.stock_footage_enabled,
        ),
        user=user,
        db=db,
    )
    project = db.query(Project).filter(Project.id == created.id).first()
    if project is None:
        raise HTTPException(status_code=500, detail="Project creation failed")
    if data.source_type == "post":
        # The content came directly from WordPress, so mark the scrape stage complete.
        project.blog_content = data.content
        project.status = ProjectStatus.SCRAPED
    link = WordPressProjectLink(
        connection_id=connection.id,
        project_id=project.id,
        external_post_id=data.external_post_id,
        content_hash=data.content_hash,
        idempotency_key=key,
    )
    db.add(link)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        duplicate = db.query(WordPressProjectLink).filter(WordPressProjectLink.idempotency_key == key).first()
        if duplicate:
            return {"project_id": duplicate.project_id, "state": "existing"}
        raise

    pipeline.start_pipeline_background(project.id, user.id, asyncio.get_running_loop())
    return {
        "project_id": project.id,
        "state": "queued",
        "editor_available": True,
    }


@router.get("/projects/{project_id}/status")
def project_status(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    project, user = _linked_project(connection, project_id, db)
    result = pipeline.get_pipeline_status(project_id, user=user, db=db)
    result["project_id"] = project_id
    result["r2_video_url"] = project.r2_video_url
    result["editor_available"] = True
    return result


@router.get("/projects/{project_id}/editor")
def wordpress_project_editor(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return projects.get_project(project_id, user=user, db=db)


@router.get("/projects/{project_id}/layouts")
def wordpress_project_layouts(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return projects.get_project_layouts(project_id, user=user, db=db)


@router.post("/projects/{project_id}/logo")
async def wordpress_upload_logo(
    project_id: int,
    request: Request,
    file: UploadFile = File(...),
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return projects.upload_logo(project_id, request, file=file, user=user, db=db)


@router.delete("/projects/{project_id}/logo")
def wordpress_delete_logo(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return projects.delete_logo(project_id, user=user, db=db)


@router.patch("/projects/{project_id}/logo")
def wordpress_update_logo(
    project_id: int,
    data: ProjectLogoUpdate,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return projects.update_project_logo(project_id, data, user=user, db=db)


@router.get("/background-music/tracks")
def wordpress_bgm_tracks(
    connection: WordPressConnection = Depends(get_wordpress_connection),
):
    return get_all_tracks()


@router.patch("/projects/{project_id}/settings")
def wordpress_update_project_settings(
    project_id: int,
    data: WordPressProjectSettingsIn,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    update = ProjectUpdate(**data.model_dump(exclude_unset=True))
    return projects.update_project(project_id, update, user=user, db=db)


@router.put("/projects/{project_id}/scenes/{scene_id}")
def wordpress_update_scene(
    project_id: int,
    scene_id: int,
    data: SceneUpdate,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return projects.update_scene(project_id, scene_id, data, user=user, db=db)


@router.post("/projects/{project_id}/scenes/{scene_id}/image")
async def wordpress_update_scene_image(
    project_id: int,
    scene_id: int,
    image: UploadFile = File(...),
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return await projects.update_scene_image(
        project_id,
        scene_id,
        image=image,
        user=user,
        db=db,
    )


@router.delete("/projects/{project_id}/scenes/{scene_id}", status_code=204)
def wordpress_delete_scene(
    project_id: int,
    scene_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return projects.delete_scene(project_id, scene_id, user=user, db=db)


@router.post("/projects/{project_id}/scenes/reorder")
def wordpress_reorder_scenes(
    project_id: int,
    data: ReorderScenesRequest,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return projects.reorder_scenes(project_id, data, user=user, db=db)


@router.post("/projects/{project_id}/scenes/{scene_id}/regenerate")
async def wordpress_regenerate_scene(
    project_id: int,
    scene_id: int,
    data: WordPressSceneRegenerateIn,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return await projects.regenerate_scene(
        project_id,
        scene_id,
        description=data.description,
        narration_text=data.narration_text,
        regenerate_voiceover="true" if data.regenerate_voiceover else "false",
        voiceover_verbatim="true" if data.voiceover_verbatim else "false",
        layout=data.layout,
        image=None,
        user=user,
        db=db,
    )


@router.post("/projects/{project_id}/scenes/add", status_code=202)
async def wordpress_add_scene(
    project_id: int,
    data: AddSceneRequest,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return await projects.add_scene(project_id, data, user=user, db=db)


@router.get("/projects/{project_id}/scenes/add-status")
async def wordpress_add_scene_status(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return await projects.get_add_scene_status(project_id, user=user, db=db)


@router.post("/projects/{project_id}/script/regenerate")
async def wordpress_regenerate_script(
    project_id: int,
    data: WordPressScriptRegenerateIn,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return await projects.regenerate_script(
        project_id,
        projects.RegenerateScriptRequest(user_instruction=data.user_instruction),
        user=user,
        db=db,
    )


@router.get("/projects/{project_id}/script/status")
def wordpress_regenerate_script_status(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return projects.get_regenerate_script_status(project_id, user=user, db=db)


@router.get("/projects/{project_id}/script/preview")
def wordpress_regenerate_script_preview(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return projects.get_regenerate_script_preview(project_id, user=user, db=db)


@router.post("/projects/{project_id}/script/verify")
async def wordpress_verify_regenerate_script(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return await projects.verify_regenerate_script(project_id, user=user, db=db)


@router.post("/projects/{project_id}/script/retry")
async def wordpress_retry_regenerate_script(
    project_id: int,
    data: WordPressScriptRegenerateIn,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return await projects.reject_regenerate_script(
        project_id,
        projects.RegenerateScriptRetryRequest(user_instruction=data.user_instruction),
        user=user,
        db=db,
    )


@router.post("/projects/{project_id}/render", status_code=202)
async def render_wordpress_project(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return await pipeline.render_video_endpoint(project_id, force_render=True, user=user, db=db)


@router.get("/projects/{project_id}/render-status")
def wordpress_render_status(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return pipeline.render_status_endpoint(project_id, user=user, db=db)


@router.post("/projects/{project_id}/embed")
def wordpress_embed(
    project_id: int,
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return embed.generate_embed_token(project_id, current_user=user, db=db)


@router.post("/connections/revoke")
def revoke_connection(
    connection: WordPressConnection = Depends(get_wordpress_connection),
    db: Session = Depends(get_db),
):
    connection.status = "revoked"
    connection.access_token_hash = None
    db.commit()
    return {"revoked": True}
