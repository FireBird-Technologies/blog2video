import React from "react";
import { Img } from "remotion";

/**
 * Simple image component — uses <Img> for all images (including GIFs).
 * GIFs render as static first frame. Matches frontend preview behavior.
 */
export const AnimatedImage: React.FC<{
  src: string;
  style?: React.CSSProperties;
}> = ({ src, style }) => {
  return <Img src={src} style={style} />;
};
