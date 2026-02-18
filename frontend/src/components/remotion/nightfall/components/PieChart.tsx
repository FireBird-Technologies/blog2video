import { interpolate, useCurrentFrame } from "remotion";
import type { PieChartData } from "../types";

interface PieChartProps {
  data: PieChartData;
  accentColor: string;
  textColor: string;
  width: number;
  height: number;
  frame: number;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  accentColor,
  textColor,
  width,
  height,
  frame,
}) => {
  const { labels, values, colors } = data;
  const total = values.reduce((sum, val) => sum + val, 0);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 60;
  const padding = 30;

  // Generate colors if not provided
  const defaultColors = [
    accentColor,
    "#60A5FA",
    "#34D399",
    "#FBBF24",
    "#F87171",
    "#A78BFA",
  ];
  const chartColors = colors || defaultColors;

  // Calculate angles
  let currentAngle = -Math.PI / 2; // Start from top
  const segments = labels.map((label, i) => {
    const value = values[i] || 0;
    const percentage = value / total;
    const angle = percentage * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // Calculate arc path
    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);
    const largeArcFlag = angle > Math.PI ? 1 : 0;

    const pathD = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      "Z",
    ].join(" ");

    // Label position (outside the pie)
    const labelAngle = startAngle + angle / 2;
    const labelRadius = radius + 40;
    const labelX = centerX + labelRadius * Math.cos(labelAngle);
    const labelY = centerY + labelRadius * Math.sin(labelAngle);

    return {
      label,
      value,
      percentage,
      pathD,
      color: chartColors[i % chartColors.length],
      labelX,
      labelY,
      labelAngle,
      startAngle,
      endAngle,
    };
  });

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {/* Segments */}
      {segments.map((segment, i) => {
        const segmentProgress = interpolate(
          frame,
          [i * 8, i * 8 + 30],
          [0, 1],
          { extrapolateRight: "clamp" }
        );

        // Animate the arc by scaling from center
        const scaleX = segmentProgress;
        const scaleY = segmentProgress;
        const transformOrigin = `${centerX} ${centerY}`;

        return (
          <g key={i}>
            {/* Segment */}
            <path
              d={segment.pathD}
              fill={segment.color}
              opacity={segmentProgress}
              transform={`scale(${scaleX}, ${scaleY})`}
              transformOrigin={transformOrigin}
              style={{
                filter: `drop-shadow(0 0 8px ${segment.color}60)`,
              }}
            />

            {/* Glow effect */}
            <path
              d={segment.pathD}
              fill={segment.color}
              opacity={0.3 * segmentProgress}
              transform={`scale(${scaleX * 1.05}, ${scaleY * 1.05})`}
              transformOrigin={transformOrigin}
              filter="blur(6px)"
            />

            {/* Label line */}
            {segmentProgress > 0.7 && (
              <line
                x1={centerX + radius * 0.7 * Math.cos(segment.labelAngle)}
                y1={centerY + radius * 0.7 * Math.sin(segment.labelAngle)}
                x2={segment.labelX}
                y2={segment.labelY}
                stroke={textColor}
                strokeWidth={1}
                strokeOpacity={0.3}
                opacity={interpolate(
                  frame,
                  [i * 8 + 20, i * 8 + 35],
                  [0, 1],
                  { extrapolateRight: "clamp" }
                )}
              />
            )}

            {/* Label */}
            {segmentProgress > 0.7 && (
              <g
                opacity={interpolate(
                  frame,
                  [i * 8 + 25, i * 8 + 40],
                  [0, 1],
                  { extrapolateRight: "clamp" }
                )}
              >
                <text
                  x={segment.labelX}
                  y={segment.labelY - 10}
                  fill={textColor}
                  fontSize={18}
                  fontWeight={600}
                  textAnchor={
                    Math.cos(segment.labelAngle) > 0 ? "start" : "end"
                  }
                >
                  {segment.label}
                </text>
                <text
                  x={segment.labelX}
                  y={segment.labelY + 14}
                  fill={segment.color}
                  fontSize={22}
                  fontWeight={700}
                  textAnchor={
                    Math.cos(segment.labelAngle) > 0 ? "start" : "end"
                  }
                >
                  {Math.round(segment.percentage * 100)}%
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Center circle (optional, creates donut effect) */}
      <circle
        cx={centerX}
        cy={centerY}
        r={radius * 0.4}
        fill={accentColor}
        opacity={0.1}
      />
    </svg>
  );
};

