# Design Philosophy

An authentic print-editorial magazine template. Cream/white paper, high-contrast serif display headlines, a book-serif body, and a single editorial red accent. Every page carries newsstand furniture — an inset keyline border, a running head (issue • section) over a hairline rule, and a page folio at the foot. The look is purely typographic — strong headlines, decks, standfirsts, key-point lists, pull quotes, figures and Q&A carry each scene on words. No photographs. Default palette is white background, near-black ink, red accent.

---

# Copy Density — give the page enough to read

This is an editorial magazine, not a poster, and the body copy is ORIGINAL magazine writing — not a transcript of the voiceover. Do NOT paste the narration onto the page. Write each scene the way a feature writer would: open on something concrete — a scene, a moment, a person, a telling number — rather than an abstract thesis; carry it through a specific, reported middle; and land on a confident editorial judgement. Reach for the texture of real magazine prose: a strong lede, vivid specifics, named voices where the source gives them, a little narrative momentum. Active voice; precise, plain-but-confident English; no filler, and no aphorisms, platitudes or fortune-cookie lines.

- **Give it enough text to fill the page.** A few tight paragraphs of real prose — roughly 60–110 words for a standard body field, a little more for a feature opener — so the page reads full and considered, never a lone line stranded in white space. Compose proper sentences, not bullet fragments or captions.
- **ALWAYS emit every field a layout marks REQUIRED — no exceptions.** Each of these layouts leaves dead white space unless its secondary fields are filled, so you MUST populate them on EVERY scene of that layout, even when the source is thin. They are not optional embellishments — a `feature_spread` without `keyPoints`, an `interview_qa` with only one exchange, or a `comparison_spread` with only one side filled is incorrect output. The fields and their required minimums:
  - `feature_spread` → `body` (4–7 sentences of on-page article copy) **+** `standfirst` (one line) **+** `keyPoints` (2–3 items). All three, every time.
  - `interview_qa` → `exchanges` with **2–3** full question/answer pairs, each answer a paragraph (3–5 sentences). Always at least two; prefer three.
  - `comparison_spread` → balanced `leftPoints` **+** `rightPoints` (3–5 short bullets each), every time. Keep the two sides roughly equal in length.
- **When the source is thin, DISTIL — do not pad and do not fabricate.** Always produce the required fields by distilling what the source genuinely supports: derive `keyPoints` and `comparison_spread` bullets from the points already made in the body, write the `standfirst` as a tight summary of the material, and base each `exchange` answer on real content. NEVER invent figures, names, dates or quotes to fill space.
- **Two-page (folded) spreads must fill BOTH leaves.** `feature_spread`, `comparison_spread` and `interview_qa` open across the binding as a two-page spread — both sides are visible at once. Write substantial, *balanced* copy for each side; never leave one leaf nearly empty.
- **Stay grounded.** The *voice* is the Economist's; the *facts* are the source's. Build the prose only from what the narration/source actually supports. Write editorially around the real material; don't fabricate substance to hit a length.

---

# Layout Catalog

---

## magazine_cover
**Visual:** A typographic cover. An enormous serif cover line is set huge across the top and reveals word-by-word; a kicker, a red rule and an italic deck (from `narration`) sit bottom-left. No image.

**Props:**
  - `title` (string) — The cover line, set huge in serif and revealed word-by-word
  - `titleFontSize` (number) — Override for the cover-line size

**When to Use:** The opening title card / cover of the piece.

**Avoid When:** You need body paragraphs or data — this is a single cover line plus a deck.

---

## feature_spread
**Visual:** The workhorse feature page. A red kicker label, a large serif headline, an italic standfirst deck with a red side-rule, then the body set in justified multi-column type (two columns in landscape) led by an oversized red drop cap. A ruled list of key-point takeaways fills the lower band of the page so it reads full, never thin.

