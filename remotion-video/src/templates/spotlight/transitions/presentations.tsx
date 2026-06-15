import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

/**
 * Spotlight custom transition presentations.
 *
 * Every move is a bold, kinetic, high-contrast cut that matches the Spotlight
 * aesthetic — words slam in, panels punch, accent-red bars wipe the frame.
 * No stock cross-dissolves. Each is a pure function of `presentationProgress`
 * (0→1) and `presentationDirection` ("entering" = incoming, "exiting" =
 * outgoing), so headless renders match the preview frame-for-frame (no timers,
 * no randomness).
 *
 * Shared easing: easeInOutCubic.
 */

export const SPOTLIGHT_ACCENT = "#EF4444";

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

type Direction = "from-left" | "from-right" | "from-top" | "from-bottom";

// ─── slamZoom ─────────────────────────────────────────────────────────────────
// The signature Spotlight move. Incoming scene slams in from a 1.2 over-scale to
// 1.0 with a quick settle; outgoing dips back (0.94) and dims. Reads like a word
// punching to fill the frame.

type SlamZoomProps = Record<string, unknown>;

const SlamZoomComponent: React.FC<
  TransitionPresentationComponentProps<SlamZoomProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const e = easeInOutCubic(presentationProgress);
  if (presentationDirection === "exiting") {
    const scale = 1 - 0.06 * e;
    const opacity = 1 - 0.85 * e;
    return (
      <AbsoluteFill style={{ transform: `scale(${scale})`, opacity }}>
        {children}
      </AbsoluteFill>
    );
  }
  // Incoming: 1.2 → 1.0, fading up quickly so the slam reads crisp.
  const scale = 1.2 - 0.2 * e;
  const opacity = Math.min(1, presentationProgress * 2.2);
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, opacity }}>
      {children}
    </AbsoluteFill>
  );
};

export const slamZoom = (): TransitionPresentation<SlamZoomProps> => ({
  component: SlamZoomComponent,
  props: {},
});

// ─── accentBarWipe ──────────────────────────────────────────────────────────────
// A solid accent-red bar sweeps across the cut; the incoming scene is revealed by
// the bar's trailing edge via clip-path, so the cut happens *under* the colour,
// never as a visible dissolve. Branded hard wipe.

type AccentBarWipeProps = { direction?: Direction; color?: string };

// Width of the travelling red band, as a fraction of the canvas. The band rides
// ahead of the cut edge so the wipe never fully covers the frame (no red flash).
const BAR_BAND = 0.32;

const AccentBarWipeComponent: React.FC<
  TransitionPresentationComponentProps<AccentBarWipeProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const direction = passedProps.direction ?? "from-left";
  const color = passedProps.color ?? SPOTLIGHT_ACCENT;
  const e = easeInOutCubic(presentationProgress);

  const horizontal = direction === "from-left" || direction === "from-right";
  const fromStart = direction === "from-left" || direction === "from-top";

  // The cut edge sweeps 0 → 1 across the whole transition. Incoming is revealed
  // behind it; outgoing stays visible ahead of it. A red band of width BAR_BAND
  // rides on the edge as the visible wipe element (the band's leading edge runs
  // ahead so it has fully exited by the end).
  const edge = e; // 0→1 cut position
  const bandFront = Math.min(1, edge + BAR_BAND);

  // clip-path that hides `clipFraction` of the canvas from the named side.
  const clipFromStart = (clipFraction: number) => {
    const pct = (clipFraction * 100).toFixed(2);
    if (horizontal) return fromStart ? `inset(0 0 0 ${pct}%)` : `inset(0 ${pct}% 0 0)`;
    return fromStart ? `inset(${pct}% 0 0 0)` : `inset(0 0 ${pct}% 0)`;
  };
  const clipFromEnd = (clipFraction: number) => {
    const pct = (clipFraction * 100).toFixed(2);
    if (horizontal) return fromStart ? `inset(0 ${pct}% 0 0)` : `inset(0 0 0 ${pct}%)`;
    return fromStart ? `inset(0 0 ${pct}% 0)` : `inset(${pct}% 0 0 0)`;
  };

  // Entering: occupies the start side, growing to `edge` (clip the far side).
  // Exiting: occupies the far side, shrinking (clip the start side by `edge`).
  const clip =
    presentationDirection === "entering"
      ? clipFromEnd(1 - edge)
      : clipFromStart(edge);

  // Red band gradient from `edge` to `bandFront`.
  const bandStart = (edge * 100).toFixed(2);
  const bandEnd = (bandFront * 100).toFixed(2);
  const gradDir = horizontal
    ? fromStart ? "to right" : "to left"
    : fromStart ? "to bottom" : "to top";
  const barBg = `linear-gradient(${gradDir}, transparent ${bandStart}%, ${color} ${bandStart}%, ${color} ${bandEnd}%, transparent ${bandEnd}%)`;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip }}>{children}</AbsoluteFill>
      {presentationDirection === "entering" && (
        <AbsoluteFill style={{ background: barBg, pointerEvents: "none" }} />
      )}
    </AbsoluteFill>
  );
};

export const accentBarWipe = (
  props: AccentBarWipeProps = {},
): TransitionPresentation<AccentBarWipeProps> => ({
  component: AccentBarWipeComponent,
  props,
});

// ─── kineticPush ────────────────────────────────────────────────────────────────
// Fast parallax push: the outgoing scene slides off + recedes (scale 0.95 + dim),
// the incoming rides in from the opposite edge faster. Snappy "next point"
// momentum. `distance` should be the canvas dimension along the push axis.

