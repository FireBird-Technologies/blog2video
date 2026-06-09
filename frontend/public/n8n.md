# Blog2Video × n8n

Use the Blog2Video **MCP server** from inside n8n to turn a blog URL into a finished, previewable
video. This page has two complete, copy-pasteable examples.

**MCP endpoint:** `https://api.blog2video.app/mcp/sse` (HTTP Streamable transport).

**Auth (every example):** every MCP call must send `Authorization: Bearer <JWT>` (or `?token=<JWT>` on
the URL). Without it the server returns 401 and the tool list is empty. Get your JWT from the
**Connect to AI** page in Blog2Video → *Connect to n8n* → **Copy token**.

**Common prerequisites**
- A Blog2Video account and a valid **JWT** (copy it from the Connect to AI page).
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

**How to read every node below.** Each node is three steps, always in this order:

1. **Add** — what to type in n8n's **+** (node search) panel, and what to **rename** the node to
   (names matter — `$('Name')` expressions break if the name is wrong).
2. **Set fields** — each field, written as **Field → value to enter**.
3. **Wire** — which output connects to which node.

> **Sub-nodes vs the main line.** A **Chat Model**, **MCP Client Tool**, and **Structured Output Parser**
> are *sub-nodes*. You add them by clicking the small **+** on the matching connector **underneath the AI
> Agent node** (the "Chat Model", "Tool", and "Output Parser" dots) — not on the main canvas line. Each AI
> Agent needs its **own** sub-node instances.

---

## Example 1 — Chat → preview URL

The user pastes a blog URL in chat; one AI Agent calls the MCP server and replies with the preview link.
You add **4 things**: the Chat Trigger, the AI Agent, and the Agent's two sub-nodes.

```
[Chat Trigger] ──main──> [AI Agent] ──Tool──────> [MCP Client Tool]
                             └────Chat Model────> [Chat Model]
```

### Node 1 — Chat Trigger
1. **Add:** click **+**, search **"Chat Trigger"**, add **When chat message received**. (Keep the name.)
2. **Set fields:** none — the defaults are fine.
3. **Wire:** `When chat message received` ▸ output → `AI Agent` ▸ input.

The user's chat message (the blog URL) automatically becomes the agent's prompt.

### Node 2 — AI Agent
1. **Add:** click **+**, search **"AI Agent"**, add **AI Agent**.
2. **Set fields:**
   - **Source for Prompt (User Message)** → `Connected Chat Trigger Node`.
   - **Options → System Message** → paste:
     ```
     You turn a blog URL into a finished video using the Blog2Video tools. When the user gives a URL:
     Call create_video with blog_url.
     Take the project id from its result and call get_preview_url with that project_id.
     Reply with ONLY the preview URL.
     Never call setup_video, create_project, list_templates, or list_voices — there is no clickable UI here.
     ```
   - **Options → Max Iterations** → `10` (room for both tool calls).
3. **Wire:** nothing after it — the agent's reply goes back to the chat.

#### Node 2a — Chat Model (sub-node, on the Agent's **Chat Model** dot)
1. **Add:** under the AI Agent, click **+** on the **Chat Model** connector → search
   **"OpenAI Chat Model"** (or **"Anthropic Chat Model"**) → add it.
