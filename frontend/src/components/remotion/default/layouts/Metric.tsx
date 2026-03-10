import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SceneLayoutProps } from "../types";

export const Metric: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  metrics = [],
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
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

  const mainMetric = metrics[0];
  const numericValue = mainMetric ? parseFloat(mainMetric.value.replace(/[^0-9.-]/g, "")) || 0 : 0;
  const animatedNum = Math.floor(
    interpolate(frame, [10, 50], [0, numericValue], {
      extrapolateRight: "clamp",
    })
  );

  // Define circle properties
  const circleSize = p ? 320 : 320; // Diameter of the circle (Increased for portrait)
  const strokeWidth = p ? 20 : 20; // Increased for portrait
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animation for the stroke
  const strokeFillPercentage = interpolate(frame, [10, 50], [0, Math.min(numericValue, 100)], {
    extrapolateRight: "clamp",
  });
  const strokeDashoffset = circumference * (1 - strokeFillPercentage / 100);

  // Spring for the circle's initial scale and opacity
  const circleScaleSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
  });
  const circleScale = interpolate(circleScaleSpring, [0, 1], [0.8, 1], {
    extrapolateRight: "clamp",
  });
  const circleOpacity = interpolate(circleScaleSpring, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subSpring = spring({
    frame: frame - 35,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
  });
  const subOp = interpolate(subSpring, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 50px",
        overflow: "hidden",
      }}
    >
      <h3
        style={{
          color: textColor,
          fontSize: titleFontSize ?? (p ? 45 : 46),
          fontWeight: 500,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp * 0.6,
          marginTop: 0,
          marginBottom: p ? 20 : 24,
          textTransform: "uppercase",
          letterSpacing: 4,
          textAlign: "center",
        }}
      >
        {title}
      </h3>

      {mainMetric && (
        <div // New wrapper for the main metric circle and its label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: p ? 20 : 30, // Space after title
            // marginBottom is handled by secondary metrics' marginTop
          }}
        >
          <div // This div now contains only the circle SVG and the numeric value
            style={{
              position: "relative",
              width: circleSize,
              height: circleSize,
              // Removed marginBottom from here
              opacity: circleOpacity,
              transform: `scale(${circleScale})`,
            }}
          >
            <svg
              width={circleSize}
              height={circleSize}
              viewBox={`0 0 ${circleSize} ${circleSize}`}
              style={{ position: "absolute", top: 0, left: 0 }}
            >
              {/* Background circle */}
              <circle
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                fill="transparent"
                stroke={`${textColor}20`}
                strokeWidth={strokeWidth}
              />
              {/* Animated circle */}
              <circle
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                fill="transparent"
                stroke={accentColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${circleSize / 2} ${circleSize / 2})`}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: p ? 90 : 90,
                  fontWeight: 800,
                  fontFamily: "Inter, sans-serif",
                  color: textColor,
                  lineHeight: 1,
                }}
              >
                {animatedNum}
                <span style={{ color: accentColor, fontSize: p ? 65 : 65 }}>
                  {mainMetric.suffix || "%"}
                </span>
              </div>
              {/* Main metric label moved outside this div */}
            </div>
          </div>
          {mainMetric.label && (
            <p
              style={{
                color: textColor,
                fontSize: descriptionFontSize ?? (p ? 35 : 31),
                fontFamily: "Inter, sans-serif",
                marginTop: p ? 15 : 20, // Space from the bottom of the circle
                marginBottom: 0,
                opacity: 0.8,
                textAlign: "center",
                maxWidth: "80%",
                lineHeight: 1.2,
              }}
            >
              {mainMetric.label}
            </p>
          )}
        </div>
      )}

      {/* Secondary metrics */}
      {metrics.length > 1 && (
        <div
          style={{
            display: "flex",
            flexDirection: "row", // Always row for secondary metrics
            gap: p ? 30 : 60,
            marginTop: p ? 30 : 40, // Space from main metric section (circle + label)
            opacity: subOp,
            alignItems: "flex-start",
            flexWrap: "wrap",
            justifyContent: "center",
            width: "100%",
            padding: p ? "0 20px" : "0 50px",
          }}
        >
          {metrics.slice(1).map((m, i) => (
            <div key={i} style={{ textAlign: "center", minWidth: p ? 80 : 100 }}>
              <div
                style={{
                  fontSize:
                    (i >= 0 && i <= 2)
                      ? (descriptionFontSize ?? (p ? 35 : 31)) + 5
                      : (descriptionFontSize ?? (p ? 35 : 31)),
                  fontWeight: 700,
                  color: accentColor,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {m.value}
                {m.suffix && <span style={{ fontSize: p ? 20 : 25, marginLeft: 2 }}>{m.suffix}</span>}
              </div>
              <div
                style={{
                  fontSize: descriptionFontSize ?? (p ? 35 : 31),
                  color: textColor,
                  opacity: 0.6,
                  fontFamily: "Inter, sans-serif",
                  marginTop: 4,
                  lineHeight: 1.2,
                }}
              >
                {m.label}
              </div>
            </div>
          ))}
        </div>
      )}

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
