"""Import a post from a connected content source (Ghost / Beehiiv / WordPress) into a project.

The counterpart of scraper.scrape_blog for content we can read through an API
instead of scraping: it fills ``blog_content`` and the image ``Asset`` rows and
sets the project to SCRAPED, so the generation pipeline skips its scrape step
and proceeds exactly as it would for a scraped URL. HTML → text and image
extraction reuse the scraper's own helpers so imported and scraped posts reach
the script generator in the same shape.
"""
from dataclasses import dataclass

from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.models.project import Project, ProjectStatus
from app.models.social_connection import (
    PLATFORM_BEEHIIV,
    PLATFORM_GHOST,
    PLATFORM_WORDPRESS,
    WP_AUTH_APP_PASSWORD,
    SocialConnection,
)
from app.observability.logging import get_logger
from app.services import beehiiv_api, ghost_api, token_crypto, wordpress_api
from app.services.scraper import (
    _MIN_CONTENT_LENGTH,
    _download_images,
    _extract_image_urls,
    _extract_text,
)
from app.services.source_common import SourceError
from app.services.source_urls import connection_site_key
from app.services.table_extraction import append_tables_to_content, extract_tables_from_html

logger = get_logger(__name__)


def ghost_credentials(conn: SocialConnection) -> ghost_api.GhostCredentials:
    return ghost_api.GhostCredentials(
        site_url=conn.site_url or "", admin_key=_decrypt_key(conn)
    )


def beehiiv_key(conn: SocialConnection) -> str:
    return _decrypt_key(conn)


def wordpress_credentials(conn: SocialConnection) -> wordpress_api.WordPressCredentials:
    kind = conn.auth_kind or WP_AUTH_APP_PASSWORD
    blog_id = conn.account_id if kind != WP_AUTH_APP_PASSWORD else None
    return wordpress_api.WordPressCredentials(
        auth_kind=kind,
        api_root=conn.api_root or (wordpress_api.wpcom_api_root(blog_id) if blog_id else ""),
        site_url=conn.site_url or "",
        secret=_decrypt_key(conn),
        blog_id=blog_id,
    )


def _decrypt_key(conn: SocialConnection) -> str:
    try:
        return token_crypto.decrypt(conn.access_token_enc or "")
    except token_crypto.TokenCryptoError:
        raise SourceError(
            "Your connection needs to be set up again. Please reconnect.",
            code="invalid_key",
        )


def fetch_post(conn: SocialConnection, post_id: str) -> dict:
    """Normalised post: {id, title, status, url, feature_image, html}."""
    if conn.platform == PLATFORM_GHOST:
        post = ghost_api.get_post(ghost_credentials(conn), post_id)
        status = post.get("status") or "draft"
        return {
            "id": post.get("id"),
            "title": post.get("title") or "",
            "status": status,
            "url": post.get("url") if status == "published" else None,
            "feature_image": post.get("feature_image"),
            "html": post.get("html") or "",
        }
    if conn.platform == PLATFORM_BEEHIIV:
        post = beehiiv_api.get_post(beehiiv_key(conn), conn.account_id or "", post_id)
        return {
            "id": post.get("id"),
            "title": post.get("title") or "",
            "status": post.get("status"),
            "url": post.get("url"),
            "feature_image": post.get("feature_image"),
            "html": post.get("html") or "",
        }
    if conn.platform == PLATFORM_WORDPRESS:
        return wordpress_api.normalize_post(
            wordpress_api.get_post(wordpress_credentials(conn), post_id)
        )
    raise SourceError(f"Unknown content source '{conn.platform}'.")


def placeholder_url(platform: str, post_id: str) -> str:
    return f"{platform}://{post_id}"


def html_to_content(html: str, base_url: str) -> tuple[str, list[str], list[dict]]:
    """(text, image_urls, tables) from a post's HTML, via the scraper helpers."""
    # Two parses: _extract_text decomposes chrome it doesn't want, and the image
    # pass must see the untouched tree.
    text = _extract_text(BeautifulSoup(html, "lxml"))
    image_urls = _extract_image_urls(BeautifulSoup(html, "lxml"), base_url)
    tables = extract_tables_from_html(html, source="content_source_html")
    return text, image_urls, tables


@dataclass
class PreparedPost:
    """A fetched post, already reduced to what a project needs."""
    post_id: str
    title: str
    url: str | None  # public URL, published posts only
    text: str
    image_urls: list[str]
    tables: list[dict]

    def blog_url(self, platform: str) -> str:
        return self.url or placeholder_url(platform, self.post_id)


def prepare_post(conn: SocialConnection, post_id: str) -> PreparedPost:
    """Fetch and convert a post. Raises SourceError; touches no DB state.

    Kept separate from ``apply_post`` so the route can reject an unreadable
    post BEFORE it creates a project and charges a video credit.
    """
    post = fetch_post(conn, post_id)
    base_url = post.get("url") or conn.site_url or "https://example.invalid/"
    text, image_urls, tables = html_to_content(post["html"], base_url)
    if len(text.strip()) < _MIN_CONTENT_LENGTH:
        raise SourceError(
            "That post doesn't have enough text to make a video from.", code="empty_post"
        )

    title = (post.get("title") or "").strip()
    if title and not text.lstrip().startswith(title):
        text = f"# {title}\n\n{text}"

    feature = post.get("feature_image")
    if feature:
        image_urls = [feature] + [u for u in image_urls if u != feature]

    return PreparedPost(
        post_id=post_id, title=title, url=post.get("url"),
        text=text, image_urls=image_urls, tables=tables,
    )


def apply_post(
    project: Project, conn: SocialConnection, prepared: PreparedPost, db: Session
) -> Project:
    """Populate ``project`` from a prepared post and mark it SCRAPED."""
    _download_images(
        project.user_id, project.id, prepared.image_urls, db, page_url=prepared.url
    )

    project.blog_url = prepared.blog_url(conn.platform)
    project.source_platform = conn.platform
    project.source_post_id = prepared.post_id
    project.source_site = connection_site_key(conn)
    project.blog_content = append_tables_to_content(prepared.text, prepared.tables)
    if not (getattr(project, "content_language", None) or "").strip():
        from app.services.language_detection import detect_content_language
        project.content_language = detect_content_language(prepared.text)
    project.status = ProjectStatus.SCRAPED
    db.commit()
    db.refresh(project)

    logger.info(
        "[SOURCE_IMPORT] Project %s: imported %s post %s (%s chars, %s images)",
        project.id, conn.platform, prepared.post_id,
        len(project.blog_content or ""), len(prepared.image_urls),
        extra={"project_id": project.id, "user_id": project.user_id},
    )
    return project
