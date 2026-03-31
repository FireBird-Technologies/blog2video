import { interpolate } from "remotion";
import type { BarChartData } from "../../nightfall/types";

interface HistogramProps {
  data: BarChartData;
  accentColor: string;
  textColor: string;
  width: number;
  height: number;
  frame: number;
}

/**
 * Histogram — adjacent bins (minimal gap), flat tops, default-template friendly.
 */
export const Histogram: React.FC<HistogramProps> = ({
  data,
  accentColor,
  textColor,
  width,
  height,
  frame,
}) => {
  if (!data?.labels?.length || !data?.values?.length) {
    return (
      <div style={{ color: textColor, padding: 20, fontSize: 14 }}>
        Add histogram bin data
      </div>
    );
  }

  const { labels, values } = data;
  const maxValue = Math.max(...values, 1);
  const n = labels.length;
  const gap = 2;
  const chartHeight = height - 80;
  const padding = 30;
  const totalGaps = (n - 1) * gap;
  const barW = Math.max(4, (width - 2 * padding - totalGaps) / n);

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding + chartHeight * (1 - ratio);
        const opacity = interpolate(frame, [0, 24], [0, 0.12], { extrapolateRight: "clamp" });
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
            strokeDasharray="3 6"
          />
        );
      })}

      {labels.map((label, i) => {
        const value = values[i] ?? 0;
        const normalizedHeight = (value / maxValue) * chartHeight;
        const x = padding + i * (barW + gap);
        const animatedHeight = interpolate(
          frame,
          [i * 4, i * 4 + 26],
          [0, normalizedHeight],
          { extrapolateRight: "clamp" }
        );

        return (
          <g key={i}>
            <rect
              x={x}
              y={padding + chartHeight - animatedHeight}
              width={barW}
              height={animatedHeight}
              fill={accentColor}
              opacity={0.92}
              rx={0}
            />
            <text
              x={x + barW / 2}
              y={padding + chartHeight + 22}
              fill={textColor}
              fontSize={14}
              fontWeight={500}
              textAnchor="middle"
              opacity={interpolate(frame, [i * 4 + 10, i * 4 + 24], [0, 0.85], {
                extrapolateRight: "clamp",
              })}
            >
              {label}
            </text>
          </g>
        );
      })}

      <line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={padding + chartHeight}
        stroke={textColor}
        strokeWidth={1.5}
        strokeOpacity={0.25}
      />
      <line
        x1={padding}
        y1={padding + chartHeight}
        x2={width - padding}
        y2={padding + chartHeight}
        stroke={textColor}
        strokeWidth={1.5}
        strokeOpacity={0.25}
      />
    </svg>
  );
};
