import React from "react";
import "../../../fonts/newspaper-defaults";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { NEWSCAST_LAYOUT_REGISTRY } from "./layouts";
import type { NewscastLayoutProps, NewscastLayoutType } from "./layouts/types";
import { LogoOverlay } from "../LogoOverlay";
import { NewsCastBackground } from "./NewsCastBackground";
import { NewsCastChrome } from "./NewsCastChrome";
import { NewscastSceneZTransition } from "./NewscastSceneZTransition";
import { NEWSCAST_BACKGROUND_VARIANT } from "./backgroundVariant";

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

/** Per-sequence body: wires global `rotationFrame` for continuous background motion across scenes. */
const NewscastSequenceInner: React.FC<{
  startFrame: number;
  durationInFrames: number;
  sceneIndex: number;
  sceneCount: number;
  isHero: boolean;
  layoutType: string;
  layoutProps: NewscastLayoutProps;
  LayoutComponent: React.ComponentType<NewscastLayoutProps>;
  voiceoverUrl?: string;
}> = ({
  startFrame,
  durationInFrames,
  sceneIndex,
  sceneCount,
  isHero,
  layoutType,
  layoutProps,
  LayoutComponent,
  voiceoverUrl,
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
                aspectRatio={layoutProps.aspectRatio}
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
      {voiceoverUrl ? <Audio src={voiceoverUrl} /> : null}
    </AbsoluteFill>
  );
};

export interface NewscastSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  /** When present (e.g. hybrid descriptors), typography may live here instead of layoutProps. */
  layoutConfig?: { titleFontSize?: number; descriptionFontSize?: number };
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface NewscastVideoCompositionProps {
  scenes: NewscastSceneInput[];
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

export const NewscastVideoComposition: React.FC<NewscastVideoCompositionProps> = ({
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
      acc += Math.max(1, Math.round(scenes[i].durationSeconds * FPS));
    }
    return offsets;
  }, [scenes]);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAF8", fontFamily }}>
      {scenes.map((scene, index) => {
        const normalizedLayout = normalizeNewscastLayoutId(scene.layout);
        const legacyLayout = toLegacyNewscastLayoutId(normalizedLayout);
        const startFrame = sceneFrameOffsets[index] ?? 0;

        const durationFrames = Math.max(1, Math.round(scene.durationSeconds * FPS));

        const LayoutComponent =
          NEWSCAST_LAYOUT_REGISTRY[normalizedLayout as NewscastLayoutType] ||
          NEWSCAST_LAYOUT_REGISTRY.anchor_narrative;

        const base = (scene.layoutProps ?? {}) as Partial<NewscastLayoutProps>;
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
          imageUrl: scene.imageUrl,
          accentColor: accentColor || "#FF3B30",
          bgColor: bgColor || "#FAFAF8",
          textColor: textColor || "#111111",
          aspectRatio: (aspectRatio as "landscape" | "portrait") || "landscape",
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
            <NewscastSequenceInner
              startFrame={startFrame}
              durationInFrames={durationFrames}
              sceneIndex={index}
              sceneCount={scenes.length}
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

