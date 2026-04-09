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
import {
  VIDEO_STYLE_OPTIONS,
  type VideoStyleId,
} from "../constants/videoStyles";

interface Props {
  onCreated: (template: CustomTemplateItem) => void;
  onCancel: () => void;
  /** Pre-selects supported video style (explainer / promotional / storytelling) for the new template. */
  initialVideoStyle?: VideoStyleId;
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

export default function CustomTemplateCreator({ onCreated, onCancel, initialVideoStyle }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<CustomTemplateTheme>(DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(DEFAULT_THEME.colors.accent);
  const [supportedVideoStyle, setSupportedVideoStyle] = useState<VideoStyleId>(
    () => initialVideoStyle ?? "explainer"
  );
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
  const [genStep, setGenStep] = useState<string>("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed timer for code generation
  useEffect(() => {
    if (!generatingCode) { setElapsedSeconds(0); return; }
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [generatingCode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) setStyleOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  useEffect(() => {
    if (initialVideoStyle) {
      setSupportedVideoStyle(initialVideoStyle);
    }
  }, [initialVideoStyle]);

  // Step 1: Extract theme from URL
  const handleExtract = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await extractTheme(url.trim());
      if (!res.data.extractable || !res.data.theme) {
        setError(res.data.reason || "We couldn't pull a usable theme from this page. Try a different URL.");
        return;
      }
      setTheme(res.data.theme);
      setAccentColor(res.data.theme.colors.accent);
      setSupportedVideoStyle(initialVideoStyle ?? "explainer");
      setTemplateName(res.data.template_name || "");
      setSourceUrl(url.trim());
      setScrapedLogoUrls(res.data.logo_urls || []);
      setScrapedOgImage(res.data.og_image || "");
      setScrapedScreenshotUrl(res.data.screenshot_url || "");
      setExtractedReason(res.data.reason || "");
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "We couldn't load that website. Try another URL, or try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save template then trigger generation inline
  const handleSave = async () => {
    if (!templateName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updatedTheme = { ...theme, colors: { ...theme.colors, accent: accentColor } };
      const res = await createCustomTemplate({
        name: templateName.trim(),
        source_url: sourceUrl || undefined,
        theme: updatedTheme,
        supported_video_style: supportedVideoStyle,
        logo_urls: scrapedLogoUrls.length > 0 ? scrapedLogoUrls : undefined,
        og_image: scrapedOgImage || undefined,
        screenshot_url: scrapedScreenshotUrl || undefined,
        reason: extractedReason || undefined,
      });
      setCreatedTemplate(res.data);
      handleGenerateCode(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save template.");
      setSaving(false);
    }
  };

  const handleGenerateCode = async (template: CustomTemplateItem) => {
    setGeneratingCode(true);
    setCodeGenError(null);
    setGenStep("Starting generation...");
    try {
      await generateTemplateCode(template.id);
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await getCodeGenerationStatus(template.id);
          const s = statusRes.data;
          if (s.step === "design_system") setGenStep("Generating design system...");
          else if (s.step === "generating_scenes") setGenStep("Generating scenes...");
          else if (s.step === "saving") setGenStep("Saving results...");

          if (s.status === "complete") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            const updated = await getCustomTemplate(template.id);
            setCreatedTemplate(updated.data);
            setGeneratingCode(false);
            setSaving(false);
            setGenStep("");
          } else if (s.status === "error") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setCodeGenError(s.error || "Code generation failed. You can retry or skip.");
            setGeneratingCode(false);
            setSaving(false);
            setGenStep("");
          }
        } catch { /* ignore polling errors */ }
      }, 2000);
    } catch (err: any) {
      setCodeGenError(err?.response?.data?.detail || "Code generation failed. You can retry or skip.");
      setGeneratingCode(false);
      setSaving(false);
    }
  };

  const isGenerating = saving || generatingCode;
  const isDone = !isGenerating && !codeGenError && createdTemplate?.intro_code;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 1 ? "Extract Theme" : "Review & Save"}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
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

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
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
                ) : "Extract Theme"}
              </button>
              {loading && (
                <p className="text-xs text-gray-400 text-center">
                  Scraping website and analyzing design... this may take 10-20 seconds.
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
                  {(["accent", "bg", "text", "surface", "muted"] as const).map((key) => (
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
                  {(["bg", "text", "surface", "muted"] as const).map((key) => (
                    <div key={key} className="flex flex-col items-center gap-1.5">
                      <div className="w-8 h-8 rounded-full border-2 border-gray-200 shadow-sm" style={{ backgroundColor: theme.colors[key] }} />
                      <span className="text-[10px] text-gray-400 capitalize">{key}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Click the accent swatch to change the brand color</p>
              </div>

              {/* Video style */}
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Template Style Category
                </label>
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
                      <svg className={`w-4 h-4 transition-transform ${styleOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-purple-50 transition-colors ${supportedVideoStyle === style.id ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"}`}
                        >
                          {style.label}
                          <span className="ml-1 text-gray-400">— {style.subtitle}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                {theme.patterns && (
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
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ background: theme.colors.bg, aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                {isGenerating ? (
                  <>
                    <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${accentColor}40`, borderTopColor: accentColor }} />
                    <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
                      {genStep || "Generating template..."}
                    </p>
                    <p className="text-xs" style={{ color: theme.colors.muted }}>{elapsedSeconds}s elapsed</p>
                  </>
                ) : codeGenError ? (
                  <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <p className="text-sm text-red-500">{codeGenError}</p>
                    <button onClick={() => handleGenerateCode(createdTemplate)} className="px-4 py-2 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      Retry
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
                <div>
                  <p className="text-sm font-semibold text-gray-900">{createdTemplate.name}</p>
                  <p className="text-xs text-gray-400">{VIDEO_STYLE_OPTIONS.find((s) => s.id === createdTemplate.supported_video_style)?.label} · {theme.fonts.heading}</p>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => onCreated(createdTemplate)}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {isGenerating ? "Close & Generate in Background" : "Done"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
