import React from "react";
import { AbsoluteFill, interpolate, staticFile } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { OptionalImg, QuoteGlyph, useMagDims } from "../magazineStyle";

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

// Warm dark "table" tone behind turning pages. Kept EXACTLY equal to MAG_BACKDROP
// (the black-bridge fill in the composition) so every dark surface in the deck — the
// bridge and any desk a presentation paints — is one consistent colour, with no
// tone-step "pop" at a transition seam.
const TABLE_BG = "#14120E"; // === MAG_BACKDROP in magazineStyle.tsx

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
              <OptionalImg
                src={staticFile("magazine-collage.png")}
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
          <OptionalImg
            src={staticFile("magazine-collage.png")}
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
              <OptionalImg
                src={staticFile("magazine-collage.png")}
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
              <OptionalImg
                src={staticFile("magazine-collage.png")}
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
                <OptionalImg
                  src={staticFile("magazine-collage.png")}
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
          <OptionalImg
            src={staticFile("magazine-collage.png")}
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
          <OptionalImg
            src={staticFile("magazine-collage.png")}
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
  const { width: W, height: H } = useMagDims();
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
  const entering = presentationDirection === "entering";

  if (entering) {
    // Page slides in from the right as a clean horizontal push — pure transform,
    // transparent backing so the outgoing page shows through underneath. No 3D
    // tilt and no dark table bg, so nothing black ever peeks at the seam.
    return (
      <AbsoluteFill style={{ backgroundColor: "transparent", zIndex: 2 }}>
        <AbsoluteFill
          style={{
            transform: `translateX(${((1 - p) * 100).toFixed(3)}%)`,
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
    <AbsoluteFill style={{ backgroundColor: "transparent", zIndex: 1 }}>
      <AbsoluteFill
        style={{
          transform: `translateX(${(-p * 100).toFixed(3)}%)`,
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
  const { width: W, height: H } = useMagDims();
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

const RIFFLE_PAGES = 6;

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
  // New scene fades up behind the band as it passes — early, so no dark gap shows.
  const newAppear = interpolate(p, [0.28, 0.5], [0, 1], clampOpts);
  // Optional push-in on the revealed scene — the "dive into the page".
  const zoomT = easeSoft(interpolate(p, [0.42, 1], [0, 1], clampOpts));
  const zoomScale = zoom ? interpolate(zoomT, [0, 1], [1.18, 1.0]) : 1;

  // For the plain riffle (no dive) animate opacity ONLY — never promote a transform
  // layer on the text-heavy page. A transform+willChange layer gets torn down at the
  // handoff to the plain next sequence, re-rasterizing the text → a one-frame flicker
  // ([[magazine-preview-paint-cost]]). The dive variant keeps its push-in scale but
  // drops the transform once it settles so the final frame matches the next sequence.
  let sceneStyle: React.CSSProperties;
  if (!zoom) {
    sceneStyle = { opacity: newAppear };
  } else if (newAppear >= 1 && zoomT >= 1) {
    sceneStyle = { opacity: 1 };
  } else {
    sceneStyle = {
      opacity: newAppear,
      transform: `scale(${zoomScale.toFixed(4)})`,
      transformOrigin: "50% 50%",
      willChange: "transform, opacity",
    };
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", zIndex: 2 }}>
      {/* New scene, revealed as the ruffle clears (and optionally pushing in) */}
      <AbsoluteFill style={sceneStyle}>
        {children}
      </AbsoluteFill>

      {/* Lightweight 2D riffle of clean pages sweeping right→left. No perspective /
          rotateY / images / blur-shadows — only translate + a small 2D rotate — so it
          stays smooth even over the heavy ticker table ([[magazine-preview-paint-cost]]). */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {Array.from({ length: RIFFLE_PAGES }).map((_, i) => {
          const startX = 100 + i * 16;            // staggered start off the right edge
          const x = startX - sweep * 300;         // travels fully off to the left
          if (x < -85 || x > 130) return null;    // skip pages outside the frame
          const bob = Math.cos(sweep * Math.PI * 2.0 + i * 0.5) * 1.4; // subtle vertical bob
          const rot = Math.sin(sweep * Math.PI * 2.0 + i * 0.6) * 4 - 3; // gentle 2D lean
          const edgeFade =
            x < -65 ? interpolate(x, [-85, -65], [0, 1], clampOpts)
            : x > 108 ? interpolate(x, [108, 130], [1, 0], clampOpts)
            : 1;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: `${-12 + bob}%`,
                left: `${x}%`,
                width: "62%",
                height: "124%",
                transformOrigin: "center center",
                transform: `rotate(${rot.toFixed(1)}deg)`,
                opacity: edgeFade,
                zIndex: i,
                background: "#FBFAF7",
                overflow: "hidden",
                borderLeft: "1px solid rgba(0,0,0,0.08)",
                borderRight: "1px solid rgba(0,0,0,0.08)",
                willChange: "transform",
              }}
            >
              {/* hairline text blocks so the sheet reads as a printed page */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(0,0,0,0.05)" }} />
              {Array.from({ length: 6 }).map((_, k) => (
                <div key={k} style={{ position: "absolute", left: "16%", right: "16%", top: `${22 + k * 11}%`, height: 2, background: "rgba(0,0,0,0.05)" }} />
              ))}
              {/* cheap page sheen + edge shading (static 2D linear gradient) */}
              <AbsoluteFill style={{
                background: "linear-gradient(to right, rgba(0,0,0,0.10) 0%, rgba(255,255,255,0.35) 45%, rgba(0,0,0,0.06) 100%)",
                pointerEvents: "none",
                opacity: 0.5,
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
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, zIndex: 1 }}>
        <AbsoluteFill
          style={{
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: "50% 50%",
            willChange: "transform",
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
  const { width, height } = useMagDims();
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

// ── Single Page Turn ─────────────────────────────────────────────────────────
// One clean sheet hinged at the spine swings open to reveal the next scene
// beneath — a "turn to the next page" flip. The OUTGOING scene is printed on the
// FRONT of the turning sheet and painted ON TOP (z-index) so the page genuinely
// lifts away; the INCOMING scene rests flat underneath and eases up from a small
// overscale as the page clears. Built paint-safe (this is the generalised, de-
// shadowed cousin of magazineCoverOpen): baked edge/sheen gradients only — no
// per-frame blur and no animated box-shadow — so it stays smooth in the live
// preview ([[magazine-preview-paint-cost]]). `direction` flips the hinge side:
//   forward → hinge LEFT spine, swings off left (turn to the next page)
//   back    → hinge RIGHT edge, swings off right (turn a page back)

type SinglePageTurnProps = { direction?: "forward" | "back" | "up"; accentColor?: string };
type TurnEdge = "left" | "right" | "top" | "bottom";

const SinglePageTurnComponent: React.FC<
  TransitionPresentationComponentProps<SinglePageTurnProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = presentationProgress;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const accent = passedProps.accentColor ?? "#D71921";
  const dir = passedProps.direction ?? "forward";
  const vertical = dir === "up"; // hinge the BOTTOM edge, sheet turns up about it
  const hingeLeft = dir === "forward";
  const hingeEdge: TurnEdge = vertical ? "bottom" : hingeLeft ? "left" : "right";
  const freeEdge: TurnEdge = vertical ? "top" : hingeLeft ? "right" : "left";
  // A soft gradient band hugging `edge`, fading toward `toward`. Horizontal-hinge
  // turns use vertical strips (full height); the vertical-hinge "up" turn uses
  // horizontal strips (full width).
  const band = (edge: TurnEdge, sizePct: number, toward: TurnEdge, stops: string): React.CSSProperties => ({
    position: "absolute",
    background: `linear-gradient(to ${toward}, ${stops})`,
    pointerEvents: "none",
    ...(vertical ? { left: 0, right: 0, height: `${sizePct}%` } : { top: 0, bottom: 0, width: `${sizePct}%` }),
    [edge]: 0,
  } as React.CSSProperties);

  if (presentationDirection === "entering") {
    // Next scene sits beneath the turning page and eases up to rest. It's revealed
    // by the cover lifting away — not by fading up — and it paints its own opaque
    // page (dark room + sheet + print texture) from frame 0, so it sits on the dark
    // table rather than a beige sheet. (A beige #E8E1D3 backing + an opacity fade-in
    // used to flash a full-frame beige sheet before the page painted in, most
    // visibly entering the editorial pull-quote off the cover page-turn.)
    const zoom = easeSoft(interpolate(p, [0.15, 1], [0, 1], cl));
    const scale = 1.08 - 0.08 * zoom;
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, zIndex: 1 }}>
        <AbsoluteFill
          style={{
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: "50% 50%",
            willChange: "transform",
          }}
        >
          {children}
          {/* soft binding shadow at the spine while the page still covers it */}
          <div style={band(hingeEdge, 16, freeEdge, `rgba(0,0,0,${(0.4 * (1 - zoom)).toFixed(3)}) 0%, transparent 100%`)} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // EXITING — the outgoing scene is the FRONT of a sheet that swings open about
  // the hinge edge, painted on top.
  const lift = easeCubic(interpolate(p, [0.05, 0.82], [0, 1], cl));
  const dirSign = vertical ? -1 : hingeLeft ? -1 : 1; // up + forward swing toward the lens
  const antic = interpolate(p, [0, 0.1], [0, dirSign * 3], cl);
  const angle = dirSign * lift * 158 + antic; // 0° flat → ±158° open
  const sheen = interpolate(p, [0.12, 0.45, 0.78], [0, 0.42, 0], cl);
  const rotate = vertical ? `rotateX(${angle.toFixed(2)}deg)` : `rotateY(${angle.toFixed(2)}deg)`;
  const backFlip = vertical ? "rotateX(180deg)" : "rotateY(180deg)";

  return (
    <AbsoluteFill
      style={{
        zIndex: 5,
        perspective: "2200px",
        perspectiveOrigin: vertical ? "50% 100%" : `${hingeLeft ? 0 : 100}% 50%`,
        pointerEvents: "none",
        backgroundColor: "transparent",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transformOrigin: vertical ? "center bottom" : `${hingeEdge} center`,
          transform: rotate,
          willChange: "transform",
        }}
      >
        {/* FRONT — the outgoing scene printed on the page */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", overflow: "hidden" }}>
          {children}
          {/* spine crease at the hinge */}
          <div style={band(hingeEdge, 8, freeEdge, "rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.05) 45%, transparent 100%")} />
          {/* baked sheen sweeping across as the page lifts */}
          <AbsoluteFill style={{ background: `linear-gradient(115deg, transparent 35%, rgba(255,255,255,${sheen.toFixed(3)}) 50%, transparent 65%)`, pointerEvents: "none" }} />
          {/* free edge darkens as it turns away (replaces an animated box-shadow) */}
          <div style={band(freeEdge, 32, hingeEdge, `rgba(0,0,0,${(lift * 0.42).toFixed(3)}) 0%, transparent 100%`)} />
        </div>
        {/* BACK — warm paper underside, shown once the page passes vertical */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: backFlip,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            overflow: "hidden",
            background: `linear-gradient(to ${freeEdge}, #FBFAF7 0%, #F0EEE8 60%, #E4E1D8 100%)`,
          }}
        >
          <div style={band(freeEdge, 10, hingeEdge, "rgba(0,0,0,0.22) 0%, transparent 100%")} />
          <div style={{ position: "absolute", top: "50%", left: "50%", width: "40%", height: 3, background: accent, opacity: 0.45, transform: "translate(-50%,-50%)" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const singlePageTurn = (
  props: SinglePageTurnProps = {},
): TransitionPresentation<SinglePageTurnProps> => ({
  component: SinglePageTurnComponent,
  props,
});

// ── Page Settle ──────────────────────────────────────────────────────────────
// "Scene comes into view": the next page eases in from a small overscale + slight
// drop and settles flat, like a fresh sheet laid on the desk; the old page eases
// back and fades beneath it. Pure transform + opacity — the cheapest reveal.

type PageSettleProps = Record<string, never>;

const PageSettleComponent: React.FC<
  TransitionPresentationComponentProps<PageSettleProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    const e = ease(p);
    const scale = 1 - 0.03 * e;
    const opacity = interpolate(p, [0.2, 0.8], [1, 0], cl);
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, zIndex: 1 }}>
        <AbsoluteFill style={{ transform: `scale(${scale.toFixed(4)})`, opacity: opacity.toFixed(3), willChange: "transform, opacity" }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const e = ease(p);
  const scale = interpolate(e, [0, 1], [1.05, 1.0]);
  const ty = interpolate(e, [0, 1], [3, 0]);
  const opacity = interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ zIndex: 2 }}>
      <AbsoluteFill style={{ transform: `translateY(${ty.toFixed(2)}%) scale(${scale.toFixed(4)})`, transformOrigin: "50% 50%", opacity: opacity.toFixed(3), willChange: "transform, opacity" }}>
        {children}
        {/* faint top contact shadow as the sheet lays down */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 48, background: "linear-gradient(to bottom, rgba(0,0,0,0.12), transparent)", opacity: (1 - e).toFixed(3), pointerEvents: "none" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const pageSettle = (): TransitionPresentation<PageSettleProps> => ({
  component: PageSettleComponent,
  props: {},
});

// ── Lift Away ────────────────────────────────────────────────────────────────
// The outgoing page lifts off the surface — scales up slightly, drifts up and
// fades — to reveal the next scene resting underneath (which eases gently to
// rest). The old page is painted ON TOP (z-index) so it genuinely lifts away.
// Transform + opacity + one static under-shadow gradient (opacity-animated); no
// blur and no animated box-shadow.

type LiftAwayProps = Record<string, never>;

const LiftAwayComponent: React.FC<
  TransitionPresentationComponentProps<LiftAwayProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "entering") {
    // Next scene rests underneath and eases to its final size.
    const e = ease(interpolate(p, [0.1, 1], [0, 1], cl));
    const scale = interpolate(e, [0, 1], [0.94, 1.0]);
    const opacity = interpolate(p, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, zIndex: 1 }}>
        <AbsoluteFill style={{ transform: `scale(${scale.toFixed(4)})`, transformOrigin: "50% 50%", opacity: opacity.toFixed(3), willChange: "transform, opacity" }}>
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // EXITING — the old page clearly peels up off the desk toward the lens and fades,
  // on top. Big scale + rise + a small tilt so the lift is unmistakable.
  const e = ease(p);
  const scale = 1 + 0.22 * e;
  const ty = -16 * e;
  const rot = -2 * e;
  const opacity = interpolate(p, [0.4, 0.95], [1, 0], cl);
  const shadeOpacity = interpolate(p, [0, 0.6], [0, 1], cl);
  return (
    <AbsoluteFill style={{ zIndex: 5, pointerEvents: "none" }}>
      <AbsoluteFill style={{ transform: `translateY(${ty.toFixed(2)}%) scale(${scale.toFixed(4)}) rotate(${rot.toFixed(2)}deg)`, transformOrigin: "50% 60%", opacity: opacity.toFixed(3), willChange: "transform, opacity" }}>
        {children}
        {/* contact shadow growing under the lifting sheet (static gradient, opacity-animated) */}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 120%, rgba(0,0,0,0.42) 0%, transparent 58%)", opacity: shadeOpacity.toFixed(3), pointerEvents: "none" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const liftAway = (): TransitionPresentation<LiftAwayProps> => ({
  component: LiftAwayComponent,
  props: {},
});

// ── Gatefold Unfold ──────────────────────────────────────────────────────────
// The signature "open the magazine" move off the cover. The cover splits at the
// centre spine into two flaps that swing open outward like a gatefold (double
// doors), revealing the first interior spread resting flat beneath. The interior
// (entering) eases up from a small overscale as the doors clear; the two cover
// flaps (exiting) rotate about their OUTER edges, painted on top, so the cover
// genuinely lifts away and shows its cream inside-cover backs once past vertical.
// Built paint-safe like magazineCoverOpen / singlePageTurn — baked edge/sheen
// gradients only, no per-frame blur and no animated box-shadow
// ([[magazine-preview-paint-cost]]).

type GatefoldUnfoldProps = { accentColor?: string };

const GatefoldUnfoldComponent: React.FC<
  TransitionPresentationComponentProps<GatefoldUnfoldProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = presentationProgress;
  const accent = passedProps.accentColor ?? "#D71921";
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "entering") {
    // The interior spread sits STATIC beneath the opening cover and fades up to rest
    // as the doors swing clear. No scale on the incoming scene — scaling a full
    // preserve-3d page every frame re-rasterizes it and jitters (the same cost that
    // sinks the bento); the swinging doors carry all the motion
    // ([[magazine-preview-paint-cost]]).
    const zoom = easeSoft(interpolate(p, [0.12, 1], [0, 1], cl));
    // The interior starts in the closed cover's shadow and is flooded with light as
    // the doors swing open. Without this the unfold barely reads when both pages are
    // light editorial spreads — the dim gives the bright opening doors contrast.
    const shade = interpolate(p, [0.12, 0.62], [0.16, 0], cl);
    return (
      // Dark bridge-matched backing (was beige #E8E1D3, which flashed a light slab
      // against the black bridge before the page appeared). The page is OPAQUE from
      // frame 0 — it's revealed by the doors opening, not by a fade — so nothing
      // shows behind it.
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, zIndex: 1 }}>
        <AbsoluteFill>
          {children}
          {/* whole-interior shade, lifting as the doors clear (kept light so no black flash) */}
          <AbsoluteFill style={{ backgroundColor: "#000", opacity: shade.toFixed(3), pointerEvents: "none" }} />
          {/* soft centre-spine contact shadow while the flaps still cover it */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "38%",
              width: "24%",
              background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,${(0.5 * (1 - zoom)).toFixed(3)}) 0%, transparent 72%)`,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // EXITING — the cover splits at the centre; the two halves swing open about
  // their OUTER edges, painted on top. The outgoing page is settled/static by now, so
  // each door's FRONT is `contain: paint` → the browser caches it as a single texture
  // and GPU-rotates it, instead of re-rasterizing the full page twice every frame.
  const lift = easeCubic(interpolate(p, [0.05, 0.82], [0, 1], cl));
  const antic = interpolate(p, [0, 0.1], [0, 3], cl); // tiny pre-open settle
  const angle = lift * 165 + antic; // 0° closed → ~165° open (per flap)

  return (
    <AbsoluteFill
      style={{
        zIndex: 5,
        perspective: "2200px",
        perspectiveOrigin: "50% 50%",
        pointerEvents: "none",
        backgroundColor: "transparent",
      }}
    >
      {(["left", "right"] as const).map((side) => {
        const isLeft = side === "left";
        const dir = isLeft ? -1 : 1; // left door swings −, right door swings +
        const hinge: "left" | "right" = isLeft ? "left" : "right";
        const free: "left" | "right" = isLeft ? "right" : "left";
        return (
          <div
            key={side}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "50%",
              ...(isLeft ? { left: 0 } : { left: "50%" }),
              transformStyle: "preserve-3d",
              transformOrigin: `${hinge} center`,
              transform: `rotateY(${(dir * angle).toFixed(2)}deg)`,
              willChange: "transform",
            }}
          >
            {/* FRONT — this half of the cover (contain:paint so the static settled
                page caches as one texture and the door just GPU-rotates it) */}
            <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", overflow: "hidden", contain: "paint" }}>
              {/* full-frame cover, offset so each flap shows its own half */}
              <div style={{ position: "absolute", top: 0, bottom: 0, width: "200%", left: isLeft ? 0 : "-100%" }}>
                {children}
              </div>
              {/* binding crease at the outer hinge edge */}
              <div style={{ position: "absolute", top: 0, bottom: 0, width: "10%", background: `linear-gradient(to ${free}, rgba(0,0,0,0.24) 0%, rgba(0,0,0,0.05) 45%, transparent 100%)`, pointerEvents: "none", ...(isLeft ? { left: 0 } : { right: 0 }) }} />
              {/* free (centre) edge: a seam when closed that darkens as it turns away —
                  kept strong so each door reads as a distinct panel over a light interior */}
              <div style={{ position: "absolute", top: 0, bottom: 0, width: "40%", background: `linear-gradient(to ${hinge}, rgba(0,0,0,${(0.16 + lift * 0.5).toFixed(3)}) 0%, transparent 100%)`, pointerEvents: "none", ...(isLeft ? { right: 0 } : { left: 0 }) }} />
            </div>
            {/* BACK — clean cream inside-cover, shown once the door passes vertical */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: "rotateY(180deg)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                overflow: "hidden",
                background: `linear-gradient(to ${free}, #FBFAF7 0%, #F0EEE8 60%, #E4E1D8 100%)`,
              }}
            >
              <div style={{ position: "absolute", top: 0, bottom: 0, width: "10%", background: `linear-gradient(to ${hinge}, rgba(0,0,0,0.22) 0%, transparent 100%)`, ...(isLeft ? { right: 0 } : { left: 0 }) }} />
              <div style={{ position: "absolute", top: "50%", left: "50%", width: "44%", height: 3, background: accent, opacity: 0.45, transform: "translate(-50%,-50%)" }} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const gatefoldUnfold = (
  props: GatefoldUnfoldProps = {},
): TransitionPresentation<GatefoldUnfoldProps> => ({
  component: GatefoldUnfoldComponent,
  props,
});

// ── Contact-Sheet / Bento Zoom ───────────────────────────────────────────────
// The outgoing scene zooms OUT into one cell of a 3×3 paper contact sheet (the
// other cells are baked cream "pages"); the grid holds for a beat, then a shared
// virtual camera DIVES into the centre cell — which holds the next scene — until
// it fills the frame. Both transition halves compute the SAME camera transform
// from progress, so the two scenes line up in the grid. The sheet is 300%×300%
// so each 1/3 cell is exactly frame-sized and scenes render at native size (text
// stays crisp). Paint-safe: transforms + opacity + baked gradients only — no
// per-frame blur/blend/animated shadow ([[magazine-preview-paint-cost]]).

type ContactSheetZoomProps = { accentColor?: string };

// Every cell except the old-scene cell (0,0) and the new-scene cell (1,1).
const BENTO_DECOR_CELLS: Array<[number, number]> = [
  [1, 0], [2, 0],
  [0, 1], [2, 1],
  [0, 2], [1, 2], [2, 2],
];

const bentoCellStyle = (c: number, r: number): React.CSSProperties => ({
  position: "absolute",
  left: `${(c * 100) / 3}%`,
  top: `${(r * 100) / 3}%`,
  width: `${100 / 3}%`,
  height: `${100 / 3}%`,
});

// A decorative cream "page" — paper bg, an accent header bar and a few faint
// text-line gradients. Image-free ([[magazine-print-redesign]]).
const BentoPaperCell: React.FC<{ accent: string; seed: number }> = ({ accent, seed }) => {
  // Alternate the thumbnail "page" type per seed so the contact sheet reads as a
  // grid of distinct magazine pages (image-led / text-led), not blank paper.
  const imageLed = seed % 2 === 0;
  return (
    <div style={{ position: "absolute", inset: "4%", background: "#FCFBF8", borderRadius: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(0,0,0,0.08)", overflow: "hidden" }}>
      {/* bold accent masthead block */}
      <div style={{ position: "absolute", top: "8%", left: "9%", width: `${34 + (seed % 3) * 12}%`, height: "9%", background: accent }} />
      {/* folio number, top-right */}
      <div style={{ position: "absolute", top: "8%", right: "9%", width: "10%", height: "9%", background: "rgba(0,0,0,0.16)" }} />
      {imageLed ? (
        // image-led page: a big photo box + caption lines
        <>
          <div style={{ position: "absolute", top: "26%", left: "9%", right: "9%", height: "42%", background: "linear-gradient(135deg, rgba(0,0,0,0.16), rgba(0,0,0,0.08))", border: "1px solid rgba(0,0,0,0.12)" }} />
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} style={{ position: "absolute", left: "9%", right: `${20 + k * 14}%`, top: `${74 + k * 9}%`, height: "4%", background: "rgba(0,0,0,0.18)" }} />
          ))}
        </>
      ) : (
        // text-led page: a two-column body of lines
        Array.from({ length: 8 }).map((_, k) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: k % 2 === 0 ? "9%" : "53%",
              width: `${k % 2 === 0 ? 38 : 38}%`,
              top: `${26 + Math.floor(k / 2) * 11}%`,
              height: "3.4%",
              background: "rgba(0,0,0,0.14)",
            }}
          />
        ))
      )}
    </div>
  );
};

const ContactSheetZoomComponent: React.FC<
  TransitionPresentationComponentProps<ContactSheetZoomProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = presentationProgress;
  const accent = passedProps.accentColor ?? "#D71921";
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  // Shared virtual camera over the 300%×300% sheet (computed identically on both
  // halves so the two scenes align). Zoom out to the corner-anchored sheet, hold
  // on the contact sheet, then dive into the centre cell.
  const MIN = 1 / 3;
  const zoomOut = easeSoft(interpolate(p, [0, 0.30], [0, 1], cl)); // 1 → 1/3 (snappier zoom-out)
  const zoomIn = easeSoft(interpolate(p, [0.66, 1], [0, 1], cl)); // 1/3 → 1 (longer hold on the sheet)
  const s = zoomIn > 0 ? MIN + (1 - MIN) * zoomIn : 1 - (1 - MIN) * zoomOut;
  const tPct = -(100 / 3) * zoomIn; // pan to the centre cell only while diving in
  const sheetTransform = `scale(${s.toFixed(4)}) translate(${tPct.toFixed(3)}%, ${tPct.toFixed(3)}%)`;

  const sheet = (content: React.ReactNode) => (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "300%",
        height: "300%",
        transformOrigin: "0 0",
        transform: sheetTransform,
        willChange: "transform",
      }}
    >
      {content}
    </div>
  );

  if (presentationDirection === "entering") {
    // Only the centre cell (the new scene); composited on top of the exiting
    // sheet so it reads as the "next page" cell, then dives in to fill.
    return (
      <AbsoluteFill style={{ backgroundColor: "transparent", overflow: "hidden", zIndex: 2 }}>
        {sheet(<div style={{ ...bentoCellStyle(1, 1), overflow: "hidden" }}>{children}</div>)}
      </AbsoluteFill>
    );
  }

  // EXITING — the warm desk + the full contact sheet: old scene in cell (0,0), a
  // blank paper placeholder in the centre (the entering scene paints over it),
  // and decorative pages everywhere else. Opaque throughout; the growing centre
  // cell covers it by the end.
  return (
    <AbsoluteFill style={{ backgroundColor: TABLE_BG, overflow: "hidden", zIndex: 1 }}>
      {sheet(
        <>
          <div style={{ ...bentoCellStyle(0, 0), overflow: "hidden" }}>{children}</div>
          {/* centre cell — the dive target; a framed blank the incoming scene paints
              over, with a thick accent frame so the eye sees which cell we dive into */}
          <div style={bentoCellStyle(1, 1)}>
            <div style={{ position: "absolute", inset: "4%", background: "#FBFAF7", borderRadius: 3, boxShadow: `0 2px 8px rgba(0,0,0,0.2)`, border: `5px solid ${accent}` }} />
          </div>
          {BENTO_DECOR_CELLS.map(([c, r], i) => (
            <div key={`${c}-${r}`} style={bentoCellStyle(c, r)}>
              <BentoPaperCell accent={accent} seed={i + 1} />
            </div>
          ))}
        </>,
      )}
    </AbsoluteFill>
  );
};

