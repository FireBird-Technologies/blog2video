import React, { useMemo, useId } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { mixTheme, withOpacity } from "./themeColor";

const BLUE = "#217cff";

function seeded(seed: number) {
  let state = seed || 42;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

type BackdropProps = {
  seed?: number;
  horizon?: boolean;
  density?: number;
  transparent?: boolean;
  brightness?: number;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  dustDensity?: number;
};

/** Animated, palette-driven night sky shared by every Starlit scene. */
export const SpaceBackdrop: React.FC<BackdropProps> = ({
  seed = 42,
  horizon = false,
  density = 180,
  transparent = false,
  brightness = 1,
  accentColor = BLUE,
  backgroundColor = "#000000",
  textColor = "#ffffff",
  dustDensity = 0,
}) => {
  const thTxt = textColor; const thBg = backgroundColor; const thAcc = accentColor;
  const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const skyId = `sky-${useId().replace(/:/g, "")}`;
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const stars = useMemo(() => {
    const next = seeded(seed);
    // Keep enough points to read at player scale; varied sizes and luminance
    // preserve the quiet night-sky hierarchy instead of uniform glitter.
    const count = Math.max(150, Math.round(density * .90));
    return Array.from({ length: count }, () => ({
      x: next() * width,
      y: next() * height,
      r: (0.7 + Math.pow(next(), 2.8) * 1.9) * Math.min(width, height) / 1080,
      phase: next() * Math.PI * 2,
      speed: 0.16 + next() * 0.22,
      blue: next() > 0.72,
      drift: 2.5 + next() * 7.5,
      driftPeriod: 7 + next() * 11,
      driftPhase: next() * Math.PI * 2,
      depth: .2 + next() * .8,
      glint: next() > 0.86,
      glintPeriod: 5 + next() * 7,
      glintPhase: next() * Math.PI * 2,
    }));
  }, [seed, density, width, height]);
  const dust = useMemo(() => {
    const next = seeded(seed + 1709);
    const count = Math.round(dustDensity * .16);
    return Array.from({ length: count }, (_, index) => {
      const x = next() * width;
      const bandY = height * (.64 - .30 * (x / Math.max(1, width)));
      const spread = (next() + next() + next() - 1.5) * height * .34;
      return {
        x,
        y: bandY + spread,
        r: .2 + Math.pow(next(), 3.2) * 1.25,
        opacity: .12 + next() * .44,
        phase: next() * Math.PI * 2,
        drift: .4 + next() * 2.2,
        accent: index % 5 !== 0,
        glow: next() > .965,
      };
    });
  }, [seed, dustDensity, width, height]);
  const meteors = useMemo(() => {
    const next = seeded(seed + 8317);
    return Array.from({length: 3}, (_, index) => ({
      x: width * (.08 + next() * .6), y: height * (.08 + next() * .68),
      delay: 1.8 + index * 3.7 + next() * .8,
      period: 13 + next() * 5, duration: .85 + next() * .45,
      distance: Math.min(width, height) * (.26 + next() * .16),
    }));
  }, [seed, width, height]);
  const t = frame / fps;
  const horizonRise = interpolate(frame, [0, Math.max(1, fps * 5)], [0, height * 0.04], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: transparent ? "transparent" : backgroundColor, overflow: "hidden" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={`${skyId}-meteor`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0" />
            <stop offset="65%" stopColor={accentColor} stopOpacity=".45" />
            <stop offset="100%" stopColor={textColor} stopOpacity=".9" />
          </linearGradient>
          <radialGradient id={`${skyId}-starlit-nebula-a`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.20" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${skyId}-starlit-nebula-b`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.09" />
            <stop offset="100%" stopColor={textColor} stopOpacity="0" />
          </radialGradient>
          <filter id={`${skyId}-starlit-blue-glow`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" result="wide" /><feGaussianBlur stdDeviation="2" result="near" /><feMerge><feMergeNode in="wide" /><feMergeNode in="near" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id={`${skyId}-starlit-star-glow`} x="-180%" y="-180%" width="460%" height="460%"><feGaussianBlur stdDeviation="1.15" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <ellipse cx={width * 0.22 + Math.sin(t / 8) * 35} cy={height * 0.24} rx={width * 0.72} ry={height * 0.55} fill={`url(#${skyId}-starlit-nebula-a)`} />
        <ellipse cx={width * 0.82 + Math.cos(t / 10) * 28} cy={height * 0.60} rx={width * 0.65} ry={height * 0.65} fill={`url(#${skyId}-starlit-nebula-b)`} />
        {dustDensity > 0 ? (
          <g>
            {dust.map((particle, index) => {
              const pulse = .78 + Math.sin(t * .34 + particle.phase) * .22;
              const spanX = width + 24;
              const spanY = height + 24;
              const dx = ((particle.x + 12 + t * (3.5 + particle.opacity * 7)) % spanX) - 12;
              const dy = ((particle.y + 12 + t * (1.1 + particle.opacity * 2.4) + Math.cos(t * .1 + particle.phase) * particle.drift * .45) % spanY) - 12;
              return (
                <circle
                  key={`dust-${index}`}
                  cx={dx}
                  cy={dy}
                  r={particle.r}
                  fill={particle.accent ? accentColor : textColor}
                  opacity={particle.opacity * pulse * brightness}
                  filter={particle.glow ? `url(#${skyId}-starlit-star-glow)` : undefined}
                />
              );
            })}
          </g>
        ) : null}
        {stars.map((star, index) => {
          const angle = t / star.driftPeriod * Math.PI * 2 + star.driftPhase;
          const spanX = width + 24;
          const spanY = height + 24;
          const x = ((star.x + 12 + t * (7 + star.depth * 15) + Math.sin(angle) * star.drift * .22) % spanX) - 12;
          const y = ((star.y + 12 + t * (2 + star.depth * 4.5) + Math.cos(angle * .83) * star.drift * .14) % spanY) - 12;
          const slowPulse = Math.sin(t * star.speed * Math.PI * 2 + star.phase);
          const finePulse = Math.sin(t * (star.speed * 2.35) * Math.PI * 2 + star.phase * 1.7);
          const twinkle = .60 + .32 * slowPulse + .08 * finePulse;
          const glintWave = Math.max(0, Math.sin(t / star.glintPeriod * Math.PI * 2 + star.glintPhase));
          const glint = star.glint ? Math.pow(glintWave, 4) : 0;
          const color = star.blue ? accentColor : textColor;

          return (
            <g key={index} transform={`translate(${x} ${y})`}>
              {/* Fixed stellar cores and broad, slow halos avoid glitter-like flashes. */}
              <circle r={star.r} fill={color} opacity={Math.min(1, (.30 + .60 * twinkle + .16 * glint) * Math.max(.85, brightness))} />
              {star.glint ? (
                <circle
                  r={star.r * 2.3}
                  fill={textColor}
                  opacity={(.05 + glint * .32) * Math.max(.85, brightness)}
                  filter={`url(#${skyId}-starlit-star-glow)`}
                />
              ) : null}
            </g>
          );
        })}
        {meteors.map((meteor, index) => {
          const local = t - meteor.delay;
          if (local < 0) return null;
          const progress = (local % meteor.period) / meteor.duration;
          if (progress > 1) return null;
          const x = meteor.x + progress * meteor.distance;
          const y = meteor.y + progress * meteor.distance * .42;
          const tail = Math.min(width, height) * .10;
          return (
            <g key={`meteor-${index}`} opacity={Math.sin(progress * Math.PI) * .65}>
              <line x1={x - tail} y1={y - tail * .42} x2={x} y2={y}
                stroke={`url(#${skyId}-meteor)`} strokeWidth={Math.max(.8, Math.min(width, height) / 1080)} strokeLinecap="round" />
              <circle cx={x} cy={y} r={Math.min(width, height) / 1080} fill={textColor} opacity=".8" />
            </g>
          );
        })}
        {horizon && (
          <circle
            cx={width / 2}
            cy={height + Math.max(width, height) * 0.88 - horizonRise}
            r={Math.max(width, height) * 1.06}
            fill={backgroundColor}
            stroke={accentColor}
            strokeWidth=".8"
            filter={`url(#${skyId}-starlit-blue-glow)`}
          />
        )}
      </svg>
    </AbsoluteFill>
  );
};

type PlanetLimbProps = {
  textColor?: string;
  bgColor?: string;
  /** Centre in canvas percentages. Values outside 0–1 intentionally crop the planet. */
  x?: number;
  y?: number;
  radius?: number;
  opacity?: number;
  showMark?: boolean;
  atmosphereOpacity?: number;
  beaconIntensity?: number;
  reverseBeacon?: boolean;
  accentColor?: string;
};

/**
 * Minimal blue atmospheric limb based on the supplied reference: no painted
 * sphere, just the edge of a planet appearing from the darkness. The optional
 * mark is a compact line-art ringed planet, not a decorative illustration.
 */
export const PlanetLimb: React.FC<PlanetLimbProps> = ({
  textColor = "#ffffff",
  bgColor = "#000000",
  x = 0.82,
  y = 1.08,
  radius = 0.58,
  opacity = 1,
  showMark = false,
  atmosphereOpacity = 1,
  beaconIntensity = 1,
  reverseBeacon = false,
  accentColor = BLUE,
}) => {
  const thTxt = textColor; const thBg = bgColor; const thAcc = accentColor ?? "#217cff";
  const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cx = width * x;
  const cy = height * y;
  const r = Math.max(width, height) * radius;
  const shimmer = .68 + Math.sin(frame * .055) * .10;
  // A bright travelling point gives each visible planetary edge the reference's
  // living atmosphere, rather than leaving it as a static blue stroke.
  const travel = (frame % 210) / 210;
  const travelAngle = Math.PI * (reverseBeacon ? 1.92 - travel * .68 : 1.17 + travel * .66);
  const glowX = cx + Math.cos(travelAngle) * r;
  const glowY = cy + Math.sin(travelAngle) * r;
  const markX = width * .12;
  const markY = height * .18;
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity, overflow: "hidden" }}>
      <defs>
        <filter id="starlit-limb-halo" x="-180%" y="-180%" width="460%" height="460%">
          <feGaussianBlur stdDeviation="24" />
        </filter>
        <filter id="starlit-limb-core" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" result="near" />
          <feMerge><feMergeNode in="near" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="starlit-limb-flare" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={thTxt} stopOpacity="1" />
          <stop offset="10%" stopColor={thTxt} stopOpacity=".66" />
          <stop offset="28%" stopColor={accentColor} stopOpacity=".6" />
          <stop offset="68%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="starlit-limb-flare-streak" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={thTxt} stopOpacity="1" />
          <stop offset="7%" stopColor={thTxt} stopOpacity=".9" />
          <stop offset="34%" stopColor={accentColor} stopOpacity=".78" />
          <stop offset="70%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={thBg} />
      {/* The live Notestack horizon is a crisp 1px rim over two broad blue
          shadows. Keeping the core unblurred makes it read as light, not ink. */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={accentColor} strokeWidth="34" opacity={shimmer * atmosphereOpacity * .13} filter="url(#starlit-limb-halo)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={accentColor} strokeWidth="8" opacity={shimmer * atmosphereOpacity * .4} filter="url(#starlit-limb-core)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={accentColor} strokeWidth="1.15" opacity="1" />
      <circle cx={cx} cy={cy} r={r - .7} fill="none" stroke={thTxt} strokeWidth=".42" opacity=".42" />

      {/* A tangential 16vw flare plus a soft 56px corona ports the reference
          CSS directly. Unlike the previous radius-scaled circles, the white
          core stays compact even when the planet centre sits far off-canvas. */}
      <ellipse
        cx={glowX}
        cy={glowY}
        rx={width * .08}
        ry={Math.max(1.5, height * .0022)}
        fill="url(#starlit-limb-flare-streak)"
        opacity={Math.min(1, .92 * beaconIntensity + .18)}
        transform={`rotate(${travelAngle * 180 / Math.PI + 90} ${glowX} ${glowY})`}
        filter="url(#starlit-limb-core)"
      />
      <circle
        cx={glowX}
        cy={glowY}
        r={28 * Math.max(.72, beaconIntensity)}
        fill="url(#starlit-limb-flare)"
        opacity={Math.min(1, .84 * beaconIntensity + .2)}
      />
      <circle cx={glowX} cy={glowY} r={3.6} fill={thTxt} opacity="1" />
      {showMark ? (
        <g transform={`translate(${markX} ${markY}) rotate(-18)`} fill="none" stroke={thAcc} strokeLinecap="round">
          <ellipse cx="0" cy="0" rx="23" ry="7" strokeWidth="2.4" />
          <circle cx="0" cy="0" r="9" strokeWidth="2.4" />
          <path d="M-21 1 Q0-13 21 1" strokeWidth="2.4" />
        </g>
      ) : null}
    </svg>
  );
};

type NotestackHorizonProps = {
  textColor?: string;
  bgColor?: string;
  portrait?: boolean;
  accentColor?: string;
  placement?: "bottom" | "right";
  beaconOpacity?: number;
  portraitHorizonOffset?: number;
  /** Portrait only: apex depth as a multiple of the width. Smaller = a wider, flatter planet. */
  portraitDepthW?: number;
  /** A brighter silver sparkle with cross spikes, riding the limb from the very first frame. */
  brightSparkle?: boolean;
  /** Seconds for the sparkle to ride the visible limb (default 18). */
  sparkleCycleSeconds?: number;
};

/** Reference-matched black planetary limb, blue atmosphere, and compact sunrise. */
export const NotestackHorizon: React.FC<NotestackHorizonProps> = ({
  textColor = "#ffffff",
  bgColor = "#000000",
  portrait = false,
  accentColor = BLUE,
  beaconOpacity = 1,
  portraitHorizonOffset = 0,
  portraitDepthW,
  brightSparkle = false,
  sparkleCycleSeconds = 18,
}) => {
  const thTxt = textColor; const thBg = bgColor; const thAcc = accentColor ?? "#217cff";
  const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const portraitOffsetY = portrait ? height * portraitHorizonOffset : 0;
  // Keep the planet optically centred. The old diagonal quadratic made the
  // hero feel like a wipe; this is a real circular limb with bilateral balance.
  const cx = width / 2;
  // Preserve the chosen apex height, then solve the circle through both
  // bottom canvas corners so the planetary limb reaches edge-to-edge exactly.
  const rimY = portrait
    ? portraitDepthW != null
      ? height * (1 + portraitHorizonOffset) - width * portraitDepthW
      : height * (.89 + portraitHorizonOffset) - width * .64
    : height * 1.68 - width * .61;
  const visibleDepth = Math.max(1, height - rimY);
  const r = ((width / 2) ** 2 + visibleDepth ** 2) / (2 * visibleDepth);
  const cy = rimY + r;
  const horizonPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  // Match the live Notestack hero: the sunrise takes 18 seconds to ride the
  // visible limb. The eased progress keeps the motion calm at both ends.
  const flareCycle = (frame % Math.max(1, fps * sparkleCycleSeconds)) / Math.max(1, fps * sparkleCycleSeconds);
  const flareTravel = .5 - Math.cos(flareCycle * Math.PI) * .5;
  // The hero sparkle starts well inside the frame, so it is already visible on the first frame.
  const flareAngle = brightSparkle ? Math.PI * (1.27 + flareTravel * .46) : Math.PI * (1.18 + flareTravel * .64);
  const flareX = cx + Math.cos(flareAngle) * r;
  const flareY = cy + Math.sin(flareAngle) * r;
  // The reference uses a 56px glow body at 1080px tall (28px radius).
  const flareRadius = Math.min(width, height) * (brightSparkle ? .04 : .026);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden"}}>
      <defs>
        <filter id="starlit-horizon-wide-glow" x="-30%" y="-80%" width="160%" height="260%">
          <feGaussianBlur stdDeviation={Math.max(8, Math.min(width, height) * .018)} />
        </filter>
        <filter id="starlit-horizon-near-glow" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation={Math.max(2, Math.min(width, height) * .0048)} />
        </filter>
        <radialGradient id="starlit-horizon-flare" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={thTxt} stopOpacity="1" />
          <stop offset="8%" stopColor={thTxt} stopOpacity=".94" />
          <stop offset="22%" stopColor={thPale} stopOpacity=".72" />
          <stop offset="48%" stopColor={accentColor} stopOpacity=".48" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={thBg} />
      <path d={horizonPath} fill="none" stroke={accentColor} strokeWidth={Math.max(30, Math.min(width, height) * .06)} opacity=".12" filter="url(#starlit-horizon-wide-glow)" />
      <path d={horizonPath} fill="none" stroke={accentColor} strokeWidth={Math.max(7, Math.min(width, height) * .014)} opacity=".28" filter="url(#starlit-horizon-near-glow)" />
      <path d={horizonPath} fill="none" stroke={accentColor} strokeWidth={Math.max(1, Math.min(width, height) * .00135)} opacity="1" />
      <path d={horizonPath} fill="none" stroke={thTxt} strokeWidth={Math.max(.35, Math.min(width, height) * .00038)} opacity=".42" />
      <circle cx={flareX} cy={flareY} r={flareRadius} fill="url(#starlit-horizon-flare)" opacity={beaconOpacity} />
      <circle cx={flareX} cy={flareY} r={Math.max(1.8, Math.min(width, height) * (brightSparkle ? .0032 : .0024))} fill={thTxt} opacity={.98 * beaconOpacity} filter="url(#starlit-horizon-near-glow)" />
    </svg>
  );
};
