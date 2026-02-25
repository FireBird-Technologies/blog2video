import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

/**
 * SpeechBubbleDialogue
 * Props:
 *  - title / narration: caption below scene
 *  - leftThought / rightThought: what each figure says
 *  - stats[0].label / stats[1].label: speaker names (default "Person A" / "Person B")
 */

// ─── Stick figure ────────────────────────────────────────────────────────────
function StickFigure({
  cx, dash, offset, stroke,
}: {
  cx: number; dash: number; offset: number; stroke: string;
}) {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* bleed */}
      <circle cx={cx} cy={60} r={26} fill="none" stroke={stroke} strokeWidth={9} strokeOpacity={0.18} strokeDasharray={dash} strokeDashoffset={offset} />
      <line x1={cx} y1={88} x2={cx} y2={188} stroke={stroke} strokeWidth={9} strokeOpacity={0.18} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={`M${cx},114 Q${cx - 40},136 ${cx - 64},154`} fill="none" stroke={stroke} strokeWidth={9} strokeOpacity={0.18} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={`M${cx},114 Q${cx + 36},130 ${cx + 58},142`} fill="none" stroke={stroke} strokeWidth={9} strokeOpacity={0.18} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={`M${cx},188 Q${cx - 14},240 ${cx - 26},290`} fill="none" stroke={stroke} strokeWidth={9} strokeOpacity={0.18} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={`M${cx},188 Q${cx + 16},240 ${cx + 28},290`} fill="none" stroke={stroke} strokeWidth={9} strokeOpacity={0.18} strokeDasharray={dash} strokeDashoffset={offset} />
      {/* core */}
      <circle cx={cx} cy={60} r={26} fill="none" stroke={stroke} strokeWidth={4.5} strokeDasharray={dash} strokeDashoffset={offset} />
      <line x1={cx} y1={88} x2={cx} y2={188} stroke={stroke} strokeWidth={4.5} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={`M${cx},114 Q${cx - 40},136 ${cx - 64},154`} fill="none" stroke={stroke} strokeWidth={4.5} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={`M${cx},114 Q${cx + 36},130 ${cx + 58},142`} fill="none" stroke={stroke} strokeWidth={4.5} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={`M${cx},188 Q${cx - 14},240 ${cx - 26},290`} fill="none" stroke={stroke} strokeWidth={4.5} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={`M${cx},188 Q${cx + 16},240 ${cx + 28},290`} fill="none" stroke={stroke} strokeWidth={4.5} strokeDasharray={dash} strokeDashoffset={offset} />
    </g>
  );
}

// ─── Dynamic bubble height estimator ─────────────────────────────────────────
// Estimates wrapped line count to compute a bubble height that always fits text.
function estimateBubbleHeight(text: string, fontSize: number, innerW: number): number {
  const charsPerLine = Math.floor(innerW / (fontSize * 0.56));
  const words = text.split(" ");
  let lines = 1;
  let lineLen = 0;
  for (const word of words) {
    if (lineLen > 0 && lineLen + word.length + 1 > charsPerLine) {
      lines++;
      lineLen = word.length;
    } else {
      lineLen += (lineLen > 0 ? 1 : 0) + word.length;
    }
  }
  return Math.max(72, lines * (fontSize * 1.45) + 32); // padding top+bottom = 32
}

// ─── Speech bubble ────────────────────────────────────────────────────────────
interface BubbleProps {
  // SVG-space position & sizing
  anchorX: number;   // X center of the figure — tail points here
  topY: number;      // top of the bubble in SVG space (negative = above svgH=0)
  side: "left" | "right";
  text: string;
  textColor: string;
  fill?: string;
  progress: number;
  fontSize: number;
}

