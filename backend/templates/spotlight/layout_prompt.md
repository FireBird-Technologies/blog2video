Layout catalog for Spotlight template
=====================================

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `spotlight` template. Spotlight is bold kinetic typography on a dark stage.

- `impact_title`  
  - **Best for**: Scene 0 hero. Giant title text slam on black.  
  - **Rule**: Only for opening.

- `statement`  
  - **Best for**: Key explanations, important points, thesis statements (multi-line).

- `word_punch`  
  - **Best for**: Single most impactful word/short phrase (1–3 words).  
  - **Rule**: Max 1 use per video.

- `cascade_list`  
  - **Best for**: Ordered lists / feature lists where items cascade in.

- `stat_stage`  
  - **Best for**: Stats and metrics on a glass stage.

- `versus`  
  - **Best for**: A vs B comparisons (split screen).

- `spotlight_image`  
  - **Best for**: Image-focused scenes with spotlight reveal.

- `rapid_points`  
  - **Best for**: Fast-cut lists of short phrases.

- `spotlight_data`  
  - **Best for**: A real chart (line / bar / histogram) rendered from a data table in the article.  
  - **Rule**: Use ONLY when a scene is bound to a chartable table (the pipeline sets `preferred_layout='spotlight_data'` and a `data_table_index`). Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges. Never invent figures — values come from the bound table.

- `spotlight_table`  
  - **Best for**: A market-snapshot / comparison data table (name · price · % change, or any multi-column tabular readout).  
  - **Rule**: Use ONLY when a scene is bound to a ticker-like table (`preferred_layout='spotlight_table'` with a `data_table_index`). Rendered as a high-contrast glass-panel table with +/- color coding.

- `closer`  
  - **Best for**: Final closing line or CTA.

Variety rules:

- Scene 0 → `impact_title`.  
- Use `word_punch` sparingly (max 1 scene).  
- Mix `statement`, `cascade_list`, `stat_stage`, `versus`, `rapid_points`, and `closer` so the video doesn’t feel like the same layout repeating.
- `spotlight_data` and `spotlight_table` are reserved for scenes the pipeline binds to a real table — do not assign them to scenes without a `data_table_index`.

