import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useVideoConfig } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { QuoteGlyph } from "../magazineStyle";

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

// Warm dark "table" tone behind turning pages, matching the scenes' DeskBackdrop
// so transitions read as pages turning on the same lamp-lit table — not a flash
// of white void between scenes.
const TABLE_BG = "#17120c";

// ── Glossy Page Flip ────────────────────────────────────────────────────────
// Zoom out → settle → a real page turns over → zoom in.
// The old scene shrinks to a bordered paper card on a medium-grey surface (so a
// white page is clearly visible against it). After a beat, a NEW page swings in,
// hinged at the left like a real magazine page: its blank back faces us while it
// is folded open, then it rotates flat to reveal the new scene. The leading edge
// catches a shadow throughout so the whole turn is readable. Finally it zooms in.
//
// Timeline (progress):
//   0.00–0.22  exiting zooms out 1 → CARD
//   0.22–0.45  stillness
//   0.45–0.82  entering page turns in (-165° → 0°) over the old card
//   0.82–0.88  stillness
//   0.88–1.00  entering zooms in CARD → 1

type GlossyPageFlipProps = {
  direction: "forward" | "backward";
  accentColor?: string;
};

const GLOSSY_CARD = 0.82;
const GLOSSY_BACKDROP =
  "radial-gradient(ellipse at 54% 30%, #3a322a 0%, #251f19 52%, #15110b 100%)";

