# Design Philosophy

Chronicle is a medieval tome / history-book aesthetic. Every scene must feel like a turned page of an ancient manuscript — aged parchment, candle-glow, ornamental borders, quill-written text, illuminated capitals, wax seals, ribbons, and sepia-embossed photographs. This template appeals to history buffs, heritage storytelling, mythology, biographies, long-form narrative pieces, and anything that benefits from a timeless, scholarly voice.

Core rules:
- Treat every scene as a page from an old book, not a modern slide.
- Voice should be measured, slightly archaic, reverent — never casual, never internet-slangy.
- Use ornamental flourishes (drop caps, seals, ribbons, corners) as punctuation, not wallpaper.
- Keep white space generous; parchment should breathe.
- Images should feel like daguerreotype plates glued into a scrapbook — embossed, sepia, worn.

---

# Layout Catalog

## book_open
**Visual:** Scene 0 only. A closed leather tome sits centered; its red wax seal cracks, the brass clasps swing open, the cover rotates on the spine, pages flip, and the camera settles on the title page where the title quill-writes in beneath an ornamental fleur-de-lys border.

**Best for:** Opening scene only. Story intro.

**Props:** uses `title` as the book title, `narration` as the opening epigraph written beneath.

**When to Use:** scene 0 exclusively. Never repeat.

---

## parchment_scroll
**Visual:** Main body layout. Optional small-caps section tag at top (a short 1–3 word tag derived from the actual story — e.g. "The Founding", "Early Years"), large serif heading, inked divider, illuminated gold drop cap on the first letter of the narration, body text quill-writes in beside it. Optional embossed sepia image card pinned to the right (landscape) or below (portrait). Vine-ornament corners.

**Best for:** Core narrative, exposition, biographies, the meat of the story.

**Props:** optional `category` (a short 1–3 word section tag drawn from the story content — never "Chapter N" or Roman numerals); optional `illuminatedLetter` (overrides the auto drop-cap letter); optional `stats` = 1–2 byline rows (year+event, person+role, etc.).

**When to Use:** the workhorse layout. Use it for any scene that tells story.

---

## chapter_plate
**Visual:** An **illuminated incipit** — a painted opening page of a medieval manuscript. Heavy gold outer frame with a vermillion/azure/emerald diamond fresco strip, four gold corner rosettes with red-and-blue petals, an inner gold-leaf panel with painted corner sprigs, the title in red "rubric" ink with a gold drop-shadow, a painted sprig divider, and the narration displayed as the body paragraph in italic brown ink with its first letter lightly enlarged in vermillion.

**Best for:** Section / act breaks and dramatic title reveals between story beats.

**Props:** none required.
- `title` IS the rubric-red headline — keep it short and punchy (2–6 words).
- `narration` is the **body paragraph shown on the page** (1–2 sentences describing the new section).
- Optional `subtitle` renders as a tiny small-caps *kicker* ABOVE the title (e.g. "ACT ONE", "THE FOUNDING"). Leave blank to skip.

**DO NOT USE** "Chapter", "Chapter N", Roman numerals, or any hardcoded theme prefix in the `title`. The title should be a genuine section heading derived from the actual story content (e.g. "The Founding", "Ruin and Renewal", "A Pact Sealed").

**When to Use:** whenever the story clearly shifts act or chapter. Usually 1–2 times in a long video, 0 in a short one.

---

## illuminated_quote
**Visual:** A pull-quote page. Ornamental vine corners draw in, a giant golden opening quotation glyph appears, the quote writes in word-by-word in italic serif, optional phrase highlight in vermillion red with underline, and a red ribbon banner unfurls below bearing the attribution. Optional small embossed portrait on the side.

**Best for:** Memorable quotes, proverbs, historical lines, testimony.

**Props:** optional `quote` (overrides narration), optional `highlightPhrase` (phrase to underline in red ink), `attribution` (person or source).

