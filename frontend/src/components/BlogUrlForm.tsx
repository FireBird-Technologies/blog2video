import { useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
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
    customVoiceId?: string,
    aspectRatio?: string
  ) => Promise<void>;
  loading?: boolean;
  /** Render as a full-screen modal overlay */
  asModal?: boolean;
  onClose?: () => void;
}

export default function BlogUrlForm({
  onSubmit,
  loading,
  asModal,
  onClose,
}: Props) {
  const { user } = useAuth();
  const isPro = user?.plan === "pro";

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
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"landscape" | "portrait">("landscape");
  const [batchCount, setBatchCount] = useState(1);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        customVoiceId.trim() || undefined,
        aspectRatio
      );
    }
    setUrls([""]);
    setName("");
  };

  const updateUrl = (index: number, value: string) => {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Mode toggle: Single / Multi */}
      <div className="flex rounded-lg bg-gray-100/80 p-0.5">
        <button
          type="button"
          onClick={() => {
            setBatchCount(1);
            setUrls((prev) => [prev[0] || ""]);
          }}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
            batchCount === 1
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Single Video
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isPro) { setShowUpgrade(true); return; }
            setBatchCount(3);
            setUrls((prev) => {
              const next = [...prev];
              while (next.length < 3) next.push("");
              return next.slice(0, 3);
            });
          }}
          className={`flex-1 py-2 rounded-md text-xs font-medium transition-all relative flex items-center justify-center gap-1.5 ${
            batchCount > 1
              ? "bg-white text-gray-900 shadow-sm"
              : isPro
              ? "text-gray-400 hover:text-gray-600"
              : "text-gray-300 cursor-not-allowed"
          }`}
        >
          Multi Video
          {!isPro && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[9px] font-semibold">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Pro
            </span>
          )}
        </button>
      </div>

      {/* URL(s) */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
          Blog URL{batchCount > 1 ? "s" : ""}
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
          placeholder="Auto-generated from URL"
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
          </div>
        )}
      </div>

      {/* Animation Instructions Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          Animation Instructions{" "}
          <span className="text-gray-300 font-normal normal-case">(optional)</span>
        </button>
        {showAdvanced && (
          <textarea
            value={animationInstructions}
            onChange={(e) => setAnimationInstructions(e.target.value)}
            placeholder="e.g. Use flow diagrams for processes, show metrics with animated counters, use comparison layouts for pros/cons, add timelines for phases..."
            rows={3}
            className="mt-2 w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all resize-none"
          />
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !urls[0]?.trim()}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Creating...
          </>
        ) : batchCount > 1 ? (
          `Generate ${urls.filter((u) => u.trim()).length} Videos`
        ) : (
          "Generate Video"
        )}
      </button>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Multi Video"
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
