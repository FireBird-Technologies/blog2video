import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const TRANS_WINDOW_SEC = 2.1;

export const NEWSCAST_TRANSITION_STYLES = [
  "zoom_soft",
  "fade_cross",
  "side_pan",
  "fly_handoff",
] as const;

export type NewscastTransitionStyle = (typeof NEWSCAST_TRANSITION_STYLES)[number];

type TransitionStylePreset = {
  xInStart: number;
  xInEnd: number;
  yInStart: number;
  yInEnd: number;
  scaleInStart: number;
  scaleInEnd: number;
  rotateInStart: number;
  rotateInEnd: number;
  xOutStart: number;
  xOutEnd: number;
  yOutStart: number;
  yOutEnd: number;
  scaleOutStart: number;
  scaleOutEnd: number;
  rotateOutStart: number;
  rotateOutEnd: number;
  opacityInStart: number;
  opacityInEnd: number;
  opacityOutStart: number;
  opacityOutEnd: number;
  layoutFxStrength: number;
};

const TRANSITION_STYLE_PRESETS: Record<NewscastTransitionStyle, TransitionStylePreset> = {
  zoom_soft: {
    xInStart: 0,
    xInEnd: 0,
    yInStart: 6,
    yInEnd: 0,
    scaleInStart: 1.05,
    scaleInEnd: 1,
    rotateInStart: 0,
    rotateInEnd: 0,
    xOutStart: 0,
    xOutEnd: 0,
    yOutStart: 0,
    yOutEnd: 0,
    scaleOutStart: 1,
    scaleOutEnd: 1,
    rotateOutStart: 0,
    rotateOutEnd: 0,
    opacityInStart: 0.88,
    opacityInEnd: 1,
    opacityOutStart: 1,
    opacityOutEnd: 1,
    layoutFxStrength: 0.45,
  },
  fade_cross: {
    xInStart: 0,
    xInEnd: 0,
    yInStart: 10,
    yInEnd: 0,
    scaleInStart: 1.02,
    scaleInEnd: 1,
    rotateInStart: 0,
    rotateInEnd: 0,
    xOutStart: 0,
    xOutEnd: 0,
    yOutStart: 0,
    yOutEnd: 8,
    scaleOutStart: 1,
    scaleOutEnd: 1,
    rotateOutStart: 0,
    rotateOutEnd: 0,
    opacityInStart: 0.38,
    opacityInEnd: 1,
    opacityOutStart: 1,
    opacityOutEnd: 0.5,
    layoutFxStrength: 0.32,
  },
  side_pan: {
    xInStart: 96,
    xInEnd: 0,
    yInStart: 0,
    yInEnd: 0,
    scaleInStart: 1.02,
    scaleInEnd: 1,
    rotateInStart: 0,
    rotateInEnd: 0,
    xOutStart: 0,
    xOutEnd: 0,
    yOutStart: 0,
    yOutEnd: 0,
    scaleOutStart: 1,
    scaleOutEnd: 1,
    rotateOutStart: 0,
    rotateOutEnd: 0,
    opacityInStart: 0.78,
    opacityInEnd: 1,
    opacityOutStart: 1,
    opacityOutEnd: 1,
    layoutFxStrength: 0.55,
  },
  fly_handoff: {
    xInStart: -82,
    xInEnd: 0,
    yInStart: 44,
    yInEnd: 0,
    scaleInStart: 0.985,
    scaleInEnd: 1,
    rotateInStart: 0,
    rotateInEnd: 0,
    xOutStart: 0,
    xOutEnd: 0,
    yOutStart: 0,
    yOutEnd: 0,
    scaleOutStart: 1,
    scaleOutEnd: 1,
    rotateOutStart: 0,
    rotateOutEnd: 0,
    opacityInStart: 0.76,
    opacityInEnd: 1,
    opacityOutStart: 1,
    opacityOutEnd: 1,
    layoutFxStrength: 0.62,
  },
};

