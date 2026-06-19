import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useVideoConfig } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

// easeInOutQuint — much slower/smoother at both ends than cubic.
// Starts barely moving, accelerates through the middle, glides to a stop.
// This is what makes premium animations feel "liquid" rather than mechanical.
const ease = (t: number): number =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

// easeInOutCubic — gentler than quint, keeps the page-turn motion
// visible throughout so the viewer can actually see the flip happening.
const easeCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// easeInOutSine — the softest in/out curve. Used for the gentle zoom + flip so
// the motion feels liquid and unhurried rather than mechanical.
const easeSoft = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return 0.5 * (1 - Math.cos(Math.PI * c));
};

// ── Glossy Page Flip ────────────────────────────────────────────────────────
// Zoom out → settle → soft flip → zoom in.
// The scene gently shrinks to a centred card on a soft grey surface and holds
// for a beat. The card then turns smoothly about its spine — the old page turns
// away, the new page turns in — holds flat, and finally zooms back in on the new
// scene. The zoom-out is what makes the turn clearly readable instead of a
// full-frame blur.
//
// Timeline (progress):
//   0.00–0.22  exiting zooms out 1 → CARD
//   0.22–0.40  stillness
//   0.40–0.58  exiting turns 0 → ±90° (edge-on)
//   0.58–0.78  entering turns ±90° → 0 (new page lands)
//   0.78–0.86  stillness
//   0.86–1.00  entering zooms in CARD → 1

type GlossyPageFlipProps = {
  direction: "forward" | "backward";
  accentColor?: string;
};

const GLOSSY_CARD = 0.84;
const GLOSSY_BACKDROP =
  "radial-gradient(ellipse at 50% 45%, #FBFBFA 0%, #EFEEEC 58%, #E3E2E0 100%)";

const GlossyPageFlipComponent: React.FC<
  TransitionPresentationComponentProps<GlossyPageFlipProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = presentationProgress;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const dir = passedProps?.direction === "backward" ? 1 : -1;

  if (presentationDirection === "exiting") {
    if (p >= 0.6) return <AbsoluteFill style={{ background: GLOSSY_BACKDROP }} />;

    const zo = easeSoft(interpolate(p, [0, 0.22], [0, 1], cl));
    const scale = 1 - (1 - GLOSSY_CARD) * zo;
    const flip = easeSoft(interpolate(p, [0.4, 0.58], [0, 1], cl));
    const angle = flip * 90 * dir; // 0 → ±90
    const lift = Math.sin(flip * Math.PI * 0.5);

    return (
      <AbsoluteFill style={{ background: GLOSSY_BACKDROP }}>
        <AbsoluteFill style={{ perspective: "1600px" }}>
          <AbsoluteFill style={{
            transform: `scale(${scale.toFixed(4)}) rotateY(${angle.toFixed(2)}deg)`,
            transformOrigin: "center center",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: `0 ${(24 + lift * 30).toFixed(0)}px ${(50 + lift * 50).toFixed(0)}px rgba(0,0,0,${(0.1 + lift * 0.12).toFixed(3)})`,
          }}>
            {children}
            <AbsoluteFill style={{
              background: `linear-gradient(105deg, rgba(255,255,255,0) 45%, rgba(255,255,255,${(lift * 0.22).toFixed(3)}) 62%, rgba(0,0,0,${(lift * 0.1).toFixed(3)}) 100%)`,
              pointerEvents: "none",
            }} />
          </AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (p < 0.56) return <AbsoluteFill style={{ pointerEvents: "none" }} />;

  const bdAlpha = interpolate(p, [0.52, 0.6], [0, 1], cl);
  const flipIn = easeSoft(interpolate(p, [0.58, 0.78], [0, 1], cl));
  const angle = (1 - flipIn) * 90 * dir; // ±90 → 0
  const zin = easeSoft(interpolate(p, [0.86, 1.0], [0, 1], cl));
  const scale = GLOSSY_CARD + (1 - GLOSSY_CARD) * zin;
  const lift = Math.sin((1 - flipIn) * Math.PI * 0.5);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: GLOSSY_BACKDROP, opacity: bdAlpha }} />
      <AbsoluteFill style={{ perspective: "1600px" }}>
        <AbsoluteFill style={{
          transform: `scale(${scale.toFixed(4)}) rotateY(${angle.toFixed(2)}deg)`,
          transformOrigin: "center center",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          borderRadius: zin < 1 ? 8 : 0,
          overflow: "hidden",
          boxShadow: `0 ${(24 - zin * 22).toFixed(0)}px ${(50 - zin * 44).toFixed(0)}px rgba(0,0,0,${(0.14 - zin * 0.12).toFixed(3)})`,
        }}>
          {children}
          <AbsoluteFill style={{
            background: `linear-gradient(105deg, rgba(0,0,0,${(lift * 0.1).toFixed(3)}) 0%, rgba(255,255,255,${(lift * 0.22).toFixed(3)}) 40%, rgba(255,255,255,0) 58%)`,
            pointerEvents: "none",
          }} />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const glossyPageFlip = (
  props: GlossyPageFlipProps,
): TransitionPresentation<GlossyPageFlipProps> => ({
  component: GlossyPageFlipComponent,
  props,
});

// ── Dramatic Page Flip ─────────────────────────────────────────────────────
// A slower, more deliberate 3D page turn used around editorial/quote scenes.
// Uses cubic easing (instead of quint) so the middle of the flip stays visible
// rather than blurring past. Stronger shadows and a wider shimmer make the
// turning page unmistakable.

type DramaticPageFlipProps = {
  accentColor?: string;
};

