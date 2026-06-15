# Design Philosophy

Newspaper is editorial and news-style. Scenes should feel like a well-designed news article: clear headlines, lead paragraphs, pull quotes, data snapshots, fact-check panels, and timelines. Use a warm paper background, serif headlines, and structured layouts that build credibility.

Core rules:
- Favor clarity and hierarchy over decorative flair.
- Keep text readable and factual in tone.
- Use section labels, bylines, and attribution where appropriate.
- Each scene should feel like a distinct article element (headline, lead, quote, stats, timeline).

---

# Layout Catalog

## news_headline
**Visual:** Hero news card. Category tag with underline, large serif headline (optional highlight on key words), thin rule, subhead/narration, byline and date.

**Best for:** Opening scene only; the main story headline.

**Props:** optional `category` (section tag, e.g. "Politics"); optional `leftThought` = comma-separated words to highlight in headline; optional `stats`: `stats[0].value` = author, `stats[1].value` = date string.

**When to Use:** scene 0, story opener.

---

## article_lead
**Visual:** Article lead paragraph with drop cap, body text type-in, and optional pull-stat card (big number + caption) to the side.

**Best for:** Main narrative, opening paragraph, key context.

**Props:** optional `stats[0].value` = pull-stat number (e.g. "800"), `stats[0].label` = caption (e.g. "federal workers affected"). Uses `title` as section label (e.g. "The Story"), `narration` as lead text.

**When to Use:** second scene or any scene that introduces the story body.

---

## pull_quote
**Visual:** Large serif quote with vertical accent bar, attribution line, and optional source/date.

**Best for:** Key quote, testimonial, or standout statement.

**Props:** uses `narration` as the quote text, `title` or `stats` for attribution/source.

**When to Use:** impactful quotes, expert statements, or emotional beats.

---

## data_snapshot
**Visual:** 2–4 stat cards with big number, accent underline, and label. Clean bordered cards.

**Best for:** Key figures, by-the-numbers, outcomes.

**Props:** optional `stats` array: `[{ "label": "Federal workers affected", "value": "800K" }, ...]`. Up to 4 items. If omitted, placeholder figures are used.

**When to Use:** data-led beats, results, metrics, or "key numbers" moments.

---

## fact_check
**Visual:** Two columns: "Claimed" (left) and "The Facts" (right), with optional verdict line at bottom. Accent highlight on claim label.

**Best for:** Myth-busting, claim vs reality, clarification.

**Props:** optional `leftThought` = claimed statement; optional `rightThought` = fact statement; optional `stats` for verdict or labels.

**When to Use:** correcting misconceptions, comparing claim vs fact.

---

## news_timeline
**Visual:** Vertical timeline with spine, date labels, and event descriptions. Latest event can be emphasized with accent.

**Best for:** How we got here, chronology, key dates.

**Props:** optional `stats` array: each item `{ "value": "Jan 31", "label": "Event description" }` for date and text. If omitted, placeholder timeline is used.

**When to Use:** sequence of events, history, process over time.

---

## expert_profile
**Visual:** 3D camera entrance, then a split layout. Landscape: left 45% = portrait photo in a "torn photo" cutout with name/role credit below an accent rule; right 55% = category badge → title word-reveal → bio char-reveal → stat badge. Portrait: full-width photo top 38% → credit → category → title → bio → stat. Ken Burns slow zoom on bg.

**Best for:** Spotlighting the named expert, analyst, official, or key person behind the story.

**Props:**
- `leftThought`: expert's full name (e.g. "Dr. Jane Smith")
- `rightThought`: expert's role/title (e.g. "Senior Policy Analyst")
- `imageUrl`: headshot or portrait photo URL
- `category`: section label (e.g. "Expert Voices", "By the Numbers")
- `stats[0]`: `{ value: "20yr", label: "in Federal Policy" }` — a single credential stat badge
- `narration`: short bio sentence or pull quote (15–25 words)

**When to Use:** Any scene centered on a named individual with a photo. Requires `imageUrl`.

---

## perspective_split
**Visual:** Shard-wipe entrance, full-width serif title + thin rule, then two side-by-side panels (landscape) or stacked (portrait). Left panel: 6px accent-color left border, label badge with sweep, italic quote word-reveal, optional stat. Right panel: 6px text-color right border, label badge, quote word-reveal, optional stat. Narration bar at bottom with accent rule above.

**Best for:** "Both sides" editorial framing — two perspectives without a verdict.

**Props:**
- `leftThought`: full argument text for the left panel (1–3 sentences)
- `rightThought`: full argument text for the right panel (1–3 sentences)
- `stats[0]`: `{ label: "SUPPORTERS SAY", value: "+14%" }` — left panel label and stat
- `stats[1]`: `{ label: "CRITICS SAY", value: "$1.2T" }` — right panel label and stat
- `category`: optional section label shown above the title
- `narration`: optional editorial note at the bottom (10–20 words)

