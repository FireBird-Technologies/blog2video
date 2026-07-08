# sakura — Layout Catalog

Use this list when picking the `preferred_layout` for each scene.

- `sakura_intro`  
  - **Best for**: Opening title card that sets the full emotional register of the video.

- `sakura_section`  
  - **Best for**: Primary body-content scene for article sections with optional supporting image.

- `sakura_quote`  
  - **Best for**: Full-bleed dramatic scene for pull-quotes, key concepts, or chapter transitions.

- `sakura_two_column_detail`  
  - **Best for**: Sections requiring side-by-side comparison, feature breakdown, or dual-point content.

- `sakura_stat_highlight`  
  - **Best for**: Emphasizing a key statistic, metric, or single bold data point.

- `sakura_list_scene`  
  - **Best for**: Presenting 3–6 enumerated points, steps, or features sequentially.

- `sakura_text_narration`  
  - **Best for**: Pure narration or transitional text with no supporting visuals — the baseline readable layout.

- `ending_socials`  
  - **Best for**: Closing branded card with call-to-action and social/website links.

- `sakura_data_visualization`  
  - **Best for**: A chart (line / bar / histogram) bound to a chartable table. line = trend over time, bar = comparison across named categories, histogram = distribution across bins/ranges.
  - **Rule**: Use ONLY when the pipeline binds a chartable table to this scene (preferred_layout=sakura_data_visualization). Never invent figures. The `chartType` field switches line/bar/histogram — there are no `_bar`/`_histogram` variant layout ids.

- `sakura_ticker`  
  - **Best for**: A data table of rows and columns lifted from the blog.
  - **Rule**: Use ONLY when the pipeline binds a data table to this scene (preferred_layout=sakura_ticker). Never invent rows.

