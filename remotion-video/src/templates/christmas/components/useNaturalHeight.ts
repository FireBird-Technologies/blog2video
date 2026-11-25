/**
 * Measures the natural (unshrunk) height of a hidden probe block, so a layout can
 * grow its board / card to fit its text before any text has to shrink.
 *
 * Usage: render an off-screen probe (`visibility: hidden; position: absolute`) holding
 * the same text at its TARGET sizes and at the real text width, pass its ref here,
 * then size the box as clamp(natural + paddings, designMin, spaceBeforeNeighbour).
 *
 * Holds the render (delayRender) until fonts are ready and the probe is measured, the
 * same way useFitText does, so every render is deterministic.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { continueRender, delayRender } from "remotion";

export const useNaturalHeight = (ref: React.RefObject<HTMLElement>, deps: React.DependencyList): number => {
  const [height, setHeight] = React.useState(0);
  const handleRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (handleRef.current === null) handleRef.current = delayRender("christmas-natural-height");
    let cancelled = false;
    const release = () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };
    const measure = () => {
      if (cancelled || !el.isConnected) {
        release();
        return;
      }
      const h = Math.ceil(el.scrollHeight);
      setHeight((prev) => (prev === h ? prev : h));
      requestAnimationFrame(release);
    };
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.status === "loaded") measure();
    else if (fonts?.ready) fonts.ready.then(() => { if (!cancelled) measure(); });
    else measure();
    return () => {
      cancelled = true;
      release();
    };
    // Callers pass only stable (text / size / width) dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return height;
};

/** Off-screen probe style: laid out at a fixed width, never visible. */
export const probeStyle = (width: number): React.CSSProperties => ({
  position: "absolute",
  left: -100000,
  top: 0,
  width,
  visibility: "hidden",
  pointerEvents: "none",
});

/**
 * Like useNaturalHeight, but for a probe container whose direct children are several
 * blocks (e.g. one per step): returns each child's natural height, in order.
 */
export const useNaturalChildHeights = (ref: React.RefObject<HTMLElement>, deps: React.DependencyList): number[] => {
  const [heights, setHeights] = React.useState<number[]>([]);
  const handleRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (handleRef.current === null) handleRef.current = delayRender("christmas-natural-heights");
    let cancelled = false;
    const release = () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };
    const measure = () => {
      if (cancelled || !el.isConnected) {
        release();
        return;
      }
      const next = Array.from(el.children).map((c) => Math.ceil((c as HTMLElement).scrollHeight));
      setHeights((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
      requestAnimationFrame(release);
    };
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.status === "loaded") measure();
    else if (fonts?.ready) fonts.ready.then(() => { if (!cancelled) measure(); });
    else measure();
    return () => {
      cancelled = true;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return heights;
};
