import { Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface BackgroundMusicProps {
  src: string;
  volume?: number;
}

export const BackgroundMusic: React.FC<BackgroundMusicProps> = ({
  src,
  volume = 0.10,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const fadeInFrames = fps; // 1 second
  const fadeOutFrames = fps * 2; // 2 seconds

  const fadeIn = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - fadeOutFrames, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const currentVolume = volume * fadeIn * fadeOut;

  return <Audio loop src={src} volume={currentVolume} />;
};
