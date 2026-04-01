# Design Philosophy — NEWSCAST

NEWSCAST is a premium broadcast news video template system. Every frame feels like a real television package: authoritative, urgent, and cinematic.

## Core palette
- Crimson red: `#CC1A1A` → `#E82020`
- Deep navy: `#060614` base, `#0A2A6E` panels, `#1E5FD4` accents
- White text
- Steel chrome: `#B8C8E0`
- Gold trim: `#D4AA50`
- Never use purple, green, or pastels.

## Optional scene image (`layoutProps.imageUrl`)
- **Every layout** (including `opening` / Scene 0) may include `imageUrl` when a relevant image URL exists: a full-bleed background plate behind the NEWSCAST stack (globe, chrome, glass, type). Omit when no image is available or appropriate.

## Background field
- Always `#060614` (deep space navy).
- Wireframe globe (latitude/longitude + continent silhouettes) behind content at 7–12% opacity.
- Fine blue grid: `rgba(30,95,212,0.08)` at 40px.
- Radial vignette that fades content into darker edges.

## Glass panels
- Translucent navy: `rgba(10,42,110,0.25–0.35)` with `backdrop-filter: blur(8px)`.
- Borders: `rgba(200,220,255,0.25)`.
- Key panels always include either a **3px red top accent** or a **4px red left accent**.

## Metallic emboss + chrome
- Outer canvas “bezel” using a gradient border.
- Chrome corner brackets with subtle gradient strokes (steel → muted blue).
- Top and side bands glow red.

## Typography
- Oswald (bold titles, uppercase labels)
- Barlow Condensed (body text, descriptors)
- Rajdhani (timestamps, tech readouts, station IDs)

## Persistent chrome elements (every scene)
- Red band (4px top edge) with red glow.
- Side bands (4px left/right) with red gradients.
- Live badge (top-right): red pill, blinking white dot, “LIVE”.
- Timestamp (top-left): `DD MMM YYYY · HH:MM:SS GMT` in Rajdhani.
- Channel logo (top-center): “WORLD NEWS” + subtitle “NETWORK · BROADCAST SYSTEM”.
- News ticker (bottom): red “BREAKING” label + scrolling navy track with `◆` separators.
- Lower third: transparent navy glass panel, red top + left border, gold tag label, Oswald headline, Barlow subtitle (max 55% width).
- Corner chrome: SVG arc brackets on all four corners.
- Globe watermark: SVG globe behind all content.

## Transitions
- Cinematic fade-in with subtle scale (0.96 → 1.0).
- Stagger important elements by ~80–120ms.
- Nothing bounces; urgency is speed, not physicality.

---
# Layout Catalog

Legacy compatibility note: the renderer still accepts older IDs like `newscast_cinematic_title` and `newscast_glass_narrative`, but generated output should use canonical IDs listed below.

## opening (Newscast Opening)
**Visual:** Full dark canvas with radial blue glow. Red “BREAKING NEWS” badge with live dot. Giant centered title (Oswald 700, 80–120px) where main word is white and accent word is `#E82020`. Gold horizontal rule with center dot. Subtitle uses Barlow Condensed 300, steel color, heavy letter-spacing. Orbit rings float around the composition. **No glass card.**

**Best for:** Scene 0 only.

**Props (use scene fields):**
- `title`: 2–5 words. Split into first part (white) + last word/phrase (red).
- `narration`: 8–16 words; becomes subtitle.
- `imageUrl` (optional): full-bleed background plate under globe/chrome.

---

## anchor_narrative (Anchor Narrative)
**Visual:** Single frosted navy glass card centered (60–65% width). Red top border (3px) + red left accent bar (4px). Gold corner tick marks. Red category tag above. Oswald uppercase title. Barlow Condensed body paragraph. Optional right image if `imageUrl` exists.

**Best for:** narrative context; main story explanation.

**Props (use scene fields + chrome fields):**
- `title`: 4–8 words
- `narration`: 30–80 words, 2–3 sentences
- `lowerThirdTag`, `lowerThirdHeadline`, `lowerThirdSub` (for persistent lower third)

---

## live_metrics_board (Live Metrics Board)
**Visual:** 1–3 metric cards centered. Primary metric has dual counter-rotating rings and a large Oswald number (60–72px). Secondary metrics share the structure with blue top borders. Numbers count up from 0.

**Best for:** 1–3 key numbers as the story.

