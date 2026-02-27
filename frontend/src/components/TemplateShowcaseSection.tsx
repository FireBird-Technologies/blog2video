import { useState } from "react";
import NightfallPreview from "./templatePreviews/NightfallPreview";
import GridcraftPreview from "./templatePreviews/GridcraftPreview";
import SpotlightPreview from "./templatePreviews/SpotlightPreview";
import NightfallPreviewPortrait from "./templatePreviews/portrait/NightfallPreviewPortrait";
import SpotlightPreviewPortrait from "./templatePreviews/portrait/SpotlightPreviewPortrait";
import GridcraftPreviewPortrait from "./templatePreviews/portrait/GridcraftPreviewPortrait";

type TemplateId = "nightfall" | "spotlight" | "gridcraft";

const TEMPLATES: { id: TemplateId; name: string; description: string }[] = [
  { id: "nightfall", name: "Nightfall", description: "Dark cinematic glass aesthetic — premium look with subtle gradients and frosted panels, ideal for explainers and product showcases." },
  { id: "spotlight", name: "Spotlight", description: "Bold kinetic typography on a dark stage. Big numbers and statements take center stage — great for impact and promotional content." },
  { id: "gridcraft", name: "Gridcraft", description: "Warm bento-style editorial layouts. Cards, metrics, and clear hierarchy — perfect for comparisons and data-driven stories." },
];

const PREVIEW_COMPONENTS: Record<TemplateId, React.ComponentType> = {
  nightfall: NightfallPreview,
  spotlight: SpotlightPreview,
  gridcraft: GridcraftPreview,
};

const PORTRAIT_PREVIEW_COMPONENTS: Record<TemplateId, React.ComponentType> = {
  nightfall: NightfallPreviewPortrait,
  spotlight: SpotlightPreviewPortrait,
  gridcraft: GridcraftPreviewPortrait,
};

type Orientation = "landscape" | "portrait";

export default function TemplateShowcaseSection() {
  const [index, setIndex] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const current = TEMPLATES[index];
  const CurrentPreview = PREVIEW_COMPONENTS[current.id];
  const CurrentPortraitPreview = PORTRAIT_PREVIEW_COMPONENTS[current.id];

  return (
    <div className="reveal">
      <p className="text-xs font-medium text-purple-600 text-center mb-4 tracking-widest uppercase">
        Templates
      </p>
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
        Multiple templates to choose from
      </h2>
      <p className="text-sm text-gray-500 text-center max-w-lg mx-auto mb-6 leading-relaxed">
        Pick the look that fits your content. Many more templates available when you create a video.
      </p>

      {/* Entire section inside one card — same style as landing page */}
      <div className="glass-card p-6 sm:p-8 rounded-xl hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all max-w-7xl mx-auto">
        {/* Template name pills first + 100+ more indicator */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {TEMPLATES.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                index === i ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {t.name}
            </button>
          ))}
          <span className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-100/80 text-gray-400 border border-dashed border-gray-300 cursor-default">
            100+ more
          </span>
        </div>

        {/* Two columns: text left, previews right */}
        <div className="grid md:grid-cols-[1fr_1.6fr] gap-8 lg:gap-10 items-center">
          {/* Left: orientation tabs above theme name, then copy for current template */}
          <div className="order-2 md:order-1 flex flex-col justify-center md:pr-2">
            {/* Landscape / Portrait — above theme name for every theme */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
                <button
                  type="button"
                  title="Landscape (Desktop / YouTube)"
                  onClick={() => setOrientation("landscape")}
                  className={`px-3 py-1.5 rounded-lg flex items-center transition-all ${
                    orientation === "landscape" ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <rect x="3" y="4" width="18" height="12" rx="2" />
                    <path d="M8 20h8M12 16v4" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Portrait (Mobile / TikTok / Reels)"
                  onClick={() => setOrientation("portrait")}
                  className={`px-3 py-1.5 rounded-lg flex items-center transition-all ${
                    orientation === "portrait" ? "bg-white text-purple-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <rect x="7" y="2" width="10" height="20" rx="2" />
                    <circle cx="12" cy="18" r="1" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="border-l-2 border-purple-500 pl-5 py-1">
              <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
                {current.name}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {current.description}
              </p>
            </div>
          </div>

          {/* Right: single preview (orientation chosen above) */}
          <div className="order-1 md:order-2 flex flex-col w-full">
            {/* Single preview: landscape or portrait */}
            {orientation === "landscape" ? (
              <div className="overflow-hidden rounded-lg border border-gray-200/60 bg-white shadow-sm">
                <div className="relative w-full aspect-video overflow-hidden">
                  <CurrentPreview key={`landscape-${current.id}`} />
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-4 sm:py-6">
                <div className="w-full max-w-[280px] overflow-hidden" style={{ aspectRatio: "9/16" }}>
                  <CurrentPortraitPreview key={`portrait-${current.id}`} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
