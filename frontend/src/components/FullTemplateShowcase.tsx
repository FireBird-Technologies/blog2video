import { useState, useEffect } from "react";
import NightfallPreview from "./templatePreviews/NightfallPreview";
import BloombergPreview from "./templatePreviews/BloombergPreview";
import WhiteboardPreview from "./templatePreviews/WhiteboardPreview";
import NightfallPreviewPortrait from "./templatePreviews/portrait/NightfallPreviewPortrait";
import BloombergPreviewPortrait from "./templatePreviews/portrait/BloombergPreviewPortrait";
import WhiteboardPreviewPortrait from "./templatePreviews/portrait/WhiteboardPreviewPortrait";
import NewscastPreview from "./templatePreviews/NewscastPreview";
import NewscastPreviewPortrait from "./templatePreviews/portrait/NewscastPreviewPortrait";
import InputShowcase from "./InputShowcase";

type TemplateId = "nightfall" | "newscast" | "bloomberg" | "whiteboard";
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
  {
    id: "bloomberg",
    name: "Bloomberg",
    description: "Terminal-style financial template with amber-on-dark panels, ticker chrome, and market-desk authority — ideal for finance, economics, and data-heavy reporting.",
    hasPortrait: true,
  },
  {
    id: "whiteboard",
    name: "Whiteboard",
    description: "Hand-drawn marker animations on a cream canvas. Stick figures and story-beat layouts ideal for educational content.",
    hasPortrait: true,
  },
];

const LANDSCAPE_PREVIEWS: Record<TemplateId, React.ComponentType> = {
  nightfall: NightfallPreview,
  newscast: NewscastPreview,
  bloomberg: BloombergPreview,
  whiteboard: WhiteboardPreview,
};

const PORTRAIT_PREVIEWS: Partial<Record<TemplateId, React.ComponentType>> = {
  nightfall: NightfallPreviewPortrait,
  newscast: NewscastPreviewPortrait,
  bloomberg: BloombergPreviewPortrait,
  whiteboard: WhiteboardPreviewPortrait,
};

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
