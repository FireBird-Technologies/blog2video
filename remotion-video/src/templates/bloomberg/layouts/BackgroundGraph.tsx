import { interpolate, useCurrentFrame } from "remotion";

interface BackgroundGraphProps {
  accentColor: string;
  textColor: string;
  opacity?: number;
  variant?: "list" | "quote" | "split" | "options" | "metric" | "socials";
}

function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Generates a volatile "economic chart" path — sharp spikes up and down */
function buildVolatilePath(
  seed: number,
  W: number,
  H: number,
  yCenter: number, // 0–1 vertical center
  amplitude: number, // 0–1 max swing
  pts: number,
): [number, number][] {
  const rng = makePrng(seed);
  const points: [number, number][] = [];

  let y = yCenter;
  for (let i = 0; i < pts; i++) {
    const x = (i / (pts - 1)) * W;

    // Sharp random swing — no smoothing, pure angular
    const swing = (rng() - 0.48) * amplitude;
    y = y + swing;

    // Occasional big spike
    if (rng() > 0.82) {
      y += rng() > 0.5 ? amplitude * 0.6 : -amplitude * 0.6;
    }

    // Clamp within visible area
    y = Math.max(yCenter - amplitude * 1.4, Math.min(yCenter + amplitude * 1.4, y));

    points.push([x, y * H]);
  }

  return points;
}

function pointsToD(points: [number, number][]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const cmds = [`M ${first[0].toFixed(1)} ${first[1].toFixed(1)}`];
  for (const [x, y] of rest) cmds.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
  return cmds.join(" ");
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

/** Seeded list of random numbers and positions for background scatter */
function buildNumbers(seed: number, count: number, W: number, H: number) {
  const rng = makePrng(seed);
  const results: { x: number; y: number; value: string; size: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Generate finance-looking numbers
    const kind = Math.floor(rng() * 4);
    let value: string;
    if (kind === 0) value = (rng() * 5000 + 100).toFixed(2);
    else if (kind === 1) value = `${(rng() * 10 - 5).toFixed(2)}%`;
    else if (kind === 2) value = (rng() * 200 + 10).toFixed(1);
    else value = `${rng() > 0.5 ? "+" : "-"}${(rng() * 3).toFixed(3)}`;

    results.push({
      x: rng() * W * 0.92 + W * 0.04,
      y: rng() * H * 0.88 + H * 0.06,
      value,
      size: 11 + rng() * 8, // 11–19px
    });
  }
  return results;
}

export const BackgroundGraph: React.FC<BackgroundGraphProps> = ({
  accentColor,
  textColor,
  opacity = 1,
  variant = "list",
}) => {
  const frame = useCurrentFrame();
  const W = 1920;
  const H = 1080;

  const variantConfig = {
    list: {
      line1: { seed: 42, yCenter: 0.54, amplitude: 0.24, pts: 62 },
      line2: { seed: 99, yCenter: 0.46, amplitude: 0.2, pts: 58 },
      numberSeed: 7,
    },
    quote: {
      line1: { seed: 134, yCenter: 0.49, amplitude: 0.18, pts: 54 },
      line2: { seed: 207, yCenter: 0.51, amplitude: 0.16, pts: 56 },
      numberSeed: 13,
    },
    split: {
      line1: { seed: 311, yCenter: 0.47, amplitude: 0.26, pts: 66 },
      line2: { seed: 523, yCenter: 0.55, amplitude: 0.22, pts: 64 },
      numberSeed: 29,
    },
    options: {
      line1: { seed: 717, yCenter: 0.53, amplitude: 0.3, pts: 72 },
      line2: { seed: 941, yCenter: 0.44, amplitude: 0.24, pts: 70 },
      numberSeed: 37,
    },
    metric: {
      line1: { seed: 1103, yCenter: 0.5, amplitude: 0.2, pts: 56 },
      line2: { seed: 1321, yCenter: 0.57, amplitude: 0.17, pts: 52 },
      numberSeed: 43,
    },
    socials: {
      line1: { seed: 1487, yCenter: 0.45, amplitude: 0.28, pts: 68 },
      line2: { seed: 1609, yCenter: 0.58, amplitude: 0.22, pts: 60 },
      numberSeed: 53,
    },
  } as const;

  const cfg = variantConfig[variant];
  const line1Points = buildVolatilePath(cfg.line1.seed, W, H, cfg.line1.yCenter, cfg.line1.amplitude, cfg.line1.pts);
  const line2Points = buildVolatilePath(cfg.line2.seed, W, H, cfg.line2.yCenter, cfg.line2.amplitude, cfg.line2.pts);

  const len1 = polylineLength(line1Points);
  const len2 = polylineLength(line2Points);

  const progress1 = interpolate(frame, [0, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progress2 = interpolate(frame, [5, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const numbers = buildNumbers(cfg.numberSeed, 28, W, H);

  const numOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", inset: 0, opacity: opacity * 0.28, pointerEvents: "none" }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "84%",
          height: "80%",
          transform: "translate(-50%, -50%)",
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Scattered numbers */}
        {numbers.map((n, i) => (
          <text
            key={i}
            x={n.x}
            y={n.y}
            fill={i % 2 === 0 ? accentColor : textColor}
            fontSize={n.size}
            fontFamily="'Share Tech Mono', monospace"
            opacity={numOpacity * 0.7}
          >
            {n.value}
          </text>
        ))}

        {/* Line 1 — accent color */}
        <path
          d={pointsToD(line1Points)}
          fill="none"
          stroke={accentColor}
          strokeWidth={2.4}
          strokeDasharray={`${len1} ${len1}`}
          strokeDashoffset={len1 - progress1 * len1}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />

        {/* Line 2 — text color */}
        <path
          d={pointsToD(line2Points)}
          fill="none"
          stroke={textColor}
          strokeWidth={2.0}
          strokeDasharray={`${len2} ${len2}`}
          strokeDashoffset={len2 - progress2 * len2}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
    </div>
  );
};
