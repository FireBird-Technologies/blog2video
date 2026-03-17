import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

/**
 * Scribble Decor: Random hand-drawn shapes to fill portrait white space
 */
const BackgroundScribbles: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [20, 50], [0, 0.15], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <svg width="100%" height="100%" viewBox="0 0 400 800" fill="none" filter="url(#ink)">
        {/* Top Right Swirl */}
        <path d="M320,50 Q380,80 340,120 Q300,160 360,190" stroke={color} strokeWidth="3" strokeLinecap="round" />
        {/* Mid Left "Math" Doodle */}
        <path d="M40,200 L80,200 M60,180 L60,220 M100,190 Q120,230 100,250" stroke={color} strokeWidth="2.5" />
        {/* Bottom Left Star-ish */}
        <path d="M50,650 L70,680 L40,670 L80,670 L50,680 Z" stroke={color} strokeWidth="2" />
        {/* Bottom Right Circles */}
        <circle cx="330" cy="720" r="15" stroke={color} strokeWidth="2" strokeDasharray="5 3" />
        <circle cx="350" cy="740" r="8" stroke={color} strokeWidth="1.5" />
        {/* Top Left Wavy Line */}
        <path d="M30,40 Q60,20 90,40 T150,40" stroke={color} strokeWidth="2" />
      </svg>
    </AbsoluteFill>
  );
};

