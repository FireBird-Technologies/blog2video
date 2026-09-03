import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";

const CHARS_PER_SEC = 28;

const InkDefs: React.FC<{ id?: string }> = ({ id = "ink" }) => (
  <defs>
    <filter id={id} x="-4%" y="-4%" width="108%" height="108%">
      <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="11" result="warp" />
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.8" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="paper">
      <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" result="noise" />
      <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
      <feComponentTransfer in="gray" result="lighter">
        <feFuncA type="linear" slope="0.06" />
      </feComponentTransfer>
      <feComposite in="lighter" in2="SourceGraphic" operator="over" />
    </filter>
  </defs>
);

const BrokenGround: React.FC<{ color: string; p: boolean }> = ({ color, p }) => {
  return (
    <svg
      style={{
        position: "absolute",
        bottom: p ? "12%" : "10%", 
        left: 0,
        width: "100%",
        height: 60,
        overflow: "visible",
      }}
      viewBox="0 0 1000 60"
      preserveAspectRatio="none"
    >
      <filter id="brokenGroundInk" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.1 0.08" numOctaves="4" seed="25" result="crackNoise" />
        <feDisplacementMap in="SourceGraphic" in2="crackNoise" scale="14" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <path
        d="M -50,30 Q 250,34 500,30 Q 750,26 1050,30"
        fill="none"
        stroke={color}
        strokeWidth="16"
        strokeLinecap="round"
        strokeOpacity="0.4"
        filter="url(#brokenGroundInk)"
      />
      <path
        d="M -50,30 Q 250,34 500,30 Q 750,26 1050,30"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeOpacity="0.8"
        filter="url(#brokenGroundInk)"
      />
    </svg>
  );
};

