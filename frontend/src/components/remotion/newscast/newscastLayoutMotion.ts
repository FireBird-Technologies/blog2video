import type { CSSProperties } from "react";
import { interpolate } from "remotion";
import { DEFAULT_NEWSCAST_ACCENT, toRgba } from "./themeUtils";

/** Primary Oswald headlines: slightly stronger than 700 for on-air punch. */
export const HEADLINE_WEIGHT = 800 as const;

/** Default static glow for backward compatibility. */
export const headlineTextShadow = {
  light: "0 2px 24px rgba(232,32,32,0.18), 0 0 20px rgba(30,95,212,0.12)",
  strong: "0 4px 32px rgba(232,32,32,0.28), 0 0 28px rgba(30,95,212,0.2)",
} as const;

/** Dynamic glow for templates that bind to theme accent. */
export function headlineTextShadowFor(accentColor?: string) {
  const accent = accentColor || DEFAULT_NEWSCAST_ACCENT;
  return {
    light: `0 2px 24px ${toRgba(accent, 0.18)}, 0 0 20px rgba(30,95,212,0.12)`,
    strong: `0 4px 32px ${toRgba(accent, 0.28)}, 0 0 28px rgba(30,95,212,0.2)`,
  } as const;
}

export type HeadlinePop = {
  scale: number;
  rotateZ: number;
  translateY: number;
  opacity: number;
};

/**
 * Short entrance: zoom + slight rotateZ + settle. Broadcast-safe (few degrees).
 */
export function headlinePop(frame: number, delayFrames = 0): HeadlinePop {
  const f = frame - delayFrames;
  const scale = interpolate(f, [0, 10, 22, 34], [0.88, 1.04, 0.99, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateZ = interpolate(f, [0, 14, 28], [-5, 1.2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(f, [0, 12, 26], [14, -4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(f, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { scale, rotateZ, translateY, opacity };
}

export function headlinePopStyle(pop: HeadlinePop): CSSProperties {
  return {
    transform: `scale(${pop.scale}) rotateZ(${pop.rotateZ}deg) translateY(${pop.translateY}px)`,
    transformOrigin: "center center",
    opacity: pop.opacity,
  };
}

/** Split-glass column titles: higher-contrast zoom + rotate (still a few degrees). */
export function headlinePopObvious(frame: number, delayFrames = 0): HeadlinePop {
  const f = frame - delayFrames;
  const scale = interpolate(f, [0, 12, 26, 38], [0.76, 1.14, 0.96, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateZ = interpolate(f, [0, 16, 32], [-8, 2.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(f, [0, 14, 30], [32, -8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(f, [0, 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { scale, rotateZ, translateY, opacity };
}

/** Glass narrative headline: bolder zoom + twist than default `headlinePop`. */
export function glassNarrativeHeadlinePop(frame: number, delayFrames = 0): HeadlinePop {
  const f = frame - delayFrames;
  const scale = interpolate(f, [0, 11, 24, 36], [0.82, 1.1, 0.98, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateZ = interpolate(f, [0, 14, 30], [-7, 2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(f, [0, 12, 28], [22, -6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(f, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { scale, rotateZ, translateY, opacity };
}

/** Chapter break: label + title snap with strong overshoot. */
export function chapterBreakHeadlinePop(frame: number, delayFrames = 0): HeadlinePop {
  const f = frame - delayFrames;
  const scale = interpolate(f, [0, 12, 28, 40], [0.72, 1.18, 0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateZ = interpolate(f, [0, 14, 32], [-10, 3, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(f, [0, 14, 32], [36, -10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(f, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { scale, rotateZ, translateY, opacity };
}

export type PanelTumble = {
  translateY: number;
  rotateX: number;
  scale: number;
  opacity: number;
};

/**
 * Glass panels: rise from below with a slight forward tilt that settles.
 */
export function panelTumbleUp(frame: number, delayFrames = 0): PanelTumble {
  const f = frame - delayFrames;
  const translateY = interpolate(f, [0, 12, 26, 38], [72, -12, 6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateX = interpolate(f, [0, 14, 30], [14, -3, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(f, [0, 10, 24], [0.94, 1.02, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(f, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { translateY, rotateX, scale, opacity };
}

/** Glass narrative main card: deeper rise + tilt vs default tumble. */
export function glassNarrativePanelTumble(frame: number, delayFrames = 0): PanelTumble {
  const f = frame - delayFrames;
  const translateY = interpolate(f, [0, 14, 30, 42], [96, -16, 8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateX = interpolate(f, [0, 16, 34], [18, -4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(f, [0, 12, 28], [0.9, 1.05, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(f, [0, 11], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { translateY, rotateX, scale, opacity };
}

/** Chapter break: heavier travel + slam for the center stack. */
export function panelTumbleUpErupt(frame: number, delayFrames = 0): PanelTumble {
  const f = frame - delayFrames;
  const translateY = interpolate(f, [0, 14, 32, 46], [120, -22, 10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotateX = interpolate(f, [0, 16, 36], [22, -5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(f, [0, 12, 30], [0.86, 1.08, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(f, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { translateY, rotateX, scale, opacity };
}

export function panelTumbleStyle(tumble: PanelTumble, perspectivePx = 1000): CSSProperties {
  return {
    transform: `perspective(${perspectivePx}px) translateY(${tumble.translateY}px) rotateX(${tumble.rotateX}deg) scale(${tumble.scale})`,
    transformOrigin: "center bottom",
    opacity: tumble.opacity,
  };
}
