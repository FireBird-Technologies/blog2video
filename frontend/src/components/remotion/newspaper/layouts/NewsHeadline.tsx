import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
} from "remotion";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

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
  const vintageUrl = staticFile("vintage-news.avif");

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
              backgroundImage: `url("${vintageUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              transform: `translate(${tx}px, ${ty}px) rotate(${rotate}deg) scale(${scale})`,
              opacity: 0.2,
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
  leftThought,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width: videoWidth } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const scale = videoWidth / 1920;

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

  // Derive highlight words from explicit leftThought when provided.
  const leftThoughtFromProps = leftThought && leftThought.trim().length > 0 ? leftThought : undefined;

  const words = title.split(" ");
  const highlights =
    highlightWords && highlightWords.length
      ? highlightWords
      : leftThoughtFromProps
        ? leftThoughtFromProps.split(/[,\u2013\u2014\-]/).join(" ").split(/\s+/).filter(Boolean)
        : [words[0], words[Math.floor(words.length / 2)], words[words.length - 1]];

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? B_FONT }}>
      <ShatterBackground bgColor={bgColor} />
      
      {/* Background Overlays */}
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.12,
          filter: "grayscale(75%) contrast(1.08)",
          zIndex: 1,
        }}
      />

      {/* Tilted Newspaper Cutout Image Card */}
      {imageUrl && (
        <div
          style={{
            position: "absolute",
            // Portrait: Center Top | Landscape: Right Side
            top: p ? "15%" : "25%",
            right: p ? "auto" : "10%",
            left: p ? "50%" : "auto",
            width: p ? "80%" : "40%",
            height: p ? "35%" : "50%",
            // ✅ physical styling: white paper background and padding
            background: "#fff",
            padding: "10px 10px 30px 10px", // extra bottom padding for 'pasted' look
            
            transform: p 
              ? "translateX(-50%) rotate(-4deg)" 
              : "rotate(-16deg)",
            opacity: contentOpacity,
            zIndex: 5,
            
            // ✅ Shadow: softer, more spread out, like paper lifted off the page
            boxShadow: "5px 10px 30px rgba(0,0,0,0.15)",

            // ✅ Cutout Effect: jagged edges mimicking a hand-torn cutout
            clipPath: "polygon(2% 0%, 98% 1%, 100% 98%, 95% 100%, 50% 98%, 2% 100%, 0% 50%)",
          }}
        >
          <div style={{ width: "100%", height: "100%", overflow: "hidden", border: "1px solid #ddd" }}>
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                // ✅ Dissolve animation combined with newsprint filter
                filter: `
                  blur(${interpolate(frame, [0, 20], [10, 0], { extrapolateRight: "clamp" })}px)
                  grayscale(20%) 
                  sepia(25%) 
                  contrast(120%) 
                  brightness(95%)
                `,
              }}
            />
          </div>
          {/* Subtle Halftone Overlay for maximum realism */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(#000 1px, transparent 0)',
            backgroundSize: '3px 3px',
            opacity: 0.03,
            pointerEvents: 'none'
          }} />
        </div>
      )}

      {/* CONTENT CONTAINER */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          // Portrait stacks content at bottom, Landscape centers it
          justifyContent: p ? "flex-end" : "center",
          padding: p ? "0 10% 15% 10%" : "7% 10%",
          zIndex: 10,
          opacity: contentOpacity,
        }}
      >
        {/* CATEGORY + AUTHOR (from stats) */}
        <div style={{ marginBottom: p ? 20 * scale : 30 * scale, display: "flex", flexDirection: "column", gap: 6 * scale }}>
          <div
            style={{
              display: "inline-block",
              fontSize: (p ? 28 : 24) * scale, // Larger for portrait
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: textColor,
              borderBottom: `${4 * scale}px solid ${textColor}`,
              paddingBottom: 6 * scale,
              alignSelf: "flex-start",
            }}
          >
            {cat}
          </div>
          {Array.isArray(stats) && stats.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 12 * scale,
                fontFamily: fontFamily ?? B_FONT,
                fontSize: (p ? 20 : 16) * scale,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#555",
              }}
            >
              {stats.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 * scale }}>
                  <span style={{ fontWeight: 700 }}>{s.value}</span>
                  {s.label && <span style={{ opacity: 0.8 }}>{s.label}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TITLE */}
        <div
          style={{
            fontFamily: fontFamily ?? H_FONT,
            // Drastically increased portrait size for mobile impact
            fontSize: titleFontSize ?? (p ? 90 * scale : 86 * scale),
            fontWeight: 800,
            lineHeight: 1.0,
            marginBottom: p ? 40 * scale : 36 * scale,
            maxWidth: p ? "100%" : (imageUrl ? "50%" : "60%"),
          }}
        >
          {words.map((word, i) => {
            const cleanWord = word.replace(/[.,!?]/g, "");
            const isHighlight = highlights.some(
              (hl) => hl.toLowerCase() === cleanWord.toLowerCase()
            );

            return (
              <span key={i} style={{ position: "relative", display: "inline-block", marginRight: `${12 * scale}px` }}>
                {isHighlight && (
                  <span
                    style={{
                      position: "absolute",
                      left: "-2%",
                      right: "-2%",
                      bottom: "10%",
                      height: "60%",
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

        {/* NARRATION */}
        {narration && (
          <div
            style={{
              fontSize: descriptionFontSize ?? (p ? 46 * scale : 44 * scale), // Larger for portrait
              fontWeight: 600,
              color: textColor,
              lineHeight: 1.4,
              maxWidth: p ? "100%" : (imageUrl ? "50%" : "70%"),
              opacity: 0.9,
            }}
          >
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};