const DramaticPageFlipComponent: React.FC<
  TransitionPresentationComponentProps<DramaticPageFlipProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const raw = presentationProgress;
  const eased = easeCubic(raw);

  if (presentationDirection === "entering") {
    const tiltX = interpolate(raw, [0, 0.8], [8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const tiltY = interpolate(raw, [0, 0.8], [-7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const camScale = interpolate(raw, [0, 0.8], [1.08, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ backgroundColor: "#FDFCFB", perspective: "1400px" }}>
        <AbsoluteFill style={{
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${camScale})`,
          transformStyle: "preserve-3d",
        }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const angle = eased * -180;
  const lift = Math.sin(raw * Math.PI);
  const shadowAlpha = (lift * 0.65).toFixed(3);
  const shadowBlur = (32 + lift * 120).toFixed(0);
  const ridge = (34 + eased * 48).toFixed(0);
  const shimmerPos = interpolate(raw, [0.06, 0.94], [96, 4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shimmerIntensity = (lift * 0.50).toFixed(3);

  return (
    <AbsoluteFill style={{ perspective: "1200px", perspectiveOrigin: "55% 50%", overflow: "hidden", backgroundColor: "#FDFCFB" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transformOrigin: "left center",
          transform: `rotateY(${angle}deg)`,
          willChange: "transform",
          boxShadow: `0 26px ${shadowBlur}px rgba(0,0,0,${shadowAlpha})`,
        }}
      >
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", overflow: "hidden" }}>
          {children}
          <AbsoluteFill style={{
            background: "linear-gradient(to right, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.08) 3%, transparent 7%)",
            pointerEvents: "none",
          }} />
          <AbsoluteFill style={{
            background: `linear-gradient(to right,
              rgba(0,0,0,0.08) 0%,
              rgba(0,0,0,0.01) 16%,
              rgba(255,255,255,${(lift * 0.60).toFixed(3)}) ${ridge}%,
              rgba(0,0,0,0.14) 82%,
              rgba(0,0,0,${(0.18 + lift * 0.48).toFixed(3)}) 100%)`,
            pointerEvents: "none",
          }} />
          <AbsoluteFill style={{
            background: `linear-gradient(to right,
              transparent ${Math.max(0, shimmerPos - 12).toFixed(1)}%,
              rgba(255,255,255,${shimmerIntensity}) ${shimmerPos.toFixed(1)}%,
              transparent ${Math.min(100, shimmerPos + 12).toFixed(1)}%)`,
            pointerEvents: "none",
          }} />
        </div>

        <div style={{
          position: "absolute",
          inset: 0,
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          background: "linear-gradient(to left, #FDFDFD 0%, #F2F2F0 40%, #E8E7E4 80%, #DDDBD8 100%)",
          overflow: "hidden",
        }}>
          <Img
            src={staticFile("magazine-collage.avif")}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.22, filter: "grayscale(0.6) brightness(1.05)" }}
          />
          <AbsoluteFill style={{
            background: "linear-gradient(to right, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.14) 7%, rgba(0,0,0,0.02) 28%, transparent 55%)",
            pointerEvents: "none",
          }} />
          <AbsoluteFill style={{
            background: "linear-gradient(to left, rgba(255,255,255,0.22) 0%, transparent 30%)",
            pointerEvents: "none",
          }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const dramaticPageFlip = (
  props: DramaticPageFlipProps = {},
): TransitionPresentation<DramaticPageFlipProps> => ({
  component: DramaticPageFlipComponent,
  props,
});

// ── Magazine Zoom ───────────────────────────────────────────────────────────
// Hero exit: zooms into the magazine page with a Vogue flash.

type MagazineZoomProps = Record<string, never>;

const MagazineZoomComponent: React.FC<
  TransitionPresentationComponentProps<MagazineZoomProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = ease(presentationProgress);
  const entering = presentationDirection === "entering";

  if (!entering) {
    const scale = 1 + 1.8 * p;
    const blurPx = 12 * p;
    const opacity = 1 - p;
    const vogueFlash = interpolate(p, [0.25, 0.45, 0.65], [0, 0.30, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <AbsoluteFill style={{ backgroundColor: "#FDFCFB" }}>
        <AbsoluteFill
          style={{
            transform: `scale(${scale})`,
            filter: `blur(${blurPx.toFixed(1)}px)`,
            opacity,
            willChange: "transform, filter, opacity",
          }}
        >
          {children}
        </AbsoluteFill>
        <Img
          src={staticFile("magazine-vogue.avif")}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: vogueFlash,
            filter: "grayscale(1) contrast(1.2)",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    );
  }

  const scale = interpolate(p, [0, 1], [1.04, 1.0]);
  const opacity = interpolate(presentationProgress, [0, 0.35], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#FDFCFB" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, opacity }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const magazineZoom = (): TransitionPresentation<MagazineZoomProps> => ({
  component: MagazineZoomComponent,
  props: {},
});

// ── Double Page Turn ────────────────────────────────────────────────────────
// Two pages turn in sequence — the first page lifts and turns, revealing a
// second page that also turns, revealing the new scene. Feels like flipping
// through multiple pages at once.

type DoublePageTurnProps = { accentColor?: string };

const DoublePageTurnComponent: React.FC<
  TransitionPresentationComponentProps<DoublePageTurnProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#E63946";
  const raw = presentationProgress;

  if (presentationDirection === "exiting") {
    const exitFade = Math.max(0, 1 - raw * 2.2);
    return <AbsoluteFill style={{ opacity: exitFade }}>{children}</AbsoluteFill>;
  }

  const incomingFade = interpolate(raw, [0.5, 0.85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const page1Progress = interpolate(raw, [0, 0.55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const page2Progress = interpolate(raw, [0.25, 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const page1Angle = ease(page1Progress) * -180;
  const page2Angle = ease(page2Progress) * -180;
  const lift1 = Math.sin(page1Progress * Math.PI);
  const lift2 = Math.sin(page2Progress * Math.PI);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: incomingFade }}>{children}</AbsoluteFill>

      {raw < 1 && (
        <AbsoluteFill style={{ perspective: "1800px", pointerEvents: "none" }}>
          {/* Second page (behind first) */}
          {page2Progress < 1 && (
            <div style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: "50%",
              transformStyle: "preserve-3d",
              transformOrigin: "left center",
              transform: `rotateY(${page2Angle}deg)`,
              background: "linear-gradient(to right, #F8F8F8 0%, #F0F0F0 100%)",
              boxShadow: `0 ${(4 + lift2 * 16).toFixed(1)}px ${(10 + lift2 * 30).toFixed(1)}px rgba(0,0,0,${(lift2 * 0.10).toFixed(3)})`,
              backfaceVisibility: "hidden",
              overflow: "hidden",
            }}>
              <Img
                src={staticFile("magazine-collage.avif")}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.20, filter: "grayscale(0.5)", pointerEvents: "none" }}
              />
              <div style={{
                position: "absolute", inset: 0,
                background: `linear-gradient(${140 + ease(page2Progress) * 40}deg, transparent 20%, rgba(255,255,255,0.4) 50%, transparent 80%)`,
                mixBlendMode: "screen",
              }} />
            </div>
          )}

          {/* First page (in front) */}
          {page1Progress < 1 && (
            <div style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: "50%",
              transformStyle: "preserve-3d",
              transformOrigin: "left center",
              transform: `rotateY(${page1Angle}deg)`,
              background: "linear-gradient(to right, #FFFFFF 0%, #FAFAFA 45%, #F5F5F5 100%)",
              boxShadow: `0 ${(6 + lift1 * 22).toFixed(1)}px ${(14 + lift1 * 38).toFixed(1)}px rgba(0,0,0,${(lift1 * 0.13).toFixed(3)})`,
              backfaceVisibility: "hidden",
              overflow: "hidden",
            }}>
              <Img
                src={staticFile("magazine-collage.avif")}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.25, filter: "grayscale(0.4)", pointerEvents: "none" }}
              />
              <div style={{
                position: "absolute", inset: 0,
                background: `linear-gradient(${130 + ease(page1Progress) * 50}deg, transparent 15%, rgba(255,255,255,0.5) 40%, transparent 65%)`,
                mixBlendMode: "screen",
              }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 3, background: accent }} />
            </div>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const doublePageTurn = (
  props: DoublePageTurnProps = {},
): TransitionPresentation<DoublePageTurnProps> => ({
  component: DoublePageTurnComponent,
  props,
});

// ── Magazine Stack Drop ─────────────────────────────────────────────────────
// A stack of magazines drops into frame, the top one opens up (spreads apart)
// to reveal the next scene. Physical, tactile, premium.

type StackDropProps = Record<string, never>;

const STACK_MAGAZINES = [
  { y: 12, x: 8, rot: 2.5, scale: 0.97 },
  { y: 6, x: -4, rot: -1.5, scale: 0.985 },
  { y: 0, x: 0, rot: 0, scale: 1.0 },
];

const StackDropComponent: React.FC<
  TransitionPresentationComponentProps<StackDropProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const raw = presentationProgress;
  const entering = presentationDirection === "entering";

  if (entering) {
    const openProgress = interpolate(raw, [0.4, 0.85], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const openEased = ease(openProgress);
    const scale = interpolate(openEased, [0, 1], [0.85, 1.0]);
    const opacity = interpolate(raw, [0.35, 0.65], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <AbsoluteFill style={{ backgroundColor: "#E8E6E2" }}>
        <AbsoluteFill style={{ transform: `scale(${scale})`, opacity }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const dropProgress = interpolate(raw, [0, 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dropEased = ease(dropProgress);

  const spreadProgress = interpolate(raw, [0.35, 0.75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spreadEased = ease(spreadProgress);

  const exitFade = interpolate(raw, [0.7, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#E8E6E2", perspective: 1400 }}>
      <AbsoluteFill style={{
        background: "radial-gradient(ellipse at 50% 55%, #F0EEEA 0%, #E0DDD8 50%, #D4D0CA 100%)",
      }} />

      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: exitFade,
      }}>
        {STACK_MAGAZINES.map((mag, i) => {
          const isTop = i === STACK_MAGAZINES.length - 1;
          const dropY = interpolate(dropEased, [0, 1], [-400, 0]);
          const bounce = i === 0 ? 0 : Math.sin(dropEased * Math.PI) * (3 - i) * 4;

          const spreadX = isTop ? spreadEased * -55 : 0;
          const spreadRot = isTop ? spreadEased * -4 : 0;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: "82%",
                height: "78%",
                background: "#FFFFFF",
                borderRadius: 3,
                transform: `
                  translateY(${dropY + mag.y - bounce}px)
                  translateX(${mag.x + spreadX}%)
                  rotate(${mag.rot + spreadRot}deg)
                  scale(${mag.scale})
                `,
                boxShadow: `0 ${4 + dropEased * 8}px ${12 + dropEased * 20}px rgba(0,0,0,${0.06 + dropEased * 0.06})`,
                overflow: "hidden",
                zIndex: i,
              }}
            >
              {isTop ? (
                <AbsoluteFill>{children}</AbsoluteFill>
              ) : (
                <Img
                  src={staticFile("magazine-collage.avif")}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.25 + i * 0.05,
                    filter: "grayscale(0.4)",
                  }}
                />
              )}

              <div style={{
                position: "absolute", top: 0, right: 0, width: 4, height: "100%",
                background: "linear-gradient(to left, #D8D5D0, #EEE)",
              }} />
              <div style={{
                position: "absolute", bottom: 0, left: 0, width: "100%", height: 4,
                background: "linear-gradient(to top, #D8D5D0, #EEE)",
              }} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const stackDrop = (): TransitionPresentation<StackDropProps> => ({
  component: StackDropComponent,
  props: {},
});

// ── Metric Zoom ─────────────────────────────────────────────────────────────
// The outgoing scene has a circular "lens" that expands from center, revealing
// the new scene underneath — like zooming into a metric/data point.

type MetricZoomProps = Record<string, never>;

const MetricZoomComponent: React.FC<
  TransitionPresentationComponentProps<MetricZoomProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const raw = presentationProgress;
  const entering = presentationDirection === "entering";

  if (!entering) {
    const shrink = interpolate(raw, [0, 0.6], [1, 0.6], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const opacity = interpolate(raw, [0.4, 0.8], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <AbsoluteFill style={{ backgroundColor: "#FDFCFB" }}>
        <AbsoluteFill style={{
          transform: `scale(${shrink})`,
          opacity,
          borderRadius: raw > 0.1 ? `${ease(raw) * 50}%` : 0,
          overflow: "hidden",
        }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const circleSize = ease(raw) * 150;
  const opacity = interpolate(raw, [0.1, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#FDFCFB" }}>
      <AbsoluteFill style={{
        clipPath: raw < 0.95 ? `circle(${circleSize}% at 50% 50%)` : "none",
        opacity,
      }}>
        {children}
      </AbsoluteFill>
      {raw < 0.95 && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: `${circleSize * 2}%`,
          height: `${circleSize * 2}%`,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          border: "3px solid #E63946",
          opacity: interpolate(raw, [0.05, 0.2, 0.7, 0.95], [0, 0.6, 0.6, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          pointerEvents: "none",
        }} />
      )}
    </AbsoluteFill>
  );
};

export const metricZoom = (): TransitionPresentation<MetricZoomProps> => ({
  component: MetricZoomComponent,
  props: {},
});

// ── Crisp Page Push ─────────────────────────────────────────────────────────

type CrispPagePushProps = { direction: "left" | "right"; distance: number };

const CrispPagePushComponent: React.FC<
  TransitionPresentationComponentProps<CrispPagePushProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = ease(presentationProgress);
  const sign = passedProps.direction === "left" ? -1 : 1;
  const dist = passedProps.distance;
  const entering = presentationDirection === "entering";

  const x = entering ? sign * dist * (1 - p) : -sign * dist * 0.4 * p;
  const scale = entering ? 1 : 1 - 0.03 * p;
  const brightness = entering ? 1 : 1 - 0.15 * p;

  return (
    <AbsoluteFill style={{ backgroundColor: "#FDFCFB" }}>
      <AbsoluteFill
        style={{
          transform: `translateX(${x}px) scale(${scale})`,
          filter: `brightness(${brightness})`,
        }}
      >
        {children}
      </AbsoluteFill>
      {entering && presentationProgress < 1 && (
        <div style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${(1 - p) * 100}%`,
          width: 2,
          background: "rgba(0,0,0,0.08)",
          boxShadow: "0 0 12px rgba(0,0,0,0.06)",
          pointerEvents: "none",
        }} />
      )}
    </AbsoluteFill>
  );
};

