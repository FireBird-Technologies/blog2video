# Design Philosophy

Newspaper is editorial and news-style. Scenes should feel like a well-designed news article: clear headlines, lead paragraphs, pull quotes, data snapshots, fact-check panels, and timelines. Use a warm paper background, serif headlines, and structured layouts that build credibility.

Core rules:
- Favor clarity and hierarchy over decorative flair.
- Keep text readable and factual in tone.
- Use section labels, bylines, and attribution where appropriate.
- Each scene should feel like a distinct article element (headline, lead, quote, stats, timeline).

---

# Layout Catalog

## news_headline
**Visual:** Hero news card. Category tag with underline, large serif headline (optional highlight on key words), thin rule, subhead/narration, byline and date.

**Best for:** Opening scene only; the main story headline.

**Props:** optional `category` (section tag, e.g. "Politics"); optional `leftThought` = comma-separated words to highlight in headline; optional `stats`: `stats[0].value` = author, `stats[1].value` = date string.

**When to Use:** scene 0, story opener.

---

## article_lead
**Visual:** Article lead paragraph with drop cap, body text type-in, and optional pull-stat card (big number + caption) to the side.

**Best for:** Main narrative, opening paragraph, key context.

**Props:** optional `stats[0].value` = pull-stat number (e.g. "800"), `stats[0].label` = caption (e.g. "federal workers affected"). Uses `title` as section label (e.g. "The Story"), `narration` as lead text.

**When to Use:** second scene or any scene that introduces the story body.

---

## pull_quote
**Visual:** Large serif quote with vertical accent bar, attribution line, and optional source/date.

**Best for:** Key quote, testimonial, or standout statement.

**Props:** uses `narration` as the quote text, `title` or `stats` for attribution/source.

**When to Use:** impactful quotes, expert statements, or emotional beats.

---

## data_snapshot
**Visual:** 2–4 stat cards with big number, accent underline, and label. Clean bordered cards.

**Best for:** Key figures, by-the-numbers, outcomes.

**Props:** optional `stats` array: `[{ "label": "Federal workers affected", "value": "800K" }, ...]`. Up to 4 items. If omitted, placeholder figures are used.

**When to Use:** data-led beats, results, metrics, or "key numbers" moments.

---

## fact_check
**Visual:** Two columns: "Claimed" (left) and "The Facts" (right), with optional verdict line at bottom. Accent highlight on claim label.

**Best for:** Myth-busting, claim vs reality, clarification.

**Props:** optional `leftThought` = claimed statement; optional `rightThought` = fact statement; optional `stats` for verdict or labels.

**When to Use:** correcting misconceptions, comparing claim vs fact.

---

## news_timeline
**Visual:** Vertical timeline with spine, date labels, and event descriptions. Latest event can be emphasized with accent.

**Best for:** How we got here, chronology, key dates.

**Props:** optional `stats` array: each item `{ "value": "Jan 31", "label": "Event description" }` for date and text. If omitted, placeholder timeline is used.

**When to Use:** sequence of events, history, process over time.

---

# Scene Flow Rules

- Scene 0 must use `news_headline`.
- Prefer `article_lead` for the second scene and narrative context.
- Use `pull_quote` for quotes, `data_snapshot` for stats, `fact_check` for claim vs fact, `news_timeline` for chronology.
- Keep transitions clear and editorial; avoid chaotic motion.
- Aim for setup (headline/lead) → development (quote, stats, fact-check) → resolution or timeline.

---

# Content Extraction Rules

- `title`: 3–8 words, headline or section label.
- `narration`: concise sentence, about 12–20 words per scene (lead paragraphs can be slightly longer).
- Use factual, neutral language suitable for news/editorial tone.
- Include attribution or source hints where relevant (byline, quote source, date).

---

# Variety Rules

- Do not repeat the same layout more than 3 consecutive scenes.
- Alternate between headline/lead, quote, data, fact-check, and timeline when the content fits.
- End with a clear conclusion: closing quote, final stat, or timeline endpoint.
