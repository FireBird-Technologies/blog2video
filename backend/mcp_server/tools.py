"""
MCP tool definitions for Blog2Video.

Transport-agnostic — used by both the local stdio server and the hosted
HTTP/SSE server. Descriptions are written to nudge Claude into the
conversational two-step polling flow for long-running operations.
"""
from mcp.types import Tool, ToolAnnotations


# Kept in sync BY HAND with app/services/background_music.py:BGM_TRACKS.
# Deliberately not imported: this module is loaded by the local stdio server
# (mcp_server/server.py), which runs without `app` on the import path.
BGM_TRACK_IDS = [
    "corporate_upbeat", "trending_reels", "documentary_sad", "podcast_intro",
    "ambient_background", "chasing_success", "relaxed_narrative", "sad_violin",
    "dramatic_trailer", "powerful_percussion", "dark_cyberpunk",
    "wonders_of_the_earth", "action_race_rock", "moment_of_peace",
]

# Mirrors CAPTION_FONT_OPTIONS in frontend/src/components/VideoPreview.tsx.
CAPTION_FONT_IDS = [
    "inter", "poppins", "montserrat", "roboto_slab", "oswald", "lora",
    "patrick_hand", "arimo", "archivo_black", "merriweather",
    "playfair_display", "fira_code",
]

# Music + caption settings. Accepted by ProjectCreate on the backend but absent
# from the MCP surface until the Manual setup flow needed them. Shared verbatim
# by create_project and create_video so the two can't drift.
_MEDIA_SETTINGS_PROPERTIES = {
    "bgm_track_id": {"type": "string", "enum": BGM_TRACK_IDS, "description": "Optional background music track id. Omit for no music."},
    "bgm_volume": {"type": "number", "minimum": 0.0, "maximum": 1.0, "default": 0.10, "description": "Background music volume, 0–1. Only meaningful together with bgm_track_id."},
    "captions_enabled": {"type": "boolean", "default": False, "description": "Burn on-screen subtitles into the video."},
    "caption_position": {"type": "string", "enum": ["bottom_center", "top_center"], "default": "bottom_center", "description": "Only used when captions_enabled."},
    "caption_font_family": {"type": "string", "enum": CAPTION_FONT_IDS, "default": "inter", "description": "Caption font id. Only used when captions_enabled."},
    "caption_font_size": {"type": "string", "default": "36", "description": "Caption font size in px, as a STRING (e.g. '36'). Range 12–64. Only used when captions_enabled."},
    "caption_offset": {"type": "integer", "minimum": -100, "maximum": 100, "default": 0, "description": "Vertical caption shift, -100..100 (positive = up). Only used when captions_enabled."},
}


