"""
MCP transport — raw ASGI handlers for the hosted MCP server's SSE transport.

Mounted on the FastAPI app in main.py:
  /mcp/sse              → GET handler that opens an SSE stream
  /mcp/messages/        → POST handler for client → server JSON-RPC messages

We use raw ASGI handlers (not FastAPI routes) because the MCP SDK's
SseServerTransport writes responses directly to the ASGI `send` callable.
FastAPI would try to write a second response on top, breaking the protocol.

Auth: every /mcp/sse connection must carry a valid Blog2Video JWT in the
Authorization header (or `?token=` query param as a fallback for clients
that can't set headers on EventSource). The JWT is stashed in a contextvar
so tool handlers can construct a per-user Blog2VideoClient.
"""
import contextvars
import logging
import urllib.parse

from fastapi import Request
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.types import TextContent, Tool
from starlette.responses import Response
from starlette.routing import Mount, Route

from app.auth import decode_access_token
from app.config import settings
from mcp_server.client import Blog2VideoClient
from mcp_server.handlers import dispatch
from mcp_server.tools import get_tool_definitions


logger = logging.getLogger(__name__)


# FastAPI router — mounted by main.py via include_router(). The /sse and
# /messages/ paths are handled by raw ASGI mounts (see starlette_routes());
# the UI iframe routes below are normal FastAPI routes (HTML responses).
from fastapi import APIRouter
from fastapi.responses import Response as FastAPIResponse
router = APIRouter(prefix="/mcp", tags=["mcp"])


# ---------------------------------------------------------------------------
# Public iframe routes for the MCP-UI `externalUrl` content type
# ---------------------------------------------------------------------------
# claude.ai's iframe loads these via <iframe src=...>. We must allow CORS from
# claude.ai origins, accept opaque `null` Origin (some hosts iframe with
# sandbox="allow-scripts" which forces null origin), and serve with the spec
# mimeType so MCP Apps clients recognize it.

_UI_MIME = "text/html;profile=mcp-app"
_UI_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Cache-Control": "no-store",
    "X-Frame-Options": "ALLOWALL",  # allow embedding in any host iframe
    "Content-Security-Policy": "frame-ancestors *",  # ditto, modern equivalent
}


@router.get("/ui/template_gallery")
async def ui_template_gallery(request: Request):
    """Serve the bundled template-gallery HTML for the iframe.

    Injects template data directly into the HTML as a window.__B2V_DATA__
    global so the iframe never needs to call fetch() (which is blocked by
    sandbox="allow-scripts" without allow-same-origin in Claude's iframe).

    Data priority in the iframe (bridge.ts):
      1. window.__B2V_DATA__  ← set here server-side (always works)
      2. ?data=<base64>       ← set by the tool handler for externalUrl
      3. postMessage          ← set by MCP Apps host
      4. fetch /api/templates ← fallback, may be sandboxed-blocked
    """
    try:
        from mcp_server.ui.resources import load_html
        html = load_html("template_gallery")
    except FileNotFoundError as e:
        return FastAPIResponse(
            content=(
                "<!doctype html><meta charset=utf-8><title>UI not built</title>"
                f"<pre>{e}</pre>"
            ),
            status_code=500,
            media_type="text/html",
            headers=_UI_CORS_HEADERS,
        )

    # Fetch templates server-side and inject into the HTML so the iframe
    # has data immediately without any client-side fetch (sandbox-safe).
    import json as _json
    templates_json = "[]"
    try:
        import httpx as _httpx
        base = settings.BACKEND_URL.rstrip("/") if settings.BACKEND_URL else "http://localhost:8000"
        async with _httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base}/api/templates")
            if resp.status_code == 200:
                raw = resp.json()
                structured = [
                    {
                        "id": t.get("id", "?"),
                        "name": t.get("name") or t.get("id", "?"),
                        "description": t.get("description", ""),
                        "genres": t.get("genres") or [],
                        "marketing_url": f"https://blog2video.app/templates/{t.get('id', '')}",
                        "preview_colors": t.get("preview_colors") or {},
                    }
                    for t in raw
                ]
                templates_json = _json.dumps(structured, ensure_ascii=False)
    except Exception:
        pass  # serve without data; bridge.ts will try ?data= and fetch() fallbacks

    # Inject before </head> so window.__B2V_DATA__ is set before React mounts
    injection = f"<script>window.__B2V_DATA__={{templates:{templates_json}}};</script>"
    html = html.replace("</head>", f"{injection}</head>", 1)

    return FastAPIResponse(content=html, media_type=_UI_MIME, headers=_UI_CORS_HEADERS)


