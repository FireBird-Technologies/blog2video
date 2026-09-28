"""Public browser-extension connector API.

The extension uses the same OAuth-device-style handshake as the WordPress
plugin: it starts a pending connection, the account owner approves a short
code in the Blog2Video web app, and the extension retrieves an
install-scoped opaque token exactly once. Kept as a separate router/model
from wordpress_integration.py because the two connectors have different
identity fields (a browser install has no site_url) and should be
revocable independently.
"""

import asyncio
import hashlib
import re
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.extension_integration import ExtensionConnection, ExtensionProjectLink
from app.models.project import Project
from app.models.saved_voice import SavedVoice
from app.models.user import User
from app.routers import embed, pipeline, projects, video_styles
from app.schemas.schemas import ProjectCreate
from app.services.language_detection import normalize_preferred_language_code
from app.services.template_preview_catalog import build_catalog

router = APIRouter(prefix="/api/integrations/extension/v1", tags=["extension-integration"])
optional_bearer = HTTPBearer(auto_error=False)

CONNECTION_TTL_MINUTES = 15
MAX_CONTENT_CHARS = 250_000


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _user_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


class ConnectionBeginIn(BaseModel):
    browser_label: str = Field(default="Chrome extension", max_length=255)


class ConnectionTokenIn(BaseModel):
    connection_id: int
    device_code: str = Field(min_length=32, max_length=255)


class ConnectionApproveIn(BaseModel):
    user_code: str = Field(min_length=8, max_length=16)


class ExtensionProjectIn(BaseModel):
    source_url: str = Field(min_length=1, max_length=2048)
    content: str = Field(min_length=1, max_length=MAX_CONTENT_CHARS)
    idempotency_key: str = Field(min_length=8, max_length=255)
    content_hash: str = Field(min_length=16, max_length=80)
    title: str = Field(min_length=1, max_length=255)
    template: str = "default"
    video_style: str = "auto"
    video_length: str = "auto"
    aspect_ratio: str = "landscape"
    logo_position: str = "bottom_right"
    logo_opacity: float = 0.9
    voice_gender: str = "female"
    voice_accent: str = "american"
    custom_voice_id: str | None = Field(default=None, max_length=100)
    content_language: str | None = None
    captions_enabled: bool = False
    stock_footage_enabled: bool = False
    script_review_enabled: bool = False

    @model_validator(mode="after")
    def valid_source(self):
        if len(self.content.strip()) < 50:
            raise ValueError("content must contain at least 50 characters")
        parsed = urlparse(self.source_url.strip())
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("source_url must be a valid HTTP or HTTPS URL")
        self.source_url = self.source_url.strip()
        return self

    @model_validator(mode="after")
    def valid_aspect_ratio(self):
        if self.aspect_ratio not in {"landscape", "portrait"}:
            raise ValueError("aspect_ratio must be landscape or portrait")
        return self


def get_extension_connection(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
    db: Session = Depends(get_db),
) -> ExtensionConnection:
    if credentials is None or not credentials.credentials.startswith("b2v_ext_"):
        raise HTTPException(status_code=401, detail="Invalid extension connection token")
    row = (
        db.query(ExtensionConnection)
        .filter(
            ExtensionConnection.access_token_hash == _hash(credentials.credentials),
            ExtensionConnection.status == "active",
        )
        .first()
    )
    if row is None or row.user_id is None:
        raise HTTPException(status_code=401, detail="Invalid extension connection token")
    row.last_used_at = datetime.utcnow()
    db.commit()
    return row


