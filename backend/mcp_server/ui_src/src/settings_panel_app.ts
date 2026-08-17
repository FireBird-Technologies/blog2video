// Settings panel — MCP Apps (SEP-1865) widget.
//
// Third step of the Manual flow: list_templates → list_voices → show_settings.
// The user has already picked a template and a voice (each gallery announced the
// choice into the conversation via app.sendMessage); this panel collects the
// remaining ~15 create_project options and then actually creates the project.
//
// Same root cause as the two galleries before it: claude.ai keeps the iframe
// hidden until the MCP Apps handshake completes, so `app.connect()` is what
// makes the widget appear at all. The hand-written setup_gallery.html never
// performed one, which is why the combined panel never rendered in Claude.
//
// Data arrives via `ontoolresult` (the tool's structuredContent). We also read
// window.openai.toolOutput as a fallback so the same bundle keeps working in
// ChatGPT, and window.__B2V_SETTINGS__ for the server-side cold-read injection
// in mcp_transport._read_resource.
//
// UNLIKE the two galleries, this widget does not merely announce a selection —
// it calls create_project itself via app.callServerTool. See submit().

import { App } from "@modelcontextprotocol/ext-apps";

type BgmTrack = {
  track_id: string;
  display_name?: string;
  mood?: string;
  r2_url?: string | null;
};

type SettingsData = {
  bgm_tracks?: BgmTrack[];
  is_paid?: boolean;
};

const statusEl = document.getElementById("status") as HTMLElement;
const settingsEl = document.getElementById("settings") as HTMLElement;
const barEl = document.getElementById("bar") as HTMLElement;
const barStatus = document.getElementById("bar-status") as HTMLElement;
const createBtn = document.getElementById("create") as HTMLButtonElement;

const app = new App(
  { name: "Blog2Video Settings", version: "1.0.0" },
  {},
  { autoResize: true },
);

let data: SettingsData = {};
let ready = false;
let bgmAudio: HTMLAudioElement | null = null;

// Mirrors ProjectCreate (app/schemas/schemas.py). Every control starts at its
// default, and a control still AT its default is omitted from the args entirely
// — that is what "skip this setting" means.
const DEFAULTS: Record<string, unknown> = {
  video_length: "auto",
  video_style: "auto",
  stock_footage_enabled: true,
  bgm_track_id: "",
  bgm_volume: 0.1,
  aspect_ratio: "landscape",
  playback_speed: 1.0,
  captions_enabled: false,
  caption_position: "bottom_center",
  caption_font_family: "inter",
  caption_font_size: "36",
  caption_offset: 0,
};

// stock_footage_enabled is checked by default here (matching auto_video's
// behaviour) even though ProjectCreate defaults it to FALSE — so it must be
// transmitted explicitly rather than omitted as "already the default".
const ALWAYS_SEND: Record<string, boolean> = { stock_footage_enabled: true };

// <input type=color> cannot express "unset" — it always reports a value, so an
// untouched picker would send #000000 and override the template palette. A
// colour is only sent once the user actually edits it.
const colorDirty: Record<string, boolean> = {};

function collectSettings(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const els = settingsEl.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-key]");

  for (const el of Array.from(els)) {
    const key = el.dataset["key"];
    if (!key) continue;
    const type = (el as HTMLInputElement).type;
    let v: unknown;

    if (type === "checkbox") v = (el as HTMLInputElement).checked;
    else if (type === "range") v = parseFloat(el.value);
    else if (type === "color") {
      if (!colorDirty[el.id]) continue;
      v = el.value;
    } else v = el.value;

    if (key === "caption_offset") v = Math.round(v as number);
    // The schema wants caption_font_size as a STRING.
    if (key === "caption_font_size") v = String(Math.round(v as number));
    if (v === "" || v === null || typeof v === "undefined") continue;
    if (!ALWAYS_SEND[key] && type !== "color" && v === DEFAULTS[key]) continue;
    out[key] = v;
  }

  // Volume is meaningless without a track.
  if (!out["bgm_track_id"]) delete out["bgm_volume"];
  // Caption sub-settings are meaningless when captions are off.
  if (!(document.getElementById("s-cap") as HTMLInputElement).checked) {
    for (const k of ["caption_position", "caption_font_family", "caption_font_size", "caption_offset"]) {
      delete out[k];
    }
  }
  return out;
}

function stopBgm(): void {
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio = null;
  }
  const btn = document.getElementById("bgm-play") as HTMLButtonElement;
  btn.classList.remove("playing");
  btn.textContent = "▶";
}

