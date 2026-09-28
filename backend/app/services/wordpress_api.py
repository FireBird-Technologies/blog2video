"""WordPress REST API client — read posts, upload media, add a video to a post.

One platform, two ways in (``SocialConnection.auth_kind``):

* **Self-hosted** (WordPress.org, and WordPress.com Business/Atomic sites on
  their own domain): an *application password* (core since WP 5.6) sent as
  HTTP Basic auth, against the site's own REST root — discovered, because it
  is ``/wp-json/`` on most sites but ``/?rest_route=/`` with plain permalinks.
* **WordPress.com** (Simple sites, and Jetpack sites picked in its site
  chooser): an OAuth bearer token against the public-api.wordpress.com proxy,
  ``/wp/v2/sites/{blog_id}/…``, which speaks the same wp/v2 API.

What a video can become depends on the site and the user's role, so publishing
re-reads ``capabilities`` every time (plans and roles change) and
``choose_delivery`` picks: upload the MP4 as a video block, embed our player in
an HTML block (needs ``unfiltered_html`` / a plugin-enabled WordPress.com plan),
or a click-to-watch thumbnail image linked to the watch page (always possible).

Every call is synchronous: the importer runs in a request handler and the
publisher on a publish_queue worker thread.
"""
import base64
import html
import json
import re
from dataclasses import dataclass
from typing import Callable
from urllib.parse import urljoin, urlparse

import httpx

from app.config import settings
from app.models.social_connection import WP_AUTH_APP_PASSWORD, WP_AUTH_WPCOM_OAUTH
from app.services.source_common import (
    HTTP_TIMEOUT,
    UPLOAD_TIMEOUT,
    SourceError,
    assert_public_host,
)

PROVIDER = "WordPress"
WPCOM_API = "https://public-api.wordpress.com"
WPCOM_AUTHORIZE_URL = f"{WPCOM_API}/oauth2/authorize"
WPCOM_TOKEN_URL = f"{WPCOM_API}/oauth2/token"
API_LINK_REL = "https://api.w.org/"
# Statuses listed for import, widest first. A role that can't see some of them
# (a Contributor asking for private posts) gets a 400, so we narrow and retry.
_STATUS_SETS = (
    "publish,future,draft,pending,private",
    "publish,future,draft,pending",
    "publish,draft",
    "publish",
)
_LIST_FIELDS = (
    "id,title,status,date_gmt,modified_gmt,link,excerpt,password,featured_media,"
    "_links,_embedded"
)
_STATUS_MAP = {
    "publish": "published",
    "future": "scheduled",
    "draft": "draft",
    "pending": "pending",
    "private": "private",
}
# WordPress.com plans, matched as substrings of plan.product_slug. Per the
# WordPress.com support pages (checked 2026-09):
#   video uploads — Premium ("upload video files like MP4… video block") and
#     Business/Commerce (VideoPress); not Personal, not Free.
#   custom code / iframes — any paid plan (Personal and up), once the site's
#     hosting features are activated (the site is then "atomic").
# Premium's slug is the legacy "value_bundle".
_WPCOM_VIDEO_PLANS = ("value_bundle", "premium", "business", "ecommerce", "pro-plan", "wooexpress")
_WPCOM_PERSONAL_PLANS = ("personal",)


@dataclass
class WordPressCredentials:
    auth_kind: str
    api_root: str  # REST root (self-hosted) or the WordPress.com site proxy
    site_url: str  # the site's home URL, for links and the editor URL
    secret: str  # "username:app_password" or the WordPress.com bearer token
    blog_id: str | None = None  # WordPress.com only

    @property
    def is_wpcom(self) -> bool:
        return self.auth_kind == WP_AUTH_WPCOM_OAUTH


def wpcom_api_root(blog_id: str) -> str:
    return f"{WPCOM_API}/wp/v2/sites/{blog_id}/"


def clean_app_password(raw: str) -> str:
    """WordPress shows application passwords in 4-char groups; spaces are
    ignored when it verifies them, so strip them rather than make users."""
    return re.sub(r"\s+", "", raw or "")


