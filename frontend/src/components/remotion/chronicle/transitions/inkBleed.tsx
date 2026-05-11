import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

/**
 * inkBleed — radial ink wash reveal.
 *
 * The outgoing scene fades to a dark sepia ink wash that grows radially
 * from the page's center, peaks at p=0.5 covering most of the spread, then
 * recedes as the new scene fades up underneath. Sells the feel of ink
 * soaking through old parchment.
 *
 * Radial and centered — visually distinct from quillWrite (horizontal
 * left-to-right wash) and from any page flip.
 */

type InkBleedProps = Record<string, unknown>;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const InkBleedComponent: React.FC<
  TransitionPresentationComponentProps<InkBleedProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const raw = presentationProgress;
  const p = easeInOutCubic(raw);

  if (presentationDirection === "exiting") {
    // Old scene fades out across the whole window, smoothest in the
    // middle when the wash is densest.
    return <AbsoluteFill style={{ opacity: 1 - p }}>{children}</AbsoluteFill>;
  }

  // Incoming fades in slightly behind the wash so it emerges as the wash
  // recedes — feels like the new chapter is "soaked through" rather than
  // popping in.
  const reveal = p;

  // Radial ink wash: radius grows 0% → 80% from center then back to 0%,
  // alpha peaks at 0.65 in the middle. Sin-modulated visibility.
  const visibility = Math.sin(raw * Math.PI);
  const radius = 80 * visibility;
  const alpha = 0.65 * visibility;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: reveal }}>{children}</AbsoluteFill>

      {/* Radial ink wash overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 50%,
            rgba(35,20,10,${alpha}) 0%,
            rgba(35,20,10,${alpha * 0.7}) ${radius * 0.5}%,
            rgba(35,20,10,${alpha * 0.3}) ${radius}%,
            transparent ${radius + 15}%)`,
          pointerEvents: "none",
          mixBlendMode: "multiply",
        }}
      />
    </AbsoluteFill>
  );
};

export const inkBleed = (): TransitionPresentation<InkBleedProps> => ({
  component: InkBleedComponent,
  props: {},
});
