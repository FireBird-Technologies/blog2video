import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

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
        // Positioned slightly above the container base
        bottom: p ? "7.5%" : "10%", 
        left: 0,
        width: "100%",
        // Height needs to be taller to accommodate the broken fragments
        height: 60,
        overflow: "visible",
      }}
      viewBox="0 0 1000 60"
      preserveAspectRatio="none"
    >
      <filter id="brokenGroundInk" x="-10%" y="-10%" width="120%" height="120%">
        {/* We use a multi-octave noise to create chaotic, unpredictable breakage */}
        <feTurbulence 
          type="fractalNoise" 
          baseFrequency="0.1 0.08" // Higher vertical frequency breaks the line
          numOctaves="4" 
          seed="25" 
          result="crackNoise" 
        />
        {/* High scale physically displaces and shatters the path geometry */}
        <feDisplacementMap 
          in="SourceGraphic" 
          in2="crackNoise" 
          scale="14" // This is the 'breaking' force
          xChannelSelector="R" 
          yChannelSelector="G" 
        />
      </filter>

      {/* The thick, marker-style base stroke */}
      <path
        d="M -50,30 Q 250,34 500,30 Q 750,26 1050,30"
        fill="none"
        stroke={color}
        strokeWidth="16" // HIGH STROKE
        strokeLinecap="round"
        strokeOpacity="0.4" // Heavy ink marker bleed
        filter="url(#brokenGroundInk)"
      />

      {/* The darker 'core' line for definition */}
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
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const fps = 30;

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

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive",
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
        <rect width="100%" height="100%" filter="url(#grain)" fill="white" />
      </svg>

      {/* TEXT LAYER: Lower z-index than stickman */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: p ? "0 10%" : "0 14%",
          zIndex: 10, 
        }}
      >
        <div
          style={{
            color: textColor,
            fontWeight: 700,
            lineHeight: 1.05,
            fontSize: titleFontSize ?? (p ? 80 : 114),
            letterSpacing: "0.01em",
            filter: "url(#ink)",
          }}
        >
          {visibleTitle}
        </div>

        <svg
          style={{ width: p ? 440 : 720, maxWidth: "90%", height: 14, marginTop: p ? 14 : 20, overflow: "visible" }}
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

        <div
          style={{
            marginTop: p ? 18 : 26,
            color: textColor,
            fontSize: descriptionFontSize ?? (p ? 30 : 36),
            fontWeight: 500,
            maxWidth: p ? "100%" : "76%",
            lineHeight: 1.35,
            filter: "url(#ink)",
          }}
        >
          {visibleNarration}
        </div>
      </div>

      <BrokenGround color={textColor} p={p} />

      {/* STICK FIGURE LAYER: Higher z-index + Left-to-Right movement */}
      <svg
       style={{
          position: "absolute",
          // ADJUSTED: Raised the container slightly to align the 
          // feet/legs with the core of the high ground stroke.
          bottom: p ? "8.5%" : "11.5%", 
          width: p ? "20%" : "13%",
          height: "auto",
          pointerEvents: "none",
          zIndex: 100, // Above text layer
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

          // 1. Vertical Bobbing
          const bob = Math.sin(cycle * 2) * 3; 
          
          // 2. Movement (Left to Right)
          const walkX = interpolate(frame, [0, 300], [-20, 120]);

          // 3. Large Step Leg Logic
          const getLegPoints = (phaseOffset: number) => {
            const p = cycle + phaseOffset;
            // Increased swing from 22 to 35 for larger steps
            const thighRotation = Math.sin(p) * 32;
            // Increased knee bend to match the larger stride
            const kneeRotation = Math.max(0, Math.sin(p - Math.PI / 2)) * 40;
            return { thighRotation, kneeRotation };
          };

          const legL = getLegPoints(0);
          const legR = getLegPoints(Math.PI);

          // 4. Arms (Same opacity, dark/solid)
          const armSwing = Math.sin(cycle) * 30; // Slightly larger arm swing to match legs

          return (
            <g
              filter="url(#inkFig)"
              transform={`translate(${walkX}, ${bob})`}
            >
              {/* HEAD */}
              <circle cx="50" cy="22" r="14" stroke={textColor} strokeWidth="4.5" fill="none" />

              {/* BODY */}
              <line x1="50" y1="38" x2="52" y2="72" stroke={textColor} strokeWidth="4.5" />

              {/* BACK ARM (Full opacity, dark) */}
              <g transform={`rotate(${-armSwing} 50 48)`}>
                <line x1="50" y1="48" x2="55" y2="68" stroke={textColor} strokeWidth="4.5" strokeLinecap="round" />
                <line x1="55" y1="68" x2="70" y2="82" stroke={textColor} strokeWidth="4.5" strokeLinecap="round" />
              </g>

              {/* LEGS */}
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

              {/* FRONT ARM (Full opacity, dark) */}
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