import { interpolate, useCurrentFrame } from "remotion";

interface BackgroundHistogramGraphProps {
  accentColor: string;
  textColor: string;
  opacity?: number;
}

type MiniChart = {
  x: number;
  y: number;
  w: number;
  h: number;
  bars: number[];
  line: number[];
  labels: string[];
};

function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function makeMiniCharts(seed: number, count: number, W: number, H: number): MiniChart[] {
  const rng = makePrng(seed);
  const charts: MiniChart[] = [];

  for (let i = 0; i < count; i++) {
    const w = 120 + rng() * 110;
    const h = 58 + rng() * 46;
    const x = rng() * (W - w - 120) + 60;
    const y = rng() * (H - h - 140) + 70;
    const barsLen = 5 + Math.floor(rng() * 4);

    const bars = Array.from({ length: barsLen }, () => 0.18 + rng() * 0.82);
    const line = Array.from({ length: barsLen }, () => 0.16 + rng() * 0.78);
    const labels = Array.from({ length: 3 }, () => {
      const n = rng() * 900 + 50;
      return rng() > 0.5 ? n.toFixed(1) : `${(rng() * 8 - 4).toFixed(2)}%`;
    });

    charts.push({ x, y, w, h, bars, line, labels });
  }

  return charts;
}

function pointsToPath(points: Array<[number, number]>) {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first[0].toFixed(1)} ${first[1].toFixed(1)} ${rest
    .map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ")}`;
}

function buildVolatilePath(
  seed: number,
  W: number,
  H: number,
  yCenter: number,
  amplitude: number,
  pts: number,
): [number, number][] {
  const rng = makePrng(seed);
  const points: [number, number][] = [];
  let y = yCenter;

  for (let i = 0; i < pts; i++) {
    const x = (i / (pts - 1)) * W;
    const swing = (rng() - 0.5) * amplitude;
    y += swing;

    // Enforce abrupt market-like spikes and drops.
    if (rng() > 0.75) {
      y += rng() > 0.5 ? amplitude * 0.85 : -amplitude * 0.85;
    }
    if (rng() > 0.9) {
      y += rng() > 0.5 ? amplitude * 0.55 : -amplitude * 0.55;
    }

    y = Math.max(yCenter - amplitude * 1.5, Math.min(yCenter + amplitude * 1.5, y));
    points.push([x, y * H]);
  }

  return points;
}

function polylineLength(points: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

export const BackgroundHistogramGraph: React.FC<BackgroundHistogramGraphProps> = ({
  accentColor,
  textColor,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const W = 1920;
  const H = 1080;
  const charts = makeMiniCharts(2026, 7, W, H);
  const fullLine1 = buildVolatilePath(808, W, H, 0.52, 0.34, 78);
  const fullLine2 = buildVolatilePath(1117, W, H, 0.47, 0.31, 74);
  const fullLineLen1 = polylineLength(fullLine1);
  const fullLineLen2 = polylineLength(fullLine2);
  const fadeIn = interpolate(frame, [0, 28], [0, 1], { extrapolateRight: "clamp" });
  const lineProgress1 = interpolate(frame, [0, 75], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const lineProgress2 = interpolate(frame, [8, 82], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <div style={{ position: "absolute", inset: 0, opacity: opacity * 0.2, pointerEvents: "none" }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "86%",
          height: "82%",
          transform: "translate(-50%, -50%)",
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d={pointsToPath(fullLine1)}
          fill="none"
          stroke={accentColor}
          strokeWidth={2.2}
          strokeOpacity={0.72}
          strokeDasharray={`${fullLineLen1} ${fullLineLen1}`}
          strokeDashoffset={fullLineLen1 - lineProgress1 * fullLineLen1}
          strokeLinecap="square"
          strokeLinejoin="miter"
          shapeRendering="crispEdges"
        />
        <path
          d={pointsToPath(fullLine2)}
          fill="none"
          stroke={textColor}
          strokeWidth={1.9}
          strokeOpacity={0.68}
          strokeDasharray={`${fullLineLen2} ${fullLineLen2}`}
          strokeDashoffset={fullLineLen2 - lineProgress2 * fullLineLen2}
          strokeLinecap="square"
          strokeLinejoin="miter"
          shapeRendering="crispEdges"
        />
        {charts.map((chart, chartIdx) => {
          const chartDelay = chartIdx * 1.5;
          const chartOpacity = interpolate(frame, [8 + chartDelay, 24 + chartDelay], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const barGap = chart.w / (chart.bars.length * 1.8);
          const barW = barGap * 0.85;
          const linePoints = chart.line.map((v, i) => {
            const lx = chart.x + 10 + i * (barW + barGap * 0.35) + barW * 0.5;
            const ly = chart.y + chart.h - 8 - chart.h * v * 0.76;
            return [lx, ly] as [number, number];
          });

          return (
            <g key={chartIdx} opacity={chartOpacity * fadeIn}>
              <rect
                x={chart.x}
                y={chart.y}
                width={chart.w}
                height={chart.h}
                rx={0}
                fill="none"
                stroke={chartIdx % 2 === 0 ? accentColor : textColor}
                strokeOpacity={0.45}
                strokeWidth={1.2}
                shapeRendering="crispEdges"
              />
              {chart.bars.map((v, i) => {
                const bh = chart.h * v * 0.78;
                const bx = chart.x + 10 + i * (barW + barGap * 0.35);
                const by = chart.y + chart.h - 8 - bh;
                return (
                  <rect
                    key={i}
                    x={bx}
                    y={by}
                    width={barW}
                    height={bh}
                    fill={i % 2 === 0 ? accentColor : textColor}
                    fillOpacity={0.62}
                    shapeRendering="crispEdges"
                  />
                );
              })}
              <path
                d={pointsToPath(linePoints)}
                fill="none"
                stroke={chartIdx % 2 === 0 ? textColor : accentColor}
                strokeWidth={1.5}
                strokeOpacity={0.75}
                strokeLinecap="butt"
                strokeLinejoin="miter"
                shapeRendering="crispEdges"
              />
              {chart.labels.map((label, i) => (
                <text
                  key={i}
                  x={chart.x + chart.w + 10}
                  y={chart.y + 12 + i * 12}
                  fill={i % 2 === 0 ? textColor : accentColor}
                  opacity={0.65}
                  fontSize={10}
                  fontFamily="'Share Tech Mono', monospace"
                >
                  {label}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
