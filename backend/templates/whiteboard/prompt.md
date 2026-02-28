# Design Philosophy

Whiteboard Story is storytelling-first. Scenes should feel hand-crafted, like a marker is sketching ideas in real time. Use clean off-white background, dark marker strokes, and simple stick-figure metaphors to keep attention on narrative flow.

Core rules:
- Favor narrative progression over dense data.
- Keep text readable and conversational.
- Make each scene feel like a storyboard beat.
- Use hand-drawn motion cues (line reveals, underlines, arrows).

---

# Layout Catalog

## drawn_title
**Visual:** Scene 0 opening title appears as if written by marker stroke. Subtitle fades in under a sketched underline. A small stick figure sits in the bottom-right, looking at the heading.

**Best for:** Hero opening only.

**Props:** none (uses `title`, `narration`).

**When to Use:** scene 0 and chapter-open style moments.

---

## marker_story
**Visual:** Main narrative panel with handwritten-style heading and body text blocks, plus doodle arrows or circles that animate in sequence.

**Best for:** Story progression, explanation beats, narrative context.

**Props:** none (uses `title`, `narration`, optional `imageUrl`).

**When to Use:** majority of storytelling scenes.

---

## stick_figure_scene
**Visual:** Stick figure + symbol scene (e.g., person, goal, obstacle, arrow). Text appears alongside to describe action or emotion.

**Best for:** Turning abstract ideas into simple character-driven visuals.

**Props:** none (uses `title`, `narration`).

**When to Use:** challenge/solution beats, emotional pivot, transformation moments.

---

## stats_figures
**Visual:** Key figures in hand-drawn style: 2–4 big numbers (e.g. "50%", "3x", "10K+") with labels in bordered cards. Animated underline under each value.

**Best for:** Highlighting a few headline stats, outcomes, or proof points.

**Props:** optional `stats` array: `[{ "label": "Growth", "value": "50%" }, ...]`. If omitted, placeholder figures are used.

**When to Use:** data-led story beats, results, comparisons, or "key numbers" moments.

---

## stats_chart
**Visual:** Simple horizontal bar chart with hand-drawn aesthetic. Each row has a label, an animated bar (length from 0–100 or numeric value), and the value text.

**Best for:** Comparing a few options or metrics (e.g. A vs B vs C).

**Props:** optional `stats` array: `[{ "label": "Option A", "value": "85" }, ...]`. Values can be numbers or strings like "85%"; numeric part is used for bar length. If omitted, placeholder bars are used.

**When to Use:** comparisons, rankings, or breakdowns that benefit from a chart.

---

## comparison
**Visual:** Two stick figures (left and right), each with a thought cloud above them. A "vs" sits between. Compare two options, ideas, or thoughts.

**Best for:** Direct comparison of two choices, perspectives, or outcomes.

**Props:** optional `leftThought`, `rightThought` (strings). Content of each thought cloud. If omitted, "Option A" / "Option B" are used.

**When to Use:** pros/cons, before/after, option A vs B, or any two-sided comparison.

---

## countdown_timer
**Visual:** Hand-drawn countdown with a circular progress ring that drains each second, tick marks, and a large center number that pops in. Optional label above and below (e.g. "until launch"). Ring can turn red in the final seconds.

**Best for:** Launch countdowns, "in 3, 2, 1" moments, or building anticipation.

**Props:** optional `stats`: use `stats[0].value` as the starting count (e.g. "5"). Must be a number string between 2 and 9. Uses `title` (above timer) and `narration` (below, e.g. "until launch").

**When to Use:** product launches, chapter transitions, or any dramatic countdown beat.

---

## handwritten_equation
**Visual:** Equation or formula revealed step by step with marker-style type-in. Each step has a label and a value line; the final step gets a hand-drawn highlight box. Ruled lines and ink-style filters.

**Best for:** Teaching a formula, showing a calculation, or step-by-step logic.

**Props:** optional `stats` array: each item `{ "label": "Step name", "value": "expression or result" }`. Used as equation steps (e.g. compound interest formula). If omitted, a sample formula is used. Uses `title` and `narration` for header context.

**When to Use:** math/formula explanations, before/after calculations, or rule-based content.

---

## speech_bubble_dialogue
**Visual:** Two stick figures in conversation with speech bubbles above them. Left and right bubble text reveals in sequence. Optional speaker names below each figure. Title/caption at bottom.

**Best for:** Dialogue, Q&A, or "person A says / person B says" moments.

**Props:** optional `leftThought`, `rightThought` (strings) — content of each speech bubble. Optional `stats[0].label`, `stats[1].label` for speaker names (e.g. "Person A", "Person B"). Uses `title` and `narration` for scene header and caption.

**When to Use:** conversations, debates, or two-perspective storytelling.

---

# Scene Flow Rules

- Scene 0 must use `drawn_title`.
- Prefer `marker_story` as baseline.
- Insert `stick_figure_scene` for key narrative pivots. Use `stats_figures` or `stats_chart` for data; use `comparison` for two-sided comparisons. Use `countdown_timer` for countdowns, `handwritten_equation` for formulas, `speech_bubble_dialogue` for dialogue.
- Keep transitions soft and hand-crafted; avoid harsh kinetic jumps.
- Aim for setup -> development -> payoff structure.

---

# Content Extraction Rules

- `title`: 3-8 words, story beat headline.
- `narration`: concise spoken-style sentence, about 15 words (roughly 12–18 words per scene).
- Emphasize characters, action, and transformation language.
- Avoid jargon-heavy technical formatting in this template.

---

# Variety Rules

- Do not repeat the same layout more than 3 consecutive scenes.
- Alternate between text-led (`marker_story`), metaphor-led (`stick_figure_scene`), stats-led (`stats_figures`, `stats_chart`), comparison (`comparison`), countdown (`countdown_timer`), equation (`handwritten_equation`), and dialogue (`speech_bubble_dialogue`) beats when appropriate.
- End with a clear payoff or conclusion scene that resolves the story arc.
