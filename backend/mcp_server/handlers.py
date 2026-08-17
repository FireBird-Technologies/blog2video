"""
MCP tool handlers for Blog2Video.

Transport-agnostic — used by both the local stdio server and the hosted
HTTP/SSE server. Each handler takes a `Blog2VideoClient` so the caller
controls authentication (env-var JWT for stdio, per-request JWT for HTTP).

Handler outputs are deliberately **markdown** (not JSON) so claude.ai's chat
renders rich tables, links, and embedded video previews directly in the chat
bubble. See plan: /Users/humeraraheel/.claude/plans/how-would-you-make-mellow-dolphin.md
"""
import contextvars
import json
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from mcp.types import CallToolResult, TextContent

from mcp_server.client import APIError, Blog2VideoClient
from mcp_server.polling import PollTimeout, poll_until


# Default polling cadence (seconds). Used only by the legacy blocking
# generate_video / render_video paths kept for stdio backwards-compat.
DEFAULT_POLL_INTERVAL = 5
DEFAULT_POLL_TIMEOUT_GENERATE = 300
DEFAULT_POLL_TIMEOUT_RENDER = 600


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# R2 public URLs for template card screenshots.
# Populated by running (once):
#   node backend/mcp_server/screenshot_templates.mjs
#   cd backend && python mcp_server/upload_template_previews.py
# The upload script prints the completed dict to paste here.
# Empty dict → falls back to Pillow PNG grid.
TEMPLATE_PREVIEW_URLS: dict[str, str] = {
    'default': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/default.png',
    'nightfall': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/nightfall.png',
    'gridcraft': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/gridcraft.png',
    'spotlight': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/spotlight.png',
    'whiteboard': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/whiteboard.png',
    'newspaper': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/newspaper.png',
    'matrix': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/matrix.png',
    'newscast': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/newscast.png',
    'mosaic': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/mosaic.png',
    'blackswan': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/blackswan.png',
    'bloomberg': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/bloomberg.png',
    'chronicle': 'https://pub-a855a571c7bf4d4d92c266a0e5597a3d.r2.dev/mcp-ui/template-previews/chronicle.png',
}

# Populated by _list_voices; read by mcp_transport._read_resource to inject into voice_gallery.html
_VOICE_CACHE: list[dict] = []
# Populated by _list_templates; lets the resource read reuse the same catalog.
_TEMPLATE_CACHE: list[dict] = []
# Populated by _setup_video; the background-music catalog for the setup widget.
# There is no unauthenticated fallback fetch — /api/background-music/tracks needs
# a JWT, so a cold resource read just yields [] and the picker shows only "None".
_BGM_CACHE: list[dict] = []

# Widget resource URI for the combined setup panel. Single source of truth:
# mcp_transport imports this, and tools.py's setup_video _meta must match it.
# claude.ai caches widget HTML per URI and never re-reads it, so shipping a
# changed bundle requires bumping the version suffix here AND in tools.py.
# _v4: the bundle is now Vite-built so its template previews inline as data URIs
# instead of being fetched from R2, and templates with no artwork render an
# initials chip rather than a broken image. Hosts cache widget HTML per URI and
# never re-read it, so the suffix must change or connectors keep serving v3.
SETUP_RESOURCE_URI = "ui://blog2video/setup_gallery_v8"

# Fallback template for auto_video when the LLM picker can't run (scrape or LLM
# failure). Set AUTO_TEMPLATE_PICK = False to skip the picker entirely and always
# use this template — cheaper and fully predictable.
AUTO_TEMPLATE = "newscast"
AUTO_TEMPLATE_PICK = True
_TEMPLATE_GALLERY_SHOWN_AT: float = 0.0
_VOICE_GALLERY_SHOWN_AT: float = 0.0
_SETUP_BLOG_URL: str = ""  # last blog_url seen, any user. Cold-read fallback only.
# Per-user blog_url, keyed by user id. The hosted transport serves every user
# from one process, so a single global gets clobbered between concurrent users —
# and start_video widens that window (the question turn and the answer turn can
# be minutes apart). Falls back to _SETUP_BLOG_URL when the user id is unknown.
_SETUP_BLOG_URL_BY_USER: dict[int, str] = {}

# id (used by backend) → marketing slug (used by blog2video.app/templates/<slug>)
TEMPLATE_SLUGS = {
    "default": "geometric-explainer",
    "nightfall": "nightfall",
    "gridcraft": "gridcraft",
    "spotlight": "spotlight",
    "whiteboard": "whiteboard",
    "newspaper": "newspaper",
    "matrix": "matrix",
    "newscast": "newscast",
    "blackswan": "blackswan",
    "mosaic": "mosaic",
    "bloomberg": "bloomberg",
    "chronicle": "chronicle",
}

STATUS_EMOJI = {
    "created": "📥",
    "scraped": "✏️",
    "scripted": "✏️",
    "generated": "🎬",
    "rendering": "⏳",
    "done": "✅",
    "rendered": "✅",
    "failed": "❌",
    "error": "❌",
}

GENERATION_STEPS = {
    0: "queued",
    1: "scraping the blog",
    2: "writing the script",
    3: "creating voiceovers",
    4: "preparing the workspace",
}

FRONTEND_BASE_URL = "https://blog2video.app"


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def _md(text: str) -> list[TextContent]:
    return [TextContent(type="text", text=text)]


def _ok(data) -> list[TextContent]:
    """Legacy JSON output. Kept for backwards-compat; new handlers use _md."""
    return [TextContent(type="text", text=json.dumps(data, indent=2, default=str))]


def _err(msg: str) -> list[TextContent]:
    return [TextContent(type="text", text=f"ERROR: {msg}")]


def _friendly_create_error(e: APIError) -> str | None:
    """Turn a known project-creation rejection into a message worth showing.

    Plan-gated failures come back as a dict detail (e.g.
    {"code": "video_length_requires_paid", ...}), which the generic _err path
    would stringify into the chat as a raw dict. Returns None for anything not
    specifically handled so the caller re-raises.
    """
    detail = e.detail
    code = detail.get("code") if isinstance(detail, dict) else None
    text = str(detail)

    if e.status_code == 403 and (code == "video_length_requires_paid" or "video_length_requires_paid" in text):
        return (
            "⚠️ **Detailed** and **More detailed** lengths need a paid plan.\n\n"
            "Re-open the setup panel and choose **Short** or **Medium**, or upgrade at "
            "https://blog2video.app/pricing."
        )
    return None


def _color_swatch(colors: dict | None) -> str:
    """3 inline color blocks as SVG. Claude.ai renders these inline in tables."""
    if not colors:
        return "▮▮▮"
    a = colors.get("accent", "#cccccc")
    b = colors.get("bg", "#ffffff")
    t = colors.get("text", "#000000")
    return (
        f'<svg width="54" height="18" xmlns="http://www.w3.org/2000/svg">'
        f'<rect x="0"  width="18" height="18" fill="{a}"/>'
        f'<rect x="18" width="18" height="18" fill="{b}" stroke="#ccc"/>'
        f'<rect x="36" width="18" height="18" fill="{t}"/>'
        f'</svg>'
    )


def _template_url(template_id: str) -> str:
    slug = TEMPLATE_SLUGS.get(template_id, template_id)
    return f"{FRONTEND_BASE_URL}/templates/{slug}"


def _project_url(project_id: int) -> str:
    return f"{FRONTEND_BASE_URL}/projects/{project_id}"


def _watch_url(project_id: int, client: "Blog2VideoClient") -> str | None:
    """Mint (or reuse) the public /preview/<token> watch link.

    Preferred over _project_url in tool output: the editor link requires the
    viewer to be logged in as the owner, whereas this one is shareable and
    works for anyone. Returns None if the backend cannot mint a token, so
    callers can fall back to the editor link.
    """
    try:
        return client.generate_embed_token(project_id).get("preview_url") or None
    except Exception as e:  # noqa: BLE001 - a missing link must not fail the tool
        logger.warning("Could not mint preview url for project %s: %s", project_id, e)
        return None


def _status_badge(status: str | None) -> str:
    if not status:
        return ""
    return f"{STATUS_EMOJI.get(status, '·')} {status}"


def _escape_cell(text: str | None, max_len: int = 80) -> str:
    """Truncate + escape pipe chars for safe table cells."""
    if text is None:
        return ""
    s = str(text).replace("\n", " ").replace("|", "\\|").strip()
    if len(s) > max_len:
        s = s[: max_len - 1].rstrip() + "…"
    return s


def _scene_table(scenes: list[dict]) -> str:
    """Render scenes as a 4-column markdown table (numbered from 1)."""
    if not scenes:
        return "_No scenes yet._"
    rows = [
        "| # | Title | Narration | Duration |",
        "|---|-------|-----------|----------|",
    ]
    for s in scenes:
        order = s.get("order", 0) + 1
        title = _escape_cell(s.get("title"), 40)
        narration = _escape_cell(s.get("narration_text"), 80)
        dur = s.get("duration_seconds")
        dur_s = f"{float(dur):.1f}s" if dur is not None else "—"
        rows.append(f"| {order} | {title} | {narration} | {dur_s} |")
    return "\n".join(rows)


def _relative_time(iso_string: str | None) -> str:
    """Coarse 'just now / 2h ago / yesterday / 3 days ago' for created_at strings."""
    if not iso_string:
        return ""
    try:
        if iso_string.endswith("Z"):
            iso_string = iso_string[:-1] + "+00:00"
        dt = datetime.fromisoformat(iso_string)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - dt
        secs = delta.total_seconds()
        if secs < 60:
            return "just now"
        if secs < 3600:
            return f"{int(secs // 60)}m ago"
        if secs < 86400:
            return f"{int(secs // 3600)}h ago"
        if secs < 172800:
            return "yesterday"
        return f"{int(secs // 86400)} days ago"
    except Exception:
        return ""


def _humanize_generation_progress(status: dict) -> tuple[str, str | None]:
    """Return (markdown_line, terminal_state) where terminal_state is
    'done' / 'error' / None (still running)."""
    state = status.get("status")
    if state in ("generated", "done"):
        return ("✅ Generation complete.", "done")
    err = status.get("error")
    if err or state in ("failed", "error"):
        return (f"❌ Generation failed: {err or 'unknown error'}", "error")
    step = status.get("step", 0) or 0
    label = GENERATION_STEPS.get(step, "working")
    if status.get("running"):
        return (f"⏳ Step {step}/4 ({label})", None)
    return (f"📥 Queued ({label})", None)


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

