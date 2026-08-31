/**
 * Custom-template craft kit — FitText.
 *
 * A render-safe auto-fit text block. AI-generated scenes use this for headlines,
 * big numerals and any text that must not overshoot its box, so a long title in
 * landscape OR a narrow portrait canvas can never spill or clip.
 *
 * MEASURES THE REAL DOM. Earlier versions estimated the size from the character
 * count alone (size = boxWidth * maxLines / (len * 0.58)). That estimate was
 * systematically pessimistic — the 0.58 advance ratio sits ~15% above the real
 * average for most faces, and any caller passing `maxHeight` without
 * `containerWidth` overestimated the width solve and then over-corrected through
 * the height loop. The visible result was type far smaller than the box it sat
 * in: exactly the whitespace the built-in templates never show, because they
 * measure `scrollHeight` instead of guessing.
 *
 * So this now does what newspaper/nightfall's `useFitText` does — grow to the
 * ceiling, then step down until the text actually fits — with the same three
 * render-safety guarantees, which are NOT optional:
 *
 *   1. delayRender()/continueRender() so the headless capturer waits for the
 *      size to settle and the MP4 matches the Player.
 *   2. The continueRender is deferred through requestAnimationFrame. setState
 *      schedules a React re-render, but a synchronous release would fire before
 *      React commits, and the capturer would grab the frame at the OLD size.
 *   3. A document.fonts.ready fallback for the headless path, where the first
 *      layout pass happens before webfonts resolve and every probe reads 0.
 *
 * The character-count estimator is kept as the seed and as the fallback for when
 * measurement is impossible (detached node, zero-height box). A failed measure
 * must still render readable text, never unsized text.
 *
 * STABILITY: the fit runs once per (text, box, desired) tuple, not per frame.
 * Generated scenes animate freely — including layout — so re-measuring every
 * frame would let the size drift mid-scene. Newspaper records a real failure of
 * exactly that kind (a bidirectional loop settling differently on different
 * frames), which is why the measurement here is one-directional and keyed.
 */

import React from "react";
import { useVideoConfig, delayRender, continueRender } from "remotion";
import { useKit } from "./context";

export interface FitTextProps {
  /** Text to render. */
  children: React.ReactNode;
  /**
   * Target size in px. Text is fitted AROUND this, in both directions: long copy
   * shrinks, and short copy is allowed to grow up to `maxFontSize` so a
   * six-word headline does not sit tiny in a box built for thirty.
   */
  fontSize?: number;
  /** Floor — never shrink below this (keeps headlines legible). */
  minFontSize?: number;
  /**
   * Ceiling for the grow direction. Defaults to 1.6x the target, clamped so a
   * one-word headline cannot balloon past what the frame can hold.
   */
  maxFontSize?: number;
  /**
   * Fraction of the canvas width this text box may occupy (0–1). Used to estimate
   * how many characters fit per line before we must shrink. Default 0.86.
   *
   * Only consulted when `containerWidth` is not given. Prefer `containerWidth`:
   * this fraction is measured against the FULL CANVAS, so a headline sitting in
   * a 40%-wide column is sized as if it owned 86% of a 1920px frame — a ~2x
   * overestimate, and the direct cause of headlines breaking mid-word inside
   * narrow columns.
   */
  widthFraction?: number;
  /**
   * Actual width in px of the box this text renders into. Pass this whenever the
   * text is inside a column, card or split rather than spanning the frame —
   * e.g. a 40% column of a 1920px canvas is `containerWidth={1920 * 0.4}`.
   */
  containerWidth?: number;
  /**
   * Height budget in px for the text block. When set, the estimate also shrinks
   * to keep `lines * lineHeight * size` within it — without this, an
   * underestimated line count silently overflows DOWNWARD, which no amount of
   * width fitting can catch.
   */
  maxHeight?: number;
  /** Max lines the text is allowed to wrap to before shrinking further. Default 3. */
  maxLines?: number;
  /** Line height multiplier, used for the height budget. Default 1.15. */
  lineHeight?: number;
  as?: "div" | "span" | "h1" | "h2" | "h3" | "p";
  style?: React.CSSProperties;
}

