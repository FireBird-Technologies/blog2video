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
    aspectRatio?: string;
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
};

const DEFAULT_CONFIG = TEMPLATE_REGISTRY.default;

export function getTemplateConfig(templateId: string | undefined): TemplateConfig {
  const id = (templateId || "default").trim().toLowerCase();
  return TEMPLATE_REGISTRY[id] ?? DEFAULT_CONFIG;
}
