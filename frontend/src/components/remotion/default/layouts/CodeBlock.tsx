import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import { GeometricBackground } from "../components/GeometricBackground";

export const CodeBlock: React.FC<SceneLayoutProps> = ({
  aspectRatio,
  title,
  accentColor = '#8be9fd',
  bgColor = '#282a36',
  textColor = '#f8f8f2',
  codeLines = [],
<<<<<<< HEAD
  codeLanguage = "",
  descriptionFontSize,
  titleFontSize,
  fontFamily,
=======
  descriptionFontSize,
  titleFontSize,
  fontFamily,
  sceneIndex,
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

<<<<<<< HEAD
  // Animation for the title
  const titleSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [25, 0]);
=======
  // ── Entrance animations ──────────────────────────────────────────────────
  const titleSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 22, stiffness: 90, mass: 1 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [22, 0]);
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb

  const cardSpring = spring({
    frame: frame - 14,
    fps,
    config: { damping: 22, stiffness: 85, mass: 1 },
  });
<<<<<<< HEAD
  const codeOp = interpolate(codeSpring, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const codeY = interpolate(codeSpring, [0, 1], [25, 0], {
    extrapolateRight: "clamp",
  });
  const codeScale = interpolate(codeSpring, [0, 1], [0.96, 1], {
    extrapolateRight: "clamp",
  });
=======
  const cardOp = interpolate(cardSpring, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const cardY = interpolate(cardSpring, [0, 1], [28, 0], { extrapolateRight: "clamp" });
  const cardScale = interpolate(cardSpring, [0, 1], [0.96, 1], { extrapolateRight: "clamp" });

  // ── Exit animations ──────────────────────────────────────────────────────
  const EXIT_DUR = 20;
  const exitStart = Math.max(0, durationInFrames - EXIT_DUR);
  const exitProg = spring({
    frame: frame - exitStart,
    fps,
    config: { damping: 24, stiffness: 100 },
    durationInFrames: EXIT_DUR,
  });
  const exitOp = interpolate(exitProg, [0, 1], [1, 0], { extrapolateLeft: "clamp" });
  const exitScale = interpolate(exitProg, [0, 1], [1, 0.97], { extrapolateLeft: "clamp" });

  // Resolve terminal card colours: always dark for readability, but slightly
  // tinted by bgColor so it doesn't feel totally disconnected.
  const isDark = (hex: string) => {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  };
  const bgIsDark = isDark(bgColor);
  // Terminal card: dark on light backgrounds, slightly lighter dark on dark backgrounds
  const cardBg = bgIsDark ? "#1e1e2e" : "#16161e";
  const codeTextColor = "#e2e8f0";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb

  return (
    <AbsoluteFill
      style={{
<<<<<<< HEAD
        background: 'linear-gradient(135deg, #432b6c, #277d7f)',
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center", // This centers the contentWrapper
=======
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
        overflow: "hidden",
        // gap removed from here, moved to contentWrapper
      }}
    >
<<<<<<< HEAD
      {/* New container for title and code block to control their alignment */}
=======
      {/* Template background — matches all other geometric scenes */}
      <GeometricBackground
        accentColor={accentColor}
        frame={frame}
        sceneIndex={sceneIndex}
      />

      {/* Content wrapper: title + terminal card */}
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
      <div
        style={{
          display: "flex",
          flexDirection: "column",
<<<<<<< HEAD
          alignItems: "flex-start", // Aligns title and code block to the left
          gap: p ? 20 : 30, // Gap between title and code block
          width: p ? '85%' : '75%', // Overall width for the combined title and code block
        }}
      >
=======
          alignItems: "flex-start",
          gap: p ? 20 : 30,
          width: p ? "88%" : "76%",
          opacity: exitOp,
          transform: `scale(${exitScale})`,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Scene title — uses project textColor */}
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
        {title && (
          <div
            style={{
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
<<<<<<< HEAD
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

=======
              fontSize: titleFontSize ?? (p ? 72 : 60),
              color: textColor,
              fontWeight: 800,
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
        )}

        {/* Terminal card — dark, accent-framed */}
        <div
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            padding: p ? "22px 26px" : "30px 38px",
            opacity: cardOp,
            transform: `translateY(${cardY}px) scale(${cardScale})`,
            overflow: "hidden",
            boxShadow: `0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px ${accentColor}30`,
            width: "100%",
            minHeight: p ? 420 : 320,
            // Accent top border — the "framing" that ties the card to the template
            borderTop: `3px solid ${accentColor}`,
          }}
        >
          {/* Traffic-light dots */}
          <div style={{ display: "flex", gap: 8, marginBottom: p ? 16 : 20 }}>
            <div style={{ width: 13, height: 13, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
            <div style={{ width: 13, height: 13, borderRadius: "50%", backgroundColor: "#FEBC2E" }} />
            <div style={{ width: 13, height: 13, borderRadius: "50%", backgroundColor: "#28C840" }} />
          </div>

>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
          <pre
            style={{
              margin: 0,
              fontFamily: "'Fira Code', 'Courier New', monospace",
<<<<<<< HEAD
              fontSize: descriptionFontSize ?? (p ? 46 : 38),
              lineHeight: 1.7,
              color: accentColor,
=======
              fontSize: descriptionFontSize ?? (p ? 40 : 32),
              lineHeight: 1.75,
              color: codeTextColor,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
            }}
          >
            <code>
              {codeLines.map((line, index) => (
<<<<<<< HEAD
                <div key={index}>{line}</div>
=======
                <div key={index}>
                  {/* Accent colour for lines that look like keywords / headings */}
                  <span style={{ color: line.startsWith("//") || line.startsWith("#") ? `${accentColor}cc` : codeTextColor }}>
                    {line}
                  </span>
                </div>
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
              ))}
            </code>
          </pre>
        </div>
      </div>
    </AbsoluteFill>
  );
};
