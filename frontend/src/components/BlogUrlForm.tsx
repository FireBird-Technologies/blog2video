import { useState } from "react";

interface Props {
  onSubmit: (
    url: string,
    name?: string,
    voiceGender?: string,
    voiceAccent?: string,
    accentColor?: string,
    bgColor?: string,
    textColor?: string,
    animationInstructions?: string
  ) => Promise<void>;
  loading?: boolean;
  /** Render as a full-screen modal overlay */
  asModal?: boolean;
  onClose?: () => void;
}

const PRESET_ACCENTS = [
  { label: "Purple", value: "#7C3AED" },
  { label: "Blue", value: "#2563EB" },
  { label: "Emerald", value: "#059669" },
  { label: "Rose", value: "#E11D48" },
  { label: "Orange", value: "#EA580C" },
  { label: "Amber", value: "#D97706" },
];

export default function BlogUrlForm({
  onSubmit,
  loading,
  asModal,
  onClose,
}: Props) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [voiceAccent, setVoiceAccent] = useState<"american" | "british">(
    "american"
  );
  const [accentColor, setAccentColor] = useState("#7C3AED");
  const [bgColor, setBgColor] = useState("#0A0A0A");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [animationInstructions, setAnimationInstructions] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await onSubmit(
      url.trim(),
      name.trim() || undefined,
      voiceGender,
      voiceAccent,
      accentColor,
      bgColor,
      textColor,
      animationInstructions.trim() || undefined
    );
    setUrl("");
    setName("");
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* URL */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
          Blog URL
        </label>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://medium.com/your-article..."
          className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all"
          autoFocus
        />
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
      <div className="grid grid-cols-2 gap-4">
        {/* Gender */}
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
            Voice
          </label>
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
          <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
            English
          </label>
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

      {/* Accent Color */}
      <div>
        <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
          Accent Color
        </label>
        <div className="flex items-center gap-2">
          {PRESET_ACCENTS.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              onClick={() => setAccentColor(p.value)}
              className={`w-7 h-7 rounded-full border-2 transition-all flex-shrink-0 ${
                accentColor === p.value
                  ? "border-gray-900 scale-110 shadow-md"
                  : "border-transparent hover:border-gray-300"
              }`}
              style={{ backgroundColor: p.value }}
            />
          ))}
          {/* Custom color picker */}
          <label
            title="Custom color"
            className={`relative w-7 h-7 rounded-full border-2 cursor-pointer flex-shrink-0 overflow-hidden transition-all ${
              !PRESET_ACCENTS.some((p) => p.value === accentColor)
                ? "border-gray-900 scale-110 shadow-md"
                : "border-gray-200 hover:border-gray-300"
            }`}
            style={{
              backgroundColor: PRESET_ACCENTS.some(
                (p) => p.value === accentColor
              )
                ? "#e5e7eb"
                : accentColor,
            }}
          >
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {PRESET_ACCENTS.some((p) => p.value === accentColor) && (
              <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-[9px] font-bold">
                +
              </span>
            )}
          </label>
        </div>
      </div>

      {/* Background & Text Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
            Background
          </label>
          <div className="flex items-center gap-2">
            {[
              { label: "Black", value: "#0A0A0A" },
              { label: "White", value: "#FFFFFF" },
              { label: "Dark gray", value: "#1F2937" },
            ].map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => {
                  setBgColor(c.value);
                  // Auto-swap text color for contrast
                  if (c.value === "#FFFFFF" || c.value === "#F9FAFB") {
                    setTextColor("#0A0A0A");
                  } else {
                    setTextColor("#FFFFFF");
                  }
                }}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  bgColor === c.value
                    ? "border-gray-900 scale-110 shadow-md"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
            <label
              title="Custom background"
              className={`relative w-7 h-7 rounded-full border-2 cursor-pointer overflow-hidden transition-all ${
                !["#0A0A0A", "#FFFFFF", "#1F2937"].includes(bgColor)
                  ? "border-gray-900 scale-110 shadow-md"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={{
                backgroundColor: ["#0A0A0A", "#FFFFFF", "#1F2937"].includes(
                  bgColor
                )
                  ? "#e5e7eb"
                  : bgColor,
              }}
            >
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {["#0A0A0A", "#FFFFFF", "#1F2937"].includes(bgColor) && (
                <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-[9px] font-bold">
                  +
                </span>
              )}
            </label>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
            Text
          </label>
          <div className="flex items-center gap-2">
            {[
              { label: "White", value: "#FFFFFF" },
              { label: "Black", value: "#0A0A0A" },
              { label: "Light gray", value: "#D1D5DB" },
            ].map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => setTextColor(c.value)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  textColor === c.value
                    ? "border-gray-900 scale-110 shadow-md"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
            <label
              title="Custom text color"
              className={`relative w-7 h-7 rounded-full border-2 cursor-pointer overflow-hidden transition-all ${
                !["#FFFFFF", "#0A0A0A", "#D1D5DB"].includes(textColor)
                  ? "border-gray-900 scale-110 shadow-md"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={{
                backgroundColor: ["#FFFFFF", "#0A0A0A", "#D1D5DB"].includes(
                  textColor
                )
                  ? "#e5e7eb"
                  : textColor,
              }}
            >
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {["#FFFFFF", "#0A0A0A", "#D1D5DB"].includes(textColor) && (
                <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-[9px] font-bold">
                  +
                </span>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Preview swatch */}
      <div
        className="rounded-xl p-4 border border-gray-200/40 flex items-center gap-3"
        style={{ backgroundColor: bgColor }}
      >
        <div
          className="w-3 h-8 rounded-sm"
          style={{ backgroundColor: accentColor }}
        />
        <div className="flex-1">
          <p
            className="text-sm font-semibold"
            style={{ color: textColor }}
          >
            Preview Title
          </p>
          <p
            className="text-xs mt-0.5 opacity-70"
            style={{ color: textColor }}
          >
            Body text will look like this.
          </p>
        </div>
        <div
          className="px-3 py-1 rounded-md text-[10px] font-medium"
          style={{ backgroundColor: accentColor, color: "#FFFFFF" }}
        >
          Accent
        </div>
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
            placeholder="e.g. Use smooth fade-in transitions, add bounce effects on bullet points, slide code blocks from the right..."
            rows={3}
            className="mt-2 w-full px-4 py-2.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-transparent transition-all resize-none"
          />
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Creating...
          </>
        ) : (
          "Create Project"
        )}
      </button>
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
      <div className="relative w-full max-w-md mx-4 bg-white/90 backdrop-blur-xl border border-gray-200/40 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-7">
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
