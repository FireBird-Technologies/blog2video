import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";

/**
 * CascadeList — Stacking Items
 *
 * Items appear one at a time, stacking vertically. Each item is a bold number
 * in accent color + white text. Previous items dim as new ones appear.
 * Raw text on black, no cards or backgrounds.
 */
export const CascadeList: React.FC<SpotlightLayoutProps> = ({
  title,
  items,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const hasImage = !!imageUrl;

  const displayItems = items || [title];
  const framesPerItem = 18;
  const currentIdx = Math.min(
    Math.floor(frame / framesPerItem),
    displayItems.length - 1
  );

  const imageOpacity = interpolate(frame, [5, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imageScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "8% 8%" : "0 8%",
          gap: hasImage ? (p ? 30 : 60) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 35%",
              width: p ? "70%" : "auto",
              height: p ? 200 : 360,
              borderRadius: 4,
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
            }}
          >
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        )}

        <div
          style={{
            width: hasImage && !p ? "60%" : "85%",
            display: "flex",
            flexDirection: "column",
            gap: p ? 12 : 20,
          }}
        >
          {displayItems.map((item, i) => {
            const itemSpring = spring({
              frame: frame - i * framesPerItem,
              fps,
              config: { damping: 18, stiffness: 180, mass: 1 },
            });

            const shown = frame >= i * framesPerItem;
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
                  opacity: shown ? (dimmed ? 0.3 : itemSpring) : 0,
                }}
              >
                <span
                  style={{
                    fontSize: p ? 18 : 28,
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
                    fontSize: p ? 20 : 30,
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
