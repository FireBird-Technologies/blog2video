Layout catalog for Newscast template
====================================================

**Optional background image (all layouts):** Every layout may include `layoutProps.imageUrl` when a relevant image URL is available. It is a full-bleed editorial photo plate behind NEWSCAST chrome (globe, glass panels, typography)—it does not replace titles or UI. Omit `imageUrl` when no suitable image exists.

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `newscast` template.

- `cinematic_title`
  - Best for: Scene 0 hero (ALWAYS).
  - Rule: Use only for the opening scene.

- `glass_narrative`
  - Best for: Story context / main explanation scenes.

- `glow_metric`
  - Best for: 1–3 key numeric metrics and statistics.

- `glass_code`
  - Best for: Code snippets / terminal / config examples.

- `kinetic_insight`
  - Best for: One powerful sentence / quote / defining moment.

- `glass_stack`
  - Best for: 2–3 key provisions/features presented as a short list.

- `split_glass`
  - Best for: Before/after, problem/solution, or other two-sided contrasts.

- `chapter_break`
  - Best for: Major section transitions / pacing breaks.

- `glass_image`
  - Best for: Image-dominant scenes with Ken Burns effect and caption.

- `data_visualization`
  - Best for: Chart-driven content (bar/line/pie).

- `ending_socials`
  - Best for: **Final scene only** — follow-along, social handles, and website CTA (when the script pipeline reserves the last scene for the ending).
  - Rule: Use **only** on the last scene when `preferred_layout` is set to `ending_socials` for that scene; do not use it elsewhere.

Global selection rules:
- Scene 0 -> `cinematic_title` always.
- Prefer `glass_narrative` or `chapter_break` for scenes 1–2.
- When the last scene is the pipeline ending: use `ending_socials` for that scene. Otherwise the final scene should be a strong close: `glass_narrative`, `kinetic_insight`, or `glow_metric`.
- Never repeat the same layout in consecutive scenes.
- Prefer variety: glass cards and impact moments alternating.

