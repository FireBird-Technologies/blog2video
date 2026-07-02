# Design Philosophy

An authentic print-editorial magazine template. Cream/white paper, high-contrast serif display headlines, a book-serif body, and a single editorial red accent. Every page carries newsstand furniture — an inset keyline border, a running head (issue • section) over a hairline rule, and a page folio at the foot. The look is predominantly typographic — strong headlines, decks, standfirsts, key-point lists, pull quotes, figures and Q&A carry most scenes on words alone. Four layouts (`feature`, `colorblock`, `text_narration`, `timeline_journey`) will *additionally* show an editorial photo when the project supplies imagery — set as a framed plate, a hero panel or an embedded page background. Images are assigned automatically from the project's image pool, so you NEVER emit an image field; just keep writing the full copy for every layout (the page reflows gracefully whether or not a photo is present). All other layouts stay photo-free. Default palette is white background, near-black ink, red accent.

---

# Copy Density — give the page enough to read

This is an editorial magazine, not a poster, and the body copy is ORIGINAL magazine writing — not a transcript of the voiceover. Do NOT paste the narration onto the page. Write each scene the way a feature writer would: open on something concrete — a scene, a moment, a person, a telling number — rather than an abstract thesis; carry it through a specific, reported middle; and land on a confident editorial judgement. Reach for the texture of real magazine prose: a strong lede, vivid specifics, named voices where the source gives them, a little narrative momentum. Active voice; precise, plain-but-confident English; no filler, and no aphorisms, platitudes or fortune-cookie lines.

- **Give it enough text to fill the page.** A few tight paragraphs of real prose — roughly 60–110 words for a standard body field, a little more for a feature opener — so the page reads full and considered, never a lone line stranded in white space. Compose proper sentences, not bullet fragments or captions.
- **ALWAYS emit every field a layout marks REQUIRED — no exceptions.** Each of these layouts leaves dead white space unless its secondary fields are filled, so you MUST populate them on EVERY scene of that layout, even when the source is thin. They are not optional embellishments — an `interview_qa` with only one exchange is incorrect output. The fields and their required minimums:
  - `interview_qa` → `exchanges` with **2–3** full question/answer pairs, each answer a paragraph (3–5 sentences). Always at least two; prefer three.
  - `colorblock` → fill the accent panel's label stack: `panelLabel`, `panelHeading`, `panelSubline` and `panelTag` (plus a strong `leftQuote`). The right panel reads as empty if these are blank.
  - `feature` → a full `body` (60–110+ words of original feature prose, flowing across BOTH pages) **+** `keyPoints` (2–3 short takeaways). The facing page reads as half-empty if the body is too short to fill both columns.
  - `text_narration` → `points` with **at least 2** (prefer 3–6) separate field-notes. A single lone bullet reads as broken — never emit exactly one; if the beat only supports one point, use `editorial_quote` or `colorblock` instead.
- **When the source is thin, DISTIL — do not pad and do not fabricate.** Always produce the required fields by distilling what the source genuinely supports: derive `keyPoints` from the points already made in the body, write the `standfirst` as a tight summary of the material, and base each `exchange` answer on real content. NEVER invent figures, names, dates or quotes to fill space.
- **Two-page (folded) spreads must fill BOTH leaves.** `interview_qa` opens across the binding as a two-page spread — both sides are visible at once. Write substantial, *balanced* copy for each side; never leave one leaf nearly empty.
- **Stay grounded.** The *voice* is the Economist's; the *facts* are the source's. Build the prose only from what the narration/source actually supports. Write editorially around the real material; don't fabricate substance to hit a length.

---

# Reserved prop names — never name a layout prop `title`

The scene's main **Title** and **Display text** are top-level scene fields and are unchanged — keep filling them exactly as before. Separately, `title` (and `narration`) is a RESERVED key inside `layout_props_json`: the renderer maps the scene's main Title onto it, so any `title` you write in `layout_props_json` collides with, and may be overridden by, that main Title.

