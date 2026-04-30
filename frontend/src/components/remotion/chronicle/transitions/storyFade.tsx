import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

/**
 * storyFade — the slow, melancholy "story-telling" fade.
 *
 * The current chapter slowly dissolves into a warm sepia mist, holds a
 * breath, and the next chapter materializes from the same mist. Reads as
 * "and then time passed..." — perfect for narrative pacing in a history
 * book where consecutive moments aren't connected by a physical action.
 *
 * Mechanics:
 *   - Outgoing scene fades 1 → 0 over the FIRST 60% of the transition,
 *     gaining a slight sepia tint as it fades (like ink yellowing on the
 *     page).
 *   - A warm sepia mist overlay rises in the middle (peaks at p=0.5),
 *     filling the frame with a soft golden haze.
 *   - Incoming scene fades 0 → 1 over the LAST 60% of the transition,
 *     emerging from the mist.
 *   - The two fades OVERLAP in the middle 20% so neither scene ever pops.
 *
 * Smoothness via cubic ease-in-out throughout.
 */

type StoryFadeProps = Record<string, unknown>;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const StoryFadeComponent: React.FC<
  TransitionPresentationComponentProps<StoryFadeProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const raw = presentationProgress;
  const p = easeInOutCubic(raw);

  if (presentationDirection === "exiting") {
    // Fade out faster — gone by p≈0.6. Sepia tint deepens as it fades.
    const opacity = Math.max(0, 1 - p / 0.6);
    const sepia = Math.min(1, p * 1.2);
    return (
      <AbsoluteFill
        style={{
          opacity,
          filter: `sepia(${sepia * 0.6}) brightness(${1 - sepia * 0.1})`,
        }}
      >
        {children}
      </AbsoluteFill>
    );
  }

  // Incoming starts fading in at p=0.4, fully visible by p=1.0.
  const reveal = Math.max(0, Math.min(1, (p - 0.4) / 0.6));

  // Sepia mist peaks at p=0.5, falls back to 0 at the ends. Sin-modulated.
  const mistAlpha = Math.sin(raw * Math.PI) * 0.55;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: reveal }}>{children}</AbsoluteFill>

      {/* Warm sepia mist veil — fills the frame with a soft golden haze
          at mid-transition. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center,
            rgba(180,140,80,${mistAlpha}) 0%,
            rgba(140,100,55,${mistAlpha * 0.85}) 60%,
            rgba(80,55,28,${mistAlpha * 0.65}) 100%)`,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />
      {/* Faint warm screen-blend pass on top of the mist for the candlelit
          glow that makes the mist feel like dust caught in a sunbeam. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center,
            rgba(255,225,170,${mistAlpha * 0.30}) 0%,
            rgba(255,200,130,${mistAlpha * 0.12}) 50%,
            transparent 100%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const storyFade = (): TransitionPresentation<StoryFadeProps> => ({
  component: StoryFadeComponent,
  props: {},
});
