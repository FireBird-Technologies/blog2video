import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  Easing,
  useVideoConfig,
} from "remotion";
import { SceneLayoutProps } from "../types";
import { GeometricBackground } from "../components/GeometricBackground";
import { useFitText } from "../components/useFitText";

export const Metric: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  metrics = [],
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const { height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and the metric label(s) are unbounded user input; this scene has no
     overflow:hidden, but the header/label bands have no height limit of their
     own either, so long copy just grows past the header/gauge and breaks the
     centred layout. Fit the header to a small budget and the main label to a
     modest one — both independent (no cascade needed; the gauge circle
     between them is a fixed size). A size the user explicitly picked is
     honored exactly (minPx === targetPx makes the hook a no-op). */
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const labelRef = React.useRef<HTMLParagraphElement>(null);

  const actualTitleFontSize = titleFontSize ?? (isPortrait ? 40 : 32);
  const actualDescriptionFontSize = descriptionFontSize ?? (isPortrait ? 34 : 28);

  const titleBudgetPx = Math.round(height * 0.1);
  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : isPortrait ? 20 : 16,
    [title, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, isPortrait],
    titleBudgetPx,
  );

  const labelBudgetPx = Math.round(height * 0.12);
  const { px: labelPx } = useFitText(
    labelRef,
    actualDescriptionFontSize,
    descriptionFontSizeIsUserSet ? actualDescriptionFontSize : isPortrait ? 18 : 15,
    [metrics, actualDescriptionFontSize, descriptionFontSizeIsUserSet, titlePx, labelBudgetPx, isPortrait],
    labelBudgetPx,
  );

  // Data Handling
  const mainMetric = metrics[0] || { value: "0", label: "", suffix: "%" };
  const numericValue = parseFloat(mainMetric.value.replace(/[^0-9.-]/g, "")) || 0;

  // Animations
  const entrance = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  
  // Count-up animation with easing for a smoother "landing"
  const animatedNum = interpolate(frame, [20, 70], [0, numericValue], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Gauge Properties
  const circleSize = isPortrait ? 380 : 340;
  const strokeWidth = 16;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Stroke Fill Logic
  const fillProgress = interpolate(frame, [20, 70], [0, Math.min(numericValue, 100)], {
    extrapolateRight: "clamp",
  });
  const strokeDashoffset = circumference * (1 - fillProgress / 100);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: fontFamily ?? "'Roboto Slab', serif",
      }}
    >
      <GeometricBackground accentColor={accentColor} frame={frame} sceneIndex={sceneIndex} />
      {/* BACKGROUND DECORATION */}
      <div style={{
        position: 'absolute',
        width: circleSize * 1.5,
        height: circleSize * 1.5,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)`,
        opacity: interpolate(entrance, [0, 1], [0, 1]),
      }} />

      {/* HEADER */}
      <div style={{
        opacity: interpolate(entrance, [0, 1], [0, 0.6]),
        transform: `translateY(${interpolate(entrance, [0, 1], [-20, 0])}px)`,
        textAlign: "center",
        marginBottom: 40,
        zIndex: 2,
      }}>
        <h3 ref={titleRef} style={{
          color: textColor,
          fontSize: titlePx,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 8,
          margin: 0,
        }}>
          {title}
        </h3>
      </div>

      {/* MAIN GAUGE SECTION */}
      <div style={{
        position: "relative",
        width: circleSize,
        height: circleSize,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: entrance,
        transform: `scale(${entrance})`,
      }}>
        <svg
          width={circleSize}
          height={circleSize}
          viewBox={`0 0 ${circleSize} ${circleSize}`}
          style={{ position: "absolute", transform: "rotate(-90deg)" }}
        >
          {/* Outer Track */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke={textColor}
            strokeOpacity={0.1}
            strokeWidth={strokeWidth}
          />
          {/* Animated Progress Arc */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke={accentColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 10px ${accentColor}66)` }}
          />
        </svg>

        {/* CENTER CONTENT */}
        <div style={{
          backgroundColor: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(12px)",
          borderRadius: "50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          // Modifications for dynamic sizing:
          minWidth: circleSize * 0.8, // Minimum size to start as a circle
          minHeight: circleSize * 0.8, // Minimum size
          padding: 20, // Add padding around content
          boxSizing: 'border-box', // Include padding in min-width/height
          // Removed fixed width/height so it can grow based on content
        }}>
          <div style={{
            fontSize: isPortrait ? 110 : 90,
            fontWeight: 900,
            color: textColor,
            lineHeight: 1,
            display: "flex",
            alignItems: "baseline",
          }}>
            {Math.round(animatedNum)}
            <span style={{ color: accentColor, fontSize: 40, marginLeft: 4 }}>
              {mainMetric.suffix || "%"}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN LABEL - Moved outside the gauge */}
      {mainMetric.label && (
        <div style={{
          textAlign: "center",
          marginTop: 30, // Space from the gauge circle
          marginBottom: 20, // Space before secondary metrics
          opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp" }),
          zIndex: 2, // Ensure it's above background decorations
        }}>
          <p ref={labelRef} style={{
            color: textColor,
            fontSize: labelPx,
            fontWeight: 500,
            margin: 0,
            lineHeight: 1.2,
            maxWidth: isPortrait ? '80%' : '60%', // Control width for text wrapping
            marginInline: 'auto', // Center the paragraph itself
          }}>
            {mainMetric.label}
          </p>
        </div>
      )}

      {/* SECONDARY METRICS (GRID LAYOUT) */}
      {metrics.length > 1 && (
        <div style={{
          display: "flex",
          gap: isPortrait ? 40 : 80,
          marginTop: 60, // Adjusted to account for new label placement
          flexWrap: "wrap",
          justifyContent: "center",
          opacity: interpolate(frame, [50, 70], [0, 1], { extrapolateLeft: "clamp" }),
        }}>
          {metrics.slice(1).map((m, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{
                fontSize: descriptionFontSize ?? (isPortrait ? 34 : 28),
                fontWeight: 800,
                color: accentColor,
                marginBottom: 4,
              }}>
                {m.value}{m.suffix}
              </div>
              <div style={{
                fontSize: descriptionFontSize ?? (isPortrait ? 34 : 28),
                color: textColor,
                opacity: 0.6,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PROGRESS BAR FOOTER */}
      <div style={{
        position: "absolute",
        bottom: 0,
        height: 6,
        width: "100%",
        background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        opacity: 0.5,
      }} />
    </AbsoluteFill>
  );
};
