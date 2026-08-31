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
import { DEFAULT_VARIANT, type KitVariant } from "./variants";

export interface KitFonts {
  heading?: string;
  body?: string;
}

export interface KitContextValue {
  palette: KitPalette;
  type: TypeScale;
  isPortrait: boolean;
  fonts: KitFonts;
  /** This template's structural variant — which arrangement content components
   *  render. Chosen once per template from a brand seed, so a template is
   *  internally consistent and two brands diverge. See variants.ts. */
  variant: KitVariant;
}

const KitContext = createContext<KitContextValue | null>(null);

/**
 * Ambient eyebrow (scene-title) size, in px.
 *
 * Provided ABOVE the scene by GeneratedVideo, not passed by the scene itself.
 * Generated scene code builds its own `overrides` object for SceneFrame
 * (`{ title, body }`) and every scene already stored in the DB was written
 * before an eyebrow size existed — so a scene will never forward it. Reading it
 * from an ambient context is what lets the editor's "Title font size" slider
 * reach the eyebrow on templates that already exist, with no regeneration.
 *
 * null = unset, which leaves the type scale's derived default in place.
 */
const EyebrowSizeContext = createContext<number | null>(null);

/**
 * Ambient structural variant, provided ABOVE the scene by GeneratedVideo.
 *
 * Same reasoning as EyebrowSizeContext: every scene already stored in the DB was
 * generated before variants existed and will never forward one, so an ambient
 * context is what lets EXISTING templates gain variety with no regeneration and
 * no change to the scene-generation prompt.
 *
 * null = unset, which leaves DEFAULT_VARIANT (the historical arrangement) in
 * place, so an un-seeded render is unchanged rather than arbitrary.
 */
const KitVariantContext = createContext<KitVariant | null>(null);

export const KitVariantProvider: React.FC<{
  variant?: KitVariant | null;
  children: React.ReactNode;
}> = ({ variant, children }) => (
  <KitVariantContext.Provider value={variant ?? null}>
    {children}
  </KitVariantContext.Provider>
);

export const EyebrowSizeProvider: React.FC<{
  size?: number;
  children: React.ReactNode;
}> = ({ size, children }) => (
  <EyebrowSizeContext.Provider value={typeof size === "number" && size > 0 ? size : null}>
    {children}
  </EyebrowSizeContext.Provider>
);

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
  overrides?: { title?: number; body?: number; label?: number };
  /** Explicit structural variant. Omitted, the ambient one is used. */
  variant?: KitVariant | null;
  children: React.ReactNode;
}

export const KitProvider: React.FC<KitProviderProps> = ({
  colors,
  isPortrait,
  fonts,
  overrides,
  variant,
  children,
}) => {
  // An explicit override from the scene wins; otherwise take the ambient size
  // provided above the scene (see EyebrowSizeProvider).
  const ambientLabel = useContext(EyebrowSizeContext);
  const label = overrides?.label ?? ambientLabel ?? undefined;
  // Same precedence for the variant: explicit prop, then ambient, then the
  // historical default so nothing changes when neither is set.
  const ambientVariant = useContext(KitVariantContext);
  const resolvedVariant = variant ?? ambientVariant ?? DEFAULT_VARIANT;
  const value = useMemo<KitContextValue>(
    () => ({
      palette: derivePalette(colors),
      type: typeScale(isPortrait, { ...overrides, label }),
      isPortrait,
      fonts: fonts ?? {},
      variant: resolvedVariant,
    }),
    [colors, isPortrait, fonts, overrides, label, resolvedVariant],
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
    variant: DEFAULT_VARIANT,
  };
}