export const contactSheetZoom = (
  props: ContactSheetZoomProps = {},
): TransitionPresentation<ContactSheetZoomProps> => ({
  component: ContactSheetZoomComponent,
  props,
});

// ── Die-Cut Reveal ───────────────────────────────────────────────────────────
// A crisp circular die-cut hole opens at frame centre and the next page shows
// through it, the hole growing until it fills the frame. Concentric border-only
// rings ride the growing edge so it reads as a punched paper cut (outer cut
// shadow, accent lip, inner highlight) rather than a plain iris. Paint-safe:
// clip-path ONLY on the revealed layer (no scale on the clipped scene), borders
// only on the rings — no blur / blend / animated box-shadow. Kept to a single
// isolated boundary to limit clip-path cost on the heavy preserve-3d pages
// ([[magazine-preview-paint-cost]]).

type DieCutRevealProps = { accentColor?: string };

const DieCutRevealComponent: React.FC<
  TransitionPresentationComponentProps<DieCutRevealProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#D71921";
  const { width: W, height: H } = useMagDims();
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // Old page sits static and full underneath; the growing hole covers it. A
    // faint centred vignette (opacity-animated static gradient) adds depth so the
    // cut reads as going "through" the sheet.
    const vig = interpolate(presentationProgress, [0, 0.5, 1], [0, 0.28, 0], cl);
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, zIndex: 1 }}>
        {children}
        <AbsoluteFill
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%)",
            opacity: vig.toFixed(3),
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    );
  }

  // ENTERING — the new page revealed through a growing circular die-cut, painted ON
  // TOP (zIndex 2) so the hole always reads over the old page. No transform on this
  // layer (clip-path only) to keep it cheap on the heavy page.
  const R = easeSoft(presentationProgress) * 100; // 0 → 100% (over-covers corners)
  const clip = `circle(${R.toFixed(2)}% at 50% 50%)`;
  // Match the ring to the clip radius in px (circle() % uses √(w²+h²)/√2).
  const rPx = ((R / 100) * Math.hypot(W, H)) / Math.SQRT2;
  const ringOpacity = interpolate(presentationProgress, [0, 0.06, 0.8, 1], [0, 1, 1, 0], cl);
  // A centred ring at radius (rPx - inset), borders only.
  const ring = (inset: number, color: string, thickness: number): React.CSSProperties => ({
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 2 * (rPx - inset),
    height: 2 * (rPx - inset),
    marginLeft: -(rPx - inset),
    marginTop: -(rPx - inset),
    borderRadius: "50%",
    border: `${thickness}px solid ${color}`,
    boxSizing: "border-box",
    pointerEvents: "none",
  });

  return (
    <AbsoluteFill style={{ zIndex: 2 }}>
      <AbsoluteFill style={{ clipPath: clip, WebkitClipPath: clip, willChange: "clip-path" }}>
        {children}
      </AbsoluteFill>
      {ringOpacity > 0.001 && rPx > 2 && (
        <div style={{ position: "absolute", inset: 0, opacity: ringOpacity.toFixed(3), pointerEvents: "none" }}>
          {/* outer cut shadow on the old page just beyond the lip */}
          <div style={ring(-3, "rgba(0,0,0,0.18)", 3)} />
          {/* accent die-cut lip */}
          <div style={ring(0, accent, 4)} />
          {/* inner paper highlight */}
          <div style={ring(4, "rgba(255,255,255,0.5)", 2)} />
        </div>
      )}
    </AbsoluteFill>
  );
};

