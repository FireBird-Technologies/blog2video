Layout catalog for Whiteboard (Stick Man) template
==================================================

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `whiteboard` template. The tone is hand-drawn, storytelling-first with stick-figure metaphors.

- `drawn_title`  
  - **Best for**: Scene 0 hero. Hand-drawn title with marker animation.  
  - **Rule**: Use only for the opening.

- `marker_story`  
  - **Best for**: Main narrative beats; marker-drawn explanations.

- `stick_figure_scene`  
  - **Best for**: Visual metaphors and character/story moments using stick figures.

- `stats_figures`  
  - **Best for**: Big stats and “by the numbers” scenes using drawn figures.

- `stats_chart`  
  - **Best for**: Chart-like stats scenes (bars/lines as whiteboard drawings).

- `comparison`  
  - **Best for**: Two-option comparisons using two stick figures / columns.

- `countdown_timer`  
  - **Best for**: Countdown / time-limited beats.

- `handwritten_equation`  
  - **Best for**: Step-by-step equations and math/finance formulas.

- `speech_bubble_dialogue`  
  - **Best for**: Dialog between two characters in speech bubbles.

- `ending_socials`
  - **Best for**: Final scene only — hand-drawn sign-off with stick figure, social icons, and website CTA.
  - **Rule**: Use **only** on the last scene when CTA or social data is available.

- `data_visualisation`
  - **Best for**: A real chart (line / bar / histogram) rendered from an ACTUAL data table in the article.
  - **Rule**: Use ONLY when a scene is bound to a chartable table (the pipeline sets `preferred_layout='data_visualisation'` and a `data_table_index`). Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges. Never invent figures — values come from the bound table.

- `ticker_table`
  - **Best for**: Displaying a static data table (rows × columns) from the article — rankings, comparisons, schedules. Up to 20 rows, 6 columns.
  - **Rule**: Use ONLY when the source contains a real tabular dataset. Never invent rows. Column 1 = row labels; columns 2–6 = values. Optionally set `tickerHighlightCol` to the 0-based index of the value column to green/red color by sign.

Variety rules:

- Scene 0 → `drawn_title`.  
- Early scenes: prefer `marker_story` or `stick_figure_scene` to establish the narrative.  
- Mix in `stats_figures` / `stats_chart` for data, `comparison` for A vs B, `speech_bubble_dialogue` for conversations, etc.
- `data_visualisation` and `ticker_table` are reserved for scenes the pipeline binds to a real table (`data_table_index` set).
- The last scene → `ending_socials` when CTA or social data is available.

