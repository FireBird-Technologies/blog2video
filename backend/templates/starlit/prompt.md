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

Opening scene only. **Required:** `title` — short and punchy, 3–8 words (never a full
sentence). **Required:** `subtitle` — ONE short line of at most 12 words that sharpens
the title. Keep the hero sparse: no lists, no extra detail. No photograph.

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

Choose this whenever the scene has real content that can be split into a central idea and its parts: the narration or source text discusses one topic and says something about 3 or more distinct aspects, causes, steps, types or examples of it. Use it for explanatory scenes like that; do not restrict it to a few per video. Do NOT choose it for a scene with no such content (a bare intro, a transition, a single sentence or a single fact): use `text_narration` there. Never choose it and then pass empty or placeholder props.

The scene shows the whole map in one of four Notestack shapes (`mapStyle`: `orbit`, `spiral`, `figure`, `cluster`; the pipeline picks one per scene automatically, never set it yourself), zooms into the centre theme, then flies to ONE branch, where 2 or 3 child stars branch out of it, each with a short title and a short line of text.

**Every prop is built 100% from this scene's own content. Nothing is invented, generic or empty.**
- `heading`: the central theme, 1-4 words, taken from the content.
- `nodes`: 3 to 8 objects. Split the scene's content into its relevant parts, one node per part, in the order the content presents them. Each `label` (2-4 words) is a word or short phrase from the content naming that part. No empty labels, no filler like "Overview", "Key points" or "More".
- `children`: on exactly one node, the branch the content discusses most, give 2 or 3 objects `{label, text}`. `label` is 2-4 words from the content; `text` is one short sentence (about 12 words, 80 characters at most) that paraphrases what the content says about that part. Every child must be filled with real content; if the content gives fewer than 2 real children for any branch, leave `children` out entirely rather than padding. Every other node has only a `label`. Do not use `value` or `sublabel`.

If you cannot fill `heading` and at least 3 `nodes` entirely from the content, choose `text_narration` instead.

No photograph, no numbering, no cards. `items` (labels only) is accepted only when `nodes` is absent.

**Worked example** (shows the SHAPE only — the words below belong to this sample scene; never copy or reuse them, fill every field from your own scene's content):
```json
{ "layout": "galaxy_deep_dive", "title": "How a Rocket Reaches Orbit",
  "narration": "A rocket reaches orbit in three stages. First, the booster burns for about two and a half minutes to climb out of the thick lower atmosphere. Then the second stage ignites and pushes the payload up to orbital speed. Finally, the fairing opens and the payload is released into its orbit.",
  "layout_props_json": { "heading": "Reaching Orbit",
    "nodes": [
      { "label": "Booster burn",
        "children": [
          { "label": "Climb phase", "text": "The booster burns for about two and a half minutes." },
          { "label": "Thick air", "text": "It lifts the rocket out of the dense lower atmosphere." }
        ] },
      { "label": "Second stage" },
      { "label": "Payload release" }
    ] } }
```
Every label and sentence above comes straight from that narration; nothing is generic, padded or empty. If the narration did not support 3 nodes, the correct choice would have been `text_narration`.

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
