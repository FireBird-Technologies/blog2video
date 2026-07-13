"""Project-scoped, membership-authorized reads of owner-scoped assets.

On a *shared* project, a collaborator must see the OWNER's custom templates,
crafted/"Designer" templates, and voices — not their own — otherwise the live
preview and picker lists break:

- custom template code is fetched from an owner-only endpoint (404 for a
  collaborator),
- crafted template list/detail is entitlement-gated (403 for a collaborator),
- the voice picker lists the collaborator's own saved voices, so the owner's
  ``custom_voice_id`` can't be resolved to a name.

The backend render/pipeline already resolves templates against the owner
(``project.user_id``). These endpoints do the same for the frontend: they
authorize via ``get_accessible_project`` (owner OR accepted collaborator, else
404) and then resolve the requested asset against ``project.user_id``.

All endpoints here are read-only and safe for editor-level collaborators. The
owner uses the plain ``/api/custom-templates`` etc. endpoints; the frontend only
routes through these when the viewer is a collaborator on someone else's project.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.custom_template import CustomTemplate
from app.models.saved_voice import SavedVoice
from app.schemas.schemas import SavedVoiceOut
from app.services.access import get_accessible_project
from app.routers.custom_templates import _serialize_template
from app.routers.crafted_templates import _wants_force_refresh
from app.services.crafted_template_service import (
    is_crafted_templates_enabled,
    list_user_crafted_templates,
    load_crafted_template_package,
    validate_crafted_template_access,
)

router = APIRouter(prefix="/api/projects/{project_id}", tags=["project-shared-assets"])


# ─── Custom templates (owner-resolved) ────────────────────────────


@router.get("/custom-templates")
def list_project_custom_templates(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the project OWNER's custom templates (for a collaborator's picker)."""
    project = get_accessible_project(project_id, user, db)
    templates = (
        db.query(CustomTemplate)
        .options(joinedload(CustomTemplate.brand_kit))
        .filter(CustomTemplate.user_id == project.user_id)
        .order_by(CustomTemplate.created_at.desc())
        .all()
    )
    # Ratings are the acting user's per-template feedback; a collaborator has no
    # ratings on the owner's templates, so omit them (None) rather than leak the
    # owner's. The picker only reads name/theme/preview here.
    return [_serialize_template(t) for t in templates]


@router.get("/custom-templates/{template_id}/code")
def get_project_custom_template_code(
    project_id: int,
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get an OWNER-owned custom template's code fields (for live preview compile)."""
    project = get_accessible_project(project_id, user, db)
    tpl = (
        db.query(CustomTemplate)
        .filter(
            CustomTemplate.id == template_id,
            CustomTemplate.user_id == project.user_id,
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Custom template not found")
    return {
        "component_code": None,
        "intro_code": tpl.intro_code,
        "outro_code": tpl.outro_code,
        "content_codes": json.loads(tpl.content_codes) if tpl.content_codes else None,
    }


# ─── Crafted templates (owner-resolved) ───────────────────────────


@router.get("/crafted-templates")
def list_project_crafted_templates(
    project_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the project OWNER's entitled crafted templates (for a collaborator's picker)."""
    project = get_accessible_project(project_id, user, db)
    if not is_crafted_templates_enabled():
        return []
    return list_user_crafted_templates(
        project.user_id, db, force_refresh=_wants_force_refresh(request)
    )


@router.get("/crafted-templates/{template_id}")
def get_project_crafted_template_detail(
    project_id: int,
    template_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a crafted template's full package, resolved against the project OWNER."""
    project = get_accessible_project(project_id, user, db)
    if not is_crafted_templates_enabled():
        raise HTTPException(status_code=404, detail="Crafted templates are disabled.")
    if not validate_crafted_template_access(template_id, project.user_id, db):
        raise HTTPException(
            status_code=403,
            detail="The project owner does not have access to this crafted template.",
        )
    package = load_crafted_template_package(
        template_id=template_id,
        user_id=project.user_id,
        db=db,
        require_entitlement=True,
        force_refresh=_wants_force_refresh(request),
    )
    if not package:
        raise HTTPException(status_code=404, detail="Crafted template package not found.")
    meta = package.get("meta") if isinstance(package.get("meta"), dict) else {}
    return {
        "id": package.get("template_id") or template_id,
        "name": package.get("name") or "",
        "description": meta.get("description", ""),
        "genres": meta.get("genres", []),
        "preview_colors": meta.get("preview_colors"),
        "hero_layout": meta.get("hero_layout"),
        "fallback_layout": meta.get("fallback_layout"),
        "valid_layouts": meta.get("valid_layouts"),
        "layouts_without_image": meta.get("layouts_without_image"),
        "layout_prop_schema": meta.get("layout_prop_schema"),
        "template_type": "crafted",
        "crafted": True,
        "composition_id": "GeneratedVideo",
        "intro_code": package.get("intro_code"),
        "outro_code": package.get("outro_code"),
        "content_codes": package.get("content_codes"),
        "content_archetype_ids": package.get("content_archetype_ids"),
        "frontend_files": package.get("frontend_files") or {},
        "frontend_entry_rel": package.get("frontend_entry_rel") or "",
        "frontend_layout_index_rel": package.get("frontend_layout_index_rel") or "",
        "frontend_mount_id": package.get("frontend_mount_id") or "",
        "preview_file": package.get("preview_file"),
        "preview_file_rel": package.get("preview_file_rel"),
        "layout_fields": package.get("layout_fields"),
        "layout_fields_rel": package.get("layout_fields_rel"),
        "preview_image_url": package.get("preview_image_url"),
        "public_asset_urls": package.get("public_asset_urls") or {},
        "theme": package.get("theme"),
        "logo_urls": meta.get("logo_urls"),
        "og_image": meta.get("og_image"),
    }


# ─── Voices (owner-resolved) ──────────────────────────────────────


@router.get("/voices", response_model=list[SavedVoiceOut])
def list_project_voices(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the project OWNER's saved voices (for a collaborator's voice picker)."""
    project = get_accessible_project(project_id, user, db)
    return (
        db.query(SavedVoice)
        .filter(SavedVoice.user_id == project.user_id)
        .order_by(SavedVoice.created_at.desc())
        .all()
    )
