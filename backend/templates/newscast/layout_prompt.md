Layout catalog for Newscast template
====================================================

**Optional background image (all layouts):** Every layout may include `layoutProps.imageUrl` when a relevant image URL is available. It is a full-bleed editorial photo plate behind NEWSCAST chrome (globe, glass panels, typography)—it does not replace titles or UI. Omit `imageUrl` when no suitable image exists.

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `newscast` template.

- `opening` (Newscast Opening)
  - Best for: Scene 0 hero (ALWAYS).
  - Rule: Use only for the opening scene.

- `anchor_narrative` (Anchor Narrative)
  - Best for: Story context / main explanation scenes.

- `live_metrics_board` (Live Metrics Board)
  - Best for: 1–3 key numeric metrics and statistics.

- `briefing_code_panel` (Briefing Code Panel)
  - Best for: Code snippets / terminal / config examples.

- `headline_insight` (Headline Insight)
  - Best for: One powerful sentence / quote / defining moment.

- `story_stack` (Story Stack)
  - Best for: 2–3 key provisions/features presented as a short list.

- `side_by_side_brief` (Side-by-Side Brief)
  - Best for: Before/after, problem/solution, or other two-sided contrasts.

- `segment_break` (Segment Break)
  - Best for: Major section transitions / pacing breaks.

- `field_image_focus` (Field Image Focus)
  - Best for: Image-dominant scenes with Ken Burns effect and caption.

- `data_visualization`
  - Best for: Chart-driven content (bar/line/pie).

- `ending_socials`
  - Best for: **Final scene only** — follow-along, social handles, and website CTA (when the script pipeline reserves the last scene for the ending).
  - Rule: Use **only** on the last scene when `preferred_layout` is set to `ending_socials` for that scene; do not use it elsewhere.

Legacy compatibility note:
- Older IDs like `newscast_cinematic_title` and `newscast_glass_narrative` are still accepted by the renderer, but prompts should emit canonical IDs above.

Global selection rules:
- Scene 0 -> `opening` always.
- Prefer `anchor_narrative` or `segment_break` for scenes 1–2.
- When the last scene is the pipeline ending: use `ending_socials` for that scene. Otherwise the final scene should be a strong close: `anchor_narrative`, `headline_insight`, or `live_metrics_board`.
- Never repeat the same layout in consecutive scenes.
- Prefer variety: glass cards and impact moments alternating.

