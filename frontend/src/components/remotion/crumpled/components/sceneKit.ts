/**
 * Per-layout boilerplate: scene clock, canvas,
 * orientation, palette and font — the same for every Crumpled layout. Font SIZES
 * are resolved in each layout with getCrumpledTypography, so their defaults stay
 * editable by Template Studio.
 *
 * Mirror byte-identical in both trees (remotion-video + frontend).
 */
import { useVideoConfig } from "remotion";
import type { SceneLayoutProps } from "../types";
import { isPortraitScene, paperPalette } from "../crumpledStyle";
import { getCrumpledFontFamily } from "../typography";
import { useSceneFrame } from "./Handwriting";

export const useCrumpledScene = (props: SceneLayoutProps) => {
  const frame = useSceneFrame(props);
  const { width, height, fps } = useVideoConfig();
  const portrait = isPortraitScene(props.aspectRatio, width, height);
  return {
    frame,
    width,
    height,
    fps,
    portrait,
    pal: paperPalette(props),
    font: getCrumpledFontFamily(props),
    /** Safe content box (keeps clear of the logo corner and caption band). */
    pad: portrait ? { x: 84, top: 150, bottom: 230 } : { x: 130, top: 96, bottom: 120 },
  };
};

/**
 * The crumple pattern of this scene's sheet: the layout's base seed/orientation and a
 * crease depth, shifted by the scene's `paperVariant` so no two scenes share the same
 * folds or the same amount of crumpling.
 */
export const scenePaper = (
  props: SceneLayoutProps,
  baseSeed: number,
  baseOrientation: 0 | 1 | 2 | 3,
): { seed: number; orientation: 0 | 1 | 2 | 3; depth: number } => {
  const v = Math.abs(Math.round(props.paperVariant ?? 0));
  return {
    seed: baseSeed + v * 97,
    orientation: ((baseOrientation + v) % 4) as 0 | 1 | 2 | 3,
    // How deeply this sheet is crumpled: a little more than a flat page, and different
    // from scene to scene (1.35 – 1.75) so neighbouring scenes don't look alike.
    depth: 1.35 + ((v * 37 + baseSeed) % 6) * 0.08,
  };
};

/** Split narration into short sentences — used when an optional list field is missing. */
export const sentences = (text: string, max: number): string[] =>
  String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
