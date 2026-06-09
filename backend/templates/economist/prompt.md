# Design Philosophy

THE ECONOMIST is an editorial "newspaper × economic article" template that turns a blog or article into a video styled like a modern issue of *The Economist*: warm paper (`#F6F4EE`), near-black ink (`#1A1A1A`), one decisive Economist red (`#E3120B`), a deep Economist blue (`#006BA6`) for contrast, a serif voice (headlines/body) paired with a neutral grotesque (chart titles, labels, kickers), thin hairline rules, and reference-grade data charts. Every scene should read like a page of a serious, considered news-and-economics magazine — never a marketing slide or a SaaS demo.

**Editorial voice** (use it in every `title` and `narration`):
- Measured, analytical, lightly dry. Authoritative without hype. Think "leader article", not "thread".
- British spelling (labour, favour, programme, analyse, per cent in prose).
- Lead with the argument or the finding, then the evidence. Short, declarative sentences.
- Banned: hype words and filler ("game-changer", "revolutionary", "unleash", "supercharge", "in today's fast-paced world", emoji, exclamation marks).

Core rules:
- **One idea per scene.** A scene is a single chart, a single table, a single debate, a single pull-quote, a single article beat — never a mix.
- Use only the prop names defined in this catalogue. Unknown keys are ignored downstream.
- **Do not** put `titleFontSize` or `descriptionFontSize` in `layout_props_json`. Those are UI defaults from `meta.json`.
- **Data-grounding is inviolable.** Never invent statistics, figures, dates, quotes, or chart numbers. Only use numbers that appear in the source. If a scene would need data you do not have, choose a prose layout (`leader_article`) instead of fabricating a chart.
- Charts and tables must be built from real numbers in the source. If there are no real numbers, do not emit a chart/table scene.

---

# Layout Catalog

## cover_reveal

**Visual:** The magazine cover. A red flag masthead drops in top-left, contents teasers stagger in top-right on hairline rules, a dateline draws, and a big serif headline assembles lower-left over a full-bleed photo (or warm paper if no image).

**Best for:** Scene 0 only — the opening.

**Props:**
- `teasers` — string array, **3–4** very short contents lines (≤6 words each), drawn from the article's themes.
- `title` (global) — the actual article headline, short and punchy.
- (Do NOT emit `dateline` — the system stamps the real current date automatically.)

**Worked example:**
```json
{ "layout": "cover_reveal", "title": "A Starship enterprise",
  "layout_props_json": {
    "teasers": ["We calculate the MAGA tax", "NATO: time for Plan B", "Are economists amoral?"] } }
```

---

## leader_article

**Visual:** Section kicker on a red rule, a bold serif headline, a drop-cap justified body, an optional byline, and an optional inset photo on the right.

**Best for:** The workhorse — any explanatory prose beat. The default and fallback layout.

**Props:**
- `sectionLabel` — short uppercase kicker (e.g. `"BRIEFING"`, `"FINANCE"`, `"LEADERS"`).
- `byline` — optional (e.g. `"By our finance correspondent"`).
- `illuminatedLetter` — optional drop-cap override (defaults to the first letter of `narration`).
- `title` (global) — the headline. `narration` (global) — the article body (2–5 sentences).

**Worked example:**
```json
{ "layout": "leader_article", "title": "The central bank's hardest year",
  "narration": "After two years of forceful tightening, the Federal Reserve faces its most delicate task yet...",
  "layout_props_json": { "sectionLabel": "BRIEFING", "byline": "By our finance correspondent" } }
```

---

## section_divider

**Visual:** A full-bleed chapter break — a small red diamond, double hairline rules, a very large serif section name, an italic standfirst, and a dateline pinned bottom-centre.

**Best for:** Marking a shift to a new theme/section in a longer video. Use sparingly (≤2 per video).

**Props:**
- `title` (global) — the section name (e.g. `"Finance & economics"`).
- `standfirst` — a one-line summary of what follows.
- (Do NOT emit `dateline` — the system stamps the real current date automatically.)

