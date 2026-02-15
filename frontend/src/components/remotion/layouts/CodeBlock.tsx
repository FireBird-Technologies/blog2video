import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

export const CodeBlock: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  codeLines = [],
  codeLanguage = "",
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const titleOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const codeOp = interpolate(frame, [15, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const codeY = interpolate(frame, [15, 40], [30, 0], {
    extrapolateRight: "clamp",
  });

  // ─── Dynamic sizing ───────────────────────────────────────
  const count = codeLines.length;
  const dense = count > 8;
  const veryDense = count > 14;

  const titleSize = p
    ? veryDense ? 22 : dense ? 26 : 32
    : veryDense ? 28 : dense ? 34 : 42;
  const codeSize = p
    ? veryDense ? 11 : dense ? 13 : 16
    : veryDense ? 14 : dense ? 17 : 22;
  const lineHeight = veryDense ? 1.5 : dense ? 1.7 : 2;
  const titleMb = p
    ? veryDense ? 14 : dense ? 20 : 28
    : veryDense ? 18 : dense ? 28 : 40;
  const codePad = p
    ? veryDense ? "14px 18px" : dense ? "18px 22px" : "24px 28px"
    : veryDense ? "18px 24px" : dense ? "24px 32px" : "32px 40px";

  // Limit visible lines to prevent overflow
  const maxVisibleLines = p
    ? veryDense ? 16 : dense ? 12 : 10
    : veryDense ? 14 : dense ? 12 : 10;
  const visibleLines = codeLines.slice(0, maxVisibleLines);

  const lineReveal = interpolate(frame, [20, 20 + visibleLines.length * 10], [0, visibleLines.length], {
    extrapolateRight: "clamp",
  });
  const cursorBlink = Math.floor(frame / 15) % 2;

  // Terminal-style dark card (always dark regardless of bgColor)
  const termBg = "#1a1a2e";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: p ? "60px 40px" : "80px 100px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <h2
        style={{
          color: textColor,
          fontSize: titleSize,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: titleMb,
          marginTop: 0,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          flexShrink: 0,
        }}
      >
        {title}
      </h2>

      <div
        style={{
          backgroundColor: termBg,
          borderRadius: 16,
          padding: codePad,
          border: "1px solid #333",
          opacity: codeOp,
          transform: `translateY(${codeY}px)`,
          overflow: "hidden",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Terminal dots */}
        <div style={{ display: "flex", gap: 8, marginBottom: p ? 16 : 20, flexShrink: 0 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FEBC2E" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#28C840" }} />
          {codeLanguage && (
            <span
              style={{
                marginLeft: 12,
                fontSize: p ? 11 : 13,
                color: "#666",
                fontFamily: "'Fira Code', 'Courier New', monospace",
              }}
            >
              {codeLanguage}
            </span>
          )}
        </div>

        <div style={{ overflow: "hidden" }}>
          {visibleLines.map((line, i) => (
            <div
              key={i}
              style={{
                fontFamily: "'Fira Code', 'Courier New', monospace",
                fontSize: codeSize,
                lineHeight,
                color: i < Math.floor(lineReveal) ? "#E0E0E0" : "transparent",
                transition: "color 0.3s",
                whiteSpace: "pre",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ color: "#555", marginRight: p ? 10 : 16, fontSize: Math.round(codeSize * 0.72) }}>
                {String(i + 1).padStart(2, " ")}
              </span>
              {line}
              {i === Math.floor(lineReveal) && (
                <span style={{ opacity: cursorBlink, color: accentColor }}>|</span>
              )}
            </div>
          ))}
          {codeLines.length > maxVisibleLines && (
            <div
              style={{
                fontFamily: "'Fira Code', 'Courier New', monospace",
                fontSize: codeSize,
                lineHeight,
                color: "#555",
              }}
            >
              ... +{codeLines.length - maxVisibleLines} more lines
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 4,
          backgroundColor: accentColor,
        }}
      />
    </AbsoluteFill>
  );
};
