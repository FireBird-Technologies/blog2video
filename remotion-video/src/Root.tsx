import { Composition } from "remotion";
import {
  DefaultVideo,
  calculateDefaultMetadata,
} from "./templates/default/DefaultVideo";
import {
  NightfallVideo,
  calculateNightfallMetadata,
} from "./templates/nightfall/NightfallVideo";
import {
  GridcraftVideo,
  calculateGridcraftMetadata,
} from "./templates/gridcraft/GridcraftVideo";
import {
  SpotlightVideo,
  calculateSpotlightMetadata,
} from "./templates/spotlight/SpotlightVideo";
import {
  MatrixVideo,
  calculateMatrixMetadata,
} from "./templates/matrix/MatrixVideo";
import {
  MosaicVideo,
  calculateMosaicMetadata,
} from "./templates/mosaic/MosaicVideo";
import {
  WhiteboardVideo,
  calculateWhiteboardMetadata,
} from "./templates/whiteboard/WhiteboardVideo";
import {
  NewspaperVideo,
  calculateNewspaperMetadata,
} from "./templates/newspaper/NewspaperVideo";
import {
  NewscastVideo,
  calculateNewscastMetadata,
} from "./templates/newscast/NewscastVideo";
import {
  BlackswanVideo,
  calculateBlackswanMetadata,
} from "./templates/blackswan/BlackswanVideo";
import {
  BloombergVideo,
  calculateBloombergMetadata,
} from "./templates/bloomberg/BloombergVideo";
import {
  ChronicleVideo,
  calculateChronicleMetadata,
} from "./templates/chronicle/ChronicleVideo";
import {
  EconomistVideo,
  calculateEconomistMetadata,
} from "./templates/economist/EconomistVideo";
import {
  GeneratedVideo,
  calculateGeneratedMetadata,
} from "./templates/generated/GeneratedVideo";
import {
  Stickman2Video,
  calculateStickman2Metadata,
} from "./templates/stickman_2/Stickman2Video";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DefaultVideo"
        component={DefaultVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateDefaultMetadata}
      />
      <Composition
        id="NightfallVideo"
        component={NightfallVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateNightfallMetadata}
      />
      <Composition
        id="GridcraftVideo"
        component={GridcraftVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateGridcraftMetadata}
      />
      <Composition
        id="SpotlightVideo"
        component={SpotlightVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateSpotlightMetadata}
      />
      <Composition
        id="MatrixVideo"
        component={MatrixVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateMatrixMetadata}
      />
      <Composition
        id="MosaicVideo"
        component={MosaicVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateMosaicMetadata}
      />
      <Composition
        id="WhiteboardVideo"
        component={WhiteboardVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateWhiteboardMetadata}
      />
      <Composition
        id="NewspaperVideo"
        component={NewspaperVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateNewspaperMetadata}
      />
      <Composition
        id="NewscastVideo"
        component={NewscastVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateNewscastMetadata}
      />
      <Composition
        id="BlackswanVideo"
        component={BlackswanVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateBlackswanMetadata}
      />
      <Composition
        id="BloombergVideo"
        component={BloombergVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateBloombergMetadata}
      />
      <Composition
        id="ChronicleVideo"
        component={ChronicleVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateChronicleMetadata}
      />
      <Composition
        id="EconomistVideo"
        component={EconomistVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          // Must be "/data.json" like every other composition: the render
          // workspace writes the project's real scenes to public/data.json,
          // while public/economist.json is only the bundled template sample.
          // Pointing at the sample here made project renders output the demo
          // video instead of the user's project.
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateEconomistMetadata}
      />
      <Composition
        id="GeneratedVideo"
        component={GeneratedVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateGeneratedMetadata}
      />
      <Composition
        id="Stickman2Video"
        component={Stickman2Video}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateStickman2Metadata}
      />
    </>
  );
};