# ─── Transport ───────────────────────────────────────────────────────────────


def _headers(creds: WordPressCredentials) -> dict[str, str]:
    if creds.is_wpcom:
        auth = f"Bearer {creds.secret}"
    else:
        auth = "Basic " + base64.b64encode(creds.secret.encode()).decode()
    return {"Authorization": auth, "Accept": "application/json"}


def _endpoint(creds: WordPressCredentials, route: str, params: dict | None) -> tuple[str, dict]:
    """URL + query for a REST ``route`` like ``wp/v2/posts``.

    Self-hosted roots come in two shapes: ``https://site/wp-json/`` (pretty
    permalinks) and ``https://site/?rest_route=/`` (plain permalinks), where
    the route travels as a query parameter.
    """
    route = route.lstrip("/")
    params = dict(params or {})
    if creds.is_wpcom:
        if route.startswith("wp/v2/"):
            return f"{WPCOM_API}/wp/v2/sites/{creds.blog_id}/{route[len('wp/v2/'):]}", params
        return f"{WPCOM_API}/{route}", params
    root = creds.api_root
    if "rest_route=" in root:
        params["rest_route"] = "/" + route
        return root.split("?", 1)[0], params
    return root.rstrip("/") + "/" + route, params


def _guard_host(url: str) -> None:
    """SSRF check, re-run on every self-hosted call: a hostname that resolved
    publicly at connect time can be re-pointed at an internal address later."""
    host = (urlparse(url).hostname or "").lower()
    if host == urlparse(WPCOM_API).hostname:
        return
    if settings.ENVIRONMENT != "local":
        assert_public_host(host)


def _send(method: str, url: str, *, headers: dict, timeout=HTTP_TIMEOUT, **kwargs) -> httpx.Response:
    _guard_host(url)
    try:
        # follow_redirects stays off: the SSRF check covered this host only.
        with httpx.Client(timeout=timeout, follow_redirects=False) as client:
            return client.request(method, url, headers=headers, **kwargs)
    except httpx.TimeoutException:
        raise SourceError("Your WordPress site took too long to respond.", retryable=True)
    except httpx.HTTPError:
        raise SourceError(
            "We couldn't reach your WordPress site. Check the site URL.",
            code="invalid_site", retryable=True,
        )


def _request(
    creds: WordPressCredentials, method: str, route: str, *,
    params: dict | None = None, timeout=HTTP_TIMEOUT, **kwargs,
) -> httpx.Response:
    url, query = _endpoint(creds, route, params)
    resp = _send(method, url, headers=_headers(creds), params=query, timeout=timeout, **kwargs)
    if resp.status_code in (301, 302, 307, 308):
        target = urljoin(url, resp.headers.get("location", ""))
        raise SourceError(
            f"Your site redirects to {urlparse(target).netloc or 'another address'}. "
            "Use that address instead.",
            code="invalid_site",
        )
    raise_for_wp_status(resp, creds)
    return resp


def _json(resp: httpx.Response):
    try:
        return resp.json()
    except ValueError:
        raise SourceError(
            "Your site blocked our request. Check your security plugin or firewall.",
            code="blocked_by_firewall",
        )


def _error_body(resp: httpx.Response) -> dict | None:
    try:
        body = resp.json()
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