@router.options("/ui/template_gallery")
async def ui_template_gallery_options():
    """CORS preflight."""
    return FastAPIResponse(status_code=204, headers=_UI_CORS_HEADERS)


# Per-request user JWT stashed in a ContextVar so tool handlers can read it.
_REQUEST_TOKEN: contextvars.ContextVar[str] = contextvars.ContextVar(
    "mcp_request_token", default=""
)


# ---------------------------------------------------------------------------
# MCP server instance (shared across all SSE connections)
# ---------------------------------------------------------------------------

mcp_server = Server("blog2video")


@mcp_server.list_tools()
async def _list_tools() -> list[Tool]:
    return get_tool_definitions()


@mcp_server.call_tool()
async def _call_tool(name: str, arguments: dict) -> list[TextContent]:
    token = _REQUEST_TOKEN.get()
    if not token:
        return [TextContent(type="text", text="ERROR: missing authentication token")]
    # Tool handlers use synchronous `requests` calls back to this same FastAPI
    # process. Running them inline on the event loop would deadlock — the SSE
    # connection occupies the loop and the loopback HTTP request can never be
    # served. Push the whole call into a worker thread instead.
    import anyio
    base_url = settings.BACKEND_URL

    def _run() -> list[TextContent]:
        client = Blog2VideoClient(jwt_token=token, base_url=base_url)
        return dispatch(name, arguments, client)

    return await anyio.to_thread.run_sync(_run)


# ---------------------------------------------------------------------------
# MCP Apps resource handlers — correct protocol for rendering UI in claude.ai
#
# The list_templates Tool declares `_meta.ui.resourceUri` pointing here. When
# Claude sees a tool with that field it:
#   1. Calls tools/call → gets TextContent (markdown)
#   2. Separately calls resources/read on this URI → gets the HTML
#   3. Renders the HTML in a sandboxed iframe in the chat bubble
#
# Without these handlers Claude never fetches the HTML and no iframe appears.
# ---------------------------------------------------------------------------

_GALLERY_URI = "ui://blog2video/template_gallery"
_VOICES_URI  = "ui://blog2video/voice_gallery"
_SETUP_URI   = "ui://blog2video/setup_gallery_v2"
_GALLERY_MIME = "text/html;profile=mcp-app"


async def _fetch_templates() -> list[dict]:
    """Fetch the template catalog from the backend (public endpoint)."""
    import httpx
    base = settings.BACKEND_URL.rstrip("/") if settings.BACKEND_URL else "http://localhost:8000"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base}/api/templates")
            if resp.status_code == 200:
                raw = resp.json()
                return [
                    {
                        "id": t.get("id", "?"),
                        "name": t.get("name") or t.get("id", "?"),
                        "genres": t.get("genres") or [],
                    }
                    for t in raw
                ]
    except Exception as exc:
        logger.warning("setup_gallery: failed to fetch templates: %s", exc)
    return []


async def _fetch_voices() -> list[dict]:
    """Cold-path voice fallback. Returns [] by design.

    Normal flow: _setup_video / _list_voices warm _VOICE_CACHE with the
    user's saved voices via the JWT-authenticated client. This function
    is only reached when the cache is empty (e.g. resource read before
    any tool call). We do NOT fall back to the public prebuilt catalog
    because that would leak voices the user has not saved — matches the
    saved-only semantics in handlers._fetch_user_voices().
    """
    return []


@mcp_server.list_resources()
async def _list_resources():
    from mcp.types import Resource
    from pydantic import AnyUrl
    return [
        Resource(
            uri=AnyUrl(_GALLERY_URI),
            name="Blog2Video Template Gallery",
            mimeType=_GALLERY_MIME,
            description="Interactive 12-card template gallery.",
        ),
        Resource(
            uri=AnyUrl(_VOICES_URI),
            name="Blog2Video Voice Gallery",
            mimeType=_GALLERY_MIME,
            description="Interactive voice selector with audio previews.",
        ),
        Resource(
            uri=AnyUrl(_SETUP_URI),
            name="Blog2Video Setup Panel",
            mimeType=_GALLERY_MIME,
            description="Combined template + voice selection panel for creating a video.",
        ),
    ]


