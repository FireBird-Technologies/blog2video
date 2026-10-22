import React from "react";
import {continueRender, delayRender} from "remotion";

export type FitTextResult = {
  px: number;
  atFloor: boolean;
  overflowHeightPx: number;
  overflowWidthPx: number;
};

/**
 * Fits real rendered text into an explicit rectangle. The probe temporarily
 * removes flex/grid constraints so scrollWidth/scrollHeight describe the
 * text's natural size rather than the clipped live box.
 */
export const useFitText = (
  ref: React.RefObject<HTMLElement>,
  targetPx: number,
  minPx: number,
  deps: React.DependencyList,
  availableHeightPx: number,
  availableWidthPx?: number,
): FitTextResult => {
  const [result, setResult] = React.useState<FitTextResult>({
    px: targetPx,
    atFloor: false,
    overflowHeightPx: 0,
    overflowWidthPx: 0,
  });
  const handleRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const staysHidden = el.style.visibility === "hidden";
    el.style.visibility = "hidden";
    if (handleRef.current === null) handleRef.current = delayRender("starlit-fit-text");
    let cancelled = false;

    const release = () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };

    const measure = () => {
      if (cancelled || !el.isConnected) {
        if (!staysHidden) el.style.visibility = "visible";
        release();
        return;
      }

      const width = Math.max(1, availableWidthPx ?? el.clientWidth);
      const height = Math.max(1, availableHeightPx);
      const saved = {
        width: el.style.width,
        height: el.style.height,
        maxWidth: el.style.maxWidth,
        maxHeight: el.style.maxHeight,
        minWidth: el.style.minWidth,
        minHeight: el.style.minHeight,
        overflow: el.style.overflow,
        flex: el.style.flex,
        position: el.style.position,
        visibility: el.style.visibility,
        fontSize: el.style.fontSize,
      };

      const naturalSize = (size: number) => {
        el.style.position = "absolute";
        el.style.visibility = "hidden";
        el.style.flex = "none";
        el.style.width = `${width}px`;
        el.style.height = "auto";
        el.style.maxWidth = "none";
        el.style.maxHeight = "none";
        el.style.minWidth = "0";
        el.style.minHeight = "0";
        el.style.overflow = "visible";
        el.style.fontSize = `${size}px`;
        const measured = {height: el.scrollHeight, width: el.scrollWidth};
        Object.assign(el.style, saved);
        return measured;
      };

      const fits = ({height: measuredHeight, width: measuredWidth}: {height: number; width: number}) =>
        measuredHeight <= height + 2 && measuredWidth <= width + 2;
      let next = Math.max(minPx, targetPx);
      let measured = naturalSize(next);
      while (next > minPx && !fits(measured)) {
        next -= 1;
        measured = naturalSize(next);
      }
      next = Math.max(minPx, next);
      if (next === minPx) measured = naturalSize(next);

      const overflowHeightPx = Math.max(0, measured.height - height - 2);
      const overflowWidthPx = Math.max(0, measured.width - width - 2);
      const atFloor = overflowHeightPx > 0 || overflowWidthPx > 0;
      el.style.fontSize = `${next}px`;
      el.style.visibility = staysHidden ? "hidden" : "visible";
      setResult((previous) =>
        previous.px === next &&
        previous.atFloor === atFloor &&
        previous.overflowHeightPx === overflowHeightPx &&
        previous.overflowWidthPx === overflowWidthPx
          ? previous
          : {px: next, atFloor, overflowHeightPx, overflowWidthPx},
      );
      requestAnimationFrame(release);
    };

    const fonts = (document as Document & {fonts?: FontFaceSet}).fonts;
    if (fonts?.status === "loaded") measure();
    else if (fonts?.ready) fonts.ready.then(() => { if (!cancelled) measure(); });
    else measure();

    return () => {
      cancelled = true;
      if (!staysHidden && el.style.visibility === "hidden") el.style.visibility = "visible";
      release();
    };
    // The caller supplies only stable dependencies; animated children should
    // not force a new measurement on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result;
};
