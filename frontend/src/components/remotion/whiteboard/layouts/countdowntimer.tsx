import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

/**
 * CountdownTimer
 *
 * A dramatic hand-drawn countdown. Each number is displayed with:
 *  - A shrinking circular progress ring (ink/marker style)
 *  - The number "popping" in with a quick scale animation
 *  - Tick marks around the ring
 *  - Optional label below
 *
 * Props:
 *  - title: label shown above the timer
 *  - narration: label shown below (e.g. "until launch")
 *  - stats[0].value: start count (default "5"), must be a number string
 *  - accentColor: ring and number color
 *  - textColor: text and tick color
 */

const FRAMES_PER_COUNT = 20; // how many frames each count lasts

export const CountdownTimer: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  stats,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const startCount = parseInt(stats?.[0]?.value ?? "5", 10) || 5;
  const clampedStart = Math.min(Math.max(startCount, 2), 9);

  const totalFrames = clampedStart * FRAMES_PER_COUNT;
  const elapsed = Math.min(frame, totalFrames);

  // Current count number
  const countIndex = Math.floor(elapsed / FRAMES_PER_COUNT);
  const currentCount = clampedStart - countIndex;
  const frameWithinCount = elapsed % FRAMES_PER_COUNT;

  // Ring progress: drains from full to empty each count
  const ringProgress = 1 - frameWithinCount / FRAMES_PER_COUNT;

  // Number pop-in scale
  const numScale = interpolate(frameWithinCount, [0, 5, 10], [0.4, 1.18, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Global fade in
  const globalOp = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  // Ring dimensions
  const ringR = p ? 110 : 140;
  const ringCX = p ? 175 : 220;
  const ringCY = p ? 175 : 220;
  const ringStroke = 14;
  const circumference = 2 * Math.PI * ringR;

  // Tick marks around the ring
  const tickCount = clampedStart * 4;
  const tickOuter = ringR + 26;
  const tickInner = ringR + 12;

  // Color shifts: starts with accentColor, turns red as it approaches 0
  const urgencyRed = currentCount <= 2 ? `#e53e3e` : accentColor;

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
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="53" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkRing" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="4" seed="57" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
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
          gap: p ? 20 : 28,
          padding: p ? "6% 6%" : "5% 8%",
          opacity: globalOp,
        }}
      >
        {/* Title */}
        {title && (
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 48 : 60),
              lineHeight: 1.1,
              textAlign: "center",
              filter: "url(#ink)",
            }}
          >
            {title}
          </div>
        )}

        {/* Timer ring + number */}
        <svg
          viewBox={`0 0 ${ringCX * 2} ${ringCY * 2}`}
          style={{ width: p ? "60%" : "38%", maxWidth: p ? 320 : 440, height: "auto", overflow: "visible" }}
          fill="none"
        >
          {/* Track ring (background) */}
          <g filter="url(#inkRing)">
            <circle
              cx={ringCX}
              cy={ringCY}
              r={ringR}
              stroke={textColor}
              strokeWidth={ringStroke + 5}
              strokeOpacity={0.08}
              fill="none"
            />
            <circle
              cx={ringCX}
              cy={ringCY}
              r={ringR}
              stroke={textColor}
              strokeWidth={2.5}
              strokeOpacity={0.2}
              fill="none"
              strokeDasharray="4 10"
            />
          </g>

          {/* Tick marks — evenly spaced */}
          <g filter="url(#inkRing)">
            {Array.from({ length: tickCount }).map((_, ti) => {
              const angle = (ti / tickCount) * 2 * Math.PI - Math.PI / 2;
              const ox = ringCX + Math.cos(angle) * tickOuter;
              const oy = ringCY + Math.sin(angle) * tickOuter;
              const ix = ringCX + Math.cos(angle) * tickInner;
              const iy = ringCY + Math.sin(angle) * tickInner;
              const isSecond = ti % 4 === 0;
              // Highlight ticks that have passed
              const tickFraction = ti / tickCount;
              const elapsed_fraction = 1 - ringProgress + countIndex / clampedStart;
              const passed = tickFraction < (1 - ringProgress + (1 / clampedStart) * Math.floor(elapsed / FRAMES_PER_COUNT));
              return (
                <g key={ti}>
                  <line x1={ox} y1={oy} x2={ix} y2={iy} stroke={textColor} strokeWidth={isSecond ? 5 : 3} strokeOpacity={0.14} strokeLinecap="round" />
                  <line x1={ox} y1={oy} x2={ix} y2={iy} stroke={passed ? urgencyRed : textColor} strokeWidth={isSecond ? 2.5 : 1.5} strokeOpacity={passed ? 0.7 : 0.3} strokeLinecap="round" />
                </g>
              );
            })}
          </g>

          {/* Progress arc — active countdown ring */}
          <g filter="url(#inkRing)">
            {/* Bleed layer */}
            <circle
              cx={ringCX}
              cy={ringCY}
              r={ringR}
              stroke={urgencyRed}
              strokeWidth={ringStroke + 6}
              strokeOpacity={0.18}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ringProgress)}
              strokeLinecap="round"
              transform={`rotate(-90 ${ringCX} ${ringCY})`}
            />
            {/* Core ring */}
            <circle
              cx={ringCX}
              cy={ringCY}
              r={ringR}
              stroke={urgencyRed}
              strokeWidth={ringStroke}
              strokeOpacity={0.95}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ringProgress)}
              strokeLinecap="round"
              transform={`rotate(-90 ${ringCX} ${ringCY})`}
            />
          </g>

          {/* Center number — scale from ring center using translate→scale→untranslate */}
          <text
            x={ringCX}
            y={ringCY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={urgencyRed}
            fontSize={currentCount > 0 ? (p ? 90 : 116) : (p ? 58 : 74)}
            fontWeight={800}
            fontFamily="'Comic Sans MS', 'Segoe Print', cursive"
            filter="url(#ink)"
            transform={`translate(${ringCX}, ${ringCY}) scale(${numScale}) translate(${-ringCX}, ${-ringCY})`}
          >
            {currentCount > 0 ? currentCount : "GO!"}
          </text>

          {/* Sub-count label: "seconds" — sits below center number */}
          <text
            x={ringCX}
            y={ringCY + (p ? 58 : 72)}
            textAnchor="middle"
            fill={textColor}
            fontSize={p ? 18 : 22}
            fontFamily="'Comic Sans MS', cursive"
            fillOpacity={0.55}
          >
            {currentCount === 1 ? "second" : currentCount > 0 ? "seconds" : ""}
          </text>

          {/* Corner emphasis lines on count change */}
          {frameWithinCount < 6 && (
            <g filter="url(#inkRing)" opacity={(6 - frameWithinCount) / 6}>
              {[45, 135, 225, 315].map((angle, ai) => {
                const rad = (angle * Math.PI) / 180;
                const x1 = ringCX + Math.cos(rad) * (ringR + 32);
                const y1 = ringCY + Math.sin(rad) * (ringR + 32);
                const x2 = ringCX + Math.cos(rad) * (ringR + 50);
                const y2 = ringCY + Math.sin(rad) * (ringR + 50);
                return (
                  <g key={ai}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={urgencyRed} strokeWidth={5} strokeOpacity={0.2} strokeLinecap="round" />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={urgencyRed} strokeWidth={2.5} strokeLinecap="round" />
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* Narration / "until launch" label */}
        {narration && (
          <div
            style={{
              color: textColor,
              fontSize: descriptionFontSize ?? (p ? 26 : 32),
              fontWeight: 600,
              textAlign: "center",
              opacity: 0.85,
              filter: "url(#ink)",
            }}
          >
            {narration}
          </div>
        )}

        {/* Progress dots for each count unit */}
        <div
          style={{
            display: "flex",
            gap: p ? 10 : 13,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {Array.from({ length: clampedStart }).map((_, di) => {
            const passed = di < countIndex;
            const active = di === countIndex;
            return (
              <svg key={di} viewBox="0 0 20 20" width={p ? 16 : 20} height={p ? 16 : 20} fill="none">
                <defs>
                  <filter id={`inkDot${di}`}>
                    <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed={di + 60} result="w" />
                    <feDisplacementMap in="SourceGraphic" in2="w" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                </defs>
                <g filter={`url(#inkDot${di})`}>
                  {/* bleed */}
                  <circle cx={10} cy={10} r={7} stroke={textColor} strokeWidth={5} strokeOpacity={0.15} fill={passed || active ? urgencyRed : "none"} fillOpacity={passed ? 0.7 : active ? 0.4 : 0} />
                  {/* core */}
                  <circle cx={10} cy={10} r={7} stroke={textColor} strokeWidth={2} strokeOpacity={0.4} fill={passed ? urgencyRed : "none"} fillOpacity={0.75} />
                </g>
              </svg>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};