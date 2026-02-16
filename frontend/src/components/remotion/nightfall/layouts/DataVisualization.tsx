import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";

/**
 * DataVisualization — Frontend Preview Component
 * 
 * Simplified version for preview - shows chart type and data info
 */

export const DataVisualization: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  textColor,
  aspectRatio,
  barChart,
  lineChart,
  pieChart,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const chartType = barChart ? "Bar Chart" : lineChart ? "Line Chart" : pieChart ? "Pie Chart" : "No Chart";

  const cardY = spring({
    frame: frame - 5,
    fps,
    config: { damping: 22, stiffness: 75, mass: 1 },
  });

  const cardOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground />
      
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 40 : 60,
        }}
      >
        <div
          style={{
            ...glassCardStyle(accentColor, 0.1),
            width: p ? "95%" : "85%",
            maxWidth: 1400,
            padding: p ? 32 : 48,
            transform: `translateY(${(1 - cardY) * 30}px)`,
            opacity: cardOpacity,
            position: "relative",
            boxShadow: `
              0 8px 32px rgba(0, 0, 0, 0.3),
              0 0 0 1px rgba(255, 255, 255, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.08)
            `,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "10%",
              width: "80%",
              height: 2,
              background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)`,
              opacity: cardOpacity,
            }}
          />

          {title && (
            <h2
              style={{
                fontSize: p ? 28 : 36,
                fontWeight: 700,
                color: textColor,
                fontFamily: "Inter, system-ui, sans-serif",
                textAlign: "center",
                opacity: titleOpacity,
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h2>
          )}

          <div
            style={{
              width: "100%",
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${accentColor}10 0%, transparent 100%)`,
              borderRadius: 12,
              border: `1px solid ${accentColor}30`,
            }}
          >
            <div
              style={{
                fontSize: p ? 24 : 32,
                fontWeight: 600,
                color: accentColor,
                textAlign: "center",
              }}
            >
              {chartType}
              <div
                style={{
                  fontSize: p ? 14 : 16,
                  color: textColor,
                  opacity: 0.7,
                  marginTop: 12,
                }}
              >
                {barChart && `${barChart.labels.length} categories`}
                {lineChart && `${lineChart.datasets.length} datasets`}
                {pieChart && `${pieChart.labels.length} segments`}
              </div>
            </div>
          </div>

          {narration && (
            <p
              style={{
                fontSize: p ? 18 : 22,
                color: textColor,
                opacity: 0.9,
                fontFamily: "Inter, system-ui, sans-serif",
                lineHeight: 1.6,
                textAlign: "center",
                fontWeight: 400,
              }}
            >
              {narration}
            </p>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
