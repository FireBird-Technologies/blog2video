/**
 * The shared scene exit: in the scene's last frames a gust of snow blows across and
 * whites the frame out. The next scene starts from white while its own snow settles
 * (see `useSnowClearIn`), so every scene looks the same played alone or in the video.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { clamp, FESTIVE } from "../christmasStyle";
import { Snowfall } from "./Snowfall";

export const SnowGustExit: React.FC<{ exit: number; portrait: boolean; seed: number }> = ({ exit, portrait, seed }) => {
  if (exit <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Snowfall count={portrait ? 60 : 90} seed={seed + 501} mode="flurry" scale={1.7} gust={exit} crystals />
      <AbsoluteFill style={{ backgroundColor: FESTIVE.snow, opacity: interpolate(exit, [0.3, 1], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
};

/** White veil that clears over a scene's first frames (pairs with the previous scene's gust). */
export const SnowClearIn: React.FC<{ frame: number; frames?: number }> = ({ frame, frames = 14 }) => {
  const o = interpolate(frame, [0, frames], [1, 0], clamp);
  if (o <= 0) return null;
  return <AbsoluteFill style={{ backgroundColor: FESTIVE.snow, opacity: o, pointerEvents: "none" }} />;
};
