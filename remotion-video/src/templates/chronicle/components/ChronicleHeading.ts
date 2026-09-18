import type { CSSProperties } from "react";
import { CHRONICLE_HEADING_FONT } from "../../../fonts/chronicle-defaults";

/** Typography shared by Chronicle scene titles, based on BookOpen V1's hero. */
export const chronicleHeroHeadingTypography = (fontFamily?: string): CSSProperties => ({
  fontFamily: fontFamily ?? CHRONICLE_HEADING_FONT,
  fontWeight: 900,
  lineHeight: 1.08,
  letterSpacing: "0.02em",
  textAlign: "center",
});

/** Exact settled (burnLevel 0.55) gold-bloom state of BookOpen V1's hero. */
export const chronicleHeroHeadingStyle = (
  accentColor: string,
  fontFamily?: string,
): CSSProperties => ({
  ...chronicleHeroHeadingTypography(fontFamily),
  color: accentColor,
  textShadow: chronicleHeroHeadingGlow(accentColor),
});

export const chronicleHeroHeadingGlow = (hex: string, heat = 0.55): string => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  const r = Number.isNaN(num) ? 184 : (num >> 16) & 255;
  const g = Number.isNaN(num) ? 134 : (num >> 8) & 255;
  const b = Number.isNaN(num) ? 11 : num & 255;
  const inner = `rgba(${Math.min(255, r + 95)}, ${Math.min(255, g + 75)}, ${Math.min(255, b + 55)}, ${0.88 * heat})`;
  const mid = `rgba(${Math.min(255, r + 48)}, ${Math.min(255, g + 38)}, ${Math.min(255, b + 22)}, ${0.72 * heat})`;
  const outer = `rgba(${r}, ${g}, ${b}, ${0.58 * heat})`;
  const distant = `rgba(${Math.round(r * 0.42)}, ${Math.round(g * 0.38)}, ${Math.round(b * 0.28)}, ${0.32 * heat})`;
  const edge = `rgba(${r}, ${g}, ${b}, 0.28)`;
  return `0 0 6px ${inner}, 0 0 14px ${mid}, 0 0 28px ${outer}, 0 0 52px ${distant}, 1px 1px 0 ${edge}`;
};