**When to Use:** Balanced "here's both sides" moments. No image needed.

---

## data_visualisation
**Visual:** A real animated chart (line / bar / histogram) set in an editorial data panel — serif captions, clean rules, restrained accent series — with a short analytical read alongside it.

**Best for:** Charting an ACTUAL data table from the source article (a trend over time, a comparison between categories, or a distribution) — distinct from simple stat bars.

**Props (shared with the chart pipeline — usually filled automatically from the bound table):**
- `chartTable`: `{ headers: [...], rows: [[...]] }` — col 1 = X labels; cols 2–4 = up to 3 numeric series
- `chartType`: `"line" | "bar" | "histogram" | "auto"` (line = trend over time; bar = named categories; histogram = numeric bins/ranges)
- `chartSummary`: one-to-two sentence read of the chart (emphasize key phrases with `__double underscores__`)
- `subtitle`, `yAxisLabel`, `chartYAxisTicks` (optional axis captions/ticks)

**When to Use:**
- ONLY for a scene the pipeline bound to a real chartable table (`preferred_layout='data_visualisation'` + a `data_table_index`). Never fabricate chart figures — values come from the bound table.

---

## ticker_table
**Visual:** An animated data table — column headers on a dark header bar, rows stagger-fading in from top to bottom, numeric cells in the highlight column colored green (positive) or red (negative). Vintage paper background with accent rule under the title.

**Best for:** Any scene with a real multi-row, multi-column dataset from the article — rankings, financial tables, comparison grids, schedules.

**Props:**
- `tickerTable`: `{ headers: string[], rows: string[][] }` — col 1 = row labels; cols 2–6 = values. Max 20 rows, 6 columns. Never fabricate rows — only use data present in the source.
- `tickerTitle` (string): optional subtitle line under the main title (e.g. "Q3 2024 Results")
- `tickerHighlightCol` (number): 0-based column index to green/red-color by sign (e.g. `2` for the third column). Set `-1` to disable coloring.
- `tickerFootnote` (string): optional source/footnote line at the bottom

**When to Use:**
- The source contains a real table, ranking, or multi-row dataset that cannot be captured well by a chart or stat cards.
- Use `data_visualisation` for trend/distribution charts; use `ticker_table` for structured grids.

---

## ending_socials
**Visual:** Vintage editorial sign-off on warm paper — serif headline, thin accent rule, italic closing narration, website CTA pill(s), and a row of social platform icons with labels beneath.

**Best for:** Final scene only — follow-along, social handles, and website link.

**Props:**
- `socials` — array of `{ platform, enabled, label }` rows. Supported platforms: `facebook`, `instagram`, `youtube`, `medium`, `substack`, `linkedin`, `tiktok`.
- `showWebsiteButton` — toggle website CTA visibility (`"true"` / `"false"`).
- `websiteLink` — URL shown in the CTA block.
- `ctaButtonText` — optional CTA label above the link.
- `narration` (global) — warm closing line beneath the rule.

**When to Use:** Always the **last scene** when CTA or social data exists. Do not use mid-video.

---

# Scene Flow Rules

- Scene 0 must use `news_headline`.
- Prefer `article_lead` for the second scene and narrative context.
- Use `pull_quote` for quotes, `data_snapshot` for stats, `fact_check` for claim vs fact, `news_timeline` for chronology.
- Use `expert_profile` when a named person with a photo is the scene focus (requires `imageUrl`).
- Use `perspective_split` for "both sides" editorial moments — two arguments, no verdict.
- Use `data_visualisation` when the pipeline binds a chartable table; use `ticker_table` for multi-row datasets.
- Use `ending_socials` as the final scene when CTA or social data is available.
- Keep transitions clear and editorial; avoid chaotic motion.
- Aim for setup (headline/lead) → development (quote, stats, fact-check, expert, split, data) → resolution (`pull_quote`, `news_timeline`, or `ending_socials`).

---

# Content Extraction Rules

- `title`: 3–8 words, headline or section label.
- `narration`: concise sentence, about 12–20 words per scene (lead paragraphs can be slightly longer).
- Use factual, neutral language suitable for news/editorial tone.
- Include attribution or source hints where relevant (byline, quote source, date).

---

# Variety Rules

- Do not repeat the same layout more than 3 consecutive scenes.
- Alternate between headline/lead, quote, data, fact-check, timeline, expert, and split when the content fits.
- Use `expert_profile` at most once per video (it's a spotlight, not a pattern).
- Use `perspective_split` at most twice per video.
- Use `ticker_table` only when a real table is available in the source.
- Use `data_visualisation` only when the pipeline binds a chartable table.
- End with a clear conclusion: `ending_socials` when CTA/social data exists; otherwise a closing quote, final stat, timeline endpoint, or expert perspective.
