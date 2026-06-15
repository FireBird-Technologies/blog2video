# stickman_2 — Layout Catalog

Use this list when picking the `preferred_layout` for each scene.

- `chalk_title`  
  - **Best for**: Opening title card — the first thing the audience sees.

- `night_walk`  
  - **Best for**: Story progression and explanation beats — the primary workhorse narrative scene.

- `shooting_star`  
  - **Best for**: A single insight, a 'wish', or an emotional turning point — a quiet, impactful beat.

- `constellation_stats`  
  - **Best for**: Displaying 3–5 key figures or metrics as a connected star map.

- `moonphase_chart`  
  - **Best for**: Comparing a few quantities on a 0–100 scale with a poetic visual metaphor.

- `shadow_comparison`  
  - **Best for**: Two-sided comparisons — 'this vs that', pros vs cons, before vs after.

- `signal_fire_scene`  
  - **Best for**: Turning an abstract idea into a grounded character moment — a reflective, intimate beat.

- `neon_countdown`  
  - **Best for**: Launch, get-ready, or suspense beats — building anticipation before a reveal.

- `lantern_dialogue`  
  - **Best for**: Back-and-forth dialogue, Q&A, or two-voice storytelling.

- `ending_socials`  
  - **Best for**: Outro — follow-along CTA, social handles, and graceful close.

- `data_visualisation`
  - **Best for**: A real chart (line / bar / histogram) rendered from an ACTUAL data table in the article.
  - **Rule**: Use ONLY when a scene is bound to a chartable table (the pipeline sets `preferred_layout='data_visualisation'` and a `data_table_index`). Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges. Never invent figures — values come from the bound table.

- `ticker_table`
  - **Best for**: Displaying a static data table (rows × columns) from the article — rankings, comparisons, schedules. Up to 20 rows, 6 columns.
  - **Rule**: Use ONLY when the source contains a real tabular dataset. Never invent rows. Column 1 = row labels; columns 2–6 = values. Optionally set `tickerHighlightCol` to the 0-based index of the value column to green/red color by sign.

Global variety rules for `preferred_layout`:

- Scene 0 → **always** `chalk_title`.
- The last scene → **`ending_socials`** when CTA or social data is available; otherwise close with `shooting_star`, `constellation_stats`, or `night_walk`.
- Prefer `night_walk` as the default narrative workhorse for middle scenes.
- `data_visualisation` and `ticker_table` are reserved for scenes the pipeline binds to a real table (`data_table_index` set) — never assign them otherwise.
- Never repeat the same layout in consecutive scenes.

