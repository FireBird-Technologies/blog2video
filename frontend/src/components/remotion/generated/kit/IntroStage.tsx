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
import type { BookendArrangement } from "./variants";

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
  /** Forwarded straight to RevealText — must accept everything the blueprint's
   *  TITLE_REVEALS vocabulary can select, or a template's chosen reveal
   *  silently degrades to the "word" default. It carried only 4 of the 6. */
  titleReveal?: "word" | "line" | "char" | "blur" | "typewriter" | "mask_up" | "fade";
  start?: number;
  style?: React.CSSProperties;
  /** WHERE the opening sits. Defaults to the template's brand-seeded variant,
   *  so an EXISTING stored scene that never passes this still gains variety —
   *  the same ambient-context trick KitVariantProvider exists for.
   *
   *  Every brand previously got the one hardcoded centred lockup, which is why
   *  two different templates opened identically. */
  arrangement?: BookendArrangement;
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
  arrangement,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, fonts, type, isPortrait, variant } = useKit();

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

  /* Explicit prop wins, then the template's ambient variant, then the
   * historical centred look — so nothing changes for a caller that opts out. */
  const mode: BookendArrangement = arrangement ?? variant.intro ?? "centred-lockup";

  // Placement per arrangement. Only `centred-lockup` keeps the original
  // centre/centre/centre; every other mode moves the block off the middle,
  // which is the whole point — a recolour of the same composition is what made
  // two brands' openings indistinguishable.
  const centred = mode === "centred-lockup";
  const bottom = mode === "stacked-baseline";
  const leftish = mode === "corner-mark" || mode === "left-rail" || mode === "split-plate";
  const align = centred ? "center" : leftish ? "flex-start" : "flex-start";
  const justify = bottom ? "flex-end" : centred ? "center" : "center";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      {decor && decor !== "none" && <Decor system={decor} intensity={decorIntensity} />}
      {/* left-rail's defining element: a full-height accent edge the content
          hangs off, rather than a short rule under a centred mark. */}
      {mode === "left-rail" && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 10,
            background: palette.accent,
            transform: `scaleY(${ruleGrow})`,
            transformOrigin: "top",
          }}
        />
      )}
      {/* split-plate: one half filled, so the division IS the composition. */}
      {mode === "split-plate" && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: isPortrait ? "100%" : "42%",
            height: isPortrait ? "38%" : "100%",
            background: withAlpha(palette.accent, 0.14),
            transform: `scaleX(${ruleGrow})`,
            transformOrigin: "left",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: align,
          justifyContent: justify,
          textAlign: centred ? "center" : "left",
          gap: isPortrait ? 22 : 26,
          padding: mode === "left-rail"
            ? (isPortrait ? "8% 8% 8% 14%" : "9% 12% 9% 8%")
            : bottom
              ? (isPortrait ? "8% 8% 12%" : "9% 12% 10%")
              : (isPortrait ? "8% 8%" : "9% 12%"),
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

        {/* The short accent rule belongs to the lockup. left-rail and
            split-plate already carry their own accent structure, and
            full-bleed-statement is defined by having no lockup at all. */}
        {mode !== "left-rail" && mode !== "split-plate" && mode !== "full-bleed-statement" && (
          <div
            style={{
              height: 4,
              width: 64,
              background: palette.accent,
              borderRadius: 4,
              transform: `scaleX(${ruleGrow})`,
              transformOrigin: centred ? "center" : "left",
              boxShadow: `0 0 18px ${withAlpha(palette.accent, 0.5)}`,
            }}
          />
        )}

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