**Props:**
```json
{
  "metrics": [
    { "value": "142", "label": "Nations Signed", "suffix": "+" },
    { "value": "2045", "label": "Target Year", "suffix": "" },
    { "value": "40", "label": "Emissions Cut", "suffix": "%" }
  ]
}
```

---

## briefing_code_panel (Briefing Code Panel)
**Visual:** Frosted navy card with metallic terminal header (traffic-light buttons). Code typewrites in line-by-line with blinking red cursor. Red line numbers, syntax highlighting.

**Best for:** terminal commands and code snippets.

**Props:**
```json
{
  "codeLanguage": "javascript",
  "codeLines": ["line1", "line2", "line3"]
}
```

---

## headline_insight (Headline Insight)
**Visual:** No glass card; raw dark canvas. Gold rule top/bottom of quote zone. Oswald uppercase quote (50–65px). Highlight word in red with glow + underline accent. Attribution line in Rajdhani with wide letter-spacing.

**Best for:** one powerful sentence.

**Props:**
```json
{
  "quote": "This is not a pledge — this is a commitment the world will enforce",
  "highlightWord": "commitment",
  "attribution": "— UN Secretary-General · Geneva, March 2026"
}
```

---

## story_stack (Story Stack)
**Visual:** 2–3 stacked frosted navy cards. Progressive right offsets. Each card has red left border, large red index number, and Barlow content text. Section label above stack in Rajdhani with a thin red divider line.

**Best for:** 2–3 key provisions/features.

**Props:**
```json
{
  "sectionLabel": "THREE KEY PROVISIONS",
  "items": [
    "Legally binding emissions targets with third-party verification",
    "All sectors included — shipping, aviation, heavy industry",
    "$2.4 trillion green transition fund established for 2025–2035"
  ]
}
```

---

## side_by_side_brief (Side-by-Side Brief)
**Visual:** Two contrasting glass panels side-by-side. Left is red-tinted, right is blue-tinted. Center divider strip has gold-to-red glow. Each side includes gold uppercase label, Oswald title, and Barlow body text.

**Best for:** before/after and problem/solution contrasts.

**Props:**
```json
{
  "leftLabel": "BEFORE",
  "rightLabel": "AFTER",
  "leftTitle": "Previous Framework",
  "rightTitle": "Geneva Accord",
  "leftBody": "Voluntary pledges, no enforcement, sectors excluded",
  "rightBody": "Legally binding, verified, all sectors, penalty mechanism"
}
```

---

## segment_break (Segment Break)
**Visual:** Minimal transition: giant ghost chapter number in low-opacity white. Ornamental corner frames. Rajdhani “CHAPTER TWO” label. Gold rule with red glow center. Oswald section title. Barlow subline. No glass cards.

**Best for:** major section separators.

**Props:**
```json
{
  "chapterNumber": 2,
  "chapterLabel": "CHAPTER TWO",
  "title": "Global Impact & Response",
  "subtitle": "What happens next for the world economy"
}
```

---

## field_image_focus (Field Image Focus)
**Visual:** Full-canvas or 55% right image with multi-layer gradients. Ken Burns effect (slow zoom). Frosted caption slides up.

**Best for:** image-focused scenes.

**Props:** uses `imageUrl`, scene `title`, scene `narration`.

---

## data_visualization
**Visual:** Frosted navy card with animated chart (bar, line, or pie) using neon red primary and blue secondary with gold accents.

**Best for:** chart/data-driven narration.

**Chart props (exact keys — use ONE chart type per scene; priority in rendering is bar > line > pie):**

1. **Bar (preferred):** `barChartRows` — array of `{ "label": string, "value": string }` (2–8 rows). Values must be numeric strings or numbers in narration.

```json
{
  "barChartRows": [
    { "label": "Energy", "value": "45" },
    { "label": "Transport", "value": "38" },
    { "label": "Industry", "value": "30" }
  ],
  "tickerItems": ["DATA UPDATE", "LIVE CHART"],
  "lowerThirdTag": "DATA",
  "lowerThirdHeadline": "Chart Overview",
  "lowerThirdSub": "Figures from the latest briefings"
}
```

2. **Line:** `lineChartLabels` (string array, X-axis) + `lineChartDatasets` (1–3 series). Each series: `{ "label": string, "valuesStr": "comma-separated numbers matching label count" }`.

