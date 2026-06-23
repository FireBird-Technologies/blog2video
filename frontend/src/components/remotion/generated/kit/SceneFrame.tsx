/**
 * Custom-template craft kit — SceneFrame.
 *
 * The scaffolding every generated scene wraps its content in. Handles:
 *  - brand background (solid or on-brand gradient)
 *  - portrait-aware padding
 *  - universal enter*exit master opacity (clean scene boundaries)
 *  - optional chrome: eyebrow/kicker, footer label, accent edge bars
 *  - provides palette + type scale to child kit components via context
 *
 * Generalized from the SceneFrame patterns in bloomberg (chrome bars),
 * nightfall (gradient bg) and chronicle (padded editorial frame).
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { KitProvider, colorsFromBrand, useKit, type KitFonts } from "./context";
import { backgroundCss, withAlpha } from "./theme";
import { masterOpacity, progressAt, easeOutQuint } from "./motion";

export interface SceneFrameProps {
  brandColors: {
    accent?: string;
    primary?: string;
    background?: string;
    text?: string;
    bg2?: string;
  };
  aspectRatio?: "landscape" | "portrait";
  fonts?: KitFonts;
  overrides?: { title?: number; body?: number };
  /** Small uppercase kicker at the top of the scene. */
  eyebrow?: string;
  /** Small footer label (e.g. brand domain / section). */
  footer?: string;
  /** Accent edge bar style. */
  edge?: "none" | "top" | "left" | "bottom";
  /** Disable the default fade-in/out (e.g. for the very first frame). */
  noFade?: boolean;
  /** Gradient angle when bg2 present. */
  gradientAngle?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const Chrome: React.FC<{ eyebrow?: string; footer?: string; edge: SceneFrameProps["edge"] }> = ({
  eyebrow,
  footer,
  edge,
}) => {
  const { palette, type, isPortrait, fonts } = useKit();
  const frame = useCurrentFrame();
  const pad = isPortrait ? 56 : 72;
  const reveal = easeOutQuint(progressAt(frame, 4, 16));

  return (
    <>
      {edge && edge !== "none" && (
        <div
          style={{
            position: "absolute",
            background: palette.accent,
            ...(edge === "top" && { top: 0, left: 0, right: 0, height: 6 }),
            ...(edge === "bottom" && { bottom: 0, left: 0, right: 0, height: 6 }),
            ...(edge === "left" && { top: 0, bottom: 0, left: 0, width: 6 }),
            transform: edge === "left" ? `scaleY(${reveal})` : `scaleX(${reveal})`,
            transformOrigin: edge === "left" ? "top" : "left",
          }}
        />
      )}
      {eyebrow && (
        <div
          style={{
            position: "absolute",
            top: pad,
            left: pad,
            right: pad,
            fontFamily: fonts.body,
            fontSize: type.label,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: palette.accent,
            opacity: reveal,
          }}
        >
          {eyebrow}
        </div>
      )}
      {footer && (
        <div
          style={{
            position: "absolute",
            bottom: pad * 0.7,
            left: pad,
            right: pad,
            fontFamily: fonts.body,
            fontSize: type.label,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: palette.muted,
            opacity: reveal * 0.9,
            borderTop: `1px solid ${withAlpha(palette.text, 0.1)}`,
            paddingTop: 10,
          }}
        >
          {footer}
        </div>
      )}
    </>
  );
};

export const SceneFrame: React.FC<SceneFrameProps> = ({
  brandColors,
  aspectRatio = "landscape",
  fonts,
  overrides,
  eyebrow,
  footer,
  edge = "none",
  noFade = false,
  gradientAngle = 160,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height, width } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait" || height > width;
  const colors = colorsFromBrand(brandColors);
  const opacity = noFade ? 1 : masterOpacity(frame, durationInFrames);

  return (
    <KitProvider colors={colors} isPortrait={isPortrait} fonts={fonts} overrides={overrides}>
      <ContextBackground
        opacity={opacity}
        gradientAngle={gradientAngle}
        eyebrow={eyebrow}
        footer={footer}
        edge={edge}
        isPortrait={isPortrait}
        style={style}
      >
        {children}
      </ContextBackground>
    </KitProvider>
  );
};

/** Inner component so it can read the freshly-provided context. */
const ContextBackground: React.FC<{
  opacity: number;
  gradientAngle: number;
  eyebrow?: string;
  footer?: string;
  edge: SceneFrameProps["edge"];
  isPortrait: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ opacity, gradientAngle, eyebrow, footer, edge, isPortrait, style, children }) => {
  const { palette, fonts } = useKit();
  const padV = isPortrait ? "9%" : "7%";
  const padH = isPortrait ? "8%" : "8%";
  const hasChrome = !!(eyebrow || footer || (edge && edge !== "none"));

  return (
    <AbsoluteFill
      style={{
        background: backgroundCss(palette, gradientAngle),
        color: palette.text,
        fontFamily: fonts.body,
        overflow: "hidden",
        opacity,
      }}
    >
      {hasChrome && <Chrome eyebrow={eyebrow} footer={footer} edge={edge} />}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: `${padV} ${padH}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          ...style,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