**When to Use:** one impactful quote per video maximum; reserve for the emotional beat.

---

## ledger_stats
**Visual:** Aged-parchment ledger. Title at top with optional narration subtitle, optional image strip, then 1–3 dashed-border ledger cells each containing a big golden/ink numeral, an underline, and a small-caps label. The primary (first) cell has a red wax seal stamped on its upper right with a dust-puff effect.

**Best for:** Key numbers, counts, historical figures, populations, dates-as-numbers.

**Props:** required `stats` array of 1–3 items `{ value, label }`. First item receives the wax seal.

**When to Use:** when the scene is fundamentally about numbers.

---

## versus_folio
**Visual:** Two facing parchment pages with a central spine and a gold "vs." medallion. Left page slides in from the left, right page slides in from the right. Each page has a Roman numeral (I., II.), a heading, a divider, and body text quill-writing in. Optional image on the left page.

**Best for:** Comparison, before/after, myth vs fact, cause vs effect, side A vs side B.

**Props:** `leftLabel`, `rightLabel`, `leftDescription`, `rightDescription`. Optional image applies to the left page.

**When to Use:** clearly binary scenes.

---

## chronicle_timeline
**Visual:** Horizontal timeline (landscape) or vertical timeline (portrait). An ink spine draws in, then 2–4 dotted waypoints appear in order; each has a big Roman/year value above and a small-caps label below/beside, alternating above/below the line.

**Best for:** Chronology, historical progressions, evolution of an idea.

**Props:** required `stats` array of 2–4 items `{ value: "year or marker", label: "event" }`.

**When to Use:** scenes fundamentally about sequence over time.

---

## map_reveal
**Visual:** Image laid inside a torn-parchment frame styled as an unfurled cartographer's map. A compass rose draws in at the top-right, faint dashed lat/long grid fades in over the image, small-caps caption beneath.

**Best for:** Any scene where the image is geographical or location-heavy (a region, a site, a battle, a city). Also great for establishing shots and atmosphere.

**Props:** no extras required — uses `title`, `narration`, and the scene image.

**When to Use:** when the image itself is the star and benefits from a cartographic treatment.

---

## decree_seal
**Visual:** Punch-line layout. A small-caps preamble fades in (e.g. "Thus it was written"), then a single giant blackletter/Gothic word writes on screen, an ink splatter settles behind it, a red wax seal stamps down in the lower right with a dust puff, and an italic sign-off ("— So it was written —") fades in.

**Best for:** One-beat conclusions, emotional punches, single-word reveals, mottos, royal decrees, definitive statements.

