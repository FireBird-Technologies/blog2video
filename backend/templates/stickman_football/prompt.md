# Design Philosophy

Ink-black stickman players animate across a chalk-drawn pitch with grass-green accents, snappy slide-ins, bouncy ball motion, and quick action wipes — playful and lively for any football story.

Core rules:
- Favor one clear beat per scene: action choreography, a short headline, or structured layout data — not everything at once.
- Every layout must use only the prop names defined in this catalog; unknown keys are ignored downstream.
- **Do not** put `title`, `narration`, `accentColor`, `bgColor`, `textColor`, `titleFontSize`, `descriptionFontSize`, `sceneDurationInFrames`, or `aspectRatio` in `layout_props_json`. Those are global scene fields or UI defaults from `meta.json`.
- **Only** output layout-specific keys listed under each layout's **Props** section.
- **Output EVERY prop listed under the chosen layout's Props section — all of them are COMPULSORY.** Never omit a defined prop. For **text/caption props** (e.g. `subline`, `shotLabel`, `kickerName`, `kickerNumber`, `goalLabel`, `eyebrow`, `skillCaption`, `leftLabel`/`rightLabel`/`leftDescription`/`rightDescription`, `ctaButtonText`, and each `steps[].label` in `corner_kick`) always provide a sensible value paraphrased from the source (or the catalog default if the source is silent) — never leave them blank.
- The only props you may omit are **data-bearing collections** that the source genuinely doesn't support: `stats`, `socials`, `handles`, `ctas`, `scoreline`. Do not invent statistics, scores, or social handles that aren't grounded in the source; prefer omission over fabrication for those. **`steps` is NOT omittable** — when the layout is `corner_kick`, you **must always** output a `steps` array with **3–5** items.

---

# Layout Catalog

## kickoff_title

**Visual:** Full white pitch over green grass. A stickman runs in from the bottom-left, kicks the ball to the upper-centre, and the impact reveals the bold title and narration. The ball drops, bounces, and the player picks it up while three more stickmen jog in and line up beside him. Optional subline appears beneath the title.

**Best for:** The opening hero card — match previews, highlight reels, sports show intros.

**Props:**
- `subline` — **string**, short kickoff tagline beneath the title (e.g. `"Match Day — Highlights"`). Defaults in `meta.json` if omitted.

**When to Use:** Scene 0 only; always the hero opener.

---

## passing_play

**Visual:** Full-width grassy pitch with two stickmen facing each other, running a passing rally — control, pass arc, chest trap, flick, return pass. Title and narration sit top-left; up to four stat cards render on cardboard panels (right in landscape, below the text in portrait).

**Best for:** Build-up play, teamwork, possession narratives, or any beat where two players exchanging the ball reinforces the story.

**Props:**
- `stats` — **object_array**, up to **4** items. Each item: `{ "label": string, "value": string }`. Renders as a 2×2 cardboard grid. Provide **0** to hide; ideally **4** when the source has enough real figures.

**When to Use:** Middle scenes with cooperative play or when you want a few supporting match numbers alongside the action.

**Notes:** No image slot. Extras beyond 4 are ignored. Keep `value` short (`"62%"`, `"418"`) and `label` to 1–2 words.

---

## freekick_setup

**Visual:** Chalk-drawn penalty area and goal. A taker near the bottom-left, a three-man wall, a goalkeeper who dives to save, and the ball deflecting back as the taker drops to despair. A name/number badge floats above the taker's head and fades out as he drops to despair. Title and narration top-left; a short shot label sits on a cardboard card above the goal.

**Best for:** Set-piece tension, tactical free-kick breakdowns, near-miss moments, or coaching explainers.

**Props:**
- `shotLabel` — **string**, short caption on the goal card (e.g. `"Top corner"`, `"Saved!"`). Keep to **2–4 words**.
- `kickerName` — **string**, name badge above the taker's head (e.g. `"Striker"`, a player surname). **1–2 words**; omit to hide.
- `kickerNumber` — **string**, short tag beneath the name (e.g. `"#9"`, a position). Keep very short; omit to hide.

**When to Use:** When the narration describes a free kick, wall setup, or goalkeeper save — not a scored goal (use `goal_moment` for that).

