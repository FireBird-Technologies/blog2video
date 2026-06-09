import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ECONOMIST_COLORS, CHROME_INSET, lighten, darken } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { formatEconomistWeek } from "../layouts/chartHelpers";

/**
 * EconomistChrome — the persistent ambient "paper" behind every scene, plus the
 * shared newscast furniture: a thin hairline masthead strip pinned to the top
 * (wordmark · section tab) and a footer strip pinned to the bottom (running
 * dateline · scene-progress dots). The furniture gives every scene one cohesive
 * editorial frame without competing with each layout's own headline.
 *
 * Furniture is suppressed when `minimal` is set — the full-bleed scenes
 * (cover_reveal, image_feature, ending_socials) own the whole canvas and draw
 * their own mastheads. Content still eases in over ~6 frames unless `disableFade`.
 */
interface EconomistChromeProps {
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
  sectionLabel?: string;
  dateline?: string;
  wordmark?: string;
  minimal?: boolean;
  disableFade?: boolean;
  /** Index of this scene (for the footer progress dots). */
  sceneIndex?: number;
  /** Total scene count (for the footer progress dots). */
  sceneCount?: number;
  children?: React.ReactNode;
}

export const EconomistChrome: React.FC<EconomistChromeProps> = ({
  bgColor = ECONOMIST_COLORS.paper,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  sectionLabel,
  dateline,
  wordmark,
  minimal = false,
  disableFade = false,
  sceneIndex,
  sceneCount,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const isPortrait = width <= 1080;

  const contentOpacity = disableFade
    ? 1
    : interpolate(frame, [0, 6], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {/* Warm paper base — soft top-left light, gently darker corners. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 28% 18%, ${lighten(
            bgColor,
            0.04,
          )} 0%, ${bgColor} 54%, ${darken(bgColor, 0.045)} 100%)`,
        }}
      />

      {/* Faint print grain — keeps the flat paper from looking digital. */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.035,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      >
        <defs>
          <filter id="economist-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#economist-grain)" />
      </svg>

      {/* Soft vignette for depth. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 58%, rgba(40,34,22,0.06) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Scene content. */}
      <AbsoluteFill style={{ opacity: contentOpacity, zIndex: 10 }}>
        {children}
      </AbsoluteFill>

      {/* Shared newscast furniture — suppressed on full-bleed scenes. */}
      {!minimal && (
        <ChromeFurniture
          isPortrait={isPortrait}
          accentColor={accentColor}
          textColor={textColor}
          sectionLabel={sectionLabel}
          dateline={dateline}
          wordmark={wordmark}
          sceneIndex={sceneIndex}
          sceneCount={sceneCount}
        />
      )}
    </AbsoluteFill>
  );
};

interface ChromeFurnitureProps {
  isPortrait: boolean;
  accentColor: string;
  textColor: string;
  sectionLabel?: string;
  dateline?: string;
  wordmark?: string;
  sceneIndex?: number;
  sceneCount?: number;
}

/** The top masthead strip + bottom dateline/progress strip. */
const ChromeFurniture: React.FC<ChromeFurnitureProps> = ({
  isPortrait,
  accentColor,
  textColor,
  sectionLabel,
  dateline,
  wordmark,
  sceneIndex,
  sceneCount,
}) => {
  const frame = useCurrentFrame();

  const sidePad = isPortrait ? 48 : 64;
  const topH = isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top;
  const botH = isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom;

  // Subtle furniture entrance — quieter than scene content so it reads as a frame.
  const op = interpolate(frame, [2, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const topY = interpolate(frame, [2, 16], [-8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const botY = interpolate(frame, [2, 16], [8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tickW = interpolate(frame, [6, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const sectionText = (sectionLabel ?? "").trim();
  const wordmarkText = (wordmark ?? "").trim();
  const datelineText = (dateline && dateline.trim()) || formatEconomistWeek();

  return (
    <>
      {/* Top masthead strip. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: topH,
          padding: `0 ${sidePad}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          opacity: op,
          transform: `translateY(${topY}px)`,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Left — running wordmark (omitted if none, never invent a brand). */}
          {wordmarkText ? (
            <span
              style={{
                fontFamily: ECONOMIST_SERIF_FONT,
                fontWeight: 700,
                fontSize: isPortrait ? 19 : 20,
                letterSpacing: 0.4,
                color: textColor,
              }}
            >
              {wordmarkText}
            </span>
          ) : (
            <span />
          )}

          {/* Right — section tab + label. */}
          {sectionText && (
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 22, height: 4, background: accentColor }} />
              <span
                style={{
                  fontFamily: ECONOMIST_SANS_FONT,
                  fontWeight: 700,
                  fontSize: isPortrait ? 15 : 16,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: ECONOMIST_COLORS.muted,
                }}
              >
                {sectionText}
              </span>
            </span>
          )}
        </div>

        {/* Hairline rule + accent flag-tick. */}
        <div style={{ position: "relative", marginTop: 10, height: 2 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0.5, height: 1, background: ECONOMIST_COLORS.rule }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 120,
              height: 2,
              background: accentColor,
              transform: `scaleX(${tickW})`,
              transformOrigin: "left center",
            }}
          />
        </div>
      </div>

      {/* Bottom dateline / progress strip. */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: botH,
          padding: `0 ${sidePad}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          opacity: op,
          transform: `translateY(${botY}px)`,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <div style={{ height: 1, background: ECONOMIST_COLORS.rule, marginBottom: 10 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Left — running dateline. */}
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 22, height: 1.5, background: ECONOMIST_COLORS.rule }} />
            <span
              style={{
                fontFamily: ECONOMIST_SANS_FONT,
                fontWeight: 700,
                fontSize: isPortrait ? 14 : 14,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: ECONOMIST_COLORS.muted,
              }}
            >
              {datelineText}
            </span>
          </span>

          {/* Right — editorial page folio "02 / 11". */}
          <SceneFolio sceneIndex={sceneIndex} sceneCount={sceneCount} accentColor={accentColor} />
        </div>
      </div>
    </>
  );
};

interface SceneFolioProps {
  sceneIndex?: number;
  sceneCount?: number;
  accentColor: string;
}

/** An editorial page-number folio: "02 / 11" — current in accent, total in muted. */
const SceneFolio: React.FC<SceneFolioProps> = ({ sceneIndex, sceneCount, accentColor }) => {
  if (!sceneCount || sceneCount <= 0) return null;
  const cur = String((sceneIndex ?? 0) + 1).padStart(2, "0");
  const total = String(sceneCount).padStart(2, "0");
  return (
    <span
      style={{
        fontFamily: ECONOMIST_SANS_FONT,
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: 2,
        color: ECONOMIST_COLORS.muted,
      }}
    >
      <span style={{ color: accentColor }}>{cur}</span>
      {" / "}
      {total}
    </span>
  );
};