Therefore, when a layout needs to carry its OWN on-screen copy or attributes in `layout_props_json`, give that key a layout-specific name — **never `title`**. Every layout below already names its own props (e.g. `quoteText`, `headline`, `leftQuote`, `panelHeading`); use those exact keys. Do NOT invent a `title` (or any generic `title`-like) key inside `layout_props_json`.

---

# Layout Catalog

---

## magazine_cover
**Visual:** A typographic cover. An enormous serif cover line is set huge across the top and reveals word-by-word; a kicker, a red rule and an italic deck (from `narration`) sit bottom-left. No image.

**Props:**
  - `title` (string) — The cover line, set huge in serif and revealed word-by-word
  - `titleFontSize` (number) — Override for the cover-line size

**When to Use:** The opening title card / cover of the piece — **Scene 0 only**.

**Avoid When:** You need body paragraphs or data — this is a single cover line plus a deck. **Never use it on any scene after the first** — the cover is the opener only.

---

## editorial_quote
**Visual:** A pull-quote page: a large serif italic statement anchored lower-left with an oversized quotation-mark watermark, a vertical accent rail, and a tracked uppercase attribution line beneath.

**Props:**
  - `quoteText` (string) — **REQUIRED.** The pull-quote text itself (revealed word-by-word). This IS the on-screen statement — write the full quote here. (Do NOT name this key `title`.)
  - `attribution` (string) — **REQUIRED.** The source/credit line, e.g. `"— Jane Smith, CEO"`. Always emit it; it is the only other copy on the page.
  - `titleFontSize` (number) — Quote size override

The quote (`quoteText`) and `attribution` are the ONLY copy shown on this page — the scene's narration / display text is NOT rendered here. Put the entire pull quote in `quoteText` and the credit in `attribution`; do not rely on the narration to supply either.

**When to Use:** A standout pull quote, key insight, or emotional beat between sections.

**Avoid When:** The quote is very long or needs supporting detail.

---

## colorblock
**Visual:** A two-panel color-block spread whose blocks animate in one after another. A solid ink (dark) left block carries a short uppercase serif statement opened by a red quotation mark; a solid red (accent) right block holds a centred label stack — small-caps label, a short rule, a serif heading, an italic subline and a small inverted tag chip. When the scene has an assigned photo, the right block becomes a hero image with the label stack floating over an accent scrim — so always write the full label stack regardless.

**Props:**
  - `leftQuote` (string) — The short bold statement on the dark panel (revealed word-by-word); falls back to `title`. Keep it punchy — one or two clauses, not a paragraph.
  - `panelLabel` (string) — Small-caps kicker on the accent panel, e.g. `"Expert Profile"`
  - `panelHeading` (string) — Centred serif heading, e.g. a name or short title
  - `panelSubline` (string) — Italic line under the heading, e.g. a role or descriptor
  - `panelTag` (string) — Small inverted chip beneath the subline, e.g. `"Editor Since 2014"`
  - `titleFontSize` (number) — Quote size override

**When to Use:** A bold profile, spotlight or statement beat — pairing a striking quote with a named person/role or a labelled callout.

**Avoid When:** The content needs running body copy or supporting detail — use the `feature` or `editorial_quote` layouts instead.

---

## feature
**Visual:** A feature-article spread. A red section kicker, a serif headline whose last word turns italic with a short red rule beneath, then a justified two-column body that inks in word-by-word, led by a large red drop cap. A ghosted folio number and a vertical section mark sit on the facing page, and a row of key-points runs along the bottom of both pages. When the scene has an assigned photo the spread turns asymmetric — headline + a single-column body on the left leaf, a full-height framed plate on the right; otherwise the body fills both leaves. Write the full `body` either way.

