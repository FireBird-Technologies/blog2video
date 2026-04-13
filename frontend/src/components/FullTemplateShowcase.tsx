import { useState, useEffect } from "react";
// import DefaultPreview from "./templatePreviews/DefaultPreview";
import NightfallPreview from "./templatePreviews/NightfallPreview";
// import GridcraftPreview from "./templatePreviews/GridcraftPreview";
import SpotlightPreview from "./templatePreviews/SpotlightPreview";
// import MatrixPreview from "./templatePreviews/MatrixPreview";
import WhiteboardPreview from "./templatePreviews/WhiteboardPreview";
// import NewsPaperPreview from "./templatePreviews/NewsPaperPreview";
import NightfallPreviewPortrait from "./templatePreviews/portrait/NightfallPreviewPortrait";
import SpotlightPreviewPortrait from "./templatePreviews/portrait/SpotlightPreviewPortrait";
import WhiteboardPreviewPortrait from "./templatePreviews/portrait/WhiteboardPreviewPortrait";
// import GridcraftPreviewPortrait from "./templatePreviews/portrait/GridcraftPreviewPortrait";
import NewscastPreview from "./templatePreviews/NewscastPreview";
import NewscastPreviewPortrait from "./templatePreviews/portrait/NewscastPreviewPortrait";


type TemplateId = "nightfall" | /* "gridcraft" | */ "newscast" | /* "default" | */ /* "matrix" | */ "whiteboard" /* | "newspaper" */;
type Orientation = "landscape" | "portrait";

interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  hasPortrait: boolean;
}

const TEMPLATES: TemplateInfo[] = [
  {
    id: "nightfall",
    name: "Nightfall",
    description: "Dark cinematic glass aesthetic — premium look with subtle gradients and frosted panels, ideal for explainers and product showcases.",
    hasPortrait: true,
  },
  {
    id: "newscast",
    name: "Newscast",
    description: "A dynamic breaking-news template featuring a hero section, headline, live ticker, pull quotes, claim vs. facts panels, and a newsroom-style timeline, with optional full-bleed background images.",
    hasPortrait: true,
  },
  // {
  //   id: "gridcraft",
  //   name: "Gridcraft",
  //   description: "Warm bento-style editorial layouts. Cards, metrics, and clear hierarchy — perfect for comparisons and data-driven stories.",
  //   hasPortrait: true,
  // },
  // {
  //   id: "default",
  //   name: "Default",
  //   description: "Clean geometric explainer style with a purple accent. Versatile layout with hero images, bullet lists, code blocks, and metrics.",
  //   hasPortrait: false,
  // },
  // {
  //   id: "matrix",
  //   name: "Matrix",
  //   description: "Digital rain and terminal aesthetics with green-on-black. Perfect for tech, cybersecurity, and developer content.",
  //   hasPortrait: false,
  // },
  {
    id: "whiteboard",
    name: "Whiteboard",
    description: "Hand-drawn marker animations on a cream canvas. Stick figures and story-beat layouts ideal for educational content.",
    hasPortrait: true,
  },
  // {
  //   id: "newspaper",
  //   name: "Newspaper",
  //   description: "Editorial news style with pull quotes, fact-check panels, and timelines — great for in-depth explainers and journalism.",
  //   hasPortrait: false,
  // },
];

const LANDSCAPE_PREVIEWS: Record<TemplateId, React.ComponentType> = {
  nightfall: NightfallPreview,
  // default: DefaultPreview,
  // gridcraft: GridcraftPreview,
  newscast: NewscastPreview,
  // matrix: MatrixPreview,
  whiteboard: WhiteboardPreview,
  // newspaper: NewsPaperPreview,
};

const PORTRAIT_PREVIEWS: Partial<Record<TemplateId, React.ComponentType>> = {
  nightfall: NightfallPreviewPortrait,
  newscast: NewscastPreviewPortrait,
  whiteboard: WhiteboardPreviewPortrait,
  // gridcraft: GridcraftPreviewPortrait,
};

type InputMode = "url" | "bulk" | "upload";

const INPUT_MODES: InputMode[] = ["url", "bulk", "upload"];

