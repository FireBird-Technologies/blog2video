import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";
import { BarChart } from "../components/BarChart";
import { LineChart } from "../components/LineChart";
import { PieChart } from "../components/PieChart";

/**
 * DataVisualization — Enhanced Professional Version
 * 
 * Features:
 * - Supports bar charts, line charts, and pie charts
 * - Shows images alongside charts when available
 * - Glass card styling with neon glow effects
 * - Animated chart reveals
 * - Responsive layout for portrait/landscape
 */

export const DataVisualization: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  textColor,
  aspectRatio,
  barChart: barChartData,
  lineChart: lineChartData,
  pieChart: pieChartData,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Collect all available charts (show multiple in columns)
  const charts: { type: "bar" | "line" | "pie"; data: unknown }[] = [];
  if (barChartData) charts.push({ type: "bar", data: barChartData });
  if (lineChartData) charts.push({ type: "line", data: lineChartData });
  if (pieChartData) charts.push({ type: "pie", data: pieChartData });
  const chartCount = charts.length;
  const hasChart = chartCount > 0;
  const multiChart = chartCount > 1;

  // Card entrance animation
  const cardY = spring({
    frame: frame - 5,
    fps,
    config: { damping: 22, stiffness: 75, mass: 1 },
  });

  const cardOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Title reveal
  const titleOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleY = interpolate(frame, [10, 35], [20, 0], {
    extrapolateRight: "clamp",
  });

  // Chart reveal
  const chartOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const chartScale = spring({
    frame: frame - 30,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  // Image reveal
  const imageOpacity = interpolate(frame, [20, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imageScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  // Narration reveal
  const narrationOpacity = interpolate(frame, [50, 75], [0, 1], {
    extrapolateRight: "clamp",
  });

  const hasImage = !!imageUrl;
  // Hide narration and image when charts are present and user wants visualization only
  const shouldShowNarration = narration && narration.trim() && (!hasChart || narration.trim().length > 50);
  const shouldShowImage = hasImage && (!hasChart || !shouldShowNarration);
  // When multiple charts: smaller size per column; when single: larger
  const baseW = p ? 600 : shouldShowImage ? 700 : 900;
  const baseH = p ? 400 : shouldShowImage ? 450 : 500;
  const chartWidth = multiChart ? (p ? 280 : Math.min(420, (1400 - 48 * 2 - 32 * (chartCount - 1)) / chartCount)) : baseW;
  const chartHeight = multiChart ? (p ? 260 : Math.min(380, baseH * 0.75)) : baseH;

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
        {/* Title */}
        {title && (
          <h2
            style={{
              fontSize: titleFontSize ?? (p ? 34 : 46),
              fontWeight: 600,
              color: textColor,
              fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
              marginBottom: p ? 24 : 32,
              textAlign: "center",
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
        )}

        {/* Main Content Container */}
        <div
          style={{
            ...glassCardStyle(accentColor, 0.1),
            width: p ? "95%" : hasImage && hasChart ? "95%" : "85%",
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
            flexDirection: p ? "column" : shouldShowImage && hasChart ? "row" : "column",
            gap: p ? 24 : 32,
            alignItems: "center",
          }}
        >
          {/* Top accent line */}
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

          {/* Image Section */}
          {shouldShowImage && (
            <div
              style={{
                flex: p ? "none" : "0 0 35%",
                width: p ? "100%" : "auto",
                height: p ? 200 : chartHeight,
                position: "relative",
                opacity: imageOpacity,
                transform: `scale(${imageScale})`,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <Img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: 12,
                  border: `1px solid ${accentColor}30`,
                }}
              />
              {/* Image glow overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(135deg, ${accentColor}10 0%, transparent 50%)`,
                  pointerEvents: "none",
                }}
              />
            </div>
          )}

          {/* Chart Section — single column or multi-column row */}
          {hasChart && (
            <div
              style={{
                flex: shouldShowImage && !p ? 1 : "none",
                width: p ? "100%" : shouldShowImage ? "65%" : "100%",
                display: "flex",
                flexDirection: multiChart ? "row" : "column",
                flexWrap: p && multiChart ? "wrap" : "nowrap",
                alignItems: "center",
                justifyContent: multiChart ? "space-evenly" : "center",
                gap: multiChart ? (p ? 16 : 24) : 0,
                opacity: chartOpacity,
                transform: `scale(${chartScale})`,
                minHeight: multiChart ? chartHeight : chartHeight,
                position: "relative",
              }}
            >
              {charts.map(({ type, data }) => (
                <div
                  key={type}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: multiChart ? 1 : "none",
                    minWidth: multiChart ? 0 : undefined,
                  }}
                >
                  {type === "bar" && (
                    <BarChart
                      data={data as Parameters<typeof BarChart>[0]["data"]}
                      accentColor={accentColor}
                      textColor={textColor}
                      width={chartWidth}
                      height={chartHeight}
                      frame={frame}
                    />
                  )}
                  {type === "line" && (
                    <LineChart
                      data={data as Parameters<typeof LineChart>[0]["data"]}
                      accentColor={accentColor}
                      textColor={textColor}
                      width={chartWidth}
                      height={chartHeight}
                      frame={frame}
                    />
                  )}
                  {type === "pie" && (
                    <PieChart
                      data={data as Parameters<typeof PieChart>[0]["data"]}
                      accentColor={accentColor}
                      textColor={textColor}
                      width={chartWidth}
                      height={chartHeight}
                      frame={frame}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Narration Section */}
          {shouldShowNarration && (
            <div
              style={{
                width: "100%",
                opacity: narrationOpacity,
                marginTop: hasChart ? (p ? 20 : 0) : 0,
                paddingTop: hasChart ? (p ? 20 : 0) : 0,
                borderTop: hasChart
                  ? `1px solid rgba(255, 255, 255, 0.1)`
                  : "none",
              }}
            >
              <p
                style={{
                  fontSize: descriptionFontSize ?? 25,
                  color: "rgba(226,232,240,0.8)",
                  opacity: 0.9,
                  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                  lineHeight: 1.7,
                  textAlign: "center",
                  fontWeight: 400,
                }}
              >
                {narration}
              </p>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