/** Average glyph advance as a fraction of font size (empirical for typical UI/serif faces).
 *
 * Used only to SEED the measured fit, and as the fallback when the DOM cannot be
 * measured. It was 0.58 while it was the whole algorithm — deliberately
 * pessimistic, because an underestimate overflowed the frame while an
 * overestimate was assumed invisible. It was not invisible: it is the direct
 * cause of the "type is far too small in the render" report.
 *
 * Now that a real `scrollHeight` pass catches genuine overflow, the seed is set
 * near the true average advance (~0.5 for common sans and serif text faces)
 * rather than above it. Overshoot is corrected by measurement; undershoot used
 * to be permanent. */
const AVG_CHAR_WIDTH_RATIO = 0.5;

/** Character count of the longest single word — a word cannot be split across
 * lines without breaking mid-word, so it sets its own width ceiling. */
function longestWordLength(text: string): number {
  let longest = 0;
  for (const word of (text || "").trim().split(/\s+/)) {
    if (word.length > longest) longest = word.length;
  }
  return longest;
}

/**
 * Deterministically solve for the font size at which `text` FILLS `maxLines`
 * lines of a `boxWidth` box, clamped to [floor, ceiling].
 *
 * Fits in both directions: short text grows toward the ceiling, long text
 * shrinks toward the floor. A shrink-only version left short headlines tiny.
 */
function estimateFitSize(
  text: string,
  boxWidth: number,
  desired: number,
  floor: number,
  ceiling: number,
  maxLines: number,
  maxHeight?: number,
  lineHeight = 1.15,
): number {
  const longestWord = longestWordLength(text);
  const len = (text || "").trim().length;
  if (len === 0) return desired;

  // Solve for the size that FILLS the box, then clamp — rather than starting at
  // `desired` and only ever shrinking.
  //
  // Shrink-only sizing is why short headlines looked tiny: "Growth" rendered at
  // the same 70px as a 90-character sentence and filled about 5% of the space
  // reserved for it. Both the too-small and the too-large complaints come from
  // the same omission — the size was never a function of how much text there is.
  //
  // Target: fill `maxLines` lines of the box. size = boxWidth * maxLines /
  // (len * ratio) is the size at which the text exactly consumes that area.
  const fillSize = (boxWidth * maxLines) / Math.max(1, len * AVG_CHAR_WIDTH_RATIO);

  // Short text may grow toward the ceiling; long text shrinks below the target.
  let size = Math.min(ceiling, fillSize);

  // A single unbreakable word must still fit on one line, or it breaks mid-word.
  if (longestWord > 0) {
    size = Math.min(size, boxWidth / (longestWord * AVG_CHAR_WIDTH_RATIO));
  }

  // ── Height fit ──
  // The width solve assumes the text uses exactly maxLines. A long word or an
  // unlucky break can produce more, so cap against the real height budget too.
  if (maxHeight && maxHeight > 0) {
    const linesAt = (s: number) =>
      Math.max(1, Math.ceil(len / Math.max(1, boxWidth / (s * AVG_CHAR_WIDTH_RATIO))));
    while (size > floor && linesAt(size) * size * lineHeight > maxHeight) {
      size -= 1;
    }
  }

  return Math.max(floor, Math.min(ceiling, size));
}

/** Extract a plain-text length estimate from children (string or simple nodes). */
function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return "";
}

