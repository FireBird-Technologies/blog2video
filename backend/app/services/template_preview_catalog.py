"""Shared public preview artwork for template pickers.

Built-in previews are the template posters the web app ships in
`frontend/public/template-posters/` (`npm run posters:build`), served from the
live site. They deploy with every frontend release, so a new template gets its
picture automatically — there is no separate upload step to forget (the old R2
`mcp-ui/template-previews/*.png` copies were uploaded by hand, and new templates
such as Starlit were missed). They are also small WebPs, so a picker loading every
template at once no longer trips the rate limit on the public r2.dev bucket.

Used by the MCP galleries (as a fallback to their bundled thumbnails) and the
WordPress, browser-extension and public API catalogs.
"""

from typing import TYPE_CHECKING

from app.config import settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def _site_base() -> str:
    return (settings.FRONTEND_URL.split(",")[0] or "http://localhost:5173").strip().rstrip("/")


def template_poster_url(template_id: str) -> str:
    """Public poster image for one built-in template (landscape)."""
    return f"{_site_base()}/template-posters/{template_id}.webp"


def get_template_preview_urls() -> dict[str, str]:
    """Preview image URL per built-in template id (every registered template + default)."""
    from app.services.template_service import list_templates

    ids = {"default", *(str(t.get("id", "")) for t in list_templates())}
    return {tid: template_poster_url(tid) for tid in sorted(ids) if tid}


def _built_in_rank(template: dict) -> int:
    """Same order as the MCP galleries: new templates first, then new scenes, then popular."""
    if template.get("new_template"):
        return 0
    if template.get("new_scenes"):
        return 1
    if template.get("popular_template"):
        return 2
    return 3


def build_catalog(user_id: int, db: "Session") -> dict:
    """Built-in + this user's custom/crafted templates, and their saved voices,
    for third-party connector pickers.

    Shared by the WordPress and browser-extension connectors so both stay
    in sync with the same template/voice shape.
    """
    from app.models.custom_template import CustomTemplate
    from app.models.saved_voice import SavedVoice
    from app.services.crafted_template_service import list_user_crafted_templates
    from app.services.template_service import list_templates

    voices = (
        db.query(SavedVoice)
        .filter(SavedVoice.user_id == user_id)
        .order_by(SavedVoice.created_at.desc())
        .all()
    )
    templates = []
    # Stable sort: registry order within each rank, new templates on top.
    for template in sorted(list_templates(), key=_built_in_rank):
        item = dict(template)
        item["preview_url"] = template_poster_url(str(item.get("id", "")))
        item["source"] = "built_in"
        templates.append(item)

    custom_rows = (
        db.query(CustomTemplate)
        .filter(CustomTemplate.user_id == user_id, CustomTemplate.generation_failed.is_(False))
        .order_by(CustomTemplate.created_at.desc())
        .all()
    )
    for tpl in custom_rows:
        templates.append({
            "id": f"custom_{tpl.id}",
            "name": tpl.name,
            "preview_url": tpl.preview_image_url or "",
            "source": "custom",
        })

    for tpl in list_user_crafted_templates(user_id, db):
        templates.append({
            "id": tpl.get("id", ""),
            "name": tpl.get("name", ""),
            "preview_url": tpl.get("preview_image_url") or "",
            "source": "crafted",
        })

    return {
        "templates": templates,
        "voices": [
            {
                "voice_id": voice.voice_id,
                "name": voice.name,
                "preview_url": voice.preview_url,
                "gender": voice.gender,
                "accent": voice.accent,
                "description": voice.description,
                "source": voice.source,
            }
            for voice in voices
        ],
    }
