import { Composition } from "remotion";
import { ExplainerVideo } from "./ExplainerVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ExplainerVideo"
        component={ExplainerVideo}
        durationInFrames={30 * 60} // Will be overridden by data
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          dataUrl: "/data.json",
        }}
      />
    </>
  );
};
