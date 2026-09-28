import { useEffect, useState, type CSSProperties } from "react";
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
  startRender,
  uploadProjectLogo,
  type Account,
  type Catalog,
  type ProjectStatus,
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
  | { kind: "rendering"; projectId: number; progress: number }
  | { kind: "done"; projectId: number; videoUrl: string; previewUrl: string | null }
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

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Logo({ size }: { size: "small" | "large" }) {
  return <div className={size === "small" ? "b2v-logo b2v-logo-small" : "b2v-logo b2v-logo-large"}>B2V</div>;
}

const STEP_LABELS = ["Content", "Template", "Voice"];

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="step-indicator">
      <div className="step-dots">
        {[1, 2, 3].map((n) => (
          <div className="step-dot-wrap" key={n}>
            <div className={n === current ? "step-dot current" : n < current ? "step-dot done" : "step-dot"}>
              {n < current ? <CheckIcon /> : n}
            </div>
            {n < 3 && <div className={n < current ? "step-line done" : "step-line"} />}
          </div>
        ))}
      </div>
      <span className="step-label">Step {current} — {STEP_LABELS[current - 1]}</span>
    </div>
  );
}

type VideoStyle = "auto" | "explainer" | "promotional" | "storytelling";
type VideoLength = "auto" | "short" | "medium" | "detailed" | "more_detailed";

