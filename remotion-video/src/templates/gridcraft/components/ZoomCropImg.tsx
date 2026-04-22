import React from "react";
import { Img } from "remotion";

/**
 * Scene image framing: pan (object-position) + zoom (scale) clipped inside a fixed box.
 * Matches default/newspaper hero behavior so the flex/image region does not grow when zooming.
 */
export function ZoomCropImg({
  src,
  imageObjectPosition,
  imageZoom,
}: {
  src: string;
  imageObjectPosition?: string;
  imageZoom?: number;
}) {
  const pos = imageObjectPosition ?? "50% 50%";
  const z = Math.max(1, imageZoom ?? 1);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: pos,
          transform: `scale(${z})`,
          transformOrigin: pos,
        }}
      />
    </div>
  );
}
