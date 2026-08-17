// Template gallery — MCP Apps (SEP-1865) widget.
//
// The host renders this page in a sandboxed iframe and waits for the MCP Apps
// handshake before it will make the iframe visible. `app.connect()` performs
// that handshake (ui/initialize over postMessage) — without it the container
// stays hidden forever, which is why the previous hand-written page never
// rendered in claude.ai. See:
// https://claude.com/docs/connectors/building/mcp-apps/troubleshooting
//
// Data arrives via `ontoolresult` (the tool's structuredContent). We also read
// window.openai.toolOutput as a fallback so the same bundle keeps working in
// ChatGPT, and window.__B2V_DATA__ for direct-browser/debug loads.

import { App } from "@modelcontextprotocol/ext-apps";

// Preview thumbnails are imported (not fetched) so Vite inlines them as data
// URIs. claude.ai ignores _meta.ui.csp.resourceDomains
// (anthropics/claude-ai-mcp#40), so any <img> pointing at our R2 bucket is
// blocked in the widget sandbox; a data: URI has no origin to block.
// Refresh these files with scripts/fetch_preview_thumbs.py.
const PREVIEWS = import.meta.glob<string>("./previews/*.webp", {
  eager: true,
  query: "?inline",
  import: "default",
});

function previewFor(id: string): string | undefined {
  return PREVIEWS[`./previews/${id}.webp`];
}

type Template = {
  id: string;
  name?: string;
  genres?: string[];
  preview_url?: string;
  /** True for the user's own templates (id is "custom_<n>"). Rendered in a
   *  separate "Your templates" section — they have no bundled .webp preview. */
  custom?: boolean;
  colors?: { accent?: string; bg?: string; text?: string };
};

const grid = document.getElementById("grid") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;

const app = new App(
  { name: "Blog2Video Template Gallery", version: "1.0.0" },
  {},
  { autoResize: true },
);

let selectedId: string | null = null;

function render(templates: Template[]): void {
  if (!templates.length) {
    status.textContent = "No templates available.";
    return;
  }
  status.textContent = "";
  grid.replaceChildren();

  // Built-ins first, then the user's own templates under a heading. Custom ones
  // arrive with id "custom_<n>" and no bundled .webp, so they fall through to
  // the initials placeholder below unless the backend rendered a thumbnail.
  const builtIns = templates.filter((t) => !t.custom);
  const customs = templates.filter((t) => t.custom);

  for (const t of [...builtIns, ...customs]) {
    if (t === customs[0]) {
      const heading = document.createElement("div");
      heading.className = "section-label";
      heading.textContent = "Your templates";
      grid.appendChild(heading);
    }
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.dataset.id = t.id;
    card.setAttribute("aria-pressed", "false");

    // Bundled data URI first; the server-supplied R2 url is only a fallback for
    // hosts that do allow external images (ChatGPT, direct browser loads).
    const src = previewFor(t.id) ?? t.preview_url;
    if (src) {
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = src;
      img.alt = t.name ?? t.id;
      img.loading = "lazy";
      // If an external fallback is blocked by CSP, swap in the letter tile
      // rather than leaving a broken-image icon.
      img.addEventListener("error", () => {
        const ph = document.createElement("div");
        ph.className = "thumb placeholder";
        ph.textContent = (t.name ?? t.id).slice(0, 2).toUpperCase();
        img.replaceWith(ph);
      });
      card.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "thumb placeholder";
      ph.textContent = (t.name ?? t.id).slice(0, 2).toUpperCase();
      card.appendChild(ph);
    }

    const meta = document.createElement("div");
    meta.className = "meta";

    const title = document.createElement("div");
    title.className = "name";
    title.textContent = t.name ?? t.id;
    meta.appendChild(title);

    const genres = (t.genres ?? []).join(" · ");
    if (genres) {
      const g = document.createElement("div");
      g.className = "genres";
      g.textContent = genres;
      meta.appendChild(g);
    }

    card.appendChild(meta);
    card.addEventListener("click", () => select(t));
    grid.appendChild(card);
  }
}

async function select(t: Template): Promise<void> {
  selectedId = t.id;
  for (const el of Array.from(grid.querySelectorAll<HTMLElement>(".card"))) {
    const on = el.dataset.id === selectedId;
    el.classList.toggle("selected", on);
    el.setAttribute("aria-pressed", String(on));
  }

  // Tell the conversation what was picked so the model can continue the flow.
  // `role` is required by the ui/message schema — omitting it makes the host
  // reject the request and the click silently does nothing.
  try {
    const res = await app.sendMessage({
      role: "user",
      content: [{ type: "text", text: `use ${t.id}` }],
    });
    if (res?.isError) console.error("[b2v] host rejected selection message");
  } catch (err) {
    console.error("[b2v] sendMessage failed:", err);
  }
}

function fromToolResult(result: unknown): Template[] | null {
  const r = result as { structuredContent?: { templates?: Template[] } } | undefined;
  const list = r?.structuredContent?.templates;
  return Array.isArray(list) ? list : null;
}

app.ontoolresult = (params) => {
  const list = fromToolResult(params);
  if (list) render(list);
};

async function boot(): Promise<void> {
  await app.connect();

  // If the host delivered the result before connect() resolved, ontoolresult
  // has already fired. Otherwise fall back to the non-MCP-Apps data channels.
  if (!grid.childElementCount) {
    const w = window as unknown as {
      openai?: { toolOutput?: { templates?: Template[] } };
      __B2V_DATA__?: { templates?: Template[] };
      __B2V_TEMPLATES__?: Template[];
    };
    const fallback =
      w.openai?.toolOutput?.templates ??
      w.__B2V_DATA__?.templates ??
      w.__B2V_TEMPLATES__;
    if (Array.isArray(fallback) && fallback.length) render(fallback);
  }
}

boot().catch((err) => {
  status.textContent = "Could not connect to the chat host.";
  console.error("[b2v] MCP Apps connect failed:", err);
});
