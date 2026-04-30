import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

/**
 * bookPageFlip — single slow page turn around the book spine.
 *
 * One parchment page hinged at the center spine rotates 0→180° across the
 * full transition window. The new scene fades in underneath from the midpoint
 * onward so it's fully visible when the page lands. Slow and deliberate —
 * reads as turning one heavy page of a real tome.
 *
 * Direction "forward"  = page extends right, rotates right→left.
 * Direction "backward" = page extends left, rotates left→right.
 */

type Direction = "forward" | "backward";

type BookPageFlipProps = {
  direction?: Direction;
} & Record<string, unknown>;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const BookPageFlipComponent: React.FC<
  TransitionPresentationComponentProps<BookPageFlipProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const direction = (passedProps.direction as Direction) ?? "forward";
  const isForward = direction === "forward";
  const raw = presentationProgress;
  const eased = easeInOutCubic(raw);

  // Old scene fades out over the first half as the page lifts.
  if (presentationDirection === "exiting") {
    const exitFade = Math.max(0, 1 - raw * 2);
    return <AbsoluteFill style={{ opacity: exitFade }}>{children}</AbsoluteFill>;
  }

  // New scene fades in from the midpoint onward so it's fully visible when
  // the page lands flat.
  const incomingFade = Math.max(0, Math.min(1, (raw - 0.5) / 0.5));

  const rotationSign = isForward ? -1 : 1;
  const angle = eased * 180 * rotationSign;

  // Shadow peaks at mid-flip when the page is most perpendicular to camera.
  const lift = Math.sin(raw * Math.PI);
  const shadowAlpha = lift * 0.38;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* New scene underneath */}
      <AbsoluteFill style={{ opacity: incomingFade }}>{children}</AbsoluteFill>

      {/* Single parchment page rotating around the spine */}
      <AbsoluteFill
        style={{
          perspective: "2400px",
          perspectiveOrigin: "50% 50%",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            [isForward ? "left" : "right"]: "50%",
            width: "50%",
            transformStyle: "preserve-3d",
            transformOrigin: isForward ? "left center" : "right center",
            transform: `rotateY(${angle}deg)`,
            background: `radial-gradient(ellipse at 30% 25%, #F5E8C8 0%, #EBD9B0 55%, #D4BC88 100%)`,
            boxShadow: `
              0 ${8 + lift * 30}px ${20 + lift * 50}px rgba(20,12,4,${shadowAlpha}),
              inset 0 0 80px rgba(120,80,40,0.28),
              inset 0 0 0 1px rgba(120,80,40,0.18)
            `,
            backfaceVisibility: "hidden",
            willChange: "transform",
          }}
        >
          {/* Spine-side shadow — darkens the binding edge as the page lifts */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              [isForward ? "left" : "right"]: 0,
              width: "22%",
              background: isForward
                ? `linear-gradient(to right, rgba(60,35,15,0.32) 0%, rgba(60,35,15,0.10) 55%, transparent 100%)`
                : `linear-gradient(to left,  rgba(60,35,15,0.32) 0%, rgba(60,35,15,0.10) 55%, transparent 100%)`,
              pointerEvents: "none",
              mixBlendMode: "multiply",
            }}
          />

          {/* Outer-edge candlelight gleam */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              [isForward ? "right" : "left"]: 0,
              width: "18%",
              background: `linear-gradient(to ${isForward ? "left" : "right"},
                rgba(255,235,200,0.38) 0%,
                rgba(255,235,200,0.10) 60%,
                transparent 100%)`,
              pointerEvents: "none",
              mixBlendMode: "screen",
            }}
          />

          {/* Aged-paper grain */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 70% 70%, rgba(120,80,40,0.16) 0%, transparent 60%)",
              pointerEvents: "none",
              mixBlendMode: "multiply",
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const bookPageFlip = (
  props: { direction?: Direction } = {},
): TransitionPresentation<BookPageFlipProps> => ({
  component: BookPageFlipComponent,
  props: { direction: props.direction ?? "forward" },
});
