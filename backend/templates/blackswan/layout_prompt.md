Layout catalog for BLACKSWAN template
====================================

Use these layout IDs exactly for `preferred_layout`:

- `droplet_intro` (opening hero only)
- `swan_title` (early title reinforcement)
- `neon_narrative` (default narrative)
- `arc_features` (feature list)
- `pulse_metric` (number/KPI scene)
- `signal_split` (before/after contrast)
- `dive_insight` (single quote/insight)
- `wing_stack` (stacked concise points)
- `reactor_code` (technical/code panel)
- `flight_path` (workflow steps)
- `frequency_chart` (bar-style data)

Placement rules
---------------

- Scene 0 MUST be `droplet_intro`.
- Scene 1 should usually be `swan_title`.
- Never repeat the same layout in consecutive scenes.
- For videos with 6+ scenes, include at least one data layout:
  - `pulse_metric` or `frequency_chart`.
- Use `neon_narrative` as the primary fallback when uncertain.

Selection heuristics
--------------------

- If narration is mostly explanatory prose: `neon_narrative`.
- If narration provides multiple bullet-style points: `arc_features` or `wing_stack`.
- If narration includes strong numeric claims: `pulse_metric` or `frequency_chart`.
- If narration contrasts two states/options: `signal_split`.
- If narration provides process order: `flight_path`.
- If narration includes technical implementation/code steps: `reactor_code`.
- If narration has one memorable line: `dive_insight`.