**Notes:** `shotLabel` and the kicker badge do not reflow; keep `shotLabel` and `kickerName` brief.

---

## corner_kick

**Visual:** Ball sits at the right corner flag; the corner taker runs up and delivers it with a foot kick. The ball is then passed stickman-to-stickman across a worked routine — one receiving stickman per **step** (3–5 total), each headed pass moving right-to-left toward the goal on the left. A goalkeeper guards the goal; the final header strikes the post, the ball drops, and the keeper bends down to gather it. Each `steps[i].label` (and optional `detail`) pops above the receiving stickman's head when the ball arrives and stays visible. Title top-centre; narration centred on the grass band below the action line (expands up and down as it wraps).

**Best for:** Worked corner routines, build-up moves, set-piece breakdowns, or any step-by-step passing sequence that ends in a near-miss or save — not a goal.

**Props:**
- `steps` — **object_array**, **3–5** items. **REQUIRED — never omit this key.** The scene cannot render without it; `{}` or missing `steps` is invalid. Each item:
  - `label` — **string**, short name for that pass/step (e.g. `"Corner"`, `"Flick on"`, `"Header"`). **1–3 words**. **Required on every item.**
  - `detail` — **string**, optional tactical hint beneath the label (e.g. `"Near post"`, `"Just wide"`). **1–4 words**; omit or leave empty to hide.

**Example `layout_props_json` (minimum valid output):**
```json
{
  "steps": [
    { "label": "Corner", "detail": "Inswinger" },
    { "label": "Flick on", "detail": "Near post" },
    { "label": "Lay off", "detail": "Edge of box" },
    { "label": "Header", "detail": "Just wide" }
  ]
}
```

**When to Use:** When the narration describes a sequence of passes or a corner/set-piece routine that does **not** end in a goal — use `goal_moment` for a scored payoff. **Do not assign `corner_kick` unless you can populate `steps`.**

**Notes:** The first step is always the corner delivery; the last step is the header on goal that misses or is saved. Every `steps` item must include a `label`; provide a `detail` when the source names a specific zone or outcome. If the source names fewer than 3 beats, **infer sensible intermediate steps** from the narration (e.g. `"Pass"`, `"Through ball"`, `"Build-up"`) so the array has **at least 3** items — never return an empty array or skip `steps`. Keep labels short so the step cards above each stickman's head do not overflow.

---

## goal_moment

**Visual:** Long-range strike scene: kicker runs in, a dispersed wall of small defenders, goalkeeper dives the wrong way, ball flies to the top corner, net ripples, and a bold stamp pops above the goal. The scorer jumps, lands, then raises both arms and holds the pose. A name/number badge floats above the kicker's head during the run-up and fades out as the celebration begins. Title and narration sit bottom-centre on the grass strip.

**Best for:** The key scoring moment, climax, or any high-impact payoff beat.

**Props:**
- `goalLabel` — **string**, celebratory stamp above the goal (e.g. `"GOAL!"`). Keep **≤ 8 characters**.
- `scoreline` — **string**, optional score beneath the stamp (e.g. `"2 – 1"`). Omit or leave empty to hide.
- `kickerName` — **string**, name badge above the scorer's head (e.g. `"Striker"`, a player surname). **1–2 words**; omit to hide.
- `kickerNumber` — **string**, short tag beneath the name (e.g. `"#9"`, a position). Keep very short; omit to hide.

**When to Use:** Genuine goal or highlight payoff moments only — use sparingly for impact.

**Notes:** Long `goalLabel` strings may overflow at default title size. The kicker badge does not reflow — keep `kickerName` short.

---

## match_stats

**Visual:** Bold centred title with accent underline sweep, then a horizontal row of up to five rounded stat tiles on faint chalk pitch markings. Each tile shows a large value and a short label; numeric values count up.

**Best for:** Post-match or half-time numbers — several metrics side by side.

**Props:**
- `stats` — **object_array**, up to **5** items. Each item: `{ "label": string, "value": string }`. One tile per item.

**When to Use:** When the narration presents **3–5** distinct match metrics that deserve equal tile weight.

