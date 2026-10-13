"""Shared public preview artwork for template pickers.

These are the R2 screenshots used by both the MCP setup gallery and external
integrations such as the WordPress plugin.
"""

from typing import TYPE_CHECKING

from app.config import settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

_PREVIEW_PATH = "mcp-ui/template-previews"
_PREVIEW_IDS = (
    "default",
    "nightfall",
    "gridcraft",
    "spotlight",
    "whiteboard",
    "newspaper",
    "matrix",
    "newscast",
    "mosaic",
    "blackswan",
    "bloomberg",
    "chronicle",
    "stickman_2",
    "magazine",
    "sakura",
    "old-documentary-reel",
)


def _preview_base() -> str:
    return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{_PREVIEW_PATH}"


def get_template_preview_urls() -> dict[str, str]:
    """Preview PNG URL per built-in template id, rooted at R2_PUBLIC_URL."""
    base = _preview_base()
    return {tid: f"{base}/{tid}.png" for tid in _PREVIEW_IDS}


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
    preview_urls = get_template_preview_urls()
    for template in list_templates():
        item = dict(template)
        item["preview_url"] = preview_urls.get(str(item.get("id", "")), "")
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
