import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import type { SpotlightLayoutProps } from "../types";

/**
 * Versus — Contrast Split
 *
 * Screen splits vertically: left = white bg / black text, right = black bg / white text.
 * Optional image alongside when available.
 */
export const Versus: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  leftLabel,
  rightLabel,
  leftDescription,
  rightDescription,
  imageUrl,
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
  const hasImage = !!imageUrl;

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: hasImage && !p ? "row" : (p ? "column" : "row"),
        overflow: "hidden",
      }}
    >
      {hasImage && (
        <div
          style={{
            flex: p ? "none" : "0 0 38%",
            width: p ? "100%" : "auto",
            height: p ? 280 : "100%",
            padding: p ? "8% 8% 0" : "8% 0 0 8%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
          }}
        >
          <div style={{ width: "100%", height: "100%", borderRadius: 4, overflow: "hidden" }}>
            <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: p ? "column" : "row",
          minWidth: 0,
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
            fontSize: p ? 28 : 40,
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
            fontSize: p ? 28 : 40,
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
      </div>
    </AbsoluteFill>
  );
};
