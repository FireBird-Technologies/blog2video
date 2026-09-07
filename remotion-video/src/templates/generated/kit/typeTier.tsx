/**
 * Which type tier a <FitText> belongs to, whether its size was chosen by a
 * PERSON, and how big the body actually rendered.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two defects that generated scene code cannot fix by itself, because every
 * stored scene already reads `props.titleFontSize` / `props.descriptionFontSize`
 * and must keep working with no regeneration:
 *
 *  1. A SIZE THE USER SET MUST RENDER LITERALLY. FitText normally treats
 *     `fontSize` as a target the box may overrule — correct for a size the
 *     GENERATOR guessed, wrong for one a person dragged a slider to. The scene
 *     cannot tell the two apart: both arrive as the same prop. Only the caller
 *     that resolved the props knows, so it declares it here.
 *
 *  2. THE TITLE MUST OUTRANK THE BODY ON THE FRAME. FitText solves each element
 *     independently against its own box, so a long title in a tight box can
 *     land BELOW the body — the requested 68/34 pair renders 61/42 and the
 *     hierarchy inverts. Nothing in the pipeline measured rendered size, so
 *     nothing caught it. The body publishes what it actually rendered at, and
 *     the title floors above it.
 *
 * Both are read-time repairs: they fix templates that are already generated and
 * stored, which a change to the scene contract cannot do.
 *
 * The registry is deliberately per-SCENE, not global. Two scenes are on screen
 * together during a transition, and a title must never be floored against the
 * body of the scene it is dissolving into.
 */
import React from "react";

export interface TypeTierValue {
  /** True when layoutConfig carried an explicit titleFontSize for this scene. */
  titleIsExact: boolean;
  /** True when layoutConfig carried an explicit descriptionFontSize. */
  descriptionIsExact: boolean;
  /**
   * The resolved sizes, so a FitText can work out WHICH tier it is.
   *
   * Generated code passes a plain number — `<FitText fontSize={titleSize}>` —
   * and cannot be asked to label itself without regenerating every stored
   * template. But `titleSize` is `props.titleFontSize ?? <literal>`, and
   * props.titleFontSize is supplied on v3 scenes (the template's stored default
   * is merged under layoutConfig by both the render and the preview). So the
   * number a FitText receives normally EQUALS one of these two, which is enough
   * to tell them apart.
   */
  titleSize?: number;
  descriptionSize?: number;
}

const TypeTierContext = React.createContext<TypeTierValue>({
  titleIsExact: false,
  descriptionIsExact: false,
});

/**
 * Which tier a given fontSize belongs to, or null when it matches neither.
 *
 * Returns null on a tie as well: if the two resolved sizes are equal there is
 * no hierarchy to enforce and no way to tell the elements apart, and guessing
 * would floor a body element against itself.
 */
export function inferTier(
  fontSize: number | undefined,
  v: TypeTierValue,
): "title" | "body" | null {
  if (typeof fontSize !== "number" || !(fontSize > 0)) return null;
  const { titleSize, descriptionSize } = v;
  if (titleSize === descriptionSize) return null;
  if (typeof titleSize === "number" && Math.round(fontSize) === Math.round(titleSize)) {
    return "title";
  }
  if (
    typeof descriptionSize === "number" &&
    Math.round(fontSize) === Math.round(descriptionSize)
  ) {
    return "body";
  }
  return null;
}

/**
 * Declares, for one scene, which of its two sizes the user set explicitly.
 *
 * Mirrors the placement of EyebrowSizeProvider / KitVariantProvider in both
 * VideoPreview.tsx and GeneratedVideo.tsx — those two blocks are required to
 * stay identical, so this one wraps the scene in exactly the same place.
 */
export const TypeTierProvider: React.FC<{
  value: TypeTierValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  // Memoised on the two booleans so a re-render of the scene does not hand
  // every FitText below a new object identity and re-run its fit.
  const memo = React.useMemo(
    () => ({
      titleIsExact: value.titleIsExact,
      descriptionIsExact: value.descriptionIsExact,
      titleSize: value.titleSize,
      descriptionSize: value.descriptionSize,
    }),
    [value.titleIsExact, value.descriptionIsExact, value.titleSize, value.descriptionSize],
  );
  return <TypeTierContext.Provider value={memo}>{children}</TypeTierContext.Provider>;
};

export const useTypeTier = (): TypeTierValue => React.useContext(TypeTierContext);

// ── The rendered-body registry ──────────────────────────────────────────────

type BodySizeStore = {
  /** The largest size any body-tier FitText in this scene actually rendered at. */
  px: number;
  subscribe: (fn: () => void) => () => void;
  publish: (px: number) => void;
};

function createStore(): BodySizeStore {
  const listeners = new Set<() => void>();
  const store: BodySizeStore = {
    px: 0,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    publish(px) {
      // MAX, not last-write. A scene has several body-tier elements (the display
      // text, the bullets, the labels) and the title must clear the biggest of
      // them, not whichever happened to measure last.
      if (px <= store.px) return;
      store.px = px;
      listeners.forEach((fn) => fn());
    },
  };
  return store;
}

const BodySizeContext = React.createContext<BodySizeStore | null>(null);

/** One registry per scene. Wraps the same subtree as TypeTierProvider.
 *
 * RESET WHEN THE SCENE'S SIZES CHANGE. `publish` is MAX-only, so within one
 * generation the registry only climbs — which is what makes the title clear the
 * BIGGEST body element rather than whichever measured last. Across a change of
 * sizes that same property is wrong: a size dragged DOWN could never lower the
 * stored maximum, so the title kept flooring itself against a value no element
 * still renders at, for the life of the mount.
 *
 * The key is read from the TypeTier context this scope always sits inside (all
 * three call sites mount it directly within TypeTierProvider), so no call site
 * has to remember to pass it. A new pair of resolved sizes starts a new
 * generation from zero; MAX-only still holds within each one. */
export const BodySizeScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { titleSize, descriptionSize } = React.useContext(TypeTierContext);
  const store = React.useMemo(
    createStore,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [titleSize, descriptionSize],
  );
  return <BodySizeContext.Provider value={store}>{children}</BodySizeContext.Provider>;
};

/** A body-tier element reports the size it settled on. No-op outside a scope. */
export function usePublishBodySize(px: number, isBody: boolean): void {
  const store = React.useContext(BodySizeContext);
  React.useEffect(() => {
    if (!store || !isBody || !(px > 0)) return;
    store.publish(px);
  }, [store, isBody, px]);
}

/**
 * The largest rendered body size in this scene, or 0 when nothing has reported.
 *
 * Subscribed rather than read once: the body's own fit is asynchronous (it
 * measures, then settles), so a title that read this during the first paint
 * would floor against a stale 0 and never revisit it.
 */
export function useRenderedBodySize(): number {
  const store = React.useContext(BodySizeContext);
  const subscribe = React.useCallback(
    (fn: () => void) => (store ? store.subscribe(fn) : () => {}),
    [store],
  );
  const get = React.useCallback(() => (store ? store.px : 0), [store]);
  return React.useSyncExternalStore(subscribe, get, get);
}
