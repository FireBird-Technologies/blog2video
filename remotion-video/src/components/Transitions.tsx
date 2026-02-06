import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const TransitionWipe: React.FC = () => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        opacity: progress,
      }}
    />
  );
};

export const TransitionFade: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0A0A0A",
        opacity,
      }}
    />
  );
};
