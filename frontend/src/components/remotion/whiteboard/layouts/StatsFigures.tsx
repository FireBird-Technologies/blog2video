import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps, WhiteboardStatItem } from "../types";

const DEFAULT_STATS: WhiteboardStatItem[] = [
  { label: "Growth", value: "50%" },
  { label: "Faster", value: "3x" },
  { label: "Users", value: "10K+" },
  { label: "Revenue", value: "$2M" },
  { label: "Retention", value: "92%" },
  { label: "Markets", value: "12" },
  { label: "ROI", value: "4x" },
];

// --- Corner Scribble Component with Bold Lines ---
function CornerScribble({ side, color, seed }: { side: 'tl' | 'tr' | 'bl' | 'br', color: string, seed: number }) {
  const positions = {
    tl: { top: 30, left: 30 },
    tr: { top: 30, right: 30, transform: 'scaleX(-1)' },
    bl: { bottom: 30, left: 30, transform: 'scaleY(-1)' },
    br: { bottom: 30, right: 30, transform: 'scale(-1)' },
  };

  return (
    <svg
      viewBox="0 0 100 100"
      style={{
        position: "absolute",
        width: 140, // Slightly larger
        height: 140,
        opacity: 0.85, // Much darker/more opaque
        ...positions[side],
      }}
    >
      <filter id={`scribbleFilter${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed={seed} />
        <feDisplacementMap in="SourceGraphic" scale={4} /> {/* More rugged */}
      </filter>
      <path
        d="M 10,10 C 35,5 65,15 90,10 M 15,25 C 45,20 75,35 95,25 M 10,10 C 15,45 5,75 12,90"
        stroke={color}
        strokeWidth="6" // Bold line width
        fill="none"
        strokeLinecap="round"
        filter={`url(#scribbleFilter${seed})`}
      />
    </svg>
  );
}

// --- Box Component with Bolder Lines ---
function HandDrawnBox({
  color,
  dashArray,
  dashOffset,
  seed = 1,
}: {
  color: string;
  dashArray: number;
  dashOffset: number;
  seed?: number;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
      }}
      fill="none"
    >
      <defs>
        <filter id={`inkCard${seed}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.025" numOctaves="4" seed={seed} result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale={3} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#inkCard${seed})`} strokeLinecap="round" strokeLinejoin="round">
        {/* Shadow - slightly lighter but still present */}
        <rect x={2} y={2} width={96} height={96} rx={10} stroke={color} strokeWidth={9} strokeOpacity={0.12} />
        {/* Main Drawing Line - much bolder */}
        <rect
          x={2} y={2} width={96} height={96} rx={10}
          stroke={color}
          strokeWidth={6} // Increased from 3
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
        />
      </g>
    </svg>
  );
}

export const StatsFigures: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  stats: statsProp,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const stats = statsProp?.length ? statsProp : DEFAULT_STATS;

  const mainStats = stats.slice(0, 5);
  const floatingStats = stats.slice(5);

  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

const floatingSlots = [
    // Original Corners
    { top: "14%", left: "13%", rotation: -8 },
    { top: "11%", right: "12%", rotation: 6 },
    { bottom: "13%", left: "10%", rotation: -5 },
    
    // New Random "Edge" Positions
    { top: "12%", left: "40%", rotation: 3 },    // Mid-Top (slightly offset)
    { bottom: "10%", right: "40%", rotation: -4 }, // Mid-Bottom
    { top: "40%", left: "12%", rotation: 12 },   // Mid-Left
    { top: "45%", right: "11%", rotation: -10 }, // Mid-Right
  ];

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#FFFFFF", fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive" }}>
      <WhiteboardBackground bgColor={"#FFFFFF"} />
      
      {/* Bold Corner Drawings */}
      <CornerScribble side="tl" color={accentColor} seed={101} />
      <CornerScribble side="tr" color={accentColor} seed={102} />
      <CornerScribble side="bl" color={accentColor} seed={103} />
      <CornerScribble side="br" color={accentColor} seed={104} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "10% 8%" : "7% 10%",
          gap: p ? 28 : 40,
        }}
      >
        {/* Title & Narration - Centered Group */}
        <div style={{ 
          textAlign: "center", 
          opacity: titleOp, 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center" 
        }}>
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 58 : 70),
              lineHeight: 1.1,
              marginBottom: 12,
              textAlign: "center",
              width: "100%",
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: textColor,
              fontSize: descriptionFontSize ?? (p ? 26 : 30),
              opacity: 0.9,
              maxWidth: p ? "100%" : 750,
              textAlign: "center",
              margin: "0 auto",
            }}
          >
            {narration}
          </div>
        </div>

        {/* Center Stats */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: p ? 20 : 30,
            justifyContent: "center",
            width: "100%",
          }}
        >
          {mainStats.map((item, i) => {
            const delay = 20 + i * 9;
            const drawProgress = interpolate(frame, [delay, delay + 24], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const dash = 400;
            const offset = dash * (1 - drawProgress);
            const cardOp = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });

            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  minWidth: p ? 120 : 160,
                  padding: p ? "18px 16px" : "24px 22px",
                  backgroundColor: "rgba(255,255,255,0.75)", // Slightly less transparent
                  opacity: cardOp,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <HandDrawnBox color={accentColor} dashArray={dash} dashOffset={offset} seed={i + 1} />
                <span style={{ color: accentColor, fontSize: p ? 34 : 42, fontWeight: 800 }}>{item.value}</span>
                <div style={{ color: textColor, fontSize: p ? 17 : 20, fontWeight: 600, textAlign: "center" }}>{item.label}</div>
                </div>
            );
          })}
        </div>
      </div>

      {/* Floating Stats */}
      {floatingStats.map((item, i) => {
        const slot = floatingSlots[i % floatingSlots.length];
        const delay = 60 + i * 10;
        const progress = interpolate(frame, [delay, delay + 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const dash = 400;
        const offset = dash * (1 - progress);

        return (
          <div
            key={`floating-${i}`}
            style={{
              position: "absolute",
              ...(({ rotation, ...rest }) => rest)(slot),
              transform: `rotate(${slot.rotation}deg)`,
              padding: "16px 20px",
              backgroundColor: "rgba(255,255,255,0.65)",
              minWidth: 130,
              opacity: progress,
              textAlign: "center"
            }}
          >
            <HandDrawnBox color={accentColor} dashArray={dash} dashOffset={offset} seed={i + 20} />
            <div style={{ fontSize: 28, fontWeight: 800, color: accentColor }}>{item.value}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: textColor }}>{item.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};