export const FitText: React.FC<FitTextProps> = ({
  children,
  fontSize,
  minFontSize,
  maxFontSize,
  widthFraction = 0.86,
  containerWidth,
  maxHeight,
  maxLines = 3,
  lineHeight = 1.15,
  as = "div",
  style,
}) => {
  const { width, height } = useVideoConfig();
  const { type } = useKit();
  const Tag = as as React.ElementType;

  const desired = fontSize ?? type.title;
  // Floor at 40% of desired rather than 50%. A caller passing minFontSize={48}
  // for a title that genuinely needs 30px cannot shrink far enough, so it
  // overflows at 48 instead — a floor that blocks fitting defeats the component.
  const floor = minFontSize ?? Math.max(16, Math.round(desired * 0.4));
  // Grow ceiling. Short text may exceed the target — otherwise a two-word
  // headline sits at the size chosen for a full sentence — but never past what
  // the frame can hold, so it is capped against the canvas height too.
  const ceiling = Math.max(
    floor,
    maxFontSize ?? Math.min(Math.round(desired * 1.6), Math.round(height * 0.18)),
  );
  // Prefer the real container width; fall back to the canvas estimate.
  const boxWidth = containerWidth && containerWidth > 0 ? containerWidth : width * widthFraction;

  const text = textOf(children);
  // The estimate is the seed: it is what paints on the very first frame and what
  // stands if measurement turns out to be impossible.
  const seed = estimateFitSize(
    text,
    boxWidth,
    desired,
    floor,
    ceiling,
    maxLines,
    maxHeight,
    lineHeight,
  );

  const ref = React.useRef<HTMLElement | null>(null);
  const handleRef = React.useRef<number | null>(null);

  // Re-fit only when something that changes the answer changes. Notably NOT the
  // frame: generated scenes animate transforms and opacity continuously, and a
  // per-frame re-measure would let the size drift mid-scene.
  const fitKey = `${text}|${boxWidth}|${desired}|${floor}|${ceiling}|${maxLines}|${maxHeight ?? 0}|${lineHeight}`;

  // The measured size, tagged with the key it was measured for. Storing the key
  // alongside the value is what makes a stale measurement impossible to paint:
  // when the key changes, the seed for the NEW inputs is used immediately rather
  // than the size that was fitted for the old ones.
  const [fit, setFit] = React.useState<{ key: string; px: number }>({
    key: fitKey,
    px: seed,
  });
  const size = fit.key === fitKey ? fit.px : seed;

  React.useLayoutEffect(() => {
    const el = ref.current;
    // No node to measure (SSR pass, detached) — the seed estimate stands.
    if (!el || typeof window === "undefined") return;

    if (handleRef.current === null) {
      handleRef.current = delayRender("kit-fit-text");
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
        release();
        return;
      }

      // Probe the element's true content height at a given size, off the normal
      // flow so a flex parent cannot pin it and report a clipped height.
      const saved = {
        position: el.style.position,
        visibility: el.style.visibility,
        flex: el.style.flex,
        width: el.style.width,
        height: el.style.height,
        maxHeight: el.style.maxHeight,
        minHeight: el.style.minHeight,
        overflow: el.style.overflow,
        fontSize: el.style.fontSize,
      };
      const probeWidth = el.clientWidth || boxWidth;

      const naturalHeight = (px: number): number => {
        el.style.position = "absolute";
        el.style.visibility = "hidden";
        el.style.flex = "none";
        el.style.width = `${probeWidth}px`;
        el.style.height = "auto";
        el.style.maxHeight = "none";
        el.style.minHeight = "0";
        el.style.overflow = "visible";
        el.style.fontSize = `${px}px`;
        const h = el.scrollHeight;
        el.style.position = saved.position;
        el.style.visibility = saved.visibility;
        el.style.flex = saved.flex;
        el.style.width = saved.width;
        el.style.height = saved.height;
        el.style.maxHeight = saved.maxHeight;
        el.style.minHeight = saved.minHeight;
        el.style.overflow = saved.overflow;
        el.style.fontSize = saved.fontSize;
        return h;
      };

      // Fonts have not resolved yet — every probe reads 0 and any size would
      // "fit". Bail to the fonts.ready path rather than locking in a wrong fit.
      if (naturalHeight(ceiling) === 0) {
        release();
        return;
      }

      // The height budget. An explicit maxHeight wins; otherwise use the box the
      // element actually occupies, and fall back to maxLines worth of the seed
      // when even that is unknown (an auto-height parent).
      const budget =
        maxHeight && maxHeight > 0
          ? maxHeight
          : el.clientHeight > 0
            ? el.clientHeight
            : Math.round(seed * lineHeight * maxLines);
      // +2px for sub-pixel rounding.
      const capacity = budget + 2;

      // Largest size in [floor, ceiling] that still fits, by binary search.
      //
      // Searching from the CEILING down (rather than from the target, the way
      // the built-in single-purpose fitters do) is what lets short copy grow to
      // fill its box instead of sitting at a size chosen for a full sentence.
      // But that span can be 100+ px, and each probe forces a synchronous
      // reflow — a linear walk would cost 100+ reflows per text block, on every
      // text block in the scene. Bisection makes it ~7 and is exact here because
      // "fits" is monotonic in size.
      let next: number;
      if (naturalHeight(ceiling) <= capacity) {
        next = ceiling;
      } else {
        let lo = floor;
        let hi = ceiling;
        // Invariant: lo fits (or is the floor, which we take regardless), hi does not.
        while (hi - lo > 1) {
          const mid = Math.floor((lo + hi) / 2);
          if (naturalHeight(mid) <= capacity) lo = mid;
          else hi = mid;
        }
        next = lo;
      }
      next = Math.max(floor, Math.min(ceiling, next));

      if (!cancelled) {
        const px = next;
        setFit((prev) => (prev.key === fitKey && prev.px === px ? prev : { key: fitKey, px }));
      }
      // Deferred so the release lands AFTER React commits and the browser
      // paints the new size — see the header note.
      requestAnimationFrame(() => release());
    };

    const fontsObj = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (el.clientHeight > 0) {
      // Fonts already loaded (the usual Player case) — measure synchronously so
      // frame 0 paints at the fitted size with no visible reflow.
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
      // The handle must always be released, or the render hangs on this scene.
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      style={{
        fontSize: size,
        lineHeight,
        // `break-word` (not `break-all`) breaks INSIDE a word only when that word
        // cannot fit a line on its own. Combined with the sizing above, a normal
        // headline now shrinks to fit rather than splitting as "Britan/nica".
        overflowWrap: "break-word",
        ...style,
        // Structural overflow guards — the same patterns the built-in templates
        // use so text wraps/shrinks instead of escaping the frame.
        //
        // These sit AFTER `...style` so a caller cannot switch them off.
        // `...style` is an escape hatch for typography (family, weight, color,
        // tracking), but generated scenes routinely pass `whiteSpace: 'nowrap'`
        // alongside `maxLines={2}` — a direct contradiction, since nowrap forces
        // one line and long copy then runs straight off the canvas. That is the
        // exact failure FitText exists to prevent, so opting out of it must not
        // be possible.
        //
        // Pinned rather than merged because the sizing math above already
        // assumes text may occupy `maxLines` lines; honoring nowrap would make
        // the computed size wrong, not merely differently styled.
        whiteSpace: "normal",
        minWidth: 0,
        maxWidth: "100%",
        // LAST-RESORT CONTAINMENT.
        //
        // The binary search clamps its answer to [floor, ceiling]. When even
        // `floor` overflows the budget, that size is committed and painted —
        // and with no vertical bound the text escaped DOWNWARD, over whatever
        // sat below it, until the scene root's overflow:hidden cut it off. That
        // is how a long quote shipped clipped mid-sentence.
        //
        // Shrinking further is not the answer: below the floor the text is
        // illegible, so it would be unreadable instead of clipped. Containing
        // it keeps the failure inside this element's own box rather than
        // corrupting the rest of the composition.
        //
        // The measurement probe saves and restores maxHeight/overflow around
        // its pass (see naturalHeight), so this does not affect fitting.
        ...(maxHeight && maxHeight > 0
          ? { maxHeight, overflow: "hidden" }
          : null),
      }}
    >
      {children}
    </Tag>
  );
};
