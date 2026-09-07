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
import { useFitScale } from "./FitBlock";
import {
  useTypeTier,
  usePublishBodySize,
  useRenderedBodySize,
  inferTier,
} from "./typeTier";

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
  /**
   * Render AT `fontSize` rather than fitting around it.
   *
   * WHY THIS EXISTS. Everywhere else in this component `fontSize` is a target
   * the box may overrule: the width solve
   * (`containerWidth * maxLines / textLength`) decides the size, and `fontSize`
   * survives only as a ceiling. That is right for a size the GENERATOR chose —
   * a guess about copy nobody has seen yet, where the box knows better.
   *
   * It is wrong for a size a PERSON chose while looking at the frame. There,
   * letting text length decide means the editor's slider moves a number nothing
   * renders: a six-word title saturated at ~117px and a ten-word title at
   * ~61px, wherever the slider went. That is the "grows to a limit, then
   * refuses" defect.
   *
   * With `exact` the requested size is honoured and only the OVERFLOW guard
   * still applies — text may shrink to stay inside `maxHeight`, because running
   * off the frame is not a preference. The width fill-solve, the 1.25x growth
   * cap and the canvas-height cap are all skipped.
   */
  exact?: boolean;
  /**
   * Which type tier this text is, in a v3 custom template.
   *
   * Generated code never passes this — it is inferred by the caller that
   * resolved the props (the element bound to props.titleFontSize is the title)
   * and delivered through context, so already-stored scenes get both behaviours
   * with no regeneration. Passing it explicitly overrides the inference.
   *
   *   "title" — renders exact when the user set titleFontSize, and is floored
   *             above whatever the body actually rendered at.
   *   "body"  — renders exact when the user set descriptionFontSize, and
   *             publishes its rendered size for the title to clear.
   */
  tier?: "title" | "body";
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

/**
 * Share of the CANVAS HEIGHT a text block may occupy when nothing else bounds
 * it — no `maxHeight` prop and an auto-height parent.
 *
 * Exists to break a circularity: the previous fallback derived the budget from
 * the seed itself (`seed * lineHeight * maxLines`), so every candidate size
 * trivially "fitted" and the DOM measurement could only confirm the estimate,
 * never correct it. Anchoring to the canvas gives the measurement something
 * real to fail against.
 *
 * 0.30 is deliberately generous — it is a backstop for scenes that pass no
 * geometry, not a substitute for `maxHeight`, which the scene should pass
 * whenever it knows its own layout (and the validator now requires).
 */
const UNBOUNDED_HEIGHT_SHARE = 0.3;

/**
 * How far above the body the title must sit, at minimum.
 *
 * A floor, not a scale. The template's own numbers decide the real ratio (the
 * scene contract asks for ~2.2x landscape / ~1.7x portrait); this only stops
 * the two from crossing when their independent fits land the wrong way round.
 * 1.15 is enough to read as a hierarchy while barely moving a title that was
 * already correct.
 */
