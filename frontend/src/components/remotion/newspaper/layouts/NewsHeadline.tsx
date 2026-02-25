import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from "remotion";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/* ───────────────────────────────────────── */
/* SHARDS                                   */
/* ───────────────────────────────────────── */

const SHARDS = [
  { clip: "polygon(0% 0%, 38% 0%, 32% 28%, 0% 22%)", ox: -250, oy: -180, rot: -360 },
  { clip: "polygon(38% 0%, 72% 0%, 68% 26%, 32% 28%)", ox: 220, oy: -200, rot: 320 },
  { clip: "polygon(72% 0%, 100% 0%, 100% 20%, 68% 26%)", ox: 300, oy: -150, rot: 280 },

  { clip: "polygon(0% 22%, 32% 28%, 36% 56%, 0% 50%)", ox: -320, oy: 0, rot: -420 },
  { clip: "polygon(32% 28%, 68% 26%, 64% 54%, 36% 56%)", ox: 0, oy: 260, rot: 360 },
  { clip: "polygon(68% 26%, 100% 20%, 100% 52%, 64% 54%)", ox: 340, oy: 80, rot: 300 },

  { clip: "polygon(0% 50%, 36% 56%, 30% 78%, 0% 74%)", ox: -280, oy: 180, rot: -360 },
  { clip: "polygon(36% 56%, 64% 54%, 70% 80%, 30% 78%)", ox: 0, oy: -300, rot: 360 },
  { clip: "polygon(64% 54%, 100% 52%, 100% 76%, 70% 80%)", ox: 300, oy: 200, rot: -380 },

  { clip: "polygon(0% 74%, 30% 78%, 34% 100%, 0% 100%)", ox: -220, oy: 320, rot: 300 },
  { clip: "polygon(30% 78%, 70% 80%, 66% 100%, 34% 100%)", ox: 0, oy: 350, rot: -320 },
  { clip: "polygon(70% 80%, 100% 76%, 100% 100%, 66% 100%)", ox: 240, oy: 300, rot: 340 },
];

const ASSEMBLE_DURATION = 55;
const DISPERSE_DURATION = 45;

/* ───────────────────────────────────────── */
/* SHATTER BACKGROUND                       */
/* ───────────────────────────────────────── */

const ShatterBackground: React.FC<{ bgColor: string }> = ({ bgColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const disperseStart = durationInFrames - DISPERSE_DURATION;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: bgColor }} />

      {SHARDS.map((shard, i) => {
        const stagger = i * 2;

        const assemble = interpolate(
          frame,
          [stagger, ASSEMBLE_DURATION + stagger],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const disperse = interpolate(
          frame,
          [disperseStart + stagger, durationInFrames],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const progress =
          frame >= disperseStart ? 1 - disperse : assemble;

        const eased =
          progress < 0.5
            ? 4 * progress ** 3
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        let tx = 0;
        let ty = 0;
        let rotate = 0;
        let scale = 1;

        if (frame < disperseStart) {
          tx = shard.ox * (1 - eased);
          ty = shard.oy * (1 - eased) * (1 + 0.15 * (1 - eased));
          rotate = shard.rot * (1 - eased) * 0.35;
          scale = 0.9 + 0.1 * eased;
        } else {
          const gravity = disperse * disperse;
          tx = shard.ox * disperse * 0.2;
          ty = gravity * 900;
          rotate = shard.rot * disperse * 0.25;
          scale = 1 - 0.1 * disperse;
        }

        const opacity =
          frame < disperseStart ? 0.4 * eased : 0.4 * (1 - disperse);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              clipPath: shard.clip,
              backgroundImage: `url("/vintage-news.avif")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              transform: `translate(${tx}px, ${ty}px) rotate(${rotate}deg) scale(${scale})`,
              opacity,
              willChange: "transform, opacity",
            }}
          />
        );
      })}
    </div>
  );
};

/* ───────────────────────────────────────── */
/* MAIN COMPONENT                           */
/* ───────────────────────────────────────── */

export const NewsHeadline: React.FC<
  BlogLayoutProps & {
    imageUrl?: string;
    highlightWords?: string[];
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
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  /* 🎬 Unified Fade In / Fade Out */
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 25, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );

  const contentOpacity = fadeIn * fadeOut;

  const cat = category ?? stats?.[0]?.label ?? "News";

  const words = title.split(" ");
  const defaultHighlights = [
    words[0],
    words[Math.floor(words.length / 2)],
    words[words.length - 1],
  ];
  const highlights =
    highlightWords && highlightWords.length
      ? highlightWords
      : defaultHighlights;

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <ShatterBackground bgColor={bgColor} />

      {imageUrl && (
        <div
          style={{
            position: "absolute",
            top: p ? 160 : 250,
            right: p ? 100 : 180,
            width: p ? 380 : 540,
            height: p ? 300 : 440,
            transform: "rotate(-16deg)",
            opacity: contentOpacity,
            zIndex: 5,
          }}
        >
          {/* Image Layer */}
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",

              /* Soft dissolve blur in/out */
              filter: `
                blur(${interpolate(frame, [0, 20], [10, 2], {
                  extrapolateRight: "clamp",
                })}px)
                grayscale(100%)
                contrast(115%)
                brightness(92%)
              `,

              /* Feathered edge dissolve */
              WebkitMaskImage:
                "radial-gradient(circle at center, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
              maskImage:
                "radial-gradient(circle at center, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                linear-gradient(
                  to bottom,
                  rgba(231, 224, 202, 0.25),
                  rgba(233, 210, 148, 0.35)
                )
              `,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* CONTENT */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: p ? "8% 7%" : "7% 10%",
          zIndex: 10,
          opacity: contentOpacity,
        }}
      >
        {/* CATEGORY */}
        <div style={{ marginBottom: 30 }}>
          <div
            style={{
              display: "inline-block",
              fontSize: p ? 20 : 24,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: textColor,
              borderBottom: `3px solid ${textColor}`,
              paddingBottom: 6,
            }}
          >
            {cat}
          </div>
        </div>

        {/* TITLE */}
        <div
          style={{
            fontFamily: H_FONT,
            fontSize: titleFontSize ?? (p ? 62 : 86),
            fontWeight: 800,
            lineHeight: 1.05,
            marginBottom: 36,
            maxWidth: p ? "100%" : "60%",
          }}
        >
          {words.map((word, i) => {
            const cleanWord = word.replace(/[.,!?]/g, "");
            const isHighlight = highlights.some(
              (hl) => hl.toLowerCase() === cleanWord.toLowerCase()
            );

            return (
              <span
                key={i}
                style={{
                  position: "relative",
                  display: "inline-block",
                  marginRight: "6px",
                }}
              >
                {isHighlight && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: "15%",
                      height: "55%",
                      backgroundColor: accentColor,
                      opacity: 0.35,
                      borderRadius: 4,
                      zIndex: -1,
                    }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>
                  {word}
                </span>
              </span>
            );
          })}
        </div>

        {/* NARRATION */}
        {narration && (
          <div
            style={{
              fontSize: descriptionFontSize ?? (p ? 26 : 32),
              fontWeight: 600,
              color: textColor,
              lineHeight: 1.6,
              maxWidth: "70%",
            }}
          >
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};