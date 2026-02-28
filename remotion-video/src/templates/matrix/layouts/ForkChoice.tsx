import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import type { MatrixLayoutProps } from "../types";

/**
 * ForkChoice — Red Pill / Blue Pill Split
 *
 * Screen splits vertically: left = red-tinted, right = blue-tinted.
 * Green neon divider. Both sides slide in from opposite edges.
 * Optional image alongside.
 */
export const ForkChoice: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  leftLabel,
  rightLabel,
  leftDescription,
  rightDescription,
  imageUrl,
  accentColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";

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

  const displayLeftLabel = leftLabel || "Red Pill";
  const displayRightLabel = rightLabel || "Blue Pill";
  const displayLeftDesc = leftDescription || narration || "";
  const displayRightDesc = rightDescription || "";
  const hasImage = !!imageUrl;

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imageScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: hasImage && !p ? "row" : p ? "column" : "row",
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
            backgroundColor: "#000000",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              border: `1px solid ${accent}33`,
            }}
          >
            <Img
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
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
        {/* Left — Red Pill */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#1a0808",
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
              fontSize: p ? 12 : 16,
              fontWeight: 700,
              color: "#EF444488",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "'Fira Code', 'Courier New', monospace",
              marginBottom: 12,
            }}
          >
            {">"} {displayLeftLabel}
          </div>
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 30 : 44),
              fontWeight: 700,
              color: "#EF4444",
              textAlign: "center",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              fontFamily: "'Fira Code', 'Courier New', monospace",
              textShadow: "0 0 16px #EF444444",
            }}
          >
            {title && !leftLabel ? title : displayLeftLabel}
          </div>
          {displayLeftDesc && (
            <div
              style={{
                fontSize: descriptionFontSize ?? (p ? 14 : 18),
                color: "#EF444488",
                marginTop: 12,
                textAlign: "center",
                fontFamily: "'Fira Code', 'Courier New', monospace",
                maxWidth: "90%",
              }}
            >
              {displayLeftDesc}
            </div>
          )}
        </div>

        {/* Green Divider */}
        <div
          style={{
            width: p ? "100%" : 3,
            height: p ? 3 : "100%",
            backgroundColor: accent,
            boxShadow: `0 0 12px ${accent}, 0 0 24px ${accent}44`,
            transform: p ? `scaleX(${lineSpring})` : `scaleY(${lineSpring})`,
            transformOrigin: "center",
            flexShrink: 0,
          }}
        />

        {/* Right — Blue Pill */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#080818",
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
              fontSize: p ? 12 : 16,
              fontWeight: 700,
              color: "#3B82F688",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "'Fira Code', 'Courier New', monospace",
              marginBottom: 12,
            }}
          >
            {">"} {displayRightLabel}
          </div>
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 30 : 44),
              fontWeight: 700,
              color: "#3B82F6",
              textAlign: "center",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              fontFamily: "'Fira Code', 'Courier New', monospace",
              textShadow: "0 0 16px #3B82F644",
            }}
          >
            {displayRightLabel}
          </div>
          {displayRightDesc && (
            <div
              style={{
                fontSize: descriptionFontSize ?? (p ? 14 : 18),
                color: "#3B82F688",
                marginTop: 12,
                textAlign: "center",
                fontFamily: "'Fira Code', 'Courier New', monospace",
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
