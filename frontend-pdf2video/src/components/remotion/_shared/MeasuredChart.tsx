import React, { useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";

/**
 * Flicker-safe replacement for recharts `<ResponsiveContainer>`.
 *
 * `ResponsiveContainer` sizes itself from an async `ResizeObserver`: it first
 * renders empty, then measures its parent and re-renders the chart. During a
 * headless Remotion render at `--concurrency 100%` (many parallel Chrome tabs,
 * frames captured fast) some screenshots land inside that empty→measured window,
 * so the chart is missing on scattered frames → the scene flickers/jitters. The
 * Studio preview never shows it because frames there are painted one at a time.
 *
 * Instead we measure the parent once in `useLayoutEffect` (synchronous, before
 * paint) and hold a `delayRender()` handle until the size is known, so Remotion
 * never captures a frame before the chart has a stable explicit pixel size.
 *
 * Drop-in usage: replace
 *   <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
 * with
 *   <MeasuredChart>{chart}</MeasuredChart>
 */
export const MeasuredChart: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [handle] = useState(() =>
    delayRender("Measuring chart", { timeoutInMilliseconds: 15_000 }),
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) {
      // Use clientWidth/clientHeight (layout box), NOT getBoundingClientRect():
      // the Remotion Player scales the whole composition with `transform: scale()`
      // to fit the viewport, and getBoundingClientRect returns the post-transform
      // (shrunken) size — which would make the chart fill only a fraction of the
      // panel. clientWidth/clientHeight are unaffected by CSS transforms, so the
      // chart gets its true coordinate-space size in both preview and render.
      let w = el.clientWidth;
      let h = el.clientHeight;

      // A ZERO MEASUREMENT MUST NOT BLANK THE CHART SILENTLY.
      //
      // Returning null on a zero size is invisible: the scene renders its title,
      // panel and caption, and only the plot is missing — which reads as "the
      // data never arrived" and sends you looking in entirely the wrong place.
      // It happens whenever an ancestor collapses this element, e.g. a chart
      // wrapped in a flex container (see CustomChart's root note).
      //
      // Walk up to the nearest ancestor that HAS a size and use that instead.
      // The chart is absolutely positioned within its parent, so borrowing the
      // parent's box is the right size in the case this recovers.
      if (w <= 0 || h <= 0) {
        let parent = el.parentElement;
        while (parent && (w <= 0 || h <= 0)) {
          if (w <= 0) w = parent.clientWidth || parent.offsetWidth || 0;
          if (h <= 0) h = parent.clientHeight || parent.offsetHeight || 0;
          parent = parent.parentElement;
        }
      }

      setSize({ w, h });
    }
    continueRender(handle);
  }, [handle]);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {size && size.w > 0 && size.h > 0
        ? React.cloneElement(children, { width: size.w, height: size.h })
        : null}
    </div>
  );
};
