/**
 * The crumpled sheet every Crumpled Paper scene is drawn on.
 *
 * - The crumpled-paper surface (paperSurface.tsx): an irregular web of facets and
 *   folds, lit from a slowly orbiting light, so the creases catch light and fall
 *   into shadow as the scene plays ("slight motion").
 * - The whole sheet drifts and breathes by a fraction of a percent.
 * - A STATIC fractal-noise grain gives paper tooth (baseFrequency is never animated).
 *   It can be switched off with PaperGrainContext — e.g. while a scene is drawn many
 *   times over (the closing's paper airplane), where full-screen noise filters per
 *   copy would make playback stall.
 *
 * Mirror byte-identical in both trees (remotion-video + frontend).
 */
import React, { createContext, useContext, useId, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { PAPER_SHADE, mix, withOpacity } from "../crumpledStyle";
import { PaperCreases, buildPaperSurface, paperDriftAt, paperLightAt, surfaceNormals } from "./paperSurface";

/** false → skip the (subtle, expensive) noise-filter grain on every backdrop below. */
export const PaperGrainContext = createContext(true);

export { applyPaperDrift, paperDriftAt, paperFacetShade, paperLightAt, type Vec3 } from "./paperSurface";

export const PaperBackdrop: React.FC<{
  paper: string;
  ink: string;
  seed?: number;
  /** Crease density (≈ facets across a 1920 canvas). */
  density?: number;
  /** 0..1 how deep the creases look. */
  depth?: number;
  /**
   * Which way the crease pattern faces, so each scene's sheet looks crumpled
   * differently: 0 as built, 1 mirrored left-right, 2 mirrored top-bottom, 3 both
   * (turned 180°). Only the creases flip — `children` are drawn as they are.
   */
  orientation?: 0 | 1 | 2 | 3;
  /** Optional extra layer drawn on the paper (ruled lines, grid…), moves with the sheet. */
  children?: React.ReactNode;
}> = ({ paper, ink, seed = 7, density = 9, depth = 1, orientation = 0, children }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const uid = useId().replace(/:/g, "");
  const grain = useContext(PaperGrainContext);
  const { surface, normals } = useMemo(() => {
    const s = buildPaperSurface(width, height, seed, density);
    return { surface: s, normals: surfaceNormals(s) };
  }, [width, height, seed, density]);

  const t = frame / fps;
  const light = paperLightAt(t);
  const drift = paperDriftAt(t);
  const shadowInk = mix(paper, PAPER_SHADE, 0.85);

  return (
    <AbsoluteFill style={{ background: paper, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${drift.x}px, ${drift.y}px) scale(${drift.s}) rotate(${drift.r}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} result="noise" />
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.05"
              />
            </filter>
            <filter id={`${uid}-fibre`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves="3" seed={seed + 3} />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.25" />
            </filter>
            <radialGradient id={`${uid}-vig`} cx="50%" cy="48%" r="75%">
              <stop offset="55%" stopColor={shadowInk} stopOpacity="0" />
              <stop offset="100%" stopColor={shadowInk} stopOpacity="0.16" />
            </radialGradient>
          </defs>
          <g transform={orientation ? `translate(${width / 2} ${height / 2}) scale(${orientation & 1 ? -1 : 1} ${orientation & 2 ? -1 : 1}) translate(${-width / 2} ${-height / 2})` : undefined}>
            <PaperCreases surface={surface} normals={normals} light={light} paper={paper} ink={PAPER_SHADE} depth={depth} />
          </g>
          {/* paper tooth + long fibres (static noise) */}
          {grain ? (
            <>
              <rect width={width} height={height} fill={withOpacity(PAPER_SHADE, 0.5)} filter={`url(#${uid}-grain)`} opacity={0.07} />
              <rect width={width} height={height} fill={withOpacity(PAPER_SHADE, 0.5)} filter={`url(#${uid}-fibre)`} opacity={0.05} />
            </>
          ) : null}
          <rect width={width} height={height} fill={`url(#${uid}-vig)`} />
        </svg>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