const VIDEO_STYLES: Array<{ value: VideoStyle; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "explainer", label: "Explainer" },
  { value: "storytelling", label: "Storytelling" },
  { value: "promotional", label: "Promotional" },
];

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
  const [videoStyle, setVideoStyle] = useState<VideoStyle>("auto");
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
      await beginRender(status.project_id);
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
          await beginRender(projectId);
        }
      } catch (err) {
        clearInterval(interval);
        await clearActiveProject();
        setStage({ kind: "error", message: (err as Error).message });
      }
    }, 3000);
  }

  async function beginRender(projectId: number) {
    setStage({ kind: "rendering", projectId, progress: 0 });
    try {
      await setActiveProject({ projectId, phase: "rendering" });
      const started = await startRender(projectId);
      if (started.r2_video_url) {
        await finishWithVideo(projectId, started.r2_video_url);
        return;
      }
      pollRender(projectId);
    } catch (err) {
      await clearActiveProject();
      setStage({ kind: "error", message: (err as Error).message });
    }
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
    <div className="popup">
      <header>
        <Logo size="small" />
        <span>Blog2Video</span>
        {stage.kind === "ready" && (
          <button className="link" onClick={handleDisconnect}>Disconnect</button>
        )}
      </header>

      {stage.kind === "loading" && (
        <div className="panel">
          <div className="skeleton-row skeleton-pill" />
          <div className="skeleton-grid">
            <div className="skeleton-row skeleton-tile" />
            <div className="skeleton-row skeleton-tile" />
            <div className="skeleton-row skeleton-tile" />
          </div>
          <div className="skeleton-row skeleton-voice" />
          <div className="skeleton-row skeleton-voice" />
        </div>
      )}

      {stage.kind === "disconnected" && (
        <div className="panel">
          <div className="hero">
            <Logo size="large" />
            <h1>Turn this page into a video</h1>
            <p>Connect your Blog2Video account to generate a narrated video from the article you're reading.</p>
            <ul className="feature-list">
              <li><span className="dot" /> Auto-extracts the article text</li>
              <li><span className="dot" /> Pick a template and voice</li>
              <li><span className="dot" /> Video renders in the background</li>
            </ul>
            <button className="primary" onClick={handleConnect}>Connect Blog2Video</button>
          </div>
        </div>
      )}

      {stage.kind === "connecting" && (
        <div className="panel">
          <div className="connecting">
            <div className="spinner" />
            <p><strong>Waiting for approval…</strong></p>
            <p>Approve the connection in the tab that just opened, then come back here — this will finish automatically.</p>
          </div>
        </div>
      )}

      {stage.kind === "ready" && (
        <div className="panel">
          <StepIndicator current={wizardStep} />

          {wizardStep === 1 && (
            <div className="wizard-step">
              <label>Page</label>
              <input value={tabUrl} readOnly />
              {extractionFailed && (
                <>
                  <label>Article text</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    placeholder="Couldn't auto-extract this page — paste the article text here."
                  />
                </>
              )}

              <label>Video format</label>
              <div className="option-grid">
                <button
                  type="button"
                  className={aspectRatio === "landscape" ? "option-button selected" : "option-button"}
                  onClick={() => setAspectRatio("landscape")}
                >
                  <strong>Landscape</strong><small>YouTube</small>
                </button>
                <button
                  type="button"
                  className={aspectRatio === "portrait" ? "option-button selected" : "option-button"}
                  onClick={() => setAspectRatio("portrait")}
                >
                  <strong>Portrait</strong><small>TikTok / Reels</small>
                </button>
              </div>

              <label htmlFor="video-length">Estimated duration</label>
              <select
                id="video-length"
                value={videoLength}
                onChange={(event) => setVideoLength(event.target.value as VideoLength)}
              >
                {VIDEO_LENGTHS.map((option) => {
                  const locked = option.paid && account?.plan?.toLowerCase() === "free";
                  return (
                    <option key={option.value} value={option.value} disabled={locked}>
                      {option.label}{locked ? " · Paid only" : ""}
                    </option>
                  );
                })}
              </select>

              <div className="creation-toggles creation-toggles-single">
                <label className="setting-toggle">
                  <input
                    type="checkbox"
                    checked={stockFootageEnabled}
                    onChange={(event) => setStockFootageEnabled(event.target.checked)}
                  />
                  <span><strong>Stock footage</strong><small>Insert matching clips automatically</small></span>
                </label>
              </div>

              <label htmlFor="project-logo">Logo <span className="label-note">optional · max 2 MB</span></label>
              <input
                id="project-logo"
                className="file-input"
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
              {logoFile && (
                <div className="logo-options">
                  <select
                    aria-label="Logo position"
                    value={logoPosition}
                    onChange={(event) => setLogoPosition(event.target.value as typeof logoPosition)}
                  >
                    <option value="top_left">Top left</option>
                    <option value="top_right">Top right</option>
                    <option value="bottom_left">Bottom left</option>
                    <option value="bottom_right">Bottom right</option>
                  </select>
                  <label className="opacity-control">
                    <span>Opacity {Math.round(logoOpacity * 100)}%</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={Math.round(logoOpacity * 100)}
                      onChange={(event) => setLogoOpacity(Number(event.target.value) / 100)}
                    />
                  </label>
                </div>
              )}

              <div className="wizard-nav wizard-nav-single">
                <button
                  type="button"
                  className="wizard-next"
                  disabled={!content.trim()}
                  onClick={() => setWizardStep(2)}
                >
                  Continue <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="wizard-step">
              <label>Template</label>
              <div className="grid">
                {stage.catalog.templates.map((t) => {
                  const isSelected = t.id === templateId;
                  return (
                    <button
                      key={t.id}
                      className={isSelected ? "tile selected" : "tile"}
                      onClick={() => setTemplateId(t.id)}
                      type="button"
                    >
                      <div className="tile-thumb">
                        {t.preview_url ? <img src={t.preview_url} alt="" /> : <span className="tile-fallback">{t.name}</span>}
                        {isSelected && <span className="tile-check"><CheckIcon /></span>}
                      </div>
                      <span className="tile-label">{t.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="style-picker-row">
                <label className="style-picker-label">Video style</label>
                <div className="style-pills">
                  {VIDEO_STYLES.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={videoStyle === option.value ? "style-pill selected" : "style-pill"}
                      onClick={() => setVideoStyle(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wizard-nav">
                <button type="button" className="wizard-back" onClick={() => setWizardStep(1)}>
                  <span aria-hidden="true">←</span> Back
                </button>
                <button
                  type="button"
                  className="wizard-next"
                  disabled={!templateId}
                  onClick={() => setWizardStep(3)}
                >
                  Continue <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="wizard-step">
              <label>Voice — tap to preview</label>
              <div className="voice-list">
                {stage.catalog.voices.length === 0 && <p className="muted">Using default voice.</p>}
                {stage.catalog.voices.map((v) => {
                  const isSelected = v.voice_id === voiceId;
                  const isPlaying = playingVoiceId === v.voice_id;
                  const subtitle = formatVoiceSubtitle(v.gender, v.accent, v.description);
                  return (
                    <div
                      key={v.voice_id}
                      role="button"
                      tabIndex={0}
                      className={isSelected ? "voice-row selected" : "voice-row"}
                      onClick={() => setVoiceId(v.voice_id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setVoiceId(v.voice_id); } }}
                    >
                      <button
                        type="button"
                        className={isPlaying ? "play playing" : "play"}
                        onClick={(e) => { e.stopPropagation(); playVoicePreview(v); }}
                        aria-label={isPlaying ? `Pause ${v.name}` : `Preview ${v.name}`}
                      >
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                      </button>
                      <div className="voice-copy">
                        <div className="voice-name">{v.name}</div>
                        {subtitle && <div className="voice-subtitle">{subtitle}</div>}
                      </div>
                      {isSelected && <span className="voice-check"><CheckIcon /></span>}
                    </div>
                  );
                })}
              </div>

              <div className="wizard-nav">
                <button type="button" className="wizard-back" onClick={() => setWizardStep(2)}>
                  <span aria-hidden="true">←</span> Back
                </button>
                <button
                  type="button"
                  className="wizard-next"
                  disabled={!content.trim() || !templateId}
                  onClick={handleGenerate}
                >
                  Create video
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {stage.kind === "generating" && (
        <div className="panel">
          <div className="connecting">
            <div className="spinner" />
            <p><strong>{stage.label}</strong></p>
            <p>Writing your script and building the scenes — this usually takes a minute or two.</p>
          </div>
        </div>
      )}

      {stage.kind === "rendering" && (
        <div className="panel">
          <div className="connecting">
            <div className="progress-ring" style={{ "--pct": `${Math.min(100, Math.round(stage.progress))}%` } as CSSProperties}>
              <span>{Math.min(100, Math.round(stage.progress))}%</span>
            </div>
            <p><strong>Rendering your video…</strong></p>
            <p>Almost there — this tab will update automatically when it's ready.</p>
          </div>
        </div>
      )}

      {stage.kind === "review" && (
        <div className="panel">
          <div className="connecting">
            <div className="review-icon"><CheckIcon /></div>
            <p><strong>{stage.reviewType === "script" ? "Script ready for review" : "Stock footage ready for review"}</strong></p>
            <p>
              {stage.reviewType === "script"
                ? "Review and approve the script on Blog2Video to continue generating your video."
                : "Review the selected clips on Blog2Video to continue to rendering."}
            </p>
            <button
              className="primary"
              onClick={() => chrome.tabs.create({ url: `${FRONTEND_BASE_URL}/project/${stage.projectId}` })}
            >
              Open review on Blog2Video
            </button>
          </div>
        </div>
      )}

      {stage.kind === "done" && (
        <div className="panel">
          <div className="connecting">
            <div className="done-badge"><CheckIcon /> Video ready</div>
            <p><strong>Your video is ready to view.</strong></p>
            <p>Open it on Blog2Video to preview, edit, or download.</p>
            <button
              className="primary"
              onClick={() => chrome.tabs.create({ url: `${FRONTEND_BASE_URL}/project/${stage.projectId}` })}
            >
              Preview
            </button>
          </div>
          <button className="link centered" onClick={() => void handleStartOver()}>Create another video</button>
        </div>
      )}

      {stage.kind === "error" && (
        <div className="panel">
          <div className="connecting">
            <div className="error-icon">!</div>
            <p><strong>Something went wrong</strong></p>
            <p className="error">{stage.message}</p>
            <button className="secondary" onClick={() => void bootstrap()}>Try again</button>
          </div>
        </div>
      )}
    </div>
  );
}

function describeStep(status: ProjectStatus): string {
  const steps = ["Scraping", "Writing script", "Generating scenes", "Adding voiceover", "Finishing up"];
  return steps[status.step] ?? "Working…";
}
