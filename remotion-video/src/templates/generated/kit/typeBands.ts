/**
 * The type-size bands, and the one place a stored size is clamped.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The Remotion CLI render has no API access, so these numbers cannot be served
 * at runtime — a compile-time copy is unavoidable. There are therefore exactly
 * TWO authorities, this file and the Python one
 * (backend/app/services/code_generator.py), and a backend test parses this file
 * and asserts they are equal. That test is the anti-drift mechanism; if you
 * change a number here and it is not mirrored in Python, CI fails.
 *
 * TWO BANDS, TWO JOBS — do not conflate them:
 *
 *   TYPE_BANDS  the GENERATION bands. What the scene generator may bake into a
 *               component as its `?? <literal>` fallback, and the range
 *               `_compute_scene_font_defaults` may produce. Narrow on purpose:
 *               a generated default has to look right with no human in the loop.
 *   USER_BANDS  the USER bands. The editor's slider range, and the only clamp
 *               applied to a size a PERSON stored on a scene. Wide on purpose:
 *               a user who wants a 180px title is not making a mistake, and a
 *               slider that stops mattering at 88 is a dead slider.
 *
 * These used to be one map, which meant the read-time clamp silently capped
 * every deliberate choice at the generator's ceiling.
 *
 * WHICH SIZE DRIVES WHAT — this depends on the template's design version, and
 * it is the part that is easy to get backwards:
 *
 *   v3 and later (two tiers, no eyebrow):
 *     props.titleFontSize        -> props.sceneTitle  (the scene TITLE, its
 *                                   main label and largest type)
 *     props.descriptionFontSize  -> props.displayText AND every content prop,
 *                                   label, caption and kicker. Everything else.
 *     props.sceneTitleFontSize   -> not emitted, not read.
 *
 *   v1/v2 (three tiers — historical, still rendering):
 *     props.titleFontSize        -> props.displayText (named for history, not
 *                                   for what it sizes)
 *     props.descriptionFontSize  -> body copy, bullets, metrics, …
 *     props.sceneTitleFontSize   -> props.sceneTitle, as a small eyebrow
 *
 * The eyebrow tier is retained below because v1/v2 scenes still store and read
 * `sceneTitleFontSize`; v3 simply never produces one.
 *
 * PORTRAIT IS SMALLER THAN LANDSCAPE in the generation bands. That is the
 * opposite of the usual convention: the portrait canvas is 1080 wide against
 * landscape's 1920, so the same point size eats nearly twice the line. The user
 * bands are orientation-independent — a person dragging a slider is looking at
 * the result and does not need guard rails per canvas.
 */

export type Orientation = "landscape" | "portrait";

/** [floor, ceiling] per tier per orientation. Mirrors the Python bands. */
export const TYPE_BANDS: Record<
  "headline" | "body" | "eyebrow",
  Record<Orientation, readonly [number, number]>
> = {
  headline: { landscape: [48, 88], portrait: [36, 60] },
  body: { landscape: [28, 44], portrait: [26, 38] },
  eyebrow: { landscape: [22, 44], portrait: [20, 38] },
};

/**
 * What a PERSON may set, via the editor's sliders.
 *
 * Deliberately far wider than TYPE_BANDS and deliberately the same in both
 * orientations. Mirrors `_USER_BANDS` in Python; the parity test checks both
 * maps.
 */
export const USER_BANDS: Record<
  "title" | "description",
  Record<Orientation, readonly [number, number]>
> = {
  title: { landscape: [10, 200], portrait: [10, 200] },
  description: { landscape: [10, 100], portrait: [10, 100] },
};

/**
 * The title:body ratio the scene contract asks for (rule 7c).
 *
 * Used to derive a body size from a title size, so the editor can offer ONE
 * control without letting the body outgrow the title — an inverted hierarchy is
 * a defect the validator rejects at generation time, and a slider should not be
 * able to create by hand what the generator forbids.
 */
export const HEADLINE_BODY_RATIO: Record<Orientation, number> = {
  landscape: 2.2,
  portrait: 1.7,
};

export function clampToBand(
  value: number | undefined,
  tier: keyof typeof TYPE_BANDS,
  orientation: Orientation,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  const [lo, hi] = TYPE_BANDS[tier][orientation];
  return Math.min(hi, Math.max(lo, Math.round(value)));
}

/** The same clamp against the wide USER bands — for values a person chose. */
export function clampToUserBand(
  value: number | undefined,
  tier: keyof typeof USER_BANDS,
  orientation: Orientation,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  const [lo, hi] = USER_BANDS[tier][orientation];
  return Math.min(hi, Math.max(lo, Math.round(value)));
}

/**
 * Body size implied by a title size, clamped into the description USER band.
 *
 * User band, not generation band: this backs an editor control, so it has to be
 * able to follow a title the user dragged to 200. Clamping it to the 28-44
 * generation band made the derived body size stick at 44 for every title above
 * ~97px, which read as the coupling being broken.
 */
