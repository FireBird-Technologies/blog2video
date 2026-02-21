import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";

/**
 * StatStage — Number Spotlight
 *
 * Giant number with counter roll-up animation centered on black.
 * A small frosted glass card fades in below with label/context.
 * The ONLY glass element in the entire Spotlight template.
 */
export const StatStage: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  metrics,
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
  const hasImage = !!imageUrl;

  const primary = metrics?.[0];
  const numericValue = primary ? parseFloat(primary.value.replace(/,/g, "")) : 0;
  const isNumeric = !isNaN(numericValue) && numericValue > 0;

  const countUpDuration = 36;
  const progress = interpolate(frame, [5, 5 + countUpDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = 1 - Math.pow(1 - progress, 3);
  const displayNumber = isNumeric
    ? Math.round(eased * numericValue)
    : primary?.value || title;

  const cardSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 20, stiffness: 160 },
  });

  const cardOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imageOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imageScale = spring({
    frame: frame - 10,
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
          padding: p ? 40 : 80,
          gap: hasImage ? (p ? 30 : 60) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 35%",
              width: p ? "70%" : "auto",
              height: p ? 200 : 350,
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

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 94 : 140),
              fontWeight: 900,
              color: textColor || "#FFFFFF",
              letterSpacing: "-0.05em",
              lineHeight: 1,
              fontFamily: "'Arial Black', sans-serif",
            }}
          >
            {displayNumber}
            {primary?.suffix && (
              <span style={{ color: accentColor, fontSize: "0.5em" }}>
                {primary.suffix}
              </span>
            )}
          </div>

          <div
            style={{
              marginTop: p ? 16 : 24,
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 4,
              padding: `${p ? 12 : 16}px ${p ? 24 : 36}px`,
              opacity: cardOpacity,
              transform: `translateY(${(1 - cardSpring) * 10}px)`,
              display: "inline-block",
            }}
          >
            <div
              style={{
                fontSize: descriptionFontSize ?? (p ? 18 : 22),
                fontWeight: 700,
                color: textColor || "#FFFFFF",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "Arial, sans-serif",
              }}
            >
              {primary?.label || title}
            </div>
            {(narration || (metrics && metrics.length > 1)) && (
              <div
                style={{
                  fontSize: descriptionFontSize ?? (p ? 14 : 18),
                  color: "#666666",
                  marginTop: 4,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {metrics && metrics.length > 1
                  ? metrics
                      .slice(1)
                      .map((m) => `${m.value}${m.suffix || ""} ${m.label}`)
                      .join(" · ")
                  : narration}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
