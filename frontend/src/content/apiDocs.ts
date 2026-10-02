/**
 * Hand-written public API reference, rendered by the /api-docs page (pages/ApiDocs.tsx).
 *
 * Covers every route an API key may call (backend/app/services/api_route_policy.py)
 * plus the simplified /api/v1 endpoints. backend/tests/test_api_docs.py fails if an
 * allowed route has no entry here or an entry names a route that doesn't exist, so
 * edit this file whenever the policy changes. That test reads the
 * `ep("METHOD", "/path"` calls below as text: keep the method and path as plain
 * string literals at the start of each `ep(...)`.
 *
 * Paths are written relative to the host (`/api/...`); the docs page prefixes the
 * deployment's base URL. `$B2V` and `$KEY` in examples are substituted there too.
 */

export interface ApiDocParam {
  name: string;
  in: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ApiDocEndpoint {
  method: string;
  path: string;
  summary: string;
  description: string;
  params: ApiDocParam[];
  body: { content_type: string; fields: Omit<ApiDocParam, "in">[] } | null;
  request_example: unknown;
  status: number;
  response_example: unknown;
  response_note: string | null;
  errors: string[];
}

export type ApiDocBlock =
  | { type: "p"; text: string }
  | { type: "code"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; columns: string[]; rows: string[][] };

export interface ApiDocs {
  guides: { id: string; title: string; blocks: ApiDocBlock[] }[];
  sections: { id: string; title: string; description: string; endpoints: ApiDocEndpoint[] }[];
}

const JSON_TYPE = "application/json";
const MULTIPART = "multipart/form-data";
const FORM = "application/x-www-form-urlencoded";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
/** [name, in, type, required, description] */
type ParamTuple = [string, string, string, boolean, string];
/** [name, type, required, description] */
type FieldTuple = [string, string, boolean, string];

interface EndpointOptions {
  params?: ParamTuple[];
  body?: FieldTuple[];
  contentType?: string;
  request?: unknown;
  response?: unknown;
  status?: number;
  responseNote?: string;
  errors?: string[];
}

function ep(method: Method, path: string, summary: string, description = "", opts: EndpointOptions = {}): ApiDocEndpoint {
  return {
    method,
    path,
    summary,
    description,
    params: (opts.params ?? []).map(([name, loc, type, required, desc]) => ({ name, in: loc, type, required, description: desc })),
    body: opts.body?.length
      ? {
          content_type: opts.contentType ?? JSON_TYPE,
          fields: opts.body.map(([name, type, required, desc]) => ({ name, type, required, description: desc })),
        }
      : null,
    request_example: opts.request ?? null,
    status: opts.status ?? 200,
    response_example: opts.response ?? null,
    response_note: opts.responseNote ?? null,
    errors: opts.errors ?? [],
  };
}

const PROJECT_ID: ParamTuple = ["project_id", "path", "integer", true, "Project ID."];

const SCENE_ID: ParamTuple = ["scene_id", "path", "integer", true, "Scene ID, from the project's `scenes`."];

// ─── Shared examples ───────────────────────────────────────────────────────────

const SCENE = {
  id: 5012,
  project_id: 812,
  order: 1,
  title: "Why remote teams stall",
  narration_text: "Most remote teams don't fail on talent. They fail on handoffs.",
  display_text: "Remote teams fail on handoffs",
  visual_description: "Split screen of two time zones",
  remotion_code: "{\"layout\": \"split_stat\", \"layoutProps\": {...}}",
  preferred_layout: "split_stat",
  scene_type: "content",
  voiceover_path: "/media/projects/812/audio/scene_1.mp3",
  duration_seconds: 7.4,
  extra_hold_seconds: null,
  bgm_volume: null,
  created_at: "2026-09-29T10:14:03",
};

const ASSET = {
  id: 9921,
  project_id: 812,
  asset_type: "audio",
  filename: "scene_1.mp3",
  r2_url: "https://media.blog2video.app/users/41/projects/812/audio/scene_1.mp3",
  excluded: false,
  created_at: "2026-09-29T10:14:09",
  duration_seconds: null,
  width: null,
  height: null,
};

const PROJECT = {
  id: 812,
  user_id: 41,
  name: "How remote teams ship faster",
  blog_url: "https://example.com/remote-teams",
  status: "generated",
  template: "default",
  video_style: "explainer",
  video_length: "auto",
  aspect_ratio: "landscape",
  voice_gender: "female",
  voice_accent: "american",
  custom_voice_id: null,
  content_language: "en",
  accent_color: "#7C3AED",
  bg_color: "#FFFFFF",
  text_color: "#000000",
  font_family: null,
  logo_r2_url: null,
  logo_position: "bottom_right",
  playback_speed: 1.0,
  bgm_track_id: "corporate_upbeat",
  bgm_volume: 0.1,
  captions_enabled: true,
  caption_position: "bottom_center",
  stock_footage_enabled: false,
  r2_video_url: null,
  created_at: "2026-09-29T10:12:40",
  updated_at: "2026-09-29T10:15:02",
  scenes: [SCENE],
  assets: [ASSET],
};

const VOICE_JOB_STATUS = {
  active: true,
  done: false,
  error: null,
  total: 6,
  completed: 2,
  progress: 33,
  status: "voice_regenerating",
  r2_video_url: null,
  kind: "voice_change",
};

const SAVED_VOICE = {
  id: 17,
  voice_id: "21m00Tcm4TlvDq8ikWAM",
  name: "Rachel",
  preview_url: "https://.../rachel.mp3",
  source: "prebuilt",
  plan: "free",
  gender: "female",
  accent: "american",
  description: "Calm, clear narrator",
  created_at: "2026-09-01T08:00:00",
  custom_voice_id: null,
};

const CUSTOM_VOICE = {
  id: 4,
  name: "My narrator",
  voice_id: "pNInz6obpgDQGcFmaJgB",
  source: "clone",
  prompt_text: null,
  form_gender: null,
  form_age: null,
  form_persona: null,
  form_speed: null,
  form_accent: null,
  preview_url: "https://.../preview.mp3",
  created_at: "2026-09-20T12:00:00",
};

const CUSTOM_TEMPLATE_ID: ParamTuple = [
  "template_id",
  "path",
  "integer",
  true,
  "Numeric template ID. Use `custom_<id>` only as a project's `template` value.",
];

const CUSTOM_TEMPLATE = {
  id: 58,
  name: "Acme brand",
  source_url: "https://acme.com",
  category: "blog",
  theme: { colors: { accent: "#FF5A1F", bg: "#0B0B0F", text: "#FFFFFF" }, fonts: { heading: "Inter" } },
  preview_colors: { accent: "#FF5A1F", bg: "#0B0B0F", text: "#FFFFFF" },
  intro_code: "...",
  outro_code: "...",
  content_codes: ["..."],
  preview_image_url: "https://.../custom_58.png",
};

// ─── Guides ────────────────────────────────────────────────────────────────────

const GUIDES: ApiDocs["guides"] = [
  {
    id: "authentication",
    title: "Authentication",
    blocks: [
      {
        type: "p",
        text: "Send your API key as `Authorization: Bearer <key>` on every request. Create keys on the API Keys page and keep them on your server. ==The API needs a paid plan.==",
      },
    ],
  },
  {
    id: "quick-flow",
    title: "Quick Video Creation",
    blocks: [
      {
        type: "list",
        items: [
          "Create: `POST /api/v1/videos` with a `url`, or `content` and a `title`. Uses one video from your plan.",
          "Wait: poll `GET /api/v1/videos/{id}/status` until `ready` is true.",
          "Get it: `GET /api/v1/videos/{id}` returns the scenes and a `preview_url` you can play or embed.",
          "Render (optional): `POST /api/v1/videos/{id}/render`, then poll it until `done`. `r2_video_url` is the MP4.",
        ],
      },
      {
        type: "p",
        text: "Optional fields when creating: `template`, `video_style`, `video_length`, `aspect_ratio`, `voice_gender`, `content_language` and `external_user_id`. Send an `Idempotency-Key` header to avoid creating the same video twice.",
      },
    ],
  },
  {
    id: "errors",
    title: "Errors",
    blocks: [
      { type: "p", text: "Errors return JSON with a `detail` field." },
      {
        type: "table",
        columns: ["Status", "Meaning"],
        rows: [
          ["400", "Not valid right now."],
          ["401", "Missing or invalid API key."],
          ["402", "No videos left this period."],
          ["403", "Not allowed on your plan, or out of credits."],
          ["404", "Not found."],
          ["409", "A job is already running."],
          ["422", "Invalid fields (listed in `detail`)."],
          ["429", "Too many requests; wait for `Retry-After`."],
        ],
      },
    ],
  },
  {
    id: "limits",
    title: "Usage and background jobs",
    blocks: [
      {
        type: "p",
        text: "Each new video uses one video from your plan; AI features use AI-edit credits. Long jobs run in the background: poll their status at most every 2 seconds.",
      },
    ],
  },
  {
    id: "custom-template-flow",
    title: "Custom templates",
    blocks: [
      {
        type: "list",
        items: [
          "Extract a theme: `POST /api/custom-templates/extract-theme`.",
          "Create the template: `POST /api/custom-templates`.",
          "Generate it: `POST /api/custom-templates/{id}/generate-code`, then poll until `complete`.",
          "Use it: create a video with `template: \"custom_<id>\"`.",
        ],
      },
    ],
  },
  {
    id: "your-app",
    title: "Serving your own users",
    blocks: [
      {
        type: "list",
        items: [
          "Call the API from your backend only; usage is billed to you.",
          "Tag videos with `external_user_id` and filter by it.",
          "Check a video belongs to the user before showing it.",
        ],
      },
    ],
  },
];

const PROJECT_SETTINGS_FIELDS: FieldTuple[] = [
    ["accent_color", "string", false, "Hex color, e.g. `#0EA5E9`."],
    ["bg_color", "string", false, "Hex color."],
    ["text_color", "string", false, "Hex color."],
    ["font_family", "string", false, "Font ID. `null` clears it."],
    ["aspect_ratio", "string", false, "`landscape` or `portrait`."],
    ["playback_speed", "number", false, "0.5 to 2.5."],
    ["video_length", "string", false, "`auto`, `short`, `medium` or `detailed`. Used by later regenerations."],
    ["content_language", "string", false, "Video language, e.g. `es`. Used by later regenerations."],
    ["bgm_track_id", "string", false, "Background music track. `null` removes it."],
    ["bgm_volume", "number", false, "0 to 1."],
    ["captions_enabled", "boolean", false, "Show captions."],
    ["caption_position", "string", false, "`bottom_center` or `top_center`."],
    ["caption_font_family", "string", false, "Caption font, e.g. `inter`."],
    ["caption_font_size", "string", false, "Caption size, e.g. `36`."],
    ["caption_offset", "integer", false, "Vertical shift, -100 to 100."],
    ["avatar_shape", "string", false, "`circle`, `rounded` or `square`."],
    ["avatar_size", "number", false, "Fraction of the video width, 0.1 to 0.42."],
    ["avatar_position", "string", false, "`top_left`, `top_right`, `bottom_left` or `bottom_right`."],
    ["avatar_bg", "string", false, "`transparent` or a hex color. `null` keeps the photo's background."],
    ["avatar_opacity", "number", false, "0.2 to 1."],
    ["avatar_shadow", "number", false, "0 to 1."],
    ["avatar_motion_style", "string", false, "`subtle`, `natural` or `expressive`."],

];

const SCENE_FIELDS: FieldTuple[] = [
    ["title", "string", false, "Scene title."],
    ["display_text", "string", false, "On-screen text."],
    ["narration_text", "string", false, "Narration script."],
    ["visual_description", "string", false, "Description used to pick or generate visuals."],
    ["duration_seconds", "number", false, "Scene length in seconds."],
    ["extra_hold_seconds", "number", false, "Extra time to hold the last frame."],
    ["bgm_volume", "number", false, "Per-scene music volume 0 to 1."],
    ["remotion_code", "string", false, "Advanced: the scene's layout descriptor JSON."],

];

// ─── Sections ──────────────────────────────────────────────────────────────────

const SECTIONS: ApiDocs["sections"] = [
  {
    id: "account",
    title: "Account",
    description: "The key owner's plan and remaining usage.",
    endpoints: [
      ep("GET", "/api/auth/me", "Get account", "Returns the user data.", {
        response: {
          id: 41,
          email: "you@company.com",
          name: "Sam",
          plan: "pro",
          videos_used_this_period: 12,
          video_limit: 100,
          can_create_video: true,
          ai_edit_credits: 40,
          ai_edit_allowance_remaining: 4870,
          custom_templates_created: 3,
          custom_template_limit: 20,
          can_create_custom_template: true,
        },
      }),
    ],
  },
  {
    id: "projects",
    title: "Projects",
    description: "Create and manage video projects. Each new project uses one video.",
    endpoints: [
      ep("POST", "/api/projects/upload", "Create a project from documents", "Up to 5 files, 5 MB each: PDF, DOCX, PPTX, TXT, MD or VTT.", {
        contentType: MULTIPART,
        body: [
          ["files", "file[]", true, "The documents."],
          ["name", "string", false, "Project name. Defaults to the file name."],
          ["template", "string", false, "Template ID. Defaults to `default`."],
          ["video_style", "string", false, "`explainer` (default), `promotional`, `storytelling` or `auto`."],
          ["video_length", "string", false, "`auto` (default), `short`, `medium` or `detailed`."],
          ["aspect_ratio", "string", false, "`landscape` (default) or `portrait`."],
          ["voice_gender", "string", false, "`female` (default), `male` or `none`."],
          ["voice_accent", "string", false, "`american` (default) or `british`."],
          ["custom_voice_id", "string", false, "Use a custom voice instead."],
          ["voice_emotion", "string", false, "Narration tone preset."],
          ["content_language", "string", false, "Video language, e.g. `es`."],
          ["accent_color", "string", false, "Hex color, e.g. `#7C3AED`."],
          ["bg_color", "string", false, "Hex color."],
          ["text_color", "string", false, "Hex color."],
          ["logo_position", "string", false, "`bottom_right` (default), `bottom_left`, `top_right` or `top_left`."],
          ["logo_opacity", "number", false, "0 to 1. Default `0.9`."],
          ["bgm_track_id", "string", false, "Background music track."],
          ["bgm_volume", "number", false, "0 to 1. Default `0.1`."],
          ["stock_footage_enabled", "boolean", false, "Use stock footage. Default `false`."],
          ["script_review_enabled", "boolean", false, "Pause for script review. Default `false`."],
          ["animation_instructions", "string", false, "Extra direction for the visuals."],
        ],
        response: { ...PROJECT, blog_url: null, status: "created", scenes: [] },
      }),
      ep("GET", "/api/projects", "List projects", "Newest first. Returns an array, or a paginated object when `page` is set.", {
        params: [
          ["page", "query", "integer", false, "Page number (1-based). Enables pagination."],
          ["per_page", "query", "integer", false, "Page size. Default 10."],
        ],
        response: [
          {
            id: 812,
            name: "How remote teams ship faster",
            blog_url: "https://example.com/remote-teams",
            status: "done",
            created_at: "2026-09-29T10:12:40",
            updated_at: "2026-09-29T10:40:11",
            scene_count: 8,
            role: "owner",
          },
        ],
        responseNote: "With `page`: `{ \"items\": [...], \"total\": 37, \"page\": 1, \"per_page\": 10 }`.",
      }),
      ep("GET", "/api/projects/{project_id}", "Get a project", "Returns settings, ordered `scenes` and `assets`. Voiceovers are `audio` assets matched to scenes by `voiceover_path`.", {
        params: [PROJECT_ID],
        response: PROJECT,
      }),
      ep("PATCH", "/api/projects/{project_id}/update-project", "Update project settings", "Send only the fields to change.", {
        params: [PROJECT_ID],
        body: PROJECT_SETTINGS_FIELDS,
        response: PROJECT,
      }),
      ep("PATCH", "/api/projects/{project_id}", "Update logo placement", "", {
        params: [PROJECT_ID],
        body: [
          ["logo_position", "string", false, "`top_left`, `top_right`, `bottom_left` or `bottom_right`."],
          ["logo_size", "number", false, "Percent of the default size."],
          ["logo_opacity", "number", false, "0 to 1."],
        ],
        response: PROJECT,
      }),
      ep("POST", "/api/projects/{project_id}/logo", "Upload a logo", "PNG, JPG, SVG or WebP. Shown on every scene.", {
        params: [PROJECT_ID],
        contentType: MULTIPART,
        body: [["file", "file", true, "The logo image."]],
        response: { logo_url: "https://media.blog2video.app/.../logo.png", logo_position: "bottom_right" },
      }),
      ep("DELETE", "/api/projects/{project_id}/logo", "Remove the logo", "", {
        params: [PROJECT_ID],
        response: { detail: "Logo removed" },
      }),
      ep("DELETE", "/api/projects/{project_id}", "Delete a project", "Permanently deletes the project and its media.", {
        params: [PROJECT_ID],
        response: { detail: "Project deleted" },
      }),
      ep("GET", "/api/projects/template-availability", "Check template availability", "Indicates whether the account has custom or crafted templates.", {
        response: { has_custom_templates: true, has_crafted_templates: false },
      }),
      ep("GET", "/api/projects/{project_id}/layouts", "List template layouts", "Layouts supported by the project's template, for use as `layout` in scene regeneration.", {
        params: [PROJECT_ID],
        response: {
          layouts: ["bullet_list", "hero_image", "hero_image--left", "quote", "split_stat"],
          selectable_layouts: ["bullet_list", "hero_image", "quote", "split_stat"],
          layout_names: { "hero_image--left": "Hero Image — Left" },
          layouts_without_image: ["bullet_list", "quote"],
          layout_variants: { hero_image: ["hero_image--left"] },
        },
        responseNote: "Includes `layout_prop_schema`, `content_prop_schema` and `layout_content_types`.",
      }),
      ep("PATCH", "/api/projects/{project_id}/assets/{asset_id}/exclude", "Include or exclude an image", "Includes or excludes a scraped image from scenes.", {
        params: [PROJECT_ID, ["asset_id", "path", "integer", true, "The asset's id."]],
        response: { id: 9930, excluded: true },
      }),
      ep("DELETE", "/api/projects/{project_id}/assets/{asset_id}", "Delete an asset", "", {
        params: [PROJECT_ID, ["asset_id", "path", "integer", true, "The asset's id."]],
        response: { detail: "Asset deleted" },
      }),
    ],
  },
  {
    id: "generation",
    title: "Generation & status",
    description: "Generate scenes and voiceovers, and track progress.",
    endpoints: [
      ep("POST", "/api/projects/{project_id}/generate", "Start generation", "Runs the full pipeline in the background and returns immediately.", {
        params: [PROJECT_ID],
        response: { detail: "Pipeline started", step: 0 },
        responseNote: "`detail` reports `Already generated`, `Pipeline already running`, `Awaiting script review` or `Awaiting stock footage review` when applicable.",
      }),
      ep("GET", "/api/projects/{project_id}/status", "Get generation status", "Poll every 3–5 seconds. Complete when `running` is false and `status` is `generated`.", {
        params: [PROJECT_ID],
        response: {
          status: "scripted",
          step: 3,
          running: true,
          error: null,
          error_code: null,
          notice: null,
          stock_footage: null,
          project_removed: false,
        },
        responseNote: "`status`: `created`, `scraped`, `scripted`, `awaiting_script_review`, `generated`, `awaiting_stock_footage_review`, `rendering`, `done`, `error`. A failed project may be removed and refunded (`project_removed: true`).",
      }),
      ep("POST", "/api/projects/{project_id}/scrape", "Run the scrape step", "Runs only the source-reading step. Use `generate` for the full pipeline.", {
        params: [PROJECT_ID],
        response: { ...PROJECT, status: "scraped", scenes: [] },
      }),
      ep("POST", "/api/projects/{project_id}/generate-script", "Run the script step", "", {
        params: [PROJECT_ID],
        response: { ...PROJECT, status: "scripted", scenes: [] },
      }),
      ep("POST", "/api/projects/{project_id}/generate-scenes", "Run the scene step", "", {
        params: [PROJECT_ID],
        response: PROJECT,
      }),
      ep("POST", "/api/projects/{project_id}/script-review/approve", "Approve the script", "First-time generation of a project created with `script_review_enabled`. Saves the scenes you send and continues to voiceovers. For a regenerated script, use `regenerate-script/verify` instead.", {
        params: [PROJECT_ID],
        body: [
          [
            "scenes",
            "array",
            true,
            "Each item: `id`, `title`, `narration_text`, `display_text`, optional `preferred_layout`.",
          ],
        ],
        response: { project: PROJECT, preference_learning: null },
      }),
      ep("POST", "/api/projects/{project_id}/script-review/scenes/{scene_id}/narration-preview", "Preview and update a scene in script review stage", "Send the scene with your edits to any field. Returns the full scene with its updated data.", {
        params: [PROJECT_ID, SCENE_ID],
        body: [
          ["title", "string", true, "Scene title."],
          ["display_text", "string", true, "On-screen text."],
          ["narration_text", "string", false, "Current narration."],
          [
            "draft_scenes",
            "array",
            true,
            "All scenes in their current draft form (`id`, `title`, `display_text`, `narration_text`).",
          ],
          ["revision", "integer", true, "Client revision counter; returned unchanged."],
        ],
        response: {
          revision: 3,
          title: "Why remote teams stall",
          display_text: "…",
          narration_text: "…",
          source_fingerprint: "a1b2c3",
        },
      }),
      ep("POST", "/api/projects/{project_id}/regenerate-script", "Regenerate the script", "Rewrites titles, on-screen text and layouts. Runs in the background.", {
        params: [PROJECT_ID],
        body: [
          ["user_instruction", "string", false, "Optional guidance, e.g. \"shorter titles, more numbers\"."],
        ],
        response: {
          id: 77,
          project_id: 812,
          status: "queued",
          current_step: "queued",
          total_scenes: 8,
          processed_scenes: 0,
          error_message: null,
          user_instruction: "shorter titles",
        },
      }),
      ep("GET", "/api/projects/{project_id}/regenerate-script-status", "Get script regeneration status", "", {
        params: [PROJECT_ID],
        response: {
          id: 77,
          project_id: 812,
          status: "awaiting_verification",
          current_step: "done",
          total_scenes: 8,
          processed_scenes: 8,
          error_message: null,
        },
        responseNote: "`null` if no job has run. At `awaiting_verification`, call `verify` to keep the result or `regenerate` to retry.",
      }),
      ep("GET", "/api/projects/{project_id}/regenerate-script/preview", "Get previous scenes", "Returns the scenes from before regeneration, for comparison.", {
        params: [PROJECT_ID],
        response: {
          previous_scenes: [
            {
              order: 1,
              title: "Old title",
              display_text: "…",
              narration_text: "…",
              visual_description: "…",
              preferred_layout: "bullet_list",
            },
          ],
        },
      }),
      ep("POST", "/api/projects/{project_id}/regenerate-script/verify", "Accept the regenerated script", "After `POST /regenerate-script`. Accepts the new script as it is (no body) and continues to scenes and voiceovers. Charges one video credit. For first-time script review, use `script-review/approve` instead.", {
        params: [PROJECT_ID],
        response: { id: 77, status: "completed" },
      }),
      ep("POST", "/api/projects/{project_id}/regenerate-script/regenerate", "Retry script regeneration", "Discards the regenerated script and runs it again, optionally with a new `user_instruction`. No credit is charged.", {
        params: [PROJECT_ID],
        body: [["user_instruction", "string", false, "New guidance for the retry."]],
        response: { id: 78, status: "queued" },
      }),
    ],
  },
  {
    id: "scenes",
    title: "Scenes",
    description: "Edit, add, reorder, regenerate and delete scenes.",
    endpoints: [
      ep("PUT", "/api/projects/{project_id}/scenes/{scene_id}", "Edit a scene", "Send only the fields to change. Changing `narration_text` does not re-record the voiceover.", {
        params: [PROJECT_ID, SCENE_ID],
        body: SCENE_FIELDS,
        response: { ...SCENE, title: "Handoffs, not talent", display_text: "Teams fail on handoffs" },
      }),
      ep("POST", "/api/projects/{project_id}/scenes/{scene_id}/regenerate", "Regenerate a scene", "Rebuilds one scene, optionally with new narration and voiceover. Uses AI-edit credits.", {
        params: [PROJECT_ID, SCENE_ID],
        contentType: MULTIPART,
        body: [
          ["description", "string", false, "What the scene should show or say."],
          ["narration_text", "string", false, "New narration."],
          ["regenerate_voiceover", "string", false, "`true` to re-record the voiceover. Default `false`."],
          [
            "voiceover_verbatim",
            "string",
            false,
            "`true` reads `narration_text` exactly; `false` allows AI refinement. Default `true`.",
          ],
          ["layout", "string", false, "Force a layout from `GET /api/projects/{project_id}/layouts`."],
          ["image", "file", false, "Image to use in the scene."],
        ],
        response: SCENE,
        errors: ["403: insufficient AI-edit credits."],
      }),
      ep("POST", "/api/projects/{project_id}/scenes/add", "Add a scene", "Generates and inserts a scene from a prompt. Runs in the background; poll `add-status`.", {
        params: [PROJECT_ID],
        body: [
          ["prompt", "string", true, "What the new scene should cover."],
          ["position", "integer", false, "1-based position to insert at. Appends when omitted."],
        ],
        response: {
          id: 31,
          status: "queued",
          current_step: "queued",
          error_message: null,
          new_scene_id: null,
          position: 6,
        },
      }),
      ep("GET", "/api/projects/{project_id}/scenes/add-status", "Get add-scene status", "", {
        params: [PROJECT_ID],
        response: {
          id: 31,
          status: "completed",
          current_step: "done",
          error_message: null,
          new_scene_id: 5020,
          position: 6,
        },
        responseNote: "`status`: `queued`, `running`, `completed` or `failed`. `null` when no job has run.",
      }),
      ep("POST", "/api/projects/{project_id}/scenes/reorder", "Reorder scenes", "", {
        params: [PROJECT_ID],
        body: [["scene_orders", "array", true, "Every scene's `scene_id` with its new 1-based `order`."]],
        response: [{ ...SCENE, id: 5013, order: 1 }, { ...SCENE, order: 2 }],
      }),
      ep("PUT", "/api/projects/{project_id}/bulk-update-scenes", "Set font sizes for all scenes", "", {
        params: [PROJECT_ID],
        body: [
          ["title_font_size", "integer", false, "Title size in px."],
          ["description_font_size", "integer", false, "Body text size in px."],
        ],
        response: [SCENE],
      }),
      ep("DELETE", "/api/projects/{project_id}/scenes/{scene_id}", "Delete a scene", "", {
        params: [PROJECT_ID, SCENE_ID],
        status: 204,
        response: null,
        responseNote: "No content.",
      }),
    ],
  },
  {
    id: "images",
    title: "Images & stock footage",
    description: "Manage scene images and stock footage.",
    endpoints: [
      ep("POST", "/api/projects/{project_id}/scenes/{scene_id}/image", "Upload a scene image", "", {
        params: [PROJECT_ID, SCENE_ID],
        contentType: MULTIPART,
        body: [["image", "file", true, "PNG, JPG or WebP."]],
        response: SCENE,
      }),
      ep("POST", "/api/projects/{project_id}/scenes/{scene_id}/generate-image", "Generate an AI image", "Returns an image to upload with the scene image endpoint. Uses AI-edit credits; failures are not charged.", {
        params: [PROJECT_ID, SCENE_ID],
        body: [["image_description", "string", true, "What the image should show."]],
        response: {
          image_base64: "iVBORw0KGgoAAAANSUhEUg…",
          refined_prompt: "Flat illustration of a calm home office at sunrise…",
        },
      }),
      ep("PATCH", "/api/projects/{project_id}/scenes/{scene_id}/image-focus", "Set image framing", "", {
        params: [PROJECT_ID, SCENE_ID],
        body: [
          ["image_focus_x", "number", false, "Horizontal focal point, 0 to 100 percent. Default 50."],
          ["image_focus_y", "number", false, "Vertical focal point, 0 to 100 percent. Default 50."],
          ["image_zoom", "number", false, "Zoom factor."],
          ["video_start_seconds", "number", false, "For stock clips: where playback starts."],
        ],
        response: SCENE,
      }),
      ep("POST", "/api/projects/{project_id}/images/move", "Move an image between scenes", "", {
        params: [PROJECT_ID],
        body: [
          ["from_scene_id", "integer", true, "Scene that has the image."],
          ["to_scene_id", "integer", true, "Scene that receives it."],
        ],
        response: { detail: "Image moved" },
      }),
      ep("POST", "/api/projects/{project_id}/images/swap", "Swap two scenes' images", "", {
        params: [PROJECT_ID],
        body: [
          ["first_scene_id", "integer", true, "First scene."],
          ["second_scene_id", "integer", true, "Second scene."],
        ],
        response: { detail: "Images swapped" },
      }),
      ep("POST", "/api/projects/{project_id}/images/duplicate", "Copy an image to another scene", "", {
        params: [PROJECT_ID],
        body: [
          ["source_scene_id", "integer", true, "Scene to copy from."],
          ["target_scene_id", "integer", true, "Scene to copy to."],
        ],
        response: { detail: "Image duplicated to target scene" },
      }),
      ep("POST", "/api/projects/{project_id}/images/assign-existing", "Assign a project image to a scene", "", {
        params: [PROJECT_ID],
        body: [
          ["scene_id", "integer", true, "Target scene."],
          ["asset_id", "integer", true, "An `image` asset of this project."],
        ],
        response: { detail: "Image assigned to scene" },
      }),
      ep("GET", "/api/projects/{project_id}/stock-footage/search", "Search stock footage", "Searches Pexels and Pixabay. No charge.", {
        params: [
          PROJECT_ID,
          ["q", "query", "string", true, "Search terms."],
          ["provider", "query", "string", false, "`all`, `pexels` or `pixabay`. Default `all`."],
          ["page", "query", "integer", false, "Default 1."],
          ["per_page", "query", "integer", false, "Default 6."],
          ["box_w", "query", "number", false, "Target width in px, to pick the best rendition."],
          ["box_h", "query", "number", false, "Target height in px."],
        ],
        response: {
          clips: [
            {
              provider: "pexels",
              id: "856789",
              preview_url: "https://videos.pexels.com/…/small.mp4",
              thumbnail_url: "https://images.pexels.com/…",
              download_url: "https://videos.pexels.com/…/hd.mp4",
              width: 1920,
              height: 1080,
              duration: 12.0,
              fps: 25.0,
              author: "Jane Doe",
              page_url: "https://www.pexels.com/video/856789/",
              tags: "office, laptop",
              description: "Person typing",
            },
          ],
        },
      }),
      ep("POST", "/api/projects/{project_id}/scenes/{scene_id}/stock-footage", "Set a scene's stock clip", "Uses a clip from the search results. Uses AI-edit credits.", {
        params: [PROJECT_ID, SCENE_ID],
        body: [
          ["provider", "string", true, "`pexels` or `pixabay`."],
          ["clip_id", "string", true, "The clip's `id` from search."],
          ["download_url", "string", true, "From search."],
          ["width", "number", false, "From search."],
          ["height", "number", false, "From search."],
          ["duration", "number", false, "From search."],
          ["author", "string", false, "Attribution, from search."],
          ["page_url", "string", false, "Attribution link, from search."],
        ],
        response: {
          asset_id: 9950,
          filename: "pexels_856789.mp4",
          video_url: "https://media.blog2video.app/…/pexels_856789.mp4",
          audio_variant_url: null,
          has_audio: false,
          duration_seconds: 12.0,
          width: 1920,
          height: 1080,
          source_author: "Jane Doe",
          source_provider: "pexels",
        },
      }),
      ep("GET", "/api/projects/{project_id}/stock-footage/pending", "List clips pending review", "For projects at `awaiting_stock_footage_review`.", {
        params: [PROJECT_ID],
        response: {
          status: "awaiting_stock_footage_review",
          awaiting: true,
          scenes: [
            {
              scene_id: 5012,
              order: 1,
              title: "Why remote teams stall",
              scene_type: "content",
              layout: "hero_image",
              duration_seconds: 7.4,
              image_focus_x: null,
              image_focus_y: null,
              image_zoom: null,
              video_start_seconds: null,
              clip: {
                filename: "pexels_856789.mp4",
                url: "https://media.blog2video.app/…/pexels_856789.mp4",
                duration_seconds: 12.0,
                author: "Jane Doe",
                provider: "pexels",
              },
            },
          ],
        },
      }),
      ep("POST", "/api/projects/{project_id}/stock-footage/link", "Replace a reviewed clip", "", {
        params: [PROJECT_ID],
        body: [
          ["scene_id", "integer", true, "Scene to change."],
          ["filename", "string", true, "Filename of a `video` asset in this project."],
        ],
        response: { detail: "Clip linked", scene_id: 5012, filename: "pexels_1234.mp4" },
      }),
      ep("POST", "/api/projects/{project_id}/stock-footage/approve", "Approve stock clips", "Resumes a project at `awaiting_stock_footage_review`.", {
        params: [PROJECT_ID],
        response: { detail: "Approved", status: "generated" },
      }),
      ep("POST", "/api/projects/{project_id}/stock-footage/reject", "Reject stock clips", "Discards the selected clips and uses images instead.", {
        params: [PROJECT_ID],
        response: { detail: "Rejected — reverted to images", status: "generated" },
      }),
    ],
  },
  {
    id: "voiceovers",
    title: "Voiceovers, voice & language",
    description: "Manage voices, voiceovers and translation.",
    endpoints: [
      ep("POST", "/api/projects/{project_id}/change-voice", "Change the voice", "Re-records all voiceovers. Runs in the background; poll `voice-change-status`.", {
        params: [PROJECT_ID],
        body: [
          ["voice_gender", "string", false, "`female` or `male`."],
          ["voice_accent", "string", false, "`american` or `british`."],
          ["custom_voice_id", "string", false, "A saved voice id; overrides gender/accent."],
          ["voice_emotion", "string", false, "Narration tone preset (paid plans)."],
        ],
        response: { started: true, total: 8 },
      }),
      ep("GET", "/api/projects/{project_id}/voice-change-status", "Get voice change status", "Also reports `delete-voiceover` progress.", {
        params: [PROJECT_ID],
        response: VOICE_JOB_STATUS,
      }),
      ep("POST", "/api/projects/{project_id}/delete-voiceover", "Delete all voiceovers", "Removes narration from every scene. Runs in the background; poll `voice-change-status`.", {
        params: [PROJECT_ID],
        response: { started: true, total: 8 },
      }),
      ep("POST", "/api/projects/{project_id}/scenes/{scene_id}/voiceover", "Upload a scene voiceover", "Replaces one scene's narration (MP3, WAV or M4A). The scene duration follows the audio.", {
        params: [PROJECT_ID, SCENE_ID],
        contentType: MULTIPART,
        body: [["audio", "file", true, "The recording."]],
        response: { ...SCENE, duration_seconds: 9.1 },
      }),
      ep("POST", "/api/projects/{project_id}/change-language", "Translate a project", "Translates all text and re-records voiceovers. Runs in the background; poll `language-change-status`.", {
        params: [PROJECT_ID],
        body: [["content_language", "string", true, "ISO code (`es`) or name (`Spanish`)."]],
        response: { started: true, total: 16, content_language: "es" },
      }),
      ep("GET", "/api/projects/{project_id}/language-change-status", "Get translation status", "", {
        params: [PROJECT_ID],
        response: {
          active: true,
          done: false,
          error: null,
          total: 16,
          completed: 9,
          progress: 56,
          phase: "voiceovers",
          status: "language_regenerating",
          r2_video_url: null,
          kind: "language_change",
          content_language: "es",
        },
      }),
      ep("POST", "/api/voice/preview", "Preview a voice", "Returns an MP3 sample.", {
        body: [
          ["voice_gender", "string", false, "`female` or `male`."],
          ["voice_accent", "string", false, "`american` or `british`."],
          ["custom_voice_id", "string", false, "A saved voice id."],
          ["voice_emotion", "string", false, "Tone preset."],
          ["video_style", "string", false, "Style used to pick the sample line."],
        ],
        response: null,
        responseNote: "Binary MP3 (`audio/mpeg`).",
      }),
      ep("GET", "/api/voices/saved", "List saved voices", "Voices usable as `custom_voice_id`. Built-in voices: `GET /api/voices` (no authentication).", {
        response: [SAVED_VOICE],
      }),
      ep("POST", "/api/voices/saved", "Save a voice", "", {
        body: [
          ["voice_id", "string", true, "ElevenLabs voice id."],
          ["name", "string", true, "Display name."],
          ["source", "string", false, "`prebuilt` or `custom`."],
          ["preview_url", "string", false, "Sample audio URL."],
          ["gender", "string", false, "Voice gender."],
          ["accent", "string", false, "Voice accent."],
          ["description", "string", false, "Short description."],
          ["plan", "string", false, "`free` or `paid`."],
          ["custom_voice_id", "integer", false, "Custom voice to link."],
        ],
        response: SAVED_VOICE,
      }),
      ep("DELETE", "/api/voices/saved/{voice_id}", "Remove a saved voice", "", {
        params: [["voice_id", "path", "string", true, "The saved voice's `voice_id`."]],
        response: { ok: true },
      }),
      ep("POST", "/api/voices/design-from-prompt", "Design a voice from a prompt", "Returns voice previews. Register the chosen one with `POST /api/voices/custom`. Limited to 40 designs per day.", {
        body: [["prompt", "string", true, "Voice description, 20–1000 characters."]],
        response: {
          previews: [
            {
              generated_voice_id: "gvx_8Hq2…",
              audio_base_64: "…",
              media_type: "audio/mpeg",
              duration_secs: 6.1,
            },
          ],
          text: "…",
        },
        errors: ["429: daily voice design limit reached."],
      }),
      ep("POST", "/api/voices/design-from-preset", "Design a voice from options", "Returns voice previews. Register the chosen one with `POST /api/voices/custom`. Limited to 40 designs per day.", {
        body: [
          ["gender", "string", false, "e.g. `male`."],
          ["age", "string", false, "e.g. `middle-aged`."],
          ["persona", "string", false, "e.g. `documentary narrator`."],
          ["speed", "string", false, "e.g. `calm`."],
          ["accent", "string", false, "e.g. `United States`."],
        ],
        response: {
          previews: [
            {
              generated_voice_id: "gvx_3Lp9…",
              audio_base_64: "…",
              media_type: "audio/mpeg",
              duration_secs: 5.4,
            },
          ],
          text: "…",
        },
        errors: ["429: daily voice design limit reached."],
      }),
      ep("GET", "/api/voices/custom", "List custom voices", "Only your own custom voices, newest first.", { response: [CUSTOM_VOICE] }),
      ep("POST", "/api/voices/custom", "Register a designed voice", "Stores a voice created with the voice design endpoints.", {
        body: [
          ["voice_id", "string", true, "The generated voice id."],
          ["source", "string", true, "`prompt` or `preset`."],
          ["name", "string", false, "Voice name."],
          ["prompt_text", "string", false, "The prompt the voice was designed from."],
          ["preview_url", "string", false, "Sample audio URL."],
        ],
        response: CUSTOM_VOICE,
      }),
      ep("POST", "/api/voices/clone", "Clone a voice from a recording", "Requires 30 seconds to several minutes of clean speech. Paid plans only.", {
        contentType: MULTIPART,
        body: [
          ["name", "string", true, "Voice name."],
          ["file", "file", true, "The recording."],
          ["remove_background_noise", "string", false, "`true` (default) or `false`."],
        ],
        response: CUSTOM_VOICE,
      }),
      ep("GET", "/api/voices/custom/{custom_voice_id}/preview", "Get a custom voice preview", "", {
        params: [["custom_voice_id", "path", "integer", true, "The custom voice's id."]],
        response: { preview_url: "https://…/preview.mp3", ready: true },
      }),
      ep("DELETE", "/api/voices/custom/{custom_voice_id}", "Delete a custom voice", "", {
        params: [["custom_voice_id", "path", "integer", true, "The custom voice's id."]],
        response: { ok: true },
      }),
    ],
  },
  {
    id: "templates",
    title: "Templates, styles & music",
    description: "Select templates, video styles and background music.",
    endpoints: [
      ep("POST", "/api/projects/{project_id}/change-template-regenerate-layouts", "Switch template", "Moves the project to another template and rebuilds all layouts. Uses one video. Runs in the background.", {
        params: [PROJECT_ID],
        body: [["template", "string", true, "Built-in, custom or crafted template id."]],
        response: {
          id: 55,
          project_id: 812,
          user_id: 41,
          target_template: "nightfall",
          status: "queued",
          total_scenes: 8,
          processed_scenes: 0,
          error_message: null,
        },
      }),
      ep("GET", "/api/projects/{project_id}/template-change-status", "Get template switch status", "", {
        params: [PROJECT_ID],
        response: {
          id: 55,
          project_id: 812,
          target_template: "nightfall",
          status: "running",
          total_scenes: 8,
          processed_scenes: 5,
          error_message: null,
        },
        responseNote: "`status`: `queued`, `running`, `completed`, `failed`. `null` when no job has run.",
      }),
      ep("GET", "/api/custom-templates", "List custom templates", "Apply one with `template: \"custom_<id>\"`. Built-in templates: `GET /api/templates` (no authentication).", {
        response: [CUSTOM_TEMPLATE],
      }),
      ep("GET", "/api/custom-templates/{template_id}", "Get a custom template", "", {
        params: [CUSTOM_TEMPLATE_ID],
        response: CUSTOM_TEMPLATE,
      }),
      ep("GET", "/api/crafted-templates", "List crafted templates", "Designer templates available to the account.", {
        response: [
          {
            id: "crafted_orbit",
            name: "Orbit",
            description: "Bold geometric",
            genres: ["tech"],
            preview_colors: { accent: "#22D3EE", bg: "#0F172A", text: "#F8FAFC" },
          },
        ],
      }),
      ep("GET", "/api/crafted-templates/{template_id}", "Get a crafted template", "", {
        params: [["template_id", "path", "string", true, "Crafted template id."]],
        response: {
          id: "crafted_orbit",
          name: "Orbit",
          description: "Bold geometric",
          genres: ["tech"],
          preview_colors: { accent: "#22D3EE" },
          hero_layout: "hero",
          fallback_layout: "bullets",
          valid_layouts: ["hero", "bullets", "stat"],
        },
      }),
      ep("GET", "/api/video-styles", "List video styles", "Styles usable as `video_style`, with the current selection.", {
        response: {
          styles: [
            { id: "explainer", name: "Explainer", description: "Teach one idea clearly", kind: "builtin" },
          ],
          selected_ids: ["explainer", "storytelling"],
          auto_style: { id: "auto", name: "Auto", description: "Pick the best style for the content" },
          max_selected: 4,
          min_selected: 1,
        },
      }),
      ep("PUT", "/api/video-styles/selection", "Set selected styles", "", {
        body: [["style_ids", "string[]", true, "Style ids to show in pickers."]],
        response: { selected_ids: ["explainer", "promotional"], max_selected: 4, min_selected: 1 },
      }),
      ep("GET", "/api/background-music/tracks", "List background music", "Use `track_id` as `bgm_track_id`.", {
        response: [
          {
            track_id: "corporate_upbeat",
            display_name: "Corporate Upbeat",
            mood: "Motivational",
            r2_url: "https://media.blog2video.app/bgm/corporate_upbeat.mp3",
          },
        ],
      }),
    ],
  },
  {
    id: "custom-templates",
    title: "Custom templates",
    description: "Create and edit custom templates. Creation uses a template slot; AI edits use AI-edit credits.",
    endpoints: [
      ep("POST", "/api/custom-templates/extract-theme", "Extract a theme from a website", "Returns colors, fonts, logos and a screenshot for `POST /api/custom-templates`.", {
        body: [["url", "string", true, "Website to read."]],
        response: {
          extractable: true,
          reason: "",
          theme: CUSTOM_TEMPLATE.theme,
          template_name: "Acme",
          logo_urls: ["https://acme.com/logo.svg"],
          og_image: "https://acme.com/og.png",
          screenshot_url: "https://media.blog2video.app/…/acme.png",
        },
        errors: ["Returns `extractable: false` with a `reason` if the site cannot be read."],
      }),
      ep("POST", "/api/custom-templates/extract-theme-from-doc", "Extract a theme from a brand document", "Accepts PDF, DOCX, MD or TXT.", {
        contentType: MULTIPART,
        body: [["file", "file", true, "The document."], ["name", "string", true, "Template name."]],
        response: {
          extractable: true,
          reason: "",
          theme: CUSTOM_TEMPLATE.theme,
          template_name: "Acme",
          logo_urls: [],
          og_image: "",
          screenshot_url: "",
        },
      }),
      ep("POST", "/api/custom-templates/extract-theme-from-prompt", "Extract a theme from a prompt", "", {
        body: [
          ["prompt", "string", true, "Description of the desired look."],
          ["name", "string", false, "Template name."],
        ],
        response: {
          extractable: true,
          reason: "",
          theme: CUSTOM_TEMPLATE.theme,
          template_name: "Neon",
          logo_urls: [],
          og_image: "",
          screenshot_url: "",
        },
      }),
      ep("POST", "/api/custom-templates", "Create a custom template", "Uses one custom-template slot. Generate the scenes next with `generate-code`.", {
        body: [
          ["name", "string", true, "Template name."],
          ["theme", "object", true, "Theme from an extract endpoint, optionally edited."],
          ["source_url", "string", false, "Where the theme came from."],
          ["logo_urls", "string[]", false, "Logo candidates from the extract call."],
          ["og_image", "string", false, "Share image, from the extract call."],
          ["screenshot_url", "string", false, "Page screenshot, from the extract call."],
        ],
        response: CUSTOM_TEMPLATE,
        errors: ["403 `custom_template_limit`: no template slots remaining."],
      }),
      ep("PUT", "/api/custom-templates/{template_id}", "Update a custom template", "", {
        params: [CUSTOM_TEMPLATE_ID],
        body: [["name", "string", false, "New name."], ["theme", "object", false, "New theme."]],
        response: CUSTOM_TEMPLATE,
      }),
      ep("DELETE", "/api/custom-templates/{template_id}", "Delete a custom template", "", {
        params: [CUSTOM_TEMPLATE_ID, ["force", "query", "boolean", false, "Delete even if projects use it."]],
        response: { detail: "Custom template deleted" },
      }),
      ep("POST", "/api/custom-templates/{template_id}/generate-code", "Generate template scenes", "Runs in the background; poll `generation-status`.", {
        params: [CUSTOM_TEMPLATE_ID],
        status: 202,
        response: { detail: "Code generation started", template_id: 58 },
      }),
      ep("GET", "/api/custom-templates/{template_id}/generation-status", "Get generation status", "Poll until `status` is `complete` or `error`.", {
        params: [CUSTOM_TEMPLATE_ID],
        response: {
          status: "generating",
          step: "content",
          running: true,
          error: null,
          stage: "content",
          run_id: 311,
          scenes_done: 3,
          scenes_total: 7,
          scenes_total_final: true,
        },
      }),
      ep("POST", "/api/custom-templates/{template_id}/regenerate-code", "Regenerate template scenes", "Uses one custom-template slot. Poll `generation-status`.", {
        params: [CUSTOM_TEMPLATE_ID],
        status: 202,
        response: { detail: "Regeneration started", template_id: 58 },
      }),
      ep("POST", "/api/custom-templates/{template_id}/resume-generation", "Resume generation", "Continues a stalled run and keeps completed scenes.", {
        params: [CUSTOM_TEMPLATE_ID],
        status: 202,
        response: { detail: "Generation resumed", template_id: 58, run_id: 312 },
      }),
      ep("GET", "/api/custom-templates/{template_id}/code", "Get template code", "", {
        params: [CUSTOM_TEMPLATE_ID],
        response: {
          component_code: null,
          intro_code: "…",
          outro_code: "…",
          content_codes: ["…"],
          layout_prop_schemas: null,
          design_version: 2,
          image_modes: { content_0: "background" },
        },
      }),
      ep("POST", "/api/custom-templates/{template_id}/upload-logo", "Upload a logo", "", {
        params: [CUSTOM_TEMPLATE_ID],
        contentType: MULTIPART,
        body: [["file", "file", true, "PNG, JPG, SVG or WebP."]],
        response: { logo_url: "https://media.blog2video.app/…/logo.png", template: CUSTOM_TEMPLATE },
      }),
      ep("POST", "/api/custom-templates/{template_id}/scenes/{scene_key}/ai-edit", "Edit a scene with AI", "Saves the result as a draft. Uses AI-edit credits; poll `ai-edit/status`.", {
        params: [
          CUSTOM_TEMPLATE_ID,
          ["scene_key", "path", "string", true, "`intro`, `outro` or `content_<n>` (from 0)."],
        ],
        body: [
          ["prompt", "string", true, "What to change."],
          ["keep_geometry", "boolean", false, "Keep the layout, change styling only."],
          ["from_blueprint", "boolean", false, "Rebuild the scene from its original plan."],
        ],
        status: 202,
        response: { edit_id: "58:content_1:1727690000", template_id: 58, scene_key: "content_1" },
      }),
      ep("GET", "/api/custom-templates/{template_id}/scenes/{scene_key}/ai-edit/status", "Get scene edit status", "", {
        params: [
          CUSTOM_TEMPLATE_ID,
          ["scene_key", "path", "string", true, "Scene key."],
          ["edit_id", "query", "string", false, "From the edit call."],
        ],
        response: {
          status: "complete",
          step: "done",
          running: false,
          error: null,
          draft_version_id: 902,
          edit_id: "58:content_1:1727690000",
        },
      }),
      ep("GET", "/api/custom-templates/{template_id}/scene-drafts", "List pending drafts", "", {
        params: [CUSTOM_TEMPLATE_ID],
        response: { drafts: ["content_1"], running: [] },
      }),
      ep("GET", "/api/custom-templates/{template_id}/scenes/{scene_key}/draft", "Get a scene draft", "", {
        params: [CUSTOM_TEMPLATE_ID, ["scene_key", "path", "string", true, "Scene key."]],
        response: {
          version_id: 902,
          scene_key: "content_1",
          label: "AI edit",
          code: "…",
          aspect_ratio: "landscape",
        },
      }),
      ep("POST", "/api/custom-templates/{template_id}/scenes/{scene_key}/draft/apply", "Apply a scene draft", "Saves a restorable version before applying.", {
        params: [CUSTOM_TEMPLATE_ID, ["scene_key", "path", "string", true, "Scene key."]],
        response: CUSTOM_TEMPLATE,
      }),
      ep("POST", "/api/custom-templates/{template_id}/scenes/{scene_key}/draft/discard", "Discard a scene draft", "", {
        params: [CUSTOM_TEMPLATE_ID, ["scene_key", "path", "string", true, "Scene key."]],
        response: { detail: "Draft discarded" },
      }),
      ep("PATCH", "/api/custom-templates/{template_id}/scenes/{scene_key}/chart", "Set chart sample data", "", {
        params: [CUSTOM_TEMPLATE_ID, ["scene_key", "path", "string", true, "Scene key."]],
        body: [
          ["chartType", "string", false, "e.g. `bar`, `line`, `pie`."],
          ["chartTable", "object", false, "Sample data table."],
        ],
        response: CUSTOM_TEMPLATE,
      }),
      ep("PATCH", "/api/custom-templates/{template_id}/scenes/{scene_key}/font-defaults", "Set scene text sizes", "", {
        params: [CUSTOM_TEMPLATE_ID, ["scene_key", "path", "string", true, "Scene key."]],
        body: [
          ["title", "object", false, "Title size per orientation, e.g. `{\"landscape\": 72, \"portrait\": 56}`. Omitted keys stay as they are."],
          ["description", "object", false, "Body text size per orientation, same shape."],
        ],
        response: CUSTOM_TEMPLATE,
      }),
      ep("PATCH", "/api/custom-templates/{template_id}/scenes/font-defaults", "Set text sizes for multiple scenes", "", {
        params: [CUSTOM_TEMPLATE_ID],
        body: [["scenes", "object", true, "Scene key → `{title?, description?}`."]],
        response: CUSTOM_TEMPLATE,
      }),
      ep("GET", "/api/custom-templates/{template_id}/versions", "List versions", "", {
        params: [CUSTOM_TEMPLATE_ID],
        response: {
          current_version_id: 904,
          versions: [{ id: 904, label: "Applied AI edit", created_at: "2026-09-30T11:02:10" }],
        },
      }),
      ep("POST", "/api/custom-templates/{template_id}/versions/{version_id}/rollback", "Restore a version", "", {
        params: [CUSTOM_TEMPLATE_ID, ["version_id", "path", "integer", true, "From `versions`."]],
        response: CUSTOM_TEMPLATE,
      }),
      ep("POST", "/api/custom-templates/{template_id}/rating", "Rate a template", "", {
        params: [CUSTOM_TEMPLATE_ID],
        body: [
          ["rating", "integer", true, "1 to 5."],
          ["suggestion", "string", false, "What would make it better."],
        ],
        response: {
          id: 7,
          user_id: 41,
          custom_template_id: 58,
          rating: 5,
          suggestion: null,
          created_at: "2026-09-30T11:05:00",
          updated_at: "2026-09-30T11:05:00",
        },
      }),
    ],
  },
  {
    id: "video-styles",
    title: "Video styles",
    description: "Manage the writing styles applied to scripts. Pass a style `id` as `video_style`.",
    endpoints: [
      ep("POST", "/api/video-styles/ai-draft", "Draft a style with AI", "Returns a name and guidance for `POST /api/video-styles/custom`.", {
        body: [["prompt", "string", true, "Describe the style."]],
        response: { name: "Dev Punchy", guidance: "Open with a bold claim. Keep sentences under 12 words…" },
      }),
      ep("POST", "/api/video-styles/custom", "Create a custom style", "", {
        body: [
          ["name", "string", true, "Style name."],
          ["guidance", "string", true, "Instructions for the scriptwriter."],
          ["creation_method", "string", false, "`manual` or `ai`."],
          ["source_prompt", "string", false, "The prompt used for an AI draft."],
        ],
        response: {
          id: "custom:12",
          custom_id: 12,
          name: "Dev Punchy",
          description: "Open with a bold claim…",
          guidance: "Open with a bold claim…",
          kind: "custom",
          editable: true,
          creation_method: "ai",
          source_prompt: "Punchy, witty…",
          version: 1,
          created_at: "2026-09-30T10:00:00",
          updated_at: "2026-09-30T10:00:00",
          pinned: false,
          selected_ids: ["explainer", "custom:12"],
        },
      }),
      ep("PATCH", "/api/video-styles/custom/{style_id}", "Edit a custom style", "", {
        params: [["style_id", "path", "integer", true, "The style's `custom_id`."]],
        body: [
          ["name", "string", true, "Style name."],
          ["guidance", "string", true, "Instructions."],
          ["version", "integer", false, "Version being edited; used to detect conflicts."],
        ],
        response: {
          id: "custom:12",
          custom_id: 12,
          name: "Dev Punchy",
          guidance: "Open with a question…",
          kind: "custom",
          version: 2,
        },
      }),
      ep("DELETE", "/api/video-styles/custom/{style_id}", "Delete a custom style", "", {
        params: [["style_id", "path", "integer", true, "The style's `custom_id`."]],
        response: { ok: true, selected_ids: ["explainer"] },
      }),
      ep("PATCH", "/api/video-styles/builtin/{style_key}", "Customize a built-in style", "", {
        params: [["style_key", "path", "string", true, "`explainer`, `promotional` or `storytelling`."]],
        body: [
          ["guidance", "string", true, "Replacement guidance."],
          ["version", "integer", true, "Current version."],
        ],
        response: {
          id: "explainer",
          name: "Explainer",
          description: "Teach one idea clearly",
          guidance: "Explain with one analogy per scene…",
          kind: "builtin",
          editable: true,
          available: true,
          customized: true,
          version: 1,
          default_guidance: "…",
          updated_at: "2026-09-30T10:00:00",
          pinned: false,
        },
      }),
      ep("DELETE", "/api/video-styles/builtin/{style_key}", "Reset a built-in style", "", {
        params: [["style_key", "path", "string", true, "Built-in style key."]],
        response: {
          id: "explainer",
          name: "Explainer",
          kind: "builtin",
          customized: false,
          guidance: "…",
          version: 0,
        },
      }),
      ep("PUT", "/api/video-styles/pin", "Set the learning target", "Script edits are learned into the pinned style.", {
        body: [["target_ref", "string", true, "`your_style`, a built-in key, or `custom:<id>`."]],
        response: { pinned_target: "custom:12" },
      }),
      ep("PATCH", "/api/video-styles/your-style", "Edit Your Style", "", {
        body: [
          ["guidance", "string", true, "The learned guidance, edited."],
          ["version", "integer", true, "Current version."],
        ],
        response: {
          guidance: "Prefers short intros and concrete numbers…",
          version: 4,
          updated_at: "2026-09-30T10:00:00",
        },
        errors: ["409: modified since last read; fetch and retry."],
      }),
      ep("DELETE", "/api/video-styles/your-style", "Clear Your Style", "Erases the learned profile.", {
        response: { ok: true, selected_ids: ["explainer"] },
      }),
    ],
  },
  {
    id: "downloads",
    title: "Downloads",
    description: "Download project source files and free templates.",
    endpoints: [
      ep("GET", "/api/projects/{project_id}/download-studio", "Download the Remotion project", "Editable Remotion source as a zip. Requires a paid plan or a Studio purchase.", {
        params: [PROJECT_ID],
        responseNote: "A `.zip` file (`application/zip`).",
      }),
      ep("GET", "/api/templates/free-download/{slug}", "Download a free template", "", {
        params: [["slug", "path", "string", true, "Template slug from the free templates gallery."]],
        responseNote: "A `.zip` file (`application/zip`).",
      }),
      ep("GET", "/api/templates/free-download-all", "Download all free templates", "", {
        responseNote: "A `.zip` file (`application/zip`).",
      }),
    ],
  },
  {
    id: "avatars",
    title: "Avatars",
    description: "Add presenter avatars to scenes. Each scene uses 10 AI-edit credits.",
    endpoints: [
      ep("POST", "/api/projects/{project_id}/avatar-batch/authorize", "Generate avatars for multiple scenes", "Charges credits for 5–10 scenes (or all remaining) and queues them.", {
        params: [PROJECT_ID],
        body: [
          ["scene_ids", "integer[]", true, "Scenes to add the presenter to."],
          ["avatar_preset", "string", false, "Presenter id."],
          ["avatar_motion_style", "string", false, "`subtle`, `natural` or `expressive`."],
        ],
        response: {
          authorized: true,
          scene_ids: [5012, 5013, 5014, 5015, 5016],
          job_ids: [301, 302, 303, 304, 305],
          credits_charged: 50,
          credits_remaining: 4820,
        },
      }),
      ep("GET", "/api/projects/{project_id}/avatar-progress", "Get avatar batch progress", "", {
        params: [PROJECT_ID],
        response: {
          scenes: [{ scene_id: 5012, status: "completed" }],
          counts: { completed: 3, running: 1, queued: 1, failed: 0 },
          total: 5,
          batch_status: "running",
          eligible_total: 8,
        },
      }),
      ep("POST", "/api/projects/{project_id}/scenes/{scene_id}/avatar", "Generate a scene avatar", "", {
        params: [PROJECT_ID, SCENE_ID],
        contentType: FORM,
        body: [["avatar_preset", "string", false, "Presenter id."]],
        response: { started: true, queued: true, job_id: 306, avatar_preset: "maya", queue_position: 2 },
      }),
      ep("GET", "/api/projects/{project_id}/scenes/{scene_id}/avatar-status", "Get scene avatar status", "", {
        params: [PROJECT_ID, SCENE_ID],
        response: {
          active: false,
          done: true,
          error: null,
          status: "completed",
          phase: null,
          kind: "avatar",
          has_avatar: true,
          has_matte: false,
          duration_seconds: 7.4,
        },
      }),
      ep("DELETE", "/api/projects/{project_id}/scenes/{scene_id}/avatar", "Remove a scene's avatar", "", {
        params: [PROJECT_ID, SCENE_ID],
        response: SCENE,
      }),
      ep("POST", "/api/projects/{project_id}/scenes/{scene_id}/avatar-matte", "Remove an avatar background", "Required before placing the avatar on a custom background.", {
        params: [PROJECT_ID, SCENE_ID],
        response: { started: true, queued: true, job_id: 410 },
      }),
      ep("POST", "/api/projects/{project_id}/avatar-matte-all", "Remove all avatar backgrounds", "", {
        params: [PROJECT_ID],
        response: { started: 5, queued: true, job_ids: [410, 411, 412, 413, 414] },
      }),
      ep("POST", "/api/projects/{project_id}/avatar-retry-failed", "Retry failed avatars", "", {
        params: [PROJECT_ID],
        response: {
          retried: 1,
          jobs: [{ scene_id: 5014, job_id: 320 }],
          skipped_exhausted: [],
          blocked_refunded: [],
        },
      }),
      ep("PATCH", "/api/projects/{project_id}/scenes/{scene_id}/avatar-appearance", "Set scene avatar appearance", "Per-scene overrides; `null` restores the project setting.", {
        params: [PROJECT_ID, SCENE_ID],
        body: [
          ["avatar_shape", "string", false, "`circle`, `rounded` or `square`."],
          ["avatar_size", "number", false, "Fraction of the video width."],
          ["avatar_position", "string", false, "Corner or edge placement, e.g. `bottom_left`."],
          ["avatar_bg", "string", false, "`transparent` or a hex color."],
          ["avatar_opacity", "number", false, "0.2 to 1."],
          ["avatar_shadow", "number", false, "0 to 1."],
        ],
        response: SCENE,
      }),
      ep("PATCH", "/api/projects/{project_id}/scenes/{scene_id}/avatar-focus", "Set scene avatar framing", "", {
        params: [PROJECT_ID, SCENE_ID],
        body: [
          ["avatar_focus_x", "number", false, "Horizontal focal point, 0 to 100 percent."],
          ["avatar_focus_y", "number", false, "Vertical focal point, 0 to 100 percent."],
          ["avatar_zoom", "number", false, "0.5 to 4."],
        ],
        response: SCENE,
      }),
      ep("POST", "/api/projects/{project_id}/avatar-portrait", "Upload a presenter photo", "", {
        params: [PROJECT_ID],
        contentType: MULTIPART,
        body: [["file", "file", true, "A clear, front-facing portrait."]],
        response: { ok: true, avatar_custom_image_url: "https://…/portrait.png", has_custom_portrait: true },
      }),
      ep("DELETE", "/api/projects/{project_id}/avatar-portrait", "Remove the presenter photo", "", {
        params: [PROJECT_ID],
        response: { ok: true, has_custom_portrait: false },
      }),
    ],
  },
  {
    id: "render",
    title: "Render, download & preview",
    description: "Render MP4 files and create live preview links.",
    endpoints: [
      ep("POST", "/api/projects/{project_id}/render", "Render the video", "Starts an MP4 render. Does not use additional videos.", {
        params: [
          PROJECT_ID,
          [
            "resolution",
            "query",
            "string",
            false,
            "`1080p` (default) or `720p`. Some templates always render at 720p.",
          ],
          [
            "force_render",
            "query",
            "boolean",
            false,
            "`true` to re-render a video that was already rendered.",
          ],
        ],
        response: { detail: "Render started", progress: 0, resolution: "1080p", render_run_id: "r_8f2c" },
        responseNote: "May return `Already rendered` (with `r2_video_url`) or `Render already running`.",
      }),
      ep("GET", "/api/projects/{project_id}/render-status", "Get render status", "Poll until `done` is true; `error` is set on failure.", {
        params: [PROJECT_ID],
        response: {
          progress: 64,
          rendered_frames: 3840,
          total_frames: 6000,
          done: false,
          error: null,
          time_remaining: "1m 10s",
          eta_seconds: 70,
          progress_unknown: false,
          r2_video_url: null,
        },
      }),
      ep("POST", "/api/projects/{project_id}/cancel-render", "Cancel a render", "", {
        params: [PROJECT_ID],
        response: { detail: "Render cancelled", cancelled: true },
      }),
      ep("GET", "/api/projects/{project_id}/download-url", "Get the MP4 link", "", {
        params: [PROJECT_ID],
        response: { url: "https://media.blog2video.app/users/41/projects/812/video.mp4" },
      }),
      ep("GET", "/api/projects/{project_id}/download", "Download the MP4", "Streams the file or redirects to it.", {
        params: [PROJECT_ID],
        response: null,
        responseNote: "Binary `video/mp4`.",
      }),
      ep("GET", "/api/projects/{project_id}/render-still", "Render a frame", "", {
        params: [PROJECT_ID, ["frame", "query", "integer", true, "Frame number (30 frames per second)."]],
        response: null,
        responseNote: "Binary `image/png`.",
      }),
      ep("POST", "/api/projects/{project_id}/render-stills", "Render multiple frames", "Streams NDJSON, one line per frame with a base64 PNG.", {
        params: [PROJECT_ID],
        body: [["frames", "integer[]", true, "Frame numbers."]],
        response: null,
        responseNote: "`application/x-ndjson`: `{\"index\": 0, \"total\": 3, \"image\": \"data:image/png;base64,…\"}`, or `{\"error\": \"…\"}` for a failed frame.",
      }),
      ep("POST", "/api/embed/token/{project_id}", "Create a live preview link", "A public player link that updates when the project changes. Embed it in an iframe.", {
        params: [PROJECT_ID],
        response: { embed_token: "3f9a…c21", preview_url: "https://blog2video.app/embed/3f9a…c21" },
      }),
    ],
  },
  {
    id: "v1",
    title: "Simplified API (/api/v1)",
    description: "Manage videos after creating them (see Quick Video Creation).",
    endpoints: [
      ep("GET", "/api/v1/me", "Get account usage", "", {
        response: {
          type: "api_key",
          email: "you@company.com",
          plan: "pro",
          videos_used: 12,
          video_limit: 150,
          video_credits: 50,
          videos_remaining: 138,
          can_create_video: true,
        },
      }),
      ep("GET", "/api/v1/catalog", "Get catalog", "", {
        response: {
          templates: [{ id: "default", name: "Default", preview_url: "https://…/default.png" }],
          voices: [{ voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", preview_url: "https://…/rachel.mp3" }],
          video_styles: { styles: [{ id: "explainer", name: "Explainer" }], selected_ids: ["explainer"] },
        },
      }),
      ep("GET", "/api/v1/videos", "List videos", "", {
        params: [
          ["external_user_id", "query", "string", false, "Only videos tagged with this id."],
          ["limit", "query", "integer", false, "1 to 100. Default 20."],
          ["before_id", "query", "integer", false, "Cursor from `next_before_id`."],
        ],
        response: {
          items: [
            {
              video_id: 812,
              name: "How remote teams ship faster",
              status: "generated",
              video_url: null,
              external_user_id: "user-42",
              metadata: null,
              created_at: "2026-09-29T10:12:40",
            },
          ],
          next_before_id: null,
        },
      }),
      ep("PATCH", "/api/v1/videos/{video_id}", "Update video settings", "Send only the fields to change.", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        body: PROJECT_SETTINGS_FIELDS,
        response: PROJECT,
      }),
      ep("PATCH", "/api/v1/videos/{video_id}/scenes/{scene_id}", "Edit a scene", "Send only the fields to change.", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."], SCENE_ID],
        body: SCENE_FIELDS,
        response: SCENE,
      }),
      ep("DELETE", "/api/v1/videos/{video_id}/scenes/{scene_id}", "Delete a scene", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."], SCENE_ID],
        status: 204,
        response: null,
        responseNote: "No content.",
      }),
      ep("POST", "/api/v1/videos/{video_id}/scenes/reorder", "Reorder scenes", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        body: [["scene_orders", "array", true, "Every scene's `scene_id` with its new 1-based `order`."]],
        response: [SCENE],
      }),
      ep("POST", "/api/v1/videos/{video_id}/scenes/{scene_id}/regenerate", "Regenerate a scene", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."], SCENE_ID],
        body: [
          ["description", "string", false, "What the scene should show or say."],
          ["narration_text", "string", false, "New narration."],
          ["regenerate_voiceover", "boolean", false, "Re-record the voiceover."],
          ["layout", "string", false, "Force a layout."],
        ],
        response: SCENE,
      }),
      ep("POST", "/api/v1/videos/{video_id}/scenes", "Add a scene", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        body: [
          ["prompt", "string", true, "What the new scene should show or say."],
          ["position", "integer", false, "1-based slot to insert at. Appends when omitted."],
        ],
        status: 202,
        response: { id: 31, status: "queued", current_step: "queued", new_scene_id: null, position: 6 },
      }),
      ep("GET", "/api/v1/videos/{video_id}/scenes/add-status", "Get add-scene status", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        response: { id: 31, status: "completed", new_scene_id: 5020 },
      }),
      ep("POST", "/api/v1/videos/{video_id}/template", "Switch template", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        body: [["template", "string", true, "Built-in, custom or crafted template ID."]],
        status: 202,
        response: { id: 55, status: "queued", target_template: "nightfall" },
      }),
      ep("GET", "/api/v1/videos/{video_id}/template", "Get template switch status", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        response: { id: 55, status: "completed" },
      }),
      ep("POST", "/api/v1/videos/{video_id}/voice", "Change the voice", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        body: [
          ["voice_gender", "string", false, "`female` or `male`."],
          ["voice_accent", "string", false, "`american` or `british`."],
          ["custom_voice_id", "string", false, "A saved voice ID; overrides gender and accent."],
          ["voice_emotion", "string", false, "Narration tone preset (paid plans)."],
        ],
        status: 202,
        response: { started: true, total: 8 },
      }),
      ep("GET", "/api/v1/videos/{video_id}/voice", "Get voice change status", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        response: VOICE_JOB_STATUS,
      }),
      ep("POST", "/api/v1/videos/{video_id}/language", "Translate a video", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        body: [["content_language", "string", true, "ISO code (`es`) or name (`Spanish`)."]],
        status: 202,
        response: { started: true, total: 16, content_language: "es" },
      }),
      ep("GET", "/api/v1/videos/{video_id}/language", "Get translation status", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        response: {
          active: false,
          done: true,
          progress: 100,
          kind: "language_change",
          content_language: "es",
        },
      }),
      ep("POST", "/api/v1/videos/{video_id}/stock-footage/approve", "Approve stock clips", "", {
        params: [["video_id", "path", "integer", true, "Video ID returned on creation."]],
        response: { detail: "Approved", status: "generated" },
      }),
    ],
  },
];


export const apiDocs: ApiDocs = { guides: GUIDES, sections: SECTIONS };
