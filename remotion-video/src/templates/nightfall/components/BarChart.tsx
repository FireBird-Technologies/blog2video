import { interpolate, useCurrentFrame } from "remotion";
import type { BarChartData } from "../types";

interface BarChartProps {
  data: BarChartData;
  accentColor: string;
  textColor: string;
  width: number;
  height: number;
  frame: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  accentColor,
  textColor,
  width,
  height,
  frame,
}) => {
  // Validate data structure
  if (!data || !data.labels || !data.values) {
    console.error("[BarChart] Invalid data structure:", data);
    return (
      <div style={{ color: textColor, padding: 20 }}>
        Invalid chart data: {JSON.stringify(data)}
      </div>
    );
  }

  const { labels, values, colors } = data;
  
  // Validate arrays
  if (!Array.isArray(labels) || !Array.isArray(values) || labels.length === 0 || values.length === 0) {
    console.error("[BarChart] Invalid arrays:", { labels, values });
    return (
      <div style={{ color: textColor, padding: 20 }}>
        Chart data missing labels or values
      </div>
    );
  }

  const maxValue = Math.max(...values, 1);
  const barWidth = (width - 60) / labels.length;
  const chartHeight = height - 80;
  const padding = 30;

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding + chartHeight * (1 - ratio);
        const opacity = interpolate(frame, [0, 30], [0, 0.15], {
          extrapolateRight: "clamp",
        });
        return (
          <line
            key={ratio}
            x1={padding}
            y1={y}
            x2={width - padding}
            y2={y}
            stroke={textColor}
            strokeWidth={1}
            strokeOpacity={opacity}
            strokeDasharray="4 4"
          />
        );
      })}

      {/* Bars */}
      {labels.map((label, i) => {
        const value = values[i] || 0;
        const normalizedHeight = (value / maxValue) * chartHeight;
        const x = padding + i * barWidth + barWidth * 0.1;
        const barW = barWidth * 0.8;
        const y = padding + chartHeight - normalizedHeight;

        // Animate bar height
        const animatedHeight = interpolate(
          frame,
          [i * 5, i * 5 + 30],
          [0, normalizedHeight],
          { extrapolateRight: "clamp" }
        );

        const barColor = colors?.[i] || accentColor;
        const glowIntensity = Math.sin(frame / 20 + i) * 0.3 + 0.7;

        return (
          <g key={i}>
            {/* Glow effect */}
            <rect
              x={x}
              y={padding + chartHeight - animatedHeight}
              width={barW}
              height={animatedHeight}
              fill={barColor}
              opacity={0.3 * glowIntensity}
              filter="blur(8px)"
            />
            {/* Main bar */}
            <rect
              x={x}
              y={padding + chartHeight - animatedHeight}
              width={barW}
              height={animatedHeight}
              fill={barColor}
              rx={4}
              style={{
                filter: `drop-shadow(0 0 8px ${barColor}80)`,
              }}
            />
            {/* Value label on bar */}
            {animatedHeight > 30 && (
              <text
                x={x + barW / 2}
                y={padding + chartHeight - animatedHeight - 8}
                fill={textColor}
                fontSize={14}
                fontWeight={600}
                textAnchor="middle"
                opacity={interpolate(
                  frame,
                  [i * 5 + 20, i * 5 + 35],
                  [0, 1],
                  { extrapolateRight: "clamp" }
                )}
              >
                {value}
              </text>
            )}
            {/* X-axis label */}
            <text
              x={x + barW / 2}
              y={padding + chartHeight + 20}
              fill={textColor}
              fontSize={12}
              textAnchor="middle"
              opacity={interpolate(
                frame,
                [i * 5 + 15, i * 5 + 30],
                [0, 0.7],
                { extrapolateRight: "clamp" }
              )}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Y-axis */}
      <line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={padding + chartHeight}
        stroke={textColor}
        strokeWidth={2}
        strokeOpacity={0.3}
      />
      {/* X-axis */}
      <line
        x1={padding}
        y1={padding + chartHeight}
        x2={width - padding}
        y2={padding + chartHeight}
        stroke={textColor}
        strokeWidth={2}
        strokeOpacity={0.3}
      />
    </svg>
  );
};
