import { AbsoluteFill, Audio, Sequence } from "remotion";
import {
  LAYOUT_REGISTRY,
  LayoutType,
  SceneLayoutProps,
} from "./layouts";
import { LogoOverlay } from "../LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

function convertDataVizProps(lp: Record<string, unknown>): Record<string, unknown> {
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

export interface DefaultSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: LayoutType;
  layoutProps: Record<string, any>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface DefaultVideoCompositionProps {
  scenes: DefaultSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
}

export const DefaultVideoComposition: React.FC<DefaultVideoCompositionProps> = ({
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
  playbackSpeed,
}) => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, fontFamily: fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          resolvedPlaybackSpeed,
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          LAYOUT_REGISTRY[scene.layout] || LAYOUT_REGISTRY.text_narration;

        const rawLayoutProps =
          scene.layout === "data_visualization"
            ? convertDataVizProps(scene.layoutProps as Record<string, unknown>)
            : scene.layoutProps;

        const layoutProps: SceneLayoutProps = {
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
            {scene.voiceoverUrl && (
              <Audio src={scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
            )}
          </Sequence>
        );
      })}

      {/* Logo overlay — spans entire video */}
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
