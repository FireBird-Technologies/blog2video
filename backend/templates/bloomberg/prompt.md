# Design Philosophy

BLOOMBERG is a Bloomberg terminal-inspired financial explainer template: pure black stage (`#000000`), amber primary text (`#FFB340`), restrained blue accent (`#5EA2FF`), dedicated red for negative moves and alerts (`#FF5A54`). All content is displayed in a dense, operator-style terminal grammar using `Share Tech Mono` monospace. Every scene should feel like a live Bloomberg workstation function screen — not a marketing slide or SaaS product demo.

Core rules:
- One terminal function per scene: a data table, a KPI board, a chart readout, a news ticker, a quote, or a boot log — never a mix of unrelated elements.
- Every layout must use only the prop names defined in this catalog; unknown keys are ignored downstream.
- **Do not** put `titleFontSize` or `descriptionFontSize` in `layout_props_json`. Those are UI defaults from `meta.json` and are not set by the scene generator.
- Do not invent statistics, prices, or financial data that are not grounded in the source narration or scene brief; prefer paraphrase and omission over fabrication.
- Use terse desk language: function labels, analyst shorthand, operator notes. Avoid landing-page copy.

---

# Layout Catalog

## terminal_boot

**Visual:** Centered boot panel on pure black. A sequence of amber log lines appear in the terminal window, finishing with an `MBN> _` prompt. Title is the system/session name.

**Best for:** The opening scene — system startup, session open, topic introduction as a boot sequence.

**Props:**
- `items` — string array, **4–8** boot log lines. Each line is a short terminal log entry (e.g. `"[OK] Loading market data feed..."`, `"[SYS] Connecting to exchange..."`).

**When to Use:** Scene 0 only; always the hero opener.

---

## terminal_narrative

**Visual:** Two-panel layout: left panel shows eyebrow function code (e.g. `MBN:NARR`), large amber title, and a bordered panel with body narration; right panel is a muted vertical rule and optional data sidebar. Dense but readable.

**Best for:** Explanatory prose, context, story beats — the default workhorse for middle scenes.

**Props:** Uses global `title` and `narration` only. No layout-specific keys.

**When to Use:** Default for narrative-heavy scenes when content is prose, not structured data.

---

## terminal_chart

**Visual:** Large chart panel occupying ~70% of the width (candlestick placeholder with amber outline), right sidebar showing indicator readouts. Title is the symbol or analysis focus.

**Best for:** Technical analysis scenes, chart breakdowns, indicator summaries.

**Props:**
- `items` — string array, **3–8** indicator readout lines (e.g. `"MA20: 184.40"`, `"RSI: 62.4"`, `"MACD: +1.82"`). Each item is one stat row.

**When to Use:** Chart analysis and technical review scenes (GRPH equivalent).

---

## terminal_dashboard

**Visual:** Title bar at top with function code, then a dense grid of KPI tiles — each tile shows a value, a short label, and a change/suffix badge. Uses amber for neutral/positive, red for negative.

**Best for:** Market overview, breadth summary, multi-metric board.

**Props:** `metrics` — array of objects, each exactly:
```json
{ "value": "S&P 500", "label": "INDEX", "suffix": "+0.84%" }
```
`value` is the symbol or primary value. `label` is a short descriptor. `suffix` is the change or secondary value.

**When to Use:** Market overview (MRKT) and technical dashboard (TECH) scenes. Up to 6 tiles.

---

## terminal_ticker

**Visual:** Screener/movers board: title bar, then a vertical list of ticker rows, each styled as a monospace terminal line. Rows alternate muted amber / black for readability.

**Best for:** Top gainers/losers, screener results, movers list.

**Props:**
- `items` — string array, **4–10** rows. Each row is a preformatted string with ticker, change, and price (e.g. `"AAPL  +2.14%  $189.40"`).

**When to Use:** Screener (SCRN) scenes, movers boards.

---

## terminal_table

**Visual:** Data table with monospace header row and data rows below. First item in `items` is treated as the header row (pipe-delimited or tab-separated). Borders in muted amber.

**Best for:** Portfolio positions, financial statements, income/balance sheet data.

