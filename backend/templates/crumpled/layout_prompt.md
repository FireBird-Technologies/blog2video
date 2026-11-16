# crumpled — Layout Catalog

Use this list when picking the `preferred_layout` for each scene.

## Title and Display text are NOT layout props (read first)

Every scene's on-screen heading is the scene's own **Title**, and its on-screen copy is
the scene's own **Display text** (both set during script generation, separately from
the spoken voiceover narration). The renderer passes them into every layout itself.

- **Never** put `title`, `subtitle`, `heading`, `body`, `narration`, `displayText`,
  `chartSummary`, `tagline` or `brandName` in the layout props — not even a copy of the
  title or display text. Any such key is ignored, so writing it only wastes effort.
- Fill **layout-specific props only** (stats, list items, the quote, the two comparison
  panels, chart metadata, links, socials).
- Write the scene's Title and Display text so they read well in the chosen layout — each
  layout below says what they become on screen.

## How to choose and fill a layout

1. **Pick a layout only if its REQUIRED props can be filled from this scene's own
   source text.** If they cannot, pick `sketch_narration` instead. Never choose a layout
   and then fill it with made-up content.
2. **REQUIRED props must be present and real.** Take them from the narration or the
   article. Do not copy example text, do not write generic filler ("Key points",
   "Deep dive", "Learn more"), and do not invent facts, numbers, quotations, links
   or names.
3. **OPTIONAL props:** omit them when the source does not provide them. The renderer
   has no default text: an omitted optional prop simply is not shown.
4. The pipeline supplies `accentColor`, `bgColor`, `textColor`, `aspectRatio`,
   `fontFamily` and `sceneDurationInFrames`. Never invent palette or timing values.
   `titleFontSize`, `descriptionFontSize` and `seed` are optional and normally left alone.
5. Vary the layouts across the video — avoid using the same layout for more than two
   scenes in a row.

## paper_hero — Opening

Opening scene only. A crumpled paper ball unfolds into the title page.
**On screen:** the Title (short and punchy, 3–8 words, never a full sentence) and,
under it, the Display text (ONE short line of at most 12 words that sharpens the title).
**Layout props:** none. No photograph.

## sketch_narration — Sketch Narration

The main layout for explanation, context and cause-and-effect: a notebook page with the
Title pencilled on as the heading (3–8 words) and the Display text written line by line
as the body (normally 40–75 words, 2–4 sentences). **Layout props:** optional photograph
only, taped beside the text. If the scene is a list, a quote, one number, a comparison or
a table, use the matching layout instead.

## taped_image — Taped Image

A scene built around one supplied photograph, taped onto the sheet with a pencil arrow
pointing at it; the Title is the heading and the Display text (25–55 words) is the body.
**Required:** `imageUrl`. **Optional:** `imageCaption` (a short real caption). Use only
when a relevant image is supplied; otherwise use `sketch_narration`.

## pencil_stat — Pencil Stat

Use ONLY when the narration states 1 to 3 specific numbers. The numbers count up on the
left, each circled in pencil; the Display text (one or two short sentences, from the
source, saying what the numbers mean) sits on the right under the Title.
**Required:**
- `stats`: 1 to 3 items `{ "value": ... }` — each the number exactly as the source gives it,
  with its unit (`98`, `37%`, `4.2`, `2.5M`, `$40B`). It must be a number. Never a word, a
  range description, the title, or a placeholder.

If the narration has no clear number, do NOT choose this layout. No photograph.

## sticky_list — Sticky List

Use for 3–4 parallel points, steps, tips or reasons. The Title is the heading and the
Display text (one or two short sentences) is written under it; each point is a torn paper
scrap, all stuck onto the sheet at once with a pencil tick. **Required:** `items` — ALWAYS
3 or 4 strings (never fewer than 3, never more than 4) of at most 8 words each, taken from
the source, and not repeating the Display text. No photograph.

## torn_quote — Torn Quote

Use ONLY for a real quotation present in the source. **Required:** `quote` — the exact
words quoted, never a paraphrase (at most ~30 words). **Optional:** `attribution` (the real
speaker or source). If the source has no direct quotation, do not choose this layout.
No photograph.

## fold_comparison — Fold Comparison

Use when the scene contrasts exactly two things (before/after, myth/fact, option A/B,
pros/cons). The sheet unfolds into two panels under the Title. **Required:** `leftLabel`,
`leftText`, `rightLabel`, `rightText` — each label 1–4 words, each text 12–35 words, all
from the source. No photograph.

## data_visualisation — Pencil Chart

Use ONLY when the scene is bound to a real chartable table from the source. The chart is
sketched in pencil on graph paper; the Title and the Display text (a one- or two-sentence
read of the chart, from the source) are written beside it. **Required:** the
pipeline-bound `chartTable` (never generated numbers). **Optional:** `chartType`
(`auto`, `line`, `bar`, `histogram`), `xAxisLabel`, `yAxisLabel` (default to the table
headers), `chartYAxisTicks`. No photograph.

## ending_socials — Ending & Socials

Closing scene only: a pencilled thank-you note. The Title is the big closing line and the
Display text (optional, one short line) is written under it. **Layout props — required:**
at least one of: a real `websiteLink` with its `ctaButtonText` (the CTA button label), or
an enabled `socials` entry with a real handle. **Optional:** `showWebsiteButton`, `ctas`
(up to three, each needs a real nonempty `websiteLink` and its `ctaButtonText`). Omit any
platform or link that is not given. No photograph.

## Photography

Layouts that accept an optional `imageUrl`: `taped_image` (required there) and
`sketch_narration`. Every other layout is image-free. Use only a relevant supplied image;
omit it otherwise. `imageFocusX` / `imageFocusY` (0–100) and `imageZoom` (0.1–8) are saved
by Adjust Image; preserve existing user adjustments.

Do not generate eyebrow labels or category microcopy above scene titles.