def raise_for_wp_status(resp: httpx.Response, creds: WordPressCredentials | None = None) -> None:
    """Map a WordPress error (``{code, message, data: {status}}``) to a SourceError."""
    status = resp.status_code
    if status < 400:
        return
    body = _error_body(resp)
    code = str((body or {}).get("code") or (body or {}).get("error") or "")
    message = html.unescape(re.sub(
        r"<[^>]+>", "", str((body or {}).get("message") or (body or {}).get("error_description") or "")
    ))[:300]
    lowered = f"{code} {message}".lower()
    wpcom = bool(creds and creds.is_wpcom)

    if body is None and status in (403, 406, 503) and "html" in resp.headers.get("content-type", ""):
        raise SourceError(
            "Your site blocked our request. Check your security plugin or firewall.",
            code="blocked_by_firewall", retryable=status == 503,
        )
    if code == "rest_not_logged_in" and not wpcom:
        # WordPress didn't log us in. Usually the username/application password
        # is wrong (some sites answer a bad password this way rather than with
        # incorrect_password); otherwise the host dropped the Authorization
        # header (Apache CGI/FastCGI). From outside the two look the same.
        raise SourceError(
            "Wrong username or application password. Check both and try again.",
            code="auth_header_stripped",
        )
    if code == "application_passwords_disabled":
        raise SourceError(
            "Application passwords are turned off on this site.",
            code="app_passwords_disabled",
        )
    if status == 401 or code in (
        "incorrect_password", "invalid_username", "invalid_email",
        "invalid_token", "authorization_required", "unauthorized",
    ):
        raise SourceError(
            "Your WordPress.com connection expired. Please reconnect."
            if wpcom else
            "Wrong username or application password. Check both and try again.",
            code="invalid_key",
        )
    if code in ("rest_upload_user_quota_exceeded", "rest_upload_limited_space") or "quota" in lowered:
        raise SourceError(
            "Your WordPress site is out of storage.", code="storage_full",
        )
    if status == 413 or code == "rest_upload_file_too_big" or (
        "upload" in code and any(k in lowered for k in ("exceeds", "too large", "too big", "maximum upload"))
    ):
        raise SourceError(
            "The video is too large for your WordPress site.",
            code="upload_too_large",
        )
    if "upload" in code and any(k in lowered for k in ("file type", "not allowed", "mime")):
        raise SourceError(
            "Your WordPress site doesn't accept video uploads.",
            code="video_not_supported",
        )
    if code == "rest_post_invalid_page_number":
        raise SourceError("No more posts.", code="page_out_of_range")
    if status == 404 or code in ("rest_post_invalid_id", "rest_invalid_post"):
        raise SourceError(
            "That post wasn't found. It may have been deleted.",
            code="post_not_found",
        )
    if status == 403 or code.startswith(("rest_forbidden", "rest_cannot")):
        raise SourceError(
            "Your WordPress account doesn't have permission to do that.",
            code="permission_denied",
        )
    if status == 409:
        raise SourceError(
            "The post changed while we were updating it. Please try again.",
            code="conflict", retryable=True,
        )
    if status == 429:
        raise SourceError(
            "Too many requests. Please try again in a minute.",
            code="rate_limited", retryable=True,
        )
    raise SourceError(
        message or f"WordPress returned an error ({status}).",
        code="provider_error", retryable=status >= 500,
    )


# ─── Discovery (self-hosted connect) ─────────────────────────────────────────


def _https_ok(url: str) -> bool:
    scheme = urlparse(url).scheme
    return scheme == "https" or (settings.ENVIRONMENT == "local" and scheme == "http")


def _api_link(resp: httpx.Response) -> str | None:
    """The REST root from ``Link: <…>; rel="https://api.w.org/"``, which every
    WordPress page sends whatever its permalink structure."""
    for part in resp.headers.get_list("link") if hasattr(resp.headers, "get_list") else [resp.headers.get("link", "")]:
        for item in part.split(","):
            m = re.match(r'\s*<([^>]+)>\s*;\s*rel="?([^";]+)"?', item)
            if m and m.group(2) == API_LINK_REL:
                return m.group(1)
    return None


def _follow(url: str, *, hops: int = 3) -> tuple[str, httpx.Response | None]:
    """GET ``url`` following up to ``hops`` redirects by hand, SSRF-checking
    and https-checking each hop (http→https, www↔apex are common)."""
    headers = {"Accept": "text/html,application/json"}
    resp = None
    for _ in range(hops + 1):
        resp = _send("GET", url, headers=headers)
        if resp.status_code in (301, 302, 303, 307, 308) and resp.headers.get("location"):
            nxt = urljoin(url, resp.headers["location"])
            if not _https_ok(nxt):
                raise SourceError(
                    "Your site must use https.",
                    code="invalid_site",
                )
            url = nxt
            continue
        return url, resp
    raise SourceError("Your site redirected too many times.", code="invalid_site")


