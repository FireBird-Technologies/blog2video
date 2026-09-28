"""Ghost Admin API client — read posts, upload media, insert a video into a post.

A video goes in as a native video card (the MP4 uploaded to the site) or, when
the site's Ghost(Pro) plan caps uploads below the file size, as an HTML card
holding our embedded player.

Auth is a short-lived HS256 JWT signed with the secret half of a custom
integration's Admin API key (``<id>:<hex secret>``), sent as
``Authorization: Ghost <jwt>``. The Admin API (not the Content API) is needed
because drafts and members-only posts are the whole point, and because
publishing back is a write.

Every call is synchronous: the importer runs in a request handler and the
publisher runs on a publish_queue worker thread.
"""
import json
import time
import uuid
from dataclasses import dataclass
from typing import Callable
from urllib.parse import urlparse

import httpx
import jwt

from app.config import settings
from app.services.source_common import (
    HTTP_TIMEOUT,
    UPLOAD_TIMEOUT,
    SourceError,
    assert_public_host,
    raise_for_provider_status,
)

PROVIDER = "Ghost"
ACCEPT_VERSION = "v5.0"
# Ghost(Pro) per-file upload cap on the free trial and Starter plans. Ghost
# reports limits in MiB-based bytes: its "5 MB" is 5242880 in
# hostSettings.limits.uploads.max (seen on a live trial site), not 5000000.
# https://ghost.org/help/media-file-size-limits/
SMALL_PLAN_UPLOAD_LIMIT = 5 * 1024 * 1024
# A cap at or below this is a small plan: a real video almost never fits, so
# publishing embeds the player instead of uploading. Slack above 5 MiB so the
# decision never hinges on exact rounding; the next plan (Publisher) is 100 MB.
SMALL_PLAN_MAX = 10 * 1024 * 1024
# Ghost's "MB" in plan limits and its error copy.
MB = 1024 * 1024


def mb_unit(limit_bytes: int | None) -> int:
    """Bytes per "MB" for showing sizes against this plan's cap.

    The free trial's cap is MiB-based (5242880). Whichever unit a plan uses,
    pick the one that makes its cap a round number so it reads as the plan's
    own "100 MB", not "95 MB"; the video's size is shown in the same unit.
    Comparisons never use this — they're byte-exact.
    """
    if limit_bytes and limit_bytes % MB != 0 and limit_bytes % 1_000_000 == 0:
        return 1_000_000
    return MB
POST_LIST_FIELDS = (
    "id,title,status,visibility,url,feature_image,published_at,updated_at,excerpt"
)


@dataclass
class GhostCredentials:
    site_url: str  # normalised, no trailing slash, no /ghost
    admin_key: str  # "<id>:<secret>"


def parse_admin_key(key: str) -> tuple[str, bytes]:
    """Split and validate an Admin API key. Raises SourceError(invalid_key)."""
    value = (key or "").strip()
    key_id, sep, secret = value.partition(":")
    if not sep or not key_id or not secret:
        raise SourceError(
            "That isn't a Ghost Admin API key.",
            code="invalid_key",
        )
    try:
        return key_id, bytes.fromhex(secret)
    except ValueError:
        raise SourceError(
            "That isn't a Ghost Admin API key. Use the Admin key, not the Content key.",
            code="invalid_key",
        )


def make_admin_jwt(admin_key: str, now: int | None = None) -> str:
    key_id, secret = parse_admin_key(admin_key)
    iat = int(now if now is not None else time.time())
    return jwt.encode(
        {"iat": iat, "exp": iat + 5 * 60, "aud": "/admin/"},
        secret,
        algorithm="HS256",
        headers={"kid": key_id, "typ": "JWT"},
    )


def _api(creds: GhostCredentials, path: str) -> str:
    return f"{creds.site_url}/ghost/api/admin/{path.lstrip('/')}"


def _headers(creds: GhostCredentials) -> dict[str, str]:
    return {
        "Authorization": f"Ghost {make_admin_jwt(creds.admin_key)}",
        "Accept-Version": ACCEPT_VERSION,
    }


def _request(creds: GhostCredentials, method: str, path: str, **kwargs) -> dict:
    timeout = kwargs.pop("timeout", HTTP_TIMEOUT)
    # Re-checked on every call, not just at connect time: a hostname that
    # resolved publicly then can be re-pointed at an internal address later.
    if settings.ENVIRONMENT != "local":
        assert_public_host(urlparse(creds.site_url).hostname or "")
    try:
        # follow_redirects stays off: the SSRF check covered this host only.
        with httpx.Client(timeout=timeout, follow_redirects=False) as client:
            resp = client.request(method, _api(creds, path), headers=_headers(creds), **kwargs)
    except httpx.TimeoutException:
        raise SourceError("Your Ghost site took too long to respond.", retryable=True)
    except httpx.HTTPError:
        raise SourceError(
            "Couldn't reach your Ghost site. Check the URL.",
            code="invalid_site", retryable=True,
        )
    if resp.status_code in (301, 302, 307, 308):
        target = resp.headers.get("location", "").split("/ghost/")[0]
        hint = f" ({target})" if target else ""
        raise SourceError(
            f"Your site redirects elsewhere{hint}. Use that address instead.",
            code="invalid_site",
        )
    raise_for_provider_status(resp, PROVIDER)
    try:
        return resp.json()
    except ValueError:
        raise SourceError(
            "That URL doesn't look like a Ghost site.", code="invalid_site"
        )


