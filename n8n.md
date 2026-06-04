# Blog2Video × n8n

Use the Blog2Video **MCP server** from inside n8n to turn a blog URL into a finished, previewable
video. This page has two complete, copy-pasteable examples.

**MCP endpoint:** `https://footrest-dweeb-silt.ngrok-free.dev/mcp/sse` (HTTP Streamable transport).
This forwards (via ngrok) to the FastAPI backend on `http://localhost:8000`.

**Auth (every example):** every MCP call must send `Authorization: Bearer <JWT>` (or `?token=<JWT>` on
the URL). Without it the server returns 401 and the tool list is empty.

**Common prerequisites**
- Backend running (uvicorn on `:8000`) and ngrok pinned to the domain above.
- A valid Blog2Video **JWT**.
- An **OpenAI** or **Anthropic** API key (for the agent's Chat Model).

---

## Tools

The MCP server exposes the tools below. In n8n, list them in the **MCP Client Tool** node (Tools to
Include → `Selected`) and let the AI Agent call them, or call a single tool directly with the community
`n8n-nodes-mcp` **Execute Tool** node.

> **Pick the right tools for n8n.** Long-running tools (`create_video`, `render_video`, `generate_video`,
> `change_template`, `start_template_code_generation`) **block and poll internally** until done — so you do
> **not** need the matching `check_*` tools in n8n; just give the agent a long **Timeout (600000)**. The
> three *widget* tools (`setup_video`, `list_templates`, `list_voices`) render clickable galleries meant
> for claude.ai and **don't work in n8n** — use `get_templates_json` / `get_voices_json` instead.

### Pipeline — make / preview / render (the core n8n tools)

- **`create_video`** — one call that creates a project from a blog URL **and** generates it
  (scrape → script → scenes), blocking ~1–5 min. Bypasses the gallery widgets.
  Inputs: **`blog_url`** (required, http/https); optional `template` (id, default `default`),
  `custom_voice_id`, `voice_gender` (`male`/`female`), `voice_accent` (`american`/`british`),
  `video_style`, `video_length`, `aspect_ratio` (`landscape`/`portrait`), `playback_speed`,
  `accent_color`, `name`, and `render` (bool — also produce the MP4 before returning).
  Returns the created project (id, template, voice, scene count).

- **`get_preview_url`** — mint/reuse a shareable `/preview/<token>` watch link.
  Inputs: **`project_id`**. Returns the preview URL.

- **`render_video`** — render the project to a downloadable MP4, blocking ~3–8 min.
  Inputs: **`project_id`**; optional `force_rerender` (re-render even if one exists). Returns the MP4 URL.

- **`generate_video`** — start + poll generation for an existing project (use only if you made the project
  with `create_project` rather than `create_video`). Inputs: **`project_id`**.

- **`check_generation_status`** / **`check_render_status`** — one-shot status for a project. Inputs:
  **`project_id`**. *Not needed after the blocking tools above — only for ad-hoc "what's the status?" checks.*

### Data — read tools (great with the Execute Tool node)

- **`get_templates_json`** — plain JSON `[{ id, name, genres }]` of all built-in templates. No inputs.
  Use to populate a template dropdown.
- **`get_voices_json`** — plain JSON `[{ voice_id, name, description }]` of available voices. No inputs.
  Use to populate a voice dropdown; pass the chosen `voice_id` as `custom_voice_id`.
- **`list_projects`** — the user's projects as a compact table. No inputs.
- **`get_project`** — full details for one project (header + scenes). Inputs: **`project_id`**.
- **`list_custom_templates`** / **`get_custom_template`** — list / fetch the user's custom templates
  (the latter takes **`template_id`**).

### Project creation (advanced)

- **`create_project`** — create a project from a blog URL **without** generating (you call `generate_video`
  next). In claude.ai this is gated behind the template/voice galleries; in n8n prefer `create_video`,
  which skips the gate. Inputs: **`blog_url`** + the same template/voice/style options as `create_video`.

### Editing a generated project

- **`update_scene`** — change fields on one scene. Inputs: **`project_id`**, **`scene_id`**, optional
  `narration_text`, `display_text`, `title`, `visual_description`. Returns a before/after diff.
- **`change_template`** — switch a project to a different template (regenerates every scene's layout,
  ~30s, async). Inputs: **`project_id`**, **`template`**. Poll **`check_template_change_status`**
  (**`project_id`**) until done.
- **`update_project_settings`** — change project-level settings; pass only what you want. Inputs:
  **`project_id`** + any of `voice_gender`, `voice_accent`, `playback_speed`, `video_length`,
  `font_family`, `content_language`, `video_style`, `accent_color`, `bg_color`, `text_color`, `aspect_ratio`.
- **`regenerate_scene`** — re-do one scene with fresh AI. Inputs: **`project_id`**, **`scene_id`**, optional
  `description`, `narration_text`, `layout`, `regenerate_voiceover`.
- **`reorder_scenes`** — Inputs: **`project_id`**, **`scene_ids`** (the FULL list in the new order).
- **`swap_scene_images`** — `mode='swap'` (`first_scene_id`+`second_scene_id`) or `mode='move'`
  (`from_scene_id`+`to_scene_id`). Inputs: **`project_id`** + the relevant scene ids.

### Custom-template creation flow (4 steps)

1. **`extract_template_theme`** — scrape a site and extract a brand theme (~10–20s). Inputs: **`url`**.
   Returns a theme card to review.
2. **`create_custom_template`** — persist the (edited) theme as a template. Inputs: **`name`**, **`theme`**
   (from step 1); optional `source_url`, `logo_urls`, `og_image`, `screenshot_url`, `reason`. Returns the
   new template id.
3. **`start_template_code_generation`** — generate the React/Remotion code (5–7 min, async, uses 1 daily
   credit). Inputs: **`template_id`**.
4. **`check_template_code_generation_status`** — poll until `complete`/`error`. Inputs: **`template_id`**.
   When ready, use `template="custom_<id>"` in `create_video` / `create_project`.

### Widget tools — claude.ai only, avoid in n8n

- **`setup_video`**, **`list_templates`**, **`list_voices`** — render interactive galleries for claude.ai.
  They have no clickable UI in n8n (`list_voices` returns no voice_ids at all). Use the `*_json` tools.

---

## Examples

- [Example 1 — Chat → preview URL](#example-1--chat--preview-url) (simplest)
- [Example 2 — Dynamic form: pick template + voice → preview → render](#example-2--dynamic-form--pick-template--voice--preview--render)

---

## Example 1 — Chat → preview URL

The user pastes a blog URL in chat; one AI Agent calls the MCP server and replies with the preview link.

```
[Chat Trigger] ──main──> [AI Agent] ──Tool──────> [MCP Client Tool]
                             └────Chat Model────> [Chat Model]
```

### Node 1 — Chat Trigger
- Add **Chat Trigger** ("When chat message received"). Connect its `main` output to the AI Agent.
- The user's chat message is the blog URL.

### Node 2 — AI Agent
- **Source for Prompt:** *Connected Chat Trigger Node* (the chat message becomes the prompt).
- **System Message:**
  ```
  You turn a blog URL into a finished video using the Blog2Video tools. When the user gives a URL:
  Call create_video with blog_url.
  Take the project id from its result and call get_preview_url with that project_id.
  Reply with ONLY the preview URL.
  Never call setup_video, create_project, list_templates, or list_voices — there is no clickable UI here.
  ```
- **Options → Max Iterations:** ~10 (room for both tool calls).

#### Node 2a — Chat Model (sub-node → Agent's **Chat Model** dot)
- Add **OpenAI Chat Model** or **Anthropic Chat Model**; set its API-key credential. **Required** — the
  agent won't run without it.

#### Node 2b — MCP Client Tool (sub-node → Agent's **Tool** dot)
- **Server Transport:** `HTTP Streamable`
- **URL:** `https://footrest-dweeb-silt.ngrok-free.dev/mcp/sse`
- **Authentication:** `Bearer Auth` → your JWT
- **Tools to Include:** `Selected` → `create_video`, `get_preview_url`
- **Options → Timeout:** `600000` (10 min — required; `create_video` runs for minutes and the default
  ~60s timeout throws `MCP error -32001`).

> Keep this on `Selected`. On `All`, the agent may call `setup_video` (the claude.ai widget tool), which
> returns *"Pick a template and a voice…"* — and the agent stalls forever, because there is no widget to
> click in n8n.

### Run
Send a blog URL in the chat. The agent runs `create_video` (1–5 min) then `get_preview_url`, and replies
with the `…/preview/<token>` link.

---

## Example 2 — Dynamic form: pick template + voice → preview → render

A multi-page form where the user **picks a template and a voice** (both fetched live from the MCP server),
gets a **preview link inside the form**, then chooses to **render an MP4**. One agent setup, used at two
stages.

### Extra prerequisites
1. **Two plain-JSON MCP tools must exist** (restart the backend so they list):
   - `get_templates_json` → `[{ id, name, genres }]`
   - `get_voices_json` → `[{ voice_id, name, description }]`

   These are needed because the *widget* tools (`list_templates` / `list_voices`) return chat/HTML, not
   data n8n can read — `list_voices` exposes **no voice_ids** at all.
2. **Community node `n8n-nodes-mcp`** installed (Settings → Community Nodes). The *built-in* MCP Client
   Tool is agent-only; the community node's **Execute Tool** runs standalone to feed a dropdown.
3. **Credentials:** one MCP credential for the community node (SSE/HTTP URL `…/mcp/sse` + header
   `Authorization: Bearer <JWT>`); Bearer JWT for the built-in MCP Client Tool nodes; an OpenAI/Anthropic
   credential for the Chat Models.

### Flow
```
[Form: Blog URL] →[Get Templates]→[Get Voices]→[Build Form]→[Form: Pick]→[Resolve]
   →[Agent: Create+Preview]→[Parse]→[Form: Preview]→[IF: Render?] ─┬ true →[Agent: Render]→[Done: Rendered]
                                                                   └ false→[Done: Preview only]
```
The **Chat Model**, **MCP Client Tool**, and **Structured Output Parser** are *sub-nodes* hanging off
each Agent's dots — not on the main line. Agent: Create+Preview and Agent: Render each need their **own**
sub-node instances.

### Node 1 — Form Trigger · `Form: Blog URL`
- Form Title `Blog2Video`. One field: **`Blog URL`** (type *Text*, required).
- (Template/Voice are dynamic → they live on page 2, not here.) `main` → Get Templates.

### Node 2 — MCP Client (community) · `Get Templates`
- Credential: MCP (community). **Operation:** `Execute Tool`; **Tool Name:** `get_templates_json`;
  **Parameters:** `{}`. `main` → Get Voices.

### Node 3 — MCP Client (community) · `Get Voices`
- Same credential. **Operation:** `Execute Tool`; **Tool Name:** `get_voices_json`; **Parameters:** `{}`.
  `main` → Build Form.

### Node 4 — Code · `Build Form` (JavaScript)
Parses each MCP tool's JSON output and builds the page-2 dropdown definitions + a voice **name→id** map.
`deepFindArray` digs through whatever shape the community node returns (and only `JSON.parse`s real
strings). `main` → Form: Pick.
```js
function deepFindArray(value, mustHaveKey) {
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    try { return deepFindArray(JSON.parse(s), mustHaveKey); } catch { return null; }
  }
  if (Array.isArray(value)) {
    if (value.some(el => el && typeof el === 'object' && mustHaveKey in el)) return value;
    for (const el of value) { const f = deepFindArray(el, mustHaveKey); if (f) return f; }
    return null;
  }
  if (value && typeof value === 'object') {
    if (mustHaveKey in value) return [value];
    for (const k of Object.keys(value)) { const f = deepFindArray(value[k], mustHaveKey); if (f) return f; }
  }
  return null;
}
function mcpRecords(nodeName, mustHaveKey) {
  let item;
  try { item = $(nodeName).first(); }
  catch (e) { throw new Error(`No node named "${nodeName}" — rename your MCP nodes to "Get Templates" and "Get Voices" (case-sensitive).`); }
  const found = deepFindArray(item.json, mustHaveKey);
  if (!found) throw new Error(`No "${mustHaveKey}" array in "${nodeName}". Raw: ${JSON.stringify(item.json).slice(0,600)}`);
  return found;
}

const tpls   = mcpRecords('Get Templates', 'id');
const voices = mcpRecords('Get Voices', 'voice_id');

const voiceMap = {};
voices.forEach(v => { voiceMap[v.name || v.voice_id] = v.voice_id; });

const formFields = [
  { fieldLabel: "Template", fieldType: "dropdown", requiredField: true,
    fieldOptions: { values: tpls.map(t => ({ option: t.id })) } },
  { fieldLabel: "Voice", fieldType: "dropdown", requiredField: true,
    fieldOptions: { values: voices.map(v => ({ option: v.name || v.voice_id })) } },
];
return [{ json: { formFields, voiceMap } }];
```

### Node 5 — n8n Form · `Form: Pick` (page 2)
- **Page Type:** `Next Form Page`. **Define Form:** `Using JSON`.
- **Form Fields (JSON):** switch this field to **Expression** mode (it defaults to Fixed, where `{{ }}`
  won't evaluate), then enter `{{ $json.formFields }}`. Renders the Template + Voice dropdowns at runtime.
- After submit: `{{ $json.Template }}` (a template id) and `{{ $json.Voice }}` (a voice name). `main` → Resolve.

### Node 6 — Edit Fields (Set) · `Resolve`
Converts the chosen voice **name** to its **voice_id** and passes the template through.
**Include Other Input Fields = ON.** Two fields (each Type String, **Expression** mode):
- `custom_voice_id` = `{{ ($('Build Form').first().json.voiceMap || {})[$json.Voice] || '' }}`
- `template` = `{{ $json.Template }}`

`main` → Agent: Create+Preview.

### Node 7 — AI Agent · `Agent: Create+Preview`
- **Source for Prompt:** *Define below* →
  ```
  blog_url: {{ $('Form: Blog URL').item.json["Blog URL"] }}
  template: {{ $json.template }}
  custom_voice_id: {{ $json.custom_voice_id }}
  ```
- **System Message:**
  ```
  You turn a blog URL into a previewable video using the Blog2Video MCP tools.
  You are given blog_url, template, and custom_voice_id.
  1. Call create_video with exactly those three arguments and render: false. Do not change them.
  2. Take the project id from the result and call get_preview_url with that project_id.
  3. Return the project id and the preview URL.
  Never call setup_video, create_project, list_templates, or list_voices.
  ```
- **Options → Max Iterations:** `10`. `main` → Parse.

#### Node 7a — Chat Model (sub-node → Agent's **Chat Model** dot)
- OpenAI/Anthropic + credential. Required.

#### Node 7b — MCP Client Tool (sub-node → Agent's **Tool** dot)
- HTTP Streamable, URL `…/mcp/sse`, Bearer JWT, Tools to Include = `Selected`: `create_video`,
  `get_preview_url`, **Timeout 600000**.

#### Node 7c — Structured Output Parser (sub-node → Agent's **Output Parser** dot)
Forces the agent's reply into a fixed shape (a system-prompt instruction alone is unreliable — the model
returns markdown tables). Turn ON **`Require Specific Output Format`** on the Agent (this reveals the
Output Parser dot), then add a Structured Output Parser with **Schema Type = Generate From JSON Example**:
```json
{ "project_id": 808, "preview_url": "http://localhost:5173/preview/abc123" }
```
With it attached, `output` becomes the object `{ project_id, preview_url }`.

### Node 8 — Edit Fields (Set) · `Parse`
Lifts the two fields into a clean item (each Expression mode):
- `project_id` (Number) = `{{ $json.output.project_id }}`
- `preview_url` (String) = `{{ $json.output.preview_url }}`

`main` → Form: Preview.

### Node 9 — n8n Form · `Form: Preview` (page 3)
- **Page Type:** `Next Form Page`. Form Title `Your preview is ready`.
- **Form Description:** `Watch it: {{ $json.preview_url }} — then choose whether to render an MP4 (3–8 min).`
- Field: **`Render to MP4?`** (Dropdown) → `Yes`, `No`. `main` → IF: Render?.

### Node 10 — IF · `Render?`
- Condition: `{{ $json["Render to MP4?"] }}` **equals** `Yes`.
- `true` → Agent: Render. `false` → Done: Preview only.

### Node 11 — AI Agent · `Agent: Render` (true branch)
- **Prompt** (*Define below*): `project_id: {{ $('Parse').item.json.project_id }}`
- **System Message:**
  ```
  You render an already-generated Blog2Video project to a downloadable MP4 using the MCP tools.
  You are given a project_id.
  1. Call render_video with that project_id.
  2. Reply with ONLY the https MP4 download URL, nothing else.
  Never call any other tool.
  ```
- `main` → Done: Rendered.
- **Node 11a — Chat Model** (sub-node → **Chat Model** dot): its own model + credential.
- **Node 11b — MCP Client Tool** (sub-node → **Tool** dot): Selected `render_video`; **Timeout 600000**.

### Node 12 — n8n Form · `Done: Rendered` (Form Ending, true branch)
- Completion text: `Done! Preview: {{ $('Parse').item.json.preview_url }} · Download: {{ $('Agent: Render').item.json.output }}`

### Node 13 — n8n Form · `Done: Preview only` (Form Ending, false branch)
- Completion text: `Your preview is ready: {{ $('Parse').item.json.preview_url }} (no MP4 rendered).`

### Important notes
- **Node names matter.** `$('Name')` matches by the node's *exact title* (case-sensitive). Rename nodes to
  `Build Form`, `Get Templates`, `Get Voices`, `Form: Blog URL`, `Parse`, etc., or expressions throw
  *"Referenced node doesn't exist"*.
- **Expression vs Fixed.** Any value field using `{{ }}` (the JSON form fields, the Set fields) must be in
  **Expression** mode, or it's treated as literal text.
- **Empty Set field?** A `[undefined]` result usually means the field name has a stray space / wrong case.
- **Form pages don't render in the editor** — test via the form's Production/Test URL.
- **Timeouts:** both MCP Client Tool nodes need **Timeout 600000**; also raise the workflow's
  *Settings → Timeout* (render is 3–8 min). ngrok-free can drop very long requests.
- **`preview_url = http://localhost:5173/...`** is the dev base — opens locally only. For a shareable link
  the backend's preview URL base must point at a public host.

### Run & verify
1. Restart backend; confirm the MCP nodes list `get_templates_json` + `get_voices_json`.
2. Execute `Get Templates`/`Get Voices`, then `Build Form` — confirm `formFields` (with options) + `voiceMap`.
3. Activate the workflow, open the form URL. Page 1: paste a blog URL → Next.
4. Page 2: Template + Voice dropdowns are populated **from MCP** → pick both → Submit.
5. Wait ~1–5 min → page 3 shows the **preview URL** + render choice. Open the link; the video plays.
6. **Yes** → wait ~3–8 min → final page shows the **MP4 download** link. **No** → preview link only.
