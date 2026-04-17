import "../../../fonts/nightfall-defaults";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { NIGHTFALL_LAYOUT_REGISTRY } from "./layouts";
import type { NightfallLayoutType, NightfallLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

/** Convert schema format (barChartRows, etc.) to component format (barChart, etc.) for data_visualization */
function convertDataVizProps(lp: Record<string, unknown>): Record<string, unknown> {
  const out = { ...lp };
  if (Array.isArray(out.barChartRows)) {
    const rows = out.barChartRows as { label?: string; value?: string }[];
    out.barChart = {
      labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
      values: rows.map((r) => (r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0)),
    };
    delete out.barChartRows;
  }
  if (Array.isArray(out.pieChartRows)) {
    const rows = out.pieChartRows as { label?: string; value?: string }[];
    out.pieChart = {
      labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
      values: rows.map((r) => (r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0)),
    };
    delete out.pieChartRows;
  }
  if (Array.isArray(out.lineChartLabels) && Array.isArray(out.lineChartDatasets)) {
    const labels = (out.lineChartLabels as string[]).map((l) => (l != null ? String(l) : ""));
    const datasets = (out.lineChartDatasets as { label?: string; valuesStr?: string }[]).map((d) => ({
      label: (d && d.label != null ? String(d.label) : "") as string,
      values: (d && d.valuesStr != null ? String(d.valuesStr) : "")
        .split(",")
        .map((s) => Number(s.trim()) || 0),
    }));
    out.lineChart = { labels, datasets };
    delete out.lineChartLabels;
    delete out.lineChartDatasets;
  }
  return out;
}

export interface NightfallSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: NightfallLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface NightfallVideoCompositionProps {
  scenes: NightfallSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  bgmUrl?: string | null;
  bgmVolume?: number;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
}

export const NightfallVideoComposition: React.FC<
  NightfallVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  bgmUrl,
  bgmVolume,
  aspectRatio,
  fontFamily,
  playbackSpeed,
}) => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#0A0A1A", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          resolvedPlaybackSpeed,
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          NIGHTFALL_LAYOUT_REGISTRY[scene.layout] ||
          NIGHTFALL_LAYOUT_REGISTRY.glass_narrative;

        const rawLayoutProps = scene.layout === "data_visualization"
          ? convertDataVizProps(scene.layoutProps as Record<string, unknown>)
          : scene.layoutProps;

        const layoutProps: NightfallLayoutProps = {
          ...rawLayoutProps,
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
            {scene.voiceoverUrl && (
              <Audio src={scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
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
    
      {bgmUrl && (
        <BackgroundMusic src={bgmUrl} volume={bgmVolume ?? 0.10} />
      )}
    </AbsoluteFill>
  );
};
