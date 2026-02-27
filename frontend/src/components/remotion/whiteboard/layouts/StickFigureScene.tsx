import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

export const StickFigureScene: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  // 1. BOUNCE MATH
  // Math.abs(Math.sin) creates a bouncing "camel hump" shape
  const bounceHeight = 120;
  const bounceRaw = Math.abs(Math.sin(frame * 0.1));
  const ballOffset = bounceRaw * bounceHeight;

  // 2. ARM MOVEMENT
  // The arms move slightly to meet the ball at the bottom (0)
  const shoulderY = 130;
  const handX = 220;
  // Arms follow the ball only at the very bottom of the bounce for a "catch" feel
  const handY = 200 - (1 - bounceRaw) * 20; 
  const elbowX = 165;
  const elbowY = 170;

  const figProgress = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [28, 46], [0, 1], { extrapolateRight: "clamp" });

  const dash = 500;
  const figOff = dash * (1 - figProgress);

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive",
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.055" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="22" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain)" fill="white" />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: p ? 20 : 44,
          padding: p ? "8% 8%" : "5% 7%",
        }}
      >
        <svg viewBox="0 0 420 370" style={{ width: p ? "84%" : "44%", maxWidth: 640, height: "auto" }} fill="none">
          <g filter="url(#ink)" strokeLinecap="round" strokeLinejoin="round">
            {/* Ground line */}
            <line x1={10} y1={310} x2={410} y2={308} stroke={textColor} strokeWidth={4} strokeOpacity={0.3} />

            {/* === STICK MAN === */}
            <circle cx={110} cy={66} r={30} stroke={textColor} strokeWidth={5} strokeDasharray={dash} strokeDashoffset={figOff} />
            <line x1={110} y1={98} x2={110} y2={218} stroke={textColor} strokeWidth={5} strokeDasharray={dash} strokeDashoffset={figOff} />

            {/* Arms - Both same opacity */}
            <path 
              d={`M110,${shoulderY} L${elbowX},${elbowY} L${handX},${handY}`} 
              stroke={textColor} 
              strokeWidth={5} 
              fill="none" 
            />
            <path 
              d={`M110,${shoulderY} L${elbowX - 15},${elbowY + 10} L${handX},${handY}`} 
              stroke={textColor} 
              strokeWidth={5} 
              fill="none" 
            />

            {/* Legs */}
            <path d="M110,218 L80,308" stroke={textColor} strokeWidth={5} />
            <path d="M110,218 L140,308" stroke={textColor} strokeWidth={5} />

            {/* === BOUNCING BALL === */}
            {/* The ball bounces UP from the hand position */}
            <g transform={`translate(0, ${-ballOffset})`}>
              <circle cx={handX} cy={handY - 25} r={25} stroke={accentColor} strokeWidth={5} fill={bgColor} />
              <path d={`M${handX-10},${handY-32} Q${handX},${handY-25} ${handX+10},${handY-32}`} stroke={accentColor} strokeWidth={3} strokeOpacity={0.5} />
            </g>
          </g>
        </svg>

        <div style={{ flex: 1, color: textColor, opacity: textOp, textAlign: p ? "center" : "left" }}>
          <div style={{ fontWeight: 700, fontSize: titleFontSize ?? (p ? 64 : 82), filter: "url(#ink)" }}>{title}</div>
          <div style={{ marginTop: 18, fontSize: descriptionFontSize ?? (p ? 30 : 38), filter: "url(#ink)" }}>{narration}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};