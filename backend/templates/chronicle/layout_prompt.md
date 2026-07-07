Layout catalog for Chronicle template
=====================================

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `chronicle` template. Think like a scribe: each scene is a page turned in an ancient manuscript. Distribute layouts as a rhythmic alternation of body pages and ornamental beats — never stack identical layouts.

- `book_open`
  - **Best for**: Scene 0 only. A closed tome's wax seal cracks, cover opens, pages flip, title quill-writes.
  - **Rule**: Use **only for the opening scene**. Never repeat.

- `parchment_scroll`
  - **Best for**: Core narrative body. Illuminated drop cap + quill-written body text + optional embossed image.
  - **Use for**: the workhorse layout — 40–60% of middle scenes. Any scene that tells story.

- `chapter_plate`
  - **Best for**: Act or section breaks. An illuminated manuscript incipit — gold+vermillion painted frame, rubric-red title, narration as body paragraph, optional kicker above the title.
  - **Rule**: At most twice per video. Only when the story truly shifts chapter. `title` must be a real section heading (2–6 words) — never "Chapter N" or Roman numerals.
  - **Required prop**: none. Optional `subtitle` renders as a small-caps kicker above the title (2–3 words).

- `illuminated_quote`
  - **Best for**: Memorable quote, proverb, historical line. Giant quotation glyph + ribbon-banner attribution.
  - **Rule**: Max one per video — reserve for the emotional peak.

- `ledger_stats`
  - **Best for**: Scenes dominated by 1–3 key numbers. Ledger cells with wax seal on the primary stat.
  - **Required prop**: `stats` array 1–3 items.

- `versus_folio`
  - **Best for**: Binary comparison, before/after, myth vs fact, cause vs effect.
  - **Required props**: `leftLabel`, `rightLabel`, `leftDescription`, `rightDescription`.

- `chronicle_timeline`
  - **Best for**: Chronological progressions. 2–4 waypoints on an ink spine.
  - **Required prop**: `stats` array of 2–4 items `{ value, label }`.

- `map_reveal`
  - **Best for**: Geographical, location-based, atmospheric establishing shots where the image is the star.
  - **Rule**: Use whenever the scene's image is a landscape, map, city, region, battlefield, or landmark.

- `decree_seal`
  - **Best for**: One-beat conclusion, single-word reveal, royal-decree punch, definitive statement.
  - **Rule**: Max one per video — reserve for the strongest single beat.
  - **Suggested prop**: `word` = 1–2 short, strong words (e.g. "HONOR", "FINIS", "EXILE").

- `chronicle_data`
  - **Best for**: A real animated chart (line / bar / histogram) drawn in ink on a parchment chart-folio, built from an actual table in the article.
  - **Rule**: Use ONLY when a scene is bound to a chartable table (the pipeline sets `preferred_layout='chronicle_data'` and a `data_table_index`). Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges. Never invent figures — values come from the bound table.

- `chronicle_table`
  - **Best for**: Multi-column data tables (snapshot / ranking / holdings tables) rendered as a ruled ledger page with gain/loss ink coloring.
  - **Rule**: Use ONLY when a scene is bound to a ticker-like table (`preferred_layout='chronicle_table'` with a `data_table_index`).

- `ending_socials`
  - **Best for**: Closing colophon with "FINIS" title, wax seal, social icons, website ribbon CTA.
  - **Rule**: **Always** the final scene. Never earlier.

Global variety rules for `preferred_layout`:

- Scene 0 → **always** `book_open`.
- Last scene → **always** `ending_socials`.
- Alternate ornamental beats (`illuminated_quote`, `decree_seal`, `chapter_plate`, `ledger_stats`, `chronicle_timeline`, `versus_folio`, `map_reveal`) with body pages (`parchment_scroll`).
- Never stack the same layout three times consecutively.
- Prefer `ledger_stats` when numbers dominate, `chronicle_timeline` when chronology dominates, `versus_folio` when binary comparison dominates, `map_reveal` when geography / imagery dominates, `illuminated_quote` when a direct quote is present, `decree_seal` for the single strongest punch line.
- `chronicle_data` and `chronicle_table` are reserved for scenes the pipeline binds to a real table — do not assign them to scenes without a `data_table_index`.
