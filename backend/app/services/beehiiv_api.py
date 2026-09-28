"""Beehiiv API v2 client — list publications and posts, fetch a post's HTML,
and (Max/Enterprise plans only) create or extend a post with the video.

Beehiiv can't host an MP4, so "add the video" means an image block — the
click-to-watch thumbnail — linked to the hosted watch page. Writing posts is
restricted to Max and Enterprise publications; on any other plan Beehiiv
answers 403, which is surfaced as ``plan_required`` (not a bad key) so the UI
can fall back to the copy-paste newsletter snippet (routers/content_sources.py).

Auth is a plain bearer API key created under Settings → API. The key is scoped
to the workspace; a workspace can hold several publications, and the one the
user picks at connect time is stored as the connection's ``account_id``.
"""
import re
from datetime import datetime, timezone

import httpx

from app.config import settings
from app.services.source_common import HTTP_TIMEOUT, SourceError, raise_for_provider_status

PROVIDER = "Beehiiv"
BASE_URL = "https://api.beehiiv.com/v2"


PLAN_REQUIRED_MESSAGE = "Adding videos to Beehiiv posts requires a Beehiiv Max or Enterprise plan."


def _base_url() -> str:
    """Read per call, so BEEHIIV_API_BASE_URL (e.g. the local mock) is honoured everywhere."""
    return (settings.BEEHIIV_API_BASE_URL or BASE_URL).rstrip("/")


OUTAGE_MESSAGE = "Beehiiv is currently unavailable. Please try again later."
PUBLICATION_GONE_MESSAGE = "Your Beehiiv publication could not be found. Please reconnect Beehiiv."


def _send(api_key: str, path: str, params=None, method: str = "GET", json=None) -> httpx.Response:
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT) as client:
            return client.request(
                method,
                f"{_base_url()}/{path.lstrip('/')}",
                headers={"Authorization": f"Bearer {(api_key or '').strip()}"},
                params=params,
                json=json,
            )
    except httpx.TimeoutException:
        raise SourceError("Beehiiv did not respond in time. Please try again.", retryable=True)
    except httpx.HTTPError:
        raise SourceError("Unable to connect to Beehiiv. Please try again.", retryable=True)


def _is_plan_error(resp: httpx.Response) -> bool:
    """A write refused because of the publication's plan, not the key.

    Beehiiv answers 403 — or, as reported in the wild, a 401 carrying
    ``SEND_API_NOT_ENTERPRISE_PLAN``. Either way the key is fine, so this must
    never read as "reconnect".
    """
    if resp.status_code == 403:
        return True
    if resp.status_code != 401:
        return False
    text = (resp.text or "").lower()
    return "not_enterprise_plan" in text or bool(re.search(r"\bplan\b", text))


def _request(api_key: str, path: str, params=None, method: str = "GET", json=None) -> dict:
    resp = _send(api_key, path, params=params, method=method, json=json)
    if method != "GET" and _is_plan_error(resp):
        raise SourceError(PLAN_REQUIRED_MESSAGE, code="plan_required")
    if resp.status_code >= 500:
        raise SourceError(OUTAGE_MESSAGE, retryable=True)
    raise_for_provider_status(resp, PROVIDER)
    try:
        return resp.json()
    except ValueError:
        raise SourceError("Beehiiv returned an invalid response. Please try again.", retryable=True)


def can_write_posts(api_key: str, publication_id: str) -> bool:
    """Whether the publication's plan allows post writes — without writing.

    Beehiiv exposes no plan field, so this sends a create with an empty body:
    ``title`` is required, so it can never create a post. A plan refusal means
    False; a validation error (the plan check passed) means True. Anything else
    raises SourceError with a user-facing reason (bad key, publication gone,
    rate limit, outage). If Beehiiv ever validated before checking the plan,
    this would say True and the publish would still fail as ``plan_required``.
    """
    resp = _send(api_key, f"publications/{publication_id}/posts", method="POST", json={})
    if _is_plan_error(resp):
        return False
    if resp.status_code in (400, 422) or resp.status_code < 300:
        return True
    if resp.status_code == 404:
        raise SourceError(PUBLICATION_GONE_MESSAGE, code="publication_not_found")
    if resp.status_code >= 500:
        raise SourceError(OUTAGE_MESSAGE, retryable=True)
    raise_for_provider_status(resp, PROVIDER)
    raise SourceError("Beehiiv returned an unexpected response. Please try again.", retryable=True)