export const dieCutReveal = (
  props: DieCutRevealProps = {},
): TransitionPresentation<DieCutRevealProps> => ({
  component: DieCutRevealComponent,
  props,
});

// ── Diagonal Cut ─────────────────────────────────────────────────────────────
// A hard diagonal edge sweeps the incoming page across the outgoing one — the
// angled "cut" print editorial layouts lean on. The new page is revealed by an
// animated clip-path polygon whose straight diagonal edge wipes in from the left,
// its top corner leading (a fixed skew gives the slant). A thin accent seam —
// paper highlight on the incoming side, faint shadow on the outgoing side —
// rides the leading edge and fades out as the wipe completes. Paint-safe by
// construction: the heavy page animates clip-path only (no transform), and the
// seam is static rotated divs with animated opacity ([[magazine-preview-paint-cost]]).
type DiagonalCutProps = { accentColor?: string };

const DiagonalCutComponent: React.FC<
  TransitionPresentationComponentProps<DiagonalCutProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#D71921";
  const { width: W, height: H } = useMagDims();
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // Old page sits static and full underneath; the diagonal reveal covers it. A
    // faint directional darkening (opacity-animated static gradient) hints at the
    // edge sweeping over from the left.
    const vig = interpolate(presentationProgress, [0, 0.5, 1], [0, 0.22, 0], cl);
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>
        {children}
        <AbsoluteFill
          style={{
            background: "linear-gradient(105deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 55%)",
            opacity: vig.toFixed(3),
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    );
  }

  // ENTERING — the new page revealed behind a straight diagonal edge sweeping in
  // from the left. clip-path only on this layer (no transform) to keep it cheap.
  const skew = 18; // horizontal lead of the top edge over the bottom, % of width
  const p = easeCubic(presentationProgress);
  const e = p * (100 + skew); // 0 → 118%, so the edge fully clears the right corner
  const topX = e;
  const botX = e - skew;
  const clip = `polygon(0% 0%, ${topX.toFixed(3)}% 0%, ${botX.toFixed(3)}% 100%, 0% 100%)`;

  // Seam geometry in px: the diagonal runs from (botXpx, H) to (topXpx, 0).
  const topXpx = (topX / 100) * W;
  const botXpx = (botX / 100) * W;
  const skewPx = (skew / 100) * W;
  const cx = (topXpx + botXpx) / 2; // diagonal midpoint
  const cy = H / 2;
  const seamLen = Math.hypot(skewPx, H) * 1.2; // overshoot past both corners
  const angleDeg = (Math.atan2(skewPx, H) * 180) / Math.PI; // tilt to match the edge
  const seamOpacity = interpolate(presentationProgress, [0, 0.06, 0.85, 1], [0, 1, 1, 0], cl);
  const bar = (left: number, width: number, color: string): React.CSSProperties => ({
    position: "absolute",
    left,
    top: -seamLen / 2,
    width,
    height: seamLen,
    background: color,
    pointerEvents: "none",
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip, WebkitClipPath: clip, willChange: "clip-path" }}>
        {children}
      </AbsoluteFill>
      {p > 0.001 && p < 0.99 && seamOpacity > 0.001 && (
        <div
          style={{
            position: "absolute",
            left: cx,
            top: cy,
            width: 0,
            height: 0,
            transform: `rotate(${angleDeg.toFixed(3)}deg)`,
            opacity: seamOpacity.toFixed(3),
            pointerEvents: "none",
          }}
        >
          {/* paper highlight on the incoming (revealed) side */}
          <div style={bar(-5, 3, "rgba(255,255,255,0.5)")} />
          {/* accent seam riding the leading edge */}
          <div style={bar(-2, 4, accent)} />
          {/* faint cut shadow on the outgoing side */}
          <div style={bar(2, 3, "rgba(0,0,0,0.18)")} />
        </div>
      )}
    </AbsoluteFill>
  );
};