def discover_site(site_url: str) -> dict:
    """Find the REST root of a self-hosted WordPress site.

    Returns ``{api_root, site_url, name, icon, app_passwords}``. Tries the
    ``Link`` header on the home page, then ``/wp-json/``, then the plain-
    permalink form ``/?rest_route=/``.
    """
    candidates: list[str] = []
    home = site_url
    blocked = False
    try:
        home, resp = _follow(site_url)
        link = _api_link(resp) if resp is not None else None
        if link and _https_ok(link):
            candidates.append(link)
        if resp is not None and resp.status_code in (403, 503) and _error_body(resp) is None:
            blocked = True
    except SourceError as exc:
        if exc.code != "invalid_site" or "redirect" in str(exc):
            raise
    base = home.split("?", 1)[0].split("#", 1)[0].rstrip("/")
    candidates += [f"{base}/wp-json/", f"{base}/?rest_route=/"]

    for root in dict.fromkeys(candidates):
        try:
            final, resp = _follow(root, hops=1)
        except SourceError:
            continue
        if resp is None or resp.status_code >= 400:
            if resp is not None and resp.status_code in (403, 503) and _error_body(resp) is None:
                blocked = True
            continue
        body = _error_body(resp)
        if not body or "wp/v2" not in (body.get("namespaces") or []):
            continue
        if final.rstrip("/") + "/" != root.rstrip("/") + "/" and "rest_route" not in root:
            root = final
        home_url = str(body.get("home") or body.get("url") or base).rstrip("/")
        if not _https_ok(home_url):
            home_url = base
        return {
            "api_root": root if "rest_route" in root else root.rstrip("/") + "/",
            "site_url": home_url,
            "name": html.unescape(str(body.get("name") or "")) or urlparse(home_url).netloc,
            "icon": body.get("site_icon_url") or None,
            "app_passwords": "application-passwords" in (body.get("authentication") or {}),
        }
    if blocked:
        raise SourceError(
            "Your site blocked our request. Check your security plugin or firewall.",
            code="blocked_by_firewall",
        )
    raise SourceError(
        "That doesn't look like a WordPress site. Check the URL.",
        code="invalid_site",
    )


# ─── Read ────────────────────────────────────────────────────────────────────


def get_me(creds: WordPressCredentials) -> dict:
    """The connected user, with ``capabilities`` (``context=edit``)."""
    return _json(_request(creds, "GET", "wp/v2/users/me", params={"context": "edit"}))


def get_wpcom_site(creds: WordPressCredentials) -> dict:
    """WordPress.com site info: name, URL, icon, plan, atomic/jetpack, and the
    user's capabilities on it."""
    return _json(_request(creds, "GET", f"rest/v1.1/sites/{creds.blog_id}"))


def _plain(text: str | None) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def _featured_image(post: dict) -> str | None:
    media = ((post.get("_embedded") or {}).get("wp:featuredmedia") or [])
    if not media or not isinstance(media[0], dict):
        return None
    item = media[0]
    sizes = ((item.get("media_details") or {}).get("sizes") or {})
    for size in ("medium_large", "large", "medium"):
        url = (sizes.get(size) or {}).get("source_url")
        if url:
            return url
    return item.get("source_url")


def _gmt(value: str | None) -> str | None:
    if not value:
        return None
    return value if value.endswith("Z") else value + "Z"


def _post_summary(post: dict) -> dict:
    wp_status = post.get("status") or "draft"
    status = _STATUS_MAP.get(wp_status, "draft")
    title = post.get("title") or {}
    return {
        "id": str(post.get("id")),
        "title": _plain(title.get("raw") if isinstance(title, dict) and title.get("raw") is not None
                        else (title.get("rendered") if isinstance(title, dict) else title)) or "(untitled)",
        "status": status,
        "published_at": _gmt(post.get("date_gmt")) if wp_status in ("publish", "future", "private") else None,
        "updated_at": _gmt(post.get("modified_gmt")),
        "feature_image": _featured_image(post),
        # Only a published post has a URL worth sending readers to.
        "url": post.get("link") if wp_status == "publish" else None,
        # Private and password-protected posts aren't public reading.
        "paid": wp_status == "private" or bool(post.get("password")),
        "excerpt": _plain((post.get("excerpt") or {}).get("rendered")) or None,
    }


