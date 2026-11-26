# Design Philosophy

A bright, cheerful winter day: a pale icy-blue sky, snowy hills and pine trees, and snow
falling in every scene. Santa, his sleigh and reindeer, a Christmas tree that decorates
itself, wrapped gifts, snowy ribbon banners and rolling snowballs carry the story. Titles are set
in a classic Christmas-card script (Berkshire Swash) and copy in a friendly rounded sans
(Nunito). The accent colour is Christmas red; pine green and gold are the fixed festive
partners. Every scene leaves in a gust of snow that whites out the frame.

Write warm, upbeat and concrete: short headings that fit on a wooden sign, friendly
sentences, no jargon. Keep the facts exactly as the source gives them.

---

# Layout Catalog

## Title and Display text are NOT layout props (read first)

Every scene's on-screen heading is the scene's own **Title**, and its on-screen copy is
the scene's own **Display text** (both set during script generation, separately from
the spoken voiceover narration). The renderer passes them into every layout itself.

- **Never** put `title`, `subtitle`, `heading`, `body`, `narration`, `displayText`,
  `chartSummary`, `tagline` or `brandName` in the layout props — not even a copy of the
  title or display text. Any such key is ignored, so writing it only wastes effort.
- Fill **layout-specific props only** (stats, list items, the quote, the two comparison
  sides, the steps, chart metadata, links, socials).
- Write the scene's Title and Display text so they read well in the chosen layout — each
  layout below says what they become on screen.

## How to choose and fill a layout

1. **Pick a layout only if its REQUIRED props can be filled from this scene's own
   source text or the article.** If they cannot, pick another layout that fits,
   choosing one the video has used least. Never choose a layout and then fill it with
   made-up content. This advice is for choosing only: **once a scene has been given a
   layout, keep it and fill every required prop** from the narration and the article.
   Never return empty props for it.
2. **REQUIRED props must be present and real.** Take them from the narration or the
   article. Do not copy example text, do not write generic filler ("Key points",
   "Deep dive", "Learn more"), and do not invent facts, numbers, quotations, links
   or names.
3. **OPTIONAL props:** omit them when the source does not provide them. The renderer
   has no default text: an omitted optional prop simply is not shown.
4. The pipeline supplies `accentColor`, `bgColor`, `textColor`, `aspectRatio`,
   `fontFamily` and `sceneDurationInFrames`. Never invent palette or timing values.
   `titleFontSize`, `descriptionFontSize` and `seed` are optional and normally left alone.
5. **Vary the layouts.** Never use the same layout for two scenes in a row, leave at
   least two other scenes between repeats where you can, and use most of the catalog.
   In a video of up to 15 scenes use `snowy_narration` at most twice and any other
   layout at most three times. `tree_list`, `snowball_steps` and `frosted_window` suit
   most scenes; a scene that states several facts is usually a `tree_list`.

## santa_hero — Santa's Sleigh

Opening scene only. Santa's sleigh and reindeer fly across a snowy sky and a
snow-capped wooden sign drops in. **On screen:** the Title on the sign (short and
festive, 3–8 words, never a full sentence) and, under it, the Display text (ONE short
line of at most 12 words that sharpens the title). **Layout props:** none. No photograph.

## snowy_narration — Snowman Story

For one explanation or piece of context that is not a list (at most two scenes in a
normal-length video, about 15% in a long one): a frosted panel on the
left holds the Title as the heading (3–8 words) and the Display text as the body
(normally 30–60 words, 2–4 sentences), while a snowman builds himself and waves on the
right. **Layout props:** optional photograph only — the snowman holds it up in a picture
frame. If the scene is a list, a quote, one number, a comparison, ordered steps or a
table, use the matching layout instead.

## frosted_window — Frosted Window

One idea beside a frosted cottage window with fairy lights. The window shows the scene's
photograph, or a snowy view when there is none. The Title is the heading and the Display text (20–50 words) is the
body on the frosted panel beside it. **Layout props:** all
optional: `imageUrl` (only a relevant supplied image) and `imageCaption` (a short real
caption, at most 6 words). Suits any scene that would otherwise be `snowy_narration`.

## gift_stat — Gift Stat

