# Spotlight Template — AI Layout Selection Guide

## Template Philosophy
Spotlight is a **kinetic typography** template. Text IS the design. Everything is bold,
fast, and direct. Think TED talk × motion graphics reel × viral social video.

The pipeline should prioritize impact over decoration. Pick layouts that make words HIT.

---

## Layout Catalog

### `impact_title` — Always Scene 0
Use for the video's opening title. The title text slams in from 200% scale.
Props: none required (uses `title` and `narration` directly).
- Rule: **First scene only.** Never repeat.

### `statement` — Default Workhorse
A sentence splits across 2–3 lines, each dropping in with spring bounce.
One `highlightWord` gets accent color treatment (1 per scene max).
Use when: explaining a key idea, making a thesis statement, setting up context.
Props:
- `highlightWord` (optional): the single most important word in the narration.

### `word_punch` — The Mic Drop
ONE word or short phrase fills the entire frame. Maximum punch.
Use sparingly: **maximum 1 per video**. Best for the single most impactful idea.
Props:
- `word`: 1–3 words maximum. Examples: "FREE.", "3X FASTER", "WHY?", "NOW."

### `cascade_list` — Ordered Impact
Items appear one at a time from the right edge, stacking up. Previous items dim.
Use for: feature lists, numbered takeaways, steps, benefits (3–6 items).
Props:
- `items` (string[]): 3–6 items, each 3–8 words. Extract the ACTUAL key points from narration.

### `stat_stage` — Single Number Spotlight
A giant number dominates the screen with a counter animation.
A frosted glass panel with the label appears below it.
Use when: a single statistic deserves to own the entire frame.
Props:
- `metrics`: array of 1–2 objects:
  - `value` (string): the number, e.g. "97"
  - `label` (string): what it means, e.g. "Customer Satisfaction Score"
  - `suffix` (string, optional): unit e.g. "%" or "x" or "K"

### `versus` — Visual Tension Split
Screen splits: left half WHITE / right half BLACK. Creates instant contrast.
Use for: before/after, old vs new, problem vs solution, two competing approaches.
Props:
- `leftLabel`: 1–4 words for white-bg side (typically the "old" or "problem")
- `rightLabel`: 1–4 words for black-bg side (typically the "new" or "solution")
- `leftDescription` (optional): 1 sentence of context
- `rightDescription` (optional): 1 sentence of context

### `spotlight_image` — Dramatic Reveal
Image reveals from total darkness via a circular spotlight expanding from center.
Cinematic slow zoom. Glass caption strip at the bottom.
Use when: a blog image, screenshot, or diagram deserves dramatic focus.
Props: none extra (uses `title`, `narration`, `imageUrl` from scene).

### `rapid_points` — Machine-Gun Headlines
3–5 short phrases displayed sequentially with HARD CUTS (instant swaps).
Odd-numbered phrases invert to white-on-black for rhythm.
Use for: rapid summaries, quick-fire takeaways, trailer-style energy.
Props:
- `phrases` (string[]): 3–5 phrases, each 3–8 words, each a complete thought.

### `closer` — The Final Frame
Always the last scene. Text sharpens from blur. Accent underline draws under
the key phrase. Small CTA or attribution text appears last.
Props:
- `highlightPhrase` (optional): the key phrase that gets the accent underline
- `cta` (optional): small call-to-action e.g. "Read the full article →"

---

## Scene Sequencing Rules

1. **Scene 0**: Always `impact_title`.
2. **Last scene**: Always `closer`.
3. **`word_punch`**: Maximum 1 per video. Place at the peak moment.
4. **Variety**: Avoid repeating the same layout more than twice in a row.
5. **Images**: Use `spotlight_image` when `imageUrl` is available and dramatic.
6. **Data**: Use `stat_stage` when narration contains a key statistic.
7. **Lists**: Use `cascade_list` when narration enumerates 3+ distinct points.
8. **Contrast**: Use `versus` for any "X vs Y" or "before/after" scene.
9. **Energy**: Use `rapid_points` when the narration is a rapid summary or high-energy takeaway.

## Content Extraction Rules

- For `cascade_list.items`: Extract the ACTUAL bullet points from narration.
  Do NOT reuse the narration text verbatim — condense to 3–8 words per item.
- For `stat_stage.metrics`: Extract the exact number from narration.
  The `value` must be a number string (e.g. "97", "3.2", "50000").
- For `statement.highlightWord`: Pick the single most impactful word.
  It should be a noun, verb, or number — not a filler word like "the" or "and".
- For `closer.highlightPhrase`: Extract the core takeaway (3–8 words).
- For `versus`: The `leftLabel`/`rightLabel` should be SHORT and PUNCHY (1–4 words).
