import { AbsoluteFill, Audio, Sequence } from "remotion";
import { LogoOverlay } from "./default/../LogoOverlay";
import {
  LAYOUT_REGISTRY as REMOTION_DEFAULT_LAYOUT_REGISTRY,
  type LayoutType as RemotionDefaultLayoutType,
  type SceneLayoutProps as RemotionDefaultSceneLayoutProps,
} from "../../../../remotion-video/src/templates/default/layouts";
import {
  NIGHTFALL_LAYOUT_REGISTRY as REMOTION_NIGHTFALL_LAYOUT_REGISTRY,
  type NightfallLayoutType as RemotionNightfallLayoutType,
  type NightfallLayoutProps as RemotionNightfallLayoutProps,
} from "../../../../remotion-video/src/templates/nightfall/layouts";
import {
  GRIDCRAFT_LAYOUT_REGISTRY as REMOTION_GRIDCRAFT_LAYOUT_REGISTRY,
} from "../../../../remotion-video/src/templates/gridcraft/layouts";
import {
  SPOTLIGHT_LAYOUT_REGISTRY as REMOTION_SPOTLIGHT_LAYOUT_REGISTRY,
  type SpotlightLayoutType as RemotionSpotlightLayoutType,
  type SpotlightLayoutProps as RemotionSpotlightLayoutProps,
} from "../../../../remotion-video/src/templates/spotlight/layouts";
import {
  MATRIX_LAYOUT_REGISTRY as REMOTION_MATRIX_LAYOUT_REGISTRY,
  type MatrixLayoutType as RemotionMatrixLayoutType,
  type MatrixLayoutProps as RemotionMatrixLayoutProps,
} from "../../../../remotion-video/src/templates/matrix/layouts";
import {
  WHITEBOARD_LAYOUT_REGISTRY as REMOTION_WHITEBOARD_LAYOUT_REGISTRY,
  type WhiteboardLayoutType as RemotionWhiteboardLayoutType,
  type WhiteboardLayoutProps as RemotionWhiteboardLayoutProps,
} from "../../../../remotion-video/src/templates/whiteboard/layouts";
import {
  NEWSPAPER_LAYOUT_REGISTRY as REMOTION_NEWSPAPER_LAYOUT_REGISTRY,
  type NewspaperLayoutType as RemotionNewspaperLayoutType,
  type BlogLayoutProps as RemotionNewspaperLayoutProps,
} from "../../../../remotion-video/src/templates/newspaper/layouts";
import { UniversalScene } from "../../../../remotion-video/src/templates/custom/UniversalScene";
import type { CustomTheme, SceneLayoutConfig } from "../../../../remotion-video/src/templates/custom/types";

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

        const layoutProps: RemotionDefaultSceneLayoutProps = {
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor,
          bgColor,
          textColor,
          aspectRatio,
          fontFamily,
          ...scene.layoutProps,
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

export interface RemotionCustomSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: {
    layoutConfig?: SceneLayoutConfig;
    theme?: CustomTheme;
    [key: string]: unknown;
  };
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface RemotionCustomVideoCompositionProps {
  scenes: RemotionCustomSceneInput[];
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

export const RemotionCustomVideoComposition: React.FC<
  RemotionCustomVideoCompositionProps
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

  const baseTheme: CustomTheme = {
    colors: {
      accent: accentColor,
      bg: bgColor,
      text: textColor,
      surface: "#F5F5F5",
      muted: "#9CA3AF",
    },
    fonts: { heading: fontFamily || "Inter", body: fontFamily || "Inter", mono: "JetBrains Mono" },
    borderRadius: 12,
    style: "minimal",
    animationPreset: "slide",
    category: "general",
    patterns: {
      cards: { corners: "rounded", shadowDepth: "subtle", borderStyle: "thin" },
      spacing: { density: "balanced", gridGap: 20 },
      images: { treatment: "rounded", overlay: "none", captionStyle: "below" },
      layout: { direction: "centered", decorativeElements: ["none"] },
    },
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        fontFamily,
      }}
    >
      {scenes.map((scene) => {
        const durationFrames = Math.max(
          1,
          Math.round((scene.durationSeconds || 5) * FPS),
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const cfg = scene.layoutProps.layoutConfig;
        const sceneTheme = scene.layoutProps.theme || baseTheme;

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <UniversalScene
              config={
                cfg || {
                  arrangement: "full-center",
                  elements: [
                    {
                      type: "heading",
                      content: {},
                      emphasis: "primary",
                    },
                    {
                      type: "body-text",
                      content: {},
                      emphasis: "secondary",
                    },
                  ],
                  decorations: ["accent-bar-bottom"],
                }
              }
              theme={sceneTheme}
              title={scene.title}
              narration={scene.narration}
              imageUrl={scene.imageUrl}
              aspectRatio={aspectRatio || "landscape"}
              fontFamily={fontFamily}
            />
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


