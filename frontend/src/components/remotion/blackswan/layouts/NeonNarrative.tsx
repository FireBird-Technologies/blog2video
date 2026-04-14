import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Swan } from "../components/Swan";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { blackswanNeonPalette } from "./blackswanAccent";

// Righteous (Astigmatic / Google Fonts) — bundled via @fontsource/righteous in fonts/registry
const mono = "'Righteous', cursive";
const display = "'Righteous', cursive";

/** Split narration on newlines so breaks stay visible (plain <p> collapses \\n in HTML). */
function narrationBlocks(text: string): string[] {
  return text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

/** Stable 3–5 count from scene copy (deterministic per render). */
function shootingStarCountFromSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 3 + (Math.abs(h) % 3);
}

const SHOOT_TRAJ = [
  { x1: 1740, y1: 20, x2: -80, y2: 980 },
  { x1: 1680, y1: 50, x2: 120, y2: 900 },
  { x1: 1820, y1: 120, x2: -40, y2: 1000 },
  { x1: 1580, y1: 30, x2: 40, y2: 860 },
  { x1: 1760, y1: 200, x2: 200, y2: 980 },
] as const;

// ── Shooting stars: 3–5 per scene (from seed), staggered cadences and paths
const ShootingStarsLayer: React.FC<{ seed: string; accentColor: string }> = ({ seed, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const h = (() => {
    let x = 0;
    for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) | 0;
    return Math.abs(x);
  })();
  const count = shootingStarCountFromSeed(seed);
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);

  return (
    <svg
      viewBox="0 0 1780 1000"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}
    >
      <defs>
        {Array.from({ length: count }, (_, i) => (
          <filter key={`nn-f-${i}`} id={`nn-star-glow-${i}`} x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>
      {Array.from({ length: count }, (_, i) => {
        const intervalSec = 3.5 + ((h + i * 47) % 100) / 55;
        const phaseShift = ((h + i * 89) % 1000) / 1000 * intervalSec;
        const cycleT = ((t + phaseShift) % intervalSec) / intervalSec;
        const activeDur = 0.62;
        if (cycleT >= activeDur) return null;
        const p = cycleT / activeDur;

        const { x1, y1, x2, y2 } = SHOOT_TRAJ[i % SHOOT_TRAJ.length];
        const cx = x1 + (x2 - x1) * p;
        const cy = y1 + (y2 - y1) * p;
        const tailLen = 120 + (i % 3) * 22;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const tailX = cx - (dx / len) * tailLen;
        const tailY = cy - (dy / len) * tailLen;

        const headOp = interpolate(p, [0, 0.08, 0.75, 1], [0, 1, 0.9, 0], { extrapolateRight: "clamp" });
        const tailOp = interpolate(p, [0, 0.08, 0.65, 1], [0, 0.7, 0.4, 0], { extrapolateRight: "clamp" });

        return (
          <g key={`nn-s-${i}`}>
            <linearGradient
              id={`nn-tail-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={tailX}
              y1={tailY}
              x2={cx}
              y2={cy}
            >
              <stop offset="0%" stopColor={pal.core} stopOpacity={0} />
              <stop offset="100%" stopColor={pal.core} stopOpacity={tailOp} />
            </linearGradient>
            <line
              x1={tailX}
              y1={tailY}
              x2={cx}
              y2={cy}
              stroke={`url(#nn-tail-${i})`}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle
              cx={cx}
              cy={cy}
              r={2.6 + (i % 2) * 0.35}
              fill={pal.core}
              opacity={headOp}
              filter={`url(#nn-star-glow-${i})`}
            />
          </g>
        );
      })}
    </svg>
  );
};

const NeonLine: React.FC<{ width?: string | number; accentColor: string }> = ({
  width = "160px",
  accentColor,
}) => (
  <div
    style={{
      height: 1,
      width,
      background: accentColor,
      boxShadow: `0 0 2px ${accentColor}, 0 0 5px ${accentColor}99`,
    }}
  />
);

export const NeonNarrative: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    bgColor = "#000000",
    textColor = "#DFFFFF",
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const eyebrowOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleOp   = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: "clamp" });
  const titleY    = interpolate(frame, [10, 35], [14, 0], { extrapolateRight: "clamp" });
  const bodyOp    = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: "clamp" });
  const bodyY     = interpolate(frame, [25, 50], [14, 0], { extrapolateRight: "clamp" });
  const rightOp   = interpolate(frame, [15, 45], [0, 1], { extrapolateRight: "clamp" });
  const neonPal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);

  // In landscape: text on left, water+swan on right
  // In portrait: stacked, water+swan below text
  // Modified: landscape waterCx moved right
  const waterCx = p ? 500 : 800;
  // Modified: portrait waterYPct moved down
  const waterYPct = p ? 120 : 72;
  // Modified: landscape swanSize increased
  const swanSize = p ? 1050 : 900;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {/* Background image — full screen, very low opacity with black overlay so all content remains legible */}
      {props.imageUrl && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <img
            src={props.imageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: 0.18 }}
          />
          {/* Modified: Reduced the opacity of the dark overlay from 0.5 to 0.35 */}
          <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.35 }} />
        </div>
      )}
      <StarField accentColor={accentColor} />
      <ShootingStarsLayer seed={`${title}\u0000${narration}`} accentColor={accentColor} />

      {/* NeonWater on the right (landscape) or bottom (portrait) — no shade */}
      <div style={{ position: "absolute", inset: 0, opacity: rightOp }}>
        <NeonWater
          uid="nn"
          cx={waterCx}
          yPct={waterYPct}
          scale={p ? 0.75 : 0.85}
          rxBase={160}
          ryBase={20}
          maxRx={300}
          nRings={5}
          delay={0.2}
          hideBg
          accentColor={accentColor}
        />
      </div>

      {/* Swan swimming on the water — right side */}
      <div
        style={{
          position: "absolute",
          // Modified: swan's position adjusted slightly for landscape, portrait swan moved down
          left: p ? "50%" : `${waterCx / 12}%`,
          top: p ? `${waterYPct - 42}%` : `${waterYPct - 18}%`,
          transform: "translate(-50%, -50%)",
          opacity: rightOp,
        }}
      >
        <Swan size={swanSize} water={false} uid="nn-swan" accentColor={accentColor} />
      </div>

      {/* Text column — left side, left-aligned */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: p ? "8%" : "6%",
          // Modified: landscape paddingRight reduced to extend text box length
          paddingRight: p ? "8%" : "45%",
          paddingTop: p ? "8%" : 0,
          // Modified: portrait paddingBottom reduced to allow more text height and push swan down
          paddingBottom: p ? "30%" : 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: p ? 16 : 20,
            alignItems: "flex-start",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              fontSize: p ? 18 : 14,
              letterSpacing: 5,
              color: neonPal.mid,
              textTransform: "uppercase",
              fontFamily: fontFamily ?? mono,
              fontWeight: 500,
              opacity: eyebrowOp,
            }}
          >
            Insight
          </div>

          {/* Title */}
          <h1
            style={{
              margin: 0,
              fontFamily: fontFamily ?? display,
              fontSize: titleFontSize ?? (p ? 73 : 69),
              fontWeight: 100,
              ...neonTitleTubeStyle(accentColor, { bgColor }),
              lineHeight: 1.1,
              opacity: titleOp,
              transform: `translateY(${titleY}px)`,
              textAlign: "left",
              letterSpacing: "0.12em"
            }}
          >
            {title}
          </h1>

          {/* Neon line — matches title width feel */}
          <NeonLine width={p ? "120px" : "140px"} accentColor={accentColor} />

          {/* Narration body — one block per newline so breaks read clearly */}
          {narration && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: p ? 22 : 18,
                opacity: bodyOp,
                transform: `translateY(${bodyY}px)`,
                textAlign: "left",
                maxWidth: "100%",
              }}
            >
              {narrationBlocks(narration).map((block, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <div
                      aria-hidden
                      style={{
                        width: "min(100%, 320px)",
                        height: 1,
                        background: `linear-gradient(90deg, ${accentColor}55 0%, ${accentColor}18 45%, transparent 100%)`,
                        boxShadow: `0 0 6px ${accentColor}33`,
                        alignSelf: "stretch",
                      }}
                    />
                  )}
                  <p
                    style={{
                      margin: 0,
                      fontFamily: fontFamily ?? mono,
                      fontSize: descriptionFontSize ?? (p ? 38 : 32),
                      fontWeight: 400,
                      letterSpacing: "0.04em",
                      lineHeight: 1.95,
                      color: textColor,
                      WebkitFontSmoothing: "antialiased",
                    }}
                  >
                    {block}
                  </p>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
