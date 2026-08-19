import React from "react";
import { NewspaperClip, NEWSPRINT_FILTER } from "../components/NewspaperClip";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
} from "remotion";
import { NewsBackground, NewsPaperWash } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * news_headline__v3 — "Stacked Deck".
 *
 * Same props and prop meanings as NewsHeadline (stats[0] = byline, stats[1] =
 * date, leftThought = comma-separated highlight words).
 *
 * Set as the opening column of a front page rather than a title card: a kicker
 * rule and section label, a stacked serif headline on a narrow measure, an
 * italic deck under a hairline, and a byline rail at the foot — with the image
 * as a boxed cutout beside the column. The whole page sits on a 3D plane that
 * tilts in and settles, and the newsprint behind it drifts independently, so
 * the frame reads as a photographed page rather than a flat graphic.
 *
 * Deliberately distinct from the other two: V1 is left-aligned over a shattered
 * background, V2 is a centred full-width masthead. This one is a COLUMN.
 */
export const NewsHeadlineV3: React.FC<
  BlogLayoutProps & {
    imageUrl?: string;
    highlightWords?: string[];
    leftThought?: string;
  }
> = ({
  title = "Breaking News Headline Goes Here",
  highlightWords,
  narration,
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  category,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  leftThought,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const fadeIn = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  const contentOpacity = fadeIn * fadeOut;

  /* ── 3D CAMERA ──────────────────────────────────────────────────────────
     The page is a plane in space: it comes in tilted and off-axis, eases to
     near-flat, then keeps drifting so the shot never freezes. */
  const camRotateX = interpolate(frame, [0, 75], [14, 2.5], { extrapolateRight: "clamp" });
  const camRotateY = interpolate(frame, [0, 75], [-13, -2], { extrapolateRight: "clamp" });
  const camRotateZ = interpolate(frame, [0, 75], [-2.4, -0.5], { extrapolateRight: "clamp" });
  const camScale = interpolate(frame, [0, 75], [1.16, 1.03], { extrapolateRight: "clamp" });
  // Slow continuous drift across the whole scene, on top of the settle above.
  const driftY = interpolate(frame, [0, durationInFrames], [0, -34]);
  const driftX = interpolate(frame, [0, durationInFrames], [0, 16]);

  // Newsprint behind the page moves on its own, slower and the other way, so
  // the two planes separate in depth (parallax).
  const bgScale = interpolate(frame, [0, durationInFrames], [1.1, 1.2], {
    extrapolateRight: "clamp",
  });
  const bgDriftX = interpolate(frame, [0, durationInFrames], [0, -26]);

  /* ── COLUMN ELEMENTS ────────────────────────────────────────────────────── */
  const kickerW = interpolate(frame, [4, 24], [0, 100], { extrapolateRight: "clamp" });
  const kickerOp = interpolate(frame, [6, 20], [0, 1], { extrapolateRight: "clamp" });
  const deckOp = interpolate(frame, [30, 46], [0, 1], { extrapolateRight: "clamp" });
  const bylineOp = interpolate(frame, [40, 56], [0, 1], { extrapolateRight: "clamp" });
  const cutoutOp = interpolate(frame, [22, 44], [0, 1], { extrapolateRight: "clamp" });
  const cutoutX = interpolate(frame, [22, 44], [46, 0], { extrapolateRight: "clamp" });

  const cat = category ?? stats?.[0]?.label ?? "News";
  const byline = stats?.[0]?.value ?? "";
  const dateline = stats?.[1]?.value ?? "";

  const leftThoughtFromProps =
    leftThought && leftThought.trim().length > 0 ? leftThought : undefined;
  const highlights =
    highlightWords && highlightWords.length
      ? highlightWords
      : leftThoughtFromProps
        ? leftThoughtFromProps
            .split(/[,–—\-]/)
            .join(" ")
            .split(/\s+/)
            .filter(Boolean)
        : [];

  const words = title.split(" ");
  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 31 : 26);
  const hasVisual = Boolean(imageUrl || videoUrl);

  // A narrow measure is what makes it read as a column. Without a cutout beside
  // it the column widens, but never to full bleed — the white space is the point.
  const columnWidth = p ? "100%" : hasVisual ? "52%" : "66%";

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? B_FONT,
        backgroundColor: bgColor,
        perspective: "1600px",
        perspectiveOrigin: "50% 45%",
      }}
    >
      {/* ── BACKDROP: newsprint drifting independently of the page ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${bgScale}) translateX(${bgDriftX}px)`,
        }}
      >
        <NewsBackground bgColor={bgColor} />
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.22,
            filter: "grayscale(80%) contrast(1.1)",
            mixBlendMode: "multiply",
          }}
        />
          <NewsPaperWash />
      </div>

      {/* ── THE PAGE: everything below rides one 3D plane ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform:
            `scale(${camScale}) rotateX(${camRotateX}deg) rotateY(${camRotateY}deg) ` +
            `rotateZ(${camRotateZ}deg) translate(${driftX}px, ${driftY}px)`,
          opacity: contentOpacity,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: p ? "stretch" : "flex-start",
          gap: p ? "4%" : "5%",
          padding: p ? "13% 9%" : "8% 7%",
        }}
      >
        {/* ── COLUMN ── */}
        <div
          style={{
            width: columnWidth,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            transform: "translateZ(40px)",
          }}
        >
          {/* KICKER: heavy rule, section label, thin rule — the column's masthead */}
          <div style={{ width: `${kickerW}%`, flexShrink: 0 }}>
            <div style={{ height: p ? 9 : 7, background: textColor, width: "100%" }} />
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 16,
                padding: p ? "10px 0" : "8px 0",
                opacity: kickerOp,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  fontFamily: fontFamily ?? B_FONT,
                  fontSize: p ? 25 : 20,
                  fontWeight: 900,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: textColor,
                }}
              >
                {cat}
              </span>
              {dateline && (
                <span
                  style={{
                    fontFamily: fontFamily ?? B_FONT,
                    fontSize: p ? 18 : 15,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: textColor,
                    opacity: 0.5,
                  }}
                >
                  {dateline}
                </span>
              )}
            </div>
            <div style={{ height: 1.5, background: textColor, width: "100%", opacity: 0.45 }} />
          </div>

          {/* HEADLINE — stacked, tight, ranged left like a real column head */}
          <div
            style={{
              fontFamily: fontFamily ?? H_FONT,
              fontSize: titleFontSize ?? (p ? 54 : 50),
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: "-0.022em",
              color: textColor,
              marginTop: p ? 26 : 22,
              flexShrink: 0,
            }}
          >
            {words.map((word, i) => {
              const cleanWord = word.replace(/[.,!?]/g, "");
              const isHighlight = highlights.some(
                (hl) => hl.toLowerCase() === cleanWord.toLowerCase(),
              );
              // Each word sets from the left, a beat apart — type being laid.
              const wIn = interpolate(frame, [12 + i * 2.5, 30 + i * 2.5], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <span
                  key={i}
                  style={{
                    position: "relative",
                    display: "inline-block",
                    marginRight: "0.26em",
                    opacity: wIn,
                    transform: `translateX(${(1 - wIn) * -16}px)`,
                  }}
                >
                  {isHighlight && (
                    <span
                      style={{
                        position: "absolute",
                        left: "-2%",
                        right: "-2%",
                        bottom: "9%",
                        height: "52%",
                        backgroundColor: accentColor,
                        opacity: 0.5,
                        zIndex: -1,
                      }}
                    />
                  )}
                  <span style={{ position: "relative", zIndex: 1 }}>{word}</span>
                </span>
              );
            })}
          </div>

          {/* DECK — hairline above, italic serif, the way a standfirst sets */}
          {narration && (
            <div style={{ opacity: deckOp, marginTop: p ? 22 : 20, flexShrink: 0 }}>
              <div
                style={{
                  width: p ? 120 : 150,
                  height: 2,
                  background: textColor,
                  opacity: 0.45,
                  marginBottom: p ? 16 : 14,
                }}
              />
              <div
                style={{
                  // Body copy is B_FONT across this family (base and V2 both
                  // set the narration in the sans face) — the serif here made
                  // this variant read as a different template.
                  fontFamily: fontFamily ?? B_FONT,
                  fontSize: actualDescriptionFontSize,
                  fontWeight: 400,
                  lineHeight: 1.42,
                  color: textColor,
                  opacity: 0.88,
                }}
              >
                {narration}
              </div>
            </div>
          )}

          {/* BYLINE RAIL — accent bar and name, at the foot of the column */}
          {byline && (
            <div
              style={{
                opacity: bylineOp,
                marginTop: p ? 26 : 24,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div style={{ width: 34, height: 5, background: accentColor, flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: fontFamily ?? B_FONT,
                  fontSize: p ? 19 : 16,
                  fontWeight: 800,
                  letterSpacing: "0.13em",
                  textTransform: "uppercase",
                  color: textColor,
                  opacity: 0.62,
                }}
              >
                {byline}
              </span>
            </div>
          )}
        </div>

        {/* ── CUTOUT: the image as a pasted clipping beside the column ── */}
        {hasVisual && (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              alignSelf: "stretch",
              minHeight: p ? "26%" : 0,
              opacity: cutoutOp,
              transform: `translateX(${cutoutX}px) translateZ(70px) rotate(1.2deg)`,
              background: "#fff",
              padding: 10,
              boxShadow: "0 22px 48px rgba(0,0,0,0.26)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", border: "1px solid #ddd" }}>
              {videoUrl ? (
                <NewspaperClip
                  src={videoUrl}
                  imageObjectPosition={imageObjectPosition}
                  imageZoom={imageZoom}
                  muted={videoMuted ?? true}
                  volume={videoVolume ?? 0.35}
                  durationInFrames={videoDurationInFrames}
                  startInFrames={videoStartInFrames}
                  style={{ filter: NEWSPRINT_FILTER(frame) }}
                />
              ) : imageUrl ? (
                <Img
                  src={imageUrl}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                    objectPosition:
                      (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                    transform: `scale(${imageZoom ?? 1})`,
                    transformOrigin:
                      (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                    display: "block",
                    filter: NEWSPRINT_FILTER(frame),
                  }}
                />
              ) : null}
            </div>
            {/* Cutline, as a clipping would carry */}
            <div
              style={{
                flexShrink: 0,
                paddingTop: 8,
                fontFamily: fontFamily ?? B_FONT,
                fontSize: p ? 15 : 13,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#555",
              }}
            >
              {cat}
            </div>
          </div>
        )}
      </div>

      {/* Halftone over everything — one print screen across the whole frame */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(#000 1px, transparent 0)",
          backgroundSize: "4px 4px",
          opacity: 0.035,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
