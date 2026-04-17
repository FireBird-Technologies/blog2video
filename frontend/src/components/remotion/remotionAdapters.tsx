import React from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from "remotion";
import { LogoOverlay } from "./default/../LogoOverlay";
import {
  LAYOUT_REGISTRY as REMOTION_DEFAULT_LAYOUT_REGISTRY,
  type LayoutType as RemotionDefaultLayoutType,
  type SceneLayoutProps as RemotionDefaultSceneLayoutProps,
} from "@remotion-video/templates/default/layouts";
import {
  NIGHTFALL_LAYOUT_REGISTRY as REMOTION_NIGHTFALL_LAYOUT_REGISTRY,
  type NightfallLayoutType as RemotionNightfallLayoutType,
  type NightfallLayoutProps as RemotionNightfallLayoutProps,
} from "@remotion-video/templates/nightfall/layouts";
import {
  GRIDCRAFT_LAYOUT_REGISTRY as REMOTION_GRIDCRAFT_LAYOUT_REGISTRY,
} from "@remotion-video/templates/gridcraft/layouts";
import { Blobs } from "@remotion-video/templates/gridcraft/components/Blobs";
import { COLORS as GRIDCRAFT_COLORS } from "@remotion-video/templates/gridcraft/utils/styles";
import {
  SPOTLIGHT_LAYOUT_REGISTRY as REMOTION_SPOTLIGHT_LAYOUT_REGISTRY,
  type SpotlightLayoutType as RemotionSpotlightLayoutType,
  type SpotlightLayoutProps as RemotionSpotlightLayoutProps,
} from "@remotion-video/templates/spotlight/layouts";
import {
  MATRIX_LAYOUT_REGISTRY as REMOTION_MATRIX_LAYOUT_REGISTRY,
  type MatrixLayoutType as RemotionMatrixLayoutType,
  type MatrixLayoutProps as RemotionMatrixLayoutProps,
} from "@remotion-video/templates/matrix/layouts";
import {
  MOSAIC_LAYOUT_REGISTRY as REMOTION_MOSAIC_LAYOUT_REGISTRY,
  type MosaicLayoutType as RemotionMosaicLayoutType,
  type MosaicLayoutProps as RemotionMosaicLayoutProps,
} from "@remotion-video/templates/mosaic/layouts";
import {
  WHITEBOARD_LAYOUT_REGISTRY as REMOTION_WHITEBOARD_LAYOUT_REGISTRY,
  type WhiteboardLayoutType as RemotionWhiteboardLayoutType,
  type WhiteboardLayoutProps as RemotionWhiteboardLayoutProps,
} from "@remotion-video/templates/whiteboard/layouts";
import {
  NEWSPAPER_LAYOUT_REGISTRY as REMOTION_NEWSPAPER_LAYOUT_REGISTRY,
  type NewspaperLayoutType as RemotionNewspaperLayoutType,
  type BlogLayoutProps as RemotionNewspaperLayoutProps,
} from "@remotion-video/templates/newspaper/layouts";

import {
  NEWSCAST_LAYOUT_REGISTRY as REMOTION_NEWSCAST_LAYOUT_REGISTRY,
  type NewscastLayoutType as RemotionNewscastLayoutType,
  type NewscastLayoutProps as RemotionNewscastLayoutProps,
} from "@remotion-video/templates/newscast/layouts";
import {
  BLACKSWAN_LAYOUT_REGISTRY as REMOTION_BLACKSWAN_LAYOUT_REGISTRY,
  type BlackswanLayoutType as RemotionBlackswanLayoutType,
  type BlackswanLayoutProps as RemotionBlackswanLayoutProps,
} from "@remotion-video/templates/blackswan/layouts";
import {
  BLOOMBERG_LAYOUT_REGISTRY as REMOTION_BLOOMBERG_LAYOUT_REGISTRY,
  type BloombergLayoutType as RemotionBloombergLayoutType,
  type BloombergLayoutProps as RemotionBloombergLayoutProps,
} from "@remotion-video/templates/bloomberg/layouts";
import { NewsCastBackground } from "./newscast/NewsCastBackground";
import { NewsCastChrome } from "./newscast/NewsCastChrome";
import { NewscastSceneZTransition } from "./newscast/NewscastSceneZTransition";
import { NEWSCAST_BACKGROUND_VARIANT } from "./newscast/backgroundVariant";

