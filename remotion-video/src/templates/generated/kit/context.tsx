/**
 * Custom-template craft kit — theme context.
 *
 * SceneFrame derives the palette + type scale once and exposes them to all kit
 * components via context, so generated scene code only passes brandColors once.
 */

import React, { createContext, useContext, useMemo } from "react";
import {
  derivePalette,
  typeScale,
  type KitColors,
  type KitPalette,
  type TypeScale,
} from "./theme";

export interface KitFonts {
  heading?: string;
  body?: string;
}

export interface KitContextValue {
  palette: KitPalette;
  type: TypeScale;
  isPortrait: boolean;
  fonts: KitFonts;
}

const KitContext = createContext<KitContextValue | null>(null);

/** Map the GeneratedSceneProps brandColors shape into kit colors. */
export function colorsFromBrand(brand: {
  accent?: string;
  primary?: string;
  background?: string;
  text?: string;
  bg2?: string;
}): KitColors {
  return {
    accent: brand.accent || brand.primary || "#6366F1",
    bg: brand.background || "#0B0B0F",
    bg2: brand.bg2,
    text: brand.text || "#FFFFFF",
  };
}

export interface KitProviderProps {
  colors: KitColors;
  isPortrait: boolean;
  fonts?: KitFonts;
  /** Honor user font-size overrides from Settings. */
  overrides?: { title?: number; body?: number };
  children: React.ReactNode;
}

export const KitProvider: React.FC<KitProviderProps> = ({
  colors,
  isPortrait,
  fonts,
  overrides,
  children,
}) => {
  const value = useMemo<KitContextValue>(
    () => ({
      palette: derivePalette(colors),
      type: typeScale(isPortrait, overrides),
      isPortrait,
      fonts: fonts ?? {},
    }),
    [colors, isPortrait, fonts, overrides],
  );
  return <KitContext.Provider value={value}>{children}</KitContext.Provider>;
};

/** Access the kit theme. Falls back to sane defaults if used outside a frame. */
export function useKit(): KitContextValue {
  const ctx = useContext(KitContext);
  if (ctx) return ctx;
  return {
    palette: derivePalette({ accent: "#6366F1", bg: "#0B0B0F", text: "#FFFFFF" }),
    type: typeScale(false),
    isPortrait: false,
    fonts: {},
  };
}
