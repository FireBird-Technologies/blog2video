Layout catalog for STICKMAN_FOOTBALL template
=============================================

Use these layout IDs exactly for `preferred_layout`:

- `kickoff_title`    — opening hero kick-off sequence (scene 0 only)
- `passing_play`     — two-player passing rally with optional 2×2 stat cards
- `freekick_setup`   — free-kick set piece ending in a **save** (not a goal)
- `goal_moment`      — long-range strike that **scores** + celebration
- `match_stats`      — 3–5 equal-weight stats on a top-down pitch (numbers scene)
- `injury_break`     — injured player + friend (left) vs referee red-carding a player (right)
- `ball_control`     — two players volleying a ball in the air (head & foot, never grounded)
- `text_narration`   — two suited pundits holding report boards (prose / verdicts)
- `ending_socials`   — full-team trophy celebration + socials + CTA (closing scene only)
- `football_data_viz` — frosted-card SVG chart on the pitch (real chart table required)
- `football_ticker`  — frosted-card data table / standings ticker on the pitch

Placement rules
---------------

- Scene 0 MUST be `kickoff_title`.
- The LAST scene MUST be `ending_socials` when CTA or social handles are available; otherwise close with `goal_moment` or a strong `text_narration`.
- Never repeat the same layout in consecutive scenes.
- Prefer `passing_play` and `text_narration` as middle-scene workhorses.
- Use `goal_moment` only for a genuine scored-goal or climax payoff — at most once or twice per video.
- `ending_socials` must NOT be used mid-video.
- Across 6+ scenes, use at least 4 distinct layout IDs when content allows.

Selection heuristics
--------------------

- Opening / match intro / video title reveal: `kickoff_title` (scene 0 only).
- Two players, teamwork, build-up, possession, passing rhythm: `passing_play`.
- A few supporting stats **alongside** the passing action (≤4): `passing_play` (with `stats` props).
- Free kick, wall, goalkeeper **save**, deflection, near-miss, taker despair: `freekick_setup`.
- Ball **enters the net**, scorer celebrates, "GOAL!", score update, match-winner: `goal_moment`.
- Scene is mainly **3–5 numbers** with no action choreography: `match_stats`.
- Injury or a **sending-off / red card** dispute, stoppage, controversy: `injury_break`.
- Ball skill, control, juggling, or two players keeping it up in the air: `ball_control`.
- Commentary, pundit verdicts, "what they said", tactical note, recap, or nothing more specific fits: `text_narration`.
- Final scene with social handles or follow CTA: `ending_socials`.
- Real **multi-row chartable table** (time series, comparisons, histogram bins): `football_data_viz`.
- Real **tabular standings / list / schedule** from the source: `football_ticker`.

Do NOT assign
-------------

| If the narration is about…              | Do NOT use…        | Use instead…                          |
|----------------------------------------|--------------------|---------------------------------------|
| A scored goal / net ripples / celebration | `freekick_setup` | `goal_moment`                         |
| Keeper save / blocked shot / miss      | `goal_moment`      | `freekick_setup`                      |
| 3–5 headline metrics, no player action | `passing_play`     | `match_stats`                         |
| 1–4 stats beside a passing rally       | `match_stats`      | `passing_play`                        |
| Ground passing rally                   | `ball_control`     | `passing_play`                        |
| Aerial keepy-up / volley skill         | `passing_play`     | `ball_control`                        |
| Injury or red-card dispute             | `text_narration`   | `injury_break`                        |
| Mid-video explainer                    | `ending_socials`   | `text_narration` or `passing_play`    |
| Any scene after 0                      | `kickoff_title`    | `text_narration` or `passing_play`    |
| 3–5 headline KPIs, no table            | `football_data_viz`| `match_stats`                         |
| Real chartable multi-row table         | `match_stats`      | `football_data_viz`                   |
| Standings / league table               | `match_stats`      | `football_ticker`                     |
| No source table at all                 | `football_data_viz`, `football_ticker` | `text_narration` or `passing_play` |

Layout summaries
----------------

### `kickoff_title`
Stickman walks in, kicks the ball, title + narration reveal on impact; teammates line up. `subline` tagline beneath the title. **Scene 0 only.**

