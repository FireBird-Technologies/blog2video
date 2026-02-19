import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import type { SpotlightLayoutProps } from "../types";

/**
 * Versus — Contrast Split
 *
 * Screen splits vertically: left = white bg / black text, right = black bg / white text.
 * Thin accent neon divider down the middle. Both sides slide in from opposite edges.
 * Color inversion creates instant visual tension.
 */
export const Versus: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  leftLabel,
  rightLabel,
  leftDescription,
  rightDescription,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const leftSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 18, stiffness: 200, mass: 1 },
  });

  const rightSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 18, stiffness: 200, mass: 1 },
  });

  const lineSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 20, stiffness: 180 },
  });

  const displayLeftLabel = leftLabel || "Before";
  const displayRightLabel = rightLabel || "After";
  const displayLeftDesc = leftDescription || narration || "";
  const displayRightDesc = rightDescription || "";

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: p ? "column" : "row",
        overflow: "hidden",
      }}
    >
      {/* Left — White background */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "8%",
          transform: p
            ? `translateY(${(1 - leftSpring) * -60}px)`
            : `translateX(${(1 - leftSpring) * -60}px)`,
          opacity: leftSpring,
        }}
      >
        <div
          style={{
            fontSize: p ? 14 : 18,
            fontWeight: 700,
            color: "#666666",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontFamily: "Arial, sans-serif",
            marginBottom: 12,
          }}
        >
          {displayLeftLabel}
        </div>
        <div
          style={{
            fontSize: p ? 32 : 48,
            fontWeight: 900,
            color: "#000000",
            textAlign: "center",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            fontFamily: "'Arial Black', sans-serif",
          }}
        >
          {title && !leftLabel ? title : displayLeftLabel}
        </div>
        {displayLeftDesc && (
          <div
            style={{
              fontSize: p ? 12 : 16,
              color: "#888888",
              marginTop: 12,
              textAlign: "center",
              fontFamily: "Arial, sans-serif",
              maxWidth: "90%",
            }}
          >
            {displayLeftDesc}
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          width: p ? "100%" : 3,
          height: p ? 3 : "100%",
          backgroundColor: accentColor,
          boxShadow: `0 0 12px ${accentColor}, 0 0 24px ${accentColor}44`,
          transform: p ? `scaleX(${lineSpring})` : `scaleY(${lineSpring})`,
          transformOrigin: "center",
          flexShrink: 0,
        }}
      />

      {/* Right — Black background */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#000000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "8%",
          transform: p
            ? `translateY(${(1 - rightSpring) * 60}px)`
            : `translateX(${(1 - rightSpring) * 60}px)`,
          opacity: rightSpring,
        }}
      >
        <div
          style={{
            fontSize: p ? 14 : 18,
            fontWeight: 700,
            color: "#666666",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontFamily: "Arial, sans-serif",
            marginBottom: 12,
          }}
        >
          {displayRightLabel}
        </div>
        <div
          style={{
            fontSize: p ? 32 : 48,
            fontWeight: 900,
            color: "#FFFFFF",
            textAlign: "center",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            fontFamily: "'Arial Black', sans-serif",
          }}
        >
          {displayRightLabel}
        </div>
        {displayRightDesc && (
          <div
            style={{
              fontSize: p ? 12 : 16,
              color: "#666666",
              marginTop: 12,
              textAlign: "center",
              fontFamily: "Arial, sans-serif",
              maxWidth: "90%",
            }}
          >
            {displayRightDesc}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
