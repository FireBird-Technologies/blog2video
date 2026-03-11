import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import type { SpotlightLayoutProps } from "../types";

/**
 * CascadeList — Stacking Items
 *
 * Items appear one at a time, stacking vertically over a background image.
 * Each item is a bold number in accent color + white text.
 * Previous items dim as new ones appear.
 */
export const CascadeList: React.FC<SpotlightLayoutProps> = ({
  title,
  items,
  imageUrl,
  accentColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const displayItems = items || [title];
  const framesPerItem = 18;
  const currentIdx = Math.min(
    Math.floor(frame / framesPerItem),
    displayItems.length - 1
  );

  const bgOpacity = interpolate(frame, [0, 20], [0, 1]);
  const bgScale = spring({
    frame,
    fps,
    config: { damping: 200 },
    from: 1.1,
    to: 1,
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill>
        {imageUrl ? (
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: bgOpacity,
              transform: `scale(${bgScale})`,
            }}
          />
        ) : (
          <AbsoluteFill style={{ backgroundColor: "#111111" }} />
        )}
        <AbsoluteFill style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }} />
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "8%",
        }}
      >
        <div
          style={{
            width: "90%",
            maxWidth: 1000,
            display: "flex",
            flexDirection: "column",
            gap: p ? 12 : 20,
          }}
        >
          {displayItems.map((item, i) => {
            const itemSpring = spring({
              frame: frame - i * framesPerItem - 5,
              fps,
              config: { damping: 18, stiffness: 180, mass: 1 },
            });

            const shown = frame >= i * framesPerItem + 5;
            const dimmed = shown && i < currentIdx;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: p ? 12 : 24,
                  transform: shown
                    ? `translateX(${(1 - itemSpring) * 80}px)`
                    : "translateX(80px)",
                  opacity: shown ? (dimmed ? 0.4 : itemSpring) : 0,
                }}
              >
                <span
                  style={{
                    fontSize: titleFontSize ?? (p ? 22 : 34),
                    fontWeight: 900,
                    color: accentColor,
                    minWidth: p ? 28 : 44,
                    fontFamily: "'Arial Black', sans-serif",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontSize: descriptionFontSize ?? (p ? 24 : 36),
                    fontWeight: 700,
                    color: textColor || "#FFFFFF",
                    fontFamily: "Arial, sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
