# Design Philosophy

Newspaper is editorial and news-style. Scenes should feel like a well-designed news article: clear headlines, lead paragraphs, pull quotes, data snapshots, fact-check panels, and timelines. Use a warm paper background, serif headlines, and structured layouts that build credibility.

Core rules:
- Favor clarity and hierarchy over decorative flair.
- Keep text readable and factual in tone.
- Use section labels, bylines, and attribution where appropriate.
- Each scene should feel like a distinct article element (headline, lead, quote, stats, timeline).
- Every layout must use **only** the prop names defined in this catalog; unknown keys are ignored downstream.
- **Always** populate `layout_props_json` with the layout-specific keys listed below when content supports them — do not leave structured layouts with `{}` if the narration contains extractable data.
- **Do not** put `titleFontSize` or `descriptionFontSize` in `layout_props_json`. Those are UI defaults from `meta.json` and are not set by the scene generator.
- Global scene fields `title` and `narration` are **not** `layout_props_json` keys — they are set separately on every scene.

**Prop naming reminders (same key, different meaning per layout):**
- On `news_headline`: `leftThought` = comma-separated **highlight words** in the headline — not a person's name or panel argument.
- On `expert_profile`: `leftThought` = expert **name**, `rightThought` = expert **role/title**.
- On `perspective_split`: `leftThought` = left panel **argument text**, `rightThought` = right panel **argument text**.
- On `fact_check`: `leftThought` = **claimed** statement, `rightThought` = **factual** correction.

---

# Layout Catalog

## news_headline
**Visual:** Hero news card. Category tag with underline, large serif headline (optional highlight on key words), thin rule, subhead/narration, byline and date.

**Best for:** Opening scene only; the main story headline.

**Props (put in `layout_props_json`):**
- `category` (string) — section tag, e.g. `"Politics"`
- `leftThought` (string) — comma-separated words to **highlight** in the headline, e.g. `"government,funding"`
- `stats` (array, up to 2) — byline rows: `stats[0].value` = author, `stats[1].value` = date string

Example:
```json
{
  "category": "Politics",
  "leftThought": "shutdown,deadline",
  "stats": [
    { "value": "By Staff Reporter", "label": "" },
    { "value": "March 2026", "label": "" }
  ]
}
```

**When to Use:** scene 0, story opener.

---

## article_lead
**Visual:** Article lead paragraph with drop cap, body text type-in, and optional pull-stat card (big number + caption) to the side.

**Best for:** Main narrative, opening paragraph, key context.

**Props (put in `layout_props_json`):**
- `stats` (array, 1 item) — pull-stat card: `stats[0].value` = big number (e.g. `"800K"`), `stats[0].label` = caption (e.g. `"federal workers affected"`)

Uses global `title` as section label (e.g. `"The Story"`), global `narration` as lead text.

Example:
```json
{
  "stats": [{ "value": "800K", "label": "federal workers affected" }]
}
```

**When to Use:** second scene or any scene that introduces the story body.

---

## pull_quote
**Visual:** Large serif quote with vertical accent bar, attribution line, and optional source/date.

**Best for:** Key quote, testimonial, or standout statement.

**Props (put in `layout_props_json`):**
- `stats` (array, 1 item) — attribution/source: `stats[0].label` = source name (e.g. `"The Editorial Desk"`)

Uses global `narration` as the quote text, global `title` for optional headline above the quote.

Example:
```json
{
  "stats": [{ "label": "Sen. Jane Smith", "value": "" }]
}
```

**When to Use:** impactful quotes, expert statements, or emotional beats.

---

## data_snapshot
**Visual:** 2–4 stat cards with big number, accent underline, and label. Clean bordered cards.

**Best for:** Key figures, by-the-numbers, outcomes.

**Props (put in `layout_props_json`):**
- `stats` (array, 2–4 items) — each `{ "label": "Human label", "value": "Big number" }`

Example:
```json
{
  "stats": [
    { "label": "Federal workers affected", "value": "800K" },
    { "label": "Days without pay", "value": "34" },
    { "label": "States impacted", "value": "12" }
  ]
}
```

**When to Use:** data-led beats, results, metrics, or "key numbers" moments.

---

## fact_check
**Visual:** Two columns: "Claimed" (left) and "The Facts" (right), with optional verdict line at bottom. Accent highlight on claim label.

**Best for:** Myth-busting, claim vs reality, clarification.

**Props (put in `layout_props_json`):**
- `leftThought` (string) — the **claim** to check
- `rightThought` (string) — the **factual** correction
- `stats` (array, up to 2) — optional column labels: `stats[0].label` = left header, `stats[1].label` = right header

Example:
```json
{
  "leftThought": "The policy will cut taxes for everyone immediately.",
  "rightThought": "Most households would not see relief until the following fiscal year.",
  "stats": [
    { "label": "CLAIMED" },
    { "label": "THE FACTS" }
  ]
}
```

**When to Use:** correcting misconceptions, comparing claim vs fact.

---

## news_timeline
**Visual:** Vertical timeline with spine, date labels, and event descriptions. Latest event can be emphasized with accent.

**Best for:** How we got here, chronology, key dates.

