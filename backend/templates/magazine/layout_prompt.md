# magazine — Layout Catalog

Use this list when picking the `preferred_layout` for each scene.

- `magazine_cover`  
  - **Best for**: Opening title card and magazine cover intro sequence.

- `feature_spread`  
  - **Best for**: The workhorse — main narrative, feature body, story setup, and the default/fallback. Give it a full paragraph of `body` (the on-page article copy, distinct from the voiceover `narration`), a `standfirst` deck and 2–3 `keyPoints` so the whole page fills. Image-free.

- `editorial_quote`  
  - **Best for**: Standout pull quote, key insight, or emotional beat between sections.

- `by_the_numbers`  
  - **Best for**: Key figures, data highlights, and 'by the numbers' infographic pages.

- `interview_qa`  
  - **Best for**: Interview, debate, two perspectives, or Q&A dialogue. Use the `exchanges` array with 2–3 exchanges, each a full paragraph-length answer, so the page reads full, not sparse.

- `comparison_spread`  
  - **Best for**: Claim vs reality, pro vs con, before vs after, or any two-sided comparison. A two-page spread — needs a balanced bullet list (`leftPoints` / `rightPoints`, 3–5 short bullets each) on BOTH sides.

- `magazine_data_visualization`  
  - **Best for**: A real animated chart (line / bar / histogram) rendered from an ACTUAL data table in the article. Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges.
  - **Rule**: Use ONLY when a scene is bound to a chartable table (the pipeline sets `preferred_layout='magazine_data_visualization'` and a `data_table_index`). Never invent figures — values come from the bound table.

- `magazine_ticker`  
  - **Best for**: A static data table (rows × columns) from the article — rankings, comparisons, schedules, financials. Up to 20 rows, 6 columns; optionally colour-code one value column by sign.
  - **Rule**: Use ONLY when the source contains a real tabular dataset (`preferred_layout='magazine_ticker'` + a `data_table_index`). Never invent rows.

- `timeline_journey`  
  - **Best for**: Chronology, process steps, history, or roadmap sequences.

- `expert_spotlight`  
  - **Best for**: Surfacing a real, attributable quote from a named person as a big pull-quote with their name/role.
  - **Rule**: Use ONLY when the source genuinely contains such a quote or strong first-person statement. Never invent a quote — for an unattributed standout line use `editorial_quote`, for plain prose use `text_narration`.

- `text_narration`  
  - **Best for**: Narration-only scenes, transitional commentary, or text-driven story beats without imagery.

- `ending_socials`  
  - **Best for**: Outro, sign-off, call to action, and social media handles.

