import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";

const GLITCH_CHARS = "アイウエオカキクケコ0123456789!@#$%^&*<>{}[]";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * MatrixTitle — Character Decode Hero
 *
 * Title text decodes from random characters on black + digital rain.
 * Each character cycles through random symbols before settling.
 */
export const MatrixTitle: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  bgColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";

  const titleChars = title.split("");
  const decodeFramesPerChar = 3;
  const totalDecodeFrames = titleChars.length * decodeFramesPerChar + 10;

  const subtitleOpacity = interpolate(
    frame,
    [totalDecodeFrames, totalDecodeFrames + 20],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  const subtitleY = spring({
    frame: frame - totalDecodeFrames,
    fps,
    config: { damping: 20, stiffness: 160 },
  });

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
      <MatrixBackground bgColor={bgColor} opacity={0.25} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 40 : 80,
          gap: hasImage ? (p ? 24 : 48) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 38%",
              width: p ? "70%" : "auto",
              height: p ? 220 : 360,
              borderRadius: 0,
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
            flex: hasImage && !p ? 1 : "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h1
            style={{
              fontSize: titleFontSize ?? (p ? 72 : 110),
              fontWeight: 700,
              color: accent,
              fontFamily: "'Fira Code', 'Courier New', monospace",
              textAlign: "center",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              maxWidth: "95%",
              textShadow: `0 0 20px ${accent}88, 0 0 40px ${accent}44`,
            }}
          >
            {titleChars.map((char, i) => {
              const charRevealFrame = i * decodeFramesPerChar + 5;
              const isRevealed = frame >= charRevealFrame;
              const isDecoding =
                frame >= charRevealFrame - 8 && !isRevealed;

              let displayChar = char;
              if (char === " ") {
                displayChar = " ";
              } else if (isDecoding) {
                const glitchIdx = Math.floor(
                  seededRandom(i * 100 + frame * 7) * GLITCH_CHARS.length
                );
                displayChar = GLITCH_CHARS[glitchIdx];
              } else if (!isRevealed && frame < charRevealFrame - 8) {
                displayChar = " ";
              }

              return (
                <span
                  key={i}
                  style={{
                    opacity: char === " " ? 1 : isRevealed || isDecoding ? 1 : 0,
                    color: isDecoding ? `${accent}66` : accent,
                  }}
                >
                  {displayChar}
                </span>
              );
            })}
          </h1>

          {narration && (
            <p
              style={{
                fontSize: descriptionFontSize ?? (p ? 20 : 24),
                fontWeight: 400,
                color: `${accent}88`,
                fontFamily: "'Fira Code', 'Courier New', monospace",
                textAlign: "center",
                marginTop: p ? 20 : 28,
                letterSpacing: "0.08em",
                opacity: subtitleOpacity,
                transform: `translateY(${(1 - subtitleY) * 12}px)`,
                maxWidth: p ? "85%" : 900,
              }}
            >
              {narration}
            </p>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
