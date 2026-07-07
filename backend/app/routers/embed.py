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
from app.services.template_service import is_custom_template, is_crafted_template, _load_custom_template_data, get_meta
from app.services.crafted_template_service import validate_crafted_template_access, load_crafted_template_package

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

    crafted_template: Optional[dict] = None
    custom_template_code: Optional[dict] = None
    layout_prop_schema: Optional[dict] = None

    if is_crafted_template(project.template):
        if not validate_crafted_template_access(project.template, project.user_id, db):
            raise HTTPException(status_code=403, detail="Crafted template access revoked for this project")
        package = load_crafted_template_package(
            template_id=project.template,
            user_id=project.user_id,
            db=db,
            require_entitlement=True,
        )
        if not package:
            raise HTTPException(status_code=404, detail="Crafted template package not found")
        meta = package.get("meta") if isinstance(package.get("meta"), dict) else {}
        project.custom_theme = package.get("theme")
        crafted_template = {
            "id": package.get("template_id") or project.template,
            "name": package.get("name") or "",
            "valid_layouts": meta.get("valid_layouts"),
            "fallback_layout": meta.get("fallback_layout"),
            "hero_layout": meta.get("hero_layout"),
            "layout_prop_schema": meta.get("layout_prop_schema"),
            "preview_colors": meta.get("preview_colors"),
            "intro_code": package.get("intro_code"),
            "outro_code": package.get("outro_code"),
            "content_codes": package.get("content_codes"),
            "content_archetype_ids": package.get("content_archetype_ids"),
            "frontend_files": package.get("frontend_files") or {},
            "frontend_entry_rel": package.get("frontend_entry_rel") or "",
            "frontend_layout_index_rel": package.get("frontend_layout_index_rel") or "",
            "frontend_mount_id": package.get("frontend_mount_id") or "",
            "public_asset_urls": package.get("public_asset_urls") or {},
            "theme": package.get("theme"),
        }
    elif is_custom_template(project.template):
        data = _load_custom_template_data(project.template, db=db, user_id=project.user_id)
        project.custom_theme = data["theme"] if data else None
        if data:
            custom_template_code = {
                "intro_code": data.get("intro_code"),
                "outro_code": data.get("outro_code"),
                "content_codes": data.get("content_codes"),
            }
    else:
        project.custom_theme = None
        meta = get_meta(project.template)
        layout_prop_schema = (meta or {}).get("layout_prop_schema") or {}

    out = EmbedProjectOut.model_validate(project)
    payload = out.model_dump(mode="json")
    payload["crafted_template"] = crafted_template
    payload["custom_template_code"] = custom_template_code
    payload["layout_prop_schema"] = layout_prop_schema
    headers = {"Access-Control-Allow-Origin": "*"}
    return JSONResponse(content=payload, headers=headers)