**Notes:** Extras beyond index 4 are ignored. Numeric strings count up; non-numeric values (e.g. `"Win"`) fade in. Labels do not wrap inside tiles — keep short.

---

## injury_break

**Visual:** Split-screen with a vertical rule. Left column: stickman down with a first-aid cross and a crouching teammate. Right column: matching heading style. Each side has a bold label and body copy beneath.

**Best for:** In-game injury stoppages, setbacks, or cause-vs-outcome contrast.

**Props:**
- `leftLabel` — **string**, bold heading for the left column (e.g. `"What happened"`).
- `rightLabel` — **string**, bold heading for the right column (e.g. `"The outcome"`).
- `leftDescription` — **text**, body copy for the left column — what occurred.
- `rightDescription` — **text**, body copy for the right column — the result or recovery status.

**When to Use:** When the narration explicitly splits an incident into cause and consequence.

**Notes:** Keep descriptions concise; long copy may crowd the left-column illustration.

---

## ball_control

**Visual:** Two stickmen face each other on the grass and volley a ball back and forth through the air — it never touches the ground. Each player strikes it across with a foot volley or a header (alternating), the kicking leg snapping up or the head nodding to meet each touch, the ball arcing high above both heads. Up to three small cardboard stat chips float above the action; title and narration wipe in to the right with a skill-caption pill below.

**Best for:** Skill, teamwork-in-the-air, technique or one-touch passing beats.

**Props:**
- `skillCaption` — **string**, short label inside the pill badge (e.g. `"First touch"`, `"Ball Control"`). **1–3 words**.
- `stats` — **object_array**, up to **3** items. Each item: `{ "label": string, "value": string }`. Shown as small cards above the juggler's head. Provide **0** to hide.

**When to Use:** When ball skill, control, or in-the-air passing between two players is the focus — not set pieces or a scored goal.

**Notes:** No image slot. The aerial volley loop runs for the whole scene. Keep stat `value` short (`"57"`, `"1.2k"`) and `label` to 1–2 words.

---

## text_narration

**Visual:** A "pundits' reports" scene on a grass pitch. Two detailed suited stickmen (visible neck, jacket + tie, arms curved through the elbow — one waving, one holding a board) stand on either half of the screen, each holding up a cardboard sign that shows a short report/verdict; the boards wave gently. Title, eyebrow and narration sit centred at the top (no divider line).

**Best for:** Commentary, analysis, pundit verdicts, or any two-sided "what they said" beat.

**Props:**
- `eyebrow` — **string**, small accent kicker in caps above the title (e.g. `"Match Report"`). Defaults in `meta.json` if omitted.
- `leftLabel` / `rightLabel` — **string**, heading on each reporter's cardboard sign (e.g. a pundit name). **1–2 words**.
- `leftDescription` / `rightDescription` — **text**, the report/verdict on each reporter's sign — one short line each.

**When to Use:** Default workhorse for explanatory narration, especially two contrasting verdicts or reports.

**Notes:** No image slot. Keep each report to one short line so it fits the cardboard sign.

---

## ending_socials

**Visual:** The whole team celebrates — six stickmen jumping with arms raised on the grass, the captain in the middle holding a golden trophy cup overhead, confetti raining down. The valediction title + sign-off line sit at the top, with a centred row of built-in social icons (Instagram, YouTube, TikTok, Facebook, LinkedIn, Medium, Substack) and one or more website CTA pill buttons.

**Best for:** Final outro when channel or team follow data is available.

**Props:**
- `socials` — **object_array** (max 7). Each item `{ "platform", "enabled", "label" }`; `platform` is one of `instagram|youtube|tiktok|facebook|linkedin|medium|substack`, `enabled` is `"true"`/`"false"`, `label` is the handle/label shown under the icon. Enabled platforms render as inline icons in a fixed order.
- `handles` — **string_array**, fallback handle row used **only** when no `socials` platforms are provided.
- `showWebsiteButton` — **select** `"true"`/`"false"`, toggles the website CTA.
- `websiteLink` — **string**, URL shown beneath the CTA pill (scheme/trailing slash stripped for display).
- `ctaButtonText` — **string**, label on the CTA pill (e.g. `"Follow the team"`).
- `ctas` — **object_array** (max 3) of `{ "ctaButtonText", "websiteLink", "showWebsiteButton" }`; overrides the single CTA fields when provided.

