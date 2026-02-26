import { useState, useEffect, useRef } from "react";
import {
  Scene,
  Project,
  Asset,
  updateScene,
  updateSceneImage,
  generateSceneImage,
  regenerateScene,
  getValidLayouts,
  deleteAsset,
  LayoutInfo,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";
import { useNavigate } from "react-router-dom";

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
  whiteboard: {
    drawn_title: { title: [82, 118], desc: [30, 36] },
    marker_story: { title: [68, 92], desc: [30, 40] },
    stick_figure_scene: { title: [66, 84], desc: [30, 38] },
    stats_figures: { title: [58, 72], desc: [26, 30] },
    stats_chart: { title: [52, 64], desc: [24, 28] },
    comparison: { title: [52, 64], desc: [24, 28] },
  },
  newspaper: {
    news_headline: { title: [48, 64], desc: [19, 23] },
    article_lead: { title: [14, 16], desc: [20, 24] },
    pull_quote: { title: [30, 38], desc: [16, 19] },
    data_snapshot: { title: [38, 50], desc: [14, 16] },
    fact_check: { title: [36, 48], desc: [22, 24] },
    news_timeline: { title: [36, 48], desc: [15, 18] },
  },
};

export function getDefaultFontSizes(
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

// ─── Layout text field definitions ──────────────────────────
type FieldType = "string" | "text" | "string_array" | "object_array";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  subFields?: { key: string; label: string; placeholder?: string }[];
  placeholder?: string;
  maxItems?: number;
}

