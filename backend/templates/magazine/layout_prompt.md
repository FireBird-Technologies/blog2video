# magazine — Layout Catalog

Use this list when picking the `preferred_layout` for each scene.

- `magazine_cover`  
  - **Best for**: Opening title card and magazine cover intro sequence.

- `editorial_quote`  
  - **Best for**: Standout pull quote, key insight, or emotional beat between sections.

- `colorblock`  
  - **Best for**: A bold spotlight or statement beat — a striking quote on a dark block paired with a named person/role or labelled callout on a red block. Fill the right block's label stack (`panelLabel` / `panelHeading` / `panelSubline` / `panelTag`).

- `feature`  
  - **Best for**: A feature-article opener or long-form editorial beat — a headline plus a substantial paragraph of reported prose flowing across both pages, led by a red drop cap. Fill `body` (60–110+ words) and `keyPoints` (2–3 short takeaways).

- `comparison`  
  - **Best for**: A before/after, two-perspective, or "VS" contrast beat — two columns split by a centre badge, each a short bulleted list. Fill `leftHeader` / `rightHeader` (e.g. 'Before' / 'After') and 2–6 short `leftPoints` / `rightPoints` (≤10 words each). Use for crisp side-by-side contrasts, not paragraph-length dialogue (use `interview_qa` for that) or charted figures (use `magazine_data_visualization`).

- `by_the_numbers`  
  - **Best for**: Key figures, data highlights, and 'by the numbers' infographic pages.

- `interview_qa`  
  - **Best for**: Interview, debate, two perspectives, or Q&A dialogue. Use the `exchanges` array with 2–3 exchanges, each a full paragraph-length answer, so the page reads full, not sparse.

- `magazine_data_visualization`  
  - **Best for**: A real animated chart (line / bar / histogram) rendered from an ACTUAL data table in the article. Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges.
  - **Rule**: Use ONLY when a scene is bound to a chartable table (the pipeline sets `preferred_layout='magazine_data_visualization'` and a `data_table_index`). Never invent figures — values come from the bound table.

- `magazine_ticker`  
  - **Best for**: A static data table (rows × columns) from the article — rankings, comparisons, schedules, financials. Up to 20 rows, 6 columns; optionally colour-code one value column by sign.
  - **Rule**: Use ONLY when the source contains a real tabular dataset (`preferred_layout='magazine_ticker'` + a `data_table_index`). Never invent rows.

- `timeline_journey`  
  - **Best for**: Chronology, process steps, history, or roadmap sequences.

- `text_narration`  
  - **Best for**: Narration-only scenes, transitional commentary, or text-driven story beats without imagery.

- `ending_socials`  
  - **Best for**: Outro, sign-off, call to action, and social media handles.