def dispatch(
    name: str,
    arguments: dict,
    client: Blog2VideoClient,
    poll_interval: int = DEFAULT_POLL_INTERVAL,
    poll_timeout_generate: int = DEFAULT_POLL_TIMEOUT_GENERATE,
    poll_timeout_render: int = DEFAULT_POLL_TIMEOUT_RENDER,
) -> list[TextContent]:
    """Dispatch a single MCP tool call. Returns TextContent list (never raises)."""
    import json as _json
    try:
        _arg_preview = _json.dumps(arguments, ensure_ascii=False)[:300]
    except Exception:
        _arg_preview = str(arguments)[:300]
    # host= is the clientInfo.name from the initialize handshake ("" when unknown).
    # Without it there is no way to tell from the logs WHICH Manual flow a user
    # was routed to — see _is_chatgpt_host.
    logger.info(
        "MCP_CALL tool=%s host=%s args=%s",
        name, current_client_name() or "?", _arg_preview,
    )
    try:
        # Pipeline tools
        if name == "start_video":
            return _start_video(arguments, client)
        if name == "setup_video":
            return _setup_video(arguments, client)
        if name == "create_project":
            return _create_project(arguments, client)
        # create_video: COMMENTED OUT alongside its tool definition in tools.py
        # (manifest-size experiment — it was 13% of the manifest and nothing
        # routed to it). _create_video below is kept; uncomment both to restore.
        # if name == "create_video":
        #     return _create_video(arguments, client)
        if name == "auto_video":
            return _auto_video(arguments, client)
        if name == "get_preview_url":
            return _get_preview_url(arguments, client)
        if name == "generate_video":
            return _generate_video(arguments, client)
        if name == "check_generation_status":
            return _check_generation_status(arguments, client)
        if name == "render_video":
            return _render_video(arguments, client)
        if name == "check_render_status":
            return _check_render_status(arguments, client)

        # Read tools
        if name == "get_project":
            return _get_project(arguments, client)
        if name == "list_projects":
            return _list_projects(client)
        if name == "list_templates":
            return _list_templates(client)
        if name == "list_voices":
            return _list_voices(client)
        if name == "show_settings":
            return _show_settings(client)
        if name == "get_templates_json":
            return _get_templates_json(client)
        if name == "get_voices_json":
            return _get_voices_json(client)

        # Edit tools (existing)
        if name == "update_scene":
            return _update_scene(arguments, client)

        # Edit tools (new)
        if name == "change_template":
            return _change_template(arguments, client)
        if name == "check_template_change_status":
            return _check_template_change_status(arguments, client)
        if name == "update_project_settings":
            return _update_project_settings(arguments, client)
        if name == "change_voice":
            return _change_voice(arguments, client)
        if name == "change_language":
            return _change_language(arguments, client)
        if name == "delete_voiceover":
            return _delete_voiceover(arguments, client)
        if name == "regenerate_scene":
            return _regenerate_scene(arguments, client)
        if name == "reorder_scenes":
            return _reorder_scenes(arguments, client)
        if name == "swap_scene_images":
            return _swap_scene_images(arguments, client)

        # Custom-template creation flow
        if name == "create_template_from_url":
            return _create_template_from_url(arguments, client)
        if name == "extract_template_theme":
            return _extract_template_theme(arguments, client)
        if name == "create_custom_template":
            return _create_custom_template(arguments, client)
        if name == "start_template_code_generation":
            return _start_template_code_generation(arguments, client)
        if name == "check_template_code_generation_status":
            return _check_template_code_generation_status(arguments, client)
        if name == "list_custom_templates":
            return _list_custom_templates(client)
        if name == "get_custom_template":
            return _get_custom_template(arguments, client)

        return _err(f"Unknown tool: {name}")
    except APIError as e:
        return _err(e.detail)
    except PollTimeout as e:
        return _err(str(e))
    except Exception as e:
        return _err(str(e))


# ---------------------------------------------------------------------------
# Pipeline handlers
# ---------------------------------------------------------------------------

def _current_user_id(client: Blog2VideoClient) -> int | None:
    """Best-effort user id for per-user state. None on any failure."""
    try:
        return (client.get_me() or {}).get("id")
    except Exception as exc:  # noqa: BLE001 - never let this break a tool call
        logger.warning("get_me failed: %s", exc)
        return None


def _remember_setup_url(client: Blog2VideoClient, blog_url: str) -> None:
    """Stash the blog_url so a later create_project can backfill it."""
    global _SETUP_BLOG_URL
    _SETUP_BLOG_URL = blog_url
    uid = _current_user_id(client)
    if uid is not None:
        _SETUP_BLOG_URL_BY_USER[uid] = blog_url


def _recall_setup_url(client: Blog2VideoClient) -> str:
    """This user's last setup blog_url, falling back to the shared global."""
    uid = _current_user_id(client)
    if uid is not None and _SETUP_BLOG_URL_BY_USER.get(uid):
        return _SETUP_BLOG_URL_BY_USER[uid]
    return _SETUP_BLOG_URL


# User-Agent of the current request, set by mcp_transport._mcp_endpoint (which
# has the ASGI scope) and read by current_client_name() as a fallback. Lives here
# rather than in mcp_transport because that module imports THIS one — the reverse
# would be circular. Same pattern as mcp_transport._REQUEST_TOKEN.
_CLIENT_UA: contextvars.ContextVar[str] = contextvars.ContextVar("mcp_client_ua", default="")

# The spec's per-request client identity (Streamable HTTP → Request Metadata).
# Sent on EVERY request precisely because a session may not exist.
_CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo"


def current_client_name() -> str:
    """Lowercased name of the calling MCP host ("openai-mcp", "claude-ai"…), or "".

    Deliberately does NOT read session.client_params: the hosted transport runs
    `StreamableHTTPSessionManager(stateless=True)`, which marks each throwaway
    session Initialized WITHOUT processing an `initialize` request, so
    `client_params` is permanently None. Two per-request sources instead:

      1. `_meta["io.modelcontextprotocol/clientInfo"]` — the spec field, present
         on every request. Confirmed in ChatGPT's raw bodies against this server.
      2. The `User-Agent` header — confirmed distinct in live traffic
         ("openai-mcp/1.0.0" vs Claude's "Python/… aiohttp/…").

    Never raises: with no active request (stdio server, unit tests) every lookup
    fails and we return "", which callers treat as "unknown host" and fall
    through to the default flow.
    """
    # Source 1 — the spec's per-request _meta.
    try:
        from mcp.server.lowlevel.server import request_ctx

        meta = request_ctx.get().meta
        # The key contains dots and a slash, so it lands in pydantic's extras
        # rather than becoming a real field (RequestParams.Meta is extra="allow").
        info = (getattr(meta, "model_extra", None) or {}).get(_CLIENT_INFO_META_KEY)
        name = (info or {}).get("name") if isinstance(info, dict) else None
        if name:
            return str(name).lower()
    except Exception:  # noqa: BLE001 - host detection must never break a tool call
        pass

    # Source 2 — User-Agent, stashed by the transport.
    try:
        return (_CLIENT_UA.get() or "").lower()
    except Exception:  # noqa: BLE001
        return ""


def _is_chatgpt_host() -> bool:
    """True when the caller is ChatGPT / the OpenAI Apps SDK.

    ChatGPT reports clientInfo.name == "openai-mcp". Substring matching so a
    rename (e.g. "chatgpt-connector") keeps working. Anything unrecognised is
    NOT ChatGPT and gets the standards-based widget chain.
    """
    name = current_client_name()
    return "openai" in name or "chatgpt" in name


# The Auto/Manual question. This transport has no MCP elicitation support, so the
# question is returned as markdown for the model to relay and the answer arrives
# as a second start_video call carrying `mode`.
_MODE_QUESTION = (
    "How would you like to make this video?\n\n"
    "**⚡ Auto** — I pick the template, voice and settings and build it now. No questions.\n\n"
    "**🎛 Manual** — you choose the template, voice, length, style, music and more "
    "in a visual panel.\n\n"
    "_Reply **auto** or **manual**._"
)


def _start_video(args: dict, client: Blog2VideoClient):
    """Entry point for every 'make a video from <url>' request.

    Two-step: the first call (no `mode`) returns the Auto/Manual question with no
    widget; the second carries the answer and delegates to the unchanged
    _auto_video / _setup_video handlers, so each flow has exactly one
    implementation.

    `mode` deliberately lives on THIS tool rather than telling the model to call
    auto_video/setup_video directly — otherwise the model learns mid-thread that
    those tools are callable and skips the fork on the next URL.
    """
    blog_url = (args.get("blog_url") or "").strip()
    if not (blog_url.startswith("http://") or blog_url.startswith("https://")):
        return _err(
            "blog_url is required and must be a valid http(s) URL. Ask the user for "
            "the article URL they want to convert, then call start_video again."
        )

    mode = (args.get("mode") or "").strip().lower()
    if mode == "auto":
        return _auto_video(args, client)
    if mode == "manual":
        # Hand off rather than calling the next handler inline. claude.ai decides
        # whether to render a widget from the TOOL definition's _meta.ui, not
        # from the result's — so a result returned under start_video's name (no
        # resourceUri) renders no panel, however it is annotated. The gallery
        # tools carry the binding at tool level, so the model must call them by
        # name.
        #
        # Manual is a CHAIN of single-purpose widgets (templates → voices →
        # settings) rather than the combined setup_video panel: setup_gallery.html
        # is hand-written and never performs the MCP Apps `ui/initialize`
        # handshake, so claude.ai keeps its iframe permanently hidden. The three
        # chain widgets are built from ui_src/ and call app.connect().
        # blog_url is stashed here because list_templates/list_voices/show_settings
        # take no arguments — _create_project backfills it via _recall_setup_url.
        _remember_setup_url(client, blog_url)

        # Host-specific routing. The widget chain advances by having each widget
        # app.sendMessage() its selection and letting the model act on it. On
        # ChatGPT that message is POSTED but does not trigger the tool-calling
        # pipeline (documented OpenAI bug), so the chain renders yet stalls at
        # every step until the user manually types "next".
        #
        # setup_gallery.html has the opposite profile: no ui/initialize handshake
        # (so Claude never renders it) but its Create button uses
        # window.openai.callTool directly — zero sendMessage calls — which is
        # ChatGPT's native, working path. Send each host to the flow that works.
        #
        # Revert this branch once OpenAI fixes ui/message; the chain is the
        # better UX and the only one that stays in sync with the Vite build.
        # NOTE the phrasing below: this tool renders NOTHING. The panel/gallery
        # only appears when the NEXT tool actually runs. Earlier wording here
        # said "Opening the setup panel.", which the model relayed as "use the
        # panel above" even on turns where it never made the follow-up call —
        # so the user was told to use a widget that was never rendered. State
        # the required action, never a completed outcome.
        if _is_chatgpt_host():
            return _md(
                f'<!-- NOT DONE YET. You MUST now call `setup_video` with blog_url="{blog_url}". '
                "This tool rendered nothing. Do NOT tell the user to use a panel, and do "
                "NOT describe any UI, until `setup_video` has returned — only then does a "
                "panel exist. If you cannot call it, say so plainly instead of describing "
                "a panel. -->"
            )

        return _md(
            "<!-- NOT DONE YET. You MUST now call `list_templates`. This tool rendered "
            "nothing. Do NOT tell the user to pick from a gallery, and do NOT describe "
            "any UI, until `list_templates` has returned. If you cannot call it, say so "
            "plainly instead of describing a gallery. After the user picks a template "
            "call `list_voices`, then `show_settings`. -->"
        )
    if mode:
        return _err(
            f"Unknown mode {mode!r}. Call start_video again with mode='auto' or mode='manual'."
        )

    # Step 1 — ask. Stash the URL so the manual branch can backfill it even if
    # the model drops it from the follow-up call.
    _remember_setup_url(client, blog_url)

    # ChatGPT loses the connector on FOLLOW-UP turns (GPT-5.6 regression): the
    # first message of a conversation reliably reaches us, the user's answer to
    # this question often does not — nothing arrives at the server at all, so no
    # server-side change can rescue it and the user has to type "@b2v manual".
    #
    # So skip the question entirely for that host and open the panel on the turn
    # that DOES work. The Auto/Manual choice is not lost — it moves into the
    # panel as a toggle (see setup_gallery.html), which costs no extra turn.
    #
    # Claude keeps the two-step fork: it has no such regression, and the question
    # reads better in chat than as a widget control.
    if _is_chatgpt_host():
        return _md(
            f'<!-- NOT DONE YET. You MUST now call `setup_video` with blog_url="{blog_url}". '
            "Do NOT ask the user to choose Auto or Manual first — the panel has that "
            "toggle built in. This tool rendered nothing; do NOT describe any UI until "
            "`setup_video` has returned. If the user ALREADY said they want it fully "
            "automatic, call `start_video` again with mode=\"auto\" instead. -->"
        )

    return _md(
        _MODE_QUESTION
        + "\n\n<!-- Relay the question above to the user in one short line and STOP. "
        "Do not call another tool. When they answer, call "
        f'start_video(blog_url="{blog_url}", mode="auto"|"manual"). -->'
    )


