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

---

# Scene Flow Rules

- **Scene 0:** Always hero_image. No exceptions.
- **Opening (scenes 1–2):** Prefer text_narration or bullet_list for setup. Avoid starting with metric or code_block.
- **Middle:** Alternate between data-heavy (metric, code_block), visual (image_caption, flow_diagram), and impact (quote_callout, comparison). Vary the rhythm.
- **Closing:** Prefer quote_callout for the key takeaway, or editorial_body if the conclusion is longer.
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

---

# Variety Rules

- NEVER use the same layout for more than 2 consecutive scenes.
- A 7-scene video should use 5–7 DIFFERENT layout types.
- text_narration is the baseline fallback — use only when nothing else fits. Max 1 per video.
- When in doubt between text_narration and ANY other layout, ALWAYS choose the other layout.
- Alternate visual rhythm: data scene → narrative scene → impact scene.
