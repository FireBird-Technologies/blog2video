/** Canvas drawing matching ZoomCropImg: cover, object-position, scale about focus. */
export function parseObjectPositionPercent(s?: string): { px: number; py: number } {
  const p = (s ?? "50% 50%").trim().split(/\s+/);
  const x = parseFloat(String(p[0] ?? "50%").replace("%", "")) || 50;
  const y = parseFloat(String(p[1] ?? "50%").replace("%", "")) || 50;
  return {
    px: Math.max(0, Math.min(100, x)),
    py: Math.max(0, Math.min(100, y)),
  };
}

/**
 * Draw `img` into the full `dest` bitmap (dest typically cols×rows for mosaic sampling).
 */
export function drawZoomCroppedImage(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  destW: number,
  destH: number,
  imageObjectPosition?: string,
  imageZoom?: number,
): void {
  const nw =
    (img as HTMLImageElement).naturalWidth ||
    (img as HTMLImageElement).width ||
    (img as HTMLCanvasElement).width;
  const nh =
    (img as HTMLImageElement).naturalHeight ||
    (img as HTMLImageElement).height ||
    (img as HTMLCanvasElement).height;
  if (!nw || !nh) {
    ctx.drawImage(img, 0, 0, destW, destH);
    return;
  }

  const { px, py } = parseObjectPositionPercent(imageObjectPosition);
  const z = Math.max(1, imageZoom ?? 1);
  const fx = (destW * px) / 100;
  const fy = (destH * py) / 100;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, destW, destH);
  ctx.clip();
  ctx.translate(fx, fy);
  ctx.scale(z, z);
  ctx.translate(-fx, -fy);

  const scale = Math.max(destW / nw, destH / nh);
  const w = nw * scale;
  const h = nh * scale;
  const dx = (destW - w) * (px / 100);
  const dy = (destH - h) * (py / 100);
  ctx.drawImage(img, 0, 0, nw, nh, dx, dy, w, h);
  ctx.restore();
}