Use ONLY when the narration states 2 to 4 specific numbers. Each number rises out of a
gift box as its lid pops off and lands in the snow. The Title sits above the gifts and
the Display text (one or two short sentences, from the source, saying what the numbers
mean) below them.
**Required:**
- `stats`: ALWAYS 2 to 4 items (never fewer than 2, never more than 4)
  `{ "value": ..., "label": ... }` — `value` is the number exactly
  as the source gives it, with its unit (`98`, `37%`, `4.2`, `2.5M`, `$40B`). It must be a
  number. Never a word, a range description, the title, or a placeholder. `label` is
  optional: 1–3 words saying what the number counts.

If the narration has fewer than 2 clear numbers, do NOT choose this layout. No photograph.

## tree_list — Tree List

Use for 2–4 parallel points, tips or reasons. A Christmas tree grows and decorates itself
while each point hangs from it on a gift tag; beside it, a frosted card shows the Title
as the heading and the Display text (15–40 words, one or two sentences that frame the
list — not a repeat of the items). **Required:** `items` — ALWAYS 2 to 4 strings (never
more than 4) of at most 9 words each, taken from the source. If the source has more
points, keep the 4 most important. No photograph.

## letter_quote — Letter to Santa

Use ONLY for a real quotation present in the source. A red envelope opens, the letter
slides out and rests in front of it with the quote written on it, while a snowman
watches from the side; the Title is a small heading above the letter. **Required:** `quote` — the exact words quoted, never a
paraphrase (at most ~35 words). **Optional:** `attribution` (the real speaker or source).
If the source has no direct quotation, do not choose this layout. No photograph.

## snow_compare — Snow Compare

Use when the scene contrasts exactly two things (before/after, myth/fact, option A/B,
pros/cons). Two columns face each other under the Title, each headed by its column
title on a snowy ribbon banner; the points are paired row by row, so each left point
opposes the right point on the same row. **Required:** `leftLabel`, `leftPoints`,
`rightLabel`, `rightPoints` — each column title 1–3 words; each points list ALWAYS 3 to
4 short strings (never fewer than 3, never more than 4, at most 8 words each), the
same number on both sides, in matching order. Use the whole article, not only the
narration, to find them (who, when, where, why, meaning). The points are facts and
ideas: never describe a picture (no lighting, rooms, clothing or mood). Once a scene has
this layout it ALWAYS carries both column titles and 3 to 4 points on each side.
No photograph.

## snowball_steps — Snowball Steps

Use for 2 or 3 ordered steps, stages or dated timeline points. A snowman points as
each step rolls in along the ground as a numbered snowball, with its label and text
shown above it, under the Title. **Required:** `steps` — ALWAYS 2 or 3 items (never
more than 3) `{ "label": ..., "text": ... }` in order, where `label` is 1–3 words or a
date and `text` is 6–16 words, all from the source. If the source has more steps, keep
the 3 most important. Use `tree_list` instead when the points have no order. No
photograph.

## data_visualisation — Snowy Chart

Use ONLY when the scene is bound to a real chartable table from the source. The chart
hangs on a snowy wooden sign: bars are candy canes, lines are strings of fairy lights.
The Title and the Display text (a one- or two-sentence read of the chart, from the
source) sit on the frosted panel beside it. **Required:** the pipeline-bound `chartTable`
(never generated numbers). **Optional:** `chartType` (`auto`, `line`, `bar`,
`histogram`), `xAxisLabel`, `yAxisLabel` (default to the table headers),
`chartYAxisTicks`. No photograph.

## ending_socials — Santa's Farewell

Closing scene only: Santa waves beside a lit tree. The Title is the big closing line on
a hanging sign and the Display text (optional, one short line) sits under it.
**Layout props — required:** at least one of: a real `websiteLink` with its
`ctaButtonText` (the CTA label, shown on a gift tag), or an enabled `socials` entry with
a real handle (shown on a hanging bauble). **Optional:** `showWebsiteButton`, `ctas` (up
to three, each needs a real nonempty `websiteLink` and its `ctaButtonText`). Omit any
platform or link that is not given. No photograph.

## Photography

Layouts that accept an optional `imageUrl`: `frosted_window` and
`snowy_narration`. Every other layout is image-free. Use only a relevant supplied image;
omit it otherwise. `imageFocusX` / `imageFocusY` (0–100) and `imageZoom` (0.1–8) are
saved by Adjust Image; preserve existing user adjustments.

Do not generate eyebrow labels or category microcopy above scene titles.
