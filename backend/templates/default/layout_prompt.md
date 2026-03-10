Layout catalog for Geometric Explainer (default)
================================================

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `default` template. Pick the layout that best matches each scene's narration and visual intent, and **spread usage across the video** (aim for 5–7 different layouts in a 7-scene video, never more than 2–3 uses of the same layout unless the content truly demands it).

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
  - **Best for**: Pipelines, workflows, architectures, data flows. Boxes connected by arrows in a horizontal flow.

- `comparison`  
  - **Best for**: A vs B, old vs new, pros vs cons, before vs after. Split screen with vertical divider.

- `metric`  
  - **Best for**: Key numbers, KPIs, performance stats. Large animated numbers with labels and progress bars.

- `quote_callout`  
  - **Best for**: Key quote, definition, insight. Vertical accent bar and italic quote text.

- `image_caption`  
  - **Best for**: Explaining a screenshot, diagram, or blog image. Image on one side, caption text on the other.

- `timeline`  
  - **Best for**: Phases, version history, chronological steps. Vertical line with alternating items.

Global variety rules for `preferred_layout`:

- Scene 0 → **always** `hero_image` when possible.  
- Avoid using the same layout more than **2 times in a row**.