**Props:**
- `items` — string array. **Row 0** is the header (e.g. `"POSITION | QTY | ENTRY | CURRENT | P&L"`). Rows 1–N are data rows. Up to 12 rows total.

**When to Use:** Portfolio monitor (PORT) and financial statements (FA) scenes.

---

## terminal_split

**Visual:** Two bordered panels side by side, each with a large amber label and a description block. A vertical amber rule divides them.

**Best for:** Before/after contrast, bull vs bear, risk-on vs risk-off, constraint vs outcome.

**Props:**
- `leftLabel` — short column title (e.g. `"RISK-OFF"`, `"BEFORE"`).
- `rightLabel` — short column title (e.g. `"RISK-ON"`, `"AFTER"`).
- `leftDescription` — one or two sentences for the left panel.
- `rightDescription` — one or two sentences for the right panel.

**When to Use:** When the narration explicitly contrasts two market states, scenarios, or phases.

---

## terminal_quote

**Visual:** Centered amber quote line in large monospace. Optional single-word highlight in blue accent. Below: sub-text narration in muted amber. A thin top and bottom terminal rule frames the quote.

**Best for:** Pull quotes, thesis statements, analyst desk notes, memorable one-liners.

**Props:**
- `quote` — **string**, one strong sentence (or two very short ones).
- `highlightWord` — optional **single word** that appears verbatim inside `quote` (rendered in blue accent).

**When to Use:** Emotional or conceptual peaks; the key takeaway in quote form.

---

## terminal_list

**Visual:** Title bar with function code, then a vertical list of amber bullet rows (amber `>` prefix instead of dots). Dense, legible, terminal-native.

**Best for:** Watch lists, next-session items, key risks, action items, process steps.

**Props:**
- `items` — string array, **3–8** items. Each item is a short clause (about 5–12 words), parallel grammar.

**When to Use:** Session close watch lists (CLOS), risk lists, ordered action items.

---

## terminal_metric

**Visual:** Centered stage with **1–4** large metric tiles. Each tile: massive amber value, short amber label below, optional muted suffix. Feels like a Bloomberg function-key data pull.

**Best for:** Key rates, macro figures, single dominant statistics.

**Props:** `metrics` — array of objects, each exactly:
```json
{ "value": "4.31", "label": "10Y YIELD", "suffix": "%" }
```
`value` is always a **string**. `label` is short. `suffix` is optional.

**When to Use:** Macro / econ (ECON) scenes with dominant rate or macro figures. Up to 4 tiles.

---

## terminal_profile

**Visual:** Title bar, then a vertical list of display profile rows — each row shows a profile name and a one-line descriptor in a bordered amber panel. Acts like a Bloomberg PREF function screen.

**Best for:** Display profile matrix, configuration overview, system rules reference.

**Props:**
- `items` — string array, **3–8** profile rows. Format: `"PROFILE_NAME   Short description of the profile."` Use fixed-width alignment.

**When to Use:** Theme/profile matrix (THME) scenes only.

---

## terminal_options

**Visual:** Options chain table: header row then data rows, styled like a Bloomberg OMON screen. Strike, type, bid, ask, IV, delta, gamma columns. Amber header, muted rows, red for puts.

**Best for:** Options chain display, vol surface, options strategy breakdown.

**Props:**
- `items` — string array. **Row 0** is the column header. Rows 1–N are chain rows. Up to 12 rows. Format each row as pipe-delimited monospace (e.g. `"185 | CALL | 5.20 | 5.40 | 28.4% | 0.52 | 0.041"`).

**When to Use:** Options monitor (OPTS) scenes.

---

## ending_socials

**Visual:** Pure black stage with a centered amber terminal prompt block. CTA text rendered as a blinking terminal command (e.g. `MBN> Get Started_`). Below: website URL in muted amber, a thin amber rule, narration text, then a row of social platform icons with amber labels.

**Best for:** Final outro scene with social handles and CTA. Terminal-native, not marketing-slide.

