import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

/**
 * quillWrite — a soft eased crossfade with a wet-ink leading edge gliding
 * across the spread, like an unseen scribe writing the next chapter.
 *
 * Smoothness comes from cubic ease-in-out on opacity (no abrupt fades) and
 * from the ink-bleed wash being wider + heavily blurred, so the eye reads
 * a slow ink stain rather than a hard wipe.
 */

type QuillWriteProps = Record<string, unknown>;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const QuillWriteComponent: React.FC<
  TransitionPresentationComponentProps<QuillWriteProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const raw = presentationProgress;
  const p = easeInOutCubic(raw);

  if (presentationDirection === "exiting") {
    return <AbsoluteFill style={{ opacity: 1 - p }}>{children}</AbsoluteFill>;
  }

  // Incoming fades in fully, ahead of the ink wash, so the new chapter is
  // already legible by the time the wash glides past.
  return (
    <AbsoluteFill style={{ opacity: p }}>
      {children}

      {/* Wide blurred warm-brown ink wash gliding L→R */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${p * 100 - 8}%`,
          width: "16%",
          background: `linear-gradient(to right,
            rgba(70,40,20,0.0) 0%,
            rgba(70,40,20,0.10) 30%,
            rgba(50,28,12,0.26) 55%,
            rgba(35,20,10,0.38) 75%,
            rgba(35,20,10,0.0) 100%)`,
          filter: "blur(8px)",
          pointerEvents: "none",
          mixBlendMode: "multiply",
          opacity: raw < 0.05 ? raw * 20 : raw > 0.92 ? (1 - raw) * 12.5 : 1,
        }}
      />

      {/* Warm gleam ahead of the nib — candlelight on freshly-marked ink */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${p * 100 + 2}%`,
          width: "10%",
          background: `linear-gradient(to right,
            rgba(255,225,170,0.18) 0%,
            rgba(255,225,170,0.06) 60%,
            transparent 100%)`,
          pointerEvents: "none",
          mixBlendMode: "screen",
          opacity: raw < 0.05 ? raw * 20 : raw > 0.92 ? (1 - raw) * 12.5 : 1,
        }}
      />
    </AbsoluteFill>
  );
};

export const quillWrite = (): TransitionPresentation<QuillWriteProps> => ({
  component: QuillWriteComponent,
  props: {},
});