function resolveLayoutTransitionStyle(layoutType?: string): NewscastTransitionStyle {
  // Fixed layout->transition family mapping to ensure consistent variety across scenes.
  if (
    layoutType === "glow_metric" ||
    layoutType === "kinetic_insight" ||
    layoutType === "split_glass"
  ) {
    return "zoom_soft";
  }

  if (layoutType === "glass_narrative" || layoutType === "chapter_break" || layoutType === "glass_code") {
    return "fade_cross";
  }

  // Remaining layouts: cinematic_title, glass_stack, glass_image, data_visualization
  return "side_pan";
}

function useSceneMotionStyle(
  durationInFrames: number,
  inStyle: NewscastTransitionStyle,
  outStyle: NewscastTransitionStyle,
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pIn = TRANSITION_STYLE_PRESETS[inStyle];
  const pOut = TRANSITION_STYLE_PRESETS[outStyle];
  const capHalf = Math.max(1, Math.floor(durationInFrames / 2));
  const transFrames = Math.min(
    Math.round(TRANS_WINDOW_SEC * fps),
    Math.max(18, Math.floor(durationInFrames * 0.56)),
    capHalf,
  );
  const exitStart = Math.max(0, durationInFrames - transFrames);
  const last = Math.max(0, durationInFrames - 1);
  const xIn = interpolate(frame, [0, transFrames], [pIn.xInStart, pIn.xInEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const yIn = interpolate(frame, [0, transFrames], [pIn.yInStart, pIn.yInEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scaleIn = interpolate(frame, [0, transFrames], [pIn.scaleInStart, pIn.scaleInEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateIn = interpolate(frame, [0, transFrames], [pIn.rotateInStart, pIn.rotateInEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const xOut = interpolate(frame, [exitStart, last], [pOut.xOutStart, pOut.xOutEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const yOut = interpolate(frame, [exitStart, last], [pOut.yOutStart, pOut.yOutEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scaleOut = interpolate(frame, [exitStart, last], [pOut.scaleOutStart, pOut.scaleOutEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateOut = interpolate(frame, [exitStart, last], [pOut.rotateOutStart, pOut.rotateOutEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacityIn = interpolate(frame, [0, transFrames], [pIn.opacityInStart, pIn.opacityInEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacityOut = interpolate(frame, [exitStart, last], [pOut.opacityOutStart, pOut.opacityOutEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return {
    translateX: xIn + xOut,
    translateY: yIn + yOut,
    scale: scaleIn * scaleOut,
    rotateZ: rotateIn + rotateOut,
    opacity: opacityIn * opacityOut,
    transInFrames: transFrames,
    layoutFxStrength: pIn.layoutFxStrength,
  };
}

export const NewscastSceneZTransition: React.FC<{
  durationInFrames: number;
  sceneIndex: number;
  sceneCount?: number;
  layoutType?: string;
  children: React.ReactNode;
}> = ({ durationInFrames, sceneIndex, sceneCount, layoutType, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = resolveLayoutTransitionStyle(layoutType);
  const inStyle = style;
  const outStyle = style;
  const { translateX, translateY, scale, rotateZ, opacity, transInFrames, layoutFxStrength } =
    useSceneMotionStyle(durationInFrames, inStyle, outStyle);
  const capHalf = Math.max(1, Math.floor(durationInFrames / 2));
  const baseTransInFrames = Math.min(
    Math.round(TRANS_WINDOW_SEC * fps),
    Math.max(3, Math.floor(durationInFrames * 0.26)),
    capHalf,
  );
  const glassNarrativeSplitFrames = Math.min(
    Math.max(3, Math.round(baseTransInFrames * 0.42)),
    Math.max(2, durationInFrames - 1),
  );
  const splitCoverPct =
    layoutType === "glass_narrative"
      ? interpolate(frame, [0, glassNarrativeSplitFrames], [50, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const splitGlassDropY =
    layoutType === "split_glass"
      ? interpolate(frame, [0, transInFrames], [-180 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const splitGlassEntryRotZ =
    layoutType === "split_glass"
      ? interpolate(frame, [0, transInFrames], [-8 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const splitGlassEntryRotateY =
    layoutType === "split_glass"
      ? interpolate(frame, [0, transInFrames], [10 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const splitGlassSpiralX =
    layoutType === "split_glass"
      ? interpolate(frame, [0, transInFrames], [-76 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const splitGlassCamScale =
    layoutType === "split_glass"
      ? interpolate(frame, [0, transInFrames], [1 + 0.14 * layoutFxStrength, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const splitGlassImpactShakeAmp =
    layoutType === "split_glass"
      ? interpolate(frame, [0, 7, 20], [8 * layoutFxStrength, 4 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const splitGlassShakeX =
    layoutType === "split_glass"
      ? Math.sin(frame * 2.6) * splitGlassImpactShakeAmp
      : 0;
  const splitGlassShakeY =
    layoutType === "split_glass"
      ? Math.cos(frame * 2.1) * splitGlassImpactShakeAmp * 0.55
      : 0;
  const splitGlassVortexPulseScale =
    layoutType === "split_glass"
      ? interpolate(frame, [0, Math.max(2, Math.floor(transInFrames * 0.45)), transInFrames], [1 + 0.22 * layoutFxStrength, 1 + 0.08 * layoutFxStrength, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const splitGlassFlashOpacity =
    layoutType === "split_glass"
      ? interpolate(frame, [0, 4, 12], [0.24 * layoutFxStrength, 0.12 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const splitGlassGlobeZoomScale =
    layoutType === "split_glass"
      ? interpolate(frame, [0, Math.max(5, Math.floor(transInFrames * 0.62)), transInFrames], [1.28, 1.1, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const splitGlassGlobeZoomOpacity =
    layoutType === "split_glass"
      ? interpolate(frame, [0, Math.max(5, Math.floor(transInFrames * 0.66)), transInFrames], [0.34, 0.2, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glowMetricGlobeZoomScale =
    layoutType === "glow_metric"
      ? interpolate(frame, [0, Math.max(6, Math.floor(transInFrames * 0.62)), transInFrames], [1.38, 1.14, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const glowMetricGlobeZoomOpacity =
    layoutType === "glow_metric"
      ? interpolate(frame, [0, Math.max(6, Math.floor(transInFrames * 0.68)), transInFrames], [0.62, 0.3, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const chapterBreakCamScale =
    layoutType === "chapter_break"
      ? interpolate(frame, [0, transInFrames], [1 + 0.24 * layoutFxStrength, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const chapterBreakCamRoll =
    layoutType === "chapter_break"
      ? interpolate(frame, [0, transInFrames], [4 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const chapterBreakCamY =
    layoutType === "chapter_break"
      ? interpolate(frame, [0, transInFrames], [15 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const chapterBreakCamX =
    layoutType === "chapter_break"
      ? interpolate(frame, [0, transInFrames], [-24 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const chapterBreakFlashOpacity =
    layoutType === "chapter_break"
      ? interpolate(frame, [0, 5, 15], [0.2 * layoutFxStrength, 0.1 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const chapterBreakShakeAmp =
    layoutType === "chapter_break"
      ? interpolate(frame, [0, 8, 20], [4 * layoutFxStrength, 2 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const chapterBreakShakeX =
    layoutType === "chapter_break"
      ? Math.sin(frame * 2.9) * chapterBreakShakeAmp
      : 0;
  const isKineticInsight = layoutType === "kinetic_insight";
  const kineticCamScale =
    isKineticInsight
      ? interpolate(frame, [0, transInFrames], [1 + 0.13 * layoutFxStrength, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const kineticCamY =
    isKineticInsight
      ? interpolate(frame, [0, transInFrames], [20 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glassImageCamX =
    layoutType === "glass_image"
      ? interpolate(frame, [0, Math.max(transInFrames + 20, Math.round(transInFrames * 1.9))], [138 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glassImageCamScale =
    layoutType === "glass_image"
      ? interpolate(frame, [0, Math.max(transInFrames + 20, Math.round(transInFrames * 1.9))], [1 + 0.28 * layoutFxStrength, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const glassImageCrackleStrength =
    layoutType === "glass_image"
      ? interpolate(frame, [0, 14, 34, 56], [0.24, 0.16, 0.08, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glassImageCrackleOpacity = Math.max(
    0,
    glassImageCrackleStrength * (0.68 + 0.22 * Math.abs(Math.sin(frame * 1.4))),
  );
  const glassImageGlobeZoomScale =
    layoutType === "glass_image"
      ? interpolate(frame, [0, Math.max(8, Math.floor(transInFrames * 0.72)), transInFrames], [1.62, 1.28, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const glassImageGlobeZoomOpacity =
    layoutType === "glass_image"
      ? interpolate(frame, [0, Math.max(8, Math.floor(transInFrames * 0.74)), transInFrames], [0.72, 0.38, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glassCodeCamScale =
    layoutType === "glass_code"
      ? interpolate(frame, [0, transInFrames], [1 + 0.16 * layoutFxStrength, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const glassCodeCamY =
    layoutType === "glass_code"
      ? interpolate(frame, [0, transInFrames], [68 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glassNarrativeCamX =
    layoutType === "glass_narrative"
      ? interpolate(frame, [0, transInFrames], [-66 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glassNarrativeCamRotY =
    layoutType === "glass_narrative"
      ? interpolate(frame, [0, transInFrames], [8 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glassStackCamX =
    layoutType === "glass_stack"
      ? interpolate(frame, [0, transInFrames], [64 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glassStackCamY =
    layoutType === "glass_stack"
      ? interpolate(frame, [0, transInFrames], [24 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glassStackCamRoll =
    layoutType === "glass_stack"
      ? interpolate(frame, [0, transInFrames], [-4 * layoutFxStrength, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const glassStackCamScale =
    layoutType === "glass_stack"
      ? interpolate(frame, [0, transInFrames], [1 + 0.11 * layoutFxStrength, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <AbsoluteFill
      style={{
        perspective: 1650,
        transformStyle: "preserve-3d",
      }}
    >
      <AbsoluteFill
        style={{
          transform:
            layoutType === "split_glass"
              ? `translateY(${translateY + splitGlassDropY + splitGlassShakeY}px) translateX(${translateX + splitGlassSpiralX + splitGlassShakeX}px) scale(${scale * splitGlassCamScale * splitGlassVortexPulseScale}) rotateX(${splitGlassEntryRotZ * -0.35}deg) rotateY(${splitGlassEntryRotateY}deg) rotateZ(${splitGlassEntryRotZ + rotateZ}deg)`
              : isKineticInsight
                ? `translateY(${translateY + kineticCamY}px) translateX(${translateX}px) scale(${scale * kineticCamScale}) rotateZ(${rotateZ}deg)`
              : layoutType === "glass_image"
                ? `translateX(${translateX + glassImageCamX}px) translateY(${translateY}px) scale(${scale * glassImageCamScale}) rotateZ(${rotateZ}deg)`
              : layoutType === "glass_code"
                ? `translateY(${translateY + glassCodeCamY}px) translateX(${translateX}px) scale(${scale * glassCodeCamScale}) rotateZ(${rotateZ}deg)`
              : layoutType === "glass_stack"
                ? `translateX(${translateX + glassStackCamX}px) translateY(${translateY + glassStackCamY}px) scale(${scale * glassStackCamScale}) rotateZ(${glassStackCamRoll + rotateZ}deg)`
              : layoutType === "glass_narrative"
                ? `translateX(${translateX + glassNarrativeCamX}px) translateY(${translateY}px) scale(${scale}) rotateY(${glassNarrativeCamRotY}deg) rotateZ(${rotateZ}deg)`
              : layoutType === "chapter_break"
                ? `translateY(${translateY + chapterBreakCamY}px) translateX(${translateX + chapterBreakCamX + chapterBreakShakeX}px) scale(${scale * chapterBreakCamScale}) rotateZ(${chapterBreakCamRoll + rotateZ}deg)`
              : layoutType === "glow_metric"
                ? `translateX(${translateX}px) translateY(${translateY}px) scale(${scale}) rotateZ(${rotateZ}deg)`
              : `translateX(${translateX}px) translateY(${translateY}px) scale(${scale}) rotateZ(${rotateZ}deg)`,
          transformStyle: "preserve-3d",
          transformOrigin: "50% 50%",
          opacity,
          backfaceVisibility: "hidden",
        }}
      >
        {children}
      </AbsoluteFill>
      {layoutType === "glass_narrative" && splitCoverPct > 0 ? (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${splitCoverPct}%`,
              background:
                "linear-gradient(90deg, rgba(4,4,14,0.7) 0%, rgba(8,18,42,0.58) 65%, rgba(12,34,80,0.34) 100%)",
              borderRight: "1px solid rgba(212,170,80,0.12)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: `${splitCoverPct}%`,
              background:
                "linear-gradient(270deg, rgba(4,4,14,0.7) 0%, rgba(8,18,42,0.58) 65%, rgba(12,34,80,0.34) 100%)",
              borderLeft: "1px solid rgba(212,170,80,0.12)",
              pointerEvents: "none",
            }}
          />
        </>
      ) : null}
      {layoutType === "split_glass" && splitGlassFlashOpacity > 0 ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 44%, rgba(255,255,255,0.9) 0%, rgba(180,220,255,0.45) 32%, rgba(120,170,255,0.2) 58%, rgba(10,20,44,0) 75%)",
            opacity: splitGlassFlashOpacity,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      {layoutType === "split_glass" && splitGlassGlobeZoomOpacity > 0 ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: splitGlassGlobeZoomOpacity,
            transform: `scale(${splitGlassGlobeZoomScale})`,
            transformOrigin: "72% 50%",
            background:
              "radial-gradient(circle at 72% 50%, rgba(140,190,255,0.34) 0%, rgba(90,150,255,0.2) 24%, rgba(40,90,190,0.1) 46%, rgba(8,20,44,0) 72%)",
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      {layoutType === "glass_image" && glassImageCrackleOpacity > 0 ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: glassImageCrackleOpacity,
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(215,235,255,0.22) 0 1px, rgba(20,45,95,0.0) 1px 6px), repeating-linear-gradient(0deg, rgba(215,235,255,0.12) 0 1px, rgba(20,45,95,0.0) 1px 7px)",
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      {layoutType === "glass_image" && glassImageGlobeZoomOpacity > 0 ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: glassImageGlobeZoomOpacity,
            transform: `scale(${glassImageGlobeZoomScale})`,
            transformOrigin: "70% 50%",
            background:
              "radial-gradient(circle at 70% 50%, rgba(155,205,255,0.46) 0%, rgba(92,158,255,0.24) 24%, rgba(32,88,190,0.14) 48%, rgba(8,20,44,0) 74%)",
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      {layoutType === "glow_metric" && glowMetricGlobeZoomOpacity > 0 ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: glowMetricGlobeZoomOpacity,
            transform: `scale(${glowMetricGlobeZoomScale})`,
            transformOrigin: "72% 50%",
            background:
              "radial-gradient(circle at 72% 50%, rgba(175,220,255,0.52) 0%, rgba(102,168,255,0.26) 26%, rgba(30,86,190,0.14) 50%, rgba(10,20,44,0) 74%)",
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      {layoutType === "chapter_break" && chapterBreakFlashOpacity > 0 ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 48% 48%, rgba(255,255,255,0.78) 0%, rgba(212,170,80,0.28) 22%, rgba(120,180,255,0.2) 46%, rgba(10,20,44,0) 74%)",
            opacity: chapterBreakFlashOpacity,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
