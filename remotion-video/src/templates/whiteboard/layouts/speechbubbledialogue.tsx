import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
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
  portrait, // Receive portrait state for thicker lines
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
}) {
  const frame = useCurrentFrame();

  const walkProgress = interpolate(frame, [0, 25], [isRight ? 60 : -60, 0], {
    extrapolateRight: "clamp",
  });
  const isWalking = frame < 25;
  const isGreeting = frame >= 25 && frame < 55;
  const isPresenting = frame >= 55;

  const walkCycle = Math.sin(frame * 0.4);
  const bob = isWalking
    ? Math.abs(Math.cos(frame * 0.4)) * 10
    : Math.sin(frame * 0.08) * 4;

  const currentCX = cx + walkProgress;
  const presentLean = isPresenting ? Math.sin(frame * 0.07) * 3 : 0;

  const headY = 60 - bob;
  const bodyStartY = 88 - bob;
  const bodyEndY = 188 - bob;
  const armBaseY = 114 - bob;
  const shoulderX = currentCX + presentLean * 0.3;

  const getArmPath = (targetX: number, targetY: number, bendRight: boolean) => {
    const upperArmLen = 42;
    const foreArmLen = 42;
    const dx = targetX - shoulderX;
    const dy = targetY - armBaseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const d = Math.min(dist, upperArmLen + foreArmLen - 1);
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
    const lx = currentCX - walkCycle * 25;
    const ly = armBaseY + 40;
    const rx = currentCX + walkCycle * 25;
    const ry = armBaseY + 40;
    leftArmPath = `M${shoulderX},${armBaseY} L${lx},${ly}`;
    rightArmPath = `M${shoulderX},${armBaseY} L${rx},${ry}`;
  } else if (isGreeting) {
    const wave = Math.sin(frame * 0.3);
    if ((isRight ? "left" : "right") === "left") {
      leftArmPath = `M${shoulderX},${armBaseY} L${currentCX - 45},${armBaseY - 30 + wave * 20}`;
      rightArmPath = `M${shoulderX},${armBaseY} L${currentCX + 20},${armBaseY + 50}`;
    } else {
      leftArmPath = `M${shoulderX},${armBaseY} L${currentCX - 20},${armBaseY + 50}`;
      rightArmPath = `M${shoulderX},${armBaseY} L${currentCX + 45},${armBaseY - 30 + wave * 20}`;
    }
  } else {
    const halfGrip = bubbleWidth * 0.38;
    const gripY = bubbleBottomY - bob + 6;
    const effortL = Math.sin(frame * 0.13 + 1.2) * 2.5;
    const effortR = Math.sin(frame * 0.11 + 0.4) * 2.5;
    const lx = currentCX + bubbleSway - halfGrip + effortL + presentLean;
    const ly = gripY + effortL;
    const rx = currentCX + bubbleSway + halfGrip + effortR + presentLean;
    const ry = gripY + effortR;
    leftArmPath = getArmPath(lx, ly, false);
    rightArmPath = getArmPath(rx, ry, true);
  }

  let leftLegX: number, rightLegX: number, legY2: number;
  if (isWalking) {
    leftLegX = currentCX - walkCycle * 20;
    rightLegX = currentCX + walkCycle * 20;
    legY2 = 290 - Math.max(0, walkCycle * 8);
  } else {
    const shift = Math.sin(frame * 0.05) * 3;
    leftLegX = currentCX - 15 + shift;
    rightLegX = currentCX + 15 + shift;
    legY2 = 290;
  }

  const renderLimbs = (sw: number, op?: number) => (
    <>
      <circle cx={currentCX} cy={headY} r={26} fill="none" stroke={stroke} strokeWidth={sw} strokeOpacity={op} strokeDasharray={dash} strokeDashoffset={offset} />
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
}: BubbleProps) {
  const innerW = 210;
  const hContent = estimateBubbleHeight(text, fontSize, innerW);
  const tailH = 24;
  const bW = innerW + 28;
  const bH = hContent;
  const bX = (side === "left" ? anchorX - 20 : anchorX - bW + 20) + swayX;
  const tY = topY + swayY;
  const r = 16;

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

  const tailMidX = side === "left" ? bX + 40 : bX + bW - 40;
  const tailPath = `M ${tailMidX - 14},${tY + bH} Q ${tailMidX},${tY + bH + tailH} Q ${tailMidX + 14},${tY + bH} Z`;

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
          {/* Dynamic stroke width: thicker for portrait */}
          <path d={bPath} fill={fill} stroke={textColor} strokeWidth={portrait ? 11 : 8} strokeOpacity={0.18} strokeLinejoin="round" strokeLinecap="round" />
          <path d={bPath} fill={fill} stroke={textColor} strokeWidth={portrait ? 5 : 3.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={off} />
          <path d={tailPath} fill={fill} stroke={textColor} strokeWidth={portrait ? 5 : 3.5} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <foreignObject x={bX + 14} y={tY + 10} width={innerW} height={hContent - 16} opacity={Math.min(progress * 2.5, 1)}>
          <div style={{ color: textColor, fontSize: fontSize, fontWeight: 600, fontFamily: "'Patrick Hand', system-ui, sans-serif", lineHeight: 1.45, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", boxSizing: "border-box", wordBreak: "break-word" }}>
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
  stats,
}) => {
  const frame = useCurrentFrame();
  const { width: videoWidth } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const scale = videoWidth / 1920;

  const figDash = 500;
  const figOff = figDash * (1 - interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" }));

  const leftBubbleProgress = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: "clamp" });
  const rightBubbleProgress = interpolate(frame, [72, 100], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [85, 105], [0, 1], { extrapolateRight: "clamp" });
  const labelOp = interpolate(frame, [25, 35], [0, 1], { extrapolateRight: "clamp" });

  const svgW = 700;
  const groundY = 308;
  const labelY = groundY + 28;
  const leftCX = 240;
  const rightCX = 460;
  const fontSize = p ? 17 : 21;

  const leftBH = estimateBubbleHeight(leftThought, fontSize, 210);
  const rightBH = estimateBubbleHeight(rightThought, fontSize, 210);
  const tailH = 24;
  const figHeadTopY = 34;
  const bubbleGap = 12;
  const leftBubbleTopY = figHeadTopY - leftBH - tailH - bubbleGap;
  const rightBubbleTopY = figHeadTopY - rightBH - tailH - bubbleGap;

  const presentProgress = interpolate(frame, [55, 75], [0, 1], { extrapolateRight: "clamp" });
  const leftSwayRaw = Math.sin(frame * 0.065) * 9 + Math.sin(frame * 0.031) * 4;
  const leftSwayY = Math.sin(frame * 0.09 + 0.5) * 4 + Math.cos(frame * 0.04) * 2;
  const rightSwayRaw = Math.sin(frame * 0.078 + Math.PI * 0.6) * 8 + Math.sin(frame * 0.041 + 1) * 3.5;
  const rightSwayY = Math.sin(frame * 0.11 + 2) * 3.5 + Math.cos(frame * 0.05 + 0.8) * 2.5;

  const leftSway = leftSwayRaw * presentProgress;
  const rightSway = rightSwayRaw * presentProgress;
  const leftSwayYFinal = leftSwayY * presentProgress;
  const rightSwayYFinal = rightSwayY * presentProgress;

  const bubbleWidth = 238;
  const leftSpeaker = stats?.[0]?.label ?? "Person A";
  const rightSpeaker = stats?.[1]?.label ?? "Person B";

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: "'Patrick Hand', system-ui, sans-serif", letterSpacing: "1.5px" }}>
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
        <svg viewBox={`0 0 ${svgW} ${labelY + 10}`} style={{ width: p ? "96%" : "80%", maxWidth: 880 * scale, height: "auto", overflow: "visible" }} fill="none">
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

          <SpeechBubble anchorX={leftCX} topY={leftBubbleTopY} side="right" text={leftThought} textColor={textColor} progress={leftBubbleProgress} fontSize={fontSize} swayX={leftSway} swayY={leftSwayYFinal} portrait={p} />
          <SpeechBubble anchorX={rightCX} topY={rightBubbleTopY} side="left" text={rightThought} textColor={accentColor} progress={rightBubbleProgress} fontSize={fontSize} swayX={rightSway} swayY={rightSwayYFinal} portrait={p} />

          <StickFigure cx={leftCX} dash={figDash} offset={figOff} stroke={textColor} isRight={false} bubbleBottomY={leftBubbleTopY + leftBH + leftSwayYFinal} bubbleWidth={bubbleWidth} bubbleSway={leftSway} portrait={p} />
          <StickFigure cx={rightCX} dash={figDash} offset={figOff} stroke={accentColor} isRight={true} bubbleBottomY={rightBubbleTopY + rightBH + rightSwayYFinal} bubbleWidth={bubbleWidth} bubbleSway={rightSway} portrait={p} />

          <text x={leftCX} y={labelY} textAnchor="middle" fill={textColor} fontSize={18} fontFamily="'Patrick Hand', system-ui, sans-serif" fontWeight="700" opacity={labelOp}>{leftSpeaker}</text>
          <text x={rightCX} y={labelY} textAnchor="middle" fill={accentColor} fontSize={18} fontFamily="'Patrick Hand', system-ui, sans-serif" fontWeight="700" opacity={labelOp}>{rightSpeaker}</text>

          {[0, 1, 2].map((dot) => {
            const dotOp = interpolate(frame, [60 + dot * 4, 68 + dot * 4], [0, 1], { extrapolateRight: "clamp" });
            return <circle key={dot} cx={svgW / 2 - 22 + dot * 22} cy={160} r={7} fill={textColor} fillOpacity={dotOp * 0.45} />;
          })}
        </svg>

        <div style={{ textAlign: "center", opacity: titleOp }}>
          <div style={{ color: textColor, fontWeight: 700, fontSize: titleFontSize ?? (p ? 42 * scale : 54 * scale), lineHeight: 1.1, filter: "url(#ink)" }}>{title}</div>
          {narration && <div style={{ marginTop: 8, color: textColor, fontSize: descriptionFontSize ?? (p ? 22 * scale : 26 * scale), opacity: 0.88, filter: "url(#ink)" }}>{narration}</div>}
        </div>
      </div>
    </AbsoluteFill>
  );
};