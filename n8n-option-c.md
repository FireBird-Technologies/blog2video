# Blog2Video × n8n — Option C: MCP-driven dynamic form (preview → render)

A multi-page n8n form where the user **picks a template and a voice** (both fetched live from the
MCP server), gets a **preview URL inside the form**, and can **then render an MP4** — all driven by
one AI Agent setup wired to the Blog2Video MCP server.

**MCP endpoint:** `https://footrest-dweeb-silt.ngrok-free.dev/mcp/sse` (HTTP Streamable)

---

## Prerequisites

1. **Backend + ngrok running.** uvicorn on `:8000`, ngrok pinned to the domain above.
2. **A valid Blog2Video JWT** (used by both the MCP node and the community MCP node).
3. **Two JSON MCP tools exist** (restart the backend so they're listed):
   - `get_templates_json` → `[{ id, name, genres }]`
   - `get_voices_json` → `[{ voice_id, name, description }]`
   These are plain-JSON (not widget) tools so n8n can build dropdowns from them.
4. **Community node `n8n-nodes-mcp`** installed (Settings → Community Nodes). The built-in
   *MCP Client Tool* is agent-only; the community node's **Execute Tool** runs standalone to feed a
   dropdown.
5. An **OpenAI or Anthropic** API key for the Chat Model.

---

## Node graph (connections)

```
[1 Form: Blog URL]
      │ main
[2 Get Templates] ──main──> [3 Get Voices] ──main──> [4 Build Form] ──main──> [5 Form: Pick]
                                                                                    │ main
                                                                              [6 Resolve]
                                                                                    │ main
                                                              [7 Agent: Create+Preview]
                                                                  ├─(Chat Model)─ [7b Chat Model]
                                                                  └─(Tool)─────── [7a MCP Client Tool]
                                                                                    │ main
                                                                              [8 Parse]
                                                                                    │ main
                                                                            [9 Form: Preview]
                                                                                    │ main
                                                                              [10 IF: Render?]
                              TRUE ┌───────────────────────────────────────────────┘ └──── FALSE
                  [11 Agent: Render]                                              [13 Done: Preview only]
                      ├─(Chat Model)─ [11b Chat Model]
                      └─(Tool)─────── [11a MCP Client Tool]
                          │ main
                  [12 Done: Rendered]
```

Main chain (top to bottom). **Chat Model** and **MCP Client Tool** hang off each Agent's connector
dots — they are *not* on the main line. Agent #1 and Agent #2 each need their **own** Chat Model +
MCP Client Tool sub-nodes.

---

## Credentials to create first

- **MCP (community node):** type *MCP Client (SSE / HTTP Streamable)* → URL `…/mcp/sse`, header
  `Authorization: Bearer <JWT>`.
- **MCP (built-in tool):** the built-in *MCP Client Tool* node uses **Bearer Auth** with the same JWT.
- **Chat Model:** OpenAI or Anthropic API key.

---

## Nodes

### 1 — Form Trigger · `Form: Blog URL`
- Form Title: `Blog2Video`
- Field: **`Blog URL`** — type *Text*, **required**.
- (Template/Voice are dynamic, so they live on page 2 — not here.)

### 2 — MCP Client (community) · `Get Templates`
- Credential: MCP (community).
- **Operation:** `Execute Tool`
- **Tool Name:** `get_templates_json`
- **Parameters:** `{}`

### 3 — MCP Client (community) · `Get Voices`
- Same credential. **Operation** `Execute Tool`; **Tool Name** `get_voices_json`; **Parameters** `{}`.

### 4 — Code · `Build Form` (JavaScript)
Parses each MCP tool's JSON output, builds the page-2 dropdown definitions and a voice **name→id** map:
> **The two MCP nodes must be named *exactly* `Get Templates` and `Get Voices`** (case-sensitive).
> `$('Get Templates')` looks a node up by its title — a mismatch throws *"Referenced node doesn't
> exist"* (which n8n garbles into *"Cannot assign to read only property 'name'"*). Rename via the
> node title, then run upstream nodes (Execute Workflow) before this one.

```js
// Digs through any MCP-node output shape and returns the data array, identified
// by a key its records must have ('id' for templates, 'voice_id' for voices).
// Parses JSON only when it actually IS a string — fixes the
// "Unexpected token 'o', "[object Obj"..." error from JSON.parse(<object>).
function deepFindArray(value, mustHaveKey) {
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    try { return deepFindArray(JSON.parse(s), mustHaveKey); } catch { return null; }
  }
  if (Array.isArray(value)) {
    // already the data array?
    if (value.some(el => el && typeof el === 'object' && mustHaveKey in el)) return value;
    // array of MCP content blocks: { type:'text', text:'<json>' }
    for (const el of value) {
      const found = deepFindArray(el, mustHaveKey);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    if (mustHaveKey in value) return [value];      // single record
    for (const k of Object.keys(value)) {
      const found = deepFindArray(value[k], mustHaveKey);
      if (found) return found;
    }
  }
  return null;
}

function mcpRecords(nodeName, mustHaveKey) {
  let item;
  try { item = $(nodeName).first(); }
  catch (e) {
    throw new Error(`No node named "${nodeName}" found upstream — rename your MCP nodes to exactly "Get Templates" and "Get Voices" (case-sensitive).`);
  }
  const found = deepFindArray(item.json, mustHaveKey);
  if (!found) {
    throw new Error(`No "${mustHaveKey}" array in "${nodeName}". Raw: ${JSON.stringify(item.json).slice(0, 600)}`);
  }
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

### 5 — n8n Form · `Form: Pick` (page 2)

This is a **second page of the same form** — not a new trigger. It renders the Template + Voice
dropdowns from the JSON that `Build Form` produced.

**Add & wire it:**
1. Add node → search **`n8n Form`** (the action node, *not* "n8n Form Trigger") → connect
   `Build Form` → this node. It auto-joins the form started by `Form: Blog URL`.

**Configure it:**
2. **Page Type:** `Next Form Page` (this is what makes it a mid-form page, not the ending).
3. **Define Form:** `Using JSON`.
4. **Form Fields (JSON):** this is the step that trips people up — the field defaults to **Fixed**
   (literal text), so `{{ }}` won't evaluate. Click the **Expression** toggle on that field, then enter:
   ```
   {{ $json.formFields }}
   ```
   The preview should show your two dropdown definitions (Template + Voice) as a JSON array. If it
   shows `undefined`, `$json` here isn't the `Build Form` output — make sure `Build Form` connects
   **directly** into this node and has run.
5. (Optional) **Form Title:** `Choose template & voice`.

**You can't see the dropdowns in the editor** — form pages only render at runtime. Test by opening the
form's **Test/Production URL**, submitting page 1 (Blog URL), and you'll land on this page with both
dropdowns populated.

- After submit, downstream nodes read `{{ $json.Template }}` (a template id) and `{{ $json.Voice }}`
  (a voice name).

> **JSON shape note:** the array must look like
> `[{ "fieldLabel": "...", "fieldType": "dropdown", "requiredField": true, "fieldOptions": { "values": [{ "option": "..." }] } }]`
> — which is exactly what `Build Form` emits. If n8n rejects it, re-check the Code node ran and that
> the field is in **Expression** mode.

### 6 — Edit Fields (Set) · `Resolve`

The Voice dropdown submits a **name** (e.g. `Rachel`); `create_video` needs the **voice_id**. This node
converts it using the `voiceMap` built back in the Code node, and passes the template through.

> ⚠️ **`[Referenced node doesn't exist]`?** `$('Build Form')` looks the Code node up **by its exact
> title**. n8n names a new Code node `Code` (or `Code in JavaScript`), *not* `Build Form`.
> **Fix:** double-click the Code node's title and rename it to exactly `Build Form` (case-sensitive,
> no trailing space). Or, change `'Build Form'` in the expression below to whatever your Code node is
> actually called.

**Configure the node:**
1. **Mode:** `Manual Mapping`.
2. **Include Other Input Fields:** ON → Input Fields to Include: `All` (so `Blog URL` etc. pass through).
3. **Fields to Set** → add two fields. For each: type the **name**, set **Type = String**, then click
   the **Expression** toggle (top-right of the value box) and paste the expression:

   - Name `custom_voice_id`, String, Expression:
     ```
     {{ ($('Build Form').first().json.voiceMap || {})[$json.Voice] || '' }}
     ```
   - Name `template`, String, Expression:
     ```
     {{ $json.Template }}
     ```

   (The `|| {}` / `|| ''` guards mean a missing voice just yields an empty `custom_voice_id` — which
   makes `create_video` fall back to the default voice — instead of erroring.)

**Testing this node:** the expression preview will show `[Referenced node doesn't exist]` until the
Code node is named `Build Form` **and** has produced output. Run the chain with **Execute Workflow**
(or open the form and submit page 2) rather than clicking *Execute step* on this node alone — `$json.Voice`
only exists after page 2 is submitted. When wired right, the preview resolves to a voice_id like
`21m00Tcm4TlvDq8ikWAM`.

### 7 — AI Agent · `Agent: Create+Preview`
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
- **Options → Max Iterations:** `10`

#### 7a — MCP Client Tool (built-in) → Agent's **Tool** dot
- Transport `HTTP Streamable`; URL `…/mcp/sse`; **Bearer Auth** JWT.
- **Tools to Include → Selected:** `create_video`, `get_preview_url`.
- **Options → Timeout: `600000`** (10 min; default ~60s throws `MCP error -32001`).

#### 7b — Chat Model → Agent's **Chat Model** dot
- OpenAI or Anthropic + credential. **Required** — the agent won't run without it.

#### 7c — Structured Output Parser → Agent's **Output Parser** dot (standardizes the reply)
LLMs ignore "reply in this exact format" instructions often (you'll get markdown tables, prose, etc.).
A parser **forces** the agent's final answer into a fixed JSON shape, so downstream always gets the two
fields cleanly.

1. On the AI Agent node, turn **ON** the **`Require Specific Output Format`** toggle (in Parameters).
   A new **Output Parser** connector appears on the bottom of the node.
2. Click it → `+` → add **Structured Output Parser**.
3. Set **Schema Type** = `Generate From JSON Example` and paste:
   ```json
   { "project_id": 808, "preview_url": "http://localhost:5173/preview/abc123" }
   ```
   (Or use a manual JSON Schema with `project_id`: number and `preview_url`: string.)

With the parser attached, the agent's `output` becomes an **object**, so downstream you read
`$json.output.project_id` and `$json.output.preview_url` directly (see Node 8).

#### Troubleshooting Node 7
- **"A Chat Model sub-node must be connected and enabled"** → you haven't added 7b yet. On the AI
  Agent node click the **Chat Model** connector (bottom of the node) → `+` → add *OpenAI Chat Model*
  or *Anthropic Chat Model* → set its API-key credential. This is mandatory; the agent can't execute
  without a model.
- **`blog_url: [Referenced node doesn't exist]`** → the Blog URL from page 1 is *not* carried into the
  page-2 item, so the prompt reaches back to the trigger with `$('Form: Blog URL')`. That fails unless
  the **Form Trigger is named exactly `Form: Blog URL`** (n8n's default is `On form submission`).
  Rename the trigger, or change `'Form: Blog URL'` in the prompt to its real title.
- **`custom_voice_id: [undefined]`** → the value mapped fine (you'll see the voice_id in the agent's
  Input panel), but the prompt reads `$json.custom_voice_id`. Open the **`Resolve`** node and confirm
  the field is named **exactly** `custom_voice_id` — no leading/trailing space, lower-case. (Compare
  with `template`, which resolves because it's named correctly.)
- You **cannot** *Execute step* this node in isolation — `$json.template`/`custom_voice_id` only exist
  after the form runs through page 2. Use **Execute Workflow** via the form URL.

### 8 — Edit Fields (Set) · `Parse`

With the **Structured Output Parser** (7c) attached, `Agent: Create+Preview` returns an **object** in
`output` — so this node just lifts the two fields into a clean, predictable item.

**Add & wire it:**
1. Add **Edit Fields (Set)** → connect `Agent: Create+Preview` → this node → rename it `Parse`.

**Configure it (parser version — recommended):**
2. **Mode:** `Manual Mapping`. **Include Other Input Fields:** OFF.
3. **Fields to Set** → two fields, each in **Expression** mode:
   - Name `project_id`, **Type Number**: `{{ $json.output.project_id }}`
   - Name `preview_url`, **Type String**: `{{ $json.output.preview_url }}`

**If you did NOT attach the parser** (agent still returns free-form text), use these resilient regexes
instead — they survive markdown tables / prose:
- `project_id` (Number): `{{ ($json.output.match(/projects\/(\d+)/) || $json.output.match(/#(\d+)/) || $json.output.match(/project\D*?(\d+)/i) || [])[1] }}`
- `preview_url` (String): `{{ ($json.output.match(/https?:\/\/\S+?\/preview\/[A-Za-z0-9]+/) || [])[0] }}`

**Testing:** the `output` field only exists after the agent has actually run, so run from the form URL.

> **Heads-up:** if `preview_url` comes back as `http://localhost:5173/preview/…`, that's the backend's
> dev preview base — it only opens on your machine. Fine for local testing; for a shareable link the
> backend's preview URL base needs to point at a public host.

### 9 — n8n Form · `Form: Preview` (page 3)
- **Page Type:** `Next Form Page`; Form Title `Your preview is ready`.
- **Form Description:** `Watch it: {{ $json.preview_url }} — then choose whether to render a downloadable MP4 (3–8 min).`
- Field: **`Render to MP4?`** (Dropdown) → options `Yes`, `No`.

### 10 — IF · `Render?`
- Condition: `{{ $json["Render to MP4?"] }}` **equals** `Yes`.

### 11 — AI Agent · `Agent: Render`  (TRUE branch)
- **Prompt** (*Define below*): `project_id: {{ $('Parse').item.json.project_id }}`
- **System Message:**
  ```
  You render an already-generated Blog2Video project to a downloadable MP4 using the MCP tools.
  You are given a project_id.
  1. Call render_video with that project_id.
  2. Reply with ONLY the https MP4 download URL, nothing else.
  Never call any other tool.
  ```
- **11a — MCP Client Tool:** same server/auth; **Selected** → `render_video` (optionally `get_project`); **Timeout `600000`**.
- **11b — Chat Model:** its own model sub-node.

### 12 — n8n Form · `Done: Rendered` (Form Ending, TRUE branch)
- Completion text: `Done! Preview: {{ $('Parse').item.json.preview_url }} · Download: {{ $('Agent: Render').item.json.output }}`

### 13 — n8n Form · `Done: Preview only` (Form Ending, FALSE branch)
- Completion text: `Your preview is ready: {{ $('Parse').item.json.preview_url }} (no MP4 rendered).`

---

## Settings, run & verify

1. Workflow → **Settings → Timeout:** raise high (or disable) so a long render isn't killed.
2. **Checkpoint before going live:** Execute `Get Templates` & `Get Voices` (each returns a JSON
   array), then Execute `Build Form` — confirm `formFields[].fieldOptions.values` is populated for
   both dropdowns.
3. **Save → Active.** Open the form's **Production URL**.
4. Page 1: paste a real blog URL → Next.
5. Page 2: Template + Voice dropdowns are populated **from MCP** → pick both → Submit.
6. Wait ~1–5 min → page 3 shows the **preview URL** + render question. Open the link; the video plays.
7. **Yes** → wait ~3–8 min → final page shows the **MP4 download** link. **No** → preview link only.

## Gotchas
- **Both MCP Client Tool nodes need Timeout `600000`** — `create_video` 1–5 min, `render_video` 3–8 min.
- **ngrok-free** can drop very long requests; retry or use a paid tunnel for big renders.
- **Between form pages the agent runs** (minutes) — the form shows a processing spinner; that's expected.
- **Voice maps name→id in `Resolve`** against `voiceMap`. If empty, `custom_voice_id` is blank and
  `create_video` falls back to default female/american — check `Get Voices` output.
- **Template value is used directly** (ids like `nightfall` are friendly), so no mapping is needed.

## No-community-node fallback
If you can't install `n8n-nodes-mcp`: replace nodes 2/3 with a tiny **AI Agent** (built-in MCP Client
Tool, tools `get_templates_json` + `get_voices_json`) whose system message is *"Call both tools and
reply with ONLY a JSON object `{ templates: [...], voices: [...] }`"*; then `Build Form` parses
`$json.output`. Costs an extra LLM call and risks malformed JSON, so the community node is preferred.