def get_tool_definitions() -> list[Tool]:
    return [
        # start_video is FIRST deliberately: it is the ONLY entry point for
        # "make a video from <url>". When two tool descriptions both plausibly
        # match, earlier position breaks the tie. auto_video and setup_video are
        # now its Auto/Manual delegates and are marked INTERNAL in their
        # descriptions — do NOT promote either of them back above this one.
        Tool(
            name="start_video",
            description=(
                "THE ONLY tool to call when a user asks to make/create/generate/turn a blog "
                "post or URL into a video. Call it IMMEDIATELY on the first such request — "
                "do not call auto_video, setup_video, create_video or create_project first; "
                "those are internal steps this tool routes to.\n\n"
                "TWO-STEP. Step 1: call with ONLY `blog_url` and no `mode`. It returns a "
                "short question asking the user to choose Auto or Manual. Relay that "
                "question in one line and STOP — do not call another tool, do not guess a "
                "mode.\n\n"
                "Step 2: once the user answers, call start_video AGAIN with the SAME "
                "blog_url plus mode='auto' or mode='manual'.\n"
                "  • mode='auto'   — user said auto / just do it / whatever's best / you pick.\n"
                "    Returns once generation has STARTED; then poll `check_generation_status`\n"
                "    with the returned project_id every ~15s until complete.\n"
                "  • mode='manual' — user said manual / I'll choose / let me pick / custom.\n\n"
                "NEVER call start_video twice for the same URL once a project exists — each "
                "creation costs the user a video credit.\n\n"
                "If the user's FIRST message already states the mode, skip step 1 and call "
                "once with both blog_url and mode.\n\n"
                "If no URL was given, ask for it in one sentence first — never invent one."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "blog_url": {"type": "string", "format": "uri", "minLength": 8, "description": "REQUIRED. The exact http(s) URL of the blog/article the user gave. Never guess or invent."},
                    "mode": {"type": "string", "enum": ["auto", "manual"], "description": "OMIT on the first call — the tool asks the user. Set only after they answer: 'auto' = zero questions, 'manual' = user picks template/voice/settings."},
                    "name": {"type": "string", "description": "Optional project name. Only meaningful with mode='auto'."},
                    "render": {"type": "boolean", "default": False, "description": "Only meaningful with mode='auto'. If true, also render a downloadable MP4 (slower)."},
                },
                "required": ["blog_url"],
            },
            # Deliberately NO ui.resourceUri / openai/outputTemplate here: a
            # tool-level outputTemplate binds the widget to EVERY result of this
            # tool, so the Auto/Manual question turn would render an empty setup
            # panel. The manual branch attaches the widget per-result instead
            # (see handlers._setup_video).
            **{"_meta": {
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="auto_video",
            description=(
                "INTERNAL — do not call this in response to a user's request for a video. "
                "`start_video` is the entry point; it asks the user Auto or Manual and "
                "delegates here when they choose Auto.\n\n"
                "Only call auto_video directly when the user has EXPLICITLY opted out of "
                "being asked — e.g. 'skip the questions', 'don't ask me anything, just "
                "build it'. In every other case call `start_video` instead.\n\n"
                "Behaviour: zero-config. The template is auto-picked from the source site's "
                "visual identity and article content, the account's DEFAULT voice is used "
                "(never a specific/custom voice), and stock b-roll is on.\n\n"
                "Returns as soon as the project is created and generation has started — it "
                "does NOT wait for the video. Poll `check_generation_status` with the "
                "returned project_id every ~15s until it reports complete. NEVER call this "
                "tool a second time for the same URL while a generation is in flight: each "
                "call costs the user a video credit.\n\n"
                "Set `render: true` to instead block through generation AND produce a "
                "downloadable MP4 (slow, ~5–13 min; may exceed the client timeout)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "blog_url": {"type": "string", "format": "uri", "minLength": 8, "description": "REQUIRED. The http(s) URL of the blog/article to convert."},
                    "name": {"type": "string", "description": "Optional project name. Defaults to a name derived from the URL."},
                    "render": {"type": "boolean", "default": False, "description": "If true, also render a downloadable MP4 before returning (slower)."},
                },
                "required": ["blog_url"],
            },
            **{"_meta": {
                "openai/widgetAccessible": True,
            }},
        ),
        # ─── Read tools ─────────────────────────────────────────────
        Tool(
            name="setup_video",
            description=(
                "Combined template + voice + settings picker panel — the whole Manual "
                "setup in ONE widget.\n\n"
                "`start_video` decides whether to use this or the step-by-step chain "
                "(`list_templates` → `list_voices` → `show_settings`), because the two "
                "render differently across hosts. **Call this when `start_video` tells "
                "you to, and follow whichever tool it names.** Do not choose between them "
                "yourself.\n\n"
                "Do NOT call this as the FIRST response to a user's request for a video — "
                "`start_video` is the entry point and asks Auto or Manual first.\n\n"
                "blog_url is MANDATORY and MUST be the actual http(s) URL the user "
                "provided. If the user has not given a URL yet, ASK them for it first "
                "in one short sentence — do NOT call this tool with an empty or fake "
                "URL. The whole pipeline (project creation, voiceover, rendering) "
                "depends on this URL being a real, fetchable article.\n\n"
                "DO NOT first respond in text. DO NOT enumerate templates or voices in "
                "text. DO NOT ask 'which template would you like' or 'male or female?' — "
                "this widget shows ALL templates and ALL voices visually so the user "
                "picks both in one step.\n\n"
                "After the user clicks Create in the widget, a project is created "
                "automatically and generate_video is called next."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "blog_url": {
                        "type": "string",
                        "format": "uri",
                        "minLength": 8,
                        "description": "REQUIRED. The exact http(s) URL of the blog/article the user wants to convert. Must start with http:// or https://. Do not invent or guess; use the URL the user provided.",
                    },
                },
                "required": ["blog_url"],
            },
            annotations=ToolAnnotations(readOnlyHint=True),
            **{"_meta": {
                "ui": {"resourceUri": "ui://blog2video/setup_gallery_v8"},
                "openai/outputTemplate": "ui://blog2video/setup_gallery_v8",
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="list_templates",
            description=(
                "Use this when the user wants to see, browse, or pick a video template "
                "(without immediately creating a video). Shows a visual gallery of every "
                "template with real preview images. Do NOT use web search or your own "
                "knowledge to describe templates — call this tool. "
                "Each template has an `id` used in create_project / change_template.\n\n"
                "This tool renders an interactive widget. Do NOT describe, enumerate, or "
                "summarize the templates in your text reply — the widget IS the "
                "user-facing output. Reply with at most one short sentence.\n\n"
                "WAIT for the user to actually pick a template (they click a card, which "
                "sends a message like `use nightfall`). Only THEN call `list_voices` so "
                "they can also pick a voice. Do not call `list_voices` in the same turn."
            ),
            inputSchema={"type": "object", "properties": {}},
            annotations=ToolAnnotations(readOnlyHint=True),
            **{"_meta": {
                "ui": {"resourceUri": "ui://blog2video/template_gallery_v4"},
                "openai/outputTemplate": "ui://blog2video/template_gallery_v4",
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="list_voices",
            description=(
                "Use this whenever the user wants to see, browse, list or pick a voice, "
                "voiceover or narrator — this is the DEFAULT tool for any voice listing "
                "request. Shows an interactive gallery of all available voices with audio "
                "previews. Do NOT use `get_voices_json` for a user-facing request (it is "
                "for automation only), and do NOT ask the user about voice gender or accent "
                "in text — call this tool so they can hear and click to select a voice.\n\n"
                "This tool renders an interactive widget. Do NOT describe, enumerate, or "
                "summarize the voices in your text reply, and do NOT render them as a "
                "markdown table — the widget IS the user-facing output. Reply with at most "
                "one short sentence.\n\n"
                "In the Manual video flow: WAIT for the user to actually pick a voice "
                "(they click a card, which sends a message like `use voice Rachel (id)`). "
                "Only THEN call `show_settings` — the final step, which creates the "
                "project itself."
            ),
            inputSchema={"type": "object", "properties": {}},
            annotations=ToolAnnotations(readOnlyHint=True),
            **{"_meta": {
                "ui": {"resourceUri": "ui://blog2video/voice_gallery_v2"},
                "openai/outputTemplate": "ui://blog2video/voice_gallery_v2",
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="show_settings",
            description=(
                "Final step of the Manual flow. Shows an interactive panel with the "
                "remaining video settings — length, style, stock footage, background "
                "music, aspect ratio, playback speed, captions and colours — plus the "
                "Create Video button.\n\n"
                "Call this AFTER the user has picked a template (`list_templates`) and a "
                "voice (`list_voices`). Every setting is optional and pre-set to a sensible "
                "default, so the user can simply click Create Video.\n\n"
                "Do not ask about length, music, captions or colours in text — the widget "
                "collects them. Reply with at most one short sentence.\n\n"
                "When the user clicks Create Video the widget sends a message like "
                "`create the video — medium length, captions on, music: moment_of_peace` "
                "(or just `create the video` if they changed nothing). On receiving it, "
                "call `create_project` IMMEDIATELY.\n\n"
                "Reading that message: it lists ONLY the settings the user changed — "
                "everything it does not mention keeps its default, so do not invent values "
                "for the rest. Phrases map onto create_project parameters (`medium length` "
                "→ video_length='medium', `captions on` → captions_enabled=true, "
                "`1.25× speed` → playback_speed=1.25). Values after `music:` and any "
                "`#rrggbb` colour are LITERAL parameter values — pass them exactly as "
                "written, do not translate them.\n\n"
                "You MUST also pass the `template` the user picked in `list_templates` and "
                "the `custom_voice_id` they picked in `list_voices` — both were announced "
                "earlier in this conversation as `use <template_id>` and "
                "`use voice <Name> (<voice_id>)`. Do not ask the user to confirm again. "
                "AFTER create_project returns, immediately call `generate_video`."
            ),
            inputSchema={"type": "object", "properties": {}},
            annotations=ToolAnnotations(readOnlyHint=True),
            **{"_meta": {
                "ui": {"resourceUri": "ui://blog2video/settings_panel_v3"},
                "openai/outputTemplate": "ui://blog2video/settings_panel_v3",
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="get_templates_json",
            description=(
                "Return all built-in video templates as plain JSON (NOT a widget): a list of "
                "{id, name, genres}. ONLY for automation contexts (e.g. n8n) that need machine-readable "
                "options to build a dropdown.\n\n"
                "Do NOT use this when a human asks to see, list or pick a template — that is "
                "`list_templates`, which shows the interactive gallery. Using this tool for a "
                "user-facing request produces a bare markdown table instead of the widget."
            ),
            inputSchema={"type": "object", "properties": {}},
            annotations=ToolAnnotations(readOnlyHint=True),
        ),
        Tool(
            name="get_voices_json",
            description=(
                "Return available narration voices as plain JSON (NOT a widget): a list of "
                "{voice_id, name, description}. ONLY for automation contexts (e.g. n8n) that need "
                "machine-readable options to build a dropdown. Pass the chosen voice_id as "
                "custom_voice_id to create_video.\n\n"
                "Do NOT use this when a human asks to see, list or pick a voice — that is "
                "`list_voices`, which shows an interactive gallery with audio previews. "
                "Using this tool for a user-facing request produces a bare markdown table "
                "instead of the widget."
            ),
            inputSchema={"type": "object", "properties": {}},
            annotations=ToolAnnotations(readOnlyHint=True),
        ),
        Tool(
            name="list_projects",
            description=(
                "List the authenticated user's video projects as a compact table "
                "(id, name, status emoji, scene count, relative time). Call when "
                "user asks 'what projects do I have' or similar."
            ),
            inputSchema={"type": "object", "properties": {}},
            annotations=ToolAnnotations(readOnlyHint=True),
        ),
        Tool(
            name="get_project",
            description=(
                "Get the full details for a single project: header card + scenes "
                "table + edit-verb hints. Call this whenever the user references "
                "an existing project by id, OR after generation completes."
            ),
            inputSchema={
                "type": "object",
                "properties": {"project_id": {"type": "integer"}},
                "required": ["project_id"],
            },
            annotations=ToolAnnotations(readOnlyHint=True),
            **{"_meta": {
                "openai/widgetAccessible": True,
            }},
        ),

        # ─── Create / pipeline tools ────────────────────────────────
        Tool(
            name="create_project",
            description=(
                "INTERNAL. Called by the setup widget. Do not call directly for a "
                "'make me a video' request — that is `start_video`.\n\n"
                "Create a new video project from a blog URL.\n\n"
                "HARD REQUIREMENT — DO NOT skip or shortcut these steps. DO NOT list "
                "templates or voices from your own knowledge or from this tool's parameter "
                "descriptions. The user MUST see and interact with the visual galleries.\n\n"
                "Mandatory sequence BEFORE calling create_project:\n"
                "1. If blog_url not provided — ask for it (this is the ONLY thing you may "
                "ask in plain text).\n"
                "2. Call list_templates — REQUIRED. This renders an interactive template "
                "gallery widget the user clicks to pick. NEVER enumerate templates in text. "
                "NEVER ask 'which template would you like'. Just call the tool.\n"
                "3. Call list_voices — REQUIRED. This renders an interactive voice gallery "
                "with audio previews the user clicks to pick. NEVER ask about gender or "
                "accent in text. NEVER enumerate voices. Just call the tool.\n"
                "4. Wait for the user to confirm both their template AND voice selections "
                "via the widgets before calling create_project.\n\n"
                "AFTER create_project returns, IMMEDIATELY call generate_video — it handles "
                "generation silently and asks the user about rendering when done. "
                "Do NOT auto-call render_video.\n\n"
                "To narrate with ONE specific named voice, pass its id as `custom_voice_id` "
                "(get ids from `list_voices` / the user's saved voices); it overrides "
                "voice_gender/voice_accent."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "blog_url": {"type": "string", "description": "URL of the blog post to convert"},
                    "name": {"type": "string"},
                    "template": {"type": "string", "default": "default", "description": "Template id selected by the user from the list_templates gallery widget. DO NOT guess or enumerate — always call list_templates first so the user picks visually."},
                    "voice_gender": {"type": "string", "enum": ["male", "female"], "default": "female"},
                    "voice_accent": {"type": "string", "enum": ["american", "british"], "default": "american"},
                    "custom_voice_id": {"type": "string", "description": "Optional. A specific voice id to narrate with (an ElevenLabs / saved voice_id, e.g. from list_voices or the user's saved voices). When set it OVERRIDES voice_gender/voice_accent. This is the same field the web app sends when the user picks a named voice."},
                    "video_style": {"type": "string", "enum": ["auto", "explainer", "promotional", "storytelling"], "default": "auto"},
                    "video_length": {"type": "string", "enum": ["auto", "short", "medium", "detailed", "more_detailed"], "default": "auto"},
                    "aspect_ratio": {"type": "string", "enum": ["landscape", "portrait"], "default": "landscape"},
                    "playback_speed": {"type": "number", "minimum": 0.5, "maximum": 2.5},
                    "accent_color": {"type": "string", "description": "Hex color, e.g. #818CF8. OMIT to inherit the template's own palette — only pass this if the user asked for a specific colour."},
                    "bg_color": {"type": "string", "description": "Hex background colour. Omit to inherit the template's palette."},
                    "text_color": {"type": "string", "description": "Hex text colour. Omit to inherit the template's palette."},
                    "stock_footage_enabled": {"type": "boolean", "default": False, "description": "Add stock video b-roll to image-capable scenes. Available on every plan. Pass true unless the user asked for no footage."},
                    **_MEDIA_SETTINGS_PROPERTIES,
                },
                "required": ["blog_url"],
            },
            **{"_meta": {
                "openai/widgetAccessible": True,
            }},
        ),
        # ── create_video: COMMENTED OUT (manifest-size experiment) ──────────
        # ChatGPT drops a connector's tool manifest as a conversation grows
        # (context compression) — a documented OpenAI regression. Our manifest
        # was ~35k chars / ~8.8k tokens across 34 tools; create_video alone was
        # 4,464 chars (13%), the single heaviest entry, and NOTHING routes to
        # it: start_video goes to auto_video or setup_video, no widget calls it,
        # and it never fired in a full day of real traffic.
        #
        # The handler (_create_video) is deliberately KEPT in handlers.py — only
        # the tool definition and its dispatch entry are disabled, so restoring
        # this is just uncommenting both.
        #
        # Trade-off: the one-shot phrasing "make a video from <url> using
        # newscast with Daniel" no longer has a dedicated tool; start_video ->
        # setup_video (panel) covers the same ground in one extra step.
        # Tool(
        # name="create_video",
        # description=(
        # "INTERNAL / programmatic. For a user asking for a video, call "
        # "`start_video`. Use create_video only when the user has already named an "
        # "explicit template AND voice in text, or another tool routed here.\n\n"
        # "One call to make a video: creates a project from a blog URL and runs the "
        # "generation pipeline (scrape → script → scenes), waiting until the scenes are "
        # "ready (~1–5 min). Bypasses the template/voice gallery widgets — pass the "
        # "choices directly as arguments.\n\n"
        # "Voice: to narrate with one specific voice pass `custom_voice_id` (an id from "
        # "`list_voices` / the user's saved voices); `voice_gender`/`voice_accent` are "
        # "OPTIONAL (default female/american) and only used when no custom_voice_id is "
        # "given (or as a fallback if that voice id is invalid).\n\n"
        # "Set `render: true` to also produce a downloadable MP4 (slower, ~+3–8 min). "
        # "After this returns, call `get_preview_url` with the project id to get a "
        # "shareable watch link."
        # ),
        # inputSchema={
        # "type": "object",
        # "properties": {
        # "blog_url": {"type": "string", "format": "uri", "minLength": 8, "description": "REQUIRED. The http(s) URL of the blog/article to convert."},
        # "name": {"type": "string"},
        # "template": {"type": "string", "default": "default", "description": "Template id (from list_templates), e.g. 'nightfall'. Defaults to 'default'."},
        # "custom_voice_id": {"type": "string", "description": "Preferred voice input: a specific voice id (ElevenLabs / saved voice_id from list_voices). Overrides voice_gender/voice_accent."},
        # "voice_gender": {"type": "string", "enum": ["male", "female"], "default": "female", "description": "Optional. Used only when custom_voice_id is not given (and as a fallback)."},
        # "voice_accent": {"type": "string", "enum": ["american", "british"], "default": "american", "description": "Optional. Ignored when custom_voice_id is set."},
        # "video_style": {"type": "string", "enum": ["auto", "explainer", "promotional", "storytelling"], "default": "auto"},
        # "video_length": {"type": "string", "enum": ["auto", "short", "medium", "detailed", "more_detailed"], "default": "auto"},
        # "aspect_ratio": {"type": "string", "enum": ["landscape", "portrait"], "default": "landscape"},
        # "playback_speed": {"type": "number", "minimum": 0.5, "maximum": 2.5},
        # "accent_color": {"type": "string", "description": "Hex color, e.g. #818CF8. OMIT to inherit the template's own palette — only pass this if the user asked for a specific colour."},
        # "bg_color": {"type": "string", "description": "Hex background colour. Omit to inherit the template's palette."},
        # "text_color": {"type": "string", "description": "Hex text colour. Omit to inherit the template's palette."},
        # "stock_footage_enabled": {"type": "boolean", "default": False, "description": "Add stock video b-roll to image-capable scenes. Available on every plan. Pass true unless the user asked for no footage."},
        # "render": {"type": "boolean", "default": False, "description": "If true, also render a downloadable MP4 before returning (slower)."},
        # **_MEDIA_SETTINGS_PROPERTIES,
        # },
        # "required": ["blog_url"],
        # },
        # **{"_meta": {
        # "openai/widgetAccessible": True,
        # }},
        # ),
        Tool(
            name="get_preview_url",
            description=(
                "Return a shareable preview link so the user can watch a project's video in "
                "the browser (mints or reuses the project's public /preview/<token> URL). "
                "Use after the project has been generated (e.g. via create_video)."
            ),
            inputSchema={
                "type": "object",
                "properties": {"project_id": {"type": "integer"}},
                "required": ["project_id"],
            },
            annotations=ToolAnnotations(readOnlyHint=True),
            **{"_meta": {
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="generate_video",
            description=(
                "Start the AI generation pipeline and wait silently until complete (1–5 min). "
                "Call this automatically right after create_project — no user confirmation needed. "
                "Polling happens internally; do NOT call check_generation_status after this. "
                "Returns a project view link and asks the user whether they want to render/download "
                "as MP4. Only call render_video if the user says yes."
            ),
            inputSchema={
                "type": "object",
                "properties": {"project_id": {"type": "integer"}},
                "required": ["project_id"],
            },
            **{"_meta": {
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="check_generation_status",
            description=(
                "Check the current generation status of a project. Use this ONLY when the user "
                "explicitly asks about the status of an existing project (e.g. 'what's the status "
                "of project 42?'). Do NOT call this after generate_video — that tool handles "
                "polling internally and returns when complete."
            ),
            inputSchema={
                "type": "object",
                "properties": {"project_id": {"type": "integer"}},
                "required": ["project_id"],
            },
            **{"_meta": {
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="render_video",
            description=(
                "Start MP4 rendering and wait silently until the download link is ready (3–8 min). "
                "Only call this if the user explicitly says they want to download or render the video. "
                "Polling happens internally; do NOT call check_render_status after this. "
                "Returns the final video URL and an inline preview. "
                "Set force_rerender=true to re-render even if a video already exists."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer"},
                    "force_rerender": {"type": "boolean", "default": False},
                },
                "required": ["project_id"],
            },
            **{"_meta": {
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="check_render_status",
            description=(
                "Check the current render status of a project. Use this ONLY when the user "
                "explicitly asks about render progress for an existing project. "
                "Do NOT call this after render_video — that tool handles polling internally "
                "and returns the final video URL when complete."
            ),
            inputSchema={
                "type": "object",
                "properties": {"project_id": {"type": "integer"}},
                "required": ["project_id"],
            },
            **{"_meta": {
                "openai/widgetAccessible": True,
            }},
        ),

        # ─── Edit tools ─────────────────────────────────────────────
        Tool(
            name="update_scene",
            description=(
                "Update one or more fields on a single scene before rendering. "
                "Returns a before/after diff table. Common uses: 'shorten scene 2' "
                "(narration_text), 'change the title of scene 3', 'replace the on-"
                "screen text in scene 5'. Only fields you supply are changed."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer"},
                    "scene_id": {"type": "integer"},
                    "narration_text": {"type": "string", "description": "Voiceover script for the scene"},
                    "display_text": {"type": "string", "description": "On-screen text overlay"},
                    "title": {"type": "string"},
                    "visual_description": {"type": "string", "description": "What the user sees (for layout/image planning)"},
                },
                "required": ["project_id", "scene_id"],
            },
        ),
        Tool(
            name="change_template",
            description=(
                "Switch an existing project to a different template. The backend "
                "regenerates every scene's layout to fit the new template — this "
                "takes ~30 seconds. RETURNS IMMEDIATELY. After calling, you MUST "
                "poll `check_template_change_status` every 10s until complete."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer"},
                    "template": {"type": "string", "description": "Template id (default, nightfall, bloomberg, etc.)"},
                },
                "required": ["project_id", "template"],
            },
        ),
        Tool(
            name="check_template_change_status",
            description=(
                "Poll template-change progress. Returns the updated scenes once "
                "done. Call every 10s after change_template until you see "
                "'✅ Template switched' or '❌ failed'."
            ),
            inputSchema={
                "type": "object",
                "properties": {"project_id": {"type": "integer"}},
                "required": ["project_id"],
            },
        ),
        Tool(
            name="update_project_settings",
            description=(
                "Update project-level settings on an EXISTING project: captions "
                "(on/off, position, font, size, offset), background music and volume, "
                "playback speed, video length, colors, font, language, aspect ratio. "
                "Pass only the fields you want to change. Common asks: 'turn captions "
                "on', 'use the oswald caption font', 'add calm background music', "
                "'make accent color #FF0000', 'speed up to 1.25x'.\n\n"
                "These are the same settings the web app's Settings tab saves, so "
                "anything editable there can be changed here.\n\n"
                "Do NOT pass these here — they are not settings writes:\n"
                "- narration VOICE (gender/accent/specific voice) → use `change_voice`; "
                "it re-records every voiceover and costs one video credit\n"
                "- the video's LANGUAGE → use `change_language`; it counts as a new "
                "video and costs one credit\n"
                "- `video_style` → fixed when the project is created; tell the user it "
                "cannot be changed afterwards\n"
                "For the first two, confirm the credit cost with the user, then call "
                "that tool — not this one."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer"},
                    "playback_speed": {"type": "number", "minimum": 0.5, "maximum": 2.5},
                    "video_length": {"type": "string", "enum": ["auto", "short", "medium", "detailed", "more_detailed"]},
                    "font_family": {"type": "string"},
                    "content_language": {"type": "string", "description": "ISO 639-1 code, e.g. 'en', 'es', 'fr'"},
                    "accent_color": {"type": "string", "description": "Hex, e.g. #FF0000"},
                    "bg_color": {"type": "string"},
                    "text_color": {"type": "string"},
                    "aspect_ratio": {"type": "string", "enum": ["landscape", "portrait"]},
                    # Captions + background music. Spread from the same dict
                    # create_project/create_video use so the three tools cannot
                    # drift — ProjectUpdate accepts every one of these and the web
                    # Settings tab already PATCHes them to the same endpoint.
                    **_MEDIA_SETTINGS_PROPERTIES,
                },
                # Reject anything not listed above rather than accepting it and
                # silently dropping it server-side (ProjectUpdate ignores unknown
                # keys). voice_gender/voice_accent/video_style used to be
                # advertised here and were discarded on every call.
                "additionalProperties": False,
                "required": ["project_id"],
            },
        ),
        Tool(
            name="change_voice",
            description=(
                "Change the narration VOICE of an existing project and re-record every "
                "scene's voiceover in that voice. The narration wording is unchanged — "
                "only the speaker.\n\n"
                "Use for: 'switch to a male voice', 'use a british narrator', 'narrate "
                "this with <voice name>'. This is NOT part of `update_project_settings` — "
                "the voiceovers must actually be re-synthesised.\n\n"
                "⚠️ COSTS ONE VIDEO CREDIT and takes a few minutes (it regenerates every "
                "scene). Tell the user the cost and get their agreement BEFORE calling. "
                "Never call it twice for the same request.\n\n"
                "ALWAYS call `list_voices` FIRST so the user can hear the options and "
                "click one — exactly like the web app, where Change voice opens a voice "
                "picker. Then pass the `voice_id` they chose as `custom_voice_id`. Do "
                "NOT invent a voice or pick one on the user's behalf.\n\n"
                "Blocks until the re-recording finishes."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer"},
                    # The voice_id is what actually drives TTS. The web app's own
                    # comment: "gender/accent are display-only metadata; the
                    # voice_id drives generation." So there is no meaningful
                    # gender/accent-only request — the user picks a named voice.
                    "custom_voice_id": {"type": "string", "description": "REQUIRED. The voice_id the user picked in `list_voices` (or one of their saved voices). This is what drives the new narration."},
                    "voice_emotion": {"type": "string", "description": "Optional delivery style, e.g. 'excited', 'calm'."},
                },
                "additionalProperties": False,
                "required": ["project_id", "custom_voice_id"],
            },
        ),
        Tool(
            name="delete_voiceover",
            description=(
                "Remove the project's voiceover and make the video MUTE. Every scene's "
                "narration audio is stripped; the on-screen text and visuals are "
                "untouched.\n\n"
                "Use for: 'remove the voiceover', 'make it silent', 'I want it without "
                "narration'.\n\n"
                "Unlike `change_voice`, this is FREE — it does not use a video credit. "
                "It does not clear an existing render either, so re-render afterwards to "
                "get a muted MP4.\n\n"
                "To give the video a DIFFERENT voice rather than no voice, use "
                "`change_voice`. Blocks until the audio has been stripped."
            ),
            inputSchema={
                "type": "object",
                "properties": {"project_id": {"type": "integer"}},
                "additionalProperties": False,
                "required": ["project_id"],
            },
        ),
        Tool(
            name="change_language",
            description=(
                "Translate an existing project into another language — on-screen text, "
                "narration and voiceovers are all regenerated.\n\n"
                "Use for: 'translate this to spanish', 'make a french version'.\n\n"
                "⚠️ COUNTS AS A NEW VIDEO and costs one video credit, and takes a few "
                "minutes. Tell the user the cost and get their agreement BEFORE calling. "
                "Never call it twice for the same request.\n\n"
                "Blocks until the translation finishes."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer"},
                    "content_language": {"type": "string", "description": "REQUIRED. ISO 639-1 code for the target language, e.g. 'es', 'fr', 'de'."},
                },
                "additionalProperties": False,
                "required": ["project_id", "content_language"],
            },
        ),
        Tool(
            name="regenerate_scene",
            description=(
                "Regenerate a single scene with fresh AI takes — useful when the "
                "user dislikes the current narration, wants a different layout, "
                "or wants new visuals. Optionally provide a `description` (what "
                "the scene should be about), `layout` (force a specific layout), "
                "or `narration_text` (use exactly this script). Setting "
                "regenerate_voiceover=true also re-records the audio."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer"},
                    "scene_id": {"type": "integer"},
                    "description": {"type": "string", "description": "What the scene should convey (e.g. 'compare X vs Y as a 2-column table')"},
                    "narration_text": {"type": "string", "description": "Use this exact narration instead of regenerating"},
                    "layout": {"type": "string", "description": "Force a specific layout id (e.g. 'bullet_list', 'comparison')"},
                    "regenerate_voiceover": {"type": "boolean", "default": False},
                },
                "required": ["project_id", "scene_id"],
            },
        ),
        Tool(
            name="reorder_scenes",
            description=(
                "Reorder all scenes in a project. Pass `scene_ids` as the FULL "
                "list of scene IDs in the desired new order. Example: if scenes "
                "are currently [10,11,12,13] and the user says 'move scene 4 "
                "before scene 2', call with scene_ids=[10,13,11,12]."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer"},
                    "scene_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "Full list of scene IDs in the new desired order",
                    },
                },
                "required": ["project_id", "scene_ids"],
            },
        ),
        Tool(
            name="swap_scene_images",
            description=(
                "Swap or move an image between two scenes. `mode='swap'` (default) "
                "exchanges images between two scenes (use first_scene_id + "
                "second_scene_id). `mode='move'` moves an image one-way (use "
                "from_scene_id + to_scene_id)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer"},
                    "mode": {"type": "string", "enum": ["swap", "move"], "default": "swap"},
                    "first_scene_id": {"type": "integer", "description": "Required for mode=swap"},
                    "second_scene_id": {"type": "integer", "description": "Required for mode=swap"},
                    "from_scene_id": {"type": "integer", "description": "Required for mode=move"},
                    "to_scene_id": {"type": "integer", "description": "Required for mode=move"},
                },
                "required": ["project_id"],
            },
        ),

        # ─── Custom-template creation flow ──────────────────────────
        Tool(
            name="create_template_from_url",
            description=(
                "THE tool to call when a user wants to create a custom template from a "
                "website — 'make a template from <url>', 'build a template like <site>'.\n\n"
                "Does the WHOLE flow in ONE call: scrapes the site, extracts the brand "
                "theme (colours, fonts, logos), saves the template, and starts code "
                "generation. Do NOT call `extract_template_theme` / "
                "`create_custom_template` / `start_template_code_generation` separately — "
                "this replaces all three.\n\n"
                "⚠️ Code generation takes 5–8 minutes and uses 1 of the user's 20 daily AI "
                "generation credits. Mention the cost when you report back.\n\n"
                "Returns as soon as generation has STARTED, with a template_id. Then poll "
                "`check_template_code_generation_status` with that id every ~15s until it "
                "reports ready. Do not call this tool twice for the same site — each call "
                "spends a credit.\n\n"
                "If the site cannot be scraped, this returns a message saying so and "
                "creates nothing (no credit spent). Only then fall back to "
                "`create_custom_template` with a theme the user describes."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "format": "uri", "minLength": 8, "description": "REQUIRED. The http(s) URL of the site to build the template from."},
                    "name": {"type": "string", "description": "Optional template name. Defaults to the name derived from the site."},
                },
                "additionalProperties": False,
                "required": ["url"],
            },
            **{"_meta": {"openai/widgetAccessible": True}},
        ),
        Tool(
            name="extract_template_theme",
            description=(
                "Step 1 of the create-template flow. Call this FIRST when the "
                "user wants to create a custom template from a website URL. "
                "Scrapes the URL and uses AI to extract a brand theme — colors, "
                "fonts, style, logos, screenshot. Sync, takes ~10–20 seconds. "
                "Returns a markdown card with the extracted theme so the user "
                "can review and confirm before saving. AFTER calling this, ask "
                "the user to confirm the name and (optionally) tweak any field "
                "before calling `create_custom_template`."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Website URL to extract the theme from (e.g. https://stripe.com)"},
                },
                "required": ["url"],
            },
        ),
        Tool(
            name="create_custom_template",
            description=(
                "Step 2 of the create-template flow. Persists the extracted (or "
                "user-edited) theme as a new custom template. Auto-creates a "
                "linked brand kit. Returns a confirmation card with the new "
                "template id. AFTER this returns, ask the user whether to start "
                "code generation now (~5 minutes) or save it for later. If they "
                "agree, call `start_template_code_generation`."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Template display name"},
                    "theme": {
                        "type": "object",
                        "description": (
                            "Theme object from extract_template_theme. Must "
                            "contain `colors` (with accent/bg/text) and `fonts` "
                            "(with heading/body). Other fields (style, "
                            "animationPreset, borderRadius, category, patterns) "
                            "are optional."
                        ),
                    },
                    "source_url": {"type": "string", "description": "Original website URL the theme was extracted from"},
                    "logo_urls": {"type": "array", "items": {"type": "string"}, "description": "Logo URLs from extraction"},
                    "og_image": {"type": "string", "description": "OG image URL from extraction"},
                    "screenshot_url": {"type": "string", "description": "Screenshot URL from extraction"},
                    "reason": {"type": "string", "description": "Optional personality / brand-voice note saved alongside the theme"},
                },
                "required": ["name", "theme"],
            },
        ),
        Tool(
            name="start_template_code_generation",
            description=(
                "Step 3 of the create-template flow. Kicks off AI generation of "
                "the React/Remotion scene code for a custom template. RETURNS "
                "IMMEDIATELY. Takes 5–7 minutes total. Uses 1 of the user's 20 "
                "daily generation credits. AFTER calling this, you MUST poll "
                "`check_template_code_generation_status` every 15 seconds until "
                "status is `complete` or `error`. Narrate the step label between "
                "polls so the user sees progress."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "template_id": {"type": "integer", "description": "Custom template id from create_custom_template"},
                },
                "required": ["template_id"],
            },
        ),
        Tool(
            name="check_template_code_generation_status",
            description=(
                "Step 4 of the create-template flow. Poll generation progress. "
                "Returns one of:\n"
                "  '⏳ Step N/6 (<label>)' — still running, call again in 15s\n"
                "  '✅ Template #X is ready to use' — STOP polling. Mention "
                "the user can now use `template=\"custom_<id>\"` in `create_project`.\n"
                "  '❌ Generation failed: <reason>' — STOP polling, surface error."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "template_id": {"type": "integer"},
                },
                "required": ["template_id"],
            },
        ),
        Tool(
            name="list_custom_templates",
            description=(
                "List all custom templates the authenticated user has created "
                "(separate from the 12 built-in templates shown by `list_templates`). "
                "Returns a markdown table with each template's color swatch, name, "
                "code-generation status, and a link to the editor. Call this when "
                "the user asks 'what templates have I made' or wants to pick an "
                "existing custom template for a project."
            ),
            inputSchema={"type": "object", "properties": {}},
            annotations=ToolAnnotations(readOnlyHint=True),
        ),
        Tool(
            name="get_custom_template",
            description=(
                "Get full details for a single custom template (color swatch, "
                "theme metadata, code-generation state, editor link). Call this "
                "when the user references a specific custom template by id."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "template_id": {"type": "integer"},
                },
                "required": ["template_id"],
            },
            annotations=ToolAnnotations(readOnlyHint=True),
        ),
    ]
