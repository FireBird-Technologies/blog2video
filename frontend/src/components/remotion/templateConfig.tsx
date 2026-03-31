/**
 * Central template configuration for VideoPreview.
 * Add new templates here; no changes needed in VideoPreview.
 *
 * To add a template:
 * 1. Create your composition (e.g. src/components/remotion/myTemplate/MyVideoComposition.tsx)
 * 2. Add an entry to TEMPLATE_REGISTRY with: component, heroLayout, fallbackLayout,
 *    validLayouts (Set of layout IDs), and defaultColors.
 */

import { DefaultVideoComposition } from "./default/DefaultVideoComposition";
import { NightfallVideoComposition } from "./nightfall/NightfallVideoComposition";
import { GridcraftVideoComposition } from "./gridcraft/GridcraftVideoComposition";
import { SpotlightVideoComposition } from "./spotlight/SpotlightVideoComposition";
import { MatrixVideoComposition } from "./matrix/MatrixVideoComposition";
import { WhiteboardVideoComposition } from "./whiteboard/WhiteboardVideoComposition";
import { NewspaperVideoComposition } from "./newspaper/NewspaperVideoComposition";
import {
  RemotionDefaultVideoComposition,
  RemotionGridcraftVideoComposition,
  RemotionMatrixVideoComposition,
  RemotionNewspaperVideoComposition,
  RemotionNightfallVideoComposition,
  RemotionSpotlightVideoComposition,
  RemotionWhiteboardVideoComposition,
} from "./remotionAdapters";

export interface TemplateColors {
  accent: string;
  bg: string;
  text: string;
}

export interface TemplateConfig {
  /** Remotion composition component */
  component: React.ComponentType<{
    scenes: Array<{
      id: number;
      order: number;
      title: string;
      narration: string;
      layout: string;
      layoutProps: Record<string, unknown>;
      durationSeconds: number;
      imageUrl?: string;
      voiceoverUrl?: string;
    }>;
    accentColor: string;
    bgColor: string;
    textColor: string;
    logo?: string | null;
    logoPosition?: string;
    logoOpacity?: number;
    logoSize?: number;
    aspectRatio?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    theme?: any;
  }>;
  /** Layout for scene 0 (hero) when no remotion_code */
  heroLayout: string;
  /** Fallback layout when descriptor is invalid or layout not in validLayouts */
  fallbackLayout: string;
  /** Valid layout IDs; layout from remotion_code must be in this set */
  validLayouts: ReadonlySet<string>;
  /** Default colors when project has no overrides */
  defaultColors: TemplateColors;
  /** Base canvas resolution for this template in landscape (width x height). Portrait swaps these. */
  baseWidth: number;
  baseHeight: number;
}

const DEFAULT_LAYOUTS = new Set([
  "hero_image",
  "text_narration",
  "code_block",
  "bullet_list",
  "flow_diagram",
  "comparison",
  "metric",
  "quote_callout",
  "image_caption",
  "timeline",
  "data_visualization",
  "ending_socials",
]);

const NIGHTFALL_LAYOUTS = new Set([
  "cinematic_title",
  "glass_narrative",
  "glow_metric",
  "glass_code",
  "kinetic_insight",
  "glass_stack",
  "split_glass",
  "chapter_break",
  "glass_image",
  "data_visualization",
  "ending_socials",
]);

const GRIDCRAFT_LAYOUTS = new Set([
  "bento_hero",
  "bento_features",
  "bento_highlight",
  "editorial_body",
  "kpi_grid",
  "bento_compare",
  "bento_code",
  "pull_quote",
  "bento_steps",
  "ending_socials",
]);

const SPOTLIGHT_LAYOUTS = new Set([
  "impact_title",
  "statement",
  "word_punch",
  "cascade_list",
  "stat_stage",
  "versus",
  "spotlight_image",
  "rapid_points",
  "closer",
  "ending_socials",
]);

const MATRIX_LAYOUTS = new Set([
  "matrix_title",
  "terminal_text",
  "glitch_punch",
  "data_stream",
  "cipher_metric",
  "fork_choice",
  "matrix_image",
  "transmission",
  "awakening",
  "ending_socials",
]);

const WHITEBOARD_LAYOUTS = new Set([
  "drawn_title",
  "marker_story",
  "stick_figure_scene",
  "stats_figures",
  "stats_chart",
  "comparison",
  "countdown_timer",
  "handwritten_equation",
  "speech_bubble_dialogue",
  "ending_socials",
]);

