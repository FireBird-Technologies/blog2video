import { useState, useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps a Remotion <Player> (or any fixed-size child) in a CSS-scaled,
 * fixed-pixel box so it renders correctly inside the coverflow carousel.
 *
 * Why this exists
 * ───────────────
 * A bare `<Player style={{ width: "100%" }}>` relies on Remotion's internal
 * `useElementSize`, which measures the container with `getClientRects()` and
 * then divides out any ancestor CSS `scale()` to size the composition. The
 * carousel's side cards carry `rotateY(...) scale(...)` (plus the stage's
 * responsive `fitScale`). A rotateY foreshortens `getClientRects()` width, so
 * Remotion's scale-detection math is thrown off and the composition is
 * mis-sized into a tiny box in the card's corner — exactly the artifact seen on
 * mobile side cards.
 *
 * Rendering the Player at a fixed pixel size (INTERNAL_W×INTERNAL_H) inside a
 * plain CSS `scale()` box makes Remotion measure a stable, untransformed box,
 * so the composition always fills the card. Measuring with `offsetWidth`
 * (layout width, not the transformed `getBoundingClientRect` width) keeps the
 * scale correct regardless of ancestor transforms.
 */
export default function PlayerScaledCanvas({
  children,
  internalWidth = 480,
  internalHeight = 270,
}: {
  children: ReactNode;
  internalWidth?: number;
  internalHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      // Scale to *cover* the box: take the larger of the width- and height-fit
      // scales. Sub-pixel rounding of the aspect-ratio box can leave the height
      // a hair under width×ratio; covering guarantees the composition fills
      // edge-to-edge (overflow is clipped) with no top/bottom strip when the
      // card is previewed at center.
      const sw = el.offsetWidth / internalWidth;
      const sh = el.offsetHeight / internalHeight;
      const s = Math.max(sw, sh);
      if (s > 0) setScale(s);
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [internalWidth, internalHeight]);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        aspectRatio: `${internalWidth}/${internalHeight}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: internalWidth,
          height: internalHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
