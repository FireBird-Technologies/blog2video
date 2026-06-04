"""
MCP tool handlers for Blog2Video.

Transport-agnostic — used by both the local stdio server and the hosted
HTTP/SSE server. Each handler takes a `Blog2VideoClient` so the caller
controls authentication (env-var JWT for stdio, per-request JWT for HTTP).

Handler outputs are deliberately **markdown** (not JSON) so claude.ai's chat
renders rich tables, links, and embedded video previews directly in the chat
bubble. See plan: /Users/humeraraheel/.claude/plans/how-would-you-make-mellow-dolphin.md
"""
import json
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from mcp.types import TextContent

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
_TEMPLATE_GALLERY_SHOWN_AT: float = 0.0
_VOICE_GALLERY_SHOWN_AT: float = 0.0
_SETUP_BLOG_URL: str = ""  # last blog_url passed to setup_video; read by the setup widget

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
    logger.info("MCP_CALL tool=%s args=%s", name, _arg_preview)
    try:
        # Pipeline tools
        if name == "setup_video":
            return _setup_video(arguments, client)
        if name == "create_project":
            return _create_project(arguments, client)
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
        if name == "regenerate_scene":
            return _regenerate_scene(arguments, client)
        if name == "reorder_scenes":
            return _reorder_scenes(arguments, client)
        if name == "swap_scene_images":
            return _swap_scene_images(arguments, client)

        # Custom-template creation flow
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
    global _VOICE_CACHE, _TEMPLATE_GALLERY_SHOWN_AT, _VOICE_GALLERY_SHOWN_AT, _SETUP_BLOG_URL

    _SETUP_BLOG_URL = str(args.get("blog_url") or "")

    # Populate cache with the user's voices (4-tier cascade — see _fetch_user_voices).
    _VOICE_CACHE = _fetch_user_voices(client)

    # Templates for structuredContent — same shape as the resource read injection.
    templates: list[dict] = []
    try:
        raw = client.list_templates() or []
        templates = [
            {
                "id": t.get("id", "?"),
                "name": t.get("name") or t.get("id", "?"),
                "genres": t.get("genres") or [],
            }
            for t in raw
        ]
    except Exception as exc:
        logger.warning("_setup_video: list_templates failed: %s", exc)

    now = time.time()
    _TEMPLATE_GALLERY_SHOWN_AT = now
    _VOICE_GALLERY_SHOWN_AT = now

    text = (
        "Pick a **template** and a **voice** in the panel above, then click **Create Video**. "
        "I'll start generating as soon as you do."
    )
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent={
            "templates": templates,
            "voices": _VOICE_CACHE,
            "blog_url": _SETUP_BLOG_URL,
        },
        isError=False,
    )


def _create_project(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    now = time.time()
    window = 1800  # 30 minutes

    # Backfill blog_url from the setup widget's cached URL if the widget passed
    # an empty string (happens when the create button fires before the model
    # populated blog_url into the widget args).
    if not (args.get("blog_url") or "").strip() and _SETUP_BLOG_URL:
        args["blog_url"] = _SETUP_BLOG_URL

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

    fields = {k: v for k, v in args.items() if v is not None}
    project = client.create_project(**fields)
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
    md = (
        f"✅ **Video generated!** Project #{project_id} has {len(scenes)} scenes ready.\n\n"
        f"[▶ View your project on Blog2Video]({_project_url(project_id)})\n\n"
        f"Would you like to **render it as an MP4** for download? "
        f"Say *yes, render it* if you want a downloadable video (takes 3–8 min)."
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
        md = (
            f"{line} — project #{project_id} now has {len(scenes)} scenes.\n\n"
            f"### Scenes\n{_scene_table(scenes)}\n\n"
            f"Next: edit any scene (e.g. *shorten scene 2*), change the template "
            f"(e.g. *use bloomberg*), or say *render the video*."
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




def _list_templates(client: Blog2VideoClient) -> list[TextContent]:
    global _TEMPLATE_GALLERY_SHOWN_AT
    templates = client.list_templates()
    _TEMPLATE_GALLERY_SHOWN_AT = time.time()

    lines = []
    for t in templates:
        tid = t.get("id", "?")
        name = t.get("name") or tid
        genres = ", ".join(t.get("genres") or [])
        r2_url = TEMPLATE_PREVIEW_URLS.get(tid, "")
        if r2_url:
            lines.append(f"![{name}]({r2_url})")
        genre_str = f" · {genres}" if genres else ""
        lines.append(f"**`{tid}`** — {name}{genre_str}")
        lines.append("")

    lines.append("_Say `use <id>` to select, e.g. `use nightfall`._")
    lines.append("\nNow call `list_voices` to show the voice selection gallery.")
    return _md("\n".join(lines))


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


def _list_voices(client: Blog2VideoClient) -> list[TextContent]:
    global _VOICE_CACHE, _VOICE_GALLERY_SHOWN_AT
    _VOICE_CACHE = _fetch_user_voices(client)
    _VOICE_GALLERY_SHOWN_AT = time.time()
    return _md("The voice gallery is shown above — click a card to hear a preview and select it.")


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

    rows = [f"✏️ Updated project #{project_id}:\n"]
    for k, new_v in fields.items():
        old_v = before.get(k)
        if old_v is not None and str(old_v) != str(new_v):
            rows.append(f"- **{k}** → `{new_v}` (was `{old_v}`)")
        else:
            rows.append(f"- **{k}** → `{new_v}`")
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


def _check_template_code_generation_status(args: dict, client: Blog2VideoClient) -> list[TextContent]:
    template_id = int(args["template_id"])
    status = client.get_template_code_generation_status(template_id)
    state = (status.get("status") or "").lower()
    step = status.get("step")
    err = status.get("error")
    running = bool(status.get("running"))

    if state in ("complete", "completed", "done", "success") and not err:
        editor_url = _template_editor_url(template_id)
        return _md(
            f"✅ Template **#{template_id}** is ready to use.\n\n"
            f"You can now make a video with it — say something like "
            f"_create a project from <blog URL> using template custom_{template_id}_, "
            f"or browse other templates with `list_templates` / `list_custom_templates`.\n\n"
            f"[↗ Open in template editor]({editor_url})"
        )

    if state in ("failed", "error") or err:
        return _md(
            f"❌ Code generation failed for template #{template_id}: "
            f"{err or 'unknown error'}\n\n"
            f"You can regenerate code from the editor, or fix the template's "
            f"theme and try again."
        )

    if running or state in ("generating", "running"):
        step_md = f" — **{_escape_cell(step, 60)}**" if step else ""
        return _md(
            f"⏳ Generating code for template #{template_id}{step_md}. "
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
