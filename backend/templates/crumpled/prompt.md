# Design Philosophy

A sheet of crumpled white paper fills every frame, its creases catching a slowly moving
light. Everything on it is drawn in pencil: handwritten titles and body copy in one
handwritten font (Caveat), graphite underlines, scribbled circles, arrows and ticks, with a
single red pencil (the accent colour) for emphasis. Photos are taped down as prints, lists
are torn scraps, quotes are strips torn from another page, and charts are sketched on
graph paper. Between scenes the paper itself moves — it tears, rips, folds away,
crumples into a ball, or tears into three strips — the middle falling away
while the sides roll up.

Write like someone jotting notes: short, warm, concrete sentences. Keep headings short
enough to be handwritten in one or two lines.

---

# Layout Catalog

## How to choose and fill a layout (read first)

1. **Pick a layout only if its REQUIRED fields can be filled from this scene's own
   source text.** If they cannot, pick `sketch_narration` instead. Never choose a layout
   and then fill it with made-up content.
2. **REQUIRED fields must be present and real.** Take them from the narration or the
   article. Do not copy example text, do not write generic filler ("Key points",
   "Deep dive", "Learn more"), and do not invent facts, numbers, quotations, links
   or names.
3. **OPTIONAL fields:** omit them when the source does not provide them. The renderer
   has no default text: an omitted optional field simply is not shown.
4. The pipeline supplies `accentColor`, `bgColor`, `textColor`, `aspectRatio`,
   `fontFamily` and `sceneDurationInFrames`. Never invent palette or timing values.
   `titleFontSize`, `descriptionFontSize` and `seed` are optional and normally left alone.
5. Vary the layouts across the video — avoid using the same layout for more than two
   scenes in a row.

## paper_hero — Opening

Opening scene only. A crumpled paper ball unfolds into the title page. **Required:**
`title` — short and punchy, 3–8 words (never a full sentence). **Required:** `subtitle` —
ONE short line of at most 12 words that sharpens the title. No photograph.

## sketch_narration — Sketch Narration

The main layout for explanation, context and cause-and-effect: a notebook page with the
heading pencilled on and the body written line by line. **Required:** `heading` (3–8 words)
and `body` (normally 40–75 words, 2–4 sentences) grounded in the narration. **Optional:** a
photograph, taped beside the text. If the scene is a list, a quote, one number, a
comparison or a table, use the matching layout instead.

## taped_image — Taped Image

A scene built around one supplied photograph, taped onto the sheet with a pencil arrow
pointing at it. **Required:** `imageUrl` plus `heading` and `body` (25–55 words) from the
narration. **Optional:** `imageCaption` (a short real caption). Use only when a relevant
image is supplied; otherwise use `sketch_narration`.

## pencil_stat — Pencil Stat

Use ONLY when the narration states 1 to 3 specific numbers. The numbers count up on the
left, each circled in pencil; one body text explaining them sits on the right.
**Required:**
- `stats`: 1 to 3 items `{ "value": ... }` — each the number exactly as the source gives it,
  with its unit (`98`, `37%`, `4.2`, `2.5M`, `$40B`). It must be a number. Never a word, a
  range description, the title, or a placeholder.
- `body`: one or two short sentences, from the source, saying what the numbers mean.

If the narration has no clear number, do NOT choose this layout. No photograph.

## sticky_list — Sticky List

Use for 3–4 parallel points, steps, tips or reasons. Each point is a torn paper scrap; all of
them are stuck onto the sheet at once and get a pencil tick. **Required:** `heading` and
`items` — ALWAYS 3 or 4 strings (never fewer than 3, never more than 4) of at most 8 words
each, taken from the source. **Optional:** `body` — one or two short sentences shown under the
heading (if omitted, the scene's display text is shown). No photograph.

## torn_quote — Torn Quote

Use ONLY for a real quotation present in the source. **Required:** `quote` — the exact
words quoted, never a paraphrase (at most ~30 words). **Optional:** `attribution` (the real
speaker or source). If the source has no direct quotation, do not choose this layout.
No photograph.

## fold_comparison — Fold Comparison

Use when the scene contrasts exactly two things (before/after, myth/fact, option A/B,
pros/cons). The sheet unfolds into two panels. **Required:** `heading`, `leftLabel`,
`leftText`, `rightLabel`, `rightText` — each label 1–4 words, each text 12–35 words, all
from the source. No photograph.

## data_visualisation — Pencil Chart

Use ONLY when the scene is bound to a real chartable table from the source. The chart is
sketched in pencil on graph paper. **Required:** the pipeline-bound `chartTable` (never
generated numbers) and a `chartSummary` written from the source. **Optional:** `chartType`
(`auto`, `line`, `bar`, `histogram`), `xAxisLabel`, `yAxisLabel` (default to the table
headers), `chartYAxisTicks`. No photograph.

## ending_socials — Ending & Socials

Closing scene only: a pencilled thank-you note. **Required:** at least one of: a real
`websiteLink` with its `ctaButtonText`, or an enabled `socials` entry with a real handle.
**Optional:** `brandName`, `tagline`, `showWebsiteButton`, `ctas` (up to three, each needs
a real nonempty `websiteLink`). Omit any platform or link that is not given. No photograph.

## Photography

Layouts that accept an optional `imageUrl`: `taped_image` (required there) and
`sketch_narration`. Every other layout is image-free. Use only a relevant supplied image;
omit it otherwise. `imageFocusX` / `imageFocusY` (0–100) and `imageZoom` (0.1–8) are saved
by Adjust Image; preserve existing user adjustments.

Do not generate eyebrow labels or category microcopy above scene titles.