### `passing_play`
Two stickmen pass back and forth on a full pitch. Text top-left; up to four stat cards on cardboard (right in landscape, below text in portrait).

### `freekick_setup`
Taker walks up, three-man wall, GK dive **save**, ball deflects back, taker kneels in despair. `shotLabel` on the goal card; `kickerName`/`kickerNumber` badge floats above the taker. Near-miss / set-piece tension — **not a goal**.

### `goal_moment`
Long-range shot beats wall + wrong-way GK dive; ball hits net, `goalLabel` stamp, optional `scoreline`. Scorer walks up, strikes, jumps and raises arms; `kickerName`/`kickerNumber` badge above the scorer. Title + narration centred on the grass band.

### `match_stats`
Full-green top-down pitch (goals top/bottom in portrait, left/right in landscape). Title at top, narration centred, up to **4** cardboard stat cards along the bottom. Pure numbers scene — no stickman action.

### `injury_break`
Injured player lying down with a friend kneeling and waving for help + first-aid cross (left); a **red referee** (black face/feet) brandishing a red card at an arguing player who waves then puts hands on head (right). `leftLabel`/`leftDescription` and `rightLabel`/`rightDescription` head each side. Portrait stacks the two halves top/bottom.

### `ball_control`
Two stickmen face each other and volley a ball through the **air** — headers and foot volleys, never touching the ground. Up to **3** stat chips above the action; title/narration + `skillCaption` pill on the right.

### `text_narration`
Two suited **pundits** (visible neck, jacket + tie, arms curved at the elbow) hold cardboard report boards overhead with both hands, showing `leftLabel`/`leftDescription` and `rightLabel`/`rightDescription`. Title + `eyebrow` + narration centred at the top.

### `ending_socials`
The full team (6 stickmen) jumps and celebrates on the grass, captain in the middle holding a golden trophy cup overhead, confetti raining. Sign-off title + narration at the top; a row of built-in social icons (`socials`) and website CTA pill(s). **Last scene only** when follow/CTA data exists.

### `football_data_viz`
Top-down green pitch + white wash + frosted glass card. Custom SVG line/bar/histogram inside the card; title + accent rule above. Requires a real `chartTable` from the source — never assign without one.

### `football_ticker`
Same pitch + frosted card. Tabular ticker with accent header, staggered rows, optional green/red highlight column. Requires a real `tickerTable` — league tables, standings, schedules.

Props quick-reference
---------------------

Only these keys belong in `layout_props_json` (never `title`, `narration`, or colors):

| Layout           | Layout props                                                                          |
|------------------|---------------------------------------------------------------------------------------|
| `kickoff_title`  | `subline` (string)                                                                    |
| `passing_play`   | `stats` — `[{ "label", "value" }]`, max 4; omit or `[]` to hide                       |
| `freekick_setup` | `shotLabel` (2–4 words), `kickerName` (1–2 words), `kickerNumber` (short)             |
| `goal_moment`    | `goalLabel` (≤8 chars), `scoreline` (optional), `kickerName`, `kickerNumber`          |
| `match_stats`    | `stats` — `[{ "label", "value" }]`, max 4                                             |
| `injury_break`   | `leftLabel`, `rightLabel`, `leftDescription`, `rightDescription`                      |
| `ball_control`   | `skillCaption` (1–3 words), `stats` — `[{ "label", "value" }]`, max 3 (optional)      |
| `text_narration` | `eyebrow`, `leftLabel`, `rightLabel`, `leftDescription`, `rightDescription`           |
| `ending_socials` | `socials` (platform array), `handles` (fallback), `ctaButtonText`, `websiteLink`, `showWebsiteButton`, `ctas` |
| `football_data_viz` | `chartType`, `chartTable`, `yAxisLabel`, `subtitle`, `chartYAxisTicks`, `chartSummary`, `barPrimaryColor`, `barSecondaryColor`, `barTertiaryColor` |
| `football_ticker` | `tickerTitle`, `tickerTable`, `tickerHighlightCol`, `tickerFootnote`                  |

Image support
-------------

No layout in this template uses an `imageUrl` prop — imagery is assigned separately by the pipeline, never authored in `layout_props_json`.