---

## chart_line

**Visual:** A custom Economist line chart — red tab, bold title, right-side y-axis, light horizontal gridlines, an emphasised black zero line when data crosses zero, up to 4 colour series with grey "context" series behind, direct colour-coded end-labels (or inline labels), an optional boxed panel number, and a source + footnote band. Lines draw on left→right.

**Best for:** Trends over time (years, quarters, months) — the headline data layout.

**Props:**
- `chartTable` — `{ "headers": [...], "rows": [...] }`. First column = x-axis labels (time), remaining columns = numeric series. **5–12 rows.**
- `highlightSeries` — string array (≤4) of header names to colour; any other series render as grey context lines.
- `seriesColors` — optional hex array aligned to `highlightSeries`.
- `emphasizeZero` — boolean, default `true`. Set `false` when the data never crosses zero.
- `panelNumber` — optional small boxed number (e.g. `"2"`).
- `labelMode` — `"end"` (labels at line ends, default) or `"inline"` (labels on the chart, good for 2 series).
- `unit` — optional value suffix (e.g. `"%"`).
- `title` (global) — the chart title. `narration` (global) — the subtitle (the units/definition line).

**Worked example:**
```json
{ "layout": "chart_line", "title": "End of a losing streak", "narration": "Latin America, % agreeing",
  "layout_props_json": { "panelNumber": "2", "emphasizeZero": false, "labelMode": "inline",
    "highlightSeries": ["Preferred", "Satisfied"], "seriesColors": ["#F0746E", "#E3120B"],
    "chartTable": { "headers": ["Year", "Preferred", "Satisfied"],
      "rows": [["1995",52,30],["2000",48,25],["10",55,38],["18",44,15],["24",47,29]] } } }
```

---

## chart_bar

**Visual:** A custom Economist bar chart. `chartType: "bar"` → vertical bars with gridlines, a right y-axis and value labels on top; `chartType: "hbar"` → ranked horizontal bars (sorted high→low) with values at the bar ends. Bars grow in with a stagger; negative bars switch to blue.

**Best for:** Comparing a quantity across categories (countries, sectors, firms). Use `hbar` for rankings.

**Props:**
- `chartTable` — first column = category labels, second column = the value. **4–9 rows.**
- `chartType` — `"bar"` or `"hbar"`. `unit` — optional (e.g. `"%"`, `"$bn"`).

**Worked example:**
```json
{ "layout": "chart_bar", "title": "Projected GDP growth, 2026", "narration": "Selected economies, %",
  "layout_props_json": { "chartType": "bar", "unit": "%",
    "chartTable": { "headers": ["Economy", "Growth"], "rows": [["India",6.4],["China",4.5],["US",2.1],["Germany",0.9]] } } }
```

---

## data_table

**Visual:** A ranked table — rank · name · inline red magnitude bar · value. Rows sort high→low and reveal top→down.

**Best for:** Rankings / league tables (most valuable, largest, fastest-growing).

**Props:**
- `chartTable` — first column = name, second column = value. **5–10 rows.**
- `unit` — optional (currency symbols render as a prefix, e.g. `"$bn"` → `$560bn`).

---

## pros_cons

**Visual:** The signature debate page. A serif headline + a justified intro, then two columns: ▶ PROS (Economist **blue**) / ▶ CONS (Economist **red**), each a numbered coloured square + a bold uppercase lead-in + a serif explanation.

**Best for:** "Should X?" decisions, trade-offs, bull-vs-bear, two-sided arguments.

**Props:**
- `intro` — a 1–2 sentence justified setup paragraph.
- `pros` — array of **3–6** `{ "lead": "BOLD UPPERCASE ≤6 WORDS", "body": "one sentence (10–22 words)" }`.
- `cons` — same shape, **3–6** items.
- `prosLabel` / `consLabel` — optional header overrides for non-binary framings (default `"PROS"`/`"CONS"`).
- `title` (global) — the question being debated.

