import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Swan } from "../components/Swan";
import type { BlackswanLayoutProps } from "../types";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { NeonWater } from "./neonWater";
import { blackswanNeonPalette } from "./blackswanAccent";

// Righteous (Astigmatic / Google Fonts) — bundled via @fontsource/righteous
const mono = "'Righteous', cursive";
const display = "'Righteous', cursive";

/** Seconds: drop start → impact (lower = faster fall). */
const HIT = 1.35;
const DROP_DELAY = 0.08;
const IX = 500;
const IY = 560;
const DSY = 60;


function dropletOutline(u: number): { rx: number; ry: number; shapeOp: number } {
  const rx = interpolate(u, [0, 0.52, 0.83, 0.95, 1], [7, 6, 5.5, 9, 11], { extrapolateRight: "clamp" });
  const ry = interpolate(u, [0, 0.52, 0.83, 0.95, 1], [8, 13, 15, 9, 3], { extrapolateRight: "clamp" });
  let shapeOp = 1;
  if (u <= 0) shapeOp = 0;
  else if (u < 0.08) shapeOp = interpolate(u, [0, 0.08], [0, 1]);
  else if (u > 0.96) shapeOp = interpolate(u, [0.96, 1], [1, 0]);
  return { rx, ry, shapeOp };
}

function dropFallMotion(t: number, iy: number): { y: number; gOpacity: number; u: number } {
  const ny = iy - DSY;
  const u = (t - DROP_DELAY) / HIT;
  if (u <= 0) return { y: 0, gOpacity: 0, u: 0 };
  if (u >= 1) return { y: ny + 30, gOpacity: 0, u: 1 };
  const gOpacity = u < 0.08 ? interpolate(u, [0, 0.08], [0, 1]) : u > 0.96 ? interpolate(u, [0.96, 1], [1, 0]) : 1;
  const y = interpolate(u, [0, 0.84, 0.96, 1], [0, ny, ny + 26, ny + 30], {
    easing: Easing.bezier(0.38, 0.04, 0.52, 1),
    extrapolateRight: "clamp",
  });
  return { y, gOpacity, u };
}