const LAYOUT_TEXT_FIELDS: Record<string, FieldDef[]> = {
  // Default template
  bullet_list: [{ key: "bullets", label: "Bullet points", type: "string_array", maxItems: 6 }],
  flow_diagram: [{ key: "steps", label: "Steps", type: "string_array", maxItems: 5 }],
  comparison: [
    { key: "leftLabel", label: "Left label", type: "string" },
    { key: "rightLabel", label: "Right label", type: "string" },
    { key: "leftDescription", label: "Left description", type: "text" },
    { key: "rightDescription", label: "Right description", type: "text" },
  ],
  timeline: [{ key: "timelineItems", label: "Timeline items", type: "object_array",
    subFields: [{ key: "label", label: "Label" }, { key: "description", label: "Description" }], maxItems: 4 }],
  metric: [{ key: "metrics", label: "Metrics", type: "object_array",
    subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "suffix", label: "Suffix", placeholder: "%" }], maxItems: 3 }],
  quote_callout: [
    { key: "quote", label: "Quote", type: "text" },
    { key: "quoteAuthor", label: "Author", type: "string" },
  ],
  code_block: [
    { key: "codeLanguage", label: "Language", type: "string", placeholder: "e.g. python" },
    { key: "codeLines", label: "Code lines", type: "string_array" },
  ],
  // Spotlight template
  cascade_list: [{ key: "items", label: "Items", type: "string_array" }],
  rapid_points: [{ key: "phrases", label: "Phrases", type: "string_array" }],
  versus: [
    { key: "leftLabel", label: "Left label", type: "string" },
    { key: "rightLabel", label: "Right label", type: "string" },
    { key: "leftDescription", label: "Left description", type: "text" },
    { key: "rightDescription", label: "Right description", type: "text" },
  ],
  closer: [
    { key: "highlightPhrase", label: "Highlight phrase", type: "string" },
    { key: "cta", label: "Call to action", type: "string" },
  ],
  stat_stage: [{ key: "metrics", label: "Metrics", type: "object_array",
    subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "suffix", label: "Suffix" }], maxItems: 3 }],
  // Nightfall template
  glass_stack: [{ key: "items", label: "Items", type: "string_array" }],
  glass_code: [
    { key: "codeLanguage", label: "Language", type: "string", placeholder: "e.g. python" },
    { key: "codeLines", label: "Code lines", type: "string_array" },
  ],
  split_glass: [
    { key: "leftLabel", label: "Left label", type: "string" },
    { key: "rightLabel", label: "Right label", type: "string" },
    { key: "leftDescription", label: "Left description", type: "text" },
    { key: "rightDescription", label: "Right description", type: "text" },
  ],
  chapter_break: [
    { key: "subtitle", label: "Subtitle", type: "string" },
    { key: "chapterNumber", label: "Chapter number", type: "string" },
  ],
  kinetic_insight: [
    { key: "quote", label: "Quote", type: "text" },
    { key: "highlightWord", label: "Highlight word", type: "string" },
  ],
  glow_metric: [{ key: "metrics", label: "Metrics", type: "object_array",
    subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "suffix", label: "Suffix" }], maxItems: 3 }],
  data_visualization: [
    { key: "barChartRows", label: "Bar chart data", type: "object_array",
      subFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value", placeholder: "Number" }], maxItems: 12 },
    { key: "lineChartLabels", label: "Line chart – X-axis labels", type: "string_array", maxItems: 12 },
    { key: "lineChartDatasets", label: "Line chart – series", type: "object_array",
      subFields: [{ key: "label", label: "Series name" }, { key: "valuesStr", label: "Values", placeholder: "e.g. 10, 20, 30" }], maxItems: 5 },
    { key: "pieChartRows", label: "Pie chart data", type: "object_array",
      subFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value", placeholder: "Number" }], maxItems: 12 },
  ],
  // Gridcraft template
  bento_compare: [
    { key: "leftLabel", label: "Left label", type: "string" },
    { key: "rightLabel", label: "Right label", type: "string" },
    { key: "leftDescription", label: "Left description", type: "text" },
    { key: "rightDescription", label: "Right description", type: "text" },
    { key: "verdict", label: "Verdict", type: "string" },
  ],
  bento_features: [{ key: "features", label: "Features", type: "object_array",
    subFields: [{ key: "icon", label: "Icon", placeholder: "emoji" }, { key: "label", label: "Label" }, { key: "description", label: "Description" }] }],
  bento_steps: [{ key: "steps", label: "Steps", type: "object_array",
    subFields: [{ key: "label", label: "Label" }, { key: "description", label: "Description" }] }],
  bento_highlight: [
    { key: "subtitle", label: "Subtitle", type: "string" },
    { key: "mainPoint", label: "Main point", type: "text" },
    { key: "supportingFacts", label: "Supporting facts", type: "string_array" },
  ],
  bento_hero: [
    { key: "tagline", label: "Tagline", type: "string" },
    { key: "category", label: "Category", type: "string" },
  ],
  pull_quote: [
    { key: "quote", label: "Quote", type: "text" },
    { key: "attribution", label: "Attribution", type: "string" },
    { key: "highlightPhrase", label: "Highlight phrase", type: "string" },
  ],
  bento_code: [
    { key: "codeLanguage", label: "Language", type: "string", placeholder: "e.g. python" },
    { key: "codeLines", label: "Code lines", type: "string_array" },
  ],
  kpi_grid: [{ key: "dataPoints", label: "Data points", type: "object_array",
    subFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value" }] }],
  // Whiteboard template
  stats_figures: [{ key: "stats", label: "Key figures", type: "object_array",
    subFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value", placeholder: "e.g. 50% or 10K+" }], maxItems: 4 }],
  stats_chart: [{ key: "stats", label: "Bar chart rows", type: "object_array",
    subFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value", placeholder: "Number 0–100" }], maxItems: 5 }],
  // Newspaper template
  news_headline: [
    { key: "category", label: "Section / category", type: "string", placeholder: "e.g. Politics, Technology" },
    { key: "leftThought", label: "Words to highlight (comma-separated)", type: "string", placeholder: "e.g. government,funding" },
    { key: "stats", label: "Byline", type: "object_array", subFields: [{ key: "value", label: "Author (row 1) / Date (row 2)" }], maxItems: 2 },
  ],
  article_lead: [
    { key: "stats", label: "Pull stat", type: "object_array", subFields: [{ key: "value", label: "Number" }, { key: "label", label: "Caption" }], maxItems: 1 },
  ],
  data_snapshot: [
    { key: "stats", label: "Key figures", type: "object_array", subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }], maxItems: 4 },
  ],
  fact_check: [
    { key: "leftThought", label: "Claimed", type: "text", placeholder: "The claim to check" },
    { key: "rightThought", label: "The facts", type: "text", placeholder: "The factual correction" },
    { key: "stats", label: "Column labels", type: "object_array", subFields: [{ key: "label", label: "Left (row 1) / Right (row 2) label" }], maxItems: 2 },
  ],
  news_timeline: [
    { key: "stats", label: "Timeline events", type: "object_array", subFields: [{ key: "value", label: "Date" }, { key: "label", label: "Description" }], maxItems: 5 },
  ],
};

/** Template-specific overrides for layout fields (when same layout id exists in multiple templates with different props). */
const LAYOUT_TEXT_FIELDS_OVERRIDE: Record<string, Record<string, FieldDef[]>> = {
  whiteboard: {
    comparison: [
      { key: "leftThought", label: "Left thought", type: "text", placeholder: "e.g. Option A or first idea" },
      { key: "rightThought", label: "Right thought", type: "text", placeholder: "e.g. Option B or second idea" },
    ],
  },
  newspaper: {
    pull_quote: [
      { key: "stats", label: "Source / publication", type: "object_array", subFields: [{ key: "label", label: "Source" }], maxItems: 1 },
    ],
  },
};

function getLayoutFields(template: string, layoutId: string | null): FieldDef[] | undefined {
  if (!layoutId) return undefined;
  const t = (template || "default").toLowerCase();
  return LAYOUT_TEXT_FIELDS_OVERRIDE[t]?.[layoutId] ?? LAYOUT_TEXT_FIELDS[layoutId];
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
  const [aiNarration, setAiNarration] = useState(scene.narration_text || "");
  const [titleFontSize, setTitleFontSize] = useState<string>("");
  const [descriptionFontSize, setDescriptionFontSize] = useState<string>("");
  const [editableLayoutProps, setEditableLayoutProps] = useState<Record<string, unknown>>({});
  const [regenerateVoiceover, setRegenerateVoiceover] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<LayoutInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [removingAssetId, setRemovingAssetId] = useState<number | null>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [showAiImageUpgradeModal, setShowAiImageUpgradeModal] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { showError } = useErrorModal();
  const navigate = useNavigate();

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

  const layoutsWithoutImage = new Set<string>(layouts?.layouts_without_image ?? []);
  const supportsImage = !currentLayoutId || !layoutsWithoutImage.has(currentLayoutId);

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
    // Prefer dedicated display_text when available; otherwise fall back to narration_text.
    const initialDisplay = scene.display_text ?? scene.narration_text ?? "";
    setDisplayText(initialDisplay);
    setAiNarration(scene.narration_text || "");
    setSelectedLayout("__keep__");
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setGeneratingImage(false);
    setGeneratedImageBase64(null);
    setGeneratedPrompt(null);
    setShowAiImageUpgradeModal(false);
    let layoutId: string | null = null;
    let ts = "";
    let ds = "";
    let lpCopy: Record<string, unknown> = {};
    if (scene.remotion_code) {
      try {
        const desc = JSON.parse(scene.remotion_code);
        layoutId = desc.layout || null;
        const lp = desc.layoutProps || {};
        if (typeof lp.titleFontSize === "number") ts = String(lp.titleFontSize);
        if (typeof lp.descriptionFontSize === "number") ds = String(lp.descriptionFontSize);
        lpCopy = { ...lp };
        // data_visualization charts: convert stored shapes to editable form
        if (layoutId === "data_visualization") {
          const lpAny = lp as Record<string, unknown>;
          // Bar: { labels, values } -> barChartRows
          if (lpAny.barChart && typeof lpAny.barChart === "object") {
            const bc = lpAny.barChart as { labels?: string[]; values?: number[] };
            const labels = Array.isArray(bc.labels) ? bc.labels : [];
            const values = Array.isArray(bc.values) ? bc.values : [];
            lpCopy.barChartRows = labels.map((label, i) => ({ label, value: String(values[i] ?? "") }));
            delete (lpCopy as Record<string, unknown>).barChart;
          }
          // Pie: { labels, values } -> pieChartRows
          if (lpAny.pieChart && typeof lpAny.pieChart === "object") {
            const pc = lpAny.pieChart as { labels?: string[]; values?: number[] };
            const plabels = Array.isArray(pc.labels) ? pc.labels : [];
            const pvalues = Array.isArray(pc.values) ? pc.values : [];
            lpCopy.pieChartRows = plabels.map((label, i) => ({ label, value: String(pvalues[i] ?? "") }));
            delete (lpCopy as Record<string, unknown>).pieChart;
          }
          // Line: { labels, datasets: [{ label, values }] } -> lineChartLabels + lineChartDatasets
          if (lpAny.lineChart && typeof lpAny.lineChart === "object") {
            const lc = lpAny.lineChart as { labels?: string[]; datasets?: Array<{ label?: string; values?: number[] }> };
            lpCopy.lineChartLabels = Array.isArray(lc.labels) ? [...lc.labels] : [];
            const datasets = Array.isArray(lc.datasets) ? lc.datasets : [];
            lpCopy.lineChartDatasets = datasets.map((d) => ({
              label: d.label ?? "",
              valuesStr: (Array.isArray(d.values) ? d.values : []).join(", "),
            }));
            delete (lpCopy as Record<string, unknown>).lineChart;
          }
        }
      } catch { /* ignore */ }
    }
    setEditableLayoutProps(lpCopy);
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

  // Fetch layouts when modal opens (needed for manual mode: image support check and layout names)
  useEffect(() => {
    if (open && !layouts) {
      getValidLayouts(project.id)
        .then((res) => setLayouts(res.data))
        .catch(() => showError("Failed to load layouts"));
    }
  }, [open, project.id, layouts]);

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
          const lp = { ...(desc.layoutProps || {}), ...editableLayoutProps };
          // data_visualization: convert editable chart form back to stored shapes
          const layoutId = desc.layout || "";
          if (layoutId === "data_visualization") {
            if (Array.isArray(lp.barChartRows)) {
              const rows = lp.barChartRows as { label?: string; value?: string }[];
              lp.barChart = {
                labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
                values: rows.map((r) => (r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0)),
              };
              delete lp.barChartRows;
            }
            if (Array.isArray(lp.pieChartRows)) {
              const rows = lp.pieChartRows as { label?: string; value?: string }[];
              lp.pieChart = {
                labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
                values: rows.map((r) => (r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0)),
              };
              delete lp.pieChartRows;
            }
            if (Array.isArray(lp.lineChartLabels) && Array.isArray(lp.lineChartDatasets)) {
              const labels = (lp.lineChartLabels as string[]).map((l) => (l != null ? String(l) : ""));
              const datasets = (lp.lineChartDatasets as { label?: string; valuesStr?: string }[]).map((d) => ({
                label: (d && d.label != null ? String(d.label) : "") as string,
                values: (d && d.valuesStr != null ? String(d.valuesStr) : "")
                  .split(",")
                  .map((s) => Number(s.trim()) || 0),
              }));
              lp.lineChart = { labels, datasets };
              delete lp.lineChartLabels;
              delete lp.lineChartDatasets;
            }
          }
          // Remove chart keys from layoutProps when entries are empty (so they are not persisted)
          const bar = lp.barChart as { labels?: unknown[]; values?: number[] } | undefined;
          if (bar && (!Array.isArray(bar.labels) || !bar.labels.length || !Array.isArray(bar.values) || !bar.values.length || bar.values.every((v) => v === 0))) {
            delete lp.barChart;
          }
          const pie = lp.pieChart as { labels?: unknown[]; values?: number[] } | undefined;
          if (pie && (!Array.isArray(pie.labels) || !pie.labels.length || !Array.isArray(pie.values) || !pie.values.length || pie.values.every((v) => v === 0))) {
            delete lp.pieChart;
          }
          const line = lp.lineChart as { labels?: unknown[]; datasets?: { values?: number[] }[] } | undefined;
          if (line && (!Array.isArray(line.labels) || !line.labels.length || !Array.isArray(line.datasets) || !line.datasets.length || line.datasets.every((d) => !d.values?.length || d.values.every((v) => v === 0)))) {
            delete lp.lineChart;
          }
          if (tsNum !== null && tsNum !== defTitle) lp.titleFontSize = tsNum;
          else delete lp.titleFontSize;
          if (dsNum !== null && dsNum !== defDesc) lp.descriptionFontSize = dsNum;
          else delete lp.descriptionFontSize;
          desc.layoutProps = lp;
          remotionCode = JSON.stringify(desc);
        }
        await updateScene(project.id, scene.id, {
          title,
          // Update only the on-screen display text here; narration_text continues to drive voiceover.
          display_text: displayText,
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
        showError(String(msg));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (editMode === "ai") {
      const keepLayout = selectedLayout === "__keep__";
      setLoading(true);
      try {
        // If narration text was edited, persist it before regenerating layout/voiceover
        const trimmedNarration = aiNarration.trim();
        if (trimmedNarration !== (scene.narration_text || "").trim()) {
          await updateScene(project.id, scene.id, {
            narration_text: trimmedNarration,
          });
        }

        await regenerateScene(
          project.id,
          scene.id,
          description,
          // For this modal, keep display text unchanged by sending an empty display-text payload.
          "",
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
        showError(String(msg));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRemoveImage = async (assetId: number) => {
    setRemovingAssetId(assetId);
    try {
      await deleteAsset(project.id, assetId);
      onSaved();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Failed to remove image";
      showError(String(msg));
    } finally {
      setRemovingAssetId(null);
    }
  };

  const hasSceneText =
    Boolean((scene.title || "").trim()) || Boolean((scene.narration_text || "").trim());

  const handleGenerateImageClick = () => {
    if (!isPro) {
      setShowAiImageUpgradeModal(true);
      return;
    }
    handleGenerateImage();
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    try {
      const res = await generateSceneImage(project.id, scene.id);
      setGeneratedImageBase64(res.data.image_base64);
      setGeneratedPrompt(res.data.refined_prompt);
    } catch (err: unknown) {
      const status = err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : 0;
      if (status === 403) {
        setShowAiImageUpgradeModal(true);
      } else {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Image generation failed";
        showError(String(msg));
      }
      setGeneratedImageBase64(null);
      setGeneratedPrompt(null);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleKeepGeneratedImage = () => {
    if (!generatedImageBase64) return;
    const dataUrl = `data:image/png;base64,${generatedImageBase64}`;
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => new File([blob], "generated.png", { type: "image/png" }))
      .then((file) => {
        setSelectedImageFile(file);
        setGeneratedImageBase64(null);
        setGeneratedPrompt(null);
      })
      .catch(() => showError("Failed to use generated image"));
  };

  const handleDiscardGeneratedImage = () => {
    setGeneratedImageBase64(null);
    setGeneratedPrompt(null);
  };

  if (!open) return null;

  const manualOnly = editMode === "manual";

  return (
    <>
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
            className="p-1 rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  editMode === "ai"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                AI-Assisted editing
              </button>
            </div>
            {editMode === "ai" && canUseAI && (
              <p className="mt-1 text-xs text-gray-600 font-medium">
                AI-Assisted-Editing limit: {isPro ? "Unlimited" : `${Math.max(0, 3 - aiUsageCount)} of 3 remaining this period`}
              </p>
            )}
            {editMode === "ai" && !canUseAI && (
              <p className="mt-1 text-xs font-medium text-red-600">
                The limit for AI-Assisted Editing has been reached.
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

              {/* ── Layout content fields (dynamic per layout type) ── */}
              {(() => {
                const layoutFields = getLayoutFields(project.template || "default", currentLayoutId);
                return currentLayoutId && layoutFields && (
                <div>
                  <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                    Layout content
                  </h4>
                  <div className="space-y-4">
                    {layoutFields.map((field) => {
                      const inputClass = "w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500";
                      const textareaClass = "w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden";
                      if (field.type === "string") {
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <input
                              type="text"
                              value={String(editableLayoutProps[field.key] ?? "")}
                              onChange={(e) => setEditableLayoutProps((prev) => ({ ...prev, [field.key]: e.target.value }))}
                              placeholder={field.placeholder}
                              className={inputClass}
                            />
                          </div>
                        );
                      }
                      if (field.type === "text") {
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <AutoGrowTextarea
                              value={String(editableLayoutProps[field.key] ?? "")}
                              onChange={(e) => setEditableLayoutProps((prev) => ({ ...prev, [field.key]: e.target.value }))}
                              placeholder={field.placeholder}
                              className={textareaClass}
                              minRows={2}
                            />
                          </div>
                        );
                      }
                      if (field.type === "string_array") {
                        const items = (Array.isArray(editableLayoutProps[field.key]) ? editableLayoutProps[field.key] : []) as string[];
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <div className="space-y-2">
                              {items.map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-400 w-5 text-right flex-shrink-0 tabular-nums">{i + 1}.</span>
                                  <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => {
                                      const updated = [...items];
                                      updated[i] = e.target.value;
                                      setEditableLayoutProps((prev) => ({ ...prev, [field.key]: updated }));
                                    }}
                                    className={`flex-1 ${inputClass}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = items.filter((_, j) => j !== i);
                                      setEditableLayoutProps((prev) => ({ ...prev, [field.key]: updated }));
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 rounded-lg hover:bg-gray-100"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                              {(!field.maxItems || items.length < field.maxItems) && (
                                <button
                                  type="button"
                                  onClick={() => setEditableLayoutProps((prev) => ({ ...prev, [field.key]: [...items, ""] }))}
                                  className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider hover:text-purple-600 mt-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add {field.label.toLowerCase().replace(/s$/, "")}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }
                      if (field.type === "object_array" && field.subFields) {
                        const items = (Array.isArray(editableLayoutProps[field.key]) ? editableLayoutProps[field.key] : []) as Record<string, string>[];
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <div className="space-y-3">
                              {items.map((item, i) => (
                                <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                                  <span className="text-[11px] text-gray-400 w-5 text-right flex-shrink-0 pt-2 tabular-nums">{i + 1}.</span>
                                  <div className="flex-1 space-y-2">
                                    {field.subFields!.map((sf) => (
                                      <div key={sf.key}>
                                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1 block">{sf.label}</label>
                                        <input
                                          type="text"
                                          value={item[sf.key] ?? ""}
                                          placeholder={sf.placeholder || sf.label}
                                          onChange={(e) => {
                                            const updated = [...items];
                                            updated[i] = { ...updated[i], [sf.key]: e.target.value };
                                            setEditableLayoutProps((prev) => ({ ...prev, [field.key]: updated }));
                                          }}
                                          className={inputClass}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = items.filter((_, j) => j !== i);
                                      setEditableLayoutProps((prev) => ({ ...prev, [field.key]: updated }));
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 rounded-lg hover:bg-gray-100 mt-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                              {(!field.maxItems || items.length < field.maxItems) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const empty: Record<string, string> = {};
                                    field.subFields!.forEach((sf) => { empty[sf.key] = ""; });
                                    setEditableLayoutProps((prev) => ({ ...prev, [field.key]: [...items, empty] }));
                                  }}
                                  className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider hover:text-purple-600 mt-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add {field.label.toLowerCase().replace(/s$/, "")}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
              })()}

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">
                  Typography <span className="normal-case tracking-normal text-gray-300">(optional)</span>
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-baseline">
                      <label className="text-xs text-gray-400">Title font size</label>
                      <span className="text-xs font-medium text-purple-600 tabular-nums">{titleFontSize}</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={1}
                      value={Math.min(200, Math.max(20, parseInt(titleFontSize, 10) || defaultFontSizes.title))}
                      onChange={(e) => setTitleFontSize(e.target.value)}
                      className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline ">
                      <label className="text-xs text-gray-400">Description font size</label>
                      <span className="text-xs font-medium text-purple-600 tabular-nums">{descriptionFontSize}</span>
                    </div>
                    <input
                      type="range"
                      min={12}
                      max={80}
                      step={1}
                      value={Math.min(80, Math.max(12, parseInt(descriptionFontSize, 10) || defaultFontSizes.desc))}
                      onChange={(e) => setDescriptionFontSize(e.target.value)}
                      className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Scene image
                </h4>
                {supportsImage ? (
                  <>
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
                          className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 disabled:opacity-50 transition-colors"
                        >
                          {removingAssetId === asset.id ? (
                            <span className="text-[10px]">…</span>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
                          className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
                    <button
                      type="button"
                      onClick={handleGenerateImageClick}
                      disabled={!hasSceneText || generatingImage}
                      title={!hasSceneText ? "Add title or narration to generate an image" : "Generate image with AI"}
                      className="flex items-center justify-center gap-1.5 w-20 h-20 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-100/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-purple-700"
                    >
                      {generatingImage ? (
                        <span className="text-xs">…</span>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          <span className="text-[10px] font-medium">AI</span>
                        </>
                      )}
                    </button>
                  </div>
                  {!hasSceneText && (
                    <p className="text-xs text-gray-400 mt-1.5">Add a title or narration to use AI image generation.</p>
                  )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    This layout does not support images. You can change the layout through AI assisted editing to an image supporting layout.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── AI-Assisted mode fields ── */}
          {editMode === "ai" && (
            <div className={`mt-5 space-y-4 ${!canUseAI ? "pointer-events-none opacity-60" : ""}`}>
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

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Narration text (voiceover script)
                </h4>
                <AutoGrowTextarea
                  value={aiNarration}
                  onChange={(e) => setAiNarration(e.target.value)}
                  placeholder="Edit the narration that will be spoken in the voiceover..."
                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
                  minRows={3}
                />
                <p className="mt-1 text-xs text-gray-500">
                  This controls the spoken narration and scene timing. Display text is edited in Manual mode.
                </p>
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
                      {currentLayoutId && (
                        <span className={`ml-1 ${supportsImage ? "text-gray-500" : "text-gray-400 italic"}`}>
                          ({supportsImage ? "Supports images" : "Does not support images"})
                        </span>
                      )}
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
                      .map((layoutId) => {
                        const supportsImageForLayout = !layoutsWithoutImage.has(layoutId);
                        return (
                          <button
                            key={layoutId}
                            type="button"
                            onClick={() => { setSelectedLayout(layoutId); setLayoutOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 text-xs hover:bg-purple-50 transition-colors ${
                              selectedLayout === layoutId ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"
                            }`}
                          >
                            {layouts.layout_names[layoutId] || layoutId.replace(/_/g, " ")}
                            <span className={`ml-1 ${supportsImageForLayout ? "text-gray-500" : "text-gray-400 italic"}`}>
                              ({supportsImageForLayout ? "Supports images" : "Does not support images"})
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
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
            disabled={loading || (editMode === "ai" && (!aiHasChanges || !canUseAI))}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : editMode === "manual" ? "Save changes" : "Apply AI edit"}
          </button>
        </div>
      </div>
    </div>

    {showAiImageUpgradeModal && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAiImageUpgradeModal(false)} />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Pro feature</h3>
          <p className="text-sm text-gray-600 mb-6">
            AI image generation is available on the Pro plan. Upgrade to unlock.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/pricing")}
              className="flex-1 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Go to pricing
            </button>
            <button
              type="button"
              onClick={() => setShowAiImageUpgradeModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    )}

    {/* AI generated image preview popup */}
    {generatedImageBase64 && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleDiscardGeneratedImage}
        />
        <div
          className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">AI generated image</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleKeepGeneratedImage}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                title="Use this image"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleDiscardGeneratedImage}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                title="Discard"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center bg-gray-50 min-h-0">
            <img
              src={`data:image/png;base64,${generatedImageBase64}`}
              alt="AI generated"
              className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-lg shadow-inner"
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
}