function SpeechBubble({ anchorX, topY, side, text, textColor, fill = "rgba(255,255,255,0.92)", progress, fontSize }: BubbleProps) {
  const innerW = 210; // px inside bubble for text (viewBox units)
  const hContent = estimateBubbleHeight(text, fontSize, innerW);
  const tailH = 24;
  const bW = innerW + 28; // bubble outer width (14px padding each side)
  const bH = hContent;
  const bX = side === "left" ? anchorX - 20 : anchorX - bW + 20;
  const r = 16;

  // Wobbly rounded-rect path
  const bPath = [
    `M ${bX + r},${topY + 1}`,
    `Q ${bX + bW / 2},${topY - 1} ${bX + bW - r},${topY + 2}`,
    `Q ${bX + bW + 1},${topY} ${bX + bW + 1},${topY + r}`,
    `Q ${bX + bW + 2},${topY + bH / 2} ${bX + bW},${topY + bH - r}`,
    `Q ${bX + bW + 1},${topY + bH + 1} ${bX + bW - r},${topY + bH}`,
    `Q ${bX + bW / 2},${topY + bH + 2} ${bX + r},${topY + bH - 1}`,
    `Q ${bX - 1},${topY + bH} ${bX},${topY + bH - r}`,
    `Q ${bX - 2},${topY + bH / 2} ${bX + 1},${topY + r}`,
    `Q ${bX},${topY - 1} ${bX + r},${topY + 1} Z`,
  ].join(" ");

  // Tail: points down toward the figure
  const tailMidX = side === "left" ? bX + 40 : bX + bW - 40;
  const tailPath = `M ${tailMidX - 14},${topY + bH} Q ${tailMidX},${topY + bH + tailH} Q ${tailMidX + 14},${topY + bH} Z`;

  const dash = 900;
  const off = dash * (1 - progress);
  const filterId = `inkB_${side}`;

  const visChars = Math.floor(text.length * progress);
  const visText = text.slice(0, visChars);

  return (
    <>
      <defs>
        <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.02" numOctaves="4" seed={side === "left" ? 7 : 11} result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g opacity={progress > 0 ? 1 : 0}>
        <g filter={`url(#${filterId})`}>
          {/* Bleed stroke */}
          <path d={bPath} fill={fill} stroke={textColor} strokeWidth={8} strokeOpacity={0.18} strokeLinejoin="round" strokeLinecap="round" />
          {/* Core stroke — animated draw */}
          <path d={bPath} fill={fill} stroke={textColor} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={dash} strokeDashoffset={off} />
          {/* Tail */}
          <path d={tailPath} fill={fill} stroke={textColor} strokeWidth={3.5} strokeLinejoin="round" />
        </g>

        {/* Text via foreignObject — sized exactly to inner bubble area */}
        <foreignObject
          x={bX + 14}
          y={topY + 10}
          width={innerW}
          height={hContent - 16}
          opacity={Math.min(progress * 2.5, 1)}
        >
          <div
            style={{
              color: textColor,
              fontSize,
              fontWeight: 600,
              fontFamily: "'Comic Sans MS', 'Segoe Print', cursive",
              lineHeight: 1.45,
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              wordBreak: "break-word",
            }}
          >
            {visText}
            {visChars < text.length && <span style={{ opacity: 0.35 }}>|</span>}
          </div>
        </foreignObject>
      </g>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const SpeechBubbleDialogue: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  leftThought = "Wait, did you know?",
  rightThought = "Tell me more!",
  stats,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const figDash = 500;
  const figOff = figDash * (1 - interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" }));

  const leftBubbleProgress  = interpolate(frame, [22, 50], [0, 1], { extrapolateRight: "clamp" });
  const rightBubbleProgress = interpolate(frame, [52, 80], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [72, 88], [0, 1], { extrapolateRight: "clamp" });
  const labelOp = interpolate(frame, [18, 28], [0, 1], { extrapolateRight: "clamp" });

  const svgW = 700;
  const groundY = 308; // ground line Y
  // Labels sit BELOW the ground line with a clear gap
  const labelY = groundY + 28;

  const leftCX  = 240;
  const rightCX = 460;

  const fontSize = p ? 17 : 21;

  // Compute bubble heights so we can position them correctly above figures
  const leftBH  = estimateBubbleHeight(leftThought,  fontSize, 210);
  const rightBH = estimateBubbleHeight(rightThought, fontSize, 210);
  const tailH = 24;
  // Bubble top: figure head starts at y=34 (cy=60 - r=26), place bubble above with gap
  const figHeadTopY = 34;
  const bubbleGap = 12;
  const leftBubbleTopY  = figHeadTopY - leftBH  - tailH - bubbleGap;
  const rightBubbleTopY = figHeadTopY - rightBH - tailH - bubbleGap;

  const leftSpeaker  = stats?.[0]?.label ?? "Person A";
  const rightSpeaker = stats?.[1]?.label ?? "Person B";

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive" }}>
      <WhiteboardBackground bgColor={bgColor} />

      {/* Paper grain + ink defs */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.055" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink" x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="31" result="w" />
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
          alignItems: "center",
          justifyContent: "center",
          gap: p ? 14 : 18,
          padding: p ? "4% 4%" : "3% 7%",
        }}
      >
        {/* Scene SVG — overflow:visible so bubbles can extend above */}
        <svg
          viewBox={`0 0 ${svgW} ${labelY + 10}`}
          style={{ width: p ? "96%" : "80%", maxWidth: 880, height: "auto", overflow: "visible" }}
          fill="none"
        >
          <defs>
            <filter id="inkFigs" x="-4%" y="-4%" width="108%" height="108%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="29" result="w" />
              <feDisplacementMap in="SourceGraphic" in2="w" scale="2.8" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>

          {/* Ground line */}
          <g filter="url(#inkFigs)">
            <line x1={20} y1={groundY} x2={680} y2={groundY - 2} stroke={textColor} strokeWidth={6} strokeOpacity={0.18} strokeLinecap="round" />
            <line x1={20} y1={groundY} x2={680} y2={groundY - 2} stroke={textColor} strokeWidth={3} strokeLinecap="round" />
          </g>

          {/* Left figure */}
          <g filter="url(#inkFigs)">
            <StickFigure cx={leftCX} dash={figDash} offset={figOff} stroke={textColor} />
          </g>

          {/* Right figure — mirror via transform */}
          <g filter="url(#inkFigs)" transform={`translate(${svgW}, 0) scale(-1, 1)`}>
            <StickFigure cx={svgW - rightCX} dash={figDash} offset={figOff} stroke={accentColor} />
          </g>

          {/* Speaker labels — clearly BELOW the ground line */}
          <text
            x={leftCX} y={labelY}
            textAnchor="middle" fill={textColor}
            fontSize={18} fontFamily="'Comic Sans MS', cursive" fontWeight="700"
            opacity={labelOp}
          >
            {leftSpeaker}
          </text>
          <text
            x={rightCX} y={labelY}
            textAnchor="middle" fill={accentColor}
            fontSize={18} fontFamily="'Comic Sans MS', cursive" fontWeight="700"
            opacity={labelOp}
          >
            {rightSpeaker}
          </text>

          {/* Left speech bubble — side="right" so bubble extends LEFT (outward) from figure */}
          <SpeechBubble
            anchorX={leftCX}
            topY={leftBubbleTopY}
            side="right"
            text={leftThought}
            textColor={textColor}
            progress={leftBubbleProgress}
            fontSize={fontSize}
          />

          {/* Right speech bubble — side="left" so bubble extends RIGHT (outward) from figure */}
          <SpeechBubble
            anchorX={rightCX}
            topY={rightBubbleTopY}
            side="left"
            text={rightThought}
            textColor={accentColor}
            fill="rgba(255,255,255,0.92)"
            progress={rightBubbleProgress}
            fontSize={fontSize}
          />

          {/* Conversation dots */}
          {[0, 1, 2].map((dot) => {
            const dotOp = interpolate(frame, [42 + dot * 4, 50 + dot * 4], [0, 1], { extrapolateRight: "clamp" });
            return (
              <circle
                key={dot}
                cx={svgW / 2 - 22 + dot * 22}
                cy={160}
                r={7}
                fill={textColor}
                fillOpacity={dotOp * 0.45}
              />
            );
          })}
        </svg>

        {/* Title / caption */}
        <div style={{ textAlign: "center", opacity: titleOp }}>
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 42 : 54),
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
                fontSize: descriptionFontSize ?? (p ? 22 : 26),
                opacity: 0.88,
                filter: "url(#ink)",
              }}
            >
              {narration}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};