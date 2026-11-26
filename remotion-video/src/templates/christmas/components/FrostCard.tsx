/**
 * Text surfaces.
 *  - `board`: a wooden sign with a frosted face and a lumpy snow cap on top.
 *  - `frost`: a frosted-glass panel (no wood) with a light snow lip.
 * The snow cap is drawn in SVG so it overhangs the edges like real snow.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { christmasRand, FESTIVE, mix, withOpacity, type WinterPalette } from "../christmasStyle";

/** A lumpy snow cap path `w` wide, `h` tall, sitting on y = h. */
export const snowCapPath = (w: number, h: number, seed: number): string => {
  const bumps = Math.max(4, Math.round(w / 120));
  const seg = (w + h) / bumps;
  let d = `M${-h * 0.5} ${h}`;
  for (let i = 0; i < bumps; i++) {
    const x0 = -h * 0.5 + i * seg;
    const peak = h * (0.15 + christmasRand(seed, i) * 0.35);
    d += ` Q${x0 + seg / 2} ${peak - h * 0.25} ${x0 + seg} ${h * (0.3 + christmasRand(seed + 1, i) * 0.25)}`;
  }
  // drips over the front edge
  d += ` L${w + h * 0.5} ${h}`;
  for (let i = bumps; i > 0; i--) {
    const x = -h * 0.5 + i * seg - seg * 0.5;
    const drip = h * (1.15 + christmasRand(seed + 2, i) * 0.45);
    d += ` Q${x + seg * 0.25} ${h * 1.05} ${x} ${drip} Q${x - seg * 0.25} ${h * 1.05} ${x - seg * 0.5} ${h}`;
  }
  return `${d} Z`;
};

export const FrostCard: React.FC<{
  pal: WinterPalette;
  width: number;
  height: number;
  variant?: "board" | "frost";
  seed?: number;
  /** 0 → 1 snow cap grows on. */
  snow?: number;
  /** Show the two hanging ropes above the board. */
  ropes?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ pal, width, height, variant = "board", seed = 1, snow = 1, ropes = 0, style, children }) => {
  const frame = variant === "board" ? Math.max(14, Math.min(width, height) * 0.035) : 0;
  const capH = Math.max(26, Math.min(64, width * 0.04));
  const wood = mix(FESTIVE.wood, pal.ink, 0.08);
  return (
    <div style={{ position: "relative", width, height, ...style }}>
      {ropes > 0 ? (
        <>
          {[0.18, 0.82].map((x) => (
            <div
              key={x}
              style={{
                position: "absolute",
                left: width * x - 3,
                top: -ropes,
                width: 6,
                height: ropes + frame,
                background: `repeating-linear-gradient(180deg, ${FESTIVE.woodDark} 0 6px, ${mix(FESTIVE.wood, "#fff", 0.25)} 6px 12px)`,
                borderRadius: 3,
              }}
            />
          ))}
        </>
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: variant === "board" ? 18 : 28,
          padding: frame,
          boxSizing: "border-box",
          background:
            variant === "board"
              ? `linear-gradient(180deg, ${mix(wood, "#fff", 0.12)}, ${wood} 55%, ${mix(wood, "#000", 0.18)})`
              : "transparent",
          boxShadow: `0 ${height * 0.03}px ${height * 0.07}px ${pal.shadow}`,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: variant === "board" ? 10 : 28,
            background:
              variant === "board"
                ? `linear-gradient(180deg, ${mix(FESTIVE.snow, pal.sky, 0.25)}, ${FESTIVE.snow})`
                : withOpacity(FESTIVE.snow, 0.72),
            border: variant === "frost" ? `2px solid ${withOpacity(FESTIVE.snow, 0.9)}` : undefined,
            boxShadow:
              variant === "board"
                ? `inset 0 0 ${frame * 1.2}px ${withOpacity(pal.snowShade, 0.65)}`
                : `inset 0 0 40px ${withOpacity(pal.snowShade, 0.5)}`,
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
      {snow > 0 ? (
        <svg
          width={width + capH}
          height={capH * 2}
          viewBox={`${-capH * 0.5} 0 ${width + capH} ${capH * 2}`}
          style={{
            position: "absolute",
            left: -capH * 0.5,
            top: -capH * 0.62,
            overflow: "visible",
            transform: `scaleY(${snow})`,
            transformOrigin: "50% 100%",
            filter: `drop-shadow(0 3px 3px ${withOpacity(pal.snowShade, 0.7)})`,
          }}
        >
          <path d={snowCapPath(width, capH, seed)} fill={FESTIVE.snow} stroke={withOpacity(pal.snowShade, 0.7)} strokeWidth={1.5} />
        </svg>
      ) : null}
    </div>
  );
};
