import React from "react";
import { Img } from "remotion";

/**
 * In the frontend Player preview, we always use <Img> for all images
 * (including GIFs — they show as a static first frame).
 *
 * Animated GIF playback only works in the server-side Remotion render
 * (remotion-video/), where @remotion/gif runs in headless Chrome
 * without the Player's error boundary interfering.
 */
export const AnimatedImage: React.FC<{
  src: string;
  style?: React.CSSProperties;
}> = ({ src, style }) => {
  return <Img src={src} style={style} />;
};
