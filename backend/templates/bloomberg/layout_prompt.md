Layout catalog for BLOOMBERG template
======================================

Use these layout IDs exactly for `preferred_layout`:

- `terminal_boot`      — opening boot sequence (scene 0 only)
- `terminal_narrative` — default prose narrative panel
- `terminal_chart`     — chart analysis with indicator sidebar
- `terminal_dashboard` — multi-KPI grid (market overview)
- `terminal_ticker`    — screener / movers list
- `terminal_table`     — data table (portfolio, financials)
- `terminal_split`     — two-column contrast panel
- `terminal_quote`     — pull-quote / desk note
- `terminal_list`      — bullet / watch list
- `terminal_metric`    — large dominant metric tiles
- `terminal_profile`   — display profile matrix (THME only)
- `terminal_options`   — options chain table (OPTS only)
- `ending_socials`     — CTA prompt + social icons (closing scene only)

Placement rules
---------------

- Scene 0 MUST be `terminal_boot`.
- The LAST scene MUST be `ending_socials` when CTA or social data is available; otherwise close with `terminal_quote` or `terminal_metric`.
- Never repeat the same layout in consecutive scenes.
- For videos with 6+ scenes, include at least one data layout (`terminal_dashboard`, `terminal_metric`, or `terminal_table`).
- Use `terminal_narrative` as the primary fallback when uncertain.
- `ending_socials` must NOT be used mid-video.
- `terminal_profile` is only appropriate for theme/profile overview content.
- `terminal_options` is only appropriate for options chain / derivatives content.

Selection heuristics
--------------------

- If narration is mostly explanatory prose → `terminal_narrative`
- If narration covers market overview / multiple indices → `terminal_dashboard`
- If narration focuses on chart or technical indicators → `terminal_chart`
- If narration lists top movers or screener results → `terminal_ticker`
- If narration covers portfolio positions or financial statements → `terminal_table`
- If narration contrasts two market states or scenarios → `terminal_split`
- If narration has one memorable thesis or desk note → `terminal_quote`
- If narration provides a watch list or action items → `terminal_list`
- If narration highlights dominant macro figures or rates → `terminal_metric`
- If narration covers options chain / vol / skew → `terminal_options`
- If this is the final scene and CTA / social context is present → `ending_socials`

Props quick-reference
---------------------

| Layout              | Required layout props                                                             |
|---------------------|-----------------------------------------------------------------------------------|
| terminal_boot       | `items` (string[], 4–8 boot log lines)                                            |
| terminal_narrative  | *(none — uses global title + narration)*                                          |
| terminal_chart      | `items` (string[], 3–8 indicator readout lines)                                   |
| terminal_dashboard  | `metrics` (array of `{value, label, suffix}`, 2–6 items)                         |
| terminal_ticker     | `items` (string[], 4–10 preformatted ticker rows)                                 |
| terminal_table      | `items` (string[], row 0 = header, rows 1–N = data, up to 12)                    |
| terminal_split      | `leftLabel`, `rightLabel`, `leftDescription`, `rightDescription`                  |
| terminal_quote      | `quote` (string), `highlightWord` (optional single word in quote)                 |
| terminal_list       | `items` (string[], 3–8 short clause items)                                        |
| terminal_metric     | `metrics` (array of `{value, label, suffix}`, 1–4 items)                         |
| terminal_profile    | `items` (string[], 3–8 profile rows: "NAME   Description")                       |
| terminal_options    | `items` (string[], row 0 = header, rows 1–N = chain rows, up to 12)              |
| ending_socials      | `ctaButtonText`, `websiteLink`, `showWebsiteButton`, `socials` (object)           |
