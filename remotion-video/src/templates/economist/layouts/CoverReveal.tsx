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
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";

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
  wordmark = "The Economist",
  dateline,
  teasers,
  imageUrl,
  imageObjectPosition = "50% 50%",
  imageZoom = 1,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
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

  // ── Red headline block entrance ────────────────────────────────────────────
  const blockIn = spring({ frame: frame - 8, fps, config: { damping: 15, mass: 0.7 } });
  const blockScale = interpolate(blockIn, [0, 1], [0.92, 1]);
  const blockOp = interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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

  // Teaser column geometry.
  const teaserColLeft = isPortrait ? margin : width * 0.52;
  const teaserColWidth = isPortrait ? width - margin * 2 : width * 0.5 - margin;
  const teaserTop = margin + 6;
  const teaserFont = isPortrait ? 32 : 32;

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
            {/* Faint concentric cover-motif arcs. */}
            <svg
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }}
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid slice"
            >
              {[18, 30, 42, 54].map((r, i) => (
                <circle
                  key={i}
                  cx={78}
                  cy={28}
                  r={r}
                  fill="none"
                  stroke={ECONOMIST_COLORS.rule}
                  strokeWidth={0.18}
                />
              ))}
            </svg>
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
        {/* Contents teasers + dateline, top-right (landscape) / top (portrait). */}
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
            const rowOp = interpolate(frame, [start, start + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const rowY = interpolate(frame, [start, start + 14], [14, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const ruleW = interpolate(frame, [start, start + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div key={i} style={{ opacity: rowOp, transform: `translateY(${rowY}px)` }}>
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
                    fontFamily: ECONOMIST_SERIF_FONT,
                    fontWeight: 600,
                    fontSize: teaserFont,
                    lineHeight: 1.18,
                    color: teaserInk,
                    padding: `${teaserFont * 0.28}px 0`,
                    textShadow,
                  }}
                >
                  {t}
                </div>
              </div>
            );
          })}
          {dateline && (
            <div
              style={{
                opacity: interpolate(frame, [30 + teaserList.length * 8, 30 + teaserList.length * 8 + 12], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <div style={{ height: 1, background: ruleColor, width: "100%" }} />
              <div
                style={{
                  fontFamily: ECONOMIST_SANS_FONT,
                  fontWeight: 700,
                  fontSize: isPortrait ? 15 : 14,
                  letterSpacing: 1.6,
                  textTransform: "uppercase",
                  color: datelineInk,
                  padding: `${teaserFont * 0.26}px 0`,
                  textShadow,
                }}
              >
                {dateline}
              </div>
            </div>
          )}
        </div>

        {/* The red hero block IS the main headline — centred on the page. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
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
              transform: `scale(${blockScale})`,
              opacity: blockOp,
              boxShadow: hasImage
                ? "0 20px 64px rgba(0,0,0,0.42)"
                : "0 14px 44px rgba(227,18,11,0.22)",
            }}
          >
            <div
              style={{
                fontFamily: ECONOMIST_SERIF_FONT,
                fontWeight: 900,
                fontSize: headlineSize,
                lineHeight: 1.04,
                letterSpacing: -headlineSize * 0.012,
                color: "#FFFFFF",
                textAlign: "center",
              }}
            >
              {words.map((w, i) => {
                const s = headlineStart + i * 5;
                const wOp = interpolate(frame, [s, s + 14], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const wY = interpolate(frame, [s, s + 16], [20, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      opacity: wOp,
                      transform: `translateY(${wY}px)`,
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
              transform: `scaleX(${blockOp})`,
              opacity: blockOp,
              boxShadow: hasImage ? "0 6px 20px rgba(0,0,0,0.4)" : "none",
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
