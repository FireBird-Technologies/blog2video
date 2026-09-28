import { useEffect, useState } from "react";
import { FRONTEND_BASE_URL } from "../config";
import {
  ApiError,
  beginConnection,
  clearCurrentProject,
  createProject,
  getAccount,
  getCatalog,
  getCurrentProject,
  getEmbed,
  getProjectStatus,
  getRenderStatus,
  revokeConnection,
  uploadProjectLogo,
  type Account,
  type Catalog,
  type ProjectStatus,
  type VideoStylesResponse,
} from "../api/client";
import { extractArticleText } from "../lib/extract";
import {
  clearActiveProject,
  clearAuth,
  getActiveProject,
  getAuth,
  setActiveProject,
  setPendingConnection,
} from "../lib/storage";

type Stage =
  | { kind: "loading" }
  | { kind: "disconnected" }
  | { kind: "connecting" }
  | { kind: "ready"; catalog: Catalog }
  | { kind: "generating"; projectId: number; label: string }
  | { kind: "review"; projectId: number; reviewType: "script" | "footage" }
  | { kind: "scenes_ready"; projectId: number }
  | { kind: "rendering"; projectId: number; progress: number }
  | { kind: "done"; projectId: number; videoUrl: string; previewUrl: string | null }
  | { kind: "limit_reached" }
  | { kind: "error"; message: string };

function formatVoiceSubtitle(gender?: string | null, accent?: string | null, description?: string | null): string {
  const parts: string[] = [];
  if (gender) parts.push(gender.trim());
  if (accent) parts.push(accent.trim());
  const left = parts.join(" • ");
  const desc = (description ?? "").trim();
  if (left && desc) return `${left} — ${desc}`;
  return desc || left;
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </svg>
  );
}

