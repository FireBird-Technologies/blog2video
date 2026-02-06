import { Composition } from "remotion";
import { ExplainerVideo, calculateVideoMetadata } from "./ExplainerVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ExplainerVideo"
        component={ExplainerVideo}
        durationInFrames={30 * 300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
        calculateMetadata={calculateVideoMetadata}
      />
    </>
  );
};
