import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";

export const TransitionWipe: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = 30;

  // Smooth zoom-out + fade: current scene scales up slightly while fading to white
  const progress = spring({
    frame,
    fps,
    config: { damping: 28, stiffness: 120, mass: 1 },
  });

  const scale = interpolate(progress, [0, 1], [1, 1.08], {
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        opacity,
        transform: `scale(${scale})`,
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
        backgroundColor: "#FFFFFF",
        opacity,
      }}
    />
  );
};
