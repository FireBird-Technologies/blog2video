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
  const textOp = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });
  const drawProgress = interpolate(frame, [0, 36], [0, 1], { extrapolateRight: "clamp" });

  const dash = 400;
  const offset = dash * (1 - drawProgress);

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive" }}>
      <WhiteboardBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: p ? 20 : 40,
          padding: p ? "8% 8%" : "6% 8%",
        }}
      >
        <svg
          viewBox="0 0 400 360"
          style={{
            width: p ? "82%" : "42%",
            maxWidth: 620,
            height: "auto",
          }}
        >
          <circle cx="120" cy="72" r="28" fill="none" stroke={textColor} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="120" y1="102" x2="120" y2="210" stroke={textColor} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="120" y1="132" x2="72" y2="174" stroke={textColor} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="120" y1="132" x2="168" y2="174" stroke={textColor} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="120" y1="210" x2="82" y2="292" stroke={textColor} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="120" y1="210" x2="160" y2="292" stroke={textColor} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} />

          <circle cx="292" cy="160" r="56" fill="none" stroke={accentColor} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="252" y1="160" x2="332" y2="160" stroke={accentColor} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} />
          <line x1="292" y1="120" x2="292" y2="200" stroke={accentColor} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} />
          <path d="M176 160 C 208 160, 226 160, 246 160" fill="none" stroke={accentColor} strokeWidth="5" strokeDasharray={dash} strokeDashoffset={offset} />
        </svg>

        <div style={{ flex: 1, opacity: textOp, color: textColor, textAlign: p ? "center" : "left" }}>
          <div
            style={{
              fontWeight: 700,
              lineHeight: 1.04,
              fontSize: titleFontSize ?? (p ? 66 : 84),
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: descriptionFontSize ?? (p ? 30 : 38),
              lineHeight: 1.2,
              maxWidth: p ? "100%" : 680,
            }}
          >
            {narration}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