export const diagonalCut = (
  props: DiagonalCutProps = {},
): TransitionPresentation<DiagonalCutProps> => ({
  component: DiagonalCutComponent,
  props,
});

// ── Cut-Paper Collage Assembly ───────────────────────────────────────────────
// The next page assembles from torn-paper fragments that fly in from the four
// corners with a little rotation and settle to form the complete page, like a
// collage built on the desk (2026 cut-paper / mixed-media trend). Each fragment
// is a full-frame slice of the new page clipped to a STATIC jagged polygon (the
// four overlap in a ~42–58% centre band so their union has no gaps); only
// transform + opacity animate, so the costly animated-clip-path case is avoided.
// Paper depth is a cheap solid-fill "shadow twin" (no filter/drop-shadow).
// Paint-safe ([[magazine-preview-paint-cost]]).

type CollageAssembleProps = { accentColor?: string };

// easeOutBack — overshoots slightly past the target then settles, so each piece
// "lands" with a small bump rather than snapping.
const easeOutBack = (x: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

const COLLAGE_FRAGMENTS: Array<{
  clip: string;
  fromX: number;
  fromY: number;
  rot: number;
  delay: number;
}> = [
  {
    // top-left
    clip: "polygon(0% 0%, 56% 0%, 52% 14%, 58% 28%, 53% 42%, 57% 56%, 42% 53%, 28% 58%, 14% 52%, 0% 56%)",
    fromX: -60, fromY: -42, rot: -8, delay: 0,
  },
  {
    // top-right
    clip: "polygon(100% 0%, 44% 0%, 48% 14%, 42% 28%, 47% 42%, 43% 56%, 58% 53%, 72% 58%, 86% 52%, 100% 56%)",
    fromX: 60, fromY: -42, rot: 8, delay: 0.12,
  },
  {
    // bottom-left
    clip: "polygon(0% 100%, 0% 44%, 14% 48%, 28% 42%, 42% 47%, 57% 44%, 53% 58%, 58% 72%, 52% 86%, 56% 100%)",
    fromX: -60, fromY: 42, rot: 6, delay: 0.24,
  },
  {
    // bottom-right
    clip: "polygon(100% 100%, 100% 44%, 86% 48%, 72% 42%, 58% 47%, 43% 44%, 47% 58%, 42% 72%, 48% 86%, 44% 100%)",
    fromX: 60, fromY: 42, rot: -6, delay: 0.36,
  },
];

const CollageAssembleComponent: React.FC<
  TransitionPresentationComponentProps<CollageAssembleProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // The outgoing page sits static and full underneath; the assembling pieces
    // cover it. Gaps between not-yet-landed fragments reveal it.
    return <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>{children}</AbsoluteFill>;
  }

  // ENTERING — the torn-paper fragments fly in and assemble into the new page.
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      {COLLAGE_FRAGMENTS.map((frag, i) => {
        const t = interpolate(p, [frag.delay, frag.delay + 0.6], [0, 1], cl);
        const e = easeOutBack(t); // 0 → ~1 (with a small overshoot)
        const k = 1 - e; // 1 (off-screen) → 0 (home)
        const tx = frag.fromX * k;
        const ty = frag.fromY * k;
        const rot = frag.rot * k;
        const op = interpolate(p, [frag.delay, frag.delay + 0.25], [0, 1], cl);
        const base = `translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%) rotate(${rot.toFixed(2)}deg)`;
        return (
          <React.Fragment key={i}>
            {/* shadow twin — same clip + transform, offset, solid fill (no filter) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                clipPath: frag.clip,
                WebkitClipPath: frag.clip,
                transform: `${base} translate(4px, 8px)`,
                opacity: (op * 0.5).toFixed(3),
                background: "rgba(0,0,0,0.18)",
                willChange: "transform, opacity",
                pointerEvents: "none",
              }}
            />
            {/* the torn paper fragment carrying its slice of the new page */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                clipPath: frag.clip,
                WebkitClipPath: frag.clip,
                transform: base,
                opacity: op.toFixed(3),
                overflow: "hidden",
                willChange: "transform, opacity",
              }}
            >
              {children}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

export const collageAssemble = (
  props: CollageAssembleProps = {},
): TransitionPresentation<CollageAssembleProps> => ({
  component: CollageAssembleComponent,
  props,
});

// ── Press Print / Ink Roll ───────────────────────────────────────────────────
// Leaving the ticker: a printing-press roller sweeps down the frame and "prints"
// the next page in its wake — the top portion is the freshly inked new page, the
// bottom is the outgoing ticker still showing, and a metallic roller bar rides the
// print line with a crisp accent ink-line on its contact edge plus a soft contact
// shadow cast just ahead onto the not-yet-printed sheet. Paint-safe: the new page
// is revealed by an animated clip-path inset only (no transform on the heavy page),
// and the roller is baked gradients + solid bars moved on the compositor via
// translateY — no blur / box-shadow ([[magazine-preview-paint-cost]]).
type PressPrintProps = { accentColor?: string };

const PressPrintComponent: React.FC<
  TransitionPresentationComponentProps<PressPrintProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#D71921";

  if (presentationDirection === "exiting") {
    // The outgoing ticker sits static and full underneath; the printed page covers
    // it from the top down as the roller passes.
    return <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>{children}</AbsoluteFill>;
  }

  // ENTERING — the new page is revealed top→down behind the descending roller.
  const p = easeCubic(presentationProgress);
  const bottomInset = (1 - p) * 100; // 100 → 0 (reveal grows downward)
  const clip = `inset(0 0 ${bottomInset.toFixed(3)}% 0)`;
  const rollerVisible = presentationProgress > 0.001 && presentationProgress < 0.999;
  return (
    <AbsoluteFill>
      {/* freshly printed page, revealed from the top down */}
      <AbsoluteFill style={{ clipPath: clip, WebkitClipPath: clip, willChange: "clip-path" }}>
        {children}
      </AbsoluteFill>
      {rollerVisible && (
        <AbsoluteFill
          style={{
            transform: `translateY(${(p * 100).toFixed(3)}%)`,
            willChange: "transform",
            pointerEvents: "none",
          }}
        >
          {/* soft contact shadow cast just ahead of the roller onto the old sheet */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 46,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.22), rgba(0,0,0,0))",
            }}
          />
          {/* crisp accent ink-line laid at the contact edge */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 4,
              marginTop: -2,
              background: accent,
            }}
          />
          {/* the metallic roller cylinder riding just above the print line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 64,
              transform: "translateY(-100%)",
              background:
                "linear-gradient(to bottom, rgba(40,38,34,0.95) 0%, rgba(120,116,108,0.9) 30%, rgba(255,255,255,0.55) 50%, rgba(120,116,108,0.9) 70%, rgba(30,28,24,0.98) 100%)",
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const pressPrint = (
  props: PressPrintProps = {},
): TransitionPresentation<PressPrintProps> => ({
  component: PressPrintComponent,
  props,
});

// ── Magazine Stack Drop (image-free) ─────────────────────────────────────────
// A small stack of cream magazine cards drops into frame from above (translateY
// only — no perspective / 3D), settles with a small easeOutBack bump, then the TOP
// card (which carries the incoming page) opens up to full frame. Paint-safe: cards
// are solid cream fills with a cheap STATIC offset "shadow twin" div (no animated
// box-shadow / blur / filter), moved on the compositor via translate + scale only;
// the outgoing page sits static underneath and is never transformed
// ([[magazine-preview-paint-cost]]). Image-free — baked accent/ink bands stand in
// for the under-cards instead of a photo collage ([[magazine-print-redesign]]).
type PageStackDropProps = { accentColor?: string };

// Resting poses for the under-cards in the dropped stack (% offset / deg / scale).
const STACK_UNDER_CARDS: Array<{ x: number; y: number; rot: number; scale: number; delay: number }> = [
  { x: -10, y: 8, rot: -7, scale: 0.46, delay: 0 },
  { x: 11, y: 5, rot: 6, scale: 0.47, delay: 0.07 },
  { x: -3, y: 0, rot: -2.5, scale: 0.485, delay: 0.14 },
];
const STACK_TOP_SCALE = 0.5; // size of the top card while it still sits in the stack
const STACK_TOP_DELAY = 0.18;

const PageStackDropComponent: React.FC<
  TransitionPresentationComponentProps<PageStackDropProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#D71921";
  const p = presentationProgress;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // Outgoing sits static and full UNDERNEATH (zIndex 1); the dropping stack lands
    // on top of it (the previous page reads as the desk the stack drops onto).
    return <AbsoluteFill style={{ backgroundColor: TABLE_BG, zIndex: 1 }}>{children}</AbsoluteFill>;
  }

  // ENTERING — the stack drops in ON TOP (zIndex 2, transparent backing so the old
  // page shows behind it), settles, then the top card opens to full frame.
  const open = easeCubic(interpolate(p, [0.58, 1], [0, 1], cl));

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", zIndex: 2 }}>
      {/* under-cards: cream magazine pages stacked behind, fade out as the top opens */}
      {STACK_UNDER_CARDS.map((c, i) => {
        const land = easeOutBack(interpolate(p, [c.delay, c.delay + 0.4], [0, 1], cl));
        const dropY = -280 * (1 - land);
        const op = interpolate(p, [c.delay, c.delay + 0.12], [0, 1], cl) * (1 - open);
        const base = `translate(${c.x}%, ${c.y}%) translateY(${dropY.toFixed(1)}px) rotate(${c.rot}deg) scale(${c.scale})`;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.16)", borderRadius: 8, transform: `${base} translate(6px, 12px)`, opacity: (op * 0.5).toFixed(3), willChange: "transform, opacity", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, background: "#F4EFE3", borderRadius: 8, overflow: "hidden", transform: base, opacity: op.toFixed(3), willChange: "transform, opacity" }}>
              {/* baked masthead-ish bands so under-cards read as magazines (no image) */}
              <div style={{ position: "absolute", top: "12%", left: "10%", right: "10%", height: 6, background: accent, opacity: 0.5 }} />
              <div style={{ position: "absolute", top: "20%", left: "10%", right: "40%", height: 4, background: "rgba(0,0,0,0.18)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 5, background: "linear-gradient(to top, #D8D2C4, #F4EFE3)" }} />
            </div>
          </React.Fragment>
        );
      })}
      {/* top card carries the incoming page; lands in the stack then opens full-bleed */}
      {(() => {
        const land = easeOutBack(interpolate(p, [STACK_TOP_DELAY, STACK_TOP_DELAY + 0.4], [0, 1], cl));
        const dropY = -280 * (1 - land);
        const scale = STACK_TOP_SCALE + (1 - STACK_TOP_SCALE) * open;
        const x = -1.5 * (1 - open);
        const y = -2 * (1 - open);
        const rot = 1.5 * (1 - open);
        const op = interpolate(p, [STACK_TOP_DELAY, STACK_TOP_DELAY + 0.12], [0, 1], cl);
        const radius = `${((1 - open) * 10).toFixed(2)}px`;
        const base = `translate(${x.toFixed(2)}%, ${y.toFixed(2)}%) translateY(${dropY.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        return (
          <React.Fragment>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.16)", borderRadius: radius, transform: `${base} translate(6px, 12px)`, opacity: ((1 - open) * op * 0.5).toFixed(3), willChange: "transform, opacity", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", transform: base, opacity: op.toFixed(3), willChange: "transform, opacity" }}>
              <AbsoluteFill>{children}</AbsoluteFill>
            </div>
          </React.Fragment>
        );
      })()}
    </AbsoluteFill>
  );
};

export const pageStackDrop = (
  props: PageStackDropProps = {},
): TransitionPresentation<PageStackDropProps> => ({
  component: PageStackDropComponent,
  props,
});

// ── Page Sweep (gap-free, directional) ───────────────────────────────────────
// A clean page sweep: the incoming page slides in from an edge / corner while the
// outgoing page parallax-pushes the opposite way. Both layers ride TRANSPARENT
// backings and only TRANSLATE, so no dark desk bg / third colour ever shows at the
// seam, and there's no scale / 3D / blur — paint-cheap even on the heavy
// self-animating colorblock & feature pages ([[magazine-preview-paint-cost]]). A
// soft leading-edge shadow + thin accent line give the printed-sheet seam. At the
// very end the incoming is rendered as a plain layer (no transform / willChange) so
// a text-heavy page never flickers when the layer is torn down at the handoff. The
// directional generalisation of pageSlide.
type SweepDir = "up" | "left" | "tl" | "br";
type PageSweepProps = { direction?: SweepDir; accentColor?: string };

// incoming start offset (%, at progress 0) + outgoing parallax push (%, at 1).
const SWEEP_VECTORS: Record<SweepDir, { ix: number; iy: number; ox: number; oy: number }> = {
  up: { ix: 0, iy: 100, ox: 0, oy: -34 }, // in from the bottom, travels up
  left: { ix: -100, iy: 0, ox: 34, oy: 0 }, // in from the left, travels right
  tl: { ix: -100, iy: -100, ox: 30, oy: 30 }, // in from the top-left, travels down-right
  br: { ix: 100, iy: 100, ox: -30, oy: -30 }, // in from the bottom-right, travels up-left
};
// leading edges of the incoming page (the sides facing its travel direction).
const SWEEP_LEADING: Record<SweepDir, Array<"top" | "bottom" | "left" | "right">> = {
  up: ["top"],
  left: ["right"],
  tl: ["right", "bottom"],
  br: ["left", "top"],
};

const sweepEdgeShadow = (side: "top" | "bottom" | "left" | "right"): React.CSSProperties => {
  const grad = (d: string) =>
    `linear-gradient(${d}, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 55%, transparent 100%)`;
  switch (side) {
    case "top":
      return { position: "absolute", left: 0, right: 0, top: 0, height: 30, background: grad("to bottom"), pointerEvents: "none" };
    case "bottom":
      return { position: "absolute", left: 0, right: 0, bottom: 0, height: 30, background: grad("to top"), pointerEvents: "none" };
    case "left":
      return { position: "absolute", top: 0, bottom: 0, left: 0, width: 30, background: grad("to right"), pointerEvents: "none" };
    case "right":
      return { position: "absolute", top: 0, bottom: 0, right: 0, width: 30, background: grad("to left"), pointerEvents: "none" };
  }
};
const sweepAccentLine = (side: "top" | "bottom" | "left" | "right", accent: string): React.CSSProperties => {
  switch (side) {
    case "top":
      return { position: "absolute", left: 0, right: 0, top: 0, height: 3, background: accent, opacity: 0.5, pointerEvents: "none" };
    case "bottom":
      return { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: accent, opacity: 0.5, pointerEvents: "none" };
    case "left":
      return { position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: accent, opacity: 0.5, pointerEvents: "none" };
    case "right":
      return { position: "absolute", top: 0, bottom: 0, right: 0, width: 3, background: accent, opacity: 0.5, pointerEvents: "none" };
  }
};

const PageSweepComponent: React.FC<
  TransitionPresentationComponentProps<PageSweepProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#D71921";
  const dir = passedProps.direction ?? "left";
  const v = SWEEP_VECTORS[dir];
  const p = ease(presentationProgress);

  if (presentationDirection === "entering") {
    // Settle to a plain layer at the very end so a text-heavy page can't flicker
    // when the transform / willChange layer is torn down at the sequence handoff.
    if (presentationProgress >= 0.999) {
      return <AbsoluteFill style={{ zIndex: 2 }}>{children}</AbsoluteFill>;
    }
    const tx = (v.ix * (1 - p)).toFixed(3);
    const ty = (v.iy * (1 - p)).toFixed(3);
    return (
      <AbsoluteFill style={{ backgroundColor: "transparent", zIndex: 2 }}>
        <AbsoluteFill style={{ transform: `translate(${tx}%, ${ty}%)`, willChange: "transform" }}>
          {children}
          {SWEEP_LEADING[dir].map((side) => (
            <React.Fragment key={side}>
              <div style={sweepEdgeShadow(side)} />
              <div style={sweepAccentLine(side, accent)} />
            </React.Fragment>
          ))}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const tx = (v.ox * p).toFixed(3);
  const ty = (v.oy * p).toFixed(3);
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", zIndex: 1 }}>
      <AbsoluteFill style={{ transform: `translate(${tx}%, ${ty}%)`, willChange: "transform" }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const pageSweep = (
  props: PageSweepProps = {},
): TransitionPresentation<PageSweepProps> => ({
  component: PageSweepComponent,
  props,
});

// ── Center Doors ─────────────────────────────────────────────────────────────
// The outgoing page splits at the vertical centre into two halves that slide apart
// like double doors, revealing the next scene resting flat behind it. The EXITING
// page owns the motion and paints ON TOP (zIndex 2) so it genuinely parts away over
// the incoming scene (zIndex 1), which eases up from a touch of overscale. A thin
// accent line rides each door's inner edge and fades as the gap opens. Paint-safe:
// the doors are two clipped copies of the page moved on the compositor via
// translateX only — no 3D, no blur, no animated box-shadow
// ([[magazine-preview-paint-cost]]). The flat, lightweight cousin of gatefoldUnfold.
type CenterDoorsProps = { accentColor?: string };

const CenterDoorsComponent: React.FC<
  TransitionPresentationComponentProps<CenterDoorsProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#D71921";
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "entering") {
    // The next scene rests flat behind the parting doors and eases up to rest.
    const settle = easeSoft(interpolate(presentationProgress, [0.1, 1], [0, 1], cl));
    const scale = 1.05 - 0.05 * settle;
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, zIndex: 1 }}>
        <AbsoluteFill
          style={{
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: "50% 50%",
            willChange: "transform",
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // EXITING — the outgoing page, split into two doors that slide apart. On top.
  const p = easeCubic(presentationProgress);
  const shift = p * 54; // % of frame each half travels outward
  const seamOpacity = interpolate(presentationProgress, [0, 0.08, 0.7, 1], [0, 1, 1, 0], cl);
  const doorEdge = (innerLeft: string): React.CSSProperties => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    left: innerLeft,
    width: 3,
    background: accent,
    opacity: seamOpacity.toFixed(3),
    pointerEvents: "none",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", zIndex: 2 }}>
      {/* left door — left half of the page, slides off to the left */}
      <AbsoluteFill
        style={{
          clipPath: "inset(0 50% 0 0)",
          WebkitClipPath: "inset(0 50% 0 0)",
          transform: `translateX(${(-shift).toFixed(3)}%)`,
          willChange: "transform",
        }}
      >
        {children}
        <div style={doorEdge("calc(50% - 3px)")} />
      </AbsoluteFill>
      {/* right door — right half of the page, slides off to the right */}
      <AbsoluteFill
        style={{
          clipPath: "inset(0 0 0 50%)",
          WebkitClipPath: "inset(0 0 0 50%)",
          transform: `translateX(${shift.toFixed(3)}%)`,
          willChange: "transform",
        }}
      >
        {children}
        <div style={doorEdge("50%")} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const centerDoors = (
  props: CenterDoorsProps = {},
): TransitionPresentation<CenterDoorsProps> => ({
  component: CenterDoorsComponent,
  props,
});

// ── Break From Behind ────────────────────────────────────────────────────────
// The outgoing page breaks apart — split into panels that fly off toward the
// nearest edges with a small tumble — revealing the next scene that was sitting
// behind it all along. The EXITING page owns the break and paints ON TOP (zIndex
// 2) while the incoming scene rests behind (zIndex 1) and eases up from a touch of
// overscale. Default is a 4-way quadrant break; `pieces: 2` does a top/bottom
// split. Paint-safe: each panel is a clipped copy of the page moved on the
// compositor via translate + a small rotate (transform only) — no blur, no animated
// box-shadow ([[magazine-preview-paint-cost]]). Panel count is capped at 4 to bound
// the cost of re-rendering the outgoing page per panel (same approach as
// contactSheetZoom).
type BreakFromBehindProps = { accentColor?: string; pieces?: 2 | 4 };

const BreakFromBehindComponent: React.FC<
  TransitionPresentationComponentProps<BreakFromBehindProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const pieces = passedProps.pieces === 2 ? 2 : 4;

  if (presentationDirection === "entering") {
    // The next scene rests behind the breaking page and eases up to rest.
    const settle = easeSoft(interpolate(presentationProgress, [0.12, 1], [0, 1], cl));
    const scale = 1.06 - 0.06 * settle;
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG, zIndex: 1 }}>
        <AbsoluteFill
          style={{
            transform: `scale(${scale.toFixed(4)})`,
            transformOrigin: "50% 50%",
            willChange: "transform",
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // EXITING — the page breaks into panels that fly off their nearest edge. On top.
  const p = easeCubic(presentationProgress);
  const d = p * 60; // % of frame each panel travels off
  const rot = p * 5; // deg of break tumble
  const panels: Array<{ clip: string; tx: number; ty: number; rot: number }> =
    pieces === 2
      ? [
          { clip: "inset(0 0 50% 0)", tx: 0, ty: -d, rot: -rot * 0.4 },
          { clip: "inset(50% 0 0 0)", tx: 0, ty: d, rot: rot * 0.4 },
        ]
      : [
          { clip: "inset(0 50% 50% 0)", tx: -d, ty: -d, rot: -rot },
          { clip: "inset(0 0 50% 50%)", tx: d, ty: -d, rot: rot },
          { clip: "inset(50% 50% 0 0)", tx: -d, ty: d, rot: rot },
          { clip: "inset(50% 0 0 50%)", tx: d, ty: d, rot: -rot },
        ];

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", zIndex: 2 }}>
      {panels.map((pn, i) => (
        <AbsoluteFill
          key={i}
          style={{
            clipPath: pn.clip,
            WebkitClipPath: pn.clip,
            transform: `translate(${pn.tx.toFixed(2)}%, ${pn.ty.toFixed(2)}%) rotate(${pn.rot.toFixed(2)}deg)`,
            transformOrigin: "50% 50%",
            willChange: "transform",
          }}
        >
          {children}
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};

export const breakFromBehind = (
  props: BreakFromBehindProps = {},
): TransitionPresentation<BreakFromBehindProps> => ({
  component: BreakFromBehindComponent,
  props,
});

// ── Window Open ──────────────────────────────────────────────────────────────
// The next scene is revealed through a rectangular "window" that opens from the
// centre outward — a clean editorial frame growing to full bleed. The rectangular
// cousin of the circular dieCutReveal. An accent frame rides the opening edge and
// fades as the window fills. Paint-safe: clip-path inset ONLY on the revealed layer
// (no transform on the heavy page), the frame is a single bordered overlay with
// animated opacity — no blur, no animated box-shadow ([[magazine-preview-paint-cost]]).
type WindowOpenProps = { accentColor?: string };

const WindowOpenComponent: React.FC<
  TransitionPresentationComponentProps<WindowOpenProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#D71921";
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // Old page sits static and full underneath; the growing window covers it. A
    // faint centred vignette adds depth so the window reads as opening through it.
    const vig = interpolate(presentationProgress, [0, 0.5, 1], [0, 0.24, 0], cl);
    return (
      <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>
        {children}
        <AbsoluteFill
          style={{
            background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)",
            opacity: vig.toFixed(3),
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    );
  }

  // ENTERING — the new page revealed through a growing rectangular window.
  const e = easeSoft(presentationProgress);
  const inset = (1 - e) * 50; // 50% → 0% on every side
  const clip = `inset(${inset.toFixed(3)}% ${inset.toFixed(3)}% ${inset.toFixed(3)}% ${inset.toFixed(3)}%)`;
  const frameOpacity = interpolate(presentationProgress, [0, 0.06, 0.82, 1], [0, 1, 1, 0], cl);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip, WebkitClipPath: clip, willChange: "clip-path" }}>
        {children}
      </AbsoluteFill>
      {frameOpacity > 0.001 && inset < 49.5 && (
        <div
          style={{
            position: "absolute",
            top: `${inset.toFixed(3)}%`,
            left: `${inset.toFixed(3)}%`,
            right: `${inset.toFixed(3)}%`,
            bottom: `${inset.toFixed(3)}%`,
            border: `4px solid ${accent}`,
            opacity: frameOpacity.toFixed(3),
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export const windowOpen = (
  props: WindowOpenProps = {},
): TransitionPresentation<WindowOpenProps> => ({
  component: WindowOpenComponent,
  props,
});

// ── Ticker-tape Crawl ────────────────────────────────────────────────────────
// The Ledger's signature arrival: a stock ticker-tape print carriage sweeps left
// →right across the frame and "prints" the ledger page into view in its wake,
// while a paper ticker-tape strip threads across the mid-band scrolling live
// quotes. The financial counterpart to the vertical printing-press roller
// (`pressPrint`) — here the motion is horizontal, like a tape machine. Paint-safe:
// the page is revealed by an animated clip-path inset only (no transform on the
// page), and the carriage / tape are baked gradients + a translateX'd text row —
// no blur, no animated box-shadow ([[magazine-preview-paint-cost]]).
type TickerTapeProps = { accentColor?: string };

// One long monospace tape; repeated so the leftward scroll never shows a seam.
const TAPE_QUOTES =
  "▲ AAPL 182.40   ▼ TSLA 241.13   ▲ MSFT 410.22   ▲ NVDA 88.15   ▼ AMZN 178.02   ▲ META 503.7   ▼ GOOGL 171.4   ";

const TickerTapeCrawlComponent: React.FC<
  TransitionPresentationComponentProps<TickerTapeProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const accent = passedProps.accentColor ?? "#D71921";
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // The outgoing page sits static and full underneath; the printed ledger covers
    // it from the left as the carriage passes.
    return <AbsoluteFill style={{ backgroundColor: TABLE_BG }}>{children}</AbsoluteFill>;
  }

  // ENTERING — the ledger page is revealed left→right behind the print carriage.
  const p = easeCubic(presentationProgress);
  const rightInset = (1 - p) * 100; // 100 → 0 (reveal grows rightward)
  const clip = `inset(0 ${rightInset.toFixed(3)}% 0 0)`;
  const carriageVisible = presentationProgress > 0.001 && presentationProgress < 0.999;
  // The tape scrolls leftward the whole time and fades as the print completes.
  const tapeScroll = interpolate(presentationProgress, [0, 1], [0, -60], cl); // %
  const tapeOpacity = interpolate(presentationProgress, [0, 0.12, 0.82, 1], [0, 1, 1, 0], cl);
  return (
    <AbsoluteFill>
      {/* freshly printed ledger page, revealed from the left edge rightward */}
      <AbsoluteFill style={{ clipPath: clip, WebkitClipPath: clip, willChange: "clip-path" }}>
        {children}
      </AbsoluteFill>

      {/* bold horizontal ticker-tape band threading across the mid-band — the star
          of the move: a wide ledger tape with two scrolling rows + accent rules */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "38%",
          height: 168,
          overflow: "hidden",
          background: "linear-gradient(to bottom, #FCFBF8 0%, #F1EFE7 100%)",
          borderTop: `6px solid ${accent}`,
          borderBottom: `6px solid ${accent}`,
          boxShadow: "0 6px 18px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.6) inset",
          opacity: tapeOpacity.toFixed(3),
          pointerEvents: "none",
        }}
      >
        {/* top row — scrolls left */}
        <div
          style={{
            position: "absolute",
            top: 14,
            height: 60,
            left: 0,
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            fontFamily: "'SFMono-Regular', ui-monospace, 'DejaVu Sans Mono', monospace",
            fontSize: 46,
            fontWeight: 800,
            letterSpacing: "0.03em",
            color: "#141414",
            transform: `translateX(${tapeScroll.toFixed(3)}%)`,
            willChange: "transform",
          }}
        >
          {`${TAPE_QUOTES}${TAPE_QUOTES}${TAPE_QUOTES}`}
        </div>
        {/* hairline divider between the two tape rows */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 84, height: 1, background: "rgba(0,0,0,0.14)" }} />
        {/* bottom row — offset start + slightly slower, accent-coloured */}
        <div
          style={{
            position: "absolute",
            top: 92,
            height: 56,
            left: 0,
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            fontFamily: "'SFMono-Regular', ui-monospace, 'DejaVu Sans Mono', monospace",
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: "0.03em",
            color: accent,
            transform: `translateX(${(tapeScroll * 0.7 - 18).toFixed(3)}%)`,
            willChange: "transform",
          }}
        >
          {`${TAPE_QUOTES}${TAPE_QUOTES}${TAPE_QUOTES}`}
        </div>
      </div>

      {/* print carriage riding the leading (right) edge of the reveal */}
      {carriageVisible && (
        <AbsoluteFill
          style={{
            transform: `translateX(${(p * 100).toFixed(3)}%)`,
            willChange: "transform",
            pointerEvents: "none",
          }}
        >
          {/* soft contact shadow cast just ahead (right) of the print line */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 60, background: "linear-gradient(to right, rgba(0,0,0,0.26), rgba(0,0,0,0))" }} />
          {/* crisp accent ink-line laid at the contact edge */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 6, marginLeft: -3, background: accent }} />
          {/* the metallic carriage bar riding just left of the print line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 90,
              transform: "translateX(-100%)",
              background:
                "linear-gradient(to right, rgba(30,28,24,0.98) 0%, rgba(120,116,108,0.9) 30%, rgba(255,255,255,0.62) 50%, rgba(120,116,108,0.9) 70%, rgba(40,38,34,0.95) 100%)",
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const tickerTapeCrawl = (
  props: TickerTapeProps = {},
): TransitionPresentation<TickerTapeProps> => ({
  component: TickerTapeCrawlComponent,
  props,
});

// ── Alternating Quote-swing ──────────────────────────────────────────────────
// The Interview's signature arrival, staged as a conversation. The Q&A spread
// splits at the centre spine and its two leaves swing in to lie flat — the LEFT
// leaf settles first, then the RIGHT, an A/B "call and response" beat (distinct
// from the gatefold's symmetric double-door open). The previous page sits static
// beneath and is covered as the leaves flatten. Paint-safe like the gatefold:
// each leaf is `contain:paint` so it caches as a texture the GPU just rotates, the
// leaves never pass vertical (front always faces camera), and each leaf brightens
// as it settles so the copy reads only once flat — no per-frame re-raster of
// writing-on text mid-swing ([[magazine-preview-paint-cost]]).
type QuoteSwingProps = { accentColor?: string };

const AlternatingQuoteSwingComponent: React.FC<
  TransitionPresentationComponentProps<QuoteSwingProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = presentationProgress;
  const accent = passedProps.accentColor ?? "#D71921";
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  if (presentationDirection === "exiting") {
    // The previous page sits static, full-bleed beneath the swinging leaves.
    return <AbsoluteFill style={{ backgroundColor: TABLE_BG, zIndex: 1 }}>{children}</AbsoluteFill>;
  }

  // ENTERING — the two leaves of the arriving Q&A spread swing down flat about the
  // centre spine, staggered: left over [0,0.6], right over [0.4,1.0].
  const START = 72; // folded-open angle (deg) before the leaf swings flat
  return (
    <AbsoluteFill
      style={{
        zIndex: 5,
        perspective: "1900px",
        perspectiveOrigin: "50% 48%",
        backgroundColor: "transparent",
        pointerEvents: "none",
      }}
    >
      {(["left", "right"] as const).map((side) => {
        const isLeft = side === "left";
        // Staggered settle: left leads, right follows.
        const t = easeCubic(
          interpolate(p, isLeft ? [0, 0.6] : [0.4, 1.0], [0, 1], cl),
        );
        // Hinge at the spine; swing from raised (±START) down to flat (0°).
        const dir = isLeft ? -1 : 1;
        const angle = (1 - t) * START * dir;
        const hinge: "left" | "right" = isLeft ? "right" : "left"; // spine side
        const free: "left" | "right" = isLeft ? "left" : "right";
        // Each leaf brightens as it lands so the copy reads only once flat. Capped low
        // (was 0.5) so the incoming interview page doesn't read as dark while it swings
        // in over the black bridge — it stays legible throughout.
        const litShade = (1 - t) * 0.22;
        return (
          <div
            key={side}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "50%",
              ...(isLeft ? { left: 0 } : { left: "50%" }),
              transformStyle: "preserve-3d",
              transformOrigin: `${hinge} center`,
              transform: `rotateY(${angle.toFixed(2)}deg)`,
              willChange: "transform",
            }}
          >
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", contain: "paint" }}>
              {/* full-frame spread, offset so each leaf shows its own half */}
              <div style={{ position: "absolute", top: 0, bottom: 0, width: "200%", left: isLeft ? 0 : "-100%" }}>
                {children}
              </div>
              {/* the leaf darkens while raised, lifting to nothing as it lands */}
              <div style={{ position: "absolute", inset: 0, background: "#000", opacity: litShade.toFixed(3), pointerEvents: "none" }} />
              {/* spine crease at the hinge edge */}
              <div style={{ position: "absolute", top: 0, bottom: 0, width: "8%", background: `linear-gradient(to ${free}, rgba(0,0,0,0.26) 0%, transparent 100%)`, pointerEvents: "none", ...(isLeft ? { right: 0 } : { left: 0 }) }} />
              {/* soft shading along the free (outer) edge while the leaf is tilted */}
              <div style={{ position: "absolute", top: 0, bottom: 0, width: "32%", background: `linear-gradient(to ${hinge}, rgba(0,0,0,${(0.04 + (1 - t) * 0.3).toFixed(3)}) 0%, transparent 100%)`, pointerEvents: "none", ...(isLeft ? { left: 0 } : { right: 0 }) }} />
            </div>
          </div>
        );
      })}
      {/* a thin accent seam down the spine, fading as the spread closes flat */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: 2,
          marginLeft: -1,
          background: accent,
          opacity: interpolate(p, [0.45, 1], [0.35, 0], cl).toFixed(3),
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const alternatingQuoteSwing = (
  props: QuoteSwingProps = {},
): TransitionPresentation<QuoteSwingProps> => ({
  component: AlternatingQuoteSwingComponent,
  props,
});