**Props:** optional `word` (overrides narration's first word) — THE blackletter word on screen; optional `cta` (sign-off line). Keep `word` to 1–2 short words.

**When to Use:** sparingly — one per video maximum, reserved for the strongest single beat.

---

## chronicle_data
**Visual:** A real animated chart (line / bar / histogram) drawn in dark ink on an aged-parchment chart folio. Line charts draw in like a quill stroke; bars rise in staggered. A short analytical summary sits beside the chart under an inked rule. Ornamental corners frame the page.

**Best for:** Showing a chart built from an actual data table in the source article (trends over time, comparisons, distributions).

**Props (shared with the chart pipeline — usually filled automatically from the bound table):**
- `chartTable`: `{ headers: [...], rows: [[...]] }` — col 1 = X labels; cols 2-4 = up to 3 numeric series
- `chartType`: `"line" | "bar" | "histogram" | "auto"`
- `chartSummary`: one-to-two sentence read of the chart (emphasize key phrases with `__double underscores__`)
- `subtitle`, `yAxisLabel`, `chartYAxisTicks` (optional axis captions/ticks)

**When to Use:**
- ONLY for a scene the pipeline bound to a chartable table (`preferred_layout='chronicle_data'` + `data_table_index`).

**When NOT to Use:**
- For 1–3 headline numbers (use `ledger_stats`).
- When there is no real table — never fabricate chart figures.

---

## chronicle_table
**Visual:** A ruled ledger page — parchment table with inked column rules, small-caps header row, and an optional change column color-coded in green (gain) / deep red (loss) ink. A footnote line cites the source beneath.

**Best for:** Market-snapshot / multi-column comparison tables (name · price · % change, ranking tables, summary grids).

**Props (usually filled automatically from the bound table):**
- `tickerTable`: `{ headers: [...], rows: [[...]] }` (max 20 rows, 6 cols)
- `tickerTitle`: optional sub-headline
- `tickerFootnote`: optional source attribution
- `tickerHighlightCol`: 0-based column index to color-code +/- (e.g. a "% Chg" column); -1 disables

**When to Use:**
- ONLY for a scene the pipeline bound to a ticker-like table (`preferred_layout='chronicle_table'` + `data_table_index`).

**When NOT to Use:**
- For 1–3 key numbers (use `ledger_stats`).

---

## ending_socials
**Visual:** Closing colophon page. Ornamental fleur-de-lys borders draw in, a large "FINIS" or custom title appears, an inked divider, italic narration sign-off, a red wax seal with the first letter of the title stamps down, social icons row fades in, a golden ribbon CTA with the website link unfurls below.

**Best for:** Always the last scene — follow-along / CTA.

**Props:** `socials` (array of platform rows), `showWebsiteButton`, `websiteLink`, `ctaButtonText`.

**When to Use:** final scene only.

---

# Scene Flow Rules

- Scene 0 **must** use `book_open`.
- The final scene **must** use `ending_socials`.
- Prefer `parchment_scroll` as the default body layout (use it for 40–60% of the middle scenes).
- Use `chapter_plate` at most twice per video and only when the story truly breaks.
- Use `illuminated_quote` and `decree_seal` sparingly (max one of each per video — they are the emotional peaks).
- Use `ledger_stats` when numbers dominate a scene, `chronicle_timeline` when chronology dominates, `versus_folio` when binary comparison dominates, `map_reveal` when geography dominates.
- `chronicle_data` and `chronicle_table` are reserved for scenes the pipeline binds to a real table (`data_table_index` set) — never assign them otherwise, and never invent table figures.
- Keep the rhythm alternating: dense narrative pages (`parchment_scroll`) should be punctuated by ornamental beats (`illuminated_quote`, `decree_seal`, `ledger_stats`, `chapter_plate`) — never three `parchment_scroll` scenes in a row.
- Arc: opening (`book_open`) → context (`parchment_scroll`) → development beats alternating ornamental + body → climax (`decree_seal` or `illuminated_quote`) → closing (`ending_socials`).

---

# Content Extraction Rules

- `title`: 2–8 words, scholarly in tone, like a chapter heading in an old book. Avoid modern punctuation like "!" or exclamatory style.
- `narration`: 12–25 words. Slightly formal, measured cadence. Past tense or timeless present. Avoid contractions unless emotionally warranted.
- Tone hint: Imagine a BBC documentary narrator or the opening of Lord of the Rings — never an influencer, never a marketer.
- When extracting a quote for `illuminated_quote`, keep it under ~25 words.
- When setting a `decree_seal.word`, keep it to 1–2 short, strong words (e.g. "HONOR", "EXILE", "FINIS", "DECREED").

---

# Variety Rules

- Never repeat the same layout 3+ scenes in a row.
- Distribute ornamental beats (`illuminated_quote`, `decree_seal`, `chapter_plate`, `ledger_stats`, `chronicle_timeline`, `versus_folio`, `map_reveal`) evenly across the video.
- If an image is particularly atmospheric or location-like, strongly prefer `map_reveal`.
- If the scene contains quantitative claims, strongly prefer `ledger_stats` over prose.
- If the scene contains a direct quote, strongly prefer `illuminated_quote`.
