import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import type { SpotlightLayoutProps } from "../types";

const SLAM = { stiffness: 200, damping: 12, mass: 1 } as const;

function chunkLines(text: string, perLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += perLine) {
    lines.push(words.slice(i, i + perLine).join(" "));
  }
  return lines;
}

function renderLine(
  line: string,
  highlightWord: string | undefined,
  accentColor: string,
  fontSize: number
) {
  if (!highlightWord) return <>{line}</>;
  const hl = highlightWord.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    <>
      {line.split(" ").map((w, i, arr) => {
        const clean = w.toLowerCase().replace(/[^a-z0-9]/g, "");
        const isHL = clean === hl;
        return (
          <span
            key={i}
            style={
              isHL
                ? {
                    color: accentColor,
                    fontSize: fontSize * 1.15,
                    display: "inline-block",
                  }
                : {}
            }
          >
            {w}{i < arr.length - 1 ? " " : ""}
          </span>
        );
      })}
    </>
  );
}

/**
 * Statement — Sentence drop layout.
 *
 * Text splits into ~3 lines. Each line springs in from above with staggered
 * delays (7 frames apart). The `highlightWord` is rendered in accent color
 * at 1.15x size — surgical single accent per scene.
 */
export const Statement: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  highlightWord,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const text = narration || title;
  const fontSize = p ? 44 : 58;
  const lines = chunkLines(text, p ? 4 : 5);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: p ? 56 : 120,
        }}
      >
        {lines.map((line, i) => {
          const delay = i * 7;
          const lineS = spring({ frame: frame - delay, fps, config: SLAM });
          const lineY = (1 - lineS) * -70;
          const lineOp = interpolate(frame, [delay, delay + 10], [0, 1], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                fontSize,
                fontWeight: 800,
                fontFamily: "Inter, system-ui, sans-serif",
                color: "#FFFFFF",
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
                opacity: lineOp,
                transform: `translateY(${lineY}px)`,
                marginBottom: i < lines.length - 1 ? 6 : 0,
                textTransform: "uppercase",
              }}
            >
              {renderLine(line, highlightWord, accentColor, fontSize)}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