**Props:**
  - `sectionLabel` (string) — Red kicker above the headline and the running-head section; defaults to `"Feature"`
  - `title` (string) — Serif headline
  - `body` (string) — **REQUIRED.** The on-page article copy, set as justified multi-column prose; its first character becomes the drop cap. Write **4–7 full sentences (≈70–120 words)** of original editorial writing for this beat — not a caption and not a copy of the voiceover. This is the main copy that fills both columns; make it substantial, never leave it thin. Goes in `layout_props_json`.
  - `narration` (string) — The spoken voiceover for the beat. It may be shorter or worded differently from the on-page `body`; do not simply duplicate `body` here.
  - `standfirst` (string) — **REQUIRED — always emit.** A single-line italic deck (≤16 words) stating the article's sub-thesis — the one sentence a reader would skim. Distil it from the source; never omit it.
  - `keyPoints` (object_array) — **REQUIRED — always emit 2–3.** An array of **2–3** short takeaway points (≤8 words each), distilled from the points already in the body, in the Economist voice. Each item is `{ "value": "<point>" }`. Never pad with filler and never leave it empty — if the source is thin, distil what is there.
  - `titleFontSize` / `descriptionFontSize` (number) — Size overrides

**When to Use:** The default and fallback layout — any explanatory prose beat (main narrative, feature body, story setup). Supply a full paragraph of `body`, a `standfirst` and 2–3 `keyPoints` so the whole page fills.

**Avoid When:** Content is a single line with no supporting detail.

**Worked example:**
```json
{ "layout": "feature_spread", "title": "The central bank's hardest year",
  "narration": "After two years of forceful tightening, the Federal Reserve now faces a far more delicate task: easing without reigniting the inflation it fought so hard to tame.",
  "layout_props_json": { "sectionLabel": "BRIEFING",
    "body": "After two years of forceful tightening, the Federal Reserve faces its most delicate task yet: easing policy without reigniting the inflation it fought so hard to tame. The data now point in opposite directions. Hiring has cooled and manufacturing has stalled, yet services inflation remains stubbornly warm. Cut too soon, and a second wave of price rises could undo three years of work; wait too long, and the real economy may buckle under the most restrictive rates since 2007. Every meeting now carries the weight of a decision that will shape the next decade of growth.",
    "standfirst": "Cut too soon and inflation returns; wait too long and growth buckles.",
    "keyPoints": [ { "value": "Hiring has cooled sharply" }, { "value": "Core inflation near target" }, { "value": "Policy most restrictive since 2007" } ] } }
```

---

## editorial_quote
**Visual:** A centred pull quote: a large serif italic statement framed above and below by short red rules, an oversized quotation-mark watermark behind it, and a tracked uppercase attribution line.

**Props:**
  - `title` (string) — The quote text (revealed word-by-word)
  - `attribution` (string) — Source line, e.g. `"— Jane Smith, CEO"`; falls back to `narration`
  - `titleFontSize` (number) — Quote size override

**When to Use:** A standout pull quote, key insight, or emotional beat between sections.

**Avoid When:** The quote is very long or needs supporting detail.

---

## by_the_numbers
**Visual:** A red kicker and serif title, a red rule, then a row of oversized serif figures (the values in red) each with a hairline divider, a short rule and a tracked uppercase label. Numeric values count up on entry.

**Props:**
  - `title` (string) — Heading
  - `narration` (string) — Optional standfirst beneath the title
  - `stats` (object_array) — Up to 4 items, each with `value` (e.g. `"4.2B"`) and `label`; numeric portions animate
  - `descriptionFontSize` (number) — Scales the figure size

**When to Use:** 2–4 key statistics, data highlights, "by the numbers" pages.

**Avoid When:** More than 4 stats or free-form text-heavy content.

---

## interview_qa
**Visual:** An "In Conversation · Name — Organisation" kicker over alternating question/answer blocks separated by hairline rules — the classic print Q&A page. Questions in bold serif, answers in book serif. Holds **two or three** exchanges so the page reads full.

**Props:**
  - `leftSpeaker` (string) — Interviewee name (used in the kicker)
  - `rightSpeaker` (string) — Their role/organisation (used in the kicker)
  - `exchanges` (object_array) — **REQUIRED — always emit 2–3 (prefer 3).** An array of question/answer exchanges, each `{ "q": "<question>", "a": "<answer>" }`. Write a fresh, specific question for each and give every answer a full, paragraph-length reply (**3–5 sentences**), grounded in the source — not one-liners. Always emit at least two; three substantial exchanges fill the page. Never emit a single exchange.
  - `title` (string) — Used as the first question when the first `exchanges` entry omits `q`.
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

