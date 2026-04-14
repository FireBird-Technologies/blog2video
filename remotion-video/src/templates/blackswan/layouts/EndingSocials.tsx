import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Swan } from "../components/Swan";
import type { BlackswanLayoutProps } from "../types";
import { BlackswanArcBirdPass, neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { NeonWater } from "./neonWater";
import { blackswanNeonPalette } from "./blackswanAccent";
import { SocialIcons } from "../../SocialIcons";

const display = "'Righteous', cursive";

const HIT = 1.35;
const DROP_DELAY = 0.08;
const IX = 500;
const IY = 560;
const DSY = 60;

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

function dropletOutline(u: number): { rx: number; ry: number; shapeOp: number } {
  const rx = interpolate(u, [0, 0.52, 0.83, 0.95, 1], [7, 6, 5.5, 9, 11], { extrapolateRight: "clamp" });
  const ry = interpolate(u, [0, 0.52, 0.83, 0.95, 1], [8, 13, 15, 9, 3], { extrapolateRight: "clamp" });
  let shapeOp = 1;
  if (u <= 0) shapeOp = 0;
  else if (u < 0.08) shapeOp = interpolate(u, [0, 0.08], [0, 1]);
  else if (u > 0.96) shapeOp = interpolate(u, [0.96, 1], [1, 0]);
  return { rx, ry, shapeOp };
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
        <filter id="bsw-fdrop-es" x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="bsw-fring-es" x="-140%" y="-140%" width="380%" height="380%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="b" />
        </filter>
      </defs>

      {t > DROP_DELAY && (
        <line x1={IX} y1={DSY} x2={IX} y2={t < HIT + 0.1 ? DSY + dropY : iy} stroke={pal.core} strokeWidth={1.5} filter="url(#bsw-fdrop-es)" opacity={0.4} />
      )}

      <g transform={`translate(0, ${dropY})`} opacity={gOpacity}>
        <ellipse cx={IX} cy={DSY} rx={drx * 2.8} ry={dry * 2.8} fill="none" stroke={pal.mid} strokeWidth={4} filter="url(#bsw-fdrop-es)" opacity={0.8 * shellOp} />
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
          <line key={ri} x1={IX} y1={iy} x2={ex} y2={ey} stroke={pal.core} strokeWidth={1.2} strokeDasharray={`${rl} ${rl}`} strokeDashoffset={offset} strokeLinecap="round" filter="url(#bsw-fdrop-es)" opacity={0.6} />
        );
      })}

      {rings.map((ring, i) => {
        // Loop shockwaves for the full scene (repeat expansion + short pause)
        const ringStart = HIT + ring.del;
        const elapsed = t - ringStart;
        const pauseAfter = 0.48;
        const cycle = ring.dur + pauseAfter;
        let p = 0;
        if (elapsed > 0) {
          const u = elapsed % cycle;
          p = Math.min(1, u / ring.dur);
        }
        const { rx, ry, opacity, sw } = shockRing(p, ring.rx, ring.ry);
        return (
          <ellipse key={i} cx={IX} cy={iy} rx={rx} ry={ry} fill="none" stroke={ring.stroke} strokeWidth={sw} filter="url(#bsw-fring-es)" opacity={opacity} />
        );
      })}
    </svg>
  );
};

