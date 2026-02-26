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

// Estimates how many lines the thought text will wrap to inside the bubble,
// so we can size the viewBox + foreignObject accordingly.
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
  const padding = 28; // top+bottom padding inside bubble
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
}

function ThoughtBubble({ thought, textColor, dash, offset, bubbleOp, isPortrait, index }: ThoughtBubbleProps) {
  const fontSize = isPortrait ? 22 : 26;
  const bubbleInnerW = 272; // viewBox units available for text (300 - 2*14)
  const contentH = estimateBubbleHeight(thought, fontSize, bubbleInnerW);
  const vbW = 300;
  const vbH = contentH + 20; // +20 for tail
  const tailY = contentH + 4;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: isPortrait ? 380 : 480,
        marginBottom: 14,
        opacity: bubbleOp,
        position: "relative",
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
          {/* Bleed layer */}
          <WobblyRect
            x={4} y={4} w={vbW - 8} h={contentH - 8} r={20}
            stroke={textColor} strokeWidth={7}
            fill="rgba(255,255,255,0.82)" opacity={0.22}
          />
          {/* Core layer — animated draw */}
          <WobblyRect
            x={4} y={4} w={vbW - 8} h={contentH - 8} r={20}
            stroke={textColor} strokeWidth={3.5}
            fill="rgba(255,255,255,0.82)"
          />
          {/* Tail */}
          <path
            d={`M${vbW / 2 - 14},${tailY} Q${vbW / 2},${tailY + 14} ${vbW / 2 + 2},${tailY + 18} Q${vbW / 2 + 16},${tailY + 14} ${vbW / 2 + 28},${tailY}`}
            fill="rgba(255,255,255,0.82)"
            stroke={textColor}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </g>
        {/* Text rendered in foreignObject sized to match content */}
        <foreignObject x="14" y="12" width={bubbleInnerW} height={contentH - 8}>
          <div
            style={{
              color: textColor,
              fontSize,
              fontWeight: 600,
              textAlign: "center",
              lineHeight: 1.4,
              fontFamily: "'Comic Sans MS', 'Segoe Print', cursive",
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

  // Stickman SVG — shared between both sides
  function Stickman({ isRight, seed }: { isRight: boolean; seed: number }) {
    return (
      <svg
        viewBox="0 0 100 160"
        // Increased: was "36%"/"28%", now "46%"/"36%"
        style={{ width: p ? "46%" : "36%", maxWidth: 240, height: "auto" }}
      >
        <defs>
          <filter id={`inkFig${seed}`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed={seed} result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter={`url(#inkFig${seed})`} strokeLinecap="round" strokeLinejoin="round">
          {/* Bleed layer */}
          <circle cx="50" cy="28" r="16" fill="none" stroke={textColor} strokeWidth="9" strokeOpacity="0.18" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="50" y1="46" x2="50" y2="100" stroke={textColor} strokeWidth="9" strokeOpacity="0.18" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="50" y1="58" x2={isRight ? 24 : 76} y2="78" stroke={textColor} strokeWidth="9" strokeOpacity="0.18" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="50" y1="58" x2={isRight ? 76 : 24} y2="72" stroke={textColor} strokeWidth="9" strokeOpacity="0.18" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="50" y1="100" x2="30" y2="152" stroke={textColor} strokeWidth="9" strokeOpacity="0.18" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="50" y1="100" x2="70" y2="152" stroke={textColor} strokeWidth="9" strokeOpacity="0.18" strokeDasharray={dash} strokeDashoffset={offset} />
          {/* Core layer */}
          <circle cx="50" cy="28" r="16" fill="none" stroke={textColor} strokeWidth="5" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="50" y1="46" x2="50" y2="100" stroke={textColor} strokeWidth="5" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="50" y1="58" x2={isRight ? 24 : 76} y2="78" stroke={textColor} strokeWidth="5" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="50" y1="58" x2={isRight ? 76 : 24} y2="72" stroke={textColor} strokeWidth="5" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="50" y1="100" x2="30" y2="152" stroke={textColor} strokeWidth="5" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="50" y1="100" x2="70" y2="152" stroke={textColor} strokeWidth="5" strokeDasharray={dash} strokeDashoffset={offset} />
        </g>
      </svg>
    );
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive" }}>
      <WhiteboardBackground bgColor={bgColor} />

      {/* Paper grain + ink filter definitions */}
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
        <rect width="100%" height="100%" filter="url(#grain)" fill="white" />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "8% 6%" : "5% 7%",
        }}
      >
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: p ? 16 : 22, opacity: titleOp }}>
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 52 : 62),
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
                fontSize: descriptionFontSize ?? (p ? 24 : 28),
                opacity: 0.88,
                filter: "url(#ink)",
              }}
            >
              {narration}
            </div>
          )}
        </div>

        {/* Two figures + VS */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: p ? "column" : "row",
            alignItems: "stretch",
            justifyContent: "center",
            gap: p ? 24 : 36,
            padding: p ? "0 4%" : "0 5%",
          }}
        >
          {/* Left figure */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
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
            />
            <Stickman isRight={false} seed={2} />
          </div>

          {/* VS label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              alignSelf: "center",
            }}
          >
            <span
              style={{
                color: accentColor,
                fontWeight: 800,
                fontSize: p ? 36 : 44,
                opacity: titleOp,
                filter: "url(#ink)",
              }}
            >
              vs
            </span>
          </div>

          {/* Right figure */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
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
            />
            <Stickman isRight seed={6} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};