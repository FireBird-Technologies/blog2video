Layout catalog for Geometric Explainer (default)
================================================

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `default` template. Pick the layout that best matches each scene's narration and visual intent, and **spread usage across the video** (aim for 5–7 different layouts in a 7-scene video, never more than 2–3 uses of the same layout unless the content truly demands it).

- Portrait guidance (9:16):
  - All layouts below are valid in portrait — adapt them.
  - In portrait, AVOID side-by-side compositions. Prefer stacked (top/bottom) or vertical flows.
  - Do NOT overuse `image_caption` just because an image exists. Use image layouts only when the image is the PRIMARY content of the scene.

- `hero_image`  
  - **Best for**: ** A full-screen background image is overlaid with a prominent, semi-transparent purple-to-blue gradient. Large, uppercase title text is centered on top, with optional smaller narration text below.

- `text_narration`  
  - **Best for**: Simple explanatory beats when no structured visual fits. Single text card with geometric decorations.  
  - **Variety rule**: ABSOLUTE LAST RESORT. Use at most **1 time per video**.

- `code_block`  
  - **Best for**: Code snippets, API calls, CLI commands, configuration. Dark terminal-style card with syntax-highlighted code.

- `bullet_list`  
  - **Best for**: ** An animated, numbered list where each point slides in. Each item features a circular number, a main point in a colored, pill-shaped container, and an optional description underneath.

- `flow_diagram`  
  - **Best for**: Pipelines, workflows, architectures, data flows.
  - **Landscape**: Boxes connected by arrows in a horizontal flow.
  - **Portrait**: Vertical flow (top → bottom) with stacked steps.

- `comparison`  
  - **Best for**: A vs B, old vs new, pros vs cons, before vs after.
  - **Landscape**: Split screen with vertical divider.
  - **Portrait**: Stacked comparison (top vs bottom) with clear labels.

- `metric`  
  - **Best for**: Key numbers, KPIs, performance stats. Large animated numbers with labels and progress bars.

- `quote_callout`  
  - **Best for**: Key quote, definition, insight. Vertical accent bar and italic quote text.

- `image_caption`  
  - **Best for**: Explaining a screenshot, diagram, or blog image WHEN THE IMAGE MATTERS.
  - **Portrait**: Full-width image with caption text BELOW (stacked), not side-by-side.
  - **Variety rule**: Use at most **2 times per video**. If multiple scenes have images, alternate with `metric`, `timeline`, `flow_diagram`, `bullet_list`, `quote_callout` depending on content.

- `timeline`  
  - **Best for**: Phases, version history, chronological steps. Vertical line with alternating items.

- `data_visualization`  
  - **Best for**: Quantitative stories: trends, distributions, comparisons across categories. Supports bar charts, line charts (series over time or categories), and histogram-style bin counts. Clean light card on the default template (no hero image).  
  - **Data**: Use `barChartRows`, `lineChartLabels` / `lineChartDatasets`, and/or `histogramRows` in layout props as appropriate.

Global variety rules for `preferred_layout`:

- Scene 0 → **always** `hero_image` when possible.  
- NEVER repeat the same layout in consecutive scenes.
- Avoid using the same layout more than **2 times** in the entire video unless truly necessary.