export const EndingSocials: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    bgColor = "#000000",
    textColor = "#DFFFFF",
    descriptionFontSize,
    titleFontSize,
    fontFamily,
    aspectRatio = "landscape",
    socials,
    websiteLink,
    showWebsiteButton,
    ctaButtonText,
  } = props;

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const p = aspectRatio === "portrait";
  /** Droplet impact anchor — low in frame, below social row; syncs with bottom water */
  const iy = p ? 918 : 952;

  const contentOpacity = interpolate(t, [0.4, HIT], [0, 1], { extrapolateRight: "clamp" });
  const contentY = interpolate(t, [0.4, HIT], [15, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const swanOpacity = interpolate(t, [HIT - 0.5, HIT + 0.8], [0, 1], { extrapolateRight: "clamp" });
  const waterReveal = interpolate(t, [HIT, HIT + 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const ctaLabel = (ctaButtonText ?? title ?? "").trim();
  const showCta = ctaLabel.length > 0;
  const showWebsite = (showWebsiteButton !== false) && (websiteLink ?? "").trim().length > 0;
  const ctaFontSize = titleFontSize ?? (p ? 82 : 76);
  const narrSize = descriptionFontSize ?? (p ? 36 : 33);
  const hasSocials =
    socials && (Array.isArray(socials) ? socials.length > 0 : Object.keys(socials as Record<string, unknown>).length > 0);

  const waterBandOpacity = 0.28 * waterReveal;
  const swanSize = p ? 1000 : 900;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      <StarField accentColor={accentColor} />

      {/* Neon water — flush to bottom */}
      <div
        style={{
          position: "absolute",
          left: 0, right: 0, bottom: 0,
          height: p ? "28%" : "20%",
          opacity: waterBandOpacity,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 0,
        }}
      >
        <NeonWater
          uid="es-neon-water"
          cx={500}
          yPct={99}
          scale={1.55}
          rxBase={360}
          ryBase={6}
          maxRx={640}
          nRings={5}
          delay={0}
          hideBg
          fadeEdges
          accentColor={accentColor}
        />
      </div>

      {/* <BlackswanArcBirdPass
        uid="es-birds"
        accentColor={accentColor}
        portrait={p}
        sizeScale={hasSocials ? 1.42 : 1.08}
        zIndex={2}
      /> */}

      {/* ── CTA text — top, plain neon title ───────────────────────────────── */}
      {showCta && (
        <div
          style={{
            position: "absolute",
            top: p ? "18%" : "12%",
            left: 0, right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 3,
            opacity: contentOpacity,
            transform: `translateY(${contentY}px)`,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: fontFamily ?? display,
              fontSize: ctaFontSize,
              fontWeight: 400,
              ...neonTitleTubeStyle(accentColor, { bgColor }),
              letterSpacing: "0.12em",
              textTransform: "capitalize", // Changed from "uppercase" to "capitalize"
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            {ctaLabel}
          </span>
        </div>
      )}

      {/* ── Swan — centered absolutely ─────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "38%",
          transform: "translate(-50%, -50%)",
          zIndex: 1,
          opacity: swanOpacity,
          pointerEvents: "none",
        }}
      >
        <Swan size={swanSize} water={false} uid="es-swan" accentColor={accentColor} />
      </div>

      {/* ── Bottom stack: website → narration → socials ────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: 0, right: 0,
          bottom: p ? "34%" : "22%",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: p ? 10 : 12,
          padding: p ? "0 40px" : "0 80px",
          opacity: contentOpacity,
          transform: `translateY(${contentY}px)`,
          pointerEvents: "none",
        }}
      >
        {/* Website link */}
        {showWebsite && (
          <div
            style={{
              fontSize: Math.round(narrSize * 0.82),
              color: `${accentColor}CC`,
              fontFamily: fontFamily ?? display,
              letterSpacing: "0.05em",
              textAlign: "center",
              wordBreak: "break-all",
              maxWidth: p ? "88%" : "70%",
            }}
          >
            {(websiteLink ?? "").trim()}
          </div>
        )}

        {/* Narration */}
        {narration?.trim() ? (
          <p
            style={{
              margin: 0,
              fontFamily: fontFamily ?? display,
              fontSize: narrSize,
              color: textColor,
              lineHeight: 1.55,
              opacity: 0.92,
              whiteSpace: "pre-wrap",
              textAlign: "center",
              textShadow: `0 0 8px ${textColor}22`,
              maxWidth: p ? "90%" : 820,
            }}
          >
            {narration}
          </p>
        ) : null}

        {/* Social icons */}
        {hasSocials ? (
          <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <SocialIcons
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              socials={socials as any}
              accentColor={accentColor}
              textColor={textColor}
              maxPerRow={p ? 3 : 5}
              fontFamily={fontFamily ?? display}
              aspectRatio={aspectRatio}
            />
          </div>
        ) : null}
      </div>

      {/* Droplet impact */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
        <DropletImpact t={t} iy={iy} accentColor={accentColor} />
      </div>
    </AbsoluteFill>
  );
};
