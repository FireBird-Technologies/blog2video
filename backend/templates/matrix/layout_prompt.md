Layout catalog for Matrix template
==================================

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `matrix` template. Matrix is terminal/cyberpunk digital-rain style.

- `matrix_title`  
  - **Best for**: Scene 0 hero. Title with digital rain.  
  - **Rule**: Only for opening.

- `terminal_text`  
  - **Best for**: Explanations in terminal-style monospace text.

- `glitch_punch`  
  - **Best for**: Short glitchy punch moments (impact words/phrases).

- `data_stream`  
  - **Best for**: Streaming data / scrolling metrics.

- `cipher_metric`  
  - **Best for**: Metrics and counters in cipher style.

- `fork_choice`  
  - **Best for**: Binary choices (e.g. “red pill vs blue pill” style comparisons).

- `matrix_image`  
  - **Best for**: Image scenes inside the Matrix aesthetic.

- `matrix_data`  
  - **Best for**: A real chart (line / bar / histogram) rendered from a data table in the article.  
  - **Rule**: Use ONLY when a scene is bound to a chartable table (the pipeline sets `preferred_layout='matrix_data'` and a `data_table_index`). Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges. Never invent figures — values come from the bound table.

- `matrix_ticker`  
  - **Best for**: A market-snapshot / comparison data table (symbol · price · % change, or any multi-column tabular readout).  
  - **Rule**: Use ONLY when a scene is bound to a ticker-like table (`preferred_layout='matrix_ticker'` with a `data_table_index`). Rendered as an intercepted terminal table with +/- color coding.

- `transmission`  
  - **Best for**: Rapid-fire intercepted transmissions / short phrases.

- `awakening`  
  - **Best for**: Final resolution / outro scene.

Variety rules:

- Scene 0 → `matrix_title`.  
- For middle scenes, alternate between narrative (`terminal_text`), data (`cipher_metric` / `data_stream` / `matrix_data` / `matrix_ticker`), impact (`glitch_punch` / `transmission`), and comparison (`fork_choice`).
- `matrix_data` and `matrix_ticker` are reserved for scenes the pipeline binds to a real table — do not assign them to scenes without a `data_table_index`.