2. **Set fields:**
   - **Credential** → your OpenAI/Anthropic API key. *(Required — the agent won't run without it.)*
   - **Model** → any capable model, e.g. `gpt-4o` or `claude-sonnet-4`.

#### Node 2b — MCP Client Tool (sub-node, on the Agent's **Tool** dot)
1. **Add:** under the AI Agent, click **+** on the **Tool** connector → search **"MCP Client Tool"**
   (the built-in one) → add it.
2. **Set fields:**
   - **Server Transport / Connection Type** → `HTTP Streamable`.
   - **Endpoint URL** → `https://api.blog2video.app/mcp/sse`.
   - **Authentication** → `Bearer Auth`.
   - **Credential → Token** → paste your Blog2Video JWT.
   - **Tools to Include** → `Selected`, then tick **`create_video`** and **`get_preview_url`**.
   - **Options → Timeout** → `600000` *(10 min — required; `create_video` runs for minutes and the
     default ~60 s timeout throws `MCP error -32001`).*

> Keep **Tools to Include** on `Selected`. On `All`, the agent may call `setup_video` (a claude.ai widget
> tool) which replies *"Pick a template and a voice…"* and then stalls forever — there's no widget to click in n8n.

### Run it
Open the chat, paste a blog URL, send. The agent runs `create_video` (1–5 min) then `get_preview_url`,
and replies with the `…/preview/<token>` link.

---

## Example 2 — Dynamic form: pick template + voice → preview → render

A multi-page form where the user **picks a template and a voice** (both fetched live from the MCP server),
gets a **preview link inside the form**, then chooses to **render an MP4**.

### Before you start
1. **Two plain-JSON MCP tools** are used (they appear in the tool list automatically):
   - `get_templates_json` → `[{ id, name, genres }]`
   - `get_voices_json` → `[{ voice_id, name, description }]`

   These exist because the *widget* tools (`list_templates` / `list_voices`) return chat/HTML, not data n8n
   can read — `list_voices` exposes **no voice_ids** at all.
2. **Install the community node `n8n-nodes-mcp`** (Settings → Community Nodes → Install). The built-in MCP
   Client Tool is agent-only; this community node's **Execute Tool** runs standalone to fill a dropdown.
3. **Create these 3 credentials first** (Credentials → New):
   - **MCP (community)** → URL `https://api.blog2video.app/mcp/sse`; add a header **Name** `Authorization`,
     **Value** `Bearer <your JWT>`.
   - **Bearer Auth (JWT)** → for the built-in MCP Client Tool sub-nodes (same JWT).
   - **OpenAI** or **Anthropic** → API key for the Chat Models.

### The flow (13 nodes on the main line)
```
[Form: Blog URL] →[Get Templates]→[Get Voices]→[Build Form]→[Form: Pick]→[Resolve]
   →[Agent: Create+Preview]→[Parse]→[Form: Preview]→[IF: Render?] ─┬ true →[Agent: Render]→[Done: Rendered]
                                                                   └ false→[Done: Preview only]
```
> **Rename every node to the exact name shown** (case-sensitive). Expressions like `$('Parse')` look nodes
> up by name and throw *"Referenced node doesn't exist"* otherwise.

### Node 1 — Form Trigger → rename to `Form: Blog URL`
1. **Add:** **+** → search **"n8n Form"** → add **On form submission** (Form Trigger). Rename it to **`Form: Blog URL`**.
2. **Set fields:**
   - **Form Title** → `Blog2Video`.
   - **Form Elements** → add **one** element: **Field Label** `Blog URL`, **Element Type** `Text`, **Required** `ON`.
     *(Template/Voice are dynamic → they live on page 2, not here.)*
3. **Wire:** `Form: Blog URL` → `Get Templates`.

### Node 2 — MCP Client (community) → rename to `Get Templates`
1. **Add:** **+** → search **"MCP Client"** → add the **community** *MCP Client* node (from `n8n-nodes-mcp`).
   Rename it to **`Get Templates`**.
2. **Set fields:**
   - **Credential** → your **MCP (community)** credential.
   - **Operation** → `Execute Tool`.
   - **Tool Name** → `get_templates_json`.
   - **Parameters** → `{}`.
3. **Wire:** `Get Templates` → `Get Voices`.

### Node 3 — MCP Client (community) → rename to `Get Voices`
1. **Add:** same as Node 2 (the community *MCP Client*). Rename it to **`Get Voices`**.
2. **Set fields:**
   - **Credential** → the same **MCP (community)** credential.
   - **Operation** → `Execute Tool`.
   - **Tool Name** → `get_voices_json`.
   - **Parameters** → `{}`.
3. **Wire:** `Get Voices` → `Build Form`.

### Node 4 — Code → rename to `Build Form`
1. **Add:** **+** → search **"Code"** → add **Code**. Rename it to **`Build Form`**.
2. **Set fields:**
   - **Mode** → `Run Once for All Items`.
   - **Language** → `JavaScript`.
   - **JavaScript Code** → paste the block below. It reads the two MCP outputs, builds the page-2 dropdown
     definitions, and a voice **name→id** map (`deepFindArray` digs through whatever shape the community
     node returns, and only `JSON.parse`s real strings).
3. **Wire:** `Build Form` → `Form: Pick`.
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

### Node 5 — n8n Form → rename to `Form: Pick` (page 2)
1. **Add:** **+** → search **"n8n Form"** → add a **Form** node (a *next page* on the same form). Rename it to **`Form: Pick`**.
2. **Set fields:**
   - **Page Type** → `Next Form Page`.
   - **Define Form** → `Using JSON`.
   - **Form Fields (JSON)** → click the field's toggle to switch it from **Fixed** to **Expression**, then
     enter: `{{ $json.formFields }}` *(in Fixed mode the `{{ }}` won't evaluate).* This renders the
     Template + Voice dropdowns at runtime.
3. **Wire:** `Form: Pick` → `Resolve`.

After the user submits, this page outputs `{{ $json.Template }}` (a template id) and `{{ $json.Voice }}` (a voice name).

### Node 6 — Edit Fields (Set) → rename to `Resolve`
Turns the chosen voice **name** into its **voice_id**, and passes the template through.
1. **Add:** **+** → search **"Edit Fields"** → add **Edit Fields (Set)**. Rename it to **`Resolve`**.
2. **Set fields:**
   - **Mode** → `Manual Mapping`.
   - **Include Other Input Fields** → `ON`.
   - **Add field 1:** **Name** `custom_voice_id`, **Type** `String`, **Value** (Expression mode):
     `{{ ($('Build Form').first().json.voiceMap || {})[$json.Voice] || '' }}`
   - **Add field 2:** **Name** `template`, **Type** `String`, **Value** (Expression mode): `{{ $json.Template }}`
3. **Wire:** `Resolve` → `Agent: Create+Preview`.

### Node 7 — AI Agent → rename to `Agent: Create+Preview`
1. **Add:** **+** → search **"AI Agent"** → add **AI Agent**. Rename it to **`Agent: Create+Preview`**.
2. **Set fields:**
   - **Source for Prompt** → `Define below`.
   - **Prompt (User Message)** → switch to **Expression**, paste:
     ```
     blog_url: {{ $('Form: Blog URL').item.json["Blog URL"] }}
     template: {{ $json.template }}
     custom_voice_id: {{ $json.custom_voice_id }}
     ```
   - **Options → System Message** → paste:
     ```
     You turn a blog URL into a previewable video using the Blog2Video MCP tools.
     You are given blog_url, template, and custom_voice_id.
     1. Call create_video with exactly those three arguments and render: false. Do not change them.
     2. Take the project id from the result and call get_preview_url with that project_id.
     3. Return the project id and the preview URL.
     Never call setup_video, create_project, list_templates, or list_voices.
     ```
   - **Require Specific Output Format** → `ON` *(this reveals the **Output Parser** connector — see Node 7c).*
   - **Options → Max Iterations** → `10`.
3. **Wire:** `Agent: Create+Preview` → `Parse`.

#### Node 7a — Chat Model (sub-node, on the **Chat Model** dot)
1. **Add:** under the agent, **+** on the **Chat Model** connector → **OpenAI Chat Model** / **Anthropic Chat Model**.
2. **Set fields:** **Credential** → your key *(required)*; **Model** → any capable model.

#### Node 7b — MCP Client Tool (sub-node, on the **Tool** dot)
1. **Add:** under the agent, **+** on the **Tool** connector → **MCP Client Tool** (built-in).
2. **Set fields:**
   - **Server Transport** → `HTTP Streamable`.
   - **Endpoint URL** → `https://api.blog2video.app/mcp/sse`.
   - **Authentication** → `Bearer Auth` → your JWT.
   - **Tools to Include** → `Selected`, then tick **`create_video`** and **`get_preview_url`**.
   - **Options → Timeout** → `600000`.

#### Node 7c — Structured Output Parser (sub-node, on the **Output Parser** dot)
Forces the reply into a fixed shape (a system-prompt instruction alone is unreliable — the model otherwise returns markdown tables).
1. **Add:** under the agent, **+** on the **Output Parser** connector → **Structured Output Parser**.
2. **Set fields:**
   - **Schema Type** → `Generate From JSON Example`.
   - **JSON Example** → paste:
     ```json
     { "project_id": 808, "preview_url": "https://blog2video.app/preview/abc123" }
     ```
With it attached, the agent's `output` becomes the object `{ project_id, preview_url }`.

### Node 8 — Edit Fields (Set) → rename to `Parse`
Lifts the two fields out of `output` into a clean item.
1. **Add:** **+** → **Edit Fields (Set)**. Rename it to **`Parse`**.
2. **Set fields:**
   - **Mode** → `Manual Mapping`.
   - **Add field 1:** **Name** `project_id`, **Type** `Number`, **Value** (Expression): `{{ $json.output.project_id }}`
   - **Add field 2:** **Name** `preview_url`, **Type** `String`, **Value** (Expression): `{{ $json.output.preview_url }}`
3. **Wire:** `Parse` → `Form: Preview`.

### Node 9 — n8n Form → rename to `Form: Preview` (page 3)
1. **Add:** **+** → **n8n Form** (a next page). Rename it to **`Form: Preview`**.
2. **Set fields:**
   - **Page Type** → `Next Form Page`.
   - **Form Title** → `Your preview is ready`.
   - **Form Description** → switch to **Expression**, enter:
     `Watch it: {{ $json.preview_url }} — then choose whether to render an MP4 (3–8 min).`
   - **Form Elements** → add **one** element: **Field Label** `Render to MP4?`, **Element Type** `Dropdown`,
     **Options** `Yes` and `No`.
3. **Wire:** `Form: Preview` → `Render?`.

### Node 10 — IF → rename to `Render?`
1. **Add:** **+** → search **"IF"** → add **IF**. Rename it to **`Render?`**.
2. **Set fields:**
   - **Condition 1:** **Value 1** (Expression) `{{ $json["Render to MP4?"] }}`, **Operator** `is equal to`, **Value 2** `Yes`.
3. **Wire:** **true** → `Agent: Render`; **false** → `Done: Preview only`.

### Node 11 — AI Agent → rename to `Agent: Render` (true branch)
1. **Add:** **+** → **AI Agent**. Rename it to **`Agent: Render`**.
2. **Set fields:**
   - **Source for Prompt** → `Define below`.
   - **Prompt** → switch to **Expression**, enter: `project_id: {{ $('Parse').item.json.project_id }}`
   - **Options → System Message** → paste:
     ```
     You render an already-generated Blog2Video project to a downloadable MP4 using the MCP tools.
     You are given a project_id.
     1. Call render_video with that project_id.
     2. Reply with ONLY the https MP4 download URL, nothing else.
     Never call any other tool.
     ```
3. **Wire:** `Agent: Render` → `Done: Rendered`.

#### Node 11a — Chat Model (sub-node, on the **Chat Model** dot)
1. **Add:** under the agent, **+** on **Chat Model** → OpenAI/Anthropic Chat Model.
2. **Set fields:** its **own** **Credential** + **Model** (same as 7a).

#### Node 11b — MCP Client Tool (sub-node, on the **Tool** dot)
1. **Add:** under the agent, **+** on **Tool** → **MCP Client Tool** (built-in).
2. **Set fields:**
   - **Server Transport** → `HTTP Streamable`.
   - **Endpoint URL** → `https://api.blog2video.app/mcp/sse`.
   - **Authentication** → `Bearer Auth` → your JWT.
   - **Tools to Include** → `Selected`, then tick **`render_video`**.
   - **Options → Timeout** → `600000`.

### Node 12 — n8n Form → rename to `Done: Rendered` (end of the true branch)
1. **Add:** **+** → **n8n Form**. Rename it to **`Done: Rendered`**.
2. **Set fields:**
   - **Page Type** → `Form Ending`.
   - **Completion Message** → switch to **Expression**, enter:
     `Done! Preview: {{ $('Parse').item.json.preview_url }} · Download: {{ $('Agent: Render').item.json.output }}`

### Node 13 — n8n Form → rename to `Done: Preview only` (end of the false branch)
1. **Add:** **+** → **n8n Form**. Rename it to **`Done: Preview only`**.
2. **Set fields:**
   - **Page Type** → `Form Ending`.
   - **Completion Message** → switch to **Expression**, enter:
     `Your preview is ready: {{ $('Parse').item.json.preview_url }} (no MP4 rendered).`

### Common gotchas
- **Node names must match exactly** (case-sensitive). `$('Parse')`, `$('Build Form')`, `$('Form: Blog URL')`
  etc. look nodes up by their title — a typo breaks the expression.
- **Expression vs Fixed.** Any field using `{{ }}` (the form-fields JSON, the Set values, the form
  descriptions, the IF condition) must be in **Expression** mode, or it's treated as plain text.
- **Empty Set field?** A `[undefined]` value usually means a stray space or wrong case in the field name.
- **Form pages don't render in the editor** — test via the form's Production/Test URL.
- **Timeouts:** both MCP Client Tool sub-nodes need **Timeout 600000**; also raise the workflow's
  **Settings → Timeout** (render is 3–8 min), or long requests get cut off.
- **Preview links** come back as `https://blog2video.app/preview/<token>` — already shareable, open anywhere.

### Run & verify
1. Run `Get Templates` / `Get Voices`, then `Build Form` — confirm it outputs `formFields` (with options) + `voiceMap`.
2. **Activate** the workflow and open the form URL. Page 1: paste a blog URL → **Next**.
3. Page 2: the **Template** and **Voice** dropdowns are filled **from MCP** → pick both → **Submit**.
4. Wait ~1–5 min → page 3 shows the **preview URL** + render choice. Open the link; the video plays.
5. **Yes** → wait ~3–8 min → final page shows the **MP4 download** link. **No** → preview link only.
