import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../../fonts/newspaper-defaults";
import { NEWSCAST_LAYOUT_REGISTRY } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import type { NewscastLayoutProps, NewscastLayoutType } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";
import { NewsCastBackground } from "./NewsCastBackground";
import { NewsCastChrome } from "./NewsCastChrome";
import { NewscastSceneZTransition } from "./NewscastSceneZTransition";
import { NEWSCAST_BACKGROUND_VARIANT } from "./backgroundVariant";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

const LEGACY_TO_NEWCAST_LAYOUT_ID: Record<string, NewscastLayoutType> = {
  opening: "opening",
  anchor_narrative: "anchor_narrative",
  live_metrics_board: "live_metrics_board",
  data_visualization: "data_visualization",
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
  ending_socials: "ending_socials",
};

const normalizeNewscastLayoutId = (layout: string): NewscastLayoutType =>
  LEGACY_TO_NEWCAST_LAYOUT_ID[layout] ?? "anchor_narrative";

const NEWCAST_LAYOUT_TO_LEGACY_KEY: Record<NewscastLayoutType, string> = {
  opening: "cinematic_title",
  anchor_narrative: "glass_narrative",
  live_metrics_board: "glow_metric",
  data_visualization: "data_visualization",
  briefing_code_panel: "glass_code",
  headline_insight: "kinetic_insight",
  story_stack: "glass_stack",
  side_by_side_brief: "split_glass",
  segment_break: "chapter_break",
  field_image_focus: "glass_image",
  ending_socials: "ending_socials",
};

const toLegacyNewscastLayoutId = (layout: NewscastLayoutType): string =>
  NEWCAST_LAYOUT_TO_LEGACY_KEY[layout];

const normalizeNewscastDataVizProps = (
  lp: Partial<NewscastLayoutProps>,
): Partial<NewscastLayoutProps> => {
  const out: Record<string, unknown> = { ...lp };

  if (typeof out.chartType === "string") {
    out.chartType = String(out.chartType).trim().toLowerCase();
  }

  const lineChart = out.lineChart as
    | {
        labels?: unknown[];
        datasets?: Array<{ label?: unknown; values?: unknown[] | string }>;
      }
    | undefined;
  if (lineChart && typeof lineChart === "object") {
    if (!out.lineChartLabels && Array.isArray(lineChart.labels)) {
      out.lineChartLabels = lineChart.labels.map((v) => String(v ?? ""));
    }
    if (!out.lineChartDatasets && Array.isArray(lineChart.datasets)) {
      out.lineChartDatasets = lineChart.datasets.map((dataset) => ({
        label: String(dataset?.label ?? ""),
        valuesStr: Array.isArray(dataset?.values)
          ? dataset.values.map((v) => String(v ?? "")).join(",")
          : String(dataset?.values ?? ""),
      }));
    }
  }

  const barChart = out.barChart as { labels?: unknown[]; values?: unknown[] } | undefined;
  if (!out.barChartRows && barChart && typeof barChart === "object") {
    const labels = Array.isArray(barChart.labels) ? barChart.labels : [];
    const values = Array.isArray(barChart.values) ? barChart.values : [];
    out.barChartRows = labels.map((label, index) => ({
      label: String(label ?? ""),
      value: String(values[index] ?? ""),
    }));
  }

  const histogram = out.histogram as { labels?: unknown[]; values?: unknown[] } | undefined;
  if (!out.histogramRows && histogram && typeof histogram === "object") {
    const labels = Array.isArray(histogram.labels) ? histogram.labels : [];
    const values = Array.isArray(histogram.values) ? histogram.values : [];
    out.histogramRows = labels.map((label, index) => ({
      label: String(label ?? ""),
      value: String(values[index] ?? ""),
    }));
  }

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

  return out as Partial<NewscastLayoutProps>;
};

const NewscastSequenceInner: React.FC<{
  startFrame: number;
  durationInFrames: number;
  sceneIndex: number;
  sceneCount: number;
  isHero: boolean;
  layoutType: string;
  layoutProps: NewscastLayoutProps;
  LayoutComponent: React.ComponentType<NewscastLayoutProps>;
  voiceoverSrc?: string;
  playbackSpeed: number;
}> = ({
  startFrame,
  durationInFrames,
  sceneIndex,
  sceneCount,
  isHero,
  layoutType,
  layoutProps,
  LayoutComponent,
  voiceoverSrc,
  playbackSpeed,
}) => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portraitScale = 1;
  const portraitTranslateY = height > width ? -((portraitScale - 1) * height * 0.5) : 0;
  const rotationFrame = startFrame + localFrame;

  return (
    <AbsoluteFill>
      <NewscastSceneZTransition
        durationInFrames={durationInFrames}
        sceneIndex={sceneIndex}
        sceneCount={sceneCount}
        layoutType={layoutType}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateY(${portraitTranslateY}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `scale(${portraitScale})`,
              transformOrigin: "50% 50%",
            }}
          >
            <div>
              <NewsCastBackground
                variant={NEWSCAST_BACKGROUND_VARIANT}
                globeOpacity={0.44}
                rotationFrame={rotationFrame}
                sceneFrame={localFrame}
                sceneDurationInFrames={durationInFrames}
                sceneLayoutType={layoutType}
                solidBackground
              />
            </div>
            {!isHero ? (
              <NewsCastChrome
                tickerItems={layoutProps.tickerItems}
                lowerThirdTag={layoutProps.lowerThirdTag}
                lowerThirdHeadline={layoutProps.lowerThirdHeadline}
                lowerThirdSub={layoutProps.lowerThirdSub}
                showLowerThird={layoutType !== "data_visualization"}
                accentColor={layoutProps.accentColor}
                textColor={layoutProps.textColor}
                descriptionFontSize={layoutProps.descriptionFontSize}
                fontFamily={layoutProps.fontFamily}
              />
            ) : null}
            <LayoutComponent {...layoutProps} />
          </div>
        </div>
      </NewscastSceneZTransition>
      {voiceoverSrc ? <Audio src={voiceoverSrc} playbackRate={playbackSpeed} /> : null}
    </AbsoluteFill>
  );
};

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  layoutConfig?: { titleFontSize?: number; descriptionFontSize?: number };
  durationSeconds: number;
  voiceoverFile: string | null;
  images: string[];
  imageUrl?: string;
}

