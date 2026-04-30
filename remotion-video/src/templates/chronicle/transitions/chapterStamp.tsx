import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

/**
 * chapterStamp — outgoing fades smoothly under a wax seal that drops in
 * (with weight, ease-out cubic), holds with a soft ring shock, then fades
 * away as the new scene fades up underneath.
 *
 * Reads as "the next chapter is decreed" — a beat of ceremony rather than
 * a hard cut. Designed to be smooth at every paused frame: outgoing always
 * full-frame, incoming always full-frame, the seal is purely an overlay.
 */

type ChapterStampProps = Record<string, unknown>;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const SEAL_OUTER = "#5A1A12";
const SEAL_INNER = "#8C2418";
const SEAL_HIGHLIGHT = "rgba(255,180,150,0.55)";

const ChapterStampComponent: React.FC<
  TransitionPresentationComponentProps<ChapterStampProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress;

  if (presentationDirection === "exiting") {
    // Smooth fade across the whole transition. No clipping anywhere.
    const fade = Math.max(0, 1 - p * p);
    return <AbsoluteFill style={{ opacity: fade }}>{children}</AbsoluteFill>;
  }

  // Incoming gradually fades up so it's mostly visible by the time the
  // seal lifts off.
  const reveal = Math.max(0, Math.min(1, p * p * 1.4));

  // Seal animation phases:
  //   0.00 - 0.32  drop in (ease-out, scale 1.6 → 1.0)
  //   0.32 - 0.60  hold + ring shock
  //   0.60 - 1.00  fade out
  let stampOpacity = 0;
  let stampScale = 1.6;
  let ringScale = 1;
  let ringOpacity = 0;

  if (p < 0.32) {
    const t = easeOutCubic(p / 0.32);
    stampOpacity = t;
    stampScale = 1.6 - t * 0.6;
  } else if (p < 0.6) {
    stampOpacity = 1;
    stampScale = 1;
    const t = (p - 0.32) / 0.28;
    ringScale = 1 + easeOutCubic(t) * 2.0;
    ringOpacity = (1 - t) * 0.45;
  } else {
    const t = (p - 0.6) / 0.4;
    stampOpacity = 1 - t * t;
    stampScale = 1 + t * 0.08;
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: reveal }}>{children}</AbsoluteFill>

      {ringOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${ringScale})`,
            width: "22%",
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            border: `4px solid rgba(140,36,24,${ringOpacity})`,
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${stampScale})`,
          width: "22%",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%,
            ${SEAL_HIGHLIGHT} 0%,
            ${SEAL_INNER} 25%,
            ${SEAL_OUTER} 70%,
            #2A0805 100%)`,
          boxShadow: `
            inset 0 0 30px rgba(0,0,0,0.55),
            inset 0 -10px 20px rgba(0,0,0,0.4),
            0 8px 30px rgba(20,8,4,0.7)`,
          opacity: stampOpacity,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "12%",
            borderRadius: "50%",
            border: "3px solid rgba(255,200,170,0.35)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "rgba(255,210,180,0.7)",
            fontFamily: "Georgia, serif",
            fontSize: "55%",
            fontWeight: 700,
            fontStyle: "italic",
            textShadow: "0 -1px 0 rgba(0,0,0,0.5)",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          ✦
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const chapterStamp = (): TransitionPresentation<ChapterStampProps> => ({
  component: ChapterStampComponent,
  props: {},
});
