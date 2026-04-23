import secrets
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.config import settings
from app.models.project import Project
from app.models.user import User
from app.schemas.schemas import SceneOut, AssetOut
from app.services.template_service import is_custom_template, _load_custom_template_data

router = APIRouter(prefix="/api/embed", tags=["embed"])


class EmbedTokenResponse(BaseModel):
    embed_token: str
    preview_url: str


class EmbedProjectOut(BaseModel):
    id: int
    name: str
    status: str
    template: str
    aspect_ratio: str
    accent_color: str
    bg_color: str
    text_color: str
    font_family: Optional[str] = None
    r2_video_url: Optional[str] = None
    logo_r2_url: Optional[str] = None
    logo_position: str
    logo_opacity: float
    logo_size: float
    playback_speed: float
    updated_at: datetime
    custom_theme: Optional[dict] = None
    scenes: list[SceneOut] = []
    assets: list[AssetOut] = []

    class Config:
        from_attributes = True


def _get_frontend_url() -> str:
    raw = getattr(settings, "FRONTEND_URL", "") or ""
    return raw.split(",")[0].strip().rstrip("/") or "https://blog2video.app"


@router.post("/token/{project_id}", response_model=EmbedTokenResponse)
def generate_embed_token(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmbedTokenResponse:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.embed_token:
        project.embed_token = secrets.token_hex(32)
        db.commit()
        db.refresh(project)

    frontend_url = _get_frontend_url()
    return EmbedTokenResponse(
        embed_token=project.embed_token,
        preview_url=f"{frontend_url}/preview/{project.embed_token}",
    )


@router.get("/project/{token}")
def get_embed_project(token: str, db: Session = Depends(get_db)) -> JSONResponse:
    project = db.query(Project).filter(Project.embed_token == token).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if is_custom_template(project.template):
        data = _load_custom_template_data(project.template, db=db)
        project.custom_theme = data["theme"] if data else None
    else:
        project.custom_theme = None

    out = EmbedProjectOut.model_validate(project)
    headers = {"Access-Control-Allow-Origin": "*"}
    return JSONResponse(content=out.model_dump(mode="json"), headers=headers)
