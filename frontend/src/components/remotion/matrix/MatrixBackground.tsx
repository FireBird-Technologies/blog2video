import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useMemo } from "react";

/**
 * MatrixBackground — Digital Rain
 *
 * Black background with columns of falling green characters.
 * Uses useCurrentFrame for deterministic, frame-accurate animation.
 */

const MATRIX_CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

interface RainColumn {
  x: number;
  speed: number;
  startOffset: number;
  chars: string[];
  fontSize: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export const MatrixBackground: React.FC<{
  bgColor?: string;
  opacity?: number;
}> = ({ bgColor = "#000000", opacity = 0.35 }) => {
  const frame = useCurrentFrame();

  const columns: RainColumn[] = useMemo(() => {
    const cols: RainColumn[] = [];
    const colCount = 55;
    for (let i = 0; i < colCount; i++) {
      const charCount = 18 + Math.floor(seededRandom(i * 7 + 3) * 14);
      const chars: string[] = [];
      for (let j = 0; j < charCount; j++) {
        const idx = Math.floor(
          seededRandom(i * 100 + j * 13 + 7) * MATRIX_CHARS.length
        );
        chars.push(MATRIX_CHARS[idx]);
      }
      cols.push({
        x: (i / colCount) * 100,
        speed: 1.5 + seededRandom(i * 31 + 11) * 3,
        startOffset: seededRandom(i * 17 + 5) * 800,
        chars,
        fontSize: 14 + Math.floor(seededRandom(i * 23) * 6),
      });
    }
    return cols;
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {columns.map((col, ci) => {
        const yOffset =
          ((frame * col.speed + col.startOffset) % (col.chars.length * 28)) -
          col.chars.length * 14;

        return (
          <div
            key={ci}
            style={{
              position: "absolute",
              left: `${col.x}%`,
              top: yOffset,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity,
              willChange: "transform",
            }}
          >
            {col.chars.map((char, chi) => {
              const isHead = chi === col.chars.length - 1;
              const distFromHead = col.chars.length - 1 - chi;
              const fadeOpacity = isHead
                ? 1
                : Math.max(0, 1 - distFromHead * 0.07);

              // Randomly change some characters each frame for living effect
              const shouldMutate =
                seededRandom(ci * 1000 + chi * 100 + (frame % 8)) > 0.85;
              const displayChar = shouldMutate
                ? MATRIX_CHARS[
                    Math.floor(
                      seededRandom(ci * 500 + chi * 50 + frame) *
                        MATRIX_CHARS.length
                    )
                  ]
                : char;

              return (
                <span
                  key={chi}
                  style={{
                    color: isHead ? "#FFFFFF" : "#00FF41",
                    fontSize: col.fontSize,
                    fontFamily: "'Fira Code', 'Courier New', monospace",
                    lineHeight: "1.4",
                    opacity: fadeOpacity,
                    textShadow: isHead
                      ? "0 0 12px #FFFFFF, 0 0 24px #00FF41"
                      : fadeOpacity > 0.5
                        ? "0 0 8px #00FF41"
                        : "none",
                  }}
                >
                  {displayChar}
                </span>
              );
            })}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
