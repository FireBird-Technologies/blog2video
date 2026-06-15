# Design Philosophy

Cinematic night-sky sibling of the daytime Stick Man template — moon-cyan chalk strokes, twinkling starfields, and hand-drawn stick figures tell your story with calm, atmospheric energy.

---

# Layout Catalog

---

## chalk_title
**Visual:** A deep blue-black (#0A0E1A) canvas filled with a twinkling starfield and radial vignette, featuring a large moon-cyan chalk title centered at ~42% from the top with an animated chalk underline drawing in beneath it; a small stick figure in the bottom-right gazes upward with one arm raised, and optional narration text appears below the title.

**Props:**
  - `imageUrl` (string) — full-canvas background image rendered at 0.35 opacity behind all elements

**When to Use:** Use `chalk_title` for cinematic title cards with a night-sky or astronomy theme, or any scene needing a handcrafted chalk aesthetic with a single focal headline. Works well as an opening or chapter-break slide.

**Avoid When:** The scene requires multiple competing text blocks or dense informational content, as the layout is optimized for a single prominent title.

**Notes:**
- The chalk underline animates in after the title (frames 25–45); very short scenes may clip this animation before it completes.
- Long titles wrap with `pre-wrap` / `break-word` but may overlap the narration zone at large font sizes — keep titles concise.
- The background image is always rendered at a fixed 0.35 opacity; it serves as atmosphere only and cannot be made more prominent.

---

## night_walk

**Visual:** A dark night-sky scene with a twinkling starfield, crescent moon, and fireflies floating near the ground. A chalk-drawn stick figure walks left-to-right across the bottom of the canvas, triggering warm radial glows from three sequential streetlamps; the left column (~54%) shows a moon-cyan title with a chalk underline and off-white narration, while the right column (~46%) is either open starfield or a framed image card with a hand-drawn cyan border.

**Props:**
  - `imageUrl` (string) — when provided, fills the right column as a framed card with a thin cyan hand-drawn border; omit for open starfield
  - `imageObjectPosition` (string) — controls focal point of the image within the card frame

**When to Use:** Choose `night_walk` for atmospheric, story-driven scenes that benefit from ambient motion and a hand-drawn aesthetic — particularly night-themed narratives, journeys, or reflective voiceover moments.

**Avoid When:** The content requires multiple images, dense text blocks, or a bright/energetic visual tone that conflicts with the dark nocturnal palette.

**Notes:**
- The stick figure always walks the full canvas width regardless of content; on portrait (`aspectRatio: "portrait"`) the lamp and figure Y positions shift to match the taller canvas
- Long titles may overflow the left column (~54% width); keep titles concise for best chalk draw-on effect
- The streetlamp glow trigger is position-based (figure proximity), so very short `sceneDurationInFrames` values may cause lamps to flicker on too rapidly or not at all

---

## shooting_star
**Visual:** A deep navy night-sky canvas filled with 150 twinkling stars, floating fireflies, and a crescent moon in the upper-right. A bright cyan comet with a fading tail arcs diagonally from upper-left to lower-right; at the moment of impact, a radial cyan flash bursts at center-screen, the title snaps in with a brief scale-down, and narration fades up beneath it. A chalk-styled stick figure stands center-left with its right arm raised, tracking the star overhead.

**Props:** _No layout-specific props — uses only the shared title/narration/style props._

**When to Use:** Choose `shooting_star` for dramatic reveal moments—product launches, key facts, or chapter openers—where you want a cinematic night-sky metaphor with a timed "aha" impact beat.

**Avoid When:** The scene is conversational or requires sustained on-screen text, since the layout is built around a single timed reveal with minimal persistent content.

**Notes:**
- The comet animation is hardcoded to start at 0.3 s and travel for 0.9 s; the flash fires at 1.2 s and narration appears at 1.8 s, so scenes shorter than ~90 frames (3 s at 30 fps) will clip the sequence.
- `imageUrl` is accepted as a prop but the layout contains no `<Img>` render path—images will be silently ignored.
- Long title strings may overflow the centered text block; keep titles to one short punchy line for best visual impact with the flash burst.

---

## constellation_stats
**Visual:** A dark night-sky canvas with a twinkling starfield and crescent moon. Three to six chalk-drawn stick figures appear one by one along a shared ground line, each holding a cardboard sign above their head that lifts up as they arrive. A hand-drawn rope connects adjacent figures at waist height, drawing in between each pair once both figures are present. Each sign displays a counting-up stat value; a label for each stat appears beneath the figure's feet.

**Props:**
  - `stats` (object_array) — **Minimum 3, maximum 6** `{ label, value }` items; each item becomes one stick figure with its own sign. Fewer than 3 will render but look sparse — always provide at least 3.

**When to Use:** Ideal for presenting 3–6 key metrics or statistics with a playful, hand-drawn team aesthetic; use `constellation_stats` when you want animated figures joining a rope to reveal stats one by one.

**Avoid When:** You have fewer than 3 stats (layout looks too sparse) or more than 6 stats (figures become too small). Does not support images.

**Notes:**
- Always provide at least 3 stats; the AI must generate a minimum of 3 `{ label, value }` objects for this layout
- Maximum of 6 stat items; extras beyond 6 are silently ignored
- Numeric values in `value` strings animate with a count-up effect; mixed strings (e.g. `"$1.2M"`, `"98%"`) are supported via prefix/suffix parsing
- Figures scale and space automatically based on count; no custom positioning available

---

## moonphase_chart
**Visual:** A dark night-sky canvas with a twinkling starfield. Between 3 and 5 moon discs float in a horizontal row, progressing from a thin crescent on the left to a full glowing circle on the right. Below them stands a chalk stick figure waving both arms upward. Each moon shows only its lit area — no filled dark side — giving clean crescent, half, gibbous, and full shapes. A label beneath each moon names it.

**Props:**
  - `bars` (object_array) — Array of 3–5 objects, each with a `label` (string, any text — shown below the moon). The `value` field is ignored; moon phase shapes are determined automatically by position (evenly spaced crescent → full).

**When to Use:** Use `moonphase_chart` for any sequence or progression concept where a visual journey from "start" to "complete" adds narrative value. The labels can be anything — stages, milestones, concepts — not just percentages.

**Avoid When:** You need to show precise numerical data or have more than 5 items.

**Notes:**
- Moon shapes are fixed by position: with N moons, shape values are evenly distributed from 10 (crescent) to 100 (full), regardless of the `value` field in bars.
- Labels can be any text — names, dates, stages. No numeric values are displayed on the moons.
- Minimum 3 moons are always shown even if fewer bars are provided.
- No image support; `imageUrl` is accepted in props but not rendered in this layout.

---

## shadow_comparison
**Visual:** Two chalk-style stick figures stand on opposite sides of a dark starfield canvas, each casting a moonlit elliptical shadow stretching toward the center. A chalk-outlined thought cloud floats above each figure, alternating a soft cyan glow — left pulses bright while right dims, then they swap — separated by a dashed vertical dividing line down the middle.

**Props:**
  - `leftThought` (text) — Text displayed inside the left figure's glowing thought cloud.
  - `rightThought` (text) — Text displayed inside the right figure's thought cloud.

**When to Use:** Use `shadow_comparison` when presenting two contrasting ideas, choices, or perspectives with a dramatic, atmospheric tone. Ideal for narrative-driven comparisons where the alternating glow visually emphasizes each side in turn.

**Avoid When:** The comparison requires more than two options or needs detailed supporting text beyond short thought-cloud labels.

**Notes:**
- `leftThought` and `rightThought` should be short phrases; long text will overflow the chalk cloud outline.
- The glow alternation is time-coded (swaps at ~2 seconds), so scene duration should be at least 3–4 seconds for the full effect to read.
- No image support; the layout is entirely SVG-driven with procedural starfield, fireflies, and a crescent moon.

---

## signal_fire_scene
**Visual:** A dark night-sky canvas featuring a crouching chalk-style stick figure tending a glowing cyan flame cluster at lower-center, with a pulsing radial light pool on the ground beneath it. Fireflies drift through the upper half, stars twinkle across the background, and title plus narration text appear in chalk style to the left of the figure, softly tinted by the fire's ambient glow.

**Props:** _No layout-specific props — uses only the shared title/narration/style props._

**When to Use:** Use `signal_fire_scene` for narrative moments evoking isolation, survival, signaling, or quiet perseverance at night. Works well as a contemplative interlude or scene-setting beat in story-driven or educational content.

**Avoid When:** Avoid when the content requires bright, high-contrast backgrounds or when imagery needs to dominate — the dark palette and SVG-only rendering leave little room for photo-based visuals.

**Notes:**
- No image rendering is implemented despite `imageUrl` being a declared prop — the scene is fully SVG/vector-drawn.
- Long title text may overflow the left text column in landscape mode; keep titles under ~40 characters for safe rendering.
- The fire glow, flame flicker, figure sway, firefly drift, and star twinkle are all procedurally animated and cannot be disabled via props.

---

## neon_countdown
**Visual:** A dark space-themed canvas with a large glowing cyan ring (stroke only) centered on screen, its arc depleting clockwise each second while the countdown numeral inside flickers and scales on each tick. Floating fireflies, a twinkling starfield, and a chalk-style crescent moon complete the atmospheric background.

**Props:**
  - `startFrom` (number) — Integer 2–9 controlling how many seconds the countdown runs and how many arc depletion steps occur
  - `label` (string) — Optional small text displayed beneath the ring, fading in after ~0.3 s

**When to Use:** Use `neon_countdown` for dramatic countdowns, launch sequences, or timed transitions where a glowing sci-fi or chalkboard-night aesthetic fits. It works best as a standalone interstitial scene.

**Avoid When:** Avoid when the scene requires body text, images, or multiple simultaneous content elements — this layout is purely countdown-focused.

**Notes:**
- `startFrom` is clamped to the range 2–9; values outside this range are rounded and clipped automatically
- `imageUrl` and `title`/`narration` props are accepted by the component signature but not rendered — do not rely on them for content
- Long `label` strings may overflow visually beneath the ring; keep labels short (under ~30 characters)

---

## lantern_dialogue
**Visual:** Two chalk-drawn stick figures stand in the lower third of the canvas facing each other, each holding a glowing hexagonal lantern. Speech bubbles with a chalk-stroke draw-on animation float above each figure; the active speaker's lantern brightens with a warm-white/cyan radial glow while the other dims, handing off at the scene's midpoint against a dark starfield background with drifting fireflies.

**Props:**
  - `leftBubble` (text) — Dialogue line displayed in the left figure's speech bubble; animates in at scene start.
  - `rightBubble` (text) — Dialogue line displayed in the right figure's speech bubble; animates in at the scene's halfway point.
  - `speakers` (object_array) — Up to 2 items with a `label` string each; labels fade in beneath the left and right figures respectively as speaker name tags.

**When to Use:** Use `lantern_dialogue` for two-character exchanges, interview-style scenes, or any moment requiring a clear visual turn-taking structure with atmospheric, hand-drawn charm.

**Avoid When:** More than two speakers are needed, or the scene requires photorealistic or brand-polished visuals.

**Notes:**
- The scene is split exactly in half: left figure speaks during the first 50% of frames, right figure speaks during the second 50% — dialogue timing is not configurable per-prop.
- Long bubble text may overflow the fixed bubble dimensions (`540×280` landscape, `500×280` portrait); keep each line concise.
- No image support; all visuals are SVG-rendered with chalk displacement filters and procedural starfield/firefly elements.

---

## ending_socials
**Visual:** A dark night-sky scene with a twinkling starfield, drifting fireflies, and a large crescent moon at the top-center. The sign-off title appears in moon-cyan below the moon, followed by a centered row of inline chalk-stroke social icons — each captioned with its label — and a website CTA (label above, link below). A chalk stick figure stands on the right, facing the camera with a drawn face, waving toward the text area.

**Props:**
  - `socials` (object_array) — Up to 7 `{ platform, enabled, label }` items. Each item with `enabled: "true"` renders as an inline chalk-stroke icon with its `label` shown beneath it. Valid `platform` values: `facebook`, `instagram`, `youtube`, `medium`, `substack`, `linkedin`, `tiktok`.
  - `handles` (string_array) — Fallback text handles, only used when no `socials` map is provided.
  - `ctas` (object_array) — Up to 3 CTAs, each `{ ctaButtonText, websiteLink, showWebsiteButton }`, rendered side by side (label above, link below). Overrides the single-CTA fields below when provided.
  - `showWebsiteButton` (select `"true"`/`"false"`) — Toggles the (single) website CTA block.
  - `ctaButtonText` (string) — Call-to-action label shown above the website link (e.g. `"Explore more on"`).
  - `websiteLink` (string) — Website URL shown beneath the CTA label (the `https://` prefix is stripped for display).

**When to Use:** Ideal as a final scene where you want a dreamy, atmospheric sign-off that showcases social platforms and an optional website link with cinematic chalk-on-night-sky aesthetics.

**Avoid When:** The video has a bright, high-energy, or corporate visual style that conflicts with the dark starfield and hand-drawn chalk aesthetic.

**Notes:**
- Social icons come from the `socials` object_array; the `handles` string_array is only a fallback when `socials` is absent.
- The entire scene fades in over ~18 frames and fades out over the final ~18 frames — keep the scene long enough (≥150 frames recommended) for all staggered animations to complete.
- Icon labels and the CTA label render at the narration font size; keep labels short so the centered row does not overflow on portrait.

## data_visualisation
**Visual:** A real animated chart (line / bar / histogram) glowing against the night canvas in the hand-drawn night aesthetic, with a short read beside the chart.

**Best for:** Charting an ACTUAL data table from the source article (a trend over time, a comparison between categories, or a distribution) — distinct from simple stat bars.

**Props (shared with the chart pipeline — usually filled automatically from the bound table):**
- `chartTable`: `{ headers: [...], rows: [[...]] }` — col 1 = X labels; cols 2–4 = up to 3 numeric series
- `chartType`: `"line" | "bar" | "histogram" | "auto"` (line = trend over time; bar = named categories; histogram = numeric bins/ranges)
- `chartSummary`: one-to-two sentence read of the chart (emphasize key phrases with `__double underscores__`)
- `subtitle`, `yAxisLabel`, `chartYAxisTicks` (optional axis captions/ticks)

**When to Use:**
- ONLY for a scene the pipeline bound to a real chartable table (`preferred_layout='data_visualisation'` + a `data_table_index`). Never fabricate chart figures — values come from the bound table.

---

## ticker_table
**Visual:** A frosted-glass data table on the starfield night canvas — cyan accent headers, rows stagger-fade in, numeric cells in the highlight column glow green (positive) or pulse red (negative) against the dark background.

**Best for:** Any scene with a real multi-row, multi-column dataset — rankings, statistics tables, comparison grids.

**Props:**
- `tickerTable`: `{ headers: string[], rows: string[][] }` — col 1 = row labels; cols 2–6 = values. Max 20 rows, 6 columns. Never fabricate rows — use only data from the source.
- `tickerTitle` (string): optional subtitle line under the main title
- `tickerHighlightCol` (number): 0-based column index to green/red-color by sign. Set `-1` to disable.
- `tickerFootnote` (string): optional source/footnote line

**When to Use:**
- The source contains a real table or multi-row dataset that cannot be captured well by `constellation_stats` or `moonphase_chart`.
- Prefer `data_visualisation` for trend/distribution charts; use `ticker_table` for structured grids.

---
