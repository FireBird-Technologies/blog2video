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
    </>
  );
};