def list_publications(api_key: str) -> list[dict]:
    """Every publication the key can see: [{id, name}]. Also validates the key."""
    body = _request(api_key, "publications", params={"limit": 100})
    return [
        {"id": p.get("id"), "name": p.get("name") or p.get("id")}
        for p in body.get("data") or []
        if p.get("id")
    ]


def list_posts(
    api_key: str, publication_id: str, page: int = 1,
    search: str | None = None, limit: int = 20,
) -> dict:
    """One page of posts, newest first, drafts included.

    Beehiiv has no title search, so ``search`` filters the fetched page only.
    The UI says as much by keeping pagination visible while a filter is typed.
    """
    try:
        body = _request(
            api_key, f"publications/{publication_id}/posts",
            params={
                "limit": limit,
                "page": max(1, page),
                "status": "all",
                "order_by": "created",
                "direction": "desc",
            },
        )
    except SourceError as exc:
        # A 404 on the listing is the publication, not a post.
        if exc.code == "post_not_found":
            raise SourceError(PUBLICATION_GONE_MESSAGE, code="publication_not_found")
        raise
    posts = [_post_summary(p) for p in body.get("data") or []]
    posts = [p for p in posts if p["status"] != "archived"]
    if search and search.strip():
        needle = search.strip().lower()
        posts = [p for p in posts if needle in (p["title"] or "").lower()]
    total_pages = body.get("total_pages") or 1
    current = body.get("page") or page
    return {
        "posts": posts,
        "page": current,
        "pages": total_pages,
        "total": body.get("total_results"),
        "has_more": current < total_pages,
    }


def _iso(ts) -> str | None:
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None


def _post_summary(post: dict) -> dict:
    raw_status = post.get("status") or "draft"
    # "confirmed" = published or scheduled to send; Beehiiv doesn't split them.
    status = "published" if raw_status == "confirmed" else raw_status
    return {
        "id": post.get("id"),
        "title": post.get("title") or "(untitled)",
        "status": status,
        "published_at": _iso(post.get("publish_date") or post.get("displayed_date")),
        "updated_at": None,
        "feature_image": post.get("thumbnail_url"),
        "url": post.get("web_url") if status == "published" else None,
        # "both" = sent to free and paid subscribers alike; only "premium" is paywalled.
        "paid": post.get("audience") == "premium",
        "excerpt": post.get("subtitle") or post.get("preview_text"),
    }


def get_post(api_key: str, publication_id: str, post_id: str) -> dict:
    """The post plus its rendered HTML, as ``{..summary, "html": str}``.

    Premium content is preferred when present: it is the full post, where the
    free version of a paywalled post stops at the paywall.
    """
    body = _request(
        api_key, f"publications/{publication_id}/posts/{post_id}",
        params=[("expand[]", "free_web_content"), ("expand[]", "premium_web_content")],
    )
    post = body.get("data") or {}
    if not post:
        raise SourceError("Beehiiv could not find that post.", code="post_not_found")
    content = post.get("content") or {}
    premium = ((content.get("premium") or {}).get("web")) or ""
    free = ((content.get("free") or {}).get("web")) or ""
    return {**_post_summary(post), "html": premium or free}


def video_blocks(thumbnail_url: str, watch_url: str, title: str) -> list[dict]:
    """The video as Beehiiv blocks: its thumbnail, linked to the watch page."""
    return [{
        "type": "image",
        "imageUrl": thumbnail_url,
        "url": watch_url,
        "alt_text": (title or "Watch the video")[:255],
    }]


def create_draft_post(api_key: str, publication_id: str, title: str, blocks: list[dict]) -> dict:
    """Create a draft holding ``blocks``. Returns ``{"id", "web_url"}``.

    ``status`` is always sent: Beehiiv changed the default for an omitted status,
    and a draft must never go out to subscribers by accident.
    """
    body = _request(
        api_key, f"publications/{publication_id}/posts", method="POST",
        json={"title": (title or "Video")[:255], "status": "draft", "blocks": blocks},
    )
    post = body.get("data") or {}
    return {"id": post.get("id"), "web_url": post.get("web_url")}


def add_blocks_to_post(
    api_key: str, publication_id: str, post_id: str, blocks: list[dict], position: str
) -> dict:
    """Add ``blocks`` at the top (``"top"``) or bottom of an existing post."""
    body = _request(
        api_key, f"publications/{publication_id}/posts/{post_id}", method="PATCH",
        json={
            "blocks": blocks,
            "content_merge_strategy": "prepend" if position == "top" else "append",
        },
    )
    post = body.get("data") or {}
    return {"id": post.get("id") or post_id, "web_url": post.get("web_url")}
