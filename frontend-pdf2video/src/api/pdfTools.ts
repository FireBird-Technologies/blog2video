import api from "./http";

/**
 * Client for the login-gated PDF tools (backend: app/routers/free_tools.py).
 *
 * Every call here needs a JWT — the axios instance in ./http.ts attaches it
 * from localStorage, and the backend returns 401 without one. That is the whole
 * reason the widgets require sign-in before they will run: the work happens on
 * our machines, against real models.
 *
 * The flow is always two steps. `extractDocument` turns the upload into text
 * (server-side, using the same extractor the main pipeline runs), then one of
 * the generators turns that text into something. They are separate calls so a
 * document that will not parse fails immediately and visibly, rather than
 * halfway through a generation.
 */

export interface ExtractedDocument {
  text: string;
  characters: number;
  words: number;
}

export interface PdfSummary {
  summary: string;
  key_points: string[];
  key_terms: string[];
  /** True when the document exceeded the prompt budget and was clipped. */
  truncated: boolean;
}

export interface ScriptScene {
  title: string;
  narration: string;
}

export interface PdfScript {
  video_title: string;
  scenes: ScriptScene[];
  truncated: boolean;
}

export interface StoryboardSlide {
  headline: string;
  /** Pipe-separated on-screen lines, e.g. "First line | Second line". */
  on_screen: string;
  narration: string;
}

export interface PdfStoryboard {
  deck_title: string;
  slides: StoryboardSlide[];
  truncated: boolean;
}

export type SummaryLength = "brief" | "standard" | "detailed";
export type ScriptLength = "short" | "standard" | "long";

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<ExtractedDocument>("/free-tools/extract-document", form, {
    // Let the browser set the multipart boundary; the instance default of
    // application/json would break the upload.
    headers: { "Content-Type": undefined },
  });
  return res.data;
}

export async function summarizeDocument(
  document: string,
  length: SummaryLength
): Promise<PdfSummary> {
  const res = await api.post<PdfSummary>("/free-tools/pdf-summary", { document, length });
  return res.data;
}

export async function scriptFromDocument(
  document: string,
  length: ScriptLength,
  maxWordsPerScene: number
): Promise<PdfScript> {
  const res = await api.post<PdfScript>("/free-tools/pdf-video-script", {
    document,
    length,
    max_words_per_scene: maxWordsPerScene,
  });
  return res.data;
}

export async function storyboardFromDocument(
  document: string,
  slideCount: number
): Promise<PdfStoryboard> {
  const res = await api.post<PdfStoryboard>("/free-tools/pdf-storyboard", {
    document,
    slide_count: slideCount,
  });
  return res.data;
}

/** Usage against a tool's allowance, as reported by the backend. */
export interface ToolQuota {
  used: number;
  limit: number;
}

/**
 * Current usage for every /tools generator, keyed by the backend's tool name
 * (see TOOL_QUOTAS in app/models/user.py). Lets a widget show what is left
 * before the user spends it, instead of only failing afterwards.
 */
export async function fetchToolQuotas(): Promise<Record<string, ToolQuota>> {
  const res = await api.get<{ quotas: Record<string, ToolQuota> }>("/free-tools/quota");
  return res.data.quotas ?? {};
}

export interface NarrationResult {
  audio: Blob;
  /** Absent if the headers are unreadable (see below) — callers should refetch. */
  quota: ToolQuota | null;
}

/**
 * Synthesize narration, returning the mp3 plus the caller's remaining allowance.
 *
 * The body is the audio itself, so the usage counts ride back on `x-tool-used`
 * and `x-tool-limit`. Both are simple response headers, exposed to JS on a
 * same-origin call; a cross-origin deployment would need them in the backend's
 * CORS `expose_headers`, hence the null-safe parse rather than an assumption.
 */
export async function narrateText(
  text: string,
  voiceGender: string,
  voiceAccent?: string
): Promise<NarrationResult> {
  const res = await api.post(
    "/free-tools/pdf-narration",
    { text, voice_gender: voiceGender, voice_accent: voiceAccent ?? null },
    { responseType: "blob" }
  );
  const used = Number(res.headers?.["x-tool-used"]);
  const limit = Number(res.headers?.["x-tool-limit"]);
  return {
    audio: res.data as Blob,
    quota: Number.isFinite(used) && Number.isFinite(limit) ? { used, limit } : null,
  };
}

/**
 * Pull a displayable message out of an axios error.
 *
 * The backend sends FastAPI's `{detail: "..."}` for the cases a user can act on
 * (unsupported file type, scanned PDF, file too large), so surfacing that
 * verbatim is much more useful than a generic failure string. A blob response
 * type means an error body arrives as a Blob and has to be read back as text.
 */
export async function toolErrorMessage(err: unknown, fallback: string): Promise<string> {
  const response = (err as { response?: { data?: unknown; status?: number } })?.response;
  if (!response) return fallback;
  if (response.status === 401) return "Your session expired. Please sign in again.";

  let data = response.data;
  if (data instanceof Blob) {
    try {
      data = JSON.parse(await data.text());
    } catch {
      return fallback;
    }
  }
  const detail = (data as { detail?: unknown })?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  return fallback;
}
