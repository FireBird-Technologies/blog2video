/**
 * Custom-template transition presentations.
 *
 * Brand-neutral, palette-driven ports of the richer editorial moves used by the
 * built-in templates (economist pagePush / whipBlur / inkBar / pageFold,
 * chronicle inkBleed). The stock @remotion/transitions (slide/wipe/flip/iris/
 * clockWipe/fade) cover the basics; these add the moves motion designers reach
 * for — a parallax depth push, a punchy whip-blur, a branded accent-bar sweep,
 * a 3-D fold, and a radial ink bleed — so custom videos get economist/chronicle-
 * grade variety while staying on-brand (accent colour is passed in, not hard-coded).
 *
 * Every presentation is a deterministic function of `presentationProgress` (no
 * timers, no randomness) so headless renders match the preview frame-for-frame.
 *
 * Keep byte-identical to the frontend mirror at
 * frontend/src/components/remotion/generated/generatedTransitionPresentations.tsx.
 */
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

const ease = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ── Parallax page-push ───────────────────────────────────────────────────────
// Outgoing scene slides off + recedes (scale + dim) while the incoming rides in
// from the opposite edge faster — reads like one page pushed over another.

type PushProps = { direction: "left" | "right"; distance: number };

const PagePush: React.FC<TransitionPresentationComponentProps<PushProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const p = ease(presentationProgress);
  const sign = passedProps.direction === "left" ? -1 : 1;
  const dist = passedProps.distance;
  const entering = presentationDirection === "entering";
  const x = entering ? sign * dist * (1 - p) : -sign * dist * 0.42 * p;
  const scale = entering ? 1 : 1 - 0.05 * p;
  const brightness = entering ? 1 : 1 - 0.18 * p;
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}px) scale(${scale})`, filter: `brightness(${brightness})` }}>
      {children}
    </AbsoluteFill>
  );
};

export const pagePush = (props: PushProps): TransitionPresentation<PushProps> => ({
  component: PagePush,
  props,
});

// ── Whip-blur ────────────────────────────────────────────────────────────────
// Fast directional motion-blur slide; blur peaks mid-transition. The punchiest
// move — kept short so it snaps. Great for bold/energetic brands.

type WhipProps = { direction: "left" | "right" };

const WhipBlur: React.FC<TransitionPresentationComponentProps<WhipProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const sign = passedProps.direction === "left" ? -1 : 1;
  const entering = presentationDirection === "entering";
  const p = presentationProgress;
  const travel = entering ? sign * 110 * (1 - ease(p)) : -sign * 110 * ease(p);
  const bell = Math.sin(Math.PI * p);
  const blurPx = bell * 26;
  const opacity = entering
    ? interpolate(p, [0, 0.25], [0, 1], { extrapolateRight: "clamp" })
    : interpolate(p, [0.7, 1], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ transform: `translateX(${travel}px)`, filter: `blur(${blurPx.toFixed(2)}px)`, opacity }}>
      {children}
    </AbsoluteFill>
  );
};

export const whipBlur = (props: WhipProps): TransitionPresentation<WhipProps> => ({
  component: WhipBlur,
  props,
});

// ── Accent-bar wipe ──────────────────────────────────────────────────────────
// A solid brand-accent bar sweeps across, covering the outgoing scene and
// uncovering the incoming one behind it — a branded hard wipe.

type BarProps = { direction: "left" | "right"; color: string };

const AccentBar: React.FC<TransitionPresentationComponentProps<BarProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const p = ease(presentationProgress);
  const entering = presentationDirection === "entering";
  const fromRight = passedProps.direction === "right";
  const lead = p * 100;
  let clip: string;
  if (entering) {
    clip = fromRight ? `inset(0 0 0 ${100 - lead}%)` : `inset(0 ${100 - lead}% 0 0)`;
  } else {
    clip = fromRight ? `inset(0 ${lead}% 0 0)` : `inset(0 0 0 ${lead}%)`;
  }
  const barWidth = 14;
  const barLeft = fromRight ? 100 - lead - barWidth : lead - barWidth;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip }}>{children}</AbsoluteFill>
      {entering && presentationProgress < 1 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${barLeft}%`,
            width: `${barWidth}%`,
            background: passedProps.color,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export const accentBar = (props: BarProps): TransitionPresentation<BarProps> => ({
  component: AccentBar,
  props,
});

// ── Page fold ────────────────────────────────────────────────────────────────
// A 3-D half-page fold hinged at the vertical centre rotates 0→180° across the
// cut. The outgoing scene fades under the lifting panel; the incoming is visible
// when the panel lands. Editorial / premium feel.

type FoldProps = { direction: "forward" | "backward"; panel: string };

const PageFold: React.FC<TransitionPresentationComponentProps<FoldProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const isForward = passedProps.direction === "forward";
  const raw = presentationProgress;
  const eased = ease(raw);
  if (presentationDirection === "exiting") {
    const exitFade = Math.max(0, 1 - raw * 2);
    return <AbsoluteFill style={{ opacity: exitFade }}>{children}</AbsoluteFill>;
  }
  const incomingFade = interpolate(raw, [0, 0.45], [0, 1], { extrapolateRight: "clamp" });
  const angle = eased * 180 * (isForward ? -1 : 1);
  const lift = Math.sin(raw * Math.PI);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: incomingFade }}>{children}</AbsoluteFill>
      {raw < 1 && (
        <AbsoluteFill style={{ perspective: "2400px", perspectiveOrigin: "50% 50%", pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: "50%",
              transformOrigin: "right center",
              transform: `rotateY(${angle}deg)`,
              background: passedProps.panel,
              boxShadow: `0 0 ${(lift * 80).toFixed(0)}px rgba(0,0,0,${(lift * 0.45).toFixed(3)})`,
              backfaceVisibility: "hidden",
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const pageFold = (props: FoldProps): TransitionPresentation<FoldProps> => ({
  component: PageFold,
  props,
});

// ── Ink bleed ────────────────────────────────────────────────────────────────
// A radial wash grows from centre (peaks at p=0.5) then recedes, revealing the
// incoming scene — chronicle's "ink soaking through" feel. Soft, organic.

type BleedProps = { color: string };

const InkBleed: React.FC<TransitionPresentationComponentProps<BleedProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const entering = presentationDirection === "entering";
  const p = presentationProgress;
  if (entering) {
    const reveal = interpolate(p, [0.35, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return <AbsoluteFill style={{ opacity: reveal }}>{children}</AbsoluteFill>;
  }
  const visibility = Math.sin(p * Math.PI);
  const radius = 80 * visibility;
  const alpha = 0.6 * visibility;
  const fade = interpolate(p, [0.4, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: fade }}>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${hexA(passedProps.color, alpha)} 0%, ${hexA(passedProps.color, alpha * 0.6)} ${(radius * 0.5).toFixed(1)}%, transparent ${(radius + 12).toFixed(1)}%)`,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const inkBleed = (props: BleedProps): TransitionPresentation<BleedProps> => ({
  component: InkBleed,
  props,
});

/** #rrggbb + alpha → rgba(). Tolerates a missing/!hex color by falling back to black. */
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return `rgba(0,0,0,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