**Props:**
  - `title` (string) — The headline (last word renders italic)
  - `body` (text) — Original feature prose, 60–110+ words, flowing across BOTH pages in two balanced columns. Open on something concrete — a scene, a moment, a person, a number — as a feature lede; its first letter becomes the red drop cap. Falls back to `narration` if omitted.
  - `keyPoints` (object_array) — 2–3 short takeaways (≤10 words each), each with a `value`; shown along the bottom of both pages.
  - `sectionLabel` (string) — Red small-caps kicker, e.g. `"FEATURE"`
  - `titleFontSize` / `descriptionFontSize` (number) — Headline / body size overrides

**When to Use:** A feature-article opener or any long-form editorial beat that carries a substantial paragraph of reported prose plus a few takeaways.

**Avoid When:** The scene is a single statistic, a pull quote, or a thin transitional line — use `by_the_numbers`, `editorial_quote` or `text_narration`.

---

## comparison
**Visual:** A two-column "Before / After" spread split by a centre hairline with a circular accent badge ("VS") on the binding. Each column is a tracked uppercase header — left in red accent, right in ink — over a short list of square-bulleted points that fade in one by one. The serif headline sits across the top.

**Props:**
  - `title` (string) — The headline, e.g. `"Before and After"`
  - `leftHeader` (string) — Left column label, e.g. `"Before"`
  - `rightHeader` (string) — Right column label, e.g. `"After"`
  - `leftPoints` (object_array) — 2–6 short bullets (≤10 words each), each with a `value`, for the left side
  - `rightPoints` (object_array) — 2–6 short bullets (≤10 words each), each with a `value`, for the right side
  - `vsLabel` (string) — Optional centre badge text; defaults to `"VS"`
  - `titleFontSize` / `descriptionFontSize` (number) — Headline / body size overrides

**When to Use:** A before/after, two-perspective, or "VS" contrast beat where the two sides are best read as crisp parallel lists.

**Avoid When:** The contrast is a paragraph-length dialogue (use `interview_qa`), a charted dataset (use `magazine_data_visualization`), or a structured grid (use `magazine_ticker`).

---

## by_the_numbers
**Visual:** A "By the Numbers" kicker and red rule, then a short editorial heading (and optional standfirst line) framing the metrics, and beneath it a grid of oversized accent figures — each counting up on entry — separated by hairlines, each with a short accent rule and a tracked uppercase label beneath it.

**Props:**
  - `title` (string) — **Required.** A short editorial heading for the metrics (≤ ~6 words), tied to the scene's actual subject — e.g. `"The Numbers Behind the Launch"`, `"By the Box Office"`. This sits above the figures and anchors the page; do NOT leave it as the generic "By the Numbers".
  - `subtitle` (string) — Optional. One short standfirst line (≤ ~14 words) framing what the figures show. Omit entirely if there is nothing substantive to add — never pad it.
  - `stats` (object_array) — **Required. 2–4 items only.** Each item must have `value` (a numeric string, e.g. `"4.2B"`, `"98%"`, `"$12B"`, `"150+"`) and `label` (a short uppercase descriptor, e.g. `"Monthly Readers"`). The numeric portion of `value` animates (counts up). **Do not pass text, sentences, or non-numeric values here.**
  - `descriptionFontSize` (number) — Optional. Scales the figure size.

**When to Use:** Exactly when a scene is best expressed as 2–4 key numeric metrics — statistics, KPIs, milestones as figures. Every `value` must contain a number.

**Avoid When:** The content is text-heavy, a single statistic, a pull quote, or the "values" are words rather than numbers — use `editorial_quote`, `text_narration`, or `feature` instead. **If the source contains no numeric figures for this beat, do NOT select `by_the_numbers` — never fabricate figures; use `text_narration`, `feature`, or `editorial_quote` instead.** More than 4 stats: drop the least important or use `magazine_ticker`.

---

## interview_qa
**Visual:** An "In Conversation · Name — Organisation" kicker over alternating question/answer blocks separated by hairline rules — the classic print Q&A page. Questions in bold serif, answers in book serif. Holds **two or three** exchanges so the page reads full.

