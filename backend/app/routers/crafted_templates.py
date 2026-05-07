import json
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.crafted_template_service import (
    is_crafted_templates_enabled,
    list_user_crafted_templates,
    publish_crafted_template,
    grant_crafted_template_access,
    load_crafted_template_package,
    invalidate_crafted_template_cache,
    crafted_cache_stats,
)

router = APIRouter(prefix="/api/crafted-templates", tags=["crafted-templates"])


class CraftedTemplatePublishRequest(BaseModel):
    template_key: str = Field(..., min_length=2, max_length=120, pattern=r"^[a-z][a-z0-9_-]*$")
    public_template_id: str = Field(..., min_length=4, max_length=140, pattern=r"^crafted_[a-z0-9_-]+$")
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="blog", min_length=1, max_length=255)
    supported_video_style: str = Field(default="explainer", min_length=1, max_length=30)
    r2_prefix: str = Field(..., min_length=3, max_length=1024)
    manifest_path: str | None = Field(default=None, max_length=1024)
    checksum: str | None = Field(default=None, max_length=128)


class CraftedTemplateGrantRequest(BaseModel):
    user_id: int
    public_template_id: str = Field(..., min_length=4, max_length=140, pattern=r"^crafted_[a-z0-9_-]+$")


def _is_publish_admin(user: User) -> bool:
    allowed = str(getattr(settings, "CRAFTED_TEMPLATE_ADMIN_EMAILS", "") or "").strip()
    if not allowed:
        return False
    allowed_emails = {x.strip().lower() for x in allowed.split(",") if x.strip()}
    return (user.email or "").strip().lower() in allowed_emails


@router.get("")
def list_crafted_templates(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_crafted_templates_enabled():
        return []
    return list_user_crafted_templates(user.id, db)


@router.get("/cache-stats")
def get_crafted_cache_stats(
    user: User = Depends(get_current_user),
):
    # Lightweight observability endpoint for rollout verification.
    if not _is_publish_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return crafted_cache_stats()


@router.post("/admin/publish")
def publish_crafted(
    payload: CraftedTemplatePublishRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_crafted_templates_enabled():
        raise HTTPException(status_code=400, detail="Crafted templates are disabled.")
    if not _is_publish_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required.")

    style = (payload.supported_video_style or "explainer").strip().lower()
    if style not in {"explainer", "promotional", "storytelling"}:
        raise HTTPException(status_code=422, detail="supported_video_style must be one of: explainer, promotional, storytelling")

    row = publish_crafted_template(
        template_key=payload.template_key.strip(),
        public_template_id=payload.public_template_id.strip(),
        name=payload.name.strip(),
        category=payload.category.strip() or "blog",
        supported_video_style=style,
        r2_prefix=payload.r2_prefix.strip().strip("/"),
        manifest_path=(payload.manifest_path or "").strip() or None,
        checksum=(payload.checksum or "").strip() or None,
        admin_user_id=user.id,
        db=db,
    )
    invalidate_crafted_template_cache(row.public_template_id)
    package = load_crafted_template_package(row.public_template_id, db=db, require_entitlement=False)
    if not package:
        row.status = "disabled"
        db.commit()
        raise HTTPException(status_code=422, detail="R2 package validation failed for published template.")

    # Keep latest validated metadata cached in DB as optional L2 fallback.
    try:
        row.cached_meta_json = json.dumps(package.get("meta") or {}, ensure_ascii=False)
        row.status = "active"
        db.commit()
    except Exception:
        db.rollback()

    return {
        "id": row.id,
        "public_template_id": row.public_template_id,
        "name": row.name,
        "status": row.status,
    }


@router.post("/admin/grant")
def grant_crafted_access(
    payload: CraftedTemplateGrantRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_crafted_templates_enabled():
        raise HTTPException(status_code=400, detail="Crafted templates are disabled.")
    if not _is_publish_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required.")

    from app.models.crafted_template import CraftedTemplate

    template = (
        db.query(CraftedTemplate)
        .filter(
            CraftedTemplate.public_template_id == payload.public_template_id,
            CraftedTemplate.status == "active",
        )
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Crafted template not found.")

    ent = grant_crafted_template_access(
        user_id=payload.user_id,
        crafted_template_id=template.id,
        db=db,
    )
    return {"entitlement_id": ent.id, "status": ent.status}
