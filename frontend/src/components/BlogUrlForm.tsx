import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useCraftedTemplates } from "../contexts/CraftedTemplatesContext";
import { useErrorModal } from "../contexts/ErrorModalContext";
import { BulkLinksSection } from "./BulkLinksSection";
import { classifyUrlScrapability } from "../utils/urlScrapability";
import { getVoicePreviews, getMyVoices, getPrebuiltVoices, previewVoice, getBgmTracks, BACKEND_URL, type TemplateMeta, type CraftedTemplateItem, type VoicePreview, type BulkProjectItem, type CustomTemplateItem, type SavedVoiceFromAPI, type ElevenLabsVoice } from "../api/client";
import {
  primeBlogUrlFormStep2Prefetch,
  fetchBlogUrlFormBuiltinTemplatesDeduped,
  fetchBlogUrlFormAvailabilityDeduped,
} from "../api/blogUrlFormStep2Prefetch";
import { VIDEO_STYLE_OPTIONS, normalizeVideoStyle, type VideoStyleId } from "../constants/videoStyles";
import UpgradePlanModal from "./UpgradePlanModal";
import { TEMPLATE_PREVIEWS, TEMPLATE_DESCRIPTIONS, NewTemplateBadge, PopularTemplateBadge, CustomTemplateBadge } from "./templatePreviewRegistry";
import CustomPreview from "./templatePreviews/CustomPreview";
import CustomPreviewLandscape from "./templatePreviews/CustomPreviewLandscape";
import CraftedTemplatePreviewSmart from "./templatePreviews/CraftedTemplatePreviewSmart";
import CraftYourTemplateCard from "./CraftYourTemplateCard";
import GetMoreTemplatesModal from "./GetMoreTemplatesModal";
import DesignerTemplateRequestModal from "./DesignerTemplateRequestModal";
import CraftYourVoiceCard from "./CraftYourVoiceCard";
import VoiceItem, { formatVoiceSubtitle, getMyVoiceDisplayName, subtitleForSavedVoice } from "./VoiceItem";
import AdvancedVoiceOptions from "./AdvancedVoiceOptions";
import {
  VOICE_STABILITY_DEFAULT,
  VOICE_STABILITY_MIN,
  VOICE_STABILITY_MAX,
  VOICE_SPEED_DEFAULT,
  VOICE_SPEED_MIN,
  VOICE_SPEED_MAX,
  VOICE_TUNING_STEP,
  VOICE_STYLE_DEFAULT,
  VOICE_STYLE_MIN,
  VOICE_STYLE_MAX,
  VOICE_EMOTIONS,
  parseVoiceTuning,
  serializeVoiceTuning,
} from "./voiceTuning";

export const VIDEO_STYLES = VIDEO_STYLE_OPTIONS;

const DEFAULT_VIDEO_STYLE: VideoStyleId = "auto";
const CRAFTED_TEMPLATE_MENU_THUMBNAIL_FRAME = 128; // ~85% of 5s * 30fps first scene

/** Source-bucket sentinel values for the genre dropdown (not real template genres). */
const GENRE_CUSTOM = "__custom__";
export const GENRE_CRAFTED = "__crafted__";
const GENRE_NEW = "__new__";
const GENRE_POPULAR = "__popular__";

function genreTemplateListCaption(genreFilter: string): string {
  if (genreFilter === GENRE_CUSTOM) return "Custom templates";
  if (genreFilter === GENRE_CRAFTED) return "Designer templates";
  if (genreFilter === GENRE_NEW) return "New templates";
  if (genreFilter === GENRE_POPULAR) return "Popular templates";
  if (genreFilter) return `Templates for ${genreFilter}`;
  return "All templates";
}

function templateBucketsForGenre(
  genreFilter: string,
  builtinTemplates: TemplateMeta[],
  readyCustomTemplates: CustomTemplateItem[],
  readyCraftedTemplates: CraftedTemplateItem[]
): {
  suggestedTemplates: TemplateMeta[];
  customTemplatesForStyle: CustomTemplateItem[];
  craftedTemplatesForStyle: CraftedTemplateItem[];
} {
  const sourceList = builtinTemplates;
  if (genreFilter === GENRE_CUSTOM) {
    return {
      suggestedTemplates: [],
      customTemplatesForStyle: readyCustomTemplates,
      craftedTemplatesForStyle: [],
    };
  }
  if (genreFilter === GENRE_CRAFTED) {
    return {
      suggestedTemplates: [],
      customTemplatesForStyle: [],
      craftedTemplatesForStyle: readyCraftedTemplates,
    };
  }
  if (genreFilter === GENRE_NEW) {
    return {
      suggestedTemplates: sourceList.filter((t) => t.new_template === true),
      customTemplatesForStyle: [],
      craftedTemplatesForStyle: [],
    };
  }
  if (genreFilter === GENRE_POPULAR) {
    return {
      suggestedTemplates: sourceList.filter((t) => t.popular_template === true),
      customTemplatesForStyle: [],
      craftedTemplatesForStyle: [],
    };
  }
  if (genreFilter) {
    const matchesGenre = (g?: string[]): boolean => (g ?? []).includes(genreFilter);
    return {
      suggestedTemplates: sourceList.filter((t) => matchesGenre(t.genres)),
      customTemplatesForStyle: [],
      craftedTemplatesForStyle: [],
    };
  }
  return {
    suggestedTemplates: sourceList,
    customTemplatesForStyle: readyCustomTemplates,
    craftedTemplatesForStyle: readyCraftedTemplates,
  };
}

/** First entry in template `genres` from meta.json; "" if missing. */
function defaultGenreForTemplate(meta: TemplateMeta | undefined | null): string {
  const raw = meta?.genres?.[0];
  return typeof raw === "string" && raw.trim() !== "" ? raw : "";
}

/** Genre aligned with a bulk row template id (built-in meta or custom genres). */
function defaultGenreForBulkTemplateId(
  templateId: string,
  builtinTemplates: TemplateMeta[],
  customTemplatesList: CustomTemplateItem[]
): string {
  if (templateId.startsWith("custom_")) {
    const cid = parseInt(templateId.replace("custom_", ""), 10);
    if (Number.isNaN(cid)) return "";
    const ct = customTemplatesList.find((t) => t.id === cid);
    return ct?.genres?.[0] ?? "";
  }
  return defaultGenreForTemplate(builtinTemplates.find((t) => t.id === templateId));
}

/**
 * After the style/genre split: video_style no longer changes per template — it's an orthogonal
 * user choice (Auto by default). These helpers exist only as no-op shims so existing call sites
 * keep compiling; they always return the form-wide default style.
 */
function defaultVideoStyleForTemplate(_meta: TemplateMeta | undefined | null): VideoStyleId {
  return DEFAULT_VIDEO_STYLE;
}

function videoStyleForBulkTemplateId(
  _templateId: string,
  _builtinTemplates: TemplateMeta[],
  _customTemplatesList: CustomTemplateItem[]
): VideoStyleId {
  return DEFAULT_VIDEO_STYLE;
}

/** Read-only demo mode used by help videos: forces step + seeds state without firing API calls. */
export interface BlogUrlFormDemoMode {
  step: 1 | 2 | 3;
  url?: string;
  name?: string;
  videoLength?: "short" | "medium" | "detailed";
  template?: string;
  videoStyle?: VideoStyleId;
  voiceGender?: "female" | "male" | "none";
  voiceAccent?: string;
  customVoiceId?: string;
  templatesData?: TemplateMeta[];
  customTemplatesData?: CustomTemplateItem[];
  myVoicesData?: SavedVoiceFromAPI[];
  voicePreviewsData?: Record<string, VoicePreview>;
  /** Replaces every built-in template preview with a static filler (used by help videos). */
  templatePreviewOverride?: (opts: { templateId: string; selected: boolean; thumbnail: boolean }) => ReactNode;
}

interface Props {
  onSubmit: (
    url: string,
    name?: string,
    voiceGender?: string,
    voiceAccent?: string,
    accentColor?: string,
    bgColor?: string,
    textColor?: string,
    animationInstructions?: string,
    logoFile?: File,
    logoPosition?: string,
    logoOpacity?: number,
    customVoiceId?: string,
    aspectRatio?: string,
    uploadFiles?: File[],
    template?: string,
    videoStyle?: VideoStyleId,
    videoLength?: "short" | "medium" | "detailed" | "more_detailed",
    contentLanguage?: string | null,
    voiceEmotion?: string,
    bgmTrackId?: string | null,
    bgmVolume?: number
  ) => Promise<void>;
  /** Bulk create: one call with array of configs; per-project logo via logoIndices + logoFiles. */
  onSubmitBulk?: (items: BulkProjectItem[], logoOptions: { logoIndices: number[]; logoFiles: File[] } | null) => Promise<void>;
  loading?: boolean;
  asModal?: boolean;
  onClose?: () => void;
  /** Invoked before navigating to My Templates to craft a template (e.g. close the new-project modal). */
  onDismissFlow?: () => void;
  /** When set, the form renders in read-only demo mode for help videos. */
  demoMode?: BlogUrlFormDemoMode;
  /** Pre-select a genre filter when step 2 opens (e.g. GENRE_CRAFTED to show Designer Templates). */
  initialGenre?: string;
}

const MAX_UPLOAD_FILES = 5;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const viteEnv =
  typeof import.meta !== "undefined" ? import.meta.env : undefined;
const processEnv =
  typeof globalThis !== "undefined" && "process" in globalThis
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    : undefined;

const MAX_BULK_LINKS = (() => {
  const raw = (viteEnv?.VITE_MAX_BULK_LINKS || processEnv?.VITE_MAX_BULK_LINKS) as
    | string
    | undefined;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
})();

/** Estimated wall-clock range per tier (UI only; backend still uses short | medium | detailed). */
const VIDEO_LENGTH_DURATION_LABELS: Record<"short" | "medium" | "detailed" | "more_detailed", string> = {
  short: "Short  ~  30 sec – 1 min",
  medium: "Medium  ~  1 - 3 mins",
  detailed: "Detailed  ~  3 – 8 mins",
  more_detailed: "More Detailed  ~  8+ mins",
};

/**
 * Minimum source-content word count each tier needs to actually reach that length.
 * Mirrors the backend thresholds in pipeline.py (_effective_video_length_for_content):
 * below these counts the video is automatically shortened to a smaller tier.
 */
const VIDEO_LENGTH_MIN_WORDS: Partial<Record<"short" | "medium" | "detailed" | "more_detailed", number>> = {
  detailed: 1500,
  more_detailed: 2000,
};

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".md", ".markdown", ".txt", ".vtt"];
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/vtt",
];

const VOICE_PREVIEW_KEYS = ["female_american", "female_british", "male_american", "male_british"];
const SUPPORTED_CONTENT_LANGUAGES: Array<{ code: string; name: string }> = [
  { code: "ar", name: "Arabic" },
  { code: "bn", name: "Bengali" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fa", name: "Persian (Farsi)" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "gu", name: "Gujarati" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "nl", name: "Dutch" },
  { code: "no", name: "Norwegian" },
  { code: "pa", name: "Punjabi" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "vi", name: "Vietnamese" },
  { code: "zh-cn", name: "Chinese (Simplified)" },
  { code: "zh-tw", name: "Chinese (Traditional)" },
];

const getLanguageOptionLabel = (code: string): string => {
  if (code === "auto") return "Auto";
  const lang = SUPPORTED_CONTENT_LANGUAGES.find((item) => item.code === code);
  return lang ? `${lang.code} - ${lang.name}` : code;
};

const normalizeVoiceGender = (value?: string | null): "female" | "male" | null => {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "female" || v === "male") return v;
  return null;
};

const normalizeVoiceAccent = (value?: string | null): string | null => {
  const v = (value ?? "").trim();
  if (!v) return null;
  return v.toLowerCase();
};