**When to Use:** Always the **last scene** when CTA or social data exists. Do not use mid-video.

**Notes:** Prefer `socials` over `handles` for the icon row. `title` and `narration` are global scene fields — the layout uses them for the sign-off headline and closing line.

---

## football_data_viz

**Visual:** Full-green top-down pitch with a white wash and vignette. A thick frosted-glass card sits centre-frame; inside, a hand-drawn SVG chart (line, bar, or histogram) animates in with axes and gridlines. Title + accent underline above the card; optional `chartSummary` caption beneath the graphic.

**Best for:** Time series, comparisons, or distributions when the source provides a real chartable table (match stats over time, shots per matchday, possession trends, etc.).

**Props:**
- `chartType` — **select** `"auto"` | `"line"` | `"bar"` | `"histogram"`. Use `"auto"` unless the source clearly implies one type.
- `chartTable` — **chart_table** (required when this layout is used): col 1 = category labels (X); cols 2–4 = up to three numeric series (max 20 rows). **Never invent numbers** — bind only real table data from the source.
- `yAxisLabel` — **string**, Y-axis caption (overrides second header when set).
- `subtitle` — **string**, X-axis / category caption (overrides first column header when set).
- `chartYAxisTicks` — **string_array**, optional custom Y tick labels (2–4 values, top → bottom).
- `chartSummary` — **string**, one short read beneath the chart paraphrased from the source trend.
- `barPrimaryColor` / `barSecondaryColor` / `barTertiaryColor` — **color**, series colours (defaults in `meta.json`).

**When to Use:** When the source contains a **real multi-row table** suitable for charting — not for 3–5 headline KPIs (use `match_stats` instead). **Omit this layout entirely** if no chartable table exists in the source.

**Notes:** No image slot. Do not fabricate `chartTable` rows or headers.

---

## football_ticker

**Visual:** Same pitch backdrop and frosted card. A football-styled data table fills the card: accent header row, staggered row reveal, optional green/red highlight on a numeric column. `tickerTitle` subtitle under the scene title; `tickerFootnote` or narration as source line at the bottom.

**Best for:** League tables, standings, squad lists, fixture grids, or any tabular snapshot from the source (max 20 rows × 6 cols).

**Props:**
- `tickerTitle` — **string**, table subtitle beneath the scene title (e.g. `"Premier League table"`).
- `tickerTable` — **ticker_table** (required when this layout is used): col 1 = row labels; cols 2–6 = values. **Never invent rows** — bind only real table data from the source.
- `tickerHighlightCol` — **number**, 0-based column index for green (+) / red (−) numeric highlight; `-1` to disable.
- `tickerFootnote` — **string**, source or footnote line (e.g. `"Source: matchday data"`).

**When to Use:** When the source provides a **real tabular dataset** (standings, rankings, schedules). **Omit this layout** if no table exists. Do not use for a handful of isolated stats (`match_stats` is better).

**Notes:** No image slot. Prefer `tickerFootnote` for attribution when the source names one.

---

# Scene Flow Rules

- Scene **0** must use **`kickoff_title`** (hero).
- **Middle:** prefer **`passing_play`** and **`text_narration`** as narrative workhorses; rotate in `freekick_setup` for set pieces, **`corner_kick`** for worked build-up routines that miss, `ball_control` for individual skill, `match_stats` for several numbers at once, **`football_data_viz`** / **`football_ticker`** when the source has real chartable or tabular data, `injury_break` for setbacks, and `goal_moment` for a genuine payoff.
- **`match_stats`** is for **3–5** metrics in tiles; **`passing_play`** `stats` is a small **2×2** supporting set alongside the action.
- **`football_data_viz`** needs a **multi-row chart table** from the source; **`football_ticker`** needs a **real standings/list table** — never assign without source data.
- **Closing:** use **`ending_socials`** as the final scene when CTA or social data is available; otherwise close with `goal_moment` or a strong `text_narration`.
- Keep the energy playful and lively; avoid stacking identical layouts back-to-back.

