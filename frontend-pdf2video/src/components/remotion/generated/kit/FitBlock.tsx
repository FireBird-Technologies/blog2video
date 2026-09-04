/**
 * Custom-template craft kit — FitBlock.
 *
 * A SHARED type budget for a group of text that must fit together.
 *
 * `FitText` fits each element against its own box, independently. That is the
 * right behaviour for a lone headline, and the wrong behaviour for a headline
 * stacked above body copy: each one individually "fits" its own slot while the
 * two of them TOGETHER overflow the region that holds them. Nothing in the
 * generated kit could see that, because no component saw more than one text
 * block at a time.
 *
 * The built-in templates solve this with `withAutoFitLayout` (see
 * nightfall/layouts/index.ts), which wraps a whole layout and shrinks its title
 * and description against one budget. Generated scenes have no layout registry
 * to wrap, so the same idea is expressed as a component: put the scene's text
 * region inside a <FitBlock>, and every <FitText> within it shares one scale.
 *
 * WHY A SCALE RATHER THAN ABSOLUTE SIZES. FitBlock does not tell its children
 * what size to be — it multiplies the size they each asked for. That preserves
 * the type hierarchy the scene designed: a title at 88 and body at 34 stay in
 * their 2.6:1 relationship at every scale, so a scene that shrinks still reads
 * as the same design rather than collapsing toward uniform text. It also means
 * FitText keeps its own per-element measurement, which is what handles a single
 * overlong word or an unlucky line break.
 *
 * The three render-safety guarantees from FitText apply here for the same
 * reasons and are NOT optional — see that file's header:
 *
 *   1. delayRender()/continueRender() so the headless capturer waits.
 *   2. The release is deferred through requestAnimationFrame, because a
 *      synchronous release fires before React commits and the capturer grabs
 *      the frame at the OLD scale.
 *   3. A document.fonts.ready fallback for the headless path, where the first
 *      layout pass runs before webfonts resolve and every probe reads 0.
 *
 * STABILITY: the fit is keyed on the inputs that change the answer, never on
 * the frame. Generated scenes animate transforms, opacity and layout
 * continuously; re-measuring per frame would let the type size drift mid-scene.
 *
 * BACKWARD COMPATIBILITY: a <FitText> outside any <FitBlock> reads a scale of
 * 1 and behaves exactly as it did before this file existed. Every scene already
 * stored in the database keeps rendering identically.
 */

import React from "react";
import { delayRender, continueRender, useVideoConfig } from "remotion";
import { useTypeTier } from "./typeTier";

/** The shared scale, 0 < scale <= 1. 1 means "no shrink applied". */
const FitScaleContext = React.createContext<number>(1);

/** Multiplier a FitText should apply to its target size. 1 when unwrapped. */
export const useFitScale = (): number => React.useContext(FitScaleContext);

export interface FitBlockProps {
  children: React.ReactNode;
  /**
   * Height budget in px for the whole group. Defaults to the element's own
   * measured height, which is correct whenever the block is a bounded flex/grid
   * child — the usual case for a scene's text column.
   */
  maxHeight?: number;
  /**
   * Floor for the shared scale. Below this the block stops shrinking and lets
   * the content clip rather than reducing a 34px body to something unreadable
   * on a screen watched across a room. 0.62 of the designed size is roughly the
   * point where the type stops being video type.
   */
  minScale?: number;
  style?: React.CSSProperties;
}

/**
 * Share of the CANVAS HEIGHT a text block may occupy when it is given no
 * explicit `maxHeight`. Mirrors the constant of the same name in FitText.
 *
 * Not `el.clientHeight`: a FitBlock is normally an auto-height flex child, so
 * its box grows to whatever it contains and can never report overflow.
 */
const UNBOUNDED_HEIGHT_SHARE = 0.55;

/** Multiplicative step per shrink iteration — matches withAutoFitLayout's 0.96. */
const STEP = 0.96;
/** Sub-pixel tolerance, same as FitText's capacity allowance. */
const SLACK = 2;
/**
 * Ceiling on measure/publish cycles per input change.
 *
 * The solve normally lands in one pass and confirms in a second. This exists
 * for the case it cannot: layout is not perfectly linear in font size, and a
 * line break that appears at one scale and disappears at the next can flip the
 * measurement between two values indefinitely. Unbounded, that pins a CPU core
 * and freezes the Player. Three is enough for the honest case and short enough
 * that the dishonest one settles on whatever it last measured.
 */
const MAX_PASSES = 3;