const GlossyPageFlipComponent: React.FC<
  TransitionPresentationComponentProps<GlossyPageFlipProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // The incoming page fully covers the old card by ~0.78; after that just hold.
    const zo = easeSoft(interpolate(p, [0, 0.22], [0, 1], cl));
    const scale = 1 - (1 - GLOSSY_CARD) * zo;
    return (
      <AbsoluteFill style={{ background: GLOSSY_BACKDROP }}>
        <AbsoluteFill style={{ transform: `scale(${scale.toFixed(4)})`, transformOrigin: "center center" }}>
          <AbsoluteFill style={{
            border: "1px solid rgba(0,0,0,0.16)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
            overflow: "hidden",
            borderRadius: 4,
          }}>
            {children}
          </AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // ENTERING — wait, then turn the new page in over the old card.
  if (p < 0.45) return <AbsoluteFill style={{ pointerEvents: "none" }} />;

  const bdAlpha = interpolate(p, [0.43, 0.52], [0, 1], cl);
  const flip = easeSoft(interpolate(p, [0.45, 0.82], [0, 1], cl));
  const angle = (1 - flip) * -165; // -165° (folded open, back showing) → 0° (flat)
  const zin = easeSoft(interpolate(p, [0.88, 1.0], [0, 1], cl));
  const scale = GLOSSY_CARD + (1 - GLOSSY_CARD) * zin;
  // Edge shadow peaks mid-turn (page perpendicular to the lens).
  const edgeDark = Math.sin(Math.min(1, Math.abs(angle) / 165) * Math.PI);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: GLOSSY_BACKDROP, opacity: bdAlpha }} />
      <AbsoluteFill style={{ perspective: "1700px", perspectiveOrigin: "50% 50%" }}>
        <AbsoluteFill style={{ transform: `scale(${scale.toFixed(4)})`, transformOrigin: "center center" }}>
          <div style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transformOrigin: "left center",
            transform: `rotateY(${angle.toFixed(2)}deg)`,
            willChange: "transform",
            boxShadow: `0 ${(20 + edgeDark * 50).toFixed(0)}px ${(50 + edgeDark * 70).toFixed(0)}px rgba(0,0,0,${(0.1 + edgeDark * 0.3).toFixed(3)})`,
          }}>
            {/* FRONT — the new scene, printed on the page */}
            <div style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.16)",
              borderRadius: zin < 1 ? 4 : 0,
            }}>
              {children}
              {/* Leading-edge shading so the turning edge stays visible */}
              <AbsoluteFill style={{
                background: `linear-gradient(to right, rgba(0,0,0,0.06) 0%, transparent 14%, transparent 80%, rgba(0,0,0,${(edgeDark * 0.4).toFixed(3)}) 100%)`,
                pointerEvents: "none",
              }} />
            </div>
            {/* BACK — blank paper, visible while the page is folded open */}
            <div style={{
              position: "absolute",
              inset: 0,
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              overflow: "hidden",
              background: "linear-gradient(to left, #FDFDFD 0%, #F1F1EF 55%, #E4E3E0 100%)",
              border: "1px solid rgba(0,0,0,0.14)",
            }}>
              <Img
                src={staticFile("magazine-collage.avif")}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.12, filter: "grayscale(0.7) brightness(1.06)" }}
              />
              <AbsoluteFill style={{
                background: `linear-gradient(to left, rgba(0,0,0,0.05) 0%, transparent 16%, transparent 80%, rgba(0,0,0,${(edgeDark * 0.34).toFixed(3)}) 100%)`,
                pointerEvents: "none",
              }} />
            </div>
          </div>
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
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, perspective: "1400px" }}>
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
    <AbsoluteFill style={{ perspective: "1200px", perspectiveOrigin: "55% 50%", overflow: "hidden", backgroundColor: TABLE_BG }}>
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
              rgba(255,242,222,${shimmerIntensity}) ${shimmerPos.toFixed(1)}%,
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
    const opacity = 1 - p;
    // Blur filter + a grayscale full-screen multiply-blend flash removed — both
    // were very costly to paint each transition frame. Scale + fade carry it.
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>
        <AbsoluteFill
          style={{
            transform: `scale(${scale})`,
            opacity,
            willChange: "transform, opacity",
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const scale = interpolate(p, [0, 1], [1.04, 1.0]);
  const opacity = interpolate(presentationProgress, [0, 0.35], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>
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
                background: `linear-gradient(${140 + ease(page2Progress) * 40}deg, transparent 20%, rgba(255,255,255,0.28) 50%, transparent 80%)`,
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
                background: `linear-gradient(${130 + ease(page1Progress) * 50}deg, transparent 15%, rgba(255,255,255,0.32) 40%, transparent 65%)`,
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
      <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>
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
    <AbsoluteFill style={{ backgroundColor: TABLE_BG, perspective: 1400 }}>
      <AbsoluteFill style={{
        background: "radial-gradient(ellipse at 54% 40%, #3a322a 0%, #251f19 52%, #15110b 100%)",
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
      <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>
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
    <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>
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
    <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>
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
    <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>
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
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, perspective: "1600px" }}>
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
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, perspective: "1600px" }}>
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
  // Moving crinkle shimmer for fold-over
  const shimPos = interpolate(raw, [0.05, 0.75], [94, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shimIntensity = (lift * 0.36).toFixed(3);

  return (
    <AbsoluteFill style={{ perspective: "2000px", perspectiveOrigin: "50% 50%", overflow: "hidden", backgroundColor: TABLE_BG }}>
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
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, perspective: "1600px" }}>
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
    <AbsoluteFill style={{ backgroundColor: TABLE_BG, overflow: "hidden" }}>
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
            background: `rgba(0,0,0,${(lift * 0.18).toFixed(3)})`,
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
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, perspective: "1600px" }}>
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
    <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>
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
    // New scene rises from below with a camera swing: tilted down → flat.
    const tiltX = interpolate(raw, [0, 0.85], [-10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const tiltY = interpolate(raw, [0, 0.85], [6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const camScale = interpolate(raw, [0, 0.85], [1.10, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const slideY = interpolate(easeCubic(raw), [0, 1], [60, 0]);
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, perspective: "1200px", perspectiveOrigin: "60% 30%" }}>
        <AbsoluteFill style={{
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${camScale}) translateY(${slideY}px)`,
          transformStyle: "preserve-3d",
        }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // Phase 1 (0–0.15): the corner curl lifts — small triangle peels up.
  // Phase 2 (0.15–0.85): the peel sweeps diagonally across the page.
  // Phase 3 (0.85–1): page finishes rotating away.

  const peelStart = 0.10;
  const peelEnd = 0.90;
  const peelT = interpolate(raw, [peelStart, peelEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const peelEased = easeCubic(peelT);

  // Diagonal fold line: x + y = C. C starts at W+H (just the corner) and
  // sweeps to 0 (whole page peeled). The fold runs from top-right to bottom-left.
  const C = interpolate(peelEased, [0, 1], [W + H, -W * 0.15]);

  // Corner curl grows in phase 1 before the full peel starts.
  const curlGrow = interpolate(raw, [0, peelStart], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const curlSize = 80 + curlGrow * 120;

  // Helper: px point → "x% y%" for clip-path.
  const pc = (x: number, y: number) => `${((x / W) * 100).toFixed(2)}% ${((y / H) * 100).toFixed(2)}%`;

  // Remaining (un-peeled) outgoing page = half-plane x + y <= C.
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

  // Flap = peeled region (x + y >= C). Reflected across x + y = C:
  // (x,y) → (C - y, C - x). CSS matrix(0, -1, -1, 0, C, C).
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

  // Camera tilts to follow the peel — looks down at the top-right corner.
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
      backgroundColor: TABLE_BG,
      transform: `rotateX(${camTiltX}deg) rotateY(${camTiltY}deg)`,
      transformStyle: "preserve-3d",
    }}>
      {/* Flat remaining portion of the outgoing page */}
      {peelEased < 0.99 && (
        <AbsoluteFill style={{ clipPath: remaining, WebkitClipPath: remaining }}>
          {children}
          {/* Static corner curl (shrinks as the peel takes over) */}
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

      {/* Shadow the flap casts onto the surface below */}
      {peelEased > 0.02 && peelEased < 0.98 && (
        <AbsoluteFill style={{
          clipPath: flapClip,
          WebkitClipPath: flapClip,
          transform: "translate(-10px, 10px)",
          background: `rgba(0,0,0,${shadowAlpha})`,
          pointerEvents: "none",
        }} />
      )}

      {/* The peeled flap — reflected outgoing content (page underside) */}
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

      {/* Cylindrical curl tube running along the diagonal fold line */}
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

      {/* Accent line along the fold for brand colour pop */}
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

  // Outgoing scene sits underneath; the pages sweep over it.
  if (presentationDirection === "exiting") {
    return <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>{children}</AbsoluteFill>;
  }

  // The band of big pages travels right → left across the frame — eased softly
  // (sine in/out) so it glides rather than snaps.
  const sweep = easeSoft(interpolate(p, [0.04, 0.84], [0, 1], clampOpts));
  // New scene fades up behind the band as it passes.
  const newAppear = interpolate(p, [0.4, 0.62], [0, 1], clampOpts);
  // Optional push-in on the revealed scene — the "dive into the page".
  const zoomT = easeSoft(interpolate(p, [0.42, 1], [0, 1], clampOpts));
  const zoomScale = zoom ? interpolate(zoomT, [0, 1], [1.18, 1.0]) : 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* New scene, revealed as the ruffle clears (and optionally pushing in) */}
      <AbsoluteFill style={{ opacity: newAppear, transform: `scale(${zoomScale.toFixed(4)})`, transformOrigin: "50% 50%", willChange: "transform, opacity" }}>
        {children}
      </AbsoluteFill>

      {/* Smooth riffle of big clean pages filling the frame */}
      <AbsoluteFill style={{ perspective: "1600px", overflow: "hidden" }}>
        {Array.from({ length: RIFFLE_PAGES }).map((_, i) => {
          const startX = 100 + i * 12;           // tighter, denser stagger
          const x = startX - sweep * 320;         // travels fully off to the left
          if (x < -95 || x > 135) return null;    // skip pages outside the frame
          const centerX = x + 30;
          const tilt = (centerX - 50) * 0.5;      // gentle curve toward the spine
          const flutter = Math.sin(sweep * Math.PI * 2.4 + i * 0.7) * 6; // softer flutter
          const bob = Math.cos(sweep * Math.PI * 2.0 + i * 0.5) * 1.6;   // subtle vertical bob
          const rot = tilt + flutter;
          const facing = 1 - Math.min(1, Math.abs(rot) / 90);
          // Per-page edge fade so pages glide in/out instead of popping.
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
              {/* thin top edge alternating sides */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: i % 2 === 0 ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.035)" }} />
              {Array.from({ length: 6 }).map((_, k) => (
                <div key={k} style={{ position: "absolute", left: "16%", right: "16%", top: `${22 + k * 11}%`, height: 2, background: "rgba(0,0,0,0.045)" }} />
              ))}
              {/* Soft cylindrical curl shading — lighter, cleaner */}
              <AbsoluteFill style={{
                background: `linear-gradient(to right,
                  rgba(0,0,0,0.20) 0%,
                  rgba(0,0,0,0.02) 16%,
                  rgba(255,255,255,0.40) 42%,
                  rgba(255,255,255,0.08) 62%,
                  rgba(0,0,0,0.05) 86%,
                  rgba(0,0,0,0.22) 100%)`,
                pointerEvents: "none",
                opacity: 0.3 + facing * 0.25,
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

// ── Zoom-Blur Dive ───────────────────────────────────────────────────────────
// The outgoing page zooms all the way IN while going softly out of focus and
// fading away; the new scene then opens by zooming OUT — resolving from a light
// blur to a crisp page — and tilts on its paper plane before aligning flat, so
// it reads as the page settling into view rather than a hard cut.
//
// Timeline (progress):
//   exiting   0.00–0.60  scale 1 → 1.6, blur 0 → 6px, opacity 1 → 0
//   entering  0.20–1.00  scale 1.5 → 1.0, blur 6 → 0px; opacity in by 0.40;
//                        rotateX 8° / rotateY -5° → 0° (paper aligns flat)

type ZoomBlurDiveProps = { accentColor?: string };

const ZoomBlurDiveComponent: React.FC<
  TransitionPresentationComponentProps<ZoomBlurDiveProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // Zoom into the page while it softly blurs. The zoom keeps it covering the
    // whole frame, so it holds opaque until the incoming page has covered the
    // frame, then fades — no opaque dark fill, so no black gap shows through.
    const z = ease(interpolate(p, [0, 0.75], [0, 1], cl));
    const scale = 1 + z * 0.9; // 1 → 1.9 (zoom all the way in)
    const opacity = 1 - ease(interpolate(p, [0.55, 0.8], [0, 1], cl));
    // Per-frame full-frame blur() removed — re-blurring a 1.9×-upscaled full
    // frame every frame saturated the live-preview compositor (whole-page jank).
    // Scale + fade carry the "dive" exactly as magazineZoom does.
    return (
      <AbsoluteFill>
        <AbsoluteFill
          style={{
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: "center center",
            opacity: opacity.toFixed(3),
            willChange: "transform, opacity",
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // ENTERING — the new page dives out of the blur, tilts on its paper plane,
  // then aligns flat as it settles to rest.
  const r = ease(interpolate(p, [0.25, 1], [0, 1], cl));
  const scale = 1.8 - r * 0.8; // 1.8 → 1.0 (zoom out to rest)
  const opacity = interpolate(p, [0.25, 0.52], [0, 1], cl);
  const tiltX = (1 - r) * 10; // paper tips toward the lens, then aligns
  const tiltY = (1 - r) * -6;

  // Transparent container (no opaque dark fill): the incoming page zooms out and
  // crossfades over the still-covering outgoing page. Per-frame full-frame blur()
  // removed (live-preview compositor cost); the zoom-out + fade carry the dive.
  return (
    <AbsoluteFill style={{ perspective: "1600px" }}>
      <AbsoluteFill
        style={{
          transform: `rotateX(${tiltX.toFixed(3)}deg) rotateY(${tiltY.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
          transformOrigin: "center center",
          transformStyle: "preserve-3d",
          opacity: opacity.toFixed(3),
          willChange: "transform, opacity",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const zoomBlurDive = (
  props: ZoomBlurDiveProps = {},
): TransitionPresentation<ZoomBlurDiveProps> => ({
  component: ZoomBlurDiveComponent,
  props,
});

// ── Single Page Turn → Zoom-In ──────────────────────────────────────────────
// One full page turn that the viewer watches end-to-end, then the next scene
// zooms in from inside the frame and crossfades over it.
//   exiting   0.00–0.50  the whole page turns 0° → 180° about its left edge
//                        (front = outgoing scene, back = blank paper), then
//             0.50–0.72  the turned page fades away
//   entering  0.45–1.00  scale 0.80 → 1.0 (zooms in from inside the screen)
//             0.50–0.88  opacity 0 → 1 (crossfades in after the turn)

type SinglePageTurnZoomProps = { accentColor?: string };

const SinglePageTurnZoomComponent: React.FC<
  TransitionPresentationComponentProps<SinglePageTurnZoomProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = presentationProgress;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const accent = passedProps?.accentColor ?? "#D71921";

  if (presentationDirection === "entering") {
    // The next scene grows out of the centre and fades in as the page turns
    // away — "zooming inside the screen". The fade is brought forward so the
    // incoming page covers the frame early; no dark TABLE_BG fill here, so it
    // composites directly over the still-present (turning) outgoing page rather
    // than over a dark slab that would read as a "break".
    const z = easeSoft(interpolate(p, [0.3, 0.85], [0, 1], cl));
    const scale = 0.8 + z * 0.2; // 0.80 → 1.0
    const opacity = interpolate(p, [0.3, 0.65], [0, 1], cl);
    return (
      <AbsoluteFill>
        <AbsoluteFill
          style={{
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: "center center",
            opacity: opacity.toFixed(3),
            willChange: "transform, opacity",
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // EXITING — the full single page turn (watch the whole page rotate away),
  // then fade the turned leaf out so the zooming-in scene takes over.
  const turn = easeCubic(interpolate(p, [0, 0.5], [0, 1], cl));
  const angle = turn * 180;
  const lift = Math.sin(Math.min(1, turn) * Math.PI);
  const pageOpacity = 1 - ease(interpolate(p, [0.5, 0.72], [0, 1], cl));
  const shadowBlur = (22 + lift * 70).toFixed(1);
  const shadowAlpha = (lift * 0.5).toFixed(3);
  const bowDark = (0.08 + lift * 0.34).toFixed(3);
  const ridge = (38 + turn * 44).toFixed(0);
  const shimPos = interpolate(p, [0.03, 0.5], [94, 6], cl);
  const shimIntensity = (lift * 0.36).toFixed(3);

  return (
    // No full-frame TABLE_BG: the exiting layer sits ON TOP of the entering one,
    // so a dark fill would hide the incoming page behind a brown slab once the
    // turned leaf has faded out. Transparent backing lets the zooming-in scene
    // read through behind the turn.
    <AbsoluteFill style={{ perspective: "2000px", perspectiveOrigin: "50% 50%", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transformOrigin: "left center",
          transform: `rotateY(${angle.toFixed(2)}deg)`,
          opacity: pageOpacity.toFixed(3),
          willChange: "transform, opacity",
        }}
      >
        {/* FRONT = outgoing scene */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", overflow: "hidden", boxShadow: `0 18px ${shadowBlur}px rgba(0,0,0,${shadowAlpha})` }}>
          {children}
          {/* Spine crease at the hinge, tinted with the accent */}
          <AbsoluteFill style={{
            background: `linear-gradient(to right, ${accent}22 0%, rgba(0,0,0,0.05) 2.5%, transparent 6%)`,
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
          {/* Moving crinkle shimmer travelling across as the page lifts */}
          <AbsoluteFill style={{
            background: `linear-gradient(to right,
              transparent ${Math.max(0, shimPos - 9).toFixed(1)}%,
              rgba(255,255,255,${shimIntensity}) ${shimPos.toFixed(1)}%,
              transparent ${Math.min(100, shimPos + 9).toFixed(1)}%)`,
            pointerEvents: "none",
          }} />
        </div>
        {/* BACK = blank paper, revealed once the page passes 90° */}
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
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2, filter: "grayscale(0.6) brightness(1.05)" }}
          />
          <AbsoluteFill style={{
            background: "linear-gradient(to right, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.10) 5%, rgba(0,0,0,0.02) 20%, transparent 50%)",
            pointerEvents: "none",
          }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const singlePageTurnZoom = (
  props: SinglePageTurnZoomProps = {},
): TransitionPresentation<SinglePageTurnZoomProps> => ({
  component: SinglePageTurnZoomComponent,
  props,
});

// ── Pull-Quote Reveal ────────────────────────────────────────────────────────
// The signature move for the editorial pull-quote. A bright accent band sweeps
// across the frame from left to right; the outgoing page is wiped away in front
// of it while the new page is uncovered in its wake — a clean editorial reveal
// that echoes the quote page's own accent rail. Pure clip-path + transform, so
// it stays cheap to paint (no per-frame blur or blend).
//
// At progress x the band sits at x across the frame: the new (entering) page
// shows in [0, x], the old (exiting) page shows in [x, 1], and the accent line
// rides the seam between them.

type PullQuoteRevealProps = { accentColor?: string };

const PullQuoteRevealComponent: React.FC<
  TransitionPresentationComponentProps<PullQuoteRevealProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#E63946";
  const raw = presentationProgress;
  const p = ease(raw);
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // Old page is hidden left→right, in lockstep with the incoming reveal. No
    // full-frame TABLE_BG fill: the exiting layer renders ON TOP of the entering
    // one, so a dark fill here would mask the new page behind a brown slab for
    // the whole wipe. Leaving it transparent lets the revealed-in page show
    // through the wiped region.
    const insetLeft = (p * 100).toFixed(2);
    const scale = 1 - 0.04 * p;
    return (
      <AbsoluteFill>
        <AbsoluteFill
          style={{
            clipPath: `inset(0 0 0 ${insetLeft}%)`,
            WebkitClipPath: `inset(0 0 0 ${insetLeft}%)`,
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: "center center",
            willChange: "clip-path, transform",
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // ENTERING — the new page is uncovered left→right; it settles from a small
  // overscale to rest. A glowing accent band rides the reveal edge. Transparent
  // backing so the still-present exiting page shows in the not-yet-revealed area.
  const revealRight = ((1 - p) * 100).toFixed(2);
  const scale = 1.04 - 0.04 * p;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          clipPath: `inset(0 ${revealRight}% 0 0)`,
          WebkitClipPath: `inset(0 ${revealRight}% 0 0)`,
          transform: `scale(${scale.toFixed(4)})`,
          transformOrigin: "center center",
          willChange: "clip-path, transform",
        }}
      >
        {children}
      </AbsoluteFill>
      {raw < 0.99 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${(p * 100).toFixed(2)}%`,
            width: 10,
            marginLeft: -5,
            background: accent,
            boxShadow: `0 0 22px ${accent}`,
            opacity: interpolate(raw, [0, 0.08, 0.92, 1], [0, 1, 1, 0], cl),
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export const pullQuoteReveal = (
  props: PullQuoteRevealProps = {},
): TransitionPresentation<PullQuoteRevealProps> => ({
  component: PullQuoteRevealComponent,
  props,
});

// ── Quote Drop Reveal (editorial pull-quote EXIT) ────────────────────────────
// The signature move when LEAVING the editorial pull-quote. The oversized accent
// quotation mark enlarges and swipes down off the bottom of the page; then the
// next scene slides straight down into place from the top, settling to cover the
// quote page. Two clean phases on the progress timeline:
//   exiting  (quote page held still; an accent glyph overlay matched to the
//             page's own resting mark)
//     0.00–0.45  glyph scales 1 → ~3.2 (enlarge), brightening over the page mark
//     0.18–0.55  glyph translates down past the bottom edge (swipes off-page)
//   entering (the next scene, rendered ON TOP of the exiting page)
//     0.00–0.45  held off-screen above (translateY -100%)
//     0.45–1.00  slides down -100% → 0; a soft shadow rides its leading edge
// Transform/opacity/shadow only — no per-frame blur or blend, so it stays cheap.

type QuoteDropRevealProps = { accentColor?: string };

const QuoteDropRevealComponent: React.FC<
  TransitionPresentationComponentProps<QuoteDropRevealProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#E63946";
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const { width, height } = useVideoConfig();
  const portrait = height >= width;

  if (presentationDirection === "exiting") {
    // The quote page holds still; an accent quote mark — sized/anchored to match
    // EditorialQuote's own resting glyph — grows, then drops off the bottom edge.
    const p = ease(presentationProgress);
    const glyphSize = portrait ? 320 : 520;
    const scale = interpolate(p, [0, 0.45], [1, 3.2], cl);
    // Glyph origin is its top-left; push it well past the bottom so it clears.
    const dropY = interpolate(p, [0.18, 0.55], [0, height * 1.2], cl);
    // Fade up over the page's own faint mark, then fade out as it swipes away.
    const glyphOpacity = interpolate(p, [0, 0.12, 0.45, 0.55], [0, 0.95, 0.95, 0], cl);
    return (
      <AbsoluteFill>
        {children}
        <QuoteGlyph
          color={accent}
          size={glyphSize}
          opacity={glyphOpacity}
          style={{
            position: "absolute",
            top: portrait ? "2%" : "0%",
            left: portrait ? "4%" : "5%",
            transform: `translateY(${dropY.toFixed(1)}px) scale(${scale.toFixed(3)})`,
            transformOrigin: "top left",
            willChange: "transform, opacity",
          }}
        />
      </AbsoluteFill>
    );
  }

  // ENTERING — the next scene drops straight down from above. It renders on top
  // of the (still-present) quote page, so its opaque MagazinePage covers it as it
  // descends. Held off-screen until the glyph has swiped clear (~0.45).
  const slide = ease(interpolate(presentationProgress, [0.45, 1], [0, 1], cl));
  const translateY = -100 * (1 - slide); // -100% → 0
  return (
    <AbsoluteFill style={{ transform: `translateY(${translateY.toFixed(3)}%)`, willChange: "transform" }}>
      {children}
      {slide > 0.001 && slide < 0.999 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            height: 64,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.32), rgba(0,0,0,0))",
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export const quoteDropReveal = (
  props: QuoteDropRevealProps = {},
): TransitionPresentation<QuoteDropRevealProps> => ({
  component: QuoteDropRevealComponent,
  props,
});

// ── Slide-Down Reveal ───────────────────────────────────────────────────────
// The outgoing page holds still while the NEXT scene drops straight down from
// above, its opaque page sheet covering the old one as it descends — the incoming
// scene is "revealed" by sliding into place from the top. No glyph, blur or page
// flip, so it reads clean after any page (used leaving the by-the-numbers stats
// page). This is the entering half of quoteDropReveal, generalised.
type SlideDownRevealProps = Record<string, never>;

const SlideDownRevealComponent: React.FC<
  TransitionPresentationComponentProps<SlideDownRevealProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  if (presentationDirection === "exiting") {
    // The outgoing page simply holds still; the descending scene covers it.
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  // ENTERING — the next scene slides down from above into place. It renders on top
  // of the (still-present) outgoing page, so its opaque MagazinePage covers it as
  // it descends.
  const slide = ease(presentationProgress);
  const translateY = -100 * (1 - slide); // -100% (off the top) → 0
  return (
    <AbsoluteFill style={{ transform: `translateY(${translateY.toFixed(3)}%)`, willChange: "transform" }}>
      {children}
      {slide > 0.001 && slide < 0.999 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            height: 64,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.32), rgba(0,0,0,0))",
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export const slideDownReveal = (): TransitionPresentation<SlideDownRevealProps> => ({
  component: SlideDownRevealComponent,
  props: {},
});

// ── Masking Zoom (feature-spread exit) ──────────────────────────────────────
// The feature page zooms INTO its red drop-cap initial, then the next scene is
// teasingly revealed by zooming back out of that same point. Only transform +
// opacity animate (no blur/shadow/blend) so the per-frame paint stays cheap.
//   exiting   0.00–0.62  scale 1 → ~6, origin on the drop-cap, holds opaque,
//                        then fades only at the very end (0.5–0.62)
//   entering  0.30–1.00  scale ~6 → 1 from the same origin (slow ease-out tail
//                        => the "very smooth, teasing" reveal), opacity 0→1 early

type MaskingZoomProps = { accentColor?: string };

// Drop-cap location in the no-image landscape feature (left page): the red
// initial leads the body, roughly 8% from the left and ~46% down. Both sides
// share this origin so the next scene unfolds from where the letter was,
// keeping the zoom-in → zoom-out reveal continuous.
const MASKING_FOCAL = "8% 46%";

const MASKING_PEAK = 4; // how far we push into the drop-cap before the swap

// IMPORTANT: transparent containers + opacity-on-the-transformed-element, exactly
// like zoomBlurDive. An opaque background / `overflow:hidden` on the wrapper
// collapses the scene's 3D-perspective content to nothing (the page vanished and
// only the fill showed). Both layers always cover the frame (scale ≥ 1), and the
// incoming reaches full opacity (on top) before the outgoing is hidden, so there
// is never a gap — no fill is needed.
const MaskingZoomComponent: React.FC<
  TransitionPresentationComponentProps<MaskingZoomProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // Push into the drop-cap. Stays fully opaque the whole time — it sits BELOW
    // the incoming layer, which covers it from on top once the swap completes.
    const z = ease(interpolate(p, [0, 0.5], [0, 1], cl));
    const scale = 1 + z * (MASKING_PEAK - 1); // 1 → PEAK
    return (
      <AbsoluteFill>
        <AbsoluteFill
          style={{
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: MASKING_FOCAL,
            willChange: "transform",
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // ENTERING — reveal the next scene by zooming OUT of the same focal point.
  // Fades in (on top) at the peak-zoom swap, then a slow easeSoft pull-out gives
  // the smooth, teasing reveal.
  const opacity = interpolate(p, [0.45, 0.55], [0, 1], cl); // 0 → 1 at the swap
  const r = easeSoft(interpolate(p, [0.5, 1], [0, 1], cl));
  const scale = MASKING_PEAK - r * (MASKING_PEAK - 1); // PEAK → 1
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `scale(${scale.toFixed(4)})`,
          transformOrigin: MASKING_FOCAL,
          opacity: opacity.toFixed(3),
          willChange: "transform, opacity",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const maskingZoom = (
  props: MaskingZoomProps = {},
): TransitionPresentation<MaskingZoomProps> => ({
  component: MaskingZoomComponent,
  props,
});