export function bodySizeForHeadline(
  headline: number,
  orientation: Orientation,
): number {
  const derived = Math.round(headline / HEADLINE_BODY_RATIO[orientation]);
  return clampToUserBand(derived, "description", orientation) ?? USER_BANDS.description[orientation][0];
}

/**
 * Resolve the type sizes a scene receives, clamped to the USER bands.
 *
 * Called by BOTH the exported render (GeneratedVideo.tsx) and the project
 * preview (VideoPreview.tsx). Those two prop-assembly blocks are required to
 * stay byte-identical; a clamp written inline in each would drift, so it lives
 * here and both call the same function.
 *
 * `designVersion` decides whether an eyebrow size is produced at all. A v3 scene
 * has two type tiers and never reads `sceneTitleFontSize`, so deriving one would
 * be a number nothing renders. A v1/v2 scene does read it, and gets the stored
 * value or a fraction of the headline as before.
 */
/**
 * Which of the two sizes a PERSON set, as opposed to inheriting from the
 * template's stored defaults.
 *
 * Both arrive at a scene as the same prop, so the scene cannot tell them apart —
 * but the distinction decides whether FitText may overrule the number. A
 * generated default is a guess about copy nobody had seen, and the box should
 * win; a value a user dragged a slider to while looking at the frame should be
 * rendered literally.
 *
 * Read from the scene's OWN layoutConfig, before the template defaults are
 * merged under it. That ordering is the whole signal: the defaults fill keys the
 * user has not set, so a key present in the raw config is one they did.
 */
export function resolveTypeExactness(
  storedConfig:
    | { titleFontSize?: unknown; descriptionFontSize?: unknown }
    | null
    | undefined,
): { titleIsExact: boolean; descriptionIsExact: boolean } {
  const isSet = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;
  return {
    titleIsExact: isSet(storedConfig?.titleFontSize),
    descriptionIsExact: isSet(storedConfig?.descriptionFontSize),
  };
}

export function resolveTypeSizes(
  config:
    | {
        titleFontSize?: unknown;
        descriptionFontSize?: unknown;
        sceneTitleFontSize?: unknown;
      }
    | null
    | undefined,
  orientation: Orientation,
  designVersion?: number,
): {
  titleFontSize: number | undefined;
  descriptionFontSize: number | undefined;
  sceneTitleFontSize: number | undefined;
} {
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;

  const titleFontSize = clampToUserBand(num(config?.titleFontSize), "title", orientation);
  const descriptionFontSize = clampToUserBand(
    num(config?.descriptionFontSize),
    "description",
    orientation,
  );

  // v3 has no eyebrow tier. Producing a size for a prop no v3 scene reads would
  // be dead data, and the ambient EyebrowSizeProvider would size labels that
  // rule 7 now binds to descriptionFontSize.
  if ((designVersion ?? 1) >= 3) {
    return { titleFontSize, descriptionFontSize, sceneTitleFontSize: undefined };
  }

  const storedEyebrow = clampToBand(num(config?.sceneTitleFontSize), "eyebrow", orientation);
  const derivedEyebrow =
    titleFontSize !== undefined
      ? clampToBand(Math.round(titleFontSize * 0.38), "eyebrow", orientation)
      : undefined;

  return {
    titleFontSize,
    descriptionFontSize,
    sceneTitleFontSize: storedEyebrow ?? derivedEyebrow,
  };
}

/**
 * Whether the second of two text fields merely repeats the first, and so should
 * be dropped rather than painted.
 *
 * PREFIX, not equality. The guard this replaces tested exact case-insensitive
 * equality, which real data almost never satisfies: a scene titled "Smarter
 * Conversations Start Here" alongside display text "Smarter conversations start
 * here. Discover AI that adapts to you." passed the guard and painted the same
 * sentence twice — once small, once large. Titles are routinely the opening
 * clause of the display text, so the prefix relation is the one that matters.
 *
 * WHICH FIELD SURVIVES is the caller's decision and it flips with the design
 * version: v1/v2 keeps the displayText headline and drops the eyebrow; v3 keeps
 * the TITLE — it is the scene's main label — and drops the display text. This
 * function only answers "do these two say the same thing".
 */
export function eyebrowRepeatsHeadline(
  eyebrow: string | undefined | null,
  headline: string | undefined | null,
): boolean {
  const e = (eyebrow || "").trim().toLowerCase();
  const h = (headline || "").trim().toLowerCase();
  if (!e || !h) return false;
  // Compare on letters and digits only, so punctuation and spacing differences
  // ("Start Here" vs "start here.") do not defeat the check.
  const norm = (s: string) => s.replace(/[^a-z0-9]+/g, " ").trim();
  const en = norm(e);
  const hn = norm(h);
  if (!en) return false;
  return hn === en || hn.startsWith(en + " ");
}
