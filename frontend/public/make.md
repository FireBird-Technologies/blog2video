# Blog2Video MCP server → Make.com — Setup & Test Log

A working, reproducible record of wiring the Blog2Video **MCP server** to **Make.com**
(eu1 zone, Free plan) so that a single scenario runs the full pipeline:
*blog URL → setup → create project → generate → render → finished MP4.*

This is the **Make equivalent of the n8n "Option A"** chain (see `n8n.md`): a deterministic,
hand-built module chain (no LLM agent), each module pinned to one MCP tool. It documents what
we built, the decisions we had to make, the gotchas, the fixes, and what Make **can** and
**cannot** do — so a teammate (or Claude) can pick it up later without re-deriving anything.

**Result: verified end-to-end.** Project #819 reached `DONE` (rendered MP4, 7 scenes) driven
entirely by Make → ngrok → local backend → Neon DB.

---

## 1. What we built (final shape)

```
[1] list_templates            ← sanity / connection test
[2] setup_video               ← unlocks the create_project gate
[3] create_project            ← template = default; returns "project #NNN"
[4] generate_video   ⚠RESUME   ← fires the AI pipeline (will time out, job runs server-side)
      → Sleep 300s            ← wait 5 min for generation to finish
[5] check_generation_status   ← fast poll; confirms "generated"
[6] render_video     ⚠RESUME   ← fires the MP4 render (will time out, job runs server-side)
      → (optional) Sleep + check_render_status to surface the MP4 URL inside Make
```

Every tool node is the **Make "MCP Client" app → "Call a Tool"** module (Beta), each pinned to
one Blog2Video tool. The two long tools carry a **Resume** error handler (see §6).

### Architecture (identical to the n8n setup)

```
[ Make.com scenario ]
        │  HTTPS + Bearer JWT (Authorization header)
        ▼
[ ngrok URL ] ──▶ [ local backend = the MCP server ]
        │                       (scrape → script → voiceover → render MP4)
        ▼
[ shared Neon Postgres DB ]
```

- Make is only the **orchestrator** — it calls MCP tools in order.
- The **MCP server** (local backend via ngrok) does all the real work.
- The **Neon DB** is shared; Make never touches it.

---

## 2. Server facts that drive the setup

(Same as `n8n.md` §2 — verified on branch `feature/mcp-server`.)

