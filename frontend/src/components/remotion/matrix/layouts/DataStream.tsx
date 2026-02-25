import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";

/**
 * DataStream — Incoming Data Packets
 *
 * Items appear one at a time, stacking vertically like incoming data.
 * Each item prefixed with `>` terminal prompt + index number.
 * Previous items dim as new ones appear.
 */
export const DataStream: React.FC<MatrixLayoutProps> = ({
  title,
  items,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
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
      <MatrixBackground bgColor={bgColor} opacity={0.2} />

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
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
              border: `1px solid ${accent}33`,
            }}
          >
            <Img
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                  gap: p ? 10 : 16,
                  transform: shown
                    ? `translateX(${(1 - itemSpring) * 80}px)`
                    : "translateX(80px)",
                  opacity: shown ? (dimmed ? 0.3 : itemSpring) : 0,
                }}
              >
                <span
                  style={{
                    fontSize: descriptionFontSize ?? (p ? 20 : 28),
                    fontWeight: 700,
                    color: accent,
                    fontFamily: "'Fira Code', 'Courier New', monospace",
                    minWidth: p ? 70 : 90,
                    textShadow: `0 0 8px ${accent}66`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {">"} {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontSize: descriptionFontSize ?? (p ? 22 : 32),
                    fontWeight: 400,
                    color: accent,
                    fontFamily: "'Fira Code', 'Courier New', monospace",
                    letterSpacing: "0.01em",
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
