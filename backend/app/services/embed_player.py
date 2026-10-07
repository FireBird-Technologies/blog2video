"""The public embed player: a project's /embed/<token> page, and the iframe
snippet that puts it on another site.

Shared by the embed-link endpoint (routers/embed.py) and Ghost publishing,
which embeds the player instead of uploading the MP4 when the site's plan caps
uploads below the video's size. The player renders the project live from its
scenes, so an embed doesn't need a rendered video.
"""
import html
import secrets

from sqlalchemy.orm import Session

from app.config import settings
from app.models.project import Project


def frontend_url() -> str:
    """The first FRONTEND_URL origin — the base of every embed's /embed/<token>.

    An embed on an https site (a Ghost post) only renders when this is https:
    an http://localhost FRONTEND_URL is blocked there as mixed content.
    """
    raw = getattr(settings, "FRONTEND_URL", "") or ""
    return raw.split(",")[0].strip().rstrip("/") or "https://blog2video.app"


def ensure_embed_token(project: Project, db: Session) -> str:
    """The project's embed token, creating (and committing) one the first time."""
    if not project.embed_token:
        project.embed_token = secrets.token_hex(32)
        db.commit()
        db.refresh(project)
    return project.embed_token


def preview_url(token: str) -> str:
    # /embed/ is the standalone player (frontend/embed/index.html). Older
    # /preview/<token> links are served by the same page.
    return f"{frontend_url()}/embed/{token}"


def embed_iframe_html(token: str, aspect_ratio: str | None) -> str:
    """A responsive iframe for the player, sized to the video's shape.

    Same src and data-* attributes as the snippet the project page copies, but
    in an aspect-ratio box so it fills the host's content column. Portrait is
    capped in width so it doesn't run several screens tall.
    """
    portrait = aspect_ratio == "portrait"
    padding = "177.78%" if portrait else "56.25%"
    max_width = "max-width:400px;margin:0 auto;" if portrait else ""
    src = html.escape(preview_url(token), quote=True)
    return (
        f'<div style="{max_width}">'
        f'<div style="position:relative;width:100%;height:0;padding-top:{padding};">'
        f'<iframe src="{src}" '
        'style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" '
        'frameborder="0" allowfullscreen '
        'data-powered-by="https://blog2video.app" '
        'data-creator="https://www.firebird-technologies.com/about"></iframe>'
        "</div></div>"
    )