function CheckIcon({ className = "w-2.5 h-2.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Logo({ size }: { size: "small" | "large" }) {
  return (
    <div
      className={
        size === "small"
          ? "w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-[11px]"
          : "w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
      }
    >
      B2V
    </div>
  );
}

const STEP_LABELS = ["Content", "Template", "Voice"];

/** Same visual language as the webapp's own StepIndicator in BlogUrlForm. */
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex flex-col items-center gap-2 mb-5">
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full text-[10px] font-semibold flex items-center justify-center transition-all ${
                n === current
                  ? "bg-purple-600 text-white"
                  : n < current
                  ? "bg-purple-100 text-purple-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {n < current ? <CheckIcon className="w-3 h-3" /> : n}
            </div>
            {n < 3 && <div className={`h-px w-8 transition-all ${n < current ? "bg-purple-300" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>
      <span className="text-[11px] text-gray-400 font-medium">
        Step {current} — {STEP_LABELS[current - 1]}
      </span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">{children}</label>;
}

const inputClass =
  "w-full px-3 py-2 bg-white/80 border border-gray-200/60 rounded-lg text-[13px] text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all";

type VideoLength = "auto" | "short" | "medium" | "detailed" | "more_detailed";

/** Mirrors the webapp's videoStyleOptionsForBlogUrlForm: Auto first, then only
 *  the user's actually-selected styles (their saved builtins, Your Style if
 *  learned, and any named custom styles) — never a hardcoded list. */
function videoStyleOptionsFromCatalog(video_styles: VideoStylesResponse | undefined): Array<{ value: string; label: string }> {
  if (!video_styles) return [{ value: "auto", label: "Auto" }];
  const auto = video_styles.auto_style ? [{ value: "auto", label: video_styles.auto_style.name }] : [];
  const byId = new Map(video_styles.styles.map((style) => [style.id, style]));
  const rest = video_styles.selected_ids.flatMap((id) => {
    const style = byId.get(id);
    return style ? [{ value: id, label: style.name }] : [];
  });
  return [...auto, ...rest];
}

const VIDEO_LENGTHS: Array<{ value: VideoLength; label: string; paid?: boolean }> = [
  { value: "auto", label: "Auto" },
  { value: "short", label: "Short · 30 sec–1 min" },
  { value: "medium", label: "Medium · 1–3 mins" },
  { value: "detailed", label: "Detailed · 3–8 mins", paid: true },
  { value: "more_detailed", label: "More detailed · 8+ mins", paid: true },
];

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function Popup() {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [tabUrl, setTabUrl] = useState("");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [voiceId, setVoiceId] = useState<string>("");
  const [account, setAccount] = useState<Account | null>(null);
  const [videoStyle, setVideoStyle] = useState<string>("auto");
  const [videoLength, setVideoLength] = useState<VideoLength>("auto");
  const [aspectRatio, setAspectRatio] = useState<"landscape" | "portrait">("landscape");
  const [stockFootageEnabled, setStockFootageEnabled] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPosition, setLogoPosition] = useState<"top_left" | "top_right" | "bottom_left" | "bottom_right">("bottom_right");
  const [logoOpacity, setLogoOpacity] = useState(0.9);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const previewAudioRef = useState<{ current: HTMLAudioElement | null }>({ current: null })[0];

  function playVoicePreview(v: { voice_id: string; preview_url: string }) {
    if (playingVoiceId === v.voice_id) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPlayingVoiceId(null);
      return;
    }
    previewAudioRef.current?.pause();
    const audio = new Audio(v.preview_url);
    audio.addEventListener("ended", () => setPlayingVoiceId(null));
    previewAudioRef.current = audio;
    setPlayingVoiceId(v.voice_id);
    void audio.play();
  }

  useEffect(() => {
    void bootstrap();
    // The popup is destroyed the moment the approval tab steals focus, so any
    // in-popup polling loop dies with it. The background service worker keeps
    // polling via chrome.alarms and writes the token to storage once approved
    // (see background.ts) — this listener catches that write whenever the
    // popup happens to be open, instead of relying on a doomed setInterval.
    const onStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && "b2v_auth" in changes && changes.b2v_auth.newValue) {
        void bootstrap();
      }
    };
    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  async function bootstrap() {
    const auth = await getAuth();
    if (!auth) {
      setStage({ kind: "disconnected" });
      return;
    }
    try {
      // The database is authoritative. Local storage makes the first paint fast,
      // but can be stale or missing after the popup/browser has been closed.
      const cached = await getActiveProject();
      if (cached?.phase === "done" && cached.videoUrl) {
        setStage({
          kind: "done",
          projectId: cached.projectId,
          videoUrl: cached.videoUrl,
          previewUrl: cached.previewUrl ?? null,
        });
      }
      let current: ProjectStatus | null = null;
      try {
        current = await getCurrentProject();
      } catch (err) {
        // During a rolling/local backend restart the extension may briefly hit
        // a server that predates the database-backed /projects/current route.
        // The cached ID can still be verified through the existing scoped
        // status endpoint, so do not strand the user on a generic 404 screen.
        if (!(err instanceof ApiError) || err.status !== 404) throw err;
        if (cached?.projectId) {
          try {
            current = await getProjectStatus(cached.projectId);
          } catch (statusErr) {
            if (!(statusErr instanceof ApiError) || statusErr.status !== 404) throw statusErr;
          }
        }
      }
      if (current) {
        await restoreProject(current);
        return;
      }
      await clearActiveProject();
      const [catalog, accountResult] = await Promise.all([getCatalog(), getAccount()]);
      setAccount(accountResult);
      setStage({ kind: "ready", catalog });
      setWizardStep(1);
      if (catalog.templates[0]) setTemplateId(catalog.templates[0].id);
      await loadActiveTab();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearAuth();
        setStage({ kind: "disconnected" });
      } else {
        setStage({ kind: "error", message: (err as Error).message });
      }
    }
  }

  async function restoreProject(status: ProjectStatus) {
    const normalized = status.status.toLowerCase();
    if (status.r2_video_url) {
      await finishWithVideo(status.project_id, status.r2_video_url);
      return;
    }
    if (status.error || normalized === "error" || normalized === "failed") {
      setStage({ kind: "error", message: status.error || "Video generation failed." });
      return;
    }
    if (normalized === "rendering") {
      await setActiveProject({ projectId: status.project_id, phase: "rendering" });
      setStage({ kind: "rendering", projectId: status.project_id, progress: 0 });
      pollRender(status.project_id);
      return;
    }
    if (normalized === "awaiting_script_review") {
      await setActiveProject({ projectId: status.project_id, phase: "review" });
      setStage({ kind: "review", projectId: status.project_id, reviewType: "script" });
      return;
    }
    if (normalized === "awaiting_stock_footage_review" || normalized === "awaiting_footage") {
      await setActiveProject({ projectId: status.project_id, phase: "review" });
      setStage({ kind: "review", projectId: status.project_id, reviewType: "footage" });
      return;
    }
    if (normalized === "generated" || normalized === "done") {
      await setActiveProject({ projectId: status.project_id, phase: "scenes_ready" });
      setStage({ kind: "scenes_ready", projectId: status.project_id });
      return;
    }
    await setActiveProject({ projectId: status.project_id, phase: "generating" });
    setStage({ kind: "generating", projectId: status.project_id, label: describeStep(status) });
    pollStatus(status.project_id);
  }

  async function loadActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      setExtractionFailed(true);
      return;
    }
    setTabUrl(tab.url);
    setTitle(tab.title || "");
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.documentElement.outerHTML,
      });
      const parsed = new DOMParser().parseFromString(result as string, "text/html");
      const extracted = extractArticleText(parsed);
      setContent(extracted);
      setExtractionFailed(!extracted.trim());
    } catch {
      // Restricted page (chrome://, webstore, etc.) — user can paste text manually.
      setExtractionFailed(true);
    }
  }

  async function handleConnect() {
    setStage({ kind: "connecting" });
    try {
      const label = `Chrome — ${navigator.platform || "extension"}`;
      const begun = await beginConnection(label);
      await setPendingConnection({ connectionId: begun.connection_id, deviceCode: begun.device_code });
      chrome.runtime.sendMessage({ type: "b2v-start-polling" });
      chrome.tabs.create({ url: begun.verification_url });
      pollForConnection();
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }

  function pollForConnection() {
    // The popup closes the instant `chrome.tabs.create` steals focus, so this
    // interval alone never fires — the background service worker's alarm-based
    // poll (background.ts) is what actually detects approval and writes the
    // token. This interval only helps if the popup is reopened and left open
    // before the background worker finishes; the storage listener below is
    // what catches the common case where the token lands after the popup
    // (re)opens.
    const interval = setInterval(async () => {
      const auth = await getAuth();
      if (auth) {
        clearInterval(interval);
        chrome.runtime.sendMessage({ type: "b2v-stop-polling" });
        await bootstrap();
      }
    }, 1500);
    return () => clearInterval(interval);
  }

  async function handleDisconnect() {
    try {
      await revokeConnection();
    } catch {
      // token may already be invalid; clear locally regardless
    }
    await clearAuth();
    await clearActiveProject();
    setStage({ kind: "disconnected" });
  }

  async function handleGenerate() {
    if (!tabUrl || !content.trim() || !templateId) return;
    const contentHash = await sha256Hex(content);
    const idempotencyKey = await sha256Hex(`${tabUrl}|${contentHash}|${Date.now()}`);
    setStage({ kind: "generating", projectId: 0, label: "Starting…" });
    try {
      const created = await createProject({
        source_url: tabUrl,
        content,
        idempotency_key: idempotencyKey,
        content_hash: contentHash,
        title: title || "Untitled page",
        template: templateId,
        video_style: videoStyle,
        video_length: videoLength,
        aspect_ratio: aspectRatio,
        stock_footage_enabled: stockFootageEnabled,
        script_review_enabled: false,
        logo_position: logoPosition,
        logo_opacity: logoOpacity,
        custom_voice_id: voiceId || undefined,
      });
      await setActiveProject({ projectId: created.project_id, phase: "generating" });
      if (logoFile) await uploadProjectLogo(created.project_id, logoFile);
      pollStatus(created.project_id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setStage({ kind: "limit_reached" });
        return;
      }
      setStage({ kind: "error", message: (err as Error).message });
    }
  }

  function pollStatus(projectId: number) {
    const interval = setInterval(async () => {
      try {
        const status: ProjectStatus = await getProjectStatus(projectId);
        setStage({ kind: "generating", projectId, label: describeStep(status) });
        if (status.error) {
          clearInterval(interval);
          await clearActiveProject();
          setStage({ kind: "error", message: status.error });
          return;
        }
        const normalized = status.status.toLowerCase();
        if (normalized === "awaiting_script_review") {
          clearInterval(interval);
          await setActiveProject({ projectId, phase: "review" });
          setStage({ kind: "review", projectId, reviewType: "script" });
          return;
        }
        if (normalized === "awaiting_stock_footage_review" || normalized === "awaiting_footage") {
          clearInterval(interval);
          await setActiveProject({ projectId, phase: "review" });
          setStage({ kind: "review", projectId, reviewType: "footage" });
          return;
        }
        if (["generated", "done"].includes(normalized)) {
          clearInterval(interval);
          await setActiveProject({ projectId, phase: "scenes_ready" });
          setStage({ kind: "scenes_ready", projectId });
        }
      } catch (err) {
        clearInterval(interval);
        await clearActiveProject();
        setStage({ kind: "error", message: (err as Error).message });
      }
    }, 3000);
  }

  function pollRender(projectId: number) {
    const interval = setInterval(async () => {
      try {
        const render = await getRenderStatus(projectId);
        setStage({ kind: "rendering", projectId, progress: render.progress });
        if (render.error) {
          clearInterval(interval);
          setStage({ kind: "error", message: render.error });
          return;
        }
        if (render.r2_video_url) {
          clearInterval(interval);
          await finishWithVideo(projectId, render.r2_video_url);
        }
      } catch (err) {
        clearInterval(interval);
        await clearActiveProject();
        setStage({ kind: "error", message: (err as Error).message });
      }
    }, 3000);
  }

  async function finishWithVideo(projectId: number, videoUrl: string) {
    let previewUrl: string | null = null;
    try {
      const embed = await getEmbed(projectId);
      previewUrl = embed.preview_url;
    } catch {
      // preview link is optional
    }
    // Kept (not cleared) so reopening the popup after the video finishes still shows
    // it — otherwise the popup closing right as the video lands would silently lose
    // the result and drop back to the template picker on next open.
    await setActiveProject({ projectId, phase: "done", videoUrl, previewUrl });
    setStage({ kind: "done", projectId, videoUrl, previewUrl });
  }

  async function handleStartOver() {
    try {
      await clearCurrentProject();
      await clearActiveProject();
      await bootstrap();
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }

  return (
    <div className="flex flex-col bg-white text-gray-900 font-sans">
      <header className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100">
        <Logo size="small" />
        <span className="text-sm font-semibold text-gray-900">Blog2Video</span>
        {stage.kind === "ready" && (
          <button className="ml-auto text-xs text-gray-400 hover:text-purple-600 transition-colors" onClick={handleDisconnect}>
            Disconnect
          </button>
        )}
      </header>

      {stage.kind === "loading" && (
        <div className="flex flex-col gap-2.5 p-4">
          <div className="h-9 rounded-xl bg-purple-50 animate-pulse" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-[68px] rounded-lg bg-purple-50 animate-pulse" />
            <div className="h-[68px] rounded-lg bg-purple-50 animate-pulse" />
            <div className="h-[68px] rounded-lg bg-purple-50 animate-pulse" />
          </div>
          <div className="h-14 rounded-xl bg-purple-50 animate-pulse" />
          <div className="h-14 rounded-xl bg-purple-50 animate-pulse" />
        </div>
      )}

      {stage.kind === "disconnected" && (
        <div className="flex flex-col items-center text-center gap-2 px-4 py-12">
          <div className="w-16 h-16 mb-2 bg-purple-100 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Turn this page into a video</h1>
          <p className="text-sm text-gray-400 max-w-xs">
            Connect your Blog2Video account to generate a narrated video from the article you're reading.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-[13px] font-medium rounded-lg transition-colors"
          >
            Connect Blog2Video
          </button>
        </div>
      )}

      {stage.kind === "connecting" && (
        <div className="flex flex-col items-center text-center gap-2 px-4 py-10">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
          <p className="text-sm font-semibold text-gray-900 mt-1">Waiting for approval…</p>
          <p className="text-sm text-gray-400 max-w-xs">
            Approve the connection in the tab that just opened, then come back here — this will finish automatically.
          </p>
        </div>
      )}

      {stage.kind === "ready" && (
        <div className="p-4">
          <StepIndicator current={wizardStep} />

          {wizardStep === 1 && (
            <div className="flex flex-col space-y-4">
              <div>
                <FieldLabel>Page</FieldLabel>
                <input className={`${inputClass} text-gray-500 bg-gray-50`} value={tabUrl} readOnly />
              </div>
              {extractionFailed && (
                <div>
                  <FieldLabel>Article text</FieldLabel>
                  <textarea
                    className={inputClass}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    placeholder="Couldn't auto-extract this page — paste the article text here."
                  />
                </div>
              )}

              <div>
                <FieldLabel>Video Format</FieldLabel>
                <div className="flex gap-2">
                  {([
                    { value: "landscape", label: "Landscape", sub: "YouTube" },
                    { value: "portrait", label: "Portrait", sub: "TikTok / Reels" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAspectRatio(opt.value)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-0.5 ${
                        aspectRatio === opt.value
                          ? "bg-purple-600 text-white shadow-sm"
                          : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/60"
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className={`text-[9px] ${aspectRatio === opt.value ? "text-purple-200" : "text-gray-300"}`}>
                        {opt.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Estimated duration</FieldLabel>
                <select
                  className={inputClass}
                  value={videoLength}
                  onChange={(event) => setVideoLength(event.target.value as VideoLength)}
                >
                  {VIDEO_LENGTHS.map((option) => {
                    const locked = option.paid && account?.plan?.toLowerCase() === "free";
                    return (
                      <option key={option.value} value={option.value} disabled={locked}>
                        {option.label}
                        {locked ? " · Paid only" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Use stock footage
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-xl border border-gray-200/60 hover:border-purple-300/60 transition-all bg-white">
                  <input
                    type="checkbox"
                    checked={stockFootageEnabled}
                    onChange={(event) => setStockFootageEnabled(event.target.checked)}
                    className="w-4 h-4 shrink-0 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
                  />
                  <span className="text-xs text-gray-700 min-w-0">Insert stock footage automatically</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Logo <span className="text-gray-300 font-normal">(optional · max 2 MB)</span>
                </label>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-50 text-purple-600 text-xs font-medium cursor-pointer hover:bg-purple-100 transition-colors">
                  Choose file
                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (file && file.size > 2 * 1024 * 1024) {
                        event.target.value = "";
                        setStage({ kind: "error", message: "Logo must be under 2 MB." });
                        return;
                      }
                      setLogoFile(file);
                    }}
                  />
                </label>
                {logoFile && (
                  <div className="mt-2 grid grid-cols-2 gap-2 items-center">
                    <select
                      aria-label="Logo position"
                      value={logoPosition}
                      onChange={(event) => setLogoPosition(event.target.value as typeof logoPosition)}
                      className={inputClass}
                    >
                      <option value="top_left">Top left</option>
                      <option value="top_right">Top right</option>
                      <option value="bottom_left">Bottom left</option>
                      <option value="bottom_right">Bottom right</option>
                    </select>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] text-gray-400">Opacity {Math.round(logoOpacity * 100)}%</span>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={Math.round(logoOpacity * 100)}
                        onChange={(event) => setLogoOpacity(Number(event.target.value) / 100)}
                        className="w-full accent-purple-600"
                      />
                    </label>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!content.trim()}
                onClick={() => setWizardStep(2)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white text-[13px] font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Continue <span aria-hidden="true">→</span>
              </button>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="flex flex-col space-y-4">
              <div>
                <FieldLabel>Template</FieldLabel>
                <div className="border border-gray-200/60 rounded-xl p-2.5 max-h-[300px] overflow-y-auto bg-gray-50/40">
                  <div className="grid grid-cols-3 gap-2">
                    {stage.catalog.templates.map((t) => {
                      const isSelected = t.id === templateId;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTemplateId(t.id)}
                          type="button"
                          className={`relative rounded-lg overflow-hidden cursor-pointer transition-all ${
                            isSelected
                              ? "border-2 border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                              : "border-2 border-gray-200/60 hover:border-purple-300/60"
                          }`}
                        >
                          <div className="relative h-[56px] overflow-hidden bg-gray-100">
                            {t.preview_url ? (
                              <img src={t.preview_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-[9px] px-1 text-center">
                                {t.name}
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shadow-sm">
                                <CheckIcon className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <div className={`px-1.5 py-1 transition-colors ${isSelected ? "bg-purple-50/80" : "bg-white/80"}`}>
                            <div className="text-[10px] font-semibold text-gray-800 truncate">{t.name}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    Video Style
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100/60 rounded-xl justify-center">
                  {videoStyleOptionsFromCatalog(stage.catalog.video_styles).map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setVideoStyle(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        videoStyle === option.value ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <span aria-hidden="true">←</span> Back
                </button>
                <button
                  type="button"
                  disabled={!templateId}
                  onClick={() => setWizardStep(3)}
                  className="py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white text-[13px] font-medium transition-colors flex items-center justify-center gap-2"
                >
                  Continue <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="flex flex-col space-y-4">
              <div>
                <FieldLabel>Voice — tap to preview</FieldLabel>
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {stage.catalog.voices.length === 0 && <p className="text-xs text-gray-400">Using default voice.</p>}
                  {stage.catalog.voices.map((v) => {
                    const isSelected = v.voice_id === voiceId;
                    const isPlaying = playingVoiceId === v.voice_id;
                    const subtitle = formatVoiceSubtitle(v.gender, v.accent, v.description);
                    return (
                      <div
                        key={v.voice_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setVoiceId(v.voice_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setVoiceId(v.voice_id);
                          }
                        }}
                        className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-all ${
                          isSelected
                            ? "border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.1)] bg-purple-50/60"
                            : "border-gray-200/60 hover:border-purple-300/60 bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playVoicePreview(v);
                          }}
                          aria-label={isPlaying ? `Pause ${v.name}` : `Preview ${v.name}`}
                          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                            isPlaying ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-600"
                          }`}
                        >
                          {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[13px] font-semibold truncate ${isSelected ? "text-purple-600" : "text-gray-900"}`}>
                            {v.name}
                          </div>
                          {subtitle && <div className="text-[11px] text-gray-400 truncate">{subtitle}</div>}
                        </div>
                        {isSelected && (
                          <span className="shrink-0 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center">
                            <CheckIcon />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {account?.can_create_video === false && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200/60">
                  <p className="text-[11px] text-amber-700 flex-1">
                    You've used all your videos for this period.{" "}
                    <button
                      type="button"
                      onClick={() => chrome.tabs.create({ url: `${FRONTEND_BASE_URL}/subscription` })}
                      className="font-semibold underline hover:text-amber-900"
                    >
                      Upgrade your plan
                    </button>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <span aria-hidden="true">←</span> Back
                </button>
                <button
                  type="button"
                  disabled={!content.trim() || !templateId}
                  onClick={account?.can_create_video === false ? () => setStage({ kind: "limit_reached" }) : handleGenerate}
                  className="py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white text-[13px] font-medium transition-colors"
                >
                  Create video
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {stage.kind === "generating" && (
        <div className="flex flex-col items-center text-center gap-2 px-4 py-10">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
          <p className="text-sm font-semibold text-gray-900 mt-1">{stage.label}</p>
          <p className="text-sm text-gray-400 max-w-xs">
            Writing your script and building the scenes — this usually takes a minute or two.
          </p>
        </div>
      )}

      {stage.kind === "scenes_ready" && (
        <div className="flex flex-col gap-3 px-4 py-8">
          <div className="flex flex-col items-center text-center gap-2">
            <span className="inline-flex items-center gap-1.5 self-center bg-emerald-50 text-emerald-600 text-xs font-semibold px-2.5 py-1 rounded-full">
              <CheckIcon className="w-3 h-3" /> Completed
            </span>
            <p className="text-sm font-semibold text-gray-900 mt-1">Your Video is Ready.</p>
            <p className="text-sm text-gray-400 max-w-xs">
              Open the project on Blog2Video to preview it, make any edits, and render the final video when you're ready.
            </p>
            <button
              type="button"
              onClick={() => chrome.tabs.create({ url: `${FRONTEND_BASE_URL}/project/${stage.projectId}` })}
              className="mt-1 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-[13px] font-medium rounded-lg transition-colors"
            >
              Preview & edit on Blog2Video
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleStartOver()}
            className="self-center text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Create another video
          </button>
        </div>
      )}

      {stage.kind === "rendering" && (
        <div className="flex flex-col items-center text-center gap-2 px-4 py-10">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: `conic-gradient(#9333ea ${Math.min(100, Math.round(stage.progress))}%, #faf5ff 0)` }}
          >
            <span className="w-[52px] h-[52px] rounded-full bg-white flex items-center justify-center text-sm font-bold text-purple-600">
              {Math.min(100, Math.round(stage.progress))}%
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-1">Rendering your video…</p>
          <p className="text-sm text-gray-400 max-w-xs">Almost there — this tab will update automatically when it's ready.</p>
        </div>
      )}

      {stage.kind === "review" && (
        <div className="flex flex-col items-center text-center gap-2 px-4 py-10">
          <div className="w-11 h-11 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
            <CheckIcon className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-1">
            {stage.reviewType === "script" ? "Script ready for review" : "Stock footage ready for review"}
          </p>
          <p className="text-sm text-gray-400 max-w-xs">
            {stage.reviewType === "script"
              ? "Review and approve the script on Blog2Video to continue generating your video."
              : "Review the selected clips on Blog2Video to continue to rendering."}
          </p>
          <button
            type="button"
            onClick={() => chrome.tabs.create({ url: `${FRONTEND_BASE_URL}/project/${stage.projectId}` })}
            className="mt-1 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-[13px] font-medium rounded-lg transition-colors"
          >
            Open review on Blog2Video
          </button>
        </div>
      )}

      {stage.kind === "done" && (
        <div className="flex flex-col gap-3 px-4 py-8">
          <div className="flex flex-col items-center text-center gap-2">
            <span className="inline-flex items-center gap-1.5 self-center bg-emerald-50 text-emerald-600 text-xs font-semibold px-2.5 py-1 rounded-full">
              <CheckIcon className="w-3 h-3" /> Video ready
            </span>
            <p className="text-sm font-semibold text-gray-900 mt-1">Your video is ready to view.</p>
            <p className="text-sm text-gray-400 max-w-xs">Open it on Blog2Video to preview, edit, or download.</p>
            <button
              type="button"
              onClick={() => chrome.tabs.create({ url: `${FRONTEND_BASE_URL}/project/${stage.projectId}` })}
              className="mt-1 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-[13px] font-medium rounded-lg transition-colors"
            >
              Preview
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleStartOver()}
            className="self-center text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Create another video
          </button>
        </div>
      )}

      {stage.kind === "limit_reached" && (
        <div className="flex flex-col items-center text-center gap-2 px-4 py-10">
          <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-1">Video limit reached</p>
          <p className="text-sm text-gray-400 max-w-xs">
            You've used all your videos for this billing period. Upgrade your plan to create more.
          </p>
          <button
            type="button"
            onClick={() => chrome.tabs.create({ url: `${FRONTEND_BASE_URL}/subscription` })}
            className="mt-1 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-[13px] font-medium rounded-lg transition-colors"
          >
            Upgrade your plan
          </button>
          <button
            type="button"
            onClick={() => void bootstrap()}
            className="text-xs text-gray-400 hover:text-purple-600 transition-colors"
          >
            Back
          </button>
        </div>
      )}

      {stage.kind === "error" && (
        <div className="flex flex-col items-center text-center gap-2 px-4 py-10">
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-lg font-bold">!</div>
          <p className="text-sm font-semibold text-gray-900 mt-1">Something went wrong</p>
          <p className="text-sm text-red-600 max-w-xs">{stage.message}</p>
          <button
            type="button"
            onClick={() => void bootstrap()}
            className="mt-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function describeStep(status: ProjectStatus): string {
  const steps = ["Scraping", "Writing script", "Generating scenes", "Adding voiceover", "Finishing up"];
  return steps[status.step] ?? "Working…";
}
