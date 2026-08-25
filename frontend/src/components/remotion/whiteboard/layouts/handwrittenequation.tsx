import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";

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
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  stats: statsProp,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const steps = statsProp?.length ? statsProp : DEFAULT_STEPS;
  const maxSteps = Math.min(steps.length, 5);
  const displaySteps = steps.slice(0, maxSteps);

  const baseTitleSize = titleFontSize ?? (p ? 80 : 68);
  const baseDescSize = descPropSize ?? (p ? 32 : 27);

  const titleOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  /* ── Auto-fit (title + narration) ────────────────────────────────
     Both render the full prop text directly from frame 0 (only opacity
     animates via titleOp) — no slice-reveal here (the .slice() elsewhere
     in this file is on step.value, a fixed equation-step label, not
     title/narration, and is left untouched). */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitNarrationRef = React.useRef<HTMLDivElement>(null);
  const { px: finalTitleSize } = useFitText(
    fitTitleRef,
    baseTitleSize,
    titleFontSizeIsUserSet ? baseTitleSize : Math.round(baseTitleSize * 0.4),
    [title, baseTitleSize, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.12 : 0.16)),
  );
  const { px: finalDescSize } = useFitText(
    fitNarrationRef,
    baseDescSize,
    descriptionFontSizeIsUserSet ? baseDescSize : Math.round(baseDescSize * 0.5),
    [narration, baseDescSize, descriptionFontSizeIsUserSet, finalTitleSize, p, height],
    Math.round(height * (p ? 0.08 : 0.1)),
  );
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
          width: 400,
          height: 500,
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
        <div style={{ opacity: titleOp, textAlign: p ? "center" : "left", width: "100%" }}>
          <div
            ref={fitTitleRef}
            style={{
              color: textColor,
              fontWeight: 800,
              fontSize: finalTitleSize,
              lineHeight: 1.1,
              filter: "url(#ink)",
              width: "100%",
            }}
          >
            {title}
          </div>
          {narration && (
            <div
              ref={fitNarrationRef}
              style={{ marginTop: 8, color: textColor, fontSize: finalDescSize, opacity: 0.8, filter: "url(#ink)", width: "100%" }}
            >
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
          gap: p ? 24 : 18,
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
                  fontSize: p ? 25 : 20,
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
          width: 170,
          height: 260,
          filter: "url(#ink)",
          opacity: titleOp * 0.9,
        }}>
          <svg viewBox="0 0 100 200" style={{ display: 'block', width: '100%', height: '100%' }}>
            <g transform={`translate(50, 100)`}>
              <g transform={`translate(0, ${bodyBob}) scale(-1, 1)`}>
                <circle cx={0} cy={-75} r={17} stroke={textColor} strokeWidth={6} fill="none" />
                <path d="M0, -58 L-4, 5 L18, 50" fill="none" stroke={textColor} strokeWidth={6} strokeLinecap="round"/>
                <path d="M-2, -15 L-25, 0" fill="none" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
                <g transform={`translate(0, ${-bodyBob})`}>
                  <path d={`M-2, -15 L25, 5 L35, ${handYVisual - 100}`} fill="none" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
                </g>
                <path d="M18,50 L14, 90" fill="none" stroke={textColor} strokeWidth={6} strokeLinecap="round" />
                <path d="M18,50 L26, 90" fill="none" stroke={textColor} strokeWidth={6} strokeLinecap="round" />
              </g>
              <circle cx={-38} cy={ballYVisual - 100} r={15} fill={accentColor} stroke={textColor} strokeWidth={1} />
              <line x1={-60} y1={55} x2={40} y2={55} stroke={textColor} strokeWidth={4} strokeLinecap="round" />
            </g>
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