export const FitBlock: React.FC<FitBlockProps> = ({
  children,
  maxHeight,
  minScale = 0.62,
  style,
}) => {
  const { height: canvasHeight } = useVideoConfig();
  const ref = React.useRef<HTMLDivElement | null>(null);
  const handleRef = React.useRef<number | null>(null);

  // A SIZE THE USER DRAGGED IS NOT SCALED.
  //
  // FitText already renders an exact size verbatim, but it multiplies its
  // target by this block's scale (`desired = desiredRaw * blockScale`), so a
  // block that shrinks its subtree to fit its own budget re-imposes exactly the
  // cap FitText just stopped applying — down to minScale, 62%. The slider then
  // saturates again, by a different route and only in the scenes that happen to
  // use a FitBlock (Dawn's chronology/sequence, most of Careem).
  //
  // So when either tier is exact the block stands down entirely: scale 1, no
  // measure/publish cycle, and — as in FitText — no delayRender handle, since
  // there is nothing to wait for. Auto-fitted content is untouched and still
  // shrinks to fit.
  const { titleIsExact, descriptionIsExact } = useTypeTier();
  const isExact = titleIsExact || descriptionIsExact;

  // Re-fit when the budget or the content changes — NOT per frame.
  //
  // React.Children.count is a cheap proxy for "the content changed shape". The
  // text itself is not in the key: each child FitText re-measures its own text
  // on its own key, and putting the full text here would re-run the shared fit
  // on every caption tweak for no benefit.
  // `isExact` rides in the key so the pass counter below resets when it flips.
  // Without it, a block that spent its 3 passes before the user dragged a
  // slider could never fit again once the drag was cleared or saved — passRef
  // resets only on a key change, and nothing else about the block moves.
  const fitKey = `${maxHeight ?? 0}|${minScale}|${React.Children.count(children)}|${isExact ? 1 : 0}`;

  const [fit, setFit] = React.useState<{ key: string; scale: number }>({
    key: fitKey,
    scale: 1,
  });
  // A stale scale must never paint: when the key changes, fall back to 1 (the
  // designed sizes) rather than a scale measured for different content. Same
  // reasoning as FitText storing its key alongside its value.
  //
  // An exact size pins this to 1 regardless of what was last measured — see the
  // note above.
  const scale = isExact ? 1 : fit.key === fitKey ? fit.scale : 1;

  // The scale currently APPLIED to the DOM, readable synchronously inside the
  // effect. State cannot serve this: measure() runs in the same commit that
  // published the last value, so reading `scale` there can see the previous
  // render's number and normalise by the wrong divisor.
  const scaleRef = React.useRef(scale);
  scaleRef.current = scale;

  // Hard stop on the measure/publish cycle.
  //
  // The maths below converges in one or two passes, but it depends on layout
  // behaving linearly, and it does not have to: a line break that appears at
  // one scale and vanishes at the next can flip the measurement back and forth
  // forever. That oscillation is invisible in a static render and locks the
  // browser in the Player, so the loop is bounded rather than trusted. Reset
  // whenever the inputs genuinely change.
  const passRef = React.useRef(0);
  const passKeyRef = React.useRef(fitKey);
  if (passKeyRef.current !== fitKey) {
    passKeyRef.current = fitKey;
    passRef.current = 0;
  }

  const release = React.useCallback(() => {
    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
  }, []);

  // Unmount: the handle must not outlive the component, or the Player waits
  // forever on a scene that has already scrolled past.
  React.useEffect(() => release, [release]);

  React.useLayoutEffect(() => {
    // Acquired HERE rather than during render — see FitText.tsx's full note.
    // Acquiring in the render body and releasing in an effect deadlocks a
    // headless capture: the page pauses on the outstanding handle, so effects
    // never flush, so nothing ever releases it.
    const el = ref.current;
    if (!el || typeof window === "undefined") return;

    // Exact sizes are rendered as chosen — nothing to solve for, so this block
    // neither measures nor delays. See the note beside `isExact` above.
    //
    // Releases rather than returns, because `isExact` can flip mid-life: the
    // user drags a slider on a block that had already started a fit, and the
    // handle taken by the previous run would otherwise be held to unmount.
    if (isExact) {
      release();
      return;
    }

    if (handleRef.current === null) {
      handleRef.current = delayRender("kit-fit-block", { timeoutInMilliseconds: 8_000 });
    }

    let cancelled = false;

    const measure = () => {
      if (cancelled || !el.isConnected) {
        release();
        return;
      }

      // The budget: an explicit maxHeight wins, otherwise the box this block
      // actually occupies. With neither there is nothing to fit against.
      // An explicit maxHeight wins. Otherwise fall back to a CANVAS-RELATIVE
      // share rather than el.clientHeight.
      //
      // clientHeight is the wrong reference for this component: a FitBlock is
      // normally an auto-height flex child, so its box GROWS to fit whatever is
      // inside it. scrollHeight then equals clientHeight, no overflow is ever
      // detected, and the scale stays 1 — which is why this was a no-op on
      // every generated scene that did not pass maxHeight (8 of 9 in template
      // 184). Measuring against a fixed share of the frame gives the block a
      // constraint its content can actually exceed.
      const budget =
        maxHeight && maxHeight > 0
          ? maxHeight
          : Math.round(canvasHeight * UNBOUNDED_HEIGHT_SHARE);
      if (budget <= 0) {
        release();
        return;
      }

      // Fonts unresolved — every probe reads 0 and any scale would "fit".
      // Defer to the fonts.ready path rather than locking in a wrong answer.
      if (el.scrollHeight === 0) {
        release();
        return;
      }

      // Shrink until the CONTENT fits the budget.
      //
      // Unlike FitText this cannot binary-search: the scale is applied through
      // React context, so a candidate scale is only observable after a commit
      // and a re-layout. We solve from the measured overflow directly —
      // scrollHeight is roughly linear in the type scale, so the ratio gives a
      // near-exact answer in one step, and STEP backs it off to absorb the
      // non-linearity from line-break changes.
      //
      // THE MEASUREMENT MUST BE SCALE-INVARIANT. scrollHeight here is the height
      // AT THE CURRENT SCALE, not at scale 1 — so `capacity / scrollHeight` is a
      // correction to apply to the scale in force, never an absolute answer.
      // Treating it as absolute made each pass shrink the already-shrunken
      // content again, compounding instead of converging: the block ratcheted
      // toward minScale and, because every pass published a new scale and
      // re-entered the effect, the preview locked up. Normalising by
      // `scaleRef.current` is what makes measure() idempotent — a block that
      // already fits measures 1.0 and stops.
      const capacity = budget + SLACK;
      const current = scaleRef.current;
      const heightAtOne = el.scrollHeight / Math.max(0.01, current);
      let next = 1;
      if (heightAtOne > capacity) {
        next = (capacity / heightAtOne) * STEP;
      }
      next = Math.min(1, Math.max(minScale, next));

      if (!cancelled) {
        // Converged, or out of passes — do not publish, or the commit
        // re-enters this effect and the cycle continues.
        if (Math.abs(next - current) >= 0.005 && passRef.current < MAX_PASSES) {
          passRef.current += 1;
          scaleRef.current = next;
          setFit({ key: fitKey, scale: next });
        }
      }
      // Backed by a timer — see FitText.tsx's identical note: rAF is not
      // guaranteed to fire in a headless capture that is paused waiting on
      // outstanding delayRender handles. release() is idempotent.
      requestAnimationFrame(() => release());
      setTimeout(() => release(), 250);
    };

    const fontsObj = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (el.clientHeight > 0) {
      measure();
    } else if (fontsObj?.ready) {
      // Race against a short timeout — see FitText.tsx's identical guard for
      // why: document.fonts.ready can hang indefinitely in some headless
      // Chromium runs, and without this a stuck promise means measure() (and
      // therefore release()) never runs, blocking the whole render on the
      // delayRender handle above until it times out.
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

    // Only cancels the in-flight async measure. It must NOT release the
    // handle: this cleanup runs on every `scale` change too, and releasing
    // here would end the delay while the fit is still converging, letting the
    // headless capturer grab a half-fitted frame. Release is unmount-only,
    // in the dedicated effect above.
    return () => {
      cancelled = true;
    };
    // `scale` IS a dependency: each published scale must be re-measured to
    // confirm it actually fits, which is how this converges. That re-entry is
    // safe only because measure() is scale-invariant (it normalises by
    // scaleRef) and because it stops publishing once converged or out of
    // passes — without both of those this dependency is an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, maxHeight, minScale, scale, canvasHeight, release, isExact]);

  return (
    <FitScaleContext.Provider value={scale}>
      <div
        ref={ref}
        style={{
          // minHeight:0 lets this shrink inside a flex parent; without it the
          // parent pins the height and clientHeight reports the unclipped box,
          // so the overflow this exists to detect is invisible.
          minHeight: 0,
          minWidth: 0,
          ...style,
        }}
      >
        {children}
      </div>
    </FitScaleContext.Provider>
  );
};
