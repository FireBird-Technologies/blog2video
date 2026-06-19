# Design Philosophy

An authentic print-editorial magazine template. Cream/white paper, high-contrast serif display headlines, a book-serif body, and a single editorial red accent. Every page carries newsstand furniture — an inset keyline border, a running head (issue • section) over a hairline rule, and a page folio at the foot. The look is mostly typographic — strong headlines, decks, pull quotes, figures and Q&A carry each scene on words. Three layouts feature a real photograph: **photo_essay** (a full-bleed cover photo), **feature_spread** (a boxed photo top-left of the article) and **expert_spotlight** (the person's headshot); only pick these when the source genuinely has a strong, relevant image for the beat. Every other layout is purely typographic — no photographs. Default palette is white background, near-black ink, red accent.

---

# Layout Catalog

---

## magazine_cover
**Visual:** A typographic cover. A heavy red rule banner runs across the top with the issue line and a "COVER STORY" tag; an enormous serif cover line is set bottom-left and reveals word-by-word, underlined by a red rule, with an italic deck beneath. No image.

**Props:**
  - `title` (string) — The cover line, set huge in serif and revealed word-by-word
  - `subtitle` (string) — Italic deck/tagline under the red rule; falls back to `narration`
  - `issueLabel` (string) — Top-left issue/date line, e.g. `"ISSUE 47 · JUNE 2026"`
  - `titleFontSize` (number) — Override for the cover-line size

**When to Use:** The opening title card / cover of the piece.

**Avoid When:** You need body paragraphs or data — this is a single cover line plus a deck.

---

## feature_spread
**Visual:** A feature article opener on the standard page. A red kicker label, a large serif headline, a red rule, then the body set in justified multi-column type (two columns in landscape) led by an oversized red drop cap. When an image is supplied it sits in a keyline-framed **box at the top-left**, with the headline and columns reflowing cleanly around it.

**Props:**
  - `sectionLabel` (string) — Red kicker above the headline and the running-head section; defaults to `"Feature"`
  - `title` (string) — Serif headline
  - `narration` (string) — Body copy; its first character becomes the drop cap
  - `imageUrl` (string) — Optional editorial photograph, shown in the top-left keyline box
  - `titleFontSize` / `descriptionFontSize` (number) — Size overrides

**When to Use:** Main narrative, feature body, story setup pages with a few sentences of prose.

**Avoid When:** Content is a short list or a single line.

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

## photo_essay
**Visual:** A dramatic **full-bleed photograph** with a dark gradient scrim, reversed-out type laid over it: a "PHOTO ESSAY" label, a huge serif headline revealed word-by-word lower-left, a red rule, an italic caption and a photo credit, inside a thin keyline frame with corner crop ticks. With no image it falls back to a bold reversed-out typographic statement page.

**Props:**
  - `title` (string) — The headline / statement set over the photo
  - `imageUrl` (string) — The full-bleed editorial photograph
  - `caption` (string) — Italic caption beneath the headline; falls back to `narration`
  - `titleFontSize` / `descriptionFontSize` (number) — Size overrides

**When to Use:** A dramatic full-frame photographic reveal or a bold thematic statement between sections.

**Avoid When:** The scene needs multiple data points or long body copy.

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
**Visual:** An "In Conversation · Name — Organisation" kicker over alternating question/answer blocks separated by hairline rules — the classic print Q&A page. Questions in bold serif (prefixed `Q.` in red), answers in book serif.

**Props:**
  - `leftSpeaker` (string) — Interviewee name (used in the kicker)
  - `rightSpeaker` (string) — Their role/organisation (used in the kicker)
  - `title` (string) — The framing question for the first block
  - `leftQuote` (text) — First answer; falls back to `narration`
  - `rightQuote` (text) — Second answer (creates a second Q&A block)
  - `descriptionFontSize` (number) — Quote size override

**When to Use:** Interviews and Q&A segments.

**Avoid When:** More than a couple of exchanges are needed in one scene.

---

## comparison_spread
**Visual:** Two columns split by a centre hairline with a circular red "VS" marker. Each column has a tracked uppercase header (left in red, right in ink), a short rule and serif body copy.

**Props:**
  - `leftHeader` (string) — Left column label, defaults to `"Before"`
  - `rightHeader` (string) — Right column label, defaults to `"After"`
  - `leftContent` (text) — Left body; falls back to `narration`
  - `rightContent` (text) — Right body
  - `title` (string) — Optional serif heading above the columns

**When to Use:** Before/after, pro/con, A vs B — any balanced two-sided comparison.

**Avoid When:** The two sides have very unequal amounts of content.

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
**Visual:** A profile page. The person's **headshot** sits in a red-keyline portrait box, beside the name (serif), an italic role, a red credential badge, a red rule and a bio with a character-by-character reveal. With no image, a large serif **monogram** (the person's initials) stands in for the portrait.

**Props:**
  - `expertName` (string) — Full name (its initials form the monogram fallback)
  - `expertRole` (string) — Role / organisation (italic)
  - `credential` (string) — Short red badge text, e.g. `"20yr in Policy"`
  - `imageUrl` (string) — The person's headshot / portrait photo
  - `narration` (string) — Bio paragraph

**When to Use:** Introducing a named authority, contributor or team member.

**Avoid When:** There is no name or bio to anchor the page.

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