**Props (put in `layout_props_json`):**
- `stats` (array, up to 5 items) — each `{ "value": "Date label", "label": "Event description" }`

Example:
```json
{
  "stats": [
    { "value": "Jan 15", "label": "Bill introduced in committee" },
    { "value": "Feb 3", "label": "Hearing draws record turnout" },
    { "value": "Mar 1", "label": "Vote scheduled on floor" }
  ]
}
```

**When to Use:** sequence of events, history, process over time.

---

## expert_profile
**Visual:** 3D camera entrance, then a split layout. Landscape: left 45% = portrait photo in a "torn photo" cutout with name/role credit below an accent rule; right 55% = category badge → title word-reveal → bio char-reveal → stat badge. Portrait: full-width photo top 38% → credit → category → title → bio → stat. Ken Burns slow zoom on bg.

**Best for:** Spotlighting the named expert, analyst, official, or key person behind the story.

**Props (put in `layout_props_json` — required when using this layout):**
- `leftThought` (string) — expert's **full name**, e.g. `"Dr. Jane Smith"`
- `rightThought` (string) — expert's **role/title**, e.g. `"Senior Policy Analyst"`
- `category` (string) — section label, e.g. `"Expert Voices"`
- `stats` (array, **exactly 1** item) — credential badge: `{ "value": "20yr", "label": "in Federal Policy" }`
- `imageUrl` (string) — headshot or portrait photo URL (**required**; scene will look empty without it)

Uses global `title` as the scene headline (word-reveal), global `narration` as short bio (15–25 words).

Example:
```json
{
  "category": "Expert Voices",
  "leftThought": "Dr. Jane Smith",
  "rightThought": "Senior Policy Analyst",
  "stats": [{ "value": "20yr", "label": "in Federal Policy" }],
  "imageUrl": "https://example.com/headshot.jpg"
}
```

**When to Use:** Any scene centered on a named individual with a photo. **Always** set `leftThought`, `rightThought`, and `imageUrl`.

---

## perspective_split
**Visual:** Shard-wipe entrance, full-width serif title + thin rule, then two side-by-side panels (landscape) or stacked (portrait). Left panel: 6px accent-color left border, label badge with sweep, italic quote word-reveal, optional stat. Right panel: 6px text-color right border, label badge, quote word-reveal, optional stat. Narration bar at bottom with accent rule above.

**Best for:** "Both sides" editorial framing — two perspectives without a verdict.

**Props (put in `layout_props_json` — required when using this layout):**
- `leftThought` (string) — full argument for the **left** panel (1–3 sentences)
- `rightThought` (string) — full argument for the **right** panel (1–3 sentences)
- `stats` (array, **exactly 2** items):
  - `stats[0]`: `{ "label": "SUPPORTERS SAY", "value": "+14%" }` — left panel heading + stat
  - `stats[1]`: `{ "label": "CRITICS SAY", "value": "$1.2T" }` — right panel heading + stat
- `category` (string, optional) — section label above the title

Uses global `title` as the full-width headline, global `narration` as optional editorial note at the bottom (10–20 words).

Example:
```json
{
  "category": "The Debate",
  "leftThought": "This policy creates opportunity and drives long-term economic growth for working families.",
  "rightThought": "The costs are too high and the benefits too uncertain to justify moving forward now.",
  "stats": [
    { "label": "SUPPORTERS SAY", "value": "+14%" },
    { "label": "CRITICS SAY", "value": "$1.2T" }
  ]
}
```

**When to Use:** Balanced "here's both sides" moments. **Always** set `leftThought`, `rightThought`, and both `stats` rows. No image.

---

## data_visualisation
**Visual:** A real animated chart (line / bar / histogram) set in an editorial data panel — serif captions, clean rules, restrained accent series — with a short analytical read alongside it.

**Best for:** Charting an ACTUAL data table from the source article (a trend over time, a comparison between categories, or a distribution) — distinct from simple stat bars.

**Props (put in `layout_props_json` — chart table is usually filled by the pipeline from the bound source table):**
- `chartType`: `"line" | "bar" | "histogram" | "auto"` (line = trend over time; bar = named categories; histogram = numeric bins)
- `chartSummary` (string) — one-to-two sentence read of the chart; emphasize key phrases with `__double underscores__`
- `subtitle`, `yAxisLabel`, `chartYAxisTicks` (optional axis captions/ticks)
- `chartTable` — **do not fabricate**; the pipeline overrides this from the embedded table when `data_table_index` is set

Example (analytical props only — figures come from the bound table):
```json
{
  "chartType": "line",
  "chartSummary": "Revenue climbed __steadily__ after Q2, peaking in November.",
  "subtitle": "Fiscal year 2025",
  "yAxisLabel": "Revenue ($B)"
}
```

**When to Use:**
- ONLY for a scene the pipeline bound to a real chartable table (`preferred_layout='data_visualisation'` + a `data_table_index`). Never fabricate chart figures — values come from the bound table.

---

## ticker_table
**Visual:** An animated data table — column headers on a dark header bar, rows stagger-fading in from top to bottom, numeric cells in the highlight column colored green (positive) or red (negative). Vintage paper background with accent rule under the title.