const NEWSPAPER_LAYOUTS = new Set([
  "news_headline",
  "article_lead",
  "pull_quote",
  "data_snapshot",
  "fact_check",
  "news_timeline",
  "ending_socials",
]);
export const TEMPLATE_REGISTRY: Record<string, TemplateConfig> = {
  default: {
    component: DefaultVideoComposition as React.ComponentType<any>,
    heroLayout: "hero_image",
    fallbackLayout: "text_narration",
    validLayouts: DEFAULT_LAYOUTS,
    defaultColors: {
      accent: "#7C3AED",
      bg: "#FFFFFF",
      text: "#000000",
    },
    baseWidth: 1920,
    baseHeight: 1080,
  },
  nightfall: {
    component: NightfallVideoComposition as React.ComponentType<any>,
    heroLayout: "cinematic_title",
    fallbackLayout: "glass_narrative",
    validLayouts: NIGHTFALL_LAYOUTS,
    defaultColors: {
      accent: "#818CF8",
      bg: "#0A0A1A",
      text: "#E2E8F0",
    },
    baseWidth: 1920,
    baseHeight: 1080,
  },
  gridcraft: {
    component: GridcraftVideoComposition as React.ComponentType<any>,
    heroLayout: "bento_hero",
    fallbackLayout: "editorial_body",
    validLayouts: GRIDCRAFT_LAYOUTS,
    defaultColors: {
      accent: "#F97316",
      bg: "#FAFAFA",
      text: "#171717",
    },
    baseWidth: 1920,
    baseHeight: 1080,
  },
  spotlight: {
    component: SpotlightVideoComposition as React.ComponentType<any>,
    heroLayout: "impact_title",
    fallbackLayout: "statement",
    validLayouts: SPOTLIGHT_LAYOUTS,
    defaultColors: {
      accent: "#EF4444",
      bg: "#000000",
      text: "#FFFFFF",
    },
    baseWidth: 1920,
    baseHeight: 1080,
  },
  matrix: {
    component: MatrixVideoComposition as React.ComponentType<any>,
    heroLayout: "matrix_title",
    fallbackLayout: "terminal_text",
    validLayouts: MATRIX_LAYOUTS,
    defaultColors: {
      accent: "#00FF41",
      bg: "#000000",
      text: "#00FF41",
    },
    baseWidth: 1920,
    baseHeight: 1080,
  },
  whiteboard: {
    component: WhiteboardVideoComposition as React.ComponentType<any>,
    heroLayout: "drawn_title",
    fallbackLayout: "marker_story",
    validLayouts: WHITEBOARD_LAYOUTS,
    defaultColors: {
      accent: "#1F2937",
      bg: "#F7F3E8",
      text: "#111827",
    },
    baseWidth: 1280,
    baseHeight: 720,
  },
  newspaper: {
    component: NewspaperVideoComposition as React.ComponentType<any>,
    heroLayout: "news_headline",
    fallbackLayout: "article_lead",
    validLayouts: NEWSPAPER_LAYOUTS,
    defaultColors: {
      accent: "#FFE34D",
      bg: "#FAFAF8",
      text: "#111111",
    },
    baseWidth: 1280,
    baseHeight: 720,
  },
};

const DEFAULT_CONFIG = TEMPLATE_REGISTRY.default;

type TemplateSource = "frontend" | "remotion";

export function getTemplateConfig(
  templateId: string | undefined,
  source: TemplateSource = "frontend",
): TemplateConfig {
  const id = (templateId || "default").trim().toLowerCase();

  const base = TEMPLATE_REGISTRY[id] ?? DEFAULT_CONFIG;

  if (source === "remotion") {
    const overrideComponent =
      id === "default"
        ? RemotionDefaultVideoComposition
        : id === "nightfall"
          ? RemotionNightfallVideoComposition
          : id === "gridcraft"
            ? RemotionGridcraftVideoComposition
            : id === "spotlight"
              ? RemotionSpotlightVideoComposition
              : id === "matrix"
                ? RemotionMatrixVideoComposition
                : id === "whiteboard"
                  ? RemotionWhiteboardVideoComposition
                  : id === "newspaper"
                    ? RemotionNewspaperVideoComposition
                    : null;

    if (overrideComponent) {
      return {
        ...base,
        component: overrideComponent as React.ComponentType<any>,
      };
    }
  }

  return base;
}