# ─── Read ────────────────────────────────────────────────────────────────────


def get_site(creds: GhostCredentials) -> dict:
    """Validate the key and return display identity: {title, url, icon}.

    ``site/`` alone is public, so the posts probe is what actually proves the key.
    """
    _request(creds, "GET", "posts/", params={"limit": 1, "fields": "id"})
    site = (_request(creds, "GET", "site/").get("site") or {})
    return {
        "title": site.get("title") or creds.site_url,
        "url": (site.get("url") or creds.site_url).rstrip("/"),
        "icon": site.get("icon") or site.get("logo"),
    }


def list_posts(
    creds: GhostCredentials, page: int = 1, search: str | None = None, limit: int = 20
) -> dict:
    """One page of posts, newest-edited first, drafts included."""
    filters = ["status:[published,draft,scheduled]"]
    if search:
        # NQL string literal: single quotes, escape embedded quotes.
        term = search.strip().replace("\\", "\\\\").replace("'", "\\'")[:100]
        if term:
            filters.append(f"title:~'{term}'")
    body = _request(
        creds, "GET", "posts/",
        params={
            "limit": limit,
            "page": max(1, page),
            "filter": "+".join(filters),
            "fields": POST_LIST_FIELDS,
            "order": "updated_at desc",
        },
    )
    pagination = ((body.get("meta") or {}).get("pagination") or {})
    return {
        "posts": [_post_summary(p) for p in body.get("posts") or []],
        "page": pagination.get("page") or page,
        "pages": pagination.get("pages") or 1,
        "total": pagination.get("total"),
        "has_more": bool(pagination.get("next")),
    }


def _post_summary(post: dict) -> dict:
    status = post.get("status") or "draft"
    return {
        "id": post.get("id"),
        "title": post.get("title") or "(untitled)",
        "status": status,
        "published_at": post.get("published_at"),
        "updated_at": post.get("updated_at"),
        "feature_image": post.get("feature_image"),
        # Drafts get a /p/<uuid>/ preview link; only a published post has a
        # URL worth sending viewers to.
        "url": post.get("url") if status == "published" else None,
        "paid": (post.get("visibility") or "public") != "public",
        "excerpt": post.get("excerpt"),
    }


def get_post(creds: GhostCredentials, post_id: str) -> dict:
    body = _request(
        creds, "GET", f"posts/{post_id}/",
        params={"formats": "html,lexical,mobiledoc"},
    )
    posts = body.get("posts") or []
    if not posts:
        raise SourceError("That post wasn't found. It may have been deleted.", code="post_not_found")
    return posts[0]


def get_upload_limit(creds: GhostCredentials) -> int | None:
    """The site's per-file media upload cap in bytes, or None if it has none we can see.

    Ghost(Pro) exposes its plan limits as ``config.hostSettings.limits`` on the
    Admin ``config/`` endpoint (``uploads.max`` in bytes); self-hosted sites have
    no such key. Only used to choose between uploading and embedding, so a
    failure here is never fatal.
    """
    try:
        body = _request(creds, "GET", "config/")
    except SourceError:
        return None
    limits = (((body.get("config") or {}).get("hostSettings") or {}).get("limits") or {})
    uploads = limits.get("uploads") or {}
    value = uploads.get("max")
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
        return None
    return int(value)


# ─── Write ───────────────────────────────────────────────────────────────────


class _ProgressFile:
    """File proxy that reports bytes read, so a multipart upload has progress.

    httpx streams multipart file fields with repeated ``read(n)`` calls and
    sizes them via fileno/seek/tell, which fall through to the real file.
    """

    def __init__(self, fh, on_progress: Callable[[int], None] | None):
        self._fh = fh
        self._on_progress = on_progress
        self._done = 0

    def read(self, *args):
        chunk = self._fh.read(*args)
        if chunk and self._on_progress:
            self._done += len(chunk)
            self._on_progress(self._done)
        return chunk

    def __getattr__(self, name):
        return getattr(self._fh, name)


