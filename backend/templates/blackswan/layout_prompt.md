Layout catalog for BLACKSWAN template
====================================

Use these layout IDs exactly for `preferred_layout`:

- `droplet_intro`    — opening hero (scene 0 only)
- `neon_narrative`   — default prose narrative
- `arc_features`     — feature / benefit list
- `pulse_metric`     — numbers / KPI data
- `signal_split`     — before/after contrast
- `dive_insight`     — single pull-quote or insight
- `reactor_code`     — code / technical panel
- `flight_path`      — ordered workflow steps
- `ending_socials`   — CTA button + social icons (closing scene only)

Placement rules
---------------

- Scene 0 MUST be `droplet_intro`.
- The LAST scene MUST be `ending_socials` when CTA or social data is available; otherwise close with `dive_insight`, `pulse_metric`, or `neon_narrative`.
- Never repeat the same layout in consecutive scenes.
- For videos with 6+ scenes, include at least one data layout (`pulse_metric`).
- Use `neon_narrative` as the primary fallback when uncertain.
- `ending_socials` must NOT be used mid-video.

Selection heuristics
--------------------

- If narration is mostly explanatory prose: `neon_narrative`.
- If narration provides multiple bullet-style points: `arc_features`.
- If narration includes strong numeric claims: `pulse_metric`.
- If narration contrasts two states/options: `signal_split`.
- If narration provides process order: `flight_path`.
- If narration includes technical implementation/code steps: `reactor_code`.
- If narration has one memorable line: `dive_insight`.
- If this is the final scene and CTA/social context is present: `ending_socials`.

Props quick-reference
---------------------

| Layout          | Required layout props                                                       |
|-----------------|-----------------------------------------------------------------------------|
| droplet_intro   | *(none — uses global title + narration)*                                    |
| neon_narrative  | *(none — uses global title + narration)*                                    |
| arc_features    | `items` (string[], 3–6 items)                                               |
| pulse_metric    | `metrics` (array of `{value, label, suffix}`, 1–4 items)                   |
| signal_split    | `leftLabel`, `rightLabel`, `leftDescription`, `rightDescription`            |
| dive_insight    | `quote` (string), `highlightWord` (optional single word in quote)           |
| reactor_code    | `codeLanguage` (string), `codeLines` (string[], 3–10 lines)                 |
| flight_path     | `phrases` (string[], 3–8 steps in order)                                    |
| ending_socials  | `ctaButtonText`, `websiteLink`, `showWebsiteButton`, `socials` (object)     |