export const crispPagePush = (
  props: CrispPagePushProps,
): TransitionPresentation<CrispPagePushProps> => ({
  component: CrispPagePushComponent,
  props,
});

// ── Stack Slide ─────────────────────────────────────────────────────────────

type StackSlideProps = Record<string, never>;

const STACK_LAYERS = [
  { dx: 6, dy: 6, opacity: 0.08 },
  { dx: 3, dy: 3, opacity: 0.10 },
];

const StackSlideComponent: React.FC<
  TransitionPresentationComponentProps<StackSlideProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = ease(presentationProgress);
  const entering = presentationDirection === "entering";

  if (entering) {
    const opacity = interpolate(presentationProgress, [0.3, 0.7], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
  }

  const slideX = -p * 110;
  const rotate = p * 2;

  return (
    <AbsoluteFill style={{ backgroundColor: "#FDFCFB" }}>
      {STACK_LAYERS.map((layer, i) => (
        <div key={i} style={{
          position: "absolute", inset: 0,
          transform: `translate(${layer.dx}px, ${layer.dy}px)`,
          background: "#FFFFFF",
          boxShadow: `0 1px 4px rgba(0,0,0,${layer.opacity})`,
          borderRight: "1px solid rgba(0,0,0,0.04)",
          borderBottom: "1px solid rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}>
          <Img
            src={staticFile("magazine-collage.avif")}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.15 + i * 0.05, filter: "grayscale(0.5)", pointerEvents: "none" }}
          />
        </div>
      ))}
      <AbsoluteFill style={{
        transform: `translateX(${slideX}%) rotate(${rotate}deg)`,
        transformOrigin: "50% 100%",
        willChange: "transform",
      }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const stackSlide = (): TransitionPresentation<StackSlideProps> => ({
  component: StackSlideComponent,
  props: {},
});

// ── Magazine Tear ───────────────────────────────────────────────────────────
// The outgoing page rips down a jagged center seam. The two ragged halves yank
// apart — left half flies left, right half flies right — revealing the new
// scene underneath. Red accent flashes along the torn seam.

type MagazineTearProps = { accentColor?: string };

// Ragged vertical seam as a clip-path polygon. The LEFT half occupies
// everything to the left of this jagged line; the RIGHT half is the mirror.
const LEFT_CLIP =
  "polygon(0% 0%, 52% 0%, 47% 8%, 53% 16%, 46% 24%, 52% 33%, 47% 41%, 53% 50%, 46% 58%, 52% 66%, 47% 75%, 53% 83%, 47% 92%, 51% 100%, 0% 100%)";
const RIGHT_CLIP =
  "polygon(52% 0%, 100% 0%, 100% 100%, 51% 100%, 47% 92%, 53% 83%, 47% 75%, 52% 66%, 46% 58%, 53% 50%, 47% 41%, 52% 33%, 46% 24%, 53% 16%, 47% 8%)";

const MagazineTearComponent: React.FC<
  TransitionPresentationComponentProps<MagazineTearProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const raw = presentationProgress;
  const entering = presentationDirection === "entering";

  // ENTERING = new scene revealed as torn halves fly apart, settling with a
  // 3D camera tilt — arrives slightly angled and corrects to flat.
  if (entering) {
    const tiltX = interpolate(raw, [0, 0.75], [5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const tiltY = interpolate(raw, [0, 0.75], [4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const camScale = interpolate(raw, [0, 0.75], [1.05, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ backgroundColor: "#FDFCFB", perspective: "1600px" }}>
        <AbsoluteFill style={{
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${camScale})`,
          transformStyle: "preserve-3d",
        }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // The rip: brief beat, then a sharp accelerating yank apart.
  const ripProgress = interpolate(raw, [0.12, 0.95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ripEased = ripProgress * ripProgress;

  // Increase splitX so halves fully exit the frame by motion alone — no opacity fade.
  const splitX = ripEased * 110;
  const rotZL = ripEased * 6;
  const rotZR = ripEased * -6;
  const foldY = ripEased * 75;
  const liftShadow = (ripEased * 0.40).toFixed(3);

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", overflow: "hidden", perspective: "1100px", perspectiveOrigin: "50% 50%" }}>
      {/* LEFT torn half — torn (right) edge swings forward toward the viewer */}
      <AbsoluteFill
        style={{
          clipPath: LEFT_CLIP,
          WebkitClipPath: LEFT_CLIP,
          transformStyle: "preserve-3d",
          transformOrigin: "left center",
          transform: `translateX(${-splitX}%) rotateY(${-foldY}deg) rotateZ(${rotZL}deg)`,
          filter: `drop-shadow(10px 4px 18px rgba(0,0,0,${liftShadow}))`,
          willChange: "transform",
        }}
      >
        {children}
        {/* Torn-edge shading: the lifted right lip catches light then falls to shadow */}
        <AbsoluteFill style={{
          background: `linear-gradient(to right, rgba(0,0,0,0) 60%, rgba(255,255,255,${(ripEased * 0.25).toFixed(3)}) 88%, rgba(0,0,0,${(ripEased * 0.30).toFixed(3)}) 100%)`,
          pointerEvents: "none",
        }} />
      </AbsoluteFill>

      {/* RIGHT torn half — torn (left) edge swings forward toward the viewer */}
      <AbsoluteFill
        style={{
          clipPath: RIGHT_CLIP,
          WebkitClipPath: RIGHT_CLIP,
          transformStyle: "preserve-3d",
          transformOrigin: "right center",
          transform: `translateX(${splitX}%) rotateY(${foldY}deg) rotateZ(${rotZR}deg)`,
          filter: `drop-shadow(-10px 4px 18px rgba(0,0,0,${liftShadow}))`,
          willChange: "transform",
        }}
      >
        {children}
        <AbsoluteFill style={{
          background: `linear-gradient(to left, rgba(0,0,0,0) 60%, rgba(255,255,255,${(ripEased * 0.25).toFixed(3)}) 88%, rgba(0,0,0,${(ripEased * 0.30).toFixed(3)}) 100%)`,
          pointerEvents: "none",
        }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const magazineTear = (
  props: MagazineTearProps = {},
): TransitionPresentation<MagazineTearProps> => ({
  component: MagazineTearComponent,
  props,
});

// ── Page Fold-Over (turned over & kept in place) ─────────────────────────────
// The outgoing page lifts at the right edge and folds all the way over to the
// LEFT, coming to rest folded flat (showing its blank back), where it STAYS for
// the remainder — like physically turning a page over and laying it down. The
// new scene sits static underneath and is revealed as the page lays over.

type PageFoldOverProps = Record<string, never>;

const PageFoldOverComponent: React.FC<
  TransitionPresentationComponentProps<PageFoldOverProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const raw = presentationProgress;
  const entering = presentationDirection === "entering";

  if (entering) {
    // New scene revealed as page folds over it — arrives with 3D camera tilt
    // that settles to flat as the fold completes.
    const tiltX = interpolate(raw, [0, 0.75], [6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const tiltY = interpolate(raw, [0, 0.75], [5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const camScale = interpolate(raw, [0, 0.75], [1.05, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ backgroundColor: "#FDFCFB", perspective: "1600px" }}>
        <AbsoluteFill style={{
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${camScale})`,
          transformStyle: "preserve-3d",
        }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // The page folds 0 → -180 over the FIRST 70% of the window, then HOLDS folded
  // (kept in place) for the last 30%.
  const turn = interpolate(raw, [0, 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // ease-out with a tiny settle so it "lays down" rather than snapping.
  const turnEased = 1 - Math.pow(1 - turn, 2.2);
  const angle = turnEased * 180;
  const lift = Math.sin(Math.min(1, turn) * Math.PI);
  const shadowBlur = (22 + lift * 70).toFixed(1);
  const shadowAlpha = (lift * 0.50).toFixed(3);
  const bowDark = (0.08 + lift * 0.34).toFixed(3);
  const ridge = (38 + turnEased * 44).toFixed(0);
  const shimPos = interpolate(raw, [0.05, 0.75], [94, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shimIntensity = (lift * 0.36).toFixed(3);

  return (
    <AbsoluteFill style={{ perspective: "2000px", perspectiveOrigin: "50% 50%", overflow: "hidden", backgroundColor: "#FDFCFB" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transformOrigin: "left center",
          transform: `rotateY(${angle}deg)`,
          willChange: "transform",
        }}
      >
        {/* FRONT = outgoing scene */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", overflow: "hidden", boxShadow: `0 18px ${shadowBlur}px rgba(0,0,0,${shadowAlpha})` }}>
          {children}
          {/* Spine crease at hinge */}
          <AbsoluteFill style={{
            background: "linear-gradient(to right, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.05) 2.5%, transparent 6%)",
            pointerEvents: "none",
          }} />
          {/* Bow gradient: spine side darkens, centre brightens, free edge darkens */}
          <AbsoluteFill style={{
            background: `linear-gradient(to right,
              rgba(0,0,0,${bowDark}) 0%,
              rgba(0,0,0,0.01) 18%,
              rgba(255,255,255,${(lift * 0.45).toFixed(3)}) ${ridge}%,
              rgba(0,0,0,0.08) 82%,
              rgba(0,0,0,${(0.12 + lift * 0.36).toFixed(3)}) 100%)`,
            pointerEvents: "none",
          }} />
          {/* Moving crinkle shimmer */}
          <AbsoluteFill style={{
            background: `linear-gradient(to right,
              transparent ${Math.max(0, shimPos - 9).toFixed(1)}%,
              rgba(255,255,255,${shimIntensity}) ${shimPos.toFixed(1)}%,
              transparent ${Math.min(100, shimPos + 9).toFixed(1)}%)`,
            pointerEvents: "none",
          }} />
        </div>
        {/* BACK = blank paper, visible once folded over and laid down */}
        <div style={{
          position: "absolute",
          inset: 0,
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          background: "linear-gradient(to left, #FDFDFD 0%, #F2F2F0 40%, #E8E7E4 80%, #DDDBD8 100%)",
          overflow: "hidden",
          boxShadow: `0 18px ${shadowBlur}px rgba(0,0,0,${shadowAlpha})`,
        }}>
          <Img
            src={staticFile("magazine-collage.avif")}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.20, filter: "grayscale(0.6) brightness(1.05)" }}
          />
          {/* Prominent hinge crease on the back */}
          <AbsoluteFill style={{
            background: "linear-gradient(to right, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.10) 5%, rgba(0,0,0,0.02) 20%, transparent 50%)",
            pointerEvents: "none",
          }} />
          <AbsoluteFill style={{
            background: "linear-gradient(to left, rgba(255,255,255,0.20) 0%, transparent 30%)",
            pointerEvents: "none",
          }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const pageFoldOver = (): TransitionPresentation<PageFoldOverProps> => ({
  component: PageFoldOverComponent,
  props: {},
});

// ── Realistic Corner Curl ───────────────────────────────────────────────────
// A page-curl peeling diagonally from the TOP-RIGHT corner, exactly like the
// reference: the corner lifts, the page rolls back along a 45° fold showing its
// underside (the outgoing content, mirrored = the back of the page), a rounded
// cylindrical curl tube runs along the fold catching light, a soft shadow trails
// it, and the NEXT page is revealed underneath as the curl sweeps across.

type CornerFoldProps = { accentColor?: string };

const CornerCurlComponent: React.FC<
  TransitionPresentationComponentProps<CornerFoldProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const { width: W, height: H } = useVideoConfig();
  const raw = presentationProgress;
  const eased = ease(raw);

  // ENTERING = the next page revealed as the curl peels from the corner,
  // arriving with a 3D camera tilt from the top-right that settles to flat.
  if (presentationDirection === "entering") {
    const tiltX = interpolate(raw, [0, 0.75], [-5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const tiltY = interpolate(raw, [0, 0.75], [5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const camScale = interpolate(raw, [0, 0.75], [1.05, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ backgroundColor: "#FDFCFB", perspective: "1600px" }}>
        <AbsoluteFill style={{
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${camScale})`,
          transformStyle: "preserve-3d",
        }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // 45° fold line: x - y = C (px). C starts at W (just the corner) and sweeps to
  // -H (whole page peeled).
  const C = interpolate(eased, [0, 1], [W, -H]);

  // Helper: px point → "x% y%" for clip-path.
  const pc = (x: number, y: number) => `${(x / W) * 100}% ${(y / H) * 100}%`;

  // Remaining (un-peeled) outgoing page = half-plane x - y <= C, as a polygon.
  let remaining: string;
  if (C >= W) {
    remaining = `polygon(${pc(0, 0)}, ${pc(W, 0)}, ${pc(W, H)}, ${pc(0, H)})`;
  } else if (C >= W - H) {
    // fold crosses top edge at (C,0) and right edge at (W, W-C)
    remaining = `polygon(${pc(0, 0)}, ${pc(C, 0)}, ${pc(W, W - C)}, ${pc(W, H)}, ${pc(0, H)})`;
  } else if (C >= 0) {
    // fold crosses top at (C,0) and bottom at (C+H, H)
    remaining = `polygon(${pc(0, 0)}, ${pc(C, 0)}, ${pc(C + H, H)}, ${pc(0, H)})`;
  } else if (C >= -H) {
    // fold crosses left edge at (0,-C) and bottom at (C+H, H)
    remaining = `polygon(${pc(0, 0)}, ${pc(0, -C)}, ${pc(C + H, H)}, ${pc(0, H)})`;
  } else {
    remaining = `polygon(0% 0%, 0% 0%, 0% 0%)`; // fully peeled
  }

  // The folded flap shows the page BACK = outgoing content reflected across the
  // fold line x - y = C: (x,y) → (y + C, x - C). CSS matrix(0,1,1,0,C,-C).
  const reflect = `matrix(0, 1, 1, 0, ${C}, ${-C})`;
  // The flap occupies the peeled half-plane x - y >= C (where the reflected
  // content lands). Clip it there.
  let flapClip: string;
  if (C >= W - H) {
    flapClip = `polygon(${pc(C, 0)}, ${pc(W, 0)}, ${pc(W, W - C)})`;
  } else if (C >= 0) {
    flapClip = `polygon(${pc(C, 0)}, ${pc(W, 0)}, ${pc(W, H)}, ${pc(C + H, H)})`;
  } else {
    flapClip = `polygon(${pc(0, -C)}, ${pc(W, 0)}, ${pc(W, H)}, ${pc(C + H, H)}, ${pc(0, H)})`;
  }

  const lift = Math.sin(Math.min(1, raw) * Math.PI);

  return (
    <AbsoluteFill style={{ backgroundColor: "#FDFCFB", overflow: "hidden" }}>
      {/* Flat remaining part of the OLD page */}
      {raw < 0.98 && (
        <AbsoluteFill style={{ clipPath: remaining, WebkitClipPath: remaining }}>
          {children}
        </AbsoluteFill>
      )}

      {/* Soft shadow the curl casts onto the page below, just past the fold */}
      {raw < 0.98 && (
        <AbsoluteFill
          style={{
            clipPath: flapClip,
            WebkitClipPath: flapClip,
            transform: "translate(-14px, 14px)",
            background: `rgba(0,0,0,${(lift * 0.22).toFixed(3)})`,
            filter: "blur(10px)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* The folded-over flap = the page back (reflected outgoing content) */}
      {raw < 0.98 && (
        <AbsoluteFill style={{ clipPath: flapClip, WebkitClipPath: flapClip, overflow: "hidden" }}>
          {/* reflected content = underside print, dimmed */}
          <AbsoluteFill style={{ transform: reflect, transformOrigin: "0 0", opacity: 0.5, filter: "grayscale(0.3) brightness(1.1)" }}>
            {children}
          </AbsoluteFill>
          {/* paper wash over the back so it reads as the reverse of the sheet */}
          <AbsoluteFill style={{ background: "rgba(248,248,248,0.62)", pointerEvents: "none" }} />
        </AbsoluteFill>
      )}

      {/* Cylindrical curl tube running along the 45° fold — the rolled paper.
          A long strip rotated 45°, centered on the fold line, with a
          shadow→light→white→light→shadow gradient = a lit cylinder. */}
      {raw < 0.98 && C > -H && C < W && (() => {
        const diag = Math.sqrt(W * W + H * H) * 1.3;
        const thickness = 46 + lift * 18;
        // The fold line x - y = C passes through (C + H/2, H/2); anchor there.
        const ax = C + H / 2;
        const ay = H / 2;
        return (
          <div
            style={{
              position: "absolute",
              left: ax,
              top: ay,
              width: diag,
              height: thickness,
              marginLeft: -diag / 2,
              marginTop: -thickness / 2,
              transform: "rotate(45deg)",
              transformOrigin: "center center",
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, rgba(120,120,120,0.5) 22%, rgba(255,255,255,0.95) 50%, rgba(190,190,190,0.5) 78%, rgba(0,0,0,0.18) 100%)",
              borderRadius: thickness / 2,
              boxShadow: "0 6px 16px rgba(0,0,0,0.22)",
              pointerEvents: "none",
              opacity: 0.95,
            }}
          />
        );
      })()}
    </AbsoluteFill>
  );
};

export const realisticCornerFold = (
  props: CornerFoldProps = {},
): TransitionPresentation<CornerFoldProps> => ({
  component: CornerCurlComponent,
  props,
});

// ── Page Slide ──────────────────────────────────────────────────────────────
// Modern horizontal push — the new page slides in from the right and pushes
// the old page off to the left, both moving in lockstep. Fully opaque
// throughout: no fades, no rotation, just a clean magazine-style swipe.
// A thin soft shadow on the seam between pages gives depth.

type PageSlideProps = Record<string, never>;

const PageSlideComponent: React.FC<
  TransitionPresentationComponentProps<PageSlideProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = ease(presentationProgress);
  const raw = presentationProgress;
  const entering = presentationDirection === "entering";

  if (entering) {
    // Page slides in from the right with a 3D camera tilt — arrives slightly
    // angled (rotateX + rotateY) and settles to flat as it lands.
    const tiltX = interpolate(raw, [0, 0.75], [5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const tiltY = interpolate(raw, [0, 0.75], [-4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const camScale = interpolate(raw, [0, 0.75], [1.04, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ backgroundColor: "#FDFCFB", perspective: "1600px" }}>
        <AbsoluteFill
          style={{
            transform: `translateX(${(1 - p) * 100}%) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${camScale})`,
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
        >
          {children}
          {/* Leading-edge shadow on the left side of the incoming page */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 32,
              background:
                "linear-gradient(to right, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.04) 60%, transparent 100%)",
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#FDFCFB" }}>
      <AbsoluteFill
        style={{
          transform: `translateX(${-p * 100}%)`,
          willChange: "transform",
        }}
      >
        {children}
        {/* Trailing-edge shadow on the right side of the outgoing page */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: 32,
            background:
              "linear-gradient(to left, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.04) 60%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const pageSlide = (): TransitionPresentation<PageSlideProps> => ({
  component: PageSlideComponent,
  props: {},
});

// ── Corner Peel Flip ──────────────────────────────────────────────────────
// The page lifts from its top-right corner curl, peels diagonally, and
// rotates away revealing the new scene rising from underneath. The camera
// tilts to follow the peel for a strong 3D read.

type CornerPeelFlipProps = { accentColor?: string };

const CornerPeelFlipComponent: React.FC<
  TransitionPresentationComponentProps<CornerPeelFlipProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const { width: W, height: H } = useVideoConfig();
  const raw = presentationProgress;
  const accent = passedProps.accentColor ?? "#E63946";

  if (presentationDirection === "entering") {
    const tiltX = interpolate(raw, [0, 0.85], [-10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const tiltY = interpolate(raw, [0, 0.85], [6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const camScale = interpolate(raw, [0, 0.85], [1.10, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const slideY = interpolate(easeCubic(raw), [0, 1], [60, 0]);
    return (
      <AbsoluteFill style={{ backgroundColor: "#FDFCFB", perspective: "1200px", perspectiveOrigin: "60% 30%" }}>
        <AbsoluteFill style={{
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${camScale}) translateY(${slideY}px)`,
          transformStyle: "preserve-3d",
        }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const peelStart = 0.10;
  const peelEnd = 0.90;
  const peelT = interpolate(raw, [peelStart, peelEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const peelEased = easeCubic(peelT);

  const C = interpolate(peelEased, [0, 1], [W + H, -W * 0.15]);

  const curlGrow = interpolate(raw, [0, peelStart], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const curlSize = 80 + curlGrow * 120;

  const pc = (x: number, y: number) => `${((x / W) * 100).toFixed(2)}% ${((y / H) * 100).toFixed(2)}%`;

  let remaining: string;
  if (C >= W + H) {
    remaining = `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)`;
  } else if (C >= W) {
    remaining = `polygon(0% 0%, ${pc(C, 0)}, ${pc(W, C - W)}, 100% 100%, 0% 100%)`;
  } else if (C >= H) {
    remaining = `polygon(0% 0%, ${pc(C, 0)}, ${pc(0, C)}, 0% 100%)`;
  } else if (C > 0) {
    remaining = `polygon(0% 0%, ${pc(C, 0)}, ${pc(0, C)})`;
  } else {
    remaining = `polygon(0% 0%, 0% 0%, 0% 0%)`;
  }

  let flapClip: string;
  if (C >= W) {
    flapClip = `polygon(${pc(C, 0)}, 100% 0%, 100% ${pc(W, C - W).split(" ")[1]})`;
  } else if (C >= H) {
    flapClip = `polygon(${pc(C, 0)}, 100% 0%, 100% 100%, ${pc(0, C).split(" ")[0]} 100%)`;
  } else if (C > 0) {
    flapClip = `polygon(${pc(C, 0)}, 100% 0%, 100% 100%, 0% 100%, ${pc(0, C)})`;
  } else {
    flapClip = `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)`;
  }

  const lift = Math.sin(peelT * Math.PI);
  const shadowAlpha = (lift * 0.35).toFixed(3);

  const camTiltX = interpolate(raw, [0, 0.5, 0.9], [0, -4, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const camTiltY = interpolate(raw, [0, 0.5, 0.9], [0, 5, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{
      perspective: "1200px",
      perspectiveOrigin: "65% 30%",
      overflow: "hidden",
      backgroundColor: "#FDFCFB",
      transform: `rotateX(${camTiltX}deg) rotateY(${camTiltY}deg)`,
      transformStyle: "preserve-3d",
    }}>
      {peelEased < 0.99 && (
        <AbsoluteFill style={{ clipPath: remaining, WebkitClipPath: remaining }}>
          {children}
          {peelT < 0.3 && (
            <div style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: curlSize,
              height: curlSize,
              pointerEvents: "none",
              zIndex: 10,
            }}>
              <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
                <defs>
                  <linearGradient id="peel-curl" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="50%" stopColor="#EEEEEE" />
                    <stop offset="100%" stopColor="#B8B8B8" />
                  </linearGradient>
                </defs>
                <path
                  d="M 32,0 L 100,0 L 100,52 Q 80,22 32,0 Z"
                  fill="url(#peel-curl)"
                />
                <path d="M 32,0 Q 80,22 100,52" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2" />
              </svg>
            </div>
          )}
        </AbsoluteFill>
      )}

      {peelEased > 0.02 && peelEased < 0.98 && (
        <AbsoluteFill style={{
          clipPath: flapClip,
          WebkitClipPath: flapClip,
          transform: "translate(-10px, 10px)",
          background: `rgba(0,0,0,${shadowAlpha})`,
          filter: "blur(14px)",
          pointerEvents: "none",
        }} />
      )}

      {peelEased > 0.02 && peelEased < 0.98 && (
        <AbsoluteFill style={{
          clipPath: flapClip,
          WebkitClipPath: flapClip,
          overflow: "hidden",
        }}>
          <AbsoluteFill style={{
            transform: `matrix(0, -1, -1, 0, ${C}, ${C})`,
            transformOrigin: "0 0",
            opacity: 0.45,
            filter: "grayscale(0.3) brightness(1.1)",
          }}>
            {children}
          </AbsoluteFill>
          <AbsoluteFill style={{ background: "rgba(248,248,246,0.60)", pointerEvents: "none" }} />
        </AbsoluteFill>
      )}

      {peelEased > 0.02 && peelEased < 0.98 && C > -W * 0.2 && C < W + H && (() => {
        const diag = Math.sqrt(W * W + H * H) * 1.4;
        const thickness = 40 + lift * 22;
        const ax = C / 2;
        const ay = C / 2;
        return (
          <div
            style={{
              position: "absolute",
              left: ax,
              top: ay,
              width: diag,
              height: thickness,
              marginLeft: -diag / 2,
              marginTop: -thickness / 2,
              transform: "rotate(-45deg)",
              transformOrigin: "center center",
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.20) 0%, rgba(140,140,140,0.45) 20%, rgba(255,255,255,0.95) 50%, rgba(160,160,160,0.45) 80%, rgba(0,0,0,0.18) 100%)",
              borderRadius: thickness / 2,
              boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
              pointerEvents: "none",
              opacity: Math.min(1, lift * 2),
            }}
          />
        );
      })()}

      {peelEased > 0.05 && peelEased < 0.95 && (() => {
        const diag = Math.sqrt(W * W + H * H) * 1.4;
        const ax = C / 2;
        const ay = C / 2;
        return (
          <div
            style={{
              position: "absolute",
              left: ax,
              top: ay,
              width: diag,
              height: 2,
              marginLeft: -diag / 2,
              marginTop: -1,
              transform: "rotate(-45deg)",
              transformOrigin: "center center",
              background: accent,
              opacity: lift * 0.35,
              pointerEvents: "none",
            }}
          />
        );
      })()}
    </AbsoluteFill>
  );
};

export const cornerPeelFlip = (
  props: CornerPeelFlipProps = {},
): TransitionPresentation<CornerPeelFlipProps> => ({
  component: CornerPeelFlipComponent,
  props,
});

// ── Magazine Riffle ────────────────────────────────────────────────────────
// A smooth, zoomed-in page riffle. A dense fan of big clean magazine pages
// sweeps across the frame right→left (like riffling a magazine in front of the
// lens) and clears to reveal the next scene. With `zoom`, the revealed scene
// also pushes in (scale 1.18→1.0) so it reads as "riffle, then dive into the
// page". Eased softly with per-page edge fades so nothing pops.

type MagazineRiffleOpenProps = { accentColor?: string; zoom?: boolean };

const RIFFLE_PAGES = 9;

const clampOpts = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const MagazineRiffleOpenComponent: React.FC<
  TransitionPresentationComponentProps<MagazineRiffleOpenProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = presentationProgress;
  const zoom = passedProps.zoom ?? false;

  if (presentationDirection === "exiting") {
    return <AbsoluteFill style={{ backgroundColor: "#FDFCFB" }}>{children}</AbsoluteFill>;
  }

  // Eased softly (sine in/out) so it glides rather than snaps.
  const sweep = easeSoft(interpolate(p, [0.04, 0.84], [0, 1], clampOpts));
  const newAppear = interpolate(p, [0.4, 0.62], [0, 1], clampOpts);
  // Optional push-in on the revealed scene — the "dive into the page".
  const zoomT = easeSoft(interpolate(p, [0.42, 1], [0, 1], clampOpts));
  const zoomScale = zoom ? interpolate(zoomT, [0, 1], [1.18, 1.0]) : 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: newAppear, transform: `scale(${zoomScale.toFixed(4)})`, transformOrigin: "50% 50%", willChange: "transform, opacity" }}>
        {children}
      </AbsoluteFill>

      <AbsoluteFill style={{ perspective: "1600px", overflow: "hidden" }}>
        {Array.from({ length: RIFFLE_PAGES }).map((_, i) => {
          const startX = 100 + i * 12;
          const x = startX - sweep * 320;
          if (x < -95 || x > 135) return null;
          const centerX = x + 30;
          const tilt = (centerX - 50) * 0.5;
          const flutter = Math.sin(sweep * Math.PI * 2.4 + i * 0.7) * 6;
          const bob = Math.cos(sweep * Math.PI * 2.0 + i * 0.5) * 1.6;
          const rot = tilt + flutter;
          const facing = 1 - Math.min(1, Math.abs(rot) / 90);
          const edgeFade =
            x < -75 ? interpolate(x, [-95, -75], [0, 1], clampOpts)
            : x > 112 ? interpolate(x, [112, 135], [1, 0], clampOpts)
            : 1;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: `${-14 + bob}%`,
                left: `${x}%`,
                width: "60%",
                height: "128%",
                transformOrigin: "center center",
                transform: `rotateY(${rot.toFixed(1)}deg)`,
                opacity: edgeFade,
                zIndex: i,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                background: "#FBFAF7",
                overflow: "hidden",
                boxShadow: "0 0 48px rgba(0,0,0,0.18)",
                borderLeft: "1px solid rgba(0,0,0,0.07)",
                borderRight: "1px solid rgba(0,0,0,0.07)",
              }}
            >
              {/* clean printed page — a faint ghost of a spread + hairline text blocks */}
              <Img
                src={staticFile("magazine-blur-bg.svg")}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: `${(i * 29) % 100}% ${(i * 47) % 100}%`,
                  opacity: 0.1,
                  filter: "saturate(0.55)",
                }}
              />
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: i % 2 === 0 ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.035)" }} />
              {Array.from({ length: 6 }).map((_, k) => (
                <div key={k} style={{ position: "absolute", left: "16%", right: "16%", top: `${22 + k * 11}%`, height: 2, background: "rgba(0,0,0,0.045)" }} />
              ))}
              <AbsoluteFill style={{
                background: `linear-gradient(to right,
                  rgba(0,0,0,0.20) 0%,
                  rgba(0,0,0,0.02) 16%,
                  rgba(255,255,255,0.40) 42%,
                  rgba(255,255,255,0.08) 62%,
                  rgba(0,0,0,0.05) 86%,
                  rgba(0,0,0,0.22) 100%)`,
                mixBlendMode: "overlay",
                pointerEvents: "none",
                opacity: 0.4 + facing * 0.35,
              }} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const magazineRiffleOpen = (
  props: MagazineRiffleOpenProps = {},
): TransitionPresentation<MagazineRiffleOpenProps> => ({
  component: MagazineRiffleOpenComponent,
  props,
});

// Riffle, then dive into the revealed scene (push-in zoom).
export const magazineRiffleZoom = (
  props: Omit<MagazineRiffleOpenProps, "zoom"> = {},
): TransitionPresentation<MagazineRiffleOpenProps> => ({
  component: MagazineRiffleOpenComponent,
  props: { ...props, zoom: true },
});

// ── Magazine Cover Open ──────────────────────────────────────────────────────
// Hero → first interior. The closed cover swings open about its left-edge spine
// like opening a real magazine, revealing the first spread underneath while the
// camera gently pushes in on it. Clean and modern — no grunge/collage textures.
//
// The interior (entering) renders flat underneath (zIndex 1) and zooms from 1.12
// → 1.0. The cover (exiting) rotates on top (zIndex 5) about its spine; once it
// has swung past flat its cream inside-cover shows, then it clears to the left.

type MagazineCoverOpenProps = { accentColor?: string };

const MagazineCoverOpenComponent: React.FC<
  TransitionPresentationComponentProps<MagazineCoverOpenProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = presentationProgress;
  const accent = passedProps.accentColor ?? "#D71921";
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "entering") {
    // The interior spread sits beneath the opening cover; the camera pushes in.
    const zoom = easeSoft(interpolate(p, [0.18, 1], [0, 1], cl));
    const scale = 1.12 - 0.12 * zoom;
    const reveal = interpolate(p, [0.1, 0.34], [0, 1], cl);
    return (
      <AbsoluteFill style={{ backgroundColor: "#0c0b08", zIndex: 1 }}>
        <AbsoluteFill
          style={{
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: "50% 50%",
            opacity: reveal,
            willChange: "transform, opacity",
          }}
        >
          {children}
          {/* soft spine shadow at the binding (left) while the cover is still over it */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: "16%",
              background: `linear-gradient(to right, rgba(0,0,0,${(0.42 * (1 - zoom)).toFixed(3)}) 0%, transparent 100%)`,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // EXITING — the cover swings open about the left spine, painted on top.
  const lift = easeCubic(interpolate(p, [0.1, 0.8], [0, 1], cl));
  const antic = interpolate(p, [0, 0.1], [0, -4], cl); // small pre-lift
  const angle = lift * -162 + antic; // 0° closed → ~-162° fully open
  const settle = Math.sin(Math.min(1, lift) * Math.PI);
  const sheen = interpolate(p, [0.12, 0.45, 0.78], [0, 0.5, 0], cl);

  return (
    <AbsoluteFill
      style={{
        zIndex: 5,
        perspective: "2200px",
        perspectiveOrigin: "0% 50%",
        pointerEvents: "none",
        backgroundColor: "transparent",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transformOrigin: "left center",
          transform: `rotateY(${angle.toFixed(2)}deg)`,
          willChange: "transform",
          boxShadow: `0 ${(24 + settle * 60).toFixed(0)}px ${(60 + settle * 90).toFixed(0)}px rgba(0,0,0,${(0.2 + settle * 0.32).toFixed(3)})`,
        }}
      >
        {/* FRONT — the cover (hero scene) */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", overflow: "hidden" }}>
          {children}
          {/* binding crease at the spine (left) */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "8%", background: "linear-gradient(to right, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.06) 40%, transparent 100%)", pointerEvents: "none" }} />
          {/* moving sheen across the cover as it lifts */}
          <AbsoluteFill style={{ background: `linear-gradient(115deg, transparent 35%, rgba(255,255,255,${sheen.toFixed(3)}) 50%, transparent 65%)`, pointerEvents: "none" }} />
          {/* the free (right) edge darkens as it turns away */}
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "30%", background: `linear-gradient(to left, rgba(0,0,0,${(lift * 0.4).toFixed(3)}) 0%, transparent 100%)`, pointerEvents: "none" }} />
        </div>
        {/* BACK — clean cream inside-cover */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            overflow: "hidden",
            background: "linear-gradient(to left, #FBFAF7 0%, #F0EEE8 60%, #E4E1D8 100%)",
          }}
        >
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "10%", background: "linear-gradient(to left, rgba(0,0,0,0.22) 0%, transparent 100%)" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", width: "44%", height: 3, background: accent, opacity: 0.5, transform: "translate(-50%,-50%)" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const magazineCoverOpen = (
  props: MagazineCoverOpenProps = {},
): TransitionPresentation<MagazineCoverOpenProps> => ({
  component: MagazineCoverOpenComponent,
  props,
});
