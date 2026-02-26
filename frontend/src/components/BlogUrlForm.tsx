import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { BulkLinksSection } from "./BulkLinksSection";
import { getTemplates, getVoicePreviews, BACKEND_URL, type TemplateMeta, type VoicePreview, type BulkProjectItem } from "../api/client";
import UpgradeModal from "./UpgradeModal";
import DefaultPreview from "./templatePreviews/DefaultPreview";
import NightfallPreview from "./templatePreviews/NightfallPreview";
import GridcraftPreview from "./templatePreviews/GridcraftPreview";
import SpotlightPreview from "./templatePreviews/SpotlightPreview";
import MatrixPreview from "./templatePreviews/MatrixPreview";
import WhiteboardPreview from "./templatePreviews/WhiteboardPreview";
import NewsPaperPreview from "./templatePreviews/NewsPaperPreview";

export const VIDEO_STYLES = [
  { id: "explainer", label: "Explainer", subtitle: "Educational, clear, step-by-step" },
  { id: "promotional", label: "Promotional", subtitle: "Persuasive, benefit-focused, CTA" },
  { id: "storytelling", label: "Storytelling", subtitle: "Narrative arc, emotional, story-driven" },
] as const;

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
    videoStyle?: string
  ) => Promise<void>;
  /** Bulk create: one call with array of configs; per-project logo via logoIndices + logoFiles. */
  onSubmitBulk?: (items: BulkProjectItem[], logoOptions: { logoIndices: number[]; logoFiles: File[] } | null) => Promise<void>;
  loading?: boolean;
  asModal?: boolean;
  onClose?: () => void;
}

const MAX_UPLOAD_FILES = 5;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

const MAX_BULK_LINKS = (() => {
  const raw = import.meta.env.VITE_MAX_BULK_LINKS as string | undefined;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
})();

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx"];
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

// Template preview component mapping (keyed by template ID from backend)
const TEMPLATE_PREVIEWS: Record<string, React.FC> = {
  default: DefaultPreview,
  nightfall: NightfallPreview,
  gridcraft: GridcraftPreview,
  spotlight: SpotlightPreview,
  matrix: MatrixPreview,
  whiteboard: WhiteboardPreview,
  newspaper: NewsPaperPreview,
};

const TEMPLATE_DESCRIPTIONS: Record<string, { title: string; subtitle: string }> = {
  default: { title: "Geometric Explainer", subtitle: "Clean purple & white, geometric tech style" },
  nightfall: { title: "Nightfall", subtitle: "Dark cinematic glass aesthetic" },
  gridcraft: { title: "Gridcraft", subtitle: "Warm bento editorial layouts" },
  spotlight: { title: "Spotlight", subtitle: "Bold kinetic typography on dark stage" },
  matrix: { title: "Matrix", subtitle: "Digital rain, terminal hacker aesthetic" },
  whiteboard: { title: "Whiteboard Story", subtitle: "Hand-drawn storytelling with stick figures" },
  newspaper: { title: "Newspaper", subtitle: "Editorial news-style headlines, quotes & timelines" },
};

