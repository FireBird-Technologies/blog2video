import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps, WhiteboardStatItem } from "../types";

const DEFAULT_STATS: WhiteboardStatItem[] = [
  { label: "Growth", value: "50%" },
  { label: "Faster", value: "3x" },
  { label: "Users", value: "10K+" },
];

// Hand-drawn box SVG border for a stat card
// Uses a normalised 100×100 viewBox + preserveAspectRatio="none" so it
// always stretches to fill whatever size the parent card ends up being.
function HandDrawnBox({
  color, dashArray, dashOffset, seed = 1,
}: {
  color: string; dashArray: number; dashOffset: number; seed?: number;
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
          <feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#inkCard${seed})`} strokeLinecap="round" strokeLinejoin="round">
        {/* Bleed layer */}
        <rect x={2} y={2} width={96} height={96} rx={10} stroke={color} strokeWidth={7} strokeOpacity={0.18} />
        {/* Core layer */}
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
  const maxItems = Math.min(stats.length, 4);

  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive" }}>
      <WhiteboardBackground bgColor={bgColor} />

      {/* Paper grain */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.052" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink" x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="7" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain)" fill="white" />
      </svg>

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
        {/* Title block */}
        <div style={{ textAlign: "center", opacity: titleOp }}>
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 58 : 70),
              lineHeight: 1.1,
              marginBottom: 8,
              filter: "url(#ink)",
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

        {/* Stat cards */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: p ? 20 : 30,
            justifyContent: "center",
            alignItems: "stretch",
          }}
        >
          {stats.slice(0, maxItems).map((item, i) => {
            const delay = 20 + i * 9;
            const drawProgress = interpolate(frame, [delay, delay + 24], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            // Normalised viewBox is 100x100, perimeter ≈ 400
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
                  boxShadow: "0 4px 14px rgba(0,0,0,0.07)",
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

                {/* Value */}
                <span
                  style={{
                    color: accentColor,
                    fontSize: p ? 34 : 42,
                    fontWeight: 800,
                    fontFamily: "inherit",
                    filter: "url(#ink)",
                    lineHeight: 1,
                  }}
                >
                  {item.value}
                </span>

                {/* Divider line — wobbly, percentage-based so it fits any card width */}
                <svg
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                  style={{ display: "block", width: "80%", height: 8 }}
                  fill="none"
                >
                  <defs>
                    <filter id={`inkDiv${i}`} x="-5%" y="-40%" width="110%" height="180%">
                      <feTurbulence type="fractalNoise" baseFrequency="0.08 0.4" numOctaves="3" seed={i + 8} result="w" />
                      <feDisplacementMap in="SourceGraphic" in2="w" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
                    </filter>
                  </defs>
                  <path
                    d="M4,5 Q50,3 96,5"
                    stroke={textColor}
                    strokeWidth="4"
                    strokeOpacity="0.2"
                    strokeLinecap="round"
                    filter={`url(#inkDiv${i})`}
                    strokeDasharray={100}
                    strokeDashoffset={100 * (1 - drawProgress)}
                  />
                  <path
                    d="M4,5 Q50,3 96,5"
                    stroke={textColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    filter={`url(#inkDiv${i})`}
                    strokeDasharray={100}
                    strokeDashoffset={100 * (1 - drawProgress)}
                  />
                </svg>

                {/* Label */}
                <div
                  style={{
                    color: textColor,
                    fontSize: p ? 17 : 20,
                    fontWeight: 600,
                    textAlign: "center",
                    filter: "url(#ink)",
                  }}
                >
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};