@mcp_server.read_resource()
async def _read_resource(uri):
    logger.info("resources/read called: uri=%s", uri)
    import json
    from mcp_server.ui.resources import load_html
    from mcp.server.lowlevel.helper_types import ReadResourceContents

    uri_str = str(uri)

    if uri_str == _GALLERY_URI:
        html = load_html("template_gallery")
        return [ReadResourceContents(content=html, mime_type=_GALLERY_MIME)]

    if uri_str == _VOICES_URI:
        from mcp_server.handlers import _VOICE_CACHE
        voices_json = json.dumps(_VOICE_CACHE, ensure_ascii=False)
        html = load_html("voice_gallery")
        injection = f"<script>window.__B2V_VOICES__={voices_json};</script>"
        html = html.replace("</head>", f"{injection}</head>", 1)
        return [ReadResourceContents(content=html, mime_type=_GALLERY_MIME)]

    if uri_str == _SETUP_URI:
        import mcp_server.handlers as h
        templates = await _fetch_templates()
        voices = h._VOICE_CACHE or await _fetch_voices()
        if not h._VOICE_CACHE and voices:
            h._VOICE_CACHE = voices  # warm cache for create_project gate
        setup = {
            "templates": templates,
            "voices": voices,
            "blog_url": h._SETUP_BLOG_URL,
        }
        html = load_html("setup_gallery")
        injection = f"<script>window.__B2V_SETUP__={json.dumps(setup, ensure_ascii=False)};</script>"
        html = html.replace("</head>", f"{injection}</head>", 1)
        return [ReadResourceContents(content=html, mime_type=_GALLERY_MIME)]

    raise ValueError(f"Unknown resource: {uri}")


# ---------------------------------------------------------------------------
# SSE transport (legacy MCP transport: GET opens a stream, POST /messages/ sends)
# ---------------------------------------------------------------------------

# The endpoint string is the path the SDK tells the client to POST to. The
# SDK prepends scope['root_path'] (the mount prefix) automatically — since
# we mount this whole sub-app at /mcp, the endpoint is relative to that
# mount and should NOT include the /mcp prefix.
sse_transport = SseServerTransport("/messages/")


# ---------------------------------------------------------------------------
# Streamable HTTP transport (newer MCP transport: single POST endpoint)
# ---------------------------------------------------------------------------
# claude.ai's current build uses Streamable HTTP — it POSTs JSON-RPC requests
# directly to the MCP endpoint URL (the same URL the user pasted into the
# connector dialog). The session manager handles connection lifecycle.
# stateless=True means each request is self-contained (no session affinity);
# this is what claude.ai expects for hosted MCP servers.

streamable_session_manager = StreamableHTTPSessionManager(
    app=mcp_server,
    stateless=True,
)


def _extract_token_from_scope(scope) -> str | None:
    """Pull a Bearer token from headers or `?token=` query param."""
    for name, value in scope.get("headers", []):
        if name.decode("latin-1").lower() == "authorization":
            val = value.decode("latin-1")
            if val.lower().startswith("bearer "):
                return val[7:].strip()
    query = scope.get("query_string", b"").decode("latin-1")
    if query:
        params = urllib.parse.parse_qs(query)
        if "token" in params and params["token"]:
            return params["token"][0]
    return None


async def _send_simple_response(send, status: int, body: bytes, headers: list | None = None) -> None:
    """Helper: write a plain HTTP response via the ASGI `send` callable."""
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": headers or [(b"content-type", b"application/json")],
    })
    await send({"type": "http.response.body", "body": body})


class _SentinelResponse:
    """No-op ASGI response — the MCP transport already wrote the HTTP response."""
    async def __call__(self, scope, receive, send):
        return


