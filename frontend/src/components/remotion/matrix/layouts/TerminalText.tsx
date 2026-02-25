import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";

/**
 * TerminalText — Green Terminal Typewriter
 *
 * Monospace text types in character-by-character with blinking cursor.
 * One highlighted word glows brighter. Optional image alongside.
 */
export const TerminalText: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  imageUrl,
  highlightWord,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const hasImage = !!imageUrl;

  const displayText = narration || title;
  const charsToShow = Math.min(
    Math.floor(frame * 1.8),
    displayText.length
  );
  const visibleText = displayText.slice(0, charsToShow);
  const isTyping = charsToShow < displayText.length;
  const cursorVisible = isTyping || frame % 30 < 15;

  const words = visibleText.split(" ");

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
      <MatrixBackground bgColor={bgColor} opacity={0.2} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "10% 8%" : "0 8%",
          gap: hasImage ? (p ? 30 : 60) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 38%",
              width: p ? "80%" : "auto",
              height: p ? 240 : 400,
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
              border: `1px solid ${accent}33`,
              position: "relative",
            }}
          >
            <Img
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Scanline overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${accent}08 2px, ${accent}08 4px)`,
                pointerEvents: "none",
              }}
            />
          </div>
        )}

        <div style={{ width: hasImage && !p ? "58%" : "85%", maxWidth: 1000 }}>
          {/* Prompt prefix */}
          <span
            style={{
              fontSize: titleFontSize ?? (p ? 36 : 48),
              fontWeight: 700,
              color: accent,
              fontFamily: "'Fira Code', 'Courier New', monospace",
              textShadow: `0 0 10px ${accent}66`,
            }}
          >
            {">"}&nbsp;
          </span>

          {/* Typed text */}
          {words.map((word, wi) => {
            const cleanWord = word.toLowerCase().replace(/[.,!?]/g, "");
            const isHighlight =
              highlightWord && cleanWord === highlightWord.toLowerCase();

            return (
              <span
                key={wi}
                style={{
                  fontSize: titleFontSize ?? (p ? 36 : 48),
                  fontWeight: isHighlight ? 700 : 400,
                  color: isHighlight ? "#FFFFFF" : accent,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  lineHeight: 1.4,
                  textShadow: isHighlight
                    ? `0 0 16px ${accent}, 0 0 32px ${accent}66`
                    : "none",
                }}
              >
                {word}{" "}
              </span>
            );
          })}

          {/* Blinking cursor */}
          {cursorVisible && (
            <span
              style={{
                fontSize: titleFontSize ?? (p ? 36 : 48),
                fontWeight: 400,
                color: accent,
                fontFamily: "'Fira Code', 'Courier New', monospace",
                textShadow: `0 0 10px ${accent}`,
              }}
            >
              █
            </span>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
