import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

export const StickFigureScene: React.FC<WhiteboardLayoutProps> = ({
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

  // Draw stickman first, then scene object, then text fades in
  const figProgress = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const objProgress = interpolate(frame, [10, 38], [0, 1], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [28, 46], [0, 1], { extrapolateRight: "clamp" });

  const dash = 500;
  const figOff = dash * (1 - figProgress);
  const objOff = dash * (1 - objProgress);

  // Groundline draw
  const groundProgress = interpolate(frame, [22, 36], [0, 1], { extrapolateRight: "clamp" });
  const groundDash = 600;
  const groundOff = groundDash * (1 - groundProgress);

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive",
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      {/* Paper grain + shared ink filter */}
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
            <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain)" fill="white" />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: p ? 20 : 44,
          padding: p ? "8% 8%" : "5% 7%",
        }}
      >
        {/* Scene SVG */}
        <svg
          viewBox="0 0 420 370"
          style={{ width: p ? "84%" : "44%", maxWidth: 640, height: "auto" }}
          fill="none"
        >
          <defs>
            <filter id="inkScene" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="16" result="w" />
              <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>

          <g filter="url(#inkScene)" strokeLinecap="round" strokeLinejoin="round">
            {/* Ground line — wobbly */}
            <line x1={10} y1={310} x2={410} y2={308} stroke={textColor} strokeWidth={7} strokeOpacity={0.2} strokeDasharray={groundDash} strokeDashoffset={groundOff} />
            <line x1={10} y1={310} x2={410} y2={308} stroke={textColor} strokeWidth={3.5} strokeDasharray={groundDash} strokeDashoffset={groundOff} />

            {/* === STICK FIGURE === */}
            {/* Head bleed */}
            <circle cx={110} cy={66} r={30} stroke={textColor} strokeWidth={10} strokeOpacity={0.2} fill="none" strokeDasharray={dash} strokeDashoffset={figOff} />
            {/* Head core */}
            <circle cx={110} cy={66} r={30} stroke={textColor} strokeWidth={5} fill="none" strokeDasharray={dash} strokeDashoffset={figOff} />

            {/* Body */}
            <line x1={110} y1={98} x2={110} y2={218} stroke={textColor} strokeWidth={10} strokeOpacity={0.2} strokeDasharray={dash} strokeDashoffset={figOff} />
            <line x1={110} y1={98} x2={110} y2={218} stroke={textColor} strokeWidth={5} strokeDasharray={dash} strokeDashoffset={figOff} />

            {/* Left arm — wave gesture toward the circle/object */}
            <path d="M110,130 Q82,148 60,168" stroke={textColor} strokeWidth={10} strokeOpacity={0.2} fill="none" strokeDasharray={dash} strokeDashoffset={figOff} />
            <path d="M110,130 Q82,148 60,168" stroke={textColor} strokeWidth={5} fill="none" strokeDasharray={dash} strokeDashoffset={figOff} />

            {/* Right arm — points toward object */}
            <path d="M110,130 Q200,108 240,118" stroke={textColor} strokeWidth={10} strokeOpacity={0.2} fill="none" strokeDasharray={dash} strokeDashoffset={figOff} />
            <path d="M110,130 Q200,108 240,118" stroke={textColor} strokeWidth={5} fill="none" strokeDasharray={dash} strokeDashoffset={figOff} />

            {/* Left leg */}
            <path d="M110,218 Q90,262 72,308" stroke={textColor} strokeWidth={10} strokeOpacity={0.2} fill="none" strokeDasharray={dash} strokeDashoffset={figOff} />
            <path d="M110,218 Q90,262 72,308" stroke={textColor} strokeWidth={5} fill="none" strokeDasharray={dash} strokeDashoffset={figOff} />

            {/* Right leg */}
            <path d="M110,218 Q130,262 148,308" stroke={textColor} strokeWidth={10} strokeOpacity={0.2} fill="none" strokeDasharray={dash} strokeDashoffset={figOff} />
            <path d="M110,218 Q130,262 148,308" stroke={textColor} strokeWidth={5} fill="none" strokeDasharray={dash} strokeDashoffset={figOff} />

            {/* === OBJECT: Big sketchy circle (concept/idea) === */}
            <circle cx={310} cy={155} r={62} stroke={accentColor} strokeWidth={10} strokeOpacity={0.2} fill="none" strokeDasharray={dash} strokeDashoffset={objOff} />
            <circle cx={310} cy={155} r={62} stroke={accentColor} strokeWidth={5} fill="none" strokeDasharray={dash} strokeDashoffset={objOff} />

            {/* Cross inside circle (symbol) */}
            <line x1={258} y1={155} x2={362} y2={155} stroke={accentColor} strokeWidth={9} strokeOpacity={0.2} strokeDasharray={dash} strokeDashoffset={objOff} />
            <line x1={258} y1={155} x2={362} y2={155} stroke={accentColor} strokeWidth={5} strokeDasharray={dash} strokeDashoffset={objOff} />
            <line x1={310} y1={100} x2={310} y2={210} stroke={accentColor} strokeWidth={9} strokeOpacity={0.2} strokeDasharray={dash} strokeDashoffset={objOff} />
            <line x1={310} y1={100} x2={310} y2={210} stroke={accentColor} strokeWidth={5} strokeDasharray={dash} strokeDashoffset={objOff} />

            {/* Small excitement marks around the circle */}
            {[0, 60, 120, 180, 240, 300].map((angle, ai) => {
              const rad = (angle * Math.PI) / 180;
              const cx2 = 310 + Math.cos(rad) * 82;
              const cy2 = 155 + Math.sin(rad) * 82;
              const cx3 = 310 + Math.cos(rad) * 92;
              const cy3 = 155 + Math.sin(rad) * 92;
              return (
                <line
                  key={ai}
                  x1={cx2} y1={cy2} x2={cx3} y2={cy3}
                  stroke={accentColor} strokeWidth={3} strokeOpacity={0.7}
                  strokeDasharray={dash} strokeDashoffset={objOff}
                />
              );
            })}
          </g>
        </svg>

        {/* Text block */}
        <div
          style={{
            flex: 1,
            color: textColor,
            textAlign: p ? "center" : "left",
            opacity: textOp,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              lineHeight: 1.04,
              fontSize: titleFontSize ?? (p ? 64 : 82),
              filter: "url(#ink)",
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: descriptionFontSize ?? (p ? 30 : 38),
              lineHeight: 1.25,
              maxWidth: p ? "100%" : 660,
              filter: "url(#ink)",
            }}
          >
            {narration}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};