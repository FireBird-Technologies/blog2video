from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.crafted_template_service import (
    is_crafted_templates_enabled,
    list_user_crafted_templates,
    load_crafted_template_package,
    crafted_cache_stats,
    validate_crafted_template_access,
)


def _wants_force_refresh(request: Request) -> bool:
    """Detect a hard-refresh signal from the client.

    Treats either `Cache-Control: no-cache` (sent by the frontend on full
    page reload) or `?fresh=1`/`?force=1` query params (Postman/manual) as
    a request to bypass the in-process cache and re-read from R2.
    """
    cache_control = (request.headers.get("cache-control") or "").lower()
    if "no-cache" in cache_control:
        return True
    query = request.query_params
    return query.get("fresh") in {"1", "true"} or query.get("force") in {"1", "true"}

router = APIRouter(prefix="/api/crafted-templates", tags=["crafted-templates"])


@router.get("")
def list_crafted_templates(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_crafted_templates_enabled():
        return []
    return list_user_crafted_templates(user.id, db, force_refresh=_wants_force_refresh(request))


@router.get("/cache-stats")
def get_crafted_cache_stats(
    user: User = Depends(get_current_user),
):
    # Lightweight observability endpoint for rollout verification.
    # Auth-only (no admin gate) — operated via Postman by the project owner.
    return crafted_cache_stats()


@router.get("/{template_id}")
def get_crafted_template_detail(
    template_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_crafted_templates_enabled():
        raise HTTPException(status_code=404, detail="Crafted templates are disabled.")
    if not validate_crafted_template_access(template_id, user.id, db):
        raise HTTPException(status_code=403, detail="You do not have access to this crafted template.")
    package = load_crafted_template_package(
        template_id=template_id,
        user_id=user.id,
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
        "styles": meta.get("styles", [package.get("supported_video_style", "explainer")]),
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


