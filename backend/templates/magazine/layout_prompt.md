# magazine — Layout Catalog

Use this list when picking the `preferred_layout` for each scene.

- `magazine_cover`  
  - **Best for**: Opening title card and magazine cover intro sequence.

- `feature_spread`  
  - **Best for**: Main narrative, feature article body, and story setup pages. Supports an optional photo (boxed top-left).

- `editorial_quote`  
  - **Best for**: Standout pull quote, key insight, or emotional beat between sections.

- `photo_essay`  
  - **Best for**: Visual moment, editorial photography showcase, or dramatic full-frame reveal. Features a full-bleed photo when a strong image exists.

- `by_the_numbers`  
  - **Best for**: Key figures, data highlights, and 'by the numbers' infographic pages.

- `interview_qa`  
  - **Best for**: Interview, debate, two perspectives, or Q&A dialogue format.

- `comparison_spread`  
  - **Best for**: Claim vs reality, pro vs con, before vs after, or any two-sided comparison.

- `magazine_data_visualization`  
  - **Best for**: A real animated chart (line / bar / histogram) rendered from an ACTUAL data table in the article. Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges.
  - **Rule**: Use ONLY when a scene is bound to a chartable table (the pipeline sets `preferred_layout='magazine_data_visualization'` and a `data_table_index`). Never invent figures — values come from the bound table.

- `magazine_ticker`  
  - **Best for**: A static data table (rows × columns) from the article — rankings, comparisons, schedules, financials. Up to 20 rows, 6 columns; optionally colour-code one value column by sign.
  - **Rule**: Use ONLY when the source contains a real tabular dataset (`preferred_layout='magazine_ticker'` + a `data_table_index`). Never invent rows.

- `timeline_journey`  
  - **Best for**: Chronology, process steps, history, or roadmap sequences.

- `expert_spotlight`  
  - **Best for**: Expert profile, team spotlight, or key person feature. Shows the person's headshot when a photo is available.

- `text_narration`  
  - **Best for**: Narration-only scenes, transitional commentary, or text-driven story beats without imagery.

- `ending_socials`  
  - **Best for**: Outro, sign-off, call to action, and social media handles.

