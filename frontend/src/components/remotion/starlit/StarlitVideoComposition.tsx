import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { SceneTransition } from "./components/SceneTransition";
import { CosmicHero } from "./layouts/CosmicHero";
import { GalaxyDeepDive } from "./layouts/GalaxyDeepDive";
import { EndingSocials } from "./layouts/EndingSocials";
import { QuoteCard } from "./layouts/QuoteCard";
import { RingedPlanet } from "./layouts/RingedPlanet";
import { RocketLaunch } from "./layouts/RocketLaunch";
import { SplitImage } from "./layouts/SplitImage";
import { StatCallout } from "./layouts/StatCallout";
import { TextNarration } from "./layouts/TextNarration";
import { DataVisualisation } from "./layouts/DataVisualisation";
import { TickerTable } from "./layouts/TickerTable";
import type { SceneLayoutProps } from "./types";
import { SceneDurationInFramesContext } from "../SceneDurationContext";

export type StarlitScene = {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationInFrames?: number;
  videoStartInFrames?: number;
  voiceoverUrl?: string;
};

export type StarlitProps = {
  scenes: StarlitScene[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
};

const LAYOUTS: Record<string, React.FC<SceneLayoutProps>> = {
  cosmic_hero: CosmicHero,
  text_narration: TextNarration,
  split_image: SplitImage,
  stat_callout: StatCallout,
  ringed_planet: RingedPlanet,
  rocket_launch: RocketLaunch,
  quote_card: QuoteCard,
  galaxy_deep_dive: GalaxyDeepDive,
  data_visualisation: DataVisualisation,
  ticker_table: TickerTable,
  ending_socials: EndingSocials,
};

export const StarlitVideoComposition: React.FC<StarlitProps> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  playbackSpeed,
}) => {
  const fps = 30;
  const speed = getPlaybackSpeed(playbackSpeed);
  let frameOffset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", fontFamily }}>
      {scenes.map((scene) => {
        const durationInFrames = getSceneDurationFrames(scene.durationSeconds, fps, speed);
        const from = frameOffset;
        frameOffset += durationInFrames;
        const Layout = LAYOUTS[scene.layout] || TextNarration;
        const raw = scene.layoutProps || {};
        const videoUrl = scene.videoUrl || (typeof raw.videoUrl === "string" ? raw.videoUrl : undefined);
        const layoutProps: SceneLayoutProps = {
          ...(raw as unknown as SceneLayoutProps),
          title: scene.title,
          narration: scene.narration,
          imageUrl: videoUrl ? undefined : scene.imageUrl || (typeof raw.imageUrl === "string" ? raw.imageUrl : undefined),
          videoUrl,
          videoMuted: scene.videoMuted ?? (typeof raw.videoMuted === "boolean" ? raw.videoMuted : true),
          videoVolume: scene.videoVolume ?? (typeof raw.videoVolume === "number" ? raw.videoVolume : 0.35),
          videoDurationInFrames: scene.videoDurationInFrames ?? (typeof raw.videoDurationInFrames === "number" ? raw.videoDurationInFrames : undefined),
          videoStartInFrames: scene.videoStartInFrames ?? (typeof raw.videoStartInFrames === "number" ? raw.videoStartInFrames : undefined),
          accentColor: accentColor || "#217cff",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#ffffff",
          aspectRatio,
          fontFamily,
          sceneDurationInFrames: durationInFrames,
        };

        return (
          <Sequence key={scene.id} from={from} durationInFrames={durationInFrames} name={scene.title}>
            <SceneDurationInFramesContext.Provider value={durationInFrames}>
              <Layout {...layoutProps} />
            </SceneDurationInFramesContext.Provider>
            <SceneTransition
              layout={scene.layout}
              accentColor={accentColor || "#217cff"}
              bgColor={bgColor || "#000000"}
              textColor={textColor || "#ffffff"}
              fontFamily={fontFamily}
              chartTable={layoutProps.chartTable}
              chartType={layoutProps.chartType}
              tickerTable={layoutProps.tickerTable}
            />
            {scene.voiceoverUrl ? <Audio src={scene.voiceoverUrl} playbackRate={speed} /> : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
