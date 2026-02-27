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
import { CustomVideoComposition } from "./custom/CustomVideoComposition";

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
]);

const NEWSPAPER_LAYOUTS = new Set([
  "news_headline",
  "article_lead",
  "pull_quote",
  "data_snapshot",
  "fact_check",
  "news_timeline",
]);
const CUSTOM_ARRANGEMENTS = new Set([
  "full-center",
  "split-left",
  "split-right",
  "top-bottom",
  "grid-2x2",
  "grid-3",
  "asymmetric-left",
  "asymmetric-right",
  "stacked",
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
  },
  custom: {
    component: CustomVideoComposition as React.ComponentType<any>,
    heroLayout: "full-center",
    fallbackLayout: "full-center",
    validLayouts: CUSTOM_ARRANGEMENTS,
    defaultColors: {
      accent: "#7C3AED",
      bg: "#FFFFFF",
      text: "#1A1A2E",
    },
  },
};

const DEFAULT_CONFIG = TEMPLATE_REGISTRY.default;

export function getTemplateConfig(templateId: string | undefined): TemplateConfig {
  const id = (templateId || "default").trim().toLowerCase();
  // Route "custom_42", "custom_123" etc. to the custom template config
  if (id.startsWith("custom_")) {
    return TEMPLATE_REGISTRY.custom;
  }
  return TEMPLATE_REGISTRY[id] ?? DEFAULT_CONFIG;
}
