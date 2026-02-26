import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

// Typewriter speed: characters per second at 30fps
const CHARS_PER_SEC = 30;

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

  const titleDurationFrames = Math.ceil(title.length * (fps / CHARS_PER_SEC));
  const titleChars = Math.min(
    title.length,
    Math.floor(interpolate(frame, [0, titleDurationFrames], [0, title.length], { extrapolateRight: "clamp" }))
  );
  const narrationStartFrame = 15 + titleDurationFrames;
  const narrationDurationFrames = Math.ceil(narration.length * (fps / CHARS_PER_SEC));
  const narrationChars = Math.min(
    narration.length,
    Math.max(0, Math.floor(interpolate(frame, [narrationStartFrame, narrationStartFrame + narrationDurationFrames], [0, narration.length], { extrapolateRight: "clamp" })))
  );

  const lineW = interpolate(frame, [8 + titleDurationFrames, 12 + titleDurationFrames + narrationDurationFrames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const visibleTitle = title.slice(0, titleChars);
  const visibleNarration = narration.slice(0, narrationChars);
  const stickmanProgress = interpolate(frame, [14, 38], [0, 1], { extrapolateRight: "clamp" });
  const stickmanDash = 280;
  const stickmanOffset = stickmanDash * (1 - stickmanProgress);

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive" }}>
      <WhiteboardBackground bgColor={bgColor} />
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
        {/* Title typewriter */}
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: "100%" }}>
          <span
            style={{
              color: textColor,
              fontWeight: 700,
              lineHeight: 1.05,
              fontSize: titleFontSize ?? (p ? 82 : 118),
              letterSpacing: "0.01em",
            }}
          >
            {visibleTitle}
          </span>
        </div>

        <div
          style={{
            marginTop: p ? 16 : 22,
            width: `${lineW}%`,
            maxWidth: p ? 440 : 720,
            height: 5,
            borderRadius: 9999,
            backgroundColor: accentColor,
          }}
        />

        {/* Narration typewriter */}
        <div style={{ marginTop: p ? 18 : 24, position: "relative", display: "inline-flex", alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: p ? "100%" : "76%" }}>
          <span
            style={{
              color: textColor,
              fontSize: descriptionFontSize ?? (p ? 30 : 36),
              fontWeight: 500,
            }}
          >
            {visibleNarration}
          </span>
        </div>
      </div>

      {/* Sitting stick figure bottom-right, looking at the heading */}
      <svg
        style={{
          position: "absolute",
          right: p ? "5%" : "6%",
          bottom: p ? "6%" : "7%",
          width: p ? "18%" : "12%",
          height: "auto",
          pointerEvents: "none",
        }}
        viewBox="0 0 100 120"
        fill="none"
      >
        <circle cx="50" cy="22" r="14" fill="none" stroke={textColor} strokeWidth="4" strokeDasharray={stickmanDash} strokeDashoffset={stickmanOffset} />
        <line x1="50" y1="38" x2="50" y2="72" stroke={textColor} strokeWidth="4" strokeDasharray={stickmanDash} strokeDashoffset={stickmanOffset} />
        <line x1="50" y1="48" x2="28" y2="58" stroke={textColor} strokeWidth="4" strokeDasharray={stickmanDash} strokeDashoffset={stickmanOffset} />
        <line x1="50" y1="48" x2="72" y2="52" stroke={textColor} strokeWidth="4" strokeDasharray={stickmanDash} strokeDashoffset={stickmanOffset} />
        <path d="M 50 72 L 32 98 L 38 102" stroke={textColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={stickmanDash} strokeDashoffset={stickmanOffset} />
        <path d="M 50 72 L 68 98 L 62 102" stroke={textColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={stickmanDash} strokeDashoffset={stickmanOffset} />
      </svg>
    </AbsoluteFill>
  );
};
