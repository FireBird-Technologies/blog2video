// Voice gallery — MCP Apps (SEP-1865) widget.
//
// Ported from the pre-MCP-Apps hand-written page that never rendered in
// claude.ai. Same root cause as the template gallery before it: the host keeps
// the iframe hidden until the MCP Apps handshake completes, and the old page
// never performed one. `app.connect()` is what makes the widget appear.
// See template_gallery_app.ts for the original write-up.
//
// Data arrives via `ontoolresult` (the tool's structuredContent). We also read
// window.openai.toolOutput as a fallback so the same bundle keeps working in
// ChatGPT, and window.__B2V_VOICES__ for the server-side cold-read injection
// in mcp_transport._read_resource.

import { App } from "@modelcontextprotocol/ext-apps";

type Voice = {
  voice_id: string;
  name?: string;
  preview_url?: string | null;
  description?: string;
  plan?: string | null;
  gender?: string;
  accent?: string;
  labels?: Record<string, string>;
};

const grid = document.getElementById("grid") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;

const app = new App(
  { name: "Blog2Video Voice Gallery", version: "1.0.0" },
  {},
  { autoResize: true },
);

let selectedId: string | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentPlayBtn: HTMLButtonElement | null = null;

const GENDER_EMOJI: Record<string, string> = { male: "👨", female: "👩" };

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function fieldsOf(v: Voice): { gender: string; accent: string } {
  // handlers._normalize_voice sends both flat fields and a labels mirror;
  // prefer the flat one and fall back so either shape renders.
  const labels = v.labels ?? {};
  return {
    gender: v.gender || labels["gender"] || "",
    accent: v.accent || labels["accent"] || "",
  };
}

function buildCard(v: Voice): HTMLButtonElement {
  const { gender, accent } = fieldsOf(v);
  const name = v.name || v.voice_id || "Voice";
  const plan = v.plan || "free";

  const card = document.createElement("button");
  card.className = "card";
  card.type = "button";
  card.dataset.id = v.voice_id;
  card.setAttribute("aria-pressed", "false");

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = GENDER_EMOJI[gender] ?? "🎙";
  card.appendChild(avatar);

  const info = document.createElement("div");
  info.className = "info";

  const title = document.createElement("div");
  title.className = "name";
  title.textContent = name;
  info.appendChild(title);

  const metaText = [cap(gender), cap(accent)].filter(Boolean).join(" · ");
  if (metaText) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = metaText;
    info.appendChild(meta);
  }

  const badges = document.createElement("div");
  badges.className = "badges";
  for (const text of [cap(gender), cap(accent)].filter(Boolean)) {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = text;
    badges.appendChild(b);
  }
  const planBadge = document.createElement("span");
  planBadge.className = plan === "free" ? "badge" : "badge badge-pro";
  planBadge.textContent = plan === "free" ? "Free" : "Pro";
  badges.appendChild(planBadge);
  info.appendChild(badges);

  card.appendChild(info);

  // Preview audio is loaded from our R2/backend origin. claude.ai ignores
  // _meta.ui.csp.resourceDomains (anthropics/claude-ai-mcp#40), so playback may
  // be blocked in the widget sandbox — unlike the template thumbnails we cannot
  // inline audio as data URIs. Render the control, but degrade to a disabled
  // state on error rather than leaving a button that does nothing.
  const play = document.createElement("button");
  play.type = "button";
  play.className = "play-btn";
  play.textContent = "▶";
  if (v.preview_url) {
    play.title = "Preview voice";
    play.dataset.preview = v.preview_url;
    play.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePlay(play);
    });
  } else {
    play.classList.add("unavailable");
    play.title = "No preview available";
    play.disabled = true;
  }
  card.appendChild(play);

  card.addEventListener("click", () => select(v));
  return card;
}

function render(voices: Voice[]): void {
  if (!voices.length) {
    status.textContent = "No voices available.";
    return;
  }
  status.textContent = "";
  grid.replaceChildren();

  const free = voices.filter((v) => (v.plan || "free") === "free");
  const pro = voices.filter((v) => (v.plan || "free") !== "free");

  for (const [label, list] of [
    ["Free voices", free],
    ["Pro voices", pro],
  ] as const) {
    if (!list.length) continue;
    const heading = document.createElement("div");
    heading.className = "section-label";
    heading.textContent = label;
    grid.appendChild(heading);

    const section = document.createElement("div");
    section.className = "grid";
    for (const v of list) section.appendChild(buildCard(v));
    grid.appendChild(section);
  }
}

function stopPlayback(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentPlayBtn) {
    currentPlayBtn.textContent = "▶";
    currentPlayBtn.classList.remove("playing");
    currentPlayBtn = null;
  }
}

function togglePlay(btn: HTMLButtonElement): void {
  const url = btn.dataset.preview;
  if (!url) return;

  const wasCurrent = currentPlayBtn === btn;
  stopPlayback();
  if (wasCurrent) return; // second click on the playing card = stop

  const audio = new Audio(url);
  audio.addEventListener("ended", stopPlayback);
  // Sandbox CSP may block the request outright; mark the control dead so the
  // user gets feedback instead of a button that silently never plays.
  audio.addEventListener("error", () => {
    stopPlayback();
    btn.classList.add("unavailable");
    btn.disabled = true;
    btn.title = "Preview unavailable here";
  });
  audio.play().catch(() => {
    stopPlayback();
    btn.classList.add("unavailable");
    btn.disabled = true;
    btn.title = "Preview unavailable here";
  });

  currentAudio = audio;
  currentPlayBtn = btn;
  btn.textContent = "■";
  btn.classList.add("playing");
}

async function select(v: Voice): Promise<void> {
  selectedId = v.voice_id;
  for (const el of Array.from(grid.querySelectorAll<HTMLElement>(".card"))) {
    const on = el.dataset.id === selectedId;
    el.classList.toggle("selected", on);
    el.setAttribute("aria-pressed", String(on));
  }

  // Tell the conversation what was picked so the model can continue the flow.
  // `role` is required by the ui/message schema — omitting it makes the host
  // reject the request and the click silently does nothing. The old page used
  // a bare postMessage({type:'voice-selected'}) that no host understands.
  const label = v.name || v.voice_id;
  try {
    const res = await app.sendMessage({
      role: "user",
      content: [{ type: "text", text: `use voice ${label} (${v.voice_id})` }],
    });
    if (res?.isError) console.error("[b2v] host rejected voice selection message");
  } catch (err) {
    console.error("[b2v] sendMessage failed:", err);
  }
}

function fromToolResult(result: unknown): Voice[] | null {
  const r = result as { structuredContent?: { voices?: Voice[] } } | undefined;
  const list = r?.structuredContent?.voices;
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
      openai?: { toolOutput?: { voices?: Voice[] } };
      __B2V_VOICES__?: Voice[];
    };
    const fallback = w.openai?.toolOutput?.voices ?? w.__B2V_VOICES__;
    if (Array.isArray(fallback) && fallback.length) render(fallback);
  }
}

boot().catch((err) => {
  status.textContent = "Could not connect to the chat host.";
  console.error("[b2v] MCP Apps connect failed:", err);
});
