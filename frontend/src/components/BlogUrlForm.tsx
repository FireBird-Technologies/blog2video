import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { getTemplates, type TemplateMeta } from "../api/client";
import UpgradeModal from "./UpgradeModal";

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
    template?: string
  ) => Promise<void>;
  loading?: boolean;
  /** Render as a full-screen modal overlay */
  asModal?: boolean;
  onClose?: () => void;
}

const MAX_UPLOAD_FILES = 5;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx"];
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export default function BlogUrlForm({
  onSubmit,
  loading,
  asModal,
  onClose,
}: Props) {
  const { user } = useAuth();
  const isPro = user?.plan === "pro";

  // Input mode
  const [mode, setMode] = useState<"url" | "upload">("url");

  // Core fields
  const [urls, setUrls] = useState<string[]>([""]);
  const [name, setName] = useState("");
  const [voiceGender, setVoiceGender] = useState<"female" | "male" | "none">("female");
  const [voiceAccent, setVoiceAccent] = useState<"american" | "british">("american");
  const [accentColor, setAccentColor] = useState("#7C3AED");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [textColor, setTextColor] = useState("#000000");
  const [animationInstructions, setAnimationInstructions] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // New fields
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPosition, setLogoPosition] = useState("bottom_right");
  const [logoOpacity, setLogoOpacity] = useState(0.9);
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"landscape" | "portrait">("landscape");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Document upload state
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [docError, setDocError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [template, setTemplate] = useState("default");

  useEffect(() => {
    getTemplates()
      .then((r) => setTemplates(r.data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "upload") {
      if (docFiles.length === 0) return;
      await onSubmit(
        "", // no URL
        name.trim() || undefined,
        voiceGender,
        voiceAccent,
        accentColor,
        bgColor,
        textColor,
        animationInstructions.trim() || undefined,
        logoFile || undefined,
        logoPosition,
        logoOpacity,
        customVoiceId.trim() || undefined,
        aspectRatio,
        docFiles
      );
      setDocFiles([]);
      setName("");
    } else {
      const validUrls = urls.filter((u) => u.trim());
      if (validUrls.length === 0) return;

      // Submit each URL as a separate project
      for (const url of validUrls) {
        await onSubmit(
          url.trim(),
          name.trim() || undefined,
          voiceGender,
          voiceAccent,
          accentColor,
          bgColor,
          textColor,
          animationInstructions.trim() || undefined,
          logoFile || undefined,
          logoPosition,
          logoOpacity,
          customVoiceId.trim() || undefined,
          aspectRatio,
          undefined,
          template !== "default" ? template : undefined
        );
      }
      setUrls([""]);
      setName("");
    }
  };

  const updateUrl = (index: number, value: string) => {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  };

  const isAllowedFile = (file: File) => {
    // Check MIME type first
    if (ALLOWED_TYPES.includes(file.type)) return true;
    // Fallback: check extension (MIME can be unreliable)
    const ext = file.name.toLowerCase().split(".").pop();
    return ext ? ALLOWED_EXTENSIONS.includes(`.${ext}`) : false;
  };

  const addDocFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setDocError(null);

    const incoming = Array.from(newFiles);

    for (const f of incoming) {
      if (!isAllowedFile(f)) {
        setDocError(`"${f.name}" is not a supported format. Use PDF, DOCX, or PPTX.`);
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

  const isSubmitDisabled =
    loading ||
    (mode === "url" && !urls[0]?.trim()) ||
    (mode === "upload" && docFiles.length === 0);

  const form = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === "url"
              ? "bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === "upload"
              ? "bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Upload
        </button>
      </div>

      {/* URL input (shown when mode === "url") */}
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
              onChange={(e) => updateUrl(i, e.target.value)}
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
            If your post is paywalled. Use the paywall-free link for best results.
          </p>
        </div>
      )}

      {/* Document upload (shown when mode === "upload") */}
      {mode === "upload" && (
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Documents{" "}
            <span className="text-gray-300 font-normal">(max 5 files, 5 MB each)</span>
          </label>

          {/* Dropzone */}
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
            <svg
              className="w-8 h-8 mx-auto mb-2 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm text-gray-500">
              Drop files here or{" "}
              <span className="text-purple-600 font-medium">browse</span>
            </p>
            <p className="text-[10px] text-gray-300 mt-1">PDF, Word, PowerPoint</p>
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              multiple
              className="hidden"
              onChange={(e) => {
                addDocFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* Error message */}
          {docError && (
            <p className="mt-2 text-[11px] text-red-500">{docError}</p>
          )}

          {/* File list */}
          {docFiles.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {docFiles.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50/80 rounded-lg"
                >
                  <svg
                    className={`w-4 h-4 flex-shrink-0 ${
                      file.name.endsWith(".pdf")
                        ? "text-red-400"
                        : file.name.endsWith(".docx")
                        ? "text-blue-400"
                        : "text-orange-400"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="flex-1 text-xs text-gray-700 truncate">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDocFile(i)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
          Project Name{" "}
          <span className="text-gray-300 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={mode === "url" ? "Auto-generated from URL" : "Auto-generated from file name"}
          className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
        />
      </div>

      {/* Voice preferences row */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Voice
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={voiceGender === "none"}
              onChange={(e) => setVoiceGender(e.target.checked ? "none" : "female")}
              className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
            />
            <span className="text-[11px] text-gray-400">No voiceover</span>
          </label>
        </div>

        {voiceGender !== "none" && (
          <div className="grid grid-cols-2 gap-4">
            {/* Gender */}
            <div>
              <div className="flex gap-2">
                {(["female", "male"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setVoiceGender(g)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      voiceGender === g
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/60"
                    }`}
                  >
                    {g === "female" ? "Female" : "Male"}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent */}
            <div>
              <div className="flex gap-2">
                {(["american", "british"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setVoiceAccent(a)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      voiceAccent === a
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/60"
                    }`}
                  >
                    {a === "american" ? "American" : "British"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Voice ID — Pro only, visible when voice is not "none" */}
      {isPro && voiceGender !== "none" && (
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Custom Voice ID{" "}
            <span className="text-gray-300 font-normal">(ElevenLabs)</span>
          </label>
          <input
            type="text"
            value={customVoiceId}
            onChange={(e) => setCustomVoiceId(e.target.value)}
            placeholder="Paste your ElevenLabs voice ID..."
            className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
          />
          <p className="mt-1 text-[10px] text-gray-300">
            Override the default voice with your own from elevenlabs.io
          </p>
        </div>
      )}

      {/* Template */}
      {templates.length > 0 && (
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
            Template
          </label>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTemplate(t.id);
                  if (t.preview_colors) {
                    setAccentColor(t.preview_colors.accent);
                    setBgColor(t.preview_colors.bg);
                    setTextColor(t.preview_colors.text);
                  }
                }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  template === t.id
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/60"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Aspect Ratio */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
          Format
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
              <span
                className={`text-[9px] ${
                  aspectRatio === opt.value ? "text-purple-200" : "text-gray-300"
                }`}
              >
                {opt.sub}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Video Colors — three dots */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
          Video Colors
        </label>
        <div className="flex items-center gap-4">
          {/* Accent */}
          <label className="flex flex-col items-center gap-1.5 cursor-pointer group">
            <span
              className="w-8 h-8 rounded-full border-2 border-gray-200 group-hover:border-gray-400 transition-all shadow-sm relative overflow-hidden"
              style={{ backgroundColor: accentColor }}
            >
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </span>
            <span className="text-[10px] text-gray-400 font-medium">Accent</span>
          </label>

          {/* Background */}
          <label className="flex flex-col items-center gap-1.5 cursor-pointer group">
            <span
              className="w-8 h-8 rounded-full border-2 border-gray-200 group-hover:border-gray-400 transition-all shadow-sm relative overflow-hidden"
              style={{ backgroundColor: bgColor }}
            >
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </span>
            <span className="text-[10px] text-gray-400 font-medium">Background</span>
          </label>

          {/* Text */}
          <label className="flex flex-col items-center gap-1.5 cursor-pointer group">
            <span
              className="w-8 h-8 rounded-full border-2 border-gray-200 group-hover:border-gray-400 transition-all shadow-sm relative overflow-hidden"
              style={{ backgroundColor: textColor }}
            >
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </span>
            <span className="text-[10px] text-gray-400 font-medium">Text</span>
          </label>
        </div>
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
          Logo{" "}
          <span className="text-gray-300 font-normal">(optional · max 2 MB)</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/60 transition-all"
          >
            {logoFile ? logoFile.name : "Choose file"}
          </button>
          {logoFile && (
            <button
              type="button"
              onClick={() => {
                setLogoFile(null);
                if (logoInputRef.current) logoInputRef.current.value = "";
              }}
              className="text-[10px] text-gray-400 hover:text-red-500"
            >
              Remove
            </button>
          )}
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
            <label className="block text-[10px] text-gray-400 mb-1">
              Position
            </label>
            <div className="flex gap-1.5">
              {(
                [
                  { value: "top_left", label: "Top Left" },
                  { value: "top_right", label: "Top Right" },
                  { value: "bottom_left", label: "Bottom Left" },
                  { value: "bottom_right", label: "Bottom Right" },
                ] as const
              ).map((pos) => (
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

            {/* Opacity slider */}
            <div className="mt-2.5">
              <label className="block text-[10px] text-gray-400 mb-1">
                Opacity{" "}
                <span className="text-gray-300">
                  {Math.round(logoOpacity * 100)}%
                </span>
              </label>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round(logoOpacity * 100)}
                onChange={(e) =>
                  setLogoOpacity(parseInt(e.target.value, 10) / 100)
                }
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitDisabled}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {mode === "upload" ? "Extracting..." : "Creating..."}
          </>
        ) : (
          "Generate Video"
        )}
      </button>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Upgrade"
      />
    </form>
  );

  if (!asModal) return form;

  // Modal overlay
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md mx-4 bg-white/90 backdrop-blur-xl border border-gray-200/40 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-7 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-900">
            New Project
          </h2>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {form}
      </div>
    </div>
  );
}