def list_posts(
    creds: WordPressCredentials, page: int = 1, search: str | None = None, limit: int = 20
) -> dict:
    """One page of posts, most recently edited first, drafts included."""
    params = {
        "context": "edit",
        "per_page": limit,
        "page": max(1, page),
        "orderby": "modified",
        "order": "desc",
        "_embed": "wp:featuredmedia",
        "_fields": _LIST_FIELDS,
    }
    term = (search or "").strip()[:100]
    if term:
        params["search"] = term
    resp = None
    for statuses in _STATUS_SETS:
        try:
            resp = _request(creds, "GET", "wp/v2/posts", params={**params, "status": statuses})
            break
        except SourceError as exc:
            if exc.code == "page_out_of_range":
                return {"posts": [], "page": page, "pages": page - 1, "total": None, "has_more": False}
            # A role that can't list some statuses gets a 400 (rest_invalid_param
            # / rest_forbidden_status): narrow the set and try again.
            if exc.code in ("provider_error", "permission_denied") and not exc.retryable:
                continue
            raise
    if resp is None:
        raise SourceError(
            "Your WordPress account can't list posts. It needs at least the Contributor role.",
            code="permission_denied",
        )
    body = _json(resp)
    posts = [_post_summary(p) for p in body if isinstance(p, dict)] if isinstance(body, list) else []
    total = _int_header(resp, "x-wp-total")
    pages = _int_header(resp, "x-wp-totalpages") or 1
    return {
        "posts": posts,
        "page": page,
        "pages": pages,
        "total": total,
        "has_more": page < pages,
    }


def _int_header(resp: httpx.Response, name: str) -> int | None:
    try:
        return int(resp.headers.get(name, ""))
    except ValueError:
        return None


def get_post(creds: WordPressCredentials, post_id: str) -> dict:
    """A post in edit context: ``content.raw`` (for inserting), ``content.rendered``
    (shortcodes expanded, for importing), ``modified_gmt`` (for conflict checks)."""
    return _json(_request(
        creds, "GET", f"wp/v2/posts/{post_id}",
        params={"context": "edit", "_embed": "wp:featuredmedia"},
    ))


def normalize_post(post: dict) -> dict:
    """The shape source_importer expects: {id, title, status, url, feature_image, html}."""
    summary = _post_summary(post)
    content = post.get("content") or {}
    body = content.get("rendered") or content.get("raw") or ""
    return {
        "id": summary["id"],
        "title": summary["title"],
        "status": summary["status"],
        "url": summary["url"],
        "feature_image": summary["feature_image"],
        "html": body,
    }


# ─── Capabilities → how the video goes in ────────────────────────────────────


def _wpcom_hosting_active(site: dict) -> bool:
    """Hosting features activated: the site runs on WordPress.com's full
    WordPress hosting ("atomic"), where custom code and iframes are allowed."""
    options = site.get("options") or {}
    return bool(options.get("is_wpcom_atomic") or options.get("is_automated_transfer"))


def _wpcom_plan_has_video(site: dict) -> bool:
    plan = site.get("plan") or {}
    slug = str(plan.get("product_slug") or "").lower()
    if any(p in slug for p in _WPCOM_VIDEO_PLANS):
        return True
    active = (plan.get("features") or {}).get("active") or []
    return any(f in active for f in ("videopress", "upload-video-files"))


def _block_editor_upload_limit(creds: WordPressCredentials) -> int | None:
    """Best effort: the server's max upload size as the block editor sees it
    (PHP upload_max_filesize/post_max_size). Unknown on most sites — then we
    just try the upload and fall back if it's refused."""
    try:
        body = _json(_request(creds, "GET", "wp-block-editor/v1/settings"))
    except SourceError:
        return None
    value = body.get("maxUploadFileSize") if isinstance(body, dict) else None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
        return None
    return int(value)


