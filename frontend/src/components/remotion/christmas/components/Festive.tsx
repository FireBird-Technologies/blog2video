/**
 * Small festive props shared by several layouts: gift box with a popping lid,
 * a sagging string of fairy lights, twinkling sparkles, gift tags and a
 * candy-cane rule.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { Easing, interpolate } from "remotion";
import { christmasRand, clamp, FESTIVE, mix, withOpacity } from "../christmasStyle";
import { starPath } from "./ChristmasTree";

// ─── Gift box ────────────────────────────────────────────────────────────────

/**
 * A wrapped gift, `width` × `height` px for the box body. `open` 0→1 pops the lid
 * up, tumbles it off to `lidSide` and lands it (with a little bounce) on the ground
 * beside the box, where it stays; `children` (e.g. a number) rise well clear of the
 * box as it opens.
 */
export const GiftBox: React.FC<{
  width: number;
  height: number;
  color: string;
  ribbon: string;
  open?: number;
  /** Which side the lid lands on: -1 = left (default), 1 = right. */
  lidSide?: -1 | 1;
  children?: React.ReactNode;
  childrenHeight?: number;
  style?: React.CSSProperties;
}> = ({ width, height, color, ribbon, open = 0, lidSide = -1, children, childrenHeight = height, style }) => {
  const lidH = height * 0.24;
  // Lid flight: pop straight up (0 → 0.35), then tumble sideways and drop onto the
  // ground beside the box with a bounce (0.35 → 1). It stays there, tucked half in
  // front of the box's bottom corner so it never strays into the next gift.
  const peak = height * 0.6;
  const up = interpolate(open, [0, 0.35], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const fall = interpolate(open, [0.35, 1], [0, 1], { ...clamp, easing: Easing.bounce });
  const lidBottom = open < 0.35 ? height - 2 + peak * up : (height - 2 + peak) * (1 - fall);
  const lidSlide = lidSide * interpolate(open, [0.2, 0.85], [0, width * 0.78], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const lidTilt = lidSide * (28 * Math.sin(Math.PI * Math.min(1, open / 0.85)) + 3 * open);
  const rise = interpolate(open, [0.25, 1], [0, 1], clamp);
  const band = Math.max(10, width * 0.13);
  return (
    <div style={{ position: "relative", width, height: height + lidH, ...style }}>
      {/* contents rising out */}
      <div
        style={{
          position: "absolute",
          left: -width * 0.3,
          width: width * 1.6,
          bottom: height - lidH * 0.4 + rise * childrenHeight * 0.45,
          height: childrenHeight,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          opacity: rise,
          transform: `translateY(${(1 - rise) * childrenHeight * 0.7}px) scale(${0.6 + rise * 0.4})`,
          transformOrigin: "50% 100%",
        }}
      >
        {children}
      </div>
      {/* box body */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width,
          height,
          borderRadius: 8,
          background: `linear-gradient(90deg, ${mix(color, "#000", 0.12)}, ${color} 35%, ${mix(color, "#000", 0.2)})`,
          boxShadow: `0 ${height * 0.08}px ${height * 0.14}px rgba(20,40,60,0.25)`,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: (width - band) / 2, top: 0, width: band, height: "100%", background: ribbon }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: height * 0.18, background: "rgba(0,0,0,0.14)" }} />
      </div>
      {/* lid + bow */}
      <div
        style={{
          position: "absolute",
          left: -width * 0.05,
          bottom: lidBottom,
          width: width * 1.1,
          height: lidH,
          zIndex: 1,
          transform: `translateX(${lidSlide}px) rotate(${lidTilt}deg)`,
          transformOrigin: "50% 100%",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 8,
            background: `linear-gradient(180deg, ${mix(color, "#fff", 0.12)}, ${color})`,
            boxShadow: "0 4px 8px rgba(20,40,60,0.2)",
          }}
        />
        <div style={{ position: "absolute", left: (width * 1.1 - band) / 2, top: 0, width: band, height: "100%", background: ribbon }} />
        <svg
          width={width * 0.7}
          height={lidH * 1.6}
          viewBox="0 0 140 64"
          style={{ position: "absolute", left: width * 0.2, top: -lidH * 1.35, overflow: "visible" }}
        >
          <path d="M70 58 Q30 0 8 26 Q0 52 70 58 Z" fill={ribbon} stroke={mix(ribbon, "#000", 0.2)} strokeWidth={3} />
          <path d="M70 58 Q110 0 132 26 Q140 52 70 58 Z" fill={ribbon} stroke={mix(ribbon, "#000", 0.2)} strokeWidth={3} />
          <circle cx={70} cy={56} r={9} fill={mix(ribbon, "#000", 0.15)} />
        </svg>
      </div>
    </div>
  );
};

// ─── Fairy lights ────────────────────────────────────────────────────────────

/**
 * A sagging string of bulbs from (0, 0) to (width, 0) with `sag` px of droop.
 * `on` 0→1 lights the bulbs left to right; lit bulbs twinkle.
 */
