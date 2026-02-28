import { useState } from "react";
import {
  extractTheme,
  createCustomTemplate,
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
  const [step, setStep] = useState<1 | 2>(1);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<CustomTemplateTheme>(DEFAULT_THEME);
  const [supportedVideoStyle, setSupportedVideoStyle] = useState<VideoStyleId>("explainer");
  const [templateName, setTemplateName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [saving, setSaving] = useState(false);

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
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to extract theme. Try another URL.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save template
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
      });
      onCreated(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 pt-4">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                s <= step ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-400"
              }`}>
                {s < step ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s}
              </div>
              {s < 2 && <div className={`flex-1 h-0.5 ${s < step ? "bg-purple-600" : "bg-gray-200"}`} />}
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
              {/* Live preview */}
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <CustomPreview theme={theme} name={templateName || undefined} />
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
                <div className="space-y-2">
                  {VIDEO_STYLE_OPTIONS.map((style) => {
                    const selected = supportedVideoStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setSupportedVideoStyle(style.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                          selected
                            ? "border-purple-400 bg-purple-50"
                            : "border-gray-200 hover:border-purple-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{style.label}</span>
                          <span
                            className={`w-3 h-3 rounded-full border ${
                              selected ? "bg-purple-600 border-purple-600" : "border-gray-300"
                            }`}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{style.subtitle}</p>
                      </button>
                    );
                  })}
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
        </div>
      </div>
    </div>
  );
}
