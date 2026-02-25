import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";

const GLITCH_CHARS = "アイウエオ0123456789!@#$%^&*<>{}[]|/\\";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * GlitchPunch — Character Scramble Impact
 *
 * ONE word fills the frame. Characters rapidly cycle through random
 * symbols then slam into place with neon glow. Max 1 per video.
 */
export const GlitchPunch: React.FC<MatrixLayoutProps> = ({
  word,
  title,
  imageUrl,
  accentColor,
  bgColor,
  aspectRatio,
  titleFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";

  const displayWord = word || title;
  const chars = displayWord.split("");

  const settleFrame = 25;
  const isSettled = frame >= settleFrame;

  const glowPulse = isSettled
    ? 0.7 + Math.sin((frame - settleFrame) * 0.15) * 0.3
    : 0;

  const scaleSpring = spring({
    frame: frame - settleFrame + 5,
    fps,
    config: { damping: 14, stiffness: 220, mass: 1.1 },
  });

  const scale = isSettled ? 0.9 + scaleSpring * 0.1 : 1;

  const hasImage = !!imageUrl;
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
      <MatrixBackground bgColor={bgColor} opacity={0.15} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: hasImage ? (p ? 24 : 48) : 0,
          padding: p ? "10% 8%" : "0 8%",
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 38%",
              width: p ? "70%" : "auto",
              height: p ? 220 : 360,
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
            fontSize: titleFontSize ?? (p ? 100 : 150),
            fontWeight: 700,
            color: accent,
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
            fontFamily: "'Fira Code', 'Courier New', monospace",
            lineHeight: 1,
            textAlign: "center",
            padding: "0 5%",
            flex: hasImage && !p ? 1 : "none",
            transform: `scale(${scale})`,
            textShadow: isSettled
              ? `0 0 ${20 + glowPulse * 30}px ${accent}${Math.round(glowPulse * 99).toString().padStart(2, "0")}, 0 0 ${40 + glowPulse * 60}px ${accent}44`
              : "none",
          }}
        >
          {chars.map((char, i) => {
            if (char === " ") return <span key={i}> </span>;

            const charSettleFrame = 8 + i * 2;
            const charSettled = frame >= charSettleFrame;

            let displayChar = char;
            if (!charSettled && frame > 2) {
              const glitchIdx = Math.floor(
                seededRandom(i * 200 + frame * 11) * GLITCH_CHARS.length
              );
              displayChar = GLITCH_CHARS[glitchIdx];
            }

            const charOpacity = frame > 2 ? 1 : 0;

            return (
              <span
                key={i}
                style={{
                  opacity: charOpacity,
                  color: charSettled ? accent : `${accent}88`,
                }}
              >
                {displayChar}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