def _setup_video(args: dict, client: Blog2VideoClient):
    """Warm the template+voice data and open the combined setup widget.

    The widget (ui://blog2video/setup_gallery) shows templates and voices in one
    panel; clicking Create calls create_project with the user's selections. This
    satisfies the create_project gate (both galleries shown).

    Returns a CallToolResult that carries the templates+voices as
    `structuredContent`. ChatGPT exposes structuredContent as
    `window.openai.toolOutput` to the widget — so on every setup_video call
    the widget sees the freshest data, bypassing ChatGPT's resource-HTML
    cache. (The resource HTML still injects `window.__B2V_SETUP__` as a
    fallback for Claude / direct-iframe hosts.)
    """
    from mcp.types import CallToolResult
    global _VOICE_CACHE, _BGM_CACHE, _TEMPLATE_GALLERY_SHOWN_AT, _VOICE_GALLERY_SHOWN_AT

    blog_url = str(args.get("blog_url") or "")
    if blog_url:
        _remember_setup_url(client, blog_url)
    else:
        blog_url = _recall_setup_url(client)

    # Populate cache with the user's voices (4-tier cascade — see _fetch_user_voices).
    _VOICE_CACHE = _fetch_user_voices(client)

    # Background-music catalog for the settings section.
    try:
        _BGM_CACHE = client.list_bgm_tracks() or []
    except Exception as exc:  # noqa: BLE001 - music is optional, never block setup
        logger.warning("_setup_video: list_bgm_tracks failed: %s", exc)

    # Gate the paid-only video lengths in the widget. Fail CLOSED: an unknown
    # plan hides the paid options rather than letting the user pick one that
    # then 403s in _normalize_video_length. The backend check is authoritative.
    is_paid = False
    try:
        plan = ((client.get_me() or {}).get("plan") or "free").strip().lower()
        is_paid = plan in ("lite", "standard", "pro")
    except Exception as exc:  # noqa: BLE001
        logger.warning("_setup_video: get_me failed, assuming free plan: %s", exc)

    # Templates for structuredContent — same shape as the resource read injection.
    templates: list[dict] = []
    try:
        raw = client.list_templates() or []
        templates = [
            {
                "id": t.get("id", "?"),
                "name": t.get("name") or t.get("id", "?"),
                "genres": t.get("genres") or [],
                "preview_url": TEMPLATE_PREVIEW_URLS.get(t.get("id", ""), ""),
                "custom": False,
            }
            for t in raw
        ]
        # /api/templates is built-ins only. Append the user's finished custom
        # templates so this panel matches the list_templates gallery — without
        # this, someone who built a template cannot pick it here.
        templates.extend(_usable_custom_templates(client))
    except Exception as exc:
        logger.warning("_setup_video: list_templates failed: %s", exc)

    now = time.time()
    _TEMPLATE_GALLERY_SHOWN_AT = now
    _VOICE_GALLERY_SHOWN_AT = now

    # Model-facing status line ONLY — never user-facing prose. Per MCP Apps
    # (SEP-1865) `content` is model context while `structuredContent` is the UI
    # channel, so a ready-to-send second-person message here gets relayed
    # verbatim and duplicates what the widget already says. Same reason
    # _list_templates returns one factual line; see its docstring.
    text = (
        f"Setup panel shown ({len(templates)} templates, {len(_VOICE_CACHE)} voices). "
        "The user picks template, voice and settings, then clicks Create Video."
    )
    # The _meta below attaches the widget to THIS RESULT rather than to the tool.
    # start_video delegates here and carries no tool-level outputTemplate, so
    # without this the manual branch would render no panel.
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent={
            "templates": templates,
            "voices": _VOICE_CACHE,
            "bgm_tracks": _BGM_CACHE,
            "is_paid": is_paid,
            "blog_url": blog_url,
        },
        isError=False,
        **{"_meta": {
            "openai/outputTemplate": SETUP_RESOURCE_URI,
            "ui": {"resourceUri": SETUP_RESOURCE_URI},
        }},
    )


