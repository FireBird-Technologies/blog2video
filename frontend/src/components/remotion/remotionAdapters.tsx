import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
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
import { NewsCastBackground } from "./newscast/NewsCastBackground";
import { NewsCastChrome } from "./newscast/NewsCastChrome";
import { NewscastSceneZTransition } from "./newscast/NewscastSceneZTransition";

const TRANS_IN_SEC = 0.52;

const RemotionNewscastSequenceInner: React.FC<{
  startFrame: number;
  durationInFrames: number;
  sceneIndex: number;
  isHero: boolean;
  layoutType: RemotionNewscastLayoutType;
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
  const { fps } = useVideoConfig();
  const rotationFrame = startFrame + localFrame;

  // Entrance motion window matches the timing used by `NewscastSceneZTransition`.
  const capHalf = Math.max(1, Math.floor(durationInFrames / 2));
  const transInFrames = Math.min(
    Math.round(TRANS_IN_SEC * fps),
    Math.max(3, Math.floor(durationInFrames * 0.26)),
    capHalf,
  );
  const entryT = interpolate(localFrame, [0, transInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const globeTranslateX =
    !isHero && layoutType === "glass_narrative"
      ? entryT * -220
      : !isHero && layoutType === "kinetic_insight"
        ? Math.sin(entryT * Math.PI) * -110 + entryT * -210
      : !isHero && layoutType === "glass_image"
        ? Math.sin(entryT * Math.PI) * -64 + entryT * -290
      : !isHero && layoutType === "glass_code"
        ? entryT * -240
      : !isHero && layoutType === "glow_metric"
      ? entryT * -260
      : !isHero && layoutType === "chapter_break"
        ? entryT * -300
      : !isHero && layoutType === "glass_stack"
        ? entryT * -90
        : 0;
  const globeTranslateY =
    !isHero && layoutType === "glass_narrative"
      ? entryT * -26
      : !isHero && layoutType === "kinetic_insight"
        ? Math.sin(entryT * Math.PI) * -62 + entryT * 24
      : !isHero && layoutType === "glass_image"
        ? Math.sin(entryT * Math.PI) * -66 + entryT * 104
      : !isHero && layoutType === "glass_code"
        ? Math.sin(entryT * Math.PI) * -34 + entryT * 12
      : !isHero && layoutType === "glow_metric"
      ? Math.sin(entryT * Math.PI) * -52 + entryT * 20
      : !isHero && layoutType === "chapter_break"
        ? Math.sin(entryT * Math.PI) * -72 + entryT * 28
      : !isHero && layoutType === "glass_stack"
        ? entryT * 16
        : 0;
  const glassStackGlobeT = Math.pow(entryT, 1.5);
  const chapterGlobeT = Math.pow(entryT, 1.9);
  const finalGlobeTranslateX =
    !isHero && layoutType === "chapter_break"
      ? chapterGlobeT * -300
      : !isHero && layoutType === "glass_stack"
        ? Math.sin(glassStackGlobeT * Math.PI) * -74 + glassStackGlobeT * -100
        : globeTranslateX;
  const finalGlobeTranslateY =
    !isHero && layoutType === "chapter_break"
      ? Math.sin(chapterGlobeT * Math.PI) * -72 + chapterGlobeT * 28
      : !isHero && layoutType === "glass_stack"
        ? Math.sin(glassStackGlobeT * Math.PI) * -48 + glassStackGlobeT * 22
      : globeTranslateY;

  return (
    <AbsoluteFill>
      <NewscastSceneZTransition durationInFrames={durationInFrames} sceneIndex={sceneIndex} layoutType={layoutType}>
        {!isHero ? (
          <NewsCastBackground
            variant="hero"
            globeOpacity={0.44}
            globePosition="right"
            rotationFrame={rotationFrame}
            globeTranslateX={finalGlobeTranslateX}
            globeTranslateY={finalGlobeTranslateY}
          />
        ) : null}
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
    <AbsoluteFill style={{ backgroundColor: bgColor || "#0b0b10", fontFamily }}>
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
          accentColor: accentColor || textColor,
          bgColor: bgColor,
          textColor,
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
            <AbsoluteFill>
              <LayoutComponent {...layoutProps} />
            </AbsoluteFill>
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
            {index < scenes.length - 1 && (
              <Sequence from={durationFrames - 15} durationInFrames={15}>
                <AbsoluteFill
                  style={{
                    backgroundColor: bgColor,
                    opacity: 0.9,
                  }}
                />
              </Sequence>
            )}
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

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAF8", fontFamily }}>
      {scenes.map((scene, index) => {
        const normalizedLayout =
          scene.layout === "kinetix_insight" ? "kinetic_insight" : scene.layout;
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
          REMOTION_NEWSCAST_LAYOUT_REGISTRY[
            normalizedLayout as RemotionNewscastLayoutType
          ] ?? REMOTION_NEWSCAST_LAYOUT_REGISTRY.glass_narrative;

        const lc = scene.layoutConfig;
        const lp = scene.layoutProps as Partial<RemotionNewscastLayoutProps>;
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

        const layoutType = normalizedLayout as RemotionNewscastLayoutType;
        const isHero = layoutType === "cinematic_title";

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