## comparison_spread
**Visual:** Two columns sitting on the page, split by a centre hairline with a circular red "VS" marker; each has a tracked uppercase header (left in red, right in ink), a short rule and a bulleted list of short points marked with small red squares.

**Props:**
  - `leftHeader` (string) — Left column label, defaults to `"Before"`
  - `rightHeader` (string) — Right column label, defaults to `"After"`
  - `leftPoints` (object_array) — **REQUIRED.** 3–5 short bullet points for the left side, each `{ "value": "<point>" }` (≤10 words each). Falls back to splitting `narration` only if absent.
  - `rightPoints` (object_array) — **REQUIRED.** 3–5 short bullet points for the right side to match `leftPoints`; leave empty and the right leaf renders blank.
  - `title` (string) — Optional serif heading above the columns

**When to Use:** Claim vs reality, pro vs con, before vs after, A vs B — any balanced two-sided comparison. Always fill BOTH columns with a balanced number of bullets.

**Avoid When:** The two sides have very unequal amounts of content.

**Worked example:**
```json
{ "layout": "comparison_spread", "title": "Before and After",
  "narration": "The redesign in two views.",
  "layout_props_json": { "leftHeader": "BEFORE", "rightHeader": "AFTER",
    "leftPoints": [
      { "value": "Columns ran too wide to read" },
      { "value": "Headlines crowded the gutter" },
      { "value": "The grid bent to whatever filled it" },
      { "value": "Pages looked busy yet said little" }
    ],
    "rightPoints": [
      { "value": "A stricter grid holds a readable measure" },
      { "value": "Headlines anchor the corner" },
      { "value": "White space is a material, not a leftover" },
      { "value": "The page reads slower, in the best sense" }
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
**Visual:** A vertical chronology — a drawn red rule with milestone dots, each paired with an accent serif date and a serif label, reading top-to-bottom.

**Props:**
  - `title` (string) — Heading
  - `narration` (string) — Optional standfirst beneath the title
  - `milestones` (object_array) — Up to 6 items, each with a date (`value`) and a `label`

**When to Use:** Chronology, history, roadmap, process steps.

**Avoid When:** Non-chronological content or more than 6 milestones.

---

## expert_spotlight
**Visual:** A two-page profile spread. The left page is a dark ink panel carrying a big, bold, uppercase **pull-quote** opened by a red quotation mark; the right page is a solid red panel with the speaker's name (serif), an italic role and a red-on-white credential badge, centred. Image-free.

**Props:**
  - `narration` (string) — **REQUIRED. The quote.** A real, attributable quotable statement from the named person — verbatim or a close paraphrase taken from the source, surfaced as the large pull-quote. Keep it punchy (one or two sentences). NEVER invent a quote.
  - `expertName` (string) — **REQUIRED.** The person who said it.
  - `expertRole` (string) — Their role / organisation (italic)
  - `credential` (string) — Short red badge text, e.g. `"20yr in Policy"`

**When to Use:** ONLY when the source genuinely contains a quote or a strong first-person statement attributable to a named person. Surface that statement as the pull-quote with the speaker's name, role and credential.

**Avoid When:** The source has no real quote from a named person — do NOT invent one. For an unattributed standout line use `editorial_quote`; for plain prose use `text_narration` or `feature_spread`.

**Worked example:**
```json
{ "layout": "expert_spotlight", "title": "Mara Voss",
  "narration": "A spread should feel inevitable, as if it could not have been set any other way.",
  "layout_props_json": { "expertName": "Mara Voss", "expertRole": "Art Director", "credential": "Editor since 2014" } }
```

---

## text_narration
**Visual:** A centred editorial column: a red kicker, a large serif headline, a red rule and a serif body paragraph. Image-free and authoritative.

**Props:**
  - `sectionLabel` (string) — Red kicker and running-head section; defaults to `"Analysis"`
  - `title` (string) — Serif headline
  - `narration` (string) — Body copy

**When to Use:** Narration-only beats, chapter intros, transitional commentary.

**Avoid When:** The scene would benefit from a list, figures or a comparison.

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