def _connection_user(connection: ExtensionConnection, db: Session) -> User:
    user = db.query(User).filter(User.id == connection.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Connected Blog2Video account is unavailable")
    return user


def _linked_project(connection: ExtensionConnection, project_id: int, db: Session) -> tuple[Project, User]:
    link = (
        db.query(ExtensionProjectLink)
        .filter(
            ExtensionProjectLink.connection_id == connection.id,
            ExtensionProjectLink.project_id == project_id,
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
    while db.query(ExtensionConnection).filter(ExtensionConnection.user_code == code).first():
        code = _user_code()
    row = ExtensionConnection(
        browser_label=data.browser_label.strip() or "Chrome extension",
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
        "verification_url": f"{frontend}/extension-connect?code={code}",
        "expires_in": CONNECTION_TTL_MINUTES * 60,
    }


@router.post("/connections/approve")
def approve_connection(
    data: ConnectionApproveIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code = re.sub(r"[^A-Z0-9]", "", data.user_code.upper())
    row = db.query(ExtensionConnection).filter(ExtensionConnection.user_code == code).first()
    if row is None or row.status != "pending":
        raise HTTPException(status_code=404, detail="Connection code not found")
    if row.expires_at < datetime.utcnow():
        row.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Connection code expired")
    token = "b2v_ext_" + secrets.token_urlsafe(48)
    row.user_id = user.id
    row.access_token_hash = _hash(token)
    row.pending_access_token = token
    row.status = "approved"
    row.approved_at = datetime.utcnow()
    db.commit()
    return {"connected": True, "browser_label": row.browser_label}


@router.get("/connections/pending/{user_code}")
def pending_connection(user_code: str, db: Session = Depends(get_db)):
    """Show the install identity before the account owner grants access."""
    code = re.sub(r"[^A-Z0-9]", "", user_code.upper())
    row = db.query(ExtensionConnection).filter(ExtensionConnection.user_code == code).first()
    if row is None or row.status != "pending":
        raise HTTPException(status_code=404, detail="Connection code not found")
    if row.expires_at < datetime.utcnow():
        row.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Connection code expired")
    return {"browser_label": row.browser_label, "expires_at": row.expires_at}


@router.post("/connections/token")
def exchange_connection_token(data: ConnectionTokenIn, db: Session = Depends(get_db)):
    row = db.query(ExtensionConnection).filter(ExtensionConnection.id == data.connection_id).first()
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
    connection: ExtensionConnection = Depends(get_extension_connection),
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
        "ai_edit_credits_available": user.ai_edit_credits_available,
    }


@router.get("/catalog")
def catalog(
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    user = _connection_user(connection, db)
    response = build_catalog(connection.user_id, db)
    # Same authoritative selection/serialization path as BlogUrlForm Step 2 and
    # the WordPress catalog — otherwise the extension's picker only ever shows
    # the 4 hardcoded builtins and never "Your Style" or the user's named
    # custom styles.
    response["video_styles"] = video_styles.video_styles_response(user, db)
    return response


@router.get("/video-styles")
def extension_video_styles(
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    user = _connection_user(connection, db)
    return video_styles.video_styles_response(user, db)


@router.post("/projects", status_code=status.HTTP_202_ACCEPTED)
async def create_extension_project(
    data: ExtensionProjectIn,
    idempotency_header: str | None = Header(default=None, alias="Idempotency-Key"),
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    user = _connection_user(connection, db)
    key = idempotency_header or data.idempotency_key
    if data.custom_voice_id:
        saved_voice = (
            db.query(SavedVoice)
            .filter(SavedVoice.user_id == user.id, SavedVoice.voice_id == data.custom_voice_id)
            .first()
        )
        if saved_voice is None:
            raise HTTPException(status_code=400, detail="Selected voice is not available to this account")
    existing = db.query(ExtensionProjectLink).filter(ExtensionProjectLink.idempotency_key == key).first()
    if existing:
        if existing.connection_id != connection.id:
            raise HTTPException(status_code=409, detail="Idempotency key already used")
        connection.current_project_id = existing.project_id
        db.commit()
        return {"project_id": existing.project_id, "state": "existing"}

    created = projects.create_project(
        ProjectCreate(
            blog_url=data.source_url,
            name=data.title,
            template=data.template,
            video_style=data.video_style,
            video_length=data.video_length,
            aspect_ratio=data.aspect_ratio,
            logo_position=data.logo_position,
            logo_opacity=data.logo_opacity,
            voice_gender=data.voice_gender,
            voice_accent=data.voice_accent,
            custom_voice_id=data.custom_voice_id,
            content_language=normalize_preferred_language_code(data.content_language),
            captions_enabled=data.captions_enabled,
            stock_footage_enabled=data.stock_footage_enabled,
            script_review_enabled=data.script_review_enabled,
        ),
        user=user,
        db=db,
    )
    project = db.query(Project).filter(Project.id == created.id).first()
    if project is None:
        raise HTTPException(status_code=500, detail="Project creation failed")
    # The core project endpoint also guards against rapid duplicate submissions
    # by returning the user's recent in-flight project. If that happens, its
    # extension link already exists; point back to it rather than inserting a
    # second link for the same project.
    reused_link = (
        db.query(ExtensionProjectLink)
        .filter(ExtensionProjectLink.project_id == project.id)
        .first()
    )
    if reused_link is not None:
        if reused_link.connection_id != connection.id:
            raise HTTPException(status_code=409, detail="This project is active in another browser connection")
        connection.current_project_id = project.id
        db.commit()
        return {"project_id": project.id, "state": "existing", "editor_available": True}
    # The content came directly from the page the user was on, so mark the
    # scrape stage complete rather than having the pipeline re-fetch the URL.
    project.blog_content = data.content
    from app.models.project import ProjectStatus

    project.status = ProjectStatus.SCRAPED
    link = ExtensionProjectLink(
        connection_id=connection.id,
        project_id=project.id,
        source_url=data.source_url,
        content_hash=data.content_hash,
        idempotency_key=key,
    )
    db.add(link)
    connection.current_project_id = project.id
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        duplicate = db.query(ExtensionProjectLink).filter(ExtensionProjectLink.idempotency_key == key).first()
        if duplicate:
            if duplicate.connection_id != connection.id:
                raise HTTPException(status_code=409, detail="Idempotency key already used")
            connection = db.get(ExtensionConnection, connection.id)
            connection.current_project_id = duplicate.project_id
            db.commit()
            return {"project_id": duplicate.project_id, "state": "existing"}
        raise

    pipeline.start_pipeline_background(project.id, user.id, asyncio.get_running_loop())
    return {
        "project_id": project.id,
        "state": "queued",
        "editor_available": True,
    }


@router.get("/projects/current")
def current_extension_project(
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    """Return the project the popup should restore, with DB-authoritative state."""
    if connection.current_project_id is None:
        return None
    try:
        project, user = _linked_project(connection, connection.current_project_id, db)
    except HTTPException as exc:
        if exc.status_code != 404:
            raise
        # A deleted project must not strand every future popup open on a 404.
        connection.current_project_id = None
        db.commit()
        return None
    result = pipeline.get_pipeline_status(project.id, user=user, db=db)
    result["project_id"] = project.id
    result["r2_video_url"] = project.r2_video_url
    result["editor_available"] = True
    return result


@router.delete("/projects/current", status_code=204)
def clear_current_extension_project(
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    """Forget the finished project so the popup can create another video."""
    connection.current_project_id = None
    db.commit()


@router.get("/projects/{project_id}/status")
def project_status(
    project_id: int,
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    project, user = _linked_project(connection, project_id, db)
    result = pipeline.get_pipeline_status(project_id, user=user, db=db)
    result["project_id"] = project_id
    result["r2_video_url"] = project.r2_video_url
    result["editor_available"] = True
    return result


@router.post("/projects/{project_id}/render", status_code=202)
async def render_extension_project(
    project_id: int,
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return await pipeline.render_video_endpoint(project_id, force_render=True, user=user, db=db)


@router.get("/projects/{project_id}/render-status")
def extension_render_status(
    project_id: int,
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return pipeline.render_status_endpoint(project_id, user=user, db=db)


@router.post("/projects/{project_id}/logo")
def upload_extension_project_logo(
    project_id: int,
    request: Request,
    file: UploadFile = File(...),
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    """Upload a Step 1 logo while preserving extension project scoping."""
    _project, user = _linked_project(connection, project_id, db)
    return projects.upload_logo(project_id, request, file, user, db)


@router.post("/projects/{project_id}/embed")
def extension_embed(
    project_id: int,
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    _project, user = _linked_project(connection, project_id, db)
    return embed.generate_embed_token(project_id, current_user=user, db=db)


@router.post("/connections/revoke")
def revoke_connection(
    connection: ExtensionConnection = Depends(get_extension_connection),
    db: Session = Depends(get_db),
):
    connection.status = "revoked"
    connection.access_token_hash = None
    db.commit()
    return {"revoked": True}
