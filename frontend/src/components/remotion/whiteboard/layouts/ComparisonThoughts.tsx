import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

// Wobbly rounded rect — dimensions passed in so it matches the dynamic bubble size
function WobblyRect({
  x, y, w, h, r, stroke, strokeWidth, fill, opacity,
}: {
  x: number; y: number; w: number; h: number; r: number;
  stroke: string; strokeWidth: number; fill?: string; opacity?: number;
}) {
  const path = [
    `M ${x + r},${y + 1}`,
    `Q ${x + w / 2},${y - 1} ${x + w - r},${y + 2}`,
    `Q ${x + w + 1},${y} ${x + w + 1},${y + r}`,
    `Q ${x + w + 2},${y + h / 2} ${x + w},${y + h - r}`,
    `Q ${x + w + 1},${y + h + 1} ${x + w - r},${y + h}`,
    `Q ${x + w / 2},${y + h + 2} ${x + r},${y + h - 1}`,
    `Q ${x - 1},${y + h} ${x},${y + h - r}`,
    `Q ${x - 2},${y + h / 2} ${x + 1},${y + r}`,
    `Q ${x},${y - 1} ${x + r},${y + 1} Z`,
  ].join(" ");
  return (
    <path
      d={path}
      fill={fill ?? "none"}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

// Estimates how many lines the thought text will wrap to inside the bubble
function estimateBubbleHeight(text: string, fontSize: number, bubbleInnerW: number): number {
  const approxCharsPerLine = Math.floor(bubbleInnerW / (fontSize * 0.58));
  const words = text.split(" ");
  let lines = 1;
  let lineLen = 0;
  for (const word of words) {
    if (lineLen + word.length + 1 > approxCharsPerLine && lineLen > 0) {
      lines++;
      lineLen = word.length;
    } else {
      lineLen += word.length + 1;
    }
  }
  const lineH = fontSize * 1.4;
  const padding = 28; 
  return Math.max(80, lines * lineH + padding);
}

interface ThoughtBubbleProps {
  thought: string;
  textColor: string;
  dash: number;
  offset: number;
  bubbleOp: number;
  isPortrait: boolean;
  index: number;
  fontFamily?: string;
}

function ThoughtBubble({ thought, textColor, dash, offset, bubbleOp, isPortrait, index, fontFamily }: ThoughtBubbleProps) {
  const fontSize = isPortrait ? 22 : 26;
  const bubbleInnerW = isPortrait ? 240 : 272; 
  const contentH = estimateBubbleHeight(thought, fontSize, bubbleInnerW);
  const vbW = isPortrait ? 260 : 300;
  const vbH = contentH + 20; 
  const tailY = contentH + 4;
  const frame = useCurrentFrame();
  const floatY = Math.sin(frame * 0.05 + index) * 15; 
  const waveRotation = Math.sin(frame * 0.04 + index) * 5;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: isPortrait ? 320 : 480,
        marginBottom: isPortrait ? 6 : 14,
        opacity: bubbleOp,
        position: "relative",
        transform: `translateY(${floatY}px) rotate(${waveRotation}deg)`,
        transformOrigin: "center bottom",
      }}
    >
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        style={{ width: "100%", height: "auto", overflow: "visible", display: "block" }}
        fill="none"
      >
        <defs>
          <filter id={`inkBubble${index}`} x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.02" numOctaves="4" seed={index + 5} result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter={`url(#inkBubble${index})`}>
          <WobblyRect
            x={4} y={4} w={vbW - 8} h={contentH - 8} r={20}
            stroke={textColor} strokeWidth={7}
            fill="rgba(255,255,255,0.82)" opacity={0.22}
          />
          <WobblyRect
            x={4} y={4} w={vbW - 8} h={contentH - 8} r={20}
            stroke={textColor} strokeWidth={3.5}
            fill="rgba(255,255,255,0.82)"
          />
          <path
            d={`M${vbW / 2 - 14},${tailY} Q${vbW / 2},${tailY + 14} ${vbW / 2 + 2},${tailY + 18} Q${vbW / 2 + 16},${tailY + 14} ${vbW / 2 + 28},${tailY}`}
            fill="rgba(255,255,255,0.82)"
            stroke={textColor}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </g>
        <foreignObject x="14" y="12" width={bubbleInnerW} height={contentH - 8}>
          <div
            style={{
              color: textColor,
              fontSize,
              fontWeight: 600,
              textAlign: "center",
              lineHeight: 1.4,
              fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
              letterSpacing: "1.5px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              padding: "4px 6px",
              wordBreak: "break-word",
            }}
          >
            {thought}
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}

