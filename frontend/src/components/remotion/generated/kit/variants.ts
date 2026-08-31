/**
 * Custom-template craft kit — per-template structural variants.
 *
 * WHY THIS EXISTS
 * ---------------
 * The kit's atmosphere layers already vary enormously — 21 decor systems, 25
 * signature artifacts, 14 card surfaces. Its CONTENT layers did not vary at all:
 * `StatGrid` had exactly one arrangement, so every brand that showed three
 * numbers got the same row of the same cards with the same 3px accent rule on
 * top. Different colours and fonts over identical bones is a recolor, not a
 * design, and it is the single most legible reason generated templates read as
 * "templated".
 *
 * A variant is chosen ONCE PER TEMPLATE from a brand-derived seed, not per
 * scene, so a template stays internally consistent — the same brand always looks
 * the same, and two different brands diverge.
 *
 * WHY SEEDED RATHER THAN MODEL-CHOSEN
 * -----------------------------------
 * `blueprint.py` established this empirically: asking the model to diversify
 * does not work. Handed "enable panel_numbering" as NON-NEGOTIABLE it returned
 * False twice with identical fingerprints. Its comment: "A high temperature
 * makes the model's WORDING vary; it does not make its DESIGN vary." A hash has
 * no such prior, costs nothing, and is reproducible.
 *
 * The pattern mirrors `code_generator.py`'s brand-seeded composition shuffle and
 * `kit_vocabulary.py`'s `fonts_for_era`, including the `h / divisor` trick that
 * decorrelates several independent picks from one hash.
 */

// ─── Vocabulary ──────────────────────────────────────────────────────────────

/** How a set of stats/metrics is laid out. */
export const STAT_ARRANGEMENTS = [
  "row",          // cards side by side (the historical default)
  "stacked-rule", // full-width rows split by hairlines, no card chrome
  "ledger",       // label left, value right — a financial statement
  "hero-rail",    // one oversized primary, the rest in a thin side rail
  "quadrant",     // 2x2 block, equal weight
  "ticker",       // dense inline strip, values separated by dividers
] as const;
export type StatArrangement = (typeof STAT_ARRANGEMENTS)[number];

/** How an ordered/unordered list is laid out. */
export const LIST_ARRANGEMENTS = [
  "markers",   // accent bullet + text
  "rules",     // rows separated by hairlines
  "cards",     // each row on its own surface
  "numbered",  // large numerals in a left rail
  "rail",      // continuous vertical rule with items hung off it
] as const;
export type ListArrangement = (typeof LIST_ARRANGEMENTS)[number];

/** How a sequence (steps / timeline) is laid out. */
export const SEQUENCE_ARRANGEMENTS = [
  "vertical-rail",  // a vertical spine with nodes
  "horizontal",     // a left-to-right track
  "numbered-stack", // stacked rows led by big numerals
  "connected-dots", // nodes joined by a drawn line
] as const;
export type SequenceArrangement = (typeof SEQUENCE_ARRANGEMENTS)[number];

/** How a pull quote is presented. */
export const QUOTE_ARRANGEMENTS = [
  "oversized-mark", // a huge quotation glyph behind the text
  "rule-framed",    // rules above and below
  "knockout",       // inverted panel
  "margin-note",    // attribution set in the margin beside the quote
] as const;
export type QuoteArrangement = (typeof QUOTE_ARRANGEMENTS)[number];

/** WHERE a bookend's elements sit. Distinct from the blueprint's
 *  opening_move/closing_move, which describe the motion BEAT and say nothing
 *  about placement — which is why every brand opened with a centred wordmark.
 *
 *  MUST stay in lockstep with BOOKEND_ARRANGEMENTS in kit_vocabulary.py. */
export const BOOKEND_ARRANGEMENTS = [
  "centred-lockup",       // mark over wordmark, centred (the historical look)
  "corner-mark",          // small mark in a corner, type against the far edge
  "left-rail",            // full-height accent rail, content hung off it
  "full-bleed-statement", // no lockup; one statement bleeding to the edges
  "split-plate",          // two plates — mark on one, title on the other
  "stacked-baseline",     // everything bottom-aligned, upper frame left empty
] as const;
export type BookendArrangement = (typeof BOOKEND_ARRANGEMENTS)[number];

