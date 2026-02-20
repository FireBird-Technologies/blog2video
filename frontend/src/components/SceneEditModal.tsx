import { useState, useEffect, useRef } from "react";
import {
  Scene,
  Project,
  Asset,
  updateScene,
  updateSceneImage,
  regenerateScene,
  getValidLayouts,
  deleteAsset,
  LayoutInfo,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";

/** Layout default font sizes: [portrait, landscape] or single number for both. */
const LAYOUT_FONT_DEFAULTS: Record<string, Record<string, { title: number | [number, number]; desc?: number | [number, number] }>> = {
  default: {
    text_narration: { title: [34, 44], desc: [20, 23] },
    hero_image: { title: [40, 54] },
    image_caption: { title: [26, 32], desc: [17, 20] },
    bullet_list: { title: [30, 40], desc: [18, 22] },
    flow_diagram: { title: [30, 38], desc: [16, 20] },
    comparison: { title: [30, 38], desc: [16, 20] },
    metric: { title: [18, 22], desc: [16, 20] },
    code_block: { title: [26, 36] },
    timeline: { title: [30, 38], desc: [14, 16] },
    quote_callout: { title: [30, 38], desc: [16, 20] },
  },
  nightfall: {
    cinematic_title: { title: [88, 140], desc: [26, 36] },
    glass_narrative: { title: [40, 52], desc: 25 },
    glass_image: { title: [48, 64], desc: 28 },
    glass_code: { title: [18, 22], desc: 22 },
    split_glass: { title: [34, 46], desc: [20, 24] },
    chapter_break: { title: [36, 46], desc: [18, 24] },
    data_visualization: { title: [34, 46], desc: 25 },
    glow_metric: { title: [28, 36], desc: [18, 20] },
    glass_stack: { title: [34, 42], desc: [16, 18] },
    kinetic_insight: { title: [80, 120], desc: [60, 72] },
  },
  spotlight: {
    impact_title: { title: [64, 100], desc: [18, 22] },
    word_punch: { title: [96, 140] },
    stat_stage: { title: [80, 120], desc: [11, 14] },
    cascade_list: { title: [18, 28], desc: [20, 30] },
    rapid_points: { title: [32, 52] },
    spotlight_image: { title: [52, 72], desc: [18, 24] },
    versus: { title: [28, 40], desc: [12, 16] },
    closer: { title: [28, 42], desc: [12, 16] },
  },
  gridcraft: {
    editorial: { title: 36, desc: 18 },
    bento_hero: { title: 72, desc: 18 },
    bento_features: { title: 24, desc: 14 },
    bento_compare: { title: 24, desc: 16 },
    bento_highlight: { title: 32, desc: 18 },
    bento_code: { title: 24, desc: 16 },
    bento_steps: { title: 18, desc: 13 },
    pull_quote: { title: 42, desc: 16 },
  },
};

function getDefaultFontSizes(
  template: string,
  layoutId: string | null,
  aspectRatio: string
): { title: number; desc: number } {
  const p = aspectRatio === "portrait";
  const t = (template || "default").toLowerCase();
  const layout = layoutId || "text_narration";
  const defs = LAYOUT_FONT_DEFAULTS[t]?.[layout] ?? LAYOUT_FONT_DEFAULTS.default?.text_narration ?? { title: [34, 44], desc: [20, 23] };
  const titleVal = defs.title;
  const descVal = defs.desc;
  const title = Array.isArray(titleVal) ? (p ? titleVal[0] : titleVal[1]) : (titleVal as number);
  const desc = descVal !== undefined
    ? (Array.isArray(descVal) ? (p ? descVal[0] : descVal[1]) : descVal)
    : 20;
  return { title, desc };
}

// Auto-growing textarea component
function AutoGrowTextarea({ value, onChange, className, placeholder, minRows = 2 }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const lineHeight = 20; // Approximate line height in pixels
      const minHeight = minRows * lineHeight + 16; // padding
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.max(minHeight, scrollHeight)}px`;
    }
  }, [value, minRows]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      rows={minRows}
    />
  );
}

export interface SceneImageItem {
  url: string;
  asset: Asset;
}

interface Props {
  open: boolean;
  onClose: () => void;
  scene: Scene;
  project: Project;
  imageItems: SceneImageItem[];
  onSaved: () => void;
}

type EditMode = "manual" | "ai";

export default function SceneEditModal({
  open,
  onClose,
  scene,
  project,
  imageItems,
  onSaved,
}: Props) {
  const [editMode, setEditMode] = useState<EditMode>("manual");
  const [title, setTitle] = useState(scene.title);
  const [description, setDescription] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [titleFontSize, setTitleFontSize] = useState<string>("");
  const [descriptionFontSize, setDescriptionFontSize] = useState<string>("");
  const [regenerateVoiceover, setRegenerateVoiceover] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<LayoutInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<number | null>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Cleanup image preview URL
  useEffect(() => {
    if (selectedImageFile) {
      const url = URL.createObjectURL(selectedImageFile);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreviewUrl(null);
    }
  }, [selectedImageFile]);

  const isPro = user?.plan === "pro";
  const aiUsageCount = project.ai_assisted_editing_count || 0;
  const canUseAI = isPro || aiUsageCount < 3;

  const currentLayoutId = (() => {
    try {
      if (scene.remotion_code) {
        const desc = JSON.parse(scene.remotion_code);
        return desc.layout || null;
      }
    } catch { /* ignore */ }
    return null;
  })();
  const currentLayoutLabel = currentLayoutId
    ? (layouts?.layout_names[currentLayoutId] || currentLayoutId.replace(/_/g, " "))
    : "Current layout";

  const defaultFontSizes = getDefaultFontSizes(
    project.template || "default",
    currentLayoutId,
    project.aspect_ratio || "landscape"
  );

  const aiHasChanges =
    description.trim().length > 0 ||
    regenerateVoiceover ||
    selectedLayout !== "__keep__";

  useEffect(() => {
    if (!open) return;
    setTitle(scene.title);
    setDescription("");
    setDisplayText(scene.narration_text || "");
    setSelectedLayout("__keep__");
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setError(null);
    // Load font sizes: use layoutProps if set, otherwise use layout default as starting point
    let layoutId: string | null = null;
    let ts = "";
    let ds = "";
    if (scene.remotion_code) {
      try {
        const desc = JSON.parse(scene.remotion_code);
        layoutId = desc.layout || null;
        const lp = desc.layoutProps || {};
        if (typeof lp.titleFontSize === "number") ts = String(lp.titleFontSize);
        if (typeof lp.descriptionFontSize === "number") ds = String(lp.descriptionFontSize);
      } catch { /* ignore */ }
    }
    const defaults = getDefaultFontSizes(
      project.template || "default",
      layoutId,
      project.aspect_ratio || "landscape"
    );
    if (!ts) ts = String(defaults.title);
    if (!ds) ds = String(defaults.desc);
    setTitleFontSize(ts);
    setDescriptionFontSize(ds);
  }, [open, scene.id, scene.title, scene.remotion_code, project.template, project.aspect_ratio]);

  useEffect(() => {
    if (open && editMode === "ai" && !layouts) {
      getValidLayouts(project.id)
        .then((res) => setLayouts(res.data))
        .catch(() => setError("Failed to load layouts"));
    }
  }, [open, editMode, project.id, layouts]);

  useEffect(() => {
    if (!layoutOpen) return;
    const handler = (e: MouseEvent) => {
      if (layoutRef.current && !layoutRef.current.contains(e.target as Node)) {
        setLayoutOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [layoutOpen]);

  const handleSave = async () => {
    setError(null);
    if (editMode === "manual") {
      setLoading(true);
      try {
        // Build remotion_code with font size overrides in layoutProps
        let remotionCode: string | undefined;
        const parseNum = (s: string, min: number, max: number): number | null => {
          const n = parseInt(s.trim(), 10);
          return !isNaN(n) ? Math.min(max, Math.max(min, n)) : null;
        };
        const tsNum = parseNum(titleFontSize, 20, 200);
        const dsNum = parseNum(descriptionFontSize, 12, 80);
        const defTitle = defaultFontSizes.title;
        const defDesc = defaultFontSizes.desc;
        if (tsNum !== null || dsNum !== null || scene.remotion_code) {
          let desc: { layout?: string; layoutProps?: Record<string, unknown> } = {};
          if (scene.remotion_code) {
            try {
              desc = JSON.parse(scene.remotion_code);
            } catch { /* ignore */ }
          }
          const lp = { ...(desc.layoutProps || {}) };
          if (tsNum !== null && tsNum !== defTitle) lp.titleFontSize = tsNum;
          else delete lp.titleFontSize;
          if (dsNum !== null && dsNum !== defDesc) lp.descriptionFontSize = dsNum;
          else delete lp.descriptionFontSize;
          desc.layoutProps = lp;
          remotionCode = JSON.stringify(desc);
        }
        await updateScene(project.id, scene.id, {
          title,
          narration_text: displayText,
          ...(remotionCode !== undefined && { remotion_code: remotionCode }),
        });
        if (selectedImageFile) {
          await updateSceneImage(project.id, scene.id, selectedImageFile);
        }
        onSaved();
        onClose();
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Failed to update scene";
        setError(String(msg));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (editMode === "ai") {
      const keepLayout = selectedLayout === "__keep__";
      setLoading(true);
      try {
        await regenerateScene(
          project.id,
          scene.id,
          description,
          scene.narration_text || "",
          regenerateVoiceover,
          keepLayout ? "__keep__" : (selectedLayout === "__auto__" ? undefined : selectedLayout || undefined),
          undefined
        );
        onSaved();
        onClose();
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Failed to regenerate scene";
        setError(String(msg));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRemoveImage = async (assetId: number) => {
    setError(null);
    setRemovingAssetId(assetId);
    try {
      await deleteAsset(project.id, assetId);
      onSaved();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Failed to remove image";
      setError(String(msg));
    } finally {
      setRemovingAssetId(null);
    }
  };

  if (!open) return null;

  const manualOnly = editMode === "manual";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Edit Scene {scene.order}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Manual vs AI toggle */}
          <div>
            <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Editing mode
            </h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditMode("manual")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  editMode === "manual"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Manual editing
              </button>
              <button
                type="button"
                onClick={() => setEditMode("ai")}
                disabled={!canUseAI}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  editMode === "ai"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : canUseAI
                    ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                }`}
              >
                AI-Assisted editing
              </button>
            </div>
            {editMode === "ai" && (
              <p className="mt-1 text-xs text-gray-600 font-medium">
                AI-Assisted-Editing limit: {isPro ? "Unlimited" : `${Math.max(0, 3 - aiUsageCount)} of 3 remaining this period`}
              </p>
            )}
          </div>

          {/* ── Manual mode fields ── */}
          {editMode === "manual" && (
            <div className="mt-5 space-y-4">
              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Title
                </h4>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Display text
                </h4>
                <AutoGrowTextarea
                  value={displayText}
                  onChange={(e) => setDisplayText(e.target.value)}
                  placeholder="Enter the text that will be displayed on screen..."
                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
                  minRows={2}
                />
              </div>

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Typography <span className="normal-case tracking-normal text-gray-300">(optional)</span>
                </h4>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-400 mb-0.5">Title font size</label>
                    <input
                      type="number"
                      min={20}
                      max={200}
                      step={1}
                      value={titleFontSize}
                      onChange={(e) => setTitleFontSize(e.target.value)}
                      placeholder={defaultFontSizes.title.toString()}
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-400 mb-0.5">Description font size</label>
                    <input
                      type="number"
                      min={12}
                      max={80}
                      step={1}
                      value={descriptionFontSize}
                      onChange={(e) => setDescriptionFontSize(e.target.value)}
                      placeholder={defaultFontSizes.desc.toString()}
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Values start at layout default. Use arrow keys or type to adjust up or down.
                </p>
              </div>

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Scene image
                </h4>
                <div className="flex flex-wrap gap-2">
                  {imageItems.map(({ url, asset }) => (
                    <div
                      key={asset.id}
                      className="relative group rounded-lg overflow-hidden border border-gray-200/40 flex-shrink-0"
                    >
                      <img
                        src={url}
                        alt=""
                        className="h-20 w-auto object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(asset.id)}
                        disabled={removingAssetId === asset.id}
                        className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 shadow"
                      >
                        {removingAssetId === asset.id ? (
                          <span className="text-[10px]">…</span>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                  {selectedImageFile && imagePreviewUrl && (
                    <div className="relative group rounded-lg overflow-hidden border-2 border-purple-400 flex-shrink-0">
                      <img
                        src={imagePreviewUrl}
                        alt="New image"
                        className="h-20 w-auto object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedImageFile(null);
                          setImagePreviewUrl(null);
                        }}
                        className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <label className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50 hover:bg-gray-100/50 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={(e) => setSelectedImageFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── AI-Assisted mode fields ── */}
          {editMode === "ai" && (
            <div className="mt-5 space-y-4">
              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Visual description <span className="normal-case tracking-normal text-gray-300">(optional)</span>
                </h4>
                <AutoGrowTextarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe how you want the visuals to change..."
                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
                  minRows={2}
                />
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Regenerate voiceover
                </h4>
                <button
                  type="button"
                  onClick={() => setRegenerateVoiceover(!regenerateVoiceover)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                    regenerateVoiceover ? "bg-purple-600" : "bg-gray-200"
                  }`}
                  role="switch"
                  aria-checked={regenerateVoiceover}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      regenerateVoiceover ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div ref={layoutRef} className="relative">
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Layout
                </h4>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium">
                    {selectedLayout === "__keep__"
                      ? (currentLayoutLabel)
                      : selectedLayout === "__auto__"
                        ? "Auto (Let AI choose)"
                        : (layouts?.layout_names[selectedLayout] || selectedLayout.replace(/_/g, " "))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLayoutOpen(!layoutOpen)}
                    className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${layoutOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {layoutOpen && (
                  <div className="absolute z-10 mt-1.5 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => { setSelectedLayout("__keep__"); setLayoutOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 transition-colors ${
                        selectedLayout === "__keep__" ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"
                      }`}
                    >
                      {currentLayoutLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedLayout("__auto__"); setLayoutOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 transition-colors ${
                        selectedLayout === "__auto__" ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"
                      }`}
                    >
                      Auto (Let AI choose)
                    </button>
                    {layouts?.layouts
                      .filter((id) => id !== currentLayoutId)
                      .map((layoutId) => (
                        <button
                          key={layoutId}
                          type="button"
                          onClick={() => { setSelectedLayout(layoutId); setLayoutOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 transition-colors ${
                            selectedLayout === layoutId ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"
                          }`}
                        >
                          {layouts.layout_names[layoutId] || layoutId.replace(/_/g, " ")}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || (editMode === "ai" && !aiHasChanges)}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : editMode === "manual" ? "Save changes" : "Apply AI edit"}
          </button>
        </div>
      </div>
    </div>
  );
}
