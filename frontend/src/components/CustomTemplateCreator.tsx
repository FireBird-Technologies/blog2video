import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import TemplateGenerationProgress, { useGenerationStatus } from "./TemplateGenerationProgress";
import ErrorModal from "./ErrorModal";
import {
  extractTheme,
  extractThemeFromPrompt,
  extractThemeFromDoc,
  createCustomTemplate,
  generateTemplateCode,
  getCodeGenerationStatus,
  type CodeGenStatus,
  getCustomTemplate,
  type CustomTemplateTheme,
  type CustomTemplateItem,
  type ExtractThemeResponse,
} from "../api/client";

type CreateMode = "url" | "prompt" | "doc";

const ACCEPTED_DOC_EXTENSIONS = [".pdf", ".docx", ".md", ".txt"];

/** Shown for ANY generation failure except hitting the plan limit.
 *
 * Deliberately generic: the backend's own error strings are pipeline internals
 * ("dspy.Refine exhausted", a validator trace) that tell a user nothing they can
 * act on, and the only useful action is the same in every case — try again, then
 * contact support. The limit case is excluded because it HAS a specific action:
 * the upgrade modal. */
const GENERATION_ERROR_MESSAGE =
  "We're sorry for the inconvenience caused. There is some issue with the generation. " +
  "Please try again, or contact support if the issue persists.";
const MIN_PROMPT_CHARS = 15;
const MAX_PROMPT_CHARS = 5000;

/** Read-only demo mode used by help videos: skips API calls, seeds state, renders inline. */
export interface CustomTemplateCreatorDemoMode {
  step?: 1 | 2;
  url?: string;
  templateName?: string;
  sourceUrl?: string;
  accentColor?: string;
  scrapedScreenshotUrl?: string;
  scrapedOgImage?: string;
  scrapedLogoUrls?: string[];
  themeOverride?: CustomTemplateTheme;
}

interface Props {
  onCreated: (template: CustomTemplateItem) => void;
  /**
   * Closed without finishing. Carries the in-flight template when generation is
   * still RUNNING, so the parent can put a live progress card on the page and
   * keep polling.
   *
   * Without this the run was orphaned: `onCreated` fires only on a terminal
   * state, so closing mid-generation left the template out of the parent's list
   * entirely — no card, no page poller, and this component's own pollers gone
   * with the unmount. The modal's copy promises the run continues in the
   * background, and this is what makes that true.
   */
  onCancel: (inFlight?: CustomTemplateItem) => void;
  /** Called when create is blocked by the plan quota (403) — parent shows the upgrade modal. */
  onLimitReached?: () => void;
  /** When set, the modal renders read-only inside a help video (no API calls, inline render). */
  demoMode?: CustomTemplateCreatorDemoMode;
}

const DEFAULT_THEME: CustomTemplateTheme = {
  colors: { accent: "#7C3AED", bg: "#FFFFFF", text: "#1A1A2E" },
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  borderRadius: 12,
  style: "minimal",
  animationPreset: "fade",
  category: "blog",
  patterns: {
    cards: { corners: "rounded", shadowDepth: "subtle", borderStyle: "thin" },
    spacing: { density: "balanced", gridGap: 20 },
    images: { treatment: "rounded", overlay: "none", captionStyle: "below" },
    layout: { direction: "centered", decorativeElements: ["none"] },
  },
};

