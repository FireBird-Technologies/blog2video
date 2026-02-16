import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "../types";

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
  const lineReveal = interpolate(frame, [20, 20 + codeLines.length * 10], [0, codeLines.length], {
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
      }}
    >
      <h2
        style={{
          color: textColor,
          fontSize: p ? 32 : 42,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: p ? 28 : 40,
        }}
      >
        {title}
      </h2>

      <div
        style={{
          backgroundColor: termBg,
          borderRadius: 16,
          padding: p ? "24px 28px" : "32px 40px",
          border: "1px solid #333",
          opacity: codeOp,
          transform: `translateY(${codeY}px)`,
        }}
      >
        {/* Terminal dots */}
        <div style={{ display: "flex", gap: 8, marginBottom: p ? 16 : 20 }}>
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

        {codeLines.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: "'Fira Code', 'Courier New', monospace",
              fontSize: p ? 16 : 22,
              lineHeight: 2,
              color: i < Math.floor(lineReveal) ? "#E0E0E0" : "transparent",
              transition: "color 0.3s",
              whiteSpace: "pre",
            }}
          >
            <span style={{ color: "#555", marginRight: p ? 10 : 16, fontSize: p ? 12 : 16 }}>
              {String(i + 1).padStart(2, " ")}
            </span>
            {line}
            {i === Math.floor(lineReveal) && (
              <span style={{ opacity: cursorBlink, color: accentColor }}>|</span>
            )}
          </div>
        ))}
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
