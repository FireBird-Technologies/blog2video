"""Recognising `blog_url` values that are placeholders rather than real links.

A project's ``blog_url`` is normally the page we scraped. Projects whose
content came from somewhere else carry a scheme-tagged placeholder instead:

  upload://documents        — built from uploaded files (doc_extractor)
  ghost://<post_id>         — imported from a connected Ghost site, no public URL yet
  beehiiv://<post_id>       — imported from a connected Beehiiv publication, likewise
  wordpress://<post_id>     — imported from a connected WordPress site, likewise

A placeholder must never be scraped, linked to, or shown as a URL. Imported
posts that ARE published store their real public URL instead, so the outro CTA
can link to them.
"""

from urllib.parse import urlparse

PLACEHOLDER_SCHEMES = ("upload://", "ghost://", "beehiiv://", "wordpress://")


def site_key(url: str | None) -> str | None:
    """A site's identity for comparisons: lowercase host + path, no scheme or
    trailing slash (``https://Blog.example.com/news/`` → ``blog.example.com/news``)."""
    raw = (url or "").strip()
    if not raw or is_placeholder_source_url(raw):
        return None
    if "://" not in raw:
        raw = "https://" + raw
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if not host:
        return None
    port = f":{parsed.port}" if parsed.port else ""
    return f"{host}{port}{parsed.path.rstrip('/')}"


def connection_site_key(conn) -> str | None:
    """The site/publication a content-source connection points at."""
    if getattr(conn, "platform", None) == "beehiiv":
        return getattr(conn, "account_id", None)
    return site_key(getattr(conn, "site_url", None))


def source_matches_connection(project, conn) -> bool:
    """Is ``project.source_post_id`` a post on the site ``conn`` is connected to?

    Post ids are only unique per site. Projects imported before source_site was
    recorded fall back to their public URL living under the connected site;
    Ghost and Beehiiv ids are globally unique, so those still match without it.
    """
    if not conn or not project.source_post_id or project.source_platform != conn.platform:
        return False
    current = connection_site_key(conn)
    stored = getattr(project, "source_site", None)
    if stored:
        return stored == current
    if conn.platform in ("ghost", "beehiiv"):
        return True
    url_key = site_key(project.blog_url)
    return bool(current and url_key and (url_key == current or url_key.startswith(current + "/")))


def is_placeholder_source_url(url: str | None) -> bool:
    return (url or "").strip().startswith(PLACEHOLDER_SCHEMES)


def public_source_link(url: str | None) -> str:
    """The URL if it is a real link worth pointing viewers at, else ''."""
    raw = (url or "").strip()
    return "" if not raw or is_placeholder_source_url(raw) else raw