def capabilities(creds: WordPressCredentials) -> dict:
    """What this connection can put into a post, read live (plans and roles change).

    ``{can_upload_video, can_upload_images, can_embed, can_edit_others,
    upload_limit_bytes, reason}`` — ``reason`` explains a missing ability in
    user terms, for the publish modal.
    """
    if creds.is_wpcom:
        site = get_wpcom_site(creds)
        caps = site.get("capabilities") or {}
        hosting = _wpcom_hosting_active(site)
        jetpack = bool(site.get("jetpack")) and not hosting
        can_upload = caps.get("upload_files", True) is not False
        slug = str((site.get("plan") or {}).get("product_slug") or "").lower()
        # Jetpack sites are self-hosted: the host decides, like any WordPress.
        can_video = can_upload and (_wpcom_plan_has_video(site) or jetpack)
        can_embed = hosting or (jetpack and bool(caps.get("unfiltered_html")))
        reason = None
        if not can_upload:
            reason = "Your WordPress.com role can't upload media."
        elif not can_video:
            reason = "Your WordPress.com plan doesn't include video uploads."
            if not can_embed and any(p in slug for p in _WPCOM_PERSONAL_PLANS):
                # Personal can't upload video, but can show our player once
                # hosting features are on.
                reason += " Activate hosting features to embed the video player instead."
        return {
            "can_upload_video": can_video,
            "can_upload_images": can_upload,
            "can_embed": can_embed,
            "can_edit_others": bool(caps.get("edit_others_posts")),
            "upload_limit_bytes": None,
            "reason": reason,
        }

    me = get_me(creds)
    caps = me.get("capabilities") or {}
    can_upload = bool(caps.get("upload_files"))
    can_embed = bool(caps.get("unfiltered_html"))
    reason = None
    if not can_upload:
        reason = "Your WordPress role can't upload media."
    elif not can_embed:
        reason = "Your WordPress role can't add embeds."
    return {
        "can_upload_video": can_upload,
        "can_upload_images": can_upload,
        "can_embed": can_embed,
        "can_edit_others": bool(caps.get("edit_others_posts")),
        "upload_limit_bytes": _block_editor_upload_limit(creds) if can_upload else None,
        "reason": reason,
    }


def fallback_delivery(caps: dict) -> str:
    """What to use when the video itself can't go in: our player, else a thumbnail."""
    return "embed" if caps.get("can_embed") else "link"


def choose_delivery(caps: dict, video_bytes: int | None) -> tuple[str, str]:
    """``(recommended, fallback)`` — recommended is video | embed | link | ask.

    * video possible and it fits (or the limit is unknown) → video
    * video possible but over a known limit → ask (fallback offered)
    * no video uploads at all → the fallback, without asking
    """
    fallback = fallback_delivery(caps)
    if not caps.get("can_upload_video"):
        return fallback, fallback
    limit = caps.get("upload_limit_bytes")
    if limit and video_bytes and video_bytes > limit:
        return "ask", fallback
    return "video", fallback


# ─── Write ───────────────────────────────────────────────────────────────────


class _ProgressFile:
    """File proxy that reports bytes read, so a multipart upload has progress."""

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
    creds: WordPressCredentials, path: str, file_name: str, mime: str,
    on_progress: Callable[[int], None] | None = None,
) -> dict:
    """Upload a file to the media library; return ``{id, source_url}``.

    Multipart, which both core and the WordPress.com proxy accept (a raw body
    doesn't survive the proxy).
    """
    with open(path, "rb") as fh:
        resp = _request(
            creds, "POST", "wp/v2/media",
            files={"file": (file_name, _ProgressFile(fh, on_progress), mime)},
            timeout=UPLOAD_TIMEOUT,
        )
    body = _json(resp)
    if not isinstance(body, dict) or not body.get("source_url"):
        raise SourceError("WordPress did not confirm the upload.", retryable=True)
    return {"id": body.get("id"), "source_url": body["source_url"]}


def is_block_content(raw: str | None) -> bool:
    """Block-editor (Gutenberg) content carries ``<!-- wp:… -->`` comments;
    classic-editor content is plain HTML. Empty content counts as blocks —
    that's what a new post in current WordPress is."""
    if not (raw or "").strip():
        return True
    return "<!-- wp:" in (raw or "")