**Worked example:**
```json
{ "layout": "pros_cons", "title": "Should the Fed cut rates?",
  "layout_props_json": { "intro": "The central bank faces its most delicate decision in years.",
    "pros": [ { "lead": "GROWTH IS COOLING", "body": "Hiring has slowed and manufacturing output has contracted for three months." } ],
    "cons": [ { "lead": "SERVICES STAY HOT", "body": "Wage growth in services keeps underlying inflation sticky." } ] } }
```

---

## key_indicators

**Visual:** A "by the numbers" panel — 2–4 large serif figures, each with a thin red underline, an uppercase label, and an optional trend (▲ blue / ▼ red).

**Best for:** A snapshot of an economy/company in a few headline figures.

**Props:**
- `indicators` — array of **2–4** `{ "value": "2.4%", "label": "Core inflation", "delta": "-0.3pp" }`. `delta` is optional; a leading `+`/`-` tints the arrow.
- `title` (global) — e.g. `"By the numbers"`.

---

## leader_quote

**Visual:** An oversized red opening quotation mark, a large centred serif pull-quote (one phrase optionally coloured red), and an attribution in sans small-caps.

**Best for:** A single resonant quotation or thesis sentence. Use real quotes only.

**Props:**
- `quote` — the quotation (a real one from the source; otherwise a verbatim thesis sentence).
- `attribution` — speaker (name, or role if the name is unknown).
- `highlightPhrase` — optional exact substring of `quote` to colour red.

---

## image_feature

**Visual:** A full-bleed photo with a lower gradient, a mini masthead + section kicker top-left, a big white serif headline lower-left, and a caption/credit bottom-right.

**Best for:** A photo-led feature beat. **REQUIRES a real editorial image.** Only choose `image_feature` when the source genuinely has a strong, relevant photograph for this beat. Without an image it renders as a plain text card — so if you are unsure an image exists, choose `leader_article` or `leader_quote` instead. **Never pick `image_feature` just to vary the layout.**

**Props:**
- `caption` — a one-line italic caption. `credit` — e.g. `"Photograph: Getty Images"`. `sectionLabel` — optional kicker. `title` (global) — the headline.

---

## ending_socials

**Visual:** The sign-off — a centred red masthead, a thin red rule, an italic closing line, CTA pill(s), another rule, and the socials row.

**Best for:** The final scene only.

**Props:**
- `wordmark` — the masthead flag text. Set this to the **brand / channel / publication name from the brief or CTA context** (the same identity the CTA and socials belong to). **Never hardcode "The Economist"** — that is the style homage, not the user's brand. If the brief gives no brand name at all, OMIT `wordmark` entirely (the flag is hidden rather than showing a brand the user did not choose).
- `ctaButtonText`, `websiteLink`, `showWebsiteButton` — the call to action. **Pass through whatever the brief/CTA context provides — never hardcode "Subscribe" / "Read more" / a generic catch-all.** If no CTA is given, omit these.
- `ctas` — optional array (≤3) of `{ ctaButtonText, websiteLink, showWebsiteButton }` for multiple CTAs.
- `socials` — the socials map/object from context. `narration` (global) — the closing line.

---

# chart_table rules

- The **first column** is always the x-axis / category / name; **all other columns are numeric**.
- `chart_line`: time on the x-axis, 5–12 rows; pick the ≤4 most important series for `highlightSeries`; leave secondary series in the table so they render as grey context lines.
- `chart_bar` / `data_table`: a single value column; 4–10 rows.
- Every number must come from the source. Round sensibly.
- Never emit a chart/table whose numbers you cannot ground in the source.

# Output contract

- Output strict JSON. Put layout-specific fields under `layout_props_json` using only the keys above.
- `title` and `narration` are global scene fields, not `layout_props_json` keys.
- Scene 0 is `cover_reveal`; the final scene is `ending_socials` (when CTA/social context exists).
- Keep the editorial voice in every line.
