import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  updateCustomTemplate,
  submitTemplateRating,
  type CustomTemplateItem,
} from "../api/client";
import CustomPreview, { buildCustomSceneLabels } from "./templatePreviews/CustomPreview";
import TemplateStarRating from "./TemplateStarRating";

interface Props {
  template: CustomTemplateItem;
  onSaved: (template: CustomTemplateItem) => void;
  onCancel: () => void;
  /** Update the parent's template in-place (e.g. after a rating) WITHOUT closing the modal. */
  onTemplatePatch?: (template: CustomTemplateItem) => void;
}

export default function CustomTemplateEditor({ template, onSaved, onCancel, onTemplatePatch }: Props) {
  const [name, setName] = useState(template.name);
  const [accentColor, setAccentColor] = useState(template.theme.colors.accent);
  const [useGradient, setUseGradient] = useState(template.theme.colors.bg2 != null);
  // const aiDecidedGradient = template.theme.colors.bg2 != null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradientOpen, setGradientOpen] = useState(false);
  const [liveScene, setLiveScene] = useState(0);
  const [myRating, setMyRating] = useState<number | null>(template.my_rating ?? null);
  const [myRatingComment, setMyRatingComment] = useState<string | null>(
    template.my_rating_comment ?? null
  );
  const [ratingSaving, setRatingSaving] = useState(false);
  const gradientRef = useRef<HTMLDivElement>(null);

  const handleRate = async (rating: 1 | 2 | 3 | 4 | 5, comment?: string) => {
    const prevRating = myRating;
    const prevComment = myRatingComment;
    const nextComment = comment ?? prevComment ?? null;
    setMyRating(rating);
    setMyRatingComment(nextComment);
    setRatingSaving(true);
    try {
      await submitTemplateRating(template.id, { rating, suggestion: comment });
      // Reflect the new rating on the parent's card without closing the modal.
      onTemplatePatch?.({ ...template, my_rating: rating, my_rating_comment: nextComment });
    } catch (err) {
      console.error("Failed to rate template:", err);
      setMyRating(prevRating);
      setMyRatingComment(prevComment);
    } finally {
      setRatingSaving(false);
    }
  };

  // Ordered scene names for the strip shown above the template name. Highlights the
  // scene currently on-screen in the live preview (driven by CustomPreview).
  const sceneLabels = buildCustomSceneLabels({
    introCode: template.intro_code || undefined,
    outroCode: template.outro_code || undefined,
    contentCodes: template.content_codes || undefined,
    contentArchetypeIds: template.content_archetype_ids || undefined,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gradientRef.current && !gradientRef.current.contains(e.target as Node)) {
        setGradientOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const theme = template.theme;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updatedColors = {
        ...template.theme.colors,
        accent: accentColor,
        bg2: useGradient ? (template.theme.colors.bg2 ?? template.theme.colors.surface) : undefined,
      };
      const res = await updateCustomTemplate(template.id, {
        name: name.trim(),
        theme: { ...template.theme, colors: updatedColors },
      });
      onSaved(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to update template.");
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit Template</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Live preview */}
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <CustomPreview theme={theme} name={name || undefined} introCode={template.intro_code || undefined} outroCode={template.outro_code || undefined} contentCodes={template.content_codes || undefined} contentArchetypeIds={template.content_archetype_ids || undefined} previewImageUrl={template.preview_image_url} logoUrls={template.logo_urls} ogImage={template.og_image} onLiveSceneChange={setLiveScene} />
          </div>

          {/* Scene name — a single centered pill showing the scene currently on
              screen in the preview; it smoothly swaps as the scene changes. */}
          {sceneLabels.length > 1 && (() => {
            const total = sceneLabels.length;
            const current = Math.min(liveScene, total - 1);
            return (
              <div className="flex items-center justify-center gap-2">
                <span className="text-[11px] font-medium text-gray-400 tabular-nums">
                  {current + 1} / {total}
                </span>
                <style>{`@keyframes scenePillIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
                <span
                  key={current}
                  className="text-[11px] font-semibold rounded-full px-3 py-1 whitespace-nowrap"
                  style={{
                    color: "#fff",
                    background: accentColor,
                    animation: "scenePillIn 0.3s ease-out",
                  }}
                >
                  {sceneLabels[current]}
                </span>
              </div>
            );
          })()}

          {/* Rating — above the name, with optional feedback (mirrors the video review) */}
          <div>
            <TemplateStarRating
              value={myRating}
              comment={myRatingComment}
              onRate={handleRate}
              disabled={ratingSaving}
              size={22}
              showLabel
              allowComment
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {/* Theme Colors */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Theme Colors
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Accent — editable */}
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
              {/* Other colors — read-only */}
              {(["bg", "text", "surface", "muted"] as const).map((key) => (
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-gray-200 shadow-sm"
                    style={{ backgroundColor: theme.colors[key] }}
                  />
                  <span className="text-[10px] text-gray-400 capitalize">{key}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Click the accent swatch to change the brand color</p>
          </div>

          {/* Gradient selector */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Background Style
            </label>
            <div ref={gradientRef} className="relative">
              <div className="flex items-center gap-2">
                <span className="inline-block px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium">
                  {useGradient ? "Gradient" : "Solid"}
                </span>
                {/* AI badge removed — confuses users */}
                <button
                  type="button"
                  onClick={() => setGradientOpen(!gradientOpen)}
                  className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${gradientOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {gradientOpen && (
                <div className="absolute z-10 mt-1.5 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                  {[
                    { value: false, label: "Solid"},
                    { value: true, label: "Gradient"},
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => { setUseGradient(opt.value); setGradientOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-purple-50 transition-colors ${useGradient === opt.value ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info pills — hidden */}
          {/* <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500">
              {theme.fonts.heading}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500">
              {theme.style}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500">
              {theme.animationPreset}
            </span>
          </div> */}


          {/* Visual patterns (read-only) — hidden: the corner/spacing/image/alignment
              chips confused users without giving them anything actionable. */}
          {/* {theme.patterns && (
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Visual Patterns
              </label>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-600 capitalize">
                  {theme.patterns.cards?.corners || "rounded"} cards
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
          )} */}

          {/* Motion / decor / charts + scene mix (read-only craft signals) */}
          {(theme.motion?.energy || theme.decor?.system || theme.charts?.style || (theme.sceneBias?.length ?? 0) > 0) && (
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Motion &amp; Scenes
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  theme.motion?.energy ? `${theme.motion.energy} motion` : null,
                  theme.decor?.system && theme.decor.system !== "none" ? `${theme.decor.system} decor` : null,
                  theme.charts?.style ? `${theme.charts.style} charts` : null,
                ].filter(Boolean).map((tag) => (
                  <span key={tag as string} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-600 capitalize">{tag}</span>
                ))}
                {theme.sceneBias?.map((s) => (
                  <span key={s} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-50 text-emerald-700 capitalize">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Source URL */}
          {template.source_url && (
            <p className="text-[11px] text-gray-400 truncate">
              Source: {template.source_url}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
