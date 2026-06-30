import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { useMagDims } from "../magazineStyle";

interface MagazineSpreadDecorProps {
  variant: "spread" | "editorial";
  accentColor?: string;
}

export const MagazineSpreadDecor: React.FC<MagazineSpreadDecorProps> = ({
  variant,
  accentColor = "#E63946",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, height } = useMagDims();

  const fadeIn = interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (variant === "spread") {
    const spineX = width / 2;
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3, opacity: fadeIn }}>
        {/* Magazine spine — vertical gradient shadow at center */}
        <div style={{
          position: "absolute",
          top: 0,
          left: spineX - 8,
          width: 16,
          height: "100%",
          background: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.06) 35%, rgba(0,0,0,0.10) 50%, rgba(0,0,0,0.06) 65%, transparent 100%)",
        }} />
        {/* Center spine line */}
        <div style={{
          position: "absolute",
          top: "3%",
          left: spineX - 0.5,
          width: 1,
          bottom: "3%",
          background: "rgba(0,0,0,0.08)",
        }} />

        {/* Top fold mark */}
        <svg viewBox="0 0 20 12" style={{ position: "absolute", top: "2%", left: spineX - 10, width: 20, height: 12, opacity: 0.3 }}>
          <polygon points="10,0 20,12 0,12" fill="rgba(0,0,0,0.12)" />
        </svg>
        {/* Bottom fold mark */}
        <svg viewBox="0 0 20 12" style={{ position: "absolute", bottom: "2%", left: spineX - 10, width: 20, height: 12, opacity: 0.3 }}>
          <polygon points="0,0 20,0 10,12" fill="rgba(0,0,0,0.12)" />
        </svg>

        {/* Subtle page-edge lines on left and right of spine */}
        <div style={{ position: "absolute", top: "5%", left: spineX - 20, width: 1, bottom: "5%", background: "rgba(0,0,0,0.04)" }} />
        <div style={{ position: "absolute", top: "5%", left: spineX + 20, width: 1, bottom: "5%", background: "rgba(0,0,0,0.04)" }} />
      </div>
    );
  }

  if (variant === "editorial") {
    const cropSize = 18;
    const cropOffset = "3.5%";
    const cropStroke = "rgba(0,0,0,0.15)";
    const cropWeight = 1.5;

    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3, opacity: fadeIn }}>
        {/* Crop marks — top-left */}
        <svg viewBox={`0 0 ${cropSize} ${cropSize}`} style={{ position: "absolute", top: cropOffset, left: cropOffset, width: cropSize, height: cropSize }}>
          <line x1="0" y1={cropSize / 2} x2={cropSize} y2={cropSize / 2} stroke={cropStroke} strokeWidth={cropWeight} />
          <line x1={cropSize / 2} y1="0" x2={cropSize / 2} y2={cropSize} stroke={cropStroke} strokeWidth={cropWeight} />
        </svg>
        {/* Crop marks — top-right */}
        <svg viewBox={`0 0 ${cropSize} ${cropSize}`} style={{ position: "absolute", top: cropOffset, right: cropOffset, width: cropSize, height: cropSize }}>
          <line x1="0" y1={cropSize / 2} x2={cropSize} y2={cropSize / 2} stroke={cropStroke} strokeWidth={cropWeight} />
          <line x1={cropSize / 2} y1="0" x2={cropSize / 2} y2={cropSize} stroke={cropStroke} strokeWidth={cropWeight} />
        </svg>
        {/* Crop marks — bottom-left */}
        <svg viewBox={`0 0 ${cropSize} ${cropSize}`} style={{ position: "absolute", bottom: cropOffset, left: cropOffset, width: cropSize, height: cropSize }}>
          <line x1="0" y1={cropSize / 2} x2={cropSize} y2={cropSize / 2} stroke={cropStroke} strokeWidth={cropWeight} />
          <line x1={cropSize / 2} y1="0" x2={cropSize / 2} y2={cropSize} stroke={cropStroke} strokeWidth={cropWeight} />
        </svg>
        {/* Crop marks — bottom-right */}
        <svg viewBox={`0 0 ${cropSize} ${cropSize}`} style={{ position: "absolute", bottom: cropOffset, right: cropOffset, width: cropSize, height: cropSize }}>
          <line x1="0" y1={cropSize / 2} x2={cropSize} y2={cropSize / 2} stroke={cropStroke} strokeWidth={cropWeight} />
          <line x1={cropSize / 2} y1="0" x2={cropSize / 2} y2={cropSize} stroke={cropStroke} strokeWidth={cropWeight} />
        </svg>

        {/* Margin rules — thin lines inset from edges */}
        <div style={{ position: "absolute", top: "5%", left: "5%", right: "5%", height: 0.5, background: "rgba(0,0,0,0.06)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "5%", right: "5%", height: 0.5, background: "rgba(0,0,0,0.06)" }} />
        <div style={{ position: "absolute", top: "5%", left: "5%", width: 0.5, bottom: "5%", background: "rgba(0,0,0,0.06)" }} />
        <div style={{ position: "absolute", top: "5%", right: "5%", width: 0.5, bottom: "5%", background: "rgba(0,0,0,0.06)" }} />

        {/* Accent dot at center-top margin */}
        <div style={{
          position: "absolute",
          top: "4.5%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: accentColor,
          opacity: 0.4,
        }} />
      </div>
    );
  }

  return null;
};
