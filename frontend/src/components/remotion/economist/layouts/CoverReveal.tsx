import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { EconomistMasthead } from "../components/EconomistMasthead";
import { EngravingTexture, ConcentricRings } from "../components/EconomistOrnaments";
import {
  clamp01,
  easeOutQuint,
  letterpressStamp,
  redactionReveal,
  ruleDraw,
  slideFrom,
} from "./motion";

/**
 * CoverReveal — the premium cinematic magazine-cover hero (← intro.jpg).
 *
 * Acts (≈300 frames @ 30fps):
 *   1. photo reveals on a back layer with a slow Ken-Burns push (parallax depth)
 *   2. the red masthead flag drops in top-left + a light sweep crosses the wordmark
 *   3. contents teasers stagger in top-right, each on its own hairline rule
 *   4. the dateline draws beneath them
 *   5. the big serif headline assembles word-by-word lower-left (foreground layer)
 *   6. a page-lift wind-up scales/lifts the whole cover into the hand-off slide
 */
export const CoverReveal: React.FC<EconomistLayoutProps> = ({
  title,
  wordmark,
  dateline,
  teasers,
  imageUrl,
  imageObjectPosition = "50% 50%",
  imageZoom = 1,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  fontFamily,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const hasImage = Boolean(imageUrl);

  const margin = isPortrait ? width * 0.06 : width * 0.045;

  // ── Ken-Burns push + parallax drift on the photo (back layer) ──────────────
  const kbScale = interpolate(frame, [0, 300], [1.05, 1.13], {
    extrapolateRight: "clamp",
  }) * imageZoom;
  const photoDriftX = interpolate(frame, [0, 300], [0, 14], { extrapolateRight: "clamp" });
  const photoDriftY = interpolate(frame, [0, 300], [0, -10], { extrapolateRight: "clamp" });
  const photoOpacity = interpolate(frame, [0, 26], [0, 1], { extrapolateRight: "clamp" });

  // ── Page-lift wind-up (foreground + whole stage) ───────────────────────────
  const lift = interpolate(frame, [248, 300], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stageScale = 1 + lift * 0.035;
  const stageY = -lift * 14;
  const stageDim = 1 - lift * 0.12;
  // Foreground parallax: text drifts opposite the photo, a touch faster on lift.
  const fgDriftX = interpolate(frame, [0, 300], [0, -7], { extrapolateRight: "clamp" });

  // ── Masthead flag entrance (top-left) ──────────────────────────────────────
  const mastheadIn = spring({ frame: frame - 4, fps, config: { damping: 14, mass: 0.6 } });
  const mastheadScale = interpolate(mastheadIn, [0, 1], [0.9, 1]);
  const mastheadOp = interpolate(frame, [4, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const mastheadSweep = interpolate(frame, [12, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const mastheadW = isPortrait ? width * 0.4 : width * 0.2;

  // ── Red headline block entrance: a print-wipe ──────────────────────────────
  // The block is wiped onto the page left→right (clip-path) like a press laying
  // down a band of ink, then settles from a slight oversize to rest.
  const blockWipe = easeOutQuint(clamp01((frame - 8) / 18)); // frames 8–26
  const blockClip = `inset(0 ${(100 - blockWipe * 100).toFixed(2)}% 0 0)`;
  const blockSettle = easeOutQuint(clamp01((frame - 26) / 10)); // frames 26–36
  const blockScale = 1.03 - 0.03 * blockSettle;
  const blockOp = blockWipe > 0 ? 1 : 0;

  const teaserInk = hasImage ? "rgba(255,255,255,0.94)" : textColor;
  const ruleColor = hasImage ? "rgba(255,255,255,0.5)" : ECONOMIST_COLORS.rule;
  const datelineInk = hasImage ? "rgba(255,255,255,0.82)" : ECONOMIST_COLORS.muted;
  const textShadow = hasImage ? "0 2px 18px rgba(0,0,0,0.45)" : "none";

  // ── Headline word-by-word assembly (now the red hero block) ─────────────────
  // Length-aware sizing: a fixed size makes long titles swamp the frame (the red
  // block covers the whole image). Shrink the type as the title grows so the
  // block always leaves the cover photo breathing room. The longest word also
  // bounds the size so a single long word never overflows the block edges.
  const baseHeadlineSize = (titleFontSize ?? (isPortrait ? 104 : 132)) as number;
  const words = (title || "").split(/\s+/).filter(Boolean);
  const charCount = (title || "").trim().length;
  const longestWord = words.reduce((m, w) => Math.max(m, w.length), 0);
  // Reference comfortably fits ~22 chars at the base size; scale down past that.
  const fitByChars = Math.min(1, 26 / Math.max(charCount, 1));
  // A single long word shouldn't exceed ~62% of the block's inner width.
  const fitByWord = Math.min(1, 12 / Math.max(longestWord, 1));
  const headlineSize = Math.max(
    isPortrait ? 52 : 60,
    Math.round(baseHeadlineSize * Math.min(fitByChars, fitByWord)),
  );
  const headlineStart = 30;

  const teaserList = (teasers ?? []).slice(0, 5);
  // The masthead shows the brand/publication name from the brief. When none is
  // given we hide the flag entirely rather than print a brand the user never
  // chose (e.g. "The Economist" — that is the style homage, not their brand).
  const brandWordmark = (wordmark ?? "").trim();

  // Teaser column geometry. In portrait the masthead sits at the very top, so the
  // contents list drops below it; in landscape it lives in the top-right column.
  const teaserColLeft = isPortrait ? margin : width * 0.52;
  const teaserColWidth = isPortrait ? width - margin * 2 : width * 0.5 - margin;
  // In portrait the headline rides up to ~34% of height; the teasers now sit
  // below it (under its rule) rather than high under the masthead. In landscape
  // they stay in the top-right column.
  const teaserTop = isPortrait ? height * 0.5 : margin + 6;
  const teaserFont = isPortrait ? 44 : 32;

  return (
    <AbsoluteFill style={{ backgroundColor: hasImage ? "#111" : ECONOMIST_COLORS.paper }}>
      {/* Back layer: photo (or paper-gradient + cover-motif fallback). */}
      <AbsoluteFill
        style={{
          transform: `scale(${stageScale}) translateY(${stageY}px)`,
          opacity: stageDim,
        }}
      >
        {hasImage ? (
          <AbsoluteFill style={{ opacity: photoOpacity, overflow: "hidden" }}>
            <Img
              src={imageUrl as string}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: imageObjectPosition,
                transform: `scale(${kbScale}) translate(${photoDriftX}px, ${photoDriftY}px)`,
              }}
            />
            {/* Legibility: soft top band (masthead/teasers) + a centred
                spotlight behind the centred headline. */}
            <AbsoluteFill
              style={{
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 26%)",
              }}
            />
            <AbsoluteFill
              style={{
                background:
                  "radial-gradient(ellipse 74% 44% at 50% 52%, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.18) 56%, rgba(0,0,0,0) 80%)",
              }}
            />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse at 30% 22%, ${ECONOMIST_COLORS.panel} 0%, ${ECONOMIST_COLORS.paper} 55%)`,
            }}
          >
            {/* Faint engraved hairline field so the paper never reads as empty. */}
            <EngravingTexture opacity={0.05} gap={11} />
            {/* Larger concentric cover-motif arcs (the signature ambient motif). */}
            <ConcentricRings cx={82} cy={26} opacity={0.6} />
          </AbsoluteFill>
        )}
      </AbsoluteFill>

      {/* Foreground: teasers + dateline + red headline block. */}
      <AbsoluteFill
        style={{
          transform: `scale(${stageScale}) translate(${fgDriftX}px, ${stageY}px)`,
          opacity: stageDim,
        }}
      >
        {/* Masthead flag + dateline, top-left. */}
        <div
          style={{
            position: "absolute",
            left: margin,
            top: margin,
            opacity: mastheadOp,
            transform: `scale(${mastheadScale})`,
            transformOrigin: "left top",
          }}
        >
          {brandWordmark && (
            <EconomistMasthead
              wordmark={brandWordmark}
              width={mastheadW}
              accentColor={accentColor}
              sweep={mastheadSweep > 0 && mastheadSweep < 1 ? mastheadSweep : undefined}
              fontFamily={fontFamily}
            />
          )}
          {dateline && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: brandWordmark ? 14 : 0 }}>
              <span style={{ width: 26, height: 3, background: accentColor, ...ruleDraw(frame, 18, 12) }} />
              {(() => {
                const reveal = redactionReveal(frame, 20, 16);
                return (
                  <span style={{ position: "relative", display: "inline-block" }}>
                    <span
                      style={{
                        display: "inline-block",
                        fontFamily: fontFamily ?? ECONOMIST_SANS_FONT,
                        fontWeight: 700,
                        fontSize: isPortrait ? 24 : 15,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        color: datelineInk,
                        textShadow,
                        clipPath: reveal.clipPath,
                      }}
                    >
                      {dateline}
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${reveal.barLeftPct.toFixed(2)}%`,
                        width: `${reveal.barWidthPct}%`,
                        background: accentColor,
                        opacity: reveal.barOpacity,
                      }}
                    />
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        {/* Numbered contents teasers, top-right (landscape) / below masthead (portrait). */}
        <div
          style={{
            position: "absolute",
            left: teaserColLeft,
            top: teaserTop,
            width: teaserColWidth,
          }}
        >
          {teaserList.map((t, i) => {
            const start = 30 + i * 8;
            const row = slideFrom(frame, start, -18);
            const numStamp = letterpressStamp(frame, start, 12);
            const reveal = redactionReveal(frame, start + 2, 16);
            const ruleW = interpolate(frame, [start, start + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div key={i} style={{ opacity: row.opacity, transform: row.transform }}>
                <div
                  style={{
                    height: 1,
                    background: ruleColor,
                    width: `${ruleW * 100}%`,
                    transformOrigin: "left",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 14,
                    padding: `${teaserFont * 0.28}px 0`,
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      display: "inline-block",
                      fontFamily: fontFamily ?? ECONOMIST_SANS_FONT,
                      fontWeight: 800,
                      fontSize: teaserFont * 0.62,
                      letterSpacing: 0.5,
                      color: accentColor,
                      textShadow,
                      opacity: numStamp.opacity,
                      transform: numStamp.transform,
                      filter: numStamp.filter,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* Teaser text uncovered by a sweeping accent bar (redaction
                      in reverse) — the bar rides ahead of the revealed copy. */}
                  <span style={{ position: "relative", display: "inline-block" }}>
                    <span
                      style={{
                        display: "inline-block",
                        fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
                        fontWeight: 600,
                        fontSize: teaserFont,
                        lineHeight: 1.18,
                        color: teaserInk,
                        textShadow,
                        clipPath: reveal.clipPath,
                      }}
                    >
                      {t}
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        top: "8%",
                        bottom: "8%",
                        left: `${reveal.barLeftPct.toFixed(2)}%`,
                        width: `${reveal.barWidthPct}%`,
                        background: accentColor,
                        opacity: reveal.barOpacity,
                      }}
                    />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* The red hero block IS the main headline. Centred in landscape; in
            portrait it rides up into the upper third so the contents teasers can
            stack beneath it (rather than floating high under the masthead). */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: isPortrait ? "34%" : "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: `0 ${margin}px`,
          }}
        >
          <div
            style={{
              background: accentColor,
              padding: `${headlineSize * 0.16}px ${headlineSize * 0.34}px`,
              maxWidth: isPortrait ? "100%" : "82%",
              transform: `scale(${blockScale.toFixed(4)})`,
              opacity: blockOp,
              clipPath: blockClip,
              boxShadow: hasImage
                ? "0 20px 64px rgba(0,0,0,0.42)"
                : "0 14px 44px rgba(227,18,11,0.22)",
            }}
          >
            <div
              style={{
                fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
                fontWeight: 900,
                fontSize: headlineSize,
                lineHeight: 1.04,
                letterSpacing: -headlineSize * 0.012,
                color: "#FFFFFF",
                textAlign: "center",
              }}
            >
              {words.map((w, i) => {
                // Each word pressed onto the red plate, letterpress-style.
                const stamp = letterpressStamp(frame, headlineStart + i * 5, 16);
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      opacity: stamp.opacity,
                      transform: stamp.transform,
                      filter: stamp.filter,
                      marginRight: headlineSize * 0.2,
                    }}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          </div>
          {/* A thin rule beneath the block — an editorial flourish that also
              visually separates the headline from the cover photo behind it. */}
          <div
            style={{
              marginTop: isPortrait ? 26 : 30,
              width: isPortrait ? 180 : 220,
              height: 4,
              background: accentColor,
              ...ruleDraw(frame, 24, 14, "center"),
              opacity: blockOp,
              boxShadow: hasImage ? "0 6px 20px rgba(0,0,0,0.4)" : "none",
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
