import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { SocialIcons } from "../../SocialIcons";

const GLITCH_CHARS = "アイウエオカキクケコ0123456789!@#$%^&*<>{}[]";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const DecodeText: React.FC<{
  text: string;
  startFrame: number;
  decodeFramesPerChar: number;
  accent: string;
  fontFamily: string;
  style?: React.CSSProperties;
}> = ({ text, startFrame, decodeFramesPerChar, accent, fontFamily, style }) => {
  const frame = useCurrentFrame();
  const chars = text.split("");

  return (
    <div style={{ ...style, fontFamily }}>
      {chars.map((char, i) => {
        const charRevealFrame = startFrame + i * decodeFramesPerChar;
        const isRevealed = frame >= charRevealFrame;
        const isDecoding = frame >= charRevealFrame - 8 && !isRevealed;

        let displayChar = char;
        if (char === " ") {
          displayChar = " ";
        } else if (isDecoding) {
          const glitchIdx = Math.floor(
            seededRandom(i * 100 + frame * 7) * GLITCH_CHARS.length
          );
          displayChar = GLITCH_CHARS[glitchIdx];
        } else if (!isRevealed) {
          displayChar = " ";
        }

        return (
          <span
            key={i}
            style={{
              opacity: char === " " ? 1 : isRevealed || isDecoding ? 1 : 0,
              color: isDecoding ? `${accent}66` : "inherit",
            }}
          >
            {displayChar}
          </span>
        );
      })}
    </div>
  );
};

export const EndingSocials: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  socials,
  websiteLink,
  showWebsiteButton,
  ctaButtonText,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = (fontFamily ?? "").trim() || MATRIX_DEFAULT_FONT_FAMILY;

  const subtext = (narration ?? "").trim();
  const resolvedWebsiteLink = (websiteLink ?? "").trim();
  const showWebsiteCta = showWebsiteButton !== false && resolvedWebsiteLink.length > 0;
  const resolvedCta = (ctaButtonText ?? "").trim() || "Get started";

  // --- Dynamic Sizing ---
  const resolvedTitleSize = titleFontSize ?? (p ? 80 : 64);
  const resolvedCtaSize = resolvedTitleSize * 1.2;

  // --- Timing logic ---
  const titleStart = 10;
  const decodeSpeed = 2; 
  const titleDuration = title.length * decodeSpeed;
  
  const subtextStart = titleStart + titleDuration + 5;
  const socialStart = subtextStart + 8;
  const ctaStart = socialStart + 10;

  const subtextPop = spring({
    frame: frame - subtextStart,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const otherElementsOpacity = interpolate(frame, [socialStart, socialStart + 10], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      <MatrixBackground bgColor={bgColor} opacity={0.25 * bgOpacity} fontFamily={resolvedFontFamily} />

      {/* 1. TOP GROUP: Moved significantly lower toward center */}
      <div style={{
        position: "absolute",
        top: p ? "22%" : "18%", // Increased from 12%/10% to move toward center
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 10%",
        zIndex: 1,
      }}>
        {/* Title */}
        <DecodeText
          text={title}
          startFrame={titleStart}
          decodeFramesPerChar={decodeSpeed}
          accent={accent}
          fontFamily={resolvedFontFamily}
          style={{
            fontSize: resolvedTitleSize,
            fontWeight: 900,
            color: accent,
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            lineHeight: 1.04,
            textAlign: "center",
            textShadow: `0 0 18px ${accent}66, 0 0 42px ${accent}22`,
          }}
        />
        
        {/* Separator */}
        <div style={{
          marginTop: 8,
          width: p ? 120 : 160, 
          height: 3,
          borderRadius: 999,
          backgroundColor: `${accent}55`,
          opacity: interpolate(frame, [titleStart, titleStart + 10], [0, 1]),
        }} />

        {/* Narration */}
        {subtext && (
          <div style={{
            marginTop: 35,
            fontSize: descriptionFontSize ?? (p ? 32 : 26),
            fontWeight: 500,
            color: `${textColor || "#00FF41"}CC`,
            lineHeight: 1.3,
            maxWidth: 750,
            fontFamily: resolvedFontFamily,
            textAlign: "center",
            opacity: subtextPop,
            transform: `scale(${interpolate(subtextPop, [0, 1], [0.95, 1])}) translateY(${interpolate(subtextPop, [0, 1], [5, 0])}px)`,
          }}>
            {subtext}
          </div>
        )}

        {/* Social Icons */}
        <div style={{ 
          marginTop: 25,
          width: "100%", 
          display: "flex", 
          justifyContent: "center",
          opacity: otherElementsOpacity,
        }}>
          <SocialIcons 
            socials={socials} 
            accentColor={accent} 
            textColor={textColor || "#00FF41"} 
            maxPerRow={p ? 4 : 10} 
            fontFamily={resolvedFontFamily} 
            aspectRatio={aspectRatio} 
          />
        </div>
      </div>

      {/* 2. BOTTOM GROUP: Moved significantly higher toward center */}
      {showWebsiteCta && (
        <div style={{
          position: "absolute",
          bottom: p ? "18%" : "15%", // Increased from 8%/7% to move toward center
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 2,
        }}>
          {/* Large CTA Button */}
          <div style={{
            padding: p ? "15px 35px" : "12px 28px",
            border: `2px solid ${accent}66`,
            borderRadius: 12,
            boxShadow: `0 0 25px ${accent}44`,
            background: "rgba(0,0,0,0.5)",
          }}>
             <DecodeText
                text={resolvedCta}
                startFrame={ctaStart}
                decodeFramesPerChar={2}
                accent={accent}
                fontFamily={resolvedFontFamily}
                style={{
                  color: accent,
                  fontSize: resolvedCtaSize,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  lineHeight: 1,
                  letterSpacing: "0.02em",
                }}
              />
          </div>
          
          {/* Website Link */}
          <div style={{ 
            marginTop: 10,
            fontSize: p ? 24 : 20, 
            color: textColor || "#00FF41", 
            opacity: otherElementsOpacity,
            fontFamily: resolvedFontFamily,
            letterSpacing: "0.05em",
            fontWeight: 600,
          }}>
            {resolvedWebsiteLink}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};