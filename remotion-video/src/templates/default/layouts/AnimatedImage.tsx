import React, { Component, Suspense } from "react";
import { Img, useVideoConfig } from "remotion";
import { Gif } from "@remotion/gif";

/**
 * Drop-in replacement for Remotion's <Img> that renders animated GIFs
 * using @remotion/gif's <Gif> component (plays all frames synced to
 * Remotion's timeline) and falls back to <Img> for other formats.
 *
 * The <Gif> component requires explicit width/height for its canvas.
 * We use the video composition dimensions from useVideoConfig().
 */

const isGifUrl = (url: string) => /\.gif(\?.*)?$/i.test(url);

// ── Error Boundary ───────────────────────────────────────────
interface EBProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}
interface EBState {
  hasError: boolean;
}

class GifErrorBoundary extends Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[AnimatedImage] <Gif> failed, falling back to <Img>:", error.message);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ── Inner Gif renderer ───────────────────────────────────────
const GifRenderer: React.FC<{ src: string; style?: React.CSSProperties }> = ({
  src,
  style,
}) => {
  const { width, height } = useVideoConfig();
  const { objectFit, ...rest } = style ?? {};

  return (
    <div style={{ ...rest, overflow: "hidden", position: "relative" }}>
      <Gif
        src={src}
        width={width}
        height={height}
        fit={(objectFit as "cover" | "contain" | "fill") ?? "cover"}
        loopBehavior="loop"
      />
    </div>
  );
};

// ── Public component ─────────────────────────────────────────
export const AnimatedImage: React.FC<{
  src: string;
  style?: React.CSSProperties;
}> = ({ src, style }) => {
  if (isGifUrl(src)) {
    const fallback = <Img src={src} style={style} />;
    return (
      <GifErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <GifRenderer src={src} style={style} />
        </Suspense>
      </GifErrorBoundary>
    );
  }

  return <Img src={src} style={style} />;
};