export const DrawnTitle: React.FC<WhiteboardLayoutProps> = ({
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
  const fps = 30;
  const { height } = useVideoConfig();

  const titleDur = Math.ceil(title.length * (fps / CHARS_PER_SEC));
  const titleChars = Math.min(
    title.length,
    Math.floor(interpolate(frame, [0, titleDur], [0, title.length], { extrapolateRight: "clamp" }))
  );

  const narrationStart = 18 + titleDur;
  const narrationDur = Math.ceil(narration.length * (fps / CHARS_PER_SEC));
  const narrationChars = Math.min(
    narration.length,
    Math.max(0, Math.floor(
      interpolate(frame, [narrationStart, narrationStart + narrationDur], [0, narration.length], { extrapolateRight: "clamp" })
    ))
  );

  const lineW = interpolate(frame, [10 + titleDur, 18 + titleDur + narrationDur], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const visibleTitle = title.slice(0, titleChars);
  const visibleNarration = narration.slice(0, narrationChars);

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and narration are unbounded user input; long copy overflows the
     frame. The visible copy is progressively SLICED in via titleChars/
     narrationChars (not spans revealed by opacity), so measuring the visible
     div directly would chase a moving (and initially empty) target — hidden
     full-text mirrors are measured instead, matching the pattern used for
     char-reveal text elsewhere in this codebase (e.g. chronicle/DecreeSeal).
     An explicitly chosen size is honored exactly (minPx === targetPx no-ops
     the hook). */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitNarrationRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 81 : 66);
  const fitNarrationTarget = descriptionFontSize ?? (p ? 37 : 27);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.4),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.22 : 0.26)),
  );
  const { px: fitNarrationPx } = useFitText(
    fitNarrationRef,
    fitNarrationTarget,
    descriptionFontSizeIsUserSet ? fitNarrationTarget : Math.round(fitNarrationTarget * 0.5),
    [narration, fitNarrationTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    Math.round(height * (p ? 0.22 : 0.24)),
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

      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden
      >
        <InkDefs />
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="linear" slope="0.055" /></feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="over" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" fill="none" />
        
        {/* Decorative corner cross-hatches for portrait */}
        {p && (
          <g stroke={textColor} strokeWidth="2" strokeOpacity="0.15" filter="url(#ink)">
            <path d="M40,60 L80,100 M80,60 L40,100" />
            <path d="M880,880 L920,920 M920,880 L880,920" transform="translate(40, -40)" />
          </g>
        )}
      </svg>

      {/* Main Content Area */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: p ? "flex-start" : "center",
          textAlign: "center",
          // Landscape stays centred, but the extra bottom padding lifts the
          // block off dead centre so it clears the walking figure below.
          // Side padding kept tight so long titles and narration have room:
          // at 14% the inner box was only 922px of a 1280 frame, and the
          // narration's own 76% cap cut that to 700px — barely half the width.
          padding: p ? "15% 6% 0 6%" : "0 9% 10% 9%",
          zIndex: 10,
        }}
      >
        {/* Hidden full-title mirror — titleChars slices the visible copy in
            progressively, so it can't be measured directly (see Auto-fit
            note above). */}
        <div
          ref={fitTitleRef}
          aria-hidden
          style={{
            position: "absolute",
            visibility: "hidden",
            width: "100%",
            fontWeight: 700,
            lineHeight: 1.1,
            fontSize: fitTitlePx,
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </div>
        {/* Title */}
        <div
          style={{
            color: textColor,
            fontWeight: 700,
            lineHeight: 1.1,
            fontSize: fitTitlePx,
            letterSpacing: "0.01em",
            filter: "url(#ink)",
            width: "100%",
          }}
        >
          {visibleTitle}
        </div>

        {/* Animated Underline */}
        <svg
          style={{ 
            width: p ? 440 : 860, 
            maxWidth: "90%", 
            height: 14, 
            marginTop: p ? 30 : 20, 
            marginBottom: p ? 20 : 0, 
            overflow: "visible" 
          }}
          viewBox="0 0 720 14"
          preserveAspectRatio="none"
        >
          <filter id="inkLine">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.3" numOctaves="3" seed="6" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <path
            d="M 0,7 Q 180,4 360,8 Q 540,12 720,7"
            fill="none"
            stroke={accentColor}
            strokeWidth="9"
            strokeOpacity="0.22"
            strokeLinecap="round"
            filter="url(#inkLine)"
            strokeDasharray={800}
            strokeDashoffset={800 * (1 - lineW / 100)}
          />
          <path
            d="M 0,7 Q 180,4 360,8 Q 540,12 720,7"
            fill="none"
            stroke={accentColor}
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#inkLine)"
            strokeDasharray={800}
            strokeDashoffset={800 * (1 - lineW / 100)}
          />
        </svg>

        {/* Hidden full-narration mirror — narrationChars slices the visible
            copy in progressively, so it can't be measured directly. */}
        <div
          ref={fitNarrationRef}
          aria-hidden
          style={{
            position: "absolute",
            visibility: "hidden",
            fontSize: fitNarrationPx,
            fontWeight: 500,
            width: p ? "100%" : "76%",
            maxWidth: p ? "100%" : "76%",
            lineHeight: 1.45,
          }}
        >
          {narration}
        </div>
        {/* Narration Text */}
        <div
          style={{
            marginTop: p ? 30 : 26,
            color: textColor,
            fontSize: fitNarrationPx,
            fontWeight: 500,
            width: p ? "100%" : "76%",
            maxWidth: p ? "100%" : "92%",
            lineHeight: 1.45,
            filter: "url(#ink)",
          }}
        >
          {visibleNarration}
        </div>
      </div>

      {/* Background/Foreground Grounds */}
      <BrokenGround color={textColor} p={p} />

      {/* STICK FIGURE: Larger and more prominent in portrait */}
      <svg
        style={{
          position: "absolute",
          bottom: p ? "12.5%" : "11.5%", 
          width: p ? "32%" : "13%",
          height: "auto",
          pointerEvents: "none",
          zIndex: 100,
          overflow: "visible",
        }}
        viewBox="0 0 100 124"
        fill="none"
      >
        <filter id="inkFig">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="9" result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" />
        </filter>

        {(() => {
          const speed = 0.9;
          const cycle = frame * 0.22 * speed;
          const bob = Math.sin(cycle * 2) * 3; 
          const walkX = interpolate(frame, [0, 300], [p ? -40 : -20, p ? 140 : 120]);

          const getLegPoints = (phaseOffset: number) => {
            const ph = cycle + phaseOffset;
            const thighRotation = Math.sin(ph) * 32;
            const kneeRotation = Math.max(0, Math.sin(ph - Math.PI / 2)) * 40;
            return { thighRotation, kneeRotation };
          };

          const legL = getLegPoints(0);
          const legR = getLegPoints(Math.PI);
          const armSwing = Math.sin(cycle) * 30;

          return (
            <g filter="url(#inkFig)" transform={`translate(${walkX}, ${bob})`}>
              <circle cx="50" cy="22" r="14" stroke={textColor} strokeWidth="4.5" fill="none" />
              <line x1="50" y1="38" x2="52" y2="72" stroke={textColor} strokeWidth="4.5" />
              {/* Back Arm */}
              <g transform={`rotate(${-armSwing} 50 48)`}>
                <line x1="50" y1="48" x2="55" y2="68" stroke={textColor} strokeWidth="4.5" strokeLinecap="round" />
                <line x1="55" y1="68" x2="70" y2="82" stroke={textColor} strokeWidth="4.5" strokeLinecap="round" />
              </g>
              {/* Legs */}
              <g transform={`rotate(${legR.thighRotation} 52 72)`}>
                <line x1="52" y1="72" x2="52" y2="92" stroke={textColor} strokeWidth="4.5" />
                <g transform={`translate(52, 92) rotate(${legR.kneeRotation})`}>
                  <line x1="0" y1="0" x2="8" y2="22" stroke={textColor} strokeWidth="4.5" strokeLinecap="round" />
                </g>
              </g>
              <g transform={`rotate(${legL.thighRotation} 52 72)`}>
                <line x1="52" y1="72" x2="52" y2="92" stroke={textColor} strokeWidth="4.5" />
                <g transform={`translate(52, 92) rotate(${legL.kneeRotation})`}>
                  <line x1="0" y1="0" x2="8" y2="22" stroke={textColor} strokeWidth="4.5" strokeLinecap="round" />
                </g>
              </g>
              {/* Front Arm */}
              <g transform={`rotate(${armSwing} 50 48)`}>
                <line x1="50" y1="48" x2="55" y2="68" stroke={textColor} strokeWidth="4.5" strokeLinecap="round" />
                <line x1="55" y1="68" x2="70" y2="82" stroke={textColor} strokeWidth="4.5" strokeLinecap="round" />
              </g>
            </g>
          );
        })()}
      </svg>
    </AbsoluteFill>
  );
};