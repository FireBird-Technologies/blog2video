import React from "react";
import { Customized } from "recharts";

type LineRow = {
  label: string;
  s0?: number | null;
  s1?: number | null;
  s2?: number | null;
};

export type LineEndCalloutSeries = {
  dataKey: "s0" | "s1" | "s2";
  yAxisId: string;
  color: string;
  visible: boolean;
};

export type LineChartEndCalloutsConfig = {
  rows: LineRow[];
  series: LineEndCalloutSeries[];
  formatValue: (value: number) => string;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  dotFill: string;
  /** Extra px reserved to the right of the plot for callout text. */
  calloutLaneWidth?: number;
};

type AxisLike = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: ((value: unknown) => number) & { bandwidth?: () => number };
};

type CustomizedChartProps = {
  offset?: { top?: number; left?: number; width?: number; height?: number };
  xAxisMap?: Record<string, AxisLike>;
  yAxisMap?: Record<string, AxisLike>;
};

function spreadVerticalPositions(
  entries: { id: string; py: number }[],
  minGap: number,
  boundTop: number,
  boundBottom: number,
): Map<string, number> {
  if (entries.length === 0) return new Map();
  const sorted = [...entries].sort((a, b) => a.py - b.py);
  const positions = sorted.map((e) => e.py);
  const gap = Math.max(minGap, 14);

  for (let iter = 0; iter < sorted.length * 6; iter++) {
    let moved = false;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] - positions[i - 1] < gap) {
        positions[i] = positions[i - 1] + gap;
        moved = true;
      }
    }
    if (positions[positions.length - 1] > boundBottom) {
      const shift = positions[positions.length - 1] - boundBottom;
      for (let i = 0; i < positions.length; i++) positions[i] -= shift;
      moved = true;
    }
    if (positions[0] < boundTop) {
      const shift = boundTop - positions[0];
      for (let i = 0; i < positions.length; i++) positions[i] += shift;
      moved = true;
    }
    for (let i = positions.length - 2; i >= 0; i--) {
      if (positions[i + 1] - positions[i] < gap) {
        positions[i] = positions[i + 1] - gap;
        moved = true;
      }
    }
    if (!moved) break;
  }

  const map = new Map<string, number>();
  sorted.forEach((e, i) => map.set(e.id, positions[i]));
  return map;
}

function xBandCenter(axis: AxisLike, category: string): number | null {
  const scale = axis.scale;
  if (!scale) return null;
  const base = Number(axis.x ?? 0);
  const band = typeof scale.bandwidth === "function" ? scale.bandwidth() : 0;
  const raw = scale(category);
  if (!Number.isFinite(Number(raw))) return null;
  return base + Number(raw) + band / 2;
}

function yScalePosition(axis: AxisLike, value: number): number | null {
  const scale = axis.scale;
  if (!scale) return null;
  const raw = scale(value);
  if (!Number.isFinite(Number(raw))) return null;
  return Number(axis.y ?? 0) + Number(raw);
}

function findLastPoint(
  rows: LineRow[],
  dataKey: "s0" | "s1" | "s2",
): { xLabel: string; y: number } | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const v = row[dataKey];
    if (v != null && Number.isFinite(v)) {
      return { xLabel: row.label, y: v as number };
    }
  }
  return null;
}

function LineChartEndCalloutsInner({
  chartProps,
  config,
}: {
  chartProps: CustomizedChartProps;
  config: LineChartEndCalloutsConfig;
}) {
  const { offset, xAxisMap, yAxisMap } = chartProps;
  if (!offset || !xAxisMap || !yAxisMap) return null;

  const xAxis = xAxisMap[Object.keys(xAxisMap)[0] ?? ""] ?? Object.values(xAxisMap)[0];
  if (!xAxis) return null;

  const plotLeft = Number(offset.left ?? 0);
  const plotTop = Number(offset.top ?? 0);
  const plotWidth = Number(offset.width ?? 0);
  const plotHeight = Number(offset.height ?? 0);
  const plotRight = plotLeft + plotWidth;
  const plotBottom = plotTop + plotHeight;

  const laneWidth = config.calloutLaneWidth ?? 58;
  const textX = plotRight + 10;
  const leaderMidX = plotRight + 4;
  const minGap = Math.max(config.fontSize + 6, 18);

  const endpoints: Array<{
    id: string;
    px: number;
    py: number;
    text: string;
    color: string;
  }> = [];

  for (const s of config.series) {
    if (!s.visible) continue;
    const last = findLastPoint(config.rows, s.dataKey);
    if (!last) continue;

    const yAxis = yAxisMap[s.yAxisId] ?? yAxisMap.left ?? Object.values(yAxisMap)[0];
    if (!yAxis) continue;

    const px = xBandCenter(xAxis, last.xLabel);
    const py = yScalePosition(yAxis, last.y);
    if (px == null || py == null) continue;

    endpoints.push({
      id: s.dataKey,
      px,
      py,
      text: config.formatValue(last.y),
      color: s.color,
    });
  }

  if (endpoints.length === 0) return null;

  const spread = spreadVerticalPositions(
    endpoints.map((e) => ({ id: e.id, py: e.py })),
    minGap,
    plotTop + config.fontSize * 0.6,
    plotBottom - config.fontSize * 0.4,
  );

  return (
    <g className="line-chart-end-callouts">
      {endpoints.map((e) => {
        const labelPy = spread.get(e.id) ?? e.py;
        const needsElbow = Math.abs(labelPy - e.py) > 3;
        const path = needsElbow
          ? `M ${e.px} ${e.py} L ${leaderMidX} ${labelPy} L ${textX - 4} ${labelPy}`
          : `M ${e.px} ${e.py} L ${textX - 4} ${labelPy}`;

        return (
          <g key={e.id}>
            <path
              d={path}
              fill="none"
              stroke={e.color}
              strokeWidth={1.4}
              strokeOpacity={0.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={e.px}
              cy={e.py}
              r={3.2}
              fill={config.dotFill}
              stroke={e.color}
              strokeWidth={1.8}
            />
            <polygon
              points={`${textX - 4},${labelPy} ${textX - 9},${labelPy - 3.5} ${textX - 9},${labelPy + 3.5}`}
              fill={e.color}
              opacity={0.9}
            />
            <text
              x={textX}
              y={labelPy}
              dy="0.35em"
              fill={e.color}
              fontSize={config.fontSize}
              fontWeight={config.fontWeight}
              fontFamily={config.fontFamily}
              textAnchor="start"
            >
              {e.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Recharts `<Customized />` layer — end-of-line value callouts that never overlap. */
export function LineChartEndCallouts({ config }: { config: LineChartEndCalloutsConfig }) {
  const visible = config.series.some((s) => s.visible);
  if (!visible || config.series.filter((s) => s.visible).length < 2) return null;

  return (
    <Customized
      component={(props: CustomizedChartProps) => (
        <LineChartEndCalloutsInner chartProps={props} config={config} />
      )}
    />
  );
}

/** Extra right margin when multi-series end callouts are shown. */
export function lineChartCalloutMargin(seriesCount: number, base = 46): number {
  return seriesCount >= 2 ? Math.max(base, 88) : base;
}