// ─── Stick figure ────────────────────────────────────────────────────────────
function StickFigure({
  cx,
  dash,
  offset,
  stroke,
  isRight,
  bubbleBottomY,
  bubbleWidth,
  bubbleSway,
  portrait,
  groundY, // New prop
}: {
  cx: number;
  dash: number;
  offset: number;
  stroke: string;
  isRight?: boolean;
  bubbleBottomY: number;
  bubbleWidth: number;
  bubbleSway: number;
  portrait: boolean;
  groundY: number; // New prop for ground position
}) {
  const frame = useCurrentFrame();

  const scale = portrait ? 1 : 0.75; // Scale factor for landscape mode (0.75 for 25% reduction)

  // Calculate vertical offset to bring feet to groundY
  const stickFigureFeetYRelativeToItsOrigin = (290 * scale); // This is the Y-coordinate of the feet in the figure's internal coordinate system
  const verticalShift = groundY - stickFigureFeetYRelativeToItsOrigin; // The amount to shift all Y-coords

  const walkProgress = interpolate(frame, [0, 25], [isRight ? 60 * scale : -60 * scale, 0], {
    extrapolateRight: "clamp",
  });
  const isWalking = frame < 25;
  const isGreeting = frame >= 25 && frame < 55;
  const isPresenting = frame >= 55;

  const walkCycle = Math.sin(frame * 0.4);
  const bob = isWalking
    ? Math.abs(Math.cos(frame * 0.4)) * (10 * scale)
    : Math.sin(frame * 0.08) * (4 * scale);

  const currentCX = cx + walkProgress;
  const presentLean = isPresenting ? Math.sin(frame * 0.07) * (3 * scale) : 0;

  // Apply verticalShift to all Y coordinates
  const headY = (60 * scale) - bob + verticalShift;
  const bodyStartY = (88 * scale) - bob + verticalShift;
  const bodyEndY = (188 * scale) - bob + verticalShift;
  const armBaseY = (114 * scale) - bob + verticalShift;
  const shoulderX = currentCX + presentLean * 0.3;

  const getArmPath = (targetX: number, targetY: number, bendRight: boolean) => {
    const upperArmLen = 42 * scale;
    const foreArmLen = 42 * scale;
    const dx = targetX - shoulderX;
    const dy = targetY - armBaseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Ensure 'd' is not too large or too small for acos.
    // '-1' is a small segment overlap, scaling it slightly
    const d = Math.min(dist, upperArmLen + foreArmLen - (1 * scale));
    const cosAngle = (upperArmLen ** 2 + d ** 2 - foreArmLen ** 2) / (2 * upperArmLen * d);
    const angleToTarget = Math.atan2(dy, dx);
    const elbowAngle = angleToTarget + (bendRight ? 1 : -1) * Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    const ex = shoulderX + Math.cos(elbowAngle) * upperArmLen;
    const ey = armBaseY + Math.sin(elbowAngle) * upperArmLen;
    return `M${shoulderX},${armBaseY} L${ex},${ey} L${targetX},${targetY}`;
  };

  let leftArmPath: string;
  let rightArmPath: string;

  if (isWalking) {
    const lx = currentCX - walkCycle * (25 * scale);
    const ly = armBaseY + (40 * scale);
    const rx = currentCX + walkCycle * (25 * scale);
    const ry = armBaseY + (40 * scale);
    leftArmPath = `M${shoulderX},${armBaseY} L${lx},${ly}`;
    rightArmPath = `M${shoulderX},${armBaseY} L${rx},${ry}`;
  } else if (isGreeting) {
    const wave = Math.sin(frame * 0.3);
    if ((isRight ? "left" : "right") === "left") {
      leftArmPath = `M${shoulderX},${armBaseY} L${currentCX - (45 * scale)},${armBaseY - (30 * scale) + wave * (20 * scale)}`;
      rightArmPath = `M${shoulderX},${armBaseY} L${currentCX + (20 * scale)},${armBaseY + (50 * scale)}`;
    } else {
      leftArmPath = `M${shoulderX},${armBaseY} L${currentCX - (20 * scale)},${armBaseY + (50 * scale)}`;
      rightArmPath = `M${shoulderX},${armBaseY} L${currentCX + (45 * scale)},${armBaseY - (30 * scale) + wave * (20 * scale)}`;
    }
  } else {
    const halfGrip = bubbleWidth * 0.38;
    // bubbleBottomY is already the absolute Y-coordinate of the bubble's bottom edge,
    // and correctly adjusted for figure's verticalShift in the parent component.
    const gripY = bubbleBottomY - bob + (6 * scale);
    const effortL = Math.sin(frame * 0.13 + 1.2) * (2.5 * scale);
    const effortR = Math.sin(frame * 0.11 + 0.4) * (2.5 * scale);
    const lx = currentCX + bubbleSway - halfGrip + effortL + presentLean;
    const ly = gripY + effortL;
    const rx = currentCX + bubbleSway + halfGrip + effortR + presentLean;
    const ry = gripY + effortR;
    leftArmPath = getArmPath(lx, ly, false);
    rightArmPath = getArmPath(rx, ry, true);
  }

  let leftLegX: number, rightLegX: number, legY2: number;
  if (isWalking) {
    leftLegX = currentCX - walkCycle * (20 * scale);
    rightLegX = currentCX + walkCycle * (20 * scale);
    legY2 = (290 * scale) - Math.max(0, walkCycle * (8 * scale));
  } else {
    const shift = Math.sin(frame * 0.05) * (3 * scale);
    leftLegX = currentCX - (15 * scale) + shift;
    rightLegX = currentCX + (15 * scale) + shift;
    legY2 = (290 * scale);
  }
  // Apply verticalShift to legY2
  legY2 += verticalShift;

  const renderLimbs = (sw: number, op?: number) => (
    <>
      <circle cx={currentCX} cy={headY} r={26 * scale} fill="none" stroke={stroke} strokeWidth={sw} strokeOpacity={op} strokeDasharray={dash} strokeDashoffset={offset} />
      <line x1={shoulderX} y1={bodyStartY} x2={currentCX + presentLean} y2={bodyEndY} stroke={stroke} strokeWidth={sw} strokeOpacity={op} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={leftArmPath} fill="none" stroke={stroke} strokeWidth={sw} strokeOpacity={op} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={rightArmPath} fill="none" stroke={stroke} strokeWidth={sw} strokeOpacity={op} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={`M${currentCX + presentLean},${bodyEndY} L${leftLegX},${legY2}`} fill="none" stroke={stroke} strokeWidth={sw} strokeOpacity={op} strokeDasharray={dash} strokeDashoffset={offset} />
      <path d={`M${currentCX + presentLean},${bodyEndY} L${rightLegX},${legY2}`} fill="none" stroke={stroke} strokeWidth={sw} strokeOpacity={op} strokeDasharray={dash} strokeDashoffset={offset} />
    </>
  );

  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* Dynamic stroke width: thicker for portrait */}
      {renderLimbs(portrait ? 12 : 9, 0.18)}
      {renderLimbs(portrait ? 6 : 4.5, undefined)}
    </g>
  );
}