const TITLE_BODY_MIN_RATIO = 1.15;

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
  exact,
  tier,
  as = "div",
  style,
}) => {
  const { width, height } = useVideoConfig();
  const { type } = useKit();
  const Tag = as as React.ElementType;

  // Which tier this is, and whether the user chose this size.
  //
  // A generated scene passes neither: it just writes
  // `<FitText fontSize={titleSize}>`. The caller that resolved the props knows
  // both facts and supplies them through context, which is what lets an
  // already-stored template pick up both behaviours without regeneration.
  const tierCtx = useTypeTier();
  // An explicit `tier` wins; otherwise match this element's fontSize against the
  // two sizes the caller resolved for the scene. See inferTier for why that is
  // enough, and why a tie resolves to neither.
  const resolvedTier = tier ?? inferTier(fontSize, tierCtx);
  const isTitle = resolvedTier === "title";
  const isBody = resolvedTier === "body";
  const resolvedExact =
    exact ??
    (isTitle ? tierCtx.titleIsExact : isBody ? tierCtx.descriptionIsExact : false);

  // The shared scale from an enclosing <FitBlock>, or 1 when there is none.
  //
  // Applied to the whole band — target, floor AND ceiling — rather than to the
  // target alone. Scaling only the target would let the floor hold the text at
  // its original size, which is exactly the overflow the block is trying to
  // resolve; and leaving the ceiling unscaled would let short text grow back
  // into the space the block just reclaimed.
  const blockScale = useFitScale();

  const desiredRaw = fontSize ?? type.title;
  const desired = desiredRaw * blockScale;
  // Floor at 40% of desired rather than 50%. A caller passing minFontSize={48}
  // for a title that genuinely needs 30px cannot shrink far enough, so it
  // overflows at 48 instead — a floor that blocks fitting defeats the component.
  const floor = (minFontSize ?? Math.max(16, Math.round(desiredRaw * 0.4))) * blockScale;
  // Under `exact` the floor may not exceed the target — a caller passing
  // minFontSize={24} for a title the user set to 18 must not be dragged back up
  // to 24, which would make the bottom of the slider dead the way the top was.
  const effFloor = resolvedExact ? Math.min(floor, desired) : floor;
  // Grow ceiling. Short text may exceed the target — otherwise a two-word
  // headline sits at the size chosen for a full sentence — but never past what
  // the frame can hold, so it is capped against the canvas height too.
  //
  // 1.25x, not the 1.6x this ran at. With no containerWidth passed (which was
  // every generated scene), the width solve resolves to the ceiling for all but
  // the longest copy, so the ceiling WAS the rendered size — turning a designed
  // 76px headline into 122px and producing the "fonts are enormous" report.
  // The type scale is chosen deliberately upstream; growth is a nudge for short
  // copy, not licence to redesign it.
  //
  // Under `exact` the ceiling IS the requested size: the growth cap and the
  // canvas cap both describe how far an auto-fitted guess may drift from its
  // target, and there is no drift to allow when the target was chosen
  // deliberately. Leaving them in place is what made the slider saturate.
  const ceiling = resolvedExact
    ? desired
    : Math.max(
        floor,
        (maxFontSize ?? Math.min(Math.round(desiredRaw * 1.25), Math.round(height * 0.18))) *
          blockScale,
      );
  // Prefer the real container width; fall back to the canvas estimate.
  const boxWidth = containerWidth && containerWidth > 0 ? containerWidth : width * widthFraction;

  const text = textOf(children);
  // The estimate is the seed: it is what paints on the very first frame and what
  // stands if measurement turns out to be impossible.
  // `exact` seeds at the requested size and lets the measured pass below shrink
  // it ONLY if it genuinely overflows its height budget. estimateFitSize is the
  // width fill-solve, and that is precisely what must not run here.
  const seed = resolvedExact
    ? Math.max(effFloor, desired)
    : estimateFitSize(
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
  // blockScale rides in via desired/floor/ceiling, which are already scaled —
  // so a change to the enclosing FitBlock's scale invalidates this key and
  // forces a re-measure, exactly like a change of text or box would.
  const fitKey = `${text}|${boxWidth}|${desired}|${effFloor}|${ceiling}|${maxLines}|${maxHeight ?? 0}|${lineHeight}|${resolvedExact ? 1 : 0}|${resolvedTier ?? ""}`;

  // The measured size, tagged with the key it was measured for. Storing the key
  // alongside the value is what makes a stale measurement impossible to paint:
  // when the key changes, the seed for the NEW inputs is used immediately rather
  // than the size that was fitted for the old ones.
  const [fit, setFit] = React.useState<{ key: string; px: number }>({
    key: fitKey,
    px: seed,
  });
  const solved = fit.key === fitKey ? fit.px : seed;

  // ── The hierarchy floor ───────────────────────────────────────────────────
  //
  // FitText solves every element independently against its own box, so a long
  // title in a tight box lands BELOW the body: a requested 68/34 pair renders
  // 61/42 and the hierarchy inverts. Nothing upstream can prevent it —
  // _font_default_defects compares the `?? 68` / `?? 34` SOURCE LITERALS, which
  // are correctly ordered, and nothing in the pipeline measures what renders.
  //
  // So the title clears the body here, against the size the body really settled
  // on. Capped by the height budget so the floor can never itself cause the
  // overflow this component exists to prevent — text pushed off the frame is a
  // worse defect than the inversion being fixed.
  const renderedBody = useRenderedBodySize();
  let size = solved;
  // AN EXACT SIZE IS NOT RAISED EITHER — the mirror of the early return in the
  // layout effect below, and the reason this guard is not merely tidiness.
  //
  // The registry this floor reads is MAX-only and is never reset for the life
  // of the mount (see typeTier.tsx). That is safe only while something pulls
  // the published sizes back down, which used to be the measured shrink. In
  // exact mode that shrink no longer runs, so the floor became a one-way
  // ratchet: an element publishes, every subscriber re-renders, the title
  // raises itself off the ratcheted value, publishes again — and because
  // `publish` notifies its listeners synchronously, React never reached idle
  // and the editor tab hung with a blank preview the moment a slider moved.
  //
  // A size the user chose is their number in BOTH directions: the measure may
  // not lower it and the hierarchy may not raise it.
  if (!resolvedExact && isTitle && renderedBody > 0) {
    const wanted = Math.round(renderedBody * TITLE_BODY_MIN_RATIO);
    if (wanted > size) {
      const budget = maxHeight && maxHeight > 0 ? maxHeight : height * UNBOUNDED_HEIGHT_SHARE;
      // One line's worth of the budget is the hard stop: below that not even a
      // single line of the title fits.
      size = Math.min(wanted, Math.max(size, Math.floor(budget / lineHeight)));
    }
  }

  // A body-tier element publishes what it rendered at, so the title can clear
  // it. Max across the scene's body elements, not last-write — see typeTier.tsx.
  usePublishBodySize(size, isBody);

  const release = React.useCallback(() => {
    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
  }, []);

  // Unmount: the handle must never outlive the component, or the Player waits
  // on a scene that has already scrolled past.
  React.useEffect(() => release, [release]);

  React.useLayoutEffect(() => {
    // THE HANDLE IS ACQUIRED HERE, NOT DURING RENDER.
    //
    // It used to be taken in the render body, on the reasoning that the
    // capturer must already be waiting by the time the first layout pass runs.
    // That is unsafe: acquiring in render pairs a side effect with a phase
    // React may run without ever committing, and the release lives in an
    // effect. In a headless capture that pairing deadlocks outright — the page
    // is paused while a delayRender is outstanding, so React never flushes
    // effects, so the effect that would release it never runs, so the page
    // stays paused. Measured on project 1211: frame 0 acquired, measured and
    // released normally; frames 1 and 2 acquired a fresh handle per frame and
    // the layout effect NEVER fired, and the render died at the first handle's
    // timeout.
    //
    // Acquiring inside the effect makes the invariant structural: a handle can
    // only exist if the code that releases it is already running. A frame that
    // never reaches its effects simply never delays, which is correct — it has
    // nothing to wait for, and the seed estimate is what paints.
    const el = ref.current;
    // No node to measure (SSR pass, detached) — the seed estimate stands.
    if (!el || typeof window === "undefined") return;

    // AN EXACT SIZE IS NOT MEASURED AT ALL.
    //
    // `exact` means a person chose this number while looking at the frame, so
    // the seed above already IS the answer and there is nothing to solve for.
    // The measured pass used to run anyway and shrink the result back to
    // `maxHeight` — which made the top of the slider dead: past the point where
    // the title needs one line more than its box allows, every further drag was
    // measured as overflow and clamped straight back. The number moved and the
    // type did not, which is the "grows to a limit, then refuses" defect.
    //
    // Overflow is the correct outcome here. The box is a guess the generator
    // made about copy nobody had seen; a size the user picked while watching
    // the result is not a guess, and silently overruling it is worse than
    // letting text run past its box where they can see it and drag back.
    // Auto-fitted sizes (the default) still measure and still shrink.
    if (resolvedExact) return;

    if (handleRef.current === null) {
      // Bounded below Remotion's own per-frame timeout so a stuck measure
      // surfaces as this label rather than eating the whole frame budget.
      handleRef.current = delayRender("kit-fit-text", { timeoutInMilliseconds: 8_000 });
    }

    let cancelled = false;

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

      // The height budget. An explicit maxHeight wins; otherwise the box the
      // element actually occupies; otherwise a CANVAS-RELATIVE share.
      //
      // That last fallback used to be `seed * lineHeight * maxLines` — derived
      // from the very size it was meant to judge, so EVERY seed fitted its own
      // budget and the measurement could only ever confirm the estimate:
      //
      //     seed 122 -> budget 421 | 3 lines at 122px need 421 -> "fits"
      //     seed  76 -> budget 262 | 3 lines at  76px need 262 -> "fits"
      //
      // With no maxHeight and an auto-height parent (the common shape in
      // generated scenes) that made this whole component a no-op, and the
      // visible size was purely the character-count estimate. A budget derived
      // from the answer can never falsify the answer, so it is now tied to the
      // canvas instead: a text block gets at most ~30% of frame height, which
      // is a real constraint the estimate can fail against.
      const budget =
        maxHeight && maxHeight > 0
          ? maxHeight
          : el.clientHeight > 0
            ? el.clientHeight
            : Math.round(height * UNBOUNDED_HEIGHT_SHARE);
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
        let lo = effFloor;
        let hi = ceiling;
        // Invariant: lo fits (or is the floor, which we take regardless), hi does not.
        while (hi - lo > 1) {
          const mid = Math.floor((lo + hi) / 2);
          if (naturalHeight(mid) <= capacity) lo = mid;
          else hi = mid;
        }
        next = lo;
      }
      next = Math.max(effFloor, Math.min(ceiling, next));

      if (!cancelled) {
        const px = next;
        setFit((prev) => (prev.key === fitKey && prev.px === px ? prev : { key: fitKey, px }));
      }
      // Deferred so the release lands AFTER React commits and the browser
      // paints the new size — see the header note.
      //
      // BACKED BY A TIMER, because rAF is not guaranteed to fire here. In a
      // headless capture the page can be paused precisely while delayRender
      // handles are outstanding, so "release on the next animation frame" and
      // "advance to the next frame once released" can wait on each other and
      // neither happens. `release()` is idempotent (it nulls the handle), so
      // whichever callback runs first wins and the other is a no-op.
      requestAnimationFrame(() => release());
      setTimeout(() => release(), 250);
    };

    const fontsObj = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (el.clientHeight > 0) {
      // Fonts already loaded (the usual Player case) — measure synchronously so
      // frame 0 paints at the fitted size with no visible reflow.
      measure();
    } else if (fontsObj?.ready) {
      // Race against a short timeout: document.fonts.ready is a native
      // promise this component does not control, and some Chromium/headless
      // combinations can leave it pending indefinitely (a documented
      // Puppeteer footgun) rather than resolving once a font request settles
      // or fails. Without this race, a hung `ready` promise means `measure()`
      // is never called, `release()` is never called, and the delayRender
      // handle above blocks the ENTIRE render until it times out — one
      // unresolved font promise failing the whole video. GeneratedVideo.tsx's
      // own font wait already guards itself the same way (explicit timeout +
      // catch); this mirrors that guarantee for FitText's independent wait.
      let settled = false;
      const timer = setTimeout(() => {
        if (settled || cancelled) return;
        settled = true;
        measure();
      }, 4_000);
      fontsObj.ready.then(() => {
        if (settled || cancelled) return;
        settled = true;
        clearTimeout(timer);
        measure();
      });
    } else {
      measure();
    }

    // Cancels the in-flight measure only. Releasing here would end the delay
    // on every re-fit while the size is still settling; release is
    // unmount-only, in the dedicated effect above.
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, release]);

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
        //
        // NOT APPLIED TO AN EXACT SIZE. Containment is the endgame of the
        // auto-fit: once shrinking has done all it can, clip rather than let
        // text corrupt the rest of the composition. An exact size never went
        // through that shrink (see the early return in the layout effect), so
        // clipping here would just reintroduce the same dead-slider defect in
        // visual form — the number rises, the type is cut off at the same
        // place. A size the user is actively dragging is shown in full.
        ...(!resolvedExact && maxHeight && maxHeight > 0
          ? { maxHeight, overflow: "hidden" }
          : null),
      }}
    >
      {children}
    </Tag>
  );
};
