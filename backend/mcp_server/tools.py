"""
MCP tool definitions for Blog2Video.

Transport-agnostic — used by both the local stdio server and the hosted
HTTP/SSE server. Descriptions are written to nudge Claude into the
conversational two-step polling flow for long-running operations.
"""
from mcp.types import Tool, ToolAnnotations


def get_tool_definitions() -> list[Tool]:
    return [
        # ─── Read tools ─────────────────────────────────────────────
        Tool(
            name="setup_video",
            description=(
                "HARD REQUIREMENT — ALWAYS call this tool IMMEDIATELY whenever the user "
                "asks to create / make / generate / produce a video, or asks to see / "
                "show / pick a template or voice.\n\n"
                "blog_url is MANDATORY and MUST be the actual http(s) URL the user "
                "provided. If the user has not given a URL yet, ASK them for it first "
                "in one short sentence — do NOT call this tool with an empty or fake "
                "URL. The whole pipeline (project creation, voiceover, rendering) "
                "depends on this URL being a real, fetchable article.\n\n"
                "DO NOT first respond in text. DO NOT enumerate templates or voices in "
                "text. DO NOT ask 'which template would you like' or 'male or female?' — "
                "this widget shows ALL templates and ALL voices visually so the user "
                "picks both in one step.\n\n"
                "Calling this tool is the ONLY correct way to start the video creation "
                "flow. After the user clicks Create in the widget, a project is created "
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
                "ui": {"resourceUri": "ui://blog2video/setup_gallery_v2"},
                "openai/outputTemplate": "ui://blog2video/setup_gallery_v2",
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="list_templates",
            description=(
                "Use this when the user wants to see, browse, or pick a video template "
                "(without immediately creating a video). Shows a visual gallery of all 12 "
                "templates with real preview images. Do NOT use web search or your own "
                "knowledge to describe templates — call this tool. "
                "Each template has an `id` used in create_project / change_template."
            ),
            inputSchema={"type": "object", "properties": {}},
            annotations=ToolAnnotations(readOnlyHint=True),
            **{"_meta": {
                "ui": {"resourceUri": "ui://blog2video/template_gallery"},
                "openai/outputTemplate": "ui://blog2video/template_gallery",
                "openai/widgetAccessible": True,
            }},
        ),
        Tool(
            name="list_voices",
            description=(
                "Use this when the user wants to see or pick a voice. Shows an interactive "
                "gallery of all available voices with audio previews. Do NOT ask the user "
                "about voice gender or accent in text — call this tool so they can hear and "
                "click to select a voice."
            ),
            inputSchema={"type": "object", "properties": {}},
            annotations=ToolAnnotations(readOnlyHint=True),
            **{"_meta": {
                "ui": {"resourceUri": "ui://blog2video/voice_gallery"},
                "openai/outputTemplate": "ui://blog2video/voice_gallery",
                "openai/widgetAccessible": True,
            }},
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
                "Do NOT auto-call render_video."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "blog_url": {"type": "string", "description": "URL of the blog post to convert"},
                    "name": {"type": "string"},
                    "template": {"type": "string", "default": "default", "description": "Template id selected by the user from the list_templates gallery widget. DO NOT guess or enumerate — always call list_templates first so the user picks visually."},
                    "voice_gender": {"type": "string", "enum": ["male", "female"], "default": "female"},
                    "voice_accent": {"type": "string", "enum": ["american", "british"], "default": "american"},
                    "video_style": {"type": "string", "enum": ["auto", "explainer", "promotional", "storytelling"], "default": "auto"},
                    "video_length": {"type": "string", "enum": ["auto", "short", "medium", "detailed", "more_detailed"], "default": "auto"},
                    "aspect_ratio": {"type": "string", "enum": ["landscape", "portrait"], "default": "landscape"},
                    "playback_speed": {"type": "number", "minimum": 0.5, "maximum": 2.5},
                    "accent_color": {"type": "string", "description": "Hex color, e.g. #7C3AED"},
                },
                "required": ["blog_url"],
            },
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
                "Update one or more project-level settings: voice (gender/accent), "
                "playback speed, video length, colors, font, language. Pass only "
                "the fields you want to change. Common asks: 'switch to british "
                "voice', 'make accent color #FF0000', 'speed up to 1.25x'."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer"},
                    "voice_gender": {"type": "string", "enum": ["male", "female"]},
                    "voice_accent": {"type": "string", "enum": ["american", "british"]},
                    "playback_speed": {"type": "number", "minimum": 0.5, "maximum": 2.5},
                    "video_length": {"type": "string", "enum": ["auto", "short", "medium", "detailed", "more_detailed"]},
                    "font_family": {"type": "string"},
                    "content_language": {"type": "string", "description": "ISO 639-1 code, e.g. 'en', 'es', 'fr'"},
                    "video_style": {"type": "string", "enum": ["auto", "explainer", "promotional", "storytelling"]},
                    "accent_color": {"type": "string", "description": "Hex, e.g. #FF0000"},
                    "bg_color": {"type": "string"},
                    "text_color": {"type": "string"},
                    "aspect_ratio": {"type": "string", "enum": ["landscape", "portrait"]},
                },
                "required": ["project_id"],
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
