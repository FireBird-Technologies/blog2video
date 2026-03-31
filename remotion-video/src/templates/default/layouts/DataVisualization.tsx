import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import type { SceneLayoutProps } from "../types";
import { BarChart } from "../../nightfall/components/BarChart";
import { LineChart } from "../../nightfall/components/LineChart";
import type { BarChartData, LineChartData } from "../../nightfall/types";
import { Histogram } from "../components/Histogram";

/**
 * Data visualization — bar, line, and histogram; default template (light) styling.
 */
export const DataVisualization: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  barChart: barChartData,
  lineChart: lineChartData,
  histogram: histogramData,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const charts: { type: "bar" | "line" | "histogram"; data: BarChartData | LineChartData }[] = [];
  if (barChartData) charts.push({ type: "bar", data: barChartData });
  if (lineChartData) charts.push({ type: "line", data: lineChartData });
  if (histogramData) charts.push({ type: "histogram", data: histogramData });
  const chartCount = charts.length;
  const hasChart = chartCount > 0;
  const multiChart = chartCount > 1;

  const cardY = spring({
    frame: frame - 5,
    fps,
    config: { damping: 22, stiffness: 75, mass: 1 },
  });
  const cardOpacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [8, 28], [12, 0], { extrapolateRight: "clamp" });
  const chartOpacity = interpolate(frame, [22, 48], [0, 1], { extrapolateRight: "clamp" });
  const chartScale = spring({
    frame: frame - 22,
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const narrationOpacity = interpolate(frame, [42, 68], [0, 1], { extrapolateRight: "clamp" });

  const shouldShowNarration =
    narration && narration.trim() && (!hasChart || narration.trim().length > 50);

  const baseW = p ? 560 : 880;
  const baseH = p ? 380 : 460;
  let chartWidth: number;
  let chartHeight: number;

  if (multiChart) {
    if (p) {
      chartWidth = 420;
      chartHeight = 240;
    } else {
      chartWidth = Math.min(400, (1320 - 40 * 2 - 24 * (chartCount - 1)) / chartCount);
      chartHeight = Math.min(360, baseH * 0.72);
    }
  } else {
    chartWidth = baseW;
    chartHeight = baseH;
  }

  const cardBg = bgColor || "#F5F5F7";
  const subtleBorder = `1px solid rgba(0,0,0,0.08)`;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: cardBg }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 36 : 52,
        }}
      >
        {title && (
          <h2
            style={{
              fontSize: titleFontSize ?? (p ? 58 : 52),
              fontWeight: 700,
              color: textColor,
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
              marginBottom: p ? 20 : 28,
              textAlign: "center",
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h2>
        )}

        <div
          style={{
            width: p ? "94%" : "88%",
            maxWidth: 1320,
            padding: p ? 28 : 40,
            borderRadius: 20,
            background: "#FFFFFF",
            border: subtleBorder,
            boxShadow: "0 12px 40px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.9) inset",
            transform: `translateY(${(1 - cardY) * 20}px)`,
            opacity: cardOpacity,
            display: "flex",
            flexDirection: "column",
            gap: p ? 20 : 26,
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "8%",
              width: "84%",
              height: 3,
              borderRadius: 2,
              background: `linear-gradient(90deg, transparent, ${accentColor}55, transparent)`,
              opacity: cardOpacity,
            }}
          />

          {hasChart && (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: multiChart ? "row" : "column",
                flexWrap: p && multiChart ? "wrap" : "nowrap",
                alignItems: "center",
                justifyContent: multiChart ? "space-evenly" : "center",
                gap: multiChart ? (p ? 14 : 22) : 0,
                opacity: chartOpacity,
                transform: `scale(${chartScale})`,
                minHeight: chartHeight,
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
                    width: multiChart && p ? chartWidth : undefined,
                    flex: multiChart && !p ? 1 : "none",
                    minWidth: multiChart ? 0 : undefined,
                  }}
                >
                  {type === "bar" && (
                    <BarChart
                      data={data as BarChartData}
                      accentColor={accentColor}
                      textColor={textColor}
                      width={chartWidth}
                      height={chartHeight}
                      frame={frame}
                    />
                  )}
                  {type === "line" && (
                    <LineChart
                      data={data as LineChartData}
                      accentColor={accentColor}
                      textColor={textColor}
                      width={chartWidth}
                      height={chartHeight}
                      frame={frame}
                    />
                  )}
                  {type === "histogram" && (
                    <Histogram
                      data={data as BarChartData}
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

          {shouldShowNarration && (
            <div
              style={{
                width: "100%",
                opacity: narrationOpacity,
                marginTop: hasChart ? (p ? 12 : 4) : 0,
                paddingTop: hasChart ? (p ? 16 : 12) : 0,
                borderTop: hasChart ? `1px solid rgba(0,0,0,0.06)` : "none",
              }}
            >
              <p
                style={{
                  fontSize: descriptionFontSize ?? (p ? 30 : 26),
                  color: textColor,
                  opacity: 0.82,
                  fontFamily: fontFamily ?? "'Roboto Slab', serif",
                  lineHeight: 1.65,
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
