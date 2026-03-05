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

Global variety rules for `preferred_layout`:

- Scene 0 → **always** `news_headline`.  
- Strongly prefer using **article_lead** for scene 1 or 2 when the story body starts.  
- Alternate between quote (`pull_quote`), data (`data_snapshot`), fact-check (`fact_check`), and timeline (`news_timeline`) when content allows.  