def _attr(value: str) -> str:
    return html.escape(value or "", quote=True)


def video_card(src: str, poster: str | None, media_id: int | None, block: bool) -> str:
    poster_attr = f' poster="{_attr(poster)}"' if poster else ""
    if not block:
        return f'[video src="{_attr(src)}"{poster_attr}][/video]'
    attrs = json.dumps({"id": media_id}) + " " if media_id else ""
    # Attribute order matches core's video block save(), so the editor
    # doesn't flag the block as modified.
    return (
        f"<!-- wp:video {attrs}-->\n"
        f'<figure class="wp-block-video"><video controls{poster_attr} src="{_attr(src)}"></video></figure>\n'
        "<!-- /wp:video -->"
    )


def embed_card(iframe_html: str, block: bool) -> str:
    if not block:
        return iframe_html
    return f"<!-- wp:html -->\n{iframe_html}\n<!-- /wp:html -->"


def link_card(image_url: str, watch_url: str, title: str, media_id: int | None, block: bool) -> str:
    alt = _attr(f"Watch: {title}" if title else "Watch the video")
    img, watch = _attr(image_url), _attr(watch_url)
    if not block:
        return (
            f'<p><a href="{watch}"><img src="{img}" alt="{alt}" /></a></p>\n'
            f'<p><a href="{watch}">▶ Watch the video</a></p>'
        )
    attrs = {"sizeSlug": "large", "linkDestination": "custom"}
    img_class = ""
    if media_id:
        attrs = {"id": media_id, **attrs}
        img_class = f' class="wp-image-{media_id}"'
    return (
        f"<!-- wp:image {json.dumps(attrs)} -->\n"
        f'<figure class="wp-block-image size-large"><a href="{watch}"><img src="{img}" alt="{alt}"{img_class}/></a></figure>\n'
        "<!-- /wp:image -->\n\n"
        "<!-- wp:paragraph -->\n"
        f'<p><a href="{watch}">▶ Watch the video</a></p>\n'
        "<!-- /wp:paragraph -->"
    )


CardBuilder = Callable[[bool], str]


def add_to_post(
    creds: WordPressCredentials, post_id: str, build_card: CardBuilder, position: str
) -> dict:
    """Insert a card at the top or bottom of an existing post; return the post.

    WordPress has no conditional write, so the post's ``modified_gmt`` is
    re-read just before saving: an edit that landed in between raises a
    retryable ``conflict`` rather than being overwritten. The post's status is
    untouched, and WordPress keeps a revision, so this is undoable.
    """
    post = get_post(creds, post_id)
    content = post.get("content") or {}
    raw = content.get("raw")
    if raw is None:
        raise SourceError(
            "You can't edit that post. Pick another post or create a new draft.",
            code="permission_denied",
        )
    card = build_card(is_block_content(raw))
    body = raw.strip()
    new_content = (
        f"{body}\n\n{card}" if position == "bottom" else f"{card}\n\n{body}"
    ) if body else card

    latest = _json(_request(
        creds, "GET", f"wp/v2/posts/{post_id}",
        params={"context": "edit", "_fields": "id,modified_gmt"},
    ))
    if latest.get("modified_gmt") != post.get("modified_gmt"):
        raise SourceError(
            "The post changed while we were updating it. Please try again.",
            code="conflict", retryable=True,
        )
    return _json(_request(creds, "POST", f"wp/v2/posts/{post_id}", json={"content": new_content}))


def create_draft(creds: WordPressCredentials, title: str, build_card: CardBuilder) -> dict:
    return _json(_request(creds, "POST", "wp/v2/posts", json={
        "title": (title or "Video")[:255],
        "status": "draft",
        "content": build_card(True),
    }))


def editor_url(creds: WordPressCredentials, post_id: str | int) -> str:
    if creds.is_wpcom:
        host = urlparse(creds.site_url).netloc or str(creds.blog_id)
        return f"https://wordpress.com/post/{host}/{post_id}"
    return f"{creds.site_url.rstrip('/')}/wp-admin/post.php?post={post_id}&action=edit"


