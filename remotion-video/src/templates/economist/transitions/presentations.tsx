import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { ECONOMIST_COLORS, lighten, darken } from "../constants";

/**
 * Custom Economist transition presentations.
 *
 * These extend the stock @remotion/transitions set with the moves motion
 * designers reach for on editorial / financial pieces — a parallax page-push,
 * a fast directional whip-blur, and a coloured "ink bar" that sweeps the cut.
 * All are deterministic functions of `presentationProgress` so headless renders
 * match the preview frame-for-frame.
 *
 * Each presentation reads `presentationDirection` ("entering" = incoming scene,
 * "exiting" = outgoing scene) and `presentationProgress` (0→1 across the
 * overlap) and returns plain transformed markup — no timers, no randomness.
 */

const ease = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ── Parallax page-push ───────────────────────────────────────────────────────
// The outgoing spread slides off and recedes slightly (scale + dim) while the
// incoming spread rides in from the opposite edge at a faster rate — the depth
// offset reads like one page being pushed over another.

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

  // Outgoing recedes a touch and dims; incoming comes from the far edge.
  const x = entering ? sign * dist * (1 - p) : -sign * dist * 0.42 * p;
  const scale = entering ? 1 : 1 - 0.05 * p;
  const brightness = entering ? 1 : 1 - 0.18 * p;

  return (
    <AbsoluteFill style={{ backgroundColor: ECONOMIST_COLORS.paper }}>
      <AbsoluteFill
        style={{
          transform: `translateX(${x}px) scale(${scale})`,
          filter: `brightness(${brightness})`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const pagePush = (
  props: PushProps,
): TransitionPresentation<PushProps> => ({
  component: PagePush,
  props,
});

// ── Whip-blur ────────────────────────────────────────────────────────────────
// A fast directional motion-blur slide. The scene streaks across with a heavy
// horizontal blur that peaks at the midpoint and resolves to crisp — the
// "whip pan" look, the punchiest move in the pool. Kept short so it snaps.

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

  // Travel: incoming sweeps in from the lead edge, outgoing flies off it.
  const travel = entering ? sign * 110 * (1 - ease(p)) : -sign * 110 * ease(p);
  // Blur peaks mid-transition (bell curve), zero at both ends.
  const bell = Math.sin(Math.PI * p);
  const blurPx = bell * 26;
  const opacity = entering
    ? interpolate(p, [0, 0.25], [0, 1], { extrapolateRight: "clamp" })
    : interpolate(p, [0.7, 1], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: ECONOMIST_COLORS.paper }}>
      <AbsoluteFill
        style={{
          transform: `translateX(${travel}px)`,
          filter: `blur(${blurPx.toFixed(2)}px)`,
          opacity,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const whipBlur = (
  props: WhipProps,
): TransitionPresentation<WhipProps> => ({
  component: WhipBlur,
  props,
});

// ── Ink-bar wipe ─────────────────────────────────────────────────────────────
// A solid Economist-red bar sweeps across, covering the outgoing scene and
// uncovering the incoming one behind it — a branded hard wipe. The incoming
// scene is revealed by the trailing edge of the bar (clip-path), so the cut
// happens under the colour, never as a visible dissolve.

type InkBarProps = { direction: "left" | "right"; color: string };

const InkBar: React.FC<TransitionPresentationComponentProps<InkBarProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const p = ease(presentationProgress);
  const entering = presentationDirection === "entering";
  const fromRight = passedProps.direction === "right";

  // The bar's leading edge position as a 0..100% of width.
  const lead = p * 100;

  // Incoming scene is clipped to the swept region (behind the bar's wake);
  // outgoing is clipped to the *complement* so it's cleared in lockstep with the
  // bar's leading edge — otherwise the previous scene's text lingers behind the
  // bar and then pops when the sequence ends.
  let clip: string | undefined;
  if (entering) {
    clip = fromRight
      ? `inset(0 0 0 ${100 - lead}%)`
      : `inset(0 ${100 - lead}% 0 0)`;
  } else {
    clip = fromRight
      ? `inset(0 ${lead}% 0 0)`
      : `inset(0 0 0 ${lead}%)`;
  }

  // The moving bar (rendered only on the entering layer so it draws on top).
  const barWidth = 14; // % of screen width
  const barLeft = fromRight ? 100 - lead - barWidth : lead - barWidth;

  return (
    <AbsoluteFill style={{ backgroundColor: ECONOMIST_COLORS.paper }}>
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

export const inkBar = (
  props: InkBarProps,
): TransitionPresentation<InkBarProps> => ({
  component: InkBar,
  props,
});

// ── Cover lift ───────────────────────────────────────────────────────────────
// A cinematic "turn the front cover" move for the hero exit. The outgoing cover
// tilts back in perspective, lifts up and away while dimming + softening, as the
// incoming spread settles from a slight over-scale into place beneath it. A thin
// Economist-red seam rides the lifting edge so the turn reads as a printed page,
// not a generic 3-D flip. Only the cover exit uses this — it deserves a hero
// move the mid-roll cuts don't get.

type CoverLiftProps = { color: string };

const CoverLift: React.FC<TransitionPresentationComponentProps<CoverLiftProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const entering = presentationDirection === "entering";
  const p = ease(presentationProgress);

  if (entering) {
    // Incoming spread settles from a gentle over-scale + slight downward drift.
    const scale = interpolate(p, [0, 1], [1.06, 1]);
    const ty = interpolate(p, [0, 1], [-26, 0]);
    const opacity = interpolate(presentationProgress, [0, 0.35], [0, 1], {
      extrapolateRight: "clamp",
    });
    return (
      <AbsoluteFill style={{ backgroundColor: ECONOMIST_COLORS.paper }}>
        <AbsoluteFill
          style={{ transform: `translateY(${ty}px) scale(${scale})`, opacity }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // Outgoing cover lifts away: hinge at the top, tilt back in perspective, rise,
  // and fade. transformOrigin at the top edge makes it read as a page turning up.
  const lift = -p * 64; // px upward
  const tiltX = p * 22; // deg, tilting away from viewer
  const scale = 1 + p * 0.06;
  const opacity = interpolate(presentationProgress, [0.55, 1], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const shadow = `0 ${(p * 60).toFixed(0)}px ${(p * 90).toFixed(0)}px rgba(0,0,0,${(
    p * 0.4
  ).toFixed(3)})`;
  const seamH = Math.max(0, 1 - p) * 6;

  return (
    <AbsoluteFill style={{ perspective: 2200, backgroundColor: "transparent" }}>
      <AbsoluteFill
        style={{
          transformOrigin: "50% 0%",
          transform: `translateY(${lift}px) rotateX(${tiltX}deg) scale(${scale})`,
          opacity,
          boxShadow: shadow,
          willChange: "transform, opacity",
        }}
      >
        {children}
        {/* Red seam along the lifting bottom edge of the cover. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: seamH,
            background: passedProps.color,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const coverLift = (
  props: CoverLiftProps,
): TransitionPresentation<CoverLiftProps> => ({
  component: CoverLift,
  props,
});

// ── Page fold ────────────────────────────────────────────────────────────────
// A crisp broadsheet half-page fold. A blank paper panel hinged at the vertical
// centre rotates 0→180° across the cut — the reader folding the page over to
// the next spread. The outgoing scene fades under the lifting panel; the
// incoming one is fully visible when the panel lands. Adapted from Chronicle's
// bookPageFlip but re-skinned for newsprint: flat paper gradient, hairline
// inset border, and a red seam on the free edge instead of parchment grain.

type PageFoldProps = { direction: "forward" | "backward" };

const PageFold: React.FC<TransitionPresentationComponentProps<PageFoldProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const isForward = passedProps.direction === "forward";
  const raw = presentationProgress;
  const eased = ease(raw);

  // Outgoing spread fades over the first half as the panel lifts off it.
  if (presentationDirection === "exiting") {
    const exitFade = Math.max(0, 1 - raw * 2);
    return <AbsoluteFill style={{ opacity: exitFade }}>{children}</AbsoluteFill>;
  }

  // Incoming spread is fully visible from p = 0.45 so the panel lands on it.
  const incomingFade = interpolate(raw, [0, 0.45], [0, 1], {
    extrapolateRight: "clamp",
  });

  const angle = eased * 180 * (isForward ? -1 : 1);
  // Shadow peaks at mid-fold when the panel stands perpendicular to camera.
  const lift = Math.sin(raw * Math.PI);
  const paperHi = lighten(ECONOMIST_COLORS.paper, 0.04);
  const paperLo = darken(ECONOMIST_COLORS.paper, 0.06);

  return (
    <AbsoluteFill style={{ backgroundColor: ECONOMIST_COLORS.paper, overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: incomingFade }}>{children}</AbsoluteFill>
      {raw < 1 && (
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
              transformOrigin: isForward ? "left center" : "right center",
              transform: `rotateY(${angle.toFixed(2)}deg)`,
              background: `linear-gradient(to ${isForward ? "right" : "left"}, ${paperHi} 0%, ${ECONOMIST_COLORS.paper} 45%, ${paperLo} 100%)`,
              boxShadow: `0 ${(8 + lift * 26).toFixed(1)}px ${(18 + lift * 44).toFixed(1)}px rgba(20,18,12,${(lift * 0.3).toFixed(3)}), inset 0 0 0 1px ${ECONOMIST_COLORS.rule}`,
              backfaceVisibility: "hidden",
              willChange: "transform",
            }}
          >
            {/* Spine-side shading — the fold crease darkens as the panel lifts. */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                [isForward ? "left" : "right"]: 0,
                width: "20%",
                background: `linear-gradient(to ${isForward ? "right" : "left"}, rgba(40,36,26,${(0.1 + lift * 0.14).toFixed(3)}) 0%, transparent 100%)`,
                pointerEvents: "none",
              }}
            />
            {/* Red seam on the free edge — reads as the printed page edge. */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                [isForward ? "right" : "left"]: 0,
                width: 3,
                background: ECONOMIST_COLORS.accent,
              }}
            />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const pageFold = (
  props: PageFoldProps,
): TransitionPresentation<PageFoldProps> => ({
  component: PageFold,
  props,
});

// ── Press roll ───────────────────────────────────────────────────────────────
// "Hot off the press" — the next page rolls up from beneath a dark ink-roller
// cylinder that rides the seam, the outgoing page feeding away above it. The
// moving layers carry a soft bell-curve blur so the roll has motion energy.

type PressRollProps = Record<string, never>;

const PressRoll: React.FC<TransitionPresentationComponentProps<PressRollProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
}) => {
  const p = ease(presentationProgress);
  const entering = presentationDirection === "entering";
  const bell = Math.sin(Math.PI * presentationProgress);
  const blurPx = bell * (entering ? 9 : 6);

  if (!entering) {
    return (
      <AbsoluteFill style={{ backgroundColor: ECONOMIST_COLORS.paper }}>
        <AbsoluteFill
          style={{
            transform: `translateY(${(-32 * p).toFixed(2)}%)`,
            filter: `brightness(${(1 - 0.16 * p).toFixed(3)}) blur(${blurPx.toFixed(2)}px)`,
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // The seam (top edge of the incoming page) as a % from the top.
  const seamTop = (1 - p) * 100;

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <AbsoluteFill
        style={{
          transform: `translateY(${seamTop.toFixed(2)}%)`,
          filter: `blur(${blurPx.toFixed(2)}px)`,
        }}
      >
        {children}
      </AbsoluteFill>
      {/* The ink-roller cylinder riding the seam. */}
      {presentationProgress < 1 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${seamTop.toFixed(2)}%`,
            height: "4%",
            transform: "translateY(-50%)",
            background: "linear-gradient(to bottom, #101010 0%, #3A3A3A 48%, #101010 100%)",
            boxShadow: `0 10px 24px rgba(0,0,0,${(0.32 * bell + 0.08).toFixed(3)})`,
            opacity: bell > 0.04 ? 1 : bell / 0.04,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export const pressRoll = (): TransitionPresentation<PressRollProps> => ({
  component: PressRoll,
  props: {},
});

// ── Halftone wipe ────────────────────────────────────────────────────────────
// The ink-bar geometry with a printer's halftone leading edge: the sweeping
// band dissolves into three columns of shrinking process dots, like ink density
// falling off a screened plate. Dots are CSS radial-gradient patterns — pure
// styling, no ids, fully deterministic.

type HalftoneProps = { direction: "left" | "right"; color: string };

const HALFTONE_COLUMNS = [
  { radius: 7, cell: 26 },
  { radius: 4.5, cell: 26 },
  { radius: 2.5, cell: 26 },
] as const;

const HalftoneWipe: React.FC<TransitionPresentationComponentProps<HalftoneProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const p = ease(presentationProgress);
  const entering = presentationDirection === "entering";
  const fromRight = passedProps.direction === "right";
  const lead = p * 100;

  // Incoming revealed behind the wake; outgoing cleared by the leading edge in
  // lockstep (mirrors the InkBar fix so the previous scene never lingers).
  let clip: string | undefined;
  if (entering) {
    clip = fromRight
      ? `inset(0 0 0 ${100 - lead}%)`
      : `inset(0 ${100 - lead}% 0 0)`;
  } else {
    clip = fromRight
      ? `inset(0 ${lead}% 0 0)`
      : `inset(0 0 0 ${lead}%)`;
  }

  const bandWidth = 10; // % of screen width
  const bandLeft = fromRight ? 100 - lead : lead - bandWidth;
  // Solid trailing half + three halftone columns toward the leading edge.
  const columns = fromRight ? [...HALFTONE_COLUMNS].reverse() : HALFTONE_COLUMNS;

  return (
    <AbsoluteFill style={{ backgroundColor: ECONOMIST_COLORS.paper }}>
      <AbsoluteFill style={{ clipPath: clip }}>{children}</AbsoluteFill>
      {entering && presentationProgress < 1 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${bandLeft.toFixed(2)}%`,
            width: `${bandWidth}%`,
            display: "flex",
            flexDirection: "row",
          }}
        >
          {(fromRight ? null : (
            <div style={{ flex: 1.2, background: passedProps.color }} />
          ))}
          {columns.map((c, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                backgroundImage: `radial-gradient(circle, ${passedProps.color} ${c.radius}px, transparent ${c.radius + 0.5}px)`,
                backgroundSize: `${c.cell}px ${c.cell}px`,
                backgroundPosition: "center",
              }}
            />
          ))}
          {(fromRight ? (
            <div style={{ flex: 1.2, background: passedProps.color }} />
          ) : null)}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const halftoneWipe = (
  props: HalftoneProps,
): TransitionPresentation<HalftoneProps> => ({
  component: HalftoneWipe,
  props,
});
