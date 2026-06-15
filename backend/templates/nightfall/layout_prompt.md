Layout catalog for Nightfall template
=====================================

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `nightfall` template. Nightfall is a dark cinematic glass style optimized for data-heavy tech content.

- `cinematic_title`  
  - **Best for**: Scene 0 hero. Dramatic title card with gradient mesh background.  
  - **Rule**: Use only for the opening scene.

- `glass_narrative`  
  - **Best for**: Main explanations and narrative body. Single frosted glass card with title + body.

- `glow_metric`  
  - **Best for**: KPIs, stats, and key metrics. Large glowing numbers with counter animations.

- `glass_code`  
  - **Best for**: Code snippets, terminal output, technical demos. Frosted code panel.

- `kinetic_insight`  
  - **Best for**: Short, punchy statements or key insights.

- `glass_stack`  
  - **Best for**: Stacked content blocks / multi-section explanations.

- `split_glass`  
  - **Best for**: Comparisons or side-by-side content in glass panels.

- `chapter_break`  
  - **Best for**: Section separators, chapter transitions.

- `glass_image`  
  - **Best for**: Image-focused scenes with caption / description.

- `nightfall_data_visualization`  
  - **Best for**: Quantitative stories — trends over time, distributions, comparisons across categories. Supports line, bar, and histogram-style charts. Dark glass panel with neon-glow accent lines.  
  - **Data**: Provide `chartTable` (headers + rows), `chartType` (`"line"` / `"bar"` / `"histogram"` / `"auto"`), and optionally `chartSummary`, `yAxisLabel`, `subtitle` (X-axis caption), `barPrimaryColor` (`#00E5FF`), `barSecondaryColor` (`#7B2FBE`).  
  - **Rule**: Use at most **1 time per video**. Do NOT use the old `data_visualization` id.

- `nightfall_ticker`  
  - **Best for**: Tabular data — leaderboards, comparison matrices, metric grids, node stats.  
  - **Data**: Provide `tickerTable` (headers + rows), `tickerTitle`, `tickerHighlightCol` (0-based column index for gain/loss colouring), `tickerFootnote`.  
  - **Rule**: Use at most **1 time per video**.

Variety rules:

- Scene 0 → `cinematic_title`.  
- In the middle of the video, **alternate** between narrative (`glass_narrative`), data (`glow_metric` / `nightfall_data_visualization` / `nightfall_ticker`), code (`glass_code`), and impact (`kinetic_insight` / `split_glass`).  

