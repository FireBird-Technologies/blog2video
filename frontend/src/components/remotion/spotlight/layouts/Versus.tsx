import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import type { SpotlightLayoutProps } from "../types";

const SLAM = { stiffness: 200, damping: 12, mass: 1 } as const;

/**
 * Versus — Contrast split-screen.
 *
 * Left half: WHITE background, BLACK text.
 * Right half: BLACK background, WHITE text.
 * Both panels slam in from opposite edges simultaneously.
 * A 3px accent-color neon line divides them at dead center.
 * Creates instant visual tension with the color inversion.
 */
export const Versus: React.FC<SpotlightLayoutProps> = ({
  title,
  leftLabel,
  rightLabel,
  leftDescription,
  rightDescription,
  narration,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const slideS = spring({ frame, fps, config: SLAM });

  // Left panel slides from left (-100% of its width), right from right (+100%)
  const leftTranslate = `translateX(${(1 - slideS) * -100}%)`;
  const rightTranslate = `translateX(${(1 - slideS) * 100}%)`;

  // Labels slide in after panels
  const labelOp = interpolate(frame, [10, 26], [0, 1], { extrapolateRight: "clamp" });

  // Descriptions appear last
  const descOp = interpolate(frame, [24, 40], [0, 1], { extrapolateRight: "clamp" });
  const descY = interpolate(frame, [24, 40], [14, 0], { extrapolateRight: "clamp" });

  const leftText = leftLabel || (title ? title.split(/vs\.?|versus/i)[0]?.trim() : "Before") || "Before";
  const rightText = rightLabel || (title ? title.split(/vs\.?|versus/i)[1]?.trim() : "After") || "After";

  const panelPadding = p ? "0 36px" : "0 72px";

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Left panel — white bg, black text */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          backgroundColor: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: panelPadding,
          paddingRight: p ? "44px" : "88px",
          transform: leftTranslate,
          overflow: "hidden",
          textAlign: "right",
        }}
      >
        <h2
          style={{
            fontSize: p ? 36 : 52,
            fontWeight: 800,
            fontFamily: "Inter, system-ui, sans-serif",
            color: "#000000",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            margin: 0,
            textTransform: "uppercase",
            opacity: labelOp,
          }}
        >
          {leftText}
        </h2>
        {(leftDescription || narration) && (
          <p
            style={{
              fontSize: p ? 15 : 19,
              fontWeight: 500,
              fontFamily: "Inter, system-ui, sans-serif",
              color: "#222222",
              lineHeight: 1.5,
              marginTop: 18,
              maxWidth: p ? 260 : 400,
              opacity: descOp,
              transform: `translateY(${descY}px)`,
            }}
          >
            {leftDescription || ""}
          </p>
        )}
      </div>

      {/* Right panel — black bg, white text */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "50%",
          height: "100%",
          backgroundColor: "#000000",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: panelPadding,
          paddingLeft: p ? "44px" : "88px",
          transform: rightTranslate,
          overflow: "hidden",
        }}
      >
        <h2
          style={{
            fontSize: p ? 36 : 52,
            fontWeight: 800,
            fontFamily: "Inter, system-ui, sans-serif",
            color: "#FFFFFF",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            margin: 0,
            textTransform: "uppercase",
            opacity: labelOp,
          }}
        >
          {rightText}
        </h2>
        {rightDescription && (
          <p
            style={{
              fontSize: p ? 15 : 19,
              fontWeight: 500,
              fontFamily: "Inter, system-ui, sans-serif",
              color: "#BBBBBB",
              lineHeight: 1.5,
              marginTop: 18,
              maxWidth: p ? 260 : 400,
              opacity: descOp,
              transform: `translateY(${descY}px)`,
            }}
          >
            {rightDescription}
          </p>
        )}
      </div>

      {/* Accent divider — neon line at exact center */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 3,
          height: "100%",
          backgroundColor: accentColor,
          boxShadow: `0 0 24px ${accentColor}, 0 0 8px ${accentColor}`,
          transform: "translateX(-50%)",
        }}
      />
    </AbsoluteFill>
  );
};
