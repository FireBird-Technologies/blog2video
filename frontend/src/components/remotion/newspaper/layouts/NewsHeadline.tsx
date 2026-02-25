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
          const fallProgress = disperse;
          const gravity = fallProgress * fallProgress;
          tx = shard.ox * fallProgress * 0.2;
          ty = gravity * 900;
          rotate = shard.rot * fallProgress * 0.25;
          scale = 1 - 0.1 * fallProgress;
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
  const p = aspectRatio === "portrait";

  const cat = category ?? stats?.[0]?.label ?? "News";

  const catOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(frame, [6, 30], [38, 0], { extrapolateRight: "clamp" });
  const headOp = interpolate(frame, [6, 28], [0, 1], { extrapolateRight: "clamp" });

  const imageAppear = interpolate(frame, [12, 28], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  // Default highlight: first, middle, last words
  const words = title.split(" ");
  const defaultHighlights = [
    words[0],
    words[Math.floor(words.length / 2)],
    words[words.length - 1],
  ];
  const highlights = highlightWords && highlightWords.length ? highlightWords : defaultHighlights;

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT }}>
      <ShatterBackground bgColor={bgColor} />

      {imageUrl && (
        <div
          style={{
            position: "absolute",
            top: p ? 60 : 80,
            right: p ? 20 : 80,
            width: p ? 280 : 440,
            height: p ? 220 : 320,
            background: "#ffffff",
            padding: 10,
            borderRadius: 6,
            boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
            transform: `rotate(-6deg) scale(${imageAppear})`,
            zIndex: 5,
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              filter: "grayscale(20%) contrast(110%)",
            }}
          />
        </div>
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: p ? "8% 7%" : "7% 10%",
          zIndex: 10,
        }}
      >
        <div style={{ marginBottom: 30, opacity: catOp }}>
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

        {/* Dynamic heading with highlighter effect */}
        <div
          style={{
            fontFamily: H_FONT,
            fontSize: titleFontSize ?? (p ? 62 : 86),
            fontWeight: 800,
            lineHeight: 1.05,
            opacity: headOp,
            transform: `translateY(${headY}px)`,
            marginBottom: 36,
            maxWidth: p ? "100%" : "60%",
            wordWrap: "break-word",
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
                  lineHeight: 1.2,
                }}
              >
                {isHighlight && (
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: accentColor,
                      opacity: 0.35,
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