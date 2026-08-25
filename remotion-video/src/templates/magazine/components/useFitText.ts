import React from "react";
import { delayRender, continueRender } from "remotion";

/**
 * Measure-and-shrink font fitter for the newspaper template.
 *
 * Renders text at `targetPx`, then — if it overflows its (height-constrained)
 * box — steps the font size down until it fits or hits `minPx`. Real DOM
 * measurement, not a character-count guess, so it copes with any narration
 * length, headline length, aspect ratio or user-chosen size: whatever the
 * actual leftover height is, the copy is sized to sit inside it instead of
 * being clipped by the scene's `overflow:hidden`.
 *
 * Render-safe: the measurement pass is gated with delayRender/continueRender so
 * Remotion's headless capture waits for the size to settle, making the rendered
 * MP4 match the live Player. Because news_headline only animates opacity (never
 * layout), the measured height is identical on every frame, so the fitted size
 * is stable across the whole scene.
 *
 * Single-column measure-and-shrink fitter (ported from the newspaper template;
 * (magazine/magazineStyle.tsx). Deliberately duplicated rather than imported:
 * the backend copies only `src/templates/{template_id}/` into each per-project
 * render workspace, so a newspaper layout importing from `magazine/` would
 * compile in the Player but break the headless render with an unresolved
 * import.
 *
 * `ref` must point at the height-constrained element; `deps` should include
 * everything that changes the copy or the available height (the text, the
 * target size, the aspect ratio).
 *
 * Returns the fitted size, plus `atFloor` — true when the copy still overflows
 * at `minPx`, i.e. shrinking alone could not make it fit — and `overflowPx`,
 * how many px it still overflows by. Callers use those to cascade to a second
 * element (narration bottoms out → shrink the title by enough to free up
 * `overflowPx`). Pass `minPx === targetPx` to make the hook a no-op while still
 * calling it unconditionally (Rules of Hooks).
 */