**Best for:** Any scene with a real multi-row, multi-column dataset from the article — rankings, financial tables, comparison grids, schedules.

**Props (put in `layout_props_json`):**
- `tickerTable`: `{ "headers": string[], "rows": string[][] }` — col 1 = row labels; cols 2–6 = values. Max 20 rows, 6 columns. **Never fabricate rows** — only use data from the source or embedded table.
- `tickerTitle` (string) — subtitle under the main title, e.g. `"Q3 2024 Results"`
- `tickerHighlightCol` (number) — 0-based column index for green/red sign coloring (e.g. `2`); use `-1` to disable
- `tickerFootnote` (string) — source/footnote line at the bottom

Example:
```json
{
  "tickerTitle": "Key figures at a glance",
  "tickerTable": {
    "headers": ["Category", "Value", "Change"],
    "rows": [
      ["Revenue", "1,240M", "+4.2%"],
      ["Operating cost", "980M", "-1.8%"],
      ["Net margin", "21%", "+0.6pp"]
    ]
  },
  "tickerHighlightCol": 2,
  "tickerFootnote": "Source: company filing, Q3 2024"
}
```

**When to Use:**
- The source contains a real table, ranking, or multi-row dataset that cannot be captured well by a chart or stat cards.
- Use `data_visualisation` for trend/distribution charts; use `ticker_table` for structured grids.

---

## ending_socials
**Visual:** Vintage editorial sign-off on warm paper — serif headline, thin accent rule, italic closing narration, website CTA pill(s), and a row of social platform icons with labels beneath.

**Best for:** Final scene only — follow-along, social handles, and website link.

**Props (put in `layout_props_json`):**
- `socials` (array) — rows `{ "platform": "instagram", "enabled": "true", "label": "@handle or URL" }`. Supported platforms: `facebook`, `instagram`, `youtube`, `medium`, `substack`, `linkedin`, `tiktok`. Set `enabled` to `"false"` for platforms not mentioned in the source.
- `showWebsiteButton` — `"true"` or `"false"` (string)
- `websiteLink` (string) — URL for the CTA block
- `ctaButtonText` (string, optional) — short CTA label above the link

Uses global `narration` as the warm closing line beneath the rule.

Example:
```json
{
  "showWebsiteButton": "true",
  "websiteLink": "https://example.com",
  "ctaButtonText": "Read the full story",
  "socials": [
    { "platform": "instagram", "enabled": "true", "label": "@newsdesk" },
    { "platform": "youtube", "enabled": "true", "label": "youtube.com/@newsdesk" },
    { "platform": "linkedin", "enabled": "false", "label": "LinkedIn" }
  ]
}
```

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

**Global fields (every scene):**
- `title`: 3–8 words, headline or section label.
- `narration`: concise sentence, about 12–20 words per scene (lead paragraphs can be slightly longer).
- Use factual, neutral language suitable for news/editorial tone.
- Include attribution or source hints where relevant (byline, quote source, date).

**Per layout (`layout_props_json`):**
- **`news_headline`:** Extract section `category`, highlight words into `leftThought` (comma-separated), author/date into `stats` rows — do not put the byline only in `narration`.
- **`article_lead`:** Pull the standout number into `stats[0]` when the lead mentions a key figure.
- **`pull_quote`:** Put attribution in `stats[0].label`; keep the quote itself in global `narration`.
- **`data_snapshot`:** Map every cited figure to a `stats` row (`label` + `value`); output 2–4 rows when the source supports it.
- **`fact_check`:** Split claim vs correction into `leftThought` / `rightThought`; never swap them.
- **`news_timeline`:** One `stats` row per dated event; preserve chronological order.
- **`expert_profile`:** **Required:** `leftThought` = name, `rightThought` = role, `imageUrl` = photo URL, `stats[0]` = one credential badge. Put the bio in global `narration`, not in `leftThought`.
- **`perspective_split`:** **Required:** both panel arguments in `leftThought` / `rightThought`, both panel labels/stats in `stats[0]` and `stats[1]`. Do not put panel text only in `narration`.
- **`data_visualisation`:** Set `chartType` and `chartSummary` from the narrative; never invent `chartTable` rows.
- **`ticker_table`:** Copy table headers/rows from the source into `tickerTable`; set `tickerHighlightCol` to the change/% column when present.
- **`ending_socials`:** Populate `socials` with only platforms mentioned in the source; warm close in global `narration`.

**Grounding:** If the source does not support a layout's required props, choose a simpler layout instead of inventing figures or names.

---

# Variety Rules

- Do not repeat the same layout more than 3 consecutive scenes.
- Alternate between headline/lead, quote, data, fact-check, timeline, expert, and split when the content fits.
- Use `expert_profile` at most once per video (it's a spotlight, not a pattern).
- Use `perspective_split` at most twice per video.
- Use `ticker_table` only when a real table is available in the source.
- Use `data_visualisation` only when the pipeline binds a chartable table.
- End with a clear conclusion: `ending_socials` when CTA/social data exists; otherwise a closing quote, final stat, timeline endpoint, or expert perspective.
