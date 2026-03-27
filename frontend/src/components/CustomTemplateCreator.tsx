import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  extractTheme,
  createCustomTemplate,
  generateTemplateCode,
  getCodeGenerationStatus,
  getCustomTemplate,
  type CustomTemplateTheme,
  type CustomTemplateItem,
} from "../api/client";
import CustomPreview from "./templatePreviews/CustomPreview";
import {
  VIDEO_STYLE_OPTIONS,
  type VideoStyleId,
} from "../constants/videoStyles";

interface Props {
  onCreated: (template: CustomTemplateItem) => void;
  onCancel: () => void;
}

const DEFAULT_THEME: CustomTemplateTheme = {
  colors: { accent: "#7C3AED", bg: "#FFFFFF", text: "#1A1A2E", surface: "#F5F5F5", muted: "#9CA3AF" },
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

export default function CustomTemplateCreator({ onCreated, onCancel }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<CustomTemplateTheme>(DEFAULT_THEME);
  const [supportedVideoStyle, setSupportedVideoStyle] = useState<VideoStyleId>("explainer");
  const [templateName, setTemplateName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const styleRef = useRef<HTMLDivElement>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [createdTemplate, setCreatedTemplate] = useState<CustomTemplateItem | null>(null);
  const [codeGenError, setCodeGenError] = useState<string | null>(null);
  const [scrapedLogoUrls, setScrapedLogoUrls] = useState<string[]>([]);
  const [scrapedOgImage, setScrapedOgImage] = useState("");
  const [scrapedScreenshotUrl, setScrapedScreenshotUrl] = useState("");
  const [extractedReason, setExtractedReason] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Elapsed timer for code generation
  useEffect(() => {
    if (!generatingCode) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [generatingCode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) {
        setStyleOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Step 1: Extract theme from URL
  const handleExtract = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await extractTheme(url.trim());
      if (!res.data.extractable || !res.data.theme) {
        setError(res.data.reason || "Could not extract theme from this URL.");
        return;
      }
      setTheme(res.data.theme);
      setSupportedVideoStyle("explainer");
      setTemplateName(res.data.template_name || "");
      setSourceUrl(url.trim());
      setScrapedLogoUrls(res.data.logo_urls || []);
      setScrapedOgImage(res.data.og_image || "");
      setScrapedScreenshotUrl(res.data.screenshot_url || "");
      setExtractedReason(res.data.reason || "");
      console.log(`[F7-DEBUG] Theme extracted: accent=${res.data.theme?.colors?.accent}, category=${res.data.theme?.category}, reason='${(res.data.reason || '').slice(0, 100)}'`);
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to extract theme. Try another URL.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save template, then move to Step 3 for code generation
  const handleSave = async () => {
    if (!templateName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createCustomTemplate({
        name: templateName.trim(),
        source_url: sourceUrl || undefined,
        theme,
        supported_video_style: supportedVideoStyle,
        logo_urls: scrapedLogoUrls.length > 0 ? scrapedLogoUrls : undefined,
        og_image: scrapedOgImage || undefined,
        screenshot_url: scrapedScreenshotUrl || undefined,
        reason: extractedReason || undefined,
      });
      console.log(`[F7-DEBUG] Template created: id=${res.data.id}, name='${res.data.name}', reason passed='${(extractedReason || '').slice(0, 80)}'`);
      setCreatedTemplate(res.data);
      setStep(3);
      // Trigger code generation
      handleGenerateCode(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save template.");
      setSaving(false);
    }
  };

  const [genStep, setGenStep] = useState<string>("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Step 3: Launch AI code generation (returns 202 immediately) then poll
  const handleGenerateCode = async (template: CustomTemplateItem) => {
    setGeneratingCode(true);
    setCodeGenError(null);
    setGenStep("Starting generation...");
    try {
      console.log(`[F7-DEBUG] [CODEGEN] Starting generation for template ${template.id}`);
      await generateTemplateCode(template.id);
      console.log(`[F7-DEBUG] [CODEGEN] 202 received — starting polling`);
      // Start polling for status
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await getCodeGenerationStatus(template.id);
          const s = statusRes.data;
          console.log(`[F7-DEBUG] [CODEGEN] Poll: status=${s.status}, step=${s.step}`);
          if (s.step === "design_system") setGenStep("Generating design system...");
          else if (s.step === "generating_scenes") setGenStep("Generating scenes...");
          else if (s.step === "saving") setGenStep("Saving results...");

          if (s.status === "complete") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            console.log(`[F7-DEBUG] [CODEGEN] Generation complete — fetching template`);
            // Fetch the updated template
            const updated = await getCustomTemplate(template.id);
            setCreatedTemplate(updated.data);
            setGeneratingCode(false);
            setSaving(false);
            setGenStep("");
          } else if (s.status === "error") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            console.error(`[F7-DEBUG] [CODEGEN] Generation failed: ${s.error}`);
            setCodeGenError(s.error || "Code generation failed. You can retry or skip.");
            setGeneratingCode(false);
            setSaving(false);
            setGenStep("");
          }
        } catch {
          // Polling error — ignore, will retry
        }
      }, 2000);
    } catch (err: any) {
      setCodeGenError(err?.response?.data?.detail || "Code generation failed. You can retry or skip.");
      setGeneratingCode(false);
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 1 ? "Extract Theme" : step === 2 ? "Review & Save" : "Generating Template"}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 px-8 pt-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex items-center gap-2 ${s < 3 ? "flex-1" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                s <= step ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-400"
              }`}>
                {s < step ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 ${s < step ? "bg-purple-600" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Step 1: URL input */}
          {step === 1 && (
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
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleExtract(); } }}
                />
              </div>
              <button
                onClick={handleExtract}
                disabled={loading || !url.trim()}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Extracting theme...
                  </>
                ) : (
                  "Extract Theme"
                )}
              </button>
              {loading && (
                <p className="text-xs text-gray-400 text-center">
                  Scraping website and analyzing design... this may take 10-20 seconds.
                </p>
              )}
            </div>
          )}

          {/* Step 2: Review extracted theme & save */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Preview placeholder — real preview appears in Step 3 after AI generation */}
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ background: theme.colors.bg }}>
                <div style={{ aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "24px 32px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["accent", "bg", "text", "surface", "muted"] as const).map((key) => (
                      <div key={key} style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: theme.colors[key], border: `1.5px solid ${theme.colors.text}15` }} />
                    ))}
                  </div>
                  <p style={{ fontFamily: `${theme.fonts.heading}, sans-serif`, fontSize: 15, fontWeight: 700, color: theme.colors.text, textAlign: "center", margin: 0 }}>
                    {templateName || "Your Template"}
                  </p>
                  <p style={{ fontFamily: `${theme.fonts.body}, sans-serif`, fontSize: 11, color: theme.colors.muted, textAlign: "center", margin: 0 }}>
                    Live preview will appear after template generation
                  </p>
                </div>
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
                  placeholder="e.g., Ocean Tech, Brand Dark..."
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
                  autoFocus
                />
              </div>

              {/* Extracted colors (read-only display) */}
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Extracted Colors
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  {(["accent", "bg", "text", "surface", "muted"] as const).map((key) => (
                    <div key={key} className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-8 h-8 rounded-full border-2 border-gray-200 shadow-sm"
                        style={{ backgroundColor: theme.colors[key] }}
                      />
                      <span className="text-[10px] text-gray-400 capitalize">{key}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extracted info pills */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500">
                  {theme.fonts.heading}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500">
                  {theme.style}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500">
                  {theme.animationPreset}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Video Style
                </label>
                <p className="text-[11px] text-gray-500 mb-2">
                  This sets script and voice tone (Explainer/Promotional/Storytelling). Your template appears in its matching style tab and in Custom Templates.
                </p>
                <div ref={styleRef} className="relative">
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium">
                      {VIDEO_STYLE_OPTIONS.find((s) => s.id === supportedVideoStyle)?.label ?? supportedVideoStyle}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStyleOpen(!styleOpen)}
                      className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${styleOpen ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {styleOpen && (
                    <div className="absolute z-10 mt-1.5 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                      {VIDEO_STYLE_OPTIONS.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => { setSupportedVideoStyle(style.id); setStyleOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-purple-50 transition-colors ${
                            supportedVideoStyle === style.id ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"
                          }`}
                        >
                          {style.label}
                          <span className="ml-1 text-gray-400">— {style.subtitle}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Visual patterns (if extracted) */}
              {theme.patterns && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Visual Patterns
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                      {theme.patterns.cards?.corners || "rounded"} cards
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                      {theme.patterns.cards?.shadowDepth || "subtle"} shadow
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                      {theme.patterns.spacing?.density || "balanced"} spacing
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                      {theme.patterns.images?.treatment || "rounded"} images
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                      {theme.patterns.layout?.direction || "centered"}
                    </span>
                  </div>
                </div>
              )}

              {/* Nav */}
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
                  ) : (
                    "Save Template"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Code generation */}
          {step === 3 && createdTemplate && (
            <div className="space-y-5">
              {/* Preview — shows Remotion player if code is ready, carousel otherwise */}
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <CustomPreview
                  theme={theme}
                  name={templateName || undefined}
                  introCode={createdTemplate.intro_code || undefined}
                  outroCode={createdTemplate.outro_code || undefined}
                  contentCodes={createdTemplate.content_codes || undefined}
                  contentArchetypeIds={createdTemplate.content_archetype_ids || undefined}
                  logoUrls={scrapedLogoUrls.length > 0 ? scrapedLogoUrls : undefined}
                  ogImage={scrapedOgImage || undefined}
                  onRetry={() => handleGenerateCode(createdTemplate)}
                />
              </div>

              {generatingCode && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">{genStep || "Generating your unique template..."}</p>
                  <p className="text-xs text-gray-400">You can close this dialog!</p>
                  <p className="text-xs text-gray-300">Elapsed: {elapsedSeconds}s</p>
                </div>
              )}

              {codeGenError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 space-y-2">
                  <p>{codeGenError}</p>
                  <button
                    onClick={() => handleGenerateCode(createdTemplate)}
                    className="px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!generatingCode && !codeGenError && createdTemplate.intro_code && (
                <p className="text-sm text-green-600 text-center font-medium">
                  Template generated successfully!
                </p>
              )}

              <button
                onClick={() => onCreated(createdTemplate)}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {generatingCode ? "Close & Generate in Background" : "Done"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