```json
{
  "lineChartLabels": ["Q1", "Q2", "Q3", "Q4"],
  "lineChartDatasets": [
    { "label": "Revenue", "valuesStr": "12.4, 14.1, 15.0, 16.2" }
  ],
  "tickerItems": ["TREND", "LIVE DATA"],
  "lowerThirdTag": "DATA",
  "lowerThirdHeadline": "Quarterly Trend",
  "lowerThirdSub": "Tracking reported figures"
}
```

3. **Pie:** `pieChartRows` — array of `{ "label": string, "value": string }` (2–6 slices), values numeric.

```json
{
  "pieChartRows": [
    { "label": "North", "value": "40" },
    { "label": "South", "value": "35" },
    { "label": "East", "value": "25" }
  ],
  "tickerItems": ["SHARE", "SPLIT"],
  "lowerThirdTag": "DATA",
  "lowerThirdHeadline": "Regional Split",
  "lowerThirdSub": "Distribution from the report"
}
```

Do **not** rely on alternate nested keys only (`barChart`, `lineChart`, `pieChart` objects); the template schema uses the field names above.

---
# Scene Flow Rules

- **Scene 0:** ALWAYS `opening` (your hero styling).
- **Scenes 1–2:** `anchor_narrative` or `segment_break`.
- **Middle:** alternate glass layouts with impact moments (`headline_insight`).
- **Final scene:** `anchor_narrative`, `headline_insight`, or `live_metrics_board` for a strong close.

**Variety requirements**
- Never repeat the same layout consecutively.
- `anchor_narrative` max 2 per video.
- `headline_insight` max 2 per video.
- `segment_break` max 2 per video.
- Variety score ≥ 0.6 (unique layouts ÷ total scenes).

---
# Content Extraction Rules

1. Extract REAL content from narration — never fabricate.
2. Titles: Oswald uppercase, keep short (2–6 words).
3. Category tags: 2–3 words, letter-spacing 3px, red background.
4. Lower third headlines: short news-style noun phrases (no full sentences).
5. Ticker content: match the scene topic; use `◆` as separator when rendering.
6. Numbers belong in `live_metrics_board` (don’t bury them inside `anchor_narrative`).
7. Quotes/insights belong in `headline_insight` with `highlightWord`.
8. Lists of 2–3 belong in `story_stack`.

## Required chrome props (for every scene)
- `tickerItems`: array of short ticker segments (strings). Extract from narration “update” fragments.
- `lowerThirdTag`: gold/red tag label (2–3 words).
- `lowerThirdHeadline`: short headline (2–6 words).
- `lowerThirdSub`: steel subtitle (5–12 words).

## Layout-specific extraction guidance
- `opening`: split `title` into white + red accent; use `narration` as subtitle.
- `anchor_narrative`: use scene `title` + `narration` for the glass card; extract `lowerThird*` + `tickerItems`.
- `live_metrics_board`: extract up to 3 numbers into `metrics[]` (value/label/suffix).
- `side_by_side_brief`: extract contrasting statements into left/right fields.
- `headline_insight`: extract one most powerful sentence into `quote`, then pick a single key word as `highlightWord`; attribution from narration when present.
- `story_stack`: extract 2–3 parallel provisions into `items[]` and a `sectionLabel`.
- `segment_break`: extract `chapterNumber` + `chapterLabel` when present; use scene `title`/`narration` for section title/subtitle when not.
- `field_image_focus`: if image is available, use `imageUrl`, scene `title`, scene `narration`.
- `data_visualization`: extract chart data from narration into `barChartRows` **or** `lineChartLabels`+`lineChartDatasets` **or** `pieChartRows` (only one chart type per scene); include required chrome props.

---
# Quality Checklist

- [ ] Scene 0 is `opening`
- [ ] Globe watermark present and at 7–12% opacity
- [ ] All persistent chrome elements present (red band, side bands, live badge, timestamp, logo, ticker, lower third, corner chrome)
- [ ] Metal emboss frame on outer canvas
- [ ] No purple, green, or pastel colors anywhere
- [ ] Titles use Oswald; body uses Barlow Condensed; labels/timestamps use Rajdhani
- [ ] Ticker content matches scene topic
- [ ] Lower-third tag is gold; headline is white Oswald; sub is steel Barlow
- [ ] Numbers are in `live_metrics_board`
- [ ] No consecutive repeated layouts