def upload_media(
    creds: GhostCredentials, video_path: str, file_name: str,
    on_progress: Callable[[int], None] | None = None,
) -> str:
    """Upload an MP4 to the site's media library; return its public URL."""
    with open(video_path, "rb") as fh:
        body = _request(
            creds, "POST", "media/upload/",
            files={"file": (file_name, _ProgressFile(fh, on_progress), "video/mp4")},
            timeout=UPLOAD_TIMEOUT,
        )
    media = body.get("media") or []
    if not media or not media[0].get("url"):
        raise SourceError("The video upload didn't finish. Please try again.", retryable=True)
    return media[0]["url"]


def upload_image(creds: GhostCredentials, image_path: str, file_name: str) -> str:
    with open(image_path, "rb") as fh:
        body = _request(
            creds, "POST", "images/upload/",
            files={"file": (file_name, fh, "image/jpeg")},
            data={"purpose": "image"},
        )
    images = body.get("images") or []
    if not images or not images[0].get("url"):
        raise SourceError("The thumbnail upload didn't finish. Please try again.", retryable=True)
    return images[0]["url"]


def build_video_card(
    *, src: str, thumbnail_src: str | None, file_name: str,
    width: int, height: int, duration: float,
) -> dict:
    """The Koenig video-card payload, shared by lexical nodes and mobiledoc cards."""
    return {
        "src": src,
        "caption": "",
        "fileName": file_name,
        "mimeType": "video/mp4",
        "width": width,
        "height": height,
        "duration": duration,
        "thumbnailSrc": thumbnail_src or "",
        "customThumbnailSrc": "",
        "thumbnailWidth": width if thumbnail_src else None,
        "thumbnailHeight": height if thumbnail_src else None,
        "cardWidth": "regular",
        "loop": False,
    }


def build_html_card(html: str) -> dict:
    """An HTML card (used for the embedded player), for lexical nodes and mobiledoc cards."""
    return {"html": html}


def insert_video_into_lexical(
    lexical: str, card: dict, position: str, card_type: str = "video"
) -> str:
    doc = json.loads(lexical)
    root = doc.get("root")
    if not isinstance(root, dict) or not isinstance(root.get("children"), list):
        raise SourceError(
            "This post's format isn't supported. Create a new draft instead.",
            code="unsupported_editor"
        )
    node = {"type": card_type, "version": 1, **card}
    if position == "bottom":
        root["children"].append(node)
    else:
        root["children"].insert(0, node)
    return json.dumps(doc)


def insert_video_into_mobiledoc(
    mobiledoc: str, card: dict, position: str, card_type: str = "video"
) -> str:
    doc = json.loads(mobiledoc)
    cards = doc.setdefault("cards", [])
    sections = doc.setdefault("sections", [])
    cards.append([card_type, card])
    section = [10, len(cards) - 1]  # 10 = card section
    if position == "bottom":
        sections.append(section)
    else:
        sections.insert(0, section)
    return json.dumps(doc)


def empty_lexical_with_video(card: dict, card_type: str = "video") -> str:
    return json.dumps({
        "root": {
            "children": [{"type": card_type, "version": 1, **card}],
            "direction": None, "format": "", "indent": 0, "type": "root", "version": 1,
        }
    })


def add_video_to_post(
    creds: GhostCredentials, post_id: str, card: dict, position: str,
    card_type: str = "video",
) -> dict:
    """Insert the card into an existing post. Returns the updated post.

    Sends back the ``updated_at`` we read, so Ghost rejects the write (409) if
    someone saved the post in between instead of silently discarding their edit.
    """
    post = get_post(creds, post_id)
    update: dict = {"updated_at": post.get("updated_at")}
    if post.get("lexical"):
        update["lexical"] = insert_video_into_lexical(post["lexical"], card, position, card_type)
    elif post.get("mobiledoc"):
        update["mobiledoc"] = insert_video_into_mobiledoc(
            post["mobiledoc"], card, position, card_type
        )
    else:
        raise SourceError(
            "This post's format isn't supported. Create a new draft instead.",
            code="unsupported_editor",
        )
    body = _request(creds, "PUT", f"posts/{post_id}/", json={"posts": [update]})
    return (body.get("posts") or [{}])[0]


def create_draft_with_video(
    creds: GhostCredentials, title: str, card: dict, card_type: str = "video"
) -> dict:
    body = _request(
        creds, "POST", "posts/",
        json={"posts": [{
            "title": title[:255] or "Video",
            "status": "draft",
            "lexical": empty_lexical_with_video(card, card_type),
        }]},
    )
    return (body.get("posts") or [{}])[0]


def editor_url(site_url: str, post_id: str) -> str:
    return f"{site_url}/ghost/#/editor/post/{post_id}"


def media_file_name(project_name: str) -> str:
    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in project_name.lower())
    safe = "-".join(filter(None, safe.split("-")))[:60] or "video"
    return f"{safe}-{uuid.uuid4().hex[:8]}.mp4"
