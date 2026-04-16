import React, { useEffect, useState } from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, continueRender, delayRender } from "remotion";
import { getTileEntryProgress, type MosaicTileEntryPattern } from "./transitions";

interface MosaicImageTilesProps {
  imageUrl: string;
  tileEntryRange: [number, number];
  tileEntryPattern?: MosaicTileEntryPattern;
  tileEntryIntensity?: number;
  overlayColor?: string;
  overlayOpacity?: number;
}

interface TileColor {
  fill: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  order: number;
}

/**
 * Renders an image as a grid of mosaic tiles that reveal with the same
 * sweep animation as the background. Each tile samples the average color
 * from that region of the image, creating a true mosaic/pixelated effect.
 */
export const MosaicImageTiles: React.FC<MosaicImageTilesProps> = ({
  imageUrl,
  tileEntryRange,
  tileEntryPattern = "linear",
  tileEntryIntensity = 24,
  overlayColor = "rgba(234,228,218,0.45)",
  overlayOpacity = 1,
}) => {
  const frame = useCurrentFrame();
  const [tileColors, setTileColors] = useState<TileColor[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [handle] = useState(() => delayRender());

  const tileProgress = interpolate(
    frame,
    tileEntryRange,
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const cols = 96;
  const rows = 54;
  const tileW = 100 / cols;
  const tileH = 100 / rows;

  // Sample colors from the image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    // Append ?cors=1 so this request is a separate cache entry from any prior
    // non-CORS load of the same URL. Without this, the browser may serve a
    // disk-cached response that has no Access-Control-Allow-Origin header,
    // causing getImageData() to fail even when R2 CORS is configured.
    const sep = imageUrl.includes("?") ? "&" : "?";
    img.src = `${imageUrl}${sep}cors=1`;

    img.onload = () => {
      setImageLoaded(true);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        continueRender(handle);
        return;
      }

      try {
        canvas.width = cols;
        canvas.height = rows;
        ctx.drawImage(img, 0, 0, cols, rows);

        const tiles: TileColor[] = [];
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const pixel = ctx.getImageData(col, row, 1, 1).data;
            const r = pixel[0];
            const g = pixel[1];
            const b = pixel[2];

            // Add slight color variation for mosaic authenticity
            const variance = 8;
            const vr = Math.floor(r + (Math.random() - 0.5) * variance);
            const vg = Math.floor(g + (Math.random() - 0.5) * variance);
            const vb = Math.floor(b + (Math.random() - 0.5) * variance);

            const order = row * cols + col;
            const x = col * tileW;
            const y = row * tileH;
            const cx = (col + 0.5) * tileW;
            const cy = (row + 0.5) * tileH;

            tiles.push({
              fill: `rgb(${Math.max(0, Math.min(255, vr))},${Math.max(0, Math.min(255, vg))},${Math.max(0, Math.min(255, vb))})`,
              x,
              y,
              w: tileW,
              h: tileH,
              cx,
              cy,
              order,
            });
          }
        }

        setTileColors(tiles);
      } catch {
        // Canvas is tainted (CORS) — component renders overlays without mosaic tile colors
      }

      continueRender(handle);
    };

    img.onerror = () => {
      // Image blocked (e.g. R2 missing CORS headers for this origin).
      // Mark as loaded so overlays still render.
      setImageLoaded(true);
      continueRender(handle);
    };
  }, [imageUrl, cols, rows, tileW, tileH, handle]);

  if (!imageLoaded) {
    return null;
  }

  return (
    <AbsoluteFill>
      {/* SVG tile grid rendering mosaic-sampled colors */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
      >
        {/* Render each tile as a solid color rect */}
        {tileColors.map((t, i) => {
          const tileReveal = getTileEntryProgress({
            progress: tileProgress,
            index: t.order,
            total: tileColors.length,
            x: t.cx,
            y: t.cy,
            pattern: tileEntryPattern,
            intensity: tileEntryIntensity,
          });
          
          return (
            <rect
              key={`tile-${i}`}
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              fill={t.fill}
              stroke="rgba(42,42,40,0.28)"
              strokeWidth="0.08"
              opacity={tileReveal}
            />
          );
        })}
      </svg>

      {/* Overlay tint */}
      {overlayColor && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: overlayColor,
            opacity: overlayOpacity,
            pointerEvents: "none",
            mixBlendMode: "multiply",
          }}
        />
      )}

      {/* 4-sided tile grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: [
            "linear-gradient(to right,  rgba(74,120,140,0.14) 0.5px, transparent 0.5px)",
            "linear-gradient(to bottom, rgba(194,98,64,0.16) 0.5px, transparent 0.5px)",
          ].join(", "),
          backgroundSize: "4px 4px",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
    </AbsoluteFill>
  );
};