function InputShowcase() {
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

export default function FullTemplateShowcase() {
  const [selectedId, setSelectedId] = useState<TemplateId>("nightfall");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [userInteracted, setUserInteracted] = useState(false);
  const [visible, setVisible] = useState(true);

  function switchTemplate(id: TemplateId) {
    setVisible(false);
    setTimeout(() => {
      setSelectedId(id);
      setOrientation("landscape");
      setVisible(true);
    }, 200);
  }

  // Auto-cycle through templates every 4s until user clicks a tab
  useEffect(() => {
    if (userInteracted) return;
    const ids = TEMPLATES.map((t) => t.id);
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setSelectedId((cur) => {
          const idx = ids.indexOf(cur);
          return ids[(idx + 1) % ids.length];
        });
        setOrientation("landscape");
        setVisible(true);
      }, 200);
    }, 4000);
    return () => clearInterval(timer);
  }, [userInteracted]);

  const current = TEMPLATES.find((t) => t.id === selectedId)!;

  // If selected template has no portrait, force landscape
  const effectiveOrientation = current.hasPortrait ? orientation : "landscape";

  const LandscapePreview = LANDSCAPE_PREVIEWS[selectedId];
  const PortraitPreview = PORTRAIT_PREVIEWS[selectedId];

  return (
    <div className="reveal">
      <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
        Templates
      </p>
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
        Multiple templates — pick your style
      </h2>
      <p className="text-sm text-gray-500 text-center max-w-lg mx-auto mb-6 leading-relaxed">
        Pick the look that fits your content. Every template has unique layouts for your scenes.
      </p>

      <div className="glass-card p-6 sm:p-8 rounded-xl hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all max-w-7xl mx-auto">
        {/* Template tab pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { switchTemplate(t.id); setUserInteracted(true); }}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                selectedId === t.id
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {t.name}
            </button>
          ))}
          <span className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-400 cursor-default select-none border border-dashed border-gray-300">
            100+ more
          </span>
        </div>

        {/* Two-column: description left, preview right */}
        <div className="grid md:grid-cols-[1fr_1.6fr] gap-8 lg:gap-10 items-center">
          {/* Left: orientation toggle + description */}
          <div className="order-2 md:order-1 flex flex-col justify-center md:pr-2">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
                <button
                  type="button"
                  title="Landscape (Desktop / YouTube)"
                  onClick={() => setOrientation("landscape")}
                  className={`px-3 py-1.5 rounded-lg flex items-center transition-all ${
                    effectiveOrientation === "landscape"
                      ? "bg-white text-purple-600 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <rect x="3" y="4" width="18" height="12" rx="2" />
                    <path d="M8 20h8M12 16v4" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  title={current.hasPortrait ? "Portrait (Mobile / TikTok / Reels)" : "Portrait not available for this template"}
                  onClick={() => current.hasPortrait && setOrientation("portrait")}
                  className={`px-3 py-1.5 rounded-lg flex items-center transition-all ${
                    !current.hasPortrait
                      ? "text-gray-200 cursor-not-allowed"
                      : effectiveOrientation === "portrait"
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <rect x="7" y="2" width="10" height="20" rx="2" />
                    <circle cx="12" cy="18" r="1" />
                  </svg>
                </button>
              </div>
              {!current.hasPortrait && (
                <span className="text-[10px] text-gray-400">Landscape only</span>
              )}
            </div>

            <div className="border-l-2 border-purple-500 pl-5 py-1">
              <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
                {current.name}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{current.description}</p>
            </div>
          </div>

          {/* Right: preview */}
          <div className="order-1 md:order-2 flex flex-col w-full" style={{ opacity: visible ? 1 : 0, transition: "opacity 0.2s ease" }}>
            {effectiveOrientation === "landscape" ? (
              <div className="overflow-hidden rounded-lg border border-gray-200/60 bg-white shadow-sm">
                <div className="relative w-full aspect-video overflow-hidden">
                  <LandscapePreview key={`landscape-${selectedId}`} />
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-4 sm:py-6">
                <div className="w-full max-w-[280px] overflow-hidden" style={{ aspectRatio: "9/16" }}>
                  {PortraitPreview && <PortraitPreview key={`portrait-${selectedId}`} />}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Content source showcase — unified tab mockup matching actual BlogUrlForm UI */}
      <InputShowcase />
    </div>
  );
}
