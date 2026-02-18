import React from "react";

export const COLORS = {
  ACCENT: "#F97316",
  BG: "#FAFAFA",
  WHITE: "#FFFFFF",
  DARK: "#171717",
  MUTED: "#6B7280",
};

export const FONT_FAMILY = {
  SANS: "'Inter', 'Segoe UI', 'Helvetica Neue', sans-serif", // Fallback for DM Sans
  SERIF: "'Georgia', 'Cambria', 'Times New Roman', serif",
  MONO: "'Courier New', monospace",
};

export const glass = (accent: boolean) => ({
  backgroundColor: accent
    ? "rgba(249,115,22,0.85)"
    : "rgba(255,255,255,0.65)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: accent
    ? "1px solid rgba(255,255,255,0.35)"
    : "1px solid rgba(255,255,255,0.7)",
  boxShadow: accent
    ? "0 8px 32px rgba(249,115,22,0.3), inset 0 1px 0 rgba(255,255,255,0.3)"
    : "0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
  borderRadius: 24, // Slightly rounder
  color: accent ? COLORS.WHITE : COLORS.DARK,
});

export const fitText = (text: string | undefined, maxChars: number = 50) => {
  if (!text) return 14;
  const length = text.length;
  if (length < maxChars / 2) return 100; // percent
  return Math.max(70, 100 - (length - maxChars / 2)); // scale down
};