const LEGACY_TO_NEWCAST_LAYOUT_ID: Record<string, RemotionNewscastLayoutType> = {
  opening: "opening",
  anchor_narrative: "anchor_narrative",
  live_metrics_board: "live_metrics_board",
  briefing_code_panel: "briefing_code_panel",
  headline_insight: "headline_insight",
  story_stack: "story_stack",
  side_by_side_brief: "side_by_side_brief",
  segment_break: "segment_break",
  field_image_focus: "field_image_focus",
  cinematic_title: "opening",
  glass_narrative: "anchor_narrative",
  glow_metric: "live_metrics_board",
  glass_code: "briefing_code_panel",
  kinetic_insight: "headline_insight",
  kinetix_insight: "headline_insight",
  glass_stack: "story_stack",
  split_glass: "side_by_side_brief",
  chapter_break: "segment_break",
  glass_image: "field_image_focus",
  newscast_cinematic_title: "opening",
  newscast_glass_narrative: "anchor_narrative",
  newscast_glow_metric: "live_metrics_board",
  newscast_glass_code: "briefing_code_panel",
  newscast_kinetic_insight: "headline_insight",
  newscast_glass_stack: "story_stack",
  newscast_split_glass: "side_by_side_brief",
  newscast_chapter_break: "segment_break",
  newscast_glass_image: "field_image_focus",
  data_visualization: "data_visualization",
  ending_socials: "ending_socials",
};

const normalizeNewscastLayoutId = (layout: string): RemotionNewscastLayoutType =>
  LEGACY_TO_NEWCAST_LAYOUT_ID[layout] ?? "anchor_narrative";

const NEWCAST_LAYOUT_TO_LEGACY_KEY: Record<RemotionNewscastLayoutType, string> = {
  opening: "cinematic_title",
  anchor_narrative: "glass_narrative",
  live_metrics_board: "glow_metric",
  briefing_code_panel: "glass_code",
  headline_insight: "kinetic_insight",
  story_stack: "glass_stack",
  side_by_side_brief: "split_glass",
  segment_break: "chapter_break",
  field_image_focus: "glass_image",
  data_visualization: "data_visualization",
  ending_socials: "ending_socials",
};

const toLegacyNewscastLayoutId = (layout: RemotionNewscastLayoutType): string =>
  NEWCAST_LAYOUT_TO_LEGACY_KEY[layout];

