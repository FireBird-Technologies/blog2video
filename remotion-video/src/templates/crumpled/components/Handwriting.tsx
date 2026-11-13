/**
 * Handwriting helpers: a scene clock (optionally held back by `enterDelayFrames`),
 * and write-on masks that reveal copy as if a pencil were writing it.
 *
 * Mirror byte-identical in both trees (remotion-video + frontend).
 */
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { clamp } from "../crumpledStyle";

/** Scene-local frame, minus any `enterDelayFrames` hold. */
export const useSceneFrame = (props: { enterDelayFrames?: number }): number =>
  useCurrentFrame() - Math.max(0, Math.round(props.enterDelayFrames ?? 0));

/** 0→1 eased progress between two scene frames. */
export const ease = (frame: number, from: number, to: number, easing = Easing.out(Easing.cubic)) =>
  interpolate(frame, [from, to], [0, 1], { ...clamp, easing });

/**
 * Reveals its children like handwriting.
 * - `line`: a soft-edged mask sweeps left → right (titles, one-liners).
 * - `block`: the mask sweeps top → bottom, so a paragraph appears line by line.
 */
export const Written: React.FC<{
  progress: number;
  mode?: "line" | "block";
  children: React.ReactNode;
  style?: React.CSSProperties;
  /** Text direction for centred / right aligned copy is irrelevant: the sweep is always reading order. */
}> = ({ progress, mode = "line", children, style }) => {
  const p = Math.max(0, Math.min(1, progress));
  const edge = mode === "line" ? 6 : 10;
  const at = -edge + p * (100 + edge * 2);
  const dir = mode === "line" ? "90deg" : "180deg";
  const mask =
    p >= 1 ? undefined : `linear-gradient(${dir}, #000 ${at.toFixed(2)}%, transparent ${(at + edge).toFixed(2)}%)`;
  return (
    <div style={{ ...style, WebkitMaskImage: mask, maskImage: mask }}>
      {children}
    </div>
  );
};
