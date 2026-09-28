"""Local stand-in for the Beehiiv API v2, for where api.beehiiv.com is unreachable.

Serves the spec-shaped fixtures in tests/fixtures/beehiiv/ and keeps posts in
memory, so created drafts and prepended/appended blocks show up on later reads.
The same app backs the contract tests (tests/test_beehiiv_contract.py), so the
mock the UI is clicked through against is the one CI checks the client with.

Run:   cd backend && uvicorn dev.beehiiv_mock:app --port 4010
Point: BEEHIIV_API_BASE_URL=http://127.0.0.1:4010/v2

The bearer key picks the behaviour, so one server covers every branch:
  bad_*        → 401 on every call (connect shows "check the key")
  ratelimit_*  → 429 on every call
  outage_*     → 503 on every call (Beehiiv down)
  slow_*       → answers after 25 s, past the client's 20 s timeout
  gone_*       → connect works, but the publication 404s (deleted / not visible)
  flaky_*      → posts listing and post fetch 500; the plan check still works
  free_*       → reads work; POST/PATCH answer 401 SEND_API_NOT_ENTERPRISE_PLAN,
                 as Beehiiv does below Max/Enterprise (the plan_required path)
  anything else → success

Prefixes ignore case, and "-" works like "_" (free-key == free_key).

Inspect with GET /_mock/requests; wipe state with POST /_mock/reset.

Post links and thumbnails point back at this server (/_mock/site/…, /_mock/thumb/…),
since the fixtures' *.beehiiv.com addresses don't exist on the real Beehiiv.
"""
import asyncio
import copy
import html
import json
import re
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response

FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "beehiiv"

app = FastAPI(title="Beehiiv API v2 (mock)")

_state: dict = {}


def reset() -> None:
    _state["publications"] = json.loads((FIXTURES / "publications.json").read_text())["data"]
    _state["posts"] = json.loads((FIXTURES / "posts.json").read_text())
    _state["requests"] = []


reset()


def requests_log() -> list[dict]:
    return _state["requests"]


def _error(status: int, name: str | None = None) -> JSONResponse:
    return JSONResponse(json.loads((FIXTURES / f"error_{name or status}.json").read_text()), status_code=status)


@app.middleware("http")
async def _record_and_gate(request: Request, call_next):
    if request.url.path.startswith("/_mock"):
        return await call_next(request)
    raw = await request.body()
    try:
        body = json.loads(raw) if raw else None
    except ValueError:
        body = None
    auth = request.headers.get("authorization", "")
    key = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    _state["requests"].append({
        "method": request.method,
        "path": request.url.path,
        "query": list(request.query_params.multi_items()),
        "key": key,
        "json": body,
    })
    # Forgiving prefixes: "free-key", "Free_Key" and "free_key" all mean free_.
    key = key.lower().replace("-", "_")
    if not key or key.startswith("bad_"):
        return _error(401)
    if key.startswith("slow_"):
        await asyncio.sleep(25)
    if key.startswith("outage_"):
        return _error(503)
    if key.startswith("gone_") and request.url.path.startswith("/v2/publications/"):
        return _error(404)
    if key.startswith("flaky_") and request.method == "GET" and "/posts" in request.url.path:
        return _error(500)
    if key.startswith("ratelimit_"):
        return _error(429)
    if key.startswith("free_") and request.method in ("POST", "PATCH", "PUT", "DELETE"):
        # Checked before the body is validated, so an empty-body probe sees it too.
        return _error(401, "plan")
    return await call_next(request)


# ─── Mock controls ──────────────────────────────────────────────────────────


@app.get("/_mock/requests")
def mock_requests():
    return {"requests": requests_log()}


@app.post("/_mock/reset")
def mock_reset():
    reset()
    return {"ok": True}