/** How a layout with no distinct content type is composed. Mirrors
 *  CONTENT_TYPE_VARIANTS["plain"]. */
export const PLAIN_ARRANGEMENTS = [
  "centered-focal",
  "asymmetric-split",
  "full-bleed-hero",
  "side-rail",
  "drop-cap",
] as const;
export type PlainArrangement = (typeof PLAIN_ARRANGEMENTS)[number];

/** Two-sided compositions. */
export const COMPARISON_ARRANGEMENTS = ["split", "stacked", "versus-bar"] as const;
export type ComparisonArrangement = (typeof COMPARISON_ARRANGEMENTS)[number];

/** How a code block is framed. */
export const CODE_ARRANGEMENTS = ["panel", "terminal"] as const;
export type CodeArrangement = (typeof CODE_ARRANGEMENTS)[number];

export interface KitVariant {
  stats: StatArrangement;
  list: ListArrangement;
  sequence: SequenceArrangement;
  quote: QuoteArrangement;
  /** The brand's opening and closing arrangement. */
  intro: BookendArrangement;
  outro: BookendArrangement;
  /** Content types the render kit could not previously vary, even though
   *  kit_vocabulary.py already listed arrangements for them. */
  plain: PlainArrangement;
  comparison: ComparisonArrangement;
  code: CodeArrangement;
  /** Surface for content cards. Set from the blueprint's `surface_default` when
   *  there is one, so a template's cards match the design it was given. */
  surface?: string;
  /** Decor system for scenes that paint their own backdrop (data-viz). */
  decor?: string;
}

/** What a template gets when no variant has been provided — the historical look,
 *  so an un-seeded render is unchanged rather than arbitrary. */
export const DEFAULT_VARIANT: KitVariant = {
  stats: "row",
  list: "markers",
  sequence: "vertical-rail",
  quote: "oversized-mark",
  intro: "centred-lockup",
  outro: "centred-lockup",
  plain: "centered-focal",
  comparison: "split",
  code: "panel",
};

// ─── Derivation ──────────────────────────────────────────────────────────────

/** FNV-1a — a small, fast, well-distributed string hash.
 *
 * Deliberately not `seededRand` (motion.ts): that is a sine-based float hash
 * built for jitter, and its low bits are not well distributed enough to index
 * short lists without clumping. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619, in 32-bit
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Derive a template's variant from a brand seed.
 *
 * Each axis is drawn from a different slice of the hash so the picks are
 * independent — deriving them all from `h % n` would correlate them, and two
 * brands that happened to collide on one axis would collide on all of them.
 */
export function variantFromSeed(
  seed: string,
  overrides?: Partial<KitVariant>,
): KitVariant {
  const h = hashString(seed || "");
  const pick = <T,>(list: readonly T[], divisor: number): T =>
    list[Math.floor(h / divisor) % list.length];

  return {
    stats: pick(STAT_ARRANGEMENTS, 1),
    list: pick(LIST_ARRANGEMENTS, 7),
    sequence: pick(SEQUENCE_ARRANGEMENTS, 53),
    quote: pick(QUOTE_ARRANGEMENTS, 397),
    // Divisors are PRIMES spread far apart, not successive powers of one base.
    // Both bookend lists have six entries, and 7 ^ 1 (mod 6), so consecutive
    // powers of 7 would make intro and outro track each other — measured at 5
    // of 10 brands landing on the same pair before this was changed.
    intro: pick(BOOKEND_ARRANGEMENTS, 2971),
    outro: pick(BOOKEND_ARRANGEMENTS, 21943),
    plain: pick(PLAIN_ARRANGEMENTS, 160231),
    comparison: pick(COMPARISON_ARRANGEMENTS, 1171733),
    code: pick(CODE_ARRANGEMENTS, 8543017),
    ...(overrides ?? {}),
  };
}
