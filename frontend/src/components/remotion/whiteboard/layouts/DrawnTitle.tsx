import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

const CHARS_PER_SEC = 28;

// Shared paper + ink bleed filters — include once in each component's SVG
const InkDefs: React.FC<{ id?: string }> = ({ id = "ink" }) => (
  <defs>
    {/* Marker wobble / ink-bleed displacement */}
    <filter id={id} x="-4%" y="-4%" width="108%" height="108%">
      <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="11" result="warp" />
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.8" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    {/* Paper grain overlay */}
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

  // Underline draws after title finishes
  const lineW = interpolate(frame, [10 + titleDur, 18 + titleDur + narrationDur], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ease-out cubic for stickman
  const stickProgress = interpolate(frame, [14, 42], [0, 1], { extrapolateRight: "clamp" });
  const stickDash = 300;
  const stickOff = stickDash * (1 - stickProgress);

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

      {/* Paper grain layer */}
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
        }}
      >
        {/* Title */}
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

        {/* Wobbly underline via SVG bezier path */}
        <svg
          style={{ width: p ? 440 : 720, maxWidth: "90%", height: 14, marginTop: p ? 14 : 20, overflow: "visible" }}
          viewBox="0 0 720 14"
          preserveAspectRatio="none"
        >
          <filter id="inkLine">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.3" numOctaves="3" seed="6" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* Double stroke for marker bleed */}
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

        {/* Narration typewriter */}
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

      {/* Stick figure — bottom right, looking left at the heading */}
      <svg
        style={{
          position: "absolute",
          right: p ? "5%" : "6%",
          bottom: p ? "5%" : "6%",
          width: p ? "18%" : "11%",
          height: "auto",
          pointerEvents: "none",
        }}
        viewBox="0 0 100 124"
        fill="none"
      >
        <filter id="inkFig">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="9" result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <g filter="url(#inkFig)">
          {/* Double-stroke: wide bleed + core */}
          <circle cx="50" cy="22" r="14" stroke={textColor} strokeWidth="7" strokeOpacity="0.18" fill="none" strokeDasharray={stickDash} strokeDashoffset={stickOff} />
          <circle cx="50" cy="22" r="14" stroke={textColor} strokeWidth="4" fill="none" strokeDasharray={stickDash} strokeDashoffset={stickOff} />

          <line x1="50" y1="38" x2="50" y2="72" stroke={textColor} strokeWidth="7" strokeOpacity="0.18" strokeDasharray={stickDash} strokeDashoffset={stickOff} />
          <line x1="50" y1="38" x2="50" y2="72" stroke={textColor} strokeWidth="4" strokeDasharray={stickDash} strokeDashoffset={stickOff} />

          {/* Left arm angled as if pointing at the title */}
          <line x1="50" y1="48" x2="22" y2="38" stroke={textColor} strokeWidth="7" strokeOpacity="0.18" strokeDasharray={stickDash} strokeDashoffset={stickOff} />
          <line x1="50" y1="48" x2="22" y2="38" stroke={textColor} strokeWidth="4" strokeDasharray={stickDash} strokeDashoffset={stickOff} />

          <line x1="50" y1="48" x2="74" y2="62" stroke={textColor} strokeWidth="7" strokeOpacity="0.18" strokeDasharray={stickDash} strokeDashoffset={stickOff} />
          <line x1="50" y1="48" x2="74" y2="62" stroke={textColor} strokeWidth="4" strokeDasharray={stickDash} strokeDashoffset={stickOff} />

          <path d="M50,72 Q42,96 32,112" stroke={textColor} strokeWidth="7" strokeOpacity="0.18" fill="none" strokeLinecap="round" strokeDasharray={stickDash} strokeDashoffset={stickOff} />
          <path d="M50,72 Q42,96 32,112" stroke={textColor} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={stickDash} strokeDashoffset={stickOff} />

          <path d="M50,72 Q58,96 68,112" stroke={textColor} strokeWidth="7" strokeOpacity="0.18" fill="none" strokeLinecap="round" strokeDasharray={stickDash} strokeDashoffset={stickOff} />
          <path d="M50,72 Q58,96 68,112" stroke={textColor} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={stickDash} strokeDashoffset={stickOff} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};