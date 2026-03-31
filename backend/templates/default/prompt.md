# Design Philosophy

Geometric Explainer is a clean, modern video style for technical and educational content. It uses flat geometric shapes, terminal-style code blocks, animated metrics with progress bars, and connected flow diagrams with arrows. The aesthetic is professional and documentary-like — not a text slideshow. Colors are minimal: white background, dark text, accent purple for highlights and geometric decorations. Every layout has built-in transitions (fade-in, slide, scale, stagger) so the video feels polished and dynamic.

---

# Layout Catalog

## hero_image
**Visual:** Full-bleed image with title overlay and gradient scrim. The image fills the frame; title and optional subtitle appear over a dark gradient at the bottom. Clean, cinematic opening.
**Best for:** Always scene 0. The opening/hero moment.
**Props:** (none — uses title + narration + imageUrl from runtime)

## text_narration
**Visual:** Centered text with floating geometric shapes behind. A single panel with title and body paragraph. Optional decorative shapes (circles, lines) in the background. The LEAST visually engaging layout.
**Best for:** Introductions, conclusions, general explanations. Use as ABSOLUTE LAST RESORT — max 1 per video.
**Props:** (none — uses title + narration directly)

## code_block
**Visual:** Dark terminal-style card with syntax-highlighted code and line numbers. Lines typewrite in one by one with a blinking cursor. Monospace font, dark background.
**Best for:** Code snippets, terminal commands, API calls, config files.
**Props:** codeLines (string[]), codeLanguage (string, e.g. "python", "javascript")

## bullet_list
**Visual:** Numbered pills with text, staggered vertically. Each bullet is a rounded pill/card with a number and short text. Animates slide-in from left, staggered.
**Best for:** Features, benefits, steps, takeaways. Max 6 items.
**Props:** bullets (string[]) — max 6 items, each 5–10 words

## flow_diagram
**Visual:** Rounded boxes connected by animated arrows, horizontal layout. Each step is a box; arrows draw between them sequentially.
**Best for:** Pipelines, workflows, processes, data flows, architectures. Max 5 steps.
**Props:** steps (string[]) — max 5 steps, short 2–4 word labels

## comparison
**Visual:** Split screen with vertical divider. Left and right content cards with labels and descriptions. Cards slide in from opposite sides.
**Best for:** Pros/cons, old/new, before/after, A vs B.
**Props:** leftLabel (string), rightLabel (string), leftDescription (string), rightDescription (string)

## metric
**Visual:** Giant animated number with counter roll-up, progress bar below. One or more large numbers with labels. Numbers animate count-up.
**Best for:** Statistics, percentages, KPIs, benchmarks, performance numbers. Max 3 metrics.
**Props:** metrics (array of {value: string, label: string, suffix?: string}) — max 3 items

## quote_callout
**Visual:** Left accent bar + italic quote text + subtle glow. A vertical accent bar on the left, quote text in italics, optional author.
**Best for:** Key quotes, definitions, insights, important callouts.
**Props:** quote (string), quoteAuthor (string)

## image_caption
**Visual:** Image card on left, caption text on right. Side-by-side layout. Image and text slide in in parallel.
**Best for:** Explaining a screenshot, diagram, or blog image. Uses imageUrl from runtime.
**Props:** (none — uses title + narration + imageUrl from runtime)

## timeline
**Visual:** Vertical line with dots, text items alternating left/right. Chronological flow with labeled phases.
**Best for:** Phases, version history, ordered milestones, chronological steps. Max 4 items.
**Props:** timelineItems (array of {label: string, description: string}) — max 4 items

## data_visualization
**Visual:** Light page background with a white rounded card, subtle shadow, and a thin accent gradient line along the top. One or more charts: **bar** (grouped bars), **line** (one or more series over shared X labels), and/or **histogram** (adjacent bins, no gaps between bars). Charts stagger-animate in; title above the card; optional longer narration below a divider when the narration is substantive.
**Best for:** Numbers over categories, trends over time or ordered categories, frequency distributions / bin counts. No scene image — charts are the focus.
**Props (put these in `layoutProps` when `preferred_layout` is `data_visualization`):**
- **barChartRows** — `array of { label: string, value: string }` — each `value` is a numeric string (e.g. `"24"`). Up to **12** rows. Use for category comparisons.
- **lineChartLabels** — `string[]` — X-axis labels (e.g. months, quarters, steps). Up to **12** labels. Must align in length with each series’ values.
- **lineChartDatasets** — `array of { label: string, valuesStr: string }` — `valuesStr` is comma-separated numbers in the **same order** as `lineChartLabels` (same count). Up to **6** series. Example: `valuesStr: "10, 20, 15"` for three labels.
- **histogramRows** — `array of { label: string, value: string }` — bin or range label + count as numeric string. Up to **16** bins. Use for distributions (e.g. `"0–10"`, `"11–20"`).

Include only the chart blocks that match the narration. You may combine bar + line + histogram in one scene if the content supports it.

---

