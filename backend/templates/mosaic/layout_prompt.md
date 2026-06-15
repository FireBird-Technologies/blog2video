Layout catalog for Mosaic template
=================================

Use these layout IDs exactly when suggesting `preferred_layout` for scenes using the `mosaic` template.

- `mosaic_title`
  - Best for: Opening hero title (scene 0).
  - Rule: Use only at the beginning.

- `mosaic_text`
  - Best for: Main narrative/explanatory text.

- `mosaic_punch`
  - Best for: Single high-impact phrase or keyword.
  - Rule: Maximum once per video.

- `mosaic_stream`
  - Best for: Ordered or grouped lists.

- `mosaic_metric`
  - Best for: Number-driven scenes and KPIs.

- `mosaic_phrases`
  - Best for: Rotating short statements.
  - Rule: Maximum once per video.

- `mosaic_close`
  - Best for: Closing statement before socials.

- `ending_socials`
  - Best for: Final follow/CTA scene.

- `mosaic_data_visualization`
  - Best for: A scene bound to a chartable table extracted from the blog (trends, comparisons, distributions).
  - Rule: Use ONLY when the pipeline binds a chartable table to this scene (preferred_layout=mosaic_data_visualization). Never invent figures.
  - line = trend over time; bar = comparison across categories; histogram = distribution over ranges.
  - Do NOT use mosaic_data_visualization_bar or mosaic_data_visualization_histogram in prompts — those are manual Studio presets.

- `mosaic_ticker`
  - Best for: A scene bound to a data table extracted from the blog.
  - Rule: Use ONLY when the pipeline binds a data table (preferred_layout=mosaic_ticker). Never invent rows.

Variety rules:
- Scene 0 should be `mosaic_title`.
- Prefer a mix of narrative (`mosaic_text`), list (`mosaic_stream`), metric (`mosaic_metric`), and emphasis (`mosaic_punch`) in middle scenes.
- Avoid repeating the same layout in adjacent scenes unless necessary.
