Layout catalog for Newspaper template
=====================================

Use these layout IDs **exactly** when suggesting `preferred_layout` for scenes using the `newspaper` template. Think like an editor: each scene should feel like a distinct article element. Distribute layouts across the story (headline → lead → quotes → data → fact-check → timeline) instead of repeating one layout.

- `news_headline`  
  - **Best for**: Scene 0 hero. Category tag, large serif headline, subhead, byline, date.  
  - **Rule**: Use **only for the opening scene**.

- `article_lead`  
  - **Best for**: Main narrative body / opening context. Lead paragraph with drop cap and optional pull-stat card.  
  - **Use for**: Second scene or any scene that introduces core story context.

- `pull_quote`  
  - **Best for**: Key quote, testimonial, or standout statement. Large serif quote with attribution line.

- `data_snapshot`  
  - **Best for**: Key numbers and by-the-numbers sections. 2–4 stat cards with big numbers and labels.

- `fact_check`  
  - **Best for**: Claim vs facts. Two columns: “Claimed” and “The Facts”, plus optional verdict.

- `news_timeline`  
  - **Best for**: Chronology. Vertical timeline of events with dates and descriptions.

- `expert_profile`
  - **Best for**: Spotlighting a named expert, source, or key person behind the story. Landscape: photo on the left with name/role credit, title + bio + stat on the right. Portrait: full-width photo + info stacked below.
  - **Props**: `leftThought` = expert's name; `rightThought` = expert's role/title; `imageUrl` = headshot; `category` = section label (e.g. "Expert Voices"); `stats[0]` = `{ value: "20yr", label: "in Policy" }` for a stat badge; `narration` = short bio or quote.
  - **Rule**: Use when the scene centers on a named individual with a photo. Requires `imageUrl`.

- `perspective_split`
  - **Best for**: Two-sided comparison without a verdict — editorial "both sides" framing. Full-width title, two panels (left with accent border, right with text border), optional narration below.
  - **Props**: `leftThought` = left panel argument text; `rightThought` = right panel argument text; `stats[0]` = `{ label: "SUPPORTERS SAY", value: "+14%" }`; `stats[1]` = `{ label: "CRITICS SAY", value: "$1.2T" }`; `category` = optional section label.
  - **Rule**: Use for balanced "here's both sides" editorial moments. No image needed.

- `data_visualisation`
  - **Best for**: A real chart (line / bar / histogram) rendered from an ACTUAL data table in the article.
  - **Rule**: Use ONLY when a scene is bound to a chartable table (the pipeline sets `preferred_layout='data_visualisation'` and a `data_table_index`). Line = trend over time; bar = comparison between named categories; histogram = distribution over numeric bins/ranges. Never invent figures — values come from the bound table.

- `ticker_table`
  - **Best for**: Displaying a static data table (rows × columns) from the article — rankings, comparisons, schedules, financial figures. Up to 20 rows, 6 columns.
  - **Rule**: Use ONLY when the source contains a real tabular dataset. Never invent rows. Column 1 = row labels; columns 2–6 = values. Optionally set `tickerHighlightCol` to the 0-based index of the value column that should be green/red coded (positive/negative numbers).

- `ending_socials`
  - **Best for**: Final scene only — follow-along CTA, social handles, and website link on a vintage editorial sign-off card.
  - **Rule**: Use **only** on the last scene when CTA or social data is available; do not use mid-video.

Global variety rules for `preferred_layout`:

- Scene 0 → **always** `news_headline`.  
- The last scene → **`ending_socials`** when CTA or social data is available; otherwise close with `pull_quote`, `data_snapshot`, or `news_timeline`.
- Strongly prefer using **article_lead** for scene 1 or 2 when the story body starts.  
- Alternate between quote (`pull_quote`), data (`data_snapshot`, `data_visualisation`, `ticker_table`), fact-check (`fact_check`), and timeline (`news_timeline`) when content allows.
- `data_visualisation` and `ticker_table` are reserved for scenes the pipeline binds to a real table (`data_table_index` set).