function renderBgm(): void {
  const sel = document.getElementById("s-bgm") as HTMLSelectElement;
  for (const t of data.bgm_tracks ?? []) {
    const o = document.createElement("option");
    o.value = t.track_id;
    o.textContent = (t.display_name || t.track_id) + (t.mood ? ` · ${t.mood}` : "");
    o.dataset["url"] = t.r2_url || "";
    sel.appendChild(o);
  }
}

function applyPlanGate(): void {
  // Fail closed: paid-only lengths stay disabled unless we know the plan is
  // paid. The backend rejects them with 403 regardless, so this only avoids
  // letting the user pick something that then fails.
  if (data.is_paid) return;
  const opts = document.querySelectorAll<HTMLOptionElement>("#s-length option[data-paid]");
  for (const o of Array.from(opts)) {
    o.disabled = true;
    o.textContent += " · Pro";
  }
}

function wireControls(): void {
  // Live range read-outs.
  const ranges: Array<[string, string, (v: number) => string]> = [
    ["s-bgmvol", "s-bgmvol-val", (v) => `${Math.round(v * 100)}%`],
    ["s-speed", "s-speed-val", (v) => `${v.toFixed(2)}×`],
    ["s-capsize", "s-capsize-val", (v) => `${Math.round(v)}px`],
    ["s-capoff", "s-capoff-val", (v) => String(Math.round(v))],
  ];
  for (const [id, valId, fmt] of ranges) {
    const el = document.getElementById(id) as HTMLInputElement;
    const out = document.getElementById(valId) as HTMLElement;
    el.addEventListener("input", () => {
      out.textContent = fmt(parseFloat(el.value));
    });
  }

  // Captions toggle reveals its sub-settings.
  const cap = document.getElementById("s-cap") as HTMLInputElement;
  cap.addEventListener("change", () => {
    (document.getElementById("capgroup") as HTMLElement).hidden = !cap.checked;
  });

  // Volume row only matters once a track is chosen.
  const bgm = document.getElementById("s-bgm") as HTMLSelectElement;
  bgm.addEventListener("change", () => {
    (document.getElementById("bgm-vol-row") as HTMLElement).hidden = !bgm.value;
    stopBgm();
  });

  // BGM preview.
  const bgmBtn = document.getElementById("bgm-play") as HTMLButtonElement;
  bgmBtn.addEventListener("click", () => {
    if (bgmAudio) {
      stopBgm();
      return;
    }
    const opt = bgm.selectedOptions[0];
    const url = opt?.dataset["url"];
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = parseFloat((document.getElementById("s-bgmvol") as HTMLInputElement).value);
    audio.addEventListener("ended", stopBgm);
    audio.addEventListener("error", () => {
      stopBgm();
      bgmBtn.classList.add("unavailable");
      bgmBtn.title = "Preview unavailable here";
    });
    void audio.play().catch(() => {
      stopBgm();
      bgmBtn.classList.add("unavailable");
    });
    bgmAudio = audio;
    bgmBtn.classList.add("playing");
    bgmBtn.textContent = "■";
  });

  // Colours are opt-in. The swatch stays hidden and the colour unsent until the
  // user clicks Customise; clicking again reverts to the template's palette.
  // Picking a colour marks it dirty, which is what collectSettings() checks.
  for (const el of Array.from(settingsEl.querySelectorAll<HTMLInputElement>("input[type=color]"))) {
    el.addEventListener("input", () => {
      colorDirty[el.id] = true;
    });
  }
  for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>(".clearcol"))) {
    const targetId = btn.dataset["toggle"];
    if (!targetId) continue;
    const input = document.getElementById(targetId) as HTMLInputElement | null;
    const note = document.getElementById(`${targetId}-note`) as HTMLElement | null;
    if (!input) continue;

    btn.addEventListener("click", () => {
      const turningOn = input.hidden;
      input.hidden = !turningOn;
      if (note) note.hidden = turningOn;
      btn.textContent = turningOn ? "Use template colour" : "Customise";
      if (turningOn) {
        // Opening the picker is itself the opt-in — otherwise a user who likes
        // the initial swatch would click Customise and still send nothing.
        colorDirty[input.id] = true;
      } else {
        delete colorDirty[input.id];
      }
    });
  }

  createBtn.addEventListener("click", () => void submit());
}