async def _mcp_endpoint(request) -> None:
    """Starlette endpoint for /mcp/sse — handles BOTH MCP transports:

      GET  → legacy SSE transport (opens a server-sent-events stream)
      POST → Streamable HTTP transport (single JSON-RPC over POST; claude.ai's
             current default)
      DELETE → Streamable HTTP session termination

    Validates the Bearer JWT (or ?token=), stashes it in the contextvar so
    tool handlers can authenticate as the user, then dispatches to the right
    transport.

    Returns nothing — the transports write the response directly to the ASGI
    send callable.
    """
    method = request.scope.get("method", "GET")
    token = _extract_token_from_scope(request.scope)
    user_id = decode_access_token(token) if token else None
    if user_id is None:
        from starlette.responses import JSONResponse
        return JSONResponse({"detail": "Missing or invalid bearer token"}, status_code=401)

    token_var = _REQUEST_TOKEN.set(token)
    try:
        if method == "GET":
            # Legacy SSE transport
            async with sse_transport.connect_sse(
                request.scope, request.receive, request._send
            ) as (read_stream, write_stream):
                await mcp_server.run(
                    read_stream,
                    write_stream,
                    mcp_server.create_initialization_options(),
                )
        else:
            # POST or DELETE → Streamable HTTP transport
            await streamable_session_manager.handle_request(
                request.scope, request.receive, request._send
            )
    finally:
        _REQUEST_TOKEN.reset(token_var)

    # The MCP transports write the HTTP response directly via the ASGI `send`
    # callable. Starlette's Route then calls `await response(scope, receive, send)`
    # on whatever we return — returning a real Response() causes a second
    # http.response.start which fails. Return a no-op sentinel instead.
    return _SentinelResponse()


_UI_MIME = "text/html;profile=mcp-app"
_UI_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Cache-Control": "no-store",
    "X-Frame-Options": "ALLOWALL",
    "Content-Security-Policy": "frame-ancestors *",
}


async def _ui_template_gallery(request) -> Response:
    """Serve the bundled template-gallery HTML for claude.ai's iframe.

    Mounted at /mcp/ui/template_gallery inside the Starlette sub-app so it
    is reachable even though `app.mount("/mcp", ...)` intercepts all /mcp/*
    before FastAPI's include_router routes can match.
    """
    from starlette.responses import Response as StarletteResponse
    try:
        from mcp_server.ui.resources import load_html
        html = load_html("template_gallery")
        return StarletteResponse(
            content=html,
            media_type=_UI_MIME,
            headers=_UI_CORS_HEADERS,
        )
    except FileNotFoundError as exc:
        return StarletteResponse(
            content=f"<pre>UI bundle not found: {exc}</pre>",
            status_code=500,
            media_type="text/html",
            headers=_UI_CORS_HEADERS,
        )


async def _ui_template_gallery_options(request) -> Response:
    """CORS preflight for the gallery route."""
    from starlette.responses import Response as StarletteResponse
    return StarletteResponse(status_code=204, headers=_UI_CORS_HEADERS)


async def _ui_voice_gallery(request) -> Response:
    """Serve the bundled voice-gallery HTML for ChatGPT/claude.ai's iframe."""
    from starlette.responses import Response as StarletteResponse
    try:
        from mcp_server.ui.resources import load_html
        html = load_html("voice_gallery")
        return StarletteResponse(
            content=html,
            media_type=_UI_MIME,
            headers=_UI_CORS_HEADERS,
        )
    except FileNotFoundError as exc:
        return StarletteResponse(
            content=f"<pre>UI bundle not found: {exc}</pre>",
            status_code=500,
            media_type="text/html",
            headers=_UI_CORS_HEADERS,
        )


async def _ui_voice_gallery_options(request) -> Response:
    from starlette.responses import Response as StarletteResponse
    return StarletteResponse(status_code=204, headers=_UI_CORS_HEADERS)


def starlette_routes() -> list:
    """Return Starlette routes for the MCP transports, to be merged into the
    /mcp sub-app via build_sdk_starlette_app(extra_routes=...).

    /sse              → GET (SSE) + POST/DELETE (Streamable HTTP)
    /messages/        → Mount for legacy SSE POST handler (?session_id=...)
    /ui/template_gallery → Public iframe HTML for the externalUrl UIResource
    /ui/voice_gallery    → Public iframe HTML for the voice picker UIResource
    """
    return [
        Route("/sse", endpoint=_mcp_endpoint, methods=["GET", "POST", "DELETE"]),
        Mount("/messages/", app=sse_transport.handle_post_message),
        Route("/ui/template_gallery", endpoint=_ui_template_gallery, methods=["GET"]),
        Route("/ui/template_gallery", endpoint=_ui_template_gallery_options, methods=["OPTIONS"]),
        Route("/ui/voice_gallery", endpoint=_ui_voice_gallery, methods=["GET"]),
        Route("/ui/voice_gallery", endpoint=_ui_voice_gallery_options, methods=["OPTIONS"]),
    ]