**Props:**
- `ctaButtonText` — **string**, short imperative phrase (e.g. `"Get Started"`, `"Subscribe Now"`, `"Try Free"`). Keep it under **4 words**.
- `websiteLink` — **string**, the URL or domain (e.g. `"www.example.com"`).
- `showWebsiteButton` — **boolean**, set `false` to hide CTA and URL. Defaults to `true`.
- `socials` — **object**, key-value map of platform names to handles. Supported keys: `instagram`, `twitter`, `linkedin`, `youtube`, `facebook`, `tiktok`, `github`. Omit platforms not mentioned in the source.
- `narration` (global) — warm closing line shown below the rule.
- `title` (global) — not displayed visually; use as internal label (e.g. `"Session Close"`).

**When to Use:** Always the **last scene** when CTA or social data exists. Do not use mid-video.

---

# Scene Flow Rules

- Scene **0** must use **`terminal_boot`** (hero).
- **Middle scenes:** use `terminal_narrative` as the prose default; rotate structured layouts (`terminal_chart`, `terminal_dashboard`, `terminal_ticker`, `terminal_table`, `terminal_split`, `terminal_quote`, `terminal_list`, `terminal_metric`, `terminal_profile`, `terminal_options`) as content demands.
- **Closing:** use **`ending_socials`** as the final scene when CTA or social data is available; otherwise close with `terminal_quote` or a strong `terminal_metric`.
- For **6+ scenes**, include **at least one** data-forward layout: `terminal_dashboard`, `terminal_metric`, or `terminal_table`.
- Balance data density (`terminal_table`, `terminal_ticker`, `terminal_options`) with breathing room (`terminal_narrative`, `terminal_quote`).
- Every scene should feel like a distinct Bloomberg terminal function — name `title` accordingly (e.g. `"MRKT> Overview"`, `"GRPH> Chart Analysis"`, `"PORT> Positions"`).

---

# Content Extraction Rules

**Global fields (every scene):**
- `title`: **3–10 words**; use Bloomberg function-style naming when possible (e.g. `"GRPH> Technical Analysis"`, `"ECON> Macro Rates"`).
- `narration`: **12–20 words** for voiceover; desk-language, speakable in one breath.

**Per layout (structured props):**
- **`terminal_boot`:** Generate terse `[OK]`/`[SYS]`/`[INIT]` prefixed log lines relevant to the topic. End with `MBN> _` style prompt.
- **`terminal_chart`:** Extract indicator values from narration; if none given, generate plausible placeholders clearly labeled with `MA`, `RSI`, `MACD`, `VOL` etc.
- **`terminal_dashboard`:** Map each index/asset to a KPI tile; use `+` prefix for gains, `-` for losses.
- **`terminal_ticker`:** One row per asset/name from the narration; align ticker, change %, and price with spaces.
- **`terminal_table`:** First row is the header; align columns with `|` separators; keep cell values short.
- **`terminal_split`:** Contrast two clearly opposing states; left/right must disagree in meaning.
- **`terminal_quote`:** Extract one tight thesis or desk note from the narration; `highlightWord` must appear verbatim in `quote`.
- **`terminal_list`:** Short parallel clauses; each item starts with a verb or noun, not a full sentence.
- **`terminal_metric`:** Pull dominant numeric figures; map to `value`/`label`/`suffix`.
- **`terminal_profile`:** Use fixed-width alignment; profile name in CAPS, description in sentence case.
- **`terminal_options`:** Header row first; use pipe delimiter; keep IV, delta, gamma values realistic.
- **`ending_socials`:** `ctaButtonText` is an imperative verb phrase (≤4 words); `narration` is a warm closing line, not a content summary.

**Grounding:** If the source does not support a layout (e.g. no numbers for `terminal_metric`), choose a different layout. Do not fabricate financial data.

---

# Variety Rules

- Do **not** repeat the **same** layout more than **2** consecutive scenes.
- Do **not** use **`terminal_boot`** after scene 0.
- Across the **whole** video, prefer **at least 4 distinct** layout IDs when `total_scenes` ≥ 6.
- **`terminal_narrative`** is the fallback for prose; **do not** let it dominate more than 40% of scenes in long videos — interleave data layouts.
- End with a **memorable** layout: `ending_socials`, `terminal_quote`, or `terminal_metric`.
- Maintain terminal voice throughout: function labels, desk shorthand, operator language. Never marketing copy inside scene content.
