import { useState } from "react";

interface Props {
  onSubmit: (
    url: string,
    name?: string,
    voiceGender?: string,
    voiceAccent?: string
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
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [voiceAccent, setVoiceAccent] = useState<"american" | "british">(
    "american"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await onSubmit(
      url.trim(),
      name.trim() || undefined,
      voiceGender,
      voiceAccent
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
