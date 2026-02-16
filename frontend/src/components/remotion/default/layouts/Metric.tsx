import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "../types";

export const Metric: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  metrics = [],
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const titleOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // If no metrics provided, show a simple title
  const mainMetric = metrics[0];
  const numericValue = mainMetric ? parseFloat(mainMetric.value.replace(/[^0-9.-]/g, "")) || 0 : 0;
  const animatedNum = Math.floor(
    interpolate(frame, [10, 50], [0, numericValue], {
      extrapolateRight: "clamp",
    })
  );
  const barW = interpolate(frame, [10, 50], [0, Math.min(numericValue, 100)], {
    extrapolateRight: "clamp",
  });
  const subOp = interpolate(frame, [35, 50], [0, 1], {
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
        padding: p ? "60px 50px" : undefined,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -100,
          left: -100,
          width: p ? 350 : 500,
          height: p ? 350 : 500,
          borderRadius: "50%",
          border: `2px solid ${accentColor}15`,
        }}
      />

      <h3
        style={{
          color: textColor,
          fontSize: p ? 18 : 22,
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
        <>
          <div
            style={{
              fontSize: p ? 90 : 120,
              fontWeight: 800,
              fontFamily: "Inter, sans-serif",
              color: textColor,
              lineHeight: 1,
            }}
          >
            {animatedNum}
            <span style={{ color: accentColor }}>
              {mainMetric.suffix || "%"}
            </span>
          </div>

          <div
            style={{
              width: p ? 280 : 380,
              height: 8,
              backgroundColor: `${textColor}20`,
              borderRadius: 4,
              marginTop: p ? 24 : 32,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${barW}%`,
                height: "100%",
                backgroundColor: accentColor,
                borderRadius: 4,
              }}
            />
          </div>

          <p
            style={{
              color: textColor,
              fontSize: p ? 16 : 20,
              fontFamily: "Inter, sans-serif",
              marginTop: p ? 20 : 24,
              marginBottom: 0,
              opacity: subOp * 0.6,
              textAlign: "center",
            }}
          >
            {mainMetric.label}
          </p>
        </>
      )}

      {/* Secondary metrics */}
      {metrics.length > 1 && (
        <div
          style={{
            display: "flex",
            flexDirection: p ? "column" : "row",
            gap: p ? 24 : 50,
            marginTop: p ? 36 : 48,
            opacity: subOp,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {metrics.slice(1).map((m, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: p ? 32 : 42,
                  fontWeight: 700,
                  color: accentColor,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {m.value}
                {m.suffix && <span style={{ fontSize: p ? 20 : 26 }}>{m.suffix}</span>}
              </div>
              <div
                style={{
                  fontSize: p ? 13 : 15,
                  color: textColor,
                  opacity: 0.6,
                  fontFamily: "Inter, sans-serif",
                  marginTop: 8,
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