interface VideoData {
  projectName: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  aspectRatio?: string;
  playbackSpeed?: number;
  fontFamily?: string | null;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

export const calculateNewscastMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    const FPS = 30;
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: VideoData = await res.json();

      const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
      const sceneFrames = data.scenes.map((s) =>
        getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
      );
      const totalFrames = sceneFrames.reduce((sum, f) => sum + f, 0);
      const isPortrait = data.aspectRatio === "portrait";

      // Newscast base resolution: 1280×720 in landscape, 720×1280 in portrait
      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 720 : 1280,
        height: isPortrait ? 1280 : 720,
      };
    } catch {
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1280,
        height: 720,
      };
    }
  };

export const NewscastVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Newscast Preview",
          accentColor: "#E82020",
          bgColor: "#060614",
          textColor: "#B8C8E0",
          aspectRatio: "landscape",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "NEWS BULLETIN",
              narration: "A clear, editorial opening for live broadcast updates.",
              layout: "opening",
              layoutProps: {
                tickerItems: [
                  "LIVE BREAKING FEED",
                  "TOP DEVELOPMENTS UPDATE",
                  "NEW DETAILS SURFACE",
                  "OFFICIAL CONFIRMATIONS",
                ],
                lowerThirdTag: "LIVE COVERAGE",
                lowerThirdHeadline: "Correspondent Report",
                lowerThirdSub: "Reporting live from the broadcast desk",
              },
              durationSeconds: 5,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
      });
  }, [dataUrl]);

  if (!data) return <AbsoluteFill style={{ backgroundColor: "#FAFAF8" }} />;

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  let currentFrame = 0;
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#FAFAF8",
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      {data.scenes.map((scene, sceneIndex) => {
        const normalizedLayout = normalizeNewscastLayoutId(scene.layout);
        const legacyLayout = toLegacyNewscastLayoutId(normalizedLayout);
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          playbackSpeed,
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          NEWSCAST_LAYOUT_REGISTRY[normalizedLayout as NewscastLayoutType] ||
          NEWSCAST_LAYOUT_REGISTRY.anchor_narrative;

        const imageUrlFromAssets = scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;
        const lp = (scene.layoutProps ?? {}) as Record<string, unknown>;
        const base = lp as Partial<NewscastLayoutProps>;
        const normalizedBase =
          normalizedLayout === "data_visualization"
            ? normalizeNewscastDataVizProps(base)
            : base;
        const lc = scene.layoutConfig;

        const layoutProps: NewscastLayoutProps = {
          ...normalizedBase,
          titleFontSize: normalizedBase.titleFontSize ?? lc?.titleFontSize,
          descriptionFontSize: normalizedBase.descriptionFontSize ?? lc?.descriptionFontSize,
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "#FF3B30",
          bgColor: data.bgColor || "#FAFAF8",
          textColor: data.textColor || "#111111",
          aspectRatio: (data.aspectRatio as "landscape" | "portrait") || "landscape",
          imageUrl:
            imageUrlFromAssets ??
            scene.imageUrl ??
            (typeof lp.imageUrl === "string" ? lp.imageUrl : undefined),
          fontFamily: resolvedFontFamily || undefined,
          globeRotationFrameOffset: startFrame,
        };

        const layoutType = legacyLayout;
        const isHero = normalizedLayout === "opening";

        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={durationFrames} name={scene.title}>
            <NewscastSequenceInner
              startFrame={startFrame}
              durationInFrames={durationFrames}
              sceneIndex={sceneIndex}
              sceneCount={data.scenes.length}
              isHero={isHero}
              layoutType={layoutType}
              layoutProps={layoutProps}
              LayoutComponent={LayoutComponent}
              voiceoverSrc={scene.voiceoverFile ? staticFile(scene.voiceoverFile) : undefined}
              playbackSpeed={playbackSpeed}
            />
          </Sequence>
        );
      })}

      {data.logo && (
        <LogoOverlay
          src={staticFile(data.logo)}
          position={data.logoPosition || "bottom_right"}
          maxOpacity={data.logoOpacity ?? 0.9}
          aspectRatio={data.aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