const RemotionNewscastSequenceInner: React.FC<{
  startFrame: number;
  durationInFrames: number;
  sceneIndex: number;
  isHero: boolean;
  layoutType: string;
  layoutProps: RemotionNewscastLayoutProps;
  LayoutComponent: React.ComponentType<RemotionNewscastLayoutProps>;
  voiceoverUrl?: string;
}> = ({
  startFrame,
  durationInFrames,
  sceneIndex,
  isHero,
  layoutType,
  layoutProps,
  LayoutComponent,
  voiceoverUrl,
}) => {
  const localFrame = useCurrentFrame();
  const rotationFrame = startFrame + localFrame;

  return (
    <AbsoluteFill>
      <NewscastSceneZTransition durationInFrames={durationInFrames} sceneIndex={sceneIndex} layoutType={layoutType}>
        <NewsCastBackground
          variant={NEWSCAST_BACKGROUND_VARIANT}
          globeOpacity={0.44}
          rotationFrame={rotationFrame}
          sceneFrame={localFrame}
          sceneDurationInFrames={durationInFrames}
          sceneLayoutType={layoutType}
          solidBackground
        />
        {!isHero ? (
          <NewsCastChrome
            tickerItems={layoutProps.tickerItems}
            lowerThirdTag={layoutProps.lowerThirdTag}
            lowerThirdHeadline={layoutProps.lowerThirdHeadline}
            lowerThirdSub={layoutProps.lowerThirdSub}
            aspectRatio={layoutProps.aspectRatio}
            accentColor={layoutProps.accentColor}
            textColor={layoutProps.textColor}
            descriptionFontSize={layoutProps.descriptionFontSize}
            fontFamily={layoutProps.fontFamily}
          />
        ) : null}
        <LayoutComponent {...layoutProps} />
      </NewscastSceneZTransition>
      {voiceoverUrl ? <Audio src={voiceoverUrl} /> : null}
    </AbsoluteFill>
  );
};
export interface RemotionDefaultSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: RemotionDefaultLayoutType;
  layoutProps: Record<string, any>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionDefaultVideoCompositionProps {
  scenes: RemotionDefaultSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionDefaultVideoComposition: React.FC<
  RemotionDefaultVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  const convertDefaultDataVizProps = (lp: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...lp };
    if (Array.isArray(out.barChartRows)) {
      const rows = out.barChartRows as { label?: string; value?: string }[];
      out.barChart = {
        labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
        values: rows.map((r) =>
          r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0,
        ),
      };
      delete out.barChartRows;
    }
    if (Array.isArray(out.histogramRows)) {
      const rows = out.histogramRows as { label?: string; value?: string }[];
      out.histogram = {
        labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
        values: rows.map((r) =>
          r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0,
        ),
      };
      delete out.histogramRows;
    }
    if (Array.isArray(out.lineChartLabels) && Array.isArray(out.lineChartDatasets)) {
      const labels = (out.lineChartLabels as string[]).map((l) => (l != null ? String(l) : ""));
      const datasets = (out.lineChartDatasets as { label?: string; valuesStr?: string }[]).map(
        (d) => ({
          label: (d && d.label != null ? String(d.label) : "") as string,
          values: (d && d.valuesStr != null ? String(d.valuesStr) : "")
            .split(",")
            .map((s) => Number(s.trim()) || 0),
        }),
      );
      out.lineChart = { labels, datasets };
      delete out.lineChartLabels;
      delete out.lineChartDatasets;
    }
    return out;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = Math.max(
          1,
          Math.round((Number(scene.durationSeconds) || 5) * FPS),
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          REMOTION_DEFAULT_LAYOUT_REGISTRY[scene.layout] ??
          REMOTION_DEFAULT_LAYOUT_REGISTRY.text_narration;

        const rawLayoutProps =
          scene.layout === "data_visualization"
            ? convertDefaultDataVizProps(scene.layoutProps as Record<string, unknown>)
            : scene.layoutProps;

        const layoutProps: RemotionDefaultSceneLayoutProps = {
          ...(rawLayoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor,
          bgColor,
          textColor,
          aspectRatio,
          fontFamily,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

export interface RemotionNightfallSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: RemotionNightfallLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionNightfallVideoCompositionProps {
  scenes: RemotionNightfallSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionNightfallVideoComposition: React.FC<
  RemotionNightfallVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  const convertDataVizProps = (lp: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...lp };
    if (Array.isArray(out.barChartRows)) {
      const rows = out.barChartRows as { label?: string; value?: string }[];
      out.barChart = {
        labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
        values: rows.map((r) =>
          r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0,
        ),
      };
      delete out.barChartRows;
    }
    if (Array.isArray(out.pieChartRows)) {
      const rows = out.pieChartRows as { label?: string; value?: string }[];
      out.pieChart = {
        labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
        values: rows.map((r) =>
          r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0,
        ),
      };
      delete out.pieChartRows;
    }
    if (Array.isArray(out.lineChartLabels) && Array.isArray(out.lineChartDatasets)) {
      const labels = (out.lineChartLabels as string[]).map((l) =>
        l != null ? String(l) : "",
      );
      const datasets = (out.lineChartDatasets as { label?: string; valuesStr?: string }[]).map(
        (d) => ({
          label: (d && d.label != null ? String(d.label) : "") as string,
          values: (d && d.valuesStr != null ? String(d.valuesStr) : "")
            .split(",")
            .map((s) => Number(s.trim()) || 0),
        }),
      );
      out.lineChart = { labels, datasets };
      delete out.lineChartLabels;
      delete out.lineChartDatasets;
    }
    return out;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#0A0A1A", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          REMOTION_NIGHTFALL_LAYOUT_REGISTRY[scene.layout] ??
          REMOTION_NIGHTFALL_LAYOUT_REGISTRY.glass_narrative;

        const rawLayoutProps =
          scene.layout === "data_visualization"
            ? convertDataVizProps(scene.layoutProps as Record<string, unknown>)
            : scene.layoutProps;

        const layoutProps: RemotionNightfallLayoutProps = {
          ...(rawLayoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#818CF8",
          bgColor: bgColor || "#0A0A1A",
          textColor: textColor || "#E2E8F0",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
          fontFamily,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

export interface RemotionGridcraftSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionGridcraftVideoCompositionProps {
  scenes: RemotionGridcraftSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionGridcraftVideoComposition: React.FC<
  RemotionGridcraftVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor || GRIDCRAFT_COLORS.BG,
        fontFamily,
      }}
    >
      <Blobs />
      {scenes.map((scene, index) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          REMOTION_GRIDCRAFT_LAYOUT_REGISTRY[scene.layout] ??
          REMOTION_GRIDCRAFT_LAYOUT_REGISTRY.editorial_body;

        const layoutProps: Record<string, unknown> = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || GRIDCRAFT_COLORS.ACCENT,
          bgColor: bgColor || GRIDCRAFT_COLORS.BG,
          textColor: textColor || GRIDCRAFT_COLORS.DARK,
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
          fontFamily,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <AbsoluteFill style={{ zIndex: 1 }}>
              <LayoutComponent {...layoutProps} />
            </AbsoluteFill>
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
            {index < scenes.length - 1 && (
              <Sequence from={durationFrames - 15} durationInFrames={15}>
                <AbsoluteFill
                  style={{
                    backgroundColor: bgColor || GRIDCRAFT_COLORS.BG,
                    opacity: 0.9,
                  }}
                />
              </Sequence>
            )}
          </Sequence>
        );
      })}

      {logo && (
        <AbsoluteFill style={{ zIndex: 20, pointerEvents: "none" }}>
          <LogoOverlay
            src={logo}
            position={logoPosition || "bottom_right"}
            maxOpacity={logoOpacity ?? 0.9}
            size={logoSize ?? 100}
            aspectRatio={aspectRatio || "landscape"}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export interface RemotionSpotlightSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: RemotionSpotlightLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionSpotlightVideoCompositionProps {
  scenes: RemotionSpotlightSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionSpotlightVideoComposition: React.FC<
  RemotionSpotlightVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          REMOTION_SPOTLIGHT_LAYOUT_REGISTRY[scene.layout] ??
          REMOTION_SPOTLIGHT_LAYOUT_REGISTRY.statement;

        const layoutProps: RemotionSpotlightLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#EF4444",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#FFFFFF",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
          fontFamily,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

export interface RemotionMatrixSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: RemotionMatrixLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionBlackswanSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: RemotionBlackswanLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionBlackswanVideoCompositionProps {
  scenes: RemotionBlackswanSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionBlackswanVideoComposition: React.FC<
  RemotionBlackswanVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          REMOTION_BLACKSWAN_LAYOUT_REGISTRY[scene.layout] ??
          REMOTION_BLACKSWAN_LAYOUT_REGISTRY.neon_narrative;

        const layoutProps: RemotionBlackswanLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#00E5FF",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#DFFFFF",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
          layoutType: scene.layout,
          fontFamily,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

export interface RemotionMatrixVideoCompositionProps {
  scenes: RemotionMatrixSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionMatrixVideoComposition: React.FC<
  RemotionMatrixVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          REMOTION_MATRIX_LAYOUT_REGISTRY[scene.layout] ??
          REMOTION_MATRIX_LAYOUT_REGISTRY.terminal_text;

        const layoutProps: RemotionMatrixLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#00FF41",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#00FF41",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
          fontFamily,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

export interface RemotionMosaicSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: RemotionMosaicLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionMosaicVideoCompositionProps {
  scenes: RemotionMosaicSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionMosaicVideoComposition: React.FC<
  RemotionMosaicVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#0F1E2D", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = Math.max(1, Math.round(scene.durationSeconds * FPS));
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          REMOTION_MOSAIC_LAYOUT_REGISTRY[scene.layout] ??
          REMOTION_MOSAIC_LAYOUT_REGISTRY.mosaic_text;

        const layoutProps: RemotionMosaicLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#D4AF37",
          bgColor: bgColor || "#0F1E2D",
          textColor: textColor || "#E6EEF7",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
          fontFamily,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

export interface RemotionWhiteboardSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: RemotionWhiteboardLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionWhiteboardVideoCompositionProps {
  scenes: RemotionWhiteboardSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionWhiteboardVideoComposition: React.FC<
  RemotionWhiteboardVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#F7F3E8", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = Math.max(1, Math.round(scene.durationSeconds * FPS));
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          REMOTION_WHITEBOARD_LAYOUT_REGISTRY[scene.layout] ??
          REMOTION_WHITEBOARD_LAYOUT_REGISTRY.marker_story;

        const layoutProps: RemotionWhiteboardLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor: accentColor || "#1F2937",
          bgColor: bgColor || "#F7F3E8",
          textColor: textColor || "#111827",
          aspectRatio: aspectRatio || "landscape",
          fontFamily,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

export interface RemotionNewspaperSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: RemotionNewspaperLayoutType | string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionNewspaperVideoCompositionProps {
  scenes: RemotionNewspaperSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionNewspaperVideoComposition: React.FC<
  RemotionNewspaperVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAF8", fontFamily }}>
      {scenes.map((scene, index) => {
        const startFrame = scenes
          .slice(0, index)
          .reduce(
            (acc, s) =>
              acc +
              Math.max(1, Math.round((s.durationSeconds || 5) * FPS)),
            0,
          );

        const durationFrames = Math.max(
          1,
          Math.round((scene.durationSeconds || 5) * FPS),
        );

        const LayoutComponent =
          REMOTION_NEWSPAPER_LAYOUT_REGISTRY[
            scene.layout as RemotionNewspaperLayoutType
          ] ?? REMOTION_NEWSPAPER_LAYOUT_REGISTRY.article_lead;

        const layoutProps: RemotionNewspaperLayoutProps = {
          ...(scene.layoutProps as Partial<RemotionNewspaperLayoutProps>),
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor: accentColor || "#FFE34D",
          bgColor: bgColor || "#FAFAF8",
          textColor: textColor || "#111111",
          aspectRatio:
            (aspectRatio as "landscape" | "portrait") || "landscape",
          fontFamily,
        };

        return (
          <Sequence
            key={`${scene.id}-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <AbsoluteFill>
              <LayoutComponent {...layoutProps} />
              {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

export interface RemotionNewscastSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: RemotionNewscastLayoutType | string;
  layoutProps: Record<string, unknown>;
  layoutConfig?: { titleFontSize?: number; descriptionFontSize?: number };
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionNewscastVideoCompositionProps {
  scenes: RemotionNewscastSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionNewscastVideoComposition: React.FC<
  RemotionNewscastVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
  const sceneFrameOffsets = React.useMemo(() => {
    const offsets = new Array<number>(scenes.length);
    let acc = 0;
    for (let i = 0; i < scenes.length; i += 1) {
      offsets[i] = acc;
      acc += Math.max(1, Math.round((scenes[i].durationSeconds || 5) * FPS));
    }
    return offsets;
  }, [scenes]);
  const normalizeNewscastDataVizProps = (
    lp: Partial<RemotionNewscastLayoutProps>,
  ): Partial<RemotionNewscastLayoutProps> => {
    const out: Record<string, unknown> = { ...lp };

    if (typeof out.chartType === "string") {
      out.chartType = String(out.chartType).trim().toLowerCase();
    }

    // Allow nested chart object from legacy descriptors.
    const legacyChart = out.chart as
      | {
          type?: string;
          labels?: unknown[];
          datasets?: Array<{ label?: unknown; values?: unknown[] | string }>;
          rows?: Array<{ label?: unknown; value?: unknown }>;
        }
      | undefined;
    if (legacyChart && typeof legacyChart === "object") {
      if (!out.chartType && legacyChart.type) out.chartType = String(legacyChart.type);
      if (!out.lineChartLabels && Array.isArray(legacyChart.labels)) {
        out.lineChartLabels = legacyChart.labels.map((v) => String(v ?? ""));
      }
      if (!out.lineChartDatasets && Array.isArray(legacyChart.datasets)) {
        out.lineChartDatasets = legacyChart.datasets.map((dataset) => ({
          label: String(dataset?.label ?? ""),
          valuesStr: Array.isArray(dataset?.values)
            ? dataset.values.map((v) => String(v ?? "")).join(",")
            : String(dataset?.values ?? ""),
        }));
      }
      if (!out.barChartRows && Array.isArray(legacyChart.rows)) {
        out.barChartRows = legacyChart.rows.map((row) => ({
          label: String(row?.label ?? ""),
          value: String(row?.value ?? ""),
        }));
      }
    }

    // Backward-compat support for nested table shape
    const legacyTable = out.table as
      | { headers?: unknown[]; rows?: unknown[][] }
      | undefined;
    if (!out.chartTable && legacyTable && typeof legacyTable === "object") {
      out.chartTable = {
        headers: Array.isArray(legacyTable.headers)
          ? legacyTable.headers.map((h) => String(h ?? ""))
          : [],
        rows: Array.isArray(legacyTable.rows)
          ? legacyTable.rows.map((row) =>
              Array.isArray(row) ? row.map((cell) => (cell == null ? "" : (cell as string | number))) : [],
            )
          : [],
      };
    }

    return out as Partial<RemotionNewscastLayoutProps>;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAF8", fontFamily }}>
      {scenes.map((scene, index) => {
        const normalizedLayout = normalizeNewscastLayoutId(scene.layout);
        const legacyLayout = toLegacyNewscastLayoutId(normalizedLayout);
        const startFrame = sceneFrameOffsets[index] ?? 0;

        const durationFrames = Math.max(
          1,
          Math.round((scene.durationSeconds || 5) * FPS),
        );

        const LayoutComponent =
          REMOTION_NEWSCAST_LAYOUT_REGISTRY[
            normalizedLayout as RemotionNewscastLayoutType
          ] ?? REMOTION_NEWSCAST_LAYOUT_REGISTRY.anchor_narrative;

        const lc = scene.layoutConfig;
        const baseLp = scene.layoutProps as Partial<RemotionNewscastLayoutProps>;
        const lp =
          normalizedLayout === "data_visualization"
            ? normalizeNewscastDataVizProps(baseLp)
            : baseLp;
        const layoutProps: RemotionNewscastLayoutProps = {
          ...lp,
          titleFontSize: lp.titleFontSize ?? lc?.titleFontSize,
          descriptionFontSize: lp.descriptionFontSize ?? lc?.descriptionFontSize,
          title: scene.title,
          narration: scene.narration,
          // Prefer top-level scene image; fall back to layoutProps.imageUrl (editor / JSON often set it only on layoutProps).
          imageUrl: scene.imageUrl ?? lp.imageUrl,
          accentColor: accentColor || "#FF3B30",
          bgColor: bgColor || "#FAFAF8",
          textColor: textColor || "#111111",
          aspectRatio:
            (aspectRatio as "landscape" | "portrait") || "landscape",
          fontFamily,
          globeRotationFrameOffset: startFrame,
        };

        const layoutType = legacyLayout;
        const isHero = normalizedLayout === "opening";

        return (
          <Sequence
            key={`${scene.id}-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <RemotionNewscastSequenceInner
              startFrame={startFrame}
              durationInFrames={durationFrames}
              sceneIndex={index}
              isHero={isHero}
              layoutType={layoutType}
              layoutProps={layoutProps}
              LayoutComponent={LayoutComponent}
              voiceoverUrl={scene.voiceoverUrl}
            />
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

// ─── Bloomberg ────────────────────────────────────────────────────────────────

export interface RemotionBloombergSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: RemotionBloombergLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionBloombergVideoCompositionProps {
  scenes: RemotionBloombergSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const RemotionBloombergVideoComposition: React.FC<
  RemotionBloombergVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          REMOTION_BLOOMBERG_LAYOUT_REGISTRY[scene.layout] ??
          REMOTION_BLOOMBERG_LAYOUT_REGISTRY.terminal_narrative;

        const layoutProps: RemotionBloombergLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#5EA2FF",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#FFB340",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
          layoutType: scene.layout,
          fontFamily,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};
