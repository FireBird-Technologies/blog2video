# magazine — Layout Catalog

Use this list when picking the `preferred_layout` for each scene.

Note: `feature`, `colorblock`, `text_narration` and `timeline_journey` automatically display an editorial photo when the project supplies imagery (a framed plate, a hero panel, or an embedded page background). You never set an image field — just write the full copy; these pages reflow gracefully with or without a photo.

- `magazine_cover`  
  - **Best for**: Opening title card and magazine cover intro sequence.  
  - **Rule**: Use **only for the opening scene (Scene 0)**. Never assign it to any later scene.

- `editorial_quote`  
  - **Best for**: Standout pull quote, key insight, or emotional beat between sections.

- `colorblock`  
  - **Best for**: A bold spotlight or statement beat — a striking quote on a dark block paired with a named person/role or labelled callout on a red block. Fill the right block's label stack (`panelLabel` / `panelHeading` / `panelSubline` / `panelTag`).

- `feature`  
  - **Best for**: A feature-article opener or long-form editorial beat — a headline plus a substantial paragraph of reported prose flowing across both pages, led by a red drop cap. Fill `body` (60–110+ words) and `keyPoints` (2–3 short takeaways).

- `comparison`  
  - **Best for**: A before/after, two-perspective, or "VS" contrast beat — two columns split by a centre badge, each a short bulleted list. Fill `leftHeader` / `rightHeader` (e.g. 'Before' / 'After') and 2–6 short `leftPoints` / `rightPoints` (≤10 words each). Use for crisp side-by-side contrasts, not paragraph-length dialogue (use `interview_qa` for that) or charted figures (use `magazine_data_visualization`).

- `by_the_numbers`  
  - **Best for**: 2–4 key numeric metrics — statistics, KPIs, or data highlights where every value is a number (e.g. `"4.2B"`, `"98%"`, `"$12B"`). The scene shows a short topic-relevant heading (+ optional standfirst) above a grid of numbers and their short labels — the `value` of every stat must still be a number, never words or sentences. Do not use this layout if the "values" would be words or sentences. **If the source has no numeric figures for this beat, do NOT pick `by_the_numbers` — never fabricate figures; use `text_narration`, `feature`, or `editorial_quote` instead.**

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
  - **Best for**: Narration-only scenes, transitional commentary, or text-driven story beats; shows a framed field photo above the notes when the project supplies imagery. Fill `points` with **at least 2 (prefer 3–6)** short bulleted field-notes (each a separate `{ "value": … }` entry) — not one prose blob, and **never a single bullet**; if only one point exists, use another layout (`editorial_quote` or `colorblock`).

- `ending_socials`  
  - **Best for**: Outro, sign-off, call to action, and social media handles.

Global rule: Scene 0 → **always** `magazine_cover`; never use `magazine_cover` on any later scene.

