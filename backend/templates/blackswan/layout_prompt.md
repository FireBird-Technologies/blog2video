Layout catalog for BLACKSWAN template
====================================

Use these layout IDs exactly for `preferred_layout`:

- `droplet_intro`    — opening hero (scene 0 only)
- `neon_narrative`   — default prose narrative
- `arc_features`     — feature / benefit list
- `pulse_metric`     — numbers / KPI data
- `signal_split`     — before/after contrast
- `dive_insight`     — single pull-quote or insight
<<<<<<< HEAD
- `reactor_code`     — code / technical panel
- `flight_path`      — ordered workflow steps
- `ending_socials`   — CTA button + social icons (closing scene only)
=======
- `reactor_code`       — code / technical panel
- `flight_path`        — ordered workflow steps
- `data_visualisation` — real chart from bound table data
- `ticker_table`       — static data table from article
- `ending_socials`     — CTA button + social icons (closing scene only)
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb

Placement rules
---------------

- Scene 0 MUST be `droplet_intro`.
- The LAST scene MUST be `ending_socials` when CTA or social data is available; otherwise close with `dive_insight`, `pulse_metric`, or `neon_narrative`.
- Never repeat the same layout in consecutive scenes.
<<<<<<< HEAD
- For videos with 6+ scenes, include at least one data layout (`pulse_metric`).
- Use `neon_narrative` as the primary fallback when uncertain.
=======
- For videos with 6+ scenes, include at least one data layout (`pulse_metric`, `data_visualisation`, or `ticker_table`).
- Use `neon_narrative` as the primary fallback when uncertain.
- `data_visualisation` and `ticker_table` ONLY when the pipeline binds a `data_table_index` — never invent figures.
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
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
<<<<<<< HEAD
=======
- If scene is bound to chartable table data: `data_visualisation`.
- If source has a multi-row tabular dataset: `ticker_table`.
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
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
<<<<<<< HEAD
| flight_path     | `phrases` (string[], 3–8 steps in order)                                    |
| ending_socials  | `ctaButtonText`, `websiteLink`, `showWebsiteButton`, `socials` (object)     |
=======
| flight_path          | `phrases` (string[], 3–8 steps in order)                                    |
| data_visualisation   | `chartTable`, `chartType`, `chartSummary`, `subtitle`, `yAxisLabel`, `chartYAxisTicks` (from bound table) |
| ticker_table         | `tickerTable`, `tickerTitle`, `tickerHighlightCol`, `tickerFootnote`          |
| ending_socials       | `ctaButtonText`, `websiteLink`, `showWebsiteButton`, `socials` (object)     |

>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