export function CustomTemplateCreatorDemoModal({ step = 1 }: { step?: 1 | 2 }) {
  const theme = {
    ...DEFAULT_THEME,
    colors: {
      ...DEFAULT_THEME.colors,
      accent: "#7C3AED",
      bg: "#FFFFFF",
      text: "#111827",
    },
    fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  };
  const accentColor = theme.colors.accent;
  const templateName = "Your Brand Template";

  return (
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">
          {step === 1 ? "Extract Theme" : "Review & Save"}
        </h2>
        <button className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-center pt-4">
        <div className="flex items-center gap-0">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                s <= step ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-400"
              }`}>
                {s < step ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s}
              </div>
              {s < 2 && <div className={`w-10 h-0.5 transition-colors ${s < step ? "bg-purple-600" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Enter a website URL and we'll extract its colors, fonts, and style to create a custom video template.
            </p>
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Website URL
              </label>
              <input
                type="url"
                readOnly
                value="https://yourbrand.com"
                className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
              />
            </div>
            <button className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
              Extract Theme
            </button>
            <p className="text-xs text-gray-400 text-center">
              Scraping website and analyzing design... this may take 10-20 seconds.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div
              className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
              style={{
                background: theme.colors.bg,
                aspectRatio: "16/9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                {(["accent", "bg", "text"] as const).map((key) => (
                  <div
                    key={key}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      backgroundColor: key === "accent" ? accentColor : theme.colors[key],
                      border: `1.5px solid ${theme.colors.text}15`,
                    }}
                  />
                ))}
              </div>
              <p style={{ fontFamily: `${theme.fonts.heading}, sans-serif`, fontSize: 14, fontWeight: 700, color: theme.colors.text, margin: 0 }}>
                {templateName}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Template Name
              </label>
              <input
                type="text"
                readOnly
                value={templateName}
                className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Extracted Colors
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex flex-col items-center gap-1.5">
                  <label className="relative cursor-pointer">
                    <div className="w-8 h-8 rounded-full border-2 border-purple-400 shadow-sm ring-2 ring-purple-200" style={{ backgroundColor: accentColor }} />
                    <input type="color" readOnly value={accentColor} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                  </label>
                  <span className="text-[10px] text-purple-500 font-medium">accent</span>
                </div>
                {(["bg", "text"] as const).map((key) => (
                  <div key={key} className="flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full border-2 border-gray-200 shadow-sm" style={{ backgroundColor: theme.colors[key] }} />
                    <span className="text-[10px] text-gray-400 capitalize">{key}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Brand Identity</span>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600">{theme.fonts.heading}</span>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">Solid</span>
              </div>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Visual Patterns</span>
              <div className="flex flex-wrap gap-2">
                {["rounded cards", "balanced spacing", "rounded images", "centered"].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">{tag}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
                Save Template
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomTemplateCreator({ onCreated, onCancel, onLimitReached, demoMode }: Props) {
  const isDemo = !!demoMode;
  const [step, setStep] = useState<1 | 2>(demoMode?.step ?? 1);
  const [mode, setMode] = useState<CreateMode>("url");
  const [url, setUrl] = useState(demoMode?.url ?? "");
  const [prompt, setPrompt] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<CustomTemplateTheme>(demoMode?.themeOverride ?? DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(
    demoMode?.accentColor ?? demoMode?.themeOverride?.colors.accent ?? DEFAULT_THEME.colors.accent
  );
  const [templateName, setTemplateName] = useState(demoMode?.templateName ?? "");
  const [sourceUrl, setSourceUrl] = useState(demoMode?.sourceUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [createdTemplate, setCreatedTemplate] = useState<CustomTemplateItem | null>(null);
  const [codeGenError, setCodeGenError] = useState<string | null>(null);
  const [scrapedLogoUrls, setScrapedLogoUrls] = useState<string[]>(demoMode?.scrapedLogoUrls ?? []);
  const [scrapedOgImage, setScrapedOgImage] = useState(demoMode?.scrapedOgImage ?? "");
  const [scrapedScreenshotUrl, setScrapedScreenshotUrl] = useState(demoMode?.scrapedScreenshotUrl ?? "");
  const [extractedReason, setExtractedReason] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [genStep, setGenStep] = useState<string>("");
  const [genStatus, setGenStatus] = useState<CodeGenStatus | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Latches once the run reaches a terminal state, so the two independent
  // observers of that state (handleGenerateCode's interval and the rail
  // poller's effect below) cannot both fire the transition. Declared here,
  // beside pollingRef, because handleGenerateCode reads it.
  const finishedRef = useRef(false);

  // Elapsed timer for code generation
  useEffect(() => {
    if (!generatingCode) { setElapsedSeconds(0); return; }
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [generatingCode]);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // Apply a successful extraction (from any input mode) and advance to review.
  const applyExtractedTheme = (data: ExtractThemeResponse, src: string) => {
    if (!data.theme) return;
    setTheme(data.theme);
    setAccentColor(data.theme.colors.accent);
    setTemplateName(data.template_name || "");
    setSourceUrl(src);
    setScrapedLogoUrls(data.logo_urls || []);
    setScrapedOgImage(data.og_image || "");
    setScrapedScreenshotUrl(data.screenshot_url || "");
    setExtractedReason(data.reason || "");
    setStep(2);
  };

  const canExtract =
    mode === "url" ? !!url.trim()
    : mode === "prompt" ? prompt.trim().length >= MIN_PROMPT_CHARS
    : !!docFile;

  // Step 1: Extract theme from the selected input (URL / prompt / uploaded doc)
  const handleExtract = async () => {
    if (isDemo || !canExtract) return;
    setLoading(true);
    setError(null);
    try {
      let res;
      if (mode === "url") {
        res = await extractTheme(url.trim());
      } else if (mode === "prompt") {
        res = await extractThemeFromPrompt(prompt.trim());
      } else {
        res = await extractThemeFromDoc(docFile!);
      }
      if (!res.data.extractable || !res.data.theme) {
        setError(
          res.data.reason ||
            (mode === "url"
              ? "We couldn't pull a usable theme from this page. Try a different URL."
              : "We couldn't build a theme from that. Try adding more detail about the brand, industry, and feel you want.")
        );
        return;
      }
      applyExtractedTheme(res.data, mode === "url" ? url.trim() : "");
    } catch (err: any) {
      const fallback =
        mode === "url"
          ? "We couldn't load that website. Try another URL, or try again in a moment."
          : mode === "doc"
          ? "We couldn't read that file. Try a text-based PDF, Word, Markdown, or text document."
          : "Something went wrong analyzing that. Please try again.";
      setError(err?.response?.data?.detail || fallback);
    } finally {
      setLoading(false);
    }
  };

  const handlePickFile = (file: File | undefined | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!ACCEPTED_DOC_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setError("We support PDF, Word (.docx), Markdown, or plain-text files.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("That file's too large. Please keep it under 10 MB.");
      return;
    }
    setError(null);
    setDocFile(file);
  };

  // Step 2: Save template then trigger generation inline
  const handleSave = async () => {
    if (isDemo) return;
    if (!templateName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updatedTheme = { ...theme, colors: { ...theme.colors, accent: accentColor } };
      const res = await createCustomTemplate({
        name: templateName.trim(),
        source_url: sourceUrl || undefined,
        theme: updatedTheme,
        logo_urls: scrapedLogoUrls.length > 0 ? scrapedLogoUrls : undefined,
        og_image: scrapedOgImage || undefined,
        screenshot_url: scrapedScreenshotUrl || undefined,
        reason: extractedReason || undefined,
      });
      setCreatedTemplate(res.data);
      handleGenerateCode(res.data);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      // Quota hit → let the parent open the upgrade modal instead of an error.
      if (status === 403 && detail?.code === "custom_template_limit") {
        setSaving(false);
        onLimitReached?.();
        return;
      }
      // Any other save failure is, from the user's side, the generation failing
      // — the save is what kicks generation off — so it gets the same "Oops"
      // modal rather than an inline banner with a backend string in it.
      setCodeGenError(GENERATION_ERROR_MESSAGE);
      setSaving(false);
    }
  };

  const handleGenerateCode = async (template: CustomTemplateItem) => {
    setGeneratingCode(true);
    setCodeGenError(null);
    setGenStep("Starting generation...");
    // A retry is a fresh run — re-arm the terminal-transition latch, or the
    // second attempt could never finish.
    finishedRef.current = false;
    try {
      await generateTemplateCode(template.id);
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await getCodeGenerationStatus(template.id);
          const s = statusRes.data;
          // Keep the whole payload: the step list below reads the durable
          // stage and the scene counter, not just this one label.
          setGenStatus(s);
          if (s.step === "design_system") setGenStep("Generating design system...");
          else if (s.step === "generating_scenes") setGenStep("Generating scenes...");
          else if (s.step === "saving") setGenStep("Saving results...");

          if (s.status === "complete") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            // Both this interval and the rail poller's effect can observe the
            // terminal state; whichever gets there first owns the transition.
            if (finishedRef.current) return;
            finishedRef.current = true;
            const updated = await getCustomTemplate(template.id);
            setCreatedTemplate(updated.data);
            setGeneratingCode(false);
            setSaving(false);
            setGenStep("");
            // Hand the finished template to the parent and close.
            //
            // The modal used to sit on an all-green rail waiting for a click on
            // "Done" — but there is nothing left to review here, the finished
            // template is already rendered on its card behind this dialog, and
            // a user who walked away during the 5-10 minute run came back to a
            // dialog whose only purpose was to be dismissed.
            onCreated(updated.data);
          } else if (s.status === "error") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            if (finishedRef.current) return;
            finishedRef.current = true;
            setCodeGenError(GENERATION_ERROR_MESSAGE);
            setGeneratingCode(false);
            setSaving(false);
            setGenStep("");
          }
        } catch { /* ignore polling errors */ }
      }, 2000);
    } catch (err: any) {
      setGeneratingCode(false);
      setSaving(false);
      // The plan limit keeps its own path — it is the one failure with a
      // specific action (upgrade), so it must not collapse into the generic
      // "try again" message. Reachable here as well as from handleSave, since
      // the retry button re-enters this function.
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 403 && detail?.code === "custom_template_limit") {
        onLimitReached?.();
        return;
      }
      setCodeGenError(GENERATION_ERROR_MESSAGE);
    }
  };

  const isGenerating = saving || generatingCode;
  const isDone = !isGenerating && !codeGenError && createdTemplate?.intro_code;

  /* Hand the in-flight template up so the run survives this modal closing.
   *
   * Bound as `() => handleClose()` at every call site, never passed directly to
   * onClick: React would hand the MouseEvent through as `inFlight`.
   *
   * Only while GENERATING — a template that already finished reaches the parent
   * through onCreated, and one that never started has nothing to poll. */
  const handleClose = () => {
    onCancel(isGenerating && createdTemplate ? createdTemplate : undefined);
  };

  // Second, independent poller for the step rail.
  //
  // handleGenerateCode's own interval drives the terminal transitions (complete
  // / error), but it is created only on the save that starts the run — so a
  // modal that is open across a re-render, or reopened on an in-flight
  // template, had nothing refreshing the rail and it sat frozen on step 1.
  // This hook keys off the template id, so it polls whenever there is a
  // generating template to poll, regardless of how the modal got there.
  const liveStatus = useGenerationStatus(createdTemplate?.id ?? 0, !!createdTemplate && isGenerating);
  const railStatus = liveStatus ?? genStatus;

  // Backstop for the terminal transition.
  //
  // handleGenerateCode's own interval is the primary path, but it is a single
  // interval owned by one call — if it is cleared, never created (the modal was
  // reopened on an in-flight template), or its poll happens to miss, the modal
  // sits on an all-green rail forever with the elapsed timer still ticking.
  // That is exactly what happened, so completion no longer depends on one
  // specific poller: whichever observer sees the terminal state finishes the run.
  useEffect(() => {
    if (!createdTemplate || !isGenerating || !liveStatus) return;
    if (finishedRef.current) return;

    if (liveStatus.status === "complete") {
      finishedRef.current = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setGeneratingCode(false);
      setSaving(false);
      setGenStep("");
      // Re-fetch so the parent receives the template WITH its generated code
      // rather than the pre-generation row we created it from.
      getCustomTemplate(createdTemplate.id)
        .then((r) => onCreated(r.data))
        .catch(() => onCreated(createdTemplate));
    } else if (liveStatus.status === "error") {
      finishedRef.current = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setGeneratingCode(false);
      setSaving(false);
      setGenStep("");
      setCodeGenError(GENERATION_ERROR_MESSAGE);
    }
    // onCreated is a parent callback and is not stable across renders; including
    // it would re-run this effect on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveStatus?.status, createdTemplate?.id, isGenerating]);

  const modal = (
    <div className={isDemo ? "absolute inset-0 z-10 flex items-center justify-center p-4" : "fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4"}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => handleClose()} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            {step === 1 ? "Extract Theme" : "Review & Save"}
          </h2>
          <button onClick={() => handleClose()} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator — 2 steps only */}
        <div className="flex items-center justify-center pt-4">
          <div className="flex items-center gap-0">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  s <= step ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-400"
                }`}>
                  {s < step ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : s}
                </div>
                {s < 2 && <div className={`w-10 h-0.5 transition-colors ${s < step ? "bg-purple-600" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          {/* Step 1: Choose an input mode, then provide it */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Mode selector */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl">
                {([
                  { key: "url", label: "Website" },
                  { key: "prompt", label: "Prompt" },
                  { key: "doc", label: "Upload doc" },
                ] as { key: CreateMode; label: string }[]).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => { setMode(m.key); setError(null); }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      mode === m.key ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {mode === "url" && (
                <>
                  <p className="text-sm text-gray-500">
                    Enter a website URL and we'll extract its colors, fonts, and style to create a custom video template.
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleExtract(); } }}
                    />
                  </div>
                </>
              )}

              {mode === "prompt" && (
                <>
                  <p className="text-sm text-gray-500">
                    Describe the template you want — the brand, its industry, the colors, fonts, and overall feel. We'll design a theme from your description.
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                      Describe your template
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
                      placeholder={`e.g. "A dark, modern fintech brand with warm orange accents — clean and trustworthy, Inter font, a bit friendlier than Stripe."`}
                      rows={6}
                      className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all resize-none min-h-[120px]"
                      autoFocus
                    />
                    <div className="mt-1 text-[11px] text-gray-400 text-right">
                      {prompt.trim().length < MIN_PROMPT_CHARS
                        ? `Add a bit more detail (${prompt.trim().length}/${MIN_PROMPT_CHARS} min)`
                        : `${prompt.length.toLocaleString()} / ${MAX_PROMPT_CHARS.toLocaleString()} chars`}
                    </div>
                  </div>
                </>
              )}

              {mode === "doc" && (
                <>
                  <p className="text-sm text-gray-500">
                    Upload a brand or design document (PDF, Word, Markdown, or text) and we'll read it to build a matching template.
                  </p>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      handlePickFile(e.dataTransfer.files?.[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center text-sm cursor-pointer transition-colors ${
                      dragActive ? "border-purple-400 bg-purple-50/50" : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/40"
                    }`}
                  >
                    {docFile ? (
                      <div className="flex items-center justify-center gap-2 text-gray-700">
                        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium truncate max-w-[260px]">{docFile.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDocFile(null); }}
                          className="text-gray-400 hover:text-gray-600"
                          aria-label="Remove file"
                        >✕</button>
                      </div>
                    ) : (
                      <div className="text-gray-500">
                        <svg className="w-6 h-6 mx-auto mb-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.9 5 5 0 119.66-2.1A4 4 0 0117 16h-1m-4-4v8m0 0l-3-3m3 3l3-3" />
                        </svg>
                        Drop a <span className="font-medium">PDF, .docx, .md</span> or <span className="font-medium">.txt</span> here, or click to browse
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_DOC_EXTENSIONS.join(",")}
                      className="hidden"
                      onChange={(e) => { handlePickFile(e.target.files?.[0]); if (e.target) e.target.value = ""; }}
                    />
                  </div>
                </>
              )}

              <button
                onClick={handleExtract}
                disabled={loading || !canExtract}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {mode === "url" ? "Extracting theme..." : "Designing theme..."}
                  </>
                ) : mode === "url" ? "Extract Theme" : "Generate Theme"}
              </button>
              {loading && (
                <p className="text-xs text-gray-400 text-center">
                  {mode === "url"
                    ? "Scraping website and analyzing design... this may take 10-20 seconds."
                    : "Analyzing and designing your theme... this may take 10-20 seconds."}
                </p>
              )}
            </div>
          )}

          {/* Step 2: Review form (pre-save) */}
          {step === 2 && !createdTemplate && (
            <div className="space-y-5">
              {/* Brand color palette preview */}
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ background: theme.colors.bg, aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["accent", "bg", "text"] as const).map((key) => (
                    <div key={key} style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: key === "accent" ? accentColor : theme.colors[key], border: `1.5px solid ${theme.colors.text}15` }} />
                  ))}
                </div>
                <p style={{ fontFamily: `${theme.fonts.heading}, sans-serif`, fontSize: 14, fontWeight: 700, color: theme.colors.text, margin: 0 }}>
                  {templateName || "Your Template"}
                </p>
              </div>

              {/* Template name */}
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Stripe Dark, Careem Green..."
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
                  autoFocus
                />
              </div>

              {/* Extracted colors — accent editable */}
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Extracted Colors
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex flex-col items-center gap-1.5">
                    <label className="relative cursor-pointer">
                      <div
                        className="w-8 h-8 rounded-full border-2 border-purple-400 shadow-sm ring-2 ring-purple-200"
                        style={{ backgroundColor: accentColor }}
                      />
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                    </label>
                    <span className="text-[10px] text-purple-500 font-medium">accent ✎</span>
                  </div>
                  {(["bg", "text"] as const).map((key) => (
                    <div key={key} className="flex flex-col items-center gap-1.5">
                      <div className="w-8 h-8 rounded-full border-2 border-gray-200 shadow-sm" style={{ backgroundColor: theme.colors[key] }} />
                      <span className="text-[10px] text-gray-400 capitalize">{key}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Click the accent swatch to change the brand color</p>
              </div>

              {/* Brand info */}
              <div className="space-y-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Brand Identity</span>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600">{theme.fonts.heading}</span>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                    {theme.colors.bg2 ? "Gradient" : "Solid"}
                  </span>
                  {/* style + animationPreset — internal AI signals, not user-facing */}
                  {/* <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600">{theme.style}</span> */}
                  {/* <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600">{theme.animationPreset}</span> */}
                </div>
                {/* Visual Patterns — hidden: the corner/spacing/image/alignment chips
                    were confusing to users without changing what they could act on. */}
                {/* {theme.patterns && (
                  <>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Visual Patterns</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        `${theme.patterns.cards?.corners || "rounded"} cards`,
                        `${theme.patterns.spacing?.density || "balanced"} spacing`,
                        `${theme.patterns.images?.treatment || "rounded"} images`,
                        theme.patterns.layout?.direction || "centered",
                      ].map((tag) => (
                        <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">{tag}</span>
                      ))}
                    </div>
                  </>
                )} */}

                {/* Motion / decor / charts — first-class craft signals derived from the brand */}
                {(theme.motion?.energy || theme.decor?.system || theme.charts?.style) && (
                  <>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Motion &amp; Style</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        theme.motion?.energy ? `${theme.motion.energy} motion` : null,
                        theme.decor?.system && theme.decor.system !== "none" ? `${theme.decor.system} decor` : null,
                        theme.charts?.style ? `${theme.charts.style} charts` : null,
                      ].filter(Boolean).map((tag) => (
                        <span key={tag as string} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-600 capitalize">{tag}</span>
                      ))}
                    </div>
                  </>
                )}

                {/* Scene mix — preferred content archetypes for this brand */}
                {theme.sceneBias && theme.sceneBias.length > 0 && (
                  <>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Scene Mix</span>
                    <div className="flex flex-wrap gap-2">
                      {theme.sceneBias.map((s) => (
                        <span key={s} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-50 text-emerald-700 capitalize">{s}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !templateName.trim()}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : "Save Template"}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Generation progress (post-save) */}
          {step === 2 && createdTemplate && (
            <div className="space-y-6">
              {/* Large generation preview */}
              {/* While generating, this panel is WHITE with black text rather
                  than the brand palette — the theme is the one thing not yet
                  proven at this point, and a dark brand background made the
                  status text unreadable. */}
              <div
                className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
                style={{
                  background: isGenerating ? "#FFFFFF" : theme.colors.bg,
                  // 16/9 is the right shape for the finished preview — it stands
                  // in for the video. While GENERATING there is no video yet,
                  // and forcing that ratio on a narrow phone made a short, wide
                  // box the step rail could not fit into. Size to content there
                  // and keep a minimum so it doesn't look collapsed.
                  ...(isGenerating
                    ? { minHeight: 190, paddingTop: 20, paddingBottom: 4 }
                    : { aspectRatio: "16/9" }),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {isGenerating ? (
                  <>
                    <TemplateGenerationProgress status={railStatus} variant="modal" />
                    <p
                      className="text-[11px] sm:text-xs px-4 sm:px-6 mb-3 sm:mb-4 text-center"
                      style={{ color: "#9CA3AF" }}
                    >
                      {elapsedSeconds}s elapsed · you can close this and let it finish in the background.
                    </p>
                  </>
                ) : codeGenError ? (
                  // The failure itself is reported by the "Oops" ErrorModal
                  // below, which is the app's standard failure surface. This
                  // panel only offers the retry, so the message is not stated
                  // twice in two different styles.
                  <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <p className="text-sm text-gray-500">Generation didn't finish.</p>
                    <button onClick={() => handleGenerateCode(createdTemplate)} className="px-4 py-2 text-xs font-medium bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors">
                      Try again
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm font-semibold text-green-600">Template generated!</p>
                  </div>
                )}
              </div>

              {/* Template summary */}
              <div className="flex items-center gap-3 px-1">
                <div className="w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
                {/* min-w-0 + truncate so a long brand name cannot widen the row
                    past the dialog on a narrow screen. */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{createdTemplate.name}</p>
                  <p className="text-xs text-gray-400 truncate">{theme.fonts.heading}</p>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => onCreated(createdTemplate)}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-[13px] sm:text-sm font-medium rounded-xl transition-colors"
              >
                {/* Shorter label on phones — "Close & Generate in Background" is
                    the widest element in the dialog and wrapped to two lines. */}
                {isGenerating ? (
                  <>
                    <span className="sm:hidden">Close &amp; run in background</span>
                    <span className="hidden sm:inline">Close &amp; Generate in Background</span>
                  </>
                ) : (
                  "Done"
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Generation failure — the app's standard "Oops 😢" dialog.
          Not rendered in demo mode, which never calls the API. */}
      {!isDemo && (
        <ErrorModal
          open={!!codeGenError}
          variant="warning"
          message={codeGenError || ""}
          onClose={() => setCodeGenError(null)}
        />
      )}
    </div>
  );
  return isDemo ? modal : ReactDOM.createPortal(modal, document.body);
}