/**
 * Render the collected args as a readable sentence for the chat.
 *
 * app.sendMessage stages the text in the composer for the user to send, so raw
 * JSON reads badly there. Enums and booleans are humanised because the model can
 * map them back from the create_project schema. IDs and hex colours are printed
 * VERBATIM — a friendly label is not reversible. That costs little here: the
 * BGM ids (tools.py BGM_TRACK_IDS) are already readable words and are schema-
 * constrained enums, so "music: moment_of_peace" both reads fine and removes any
 * guessing.
 *
 * Only keys PRESENT in `args` appear. collectSettings() already drops anything
 * left at its default, so an untouched panel yields the bare "create the video".
 */
function describeSettings(args: Record<string, unknown>): string {
  const bits: string[] = [];
  const say = (k: string, fmt: (v: unknown) => string) => {
    if (k in args) bits.push(fmt(args[k]));
  };

  say("video_length", (v) => `${v} length`);
  say("video_style", (v) => `${v} style`);
  say("aspect_ratio", (v) => `${v}`);
  say("stock_footage_enabled", (v) => (v ? "stock footage on" : "stock footage off"));
  say("bgm_track_id", (v) => `music: ${v}`);
  say("bgm_volume", (v) => `music volume ${Math.round((v as number) * 100)}%`);
  say("playback_speed", (v) => `${v}× speed`);
  say("captions_enabled", (v) => (v ? "captions on" : "captions off"));
  say("caption_position", (v) => `captions at ${String(v).replace("_", " ")}`);
  say("caption_font_family", (v) => `caption font ${v}`);
  say("caption_font_size", (v) => `caption size ${v}px`);
  say("caption_offset", (v) => `caption offset ${v}`);
  say("accent_color", (v) => `accent ${v}`);
  say("bg_color", (v) => `background ${v}`);
  say("text_color", (v) => `text colour ${v}`);

  return bits.length ? `create the video — ${bits.join(", ")}` : "create the video";
}

async function submit(): Promise<void> {
  const args = collectSettings();
  createBtn.disabled = true;
  createBtn.textContent = "Creating…";
  settingsEl.classList.add("locked");
  stopBgm();

  // Announce the settings and let the MODEL call create_project — the same
  // mechanism both galleries use for their selections.
  //
  // This widget previously called app.callServerTool("create_project") itself.
  // claude.ai silently declines app-initiated tools/call: the request reaches
  // the transport (POST /mcp/sse → 200) but is dropped before dispatch(), so no
  // MCP_CALL line is ever logged and no consent prompt is shown. Routing through
  // the model is also the only way the template and voice reach create_project —
  // those live in the chat text the galleries emitted ("use nightfall"), which
  // this widget cannot see.
  //
  // `role` is required by the ui/message schema — omitting it makes the host
  // reject the request and the click silently does nothing.
  try {
    await app.sendMessage({
      role: "user",
      content: [
        {
          type: "text",
          text: describeSettings(args),
        },
      ],
    });
    barStatus.textContent = "Creating your video…";
    createBtn.textContent = "Created ✓";
  } catch (err) {
    console.error("[b2v] sendMessage failed:", err);
    createBtn.disabled = false;
    createBtn.textContent = "Retry";
    settingsEl.classList.remove("locked");
  }
}

function render(d: SettingsData): void {
  if (ready) return;
  data = d;
  ready = true;
  renderBgm();
  applyPlanGate();
  wireControls();
  statusEl.hidden = true;
  settingsEl.hidden = false;
  barEl.hidden = false;
}

function fromToolResult(result: unknown): SettingsData | null {
  const r = result as { structuredContent?: SettingsData } | undefined;
  const sc = r?.structuredContent;
  // bgm_tracks may legitimately be empty, so presence of the key is the signal.
  return sc && ("bgm_tracks" in sc || "is_paid" in sc) ? sc : null;
}

app.ontoolresult = (params) => {
  const d = fromToolResult(params);
  if (d) render(d);
};

async function boot(): Promise<void> {
  await app.connect();

  // If the host delivered the result before connect() resolved, ontoolresult
  // has already fired. Otherwise fall back to the non-MCP-Apps data channels.
  if (!ready) {
    const w = window as unknown as {
      openai?: { toolOutput?: SettingsData };
      __B2V_SETTINGS__?: SettingsData;
    };
    render(w.openai?.toolOutput ?? w.__B2V_SETTINGS__ ?? {});
  }
}

boot().catch((err) => {
  statusEl.textContent = "Could not connect to the chat host.";
  console.error("[b2v] MCP Apps connect failed:", err);
});
