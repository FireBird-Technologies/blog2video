import json
from typing import Optional
from datetime import datetime

import asyncio

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.auth import get_current_user
from app.models.project import Project
from app.models.user import User
from app.schemas.schemas import SceneOut, AssetOut
from app.services import embed_player
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
    # Caption settings — the embed player renders captions and offers a viewer-side
    # caption toggle, so it needs the project's saved values (without these the
    # player always fell back to "off / inter / 36" no matter what the owner set).
    captions_enabled: bool
    caption_font_family: str
    caption_font_size: str
    caption_offset: int
    updated_at: datetime
    custom_theme: Optional[dict] = None
    scenes: list[SceneOut] = []
    assets: list[AssetOut] = []

    class Config:
        from_attributes = True


@router.post("/token/{project_id}", response_model=EmbedTokenResponse)
def generate_embed_token(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmbedTokenResponse:
    from app.services.access import get_accessible_project
    project = get_accessible_project(project_id, current_user, db)

    token = embed_player.ensure_embed_token(project, db)
    return EmbedTokenResponse(embed_token=token, preview_url=embed_player.preview_url(token))


@router.get("/project/{token}")
def get_embed_project(token: str, lite: bool = False, db: Session = Depends(get_db)) -> JSONResponse:
    """The project for the public player.

    ``lite=1`` is the player's live refresh: the same project fields, without the
    template code (``crafted_template``, ``custom_template_code``,
    ``layout_prop_schema`` are null). The player keeps the code it loaded first
    and asks for the full payload again only when ``template`` changes.
    """
    project = db.query(Project).filter(Project.embed_token == token).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    crafted_template: Optional[dict] = None
    custom_template_code: Optional[dict] = None
    layout_prop_schema: Optional[dict] = None

    if lite:
        # Theme only: it is part of the project payload the player styles with.
        if is_crafted_template(project.template):
            if not validate_crafted_template_access(project.template, project.user_id, db):
                raise HTTPException(status_code=403, detail="Crafted template access revoked for this project")
            package = load_crafted_template_package(
                template_id=project.template, user_id=project.user_id, db=db, require_entitlement=True,
            )
            project.custom_theme = (package or {}).get("theme")
        elif is_custom_template(project.template):
            data = _load_custom_template_data(project.template, db=db, user_id=project.user_id)
            project.custom_theme = data["theme"] if data else None
        else:
            project.custom_theme = None
    elif is_crafted_template(project.template):
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
            "content_prop_schema": meta.get("content_prop_schema") or {},
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
            # Everything the player reads off this payload must be here.
            #
            # It carried only the three code fields, and the embed page hands it
            # straight to VideoPreview as `precompiledTemplateData` — which then
            # SKIPS the fetch that would otherwise supply the rest. Each missing
            # field failed silently and differently: no `design_version` meant
            # the built-in CTA overlay replaced a v2/v3 template's own ending; no
            # `scene_font_defaults` meant type fell back to the literal baked
            # into the generated code; no `image_modes` meant a "half" scene was
            # indistinguishable from a legacy null, so media sitting BESIDE the
            # copy got the full-bleed blur+scrim.
            #
            # Derived from the blueprint this loader already returns, so no extra
            # query. The two helpers read it off an ORM attribute as JSON, hence
            # the re-encode rather than a second DB round-trip.
            from types import SimpleNamespace

            from app.routers.custom_templates import (
                _design_version,
                _image_modes_by_layout,
            )

            _bp = data.get("design_blueprint")
            _shim = SimpleNamespace(
                design_blueprint=json.dumps(_bp) if _bp else None
            )
            custom_template_code = {
                "intro_code": data.get("intro_code"),
                "outro_code": data.get("outro_code"),
                "content_codes": data.get("content_codes"),
                "design_version": _design_version(_shim),
                "scene_font_defaults": data.get("scene_font_defaults"),
                "image_modes": _image_modes_by_layout(_shim),
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


@router.websocket("/project/{token}/live")
async def embed_project_live(websocket: WebSocket, token: str):
    """Read-only live channel for a public preview.

    Pushes the same ``edit`` / ``project_reloaded`` messages collaborators get,
    so the /embed/<token> player can refetch GET /project/{token} the moment the owner
    (or an API caller) changes the video. Knowing the embed token is the only
    requirement, exactly as for the preview itself; nothing sent here is
    accepted. Rooms are in-process, like collaboration (see collab_ws.py).
    """
    from app.routers.collab_ws import collab_manager

    db = SessionLocal()
    try:
        project = db.query(Project.id).filter(Project.embed_token == token).first()
    finally:
        db.close()
    if project is None:
        await websocket.close(code=4404)
        return
    project_id = project[0]

    await websocket.accept()
    collab_manager.bind_loop(asyncio.get_running_loop())
    collab_manager.add_viewer(project_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        collab_manager.remove_viewer(project_id, websocket)
