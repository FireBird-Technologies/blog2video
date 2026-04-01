/**
 * Brand-aware transition overlay for AI-generated videos.
 * Fades to brandColors.background with a subtle scale effect.
 * Duration: 12-15 frames at 30fps.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

interface GeneratedTransitionProps {
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

export const GeneratedTransition: React.FC<GeneratedTransitionProps> = ({ brandColors }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Fade in the overlay (0→1) over the full transition duration
  const opacity = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  // Subtle scale from 1 → 1.05 for depth
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.05], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandColors.background,
        opacity,
        transform: `scale(${scale})`,
      }}
    />
  );
};
