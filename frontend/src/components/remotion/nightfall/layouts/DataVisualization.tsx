import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
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
 * - Glass card styling with neon glow effects
 * - Animated chart reveals
 * - Responsive layout for portrait/landscape (now with max 2 graphs in portrait)
 * - Removed image display
 */

export const DataVisualization: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  // imageUrl, // Image display removed per user instruction
  accentColor,
  bgColor,
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

  // Image reveal animations removed
  // const imageOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: "clamp", });
  // const imageScale = spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 80 }, });

  // Narration reveal
  const narrationOpacity = interpolate(frame, [50, 75], [0, 1], {
    extrapolateRight: "clamp",
  });

  // `hasImage` and `shouldShowImage` logic removed
  const shouldShowNarration = narration && narration.trim() && (!hasChart || narration.trim().length > 50);
  
  // Base dimensions for single chart (no image context)
  const baseW = p ? 600 : 900;
  const baseH = p ? 400 : 500;

  // Determine chart dimensions based on layout and chart count
  let chartWidth: number;
  let chartHeight: number;

  if (multiChart) {
    if (p) {
      // Portrait mode: Max 2 graphs in one row.
      // We set a numerical width that allows two charts plus gap to fit,
      // and causes a third chart to wrap to the next row due to `flexWrap`.
      // For a typical portrait Remotion canvas (e.g., 1080px wide) and 95% card width with 32px padding,
      // available space is approx. (1080 * 0.95) - (2 * 32) = 962px.
      // With a 16px gap, two charts can be (962 - 16) / 2 = 473px wide. Using 450px for safety/aesthetics.
      chartWidth = 450;
      chartHeight = 260; // Keep original multi-chart portrait height
    } else {
      // Landscape mode: all charts in one row (original logic)
      chartWidth = Math.min(420, (1400 - 48 * 2 - 32 * (chartCount - 1)) / chartCount);
      chartHeight = Math.min(380, baseH * 0.75); // Keep original multi-chart landscape height
    }
  } else {
    // Single chart (original logic)
    chartWidth = baseW;
    chartHeight = baseH;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />

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
              fontSize: titleFontSize ?? (p ? 67 : 61),
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
            width: p ? "95%" : "85%", // Adjusted width as image is no longer present
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
            flexDirection: "column", // Always column, as no image to place side-by-side
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

          {/* Image Section (removed as per user instruction) */}

          {/* Chart Section — single column or multi-column row */}
          {hasChart && (
            <div
              style={{
                flex: "none", // No longer needs to adjust based on image presence, takes full width
                width: "100%", // Always takes full width of the card's content area
                display: "flex",
                flexDirection: multiChart ? "row" : "column",
                flexWrap: p && multiChart ? "wrap" : "nowrap", // Enables wrapping for multiple charts in portrait
                alignItems: "center",
                justifyContent: multiChart ? "space-evenly" : "center",
                gap: multiChart ? (p ? 16 : 24) : 0,
                opacity: chartOpacity,
                transform: `scale(${chartScale})`,
                minHeight: chartHeight,
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
                    // In portrait mode with multiple charts, explicitly set width to control wrapping.
                    width: multiChart && p ? chartWidth : undefined,
                    // In landscape with multiple charts, use flex: 1 to distribute space.
                    // For single chart or portrait multi-chart, explicitly disable flexing.
                    flex: multiChart && !p ? 1 : "none",
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
                  fontSize: descriptionFontSize ?? (p ? 38 : 30),
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
