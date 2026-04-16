import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, interpolate } from "remotion";
import { getTileEntryProgress, type MosaicTileEntryPattern } from "./transitions";

interface MosaicImageRevealProps {
  imageUrl: string;
  revealProgress: number;
  clarityProgress?: number; // 0 = mosaic tiles, 1 = clear image with tile outlines
  pattern?: MosaicTileEntryPattern;
  intensity?: number;
  overlay?: React.ReactNode;
  style?: React.CSSProperties;
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
 * Renders an image as actual mosaic tiles - each tile is a solid color
 * sampled from that region of the image, creating a true mosaic effect.
 */
export const MosaicImageReveal: React.FC<MosaicImageRevealProps> = ({
  imageUrl,
  revealProgress,
  clarityProgress = 1,
  pattern = "linear",
  intensity = 24,
  overlay,
  style,
}) => {
  const [tileColors, setTileColors] = useState<TileColor[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [handle] = useState(() => delayRender());

  const cols = 36; // Reduced for stronger mosaic effect (was 48)
  const rows = 20; // Reduced for stronger mosaic effect (was 27)
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

            // Add subtle color variation for authentic mosaic look
            const variance = 6;
            const vr = Math.min(255, Math.max(0, r + (Math.random() - 0.5) * variance));
            const vg = Math.min(255, Math.max(0, g + (Math.random() - 0.5) * variance));
            const vb = Math.min(255, Math.max(0, b + (Math.random() - 0.5) * variance));

            const order = row * cols + col;
            const x = col * tileW;
            const y = row * tileH;
            const cx = (col + 0.5) * tileW;
            const cy = (row + 0.5) * tileH;

            tiles.push({
              fill: `rgb(${Math.round(vr)},${Math.round(vg)},${Math.round(vb)})`,
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
      } catch (e) {
        console.error("[MosaicImageReveal] Canvas read failed (likely CORS tainted canvas):", e);
      }

      continueRender(handle);
    };

    img.onerror = () => {
      // Image blocked (e.g. R2 missing CORS headers for this origin).
      // Mark as loaded so the display <img> below still renders without crossOrigin.
      setImageLoaded(true);
      continueRender(handle);
    };
  }, [imageUrl, cols, rows, tileW, tileH, handle]);

  if (!imageLoaded) {
    return null;
  }

  return (
    <AbsoluteFill style={style}>
      {/* Base clear image - fades in as clarity increases */}
      <img
        src={imageUrl}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: clarityProgress,
        }}
        alt=""
      />

      {/* SVG mosaic tiles - fade out as clarity increases */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, opacity: 1 - clarityProgress * 0.95 }}
      >
        {tileColors.map((t, i) => {
          const tileReveal = getTileEntryProgress({
            progress: revealProgress,
            index: t.order,
            total: tileColors.length,
            x: t.cx,
            y: t.cy,
            pattern,
            intensity,
          });

          return (
            <rect
              key={`tile-${i}`}
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              fill={t.fill}
              stroke="rgba(42,42,40,0.35)"
              strokeWidth="0.18"
              opacity={tileReveal}
            />
          );
        })}
      </svg>

      {/* Tile grid overlay - always visible for tile outline effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: [
            "linear-gradient(to right,  rgba(42,42,40,0.15) 0.5px, transparent 0.5px)",
            "linear-gradient(to bottom, rgba(42,42,40,0.15) 0.5px, transparent 0.5px)",
          ].join(", "),
          backgroundSize: `${tileW}% ${tileH}%`,
          pointerEvents: "none",
          opacity: 0.3 + clarityProgress * 0.4,
        }}
      />

      {/* Additional overlays (color tints, etc.) */}
      {overlay}
    </AbsoluteFill>
  );
};