## hero_image
**Visual:** A full-screen background image is overlaid with a colorful diagonal gradient, transitioning from purple to blue. A large, uppercase title and optional subtitle are centered on top, animating in with a subtle upward motion.

**When to Use:** Use the `hero_image` layout for impactful video introductions, title screens, or section breaks that need to grab the viewer's attention.

**Avoid When:** Avoid this layout for displaying long paragraphs or detailed, multi-point information.

**Notes:**
* The purple-to-blue diagonal gradient overlay is a fixed part of the design and cannot be customized.
* The title text is automatically converted to uppercase.
* The background image has a subtle zoom-out animation applied throughout the scene.

---

## bullet_list
**Visual:** An animated, numbered list where each point slides in. Each item features a circular number, a main point in a colored, pill-shaped container, and an optional description underneath.

**Props:**
  - `points` (object_array) — An array of objects for the list items. Each object must have a `key` (the main text) and an optional `value` (the description).

**When to Use:** Use the `bullet_list` layout to present a sequence of key features, benefits, or takeaways in a visually distinct and structured manner.

**Avoid When:** Avoid this layout for very long text descriptions that would compromise the design.

**Notes:**
- The text for each point's title (`key`) is automatically transformed to uppercase.
- The description (`value`) for each point is optional; if omitted, only the pill-shaped title will be shown.
- For best results, keep the number of points between 2 and 5.

---

## data_visualization
**Visual:** Clean explainer-style data panel: white card on a light neutral background, accent-colored chart elements, dark text. Bar and histogram use animated bars; line chart draws series with points and connecting lines.

**Props (required shape for the scene generator — names must match exactly):**
- `barChartRows` — object_array: each row `{ "label": "<category>", "value": "<number as string>" }`.
- `lineChartLabels` — string_array: shared X labels for every line series.
- `lineChartDatasets` — object_array: each `{ "label": "<series name>", "valuesStr": "<comma-separated numbers>" }`. The number of values after splitting by comma must equal `lineChartLabels.length`.
- `histogramRows` — object_array: each `{ "label": "<bin or range>", "value": "<count as string>" }`.

**When to Use:** Use `data_visualization` when the blog content implies charts: statistics by category, trends over periods, or frequency distributions. Prefer it over `metric` when you need multiple points or a full series, not just 1–3 headline numbers.

**Avoid When:** Avoid when there are no numeric series to plot — use `metric` or `bullet_list` instead.

**Notes:**
- Values in `barChartRows`, `histogramRows`, and inside `valuesStr` must be plausible numbers derived from the source text; do not invent data that contradicts the article.
- If only one chart type is needed, omit the other props entirely (do not send empty arrays unless the schema expects them).

---

# Scene Flow Rules

- **Scene 0:** Always hero_image. No exceptions.
- **Opening (scenes 1–2):** Prefer text_narration or bullet_list for setup. Avoid starting with metric or code_block.
- **Middle:** Alternate between data-heavy (metric, code_block, **data_visualization**), visual (image_caption, flow_diagram), and impact (quote_callout, comparison). Vary the rhythm.
- **Closing:** Prefer quote_callout for the key takeaway, or text_narration if the conclusion needs a longer plain paragraph (use sparingly).
- **text_narration:** Use at most 1 time in the entire video. Ideally zero.

---

# Content Extraction Rules

- **code_block:** Extract ACTUAL code, commands, or API calls from the narration. Use real syntax, real variable names. Include 3–8 lines. Never fabricate.
- **bullet_list:** Pull the ACTUAL items, features, or steps. Each bullet = 5–10 words, concise phrase. Max 6.
- **flow_diagram:** Extract the ACTUAL process steps. Short 2–4 word labels per step. Max 5. Think: Input → Process → Validate → Output.
- **metric:** Extract REAL numbers from the narration. value="40", label="Error reduction", suffix="%". Round numbers, clear labels.
- **comparison:** Extract the ACTUAL two sides. Clear contrasting labels and 1–2 sentence descriptions each.
- **quote_callout:** Extract the KEY insight or quotable statement. 1–2 impactful sentences. Never fabricate.
- **timeline:** Extract 3–4 chronological phases with short labels and 1-line descriptions.
- **data_visualization:** Extract **real numbers** from the article for charts. Build `barChartRows` for category-vs-value data; `lineChartLabels` + `lineChartDatasets` when the text gives a trend or sequence over named steps or time periods (comma-separated values must match label count); `histogramRows` when the content describes frequencies, buckets, or binned counts. Use short axis/bin labels. If the source only gives approximate figures, state them consistently — do not contradict the narration.

---

# Variety Rules

- NEVER use the same layout for more than 2 consecutive scenes.
- A 7-scene video should use 5–7 DIFFERENT layout types.
- text_narration is the baseline fallback — use only when nothing else fits. Max 1 per video.
- When in doubt between text_narration and ANY other layout, ALWAYS choose the other layout.
- Alternate visual rhythm: data scene → narrative scene → impact scene.