type KineticPushProps = { direction?: Direction; distance?: number };

const KineticPushComponent: React.FC<
  TransitionPresentationComponentProps<KineticPushProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const direction = passedProps.direction ?? "from-right";
  const distance = passedProps.distance ?? 1920;
  const e = easeInOutCubic(presentationProgress);

  const horizontal = direction === "from-left" || direction === "from-right";
  const sign = direction === "from-right" || direction === "from-bottom" ? 1 : -1;
  const axis = horizontal ? "translateX" : "translateY";

  if (presentationDirection === "exiting") {
    // Outgoing pushed away the opposite way + receding.
    const off = -sign * e * distance * 0.6;
    const scale = 1 - 0.05 * e;
    const dim = 1 - 0.45 * e;
    return (
      <AbsoluteFill style={{ transform: `${axis}(${off}px) scale(${scale})`, opacity: dim }}>
        {children}
      </AbsoluteFill>
    );
  }
  // Incoming rides in from the entry edge, faster (full distance).
  const off = sign * (1 - e) * distance;
  return (
    <AbsoluteFill style={{ transform: `${axis}(${off}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

export const kineticPush = (
  props: KineticPushProps = {},
): TransitionPresentation<KineticPushProps> => ({
  component: KineticPushComponent,
  props,
});

// ─── wordSlam ─────────────────────────────────────────────────────────────────
// A brief black-out + scale-punch: the outgoing scene drops to black fast, then
// the incoming scene slams up from a 1.35 over-scale through the black. Plays to
// "words fill the frame, slam in".

type WordSlamProps = Record<string, unknown>;

const WordSlamComponent: React.FC<
  TransitionPresentationComponentProps<WordSlamProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress;
  if (presentationDirection === "exiting") {
    // Snap to black in the first 45% of the transition.
    const opacity = Math.max(0, 1 - p / 0.45);
    const scale = 1 + 0.05 * easeInOutCubic(Math.min(1, p / 0.45));
    return (
      <AbsoluteFill style={{ backgroundColor: "#000000" }}>
        <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>{children}</AbsoluteFill>
      </AbsoluteFill>
    );
  }
  // Incoming appears after the black-out (p>0.45), slamming from 1.35→1.0.
  const local = Math.max(0, (p - 0.45) / 0.55);
  const e = easeInOutCubic(local);
  const scale = 1.35 - 0.35 * e;
  const opacity = Math.min(1, local * 2.4);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const wordSlam = (): TransitionPresentation<WordSlamProps> => ({
  component: WordSlamComponent,
  props: {},
});

// ─── barSplit ─────────────────────────────────────────────────────────────────
// Two accent-red bars wipe in from top + bottom and meet at center (first half),
// then part to reveal the new scene (second half). High-contrast stage reveal.

type BarSplitProps = { color?: string };

const BarSplitComponent: React.FC<
  TransitionPresentationComponentProps<BarSplitProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const color = passedProps.color ?? SPOTLIGHT_ACCENT;
  const p = presentationProgress;

  // close: 0→1 over first half (bars meet at center); open: 0→1 over second half.
  const close = Math.min(1, p / 0.5);
  const open = Math.max(0, (p - 0.5) / 0.5);
  const eClose = easeInOutCubic(close);
  const eOpen = easeInOutCubic(open);

  // Each bar covers `cover`% of its half (0 → 50% when closed).
  const cover = 50 * eClose * (1 - eOpen);

  if (presentationDirection === "exiting") {
    // Outgoing visible until the bars close over it.
    const opacity = 1 - eClose;
    return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
  }

  // Incoming visible once the bars start parting (after midpoint).
  const reveal = eOpen;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <AbsoluteFill style={{ opacity: reveal }}>{children}</AbsoluteFill>
      {/* top bar */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${cover}%`, background: color, pointerEvents: "none" }} />
      {/* bottom bar */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${cover}%`, background: color, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export const barSplit = (
  props: BarSplitProps = {},
): TransitionPresentation<BarSplitProps> => ({
  component: BarSplitComponent,
  props,
});

// ─── whipBlur ─────────────────────────────────────────────────────────────────
// Fast directional motion-blur slide; horizontal blur peaks (~26px) at the
// midpoint via a sin(πp) bell, resolves crisp. The punchy "whip pan".

type WhipBlurProps = { direction?: Direction; distance?: number };

const WhipBlurComponent: React.FC<
  TransitionPresentationComponentProps<WhipBlurProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const direction = passedProps.direction ?? "from-right";
  const distance = passedProps.distance ?? 1920;
  const e = easeInOutCubic(presentationProgress);
  const blur = Math.sin(presentationProgress * Math.PI) * 26;

  const horizontal = direction === "from-left" || direction === "from-right";
  const sign = direction === "from-right" || direction === "from-bottom" ? 1 : -1;
  const axis = horizontal ? "translateX" : "translateY";

  const off =
    presentationDirection === "exiting"
      ? -sign * e * distance
      : sign * (1 - e) * distance;
  return (
    <AbsoluteFill style={{ transform: `${axis}(${off}px)`, filter: `blur(${blur * 0.5}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

export const whipBlur = (
  props: WhipBlurProps = {},
): TransitionPresentation<WhipBlurProps> => ({
  component: WhipBlurComponent,
  props,
});