**Props:**
  - `leftSpeaker` (string) — Interviewee name (used in the kicker)
  - `rightSpeaker` (string) — Their role/organisation (used in the kicker)
  - `exchanges` (object_array) — **REQUIRED — always emit 2–3 (prefer 3).** An array of question/answer exchanges, each `{ "q": "<question>", "a": "<answer>" }`. Write a fresh, specific question for each and give every answer a full, paragraph-length reply (**3–5 sentences**), grounded in the source — not one-liners. Always emit at least two; three substantial exchanges fill the page. Never emit a single exchange.
  - `leftQuote` / `rightQuote` (text) — *Legacy fields only. Do NOT use for new scenes — always use `exchanges` instead.*
  - `descriptionFontSize` (number) — Quote size override

**When to Use:** Interviews, debates, two perspectives, or Q&A dialogue. Use `exchanges` with 2–3 full exchanges so the conversation fills the page rather than leaving it sparse.

**Avoid When:** More than three exchanges are needed in one scene — split across scenes.

**Worked example:**
```json
{ "layout": "interview_qa", "title": "In Conversation",
  "narration": "We sat down with the team behind the redesign.",
  "layout_props_json": { "leftSpeaker": "Mara Voss", "rightSpeaker": "Art Director",
    "exchanges": [
      { "q": "Where does a redesign actually begin?", "a": "It begins long before anything is drawn. We spend weeks just reading the magazine as a reader would, noting where the eye stumbles and where it glides. Only once we understand the rhythm of the existing pages do we let ourselves touch the grid." },
      { "q": "What was the hardest constraint?", "a": "Type, always. A magazine lives or dies on its body text, and the temptation is to make it expressive. We resisted that. The headline can sing; the body must simply disappear into the reading." },
      { "q": "And how do you know when it's finished?", "a": "You never quite do. But there is a moment when a spread stops feeling designed and starts feeling inevitable — as if it could not have been any other way. That is the signal to stop." }
    ] } }
```

---

## magazine_data_visualization
**Visual:** A red kicker and serif title, a red rule, then a single chart drawn as a print figure on the paper — hairline grid, accent series (animated line+area, grouped bars, or histogram bins) — beside a serif insight paragraph.

**Props (filled automatically from the bound table):**
  - `title` (string) — Heading
  - `chartTable` (chart_table) — `{ headers: string[], rows: string[][] }`; col 1 = X labels, cols 2–4 = up to 3 numeric series (max 20 rows). Values come from the bound table — never invent figures.
  - `chartType` (string) — `'auto'` / `'line'` / `'bar'` / `'histogram'`. Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges (0–10, <5, 50+).
  - `chartSummary` (string) — Insight paragraph beside the chart; auto-generated from the data when omitted
  - `yAxisLabel` / `subtitle` (string) — Y-axis label and X-axis caption overrides
  - `barPrimaryColor` / `barSecondaryColor` (color) — series colors

**When to Use:** ONLY for a scene the pipeline bound to a chartable table (`preferred_layout='magazine_data_visualization'` + a `data_table_index`).

**Avoid When:** No real chartable table is bound — use `by_the_numbers` for a few key figures or `magazine_ticker` for a structured grid.

---

## timeline_journey
**Visual:** A vertical chronology — a drawn red rule with milestone dots, each paired with an accent serif date and a serif label, reading top-to-bottom. When the scene has an assigned photo it is embedded as a faint full-bleed page background behind the chronology, which stays fully legible on top.

**Props:**
  - `title` (string) — Heading
  - `narration` (string) — Optional standfirst beneath the title
  - `milestones` (object_array) — Up to 6 items, each with a date (`value`), a `label`, and an optional one-line `desc` detail (a short clause expanding the label, drawn from the source — do not invent)

**When to Use:** Chronology, history, roadmap, process steps.

**Avoid When:** Non-chronological content or more than 6 milestones.

---

## text_narration
**Visual:** A "Field Notes" index page: a red kicker, a large serif headline, a red rule, then a ledger of bulleted notes — one red-bulleted line per note. When the scene has an assigned photo, a framed field-plate sits under the headline rule and the notes ledger reflows below (a couple fewer notes show).

