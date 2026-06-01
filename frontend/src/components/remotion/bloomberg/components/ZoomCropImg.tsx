import React from "react";
import { Img } from "remotion";

/**
 * Scene image framing: pan (object-position) + zoom (scale) clipped inside a fixed box.
 *
 * zoom >= 1  →  object-fit: cover  + scale(z) from the focus point (zoom-in, crops edges)
 * zoom <  1  →  object-fit: contain + scale(z) from center (zoom-out, reveals full image)
 */
export function ZoomCropImg({
  src,
  imageObjectPosition,
  imageZoom,
  alt = "",
}: {
  src: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  alt?: string;
}) {
  const pos = imageObjectPosition ?? "50% 50%";
  const z = Math.max(0.1, imageZoom ?? 1);
  const isZoomedOut = z < 1;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <Img
        src={src}
        alt={alt}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          objectFit: isZoomedOut ? "contain" : "cover",
          objectPosition: isZoomedOut ? "center" : pos,
          transform: `scale(${z})`,
          transformOrigin: isZoomedOut ? "center center" : pos,
        }}
      />
    </div>
  );
}

