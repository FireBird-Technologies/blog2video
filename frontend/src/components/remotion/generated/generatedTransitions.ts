/**
 * Brand-keyed transition pool for AI-generated custom templates.
 *
 * WHY: the old `GeneratedTransition` was a single-layer overlay painted on the
 * last ~15 frames of the OUTGOING scene only — the incoming scene never moved,
 * so it read as a masked cut, not a real transition. This pool returns true
 * `@remotion/transitions` presentations (slide / wipe / iris / flip / clockWipe
 * / fade) where the incoming and outgoing scenes genuinely overlap and move
 * together, exactly like the built-in templates (economist/spotlight/chronicle).
 * Driven by `TransitionSeries` in both the render (GeneratedVideo) and the
 * Edit-Template preview (ContinuousCustomComposition), so preview === render.
 *
 * Selection is keyed by the OUTGOING scene index against the brand's motion
 * personality (`theme.motion.transitionFamily`), so identical input always
 * renders identical transitions (reproducible) and the inter-brand distinctness
 * lever stays the brand signature — a calm brand (fade/ink_wash) and a bold one
 * (page_flip/whip_blur) get visibly different rhythms from the same engine. Each
 * move also rotates its DIRECTION by index, so a brand with a small family still
 * gets varied handoffs (left/right/up/down) instead of the same move every cut.
 *
 * NOTE: keep this file byte-identical to the frontend mirror at
 * frontend/src/components/remotion/generated/generatedTransitions.ts.
 */
import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide, type SlideDirection } from "@remotion/transitions/slide";
import { wipe, type WipeDirection } from "@remotion/transitions/wipe";
import { flip, type FlipDirection } from "@remotion/transitions/flip";
import { iris } from "@remotion/transitions/iris";
import { clockWipe } from "@remotion/transitions/clock-wipe";

/**
 * Brand motion personalities → concrete moves. The first five are the original
 * signature vocabulary (theme_extractor emits these); the rest are richer moves
 * a bolder/editorial signature can opt into for economist/chronicle-grade
 * variety. Unknown strings fall through to a safe fade.
 */
export type GeneratedTransitionFamily =
  | "fade"
  | "accent_wash"
  | "rule_sweep"
  | "ink_wash"
  | "whip_blur"
  | "push_slide"
  | "cover_wipe"
  | "page_flip"
  | "clock_sweep";

// Full rotation used when a brand has no explicit family — gives any template a
// rich, economist-style mix out of the box.
const DEFAULT_FAMILY: GeneratedTransitionFamily[] = [
  "push_slide",
  "rule_sweep",
  "page_flip",
  "ink_wash",
  "cover_wipe",
  "clock_sweep",
  "whip_blur",
  "fade",
];

export interface GeneratedTransitionChoice {
  presentation: TransitionPresentation<Record<string, unknown>>;
  /** Overlap consumed by the transition (frames). With each non-last sequence
   *  held by exactly this many frames, total duration + audio start frames stay
   *  identical to a plain back-to-back render. */
  frames: number;
}

type P = TransitionPresentation<Record<string, unknown>>;
// TransitionPresentation is invariant in its prop type, so each presentation is
// erased to the shared pool type at the boundary (callers only read
// `.presentation` + `.frames`). Mirrors the economist `as` casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = (p: TransitionPresentation<any>): P => p as unknown as P;

const SLIDE_DIRS: SlideDirection[] = ["from-right", "from-left", "from-bottom", "from-top"];
const WIPE_DIRS: WipeDirection[] = ["from-left", "from-top-left", "from-right", "from-bottom-right"];
const FLIP_DIRS: FlipDirection[] = ["from-right", "from-left", "from-top", "from-bottom"];
const pick = <T,>(arr: T[], i: number): T => arr[Math.abs(i) % arr.length];

/**
 * Map one brand "family" personality to a concrete overlapping presentation.
 * `iris`/`clockWipe` need canvas dimensions; `index` rotates each move's
 * direction so consecutive cuts never feel identical.
 */
function presentationFor(
  fam: GeneratedTransitionFamily,
  w: number,
  h: number,
  index: number,
): GeneratedTransitionChoice {
  switch (fam) {
    case "accent_wash":
    case "push_slide":
      // Push — incoming scene slides in over the outgoing one (direction varies).
      return { presentation: cast(slide({ direction: pick(SLIDE_DIRS, index) })), frames: 22 };
    case "rule_sweep":
      // Hard-edged directional wipe, evoking a printed rule sweeping the cut.
      return { presentation: cast(wipe({ direction: pick(WIPE_DIRS, index) })), frames: 24 };
    case "cover_wipe":
      // Vertical wipe — the next scene covers up/down over the current one.
      return {
        presentation: cast(wipe({ direction: index % 2 === 0 ? "from-bottom" : "from-top" })),
        frames: 24,
      };
    case "ink_wash":
      // Circular reveal (radial), matching the old ink-wash's radial feel.
      return { presentation: cast(iris({ width: w, height: h })), frames: 28 };
    case "page_flip":
      // 3D page flip — the outgoing scene turns away revealing the next.
      return {
        presentation: cast(flip({ direction: pick(FLIP_DIRS, index), perspective: 1700 })),
        frames: 26,
      };
    case "clock_sweep":
      // Radial clock wipe sweeping the new scene in around the centre.
      return { presentation: cast(clockWipe({ width: w, height: h })), frames: 30 };
    case "whip_blur":
      // Fast vertical push for a punchy "whip" handoff.
      return {
        presentation: cast(slide({ direction: index % 2 === 0 ? "from-bottom" : "from-top" })),
        frames: 16,
      };
    case "fade":
    default:
      return { presentation: cast(fade()), frames: 20 };
  }
}

export const pickGeneratedTransition = (
  index: number,
  family?: GeneratedTransitionFamily[] | string[],
  w = 1920,
  h = 1080,
): GeneratedTransitionChoice => {
  const pool =
    family && family.length
      ? (family as GeneratedTransitionFamily[])
      : DEFAULT_FAMILY;
  const fam = pool[Math.abs(index) % pool.length];
  return presentationFor(fam, w, h, index);
};
