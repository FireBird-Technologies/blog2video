# B2V MCP in n8n

How to connect the Blog2Video MCP server to n8n and turn a blog URL into a finished,
previewable video.

The hosted MCP server is exposed at:

```
https://footrest-dweeb-silt.ngrok-free.dev/mcp/sse      (HTTP Streamable transport)
```

This forwards (via ngrok) to the local FastAPI backend on `http://localhost:8000`.

---

## Prerequisites (apply to every option)

1. **Backend + ngrok running.** uvicorn on `:8000`, ngrok pinned to the domain above.
2. **A valid Blog2Video JWT.** Every MCP call must send `Authorization: Bearer <JWT>`
   (or `?token=<JWT>` on the URL). Without it the server returns 401 and the tool list is
   empty.
3. **The one-shot tools exist on the server.** Restart the backend so these are listed:
   - `create_video` — create a project from a blog URL **and** generate it in one call.
     Only `blog_url` is required; `template`, `custom_voice_id`, `render` are optional.
     Bypasses the claude.ai gallery widgets.
   - `get_preview_url` — returns a shareable `/preview/<token>` link to watch the video.

---

## Option A — AI Agent drives the MCP server

One **AI Agent** node decides which tools to call; a single **MCP Client Tool** node hands
it the Blog2Video tools. The user sends a blog URL, the agent makes the video and replies
with the preview link.

```
[1 Chat/Form Trigger] ──> [2 AI Agent] ──tool──> [3 MCP Client Tool]
                              │
                              └──model──> [4 Chat model: OpenAI / Anthropic]
```

### Node 1 — Trigger
- **Chat Trigger** ("When chat message received"): the user pastes the blog URL as the
  chat message.
- Or a **Form Trigger** with a `Blog URL` field — then set the Agent's prompt to
  `{{ $json["Blog URL"] }}`.

### Node 2 — AI Agent
The Agent has three connector dots on its bottom edge: **Chat Model**, **Memory** (skip),
**Tool**.

1. Add the **AI Agent** node; connect Node 1 into its main input.
2. **Source for Prompt:**
   - Chat Trigger → leave *Connected Chat Trigger Node*.
   - Form Trigger → set *Define below* and use `{{ $json["Blog URL"] }}`.
3. **System Message** (paste exactly):

   > You turn a blog URL into a finished video using the Blog2Video tools. When the user
   > gives a URL:
   > 1. Call `create_video` with `blog_url` (optionally `template` and `custom_voice_id`).
   > 2. Take the project id from its result and call `get_preview_url` with that
   >    `project_id`.
   > 3. Reply with ONLY the preview URL.
   > Never call setup_video, create_project, list_templates, or list_voices — there is no
   > clickable UI here.

4. **Options → Max Iterations:** raise to ~10 so it has room for both tool calls.

### Node 3 — MCP Client Tool (wired into the Agent's **Tool** input)
1. Click the Agent's **Tool** dot → add **MCP Client Tool**.
2. Server Transport `HTTP Streamable`; URL `https://footrest-dweeb-silt.ngrok-free.dev/mcp/sse`.
3. **Authentication → Bearer Auth** with your JWT.
4. **Tools to Include → `Selected`**, and select only:
   - `create_video`
   - `get_preview_url`

   > This is important. If you leave it on `All`, the agent may call `setup_video` (the
   > claude.ai widget tool), which returns *"Pick a template and a voice from the options
   > above, then click Create Video"* — and the agent will stall there forever, because
   > there is no widget to click in n8n. Restricting to the two one-shot tools removes
   > that failure mode entirely.

### Node 4 — Chat model
- Add an **OpenAI Chat Model** or **Anthropic Chat Model** to the Agent's **Chat Model**
  dot, with your API-key credential. (This is the only added cost vs. a no-LLM pipeline.)

### Getting the final URL
The agent's reply is in its **`output`** field, and per the prompt that's just the URL:
- Chat Trigger → the URL appears in the chat window automatically.
- Form Trigger → add a **Form** node (Page Type = **Form Ending**) after the Agent:
  `Your video is ready: {{ $('AI Agent').item.json.output }}`
- To force a clean URL (in case the model adds prose), put it through a Set node:
  `video_url = {{ $json.output.match(/https?:\/\/\S+/)[0] }}`

### Notes
- `create_video` blocks while generating (~1–5 min). If you hit a timeout, raise the MCP
  node's request **Timeout** and the workflow execution timeout. (ngrok-free can also drop
  very long requests.)
- Voice: pass a specific voice as `custom_voice_id` (an ElevenLabs / saved `voice_id`).
  It overrides gender/accent. If omitted, the backend defaults to a female/american voice.
- Template: pass a template id (e.g. `nightfall`). If omitted, defaults to `default`.

### Quick verification
1. Backend restarted → in the MCP Client Tool node, the tool dropdown lists `create_video`
   and `get_preview_url`.
2. Send a real blog URL in the chat / form.
3. The agent calls `create_video` then `get_preview_url` and replies with a
   `…/preview/<token>` link.
4. Open the link — the generated video plays.