export const FairyLights: React.FC<{
  frame: number;
  width: number;
  sag?: number;
  count?: number;
  on?: number;
  colors: string[];
  bulb?: number;
  style?: React.CSSProperties;
}> = ({ frame, width, sag = 40, count = 14, on = 1, colors, bulb = 11, style }) => {
  const y = (x: number) => (4 * sag * x * (width - x)) / (width * width);
  return (
    <svg width={width} height={sag + bulb * 4} viewBox={`0 0 ${width} ${sag + bulb * 4}`} style={{ overflow: "visible", ...style }}>
      <path d={`M0 0 Q${width / 2} ${sag * 2} ${width} 0`} stroke="#2E4A3A" strokeWidth={2.5} fill="none" />
      {Array.from({ length: count }, (_, i) => {
        const x = ((i + 0.5) / count) * width;
        const by = y(x);
        const lit = interpolate(on, [i / count, (i + 1) / count], [0, 1], clamp);
        const tw = 0.65 + 0.35 * Math.sin(frame / 5 + i * 2.1);
        const c = colors[i % colors.length];
        const sway = Math.sin(frame / 20 + i) * 6;
        return (
          <g key={i} transform={`translate(${x.toFixed(1)} ${by.toFixed(1)}) rotate(${sway.toFixed(1)})`}>
            <rect x={-bulb * 0.35} y={0} width={bulb * 0.7} height={bulb * 0.6} fill="#2E4A3A" rx={1.5} />
            {lit > 0 ? <circle cx={0} cy={bulb * 1.6} r={bulb * 2} fill={withOpacity(c, 0.28 * lit * tw)} /> : null}
            <ellipse cx={0} cy={bulb * 1.5} rx={bulb * 0.62} ry={bulb * 0.95} fill={lit > 0 ? c : mix(c, "#556070", 0.6)} opacity={0.5 + 0.5 * lit} />
            <ellipse cx={-bulb * 0.2} cy={bulb * 1.15} rx={bulb * 0.16} ry={bulb * 0.3} fill="#fff" opacity={0.7 * lit} />
          </g>
        );
      })}
    </svg>
  );
};

// ─── Sparkles ────────────────────────────────────────────────────────────────

/** Twinkling four-point sparkles scattered over a `width` × `height` area. */
export const Sparkles: React.FC<{
  frame: number;
  width: number;
  height: number;
  count?: number;
  seed?: number;
  color?: string;
  size?: number;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({ frame, width, height, count = 12, seed = 5, color = FESTIVE.gold, size = 14, opacity = 1, style }) => (
  <svg width={width} height={height} style={{ position: "absolute", overflow: "visible", pointerEvents: "none", ...style }}>
    {Array.from({ length: count }, (_, i) => {
      const x = christmasRand(seed, i) * width;
      const y = christmasRand(seed + 3, i) * height;
      const tw = Math.max(0, Math.sin(frame / (6 + (i % 4)) + i * 1.9));
      const r = size * (0.5 + christmasRand(seed + 7, i) * 0.8) * tw;
      if (r < 0.5) return null;
      return (
        <path
          key={i}
          d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`}
          fill={color}
          opacity={opacity * (0.5 + tw * 0.5)}
        />
      );
    })}
  </svg>
);

// ─── Gift tag ────────────────────────────────────────────────────────────────

/**
 * A paper gift tag with a punched hole at its pointed end; children are the label.
 * `point` is the side the pointed end (and the hole / string) faces — "left" by
 * default, "right" for tags hanging on the left of something they point back at.
 */
export const GiftTag: React.FC<{
  color?: string;
  ink: string;
  accent: string;
  padding?: number;
  point?: "left" | "right";
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ color = "#FFF8EC", ink, accent, padding = 18, point = "left", style, children }) => {
  const right = point === "right";
  // Fixed-depth point (not a % of the width, which ate into the text on wide tags),
  // and the label indented well past it and the punched hole.
  const tip = padding * 2.2;
  const indent = tip + padding * 1.6;
  return (
    <div
      style={{
        position: "relative",
        background: color,
        color: ink,
        padding: right
          ? `${padding}px ${indent}px ${padding}px ${padding * 1.4}px`
          : `${padding}px ${padding * 1.4}px ${padding}px ${indent}px`,
        clipPath: right
          ? `polygon(0 0, calc(100% - ${tip}px) 0, 100% 50%, calc(100% - ${tip}px) 100%, 0 100%)`
          : `polygon(${tip}px 0, 100% 0, 100% 100%, ${tip}px 100%, 0 50%)`,
        filter: `drop-shadow(0 6px 8px ${withOpacity("#1a2a3a", 0.25)})`,
        ...(right ? { borderLeft: `6px solid ${accent}` } : { borderRight: `6px solid ${accent}` }),
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          ...(right ? { right: tip * 0.55 } : { left: tip * 0.55 }),
          top: "50%",
          width: padding * 0.7,
          height: padding * 0.7,
          marginTop: -padding * 0.35,
          borderRadius: "50%",
          background: mix(color, ink, 0.35),
        }}
      />
      {children}
    </div>
  );
};

/** A horizontal red-and-white candy-cane bar. */
export const CandyCaneRule: React.FC<{ width: number; height?: number; accent: string; style?: React.CSSProperties }> = ({
  width,
  height = 10,
  accent,
  style,
}) => (
  <div
    style={{
      width,
      height,
      borderRadius: height / 2,
      background: `repeating-linear-gradient(135deg, ${accent} 0 ${height * 1.4}px, ${FESTIVE.snow} ${height * 1.4}px ${height * 2.8}px)`,
      boxShadow: `0 1px 2px rgba(20,40,60,0.25)`,
      ...style,
    }}
  />
);

/** A gold star (for headings / bullets). */
export const GoldStar: React.FC<{ size: number; glow?: number; style?: React.CSSProperties }> = ({ size, glow = 0, style }) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ overflow: "visible", ...style }}>
    {glow > 0 ? <circle r={60} fill={withOpacity(FESTIVE.goldLight, 0.35 * glow)} /> : null}
    <path d={starPath(0, 0, 46)} fill={FESTIVE.gold} stroke={mix(FESTIVE.gold, "#7a5a10", 0.4)} strokeWidth={4} strokeLinejoin="round" />
  </svg>
);