function estimateBubbleHeight(text: string, fontSize: number, innerW: number): number {
  // Rough estimation, adjust char width for scaled innerW
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
  return Math.max(72, lines * (fontSize * 1.45) + 32);
}

interface BubbleProps {
  anchorX: number;
  topY: number;
  side: "left" | "right";
  text: string;
  textColor: string;
  fill?: string;
  progress: number;
  fontSize: number;
  swayX?: number;
  swayY?: number;
  portrait: boolean;
  fontFamily?: string;
  figureScale: number; // Add scale prop for bubble
}

function SpeechBubble({
  anchorX,
  topY,
  side,
  text,
  textColor,
  fill = "rgba(255,255,255,0.92)",
  progress,
  fontSize,
  swayX = 0,
  swayY = 0,
  portrait,
  fontFamily,
  figureScale, // Use the passed scale
}: BubbleProps) {
  const innerW = 210 * figureScale; // Scale inner content width
  const hContent = estimateBubbleHeight(text, fontSize, innerW);
  const tailH = 24 * figureScale; // Scale tail height
  const bubblePadding = 28 * figureScale; // Scale padding
  const bW = innerW + bubblePadding;
  const bH = hContent;
  const bX = (side === "left" ? anchorX - (20 * figureScale) : anchorX - bW + (20 * figureScale)) + swayX; // Scale offsets
  const tY = topY + swayY;
  const r = 16 * figureScale; // Scale border radius

  const bPath = [
    `M ${bX + r},${tY + 1}`,
    `Q ${bX + bW / 2},${tY - 1} ${bX + bW - r},${tY + 2}`,
    `Q ${bX + bW + 1},${tY} ${bX + bW + 1},${tY + r}`,
    `Q ${bX + bW + 2},${tY + bH / 2} ${bX + bW},${tY + bH - r}`,
    `Q ${bX + bW + 1},${tY + bH + 1} ${bX + bW - r},${tY + bH}`,
    `Q ${bX + bW / 2},${tY + bH + 2} ${bX + r},${tY + bH - 1}`,
    `Q ${bX - 1},${tY + bH} ${bX},${tY + bH - r}`,
    `Q ${bX - 2},${tY + bH / 2} ${bX + 1},${tY + r}`,
    `Q ${bX},${tY - 1} ${bX + r},${tY + 1} Z`,
  ].join(" ");

  const tailMidX = side === "left" ? bX + (40 * figureScale) : bX + bW - (40 * figureScale); // Scale tail position
  const tailPath = `M ${tailMidX - (14 * figureScale)},${tY + bH} Q ${tailMidX},${tY + bH + tailH} Q ${tailMidX + (14 * figureScale)},${tY + bH} Z`; // Scale tail dimensions

  const dash = 900 * figureScale; // Scale dash array for drawing animation
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
          {/* Dynamic stroke width: thicker for portrait */}
          <path d={bPath} fill={fill} stroke={textColor} strokeWidth={portrait ? 11 : 8} strokeOpacity={0.18} strokeLinejoin="round" strokeLinecap="round" />
          <path d={bPath} fill={fill} stroke={textColor} strokeWidth={portrait ? 5 : 3.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={off} />
          <path d={tailPath} fill={fill} stroke={textColor} strokeWidth={portrait ? 5 : 3.5} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <foreignObject x={bX + (14 * figureScale)} y={tY + (10 * figureScale)} width={innerW} height={hContent - (16 * figureScale)} opacity={Math.min(progress * 2.5, 1)}>
          <div style={{ color: textColor, fontSize: fontSize, fontWeight: 600, fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif", lineHeight: 1.45, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", boxSizing: "border-box", wordBreak: "break-word" }}>
            {visText}
            {visChars < text.length && <span style={{ opacity: 0.35 }}>|</span>}
          </div>
        </foreignObject>
      </g>
    </>
  );
}

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
  fontFamily,
  stats,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const figureScale = p ? 1 : 0.75; // Define scale for landscape mode

  const figDash = 500;
  const figOff = figDash * (1 - interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" }));

  const leftBubbleProgress = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: "clamp" });
  const rightBubbleProgress = interpolate(frame, [72, 100], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [85, 105], [0, 1], { extrapolateRight: "clamp" });
  const labelOp = interpolate(frame, [25, 35], [0, 1], { extrapolateRight: "clamp" });

  const svgW = 700;
  const groundY = 308; // Y-coordinate for the ground line
  const labelY = groundY + 28; // Labels below the ground
  const leftCX = 240;
  const rightCX = 460;
  const fontSize = descriptionFontSize ?? (p ? 30 : 19); // Keep fontSize as is, it's user-configurable

  // Scale bubble dimensions in the parent
  const bubbleInnerW = 210 * figureScale;
  const bubblePadding = 28 * figureScale;
  const bubbleTotalWidth = bubbleInnerW + bubblePadding; // This is the total width of the bubble itself
  const tailH = 24 * figureScale; // Scaled tail height

  // --- Calculations for figure and bubble positioning relative to the ground ---
  const stickFigureBaseHeight = 290; // The total height of the stick figure from its internal Y=0 to its feet
  const stickFigureHeadCenterYFromOrigin = 60; // Head center Y from stick figure's internal Y=0
  const stickFigureHeadRadius = 26; // Radius of the head

  // Calculate the actual Y-coordinate of the top of the stick figure's head when its feet are on groundY
  const figureHeadTopY = groundY - (stickFigureBaseHeight * figureScale) + (stickFigureHeadCenterYFromOrigin * figureScale) - (stickFigureHeadRadius * figureScale);

  // Use this new figureHeadTopY for bubble positioning
  const bubbleGap = 12 * figureScale; // Scaled gap between head and bubble

  const leftBH = estimateBubbleHeight(leftThought, fontSize, bubbleInnerW); // Estimate height with scaled innerW
  const rightBH = estimateBubbleHeight(rightThought, fontSize, bubbleInnerW); // Estimate height with scaled innerW

  const leftBubbleTopY = figureHeadTopY - leftBH - tailH - bubbleGap;
  const rightBubbleTopY = figureHeadTopY - rightBH - tailH - bubbleGap;

  const presentProgress = interpolate(frame, [55, 75], [0, 1], { extrapolateRight: "clamp" });
  const leftSwayRaw = Math.sin(frame * 0.065) * 9 + Math.sin(frame * 0.031) * 4;
  const leftSwayY = Math.sin(frame * 0.09 + 0.5) * 4 + Math.cos(frame * 0.04) * 2;
  const rightSwayRaw = Math.sin(frame * 0.078 + Math.PI * 0.6) * 8 + Math.sin(frame * 0.041 + 1) * 3.5;
  const rightSwayY = Math.sin(frame * 0.11 + 2) * 3.5 + Math.cos(frame * 0.05 + 0.8) * 2.5;

  // Scale sway amplitudes
  const leftSway = leftSwayRaw * presentProgress * figureScale;
  const rightSway = rightSwayRaw * presentProgress * figureScale;
  const leftSwayYFinal = leftSwayY * presentProgress * figureScale;
  const rightSwayYFinal = rightSwayY * presentProgress * figureScale;

  // Calculate the bubble's bottom Y coordinate for the stick figure's arms to grip
  const leftBubbleBottomY = leftBubbleTopY + leftBH + leftSwayYFinal;
  const rightBubbleBottomY = rightBubbleTopY + rightBH + rightSwayYFinal;

  const leftSpeaker = stats?.[0]?.label ?? "Person A";
  const rightSpeaker = stats?.[1]?.label ?? "Person B";

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        letterSpacing: "1.5px",
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />
      {p && <BackgroundScribbles color={textColor} />}

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
        <rect width="100%" height="100%" filter="url(#grain)" fill="none" />
      </svg>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: p ? 14 : 18, padding: p ? "4% 4%" : "12% 7% 3% 7%" }}> {/* Landscape padding: 12% top */}
        <svg viewBox={`0 0 ${svgW} ${labelY + 10}`} style={{ width: p ? "96%" : "80%", maxWidth: 880, height: "auto", overflow: "visible" }} fill="none">
          <defs>
            <filter id="inkFigs" x="-4%" y="-4%" width="108%" height="108%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="29" result="w" />
              <feDisplacementMap in="SourceGraphic" in2="w" scale="2.8" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>

          <g filter="url(#inkFigs)">
            {/* Thicker ground line for portrait */}
            <line x1={20} y1={groundY} x2={680} y2={groundY - 2} stroke={textColor} strokeWidth={p ? 9 : 6} strokeOpacity={0.18} strokeLinecap="round" />
            <line x1={20} y1={groundY} x2={680} y2={groundY - 2} stroke={textColor} strokeWidth={p ? 4.5 : 3} strokeLinecap="round" />
          </g>

          <SpeechBubble anchorX={leftCX} topY={leftBubbleTopY} side="right" text={leftThought} textColor={textColor} progress={leftBubbleProgress} fontSize={fontSize} swayX={leftSway} swayY={leftSwayYFinal} portrait={p} fontFamily={fontFamily} figureScale={figureScale} />
          <SpeechBubble anchorX={rightCX} topY={rightBubbleTopY} side="left" text={rightThought} textColor={accentColor} progress={rightBubbleProgress} fontSize={fontSize} swayX={rightSway} swayY={rightSwayYFinal} portrait={p} fontFamily={fontFamily} figureScale={figureScale} />

          <StickFigure cx={leftCX} dash={figDash} offset={figOff} stroke={textColor} isRight={false} bubbleBottomY={leftBubbleBottomY} bubbleWidth={bubbleTotalWidth} bubbleSway={leftSway} portrait={p} groundY={groundY} />
          <StickFigure cx={rightCX} dash={figDash} offset={figOff} stroke={accentColor} isRight={true} bubbleBottomY={rightBubbleBottomY} bubbleWidth={bubbleTotalWidth} bubbleSway={rightSway} portrait={p} groundY={groundY} />

          <text x={leftCX} y={labelY} textAnchor="middle" fill={textColor} fontSize={18} fontFamily={fontFamily ?? "'Patrick Hand', system-ui, sans-serif"} fontWeight="700" opacity={labelOp}>{leftSpeaker}</text>
          <text x={rightCX} y={labelY} textAnchor="middle" fill={accentColor} fontSize={18} fontFamily={fontFamily ?? "'Patrick Hand', system-ui, sans-serif"} fontWeight="700" opacity={labelOp}>{rightSpeaker}</text>

          {[0, 1, 2].map((dot) => {
            const dotOp = interpolate(frame, [60 + dot * 4, 68 + dot * 4], [0, 1], { extrapolateRight: "clamp" });
            return <circle key={dot} cx={svgW / 2 - (22 * figureScale) + dot * (22 * figureScale)} cy={160 * figureScale} r={7 * figureScale} fill={textColor} fillOpacity={dotOp * 0.45} />;
          })}
        </svg>

        <div style={{ textAlign: "center", opacity: titleOp }}>
          <div style={{ color: textColor, fontWeight: 700, fontSize: titleFontSize ?? (p ? 72 : 37), lineHeight: 1.1, filter: "url(#ink)" }}>{title}</div>
          {narration && <div style={{ marginTop: 8, color: textColor, fontSize: descriptionFontSize ?? (p ? 30 : 19), opacity: 0.88, filter: "url(#ink)" }}>{narration}</div>}
        </div>
      </div>
    </AbsoluteFill>
  );
};
