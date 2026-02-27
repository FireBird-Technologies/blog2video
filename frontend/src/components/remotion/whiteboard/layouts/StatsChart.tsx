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
  stats: statsProp,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const stats = statsProp?.length ? statsProp : DEFAULT_STATS;
  const maxItems = Math.min(stats.length, 5);

  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive" }}>
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
        <rect width="100%" height="100%" filter="url(#grain)" fill="white" />
        
        {/* Bolder, Darker Random Drawings */}
        <g stroke={accentColor} strokeWidth="5" fill="none" opacity="0.85" filter="url(#ink)">
            <path d="M 50,150 Q 80,120 110,150 T 170,150" strokeDasharray="10 5" />
            <circle cx="90%" cy="15%" r="40" strokeDasharray="15 10" />
            <path d="M 85%,85% L 92%,92% M 92%,85% L 85%,92%" />
            <path d="M 10%,80% C 15%,75% 25%,85% 30%,80%" strokeWidth="6" />
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
          padding: p ? "10% 8%" : "8% 10%",
          gap: p ? 32 : 48,
        }}
      >
        {/* Title block */}
        <div style={{ opacity: titleOp, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 58 : 72),
              lineHeight: 1.1,
              marginBottom: 16,
              filter: "url(#ink)",
              maxWidth: 800,
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: textColor,
              fontSize: descriptionFontSize ?? (p ? 26 : 30),
              opacity: 0.9,
              maxWidth: p ? "100%" : 640,
              filter: "url(#ink)",
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
            gap: p ? 16 : 20,
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
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Label */}
                  <span
                    style={{
                      flexShrink: 0,
                      color: textColor,
                      fontSize: p ? 18 : 22,
                      fontWeight: 600,
                      minWidth: p ? 80 : 120,
                      textAlign: "left",
                      filter: "url(#ink)",
                    }}
                  >
                    {item.label}
                  </span>

                  {/* Bar track */}
                  <div
                    style={{
                      flex: 1,
                      height: p ? 28 : 36,
                      borderRadius: 8,
                      backgroundColor: "rgba(0,0,0,0.06)",
                      overflow: "hidden",
                      border: `3px solid ${accentColor}`,
                      position: "relative",
                      transform: `rotate(${(i % 2 === 0 ? 0.5 : -0.5)}deg)`,
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
                      fontSize: p ? 20 : 26,
                      fontWeight: 800,
                      minWidth: 50,
                      textAlign: "right",
                      filter: "url(#ink)",
                    }}
                  >
                    {item.value}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};