def _create_project(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    now = time.time()
    window = 1800  # 30 minutes

    # Backfill blog_url from the setup widget's cached URL if the widget passed
    # an empty string (happens when the create button fires before the model
    # populated blog_url into the widget args). Prefer this user's own stashed
    # URL over the shared global.
    if not (args.get("blog_url") or "").strip():
        recalled = _recall_setup_url(client)
        if recalled:
            args["blog_url"] = recalled

    blog_url = (args.get("blog_url") or "").strip()
    if not blog_url or not (blog_url.startswith("http://") or blog_url.startswith("https://")):
        return _md(
            "❌ Cannot create project — `blog_url` is missing or not a valid http(s) URL.\n\n"
            "Ask the user for the article URL they want to convert, then call "
            "`setup_video` with that URL so the template/voice picker has the right "
            "context. Do NOT invent or guess a URL."
        )

    missing = []
    if now - _TEMPLATE_GALLERY_SHOWN_AT > window:
        missing.append("`list_templates`")
    if now - _VOICE_GALLERY_SHOWN_AT > window:
        missing.append("`list_voices`")

    if missing:
        tools = " and ".join(missing)
        return _md(
            f"❌ Cannot create project yet — galleries not shown.\n\n"
            f"Call {tools} NOW (in that order) so the user can visually select "
            f"a template and voice. Do NOT ask text questions about template or voice. "
            f"After both galleries are shown and the user has made their selections, "
            f"call create_project again with their choices."
        )

    # Legacy shim: the _v2 widget sent `voice_id`, but ProjectCreate's field is
    # `custom_voice_id` and Pydantic silently drops unknown keys — so those voice
    # picks were being thrown away. claude.ai clients holding the cached _v2 HTML
    # keep sending the old name until they re-read the resource.
    if args.get("voice_id") and not args.get("custom_voice_id"):
        args["custom_voice_id"] = args["voice_id"]
    args.pop("voice_id", None)

    # The comprehension below filters None but not "". An empty custom_voice_id
    # or bgm_track_id would reach the backend as a falsy-but-present value, and
    # an empty colour would fight the template palette.
    for _k in ("custom_voice_id", "bgm_track_id", "accent_color", "bg_color", "text_color"):
        if isinstance(args.get(_k), str) and not args[_k].strip():
            args.pop(_k)

    fields = {k: v for k, v in args.items() if v is not None}
    try:
        project = client.create_project(**fields)
    except APIError as e:
        friendly = _friendly_create_error(e)
        if friendly:
            return _md(friendly)
        raise
    pid = project["id"]
    template = project.get("template", "default")
    voice = f"{project.get('voice_gender', 'female')} · {project.get('voice_accent', 'american')}"
    aspect = project.get("aspect_ratio", "landscape")
    length = project.get("video_length", "auto")

    md = (
        f"✅ Created **project #{pid}** from `{project.get('blog_url')}`.\n\n"
        f"| | |\n"
        f"|---|---|\n"
        f"| **Template** | {template} {_color_swatch(project.get('preview_colors'))} |\n"
        f"| **Voice** | {voice} |\n"
        f"| **Length** | {length} |\n"
        f"| **Aspect** | {aspect} |\n"
        f"| **Status** | {_status_badge(project.get('status'))} |\n\n"
        f"Next: say *generate the video* — or *show the templates* if you want to change template first."
    )
    return _md(md)


def _create_video(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    """One-shot: create a project from a blog URL and generate the video.

    Unlike create_project this calls the backend directly and bypasses the
    gallery-shown gate — the caller passes template/voice as explicit args, so
    the widget UX is irrelevant. Blocks until scenes are ready; when
    render=True it also renders a downloadable MP4 before returning.
    """
    blog_url = (args.get("blog_url") or "").strip()
    if not blog_url or not (blog_url.startswith("http://") or blog_url.startswith("https://")):
        return _err("blog_url is required and must be a valid http(s) URL.")

    do_render = bool(args.get("render", False))
    fields = {k: v for k, v in args.items() if k != "render" and v is not None}

    # Create the project directly (no gallery gate).
    project = client.create_project(**fields)
    pid = project["id"]

    # Generate — blocking poll until scenes are ready.
    client.start_generation(pid)
    poll_until(
        check_fn=lambda: client.get_generation_status(pid),
        is_done=lambda s: s.get("status") in ("generated", "done"),
        is_error=lambda s: (
            bool(s.get("status") in ("failed", "error") or s.get("error")),
            s.get("error") or "unknown error",
        ),
        interval=DEFAULT_POLL_INTERVAL,
        timeout=DEFAULT_POLL_TIMEOUT_GENERATE,
        label="Video generation",
    )

    project = client.get_project(pid)
    scenes = project.get("scenes", [])
    template = project.get("template", "default")
    voice = project.get("custom_voice_id") or (
        f"{project.get('voice_gender', 'female')} · {project.get('voice_accent', 'american')}"
    )
    header = (
        f"✅ Created **project #{pid}** and generated the video — {len(scenes)} scenes ready.\n\n"
        f"| | |\n|---|---|\n"
        f"| **Template** | {template} |\n"
        f"| **Voice** | {voice} |\n"
        f"| **Source** | {project.get('blog_url')} |\n\n"
    )

    if not do_render:
        watch = _watch_url(pid, client)
        link = (
            f"[▶ Watch the video]({watch})\n\n`{watch}`\n\n"
            if watch else
            f"[▶ Open in editor]({_project_url(pid)})\n\n"
        )
        return _md(
            header
            + link
            + f"Pass `render: true` to also produce a downloadable MP4."
        )

    # Optional render — blocking poll until the MP4 is ready.
    resp = client.start_render(pid)
    if resp.get("r2_video_url"):
        return _md(header + _render_complete_markdown(pid, resp["r2_video_url"], already=True)[0].text)
    final = poll_until(
        check_fn=lambda: client.get_render_status(pid),
        is_done=lambda s: bool(s.get("done")) and not s.get("error"),
        is_error=lambda s: (
            bool(s.get("done") and s.get("error")),
            s.get("error") or "unknown error",
        ),
        interval=DEFAULT_POLL_INTERVAL,
        timeout=DEFAULT_POLL_TIMEOUT_RENDER,
        label="Video rendering",
    )
    url = final.get("r2_video_url")
    if not url:
        return _md(header + f"Render complete but no URL returned. [Open your project]({_project_url(pid)}).")
    return _md(header + _render_complete_markdown(pid, url, already=False)[0].text)


def _auto_video(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    """Zero-config: URL in, finished video out.

    Differs from _create_video in what it sends rather than how it runs:
      * template                 — picked HERE from the source site's scraped
                                   theme + content, then sent as a concrete id
                                   (see app/dspy_modules/template_picker.py)
      * stock_footage_enabled    — on; the MCP path left this false by default,
                                   so b-roll never got attached
      * no custom_voice_id       — uses the account's default voice; a stale
                                   saved voice 404s on every scene
      * NO colours               — so the template's own palette wins instead of
                                   the generic purple fallback
    """
    blog_url = (args.get("blog_url") or "").strip()
    if not blog_url or not (blog_url.startswith("http://") or blog_url.startswith("https://")):
        return _err("blog_url is required and must be a valid http(s) URL.")

    # Pick the template up front so the backend receives a concrete id like any
    # other caller — no sentinel, and nothing in the pipeline or the project
    # router needs to know auto-selection exists.
    template = AUTO_TEMPLATE
    if AUTO_TEMPLATE_PICK:
        try:
            import asyncio

            from app.dspy_modules.template_picker import pick_template_for_url

            template = asyncio.run(pick_template_for_url(blog_url))
        except Exception as e:  # noqa: BLE001 - a pick failure must not block creation
            logger.warning("auto_video: template pick failed, using %s: %s", AUTO_TEMPLATE, e)

    fields: dict = {
        "blog_url": blog_url,
        "template": template,
        "stock_footage_enabled": True,
    }
    if args.get("name"):
        fields["name"] = args["name"]

    # Deliberately NO custom_voice_id: the backend's own voice_gender/
    # voice_accent defaults always resolve, whereas a saved voice can be stale
    # (deleted at the TTS provider) and then every scene fails synthesis with
    # 404 voice_not_found. Passing a bad id also overrides those working
    # defaults, so auto_video never sets one — picking a specific voice is what
    # setup_video / create_video are for.

    project = client.create_project(**fields)
    pid = project["id"]

    client.start_generation(pid)

    # Return NOW rather than blocking for the full generation. Waiting here used
    # to outlast the MCP connector's own timeout on long articles: the client
    # gave up, retried, and each retry created another project and burned
    # another video credit while the original kept generating server-side.
    # (create_project now also dedupes retries, but not timing out is the cure.)
    # render=true still blocks, since the caller explicitly asked to wait.
    if not bool(args.get("render", False)):
        voice = project.get("custom_voice_id") or (
            f"{project.get('voice_gender', 'female')} · {project.get('voice_accent', 'american')}"
        )
        return _md(
            f"🎬 Created **project #{pid}** — generating now (~1–5 min).\n\n"
            f"| | |\n|---|---|\n"
            f"| **Template** | {project.get('template', '?')} _(auto-picked)_ |\n"
            f"| **Voice** | {voice} |\n"
            f"| **Stock footage** | {'on' if project.get('stock_footage_enabled') else 'off'} |\n"
            f"| **Source** | {project.get('blog_url')} |\n\n"
            f"Call `check_generation_status` with project_id **{pid}** every ~15s until it "
            f"reports complete, then show the user the watch link. Do NOT call auto_video "
            f"or start_video again for this URL — the video is already being made."
        )

    # render=true — the caller opted into waiting for the whole pipeline.
    poll_until(
        check_fn=lambda: client.get_generation_status(pid),
        is_done=lambda s: s.get("status") in ("generated", "done"),
        is_error=lambda s: (
            bool(s.get("status") in ("failed", "error") or s.get("error")),
            s.get("error") or "unknown error",
        ),
        interval=DEFAULT_POLL_INTERVAL,
        timeout=DEFAULT_POLL_TIMEOUT_GENERATE,
        label="Video generation",
    )

    project = client.get_project(pid)
    scenes = project.get("scenes", [])
    voice = project.get("custom_voice_id") or (
        f"{project.get('voice_gender', 'female')} · {project.get('voice_accent', 'american')}"
    )
    header = (
        f"✅ Created **project #{pid}** and generated the video — {len(scenes)} scenes ready.\n\n"
        f"| | |\n|---|---|\n"
        f"| **Template** | {project.get('template', '?')} _(auto-picked)_ |\n"
        f"| **Voice** | {voice} |\n"
        f"| **Accent** | `{project.get('accent_color', '?')}` |\n"
        f"| **Stock footage** | {'on' if project.get('stock_footage_enabled') else 'off'} |\n"
        f"| **Source** | {project.get('blog_url')} |\n\n"
    )

    resp = client.start_render(pid)
    if resp.get("r2_video_url"):
        return _md(header + _render_complete_markdown(pid, resp["r2_video_url"], already=True)[0].text)
    final = poll_until(
        check_fn=lambda: client.get_render_status(pid),
        is_done=lambda s: bool(s.get("done")) and not s.get("error"),
        is_error=lambda s: (
            bool(s.get("done") and s.get("error")),
            s.get("error") or "unknown error",
        ),
        interval=DEFAULT_POLL_INTERVAL,
        timeout=DEFAULT_POLL_TIMEOUT_RENDER,
        label="Video rendering",
    )
    url = final.get("r2_video_url")
    if not url:
        return _md(header + f"Render complete but no URL returned. [Open your project]({_project_url(pid)}).")
    return _md(header + _render_complete_markdown(pid, url, already=False)[0].text)


def _get_preview_url(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    """Mint (or reuse) a public preview link so the user can watch the video."""
    pid = int(args["project_id"])
    resp = client.generate_embed_token(pid)
    url = resp.get("preview_url")
    if not url:
        return _err("No preview_url returned for this project.")
    return _md(
        f"🔗 **Preview link for project #{pid}:**\n\n"
        f"[▶ Watch the video]({url})\n\n"
        f"`{url}`\n\n"
        f"_This link is shareable — anyone with it can view the video._"
    )


def _generate_video(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    """Blocking: starts generation and polls silently until complete."""
    project_id = int(args["project_id"])
    client.start_generation(project_id)

    poll_until(
        check_fn=lambda: client.get_generation_status(project_id),
        is_done=lambda s: s.get("status") in ("generated", "done"),
        is_error=lambda s: (
            bool(s.get("status") in ("failed", "error") or s.get("error")),
            s.get("error") or "unknown error",
        ),
        interval=DEFAULT_POLL_INTERVAL,
        timeout=DEFAULT_POLL_TIMEOUT_GENERATE,
        label="Video generation",
    )

    project = client.get_project(project_id)
    scenes = project.get("scenes", [])
    # Hand over the SHAREABLE watch link, not the editor link — the latter only
    # works for a viewer logged in as the owner (see _watch_url's docstring).
    # _watch_url returns None if the token cannot be minted, so this degrades to
    # the editor link rather than failing. Mirrors _create_video.
    watch = _watch_url(project_id, client)
    link = (
        f"[▶ Watch the video]({watch})\n\n`{watch}`\n\n"
        if watch else
        f"[▶ Open in editor]({_project_url(project_id)})\n\n"
    )
    md = (
        f"✅ **Video generated!** Project #{project_id} has {len(scenes)} scenes ready.\n\n"
        + link
        + "Would you like to **render it as an MP4** for download? "
          "Say *yes, render it* if you want a downloadable video (takes 3–8 min)."
    )
    return _md(md)


def _check_generation_status(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    project_id = int(args["project_id"])
    status = client.get_generation_status(project_id)
    line, terminal = _humanize_generation_progress(status)

    if terminal == "done":
        # Fetch the full project for the scene table
        project = client.get_project(project_id)
        scenes = project.get("scenes", [])
        # Same shareable-link treatment as _generate_video: when the model polls
        # instead of blocking, this is where the user finds out the video is
        # ready, so it must carry a way to actually watch it.
        watch = _watch_url(project_id, client)
        link = (
            f"[▶ Watch the video]({watch})\n\n`{watch}`\n\n"
            if watch else
            f"[▶ Open in editor]({_project_url(project_id)})\n\n"
        )
        md = (
            f"{line} — project #{project_id} now has {len(scenes)} scenes.\n\n"
            + link
            + f"### Scenes\n{_scene_table(scenes)}\n\n"
            + "Next: edit any scene (e.g. *shorten scene 2*), change the template "
              "(e.g. *use bloomberg*), or say *render the video*."
        )
        return _md(md)

    if terminal == "error":
        return _md(f"{line}\n\nTry again, or check the project to see what went wrong.")

    # Still running
    md = f"{line} — project #{project_id}. I'll check again in ~10s."
    return _md(md)


def _render_video(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    """Blocking: starts rendering and polls silently until the MP4 is ready."""
    project_id = int(args["project_id"])
    force = bool(args.get("force_rerender", False))
    resp = client.start_render(project_id, force_render=force)

    # Backend short-circuits if already rendered
    if resp.get("r2_video_url") and not force:
        return _render_complete_markdown(project_id, resp["r2_video_url"], already=True)

    final = poll_until(
        check_fn=lambda: client.get_render_status(project_id),
        is_done=lambda s: bool(s.get("done")) and not s.get("error"),
        is_error=lambda s: (
            bool(s.get("done") and s.get("error")),
            s.get("error") or "unknown error",
        ),
        interval=DEFAULT_POLL_INTERVAL,
        timeout=DEFAULT_POLL_TIMEOUT_RENDER,
        label="Video rendering",
    )

    url = final.get("r2_video_url")
    if not url:
        return _md(
            f"✅ Render complete but no URL returned. "
            f"[Open your project]({_project_url(project_id)}) to get the link."
        )
    return _render_complete_markdown(project_id, url, already=False)


def _check_render_status(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    project_id = int(args["project_id"])
    status = client.get_render_status(project_id)
    done = bool(status.get("done"))
    err = status.get("error")
    if done and err:
        return _md(f"❌ Render failed for project #{project_id}: {err}")
    if done:
        url = status.get("r2_video_url")
        if not url:
            return _md(f"✅ Render complete but no URL returned. Try `get_project` "
                       f"to look it up.")
        return _render_complete_markdown(project_id, url, already=False)

    progress = status.get("progress")
    rendered = status.get("rendered_frames")
    total = status.get("total_frames")
    eta = status.get("time_remaining") or ""

    parts = [f"⏳ Rendering project #{project_id}"]
    if progress is not None:
        parts.append(f"**{progress}%**")
    if rendered is not None and total:
        parts.append(f"({rendered}/{total} frames)")
    if eta:
        parts.append(f"· ETA {eta}")
    line = " — ".join([parts[0], " ".join(parts[1:])]) if len(parts) > 1 else parts[0]
    return _md(f"{line}. I'll check again in ~10s.")


def _render_complete_markdown(project_id: int, video_url: str, already: bool) -> list[TextContent]:
    """Final 'render done' card with inline video + project page link."""
    headline = (
        f"✅ Project #{project_id} is already rendered."
        if already
        else f"✅ Project #{project_id} rendered."
    )
    md = (
        f"{headline}\n\n"
        f"🎥 **Watch the video:**\n\n"
        f"![]({video_url})\n\n"
        f"[▶ Open MP4 in a new tab]({video_url}) · "
        f"[✏️ Open project in editor]({_project_url(project_id)})"
    )
    return _md(md)


# ---------------------------------------------------------------------------
# Read handlers
# ---------------------------------------------------------------------------

def _get_project(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    project_id = int(args["project_id"])
    project = client.get_project(project_id)
    name = project.get("name") or f"Project #{project_id}"
    template = project.get("template", "default")
    voice = f"{project.get('voice_gender', '?')} · {project.get('voice_accent', '?')}"
    aspect = project.get("aspect_ratio", "landscape")
    status = _status_badge(project.get("status"))
    blog_url = project.get("blog_url")
    scenes = project.get("scenes", [])
    r2 = project.get("r2_video_url")

    header = (
        f"## Project #{project_id} — {name}\n\n"
        f"**Template:** {template} {_color_swatch(project.get('preview_colors'))} · "
        f"**Aspect:** {aspect} · **Voice:** {voice} · **Status:** {status}\n"
    )
    if blog_url:
        header += f"\n**Blog source:** {blog_url}\n"

    body = f"\n### Scenes ({len(scenes)})\n\n{_scene_table(scenes)}\n"

    video_line = ""
    if r2:
        video_line = (
            f"\n**Video:** [▶ Watch MP4]({r2}) · "
            f"[✏️ Open in editor]({_project_url(project_id)})\n"
        )

    hints = (
        "\n_Say things like:_\n"
        "- *shorten scene 2's narration*\n"
        "- *change template to bloomberg*\n"
        "- *switch to british voice*\n"
        "- *render the video*\n"
    )
    return _md(header + body + video_line + hints)


def _list_projects(client: Blog2VideoClient) -> list[TextContent]:
    projects = client.list_projects()
    if not projects:
        return _md(
            "You don't have any projects yet.\n\n"
            "Say *create a project from <blog URL>* to start one — or *show the "
            "templates* to browse styles first."
        )
    rows = [
        f"You have {len(projects)} project{'s' if len(projects) != 1 else ''}.\n",
        "| # | Name | Status | Scenes | Updated |",
        "|---|------|--------|--------|---------|",
    ]
    for p in projects:
        pid = p.get("id")
        name = _escape_cell(p.get("name") or "(unnamed)", 40)
        status = _status_badge(p.get("status"))
        n_scenes = p.get("scene_count")
        if n_scenes is None:
            n_scenes = len(p.get("scenes") or [])
        when = _relative_time(p.get("updated_at") or p.get("created_at"))
        rows.append(f"| {pid} | {name} | {status} | {n_scenes} | {when} |")
    rows.append("\n_Say *open project &lt;#&gt;* to see details, or *create a new project* "
                "to start one._")
    return _md("\n".join(rows))


def _list_templates_markdown(templates: list[dict]) -> str:
    """Render the markdown fallback table for `list_templates`.

    Not currently called by `_list_templates` (which uses TextContent only),
    but kept as a utility for any context needing a markdown table of templates.
    """
    if not templates:
        return "_No templates available._"
    rows = [
        f"Here are all {len(templates)} templates. The 3-block preview = "
        "accent / background / text colors.\n",
        "| Preview | Template | Best for | Open |",
        "|---------|----------|----------|------|",
    ]
    for t in templates:
        tid = t.get("id", "?")
        name = t.get("name") or tid
        swatch = _color_swatch(t.get("preview_colors"))
        # Combine name + id like "**default** (Geometric Explainer)"
        label = f"**{tid}** ({name})" if name and name.lower() != tid.lower() else f"**{tid}**"
        genres = ", ".join(t.get("genres") or [])
        best_for = _escape_cell(genres or t.get("description", ""), 50)
        link = f"[↗]({_template_url(tid)})"
        rows.append(f"| {swatch} | {label} | {best_for} | {link} |")
    rows.append('\n_Say *use &lt;id&gt;* (e.g. "use nightfall") to pick one when creating '
                "or changing a project's template._")
    rows.append(
        "\n> **Render this table to the user verbatim.** Do not summarize, "
        "rename columns, or rewrite descriptions — the table IS the "
        "user-facing interface."
    )
    return "\n".join(rows)




def _custom_template_is_usable(t: dict) -> bool:
    """True when a custom template's code generation finished successfully.

    Same rule _list_custom_templates renders in its "Code ready?" column: code
    present and not marked failed. A half-generated template must never appear
    as selectable in a picker.
    """
    if t.get("generation_failed"):
        return False
    return bool(t.get("intro_code") or t.get("content_codes"))


def _usable_custom_templates(client: Blog2VideoClient) -> list[dict]:
    """This user's FINISHED custom templates, shaped like built-in catalog rows.

    `id` is the "custom_<id>" form create_project expects (see
    template_service.is_custom_template), so a picked card needs no translation.
    Never raises: custom templates are an enhancement to the gallery, so a
    failure here must not take the built-ins down with it.
    """
    try:
        raw = client.list_custom_templates() or []
    except Exception as exc:  # noqa: BLE001
        logger.warning("_usable_custom_templates: fetch failed: %s", exc)
        return []
    out: list[dict] = []
    for t in raw:
        if not _custom_template_is_usable(t):
            continue
        tid = t.get("id")
        out.append({
            "id": f"custom_{tid}",
            "name": t.get("name") or f"Custom #{tid}",
            "genres": [],
            # Field names per the custom-template serializer: preview_image_url
            # (the rendered thumbnail) and preview_colors.
            "preview_url": t.get("preview_image_url") or "",
            "custom": True,
            "colors": t.get("preview_colors") or _extract_preview_colors(t) or {},
        })
    return out


def _list_templates(client: Blog2VideoClient):
    """Open the template gallery widget.

    Per MCP Apps (SEP-1865) the catalog goes in `structuredContent` — the UI
    data channel, which the spec excludes from model context — while `content`
    carries only a one-line summary. Putting the 12 image rows in `content`
    (as this used to) drops the whole catalog into Claude's context, and Claude
    then paraphrases it in prose instead of letting the widget speak.

    Shows built-ins AND the user's finished custom templates: /api/templates
    returns only the built-ins, so before this a user could not see or pick a
    template they had made.
    """
    global _TEMPLATE_GALLERY_SHOWN_AT, _TEMPLATE_CACHE
    templates = [
        {
            "id": t.get("id", "?"),
            "name": t.get("name") or t.get("id", "?"),
            "genres": t.get("genres") or [],
            "preview_url": TEMPLATE_PREVIEW_URLS.get(t.get("id", ""), ""),
            "custom": False,
        }
        for t in (client.list_templates() or [])
    ]
    custom = _usable_custom_templates(client)
    templates.extend(custom)

    _TEMPLATE_CACHE = templates
    _TEMPLATE_GALLERY_SHOWN_AT = time.time()

    extra = f" + {len(custom)} custom" if custom else ""
    return CallToolResult(
        content=[TextContent(
            type="text",
            text=f"Template gallery shown ({len(templates) - len(custom)} built-in"
                 f"{extra}). Click a card to select one.",
        )],
        structuredContent={"templates": templates},
        isError=False,
    )


def _normalize_voice(v: dict) -> dict:
    """Produce a shape both widgets accept: keep flat gender/accent AND a labels mirror."""
    labels = dict(v.get("labels") or {})
    gender = v.get("gender") or labels.get("gender") or ""
    accent = v.get("accent") or labels.get("accent") or ""
    if gender and "gender" not in labels:
        labels["gender"] = gender
    if accent and "accent" not in labels:
        labels["accent"] = accent
    return {
        "voice_id": v.get("voice_id", ""),
        "name": v.get("name") or v.get("voice_id") or "Voice",
        "preview_url": v.get("preview_url"),
        "description": v.get("description") or "",
        "plan": v.get("plan"),
        "gender": gender,
        "accent": accent,
        "labels": labels,
    }


def _fetch_user_voices(client: Blog2VideoClient) -> list[dict]:
    """Return user voices with a guaranteed non-empty fallback.

    Tier cascade (logged so we can debug "no voices" reports):
      1) GET /api/voices/saved (per-user saved list)
      2) Seed via ensure_free_voices_for_user, then re-fetch /saved
      3) Direct DB read of prebuilt_voices matching FREE_PREMADE_VOICE_IDS
      4) Hardcoded FREE_PREMADE_FALLBACK constants (no preview URLs)

    NEVER returns []. Tier 4 is a static list, so the widget always
    renders at least 4 voice cards.
    """
    # Tier 1: saved
    try:
        saved = client.list_saved_voices() or []
    except Exception as exc:
        logger.warning("_fetch_user_voices: list_saved_voices failed: %s", exc)
        saved = []

    if saved:
        logger.info("_fetch_user_voices: tier1 saved=%d", len(saved))
        return [_normalize_voice(v) for v in saved]

    # Tier 2: seed then re-fetch
    user_id = None
    try:
        me = client.get_me()
        if isinstance(me, dict):
            user_id = me.get("id")
    except Exception as exc:
        logger.warning("_fetch_user_voices: get_me failed: %s", exc)

    if user_id:
        try:
            from app.database import SessionLocal
            from app.services.voice_seed import ensure_free_voices_for_user
            db = SessionLocal()
            try:
                ensure_free_voices_for_user(db, int(user_id))
            finally:
                db.close()
        except Exception as exc:
            logger.warning("_fetch_user_voices: seed failed for user %s: %s", user_id, exc)

        try:
            saved = client.list_saved_voices() or []
        except Exception as exc:
            logger.warning("_fetch_user_voices: re-fetch after seed failed: %s", exc)
            saved = []

        if saved:
            logger.info("_fetch_user_voices: tier2 seed+saved=%d", len(saved))
            return [_normalize_voice(v) for v in saved]

    # Tier 3: direct DB read of the 4 default rows from prebuilt_voices
    try:
        from app.database import SessionLocal
        from app.models.prebuilt_voice import PrebuiltVoice
        from app.constants import FREE_PREMADE_VOICE_IDS
        db = SessionLocal()
        try:
            rows = (
                db.query(PrebuiltVoice)
                .filter(PrebuiltVoice.voice_id.in_(FREE_PREMADE_VOICE_IDS))
                .all()
            )
            voices = [
                {
                    "voice_id": r.voice_id,
                    "name": r.name,
                    "preview_url": r.preview_url,
                    "description": r.description or "",
                    "plan": "free",
                }
                for r in rows
            ]
        finally:
            db.close()
        if voices:
            logger.info("_fetch_user_voices: tier3 prebuilt DB read=%d", len(voices))
            return [_normalize_voice(v) for v in voices]
    except Exception as exc:
        logger.warning("_fetch_user_voices: tier3 DB read failed: %s", exc)

    # Tier 4: hardcoded constants (always succeeds)
    from app.constants import FREE_PREMADE_FALLBACK
    logger.info("_fetch_user_voices: tier4 hardcoded fallback=%d", len(FREE_PREMADE_FALLBACK))
    return [
        _normalize_voice({
            "voice_id": v["voice_id"],
            "name": v["name"],
            "preview_url": None,
            "description": "",
            "plan": "free",
        })
        for v in FREE_PREMADE_FALLBACK
    ]


def _list_voices(client: Blog2VideoClient):
    """Open the voice gallery widget. Same structuredContent contract as
    _list_templates — the widget reads the catalog, the model sees one line."""
    global _VOICE_CACHE, _VOICE_GALLERY_SHOWN_AT
    _VOICE_CACHE = _fetch_user_voices(client)
    _VOICE_GALLERY_SHOWN_AT = time.time()
    return CallToolResult(
        content=[TextContent(
            type="text",
            text=f"Voice gallery shown ({len(_VOICE_CACHE)} voices). "
                 "Click a card to hear a preview and select it.",
        )],
        structuredContent={"voices": _VOICE_CACHE},
        isError=False,
    )


def _show_settings(client: Blog2VideoClient):
    """Open the settings panel — final step of the Manual chain.

    Same structuredContent contract as _list_templates / _list_voices: the
    widget reads the data, the model sees one factual line. The panel calls
    create_project itself (app.callServerTool) when the user clicks Create
    Video, so this handler only has to supply the catalog and the plan gate.
    """
    global _BGM_CACHE
    try:
        _BGM_CACHE = client.list_bgm_tracks() or []
    except Exception as exc:  # noqa: BLE001 - music is optional, never block setup
        logger.warning("_show_settings: list_bgm_tracks failed: %s", exc)

    # Gate the paid-only video lengths in the widget. Fail CLOSED: an unknown
    # plan hides the paid options rather than letting the user pick one that
    # then 403s in _normalize_video_length. The backend check is authoritative.
    is_paid = False
    try:
        plan = ((client.get_me() or {}).get("plan") or "free").strip().lower()
        is_paid = plan in ("lite", "standard", "pro")
    except Exception as exc:  # noqa: BLE001
        logger.warning("_show_settings: get_me failed, assuming free plan: %s", exc)

    return CallToolResult(
        content=[TextContent(
            type="text",
            text=f"Settings panel shown ({len(_BGM_CACHE)} music tracks). "
                 "The user adjusts settings and clicks Create Video.",
        )],
        structuredContent={"bgm_tracks": _BGM_CACHE, "is_paid": is_paid},
        isError=False,
    )


def _get_templates_json(client: Blog2VideoClient) -> list[TextContent]:
    """Plain-JSON template list for automation contexts (e.g. n8n) — no widget."""
    templates = client.list_templates() or []
    data = [
        {"id": t.get("id"), "name": t.get("name") or t.get("id"), "genres": t.get("genres") or []}
        for t in templates if t.get("id")
    ]
    return _ok(data)


def _get_voices_json(client: Blog2VideoClient) -> list[TextContent]:
    """Plain-JSON voice list for automation contexts (e.g. n8n) — no widget.

    Reuses the robust tier-cascade in _fetch_user_voices (never returns empty).
    """
    voices = _fetch_user_voices(client)
    data = [
        {"voice_id": v["voice_id"], "name": v["name"], "description": v.get("description", "")}
        for v in voices if v.get("voice_id")
    ]
    return _ok(data)


# ---------------------------------------------------------------------------
# Existing edit handler — update_scene with before/after diff
# ---------------------------------------------------------------------------

def _update_scene(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    project_id = int(args["project_id"])
    scene_id = int(args["scene_id"])
    fields = {
        k: v
        for k, v in args.items()
        if k not in ("project_id", "scene_id") and v is not None
    }

    # Try to fetch before-state so we can show a diff. If the lookup fails,
    # we still proceed with the update.
    before = None
    try:
        project = client.get_project(project_id)
        for s in project.get("scenes", []):
            if s.get("id") == scene_id:
                before = s
                break
    except Exception:
        pass

    after = client.update_scene(project_id, scene_id, **fields)

    rows = ["| Field | Before | After |", "|-------|--------|-------|"]
    for k in fields.keys():
        b = _escape_cell(before.get(k) if before else None, 80)
        a = _escape_cell(after.get(k), 80)
        rows.append(f"| {k} | {b or '—'} | {a or '—'} |")
    order = after.get("order")
    label = f"scene {order + 1}" if order is not None else f"scene id={scene_id}"
    md = (
        f"✏️ Updated {label} of project #{project_id}.\n\n"
        + "\n".join(rows)
        + "\n\n_Re-render to bake the change (`render_video`)._"
    )
    return _md(md)


# ---------------------------------------------------------------------------
# New edit handlers
# ---------------------------------------------------------------------------

def _change_template(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    project_id = int(args["project_id"])
    template = str(args["template"])
    client.change_template(project_id, template)
    return _md(
        f"🎨 Switching project #{project_id} to **{template}** template. "
        f"Regenerating scene layouts (~30s).\n\n"
        f"I'll check progress in 10 seconds. (Tool: "
        f"`check_template_change_status` with `project_id={project_id}`.)"
    )


def _check_template_change_status(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    project_id = int(args["project_id"])
    job = client.get_template_change_status(project_id)
    if not job:
        # No job — likely already done. Show the current project.
        return _get_project({"project_id": project_id}, client)

    state = (job.get("status") or "").lower()
    if state in ("completed", "succeeded", "done"):
        project = client.get_project(project_id)
        scenes = project.get("scenes", [])
        return _md(
            f"✅ Template switched to **{project.get('template')}** for project #{project_id}.\n\n"
            f"### Scenes ({len(scenes)})\n{_scene_table(scenes)}\n\n"
            f"_Re-render to bake the change._"
        )
    if state in ("failed", "error"):
        err = job.get("error") or "unknown error"
        return _md(f"❌ Template change failed: {err}")
    pct = job.get("progress")
    extra = f" — {pct}%" if pct is not None else ""
    return _md(f"⏳ Template change in progress{extra}. I'll check again in ~10s.")


def _change_voice(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    """Re-record every scene's voiceover in a new voice. Costs one video credit.

    Deliberately NOT part of update_project_settings: ProjectUpdate has no voice
    columns, and a settings write would not re-synthesise the narration. Blocks
    until the background job finishes so the user gets one finished answer.
    """
    project_id = int(args["project_id"])
    voice_id = (args.get("custom_voice_id") or "").strip()

    # The voice_id drives TTS — gender/accent are display-only metadata (the web
    # app says so in its own comment). So a voice change is meaningless without
    # an id, and the user must pick one from the gallery rather than have the
    # model guess. Same gate create_project uses, on the same timestamp.
    if not voice_id:
        return _md(
            "❌ Cannot change the voice — no `custom_voice_id` given.\n\n"
            "Call `list_voices` NOW so the user can hear the options and pick one, "
            "then call `change_voice` again with the `voice_id` they chose."
        )
    if time.time() - _VOICE_GALLERY_SHOWN_AT > 1800:
        return _md(
            "❌ Cannot change the voice yet — the voice gallery has not been shown.\n\n"
            "Call `list_voices` NOW so the user can hear the options and click one. "
            "Do NOT pick a voice on their behalf."
        )

    fields = {k: v for k, v in args.items() if k != "project_id" and v is not None}
    client.change_voice(project_id, **fields)

    final = poll_until(
        check_fn=lambda: client.get_voice_change_status(project_id),
        is_done=lambda s: bool(s.get("done")),
        is_error=lambda s: (bool(s.get("error")), s.get("error") or "unknown error"),
        interval=DEFAULT_POLL_INTERVAL,
        timeout=DEFAULT_POLL_TIMEOUT_GENERATE,
        label="Voice change",
    )
    if final.get("error"):
        return _md(f"❌ Voice change failed: {final['error']}")

    project = client.get_project(project_id) or {}
    voice = project.get("custom_voice_id") or (
        f"{project.get('voice_gender', 'female')} · {project.get('voice_accent', 'american')}"
    )
    watch = _watch_url(project_id, client)
    link = (
        f"[▶ Watch the video]({watch})\n\n`{watch}`\n\n"
        if watch else
        f"[▶ Open in editor]({_project_url(project_id)})\n\n"
    )
    return _md(
        f"✅ **Voice changed** for project #{project_id} — every scene re-recorded with "
        f"**{voice}**.\n\n" + link + "_Re-render to get an updated MP4 (`render_video`)._"
    )


def _delete_voiceover(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    """Strip the narration audio, making the video mute. Costs NO credit.

    Runs as a ProjectVoiceChangeJob tagged "_op: delete", so progress comes from
    the SHARED /voice-change-status endpoint. No gallery gate and no credit
    warning here — unlike change_voice this is free and needs no voice picked.
    """
    project_id = int(args["project_id"])
    resp = client.delete_voiceover(project_id) or {}

    # The endpoint short-circuits with started=False when the project is already
    # muted — there is no job to poll in that case.
    if resp.get("started") is False:
        return _md(f"ℹ️ Project #{project_id} already has no voiceover — nothing to remove.")

    final = poll_until(
        check_fn=lambda: client.get_voice_change_status(project_id),
        is_done=lambda s: bool(s.get("done")),
        is_error=lambda s: (bool(s.get("error")), s.get("error") or "unknown error"),
        interval=DEFAULT_POLL_INTERVAL,
        timeout=DEFAULT_POLL_TIMEOUT_GENERATE,
        label="Voiceover removal",
    )
    if final.get("error"):
        return _md(f"❌ Could not remove the voiceover: {final['error']}")

    watch = _watch_url(project_id, client)
    link = (
        f"[▶ Watch the video]({watch})\n\n`{watch}`\n\n"
        if watch else
        f"[▶ Open in editor]({_project_url(project_id)})\n\n"
    )
    return _md(
        f"🔇 **Voiceover removed** from project #{project_id} — the video is now mute.\n\n"
        + link
        + "_The existing MP4 still has audio; re-render (`render_video`) to get the muted version._"
    )


def _change_language(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    """Translate the project (text + narration + voiceovers). Costs one credit."""
    project_id = int(args["project_id"])
    language = (args.get("content_language") or "").strip()
    if not language:
        return _md("❌ `content_language` is required — pass an ISO 639-1 code, e.g. 'es'.")

    client.change_language(project_id, language)

    final = poll_until(
        check_fn=lambda: client.get_language_change_status(project_id),
        is_done=lambda s: bool(s.get("done")),
        is_error=lambda s: (bool(s.get("error")), s.get("error") or "unknown error"),
        interval=DEFAULT_POLL_INTERVAL,
        timeout=DEFAULT_POLL_TIMEOUT_GENERATE,
        label="Language change",
    )
    if final.get("error"):
        return _md(f"❌ Language change failed: {final['error']}")

    watch = _watch_url(project_id, client)
    link = (
        f"[▶ Watch the video]({watch})\n\n`{watch}`\n\n"
        if watch else
        f"[▶ Open in editor]({_project_url(project_id)})\n\n"
    )
    return _md(
        f"✅ **Translated** project #{project_id} to `{language}` — on-screen text, "
        f"narration and voiceovers regenerated.\n\n" + link
        + "_Re-render to get an updated MP4 (`render_video`)._"
    )


def _update_project_settings(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    project_id = int(args["project_id"])
    fields = {
        k: v
        for k, v in args.items()
        if k != "project_id" and v is not None
    }
    if not fields:
        return _md("_No changes specified._")

    # Snapshot before
    before = {}
    try:
        before = client.get_project(project_id) or {}
    except Exception:
        pass

    after = client.update_project_settings(project_id, **fields)

    # Report what the BACKEND stored, not what was asked for. The endpoint
    # coerces and clamps (caption_font_size → str, bgm_volume → 0..1) and drops
    # any field ProjectUpdate does not define, so echoing the request would
    # confirm changes that never happened. Fall back to the requested value only
    # when the response omits the key entirely.
    rows = [f"✏️ Updated project #{project_id}:\n"]
    ignored: list[str] = []
    for k, req_v in fields.items():
        if isinstance(after, dict) and k in after:
            new_v = after[k]
        else:
            new_v = req_v
        old_v = before.get(k)
        if isinstance(after, dict) and k in after and str(after[k]) != str(req_v):
            # Stored value differs from what was asked — clamped, coerced, or refused.
            if str(old_v) == str(after[k]):
                ignored.append(k)
                continue
            rows.append(f"- **{k}** → `{new_v}` (requested `{req_v}`)")
        elif old_v is not None and str(old_v) != str(new_v):
            rows.append(f"- **{k}** → `{new_v}` (was `{old_v}`)")
        else:
            rows.append(f"- **{k}** → `{new_v}`")

    if ignored:
        rows.append(
            f"\n⚠️ Not applied: {', '.join(f'`{k}`' for k in ignored)} — "
            "this project setting cannot be changed here."
        )
    rows.append("\n_Re-render to apply (`render_video`)._")
    return _md("\n".join(rows))


def _regenerate_scene(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    project_id = int(args["project_id"])
    scene_id = int(args["scene_id"])
    scene = client.regenerate_scene(
        project_id,
        scene_id,
        description=args.get("description"),
        narration_text=args.get("narration_text"),
        layout=args.get("layout"),
        regenerate_voiceover=bool(args.get("regenerate_voiceover", False)),
    )
    order = scene.get("order")
    label = f"scene {order + 1}" if order is not None else f"scene id={scene_id}"
    md = (
        f"🔄 Regenerated {label} of project #{project_id}.\n\n"
        f"| Field | Value |\n|-------|-------|\n"
        f"| Title | {_escape_cell(scene.get('title'), 80)} |\n"
        f"| Narration | {_escape_cell(scene.get('narration_text'), 100)} |\n"
        f"| Duration | {scene.get('duration_seconds', '—')}s |\n\n"
        f"_Re-render to bake the change._"
    )
    return _md(md)


def _reorder_scenes(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    project_id = int(args["project_id"])
    scene_ids = args["scene_ids"]
    if not isinstance(scene_ids, list) or not scene_ids:
        return _err("scene_ids must be a non-empty list of scene IDs.")
    client.reorder_scenes(project_id, [int(s) for s in scene_ids])

    # Fetch the new order
    project = client.get_project(project_id)
    scenes = project.get("scenes", [])
    md = (
        f"🔀 Reordered scenes for project #{project_id}.\n\n"
        f"### New order\n{_scene_table(scenes)}\n\n"
        f"_Re-render to bake the change._"
    )
    return _md(md)


def _swap_scene_images(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    project_id = int(args["project_id"])
    mode = (args.get("mode") or "swap").lower()

    if mode == "move":
        from_id = int(args["from_scene_id"])
        to_id = int(args["to_scene_id"])
        client.move_scene_image(project_id, from_id, to_id)
        return _md(
            f"➡️ Moved image from scene id={from_id} to scene "
            f"id={to_id} in project #{project_id}.\n\n"
            f"_Re-render to bake the change._"
        )

    first_id = int(args.get("first_scene_id", args.get("source_scene_id")))
    second_id = int(args.get("second_scene_id", args.get("target_scene_id")))
    client.swap_scene_images(project_id, first_id, second_id)
    return _md(
        f"🔀 Swapped images between scene id={first_id} and scene "
        f"id={second_id} in project #{project_id}.\n\n"
        f"_Re-render to bake the change._"
    )


# ---------------------------------------------------------------------------
# Custom-template creation flow (guided in-chat)
# ---------------------------------------------------------------------------

def _template_editor_url(template_id: int) -> str:
    return f"{FRONTEND_BASE_URL}/templates/custom/{template_id}"


def _theme_summary_card(theme: dict, name: str | None = None) -> str:
    """Render a markdown summary of a CustomTemplateTheme dict.

    Covers the fields the extract endpoint returns: colors, fonts, style,
    animationPreset, borderRadius, category, patterns, personality.
    """
    colors = theme.get("colors") or {}
    fonts = theme.get("fonts") or {}
    rows = ["| | |", "|---|---|"]
    if name:
        rows.append(f"| **Suggested name** | {_escape_cell(name, 80)} |")
    if theme.get("style") or theme.get("animationPreset"):
        bits = [b for b in [theme.get("style"), theme.get("animationPreset")] if b]
        rows.append(f"| Style | {_escape_cell(' · '.join(bits), 80)} |")
    if theme.get("category"):
        rows.append(f"| Category | {_escape_cell(theme.get('category'), 40)} |")
    if colors:
        rows.append(f"| Colors | {_color_swatch(colors)} (accent / bg / text) |")
    heading_font = fonts.get("heading")
    body_font = fonts.get("body")
    if heading_font:
        rows.append(f"| Heading font | {_escape_cell(heading_font, 80)} |")
    if body_font and body_font != heading_font:
        rows.append(f"| Body font | {_escape_cell(body_font, 80)} |")
    if theme.get("borderRadius"):
        rows.append(f"| Border radius | {_escape_cell(theme.get('borderRadius'), 40)} |")
    return "\n".join(rows)


def _extract_template_theme(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    url = str(args["url"]).strip()
    result = client.extract_template_theme(url)

    if not result.get("extractable", True):
        reason = result.get("reason") or "Site couldn't be scraped automatically."
        return _md(
            f"❌ Couldn't extract a theme from `{url}`.\n\n"
            f"_Reason:_ {reason}\n\n"
            f"You can describe the colors and fonts manually and I'll save a "
            f"template from that — just tell me what you want."
        )

    theme = result.get("theme") or {}
    name = result.get("template_name") or ""
    screenshot_url = result.get("screenshot_url")
    logo_urls = result.get("logo_urls") or []
    og_image = result.get("og_image")

    parts = [f"🎨 Extracted theme from `{url}`.\n", _theme_summary_card(theme, name=name), ""]
    if screenshot_url:
        parts.append(f"**Screenshot:** ![]({screenshot_url})\n")
    if logo_urls:
        # Show up to 3 logos inline
        logo_md = " ".join(f"![]({u})" for u in logo_urls[:3])
        parts.append(f"**Logo{'s' if len(logo_urls) > 1 else ''}:** {logo_md}\n")
    elif og_image:
        parts.append(f"**Open Graph image:** ![]({og_image})\n")

    parts.append(
        f"\nIf this looks right, say _save it as_ \"**{name or 'My Template'}**\" "
        "and I'll create the template. You can also edit the name, swap colors, "
        "or pick a different logo first."
    )
    return _md("\n".join(parts))


def _create_custom_template(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    name = str(args["name"]).strip()
    theme = args["theme"]
    if not isinstance(theme, dict):
        return _err("`theme` must be a JSON object (the dict returned by extract_template_theme).")

    template = client.create_custom_template(
        name=name,
        theme=theme,
        source_url=args.get("source_url"),
        logo_urls=args.get("logo_urls"),
        og_image=args.get("og_image"),
        screenshot_url=args.get("screenshot_url"),
        reason=args.get("reason"),
    )
    tid = template.get("id")
    editor_url = _template_editor_url(tid)
    md = (
        f"✅ Saved **custom template #{tid} — {_escape_cell(name, 60)}**.\n\n"
        f"Code generation hasn't started yet. This takes ~5 minutes and uses 1 "
        f"of your 20 daily AI generation credits.\n\n"
        f"Say _generate the code_ to launch it (tool: "
        f"`start_template_code_generation` with `template_id={tid}`), "
        f"or [open the template in the editor]({editor_url}) to tweak the theme first."
    )
    return _md(md)


def _start_template_code_generation(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    template_id = int(args["template_id"])
    client.start_template_code_generation(template_id)
    return _md(
        f"🛠 Generating code for **custom template #{template_id}**. This takes "
        f"~5 minutes.\n\nI'll check progress in 15 seconds. (Tool: "
        f"`check_template_code_generation_status` with `template_id={template_id}`.)"
    )


def _create_template_from_url(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    """One-shot custom template: extract theme → save → start code generation.

    Collapses extract_template_theme + create_custom_template +
    start_template_code_generation into a single call. Those three still exist
    as separate tools for the manual path (a site that cannot be scraped, where
    the user describes the theme instead).

    Returns as soon as generation has STARTED — the same shape as auto_video —
    rather than blocking for the ~5-8 minutes codegen takes, which would risk
    the host's tool timeout.

    Aborts BEFORE create_custom_template when extraction fails, so a
    non-scrapable site costs no AI credit.
    """
    url = str(args.get("url") or "").strip()
    if not url.startswith(("http://", "https://")):
        return _err("`url` is required and must be a valid http(s) URL.")

    result = client.extract_template_theme(url) or {}
    if not result.get("extractable", True):
        reason = result.get("reason") or "Site couldn't be scraped automatically."
        return _md(
            f"❌ Couldn't extract a theme from `{url}`.\n\n"
            f"_Reason:_ {reason}\n\n"
            f"Nothing was created and no credit was used. You can describe the "
            f"colours and fonts yourself and I'll save a template from that — "
            f"just tell me what you want."
        )

    theme = result.get("theme") or {}
    if not theme:
        return _md(
            f"❌ No theme could be read from `{url}`. Nothing was created and no "
            f"credit was used. Describe the colours and fonts you want instead."
        )

    name = str(args.get("name") or result.get("template_name") or "").strip() or "My Template"

    template = client.create_custom_template(
        name=name,
        theme=theme,
        source_url=url,
        logo_urls=result.get("logo_urls"),
        og_image=result.get("og_image"),
        screenshot_url=result.get("screenshot_url"),
        reason=result.get("reason"),
    ) or {}
    tid = template.get("id")
    if not tid:
        return _err("Template was created but the backend returned no id.")

    client.start_template_code_generation(int(tid))

    return _md(
        f"🎨 Extracted the theme from `{url}` and saved it as "
        f"**custom template #{tid} — {_escape_cell(name, 60)}**.\n\n"
        f"{_theme_summary_card(theme, name=name)}\n\n"
        f"🛠 Code generation has started. It usually takes 5–8 minutes (longer if a "
        f"scene needs a retry) and uses 1 of your 20 daily AI generation credits.\n\n"
        f"I'll check progress with `check_template_code_generation_status` "
        f"(`template_id={tid}`) in ~15s.\n\n"
        f"[↗ Open in template editor]({_template_editor_url(tid)})"
    )


def _template_code_exists(template_id: int, client: Blog2VideoClient) -> bool:
    """True when the template already has generated code, whatever the status
    endpoint claims.

    Second opinion for _check_template_code_generation_status. Never raises: a
    failed lookup returns False, so the caller falls through to its normal
    "still generating" reply rather than erroring.
    """
    try:
        tpl = client.get_custom_template(template_id) or {}
    except Exception as exc:  # noqa: BLE001 - cross-check must never break the tool
        logger.warning(
            "_template_code_exists: lookup failed for %s: %s", template_id, exc
        )
        return False
    if tpl.get("is_regenerating"):
        return False  # a NEW generation really is running; report progress
    return bool(tpl.get("intro_code"))


def _template_ready_message(template_id: int) -> list[TextContent]:
    """The 'code generation finished' reply. Shared by the two branches that can
    conclude a template is ready — the status endpoint saying so, and the
    cross-check below discovering the code already exists."""
    return _md(
        f"✅ Template **#{template_id}** is ready to use.\n\n"
        f"You can now make a video with it — say something like "
        f"_create a project from <blog URL> using template custom_{template_id}_, "
        f"or browse other templates with `list_templates` / `list_custom_templates`.\n\n"
        f"[↗ Open in template editor]({_template_editor_url(template_id)})"
    )


def _check_template_code_generation_status(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    template_id = int(args["template_id"])
    status = client.get_template_code_generation_status(template_id)
    state = (status.get("status") or "").lower()
    step = status.get("step")
    err = status.get("error")
    running = bool(status.get("running"))

    if state in ("complete", "completed", "done", "success") and not err:
        return _template_ready_message(template_id)

    if state in ("failed", "error") or err:
        return _md(
            f"❌ Code generation failed for template #{template_id}: "
            f"{err or 'unknown error'}\n\n"
            f"You can regenerate code from the editor, or fix the template's "
            f"theme and try again."
        )

    # Not terminal — but do NOT trust that alone. /generation-status reads an
    # in-memory progress dict BEFORE the DB, so a stale entry keeps reporting
    # "generating" long after codegen finished. That is exactly what happened to
    # template 122: the code was written and the web app showed it ready, while
    # MCP polled 11 times and reported a stall. The web app dodges this by
    # reading the template's code directly — do the same here.
    if _template_code_exists(template_id, client):
        return _template_ready_message(template_id)

    if running or state in ("generating", "running"):
        step_md = f" — **{_escape_cell(step, 60)}**" if step else ""
        return _md(
            f"⏳ Generating code for template #{template_id}{step_md}. "
            f"This usually takes 5–8 minutes, and longer if a scene needs a retry. "
            f"I'll check again in ~15s."
        )

    # Unknown / queued
    return _md(f"⏳ Template #{template_id} status: `{state or 'queued'}`. "
               f"I'll check again in ~15s.")


def _list_custom_templates(client: Blog2VideoClient) -> list[TextContent]:
    templates = client.list_custom_templates()
    if not templates:
        return _md(
            "You haven't created any custom templates yet.\n\n"
            "Say *create a template from <website URL>* and I'll extract the "
            "brand theme, save it, and generate scene code for you."
        )

    rows = [
        f"You have {len(templates)} custom template{'s' if len(templates) != 1 else ''}.\n",
        "| Preview | id | Name | Code ready? | Updated |",
        "|---------|-----|------|------------|---------|",
    ]
    for t in templates:
        tid = t.get("id")
        name = _escape_cell(t.get("name") or "(unnamed)", 40)
        swatch = _color_swatch(_extract_preview_colors(t))
        code_ready = "✅" if (t.get("intro_code") or t.get("content_codes")) else "⏳ not yet"
        if t.get("generation_failed"):
            code_ready = "❌ failed"
        when = _relative_time(t.get("updated_at") or t.get("created_at"))
        rows.append(f"| {swatch} | `custom_{tid}` | {name} | {code_ready} | {when} |")
    rows.append(
        "\n_Use one in a project with `template=\"custom_<id>\"` in `create_project`. "
        "Or say *make a new template from <URL>* to add another._"
    )
    return _md("\n".join(rows))


def _get_custom_template(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    template_id = int(args["template_id"])
    t = client.get_custom_template(template_id)
    name = t.get("name") or f"Custom template #{template_id}"
    editor_url = _template_editor_url(template_id)
    code_ready = bool(t.get("intro_code") or t.get("content_codes"))
    code_status = "✅ Ready to use" if code_ready else (
        "❌ Generation failed" if t.get("generation_failed") else "⏳ Not generated yet"
    )

    theme = t.get("theme")
    if isinstance(theme, str):
        # API sometimes returns the JSON string; tolerate it
        try:
            import json as _json
            theme = _json.loads(theme)
        except Exception:
            theme = {}
    theme = theme or {}

    md_parts = [
        f"## Custom template #{template_id} — {_escape_cell(name, 60)}\n",
        f"**Code status:** {code_status}  ·  "
        f"**Created:** {_relative_time(t.get('created_at'))}  ·  "
        f"**Source:** {t.get('source_url') or '_(none)_'}\n",
        "",
        _theme_summary_card(theme),
        "",
    ]

    screenshot_url = t.get("screenshot_url") or t.get("preview_image_url")
    if screenshot_url:
        md_parts.append(f"**Preview:** ![]({screenshot_url})\n")

    md_parts.append(f"\n[↗ Open in template editor]({editor_url})")
    if code_ready:
        md_parts.append(
            f"\n\n_To use: pass `template=\"custom_{template_id}\"` to `create_project`._"
        )
    else:
        md_parts.append(
            f"\n\n_To generate code: call `start_template_code_generation` with "
            f"`template_id={template_id}` (~5 min)._"
        )

    return _md("\n".join(md_parts))


def _extract_preview_colors(template_or_theme: dict) -> dict | None:
    """Pull {accent, bg, text} from a CustomTemplate response, handling both
    the top-level preview_colors field and a nested theme.colors."""
    if not template_or_theme:
        return None
    pc = template_or_theme.get("preview_colors")
    if pc:
        return pc
    theme = template_or_theme.get("theme")
    if isinstance(theme, str):
        try:
            import json as _json
            theme = _json.loads(theme)
        except Exception:
            return None
    if isinstance(theme, dict):
        return theme.get("colors")
    return None
