import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps, WhiteboardStatItem } from "../types";

const DEFAULT_STATS: WhiteboardStatItem[] = [
  { label: "Option A", value: "85" },
  { label: "Option B", value: "60" },
  { label: "Option C", value: "40" },
];

function parseBarValue(value: string): number {
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d+)/);
  if (match) return Math.min(100, Math.max(0, parseInt(match[1], 10)));
  if (trimmed.endsWith("%")) {
    const n = parseInt(trimmed.slice(0, -1), 10);
    if (!Number.isNaN(n)) return Math.min(100, Math.max(0, n));
  }
  return 50;
}

export const StatsChart: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
  stats: statsProp,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const stats = statsProp?.length ? statsProp : DEFAULT_STATS;
  const maxItems = Math.min(stats.length, 5);

  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif", letterSpacing: "1.5px" }}>
      <WhiteboardBackground bgColor={bgColor} />

      {/* Paper grain + ink filter */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.052" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink" x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="19" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain)" fill="none" />
        
        {/* Bolder, Darker Random Drawings */}
        <g stroke={accentColor} strokeWidth="5" fill="none" opacity="0.85" filter="url(#ink)">
            <path d="M 50,150 Q 80,120 110,150 T 170,150" strokeDasharray="10 5" />
            <circle cx="90%" cy="15%" r="40" strokeDasharray="15 10" />
            <path d="M 85%,85% L 92%,92% M 92%,85% L 85%,92%" />
            <path d="M 10%,80% C 15%,75% 25%,85% 30%,80%" strokeWidth="6" />
            
            {/* PORTRAIT-ONLY EXTRA STROKES */}
            {p && (
              <>
                {/* Arrow pointing to the chart */}
                <path d="M 15%,25% Q 10%,35% 15%,45%" strokeWidth="4" markerEnd="url(#arrowhead)" />
                {/* Highlight circle around the first bar area */}
                <ellipse cx="50%" cy="55%" rx="45%" ry="25%" strokeWidth="2" strokeDasharray="20 10" opacity="0.3" />
                {/* Zig-zag at bottom */}
                <path d="M 40%,95% L 45%,92% L 50%,95% L 55%,92% L 60%,95%" strokeWidth="3" />
                {/* Underline for the title area */}
                <path d="M 20%,18% Q 50%,21% 80%,17%" strokeWidth="6" opacity="0.6" />
                {/* Top left star/burst */}
                <path d="M 5%,5% L 10%,10% M 10%,5% L 5%,10% M 7.5%,3% L 7.5%,12% M 3%,7.5% L 12%,7.5%" strokeWidth="3" />
              </>
            )}
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center", 
          textAlign: "center",     
          padding: p ? "12% 8%" : "8% 10%",
          gap: p ? 40 : 48,
        }}
      >
        {/* Title block */}
        <div style={{ opacity: titleOp, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 54 : 72),
              lineHeight: 1.1,
              marginBottom: 16,
              filter: "url(#ink)",
              maxWidth: 800,
              transform: p ? "rotate(-1deg)" : "none",
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: textColor,
              fontSize: descriptionFontSize ?? (p ? 24 : 30),
              opacity: 0.9,
              maxWidth: p ? "90%" : 640,
              filter: "url(#ink)",
              fontStyle: p ? "italic" : "normal",
            }}
          >
            {narration}
          </div>
        </div>

        {/* Horizontal bar chart */}
        <div
          style={{
            width: "100%",
            maxWidth: p ? "100%" : 800,
            display: "flex",
            flexDirection: "column",
            gap: p ? 24 : 20,
            padding: p ? "20px" : "0",
            backgroundColor: p ? "rgba(255,255,255,0.4)" : "transparent",
            borderRadius: p ? "20px" : "0",
            border: p ? `2px dashed ${accentColor}44` : "none",
          }}
        >
          {stats.slice(0, maxItems).map((item, i) => {
            const delay = 20 + i * 10;
            const barProgress = interpolate(frame, [delay, delay + 24], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const pct = parseBarValue(item.value);
            const barWidthPct = (pct / 100) * barProgress;

            return (
              <div
                key={i}
                style={{
                  opacity: interpolate(frame, [delay, delay + 8], [0, 1], { extrapolateRight: "clamp" }),
                  transform: p ? `translateX(${interpolate(barProgress, [0, 1], [-20, 0])}px)` : "none",
                }}
              >
                <div style={{ display: "flex", flexDirection: p ? "column" : "row", alignItems: p ? "flex-start" : "center", gap: p ? 4 : 16 }}>
                  {/* Label */}
                  <span
                    style={{
                      flexShrink: 0,
                      color: textColor,
                      fontSize: p ? 20 : 22,
                      fontWeight: 700,
                      minWidth: p ? "auto" : 120,
                      textAlign: "left",
                      filter: "url(#ink)",
                    }}
                  >
                    {item.label}
                  </span>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                    {/* Bar track */}
                    <div
                      style={{
                        flex: 1,
                        height: p ? 32 : 36,
                        borderRadius: p ? 4 : 8,
                        backgroundColor: "rgba(0,0,0,0.06)",
                        overflow: "hidden",
                        border: `${p ? 4 : 3}px solid ${accentColor}`,
                        position: "relative",
                        transform: `rotate(${(i % 2 === 0 ? 0.7 : -0.7)}deg)`,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: `${barWidthPct * 100}%`,
                          backgroundColor: accentColor,
                          opacity: 0.15,
                        }}
                      />
                      <div
                        style={{
                          width: `${barWidthPct * 100}%`,
                          height: "100%",
                          backgroundColor: accentColor,
                        }}
                      />
                    </div>

                    {/* Value */}
                    <span
                      style={{
                        flexShrink: 0,
                        color: accentColor,
                        fontSize: p ? 22 : 26,
                        fontWeight: 800,
                        minWidth: 55,
                        textAlign: "right",
                        filter: "url(#ink)",
                        transform: p ? "scale(1.1)" : "none",
                      }}
                    >
                      {item.value}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};