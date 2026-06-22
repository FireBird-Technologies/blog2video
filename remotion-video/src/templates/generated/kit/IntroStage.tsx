/**
 * Custom-template craft kit — IntroStage.
 *
 * WHY: built-in templates open with a signature reveal (book-open, terminal-boot,
 * magazine-cover) while custom intros were a thin fade. IntroStage is an OPTIONAL
 * scaffold that gives every custom intro a coherent brand-reveal beat: a logo
 * settle, a staggered brand-title reveal, an accent rule draw, and the brand's
 * signature decor backdrop — all timed as ONE entrance.
 *
 * HOW IT STAYS VALID: the component validator requires the generated intro CODE
 * to contain a `props.logoUrl &&` conditional. So IntroStage takes a pre-built
 * `logo` SLOT (the scene passes `logo={props.logoUrl && <Img .../>}`) rather than
 * a URL — the conditional lives in the scene code, the choreography lives here.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { useKit } from "./context";
import { withAlpha } from "./theme";
import { RevealText } from "./text";
import { Decor, type DecorSystem } from "./Decor";

export interface IntroStageProps {
  /** Brand title / props.displayText. */
  title: string;
  subtitle?: React.ReactNode;
  /** Pass {props.logoUrl && <Img src={props.logoUrl} ... />} — keeps the scene valid. */
  logo?: React.ReactNode;
  /** Brand signature decor backdrop. */
  decor?: DecorSystem;
  decorIntensity?: number;
  /** Title reveal personality — "blur" for energetic brands, "word"/"line" for calm. */
  titleReveal?: "word" | "line" | "char" | "blur";
  start?: number;
  style?: React.CSSProperties;
}

export const IntroStage: React.FC<IntroStageProps> = ({
  title,
  subtitle,
  logo,
  decor,
  decorIntensity = 0.5,
  titleReveal = "word",
  start = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, fonts, type, isPortrait } = useKit();

  if (frame === 0 && typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.log(`[F7-DEBUG][V3][LAYOUT] IntroStage titleReveal=${titleReveal} decor=${decor ?? "none"}`);
  }

  // Signature beat: the logo settles in with a spring, the rule draws, the title
  // reveals — staggered so it reads as one choreographed opening, not a flat fade.
  const logoIn = spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 110 } });
  const ruleGrow = interpolate(frame, [start + 8, start + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      {decor && decor !== "none" && <Decor system={decor} intensity={decorIntensity} />}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: isPortrait ? 22 : 26,
          padding: isPortrait ? "8% 8%" : "9% 12%",
        }}
      >
        {logo && (
          <div
            style={{
              opacity: logoIn,
              transform: `scale(${0.7 + logoIn * 0.3}) translateY(${(1 - logoIn) * 18}px)`,
              marginBottom: 6,
            }}
          >
            {logo}
          </div>
        )}

        <div
          style={{
            height: 4,
            width: 64,
            background: palette.accent,
            borderRadius: 4,
            transform: `scaleX(${ruleGrow})`,
            transformOrigin: "center",
            boxShadow: `0 0 18px ${withAlpha(palette.accent, 0.5)}`,
          }}
        />

        <RevealText
          text={title}
          mode={titleReveal}
          start={start + 6}
          as="h1"
          style={{
            fontFamily: fonts.heading,
            fontSize: type.title,
            fontWeight: 800,
            color: palette.text,
            lineHeight: 1.05,
            margin: 0,
            maxWidth: "92%",
          }}
        />

        {subtitle && (
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: type.body,
              color: palette.muted,
              opacity: interpolate(frame, [start + 20, start + 34], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              maxWidth: isPortrait ? "92%" : "70%",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
