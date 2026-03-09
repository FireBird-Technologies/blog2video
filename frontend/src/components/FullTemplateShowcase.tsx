import { useState } from "react";
import type { CustomTemplateTheme } from "../api/client";
// import DefaultPreview from "./templatePreviews/DefaultPreview";
import NightfallPreview from "./templatePreviews/NightfallPreview";
// import GridcraftPreview from "./templatePreviews/GridcraftPreview";
import SpotlightPreview from "./templatePreviews/SpotlightPreview";
// import MatrixPreview from "./templatePreviews/MatrixPreview";
import WhiteboardPreview from "./templatePreviews/WhiteboardPreview";
// import NewsPaperPreview from "./templatePreviews/NewsPaperPreview";
import CustomPreview from "./templatePreviews/CustomPreview";
import NightfallPreviewPortrait from "./templatePreviews/portrait/NightfallPreviewPortrait";
import SpotlightPreviewPortrait from "./templatePreviews/portrait/SpotlightPreviewPortrait";
// import GridcraftPreviewPortrait from "./templatePreviews/portrait/GridcraftPreviewPortrait";

type TemplateId = "nightfall" | /* "gridcraft" | */ "spotlight" | /* "default" | */ /* "matrix" | */ "whiteboard" | /* "newspaper" | */ "custom";
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
    id: "spotlight",
    name: "Spotlight",
    description: "Bold kinetic typography on a dark stage. Big numbers and statements take center stage — great for impact and promotional content.",
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
    hasPortrait: false,
  },
  // {
  //   id: "newspaper",
  //   name: "Newspaper",
  //   description: "Editorial news style with pull quotes, fact-check panels, and timelines — great for in-depth explainers and journalism.",
  //   hasPortrait: false,
  // },
  {
    id: "custom",
    name: "Custom",
    description: "Design your own template from any website URL. Set your brand colors, typography, and animation style — fully yours.",
    hasPortrait: false,
  },
];

// Sample theme for the Custom tab preview
const SAMPLE_CUSTOM_THEME: CustomTemplateTheme = {
  colors: {
    accent: "#6366F1",
    bg: "#0F0F1A",
    text: "#F1F5F9",
    surface: "#1E1E2E",
    muted: "#94A3B8",
  },
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  borderRadius: 12,
  style: "glass",
  animationPreset: "spring",
  category: "tech",
  patterns: {
    cards: { corners: "rounded", shadowDepth: "medium", borderStyle: "accent" },
    spacing: { density: "comfortable", gridGap: 24 },
    images: { treatment: "rounded", overlay: "gradient", captionStyle: "below" },
    layout: { direction: "centered", decorativeElements: ["gradient", "blur"] },
  },
};

const LANDSCAPE_PREVIEWS: Record<TemplateId, React.ComponentType> = {
  nightfall: NightfallPreview,
  // default: DefaultPreview,
  // gridcraft: GridcraftPreview,
  spotlight: SpotlightPreview,
  // matrix: MatrixPreview,
  whiteboard: WhiteboardPreview,
  // newspaper: NewsPaperPreview,
  custom: () => <CustomPreview theme={SAMPLE_CUSTOM_THEME} name="Your Brand" />,
};

const PORTRAIT_PREVIEWS: Partial<Record<TemplateId, React.ComponentType>> = {
  nightfall: NightfallPreviewPortrait,
  spotlight: SpotlightPreviewPortrait,
  // gridcraft: GridcraftPreviewPortrait,
};

export default function FullTemplateShowcase() {
  const [selectedId, setSelectedId] = useState<TemplateId>("nightfall");
  const [orientation, setOrientation] = useState<Orientation>("landscape");

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
        Multiple templates — or build your own
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
              onClick={() => setSelectedId(t.id)}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                selectedId === t.id
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {t.name}
            </button>
          ))}
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
                {current.id === "custom" && (
                  <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-600 rounded-full align-middle">
                    Pro
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{current.description}</p>
            </div>
          </div>

          {/* Right: preview */}
          <div className="order-1 md:order-2 flex flex-col w-full">
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
    </div>
  );
}