def media_file_name(project_name: str, ext: str) -> str:
    import uuid

    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in (project_name or "").lower())
    safe = "-".join(filter(None, safe.split("-")))[:60] or "video"
    return f"{safe}-{uuid.uuid4().hex[:8]}.{ext}"


# ─── WordPress.com OAuth ─────────────────────────────────────────────────────


def wpcom_enabled() -> bool:
    return bool(settings.WORDPRESS_COM_CLIENT_ID and settings.WORDPRESS_COM_CLIENT_SECRET)


def wpcom_redirect_uri() -> str:
    return f"{settings.BACKEND_URL.rstrip('/')}/api/sources/wordpress/callback"


def wpcom_authorize_url(state: str) -> str:
    """No ``scope``: WordPress.com then shows its site picker and issues a
    token for the one site chosen (the token response names it)."""
    from urllib.parse import urlencode

    return WPCOM_AUTHORIZE_URL + "?" + urlencode({
        "client_id": settings.WORDPRESS_COM_CLIENT_ID,
        "redirect_uri": wpcom_redirect_uri(),
        "response_type": "code",
        "state": state,
    })


def exchange_wpcom_code(code: str) -> dict:
    """Code → ``{access_token, blog_id, blog_url, scope}``. Tokens don't expire."""
    resp = _send(
        "POST", WPCOM_TOKEN_URL,
        headers={"Accept": "application/json"},
        data={
            "client_id": settings.WORDPRESS_COM_CLIENT_ID,
            "client_secret": settings.WORDPRESS_COM_CLIENT_SECRET,
            "redirect_uri": wpcom_redirect_uri(),
            "code": code,
            "grant_type": "authorization_code",
        },
    )
    raise_for_wp_status(resp)
    body = _json(resp)
    if not isinstance(body, dict) or not body.get("access_token"):
        raise SourceError("WordPress.com didn't return a token. Please try again.", code="invalid_key")
    return body


def resolve_wpcom_site(token: str, blog_id, blog_url: str | None) -> dict:
    """The site a WordPress.com token is for, as ``rest/v1.1/sites/{id}`` returns it.

    The token response names the site by ``blog_id`` and ``blog_url``, but
    ``blog_id`` can come back empty or 0 (and then /sites/0 is "Unknown
    blog"), so fall back to the site's domain, then to the user's only site.
    """
    candidates: list[str] = []
    if blog_id and str(blog_id) != "0":
        candidates.append(str(blog_id))
    host = urlparse(blog_url or "").netloc
    if host:
        candidates.append(host)

    def lookup(site_ref: str) -> dict:
        creds = WordPressCredentials(
            auth_kind=WP_AUTH_WPCOM_OAUTH, api_root="", site_url=blog_url or "",
            secret=token, blog_id=site_ref,
        )
        return get_wpcom_site(creds)

    last: SourceError | None = None
    for ref in candidates:
        try:
            site = lookup(ref)
            if isinstance(site, dict) and site.get("ID"):
                return site
        except SourceError as exc:
            if exc.code == "invalid_key":
                raise
            last = exc

    # No usable id or domain: the user's sites; one is unambiguous.
    try:
        creds = WordPressCredentials(
            auth_kind=WP_AUTH_WPCOM_OAUTH, api_root="", site_url="", secret=token,
        )
        mine = _json(_request(creds, "GET", "rest/v1.1/me/sites", params={"fields": "ID"}))
        sites = [s for s in (mine.get("sites") or []) if isinstance(s, dict) and s.get("ID")]
        if len(sites) == 1:
            return lookup(str(sites[0]["ID"]))
        if not sites:
            raise SourceError(
                "Your WordPress.com account doesn't have a site yet. Create one first.",
                code="invalid_site",
            )
    except SourceError as exc:
        if exc.code == "invalid_key" or "doesn't have a site" in str(exc):
            raise
        last = last or exc
    raise SourceError(
        "No site was selected. Try again and choose a site.",
        code="invalid_site",
    ) from last