**Props:**
  - `sectionLabel` (string) — Red kicker and running-head section; defaults to `"Analysis"`
  - `headline` (string) — **REQUIRED.** The serif headline for this page. (Do NOT name this key `title`.)
  - `points` (object_array) — **REQUIRED. At least 2 — prefer 3–6 — short field-notes (≤14 words each), each `{ "value": "<note>" }`.** Each entry renders as its own red-bulleted line. **NEVER emit a single note — one lone bullet reads as broken.** If the beat genuinely supports only one point, use a different layout (`editorial_quote` or `colorblock`) instead of `text_narration`. Emit SEPARATE array entries — do NOT join items with `•` (or any character) inside a single string, and do not cram the whole list into one entry.
  - `narration` (string) — The spoken voiceover for this beat. Used as a fallback (sentence-split into notes) ONLY when `points` is omitted; always prefer `points`.

The headline (`headline`) and the notes (`points`) are this layout's own on-screen copy — populate BOTH for every text_narration scene. Do not leave them empty expecting the page to reuse another field; the page renders exactly what you emit here.

**When to Use:** Narration-only beats, chapter intros, transitional commentary, or a short set of key takeaways.

**Avoid When:** The scene would benefit from figures (`by_the_numbers`) or a two-sided comparison. Also avoid when the beat supports only ONE point — a single bullet looks broken; use `editorial_quote` or `colorblock` instead.

**Worked example:**
```json
{ "layout": "text_narration", "title": "A Working Theory of Print",
  "narration": "The studios betting on print are chasing attention, not paper.",
  "layout_props_json": { "sectionLabel": "ESSAY", "headline": "A Working Theory of Print",
    "points": [
      { "value": "Rejects generic stock footage for purpose-built visuals" },
      { "value": "Generates real diagrams and labelled flowcharts from input" },
      { "value": "Renders syntax-highlighted code blocks with accurate structure" },
      { "value": "Animates data contextually, not decoratively" }
    ] } }
```

---

## ending_socials
**Visual:** A masthead/colophon closing page: a large serif sign-off, a centred red rule, an italic deck, the social handles, and optional red CTA labels with their URLs beneath.

**Props:**
  - `title` (string) — Sign-off headline (defaults to "Thank You")
  - `narration` (string) — Optional italic deck
  - `socials` (array) — Social platform entries rendered as icons
  - `ctaButtonText` (string) / `websiteLink` (string) — Single CTA label + URL
  - `ctas` (object_array) — Up to 3 CTA cards (overrides the single CTA)
  - `showWebsiteButton` (boolean) — Hide the CTA when `false`

**When to Use:** Outro, sign-off, social handles, call to action.

**Avoid When:** There is no social presence or site to promote.

---

## magazine_ticker
**Visual:** An editorial ledger drawn on the paper: a red kicker and serif title, then a table with a red header band and hairline grid. Rows reveal in sequence; one column can be colour-coded by value (green positive / red negative).

**Props (filled automatically from the bound table):**
  - `title` (string) — Heading
  - `tickerTitle` (string) — Kicker above the title, e.g. `"Q1 2026 Performance"`
  - `tickerTable` (ticker_table) — `{ headers: string[], rows: string[][] }`; col 1 = row labels, cols 2–6 = values. Max 20 rows, 6 columns. Never fabricate rows — use only data from the source.
  - `tickerHighlightCol` (number) — Zero-based column to colour-code by sign; `-1` disables
  - `tickerFootnote` (string) — Italic footnote; falls back to `narration`

**When to Use:** ONLY for a scene the pipeline bound to a ticker-like table (`preferred_layout='magazine_ticker'` + a `data_table_index`) — tabular data, results, rankings, financials.

**Avoid When:** The data is better shown as a chart (`magazine_data_visualization`) or a few big figures (`by_the_numbers`).
