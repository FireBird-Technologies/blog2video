"""Shared public preview artwork for template pickers.

These are the R2 screenshots used by both the MCP setup gallery and external
integrations such as the WordPress plugin.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

TEMPLATE_PREVIEW_URLS: dict[str, str] = {
    "default": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/default.png",
    "nightfall": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/nightfall.png",
    "gridcraft": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/gridcraft.png",
    "spotlight": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/spotlight.png",
    "whiteboard": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/whiteboard.png",
    "newspaper": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/newspaper.png",
    "matrix": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/matrix.png",
    "newscast": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/newscast.png",
    "mosaic": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/mosaic.png",
    "blackswan": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/blackswan.png",
    "bloomberg": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/bloomberg.png",
    "chronicle": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/chronicle.png",
    "stickman_2": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/stickman_2.webp",
    "magazine": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/magazine.webp",
    "sakura": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/sakura.webp",
    "old-documentary-reel": "https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/old-documentary-reel.webp",
}


def build_catalog(user_id: int, db: "Session") -> dict:
    """Templates + this user's saved voices, for third-party connector pickers.

    Shared by the WordPress and browser-extension connectors so both stay
    in sync with the same template/voice shape.
    """
    from app.models.saved_voice import SavedVoice
    from app.services.template_service import list_templates

    voices = (
        db.query(SavedVoice)
        .filter(SavedVoice.user_id == user_id)
        .order_by(SavedVoice.created_at.desc())
        .all()
    )
    templates = []
    for template in list_templates():
        item = dict(template)
        item["preview_url"] = TEMPLATE_PREVIEW_URLS.get(str(item.get("id", "")), "")
        templates.append(item)
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
