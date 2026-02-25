import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SceneLayoutProps } from "../types";

export const CodeBlock: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  codeLines = [],
  codeLanguage = "",
  aspectRatio,
  titleFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const titleSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 22, stiffness: 90, mass: 1 },
  });
  const titleOp = interpolate(titleSpring, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Code block springs in with scale + slide
  const codeSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
  });
  const codeOp = interpolate(codeSpring, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const codeY = interpolate(codeSpring, [0, 1], [25, 0], {
    extrapolateRight: "clamp",
  });
  const codeScale = interpolate(codeSpring, [0, 1], [0.96, 1], {
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
        overflow: "hidden",
      }}
    >
      <h2
        style={{
          color: textColor,
          fontSize: titleFontSize ?? (p ? 32 : 44),
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginTop: 0,
          marginBottom: p ? 24 : 32,
        }}
      >
        {title}
      </h2>

      <div
        style={{
          backgroundColor: termBg,
          borderRadius: 16,
          padding: p ? "20px 24px" : "28px 36px",
          border: "1px solid #333",
          opacity: codeOp,
          transform: `translateY(${codeY}px) scale(${codeScale})`,
          overflow: "hidden",
        }}
      >
        {/* Terminal dots */}
        <div style={{ display: "flex", gap: 8, marginBottom: p ? 14 : 18 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FEBC2E" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#28C840" }} />
          {codeLanguage && (
            <span
              style={{
                marginLeft: 12,
                fontSize: p ? 10 : 12,
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
              fontSize: p ? 14 : 18,
              lineHeight: 1.8,
              color: i < Math.floor(lineReveal) ? "#E0E0E0" : "transparent",
              transition: "color 0.3s",
              whiteSpace: "pre",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span style={{ color: "#555", marginRight: p ? 10 : 16, fontSize: p ? 11 : 14 }}>
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
