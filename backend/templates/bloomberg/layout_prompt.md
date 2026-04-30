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
- `terminal_dataviz`   — bar / line / histogram chart from extracted table data
- `terminal_list`      — bullet / watch list
- `terminal_metric`    — large dominant metric tiles
- `terminal_profile`   — display profile matrix (THME only)
- `terminal_options`   — options chain table (OPTS only)
- `ending_socials`     — CTA prompt + social icons (closing scene only)

Placement rules
---------------

- Scene 0 MUST be `terminal_boot`.
- The LAST scene MUST be `ending_socials` when CTA or social data is available; otherwise close with `terminal_metric` or `terminal_narrative`.
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
- If narration has numeric comparison / trend data that is NOT candlestick price data → `terminal_dataviz`
- If narration provides a watch list or action items → `terminal_list`
- If narration highlights dominant macro figures or rates → `terminal_metric`
- If narration covers options chain / vol / skew → `terminal_options`
- If this is the final scene and CTA / social context is present → `ending_socials`
