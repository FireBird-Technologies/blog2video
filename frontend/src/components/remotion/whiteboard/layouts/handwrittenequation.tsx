import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

/**
 * HandwrittenEquation
 *
 * Reveals a mathematical equation (or any formula/rule) step by step,
 * each line appearing left-to-right with marker stroke animation.
 * A hand-drawn box is drawn around the final answer.
 *
 * Props used:
 *  - title: e.g. "Compound Interest"
 *  - narration: context line at top
 *  - stats: array of { label, value } used as equation steps:
 *      label = step annotation (e.g. "Principal"), value = math expression (e.g. "A = P(1 + r/n)^nt")
 *    Defaults to a sample compound interest formula if not provided.
 *  - accentColor: highlight color for the final answer box
 */

const DEFAULT_STEPS = [
  { label: "Compound Interest Formula", value: "A = P · (1 + r/n)^(n·t)" },
  { label: "Where:", value: "P = principal,  r = rate,  n = compounds/yr,  t = years" },
  { label: "Example:", value: "A = 1000 · (1 + 0.05/12)^(12·5)" },
  { label: "Result:", value: "A ≈ $1,283.36" },
];

// Frames per step reveal
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
  descriptionFontSize,
  stats: statsProp,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const steps = statsProp?.length ? statsProp : DEFAULT_STEPS;
  const maxSteps = Math.min(steps.length, 5);
  const displaySteps = steps.slice(0, maxSteps);

  // Title fades in at start
  const titleOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  // Each step has a start frame
  const stepStartFrame = (i: number) => 16 + i * (STEP_DURATION + STEP_GAP);

  // Final step gets a highlight box drawn around it
  const lastStepStart = stepStartFrame(displaySteps.length - 1);
  const boxProgress = interpolate(frame, [lastStepStart + STEP_DURATION, lastStepStart + STEP_DURATION + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive",
      }}
    >
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
          <filter id="ink" x="-3%" y="-8%" width="106%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="5" seed="41" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain)" fill="white" />
      </svg>

      {/* Ruled lines — like actual whiteboard / paper, drawn faintly */}
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
        {/* Header */}
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
                fontSize: descriptionFontSize ?? (p ? 22 : 28),
                opacity: 0.85,
                filter: "url(#ink)",
              }}
            >
              {narration}
            </div>
          )}

          {/* Divider underline */}
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

        {/* Equation steps */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: p ? 14 : 18,
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
                {/* Step annotation */}
                <div
                  style={{
                    color: textColor,
                    fontSize: p ? 16 : 20,
                    fontWeight: 600,
                    opacity: Math.min(progress * 3, 0.6),
                    marginBottom: 3,
                    letterSpacing: "0.02em",
                    filter: "url(#ink)",
                  }}
                >
                  {step.label}
                </div>

                {/* Equation value with stroke reveal */}
                <div
                  style={{
                    position: "relative",
                    display: "inline-block",
                    padding: isLast ? "6px 14px" : "0",
                  }}
                >
                  {/* Hand-drawn highlight box for final answer */}
                  {isLast && (
                    <svg
                      style={{ position: "absolute", inset: -8, width: "calc(100% + 16px)", height: "calc(100% + 16px)", overflow: "visible", pointerEvents: "none" }}
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
                        {/* Bleed */}
                        <rect x={3} y={3} width={294} height={54} rx={12} stroke={accentColor} strokeWidth={9} strokeOpacity={0.22} strokeDasharray={800} strokeDashoffset={800 * (1 - boxProgress)} />
                        {/* Core */}
                        <rect x={3} y={3} width={294} height={54} rx={12} stroke={accentColor} strokeWidth={4} strokeDasharray={800} strokeDashoffset={800 * (1 - boxProgress)} />
                      </g>
                    </svg>
                  )}

                  {/* The equation text itself */}
                  <div
                    style={{
                      color: isLast ? accentColor : textColor,
                      fontSize: p ? (isLast ? 32 : 26) : (isLast ? 40 : 32),
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

                {/* Connecting arrow to next step */}
                {!isLast && (
                  <svg
                    style={{ display: "block", width: p ? 36 : 44, height: p ? 20 : 26, marginTop: 2, marginLeft: 12 }}
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
                      <line x1={4} y1={13} x2={36} y2={13} stroke={textColor} strokeWidth={5} strokeOpacity={0.2} />
                      <line x1={4} y1={13} x2={36} y2={13} stroke={textColor} strokeWidth={2.5} />
                      <path d="M28,6 L38,13 L28,20" stroke={textColor} strokeWidth={5} strokeOpacity={0.2} fill="none" />
                      <path d="M28,6 L38,13 L28,20" stroke={textColor} strokeWidth={2.5} fill="none" />
                    </g>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};