const VOICE_PREVIEW_KEYS = ["female_american", "female_british", "male_american", "male_british"];

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
}
function TemplateVideoLightbox({ templateId, onClose, onSelect, isSelected }: VideoLightboxProps) {
  const PreviewComp = TEMPLATE_PREVIEWS[templateId];
  const desc = TEMPLATE_DESCRIPTIONS[templateId];

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
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
              {desc?.title ?? templateId} — Preview
            </span>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Video content */}
          <div className="bg-black">
            {PreviewComp ? (
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
              {desc?.subtitle}
            </div>
            <button
              onClick={() => { onSelect(); onClose(); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              }`}
            >
              {isSelected ? "✓ Selected" : "Use this template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlogUrlForm({ onSubmit, onSubmitBulk, loading, asModal, onClose }: Props) {
  const { user } = useAuth();
  const isPro = user?.plan === "pro";

  // Wizard step
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — input
  const [mode, setMode] = useState<"url" | "upload" | "bulk">("url");
  const [urls, setUrls] = useState<string[]>([""]);
  const [name, setName] = useState("");
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [docError, setDocError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Bulk: rows (url); per-row name, template, voice, format, logo
  const [bulkRows, setBulkRows] = useState<{ url: string }[]>([{ url: "" }]);
  const [bulkNames, setBulkNames] = useState<string[]>([""]);
  const [bulkTemplates, setBulkTemplates] = useState<string[]>(["nightfall"]);
  const [bulkVoiceGender, setBulkVoiceGender] = useState<("female" | "male" | "none")[]>(["female"]);
  const [bulkVoiceAccent, setBulkVoiceAccent] = useState<("american" | "british")[]>(["american"]);
  const [bulkCustomVoiceId, setBulkCustomVoiceId] = useState<string[]>([]);
  const [bulkAspectRatio, setBulkAspectRatio] = useState<("landscape" | "portrait")[]>(["landscape"]);
  const [bulkVideoStyles, setBulkVideoStyles] = useState<string[]>(["promotional"]);
  const [bulkTemplateListTabs, setBulkTemplateListTabs] = useState<("forStyle" | "others")[]>(["forStyle"]);
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
  const [bulkApplyTemplateAll, setBulkApplyTemplateAll] = useState(false);
  const [bulkApplyVoiceAll, setBulkApplyVoiceAll] = useState(false);

  // Step 2 — voice
  const [voiceGender, setVoiceGender] = useState<"female" | "male" | "none">("female");
  const [voiceAccent, setVoiceAccent] = useState<"american" | "british">("american");
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [voicePreviews, setVoicePreviews] = useState<Record<string, VoicePreview>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedAudioRef = useRef<Record<string, HTMLAudioElement>>({});
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  // Step 2 — video style & template
  const [videoStyle, setVideoStyle] = useState<string>("promotional");
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [templateListTab, setTemplateListTab] = useState<"forStyle" | "others">("forStyle");
  const [template, setTemplate] = useState("nightfall");
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const styleDropdownRef = useRef<HTMLDivElement>(null);

  // When style changes, show "For this style" templates first
  useEffect(() => {
    setTemplateListTab("forStyle");
  }, [videoStyle]);

  // Close style dropdown on click outside
  useEffect(() => {
    if (!styleDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(e.target as Node)) {
        setStyleDropdownOpen(false);
      }
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [styleDropdownOpen]);

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
  useEffect(() => {
    getTemplates()
      .then((r) => setTemplates(r.data))
      .catch(() => {});
    getVoicePreviews()
      .then((r) => setVoicePreviews(r.data))
      .catch(() => {});
  }, []);

  // Sync colors to the selected template when templates load (so default "nightfall" shows nightfall colors on step 2)
  useEffect(() => {
    if (templates.length === 0) return;
    const meta = templates.find((t) => t.id === template);
    if (meta?.preview_colors) {
      setAccentColor(meta.preview_colors.accent);
      setBgColor(meta.preview_colors.bg);
      setTextColor(meta.preview_colors.text);
    }
  }, [templates, template]);

  // Preload voice preview audio on mount so it's ready by step 3
  useEffect(() => {
    const base = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";
    for (const key of VOICE_PREVIEW_KEYS) {
      if (preloadedAudioRef.current[key]) continue;
      const url = `${base}/voices/preview-audio?key=${encodeURIComponent(key)}`;
      const a = new Audio();
      a.preload = "auto";
      a.src = url;
      preloadedAudioRef.current[key] = a;
    }
  }, []);

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

  // ─── File helpers ────────────────────────────────────────────
  const isAllowedFile = (file: File) => {
    if (ALLOWED_TYPES.includes(file.type)) return true;
    const ext = file.name.toLowerCase().split(".").pop();
    return ext ? ALLOWED_EXTENSIONS.includes(`.${ext}`) : false;
  };

  const addDocFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setDocError(null);
    const incoming = Array.from(newFiles);
    for (const f of incoming) {
      if (!isAllowedFile(f)) {
        setDocError(`"${f.name}" is not supported. Use PDF, DOCX, or PPTX.`);
        return;
      }
      if (f.size > MAX_UPLOAD_SIZE) {
        setDocError(`"${f.name}" exceeds the 5 MB size limit.`);
        return;
      }
    }
    const combined = [...docFiles, ...incoming];
    if (combined.length > MAX_UPLOAD_FILES) {
      setDocError(`Maximum ${MAX_UPLOAD_FILES} files allowed.`);
      return;
    }
    setDocFiles(combined);
  };

  const removeDocFile = (index: number) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== index));
    setDocError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── Navigation ──────────────────────────────────────────────
  // Step order: 1 = Project (URL/Upload/Bulk), 2 = Template, 3 = Voice
  const canGoNext1 =
    mode === "url" ? !!urls[0]?.trim() : mode === "upload" ? docFiles.length > 0 : bulkRows.some((r) => r.url.trim());

  const goNext = () => {
    if (step === 1 && canGoNext1) {
      if (mode === "bulk") {
        const n = bulkRows.length;
        setBulkNames((prev) => resizeTo(prev, n, ""));
        setBulkTemplates((prev) => resizeTo(prev, n, "nightfall"));
        setBulkVoiceGender((prev) => resizeTo(prev, n, "female"));
        setBulkVoiceAccent((prev) => resizeTo(prev, n, "american"));
        setBulkCustomVoiceId((prev) => resizeTo(prev, n, ""));
        setBulkAspectRatio((prev) => resizeTo(prev, n, "landscape"));
        setBulkVideoStyles((prev) => resizeTo(prev, n, "promotional"));
        setBulkTemplateListTabs((prev) => resizeTo(prev, n, "forStyle"));
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
    setBulkTemplates((prev) => [...prev, "nightfall"]);
    setBulkVoiceGender((prev) => [...prev, "female"]);
    setBulkVoiceAccent((prev) => [...prev, "american"]);
    setBulkCustomVoiceId((prev) => [...prev, ""]);
    setBulkAspectRatio((prev) => [...prev, "landscape"]);
    setBulkVideoStyles((prev) => [...prev, "promotional"]);
    setBulkTemplateListTabs((prev) => [...prev, "forStyle"]);
    setBulkAccentColors((prev) => [...prev, ""]);
    setBulkBgColors((prev) => [...prev, ""]);
    setBulkTextColors((prev) => [...prev, ""]);
    setBulkLogoFile((prev) => [...prev, null]);
    setBulkLogoPosition((prev) => [...prev, "bottom_right"]);
    setBulkLogoOpacity((prev) => [...prev, 0.9]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkRows.length <= 1) return;
    setBulkRows((prev) => prev.filter((_, i) => i !== index));
    setBulkNames((prev) => prev.filter((_, i) => i !== index));
    setBulkTemplates((prev) => prev.filter((_, i) => i !== index));
    setBulkVoiceGender((prev) => prev.filter((_, i) => i !== index));
    setBulkVoiceAccent((prev) => prev.filter((_, i) => i !== index));
    setBulkCustomVoiceId((prev) => prev.filter((_, i) => i !== index));
    setBulkAspectRatio((prev) => prev.filter((_, i) => i !== index));
    setBulkVideoStyles((prev) => prev.filter((_, i) => i !== index));
    setBulkTemplateListTabs((prev) => prev.filter((_, i) => i !== index));
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
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  // ─── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== 3) return;
    const enteredAt = step3EnteredAtRef.current;
    if (enteredAt != null && Date.now() - enteredAt < 400) return;
    step3EnteredAtRef.current = null;
    audioRef.current?.pause();

    if (mode === "bulk" && onSubmitBulk) {
      const valid = bulkRows
        .map((r, i) => ({ url: r.url, name: bulkNames[i] ?? "", i }))
        .filter((r) => r.url.trim());
      if (valid.length === 0) return;
      const items: BulkProjectItem[] = valid.map(({ url, name: n, i }) => ({
        blog_url: url.trim(),
        name: n.trim() || undefined,
        template: bulkTemplates[i] !== "default" ? bulkTemplates[i] : undefined,
        video_style: (bulkVideoStyles[i] ?? "promotional").toLowerCase(),
        voice_gender: bulkVoiceGender[i],
        voice_accent: bulkVoiceAccent[i],
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
        custom_voice_id: bulkCustomVoiceId[i]?.trim() || undefined,
        aspect_ratio: bulkAspectRatio[i] ?? "landscape",
      }));
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
      setBulkTemplates(["nightfall"]);
      setBulkVoiceGender(["female"]);
      setBulkVoiceAccent(["american"]);
      setBulkCustomVoiceId([]);
      setBulkAspectRatio(["landscape"]);
      setBulkVideoStyles(["promotional"]);
      setBulkTemplateListTabs(["forStyle"]);
      setBulkAccentColors([""]);
      setBulkBgColors([""]);
      setBulkTextColors([""]);
      setBulkLogoFile([null]);
      setBulkLogoPosition(["bottom_right"]);
      setBulkLogoOpacity([0.9]);
      setBulkActiveIndex(0);
      return;
    }

    if (mode === "upload") {
      if (docFiles.length === 0) return;
      await onSubmit(
        "",
        name.trim() || undefined,
        voiceGender,
        voiceAccent,
        accentColor,
        bgColor,
        textColor,
        undefined,
        logoFile || undefined,
        logoPosition,
        logoOpacity,
        customVoiceId.trim() || undefined,
        aspectRatio,
        docFiles,
        template !== "default" ? template : undefined,
        videoStyle
      );
      setDocFiles([]);
      setName("");
    } else {
      const validUrls = urls.filter((u) => u.trim());
      if (validUrls.length === 0) return;
      for (const url of validUrls) {
        await onSubmit(
          url.trim(),
          name.trim() || undefined,
          voiceGender,
          voiceAccent,
          accentColor,
          bgColor,
          textColor,
          undefined,
          logoFile || undefined,
          logoPosition,
          logoOpacity,
          customVoiceId.trim() || undefined,
          aspectRatio,
          undefined,
          template !== "default" ? template : undefined,
          videoStyle
        );
      }
      setUrls([""]);
      setName("");
    }
  };

  // ─── Template apply colors ───────────────────────────────────
  const applyTemplate = (id: string) => {
    setTemplate(id);
    const meta = templates.find((t) => t.id === id);
    if (meta?.preview_colors) {
      setAccentColor(meta.preview_colors.accent);
      setBgColor(meta.preview_colors.bg);
      setTextColor(meta.preview_colors.text);
    }
  };

  // ─── Step 1: Project (URL or Upload) ─────────────────────────
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
      {mode === "bulk" && (
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
      )}

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
              onChange={(e) =>
                setUrls((prev) => prev.map((u, idx) => (idx === i ? e.target.value : u)))
              }
              placeholder={
                i === 0
                  ? "https://yourblog.com/your-article..."
                  : `URL ${i + 1} (optional)`
              }
              className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all mb-2"
              autoFocus={i === 0}
            />
          ))}
          <p className="mt-0.5 text-[11px] text-gray-400 leading-relaxed">
            Use a paywall-free link for best results.
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
            className="relative border-2 border-dashed border-gray-200/80 rounded-xl p-6 text-center hover:border-purple-400/60 transition-colors cursor-pointer"
            onClick={() => docInputRef.current?.click()}
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
              Drop files here or <span className="text-purple-600 font-medium">browse</span>
            </p>
            <p className="text-[10px] text-gray-300 mt-1">PDF, Word, PowerPoint</p>
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
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

      {/* Format + Logo (single-link / upload only; bulk has per-row in step 3) */}
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
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm transition-colors"
                    title="Remove logo"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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
                    alert("Logo must be under 2 MB.");
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
                <div className="flex gap-1.5">
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

      {/* Next — always at bottom for consistent UI in Link and Upload */}
      <button
        type="button"
        onClick={goNext}
        disabled={!canGoNext1}
        className="w-full mb-3 py-3 mt-auto bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 flex-shrink-0"
      >
        Go to step 2
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  // ─── Step 2: Template (moved up; was step 3) ───────────────────
  const availableTemplates = templates.length > 0
    ? templates
    : [
        { id: "default", name: "Geometric Explainer" },
        { id: "nightfall", name: "Nightfall" },
        { id: "gridcraft", name: "Gridcraft" },
        { id: "spotlight", name: "Spotlight" },
        { id: "matrix", name: "Matrix" },
      ];
  // ─── Step 2: Video style + Template ──────────────────────────
  const FALLBACK_TEMPLATES: TemplateMeta[] = [
    { id: "default", name: "Geometric Explainer", description: "", styles: ["explainer", "storytelling"] },
    { id: "nightfall", name: "Nightfall", description: "", styles: ["explainer", "promotional"] },
    { id: "gridcraft", name: "Gridcraft", description: "", styles: ["promotional", "storytelling"] },
    { id: "spotlight", name: "Spotlight", description: "", styles: ["promotional"] },
    { id: "whiteboard", name: "Whiteboard Story", description: "", styles: ["storytelling"] },
  ];
  const styleLower = (videoStyle || "promotional").toLowerCase();
  const sourceList = templates.length > 0 ? templates : FALLBACK_TEMPLATES;
  const suggestedTemplates = sourceList.filter(
    (t) => t.styles?.some((s) => s.toLowerCase() === styleLower)
  );

  const SelectedPreviewComp = TEMPLATE_PREVIEWS[template];
  const selectedDesc = TEMPLATE_DESCRIPTIONS[template];

  const step2Template = (
    <div className="space-y-5">
      {/* Selected template — full-width preview */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
          Selected Template
        </label>
        <div className="rounded-xl overflow-hidden border-2 border-purple-500 shadow-[0_0_0_4px_rgba(124,58,237,0.1)]">
          <div className="relative">
            {SelectedPreviewComp ? (
              <SelectedPreviewComp key={`selected-${template}-${step}`} />
            ) : (
              <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
                {selectedDesc?.title ?? template}
              </div>
            )}
          </div>
          <div className="px-4 py-2.5 bg-purple-50/80 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">{selectedDesc?.title ?? template}</div>
              {selectedDesc?.subtitle && (
                <div className="text-[11px] text-gray-400 mt-0.5">{selectedDesc.subtitle}</div>
              )}
            </div>
            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Video Style tabs + Templates list (filtered by style) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Video Style
          </label>
          <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
            {VIDEO_STYLES.map((s) => {
              const isSelected = (videoStyle || "promotional").toLowerCase() === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setVideoStyle(s.id)}
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
        <div className="border border-gray-200/60 rounded-xl p-2.5 max-h-[220px] overflow-y-auto bg-gray-50/40">
          {suggestedTemplates.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {suggestedTemplates.map((t) => {
                const PreviewComp = TEMPLATE_PREVIEWS[t.id];
                const desc = TEMPLATE_DESCRIPTIONS[t.id];
                const isSelected = template === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => applyTemplate(t.id)}
                    className={`relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all group ${
                      isSelected
                        ? "border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                        : "border-gray-200/60 hover:border-purple-300/60"
                    }`}
                  >
                    <div className="relative overflow-hidden max-h-[70px] min-h-[56px]">
                      {PreviewComp ? (
                        <PreviewComp key={`${t.id}-${step}`} />
                      ) : (
                        <div className="w-full h-full min-h-[56px] bg-gray-100 flex items-center justify-center text-gray-300 text-[10px]">
                          {t.name}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shadow-sm">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
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
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">
              No templates for this style. Try another video style above.
            </p>
          )}
        </div>
      </div>

      {/* Video colors */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
          Video Colors
        </label>
        <div className="flex items-center gap-5">
          {[
            { label: "Accent", value: accentColor, setter: setAccentColor },
            { label: "Background", value: bgColor, setter: setBgColor },
            { label: "Text", value: textColor, setter: setTextColor },
          ].map(({ label, value, setter }) => (
            <label key={label} className="flex flex-col items-center gap-1.5 cursor-pointer group">
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
          <p className="text-sm text-gray-500">Add at least one valid URL to continue.</p>
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

    const tpl = bulkTemplates[activeIndex] ?? "nightfall";
    const templateMeta = templates.find((t) => t.id === tpl);
    const defaultAccent = templateMeta?.preview_colors?.accent ?? accentColor;
    const defaultBg = templateMeta?.preview_colors?.bg ?? bgColor;
    const defaultText = templateMeta?.preview_colors?.text ?? textColor;

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
    const activeVideoStyle = bulkVideoStyles[activeIndex] ?? "promotional";

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
          next[idx] = activeVideoStyle || "promotional";
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
      setBulkTemplates((prev) => {
        const next = [...prev];
        next[activeIndex] = id;
        return next;
      });
      const colors = templates.find((t) => t.id === id)?.preview_colors;
      if (colors) {
        setBulkAccentColors((prev) => {
          const next = [...prev];
          next[activeIndex] = colors.accent;
          return next;
        });
        setBulkBgColors((prev) => {
          const next = [...prev];
          next[activeIndex] = colors.bg;
          return next;
        });
        setBulkTextColors((prev) => {
          const next = [...prev];
          next[activeIndex] = colors.text;
          return next;
        });
      }
    };

    const SelectedPreviewComp = TEMPLATE_PREVIEWS[tpl];
    const selectedDesc = TEMPLATE_DESCRIPTIONS[tpl];

    const FALLBACK_TEMPLATES: TemplateMeta[] = [
      { id: "default", name: "Geometric Explainer", description: "", styles: ["explainer", "storytelling"] },
      { id: "nightfall", name: "Nightfall", description: "", styles: ["explainer", "promotional"] },
      { id: "gridcraft", name: "Gridcraft", description: "", styles: ["promotional", "storytelling"] },
      { id: "spotlight", name: "Spotlight", description: "", styles: ["promotional"] },
      { id: "whiteboard", name: "Whiteboard Story", description: "", styles: ["storytelling"] },
    ];
    const styleLower = (activeVideoStyle || "promotional").toLowerCase();
    const sourceList = templates.length > 0 ? templates : FALLBACK_TEMPLATES;
    const suggestedTemplates = sourceList.filter(
      (t) => t.styles?.some((s) => s.toLowerCase() === styleLower)
    );

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
              alert("Logo must be under 2 MB.");
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

        {/* Apply template, colors & logo to all */}
        <div className="flex items-center justify-end mb-2">
          <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bulkApplyTemplateAll}
              onChange={(e) => {
                const checked = e.target.checked;
                setBulkApplyTemplateAll(checked);
                if (checked) applyTemplateToAll();
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
              {SelectedPreviewComp ? (
                <SelectedPreviewComp key={`selected-bulk-${tpl}-${activeIndex}-${step}`} />
              ) : (
                <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
                  {selectedDesc?.title ?? tpl}
                </div>
              )}
            </div>
            <div className="px-4 py-2.5 bg-purple-50/80 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-800">{selectedDesc?.title ?? tpl}</div>
                {selectedDesc?.subtitle && (
                  <div className="text-[11px] text-gray-400 mt-0.5">{selectedDesc.subtitle}</div>
                )}
              </div>
              <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Video Style tabs */}
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Video Style
          </label>
          <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
            {VIDEO_STYLES.map((s) => {
              const isSelected = (activeVideoStyle || "promotional").toLowerCase() === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setBulkVideoStyles((prev) => {
                      const next = [...prev];
                      next[activeIndex] = s.id;
                      return next;
                    })
                  }
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

        {/* Templates list filtered by style */}
        <div className="border border-gray-200/60 rounded-xl p-2.5 max-h-[220px] overflow-y-auto bg-gray-50/40">
          {suggestedTemplates.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {suggestedTemplates.map((t) => {
                const PreviewComp = TEMPLATE_PREVIEWS[t.id];
                const desc = TEMPLATE_DESCRIPTIONS[t.id];
                const isSelected = tpl === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => applyBulkTemplate(t.id)}
                    className={`relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all group ${
                      isSelected
                        ? "border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.1)]"
                        : "border-gray-200/60 hover:border-purple-300/60"
                    }`}
                  >
                    <div className="relative overflow-hidden max-h-[70px] min-h-[56px]">
                      {PreviewComp ? (
                        <PreviewComp key={`${t.id}-bulk-${activeIndex}`} />
                      ) : (
                        <div className="w-full h-full min-h-[56px] bg-gray-100 flex items-center justify-center text-gray-300 text-[10px]">
                          {t.name}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shadow-sm">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
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
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">
              No templates for this style. Try another video style above.
            </p>
          )}
        </div>

        {/* Video colors (same UI as single) + Logo (bulk-only extra, placed to the right) */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Video Colors
            </label>
            <div className="flex items-center gap-5">
              {[
                { label: "Accent", value: accent, setter: (v: string) => setBulkAccentColors((prev) => { const n = [...prev]; n[activeIndex] = v; return n; }) },
                { label: "Background", value: bg, setter: (v: string) => setBulkBgColors((prev) => { const n = [...prev]; n[activeIndex] = v; return n; }) },
                { label: "Text", value: text, setter: (v: string) => setBulkTextColors((prev) => { const n = [...prev]; n[activeIndex] = v; return n; }) },
              ].map(({ label, value, setter }) => (
                <label key={label} className="flex flex-col items-center gap-1.5 cursor-pointer group">
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

          <div className="min-w-[240px]">
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
                      setBulkLogoFile((prev) => {
                        const n = [...prev];
                        n[activeIndex] = null;
                        return n;
                      });
                    }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm transition-colors"
                    title="Remove logo"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {bulkLogoFile[activeIndex] && (
              <div className="mt-2">
                <label className="block text-[10px] text-gray-400 mb-1">Position</label>
                <div className="flex gap-1.5">
                  {([
                    { value: "top_left", label: "Top Left" },
                    { value: "top_right", label: "Top Right" },
                    { value: "bottom_left", label: "Bottom Left" },
                    { value: "bottom_right", label: "Bottom Right" },
                  ] as const).map((pos) => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() =>
                        setBulkLogoPosition((prev) => {
                          const n = [...prev];
                          n[activeIndex] = pos.value;
                          return n;
                        })
                      }
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
                    onChange={(e) =>
                      setBulkLogoOpacity((prev) => {
                        const n = [...prev];
                        n[activeIndex] = parseInt(e.target.value, 10) / 100;
                        return n;
                      })
                    }
                    className="w-full h-1.5 bg-gray-300 rounded-full appearance-none cursor-pointer accent-purple-600"
                  />
                </div>
              </div>
            )}
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
  })();

  // ─── Step 3: Voice (last step) — audio playlist style ─────────
  const voiceOptions = [
    { gender: "female" as const, accent: "american" as const, key: "female_american", flag: "🇺🇸" },
    { gender: "female" as const, accent: "british" as const, key: "female_british", flag: "🇬🇧" },
    { gender: "male" as const, accent: "american" as const, key: "male_american", flag: "🇺🇸" },
    { gender: "male" as const, accent: "british" as const, key: "male_british", flag: "🇬🇧" },
  ];

  const getPlaybackUrl = (key: string): string | null => {
    if (!VOICE_PREVIEW_KEYS.includes(key)) return null;
    const base = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";
    return `${base}/voices/preview-audio?key=${encodeURIComponent(key)}`;
  };

  const step3Voice = (
    <div className="space-y-5">
      <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-xl bg-gray-50/60 border border-gray-200/60 hover:border-gray-300/60 transition-all">
        <input
          type="checkbox"
          checked={voiceGender === "none"}
          onChange={(e) => setVoiceGender(e.target.checked ? "none" : "female")}
          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
        />
        <div>
          <span className="text-sm font-medium text-gray-700">No voiceover</span>
          <p className="text-[11px] text-gray-400 mt-0.5">Text-only video, no narration audio</p>
        </div>
      </label>

      <div className={voiceGender === "none" ? "opacity-60 pointer-events-none" : ""}>
        <label className="block text-[11px] font-medium text-gray-400 mb-3 uppercase tracking-wider">
          Voice — select and play to preview
        </label>
        <div className="space-y-2">
          {voiceOptions.map(({ gender, accent, key, flag }) => {
            const preview = voicePreviews[key];
            const playbackUrl = getPlaybackUrl(key);
            const isDisabled = voiceGender === "none";
            const isSelected = voiceGender === gender && voiceAccent === accent;
            const isPlaying = playingKey === key;
            const FALLBACK_NAMES: Record<string, string> = {
              female_american: "Rachel",
              female_british: "Alice",
              male_american: "Bill",
              male_british: "Daniel",
            };
            const FALLBACK_DESCS: Record<string, string> = {
              female_american: "Warm & confident, clear narration",
              female_british: "Soft & polished, refined tone",
              male_american: "Friendly & articulate, conversational",
              male_british: "Calm & authoritative, smooth delivery",
            };
            const name = FALLBACK_NAMES[key] || preview?.name || `${gender} ${accent}`;
            const desc = [gender === "female" ? "Female" : "Male", accent === "american" ? "American" : "British"].join(" • ") + ` — ${preview?.description || FALLBACK_DESCS[key] || ""}`;

            return (
              <div
                key={key}
                onClick={() => { if (!isDisabled) { setVoiceGender(gender); setVoiceAccent(accent); } }}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                  isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                } ${
                  isSelected
                    ? "border-purple-500 bg-purple-50/60 shadow-[0_0_0_4px_rgba(124,58,237,0.08)]"
                    : "border-gray-200/60 bg-white/60 hover:border-purple-300/60 hover:bg-purple-50/20"
                } ${isDisabled ? "hover:border-gray-200/60 hover:bg-white/60" : ""}`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDisabled) playVoice(key, playbackUrl);
                  }}
                  disabled={!playbackUrl || isDisabled}
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isDisabled || !playbackUrl
                      ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                      : isPlaying
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700"
                  }`}
                >
                    {isPlaying ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{flag} {name}</div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
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

      {isPro && voiceGender !== "none" && (
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Custom Voice ID <span className="text-gray-300 font-normal">(ElevenLabs)</span>
          </label>
          <input
            type="text"
            value={customVoiceId}
            onChange={(e) => setCustomVoiceId(e.target.value)}
            placeholder="Paste your ElevenLabs voice ID to override..."
            className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
          />
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
          disabled={loading}
          className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {mode === "upload" ? "Extracting..." : mode === "bulk" ? "Creating..." : "Creating..."}
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
          <p className="text-sm text-gray-500">Add at least one valid URL to continue.</p>
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
    const rowVoiceGender = bulkVoiceGender[activeIndex] ?? "female";
    const rowVoiceAccent = bulkVoiceAccent[activeIndex] ?? "american";
    const rowCustomVoiceId = bulkCustomVoiceId[activeIndex] ?? "";

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
      setBulkCustomVoiceId((prev) => {
        const next = [...prev];
        targetIndices.forEach((idx) => {
          next[idx] = rowCustomVoiceId;
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
        <div className="flex items-center justify-end mb-1">
          <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bulkApplyVoiceAll}
              onChange={(e) => {
                const checked = e.target.checked;
                setBulkApplyVoiceAll(checked);
                if (checked) applyVoiceToAll();
              }}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
            />
            <span className="font-medium">Apply voice settings to all videos</span>
          </label>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-xl bg-gray-50/60 border border-gray-200/60 hover:border-gray-300/60 transition-all">
          <input
            type="checkbox"
            checked={rowVoiceGender === "none"}
            onChange={(e) =>
              setBulkVoiceGender((prev) => {
                const next = [...prev];
                next[activeIndex] = e.target.checked ? "none" : "female";
                return next;
              })
            }
            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">No voiceover</span>
            <p className="text-[11px] text-gray-400 mt-0.5">Text-only video, no narration audio</p>
          </div>
        </label>

        <div className={rowVoiceGender === "none" ? "opacity-60 pointer-events-none" : ""}>
          <label className="block text-[11px] font-medium text-gray-400 mb-3 uppercase tracking-wider">
            Voice — select and play to preview
          </label>
          <div className="space-y-2">
            {voiceOptions.map(({ gender, accent, key, flag }) => {
              const preview = voicePreviews[key];
              const playbackUrl = getPlaybackUrl(key);
              const isDisabled = rowVoiceGender === "none";
              const isSelected = rowVoiceGender === gender && rowVoiceAccent === accent;
              const isPlaying = playingKey === key;

              const FALLBACK_NAMES: Record<string, string> = {
                female_american: "Rachel",
                female_british: "Alice",
                male_american: "Bill",
                male_british: "Daniel",
              };
              const FALLBACK_DESCS: Record<string, string> = {
                female_american: "Warm & confident, clear narration",
                female_british: "Soft & polished, refined tone",
                male_american: "Friendly & articulate, conversational",
                male_british: "Calm & authoritative, smooth delivery",
              };
              const name = FALLBACK_NAMES[key] || preview?.name || `${gender} ${accent}`;
              const desc =
                [gender === "female" ? "Female" : "Male", accent === "american" ? "American" : "British"].join(" • ") +
                ` — ${preview?.description || FALLBACK_DESCS[key] || ""}`;

              return (
                <div
                  key={key}
                  onClick={() => { if (!isDisabled) { setBulkVoiceGender((prev) => { const n = [...prev]; n[activeIndex] = gender; return n; }); setBulkVoiceAccent((prev) => { const n = [...prev]; n[activeIndex] = accent; return n; }); } }}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                    isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                  } ${
                    isSelected
                      ? "border-purple-500 bg-purple-50/60 shadow-[0_0_0_4px_rgba(124,58,237,0.08)]"
                      : "border-gray-200/60 bg-white/60 hover:border-purple-300/60 hover:bg-purple-50/20"
                  } ${isDisabled ? "hover:border-gray-200/60 hover:bg-white/60" : ""}`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isDisabled) playVoice(key, playbackUrl);
                    }}
                    disabled={!playbackUrl || isDisabled}
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isDisabled || !playbackUrl
                        ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                        : isPlaying
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700"
                    }`}
                  >
                    {isPlaying ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">
                      {flag} {name}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
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

        {isPro && rowVoiceGender !== "none" && (
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Custom Voice ID <span className="text-gray-300 font-normal">(ElevenLabs)</span>
            </label>
            <input
              type="text"
              value={rowCustomVoiceId}
              onChange={(e) =>
                setBulkCustomVoiceId((prev) => {
                  const next = [...prev];
                  next[activeIndex] = e.target.value;
                  return next;
                })
              }
              placeholder="Paste your ElevenLabs voice ID to override..."
              className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
            />
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
            disabled={loading || !onSubmitBulk}
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating…
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

  // Constant form size: min-height so layout doesn’t jump between steps
  const stepContentWrapper = (
    <div className="min-h-[420px] flex flex-col">
      {stepContent}
    </div>
  );

  const formContent = (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        // Prevent Enter from submitting unless the submit button is focused (avoids auto-submit when landing on step 3)
        if (e.key === "Enter" && document.activeElement !== submitButtonRef.current) {
          e.preventDefault();
        }
      }}
    >
      <StepIndicator current={step} total={3} />
      {stepContentWrapper}
      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Upgrade"
      />
    </form>
  );

  if (!asModal) {
    return (
      <div>
        <StepIndicator current={step} total={3} />
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && document.activeElement !== submitButtonRef.current) {
              e.preventDefault();
            }
          }}
        >
          <div className="min-h-[420px] flex flex-col">{stepContent}</div>
        </form>
        <UpgradeModal
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          feature="Upgrade"
        />
        {videoPreviewId && (
          <TemplateVideoLightbox
            templateId={videoPreviewId}
            onClose={() => setVideoPreviewId(null)}
            onSelect={() => applyTemplate(videoPreviewId)}
            isSelected={template === videoPreviewId}
          />
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${modalWidth} bg-white/90 backdrop-blur-xl border border-gray-200/40 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-7 max-h-[90vh] overflow-y-auto transition-all duration-300`}
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
    </div>
  );
}
