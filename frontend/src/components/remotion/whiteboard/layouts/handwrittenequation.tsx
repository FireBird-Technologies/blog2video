import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

const DEFAULT_STEPS = [
  { label: "Compound Interest Formula", value: "A = P · (1 + r/n)^(n·t)" },
  { label: "Where:", value: "P = principal,  r = rate,  n = compounds/yr,  t = years" },
  { label: "Example:", value: "A = 1000 · (1 + 0.05/12)^(12·5)" },
  { label: "Result:", value: "A ≈ $1,283.36" },
];

const STEP_DURATION = 22;
const STEP_GAP = 8;

export const HandwrittenEquation: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize: descPropSize, // Renamed for scaling logic
  stats: statsProp,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const steps = statsProp?.length ? statsProp : DEFAULT_STEPS;
  const maxSteps = Math.min(steps.length, 5);
  const displaySteps = steps.slice(0, maxSteps);

  // === TEXT SCALING LOGIC ===
  const baseDescSize = p ? 22 : 28;
  const finalDescSize = descPropSize ?? baseDescSize;
  const scaleF = finalDescSize / baseDescSize;

  // Title fades in at start
  const titleOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  const stepStartFrame = (i: number) => 16 + i * (STEP_DURATION + STEP_GAP);

  const lastStepStart = stepStartFrame(displaySteps.length - 1);
  const boxProgress = interpolate(frame, [lastStepStart + STEP_DURATION, lastStepStart + STEP_DURATION + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === STICKMAN ANIMATION MATH ===
  // Ball bounce physics
  const bouncePeriod = 30; // frames per bounce
  const bounceFrame = frame % bouncePeriod;
  const t = bounceFrame / bouncePeriod; // 0 to 1 over one bounce

  // Ball visuals
  const ballApexHeight = 70; // Even taller apex
  const ballYVisual = 130 - ballApexHeight * (1 - 4 * (t - 0.5) ** 2); // 130 is "floor"

  // Hand follows
  const handLag = 0.12; 
  const handApexHeight = 50;
  const tHand = (t + handLag) % 1;
  const handYVisual = 130 - 20 - handApexHeight * (1 - 4 * (tHand - 0.5) ** 2); // 20 offset from floor

  // Minimal body bob
  const bodyBob = Math.sin(frame * 0.08) * 2.5;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive",
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      {/* Background noise/texture */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.055" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink" x="-3%" y="-8%" width="106%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="5" seed="41" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain)" fill="white" />
      </svg>

      {/* Guide lines */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={i}
            x1="4%" y1={`${(i + 1) * 11}%`} x2="96%" y2={`${(i + 1) * 11}%`}
            stroke={textColor}
            strokeWidth="0.8"
            strokeOpacity="0.06"
          />
        ))}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "7% 8%" : "5% 9%",
          gap: p ? 12 : 16,
        }}
      >
        {/* Title and description group */}
        <div style={{ opacity: titleOp }}>
          <div
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 52 : 64),
              lineHeight: 1.05,
              filter: "url(#ink)",
            }}
          >
            {title}
          </div>
          {narration && (
            <div
              style={{
                marginTop: 6,
                color: textColor,
                fontSize: finalDescSize, 
                opacity: 0.85,
                filter: "url(#ink)",
              }}
            >
              {narration}
            </div>
          )}

          <svg style={{ display: "block", width: "100%", height: 10, marginTop: 10 }} viewBox="0 0 800 10" preserveAspectRatio="none">
            <defs>
              <filter id="inkUnder">
                <feTurbulence type="fractalNoise" baseFrequency="0.04 0.3" numOctaves="3" seed="5" result="w" />
                <feDisplacementMap in="SourceGraphic" in2="w" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <path d="M0,5 Q200,3 400,6 Q600,9 800,4" fill="none" stroke={textColor} strokeWidth={6} strokeOpacity={0.18} strokeLinecap="round" filter="url(#inkUnder)" strokeDasharray={900} strokeDashoffset={900 * (1 - titleOp)} />
            <path d="M0,5 Q200,3 400,6 Q600,9 800,4" fill="none" stroke={textColor} strokeWidth={3} strokeLinecap="round" filter="url(#inkUnder)" strokeDasharray={900} strokeDashoffset={900 * (1 - titleOp)} />
          </svg>
        </div>

        {/* Steps Container */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: (p ? 14 : 18) * scaleF, 
          }}
        >
          {displaySteps.map((step, i) => {
            const startF = stepStartFrame(i);
            const progress = interpolate(frame, [startF, startF + STEP_DURATION], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const isLast = i === displaySteps.length - 1;
            const lineProgress = interpolate(frame, [startF, startF + STEP_DURATION * 0.6], [0, 1], { extrapolateRight: "clamp" });
            const visChars = Math.floor(step.value.length * progress);

            return (
              <div
                key={i}
                style={{
                  opacity: progress > 0.01 ? 1 : 0,
                  position: "relative",
                }}
              >
                {/* Step Label */}
                <div
                  style={{
                    color: textColor,
                    fontSize: (p ? 16 : 20) * scaleF, 
                    fontWeight: 600,
                    opacity: Math.min(progress * 3, 0.6),
                    marginBottom: 3 * scaleF, 
                    letterSpacing: "0.02em",
                    filter: "url(#ink)",
                  }}
                >
                  {step.label}
                </div>

                {/* Step Value / Equation */}
                <div
                  style={{
                    position: "relative",
                    display: "inline-block",
                    padding: isLast ? `${6 * scaleF}px ${14 * scaleF}px` : "0", 
                  }}
                >
                  {/* Highlighting box for the last step */}
                  {isLast && (
                    <svg
                      style={{ 
                        position: "absolute", 
                        inset: -8 * scaleF, 
                        width: `calc(100% + ${16 * scaleF}px)`, 
                        height: `calc(100% + ${16 * scaleF}px)`, 
                        overflow: "visible", 
                        pointerEvents: "none" 
                      }}
                      fill="none"
                      viewBox="0 0 300 60"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <filter id="inkBox" x="-5%" y="-10%" width="110%" height="120%">
                          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.025" numOctaves="4" seed="44" result="w" />
                          <feDisplacementMap in="SourceGraphic" in2="w" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
                        </filter>
                      </defs>
                      <g filter="url(#inkBox)" strokeLinecap="round" strokeLinejoin="round">
                        <rect x={3} y={3} width={294} height={54} rx={12} stroke={accentColor} strokeWidth={9 * scaleF} strokeOpacity={0.22} strokeDasharray={800} strokeDashoffset={800 * (1 - boxProgress)} />
                        <rect x={3} y={3} width={294} height={54} rx={12} stroke={accentColor} strokeWidth={4 * scaleF} strokeDasharray={800} strokeDashoffset={800 * (1 - boxProgress)} />
                      </g>
                    </svg>
                  )}

                  <div
                    style={{
                      color: isLast ? accentColor : textColor,
                      fontSize: (p ? (isLast ? 32 : 26) : (isLast ? 40 : 32)) * scaleF, 
                      fontWeight: isLast ? 800 : 600,
                      lineHeight: 1.3,
                      filter: "url(#ink)",
                      fontFamily: "'Comic Sans MS', 'Segoe Print', cursive",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {step.value.slice(0, visChars)}
                    {visChars < step.value.length && (
                      <span style={{ opacity: 0.35 }}>|</span>
                    )}
                  </div>
                </div>

                {/* Arrow pointing to the next step */}
                {!isLast && (
                  <svg
                    style={{ 
                      display: "block", 
                      width: (p ? 36 : 44) * scaleF, 
                      height: (p ? 20 : 26) * scaleF, 
                      marginTop: 2 * scaleF, 
                      marginLeft: 12 * scaleF 
                    }}
                    viewBox="0 0 44 26"
                    fill="none"
                  >
                    <defs>
                      <filter id={`inkArr${i}`}>
                        <feTurbulence type="fractalNoise" baseFrequency="0.06 0.1" numOctaves="3" seed={i + 50} result="w" />
                        <feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G" />
                      </filter>
                    </defs>
                    <g filter={`url(#inkArr${i})`} opacity={lineProgress} strokeLinecap="round" strokeLinejoin="round">
                      <line x1={4} y1={13} x2={36} y2={13} stroke={textColor} strokeWidth={5 * scaleF} strokeOpacity={0.2} />
                      <line x1={4} y1={13} x2={36} y2={13} stroke={textColor} strokeWidth={2.5 * scaleF} />
                      <path d="M28,6 L38,13 L28,20" stroke={textColor} strokeWidth={5 * scaleF} strokeOpacity={0.2} fill="none" />
                      <path d="M28,6 L38,13 L28,20" stroke={textColor} strokeWidth={2.5 * scaleF} fill="none" />
                    </g>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* === TALL STICKMAN AT BOTTOM-RIGHT === */}
      <AbsoluteFill style={{
        top: 'auto', left: 'auto',
        right: p ? '4%' : '5%', 
        bottom: p ? '8%' : '15%', // Pushed right to the ground edge
        width: 170 * scaleF, // Very wide area
        height: 260 * scaleF, // Very tall area
        filter: "url(#ink)",
        opacity: titleOp * 0.9, // Higher opacity for the full dark line effect
      }}>
        {/* Taller viewbox for extra height */}
        <svg viewBox="0 0 100 200" style={{ display: 'block', width: '100%', height: '100%' }}>
          <g transform={`translate(50, 100)`}> 
            {/* The main stickman group, now flipped to face left */}
            <g transform={`translate(0, ${bodyBob}) scale(-1, 1)`}>
              
              {/* Head (facing right now in this group) */}
              <circle cx={0} cy={-75} r={17} stroke={textColor} strokeWidth={6 * scaleF} fill="none" />
              
              {/* Body - Very long torso for height, facing right */}
              <path d="M0, -58 L-4, 5 L18, 50" fill="none" stroke={textColor} strokeWidth={6 * scaleF} strokeLinecap="round"/>
              
              {/* Left-side arm (visual right now due to scale) - Passive */}
              <path d="M-2, -15 L-25, 0" fill="none" stroke={textColor} strokeWidth={5 * scaleF} strokeLinecap="round" />
              
              {/* Right-side arm (visual left due to scale) - The Bouncing Hand */}
              <g transform={`translate(0, ${-bodyBob})`}>
                <path d={`M-2, -15 L25, 5 L35, ${handYVisual - 100}`} fill="none" stroke={textColor} strokeWidth={5 * scaleF} strokeLinecap="round" />
              </g>

              {/* Legs - Planted firmly ON THE GROUND (y=90 visual floor in g transform) */}
              <path d="M18,50 L14, 90" fill="none" stroke={textColor} strokeWidth={6 * scaleF} strokeLinecap="round" />
              <path d="M18,50 L26, 90" fill="none" stroke={textColor} strokeWidth={6 * scaleF} strokeLinecap="round" />
            </g>
            
            {/* Ball - visual left, hitting floor at y=90 */}
            <circle cx={-38} cy={ballYVisual - 100} r={15} fill={accentColor} filter="url(#inkBox)" stroke={textColor} strokeWidth={1} />
            
            {/* Solid, bold ground line stickman stands on */}
            <line x1={-60} y1={55} x2={40} y2={55} stroke={textColor} strokeWidth={4 * scaleF} strokeLinecap="round" />
          </g>
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};