export const useFitText = (
  ref: React.RefObject<HTMLElement>,
  targetPx: number,
  minPx: number,
  deps: React.DependencyList,
  /**
   * Explicit height budget in px, overriding the element's own clientHeight.
   *
   * Needed for elements that are NOT allowed to shrink (`flex-shrink:0`), whose
   * clientHeight always equals their content height — measuring such an element
   * against itself can never detect overflow. The headline is one: its real
   * constraint is "title + floored narration must both fit in the column", not
   * "the title overflows its own box".
   */
  availPx?: number,
): { px: number; atFloor: boolean; overflowPx: number } => {
  const [state, setState] = React.useState<{
    px: number;
    atFloor: boolean;
    overflowPx: number;
  }>({
    px: targetPx,
    atFloor: false,
    overflowPx: 0,
  });
  // One delayRender handle per fit cycle so headless render blocks until we've
  // converged on a non-overflowing size.
  const handleRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // A caller may point us at a deliberately hidden measurement mirror (used
    // when the visible copy animates in, so measuring it would give a moving
    // target). Such an element must STAY hidden — remember that up front and
    // never reveal it at the end of the fit.
    const staysHidden = el.style.visibility === "hidden";

    // Hide the copy until the fit is resolved so the preview never paints it at
    // the target size and then reflows to the measured size (the visible
    // "shift" on scene load). We reveal it at the final size in measure().
    el.style.visibility = "hidden";

    if (handleRef.current === null) {
      handleRef.current = delayRender("magazine-fit-text2");
    }
    let cancelled = false;
    const release = () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };

    const measure = () => {
      if (cancelled || !el.isConnected) {
        // Reveal before bailing. Without this the element keeps the
        // `visibility:hidden` set above and the copy never appears at all —
        // the fit is optional, showing the text is not.
        if (!staysHidden) el.style.visibility = "visible";
        release();
        return;
      }

      // The band the copy must fit within. The element is a flex child that is
      // allowed to shrink (`flex:0 1 auto; min-height:0`), so once the column
      // overflows this reports the real leftover height rather than the copy's
      // own height.
      const avail = availPx ?? el.clientHeight;
      const width = el.clientWidth;

      // Stash every inline prop we override so we can restore it after
      // measuring. `flex` matters: the element is a flex child whose height the
      // flex algorithm pins — `height:auto` alone is ignored and the probe would
      // read the (clipped) band height instead of the true copy height. We force
      // `flex:none` + `position:absolute` so it sizes purely to its content
      // during the probe, off the normal flow.
      const saved = {
        width: el.style.width,
        height: el.style.height,
        maxHeight: el.style.maxHeight,
        minHeight: el.style.minHeight,
        overflow: el.style.overflow,
        flex: el.style.flex,
        position: el.style.position,
        visibility: el.style.visibility,
        fontSize: el.style.fontSize,
      };

      const naturalHeight = (size: number): number => {
        el.style.position = "absolute";
        el.style.visibility = "hidden";
        el.style.flex = "none";
        el.style.width = `${width}px`;
        el.style.height = "auto";
        el.style.maxHeight = "none";
        el.style.minHeight = "0";
        el.style.overflow = "visible";
        el.style.fontSize = `${size}px`;
        const h = el.scrollHeight;
        // Restore the live layout before the next probe / final paint.
        el.style.width = saved.width;
        el.style.height = saved.height;
        el.style.maxHeight = saved.maxHeight;
        el.style.minHeight = saved.minHeight;
        el.style.overflow = saved.overflow;
        el.style.flex = saved.flex;
        el.style.position = saved.position;
        el.style.visibility = saved.visibility;
        return h;
      };

      // +2px tolerance for sub-pixel rounding.
      const capacity = avail + 2;
      let next = targetPx;
      let atFloor = false;
      let overflowPx = 0;
      if (naturalHeight(targetPx) > capacity) {
        let size = targetPx;
        while (size > minPx && naturalHeight(size) > capacity) size -= 1;
        next = Math.max(minPx, size);
        // Still overflowing at the floor: shrinking alone cannot fit this copy.
        // Report by how much, so a caller can free up that many px elsewhere.
        overflowPx = Math.max(0, naturalHeight(next) - capacity);
        atFloor = overflowPx > 0;
      }
      el.style.fontSize = `${next}px`;
      // Reveal at the fitted size — no reflow shift. A measurement mirror that
      // was hidden by its author stays hidden.
      el.style.visibility = staysHidden ? "hidden" : "visible";
      setState((prev) =>
        prev.px === next && prev.atFloor === atFloor && prev.overflowPx === overflowPx
          ? prev
          : { px: next, atFloor, overflowPx },
      );
      // Defer continueRender until after the browser has painted the new font
      // size. setState triggers a React re-render but continueRender would fire
      // synchronously before React commits — the headless capturer would then
      // grab the frame at the old size. rAF fires after the paint so the
      // captured frame always shows the fitted size.
      requestAnimationFrame(() => release());
    };

    // Try to measure synchronously — if the element has real dimensions (i.e.
    // the custom fonts are already loaded, as is always the case in the Player
    // after the first scene), reveal immediately at frame 0 so the content is
    // visible from the first paint and there is no mid-entrance pop-in. Only
    // fall back to the async fonts.ready path if the element has zero height
    // (unmeasurable = fonts not yet loaded), which happens on very first load or
    // in headless render before fonts are ready.
    const fontsObj = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (el.clientHeight > 0) {
      measure();
    } else if (fontsObj?.ready) {
      fontsObj.ready.then(() => {
        if (!cancelled) measure();
      });
    } else {
      measure();
    }

    return () => {
      cancelled = true;
      // Same guarantee on unmount/dep-change: never leave the copy hidden.
      if (!staysHidden && el.style.visibility === "hidden") {
        el.style.visibility = "visible";
      }
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
};

/**
 * Height (in unscaled layout px) available to `ref` inside `containerRef`:
 * the container's content box, less everything above the element.
 *
 * Uses offsetTop/offsetHeight rather than getBoundingClientRect because several
 * newspaper layouts animate a 3D camera on an ancestor — a projected rect
 * changes every frame and would make the fitted size drift mid-scene, while
 * layout geometry stays constant.
 *
 * Returns 0 until both refs are attached; pass the result straight to
 * `useFitText`'s `availPx` (0 is falsy, so the hook falls back to clientHeight
 * on the first pass and re-fits once the real budget arrives).
 */
export const useAvailableHeight = (
  ref: React.RefObject<HTMLElement>,
  containerRef: React.RefObject<HTMLElement>,
  deps: React.DependencyList,
): number => {
  const [px, setPx] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = ref.current;
    const box = containerRef.current;
    if (!el || !box) return;

    const cs = window.getComputedStyle(box);
    const padBottom = parseFloat(cs.paddingBottom) || 0;

    // offsetTop is relative to the nearest positioned ancestor, so walk up the
    // offsetParent chain until we reach the container.
    let top = 0;
    for (
      let n: HTMLElement | null = el;
      n && n !== box;
      n = n.offsetParent as HTMLElement | null
    ) {
      top += n.offsetTop;
    }

    const next = Math.max(1, Math.round(box.offsetHeight - padBottom - top));
    setPx((prev) => (Math.abs(prev - next) <= 1 ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return px;
};
