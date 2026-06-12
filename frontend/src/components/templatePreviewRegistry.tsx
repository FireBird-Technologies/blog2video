import type { FC } from "react";
import DefaultPreview from "./templatePreviews/DefaultPreview";
import NightfallPreview from "./templatePreviews/NightfallPreview";
import GridcraftPreview from "./templatePreviews/GridcraftPreview";
import SpotlightPreview from "./templatePreviews/SpotlightPreview";
import MatrixPreview from "./templatePreviews/MatrixPreview";
import WhiteboardPreview from "./templatePreviews/WhiteboardPreview";
import NewsPaperPreview from "./templatePreviews/NewsPaperPreview";
import NewscastPreview from "./templatePreviews/NewscastPreview";
import BlackswanPreview from "./templatePreviews/BlackswanPreview";
import MosaicPreview from "./templatePreviews/MosaicPreview";
import BloombergPreview from "./templatePreviews/BloombergPreview";
import ChroniclePreview from "./templatePreviews/ChroniclePreview";
import EconomistPreview from "./templatePreviews/EconomistPreview";

import Stickman2Preview from "./templatePreviews/Stickman2Preview";
/** Preview components keyed by built-in template id from the API. */
export const TEMPLATE_PREVIEWS: Record<string, FC<{ thumbnailMode?: boolean }>> = {
  default: DefaultPreview,
  nightfall: NightfallPreview,
  gridcraft: GridcraftPreview,
  spotlight: SpotlightPreview,
  matrix: MatrixPreview,
  whiteboard: WhiteboardPreview,
  newspaper: NewsPaperPreview,
  newscast: NewscastPreview,
  blackswan: BlackswanPreview,
  mosaic: MosaicPreview,
  bloomberg: BloombergPreview,
  chronicle: ChroniclePreview,
  economist: EconomistPreview,
  stickman_2: Stickman2Preview,
};

export const TEMPLATE_DESCRIPTIONS: Record<string, { title: string; subtitle: string }> = {
  default: { title: "Geometric Explainer", subtitle: "Clean purple & white, geometric tech style" },
  nightfall: { title: "Nightfall", subtitle: "Dark cinematic glass aesthetic" },
  gridcraft: { title: "Gridcraft", subtitle: "Warm bento editorial layouts" },
  spotlight: { title: "Spotlight", subtitle: "Bold kinetic typography on dark stage" },
  matrix: { title: "Matrix", subtitle: "Digital rain, terminal hacker aesthetic" },
  whiteboard: { title: "Stick Man", subtitle: "Hand-drawn storytelling with stick figures" },
  newspaper: { title: "Newspaper", subtitle: "Editorial news-style headlines, quotes & timelines" },
  newscast: {
    title: "Newscast",
    subtitle: "Broadcast news package — ticker, lower third, glass panels, and data beats",
  },
  blackswan: {
    title: "Black Swan",
    subtitle: "Neon-on-black cinematic ripples, swan energy, and data scenes",
  },
  mosaic: {
    title: "Mosaic",
    subtitle: "Tessellated tile layouts with elegant guide lines and data panels",
  },
  bloomberg: {
    title: "Bloomberg",
    subtitle: "Amber terminal-inspired finance dashboard with ticker and data views",
  }, 
  chronicle: {
    title: "Chronicle",
    subtitle: "Medieval tome — parchment pages, illuminated drop caps, and wax seals",
  },
  economist: {
    title: "The Economist",
    subtitle: "Editorial newspaper × economics — paper, red masthead, and reference-grade charts",
  },
  stickman_2: { title: "Stick Man 2: Night Edition", subtitle: "Glowing chalk stories under the night sky" },
};

/** Purple primary "New" chip when template meta.json has new_template: true */
export function NewTemplateBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide text-white bg-purple-600 shadow-[0_0_8px_rgba(124,58,237,0.45)] ring-1 ring-purple-400/70 ${className}`}
    >
      New
    </span>
  );
}

/** Amber "Popular" chip for templates marked popular_template: true */
export function PopularTemplateBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide text-white bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.45)] ring-1 ring-amber-400/70 ${className}`}
    >
      Popular
    </span>
  );
}

/** Same treatment as {@link NewTemplateBadge} — used on custom template thumbnails in pickers. */
export function CustomTemplateBadge({ className = "" }: { className?: string }) {
  return (
   <span
    className={`pointer-events-none px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide text-white bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.45)] ring-1 ring-green-400/70 ${className}`}
    >
      Custom
    </span>
  );
}
