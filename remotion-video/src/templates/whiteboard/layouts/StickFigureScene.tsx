import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";

export const StickFigureScene: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const { height } = useVideoConfig();

  // 1. BOUNCE MATH
  const bounceHeight = 120;
  const bounceRaw = Math.abs(Math.sin(frame * 0.1));
  const ballOffset = bounceRaw * bounceHeight;

  // 2. ARM MOVEMENT
  const shoulderY = 130;
  const handX = 220;
  const handY = 200 - (1 - bounceRaw) * 20; 
  const elbowX = 165;
  const elbowY = 170;

  const figProgress = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [28, 46], [0, 1], { extrapolateRight: "clamp" });
  const doodleOp = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });

  const dash = 500;
  const figOff = dash * (1 - figProgress);

  /* ── Auto-fit (title + narration) ────────────────────────────────
     Title and narration render the full prop text directly from frame 0
     (only opacity fades via textOp) — no slice-reveal — so direct ref is
     safe. Title renders in one of two mutually-exclusive spots (portrait
     header vs landscape side panel) sharing the same ref/fit; only one is
     ever mounted at a time. */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitNarrationRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 73 : 62);
  const fitNarrationTarget = descriptionFontSize ?? (p ? 31 : 28);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.4),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.16 : 0.2)),
  );
  const { px: fitNarrationPx } = useFitText(
    fitNarrationRef,
    fitNarrationTarget,
    descriptionFontSizeIsUserSet ? fitNarrationTarget : Math.round(fitNarrationTarget * 0.5),
    [narration, fitNarrationTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    // Landscape: narration sits alone in its own column (title + narration
    // stacked, nothing else below), so it can use most of the frame height,
    // not just a slice — the old 22% badly under-budgeted it. Portrait keeps
    // a smaller share since the figure sits below it in the same column.
    Math.round(height * (p ? 0.24 : 0.55)),
  );

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        letterSpacing: "1.5px"
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.055" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="22" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain)" fill="none" />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          justifyContent: p ? "space-around" : "center", // Spaced out for portrait
          gap: p ? 40 : 44,
          padding: p ? "15% 8%" : "5% 7%",
        }}
      >
        {/* Header-style Text for Portrait */}
        {p && (
          <div style={{ color: textColor, opacity: textOp, textAlign: "center", marginBottom: -20, width: "100%" }}>
            <div ref={fitTitleRef} style={{ fontWeight: 700, fontSize: fitTitlePx, filter: "url(#ink)", width: "100%" }}>{title}</div>
            {/* Hand-drawn underline for title in portrait */}
            <svg width="100%" height="20" viewBox="0 0 300 20" style={{ opacity: doodleOp }}>
                <path d="M50,10 Q150,18 250,10" stroke={accentColor} strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        )}

        <svg viewBox="0 0 420 370" style={{ width: p ? "90%" : "44%", maxWidth: 640, height: "auto" }} fill="none">
          <g filter="url(#ink)" strokeLinecap="round" strokeLinejoin="round">
            {/* Ground line */}
            <line x1={10} y1={310} x2={410} y2={308} stroke={textColor} strokeWidth={4} strokeOpacity={0.3} />

            {/* Motion Lines for Ball (Portrait only) */}
            {p && (
               <g stroke={accentColor} strokeOpacity={0.2 * (1 - bounceRaw)} strokeWidth={3}>
                  <line x1={handX - 10} y1={handY - 80} x2={handX - 10} y2={handY - 110} />
                  <line x1={handX + 10} y1={handY - 80} x2={handX + 10} y2={handY - 110} />
               </g>
            )}

            {/* === STICK MAN === */}
            <circle cx={110} cy={66} r={30} stroke={textColor} strokeWidth={5} strokeDasharray={dash} strokeDashoffset={figOff} />
            <line x1={110} y1={98} x2={110} y2={218} stroke={textColor} strokeWidth={5} strokeDasharray={dash} strokeDashoffset={figOff} />

            {/* Arms */}
            <path d={`M110,${shoulderY} L${elbowX},${elbowY} L${handX},${handY}`} stroke={textColor} strokeWidth={5} fill="none" />
            <path d={`M110,${shoulderY} L${elbowX - 15},${elbowY + 10} L${handX},${handY}`} stroke={textColor} strokeWidth={5} fill="none" />

            {/* Legs */}
            <path d="M110,218 L80,308" stroke={textColor} strokeWidth={5} />
            <path d="M110,218 L140,308" stroke={textColor} strokeWidth={5} />

            {/* === BOUNCING BALL === */}
            <g transform={`translate(0, ${-ballOffset})`}>
              <circle cx={handX} cy={handY - 25} r={25} stroke={accentColor} strokeWidth={5} fill={bgColor} />
              <path d={`M${handX-10},${handY-32} Q${handX},${handY-25} ${handX+10},${handY-32}`} stroke={accentColor} strokeWidth={3} strokeOpacity={0.5} />
            </g>
          </g>
        </svg>

        <div style={{
          flex: p ? "none" : 1,
          color: textColor,
          opacity: textOp,
          textAlign: p ? "center" : "left",
          maxWidth: p ? "90%" : "auto",
          width: p ? "90%" : "auto",
        }}>
          {!p && <div ref={fitTitleRef} style={{ fontWeight: 700, fontSize: fitTitlePx, filter: "url(#ink)", width: "100%" }}>{title}</div>}
          <div
            ref={fitNarrationRef}
            style={{
              marginTop: p ? 0 : 18,
              fontSize: fitNarrationPx,
              filter: "url(#ink)",
              lineHeight: 1.4,
              width: "100%",
            }}
          >
            {narration}
          </div>
        </div>
      </div>

      {/* Decorative Portrait Background Doodle (Top Right Cloud) */}
      {p && (
        <svg 
          style={{ position: "absolute", top: "5%", right: "5%", width: "25%", opacity: doodleOp * 0.3 }} 
          viewBox="0 0 100 60"
        >
          <path 
            d="M10,40 Q10,10 40,10 Q50,0 70,10 Q95,10 90,40 Z" 
            stroke={accentColor} 
            strokeWidth="3" 
            fill="none" 
            filter="url(#ink)"
          />
        </svg>
      )}
      
      {/* Decorative Portrait Background Doodle (Bottom Left Scribble) */}
      {p && (
        <svg 
          style={{ position: "absolute", bottom: "5%", left: "5%", width: "20%", opacity: doodleOp * 0.2 }} 
          viewBox="0 0 100 100"
        >
          <path 
            d="M10,90 Q30,70 50,90 T90,90" 
            stroke={textColor} 
            strokeWidth="2" 
            fill="none" 
            strokeDasharray="4 4"
          />
        </svg>
      )}
    </AbsoluteFill>
  );
};