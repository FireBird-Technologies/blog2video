# Design Philosophy

A pure-black cosmic canvas with drifting stars, glowing planets, and constellation lines — built on the exact NotestackAI design tokens for a seamless brand match.

---

# Layout Catalog

## How to choose and fill a layout (read first)

1. **Pick a layout only if its REQUIRED fields can be filled from this scene's own
   source text.** If they cannot, pick `text_narration` instead. Never choose a layout
   and then fill it with made-up content.
2. **REQUIRED fields must be present and real.** Take them from the narration or the
   article. Do not copy example text, do not write generic filler ("Key points",
   "Deep dive", "Learn more"), and do not invent facts, numbers, quotations, links,
   names or branches.
3. **OPTIONAL fields:** omit them when the source does not provide them. The renderer
   has no default text: an omitted optional field simply is not shown.
4. The pipeline supplies `accentColor`, `bgColor`, `textColor`, `aspectRatio`,
   `fontFamily` and `sceneDurationInFrames`. Never invent palette or timing values.
   `titleFontSize`, `descriptionFontSize` and `seed` are optional and normally left alone.

## cosmic_hero — Opening

Opening scene only. **Required:** `title`. **Optional:** `subtitle` (defaults to the
narration when omitted). No photograph.

## text_narration — Deep Space Narrative

The main layout for explanation, context and cause-and-effect. **Required:** `heading`
(3–8 words) and `body` (normally 45–80 words, 2–4 sentences) grounded in the narration;
do not shrink rich material to a tagline. **Optional:** a photograph, shown as a round
image beside the text. If the scene is a list, a quote, one number, or a table, use the
matching layout instead.

## split_image — Blended Image

A scene built around one supplied photograph. **Required:** `imageUrl` plus `heading`
and `body` from the narration. **Optional:** `ctaLabel` (omit to hide the pill). Use only
when a relevant image is supplied; otherwise use `text_narration`.

## stat_callout — Statistic

Use ONLY when the narration states one specific number. **Required:**
- `statValue`: the number itself, exactly as the source gives it (`98`, `4.2`, `2.5M`).
  It must be a number. Never a word, a range description, the title, or a placeholder.
- `descriptor`: one short line saying what the number measures, from the source.

**Optional:** `statSuffix` (the unit that follows the number: `%`, `K`, `M`, `B+`).
If the narration has no clear number, do NOT choose this layout; use `text_narration`.
No photograph.

## ringed_planet — Chapter

A chapter or section opener. **Required:** `heading`. **Optional:** `body` (one short
supporting sentence), and a photograph (full-bleed on the right; the planet and rings sit behind the image).

## rocket_launch — Transition

A forward-looking transition into the next idea. **Required:** `heading`. **Optional:**
`body` (one short line). No photograph.

## quote_card — Quote

Use ONLY for a real quotation present in the source. **Required:** `quote` — the exact
words quoted, never a paraphrase or summary. **Optional:** `attribution` (the real
speaker or source) and a photograph (half of the card). If the source has no direct
quotation, do not choose this layout.

## galaxy_deep_dive — Mind Constellation

Use this to turn ANY concept into a map: one central idea that can be broken into its parts, aspects, causes, steps, types or examples. It is the default choice for an explanatory scene about a topic, process, system or idea with more than one facet, and it should appear in most videos. The scene shows the whole map in one of four Notestack shapes (`mapStyle`: `orbit`, `spiral`, `figure`, `cluster`; the pipeline picks one per scene automatically, never set it yourself), zooms into the centre theme, then flies to ONE branch, where 2 or 3 child stars branch out of it, each with a short title and a short line of text. The camera stays there until the scene ends.

**Required:**
- `heading`: the central theme, 1-4 words, from the source.
- `nodes`: 3 to 8 objects, one per part or aspect of the central idea. Take them from what the scene's narration and the article say, or directly imply: if the source treats the idea as one block, split it into its natural components (for example what it is, why it matters, how it works, an example). Each has `label` (2-4 words). Do not add a branch that states a fact the source does not support. Only if the scene is a direct quotation, a single statistic or a data table, so there is nothing to break apart, choose another layout.

**One branch gets children:** put `children` on exactly one node: 2 or 3 objects `{label, text}`. `label` is 2-4 words; `text` is one short sentence of about 12 words (80 characters at most) that paraphrases the source. Pick the branch the narration discusses most. Never invent children; fewer than 2 real children means leave `children` out. Every other node has only a `label`. Do not use `value` or `sublabel`.

No photograph, no numbering, no cards. `items` (labels only) is accepted only when `nodes` is absent.

## data_visualisation — Data Constellation

Use ONLY when the scene is bound to a real chartable table from the source. **Required:**
the pipeline-bound `chartTable` (never generated numbers) and a `chartSummary` written
from the source. **Optional:** `chartType` (`auto`, `line`, `bar`, `histogram`),
`xAxisLabel`, `yAxisLabel` (default to the table headers), `chartYAxisTicks`.
No photograph.

## ticker_table — Mission Telemetry

Use ONLY for a real source table (rankings, comparisons, schedules, measured figures).
**Required:** `tickerTable` with `headers` and `rows` from the source — at most 20 rows and
6 columns; the first column is the row label. **Optional:** `tickerHighlightCol`
(zero-based, -1 for none; a numeric change column). Never invent rows. No photograph.

## ending_socials — Ending & Socials

Closing scene only. **Required:** at least one of: a real `websiteLink` with its
`ctaButtonText`, or an enabled `socials` entry with a real handle. **Optional:**
`brandName`, `tagline`, `showWebsiteButton`, `ctas` (up to three, each needs a real
nonempty `websiteLink`). Omit any platform or link that is not given. No photograph.

## Photography

Layouts that accept an optional `imageUrl`: `split_image`, `text_narration`,
`quote_card`, `ringed_planet`, `rocket_launch`. Every other layout
is image-free. Use only a relevant supplied image; omit it otherwise. Only `split_image`
shows the image as a full background. `imageFocusX` / `imageFocusY` (0–100) and
`imageZoom` (0.1–8) are saved by Adjust Image; preserve existing user adjustments.

Do not generate eyebrow labels or category microcopy above scene titles. No Starlit
layout displays them.

### text_narration — visual notes

The visual is a pure-black editorial deep-space field: one complete screen-spanning
constellation drifts behind a central reading band (`constellationStyle`: `web`, `figures`, `radial`, `river`, `mesh`; the pipeline picks one per scene automatically, never set it yourself). With a photograph the card narrows
and a large round photo straddles its edge. Never add decorative microcopy, coordinates,
plants or wireframe UI. Favour calm, continuous prose that rewards the visual build.