export const ComparisonThoughts: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  leftThought = "Option A",
  rightThought = "Option B",
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const drawProgress = interpolate(frame, [0, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dash = 380;
  const offset = dash * (1 - drawProgress);

  const bubbleOp = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });

  function Stickman({ isRight, seed }: { isRight: boolean; seed: number }) {
    const frame = useCurrentFrame();
    const t = frame * 0.05;
    const breath = Math.sin(t * 1.2) * 1.5;
    const jitter = (Math.sin(frame * 0.4) * 0.5);
    const weightShift = Math.sin(t * 0.8) * 4;
    const hipX = 50 + weightShift;
    const hipY = 105;
    const torsoAngle = (isRight ? -3 : 3) + Math.cos(t * 0.7) * 4;
    const torsoRad = (torsoAngle * Math.PI) / 180;
    const shoulderX = hipX + Math.sin(torsoRad) * 45;
    const shoulderY = hipY - Math.cos(torsoRad) * 45 + breath;
    const headTilt = Math.sin(t * 1.5) * 5;
    const headRad = ((torsoAngle + headTilt) * Math.PI) / 180;
    const headX = shoulderX + Math.sin(headRad) * 18;
    const headY = shoulderY - Math.cos(headRad) * 18 + jitter;
    const handOffset = 18;
    const targetHandX = headX + (isRight ? handOffset : -handOffset);
    const targetHandY = headY + 5 + Math.sin(t * 2) * 3;
    const elbowArc = 26;
    const elbowYDrop = 12;
    const elbowX = (shoulderX + targetHandX) / 2 + (isRight ? elbowArc : -elbowArc);
    const elbowY = (shoulderY + targetHandY) / 2 + elbowYDrop;
    const restHandX = shoulderX + (isRight ? -22 : 22) + Math.sin(t) * 5;
    const restHandY = shoulderY + 30 + Math.cos(t) * 5;
    const restElbowArc = 10;
    const restElbowX = (shoulderX + restHandX) / 2 + (isRight ? -restElbowArc : restElbowArc);
    const restElbowY = (shoulderY + restHandY) / 2 + 10;
    const footLX = 35;
    const footRX = 65;
    const footY = 155;

    return (
      <svg viewBox="0 0 100 160" style={{ width: p ? "48%" : "36%", maxWidth: 240, height: "auto", overflow: "visible" }} fill="none">
        <defs>
          <filter id={`inkFig${seed}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed={seed} result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter={`url(#inkFig${seed})`} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={headX} cy={headY} r="15" stroke={textColor} strokeWidth={4.5} />
          <line x1={shoulderX} y1={shoulderY} x2={hipX} y2={hipY} stroke={textColor} strokeWidth={5} />
          <path d={`M ${shoulderX} ${shoulderY} Q ${elbowX} ${elbowY} ${targetHandX} ${targetHandY}`} stroke={textColor} strokeWidth={4.5} fill="none" />
          <path d={`M ${shoulderX} ${shoulderY} Q ${restElbowX} ${restElbowY} ${restHandX} ${restHandY}`} stroke={textColor} strokeWidth={4.5} fill="none" />
          <line x1={hipX} y1={hipY} x2={footLX} y2={footY} stroke={textColor} strokeWidth={5} />
          <line x1={hipX} y1={hipY} x2={footRX} y2={footY} stroke={textColor} strokeWidth={5} />
          <circle cx={targetHandX} cy={targetHandY} r={2.5} fill={textColor} />
        </g>
      </svg>
    );
  }

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        letterSpacing: "1.5px",
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.052" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" seed="13" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain)" fill="none" />
        {p && (
            <path d="M 50,500 Q 500,510 950,500" stroke={textColor} strokeWidth="3" strokeOpacity="0.15" fill="none" filter="url(#ink)" />
        )}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "10% 6% 6% 6%" : "5% 7%",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: p ? 20 : 22, opacity: titleOp }}>
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 50 : 62),
              lineHeight: 1.1,
              filter: "url(#ink)",
            }}
          >
            {title}
          </div>
          {narration && (
            <div
              style={{
                marginTop: 8,
                color: textColor,
                fontSize: descriptionFontSize ?? (p ? 26 : 28),
                opacity: 0.88,
                filter: "url(#ink)",
                maxWidth: p ? "92%" : "auto",
                marginInline: "auto"
              }}
            >
              {narration}
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: p ? "column" : "row",
            alignItems: p ? "center" : "stretch",
            justifyContent: p ? "space-between" : "center",
            gap: p ? 0 : 36,
          }}
        >
          {/* LEFT THOUGHT SECTION */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              minWidth: 0,
            }}
          >
            <ThoughtBubble
              thought={leftThought}
              textColor={textColor}
              dash={dash}
              offset={offset}
              bubbleOp={bubbleOp}
              isPortrait={p}
              index={0}
              fontFamily={fontFamily}
            />
            <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center", marginTop: p ? -10 : 20 }}>
              <Stickman isRight={false} seed={2} />
            </div>
          </div>

          {/* MASSIVE VS DIVIDER for Portrait */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              margin: p ? "5px 0" : "0",
              zIndex: 10,
            }}
          >
            <span
              style={{
                color: accentColor,
                fontWeight: 900,
                // DRAMATICALLY INCREASED SIZE IN PORTRAIT
                fontSize: p ? 64 : 44, 
                opacity: titleOp,
                filter: "url(#ink)",
                textTransform: "uppercase",
                fontStyle: "italic",
                letterSpacing: p ? "0.05em" : "normal",
                // Added a slight glow/halo effect in portrait
                textShadow: p ? `2px 2px 0px ${bgColor}, 4px 4px 0px rgba(0,0,0,0.1)` : "none",
              }}
            >
              vs
            </span>
          </div>

          {/* RIGHT THOUGHT SECTION */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              minWidth: 0,
            }}
          >
            <ThoughtBubble
              thought={rightThought}
              textColor={textColor}
              dash={dash}
              offset={offset}
              bubbleOp={bubbleOp}
              isPortrait={p}
              index={1}
              fontFamily={fontFamily}
            />
            <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center", marginTop: p ? -10 : 20 }}>
              <Stickman isRight={true} seed={3} />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};