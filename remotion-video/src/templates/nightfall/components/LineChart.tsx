import { interpolate, useCurrentFrame } from "remotion";
import type { LineChartData } from "../types";

interface LineChartProps {
  data: LineChartData;
  accentColor: string;
  textColor: string;
  width: number;
  height: number;
  frame: number;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  accentColor,
  textColor,
  width,
  height,
  frame,
}) => {
  const { labels, datasets } = data;
  const maxValue = Math.max(
    ...datasets.flatMap((d) => d.values),
    1
  );
  const chartWidth = width - 60;
  const chartHeight = height - 80;
  const padding = 30;
  const pointSpacing = chartWidth / (labels.length - 1 || 1);

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

      {/* Draw each dataset */}
      {datasets.map((dataset, datasetIdx) => {
        const color = dataset.color || accentColor;
        const points = labels.map((label, i) => {
          const value = dataset.values[i] || 0;
          const x = padding + i * pointSpacing;
          const y = padding + chartHeight - (value / maxValue) * chartHeight;
          return { x, y, value, label };
        });

        // Animate path drawing
        const pathProgress = interpolate(
          frame,
          [datasetIdx * 20, datasetIdx * 20 + 60],
          [0, 1],
          { extrapolateRight: "clamp" }
        );

        // Build path string
        let pathD = "";
        points.forEach((point, i) => {
          if (i === 0) {
            pathD += `M ${point.x} ${point.y}`;
          } else {
            const prevPoint = points[i - 1];
            const cp1x = prevPoint.x + (point.x - prevPoint.x) / 2;
            const cp1y = prevPoint.y;
            const cp2x = prevPoint.x + (point.x - prevPoint.x) / 2;
            const cp2y = point.y;
            pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
          }
        });

        // Calculate visible path length
        const totalLength = pathD.length;
        const visibleLength = Math.floor(totalLength * pathProgress);
        const visiblePath = pathD.slice(0, visibleLength);

        return (
          <g key={datasetIdx}>
            {/* Gradient for line */}
            <defs>
              <linearGradient id={`lineGradient-${datasetIdx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="1" />
              </linearGradient>
            </defs>

            {/* Area under curve */}
            <path
              d={`${pathD} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`}
              fill={`url(#lineGradient-${datasetIdx})`}
              opacity={interpolate(
                frame,
                [datasetIdx * 20 + 30, datasetIdx * 20 + 60],
                [0, 0.2],
                { extrapolateRight: "clamp" }
              )}
            />

            {/* Line */}
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={pathProgress}
              style={{
                filter: `drop-shadow(0 0 6px ${color}80)`,
              }}
            />

            {/* Points */}
            {points.map((point, i) => {
              const pointOpacity = interpolate(
                frame,
                [datasetIdx * 20 + i * 8, datasetIdx * 20 + i * 8 + 15],
                [0, 1],
                { extrapolateRight: "clamp" }
              );
              const pointScale = interpolate(
                frame,
                [datasetIdx * 20 + i * 8, datasetIdx * 20 + i * 8 + 15],
                [0, 1],
                { extrapolateRight: "clamp" }
              );

              return (
                <g key={i}>
                  {/* Glow */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={6}
                    fill={color}
                    opacity={0.4 * pointOpacity}
                    filter="blur(4px)"
                  />
                  {/* Point */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={4}
                    fill={color}
                    opacity={pointOpacity}
                    transform={`scale(${pointScale})`}
                    style={{
                      filter: `drop-shadow(0 0 8px ${color})`,
                    }}
                  />
                  {/* Value label */}
                  {pointOpacity > 0.5 && (
                    <text
                      x={point.x}
                      y={point.y - 12}
                      fill={textColor}
                      fontSize={11}
                      fontWeight={600}
                      textAnchor="middle"
                      opacity={pointOpacity}
                    >
                      {point.value}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Dataset label */}
            {dataset.label && (
              <text
                x={width - padding - 10}
                y={padding + datasetIdx * 20 + 15}
                fill={color}
                fontSize={12}
                fontWeight={600}
                textAnchor="end"
                opacity={interpolate(
                  frame,
                  [datasetIdx * 20 + 40, datasetIdx * 20 + 60],
                  [0, 1],
                  { extrapolateRight: "clamp" }
                )}
              >
                ● {dataset.label}
              </text>
            )}
          </g>
        );
      })}

      {/* X-axis labels */}
      {labels.map((label, i) => {
        const x = padding + i * pointSpacing;
        return (
          <text
            key={i}
            x={x}
            y={padding + chartHeight + 20}
            fill={textColor}
            fontSize={11}
            opacity={0.6}
            textAnchor="middle"
            opacity={interpolate(
              frame,
              [i * 5, i * 5 + 20],
              [0, 0.6],
              { extrapolateRight: "clamp" }
            )}
          >
            {label}
          </text>
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