---

# Content Extraction Rules

**Global fields (every scene — not in `layout_props_json`):**
- `title`: **3–8 words** — energetic scene headline in a sporty tone.
- `narration`: **about 12–20 words** — concise spoken-style copy; one breath per scene.

**Per layout (structured props only):**
- **`kickoff_title`:** `subline` = short tagline paraphrased from the intro beat.
- **`passing_play`:** Split real figures from the source into `stats` `{ label, value }`; never invent numbers. Use 0–4 items as justified.
- **`freekick_setup`:** `shotLabel` = the shot type or outcome in 2–4 words (e.g. `"Near post"`, `"Wall blocks"`); `kickerName` / `kickerNumber` = the taker's name/number if named in the source, otherwise omit both.
- **`corner_kick`:** **`steps` is mandatory** — always output **3–5** items; never `{}`, never omit the key, never `[]`. Split the narration into ordered build-up beats: first = corner delivery, last = header on goal that misses or is saved. Each item **must** have `label` (1–3 words, e.g. `"Flick on"`); add `detail` (1–4 words, e.g. `"Near post"`) when the source names a zone or outcome, otherwise omit `detail`. If the source only implies a routine without naming every touch, **synthesize plausible step labels** from context (e.g. `"Corner"` → `"Pass"` → `"Header"`) rather than leaving `steps` empty.
- **`goal_moment`:** `goalLabel` = short stamp word; `scoreline` = real score string if stated in source, otherwise omit; `kickerName` / `kickerNumber` = the scorer's name/number if named in the source, otherwise omit both.
- **`match_stats`:** Pull **3–5** real metrics into `stats`; each `value` short, each `label` 1–2 words.
- **`injury_break`:** `leftLabel` / `rightLabel` = contrasting column titles; `leftDescription` = incident, `rightDescription` = outcome — one concise line each.
- **`ball_control`:** `skillCaption` = the named skill or technique (1–3 words); `stats` = up to 3 real figures about the player/skill if the source provides them, otherwise omit.
- **`text_narration`:** `eyebrow` = section kicker (e.g. `"Half Time"`, `"Tactical Note"`); `leftLabel`/`rightLabel` = the two reporters/pundits; `leftDescription`/`rightDescription` = each one's short verdict on their cardboard sign (one line each, grounded in the source).
- **`ending_socials`:** enable only the `socials` platforms actually present in the source (others `enabled: "false"`); `handles` only if no platforms are given; `ctaButtonText` = imperative phrase ≤ 4 words; `websiteLink` only if a real URL is in the source.
- **`football_data_viz`:** Populate `chartTable` **only** from a real source table — headers in row 1 of the table, data rows below; set `chartType` to match the data shape; `chartSummary` = one factual trend sentence from the source; axis labels from column headers when sensible. **Never invent series or values.**
- **`football_ticker`:** Populate `tickerTable` **only** from a real source table; `tickerTitle` = what the table represents; `tickerHighlightCol` = index of a +/- numeric column (e.g. goal difference) when present, else `-1`; `tickerFootnote` = source attribution if stated. **Never invent rows.**

**Grounding:** If the source does not support a layout (e.g. no numbers for `match_stats`, no table for `football_data_viz`/`football_ticker`), choose a different layout or keep global `narration` factual without inventing figures. **Exception:** `corner_kick` always requires `steps` — if the source lacks explicit step names, derive them from the narration beat-by-beat or use generic build-up labels (`"Corner"`, `"Pass"`, `"Through ball"`, `"Header"`) so the array has 3–5 labelled items.

---

# Variety Rules

- Do **not** repeat the **same** layout in consecutive scenes.
- Alternate action (`passing_play`, `ball_control`, `freekick_setup`, `corner_kick`), narration (`text_narration`), data (`match_stats`, `football_data_viz`, `football_ticker`, `passing_play` stats), and payoff (`goal_moment`) beats as content demands.
- Use **`goal_moment`** for genuine highlights only — sparingly, for impact.
- End with **`ending_socials`** when CTA/social data exists; otherwise a memorable closing beat.
- Across **6+** scenes, prefer **at least 4 distinct** layout IDs when content allows.
