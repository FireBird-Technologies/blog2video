Layout catalog for Gridcraft template
=====================================

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `gridcraft` template. Gridcraft is a bento-style, editorial grid for SaaS/product stories.

- `bento_hero`  
  - **Best for**: Scene 0 hero. Large accent cell + two smaller supporting cells.  
  - **Rule**: Use only for the opening.

- `bento_features`  
  - **Best for**: 4–6 features/benefits in a bento grid.

- `bento_highlight`  
  - **Best for**: One main idea with 2 supporting facts.

- `editorial_body`  
  - **Best for**: Longer narrative text with editorial layout.

- `kpi_grid`  
  - **Best for**: Multiple KPIs/metrics in a grid.

- `bento_compare`  
  - **Best for**: Comparing two options in a bento layout.

- `bento_code`  
  - **Best for**: Code examples in a bento cell.

- `pull_quote`  
  - **Best for**: Quotes or standout statements.

- `bento_steps`  
  - **Best for**: Ordered steps / process in bento cells.

- `data_visualisation`
  - **Best for**: A real chart (line / bar / histogram) rendered from an ACTUAL data table in the article.
  - **Rule**: Use ONLY when a scene is bound to a chartable table (the pipeline sets `preferred_layout='data_visualisation'` and a `data_table_index`). Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges. Never invent figures — values come from the bound table.

- `ticker_table`
  - **Best for**: Displaying a static data table (rows × columns) from the article — rankings, comparisons, schedules, product matrices. Up to 20 rows, 6 columns.
  - **Rule**: Use ONLY when the source contains a real tabular dataset. Never invent rows. Column 1 = row labels; columns 2–6 = values. Optionally set `tickerHighlightCol` to the 0-based index of the value column to green/red color by sign.

- `ending_socials`
  - **Best for**: Final scene only — bento-style sign-off with social icons and website CTA.
  - **Rule**: Use **only** on the last scene when CTA or social data is available.

Variety rules:

- Scene 0 → `bento_hero`.  
- In the middle, mix `bento_features`, `bento_highlight`, `kpi_grid`, `bento_compare`, `pull_quote`, `bento_steps`, `editorial_body`, `data_visualisation`, and `ticker_table` as content demands.
- `data_visualisation` and `ticker_table` are reserved for scenes the pipeline binds to a real table (`data_table_index` set).
- The last scene → `ending_socials` when CTA or social data is available; otherwise `pull_quote`, `kpi_grid`, or `editorial_body`.

