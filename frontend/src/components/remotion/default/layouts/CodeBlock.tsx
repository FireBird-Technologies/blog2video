import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SceneLayoutProps } from "../types";

export const CodeBlock: React.FC<SceneLayoutProps> = ({
  aspectRatio,
  title,
  accentColor = '#8be9fd',
  bgColor = '#282a36',
  textColor = '#f8f8f2',
  codeLines = [],
  codeLanguage = "",
  descriptionFontSize,
  titleFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Animation for the title
  const titleSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [25, 0]);

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

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #432b6c, #277d7f)',
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center", // This centers the contentWrapper
        overflow: "hidden",
        // gap removed from here, moved to contentWrapper
      }}
    >
      {/* New container for title and code block to control their alignment */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start", // Aligns title and code block to the left
          gap: p ? 20 : 30, // Gap between title and code block
          width: p ? '85%' : '75%', // Overall width for the combined title and code block
        }}
      >
        {title && (
          <div
            style={{
              fontFamily: "'Fira Code', 'Courier New', monospace",
              fontSize: titleFontSize ?? (p ? 99 : 77),
              color: "#ffffff",
              fontWeight: 'bold',
              // textAlign: 'center' removed: now aligned by parent's alignItems
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
            }}
          >
            {title}
          </div>
        )}
        <div
          style={{
            backgroundColor: bgColor,
            borderRadius: 10,
            padding: p ? "24px 28px" : "32px 40px",
            opacity: codeOp,
            transform: `translateY(${codeY}px) scale(${codeScale})`,
            overflow: "hidden",
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            width: '100%', // Take full width of its parent (contentWrapper)
            height: 'auto',
            minWidth: p ? 400 : 800,
            minHeight: p ? 600 : 400,
          }}
        >
          {/* Terminal dots */}
          <div style={{ display: "flex", gap: 8, marginBottom: p ? 16 : 20 }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
            <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FEBC2E" }} />
            <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#28C840" }} />
          </div>

          <pre
            style={{
              margin: 0,
              fontFamily: "'Fira Code', 'Courier New', monospace",
              fontSize: descriptionFontSize ?? (p ? 46 : 38),
              lineHeight: 1.7,
              color: accentColor,
            }}
          >
            <code>
              {codeLines.map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </AbsoluteFill>
  );
};
