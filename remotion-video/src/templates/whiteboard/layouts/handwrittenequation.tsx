import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

const DEFAULT_STEPS = [
  { label: "Compound Interest Formula", value: "A = P · (1 + r/n)^(n·t)" },
  { label: "Where:", value: "P = principal,  r = rate,  n = compounds/yr,  t = years" },
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
  descriptionFontSize: descPropSize,
  stats: statsProp,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width: videoWidth } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const scale = videoWidth / 1920;

  const steps = statsProp?.length ? statsProp : DEFAULT_STEPS;
  const maxSteps = Math.min(steps.length, 5);
  const displaySteps = steps.slice(0, maxSteps);

  const finalTitleSize = (titleFontSize ?? (p ? 58 : 64)) * scale;
  const finalDescSize = descPropSize ?? (p ? 22 : 43) * scale;

  const titleOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const stepStartFrame = (i: number) => 16 + i * (STEP_DURATION + STEP_GAP);

  // === STICKMAN ANIMATION MATH ===
  const bouncePeriod = 30;
  const t = (frame % bouncePeriod) / bouncePeriod;
  const ballYVisual = 130 - 70 * (1 - 4 * (t - 0.5) ** 2);
  const handYVisual = 130 - 20 - 50 * (1 - 4 * (((t + 0.12) % 1) - 0.5) ** 2);
  const bodyBob = Math.sin(frame * 0.08) * 2.5;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        letterSpacing: "1.5px"
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="5" seed="41" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" />
          </filter>
          <filter id="inkBoxPortrait" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04 0.02" numOctaves="3" seed="12" />
            <feDisplacementMap in="SourceGraphic" scale="4" />
          </filter>
        </defs>
      </svg>

      {/* PORTRAIT STICKMAN (Middle Background) */}
      {p && (
        <div style={{
          position: "absolute",
          top: "60%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 400 * scale,
          height: 500 * scale,
          opacity: titleOp * 0.25,
          filter: "url(#ink)",
          pointerEvents: "none"
        }}>
          <svg viewBox="0 0 100 200" style={{ width: "100%", height: "100%" }}>
            <g transform="translate(50, 100)">
              <g transform={`translate(0, ${bodyBob}) scale(-1, 1)`}>
                <circle cx={0} cy={-75} r={17} stroke={textColor} strokeWidth={5} fill="none" />
                <path d="M0, -58 L-4, 5 L18, 50" fill="none" stroke={textColor} strokeWidth={5} strokeLinecap="round"/>
                <path d="M-2, -15 L-25, 0" fill="none" stroke={textColor} strokeWidth={4} strokeLinecap="round" />
                <g transform={`translate(0, ${-bodyBob})`}>
                  <path d={`M-2, -15 L25, 5 L35, ${handYVisual - 100}`} fill="none" stroke={textColor} strokeWidth={4} strokeLinecap="round" />
                </g>
                <path d="M18,50 L14, 90" fill="none" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
                <path d="M18,50 L26, 90" fill="none" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
              </g>
              {/* THE BALL - Added to portrait mode */}
              <circle cx={-38} cy={ballYVisual - 100} r={15} fill={accentColor} stroke={textColor} strokeWidth={1} />
              <line x1={-60} y1={55} x2={40} y2={55} stroke={textColor} strokeWidth={4} strokeLinecap="round" />
            </g>
          </svg>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "12% 8%" : "5% 9%",
          gap: p ? 30 : 16,
          zIndex: 2,
        }}
      >
        <div style={{ opacity: titleOp, textAlign: p ? "center" : "left" }}>
          <div style={{
            color: textColor,
            fontWeight: 800,
            fontSize: finalTitleSize,
            lineHeight: 1.1,
            filter: "url(#ink)",
          }}>
            {title}
          </div>
          {narration && (
            <div style={{ marginTop: 8, color: textColor, fontSize: finalDescSize, opacity: 0.8, filter: "url(#ink)" }}>
              {narration}
            </div>
          )}
        </div>

        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: p ? "flex-start" : "center",
          marginTop: p ? 20 : 0,
          gap: (p ? 24 : 18) * scale,
        }}>
          {displaySteps.map((step, i) => {
            const startF = stepStartFrame(i);
            const progress = interpolate(frame, [startF, startF + STEP_DURATION], [0, 1], { extrapolateRight: "clamp" });
            const isLast = i === displaySteps.length - 1;
            const visChars = Math.floor(step.value.length * progress);

            return (
              <div
                key={i}
                style={{
                  opacity: progress > 0.01 ? 1 : 0,
                  position: "relative",
                  background: p ? `${bgColor}AA` : "transparent",
                  backdropFilter: p ? "blur(2px)" : "none",
                  padding: p ? "20px" : "0",
                  borderRadius: p ? "15px" : "0",
                  border: p ? `2px solid ${textColor}20` : "none",
                  filter: p ? "url(#inkBoxPortrait)" : "none",
                  transform: p ? `rotate(${(i % 2 === 0 ? 0.5 : -0.5)}deg)` : "none"
                }}
              >
                <div style={{
                  color: textColor,
                  fontSize: (p ? 25 : 20) * scale,
                  fontWeight: 600,
                  opacity: 0.6,
                  marginBottom: 4,
                  filter: "url(#ink)",
                }}>
                  {step.label}
                </div>

                <div style={{ position: "relative", display: "inline-block" }}>
                  <div style={{
                    color: isLast ? accentColor : textColor,
                    fontSize: finalDescSize * (isLast ? 1.3 : 1),
                    fontWeight: isLast ? 800 : 600,
                    filter: "url(#ink)",
                    letterSpacing: "0.02em",
                  }}>
                    {step.value.slice(0, visChars)}
                    {visChars < step.value.length && <span style={{ opacity: 0.3 }}>|</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LANDSCAPE STICKMAN */}
      {!p && (
        <AbsoluteFill style={{
          top: 'auto', left: 'auto',
          right: '5%', bottom: '15%',
          width: 170 * scale,
          height: 260 * scale,
          filter: "url(#ink)",
          opacity: titleOp * 0.9,
        }}>
          <svg viewBox="0 0 100 200" style={{ display: 'block', width: '100%', height: '100%' }}>
            <g transform={`translate(50, 100)`}>
              <g transform={`translate(0, ${bodyBob}) scale(-1, 1)`}>
                <circle cx={0} cy={-75} r={17} stroke={textColor} strokeWidth={6 * scale} fill="none" />
                <path d="M0, -58 L-4, 5 L18, 50" fill="none" stroke={textColor} strokeWidth={6 * scale} strokeLinecap="round"/>
                <path d="M-2, -15 L-25, 0" fill="none" stroke={textColor} strokeWidth={5 * scale} strokeLinecap="round" />
                <g transform={`translate(0, ${-bodyBob})`}>
                  <path d={`M-2, -15 L25, 5 L35, ${handYVisual - 100}`} fill="none" stroke={textColor} strokeWidth={5 * scale} strokeLinecap="round" />
                </g>
                <path d="M18,50 L14, 90" fill="none" stroke={textColor} strokeWidth={6 * scale} strokeLinecap="round" />
                <path d="M18,50 L26, 90" fill="none" stroke={textColor} strokeWidth={6 * scale} strokeLinecap="round" />
              </g>
              <circle cx={-38} cy={ballYVisual - 100} r={15} fill={accentColor} stroke={textColor} strokeWidth={1} />
              <line x1={-60} y1={55} x2={40} y2={55} stroke={textColor} strokeWidth={4 * scale} strokeLinecap="round" />
            </g>
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
