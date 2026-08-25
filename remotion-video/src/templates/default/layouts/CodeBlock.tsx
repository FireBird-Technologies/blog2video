import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import { GeometricBackground } from "../components/GeometricBackground";
import { useFitText, useAvailableHeight } from "../components/useFitText";

export const CodeBlock: React.FC<SceneLayoutProps> = ({
  aspectRatio,
  title,
  accentColor,
  bgColor,
  textColor,
  codeLines = [],
  descriptionFontSize,
  titleFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height } = useVideoConfig();
  const p = aspectRatio === "portrait";

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and code are unbounded user input. The card grows to fit the code
     (only `minHeight` is set) inside a wrapper with no height limit of its
     own, so a long title or many code lines just grow past the frame and get
     clipped by the AbsoluteFill's overflow:hidden. Fit the title to its own
     budget, then the code block to the space left in the wrapper (measured
     via offsetTop/offsetHeight, which the card's scale-in transform does not
     perturb, unlike getBoundingClientRect). A size the user explicitly
     picked is honored exactly (minPx === targetPx makes the hook a no-op). */
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLDivElement>(null);
  const codeRef = React.useRef<HTMLPreElement>(null);

  const actualTitleFontSize = titleFontSize ?? (p ? 72 : 60);
  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 40 : 32);

  const titleBudgetPx = Math.round(height * (p ? 0.16 : 0.18));
  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 32 : 26,
    [title, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, p],
    titleBudgetPx,
  );

  const codeAvail = useAvailableHeight(codeRef, wrapperRef, [
    title, titlePx, codeLines, actualDescriptionFontSize, p,
  ]);
  const { px: codePx } = useFitText(
    codeRef,
    actualDescriptionFontSize,
    descriptionFontSizeIsUserSet ? actualDescriptionFontSize : p ? 16 : 13,
    [codeLines, actualDescriptionFontSize, descriptionFontSizeIsUserSet, titlePx, codeAvail, p],
    codeAvail || undefined,
  );

  // ── Entrance animations ──────────────────────────────────────────────────
  const titleSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 22, stiffness: 90, mass: 1 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [22, 0]);

  const cardSpring = spring({
    frame: frame - 14,
    fps,
    config: { damping: 22, stiffness: 85, mass: 1 },
  });
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

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Template background — matches all other geometric scenes */}
      <GeometricBackground
        accentColor={accentColor}
        frame={frame}
        sceneIndex={sceneIndex}
      />

      {/* Content wrapper: title + terminal card */}
      <div
        ref={wrapperRef}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: p ? 20 : 30,
          width: p ? "88%" : "76%",
          maxHeight: "84%",
          opacity: exitOp,
          transform: `scale(${exitScale})`,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Scene title — uses project textColor */}
        {title && (
          <div
            ref={titleRef}
            style={{
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
              fontSize: titlePx,
              color: textColor,
              fontWeight: 800,
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              lineHeight: 1.1,
              flexShrink: 0,
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

          <pre
            ref={codeRef}
            style={{
              margin: 0,
              fontFamily: "'Fira Code', 'Courier New', monospace",
              fontSize: codePx,
              lineHeight: 1.75,
              color: codeTextColor,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <code>
              {codeLines.map((line, index) => (
                <div key={index}>
                  {/* Accent colour for lines that look like keywords / headings */}
                  <span style={{ color: line.startsWith("//") || line.startsWith("#") ? `${accentColor}cc` : codeTextColor }}>
                    {line}
                  </span>
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </AbsoluteFill>
  );
};