- **Auth is mandatory.** Every `/mcp/sse` request needs a valid Blog2Video JWT, sent either as
  **`Authorization: Bearer <JWT>`** (Make's connection does this automatically — see §4) or as
  **`?token=<JWT>`** on the URL. No token → 401, empty tool list.
- **Transport:** `/mcp/sse` is **HTTP Streamable**. Make's MCP Client speaks this natively.
- **`create_project` is gated:** refuses unless a template **and** voice gallery were "shown" in
  the last 30 min. **One `setup_video` call sets both flags** — so `setup_video` alone unlocks it.
  (This is why module 2 is `setup_video`, before `create_project`.)
- **Single worker required.** The gate flags are in-process module globals — run the backend on
  **one** uvicorn worker or the gate is flaky.
- **`/api/templates` is public; `create_project` needs a real DB user** → root of the JWT gotcha
  (§4 in `n8n.md`). We reused the **DB-matched, 1-year token** minted for that DB.
- **Long-running tools:** `generate_video` ~1–5 min, `render_video` ~3–8 min. Both **start the
  job, then block while polling server-side** — so the job finishes even if the client gives up.
  This is the whole reason Make times out but the video still completes (§6).

---

## 3. Prerequisites

1. Backend running **single uvicorn worker**.
2. **ngrok** tunnel up, pointing at the backend → MCP endpoint `https://<sub>.ngrok-free.dev/mcp/sse`.
   (Free ngrok URLs change when the tunnel restarts — update the Make connection if so.)
3. A valid **JWT for a user that exists in the DB the backend reads** (the §4 gotcha from `n8n.md`).
   We reused the existing 1-year token minted for user id=3.
4. A **Make.com account** (Free plan, 1,000 credits, is enough to test — each tool call = 1 credit).

---

## 4. The Make connection (this is where Make differs from n8n)

Add an **MCP Client → "Call a Tool"** module → **Create a connection** → **MCP server: "+ New
MCP server"**. Fields:

| Field | Value |
|-------|-------|
| Connection name | `Blog2Video MCP` |
| MCP server | **+ New MCP server** (Blog2Video is not a verified/built-in server) |
| **URL** | `https://<sub>.ngrok-free.dev/mcp/sse` (plain endpoint, **no token in it**) |
| **API key / Access token** | the **raw JWT only** (no `Bearer ` prefix) |

**Key fact:** Make's connection dialog states *"The token is added to the Authorization header as
a Bearer token."* So Make sends a proper `Authorization: Bearer <JWT>` header — exactly like n8n's
Bearer Auth. **You do NOT need the `?token=` URL trick** (though it also works as a fallback if a
client can't set headers — verified).

**Proof of connection:** once saved, the **Tool Name** dropdown populates with all 27 Blog2Video
tools (`setup_video`, `list_templates`, `create_project`, …). Pick `list_templates` → **Run once**
→ 12 templates come back = server + tunnel + token all good. (Same milestone as `n8n.md` §5.1.)

---

## 5. Building the chain (module by module)

Each pipeline node = an MCP Client → "Call a Tool" module. Build module 1, then add the next from
the **right edge "+"** of the previous one (it reuses the same connection).

| # | Tool | Arguments |
|---|------|-----------|
| 1 | `list_templates` | none (connection sanity test) |
| 2 | `setup_video` | `blog_url` = `https://www.metal.so/` |
| 3 | `create_project` | `blog_url` = same URL, `template` = `default` |
| 4 | `generate_video` | `project_id` = dynamic (see §5.1) + **Resume** handler (§6) |
| — | Sleep | `300` (Tools → Sleep; max 300s) |
| 5 | `check_generation_status` | `project_id` = dynamic (§5.1) |
| 6 | `render_video` | `project_id` = dynamic (§5.1), `force_rerender` = **No** + **Resume** handler |

### 5.1 Dynamic `project_id` (the regex gotcha)

`create_project` returns markdown text like `✅ Created **project #819** from …`. There is **no
clean numeric field** — you must extract the number from that text. Set `project_id` to an
**expression** referencing the `create_project` module's `Result` (module #3 here):

```
{{replace(3.result; "/[\s\S]*?project #(\d+)[\s\S]*/"; "$1")}}
```

- Map the `Result` token from the create_project module first (it becomes `3.result`), then wrap
  it with `replace(...)`.
- **Use `[\s\S]`, not `.` with an `s` flag.** Our first attempt `/.*?project #(\d+).*/gs` returned
  the whole multi-line blob → `render_video`/`generate_video` rejected it with
  **"Invalid number in parameter 'project_id'"**. `[\s\S]` matches across the markdown's newlines
  reliably; dropping the `g` flag keeps it a single whole-string replace. This fix made it return
  just `819`.

Reference the same `3.result` in **every** downstream module (generate, check, render) — not
`generate_video`'s output — because the project number lives in module 3's text.

---

## 6. The timeout problem + the fix (Make's §6 — same as n8n)

**Issue:** Make's MCP Client (Beta) has its own **~2-minute internal request timeout that no field
overrides** (just like n8n's MCP node — `n8n.md` §6). Long blocking calls — `generate_video`
(~2–5 min) and `render_video` (~3–8 min) — therefore throw **`MCP error -32001: Request timed
out`**.

**Important:** the job still **completes on the server** — these tools *start* the job before they
block. We verified in the DB: while Make showed the timeout, **project #818/#819 reached
GENERATED, then #819 reached DONE (rendered MP4)**.

**Two timeouts, only one is yours to change:**
- The **MCP Client's ~2-min internal limit** — **cannot** be raised. No setting reaches it.
- The **scenario execution limit** — *can* be raised, but it doesn't help, because the individual
  call dies first.

So "just add a timeout" does **not** work. The fix is to **never let one call block** — fire-and-poll:

1. **Resume** error handler on `generate_video` → on timeout, skip the error and continue (the job
   already started). *(Make: right-click module → Add error handler → **Resume**. Leave substitute
   fields empty.)*
2. **Sleep 300s** → wait for generation to actually finish before checking.
3. **`check_generation_status`** → a *fast* call, returns "generated" cleanly (no timeout).
4. **Resume** on `render_video` → same fire-and-forget for the render.
5. *(Optional, not built in this test)* Sleep ×2 + **`check_render_status`** → surface the final
   MP4 URL **inside** Make. We skipped this and confirmed the MP4 in the DB instead.

> **Resume ≠ Sleep.** Resume only stops the timeout from **killing the scenario** (it fires
> *instantly*). Sleep is what **waits** for the slow server job to finish before the next module
> checks/renders. You need both: Resume to survive, Sleep to not race ahead. A fixed 5-min Sleep
> is the simple version; the "proper" version loops (Sleep 30s → check → repeat) so it waits only
> as long as needed.

---

## 7. What Make CAN and CANNOT do (vs n8n)

| Capability | Make | Notes |
|---|---|---|
| Connect to the MCP server (Bearer header) | ✅ | Connection's "API key / Access token" field → `Authorization: Bearer`. |
| Discover + call any of the 27 tools | ✅ | "Call a Tool" module, one tool each. |
| Run the full deterministic chain | ✅ | Proven: project #819 → DONE end-to-end. |
| Handle the long-tool timeout | ✅ (workaround) | Resume + Sleep fire-and-poll. Cannot raise the MCP timeout itself. |
| Dynamic `project_id` from tool output | ✅ | Via `replace()` regex on the markdown (§5.1). |
| **Form trigger that shows the result back on the same form** | ❌ | Make's native **MakeForms** can *trigger* a scenario (`Watch New Response`) but **cannot display a custom completion/result page** to the user the way n8n's **Form Ending** does. There is no "show the MP4 on the thank-you page" equivalent. For a user-facing round-trip, use a **Custom Webhook** trigger + **Webhook Response** (return the MP4 link), or deliver the result via **email / Google Sheet** at the end. |
| Add a custom MCP connector to the **consumer Gemini-style app** | n/a | (That's a Gemini limitation, noted for cross-reference — Make is fine.) |

**Decision we made in this test:** we chose **"just the tool chain, no form"** — simplest path to
prove the full pipeline runs on Make. The form-in / form-out round-trip from the n8n build is **not
cleanly reproducible on Make** (the ❌ row above), so for a real user-facing flow on Make you'd use
a webhook + webhook-response, or push the MP4 URL to email/Sheets.

---

## 8. End result (verified)

- Full deterministic chain **works end-to-end on Make**; all MCP tools reachable.
- **Project #818 → GENERATED (7 scenes)** — completed server-side despite a Make timeout (§6 in action).
- **Project #819 → DONE** — generated *and* rendered MP4 (7 scenes), the full pipeline, with the
  fire-and-poll (Resume + Sleep) structure handling both long tools.
- `list_templates` / `setup_video` / `create_project` all confirmed green before the long steps.

**Conclusion:** the Blog2Video MCP server is proven to work through Make.com. The only thing Make
can't match from the n8n build is the **form-ending result page** — for that, use a webhook
response or email/Sheet delivery (§7).

---

## 9. Re-running later / maintenance

- **Token rotation:** the JWT expires (we used a 1-year mint). When it does, re-mint (see `n8n.md`
  §4) and update the **one** `Blog2Video MCP` connection's "API key / Access token" — all modules
  share it.
- **ngrok URL changes:** if the tunnel restarts with a new URL, update the **URL** in the
  `Blog2Video MCP` connection (Connections page) — one place, all modules follow.
- **Single worker:** always run the backend single-worker, or the `create_project` gate breaks.
- **Sanity check before a full run:** `list_templates` → Run once. Templates back = server +
  tunnel + token all good.
- **Credits:** Free plan = 1,000 credits/month; each tool call = 1 credit. A full chain run is a
  handful of credits.
