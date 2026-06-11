Layout catalog for THE ECONOMIST template
==========================================

Use these layout IDs exactly for `preferred_layout`:

- `cover_reveal`    — magazine cover intro (scene 0 only)
- `leader_article`  — drop-cap article page (default prose workhorse + fallback)
- `section_divider` — full-bleed chapter break
- `chart_line`      — line chart over time (custom SVG, right axis, end-labels)
- `chart_bar`       — bar chart across categories (vertical or ranked horizontal)
- `data_table`      — ranked table with inline magnitude bars
- `pros_cons`       — signature blue PROS / red CONS debate page
- `key_indicators`  — "by the numbers" KPI panel
- `leader_quote`    — oversized pull-quote
- `image_feature`   — full-bleed photo feature (requires a real image)
- `ending_socials`  — sign-off masthead + CTA + socials (closing scene only)

Placement rules
---------------

- Scene 0 MUST be `cover_reveal`.
- The LAST scene MUST be `ending_socials` when CTA or social context is available; otherwise close with `key_indicators` or `leader_quote`.
- `cover_reveal` and `ending_socials` are never used mid-video.
- Never repeat the same layout in consecutive scenes; never place two chart layouts back-to-back.
- `pros_cons` appears at most once per video.
- `section_divider` appears at most twice per video, and only to introduce a genuinely new section.
- `image_feature` requires a real editorial image; do not select it otherwise.
- `chart_line` / `chart_bar` / `data_table` require real numeric data from the source; never select a data layout to display invented numbers.
- `leader_article` is the primary fallback whenever uncertain. Keep it to ≤40% of scenes.

Selection heuristics (in order of precedence)
--------------------------------------------

- Scene 0 → `cover_reveal`.
- Final scene with CTA/social context → `ending_socials`.
- Two-sided decision / trade-off / "should X?" / bull-vs-bear → `pros_cons`.
- A trend over time with real numbers → `chart_line`.
- A comparison/ranking across categories with real numbers → `chart_bar` (use `hbar` for rankings) or `data_table` (for league tables).
- A few headline figures summarising an economy/company → `key_indicators`.
- A single resonant real quotation or thesis sentence → `leader_quote`.
- A photo-led beat with a real editorial image → `image_feature`.
- A shift to a new theme in a longer video → `section_divider`.
- Otherwise (explanatory prose) → `leader_article`.

Shape sketch for a 6–10 scene video
-----------------------------------

cover_reveal → leader_article → chart_line (or chart_bar) → pros_cons → key_indicators → leader_quote → (section_divider → leader_article → data_table) → ending_socials

Variety guardrails
------------------

- Vary the rhythm: alternate prose, data and argument scenes; do not stack similar layouts.
- At most one `pros_cons`, at most two `section_divider`, charts never consecutive.
- CTA passthrough: `ending_socials` uses whatever CTA/social context is provided — never hardcode the CTA copy.
