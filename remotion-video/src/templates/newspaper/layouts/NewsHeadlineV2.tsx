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
 * news_headline__v2 — "Broadsheet".
 *
 * Same props and prop meanings as NewsHeadline (stats[0] = byline, stats[1] =
 * date, leftThought = comma-separated highlight words), rendered as a classic
 * front-page masthead: full-width rules, centered deck, image below the fold.
 */
export const NewsHeadlineV2: React.FC<
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

  // Symmetric in/out so the scene never appears to end early.
  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 22, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  const contentOpacity = fadeIn * fadeOut;

  // Masthead rules sweep out from the centre, then retract on exit.
  const ruleIn = interpolate(frame, [4, 26], [0, 100], { extrapolateRight: "clamp" });
  const ruleOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [100, 0],
    { extrapolateLeft: "clamp" },
  );
  const ruleW = Math.min(ruleIn, ruleOut);

  const deckOp = interpolate(frame, [16, 34], [0, 1], { extrapolateRight: "clamp" });
  const imageOp = interpolate(frame, [26, 46], [0, 1], { extrapolateRight: "clamp" });
  const imageY = interpolate(frame, [26, 46], [40, 0], { extrapolateRight: "clamp" });

  // 3D camera drift on the PAPER only, mirroring ArticleLead's treatment: the
  // page tilts and settles while the type stays flat and centred, so the
  // masthead alignment is untouched.
  const camRotateX = interpolate(frame, [0, 70], [12, 3], { extrapolateRight: "clamp" });
  const camRotateY = interpolate(frame, [0, 70], [-7, 0], { extrapolateRight: "clamp" });
  const camScale = interpolate(
    frame,
    [0, 40, Math.max(41, durationInFrames)],
    [1.14, 1.06, 1.0],
    { extrapolateRight: "clamp" },
  );
  const camTranslateY = interpolate(frame, [0, durationInFrames], [0, -26]);

  const cat = category ?? stats?.[0]?.label ?? "News";
  const byline = stats?.[0]?.value ?? "";
  const dateline = stats?.[1]?.value ?? "";

  const leftThoughtFromProps =
    leftThought && leftThought.trim().length > 0 ? leftThought : undefined;
  const words = title.split(" ");
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

  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 29 : 27);
  const hasVisual = Boolean(imageUrl || videoUrl);

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? B_FONT,
        backgroundColor: bgColor,
        perspective: "1500px",
      }}
    >
      {/* 3D CAMERA LAYER — the paper tilts and settles beneath the type, which
          stays flat and centred so the masthead alignment is unchanged. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: `scale(${camScale}) rotateX(${camRotateX}deg) rotateY(${camRotateY}deg) translateY(${camTranslateY}px)`,
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
            opacity: 0.32,
            filter: "grayscale(75%) contrast(1.08)",
            zIndex: 1,
          }}
        />
          <NewsPaperWash zIndex={2} />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: hasVisual ? "flex-start" : "center",
          padding: p ? "10% 7%" : "5% 8%",
          zIndex: 10,
          opacity: contentOpacity,
          textAlign: "center",
        }}
      >
        {/* MASTHEAD RULE + CATEGORY */}
        <div style={{ width: `${ruleW}%`, flexShrink: 0 }}>
          <div style={{ height: p ? 6 : 5, background: textColor, width: "100%" }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: p ? 16 : 22,
              padding: p ? "10px 0" : "8px 0",
              fontSize: p ? 24 : 20,
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: textColor,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            <span style={{ fontFamily: fontFamily ?? B_FONT }}>{cat}</span>
            {dateline && (
              <span style={{ fontFamily: fontFamily ?? B_FONT, opacity: 0.55 }}>{dateline}</span>
            )}
          </div>
          <div style={{ height: 2, background: textColor, width: "100%", opacity: 0.6 }} />
        </div>

        {/* HEADLINE */}
        <div
          style={{
            fontFamily: fontFamily ?? H_FONT,
            fontSize: titleFontSize ?? (p ? 54 : 54),
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: "-0.015em",
            color: textColor,
            marginTop: p ? 30 : 26,
            maxWidth: "100%",
            flexShrink: 0,
          }}
        >
          {words.map((word, i) => {
            const cleanWord = word.replace(/[.,!?]/g, "");
            const isHighlight = highlights.some(
              (hl) => hl.toLowerCase() === cleanWord.toLowerCase(),
            );
            return (
              <span
                key={i}
                style={{ position: "relative", display: "inline-block", marginRight: 12 }}
              >
                {isHighlight && (
                  <span
                    style={{
                      position: "absolute",
                      left: "-2%",
                      right: "-2%",
                      bottom: "8%",
                      height: "58%",
                      backgroundColor: accentColor,
                      opacity: 0.4,
                      borderRadius: 2,
                      zIndex: -1,
                    }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>{word}</span>
              </span>
            );
          })}
        </div>

        {/* DECK / SUBHEAD — hairline rule above, byline below */}
        {narration && (
          <div style={{ opacity: deckOp, marginTop: p ? 24 : 20, maxWidth: p ? "100%" : "72%" }}>
            <div
              style={{
                width: p ? 90 : 110,
                height: 3,
                background: accentColor,
                margin: "0 auto 18px auto",
              }}
            />
            <div
              style={{
                fontFamily: fontFamily ?? B_FONT,
                fontSize: actualDescriptionFontSize,
                fontWeight: 500,
                fontStyle: "italic",
                color: textColor,
                lineHeight: 1.4,
                opacity: 0.9,
              }}
            >
              {narration}
            </div>
          </div>
        )}

        {byline && (
          <div
            style={{
              fontFamily: fontFamily ?? B_FONT,
              opacity: deckOp * 0.75,
              marginTop: p ? 18 : 14,
              fontSize: p ? 20 : 16,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#555",
              flexShrink: 0,
            }}
          >
            {byline}
          </div>
        )}

        {/* BELOW-THE-FOLD VISUAL */}
        {hasVisual && (
          <div
            style={{
              marginTop: p ? 34 : 28,
              width: p ? "92%" : "62%",
              flex: 1,
              minHeight: 0,
              background: "#fff",
              padding: 10,
              boxShadow: "4px 8px 26px rgba(0,0,0,0.14)",
              opacity: imageOp,
              transform: `translateY(${imageY}px)`,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                border: "1px solid #ddd",
              }}
            >
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
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
