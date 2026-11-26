/**
 * Per-layout boilerplate: scene clock, canvas, orientation, palette, fonts and the
 * exit window — the same for every Snowy Christmas layout. Font SIZES are resolved
 * in each layout with getChristmasTypography, so their defaults stay editable by
 * Template Studio.
 *
 * Mirror byte-identical in all three trees.
 */
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneLayoutProps } from "../types";
import { clamp, isPortraitScene, winterPalette } from "../christmasStyle";
import { getChristmasFonts } from "../typography";

/** Frames every layout spends on its exit at the end of the scene. */
export const EXIT_FRAMES = 20;

/** 0→1 eased progress between two scene frames. */
export const ease = (frame: number, from: number, to: number, easing = Easing.out(Easing.cubic)) =>
  interpolate(frame, [from, to], [0, 1], { ...clamp, easing });

/** A springy pop (0→1 with a small overshoot) between two frames. */
export const pop = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.7)) });

export const useChristmasScene = (props: SceneLayoutProps) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const portrait = isPortraitScene(props.aspectRatio, width, height);
  const total = Math.max(1, Math.round(props.sceneDurationInFrames ?? durationInFrames));
  const exitFrames = Math.min(EXIT_FRAMES, Math.floor(total * 0.3));
  const exitStart = total - exitFrames;
  const variant = Math.abs(Math.round(props.sceneVariant ?? 0));
  return {
    frame,
    width,
    height,
    fps,
    portrait,
    total,
    /** First frame of this scene's exit. */
    exitStart,
    /** 0 → 1 over the exit window. */
    exit: interpolate(frame, [exitStart, total], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) }),
    pal: winterPalette(props),
    fonts: getChristmasFonts(props),
    /** Scene seed: the layout seed, shifted by the scene so neighbours differ. */
    seed: Math.round(props.seed ?? 0) + variant * 53,
    /** Safe content box (keeps clear of the logo corner and caption band). */
    pad: portrait ? { x: 80, top: 150, bottom: 240 } : { x: 130, top: 96, bottom: 130 },
  };
};

/** Split text into short sentences — used when an optional list field is missing. */
export const sentences = (text: string, max: number): string[] =>
  String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