function shockRing(p: number, maxRx: number, maxRy: number) {
  const rx = interpolate(p, [0, 1], [8, maxRx], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" });
  const ry = interpolate(p, [0, 1], [3, maxRy], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" });
  const opacity = interpolate(p, [0, 0.15, 0.5, 0.85, 1], [0.95, 0.88, 0.62, 0.28, 0], { extrapolateRight: "clamp" });
  const sw = interpolate(p, [0, 0.15, 0.5, 0.85, 1], [3, 2.4, 1.6, 0.8, 0.25], { extrapolateRight: "clamp" });
  return { rx, ry, opacity, sw };
}

const DropletImpact: React.FC<{ t: number; iy: number; accentColor: string }> = ({ t, iy, accentColor }) => {
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);
  const { y: dropY, gOpacity, u: fallU } = dropFallMotion(t, iy);
  const { rx: drx, ry: dry, shapeOp } = dropletOutline(fallU);
  const shellOp = gOpacity * shapeOp;

  const rayDur = 0.32;
  const rayOffset = (ri: number, rl: number) => {
    const start = HIT + ri * 0.01;
    const loc = t - start;
    if (loc <= 0) return rl;
    if (loc >= rayDur) return 0;
    return interpolate(loc, [0, rayDur], [rl, 0], { easing: Easing.out(Easing.quad) });
  };

  const rings = useMemo(
    () => [
      { rx: 460, ry: 148, dur: 1.45, del: 0, stroke: pal.core },
      { rx: 360, ry: 116, dur: 1.7, del: 0.12, stroke: pal.vivid },
      { rx: 270, ry: 87, dur: 2.0, del: 0.24, stroke: pal.mid },
    ],
    [pal],
  );

  return (
    <svg viewBox="0 0 1000 1000" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
      <defs>
        <filter id="bsw-fdrop-di" x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="bsw-fring-di" x="-140%" y="-140%" width="380%" height="380%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="b" />
        </filter>
      </defs>

      {t > DROP_DELAY && (
        <line x1={IX} y1={DSY} x2={IX} y2={t < HIT + 0.1 ? DSY + dropY : iy} stroke={pal.core} strokeWidth={1.5} filter="url(#bsw-fdrop-di)" opacity={0.4} />
      )}

      <g transform={`translate(0, ${dropY})`} opacity={gOpacity}>
        <ellipse cx={IX} cy={DSY} rx={drx * 2.8} ry={dry * 2.8} fill="none" stroke={pal.mid} strokeWidth={4} filter="url(#bsw-fdrop-di)" opacity={0.8 * shellOp} />
        <ellipse cx={IX} cy={DSY} rx={drx * 1.5} ry={dry * 1.5} fill="none" stroke={pal.bright} strokeWidth={1} opacity={0.9 * shellOp} />
      </g>

      {Array.from({ length: 20 }).map((_, ri) => {
        const ang = ((-180 + ri * (180 / 19)) * Math.PI) / 180;
        const rl = 60 + (ri % 3) * 25;
        const ex = IX + Math.cos(ang) * rl;
        const ey = iy + Math.sin(ang) * rl;
        const offset = rayOffset(ri, rl);
        if (t < HIT) return null;
        return (
          <line key={ri} x1={IX} y1={iy} x2={ex} y2={ey} stroke={pal.core} strokeWidth={1.2} strokeDasharray={`${rl} ${rl}`} strokeDashoffset={offset} strokeLinecap="round" filter="url(#bsw-fdrop-di)" opacity={0.6} />
        );
      })}

      {rings.map((ring, i) => {
        const p = interpolate(t, [HIT + ring.del, HIT + ring.del + ring.dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const { rx, ry, opacity, sw } = shockRing(p, ring.rx, ring.ry);
        return (
          <ellipse key={i} cx={IX} cy={iy} rx={rx} ry={ry} fill="none" stroke={ring.stroke} strokeWidth={sw} filter="url(#bsw-fring-di)" opacity={opacity} />
        );
      })}
    </svg>
  );
};

export const DropletIntro: React.FC<BlackswanLayoutProps> = (props) => {
  const { title, narration, accentColor = "#00E5FF", bgColor = "#000000", textColor = "#FFFFFF", titleFontSize, descriptionFontSize, fontFamily, aspectRatio = "landscape", imageUrl } = props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const portrait = aspectRatio === "portrait";
  const iy = portrait ? IY : 490;

  // Image appears in last 3 seconds, fades in over 0.7s
  const totalSec = durationInFrames / fps;
  const imgStartSec = Math.max(totalSec - 3, HIT + 0.5);
  const hasImage = !!imageUrl;
  const imgOpacity = hasImage
    ? interpolate(t, [imgStartSec, imgStartSec + 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  // Fade out scene content as image appears
  const sceneContentOp = hasImage
    ? interpolate(t, [imgStartSec, imgStartSec + 0.5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  const textOpacity = interpolate(t, [0.4, HIT], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(t, [0.4, HIT], [15, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const swanOpacity = interpolate(t, [HIT - 0.5, HIT + 0.8], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {/* Scene content — fades out when image takes over */}
      <div style={{ position: "absolute", inset: 0, opacity: sceneContentOp }}>
        <StarField accentColor={accentColor} />

        {/* Neon Water pond at droplet impact — fades in on hit */}
        <div style={{
          position: "absolute", inset: 0,
          opacity: interpolate(t, [HIT, HIT + 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          <NeonWater
            uid="d0-neon-water"
            cx={500}
            yPct={iy / 10}
            rxBase={110}
            ryBase={20}
            maxRx={240}
            nRings={6}
            delay={0}
            hideBg
            accentColor={accentColor}
          />
        </div>

        <DropletImpact t={t} iy={iy} accentColor={accentColor} />

        {/* Swan Container */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: portrait ? "5%" : "-16%",
          transform: "translateX(-50%)",
          opacity: swanOpacity,
        }}>
          <Swan size={portrait ? 1550 : 1200} water={false} uid="d0-swan" accentColor={accentColor} />
        </div>

        {/* Text Container */}
        <div style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: portrait ? "15%" : "10%",
          padding: portrait ? "0 40px" : "0 80px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: portrait ? 6 : 10,
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{
              fontFamily: fontFamily ?? display,
              fontSize: titleFontSize ?? (portrait ? 73 : 74),
              fontWeight: 400,
              ...neonTitleTubeStyle(accentColor, { bgColor }),
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              lineHeight: 1.2,
              textAlign: "center",
            }}>
              {title}
            </span>
          </div>

          <div style={{ height: 3, width: portrait ? 320 : 400, background: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />

          {narration && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {narration.split(" ").map((w, i) => (
                <span key={i} style={{
                  fontSize: descriptionFontSize ?? (portrait ? 36 : 33),
                  color: textColor,
                  fontFamily: fontFamily ?? display,
                  fontWeight: 400,
                  letterSpacing: "0.06em",
                  lineHeight: 1.5,
                }}>
                  {w}
                </span>
              ))}
            </div>
          )}

          <div style={{
            marginTop: 15,
            color: accentColor,
            fontFamily: fontFamily ?? mono,
            fontSize: 24,
            fontWeight: 400,
            letterSpacing: 8,
            opacity: 0.5,
            textTransform: "uppercase",
          }}>
            BLACKSWAN
          </div>
        </div>
      </div>

      {/* Full-screen image overlay — last 3 seconds */}
      {hasImage && (
        <div style={{ position: "absolute", inset: 0, opacity: imgOpacity, zIndex: 10 }}>
          <img
            src={imageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {/* Dark overlay so particles are visible */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
          {/* Particles on top of image */}
          <div style={{ position: "absolute", inset: 0 }}>
            <StarField accentColor={accentColor} />
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