// Step indicator — order: 1 Content, 2 Template, 3 Voice
function StepIndicator({ current, total }: { current: number; total: number }) {
  const stepLabels = ["Project", "Template", "Voice"];
  return (
    <div className="flex flex-col items-center gap-2 mb-6">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
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
              {n < current ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                n
              )}
            </div>
            {n < total && (
              <div
                className={`h-px w-8 transition-all ${
                  n < current ? "bg-purple-300" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <span className="text-[11px] text-gray-400 font-medium">
        Step {current} — {stepLabels[current - 1]}
      </span>
    </div>
  );
}

// ─── Template video player lightbox
interface VideoLightboxProps {
  templateId: string;
  onClose: () => void;
  onSelect: () => void;
  isSelected: boolean;
  customTemplate?: CustomTemplateItem | CraftedTemplateItem | null;
}
function TemplateVideoLightbox({ templateId, onClose, onSelect, isSelected, customTemplate }: VideoLightboxProps) {
  const { ensureCraftedTemplateDetail } = useCraftedTemplates();
  const PreviewComp = TEMPLATE_PREVIEWS[templateId];
  const desc = TEMPLATE_DESCRIPTIONS[templateId];
  const title = customTemplate ? customTemplate.name : (desc?.title ?? templateId);
  const subtitle = customTemplate
    ? (templateId.startsWith("crafted_") ? "Designer template" : "Custom template")
    : desc?.subtitle;

  // Crafted templates ship summary-only by default; the full layout package
  // (frontend_files, frontend_entry_rel, public_asset_urls) is fetched here
  // on demand so the lightbox can render the real composition. The context
  // dedupes concurrent calls and caches the result.
  useEffect(() => {
    if (templateId.startsWith("crafted_")) {
      void ensureCraftedTemplateDetail(templateId);
    }
  }, [templateId, ensureCraftedTemplateDetail]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Player container */}
      <div className="relative w-full max-w-2xl">
        {/* Screen bezel */}
        <div className="rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_32px_80px_rgba(0,0,0,0.7)] bg-[#0f0f0f]">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#1a1a1a] border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              {/* macOS-style dots */}
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
            </div>
            <span className="text-[11px] text-white/40 font-medium tracking-wide">
              {title} — Preview
            </span>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Video content */}
          <div className="bg-black">
            {customTemplate && customTemplate.theme ? (
              <CustomPreview theme={customTemplate.theme} name={customTemplate.name} previewImageUrl={customTemplate.preview_image_url ?? undefined} introCode={customTemplate.intro_code || undefined} outroCode={customTemplate.outro_code || undefined} contentCodes={customTemplate.content_codes || undefined} contentArchetypeIds={customTemplate.content_archetype_ids || undefined} validLayouts={(customTemplate as any).valid_layouts || undefined} frontendFiles={(customTemplate as any).frontend_files || undefined} frontendEntryRel={(customTemplate as any).frontend_entry_rel || undefined} publicAssetUrls={templateId.startsWith("crafted_") ? ((customTemplate as CraftedTemplateItem).public_asset_urls ?? undefined) : undefined} logoUrls={customTemplate.logo_urls ?? undefined} ogImage={customTemplate.og_image ?? undefined} showLoaderOnEmptyOrError={templateId.startsWith("crafted_")} />
            ) : PreviewComp ? (
              <PreviewComp />
            ) : (
              <div className="w-full aspect-video bg-gray-900 flex items-center justify-center text-gray-500 text-sm">
                No preview available
              </div>
            )}
          </div>

          {/* Bottom controls bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border-t border-white/[0.06]">
            <div className="text-[11px] text-white/40">
              {subtitle}
            </div>
            <button
              onClick={() => { onSelect(); onClose(); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              }`}
            >
              {isSelected ? "Selected" : "Use this template"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

type BlogUrlFormDemoStep = 1 | 2 | 3;

/**
 * @deprecated Use `<BlogUrlForm demoMode={...} />` directly. Kept temporarily for backwards compatibility.
 */
export function BlogUrlFormDemoModal({
  step,
  focus = "source",
}: {
  step: BlogUrlFormDemoStep;
  focus?: "new" | "source" | "template" | "voice" | "generate";
}) {
  const selectedTemplateId = "spotlight";
  const SelectedPreview = TEMPLATE_PREVIEWS[selectedTemplateId];
  const selectedDesc = TEMPLATE_DESCRIPTIONS[selectedTemplateId];
  const demoTemplates = ["spotlight", "nightfall", "gridcraft", "default"];

  const inputClass =
    "w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all";

  const step1 = (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 flex flex-col space-y-5 min-h-0">
        <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit">
          {(["url", "upload", "bulk"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === "url" ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {mode === "url" ? "Link" : mode === "upload" ? "Upload" : "Multi Link"}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Blog / Article URL
          </label>
          <input
            type="url"
            readOnly
            value="https://yourblog.com/how-ai-search-works"
            className={`${inputClass} ${focus === "source" ? "ring-2 ring-purple-500/40 border-transparent" : ""}`}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Project name <span className="normal-case text-gray-300">(optional)</span>
          </label>
          <input type="text" readOnly value="AI Search Explainer" className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Estimated duration
          </label>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-gray-200/60 bg-white/80 px-4 py-2.5 text-left text-sm text-gray-700"
          >
            <span>Medium  ~  1 - 3 mins</span>
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-5 flex gap-2 pt-1">
        <button
          type="button"
          className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          Go to step 2
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );

  const step2 = (
    <div className="space-y-5">
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
          Selected Template
        </label>
        <div className="rounded-xl overflow-hidden border-2 border-purple-500 shadow-[0_0_0_4px_rgba(124,58,237,0.1)]">
          <div className="relative">{SelectedPreview ? <SelectedPreview /> : null}</div>
          <div className="px-4 py-2.5 bg-purple-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">{selectedDesc?.title ?? "Spotlight"}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">{selectedDesc?.subtitle}</div>
            </div>
            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Video Style
          </label>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100/60 rounded-xl justify-center">
            {VIDEO_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  style.id === "promotional" ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mb-1.5 font-medium">
          Suggested templates for the selected video style
        </p>
        <div className="border border-gray-200/60 rounded-xl p-2.5 max-h-[220px] overflow-y-auto bg-gray-50/40">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <CraftYourTemplateCard
              variant="default"
              isPro
              onClick={() => undefined}
              onKeyDown={() => undefined}
            />
            {demoTemplates.map((templateId) => {
              const Preview = TEMPLATE_PREVIEWS[templateId];
              const desc = TEMPLATE_DESCRIPTIONS[templateId];
              const selected = templateId === selectedTemplateId;
              return (
                <div
                  key={templateId}
                  className={`relative rounded-lg overflow-hidden cursor-pointer transition-all group ${
                    selected
                      ? "border-2 border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                      : "border-2 border-gray-200/60 hover:border-purple-300/60"
                  }`}
                >
                  <div className="relative overflow-hidden max-h-[70px] min-h-[56px]">
                    {Preview ? <Preview thumbnailMode /> : null}
                    {selected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shadow-sm">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className={`px-2 py-1 transition-colors ${selected ? "bg-purple-50/80" : "bg-white/80"}`}>
                    <div className="text-[10px] font-semibold text-gray-800 truncate">{desc?.title ?? templateId}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" className="px-5 py-3 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/60">
          Back
        </button>
        <button type="button" className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
          Go to step 3
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );

  const voiceRows = [
    { name: "Rachel", subtitle: "Female - American - clear product narration", selected: true },
    { name: "Alice", subtitle: "Female - British - soft and polished", selected: false },
    { name: "Bill", subtitle: "Male - American - friendly and articulate", selected: false },
  ];

  const step3 = (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-purple-50/60 border border-purple-200/50">
        <svg className="w-4 h-4 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        <p className="text-[11px] text-purple-600 leading-relaxed">
          Choose narration language. Keep <span className="font-semibold">Auto</span> to detect from content.
        </p>
      </div>
      <div className="space-y-1.5">
        <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
          Language
        </label>
        <button type="button" className="flex w-full items-center justify-between rounded-xl border border-gray-200/60 bg-white/80 px-4 py-2.5 text-left text-sm text-gray-700">
          <span>Auto</span>
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <p className="text-[11px] text-gray-500">Language of the video content</p>
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-xl bg-gray-50/60 border border-gray-200/60 hover:border-gray-300/60 transition-all">
        <input type="checkbox" readOnly checked={false} className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600" />
        <div>
          <span className="text-sm font-medium text-gray-700">No voiceover</span>
          <p className="text-[11px] text-gray-400 mt-0.5">Text-only video, no narration audio</p>
        </div>
      </label>
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-3 uppercase tracking-wider">
          Voice - Select and Play to Preview
        </label>
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {voiceRows.map((voice) => (
            <VoiceItem
              key={voice.name}
              name={voice.name}
              subtitle={voice.subtitle}
              hasPreview
              isPlaying={focus === "voice" && voice.selected}
              onPlay={() => undefined}
              isSelected={voice.selected}
              actions={
                voice.selected ? (
                  <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : null
              }
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" className="px-5 py-3 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/60">
          Back
        </button>
        <button
          type="button"
          className={`flex-1 py-3 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 ${
            focus === "generate" ? "bg-purple-700 ring-4 ring-purple-500/20" : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          Generate Video
        </button>
      </div>
    </div>
  );

  const content = step === 1 ? step1 : step === 2 ? step2 : step3;

  return (
    <div className="relative w-full max-w-xl bg-white/90 backdrop-blur-xl border border-gray-200/40 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-7 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-gray-900">New Project</h2>
        <button className="text-gray-300 hover:text-gray-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <StepIndicator current={step} total={3} />
      <div className="relative min-h-[420px] flex flex-col">
        <div className="min-h-[420px] flex flex-col">{content}</div>
      </div>
    </div>
  );
}

function deriveNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.replace(/\/$/, "").split("/");
    const path = segments[segments.length - 1] || parsed.hostname;
    return path.replace(/[-_]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()).slice(0, 100) || "Untitled Project";
  } catch {
    return "Untitled Project";
  }
}

/** Returns true if the trimmed string has any whitespace in the middle (not just at start/end). */
function hasSpacesInMiddle(s: string): boolean {
  const t = s.trim();
  return t.length > 0 && /\s/.test(t);
}

/** Treat as a link only if it contains a dot (e.g. example.com). Rejects single words or plain sentences. */
function containsDot(s: string): boolean {
  return s.trim().includes(".");
}

const FILE_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odt", ".odp", ".ods", ".txt", ".md", ".markdown", ".rtf", ".csv"];

/** Returns the matched file extension if the URL ends with a document extension, else null. */
function getFileExtension(s: string): string | null {
  const trimmed = s.trim().toLowerCase();
  // Check the raw input first (covers "hello.pdf", "example.com/file.pdf", etc.)
  const directMatch = FILE_EXTENSIONS.find((ext) => trimmed.endsWith(ext));
  if (directMatch) return directMatch;
  // Also check the pathname of a parsed URL (handles query strings, e.g. site.com/doc.pdf?v=1)
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const path = url.pathname.toLowerCase();
    return FILE_EXTENSIONS.find((ext) => path.endsWith(ext)) ?? null;
  } catch {
    return null;
  }
}

export default function BlogUrlForm({ onSubmit, onSubmitBulk, loading, asModal, onClose, onDismissFlow, demoMode, initialGenre }: Props) {
  const { user } = useAuth();
  const { showError } = useErrorModal();
  const navigate = useNavigate();
  const isPro = demoMode ? true : user?.plan === "pro" || user?.plan === "standard";
  const isDemo = !!demoMode;

  // Wizard step
  const [step, setStep] = useState<1 | 2 | 3>(demoMode?.step ?? 1);
  useEffect(() => {
    if (demoMode?.step) setStep(demoMode.step);
  }, [demoMode?.step]);

  // Step 1 — input
  const [mode, setMode] = useState<"url" | "upload" | "bulk">("url");
  const [urls, setUrls] = useState<string[]>([""]);
  const [name, setName] = useState("");
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [docError, setDocError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  /** URL validation error for single-link mode (shown only after blur). */
  const [urlError, setUrlError] = useState<string | null>(null);
  // Bulk: rows (url); per-row name, template, voice, format, logo
  const [bulkRows, setBulkRows] = useState<{ url: string }[]>([{ url: "" }]);
  const [bulkNames, setBulkNames] = useState<string[]>([""]);
  const [bulkTemplates, setBulkTemplates] = useState<string[]>(["default"]);
  const bulkTemplatesRef = useRef<string[]>(["default"]);
  bulkTemplatesRef.current = bulkTemplates;
  const [bulkVoiceGender, setBulkVoiceGender] = useState<("female" | "male" | "none")[]>(["female"]);
  const [bulkVoiceAccent, setBulkVoiceAccent] = useState<string[]>(["american"]);
  const [bulkVoiceStability, setBulkVoiceStability] = useState<number[]>(() => [parseVoiceTuning(user?.preferred_voice_emotion)[0]]);
  const [bulkVoiceSpeed, setBulkVoiceSpeed] = useState<number[]>(() => [parseVoiceTuning(user?.preferred_voice_emotion)[1]]);
  const [bulkVoiceEmotion, setBulkVoiceEmotion] = useState<string[]>(() => [parseVoiceTuning(user?.preferred_voice_emotion)[2]]);
  const [bulkVoiceStyle, setBulkVoiceStyle] = useState<number[]>(() => [parseVoiceTuning(user?.preferred_voice_emotion)[3]]);
  const [bulkCustomVoiceId, setBulkCustomVoiceId] = useState<string[]>([]);
  const [bulkContentLanguage, setBulkContentLanguage] = useState<string[]>(["auto"]);
  const [bulkVideoLength, setBulkVideoLength] = useState<("short" | "medium" | "detailed" | "more_detailed")[]>(["short"]);
  const [bulkAspectRatio, setBulkAspectRatio] = useState<("landscape" | "portrait")[]>(["landscape"]);
  const [bulkVideoStyles, setBulkVideoStyles] = useState<VideoStyleId[]>([DEFAULT_VIDEO_STYLE]);
  const bulkStyleManuallySet = useRef<boolean[]>([false]);
  // Empty string = "not yet set from template"; we derive from template.preview_colors on step 2.
  const [bulkAccentColors, setBulkAccentColors] = useState<string[]>([""]);
  const [bulkBgColors, setBulkBgColors] = useState<string[]>([""]);
  const [bulkTextColors, setBulkTextColors] = useState<string[]>([""]);
  const [bulkActiveIndex, setBulkActiveIndex] = useState(0);
  const [bulkLogoFile, setBulkLogoFile] = useState<(File | null)[]>([null]);
  const [bulkLogoPosition, setBulkLogoPosition] = useState<string[]>(["bottom_right"]);
  const [bulkLogoOpacity, setBulkLogoOpacity] = useState<number[]>([0.9]);
  const [bulkLogoRowIndex, setBulkLogoRowIndex] = useState<number | null>(null);
  const bulkLogoInputRef = useRef<HTMLInputElement>(null);
  const [bulkApplyLengthAll, setBulkApplyLengthAll] = useState(true);
  const [bulkLengthMasterIndex, setBulkLengthMasterIndex] = useState(0);
  const [bulkApplyTemplateAll, setBulkApplyTemplateAll] = useState(true);
  const [bulkTemplateMasterIndex, setBulkTemplateMasterIndex] = useState(0);
  const [bulkApplyVoiceAll, setBulkApplyVoiceAll] = useState(true);
  const [bulkVoiceMasterIndex, setBulkVoiceMasterIndex] = useState(0);

  // Step 2 — voice
  const [voiceGender, setVoiceGender] = useState<"female" | "male" | "none">("female");
  const [voiceAccent, setVoiceAccent] = useState<string>("american");
  // Voice tuning sliders (paid). Initialized from the remembered per-user preference so a returning
  // user sees their last settings pre-selected.
  const [voiceStability, setVoiceStability] = useState<number>(() => parseVoiceTuning(user?.preferred_voice_emotion)[0]);
  const [voiceSpeed, setVoiceSpeed] = useState<number>(() => parseVoiceTuning(user?.preferred_voice_emotion)[1]);
  const [voiceEmotion, setVoiceEmotion] = useState<string>(() => parseVoiceTuning(user?.preferred_voice_emotion)[2]);
  const [voiceStyle, setVoiceStyle] = useState<number>(() => parseVoiceTuning(user?.preferred_voice_emotion)[3]);
  // Live voice-preview playback state (Advanced Options "Listen").
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing">("idle");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const stopVoicePreview = useCallback(() => {
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewState("idle");
  }, []);

  // Synthesize + play a short sample with the given voice + tuning. Toggling while playing stops it.
  const handleVoicePreview = useCallback(
    async (args: { gender: string; accent: string; customVoiceId: string; stability: number; speed: number; emotion: string; style: number }) => {
      if (previewState === "playing") {
        stopVoicePreview();
        return;
      }
      if (previewState === "loading") return;
      setPreviewState("loading");
      try {
        const url = await previewVoice({
          voice_gender: args.gender,
          voice_accent: args.accent,
          custom_voice_id: args.customVoiceId || undefined,
          voice_emotion: serializeVoiceTuning(args.stability, args.speed, args.emotion, args.style, true),
        });
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        const audio = new Audio(url);
        audio.addEventListener("ended", stopVoicePreview);
        previewAudioRef.current = audio;
        await audio.play();
        setPreviewState("playing");
      } catch (err: any) {
        setPreviewState("idle");
        const status = err?.response?.status;
        if (status === 429) showError("Please wait a moment before previewing again.");
        else if (status === 403) showError("Voice preview requires a Pro or Standard plan.");
        else showError("Couldn't generate a voice preview. Please try again.");
      }
    },
    [previewState, stopVoicePreview, showError]
  );

  // Stop any preview playback when the component unmounts.
  useEffect(() => () => stopVoicePreview(), [stopVoicePreview]);
  // Whether the "Advanced Options" tab (voice tuning sliders) is expanded. Paid-only.
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  // Active tab in the Step 3 voice/music panel: voice | bgm | advanced (paid).
  const [voicePanelTab, setVoicePanelTab] = useState<"voice" | "bgm" | "advanced">("voice");
  // Master switch for the expressive v3 path. Off → standard v2 voice. Only when ON is the voice
  // tuning sent (which is what routes the project through eleven_v3 + [excited] + emotive narration).
  // Defaults ON for users who previously enabled it (a saved preference exists) — it stays enabled
  // across sessions until they explicitly turn it off on a voiced video.
  const [expressiveEnabled, setExpressiveEnabled] = useState<boolean>(() => parseVoiceTuning(user?.preferred_voice_emotion)[4]);
  const [contentLanguage, setContentLanguage] = useState<string>("auto");
  const [videoLength, setVideoLength] = useState<"short" | "medium" | "detailed" | "more_detailed">("short");
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [voicePreviews, setVoicePreviews] = useState<Record<string, VoicePreview>>({});
  const [myVoicesList, setMyVoicesList] = useState<SavedVoiceFromAPI[]>([]);
  const [myVoicesLoading, setMyVoicesLoading] = useState(true);
  const [premiumTeaserVoices, setPremiumTeaserVoices] = useState<ElevenLabsVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedAudioRef = useRef<Record<string, HTMLAudioElement>>({});
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const voiceGenderRef = useRef(voiceGender);
  const customVoiceIdRef = useRef(customVoiceId);
  voiceGenderRef.current = voiceGender;
  customVoiceIdRef.current = customVoiceId;

  // Background music
  const [bgmTracks, setBgmTracks] = useState<import("../api/client").BgmTrack[]>([]);
  const [selectedBgmTrackId, setSelectedBgmTrackId] = useState<string | null>(null);
  const [selectedBgmVolume, setSelectedBgmVolume] = useState<number>(0.10);
  const [bgmPlayingId, setBgmPlayingId] = useState<string | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  // Step 2 — video style & template
  const [videoStyle, setVideoStyle] = useState<VideoStyleId>(DEFAULT_VIDEO_STYLE);
  const styleManuallySet = useRef(false);
  /** Genre dropdown filter — populated dynamically from all templates' meta.genres. "" = show all. */
  const [genre, setGenre] = useState<string>(initialGenre ?? "");
  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  const [template, setTemplate] = useState("default");
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const { craftedTemplates, loading: craftedTemplatesCacheLoading, initialized: craftedTemplatesInitialized, ensureCraftedTemplateDetail } = useCraftedTemplates();
  // When a crafted template is selected, fetch its full bundle (frontend_files,
  // entry, public assets) on demand so its picker card can render the REAL
  // composition via the module graph (falls back to the marquee until ready).
  useEffect(() => {
    if (template.startsWith("crafted_")) {
      void ensureCraftedTemplateDetail(template);
    }
  }, [template, ensureCraftedTemplateDetail]);
  /** Built-in template list fetch — drives step 2 loading overlay (often warmed by Dashboard prefetch). */
  const [builtinTemplatesLoading, setBuiltinTemplatesLoading] = useState(true);
  /** After built-ins load: session random pick (or skip) has finished — step 2 can interact. */
  const [sessionBuiltinInitDone, setSessionBuiltinInitDone] = useState(false);
  /** Random built-in default for new rows / initial pick; stable until templates reload. */
  const [pickerDefaultTemplateId, setPickerDefaultTemplateId] = useState<string>("default");
  const templateManuallySelectedRef = useRef(false);

  const [aspectRatio, setAspectRatio] = useState<"landscape" | "portrait">("landscape");
  const [accentColor, setAccentColor] = useState("#7C3AED");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [textColor, setTextColor] = useState("#000000");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPosition, setLogoPosition] = useState("bottom_right");
  const [logoOpacity, setLogoOpacity] = useState(0.9);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [videoPreviewId, setVideoPreviewId] = useState<string | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  /** When we navigated to step 3 (ms). Used to ignore submit from replayed click after "Go to step 3". */
  const step3EnteredAtRef = useRef<number | null>(null);

  // Load all templates once (filtering by style is done in UI)
  const [customTemplates, setCustomTemplates] = useState<CustomTemplateItem[]>([]);
  const templatesRef = useRef<TemplateMeta[]>(templates);
  const customTemplatesRef = useRef<CustomTemplateItem[]>(customTemplates);
  const pickerDefaultTemplateIdRef = useRef(pickerDefaultTemplateId);
  templatesRef.current = templates;
  customTemplatesRef.current = customTemplates;
  pickerDefaultTemplateIdRef.current = pickerDefaultTemplateId;
  // Only show templates that have finished generating (intro_code exists)
  const readyCustomTemplates = customTemplates.filter((ct) => !!ct.intro_code);
  const readyCraftedTemplates = craftedTemplates.filter((ct) => !!ct.theme);
  const [showCustomTemplateUpgrade, setShowCustomTemplateUpgrade] = useState(false);
  const [showGetMoreTemplates, setShowGetMoreTemplates] = useState(false);
  const [showDesignerRequest, setShowDesignerRequest] = useState(false);
  const [customTemplatesLoading, setCustomTemplatesLoading] = useState(false);
  const [hasCraftedTemplatesEligible, setHasCraftedTemplatesEligible] = useState(false);
  // Show the crafted-template loader until the first R2 roundtrip resolves
  // (not just during the non-silent fetch window), so eligible users never
  // see the "no templates" state flash while we silently revalidate the
  // localStorage cache against R2.
  const craftedTemplatesLoading =
    hasCraftedTemplatesEligible && (craftedTemplatesCacheLoading || !craftedTemplatesInitialized);
  const [templateAvailabilityLoading, setTemplateAvailabilityLoading] = useState(true);
  const allTemplates = useMemo<TemplateMeta[]>(() => {
    const byId = new Map<string, TemplateMeta>();
    for (const t of templates) byId.set(t.id, t);
    for (const ct of craftedTemplates) {
      if (!byId.has(ct.id)) byId.set(ct.id, ct as unknown as TemplateMeta);
    }
    return Array.from(byId.values());
  }, [templates, craftedTemplates]);

  const renderLanguageDropdown = (
    value: string,
    onSelect: (next: string) => void
  ) => (
    <details className="relative group">
      <summary className="list-none w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 flex items-center justify-between">
        <span>{getLanguageOptionLabel(value)}</span>
        <svg
          className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
        {/* ~12 visible rows; rest scrollable */}
        <div className="max-h-[18.5rem] overflow-y-auto py-1">
          <button
            type="button"
            onClick={(e) => {
              onSelect("auto");
              const details = (e.currentTarget.closest("details") as HTMLDetailsElement | null);
              details?.removeAttribute("open");
            }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-purple-50 ${
              value === "auto" ? "bg-purple-50 text-purple-700" : "text-gray-700"
            }`}
          >
            Auto
          </button>
          {SUPPORTED_CONTENT_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={(e) => {
                onSelect(lang.code);
                const details = (e.currentTarget.closest("details") as HTMLDetailsElement | null);
                details?.removeAttribute("open");
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-purple-50 ${
                value === lang.code ? "bg-purple-50 text-purple-700" : "text-gray-700"
              }`}
            >
              {lang.code} - {lang.name}
            </button>
          ))}
        </div>
      </div>
    </details>
  );

  const renderVideoLengthDropdown = (
    value: "short" | "medium" | "detailed" | "more_detailed",
    onSelect: (next: "short" | "medium" | "detailed" | "more_detailed") => void
  ) => {
    const minWords = VIDEO_LENGTH_MIN_WORDS[value];
    return (
    <>
    <details className="relative group">
      <summary className="list-none w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 flex items-center justify-between">
        <span>{VIDEO_LENGTH_DURATION_LABELS[value]}</span>
        <svg
          className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
        <div className="max-h-[18.5rem] overflow-y-auto py-1">
          {(["short", "medium", "detailed", "more_detailed"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={(e) => {
                onSelect(opt);
                const details = (e.currentTarget.closest("details") as HTMLDetailsElement | null);
                details?.removeAttribute("open");
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-purple-50 ${
                value === opt ? "bg-purple-50 text-purple-700" : "text-gray-700"
              }`}
            >
              {VIDEO_LENGTH_DURATION_LABELS[opt]}
            </button>
          ))}
        </div>
      </div>
    </details>
    {minWords && (
      <p className="mt-1.5 flex items-start gap-1 text-[11px] text-red-600 leading-relaxed">
        <svg className="w-3.5 h-3.5 flex-shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <span>
          Make sure your content is at least ~{minWords.toLocaleString()} words for this length,
          otherwise the video will be automatically shortened.
        </span>
      </p>
    )}
    </>
    );
  };

  // Load templates, voice previews, and user's saved voices once
  useEffect(() => {
    let mounted = true;
    if (isDemo) {
      if (demoMode?.templatesData) setTemplates(demoMode.templatesData);
      if (demoMode?.customTemplatesData) setCustomTemplates(demoMode.customTemplatesData);
      if (demoMode?.myVoicesData) setMyVoicesList(demoMode.myVoicesData);
      if (demoMode?.voicePreviewsData) setVoicePreviews(demoMode.voicePreviewsData);
      if (demoMode?.url) setUrls([demoMode.url]);
      if (demoMode?.name) setName(demoMode.name);
      if (demoMode?.videoLength) setVideoLength(demoMode.videoLength);
      if (demoMode?.template) {
        setTemplate(demoMode.template);
        templateManuallySelectedRef.current = true;
      }
      if (demoMode?.videoStyle) {
        setVideoStyle(demoMode.videoStyle);
        styleManuallySet.current = true;
      }
      if (demoMode?.voiceGender) setVoiceGender(demoMode.voiceGender);
      if (demoMode?.voiceAccent) setVoiceAccent(demoMode.voiceAccent);
      if (demoMode?.customVoiceId) setCustomVoiceId(demoMode.customVoiceId);
      setBuiltinTemplatesLoading(false);
      setSessionBuiltinInitDone(true);
      setMyVoicesLoading(false);
      setCustomTemplatesLoading(false);
      setHasCraftedTemplatesEligible(false);
      setTemplateAvailabilityLoading(false);
      sessionRandomAppliedRef.current = true;
      return () => {
        mounted = false;
      };
    }
    primeBlogUrlFormStep2Prefetch();
    fetchBlogUrlFormBuiltinTemplatesDeduped()
      .then((data) => {
        if (mounted) {
          setTemplates(data);
          setBuiltinTemplatesLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setBuiltinTemplatesLoading(false);
      });
    fetchBlogUrlFormAvailabilityDeduped()
      .then(({ hasCraftedTemplatesEligible: eligible, customTemplates }) => {
        if (!mounted) return;
        setHasCraftedTemplatesEligible(eligible);
        setCustomTemplates(customTemplates);
        setCustomTemplatesLoading(false);
        setTemplateAvailabilityLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setHasCraftedTemplatesEligible(true);
        setCustomTemplates([]);
        setCustomTemplatesLoading(false);
        setTemplateAvailabilityLoading(false);
      });
    getVoicePreviews()
      .then((r) => {
        if (mounted) setVoicePreviews(r.data);
      })
      .catch(() => {});
    getBgmTracks()
      .then((r) => {
        if (mounted) setBgmTracks(r.data);
      })
      .catch(() => {});
    setMyVoicesLoading(true);
    getMyVoices()
      .then((r) => {
        if (!mounted) return;
        const list = r.data ?? [];
        setMyVoicesList(list);
        if (list.length > 0) {
          const first = list[0];
          const firstId = first.voice_id;
          // Single/link flow: default-select the first voice in Step 3 (read latest prefs via refs)
          if (!customVoiceIdRef.current && voiceGenderRef.current !== "none") {
            setCustomVoiceId(firstId);
            const g = normalizeVoiceGender(first.gender);
            const a = normalizeVoiceAccent(first.accent);
            if (g) setVoiceGender(g);
            if (a) setVoiceAccent(a);
          }
        }
      })
      .catch(() => {
        if (mounted) setMyVoicesList([]);
      })
      .finally(() => {
        if (mounted) setMyVoicesLoading(false);
      });
    getPrebuiltVoices()
      .then((r: { data?: { voices?: ElevenLabsVoice[] } }) => {
        if (!mounted) return;
        const voices = r.data?.voices ?? [];
        const paid = voices.filter((v) => v.plan === "paid");
        setPremiumTeaserVoices(paid.slice(0, 2));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Keep bulk rows in sync: whenever we have saved voices and bulk URLs,
  // ensure each populated row gets a default custom voice if it doesn't have one.
  useEffect(() => {
    if (!myVoicesList.length) return;
    const firstId = myVoicesList[0].voice_id;
    setBulkCustomVoiceId((prev) => {
      const next = [...prev];
      let changed = false;
      bulkRows.forEach((row, idx) => {
        if (row.url.trim() && !next[idx]) {
          next[idx] = firstId;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [myVoicesList, bulkRows]);

  // Sync colors to the selected template when templates load or selection changes.
  // Runs before session random pick on the same commit so random pick can override starter "default" colors.
  useEffect(() => {
    if (allTemplates.length === 0) return;
    // Check custom templates first
    if (template.startsWith("custom_")) {
      const customId = parseInt(template.replace("custom_", ""));
      const ct = customTemplates.find((t) => t.id === customId);
      if (ct) {
        setAccentColor(ct.preview_colors.accent);
        setBgColor(ct.preview_colors.bg);
        setTextColor(ct.preview_colors.text);
      }
      return;
    }
    const meta = allTemplates.find((t) => t.id === template);
    if (meta?.preview_colors) {
      setAccentColor(meta.preview_colors.accent);
      setBgColor(meta.preview_colors.bg);
      setTextColor(meta.preview_colors.text);
    }
  }, [allTemplates, customTemplates, template]);

  // Built-ins loaded but empty (error / no data): unblock step 2 without random pick.
  useEffect(() => {
    if (builtinTemplatesLoading) return;
    if (templates.length === 0) {
      setSessionBuiltinInitDone(true);
    }
  }, [builtinTemplatesLoading, templates.length]);

  // Once per form mount: pick a random built-in template for this session (single + all bulk rows).
  const sessionRandomAppliedRef = useRef(false);
  useEffect(() => {
    if (templates.length === 0) return;
    if (sessionRandomAppliedRef.current) {
      setSessionBuiltinInitDone(true);
      return;
    }
    const idx = Math.floor(Math.random() * templates.length);
    const picked = templates[idx];
    if (!picked?.id) {
      setSessionBuiltinInitDone(true);
      return;
    }
    sessionRandomAppliedRef.current = true;
    setPickerDefaultTemplateId(picked.id);
    if (templateManuallySelectedRef.current) {
      setSessionBuiltinInitDone(true);
      return;
    }
    // Genre filter stays at "All genres" by default; users narrow the list explicitly.
    if (picked.preview_colors) {
      setAccentColor(picked.preview_colors.accent);
      setBgColor(picked.preview_colors.bg);
      setTextColor(picked.preview_colors.text);
    }
    setTemplate((prev) =>
      prev === "default" ? picked.id : prev
    );
    setBulkTemplates((prev) =>
      prev.length > 0
        ? prev.map((tpl) => (tpl === "default" ? picked.id : tpl))
        : [picked.id]
    );
    setSessionBuiltinInitDone(true);
  }, [templates]);

  // Preload voice preview audio on mount so it's ready by step 3
  useEffect(() => {
    if (isDemo) return;
    const base = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";
    for (const key of VOICE_PREVIEW_KEYS) {
      if (preloadedAudioRef.current[key]) continue;
      const url = `${base}/voices/preview-audio?key=${encodeURIComponent(key)}`;
      const a = new Audio();
      a.preload = "auto";
      a.src = url;
      preloadedAudioRef.current[key] = a;
    }
  }, [isDemo]);

  // Cleanup audio only on unmount; do not clear preloadedAudioRef so step 3 can use it
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      for (const key of VOICE_PREVIEW_KEYS) {
        const a = preloadedAudioRef.current[key];
        if (a) {
          a.pause();
          a.removeAttribute("src");
          a.load();
        }
      }
      preloadedAudioRef.current = {};
    };
  }, []);

  // ─── Audio preview ───────────────────────────────────────────
  const playVoice = (key: string, url: string | null) => {
    if (!url) return;
    if (playingKey === key) {
      audioRef.current?.pause();
      setPlayingKey(null);
      return;
    }
    audioRef.current?.pause();
    // Always use preloaded instance when present so we don't refetch at step 3
    let audio = preloadedAudioRef.current[key];
    if (!audio) {
      audio = new Audio(url);
      audio.preload = "auto";
      preloadedAudioRef.current[key] = audio;
    }
    audio.currentTime = 0;
    audio.onended = () => setPlayingKey(null);
    audio.onerror = () => setPlayingKey(null);
    audio.play().catch(() => setPlayingKey(null));
    audioRef.current = audio;
    setPlayingKey(key);
  };

  const playMyVoice = (saved: { voice_id: string; preview_url?: string | null }) => {
    const key = `my_${saved.voice_id}`;
    if (playingKey === key) {
      audioRef.current?.pause();
      setPlayingKey(null);
      return;
    }
    const src = saved.preview_url;
    if (!src) return;
    audioRef.current?.pause();
    const audio = new Audio(src);
    audio.onended = () => setPlayingKey(null);
    audio.onerror = () => setPlayingKey(null);
    audio.play().catch(() => setPlayingKey(null));
    audioRef.current = audio;
    setPlayingKey(key);
  };

  const playPremiumTeaser = (voice: ElevenLabsVoice) => {
    const key = `premium_${voice.voice_id}`;
    if (playingKey === key) {
      audioRef.current?.pause();
      setPlayingKey(null);
      return;
    }
    if (!voice.preview_url) return;
    audioRef.current?.pause();
    const audio = new Audio(voice.preview_url);
    audio.onended = () => setPlayingKey(null);
    audio.onerror = () => setPlayingKey(null);
    audio.play().catch(() => setPlayingKey(null));
    audioRef.current = audio;
    setPlayingKey(key);
  };

  // ─── File helpers ────────────────────────────────────────────
  const isAllowedFile = (file: File) => {
    // 1) Extension check first — file.type can be empty / unreliable for .vtt
    //    on many browsers (Chrome reports "" or "application/octet-stream").
    const lowerName = (file.name || "").toLowerCase();
    const dotIdx = lowerName.lastIndexOf(".");
    if (dotIdx !== -1) {
      const ext = lowerName.slice(dotIdx); // includes the leading "."
      if (ALLOWED_EXTENSIONS.includes(ext)) return true;
    }
    // 2) Fallback to MIME type.
    return ALLOWED_TYPES.includes(file.type);
  };

  /** Add one or more files using functional state so paste / drop handlers never see stale `docFiles`. */
  const addDocFileArray = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return;
    setDocError(null);
    for (const f of incoming) {
      if (!isAllowedFile(f)) {
        setDocError(`"${f.name}" is not supported. Use PDF, DOCX, PPTX, Markdown, TXT, or VTT.`);
        return;
      }
      if (f.size > MAX_UPLOAD_SIZE) {
        setDocError(`"${f.name}" exceeds the 5 MB size limit.`);
        return;
      }
    }
    setDocFiles((prev) => {
      if (prev.length + incoming.length > MAX_UPLOAD_FILES) {
        setTimeout(() => setDocError(`Maximum ${MAX_UPLOAD_FILES} files allowed.`), 0);
        return prev;
      }
      return [...prev, ...incoming];
    });
  }, []);

  const addDocFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    addDocFileArray(Array.from(newFiles));
  }, [addDocFileArray]);

  /** Plain text from clipboard → single .txt document (same limits as uploads). */
  const addPastedTextAsTxtFile = useCallback((text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const file = new File([blob], "pasted-content.txt", { type: "text/plain" });
    addDocFileArray([file]);
  }, [addDocFileArray]);

  // Step 1 + Upload: Ctrl+V pastes plain text as a .txt doc, or pasted files as uploads.
  // Skips when focus is in an input/textarea so project name & other fields work normally.
  useEffect(() => {
    if (step !== 1 || mode !== "upload") return;

    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("input, textarea, select, [contenteditable='true']")) return;

      const cd = e.clipboardData;
      if (!cd) return;

      if (cd.files && cd.files.length > 0) {
        e.preventDefault();
        addDocFiles(cd.files);
        return;
      }

      const text = cd.getData("text/plain");
      const trimmed = text?.trim() ?? "";
      if (!trimmed) return;

      e.preventDefault();
      addPastedTextAsTxtFile(trimmed);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [step, mode, addDocFiles, addPastedTextAsTxtFile]);

  const removeDocFile = (index: number) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== index));
    setDocError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── File-extension URL detection ────────────────────────────
  const urlFileExt = mode === "url" ? getFileExtension(urls[0] ?? "") : null;
  const bulkFileExtRows = mode === "bulk"
    ? bulkRows.map((r) => getFileExtension(r.url))
    : [];
  const hasBulkFileExt = bulkFileExtRows.some(Boolean);

  // ─── Non-scrapable link detection ────────────────────────────
  const urlScrape = mode === "url" ? classifyUrlScrapability(urls[0] ?? "") : "ok";
  const bulkScrapeRows = mode === "bulk"
    ? bulkRows.map((r) => classifyUrlScrapability(r.url))
    : [];
  const hasBulkBlocked = bulkScrapeRows.some((s) => s === "blocked");

  // ─── Navigation ──────────────────────────────────────────────
  // Step order: 1 = Project (URL/Upload/Bulk), 2 = Template, 3 = Voice
  const canGoNext1 =
    mode === "url"
      ? !!urls[0]?.trim() && !hasSpacesInMiddle(urls[0]) && containsDot(urls[0]) && !urlFileExt && urlScrape !== "blocked"
      : mode === "upload"
        ? docFiles.length > 0
        : bulkRows.some((r) => r.url.trim()) &&
          bulkRows.every(
            (r) =>
              !r.url.trim() || (!hasSpacesInMiddle(r.url) && containsDot(r.url))
          ) && !hasBulkFileExt && !hasBulkBlocked;

  const goNext = () => {
    if (step === 1 && canGoNext1) {
      if (mode === "bulk") {
        const n = bulkRows.length;
        setBulkNames((prev) => resizeTo(prev, n, ""));
        setBulkTemplates((prev) => resizeTo(prev, n, pickerDefaultTemplateId));
        setBulkVoiceGender((prev) => resizeTo(prev, n, "female"));
        setBulkVoiceAccent((prev) => resizeTo(prev, n, "american"));
        setBulkCustomVoiceId((prev) => resizeTo(prev, n, ""));
        setBulkContentLanguage((prev) => resizeTo(prev, n, "auto"));
        setBulkVideoLength((prev) => resizeTo(prev, n, "short"));
        setBulkAspectRatio((prev) => resizeTo(prev, n, "landscape"));
        setBulkVideoStyles((prev) =>
          resizeTo(
            prev,
            n,
            videoStyleForBulkTemplateId(
              pickerDefaultTemplateIdRef.current,
              templatesRef.current,
              customTemplatesRef.current
            )
          )
        );
        setBulkAccentColors((prev) => resizeTo(prev, n, ""));
        setBulkBgColors((prev) => resizeTo(prev, n, ""));
        setBulkTextColors((prev) => resizeTo(prev, n, ""));
        setBulkLogoFile((prev) => resizeTo(prev, n, null));
        setBulkLogoPosition((prev) => resizeTo(prev, n, "bottom_right"));
        setBulkLogoOpacity((prev) => resizeTo(prev, n, 0.9));
        setBulkActiveIndex(0);
      }
      setStep(2);
    } else if (step === 2) {
      step3EnteredAtRef.current = Date.now();
      setBulkActiveIndex(0);
      setStep(3);
    }
  };

  function resizeTo<T>(arr: T[], len: number, fill: T): T[] {
    if (arr.length >= len) return arr.slice(0, len);
    return [...arr, ...Array(len - arr.length).fill(fill)];
  }

  const addBulkRow = () => {
    if (bulkRows.length >= MAX_BULK_LINKS) return;
    setBulkRows((prev) => [...prev, { url: "" }]);
    setBulkNames((prev) => [...prev, ""]);
    setBulkTemplates((prev) => [...prev, pickerDefaultTemplateId]);
    setBulkVoiceGender((prev) => [...prev, "female"]);
    setBulkVoiceAccent((prev) => [...prev, "american"]);
    setBulkCustomVoiceId((prev) => [...prev, ""]);
    setBulkContentLanguage((prev) => [...prev, "auto"]);
    setBulkVideoLength((prev) => [...prev, "short"]);
    setBulkAspectRatio((prev) => [...prev, "landscape"]);
    setBulkVideoStyles((prev) => [
      ...prev,
      videoStyleForBulkTemplateId(
        pickerDefaultTemplateIdRef.current,
        templatesRef.current,
        customTemplatesRef.current
      ),
    ]);
    setBulkAccentColors((prev) => [...prev, ""]);
    setBulkBgColors((prev) => [...prev, ""]);
    setBulkTextColors((prev) => [...prev, ""]);
    setBulkLogoFile((prev) => [...prev, null]);
    setBulkLogoPosition((prev) => [...prev, "bottom_right"]);
    setBulkLogoOpacity((prev) => [...prev, 0.9]);
    bulkStyleManuallySet.current = [...bulkStyleManuallySet.current, false];
  };

  const removeBulkRow = (index: number) => {
    if (bulkRows.length <= 1) return;
    bulkStyleManuallySet.current = bulkStyleManuallySet.current.filter((_, i) => i !== index);
    setBulkRows((prev) => prev.filter((_, i) => i !== index));
    setBulkNames((prev) => prev.filter((_, i) => i !== index));
    setBulkTemplates((prev) => prev.filter((_, i) => i !== index));
    setBulkVoiceGender((prev) => prev.filter((_, i) => i !== index));
    setBulkVoiceAccent((prev) => prev.filter((_, i) => i !== index));
    setBulkCustomVoiceId((prev) => prev.filter((_, i) => i !== index));
    setBulkContentLanguage((prev) => prev.filter((_, i) => i !== index));
    setBulkVideoLength((prev) => prev.filter((_, i) => i !== index));
    setBulkAspectRatio((prev) => prev.filter((_, i) => i !== index));
    setBulkVideoStyles((prev) => prev.filter((_, i) => i !== index));
    setBulkAccentColors((prev) => prev.filter((_, i) => i !== index));
    setBulkBgColors((prev) => prev.filter((_, i) => i !== index));
    setBulkTextColors((prev) => prev.filter((_, i) => i !== index));
    setBulkLogoFile((prev) => prev.filter((_, i) => i !== index));
    setBulkLogoPosition((prev) => prev.filter((_, i) => i !== index));
    setBulkLogoOpacity((prev) => prev.filter((_, i) => i !== index));
    setBulkActiveIndex((prev) => {
      if (prev >= bulkRows.length - 1) return Math.max(0, prev - 1);
      return prev;
    });
  };

 const goBack = () => {
  if (step === 2) {
    setStep(1);
    setBulkActiveIndex(0);
  } 
  else if (step === 3) {
    setStep(2);
    setBulkActiveIndex(0);
  }
};

  // ─── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) return;
    if (step !== 3) return;
    const enteredAt = step3EnteredAtRef.current;
    if (enteredAt != null && Date.now() - enteredAt < 400) return;
    step3EnteredAtRef.current = null;
    audioRef.current?.pause();
    bgmAudioRef.current?.pause();

    if (mode === "bulk" && onSubmitBulk) {
      const valid = bulkRows
        .map((r, i) => ({ url: r.url, name: bulkNames[i] ?? "", i }))
        .filter((r) => r.url.trim());
      if (valid.length === 0) return;
      if (!isPro && valid.some((v) => (bulkTemplates[v.i] ?? "").startsWith("custom_"))) {
        setShowCustomTemplateUpgrade(true);
        return;
      }
      // Detect duplicate URLs and auto-suffix names
      const urlCounts: Record<string, number> = {};
      const urlSeenSoFar: Record<string, number> = {};
      for (const { url } of valid) {
        const normalized = url.trim();
        urlCounts[normalized] = (urlCounts[normalized] ?? 0) + 1;
      }

      const firstSavedVoiceId = myVoicesList[0]?.voice_id;
      const items: BulkProjectItem[] = valid.map(({ url, name: n, i }) => {
        const normalized = url.trim();
        urlSeenSoFar[normalized] = (urlSeenSoFar[normalized] ?? 0) + 1;
        const isDuplicate = urlCounts[normalized] > 1;

        let resolvedName = n.trim() || undefined;
        if (!resolvedName && isDuplicate) {
          const occurrence = urlSeenSoFar[normalized];
          const derived = deriveNameFromUrl(normalized);
          resolvedName = occurrence === 1 ? derived : `${derived} (${occurrence})`;
        }

        const rowSelectedVoiceId = bulkCustomVoiceId[i]?.trim();
        const selectedVoice = myVoicesList.find((v) => v.voice_id === rowSelectedVoiceId);
        const rowGender = bulkVoiceGender[i] ?? "female";
        const inferredGender =
          rowGender === "none"
            ? "none"
            : (normalizeVoiceGender(selectedVoice?.gender) ?? rowGender);
        const inferredAccent = normalizeVoiceAccent(selectedVoice?.accent) ?? bulkVoiceAccent[i];
        const effectiveCustomVoiceId = rowSelectedVoiceId || firstSavedVoiceId;

        return {
        blog_url: normalized,
        name: resolvedName,
        template: bulkTemplates[i] !== "default" ? bulkTemplates[i] : undefined,
        video_style:
          bulkVideoStyles[i] ??
          videoStyleForBulkTemplateId(
            bulkTemplates[i] ?? "default",
            templatesRef.current,
            customTemplatesRef.current
          ),
        video_length: bulkVideoLength[i] ?? "short",
        voice_gender: inferredGender,
        voice_accent: inferredAccent,
        voice_emotion: (() => {
          const s = bulkVoiceStability[i] ?? VOICE_STABILITY_DEFAULT;
          const sp = bulkVoiceSpeed[i] ?? VOICE_SPEED_DEFAULT;
          const em = bulkVoiceEmotion[i] ?? "";
          const sty = bulkVoiceStyle[i] ?? VOICE_STYLE_DEFAULT;
          // Always send for Pro+voiced so the enabled/disabled flag + last values are remembered;
          // the backend only applies tuning to the project when the flag is on.
          return isPro && inferredGender !== "none" ? serializeVoiceTuning(s, sp, em, sty, expressiveEnabled) : undefined;
        })(),
        accent_color:
          bulkAccentColors[i] && bulkAccentColors[i].trim()
            ? bulkAccentColors[i]
            : accentColor,
        bg_color:
          bulkBgColors[i] && bulkBgColors[i].trim()
            ? bulkBgColors[i]
            : bgColor,
        text_color:
          bulkTextColors[i] && bulkTextColors[i].trim()
            ? bulkTextColors[i]
            : textColor,
        logo_position: bulkLogoPosition[i] ?? "bottom_right",
        logo_opacity: bulkLogoOpacity[i] ?? 0.9,
        custom_voice_id:
          inferredGender === "none"
            ? undefined
            : (effectiveCustomVoiceId || undefined),
        aspect_ratio: bulkAspectRatio[i] ?? "landscape",
        content_language:
          (bulkContentLanguage[i] ?? "auto") === "auto"
            ? null
            : (bulkContentLanguage[i] ?? "auto"),
      };
      });
      const logoIndices: number[] = [];
      const logoFiles: File[] = [];
      valid.forEach((v, j) => {
        const f = bulkLogoFile[v.i];
        if (f) {
          logoIndices.push(j);
          logoFiles.push(f);
        }
      });
      await onSubmitBulk(items, logoIndices.length > 0 ? { logoIndices, logoFiles } : null);
      setBulkRows([{ url: "" }]);
      setBulkNames([""]);
      setBulkTemplates([pickerDefaultTemplateId]);
      setBulkVoiceGender(["female"]);
      setBulkVoiceAccent(["american"]);
      setBulkVoiceStability([VOICE_STABILITY_DEFAULT]);
      setBulkVoiceSpeed([VOICE_SPEED_DEFAULT]);
      setBulkVoiceEmotion([""]);
      setBulkVoiceStyle([VOICE_STYLE_DEFAULT]);
      setBulkCustomVoiceId([]);
      setBulkContentLanguage(["auto"]);
      setBulkVideoLength(["short"]);
      setBulkAspectRatio(["landscape"]);
      setBulkVideoStyles([DEFAULT_VIDEO_STYLE]);
      setBulkAccentColors([""]);
      setBulkBgColors([""]);
      setBulkTextColors([""]);
      setBulkLogoFile([null]);
      setBulkLogoPosition(["bottom_right"]);
      setBulkLogoOpacity([0.9]);
      setBulkActiveIndex(0);
      setBulkApplyLengthAll(true);
      setBulkLengthMasterIndex(0);
      setBulkApplyTemplateAll(true);
      setBulkTemplateMasterIndex(0);
      setBulkApplyVoiceAll(true);
      setBulkVoiceMasterIndex(0);
      setVideoLength("short");
      setContentLanguage("auto");
      return;
    }

    if (mode === "upload") {
      if (docFiles.length === 0) return;
      if (template.startsWith("custom_") && !isPro) {
        setShowCustomTemplateUpgrade(true);
        return;
      }
      const selectedVoice = myVoicesList.find((v) => v.voice_id === customVoiceId.trim());
      const inferredGender =
        voiceGender === "none"
          ? "none"
          : (normalizeVoiceGender(selectedVoice?.gender) ?? voiceGender);
      const inferredAccent = normalizeVoiceAccent(selectedVoice?.accent) ?? voiceAccent;
      const effectiveCustomVoiceId = customVoiceId.trim() || myVoicesList[0]?.voice_id || "";
      await onSubmit(
        "",
        name.trim() || undefined,
        inferredGender,
        inferredAccent,
        accentColor,
        bgColor,
        textColor,
        undefined,
        logoFile || undefined,
        logoPosition,
        logoOpacity,
        inferredGender === "none" ? undefined : (effectiveCustomVoiceId || undefined),
        aspectRatio,
        docFiles,
        template !== "default" ? template : undefined,
        videoStyle,
        videoLength,
        contentLanguage === "auto" ? null : contentLanguage,
        isPro && inferredGender !== "none"
          ? serializeVoiceTuning(voiceStability, voiceSpeed, voiceEmotion, voiceStyle, expressiveEnabled)
          : undefined,
        selectedBgmTrackId,
        selectedBgmVolume
      );
      setDocFiles([]);
      setName("");
    } else {
      const validUrls = urls.filter((u) => u.trim());
      if (validUrls.length === 0) return;
      if (template.startsWith("custom_") && !isPro) {
        setShowCustomTemplateUpgrade(true);
        return;
      }
      const selectedVoice = myVoicesList.find((v) => v.voice_id === customVoiceId.trim());
      const inferredGender =
        voiceGender === "none"
          ? "none"
          : (normalizeVoiceGender(selectedVoice?.gender) ?? voiceGender);
      const inferredAccent = normalizeVoiceAccent(selectedVoice?.accent) ?? voiceAccent;
      const effectiveCustomVoiceId = customVoiceId.trim() || myVoicesList[0]?.voice_id || "";
      for (const url of validUrls) {
        await onSubmit(
          url.trim(),
          name.trim() || undefined,
          inferredGender,
          inferredAccent,
          accentColor,
          bgColor,
          textColor,
          undefined,
          logoFile || undefined,
          logoPosition,
          logoOpacity,
          inferredGender === "none" ? undefined : (effectiveCustomVoiceId || undefined),
          aspectRatio,
          undefined,
          template !== "default" ? template : undefined,
          videoStyle,
          videoLength,
          contentLanguage === "auto" ? null : contentLanguage,
          isPro && inferredGender !== "none"
          ? serializeVoiceTuning(voiceStability, voiceSpeed, voiceEmotion, voiceStyle, expressiveEnabled)
          : undefined,
          selectedBgmTrackId,
          selectedBgmVolume
        );
      }
      setUrls([""]);
      setName("");
    }
  };

  // ─── Template apply colors ───────────────────────────────────
  const applyTemplate = (id: string) => {
    templateManuallySelectedRef.current = true;
    if (id.startsWith("custom_") && !isPro) {
      setShowCustomTemplateUpgrade(true);
      return;
    }
    setTemplate(id);
    // Custom template
    if (id.startsWith("custom_")) {
      const customId = parseInt(id.replace("custom_", ""));
      const ct = customTemplates.find((t) => t.id === customId);
      if (ct) {
        setAccentColor(ct.preview_colors.accent);
        setBgColor(ct.preview_colors.bg);
        setTextColor(ct.preview_colors.text);
      }
      return;
    }
    const meta = allTemplates.find((t) => t.id === id);
    if (meta?.preview_colors) {
      setAccentColor(meta.preview_colors.accent);
      setBgColor(meta.preview_colors.bg);
      setTextColor(meta.preview_colors.text);
    }
  };

  const openStep2CustomTemplateCreator = (style: VideoStyleId, _bulkRow: number | null) => {
    if (!isPro) {
      setShowCustomTemplateUpgrade(true);
      return;
    }
    onDismissFlow?.();
    const params = new URLSearchParams();
    params.set("tab", "templates");
    params.set("openCustomCreator", "1");
    params.set("videoStyle", style);
    navigate(`/dashboard?${params.toString()}`);
  };

  const openStep3CustomVoiceCreator = () => {
    if (!isPro) {
      setShowCustomTemplateUpgrade(true);
      return;
    }
    onDismissFlow?.();
    const params = new URLSearchParams();
    params.set("tab", "voices");
    params.set("openCustomVoiceCreator", "1");
    navigate(`/dashboard?${params.toString()}`);
  };

  // ─── Step 1: Project (URL or Upload) ─────────────────────────
  const bulkStep1ActiveIndex = Math.min(bulkActiveIndex, Math.max(0, bulkRows.length - 1));
  const bulkStep1MasterIndex = Math.min(bulkLengthMasterIndex, Math.max(0, bulkRows.length - 1));
  const bulkStep1RowVideoLength = bulkVideoLength[bulkStep1ActiveIndex] ?? "short";
  const applyStep1LengthToAll = () => {
    setBulkVideoLength((prev) => {
      const next = resizeTo(prev, bulkRows.length, "short");
      const value = next[bulkStep1ActiveIndex] ?? "short";
      return next.map(() => value);
    });
  };

  const step1 = (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 flex flex-col space-y-5 min-h-0">
      {/* Mode tabs — selected tab purple */}
      <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit">
        {(["url", "upload", ...(onSubmitBulk ? (["bulk"] as const) : [])] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === m
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {m === "url" ? "Link" : m === "upload" ? "Upload" : "Multi Link"}
          </button>
        ))}
      </div>

      {/* Bulk: multiple links (url + name per row) */}
      {mode === "bulk" && (<>
        <BulkLinksSection
          rows={bulkRows}
          maxBulkLinks={MAX_BULK_LINKS}
          aspectRatios={bulkAspectRatio}
          onChangeUrl={(index, value) =>
            setBulkRows((prev) => prev.map((r, i) => (i === index ? { ...r, url: value } : r)))
          }
          onChangeAspectRatio={(index, value) =>
            setBulkAspectRatio((prev) => {
              const next = [...prev];
              next[index] = value;
              return next;
            })
          }
          onAddRow={addBulkRow}
          onRemoveRow={removeBulkRow}
        />
        {(() => {
          const seen = new Set<string>();
          const hasDupes = bulkRows.some((r) => {
            const t = r.url.trim();
            if (!t) return false;
            if (seen.has(t)) return true;
            seen.add(t);
            return false;
          });
          return hasDupes ? (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-2">
              Duplicate URLs detected — suffixes will be added to project names to differentiate them.
            </p>
          ) : null;
        })()}
        {hasBulkFileExt && (
          <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-purple-50 border border-purple-200/60">
            <svg className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
            </svg>
            <p className="text-[11px] text-purple-700 leading-relaxed">
              {bulkFileExtRows.map((ext, i) => ext ? (
                <span key={i}>Row {i + 1} has a <span className="font-semibold">{ext.toUpperCase()}</span> file link. </span>
              ) : null)}
              Please use the <span className="font-semibold">Upload</span> tab to upload files directly instead of linking to them.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          <div className="flex flex-wrap gap-1 p-1 bg-gray-100/60 rounded-xl">
            {bulkRows.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setBulkActiveIndex(i)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  i === bulkStep1ActiveIndex
                    ? "bg-white text-purple-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                Video #{i + 1}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center justify-start">
          <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer select-none">
            <input
                type="checkbox"
                checked={bulkApplyLengthAll}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setBulkApplyLengthAll(checked);
                  if (checked) {
                    setBulkLengthMasterIndex(bulkStep1ActiveIndex);
                    applyStep1LengthToAll();
                  }
                }}
                className="h-3.5 w-3.5 rounded border-gray-300 accent-purple-600 focus:ring-purple-500"
              />
            Apply duration to all
          </label>
        </div>
        <div className="mt-1 space-y-1.5">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Estimated duration
          </label>
          {renderVideoLengthDropdown(bulkStep1RowVideoLength, (value) => {
            if (bulkApplyLengthAll && bulkStep1ActiveIndex !== bulkStep1MasterIndex) {
              setBulkApplyLengthAll(false);
              setBulkVideoLength((prev) => {
                const next = resizeTo(prev, bulkRows.length, "short");
                next[bulkStep1ActiveIndex] = value;
                return next;
              });
              return;
            }
            if (bulkApplyLengthAll && bulkStep1ActiveIndex === bulkStep1MasterIndex) {
              setBulkVideoLength((prev) => resizeTo(prev, bulkRows.length, "short").map(() => value));
              return;
            }
            setBulkVideoLength((prev) => {
              const next = resizeTo(prev, bulkRows.length, "short");
              next[bulkStep1ActiveIndex] = value;
              return next;
            });
          })}
          <p className="text-[10px] text-gray-400 pb-10 leading-relaxed">
            Actual length may vary depending on content size and video style. If the scraped or uploaded content is
            very short, video might get shorten automatically.
          </p>
        </div>
      </>)}

      {/* URL input */}
      {mode === "url" && (
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Blog URL
          </label>
          {urls.map((url, i) => (
            <input
              key={i}
              type="url"
              required={i === 0}
              value={url}
              onChange={(e) => {
                const next = e.target.value;
                setUrls((prev) => prev.map((u, idx) => (idx === i ? next : u)));
                if (i === 0) {
                  setUrlError(null);
                }
              }}
              onBlur={(e) => {
                if (i !== 0) return;
                const value = e.target.value;
                const trimmed = value.trim();
                if (!trimmed) {
                  setUrlError(null);
                  return;
                }
                if (hasSpacesInMiddle(value)) {
                  setUrlError("Enter a valid link (e.g. example.com, https://example.com).");
                } else if (!containsDot(value)) {
                  setUrlError("Enter a valid link (e.g. example.com, https://example.com).");
                } else {
                  setUrlError(null);
                }
              }}
              placeholder={
                i === 0
                  ? "https://yourblog.com/your-article..."
                  : `URL ${i + 1} (optional)`
              }
              className={`w-full px-4 py-2.5 bg-white/80 border rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all mb-2 ${
                i === 0 && urls[0]?.trim() && (urlError || urlScrape === "blocked")
                  ? "border-red-400"
                  : "border-gray-200/60"
              }`}
              autoFocus={i === 0}
            />
          ))}
          {urlError && urls[0]?.trim() && (
            <p className="text-xs text-red-500 mt-1">
              {urlError}
            </p>
          )}
          {urlFileExt && urls[0]?.trim() && (
            <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-purple-50 border border-purple-200/60">
              <svg className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
              </svg>
              <p className="text-[11px] text-purple-700 leading-relaxed">
                <span className="font-semibold">{urlFileExt.toUpperCase()} files</span> can't be processed as a URL. Please use the{" "}
                <span className="font-semibold">Upload</span> tab above to upload this file directly.
              </p>
            </div>
          )}
          {urlScrape === "blocked" && urls[0]?.trim() && (
            <p className="text-xs text-red-500 mt-1">
              This site can't be scraped, please use a different link.
            </p>
          )}
          {urlScrape === "warn" && urls[0]?.trim() && (
            <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200/60">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-[11px] text-amber-600 leading-relaxed">
                This link might not be scrapable — try a different one if you have it.
              </p>
            </div>
          )}
          <p className="mt-0.5 text-[11px] text-gray-400 leading-relaxed">
            Use a paywall-free link for best results.{" "}
            <button
              type="button"
              onClick={() => {
                const demoUrls = [
                  "https://blog2video.app/"
                  
                ];
                const picked = demoUrls[Math.floor(Math.random() * demoUrls.length)];
                setUrls((prev) => prev.map((u, idx) => (idx === 0 ? picked : u)));
                setUrlError(null);
              }}
              className="text-purple-500 hover:text-purple-700 underline underline-offset-2 transition-colors"
            >
              Try a demo link
            </button>
          </p>
        </div>
      )}

      {/* Document upload */}
      {mode === "upload" && (
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Documents{" "}
            <span className="text-gray-300 font-normal">(max 5 files, 5 MB each)</span>
          </label>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload documents or paste text"
            className="relative border-2 border-dashed border-gray-200/80 rounded-xl p-6 text-center hover:border-purple-400/60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            onClick={() => docInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                docInputRef.current?.click();
              }
            }}
            onPaste={(e) => {
              e.stopPropagation();
              const cd = e.clipboardData;
              if (cd.files && cd.files.length > 0) {
                e.preventDefault();
                addDocFiles(cd.files);
                return;
              }
              const text = cd.getData("text/plain");
              const trimmed = text?.trim() ?? "";
              if (trimmed) {
                e.preventDefault();
                addPastedTextAsTxtFile(trimmed);
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("border-purple-400/60", "bg-purple-50/30");
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-purple-400/60", "bg-purple-50/30");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-purple-400/60", "bg-purple-50/30");
              addDocFiles(e.dataTransfer.files);
            }}
          >
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-500">
              Drop files here or <span className="text-purple-600 font-medium">paste text (Ctrl+V)</span>
            </p>
            <p className="text-[10px] text-gray-300 mt-1">PDF, Word, PowerPoint, Markdown, Text, VTT — or paste plain text as a .txt file</p>
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,.md,.markdown,.txt,.vtt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/x-markdown,text/vtt"
              multiple
              className="hidden"
              onChange={(e) => { addDocFiles(e.target.files); e.target.value = ""; }}
            />
          </div>
          {docError && <p className="mt-2 text-[11px] text-red-500">{docError}</p>}
          {docFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {docFiles.map((file, i) => (
                <div key={`${file.name}-${i}`} className="flex items-center gap-3 px-4 py-3 bg-gray-50/80 rounded-xl border border-gray-200/60">
                  <svg
                    className={`w-6 h-6 flex-shrink-0 ${file.name.endsWith(".pdf") ? "text-red-400" : file.name.endsWith(".docx") ? "text-blue-400" : "text-orange-400"}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <span className="flex-1 text-sm text-gray-700 truncate font-medium">{file.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeDocFile(i); }}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/60 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Project name (single-link / upload only; bulk has per-row name) */}
      {mode !== "bulk" && (
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Project Name <span className="text-gray-300 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === "url" ? "Auto-generated from URL" : "Auto-generated from file name"}
            className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
          />
        </div>
      )}

      {/* Format, duration + Logo (single-link / upload only; bulk has per-row in step 3) */}
      {mode !== "bulk" && (
        <>
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Video Format
            </label>
            <div className="flex gap-2">
              {([
                { value: "landscape", label: "Landscape", sub: "YouTube" },
                { value: "portrait", label: "Portrait", sub: "TikTok / Reels" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAspectRatio(opt.value)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-0.5 ${
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
            <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Estimated duration
            </label>
            {renderVideoLengthDropdown(videoLength, setVideoLength)}
            <p className="mt-1 text-[10px] text-gray-400 leading-relaxed">
              Actual length may vary depending on content size and video style. If the scraped or uploaded content is
              very short, we may shorten the video.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Logo <span className="text-gray-300 font-normal">(optional · max 2 MB)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="relative mb-4 inline-block">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/60 transition-all pr-8"
                >
                  {logoFile ? logoFile.name : "Choose file"}
                </button>
                {logoFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoFile(null);
                      if (logoInputRef.current) logoInputRef.current.value = "";
                    }}
                    className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 flex items-center justify-center transition-colors"
                    title="Remove logo"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f && f.size > 2 * 1024 * 1024) {
                    showError("Logo must be under 2 MB.");
                    e.target.value = "";
                    return;
                  }
                  setLogoFile(f);
                }}
              />
            </div>
            {logoFile && (
              <div className="mt-2">
                <label className="block text-[10px] text-gray-400 mb-1">Position</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {([
                    { value: "top_left", label: "Top Left" },
                    { value: "top_right", label: "Top Right" },
                    { value: "bottom_left", label: "Bottom Left" },
                    { value: "bottom_right", label: "Bottom Right" },
                  ] as const).map((pos) => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => setLogoPosition(pos.value)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                        logoPosition === pos.value
                          ? "bg-purple-600 text-white"
                          : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-200/60"
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 mb-3.5">
                  <label className="block text-[10px] text-gray-500 mb-1">
                    Opacity <span className="text-gray-500">{Math.round(logoOpacity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(logoOpacity * 100)}
                    onChange={(e) => setLogoOpacity(parseInt(e.target.value, 10) / 100)}
                    className="w-full h-1.5 bg-gray-300 rounded-full appearance-none cursor-pointer accent-purple-600"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
      </div>

      {/* Next — always visible; gray when disabled (invalid/empty URL) */}
      <button
        type="button"
        onClick={goNext}
        disabled={!canGoNext1}
        className={`w-full mb-3 py-3 mt-auto text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 flex-shrink-0 ${
          canGoNext1
            ? "bg-purple-600 hover:bg-purple-700 text-white"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        }`}
      >
        Go to step 2
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  // ─── Step 2: Genre/source filter + Template list ──────────────────────────
  // Genre dropdown has two source-bucket options at the top — "Custom Templates"
  // and "Designer Templates" — encoded with sentinel values. Below them are
  // the actual genres, compiled from built-in templates' meta.json.
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) (t.genres ?? []).forEach((g) => g && set.add(g));
    return Array.from(set).sort();
  }, [templates]);

  const {
    suggestedTemplates,
    customTemplatesForStyle,
    craftedTemplatesForStyle,
  } = templateBucketsForGenre(genre, templates, readyCustomTemplates, readyCraftedTemplates);

  const sortedSuggestedTemplates = [...suggestedTemplates].sort((a, b) => {
    const rank = (t: TemplateMeta) => (t.new_template ? 0 : t.popular_template ? 1 : 2);
    return rank(a) - rank(b);
  });

  const styleTemplateItems: Array<
    | { type: "builtin"; id: string; data: TemplateMeta }
    | { type: "custom"; id: string; data: CustomTemplateItem }
    | { type: "crafted"; id: string; data: CraftedTemplateItem }
  > = [
    ...sortedSuggestedTemplates.map((t) => ({ type: "builtin" as const, id: t.id, data: t })),
    ...customTemplatesForStyle.map((ct) => ({ type: "custom" as const, id: `custom_${ct.id}`, data: ct })),
    ...craftedTemplatesForStyle.map((ct) => ({ type: "crafted" as const, id: ct.id, data: ct })),
  ];

  const SelectedPreviewComp = TEMPLATE_PREVIEWS[template];
  const selectedDesc = TEMPLATE_DESCRIPTIONS[template];
  const selectedCustom = template.startsWith("custom_")
    ? customTemplates.find((ct) => ct.id === parseInt(template.replace("custom_", "")))
    : null;
  const selectedCrafted = template.startsWith("crafted_")
    ? craftedTemplates.find((ct) => ct.id === template)
    : null;
  const selectedBuiltinNew =
    !template.startsWith("custom_") && allTemplates.some((t) => t.id === template && t.new_template === true);

  const step2Template = (
    <div className="space-y-5">
      {/* Selected template — full-width preview */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
          Selected Template
        </label>
        <div className="rounded-xl overflow-hidden border-2 border-purple-500 shadow-[0_0_0_4px_rgba(124,58,237,0.1)]">
          <div className="relative">
            {demoMode?.templatePreviewOverride && !selectedCustom && !selectedCrafted ? (
              demoMode.templatePreviewOverride({ templateId: template, selected: true, thumbnail: false })
            ) : selectedCustom ? (
              <CustomPreview theme={selectedCustom.theme} name={selectedCustom.name} previewImageUrl={selectedCustom.preview_image_url} introCode={selectedCustom.intro_code || undefined} outroCode={selectedCustom.outro_code || undefined} contentCodes={selectedCustom.content_codes || undefined} contentArchetypeIds={selectedCustom.content_archetype_ids || undefined} logoUrls={selectedCustom.logo_urls} ogImage={selectedCustom.og_image} key={`selected-custom-${selectedCustom.id}-${step}`} />
            ) : selectedCrafted && ((selectedCrafted as any).frontend_files || selectedCrafted.preview_file || selectedCrafted.preview_image_url || selectedCrafted.theme) ? (
              <CraftedTemplatePreviewSmart
                item={selectedCrafted}
                compileCacheScope={user?.id != null ? String(user.id) : undefined}
                showLoaderOnEmptyOrError
                key={`selected-crafted-${selectedCrafted.id}-${step}`}
              />
            ) : template.startsWith("crafted_") && craftedTemplatesLoading ? (
              <div className="w-full aspect-video bg-[#1a1a2e] flex items-center justify-center">
                <span className="w-7 h-7 border-2 border-purple-200/50 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : SelectedPreviewComp ? (
              <SelectedPreviewComp key={`selected-${template}-${step}`} />
            ) : (
              <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
                {selectedDesc?.title ?? template}
              </div>
            )}
          </div>
          <div className="px-4 py-2.5 bg-purple-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">
                  {selectedCustom ? selectedCustom.name : selectedCrafted ? selectedCrafted.name : (selectedDesc?.title ?? template)}
                </span>
                {selectedBuiltinNew && <NewTemplateBadge className="shrink-0" />}
                {selectedCustom && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ backgroundColor: selectedCustom.preview_colors.accent }}>
                    Custom
                  </span>
                )}
                {selectedCrafted && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-amber-500">
                    Designer
                  </span>
                )}
              </div>
              {selectedCustom ? (
                <div className="text-[11px] text-gray-400 mt-0.5">Custom template</div>
              ) : selectedCrafted ? (
                <div className="text-[11px] text-gray-400 mt-0.5">Designer template</div>
              ) : selectedDesc?.subtitle ? (
                <div className="text-[11px] text-gray-400 mt-0.5">{selectedDesc.subtitle}</div>
              ) : null}
            </div>
            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Genre dropdown + Templates list (filtered by genre) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Genre
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setGenreDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100/60 hover:bg-gray-200/70 text-[11px] font-medium text-gray-700 transition-all min-w-[140px] justify-between"
            >
              <span>
                {genre === GENRE_CUSTOM
                  ? "Custom Templates"
                  : genre === GENRE_CRAFTED
                  ? "Designer"
                  : genre === GENRE_NEW
                  ? "New"
                  : genre === GENRE_POPULAR
                  ? "Popular"
                  : genre || "All genres"}
              </span>
              <svg
                className={`w-3 h-3 text-gray-500 transition-transform ${genreDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {genreDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setGenreDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[200px] max-h-[300px] overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setGenre("");
                      setGenreDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      genre === "" ? "bg-purple-50 text-purple-600" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    All genres
                  </button>
                  {/* Source filters — independent of genre */}
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setGenre(GENRE_NEW);
                      setGenreDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      genre === GENRE_NEW ? "bg-purple-50 text-purple-600" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    ✦ New
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenre(GENRE_POPULAR);
                      setGenreDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      genre === GENRE_POPULAR ? "bg-amber-50 text-amber-600" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Popular
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenre(GENRE_CUSTOM);
                      setGenreDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      genre === GENRE_CUSTOM ? "bg-purple-50 text-purple-600" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Custom Templates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenre(GENRE_CRAFTED);
                      setGenreDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      genre === GENRE_CRAFTED ? "bg-purple-50 text-purple-600" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Designer Templates
                  </button>
                  {allGenres.length > 0 && <div className="my-1 border-t border-gray-100" />}
                  {allGenres.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setGenre(g);
                        setGenreDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        genre === g ? "bg-purple-50 text-purple-600" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mb-1.5 font-medium">
          {genreTemplateListCaption(genre)}
        </p>
        <div className="border border-gray-200/60 rounded-xl p-2.5 max-h-[260px] sm:max-h-[220px] overflow-y-auto bg-gray-50/40">
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <CraftYourTemplateCard
                variant="default"
                isPro={isPro}
                onClick={() => {
                  if (!isPro) { setShowCustomTemplateUpgrade(true); return; }
                  setShowGetMoreTemplates(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!isPro) { setShowCustomTemplateUpgrade(true); return; }
                    setShowGetMoreTemplates(true);
                  }
                }}
              />
              {styleTemplateItems.map((item) => {
                if (item.type === "custom" || item.type === "crafted") {
                  const ct = item.data;
                  const customId = item.id;
                  const isSelected = template === customId;
                  return (
                    <div
                      key={customId}
                      onClick={() => applyTemplate(customId)}
                      className={`relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all group ${
                        isSelected
                          ? "border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                          : "border-gray-200/60 hover:border-purple-300/60"
                      }`}
                    >
                      <div className="relative isolate overflow-hidden max-h-[70px] min-h-[56px]">
                        <div className="relative z-0 min-h-[56px]">
                          {item.type === "crafted" ? (
                            <CraftedTemplatePreviewSmart
                              item={ct as any}
                              compileCacheScope={user?.id != null ? String(user.id) : undefined}
                              thumbnailMode
                              showLoaderOnEmptyOrError
                              key={`${customId}-${step}`}
                            />
                          ) : (
                            <CustomPreviewLandscape {...({ theme: ct.theme, name: ct.name, introCode: ct.intro_code || undefined, outroCode: ct.outro_code || undefined, contentCodes: ct.content_codes || undefined, contentArchetypeIds: ct.content_archetype_ids || undefined, validLayouts: (ct as any).valid_layouts, frontendFiles: (ct as any).frontend_files, frontendEntryRel: (ct as any).frontend_entry_rel, publicAssetUrls: (ct as any).public_asset_urls, previewImageUrl: ct.preview_image_url, logoUrls: (ct as any).logo_urls, ogImage: (ct as any).og_image, showLoaderOnEmptyOrError: false, thumbnailFrame: 135, thumbnailMode: true } as any)} key={`${customId}-${step}`} />
                          )}
                        </div>
                        <div className="absolute top-0 left-0.5 z-[5]">
                          {item.type === "custom" ? <CustomTemplateBadge /> : (
                            <span className="pointer-events-none px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide text-white bg-amber-500 ring-1 ring-amber-300">
                              Designer
                            </span>
                          )}
                        </div>
                        {item.type === "custom" && !isPro && (
                          <div className="absolute top-6 left-0.5 z-[5] px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-600 text-white">
                            Pro
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 z-20 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shadow-md ring-2 ring-white">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className={`px-2 py-1 transition-colors ${isSelected ? "bg-purple-50/80" : "bg-white/80"}`}>
                        <div className="text-[10px] font-semibold text-gray-800 truncate">
                          {ct.name}
                        </div>
                      </div>
                    </div>
                  );
                }

                const t = item.data;
                const PreviewComp = TEMPLATE_PREVIEWS[t.id];
                const desc = TEMPLATE_DESCRIPTIONS[t.id];
                const isSelected = template === t.id;
                const isNewTemplate = t.new_template === true;
                const isPopularTemplate = t.popular_template === true;
                return (
                  <div
                    key={t.id}
                    onClick={() => applyTemplate(t.id)}
                    className={`relative rounded-lg overflow-hidden cursor-pointer transition-all group ${
                      isSelected
                        ? "border-2 border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                        : isNewTemplate
                        ? "border border-purple-500 shadow-[0_0_0_2px_rgba(124,58,237,0.2)] hover:border-purple-600"
                        : isPopularTemplate
                        ? "border border-amber-400/60 shadow-[0_0_0_2px_rgba(245,158,11,0.15)] hover:border-amber-500"
                        : "border-2 border-gray-200/60 hover:border-purple-300/60"
                    }`}
                  >
                    <div className="relative overflow-hidden max-h-[70px] min-h-[56px]">
                      {demoMode?.templatePreviewOverride ? (
                        demoMode.templatePreviewOverride({ templateId: t.id, selected: isSelected, thumbnail: true })
                      ) : PreviewComp ? (
                        <PreviewComp key={`${t.id}-${step}`} thumbnailMode />
                      ) : (
                        <div className="w-full h-full min-h-[56px] bg-gray-100 flex items-center justify-center text-gray-300 text-[10px]">
                          {desc?.title ?? t.name}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shadow-sm">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      {isNewTemplate && (
                        <div className="absolute top-0.5 left-0.5 z-[1]">
                          <NewTemplateBadge />
                        </div>
                      )}
                      {!isNewTemplate && isPopularTemplate && (
                        <div className="absolute top-0.5 left-0.5 z-[1]">
                          <PopularTemplateBadge />
                        </div>
                      )}
                    </div>
                    <div className={`px-2 py-1 transition-colors ${isSelected ? "bg-purple-50/80" : "bg-white/80"}`}>
                      <div className="text-[10px] font-semibold text-gray-800 truncate">
                        {desc?.title ?? t.name}
                      </div>
                    </div>
                  </div>
                );
              })}
              {customTemplatesLoading && (
                <div
                  className="rounded-lg border border-dashed border-gray-200/80 bg-white/70 flex flex-col items-center justify-center gap-2 min-h-[88px] px-2 py-3 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <span className="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin shrink-0" aria-hidden />
                  <p className="text-[10px] text-gray-500 leading-snug">
                    Loading custom templates, please wait.
                  </p>
                </div>
              )}
              {craftedTemplatesLoading && (
                <div
                  className="rounded-lg border border-dashed border-gray-200/80 bg-white/70 flex flex-col items-center justify-center gap-2 min-h-[88px] px-2 py-3 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <span className="w-4 h-4 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin shrink-0" aria-hidden />
                  <p className="text-[10px] text-gray-500 leading-snug">
                    Loading designer templates, please wait.
                  </p>
                </div>
              )}
            </div>
            {styleTemplateItems.length === 0 && (
              <p className="text-xs text-gray-500 py-3 text-center">
                No templates for this genre. Pick another genre above or add a custom template.
              </p>
            )}
          </>
        </div>

        {/* Video Style picker — orthogonal to genre. "Auto" lets the AI choose after scraping. */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              Video Style
            </label>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100/60 rounded-xl justify-center">
              {VIDEO_STYLES.map((s) => {
                const isSelected = videoStyle === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      styleManuallySet.current = true;
                      setVideoStyle(s.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      isSelected ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Video colors */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
          Video Colors
        </label>
        <div className="flex items-center gap-3 sm:gap-5">
          {[
            { label: "Accent", value: accentColor, setter: setAccentColor },
            { label: "Background", value: bgColor, setter: setBgColor },
            { label: "Text", value: textColor, setter: setTextColor },
          ].map(({ label, value, setter }) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer group">
              <span
                className="w-8 h-8 rounded-full border-2 border-gray-200 group-hover:border-gray-400 transition-all shadow-sm relative overflow-hidden"
                style={{ backgroundColor: value }}
              >
                <input
                  type="color"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </span>
              <span className="text-[10px] text-gray-400 font-medium">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={goBack}
          className="px-5 py-3 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/60"
        >
          Back
        </button>
        <button
          type="button"
          onClick={goNext}
          className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          Go to step 3
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );

  // ─── Step 2 bulk: template per project (tabbed; same UI as single) ─────────
  const step2BulkTemplate = (() => {
    const indexed = bulkRows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => row.url.trim());
    if (indexed.length === 0) {
      return (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">Please go back to step 1 to continue again.</p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={goBack}
              className="px-5 py-3 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/60"
            >
              Back
            </button>
          </div>
        </div>
      );
    }

    const active = Math.min(bulkActiveIndex, indexed.length - 1);
    const activeIndex = indexed[active].i;
    const activeRow = indexed[active].row;
    const masterIndex =
      indexed.find(({ i }) => i === bulkTemplateMasterIndex)?.i ?? indexed[0].i;

    const tpl = bulkTemplates[activeIndex] ?? "default";
    const templateMeta = allTemplates.find((t) => t.id === tpl);
    const selectedCustomBulk = tpl.startsWith("custom_")
      ? customTemplates.find((ct) => ct.id === parseInt(tpl.replace("custom_", "")))
      : null;
    const selectedCraftedBulk = tpl.startsWith("crafted_")
      ? craftedTemplates.find((ct) => ct.id === tpl)
      : null;
    const selectedBuiltinNewBulk = !tpl.startsWith("custom_") && templateMeta?.new_template === true;
    const defaultAccent =
      selectedCustomBulk?.preview_colors?.accent
      ?? selectedCraftedBulk?.preview_colors?.accent
      ?? templateMeta?.preview_colors?.accent
      ?? accentColor;
    const defaultBg =
      selectedCustomBulk?.preview_colors?.bg
      ?? selectedCraftedBulk?.preview_colors?.bg
      ?? templateMeta?.preview_colors?.bg
      ?? bgColor;
    const defaultText =
      selectedCustomBulk?.preview_colors?.text
      ?? selectedCraftedBulk?.preview_colors?.text
      ?? templateMeta?.preview_colors?.text
      ?? textColor;

    const accent =
      bulkAccentColors[activeIndex] && bulkAccentColors[activeIndex].trim()
        ? bulkAccentColors[activeIndex]
        : defaultAccent;
    const bg =
      bulkBgColors[activeIndex] && bulkBgColors[activeIndex].trim()
        ? bulkBgColors[activeIndex]
        : defaultBg;
    const text =
      bulkTextColors[activeIndex] && bulkTextColors[activeIndex].trim()
        ? bulkTextColors[activeIndex]
        : defaultText;
    const activeVideoStyle = bulkVideoStyles[activeIndex] ?? DEFAULT_VIDEO_STYLE;
    const rowVideoLength = bulkVideoLength[activeIndex] ?? "short";

    const applyTemplateToAll = () => {
      const targetIndices = indexed.map(({ i }) => i);
      // Template + video style + colors
      setBulkTemplates((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = tpl;
        });
        return next;
      });
      setBulkVideoStyles((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = activeVideoStyle || DEFAULT_VIDEO_STYLE;
        });
        return next;
      });
      setBulkAccentColors((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = accent;
        });
        return next;
      });
      setBulkBgColors((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = bg;
        });
        return next;
      });
      setBulkTextColors((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = text;
        });
        return next;
      });
      setBulkVideoLength((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowVideoLength;
        });
        return next;
      });
      // Logo (file, position, opacity)
      setBulkLogoFile((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = bulkLogoFile[activeIndex] ?? null;
        });
        return next;
      });
      setBulkLogoPosition((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = bulkLogoPosition[activeIndex] ?? "bottom_right";
        });
        return next;
      });
      setBulkLogoOpacity((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = bulkLogoOpacity[activeIndex] ?? 0.9;
        });
        return next;
      });
    };

    const applyBulkTemplate = (id: string) => {
      templateManuallySelectedRef.current = true;
      if (id.startsWith("custom_") && !isPro) {
        setShowCustomTemplateUpgrade(true);
        return;
      }
      const colors = id.startsWith("custom_")
        ? customTemplates.find((t) => t.id === parseInt(id.replace("custom_", "")))?.preview_colors
        : id.startsWith("crafted_")
        ? craftedTemplates.find((t) => t.id === id)?.preview_colors
        : allTemplates.find((t) => t.id === id)?.preview_colors;
      const targetIndices = indexed.map(({ i }) => i);

      if (bulkApplyTemplateAll && activeIndex !== masterIndex) {
        setBulkApplyTemplateAll(false);
        setBulkTemplates((prev) => {
          const next = [...prev];
          next[activeIndex] = id;
          return next;
        });
        if (colors) {
          setBulkAccentColors((prev) => { const next = [...prev]; next[activeIndex] = colors.accent; return next; });
          setBulkBgColors((prev) => { const next = [...prev]; next[activeIndex] = colors.bg; return next; });
          setBulkTextColors((prev) => { const next = [...prev]; next[activeIndex] = colors.text; return next; });
        }
        return;
      }

      if (bulkApplyTemplateAll && activeIndex === masterIndex) {
        setBulkTemplates((prev) => {
          const next = [...prev];
          targetIndices.forEach((idx) => { next[idx] = id; });
          return next;
        });
        if (colors) {
          setBulkAccentColors((prev) => {
            const next = [...prev];
            targetIndices.forEach((idx) => { next[idx] = colors.accent; });
            return next;
          });
          setBulkBgColors((prev) => {
            const next = [...prev];
            targetIndices.forEach((idx) => { next[idx] = colors.bg; });
            return next;
          });
          setBulkTextColors((prev) => {
            const next = [...prev];
            targetIndices.forEach((idx) => { next[idx] = colors.text; });
            return next;
          });
        }
        return;
      }

      setBulkTemplates((prev) => {
        const next = [...prev];
        next[activeIndex] = id;
        return next;
      });
      if (colors) {
        setBulkAccentColors((prev) => { const next = [...prev]; next[activeIndex] = colors.accent; return next; });
        setBulkBgColors((prev) => { const next = [...prev]; next[activeIndex] = colors.bg; return next; });
        setBulkTextColors((prev) => { const next = [...prev]; next[activeIndex] = colors.text; return next; });
      }
    };

    const targetIndicesForTemplate = indexed.map(({ i }) => i);
    const setBulkColor = (kind: "accent" | "bg" | "text", v: string) => {
      if (bulkApplyTemplateAll && activeIndex !== masterIndex) {
        setBulkApplyTemplateAll(false);
        if (kind === "accent") setBulkAccentColors((prev) => { const n = [...prev]; n[activeIndex] = v; return n; });
        if (kind === "bg") setBulkBgColors((prev) => { const n = [...prev]; n[activeIndex] = v; return n; });
        if (kind === "text") setBulkTextColors((prev) => { const n = [...prev]; n[activeIndex] = v; return n; });
        return;
      }
      if (bulkApplyTemplateAll && activeIndex === masterIndex) {
        if (kind === "accent") setBulkAccentColors((prev) => { const n = [...prev]; targetIndicesForTemplate.forEach((idx) => { n[idx] = v; }); return n; });
        if (kind === "bg") setBulkBgColors((prev) => { const n = [...prev]; targetIndicesForTemplate.forEach((idx) => { n[idx] = v; }); return n; });
        if (kind === "text") setBulkTextColors((prev) => { const n = [...prev]; targetIndicesForTemplate.forEach((idx) => { n[idx] = v; }); return n; });
        return;
      }
      if (kind === "accent") setBulkAccentColors((prev) => { const n = [...prev]; n[activeIndex] = v; return n; });
      if (kind === "bg") setBulkBgColors((prev) => { const n = [...prev]; n[activeIndex] = v; return n; });
      if (kind === "text") setBulkTextColors((prev) => { const n = [...prev]; n[activeIndex] = v; return n; });
    };

    const SelectedPreviewComp = TEMPLATE_PREVIEWS[tpl];
    const selectedDesc = TEMPLATE_DESCRIPTIONS[tpl];

    const {
      suggestedTemplates,
      customTemplatesForStyle,
      craftedTemplatesForStyle,
    } = templateBucketsForGenre(genre, templates, readyCustomTemplates, readyCraftedTemplates);
    const sortedBulkSuggestedTemplates = [...suggestedTemplates].sort((a, b) => {
      const rank = (t: TemplateMeta) => (t.new_template ? 0 : t.popular_template ? 1 : 2);
      return rank(a) - rank(b);
    });
    const styleTemplateItems: Array<
      | { type: "builtin"; id: string; data: TemplateMeta }
      | { type: "custom"; id: string; data: CustomTemplateItem }
      | { type: "crafted"; id: string; data: CraftedTemplateItem }
    > = [
      ...sortedBulkSuggestedTemplates.map((t) => ({ type: "builtin" as const, id: t.id, data: t })),
      ...customTemplatesForStyle.map((ct) => ({ type: "custom" as const, id: `custom_${ct.id}`, data: ct })),
      ...craftedTemplatesForStyle.map((ct) => ({ type: "crafted" as const, id: ct.id, data: ct })),
    ];

    return (
      <div className="space-y-5">
        {/* Bulk logo picker (step 2) */}
        <input
          ref={bulkLogoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            e.target.value = "";
            if (bulkLogoRowIndex === null) return;
            if (f && f.size > 2 * 1024 * 1024) {
              showError("Logo must be under 2 MB.");
              return;
            }
            const targetIndices = indexed.map(({ i }) => i);
            if (bulkApplyTemplateAll && bulkLogoRowIndex !== masterIndex) {
              setBulkApplyTemplateAll(false);
              setBulkLogoFile((prev) => {
                const n = [...prev];
                n[bulkLogoRowIndex] = f;
                return n;
              });
              setBulkLogoRowIndex(null);
              return;
            }
            if (bulkApplyTemplateAll && bulkLogoRowIndex === masterIndex) {
              setBulkLogoFile((prev) => {
                const n = [...prev];
                targetIndices.forEach((idx) => { n[idx] = f; });
                return n;
              });
              setBulkLogoRowIndex(null);
              return;
            }
            setBulkLogoFile((prev) => {
              const n = [...prev];
              n[bulkLogoRowIndex] = f;
              return n;
            });
            setBulkLogoRowIndex(null);
          }}
        />

        {/* Tabs for each bulk project — match Link/Upload/Multi Link tabs */}
        <div className="flex flex-wrap gap-1 mb-2">
          <div className="flex flex-wrap gap-1 p-1 bg-gray-100/60 rounded-xl">
            {indexed.map(({ row, i }, tabIdx) => (
              <button
                key={i}
                type="button"
                onClick={() => setBulkActiveIndex(tabIdx)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  tabIdx === active
                    ? "bg-white text-purple-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
                title={row.url.trim() || undefined}
              >
                Video #{tabIdx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Apply template, colors & logo to all */}
        <div className="flex items-center justify-start ml-1 mb-1">
          <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bulkApplyTemplateAll}
              onChange={(e) => {
                const checked = e.target.checked;
                setBulkApplyTemplateAll(checked);
                if (checked) {
                  setBulkTemplateMasterIndex(activeIndex);
                  applyTemplateToAll();
                }
              }}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
            />
            <span className="font-medium">Apply template, colors & logo to all videos</span>
          </label>
        </div>

        {/* Selected template — full-width preview (same UI as single) */}
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
            Selected Template
          </label>
          <div className="rounded-xl overflow-hidden border-2 border-purple-500 shadow-[0_0_0_4px_rgba(124,58,237,0.1)]">
            <div className="relative">
              {selectedCustomBulk ? (
                <CustomPreview theme={selectedCustomBulk.theme} name={selectedCustomBulk.name} previewImageUrl={selectedCustomBulk.preview_image_url} introCode={selectedCustomBulk.intro_code || undefined} outroCode={selectedCustomBulk.outro_code || undefined} contentCodes={selectedCustomBulk.content_codes || undefined} contentArchetypeIds={selectedCustomBulk.content_archetype_ids || undefined} logoUrls={selectedCustomBulk.logo_urls} ogImage={selectedCustomBulk.og_image} key={`selected-bulk-custom-${tpl}-${activeIndex}-${step}`} />
              ) : selectedCraftedBulk && ((selectedCraftedBulk as any).frontend_files || selectedCraftedBulk.preview_file || selectedCraftedBulk.preview_image_url || selectedCraftedBulk.theme) ? (
                <CraftedTemplatePreviewSmart
                  item={selectedCraftedBulk}
                  compileCacheScope={user?.id != null ? String(user.id) : undefined}
                  showLoaderOnEmptyOrError
                  key={`selected-bulk-crafted-${tpl}-${activeIndex}-${step}`}
                />
              ) : tpl.startsWith("crafted_") && craftedTemplatesLoading ? (
                <div className="w-full aspect-video bg-[#1a1a2e] flex items-center justify-center">
                  <span className="w-7 h-7 border-2 border-purple-200/50 border-t-purple-500 rounded-full animate-spin" />
                </div>
              ) : SelectedPreviewComp ? (
                <SelectedPreviewComp key={`selected-bulk-${tpl}-${activeIndex}-${step}`} />
              ) : (
                <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
                  {selectedDesc?.title ?? tpl}
                </div>
              )}
            </div>
            <div className="px-4 py-2.5 bg-purple-50/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-gray-800">{selectedCustomBulk ? selectedCustomBulk.name : selectedCraftedBulk ? selectedCraftedBulk.name : (selectedDesc?.title ?? tpl)}</div>
                  {selectedBuiltinNewBulk && <NewTemplateBadge className="shrink-0" />}
                  {selectedCustomBulk && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ backgroundColor: selectedCustomBulk.preview_colors.accent }}>
                      Custom
                    </span>
                  )}
                  {selectedCraftedBulk && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-amber-500">
                      Designer
                    </span>
                  )}
                </div>
                {selectedCustomBulk ? (
                  <div className="text-[11px] text-gray-400 mt-0.5">Custom template</div>
                ) : selectedCraftedBulk ? (
                  <div className="text-[11px] text-gray-400 mt-0.5">Designer template</div>
                ) : selectedDesc?.subtitle ? (
                  <div className="text-[11px] text-gray-400 mt-0.5">{selectedDesc.subtitle}</div>
                ) : null}
              </div>
              <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Genre filter — same `genre` state as single-link step 2 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              Genre
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setGenreDropdownOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100/60 hover:bg-gray-200/70 text-[11px] font-medium text-gray-700 transition-all min-w-[140px] justify-between"
              >
                <span>
                  {genre === GENRE_CUSTOM
                    ? "Custom Templates"
                    : genre === GENRE_CRAFTED
                    ? "Designer"
                    : genre === GENRE_NEW
                    ? "New"
                    : genre === GENRE_POPULAR
                    ? "Popular"
                    : genre || "All genres"}
                </span>
                <svg
                  className={`w-3 h-3 text-gray-500 transition-transform ${genreDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {genreDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setGenreDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[200px] max-h-[300px] overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setGenre("");
                        setGenreDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        genre === "" ? "bg-purple-50 text-purple-600" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      All genres
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setGenre(GENRE_NEW);
                        setGenreDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        genre === GENRE_NEW ? "bg-purple-50 text-purple-600" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      ✦ New
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenre(GENRE_POPULAR);
                        setGenreDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        genre === GENRE_POPULAR ? "bg-amber-50 text-amber-600" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Popular
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenre(GENRE_CUSTOM);
                        setGenreDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        genre === GENRE_CUSTOM ? "bg-purple-50 text-purple-600" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Custom Templates
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenre(GENRE_CRAFTED);
                        setGenreDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        genre === GENRE_CRAFTED ? "bg-purple-50 text-purple-600" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Designer Templates
                    </button>
                    {allGenres.length > 0 && <div className="my-1 border-t border-gray-100" />}
                    {allGenres.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setGenre(g);
                          setGenreDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                          genre === g ? "bg-purple-50 text-purple-600" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mb-1.5 font-medium">
          {genreTemplateListCaption(genre)}
        </p>
        {/* Template thumbnails — filtered by genre; video style below is orthogonal */}
        <div className="border border-gray-200/60 rounded-xl p-2.5 max-h-[220px] overflow-y-auto bg-gray-50/40">
          <>
            <div className="grid grid-cols-3 gap-2">
              <CraftYourTemplateCard
                variant="compact"
                isPro={isPro}
                onClick={() => {
                  if (!isPro) { setShowCustomTemplateUpgrade(true); return; }
                  setShowGetMoreTemplates(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!isPro) { setShowCustomTemplateUpgrade(true); return; }
                    setShowGetMoreTemplates(true);
                  }
                }}
              />
              {styleTemplateItems.map((item) => {
                if (item.type === "custom" || item.type === "crafted") {
                  const ct = item.data;
                  const customId = item.id;
                  const isSelected = tpl === customId;
                  return (
                    <div
                      key={customId}
                      onClick={() => applyBulkTemplate(customId)}
                      className={`relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all group ${
                        isSelected
                          ? "border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                          : "border-gray-200/60 hover:border-purple-300/60"
                      }`}
                    >
                      <div className="relative isolate overflow-hidden max-h-[70px] min-h-[56px]">
                        <div className="relative z-0 min-h-[56px]">
                          {item.type === "crafted" ? (
                            <CraftedTemplatePreviewSmart
                              item={ct as any}
                              compileCacheScope={user?.id != null ? String(user.id) : undefined}
                              thumbnailMode
                              showLoaderOnEmptyOrError
                              key={`${customId}-bulk-${activeIndex}`}
                            />
                          ) : (
                            <CustomPreviewLandscape {...({ theme: ct.theme, name: ct.name, introCode: ct.intro_code || undefined, outroCode: ct.outro_code || undefined, contentCodes: ct.content_codes || undefined, contentArchetypeIds: ct.content_archetype_ids || undefined, validLayouts: (ct as any).valid_layouts, frontendFiles: (ct as any).frontend_files, frontendEntryRel: (ct as any).frontend_entry_rel, publicAssetUrls: (ct as any).public_asset_urls, previewImageUrl: ct.preview_image_url, logoUrls: (ct as any).logo_urls, ogImage: (ct as any).og_image, showLoaderOnEmptyOrError: false, thumbnailFrame: 135, thumbnailMode: true } as any)} key={`${customId}-bulk-${activeIndex}`} />
                          )}
                        </div>
                        <div className="absolute top-0.5 left-0.5 z-[5]">
                          {item.type === "custom" ? <CustomTemplateBadge /> : (
                            <span className="pointer-events-none px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide text-white bg-amber-500 ring-1 ring-amber-300">
                              Designer
                            </span>
                          )}
                        </div>
                        {item.type === "custom" && !isPro && (
                          <div className="absolute top-6 left-0.5 z-[5] px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-600 text-white">
                            Pro
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 z-20 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shadow-md ring-2 ring-white">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className={`px-2 py-1 transition-colors ${isSelected ? "bg-purple-50/80" : "bg-white/80"}`}>
                        <div className="text-[10px] font-semibold text-gray-800 truncate">
                          {ct.name}
                        </div>
                      </div>
                    </div>
                  );
                }

                const t = item.data;
                const PreviewComp = TEMPLATE_PREVIEWS[t.id];
                const desc = TEMPLATE_DESCRIPTIONS[t.id];
                const isSelected = tpl === t.id;
                const isNewTemplate = t.new_template === true;
                const isPopularTemplate = t.popular_template === true;
                return (
                  <div
                    key={t.id}
                    onClick={() => applyBulkTemplate(t.id)}
                    className={`relative rounded-lg overflow-hidden cursor-pointer transition-all group ${
                      isSelected
                        ? "border-2 border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                        : isNewTemplate
                        ? "border border-purple-500 shadow-[0_0_0_2px_rgba(124,58,237,0.2)] hover:border-purple-600"
                        : isPopularTemplate
                        ? "border border-amber-400/60 shadow-[0_0_0_2px_rgba(245,158,11,0.15)] hover:border-amber-500"
                        : "border-2 border-gray-200/60 hover:border-purple-300/60"
                    }`}
                  >
                    <div className="relative overflow-hidden max-h-[70px] min-h-[56px]">
                      {PreviewComp ? (
                        <PreviewComp key={`${t.id}-bulk-${activeIndex}`} thumbnailMode />
                      ) : (
                        <div className="w-full h-full min-h-[56px] bg-gray-100 flex items-center justify-center text-gray-300 text-[10px]">
                          {desc?.title ?? t.name}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shadow-sm">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      {isNewTemplate && (
                        <div className="absolute top-0.5 left-0.5 z-[1]">
                          <NewTemplateBadge />
                        </div>
                      )}
                      {!isNewTemplate && isPopularTemplate && (
                        <div className="absolute top-0.5 left-0.5 z-[1]">
                          <PopularTemplateBadge />
                        </div>
                      )}
                    </div>
                    <div className={`px-2 py-1 transition-colors ${isSelected ? "bg-purple-50/80" : "bg-white/80"}`}>
                      <div className="text-[10px] font-semibold text-gray-800 truncate">
                        {desc?.title ?? t.name}
                      </div>
                    </div>
                  </div>
                );
              })}
              {customTemplatesLoading && (
                <div
                  className="rounded-lg border border-dashed border-gray-200/80 bg-white/70 flex flex-col items-center justify-center gap-2 min-h-[88px] px-2 py-3 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <span className="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin shrink-0" aria-hidden />
                  <p className="text-[10px] text-gray-500 leading-snug">
                    Loading the custom template, please wait.
                  </p>
                </div>
              )}
              {craftedTemplatesLoading && (
                <div
                  className="rounded-lg border border-dashed border-gray-200/80 bg-white/70 flex flex-col items-center justify-center gap-2 min-h-[88px] px-2 py-3 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <span className="w-4 h-4 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin shrink-0" aria-hidden />
                  <p className="text-[10px] text-gray-500 leading-snug">
                    Loading designer templates, please wait.
                  </p>
                </div>
              )}
            </div>
            {styleTemplateItems.length === 0 && (
              <p className="text-xs text-gray-500 py-3 text-center">
                No templates for this genre. Pick another genre above or add a custom template.
              </p>
            )}
          </>
        </div>

        {/* Video Style — orthogonal to genre (same behavior as single-link step 2) */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              Video Style
            </label>
            <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
              {VIDEO_STYLES.map((s) => {
                const isSelected = activeVideoStyle === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const targetIndices = indexed.map(({ i }) => i);
                      if (bulkApplyTemplateAll && activeIndex !== masterIndex) {
                        setBulkApplyTemplateAll(false);
                        bulkStyleManuallySet.current[activeIndex] = true;
                        setBulkVideoStyles((prev) => {
                          const next = [...prev];
                          next[activeIndex] = s.id;
                          return next;
                        });
                        return;
                      }
                      if (bulkApplyTemplateAll && activeIndex === masterIndex) {
                        targetIndices.forEach((idx) => { bulkStyleManuallySet.current[idx] = true; });
                        setBulkVideoStyles((prev) => {
                          const next = [...prev];
                          targetIndices.forEach((idx) => { next[idx] = s.id; });
                          return next;
                        });
                        return;
                      }
                      bulkStyleManuallySet.current[activeIndex] = true;
                      setBulkVideoStyles((prev) => {
                        const next = [...prev];
                        next[activeIndex] = s.id;
                        return next;
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      isSelected ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Video colors (same UI as single) + Logo (bulk-only extra, placed to the right) */}
        <div className="flex flex-col gap-5">
          <div className="min-w-0">
            <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider text-center sm:text-left">
              Video Colors
            </label>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-3">
              {[
                { label: "Accent", value: accent, setter: (v: string) => setBulkColor("accent", v) },
                { label: "Background", value: bg, setter: (v: string) => setBulkColor("bg", v) },
                { label: "Text", value: text, setter: (v: string) => setBulkColor("text", v) },
              ].map(({ label, value, setter }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer group">
                  <span
                    className="w-8 h-8 rounded-full border-2 border-gray-200 group-hover:border-gray-400 transition-all shadow-sm relative overflow-hidden"
                    style={{ backgroundColor: value }}
                  >
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="w-full">
            <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Logo <span className="text-gray-300 font-normal">(optional · max 2 MB)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="relative mb-4 inline-block">
                <button
                  type="button"
                  onClick={() => { setBulkLogoRowIndex(activeIndex); bulkLogoInputRef.current?.click(); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/60 transition-all pr-8"
                >
                  {bulkLogoFile[activeIndex] ? bulkLogoFile[activeIndex]!.name : "Choose file"}
                </button>
                {bulkLogoFile[activeIndex] && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetIndices = indexed.map(({ i }) => i);
                      if (bulkApplyTemplateAll && activeIndex !== masterIndex) {
                        setBulkApplyTemplateAll(false);
                        setBulkLogoFile((prev) => { const n = [...prev]; n[activeIndex] = null; return n; });
                        return;
                      }
                      if (bulkApplyTemplateAll && activeIndex === masterIndex) {
                        setBulkLogoFile((prev) => {
                          const n = [...prev];
                          targetIndices.forEach((idx) => { n[idx] = null; });
                          return n;
                        });
                        return;
                      }
                      setBulkLogoFile((prev) => { const n = [...prev]; n[activeIndex] = null; return n; });
                    }}
                    className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 flex items-center justify-center transition-colors"
                    title="Remove logo"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {bulkLogoFile[activeIndex] && (
              <div className="mt-2">
                <label className="block text-[10px] text-gray-400 mb-1">Position</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {([
                    { value: "top_left", label: "Top Left" },
                    { value: "top_right", label: "Top Right" },
                    { value: "bottom_left", label: "Bottom Left" },
                    { value: "bottom_right", label: "Bottom Right" },
                  ] as const).map((pos) => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => {
                        const targetIndices = indexed.map(({ i }) => i);
                        if (bulkApplyTemplateAll && activeIndex !== masterIndex) {
                          setBulkApplyTemplateAll(false);
                          setBulkLogoPosition((prev) => { const n = [...prev]; n[activeIndex] = pos.value; return n; });
                          return;
                        }
                        if (bulkApplyTemplateAll && activeIndex === masterIndex) {
                          setBulkLogoPosition((prev) => {
                            const n = [...prev];
                            targetIndices.forEach((idx) => { n[idx] = pos.value; });
                            return n;
                          });
                          return;
                        }
                        setBulkLogoPosition((prev) => { const n = [...prev]; n[activeIndex] = pos.value; return n; });
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                        (bulkLogoPosition[activeIndex] ?? "bottom_right") === pos.value
                          ? "bg-purple-600 text-white"
                          : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-200/60"
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 mb-3.5">
                  <label className="block text-[10px] text-gray-500 mb-1">
                    Opacity <span className="text-gray-500">{Math.round((bulkLogoOpacity[activeIndex] ?? 0.9) * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round((bulkLogoOpacity[activeIndex] ?? 0.9) * 100)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) / 100;
                      const targetIndices = indexed.map(({ i }) => i);
                      if (bulkApplyTemplateAll && activeIndex !== masterIndex) {
                        setBulkApplyTemplateAll(false);
                        setBulkLogoOpacity((prev) => { const n = [...prev]; n[activeIndex] = val; return n; });
                        return;
                      }
                      if (bulkApplyTemplateAll && activeIndex === masterIndex) {
                        setBulkLogoOpacity((prev) => {
                          const n = [...prev];
                          targetIndices.forEach((idx) => { n[idx] = val; });
                          return n;
                        });
                        return;
                      }
                      setBulkLogoOpacity((prev) => { const n = [...prev]; n[activeIndex] = val; return n; });
                    }}
                    className="w-full h-1.5 bg-gray-300 rounded-full appearance-none cursor-pointer accent-purple-600"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={goBack}
            className="w-full sm:w-auto px-5 py-3 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/60"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            className="w-full sm:flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Go to step 3
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  })();

  // ─── Step 3: Voice (last step) — audio playlist style ─────────
  const voiceOptions = [
    { gender: "female" as const, accent: "american" as const, key: "female_american" },
    { gender: "female" as const, accent: "british" as const, key: "female_british" },
    { gender: "male" as const, accent: "american" as const, key: "male_american" },
    { gender: "male" as const, accent: "british" as const, key: "male_british" },
  ];

  const getPlaybackUrl = (key: string): string | null => {
    if (!VOICE_PREVIEW_KEYS.includes(key)) return null;
    const base = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";
    return `${base}/voices/preview-audio?key=${encodeURIComponent(key)}`;
  };

  const FALLBACK_VOICE_NAMES: Record<string, string> = {
    female_american: "Rachel",
    female_british: "Alice",
    male_american: "Bill",
    male_british: "Daniel",
  };
  const FALLBACK_VOICE_DESCS: Record<string, string> = {
    female_american: "Warm & confident, clear narration",
    female_british: "Soft & polished, refined tone",
    male_american: "Friendly & articulate, conversational",
    male_british: "Calm & authoritative, smooth delivery",
  };

  const step3Voice = (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-purple-50/60 border border-purple-200/50">
        <svg className="w-4 h-4 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        <p className="text-[11px] text-purple-600 leading-relaxed">
          Choose narration language. Keep <span className="font-semibold">Auto</span> to detect from content.
        </p>
      </div>
      <div className="space-y-1.5">
        <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
          Language
        </label>
        {renderLanguageDropdown(contentLanguage, setContentLanguage)}
        <p className="text-[11px] text-gray-500">Language of the video content</p>
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-xl bg-gray-50/60 border border-gray-200/60 hover:border-gray-300/60 transition-all">
        <input
          type="checkbox"
          checked={voiceGender === "none"}
          onChange={(e) => {
            const noVoice = e.target.checked;
            if (noVoice) {
              setVoiceGender("none");
              return;
            }
            const id = customVoiceId.trim();
            const saved = id ? myVoicesList.find((v) => v.voice_id === id) : undefined;
            setVoiceGender(normalizeVoiceGender(saved?.gender) ?? "female");
            const a = normalizeVoiceAccent(saved?.accent);
            if (a) setVoiceAccent(a);
          }}
          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
        />
        <div>
          <span className="text-sm font-medium text-gray-700">No voiceover</span>
          <p className="text-[11px] text-gray-400 mt-0.5">Text-only video, no narration audio</p>
        </div>
      </label>

      {/* Voices from user's saved list + premium teasers for free users */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            {voicePanelTab === "advanced" && isPro
              ? "Advanced Options"
              : voicePanelTab === "bgm"
                ? "Music — Play to preview"
                : "Voice — Play to preview"}
          </label>
          <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setVoicePanelTab("voice")}
              className={`whitespace-nowrap px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                voicePanelTab === "voice"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Voice
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isPro) {
                  setShowUpgrade(true);
                  return;
                }
                setVoicePanelTab("bgm");
              }}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                voicePanelTab === "bgm" && isPro
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Music
              <span className="inline-flex h-4 items-center justify-center rounded-full bg-purple-600 px-1.5 text-[9px] font-semibold text-white">
                Premium
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isPro) {
                  setShowUpgrade(true);
                  return;
                }
                setVoicePanelTab("advanced");
              }}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                voicePanelTab === "advanced" && isPro
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Advanced Options
              <span className="inline-flex h-4 items-center justify-center rounded-full bg-purple-600 px-1.5 text-[9px] font-semibold text-white">
                Premium
              </span>
            </button>
          </div>
        </div>
        {voicePanelTab === "voice" && (
        <div className={`space-y-2 max-h-[320px] overflow-y-auto ${voiceGender === "none" ? "opacity-60 pointer-events-none" : ""}`}>
          <CraftYourVoiceCard
            isPro={isPro}
            onClick={openStep3CustomVoiceCreator}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openStep3CustomVoiceCreator();
              }
            }}
          />
          {myVoicesLoading ? (
            <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-gray-50/60 border border-gray-200/60">
              <span className="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin shrink-0" />
              <p className="text-[11px] text-gray-500">Loading your voices…</p>
            </div>
          ) : (
            <>
              {myVoicesList.map((saved) => {
                const isSelected = customVoiceId === saved.voice_id;
                const canSelect = isPro || (saved.plan !== "paid" && !saved.custom_voice_id);
                const hasPreview = !!saved.preview_url;
                const myKey = `my_${saved.voice_id}`;
                const isPlaying = playingKey === myKey;
                const { displayName } = getMyVoiceDisplayName(saved.name);
                const isCustom = !!saved.custom_voice_id;
                return (
                  <VoiceItem
                    key={`saved_${saved.id}`}
                    name={displayName}
                    subtitle={subtitleForSavedVoice(saved)}
                    hasPreview={hasPreview}
                    isPlaying={isPlaying}
                    onPlay={() => playMyVoice(saved)}
                    disabled={false}
                    isSelected={isSelected}
                    onClick={() => {
                      if (!canSelect) {
                        setShowUpgrade(true);
                        return;
                      }
                      const nextId = isSelected ? "" : saved.voice_id;
                      setCustomVoiceId(nextId);
                      if (!isSelected) {
                        const g = normalizeVoiceGender(saved.gender);
                        const a = normalizeVoiceAccent(saved.accent);
                        if (g) setVoiceGender(g);
                        if (a) setVoiceAccent(a);
                      }
                    }}
                    badge={
                      isCustom ? (
                        <span className="inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">Custom</span>
                      ) : saved.plan === "paid" ? (
                        <span className="inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">Premium</span>
                      ) : null
                    }
                    actions={
                      isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : null
                    }
                  />
                );
              })}
              {!isPro && premiumTeaserVoices.map((voice) => {
                const key = `premium_${voice.voice_id}`;
                const isPlaying = playingKey === key;
                const labels = voice.labels ?? {};
                const subtitle = formatVoiceSubtitle(labels.gender, labels.accent, voice.description ?? "Premium voice");
                return (
                  <VoiceItem
                    key={key}
                    name={voice.name}
                    subtitle={subtitle}
                    hasPreview={!!voice.preview_url}
                    isPlaying={isPlaying}
                    onPlay={() => playPremiumTeaser(voice)}
                    disabled={false}
                    isSelected={false}
                    onClick={() => setShowUpgrade(true)}
                    badge={
                      <span className="inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">Premium</span>
                    }
                  />
                );
              })}
            </>
          )}
        </div>
        )}
        {voicePanelTab === "voice" && !myVoicesLoading && myVoicesList.length === 0 && (
          <p className="text-[11px] text-gray-500 mt-2">
            No voices saved. Add voices in the Voices tab to use them here.{" "}
            {!isPro && (
              <button type="button" onClick={() => setShowUpgrade(true)} className="text-purple-600 hover:underline">
                Upgrade to add video
              </button>
            )}
          </p>
        )}
        {/* Advanced Options tab content — voice tuning sliders (paid) */}
        {voicePanelTab === "advanced" && isPro && voiceGender !== "none" && (
          <AdvancedVoiceOptions
            value={{ enabled: expressiveEnabled, stability: voiceStability, speed: voiceSpeed, emotion: voiceEmotion, style: voiceStyle }}
            onChange={(t) => { setExpressiveEnabled(t.enabled); setVoiceStability(t.stability); setVoiceSpeed(t.speed); setVoiceEmotion(t.emotion); setVoiceStyle(t.style); }}
            voiceGender={voiceGender}
            voiceAccent={voiceAccent}
            customVoiceId={customVoiceId}
          />
        )}
      </div>

      {/* ─── Music tab content (Premium; optional) ─────── */}
      {voicePanelTab === "bgm" && isPro && bgmTracks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-400 mb-1">Ambient music behind your narration — optional.</p>

          {/* Volume — shown once a track is picked; applies to the whole project */}
          {selectedBgmTrackId && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-600">Music volume</span>
                <span className="text-[11px] text-gray-400 tabular-nums">{Math.round(selectedBgmVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(selectedBgmVolume * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  setSelectedBgmVolume(v);
                  if (bgmAudioRef.current) bgmAudioRef.current.volume = Math.max(0, Math.min(1, v));
                }}
                className="w-full accent-purple-600 cursor-pointer"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Sets the volume for the whole video. After it's generated, you can fine-tune the music volume per scene in the <span className="font-medium text-gray-500">Audio</span> tab.</p>
            </div>
          )}

          <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {/* None option */}
            <button
              type="button"
              onClick={() => {
                setSelectedBgmTrackId(null);
                bgmAudioRef.current?.pause();
                setBgmPlayingId(null);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                !selectedBgmTrackId
                  ? "border-purple-400 bg-purple-50/60"
                  : "border-gray-200/60 bg-gray-50/40 hover:border-gray-300/60"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-700">None</span>
                <p className="text-[11px] text-gray-400">No background music</p>
              </div>
              {!selectedBgmTrackId && (
                <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>

            {bgmTracks.map((track) => {
              const isSelected = selectedBgmTrackId === track.track_id;
              const isPlaying = bgmPlayingId === track.track_id;
              return (
                <div
                  key={track.track_id}
                  onClick={() => setSelectedBgmTrackId(isSelected ? null : track.track_id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-purple-400 bg-purple-50/60"
                      : "border-gray-200/60 bg-gray-50/40 hover:border-gray-300/60"
                  }`}
                >
                  {/* Play/pause button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPlaying) {
                        bgmAudioRef.current?.pause();
                        setBgmPlayingId(null);
                      } else {
                        if (bgmAudioRef.current) {
                          bgmAudioRef.current.pause();
                        }
                        const audio = new Audio(track.r2_url);
                        audio.volume = Math.max(0, Math.min(1, selectedBgmVolume));
                        audio.onended = () => setBgmPlayingId(null);
                        audio.play().catch(() => {});
                        bgmAudioRef.current = audio;
                        setBgmPlayingId(track.track_id);
                      }
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isPlaying
                        ? "bg-purple-600 text-white"
                        : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                    }`}
                  >
                    {isPlaying ? (
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-700">{track.display_name}</span>
                    <p className="text-[11px] text-gray-400">{track.mood}</p>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={goBack}
          className="px-5 py-3 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/60"
        >
          Back
        </button>
        <button
          ref={submitButtonRef}
          type="submit"
          data-action="new-project"
          disabled={loading}
          className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:text-white text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating
            </>
          ) : (
            "Generate Video"
          )}
        </button>
      </div>
    </div>
  );

  // ─── Step 3 bulk: voice per project (tabbed) ───────────────────
  const step3BulkVoice = (() => {
    const indexed = bulkRows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => row.url.trim());

    if (indexed.length === 0) {
      return (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">Please go back to step 1 to continue again.</p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={goBack}
              className="px-5 py-3 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/60"
            >
              Back
            </button>
          </div>
        </div>
      );
    }

    const active = Math.min(bulkActiveIndex, indexed.length - 1);
    const activeIndex = indexed[active].i;
    const masterIndex =
      indexed.find(({ i }) => i === bulkVoiceMasterIndex)?.i ??
      indexed[0].i;
    const rowVoiceGender = bulkVoiceGender[activeIndex] ?? "female";
    const rowVoiceAccent = bulkVoiceAccent[activeIndex] ?? "american";
    const rowVoiceStability = bulkVoiceStability[activeIndex] ?? VOICE_STABILITY_DEFAULT;
    const rowVoiceSpeed = bulkVoiceSpeed[activeIndex] ?? VOICE_SPEED_DEFAULT;
    const rowVoiceEmotion = bulkVoiceEmotion[activeIndex] ?? "";
    const rowVoiceStyle = bulkVoiceStyle[activeIndex] ?? VOICE_STYLE_DEFAULT;
    const rowCustomVoiceId = bulkCustomVoiceId[activeIndex] ?? "";
    const rowContentLanguage = bulkContentLanguage[activeIndex] ?? "auto";
    const rowVideoLength = bulkVideoLength[activeIndex] ?? "short";

    const applyVoiceToAll = () => {
      const targetIndices = indexed.map(({ i }) => i);
      setBulkVoiceGender((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowVoiceGender;
        });
        return next;
      });
      setBulkVoiceAccent((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowVoiceAccent;
        });
        return next;
      });
      setBulkVoiceStability((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowVoiceStability;
        });
        return next;
      });
      setBulkVoiceSpeed((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowVoiceSpeed;
        });
        return next;
      });
      setBulkVoiceEmotion((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowVoiceEmotion;
        });
        return next;
      });
      setBulkVoiceStyle((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowVoiceStyle;
        });
        return next;
      });
      setBulkCustomVoiceId((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowCustomVoiceId;
        });
        return next;
      });
      setBulkContentLanguage((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowContentLanguage;
        });
        return next;
      });
      setBulkVideoLength((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowVideoLength;
        });
        return next;
      });
    };

    return (
      <div className="space-y-5">
        {/* Tabs for each bulk project — match Link/Upload/Multi Link tabs */}
        <div className="flex flex-wrap gap-1 pb-2 mb-2">
          <div className="flex flex-wrap gap-1 p-1 bg-gray-100/60 rounded-xl">
            {indexed.map(({ row, i }, tabIdx) => (
              <button
                key={i}
                type="button"
                onClick={() => setBulkActiveIndex(tabIdx)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  tabIdx === active
                    ? "bg-white text-purple-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
                title={row.url.trim() || undefined}
              >
                Video #{tabIdx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Apply voice selection to all */}
        <div className="flex items-center justify-start mb-2 ml-1">
          <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bulkApplyVoiceAll}
              onChange={(e) => {
                const checked = e.target.checked;
                setBulkApplyVoiceAll(checked);
                if (checked) {
                  // Use the currently active video as the master when (re)enabling apply-to-all.
                  setBulkVoiceMasterIndex(activeIndex);
                  applyVoiceToAll();
                }
              }}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
            />
            <span className="font-medium">Apply settings to all videos</span>
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Language
          </label>
          {renderLanguageDropdown(rowContentLanguage, (value) => {
            const targetIndices = indexed.map(({ i }) => i);
            if (bulkApplyVoiceAll && activeIndex === masterIndex) {
              setBulkContentLanguage((prev) => {
                const next = [...prev];
                targetIndices.forEach((idx) => {
                  next[idx] = value;
                });
                return next;
              });
            } else {
              setBulkApplyVoiceAll(false);
              setBulkContentLanguage((prev) => {
                const next = [...prev];
                next[activeIndex] = value;
                return next;
              });
            }
          })}
          <p className="text-[11px] text-gray-500">Language of the video content</p>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-xl bg-gray-50/60 border border-gray-200/60 hover:border-gray-300/60 transition-all">
          <input
            type="checkbox"
            checked={rowVoiceGender === "none"}
            onChange={(e) => {
              const noVoice = e.target.checked;
              const targetIndices = indexed.map(({ i }) => i);

              const applyNoVoiceoverToggle = (indices: number[]) => {
                if (noVoice) {
                  setBulkVoiceGender((prev) => {
                    const next = [...prev];
                    indices.forEach((idx) => {
                      next[idx] = "none";
                    });
                    return next;
                  });
                  return;
                }
                setBulkVoiceGender((prev) => {
                  const next = [...prev];
                  indices.forEach((idx) => {
                    const vid = (bulkCustomVoiceId[idx] ?? "").trim();
                    const saved = vid ? myVoicesList.find((v) => v.voice_id === vid) : undefined;
                    next[idx] = normalizeVoiceGender(saved?.gender) ?? "female";
                  });
                  return next;
                });
                setBulkVoiceAccent((prev) => {
                  const next = [...prev];
                  indices.forEach((idx) => {
                    const vid = (bulkCustomVoiceId[idx] ?? "").trim();
                    const saved = vid ? myVoicesList.find((v) => v.voice_id === vid) : undefined;
                    const a = normalizeVoiceAccent(saved?.accent);
                    if (a) next[idx] = a;
                  });
                  return next;
                });
              };

              if (bulkApplyVoiceAll && activeIndex !== masterIndex) {
                // Editing a non-master video breaks the global sync.
                setBulkApplyVoiceAll(false);
                applyNoVoiceoverToggle([activeIndex]);
                return;
              }

              if (bulkApplyVoiceAll && activeIndex === masterIndex) {
                // Master row change: keep all videos in sync.
                applyNoVoiceoverToggle(targetIndices);
                return;
              }

              // No global sync: only update this row.
              applyNoVoiceoverToggle([activeIndex]);
            }}
            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">No voiceover</span>
            <p className="text-[11px] text-gray-400 mt-0.5">Text-only video, no narration audio</p>
          </div>
        </label>

        <div className={rowVoiceGender === "none" ? "opacity-60 pointer-events-none" : ""}>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              {showAdvancedOptions && isPro ? "Advanced Options" : "Voice — select and play to preview"}
            </label>
            <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(false)}
                className={`whitespace-nowrap px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  !(showAdvancedOptions && isPro)
                    ? "bg-white text-purple-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                Voice
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isPro) {
                    setShowUpgrade(true);
                    return;
                  }
                  setShowAdvancedOptions(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  showAdvancedOptions && isPro
                    ? "bg-white text-purple-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                Advanced Options
                <span className="inline-flex h-4 items-center justify-center rounded-full bg-purple-600 px-1.5 text-[9px] font-semibold text-white">
                  Premium
                </span>
              </button>
            </div>
          </div>
          {!(showAdvancedOptions && isPro) && (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {myVoicesLoading ? (
              <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-gray-50/60 border border-gray-200/60">
                <span className="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin shrink-0" />
                <p className="text-[11px] text-gray-500">Loading your voices…</p>
              </div>
            ) : (
              <>
                {myVoicesList.map((saved) => {
                  const isSelectedBulk = rowCustomVoiceId === saved.voice_id;
                  const canSelectBulk = isPro || (saved.plan !== "paid" && !saved.custom_voice_id);
                  const hasPreview = !!saved.preview_url;
                  const myKey = `my_${saved.voice_id}`;
                  const isPlaying = playingKey === myKey;
                  const { displayName } = getMyVoiceDisplayName(saved.name);
                  const isCustom = !!saved.custom_voice_id;
                  return (
                    <VoiceItem
                      key={`saved_${saved.id}`}
                      name={displayName}
                      subtitle={subtitleForSavedVoice(saved)}
                      hasPreview={hasPreview}
                      isPlaying={isPlaying}
                      onPlay={() => playMyVoice(saved)}
                      disabled={false}
                      isSelected={isSelectedBulk}
                      onClick={() => {
                        if (!canSelectBulk) {
                          setShowUpgrade(true);
                          return;
                        }
                        const value = isSelectedBulk ? "" : saved.voice_id;
                        const g = normalizeVoiceGender(saved.gender);
                        const a = normalizeVoiceAccent(saved.accent);
                        const targetIndices = indexed.map(({ i }) => i);
                        if (bulkApplyVoiceAll && activeIndex === masterIndex) {
                          if (g) {
                            setBulkVoiceGender((prev) => {
                              const next = [...prev];
                              targetIndices.forEach((idx) => { next[idx] = g; });
                              return next;
                            });
                          }
                          if (a) {
                            setBulkVoiceAccent((prev) => {
                              const next = [...prev];
                              targetIndices.forEach((idx) => { next[idx] = a; });
                              return next;
                            });
                          }
                          setBulkCustomVoiceId((prev) => {
                            const next = [...prev];
                            targetIndices.forEach((idx) => { next[idx] = value; });
                            return next;
                          });
                        } else {
                          setBulkApplyVoiceAll(false);
                          if (g) {
                            setBulkVoiceGender((prev) => {
                              const next = [...prev];
                              next[activeIndex] = g;
                              return next;
                            });
                          }
                          if (a) {
                            setBulkVoiceAccent((prev) => {
                              const next = [...prev];
                              next[activeIndex] = a;
                              return next;
                            });
                          }
                          setBulkCustomVoiceId((prev) => {
                            const next = [...prev];
                            next[activeIndex] = value;
                            return next;
                          });
                        }
                      }}
                      badge={
                        isCustom ? (
                          <span className="inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">Custom</span>
                        ) : saved.plan === "paid" ? (
                          <span className="inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">Premium</span>
                        ) : null
                      }
                      actions={
                        isSelectedBulk ? (
                          <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : null
                      }
                    />
                  );
                })}
                {!isPro && premiumTeaserVoices.map((voice) => {
                  const key = `premium_${voice.voice_id}`;
                  const isPlaying = playingKey === key;
                  const labels = voice.labels ?? {};
                  const subtitle = formatVoiceSubtitle(labels.gender, labels.accent, voice.description ?? "Premium voice");
                  return (
                    <VoiceItem
                      key={key}
                      name={voice.name}
                      subtitle={subtitle}
                      hasPreview={!!voice.preview_url}
                      isPlaying={isPlaying}
                      onPlay={() => playPremiumTeaser(voice)}
                      disabled={false}
                      isSelected={false}
                      onClick={() => setShowUpgrade(true)}
                      badge={
                        <span className="inline-flex h-5 min-w-[4.5rem] items-center justify-center rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">Premium</span>
                      }
                    />
                  );
                })}
              </>
            )}
          </div>
          )}
          {!(showAdvancedOptions && isPro) && !myVoicesLoading && myVoicesList.length === 0 && (
            <p className="text-[11px] text-gray-500 mt-2">
              No voices saved. Add voices in the Voices tab to use them here.{" "}
              {!isPro && (
                <button type="button" onClick={() => setShowUpgrade(true)} className="text-purple-600 hover:underline">
                  Upgrade to add video
                </button>
              )}
            </p>
          )}
        </div>

        {/* Voice tuning — Stability + Speed sliders (paid); apply-to-all sync mirrors other voice controls */}
        {(() => {
          const applyBulkTuning = <T,>(
            setter: React.Dispatch<React.SetStateAction<T[]>>,
            value: T,
          ) => {
            const targetIndices = indexed.map(({ i }) => i);
            if (bulkApplyVoiceAll && activeIndex === masterIndex) {
              setter((prev) => {
                const next = [...prev];
                targetIndices.forEach((idx) => { next[idx] = value; });
                return next;
              });
            } else {
              setBulkApplyVoiceAll(false);
              setter((prev) => {
                const next = [...prev];
                next[activeIndex] = value;
                return next;
              });
            }
          };
          return (
            <div className={rowVoiceGender === "none" ? "opacity-60 pointer-events-none" : ""}>
              {showAdvancedOptions && isPro && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50/60 border border-gray-200/60">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Enable</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={expressiveEnabled}
                      onClick={() => setExpressiveEnabled((v) => !v)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${expressiveEnabled ? "bg-purple-600" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${expressiveEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  <div
                    className={`space-y-4 transition-opacity ${expressiveEnabled ? "" : "opacity-50 pointer-events-none select-none"}`}
                    aria-disabled={!expressiveEnabled}
                  >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-medium text-gray-600">
                            Emotion <span className="font-normal text-gray-400">(optional)</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {VOICE_EMOTIONS.map((em) => {
                            const selected = rowVoiceEmotion === em.value;
                            return (
                              <button
                                key={em.value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => applyBulkTuning(setBulkVoiceEmotion, selected ? "" : em.value)}
                                className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                  selected
                                    ? "bg-purple-600 border-purple-600 text-white"
                                    : "bg-white border-gray-200 text-gray-600 hover:border-purple-300"
                                }`}
                              >
                                {em.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-gray-600">Expressiveness</span>
                          <span className="text-[11px] text-gray-400 tabular-nums">{rowVoiceStability.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={VOICE_STABILITY_MIN}
                          max={VOICE_STABILITY_MAX}
                          step={VOICE_TUNING_STEP}
                          value={rowVoiceStability}
                          onChange={(e) => applyBulkTuning(setBulkVoiceStability, parseFloat(e.target.value))}
                          className="w-full accent-purple-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                          <span>Steady</span>
                          <span>Expressive</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-gray-600">Character</span>
                          <span className="text-[11px] text-gray-400 tabular-nums">{rowVoiceStyle.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={VOICE_STYLE_MIN}
                          max={VOICE_STYLE_MAX}
                          step={VOICE_TUNING_STEP}
                          value={rowVoiceStyle}
                          onChange={(e) => applyBulkTuning(setBulkVoiceStyle, parseFloat(e.target.value))}
                          className="w-full accent-purple-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                          <span>Natural</span>
                          <span>Dramatic</span>
                        </div>
                        {rowVoiceStyle >= 0.4 && rowVoiceStability >= 0.7 && (
                          <p className="text-[10px] text-amber-600 mt-0.5">High Character + high Expressiveness can sound distorted.</p>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-gray-600">Speed</span>
                          <span className="text-[11px] text-gray-400 tabular-nums">{rowVoiceSpeed.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min={VOICE_SPEED_MIN}
                          max={VOICE_SPEED_MAX}
                          step={VOICE_TUNING_STEP}
                          value={rowVoiceSpeed}
                          onChange={(e) => applyBulkTuning(setBulkVoiceSpeed, parseFloat(e.target.value))}
                          className="w-full accent-purple-600 cursor-pointer"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleVoicePreview({
                            gender: rowVoiceGender,
                            accent: rowVoiceAccent,
                            customVoiceId: rowCustomVoiceId,
                            stability: rowVoiceStability,
                            speed: rowVoiceSpeed,
                            emotion: rowVoiceEmotion,
                            style: rowVoiceStyle,
                          })
                        }
                        disabled={previewState === "loading"}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:border-purple-300 hover:text-purple-700 transition-colors disabled:opacity-50"
                      >
                        {previewState === "loading" ? (
                          <>
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
                            Generating…
                          </>
                        ) : previewState === "playing" ? (
                          <>
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                            Stop
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
                            Listen to a sample
                          </>
                        )}
                      </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={goBack}
            className="px-5 py-3 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/60"
          >
            Back
          </button>
          <button
            ref={submitButtonRef}
            type="submit"
            disabled={loading || !onSubmitBulk}
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:text-white text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating
              </>
            ) : (
              "Create all & generate"
            )}
          </button>
        </div>
      </div>
    );
  })();

  // ─── Render ──────────────────────────────────────────────────
  // Step order: 1 Project, 2 Template, 3 Voice
  const stepContent =
    step === 1
      ? step1
      : step === 2
        ? mode === "bulk"
          ? step2BulkTemplate
          : step2Template
        : mode === "bulk"
          ? step3BulkVoice
          : step3Voice;

  const modalWidth = "max-w-xl";

  const isStep2TemplatesPending =
    step === 2 && (builtinTemplatesLoading || templateAvailabilityLoading || !sessionBuiltinInitDone);

  // Constant form size: min-height so layout doesn’t jump between steps
  const stepContentWrapper = (
    <div className="relative min-h-[420px] flex flex-col">
      <div className="min-h-[420px] flex flex-col">{stepContent}</div>
      {isStep2TemplatesPending && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-md ring-1 ring-gray-200/50 shadow-[inset_0_0_24px_rgba(124,58,237,0.06)]"
          aria-busy="true"
        >
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600"
            aria-hidden
          />
        </div>
      )}
    </div>
  );

  const formContent = (
    <>
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          // Prevent Enter from submitting unless the submit button is focused (avoids auto-submit when landing on step 3)
          if (e.key === "Enter" && document.activeElement !== submitButtonRef.current) {
            e.preventDefault();
          }
        }}
      >
        <div className="relative">
          <StepIndicator current={step} total={3} />
          {stepContentWrapper}
        </div>
        <UpgradePlanModal
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          title="Upgrade to unlock"
          subtitle="Unlock premium voices and more. Choose a plan below."
        />
        <UpgradePlanModal
          open={showCustomTemplateUpgrade}
          onClose={() => setShowCustomTemplateUpgrade(false)}
          subscriptionsOnly
          title="Upgrade to use custom template"
          subtitle="Custom templates are a Standard & Pro feature. Upgrade your plan to use this template in your videos."
        />
        <GetMoreTemplatesModal
          open={showGetMoreTemplates}
          onClose={() => setShowGetMoreTemplates(false)}
          onChooseLink={() => {
            setShowGetMoreTemplates(false);
            openStep2CustomTemplateCreator(videoStyle, null);
          }}
          onChooseDesigner={() => {
            setShowGetMoreTemplates(false);
            setShowDesignerRequest(true);
          }}
        />
        <DesignerTemplateRequestModal
          open={showDesignerRequest}
          onClose={() => setShowDesignerRequest(false)}
        />
      </form>
    </>
  );

  if (!asModal) {
    return (
      <div className="relative">
        <StepIndicator current={step} total={3} />
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && document.activeElement !== submitButtonRef.current) {
              e.preventDefault();
            }
          }}
        >
          {stepContentWrapper}
        </form>
        <UpgradePlanModal
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          title="Upgrade to unlock"
          subtitle="Unlock premium voices and more. Choose a plan below."
        />
        <UpgradePlanModal
          open={showCustomTemplateUpgrade}
          onClose={() => setShowCustomTemplateUpgrade(false)}
          subscriptionsOnly
          title="Upgrade to use custom template"
          subtitle="Custom templates are a Standard & Pro feature. Upgrade your plan to use this template in your videos."
        />
        <GetMoreTemplatesModal
          open={showGetMoreTemplates}
          onClose={() => setShowGetMoreTemplates(false)}
          onChooseLink={() => {
            setShowGetMoreTemplates(false);
            openStep2CustomTemplateCreator(videoStyle, null);
          }}
          onChooseDesigner={() => {
            setShowGetMoreTemplates(false);
            setShowDesignerRequest(true);
          }}
        />
        <DesignerTemplateRequestModal
          open={showDesignerRequest}
          onClose={() => setShowDesignerRequest(false)}
        />
        {videoPreviewId && (
          <TemplateVideoLightbox
            templateId={videoPreviewId}
            onClose={() => setVideoPreviewId(null)}
            onSelect={() => applyTemplate(videoPreviewId)}
            isSelected={template === videoPreviewId}
            customTemplate={
              videoPreviewId.startsWith("custom_")
                ? customTemplates.find((ct) => ct.id === parseInt(videoPreviewId.replace("custom_", "")))
                : videoPreviewId.startsWith("crafted_")
                ? craftedTemplates.find((ct) => ct.id === videoPreviewId)
                : null
            }
          />
        )}
      </div>
    );
  }

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      <div
        className={`absolute inset-0 ${isStep2TemplatesPending ? "bg-black/45 backdrop-blur-md" : "bg-black/40 backdrop-blur-sm"}`}
        onClick={onClose}
      />
      <div
        className={`relative w-full ${modalWidth} bg-white/90 backdrop-blur-xl border border-gray-200/40 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-7 mt-5 max-h-[85vh] overflow-y-auto transition-all duration-300`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-900">New Project</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {formContent}
      </div>
      {videoPreviewId && (
        <TemplateVideoLightbox
          templateId={videoPreviewId}
          onClose={() => setVideoPreviewId(null)}
          onSelect={() => applyTemplate(videoPreviewId)}
          isSelected={template === videoPreviewId}
        />
      )}
    </div>,
    document.body
  );
}
