import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";

const CIPHER_CHARS = "0123456789ABCDEF!@#$%ΔΣΩλ";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * CipherMetric — Number Decode
 *
 * Giant number decodes from cipher noise with counter roll-up.
 * Terminal-style card below with label. Green glow on number.
 */
export const CipherMetric: React.FC<MatrixLayoutProps> = ({
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
  const accent = accentColor || "#00FF41";
  const hasImage = !!imageUrl;

  const primary = metrics?.[0];
  const numericValue = primary
    ? parseFloat(primary.value.replace(/,/g, ""))
    : 0;
  const isNumeric = !isNaN(numericValue) && numericValue > 0;

  const decodePhase = frame < 20; // cipher noise phase
  const countUpDuration = 36;
  const progress = interpolate(frame, [20, 20 + countUpDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = 1 - Math.pow(1 - progress, 3);

  let displayNumber: string;
  if (decodePhase) {
    // Show cipher noise
    const valueStr = primary?.value || title;
    displayNumber = valueStr
      .split("")
      .map((_, i) => {
        const idx = Math.floor(
          seededRandom(i * 100 + frame * 7) * CIPHER_CHARS.length
        );
        return CIPHER_CHARS[idx];
      })
      .join("");
  } else if (isNumeric) {
    displayNumber = String(Math.round(eased * numericValue));
  } else {
    displayNumber = primary?.value || title;
  }

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
  const imageScaleVal = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const glowPulse = !decodePhase
    ? 0.6 + Math.sin(frame * 0.1) * 0.4
    : 0.3;

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
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScaleVal})`,
              border: `1px solid ${accent}33`,
            }}
          >
            <Img
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 90 : 130),
              fontWeight: 700,
              color: accent,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              fontFamily: "'Fira Code', 'Courier New', monospace",
              textShadow: `0 0 ${20 * glowPulse}px ${accent}88, 0 0 ${40 * glowPulse}px ${accent}44`,
            }}
          >
            {displayNumber}
            {primary?.suffix && !decodePhase && (
              <span style={{ color: `${accent}88`, fontSize: "0.5em" }}>
                {primary.suffix}
              </span>
            )}
          </div>

          {/* Terminal card with label */}
          <div
            style={{
              marginTop: p ? 16 : 24,
              border: `1px solid ${accent}44`,
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
                color: accent,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "'Fira Code', 'Courier New', monospace",
              }}
            >
              {primary?.label || title}
            </div>
            {(narration || (metrics && metrics.length > 1)) && (
              <div
                style={{
                  fontSize: descriptionFontSize ?? (p ? 14 : 18),
                  color: `${accent}66`,
                  marginTop: 4,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
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
