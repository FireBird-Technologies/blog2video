import { useState, useEffect } from "react";

type InputMode = "url" | "bulk" | "upload";

const INPUT_MODES: InputMode[] = ["url", "bulk", "upload"];

export default function InputShowcase() {
  const [mode, setMode] = useState<InputMode>("url");
  const [userInteracted, setUserInteracted] = useState(false);
  const [visible, setVisible] = useState(true);

  function switchMode(next: InputMode) {
    setVisible(false);
    setTimeout(() => {
      setMode(next);
      setVisible(true);
    }, 200);
  }

  useEffect(() => {
    if (userInteracted) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMode((cur) => {
          const idx = INPUT_MODES.indexOf(cur);
          return INPUT_MODES[(idx + 1) % INPUT_MODES.length];
        });
        setVisible(true);
      }, 200);
    }, 3000);
    return () => clearInterval(timer);
  }, [userInteracted]);

  return (
    <div className="mt-8">
      <p className="text-xs font-medium text-purple-600 text-center mb-2 tracking-widest uppercase">Input</p>
      <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center mb-2">Works with any content source</h3>
      <p className="text-sm text-gray-500 text-center max-w-lg mx-auto mb-8 leading-relaxed">
        Paste a blog URL, batch multiple links, or upload your own documents — PDF, PPTX, or DOCX.
      </p>

      <div className="glass-card p-6 sm:p-8 rounded-xl max-w-4xl mx-auto">
        {/* Mode tabs — matches real BlogUrlForm style exactly */}
        <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit mb-6">
          {(["url", "bulk", "upload"] as InputMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { switchMode(m); setUserInteracted(true); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === m
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {m === "url" ? "Link" : m === "bulk" ? "Multi Link" : "Upload"}
            </button>
          ))}
        </div>

        {/* Content area — fades on mode change */}
        <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.2s ease" }}>
          {/* Link mode */}
          {mode === "url" && (
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">Blog URL</label>
              <input
                readOnly
                value="https://yourblog.com/your-article..."
                className="w-full px-4 py-3.5 bg-white/80 border border-gray-200/60 rounded-xl text-sm text-gray-300 focus:outline-none mb-2"
              />
              <p className="text-xs text-gray-400 mt-1">Any blog post, article, or public link. Use a paywall-free link for best results.</p>
            </div>
          )}

          {/* Multi Link mode */}
          {mode === "bulk" && (
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Links <span className="text-gray-300 font-normal">(max 10)</span>
              </label>
              <div className="space-y-2.5 mb-3">
                {[
                  { url: "https://yourblog.com/article-one" },
                  { url: "https://yourblog.com/deep-dive-two" },
                  { url: "" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      readOnly
                      value={row.url}
                      placeholder={`URL ${i + 1}`}
                      className="flex-1 px-3 py-3 bg-white/80 border border-gray-200/60 rounded-lg text-sm text-gray-400 placeholder-gray-300 focus:outline-none"
                    />
                    {/* orientation toggle */}
                    <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
                      <div className="px-2 py-1 rounded-lg bg-white shadow-sm">
                        <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <rect x="3" y="4" width="18" height="12" rx="2" />
                          <path d="M8 20h8M12 16v4" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="px-2 py-1 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <rect x="7" y="2" width="10" height="20" rx="2" />
                          <circle cx="12" cy="18" r="1" />
                        </svg>
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg text-gray-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-purple-600 font-medium flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add link
              </p>
            </div>
          )}

          {/* Upload mode */}
          {mode === "upload" && (
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Documents <span className="text-gray-300 font-normal">(max 5 files, 5 MB each)</span>
              </label>
              <div className="border-2 border-dashed border-gray-200/80 rounded-xl p-6 text-center mb-3">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-500">Drop files here or <span className="text-purple-600 font-medium">browse</span></p>
                <p className="text-[10px] text-gray-300 mt-1">PDF, Word, PowerPoint</p>
              </div>
              <div className="space-y-2">
                {[
                  { name: "research-paper.pdf", size: "2.4 MB", ext: "pdf" },
                  { name: "presentation.pptx", size: "1.1 MB", ext: "pptx" },
                ].map((f) => (
                  <div key={f.name} className="flex items-center gap-3 px-4 py-3 bg-gray-50/80 rounded-xl border border-gray-200/60">
                    <svg className={`w-5 h-5 flex-shrink-0 ${f.ext === "pdf" ? "text-red-400" : f.ext === "docx" ? "text-blue-400" : "text-orange-400"}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="flex-1 text-sm text-gray-700 font-medium truncate">{f.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{f.size}</span>
                    <span className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 bg-red-50 border border-red-200/60">Remove</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
