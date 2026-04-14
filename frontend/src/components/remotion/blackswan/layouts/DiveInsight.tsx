import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { BlackswanFlock } from "./birds";
import { NeonWater } from "./neonWater";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { blackswanNeonPalette } from "./blackswanAccent";

// Righteous — same family as DropletIntro
const mono = "'Righteous', cursive";
const display = "'Righteous', cursive";

/** Image panel centered with accent border + corner glow */
const ImageWithAccentBorder: React.FC<{ src: string; accentColor: string; opacity?: number }> = ({ src, accentColor, opacity = 1 }) => (
  <div style={{ position: "relative", width: "100%", height: "100%", opacity }}>
    <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    {/* Glowing border */}
    <div style={{
      position: "absolute",
      inset: 0,
      boxShadow: `inset 0 0 0 2px ${accentColor}99, 0 0 20px ${accentColor}66, 0 0 40px ${accentColor}33`,
      pointerEvents: "none",
    }} />
    {/* SVG corner accents */}
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <filter id="dv-corner-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d="M0,20 L0,0 L20,0" fill="none" stroke={accentColor} strokeWidth="1.6" filter="url(#dv-corner-glow)" />
      <path d="M80,0 L100,0 L100,20" fill="none" stroke={accentColor} strokeWidth="1.6" filter="url(#dv-corner-glow)" />
      <path d="M100,80 L100,100 L80,100" fill="none" stroke={accentColor} strokeWidth="1.6" filter="url(#dv-corner-glow)" />
      <path d="M20,100 L0,100 L0,80" fill="none" stroke={accentColor} strokeWidth="1.6" filter="url(#dv-corner-glow)" />
    </svg>
  </div>
);

export const DiveInsight: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    quote,
    highlightWord,
    accentColor = "#00E5FF",
    textColor = "#DFFFFF",
    bgColor = "#000000",
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
    imageUrl,
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const hasImage = !!imageUrl;

  const quoteOp = interpolate(frame, [8, 30],  [0, 1], { extrapolateRight: "clamp" });
  const quoteY  = interpolate(frame, [8, 30],  [14, 0], { extrapolateRight: "clamp" });
  const eyeOp   = interpolate(frame, [0, 18],  [0, 1], { extrapolateRight: "clamp" });
  const waterOp = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const imgOp   = interpolate(frame, [5, 25],  [0, 1], { extrapolateRight: "clamp" });
  const neonPal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);

  const insightText = quote || narration || "";
  let hl = false;

  const highlighted =
    highlightWord && insightText.includes(highlightWord)
      ? insightText.replace(highlightWord, `__S__${highlightWord}__E__`)
      : insightText;
  const pieces = highlighted.split(/(__S__|__E__)/);

  const quoteFontSize = titleFontSize ?? (p ? 80 : 67);
  const subFontSize   = descriptionFontSize ?? (p ? 33 : 39);

  // ── With image: image centered, quote below ──────────────────
  if (hasImage) {
    const imgHeight = p ? "35%" : "45%"; // Decreased height further

    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
        <StarField accentColor={accentColor} />

        <BlackswanFlock uid="dv-flock" cx={500} cy={p ? 600 : 560} startDelaySec={0.3} accentColor={accentColor} />

        <div style={{ position: "absolute", inset: 0, opacity: waterOp * 0.45 }}>
          <NeonWater uid="dv6" cx={500} yPct={p ? 72 : 68} rxBase={220} ryBase={28} maxRx={520} nRings={6} delay={0.05} hideBg fadeEdges accentColor={accentColor} />
        </div>

        {/* Image — centered horizontally, upper portion */}
        <div
          style={{
            position: "absolute",
            left: p ? "10%" : "18%", // Decreased width by increasing left/right
            right: p ? "10%" : "18%", // Decreased width by increasing left/right
            top: p ? "10%" : "8%", // Adjusted top position
            height: imgHeight,
            opacity: imgOp,
            zIndex: 1,
          }}
        >
          <ImageWithAccentBorder src={imageUrl!} accentColor={accentColor} />
        </div>

        {/* Quote + text — below image */}
        <div
          style={{
            position: "absolute",
            left: p ? "4%" : "6%",
            right: p ? "4%" : "6%",
            bottom: p ? "4%" : "5%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: p ? 14 : 16,
            zIndex: 2,
          }}
        >
          {/* Eyebrow */}
          <div style={{
            fontSize: p ? 16 : 14,
            letterSpacing: 6,
            color: neonPal.mid,
            textTransform: "uppercase",
            fontFamily: fontFamily ?? mono,
            fontWeight: 400,
            opacity: eyeOp,
          }}>
            Insight
          </div>

          {/* Quote */}
          <div
            style={{
              fontFamily: fontFamily ?? display,
              fontSize: quoteFontSize,
              fontWeight: 400,
              ...neonTitleTubeStyle(accentColor, { bgColor }),
              textAlign: "center",
              lineHeight: 1.2,
              letterSpacing: "0.12em",
              opacity: quoteOp,
              transform: `translateY(${quoteY}px)`,
              maxWidth: p ? "100%" : "1200px",
            }}
          >
            {pieces.map((piece, idx) => {
              if (piece === "__S__") { hl = true; return null; }
              if (piece === "__E__") { hl = false; return null; }
              return hl ? (
                <span key={idx} style={{ ...neonTitleTubeStyle(accentColor, { bgColor }) }}>{piece}</span>
              ) : (
                <React.Fragment key={idx}>{piece}</React.Fragment>
              );
            })}
          </div>

          {/* Accent line */}
          <div style={{
            height: 2,
            width: p ? 140 : 180,
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}, 0 0 18px ${accentColor}88`,
            opacity: quoteOp,
            flexShrink: 0,
          }} />

          {title && title !== insightText && (
            <p style={{
              margin: 0,
              fontFamily: fontFamily ?? display,
              fontSize: subFontSize,
              fontWeight: 400,
              ...neonTitleTubeStyle(accentColor, { bgColor }),
              opacity: quoteOp * 0.8,
              letterSpacing: "0.12em",
              textAlign: "center",
              lineHeight: 1.6,
            }}>
              {title}
            </p>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // ── No image: original centered layout ──────────────────────
  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      <StarField accentColor={accentColor} />

      <BlackswanFlock uid="dv-flock" cx={500} cy={p ? 600 : 560} startDelaySec={0.3} accentColor={accentColor} />

      <div style={{ position: "absolute", inset: 0, opacity: waterOp * 0.45 }}>
        <NeonWater uid="dv6" cx={500} yPct={p ? 72 : 68} rxBase={220} ryBase={28} maxRx={520} nRings={6} delay={0.05} hideBg fadeEdges accentColor={accentColor} />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: p ? "30%" : "20%",
          paddingLeft: p ? "8%" : "8%",
          paddingRight: p ? "8%" : "8%",
          gap: p ? 20 : 24,
        }}
      >
        <div style={{
          fontSize: p ? 18 : 16,
          letterSpacing: 6,
          color: neonPal.mid,
          textTransform: "uppercase",
          fontFamily: fontFamily ?? mono,
          fontWeight: 400,
          opacity: eyeOp,
        }}>
          Insight
        </div>

        <div
          style={{
            fontFamily: fontFamily ?? display,
            fontSize: titleFontSize ?? (p ? 80 : 67),
            fontWeight: 400,
            ...neonTitleTubeStyle(accentColor, { bgColor }),
            textAlign: "center",
            lineHeight: 1.25,
            letterSpacing: "0.02em",
            opacity: quoteOp,
            transform: `translateY(${quoteY}px)`,
            maxWidth: p ? "100%" : "1100px",
          }}
        >
          {pieces.map((piece, idx) => {
            if (piece === "__S__") { hl = true; return null; }
            if (piece === "__E__") { hl = false; return null; }
            return hl ? (
              <span key={idx} style={{ ...neonTitleTubeStyle(accentColor, { bgColor }) }}>{piece}</span>
            ) : (
              <React.Fragment key={idx}>{piece}</React.Fragment>
            );
          })}
        </div>

        <div style={{
          height: 2,
          width: p ? 160 : 200,
          background: accentColor,
          boxShadow: `0 0 8px ${accentColor}, 0 0 18px ${accentColor}88`,
          opacity: quoteOp,
          flexShrink: 0,
        }} />

        {title && title !== insightText && (
          <p style={{
            margin: 0,
            fontFamily: fontFamily ?? display,
            fontSize: subFontSize,
            fontWeight: 400,
            ...neonTitleTubeStyle(accentColor, { bgColor }),
            opacity: quoteOp * 0.8,
            letterSpacing: "0.04em",
            textAlign: "center",
            lineHeight: 1.6,
          }}>
            {title}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
