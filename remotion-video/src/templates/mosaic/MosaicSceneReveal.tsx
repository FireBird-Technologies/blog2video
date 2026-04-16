import React, { useEffect, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Mosaic Tile Reveal — Scene Transition
 *
 * Breaks the ENTIRE scene into a grid of 4px tiles.
 * Enter: Stone-colored tiles cover everything, then dissolve
 *        left-to-right revealing the scene content beneath.
 * Exit:  Stone tiles reassemble left-to-right, covering
 *        content before scene switch.
 *
 * Tile delay = col * 1.8 + row * 0.3 (left-to-right sweep
 * with slight diagonal, matching the HTML reference exactly).
 *
 * Uses delayRender/continueRender so Remotion waits for the
 * canvas to be fully painted before capturing the frame.
 */

const STONE = "#EAE4DA";
const STONE_RGB = { r: 234, g: 228, b: 218 };
const TILE_FADE_FRAMES = 10;

export const MosaicSceneReveal: React.FC<{
  durationFrames: number;
  tileSize?: number;
  gap?: number;
  bgColor?: string;
  phase?: "enter" | "exit";
}> = ({ durationFrames, tileSize = 4, gap = 0, bgColor, phase = "enter" }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const base = bgColor || STONE;
  const step = Math.max(1, tileSize + gap);
  const cols = Math.ceil(width / step);
  const rows = Math.ceil(height / step);

  const maxDelay = (cols - 1) * 1.8 + (rows - 1) * 0.3;
  const totalAnimFrames = maxDelay + TILE_FADE_FRAMES;

  // Sweep takes ~40% of scene or max 45 frames (~1.5s at 30fps)
  const sweepFrames = Math.max(1, Math.min(Math.round(durationFrames * 0.4), 45));

  let animFrame: number;
  if (phase === "enter") {
    animFrame = (frame / sweepFrames) * totalAnimFrames;
  } else {
    const exitStart = Math.max(0, durationFrames - sweepFrames);
    const exitProgress = Math.max(
      0,
      Math.min(1, (frame - exitStart) / sweepFrames)
    );
    animFrame = exitProgress * totalAnimFrames;
  }

  const enterDone = phase === "enter" && animFrame >= totalAnimFrames;
  const exitNotStarted = phase === "exit" && animFrame <= 0;

  useEffect(() => {
    const handle = delayRender("Painting mosaic tile reveal overlay");
    const canvas = canvasRef.current;
    if (!canvas) {
      continueRender(handle);
      return;
    }

    if (enterDone || exitNotStarted) {
      // Nothing to paint — clear and let Remotion continue
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, width, height);
      continueRender(handle);
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      continueRender(handle);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    // Create an ImageData buffer for pixel-perfect tile painting
    const imageData = ctx.createImageData(width, height);
    const pixels = imageData.data;

    const { r, g, b } = STONE_RGB;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const delay = col * 1.8 + row * 0.3;
        const localTime = animFrame - delay;

        let alpha: number;
        if (phase === "enter") {
          if (localTime < 0) alpha = 1;
          else if (localTime >= TILE_FADE_FRAMES) alpha = 0;
          else alpha = 1 - localTime / TILE_FADE_FRAMES;
        } else {
          if (localTime < 0) alpha = 0;
          else if (localTime >= TILE_FADE_FRAMES) alpha = 1;
          else alpha = localTime / TILE_FADE_FRAMES;
        }

        if (alpha <= 0.002) continue;

        const a = Math.round(alpha * 255);
        const x0 = col * step;
        const y0 = row * step;
        const tw = Math.min(tileSize, width - x0);
        const th = Math.min(tileSize, height - y0);

        // Fill tile pixels
        for (let py = y0; py < y0 + th; py++) {
          for (let px = x0; px < x0 + tw; px++) {
            const idx = (py * width + px) * 4;
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = a;
          }
        }

        // Draw subtle tile edge highlight (1px lighter top & left edges)
        // This makes individual tiles VISIBLE during the transition
        if (alpha > 0.05 && alpha < 0.98) {
          const edgeA = Math.min(255, Math.round(alpha * 280));
          // Top edge
          for (let px = x0; px < x0 + tw; px++) {
            const idx = (y0 * width + px) * 4;
            pixels[idx] = Math.min(255, r + 12);
            pixels[idx + 1] = Math.min(255, g + 10);
            pixels[idx + 2] = Math.min(255, b + 8);
            pixels[idx + 3] = edgeA;
          }
          // Left edge
          for (let py = y0; py < y0 + th; py++) {
            const idx = (py * width + x0) * 4;
            pixels[idx] = Math.min(255, r + 12);
            pixels[idx + 1] = Math.min(255, g + 10);
            pixels[idx + 2] = Math.min(255, b + 8);
            pixels[idx + 3] = edgeA;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Signal Remotion that this frame is ready to capture
    continueRender(handle);
  }, [
    frame,
    width,
    height,
    tileSize,
    gap,
    base,
    phase,
    animFrame,
    cols,
    rows,
    enterDone,
    exitNotStarted,
    step,
  ]);

  if (enterDone || exitNotStarted) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