@app.get("/_mock/site/{site}/p/{slug}", response_class=HTMLResponse)
def mock_post_page(site: str, slug: str):
    """Stands in for https://<site>.beehiiv.com/p/<slug>: the post's full web content."""
    for posts in _state["posts"].values():
        for post in posts:
            m = _WEB_URL_RE.match(post.get("web_url") or "")
            if m and m.groups() == (site, slug):
                content = post.get("content") or {}
                body = (content.get("premium") or {}).get("web") or (content.get("free") or {}).get("web") or ""
                return (
                    f"<!doctype html><meta charset=utf-8><title>{html.escape(post['title'])}</title>"
                    f"<body style='font-family:sans-serif;max-width:680px;margin:40px auto'>"
                    f"<p style='color:#888'>Beehiiv mock · {html.escape(post['status'])}</p>{body}</body>"
                )
    return HTMLResponse("Not found in the Beehiiv mock", status_code=404)


@app.get("/_mock/thumb/{post_id}.svg")
def mock_thumbnail(post_id: str):
    post = next((p for ps in _state["posts"].values() for p in ps if p["id"] == post_id), None)
    title = html.escape(post["title"] if post else "Beehiiv mock")
    hue = sum(map(ord, post_id)) % 360
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>"
        f"<rect width='640' height='360' fill='hsl({hue},55%,45%)'/>"
        "<text x='320' y='190' font-family='sans-serif' font-size='36' fill='white' "
        f"text-anchor='middle'>{title}</text></svg>"
    )
    return Response(svg, media_type="image/svg+xml")


# ─── Beehiiv v2 ─────────────────────────────────────────────────────────────


