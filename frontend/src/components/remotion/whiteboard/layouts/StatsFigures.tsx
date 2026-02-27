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
        <filter id={`inkCard${seed}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.025" numOctaves="4" seed={seed} result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale={2} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#inkCard${seed})`} strokeLinecap="round" strokeLinejoin="round">
        <rect x={2} y={2} width={96} height={96} rx={10} stroke={color} strokeWidth={7} strokeOpacity={0.18} />
        <rect
          x={2} y={2} width={96} height={96} rx={10}
          stroke={color} strokeWidth={3}
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

  const mainStats = stats.slice(0, 5);
  const floatingStats = stats.slice(5);

  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  // Predefined floating slots (edges and corners)
 const floatingSlots = [
  { top: "15%", left: "15%", rotation: -8 },
  { top: "15%", right: "15%", rotation: 6 },
  { bottom: "15%", left: "15%", rotation: -5 },
  { bottom: "15%", right: "15%", rotation: 7 },
  { top: "35%", left: "10%", rotation: -10 },
  { top: "35%", right: "10%", rotation: 9 },
  { bottom: "30%", left: "12%", rotation: -6 },
  { bottom: "30%", right: "12%", rotation: 8 },
];

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive" }}>
      <WhiteboardBackground bgColor={"#FFFFFF"} />

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
        {/* Title */}
        <div style={{ textAlign: "center", opacity: titleOp }}>
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 58 : 70),
              lineHeight: 1.1,
              marginBottom: 8,
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
                  minWidth: p ? 120 : 148,
                  padding: p ? "18px 16px" : "22px 20px",
                  backgroundColor: "rgba(255,255,255,0.5)",
                  borderRadius: 14,
                  opacity: cardOp,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  overflow: "visible",
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
              backgroundColor: "rgba(255,255,255,0.55)",
              borderRadius: 12,
              minWidth: 130,
              opacity: progress,
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