import React from "react";
import { Img, useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";

interface MagazineInkOverlayProps {
  variant: "corner" | "border" | "watermark";
  opacity?: number;
  accentColor?: string;
}

export const MagazineInkOverlay: React.FC<MagazineInkOverlayProps> = ({
  variant,
  opacity: maxOpacity = 0.25,
  accentColor = "#E63946",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (variant === "corner") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2, opacity: fadeIn }}>
        {/* Vogue-style editorial image — bottom-left corner */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "22%",
          height: "45%",
          overflow: "hidden",
          opacity: maxOpacity * 1.2,
        }}>
          <Img
            src={staticFile("magazine-vogue.avif")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top left",
              filter: "grayscale(1) contrast(1.4)",
              mixBlendMode: "multiply",
            }}
          />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, transparent 40%, #FDFCFB 75%)",
          }} />
        </div>

        {/* Bold ink strokes — heavy editorial framing */}
        <svg
          viewBox="0 0 300 300"
          style={{ position: "absolute", bottom: 0, left: 0, width: 260, height: 260, opacity: maxOpacity * 2.5 }}
        >
          <line x1="0" y1="300" x2="200" y2="300" stroke="#1A1A1A" strokeWidth="4" />
          <line x1="0" y1="300" x2="0" y2="100" stroke="#1A1A1A" strokeWidth="4" />
          <line x1="25" y1="275" x2="140" y2="275" stroke="#1A1A1A" strokeWidth="2" opacity="0.6" />
          <line x1="25" y1="300" x2="25" y2="180" stroke="#1A1A1A" strokeWidth="2" opacity="0.6" />
          <line x1="0" y1="250" x2="80" y2="250" stroke={accentColor} strokeWidth="3" opacity="0.8" />
          <line x1="50" y1="300" x2="50" y2="240" stroke={accentColor} strokeWidth="2" opacity="0.5" />
        </svg>

        {/* Top-right corner — collage texture peek */}
        <div style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "18%",
          height: "35%",
          overflow: "hidden",
          opacity: maxOpacity * 0.8,
        }}>
          <Img
            src={staticFile("magazine-collage.avif")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              filter: "grayscale(0.5) contrast(1.15)",
            }}
          />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(225deg, transparent 25%, #FDFCFB 65%)",
          }} />
        </div>

        <svg
          viewBox="0 0 200 200"
          style={{ position: "absolute", top: 0, right: 0, width: 180, height: 180, opacity: maxOpacity * 2 }}
        >
          <line x1="200" y1="0" x2="40" y2="0" stroke="#1A1A1A" strokeWidth="3" />
          <line x1="200" y1="0" x2="200" y2="160" stroke="#1A1A1A" strokeWidth="3" />
          <line x1="200" y1="50" x2="120" y2="50" stroke={accentColor} strokeWidth="2" opacity="0.7" />
        </svg>
      </div>
    );
  }

  if (variant === "border") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2, opacity: fadeIn }}>
        {/* Collage texture strip along left edge */}
        <div style={{
          position: "absolute",
          top: "6%",
          left: 0,
          width: "3.5%",
          bottom: "6%",
          overflow: "hidden",
          opacity: maxOpacity * 1.2,
        }}>
          <Img
            src={staticFile("magazine-collage.avif")}
            style={{
              width: "250%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(0.4) contrast(1.1)",
            }}
          />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, transparent 40%, #FDFCFB 100%)",
          }} />
        </div>

        {/* Right edge strip too */}
        <div style={{
          position: "absolute",
          top: "6%",
          right: 0,
          width: "2.5%",
          bottom: "6%",
          overflow: "hidden",
          opacity: maxOpacity * 0.8,
        }}>
          <Img
            src={staticFile("magazine-collage.avif")}
            style={{
              width: "250%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "right center",
              filter: "grayscale(0.5)",
            }}
          />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to left, transparent 30%, #FDFCFB 100%)",
          }} />
        </div>

        {/* Bold ink rule frames */}
        <div style={{
          position: "absolute",
          top: "5%",
          left: "5%",
          right: "5%",
          bottom: "5%",
          border: `2px solid rgba(26,26,26,${maxOpacity * 1.5})`,
        }} />
        <div style={{
          position: "absolute",
          top: "6.5%",
          left: "6.5%",
          right: "6.5%",
          bottom: "6.5%",
          border: `1px solid rgba(26,26,26,${maxOpacity * 0.8})`,
        }} />
        {[
          { top: "4.5%", left: "4.5%" },
          { top: "4.5%", right: "4.5%" },
          { bottom: "4.5%", left: "4.5%" },
          { bottom: "4.5%", right: "4.5%" },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              ...pos,
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: accentColor,
              opacity: maxOpacity * 2,
            } as React.CSSProperties}
          />
        ))}
      </div>
    );
  }

  if (variant === "watermark") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, opacity: fadeIn }}>
        {/* Visible newspaper collage texture as editorial background */}
        <Img
          src={staticFile("magazine-collage.avif")}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: maxOpacity * 0.6,
            filter: "grayscale(0.6) contrast(0.95)",
            mixBlendMode: "multiply",
          }}
        />
        {/* SVG text-line pattern */}
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: maxOpacity * 0.4 }}>
          {Array.from({ length: 25 }, (_, i) => {
            const y = 40 + i * 38;
            const widthPct = 30 + (i * 17) % 35;
            const xOffset = (i * 31) % 25 + 15;
            return (
              <rect
                key={i}
                x={`${xOffset}%`}
                y={y}
                width={`${widthPct}%`}
                height="2.5"
                fill="#1A1A1A"
                opacity={0.08 + (i % 3) * 0.02}
                rx="1"
              />
            );
          })}
        </svg>
      </div>
    );
  }

  return null;
};