def _page(items: list, limit: int, page: int) -> dict:
    limit = max(1, min(limit, 100))
    page = max(1, page)
    total_pages = max(1, -(-len(items) // limit))
    start = (page - 1) * limit
    return {
        "data": items[start:start + limit],
        "limit": limit,
        "page": page,
        "total_results": len(items),
        "total_pages": total_pages,
    }


def _int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _find_pub(pub_id: str) -> dict | None:
    return next((p for p in _state["publications"] if p["id"] == pub_id), None)


def _find_post(pub_id: str, post_id: str) -> dict | None:
    return next((p for p in _state["posts"].get(pub_id, []) if p["id"] == post_id), None)


_WEB_URL_RE = re.compile(r"^https://([a-z0-9-]+)\.beehiiv\.com/p/([^/?#]+)$")


def _public(post: dict, expand: list[str], base: str) -> dict:
    """The post as Beehiiv returns it: ``content`` only for the requested expansions,
    and links rewritten to pages this mock serves (``base`` is its own root URL)."""
    out = {k: v for k, v in post.items() if k != "content"}
    m = _WEB_URL_RE.match(post.get("web_url") or "")
    if m:
        out["web_url"] = f"{base}_mock/site/{m.group(1)}/p/{m.group(2)}"
    if post.get("thumbnail_url"):
        out["thumbnail_url"] = f"{base}_mock/thumb/{post['id']}.svg"
    content = post.get("content") or {}
    wanted: dict = {}
    for item in expand:
        m = re.fullmatch(r"(free|premium)_(web|email|rss)_content", item)
        if m:
            tier, kind = m.groups()
            wanted.setdefault(tier, {})[kind] = (content.get(tier) or {}).get(kind)
    if wanted:
        out["content"] = wanted
    return out


def _render_blocks(blocks: list) -> str:
    parts = []
    for b in blocks or []:
        if not isinstance(b, dict):
            continue
        if b.get("type") == "image":
            img = (
                f'<img src="{html.escape(str(b.get("imageUrl") or ""))}" '
                f'alt="{html.escape(str(b.get("alt_text") or ""))}">'
            )
            parts.append(f'<a href="{html.escape(str(b["url"]))}">{img}</a>' if b.get("url") else img)
        elif b.get("type") == "paragraph":
            parts.append(f"<p>{html.escape(str(b.get('plaintext') or ''))}</p>")
    return "".join(parts)


@app.get("/v2/publications")
def list_publications(request: Request):
    q = request.query_params
    return _page(list(_state["publications"]), _int(q.get("limit"), 10), _int(q.get("page"), 1))


@app.get("/v2/publications/{pub_id}/posts")
def list_posts(pub_id: str, request: Request):
    if not _find_pub(pub_id):
        return _error(404)
    q = request.query_params
    posts = list(_state["posts"].get(pub_id, []))
    status = q.get("status") or "all"
    if status != "all":
        posts = [p for p in posts if p["status"] == status]
    order_by = q.get("order_by") or "created"
    if order_by not in ("created", "publish_date", "displayed_date"):
        order_by = "created"
    posts.sort(key=lambda p: p.get(order_by) or 0, reverse=(q.get("direction") or "asc") == "desc")
    body = _page(posts, _int(q.get("limit"), 10), _int(q.get("page"), 1))
    expand = q.getlist("expand[]") or q.getlist("expand")
    body["data"] = [_public(p, expand, str(request.base_url)) for p in body["data"]]
    return body


@app.get("/v2/publications/{pub_id}/posts/{post_id}")
def get_post(pub_id: str, post_id: str, request: Request):
    post = _find_post(pub_id, post_id)
    if not post:
        return _error(404)
    q = request.query_params
    return {"data": _public(post, q.getlist("expand[]") or q.getlist("expand"), str(request.base_url))}


@app.post("/v2/publications/{pub_id}/posts")
async def create_post(pub_id: str, request: Request):
    pub = _find_pub(pub_id)
    if not pub:
        return _error(404)
    body = await request.json()
    title = (body.get("title") or "").strip()
    if not title:
        return JSONResponse(
            {"status": 400, "statusText": "Bad Request", "errors": [{"message": "title is required"}]},
            status_code=400,
        )
    now = int(time.time())
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "post"
    # Omitted status publishes, as the real API now does — the client must send "draft".
    status = body.get("status") or "confirmed"
    web = _render_blocks(body.get("blocks"))
    host = re.sub(r"[^a-z0-9]+", "-", pub["name"].lower()).strip("-")
    post = {
        "id": f"post_{uuid.uuid4()}",
        "title": title,
        "subtitle": body.get("subtitle"),
        "authors": [],
        "created": now,
        "status": status,
        "publish_date": now if status == "confirmed" else None,
        "displayed_date": now if status == "confirmed" else None,
        "split_tested": False,
        "subject_line": title,
        "preview_text": None,
        "slug": slug,
        "thumbnail_url": None,
        "web_url": f"https://{host}.beehiiv.com/p/{slug}",
        "audience": "free",
        "platform": "both",
        "content_tags": [],
        "hidden_from_feed": False,
        "content": {
            "free": {"web": web, "email": web, "rss": web},
            "premium": {"web": None, "email": None},
        },
    }
    _state["posts"].setdefault(pub_id, []).append(post)
    return JSONResponse({"data": _public(post, [], str(request.base_url))}, status_code=201)


@app.patch("/v2/publications/{pub_id}/posts/{post_id}")
async def update_post(pub_id: str, post_id: str, request: Request):
    post = _find_post(pub_id, post_id)
    if not post:
        return _error(404)
    body = await request.json()
    if body.get("title"):
        post["title"] = body["title"]
    if "blocks" in body:
        added = _render_blocks(body.get("blocks"))
        strategy = body.get("content_merge_strategy") or "replace"
        content = copy.deepcopy(post.get("content") or {})
        for tier in ("free", "premium"):
            for kind in ("web", "email", "rss"):
                tier_content = content.setdefault(tier, {})
                if kind not in tier_content or (tier == "premium" and tier_content.get(kind) is None):
                    continue
                current = tier_content.get(kind) or ""
                tier_content[kind] = (
                    added + current if strategy == "prepend"
                    else current + added if strategy == "append"
                    else added
                )
        post["content"] = content
    return {"data": _public(post, [], str(request.base_url))}
