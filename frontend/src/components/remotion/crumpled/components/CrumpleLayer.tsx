/**
 * Extra crumpling over a sheet while it is being handled: the scene backdrop's own
 * crease pattern, deepened, plus a finer web of wrinkles. `amount` 0..1 — at 0 it
 * renders nothing, leaving exactly the backdrop (so a sheet can be "pressed flat").
 * Pure shading (alpha facets) over whatever is beneath it.
 *
 * Mirror byte-identical in both trees (remotion-video + frontend).
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { PAPER_SHADE } from "../crumpledStyle";
import { PaperCreases, buildPaperSurface, paperLightAt, surfaceNormals } from "./paperSurface";

export const CrumpleLayer: React.FC<{
  seed: number;
  orientation: 0 | 1 | 2 | 3;
  paper: string;
  amount: number;
  /** Crease density of the scene's backdrop (so the deepened creases are ITS creases). */
  density?: number;
}> = ({ seed, orientation, paper, amount, density = 8 }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const coarse = useMemo(() => {
    const s = buildPaperSurface(width, height, seed, density);
    return { s, n: surfaceNormals(s) };
  }, [width, height, seed, density]);
  const fine = useMemo(() => {
    const s = buildPaperSurface(width, height, seed + 7, 17);
    return { s, n: surfaceNormals(s) };
  }, [width, height, seed]);
  if (amount <= 0.001) return null;
  const light = paperLightAt(frame / fps);
  const flip = orientation
    ? `translate(${width / 2} ${height / 2}) scale(${orientation & 1 ? -1 : 1} ${orientation & 2 ? -1 : 1}) translate(${-width / 2} ${-height / 2})`
    : undefined;
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: amount }}>
      <g transform={flip}>
        <PaperCreases surface={coarse.s} normals={coarse.n} light={light} paper={paper} ink={PAPER_SHADE} depth={3} />
      </g>
      <PaperCreases surface={fine.s} normals={fine.n} light={light} paper={paper} ink={PAPER_SHADE} depth={2.4} />
    </svg>
  );
};
