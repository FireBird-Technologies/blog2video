# Design Philosophy

A deeply characterful Japanese-aesthetic template featuring washi paper textures, Seigaiha wave patterns, Kamon crests, and falling cherry blossom petals. Ideal for converting written content into narrated, branded videos.

Each layout has its OWN background geometry (deep-plum radial, warm washi radial, a vertical crimson band, an asymmetric ink-corner wash, an off-center spotlight, or a celebration ring field), its OWN composition (centered, left-column+panel, two-column, asymmetric big-number, left-rail list, off-center block, full-bleed image), and its OWN entrance motion — so no two scenes read alike. Scene boundaries use a VARIED transition vocabulary chosen automatically per boundary (petal vortex/swarm/scatter, bloom-unfurl, shoji sliding panels, iris circle wipe, sumi ink-bleed, brush swipe, diagonal panel, vertical shutter, rack-focus bloom), with no two adjacent boundaries repeating. These are all automatic and not author-configurable.

---

# Japanese-Script Fields — ALWAYS Japanese

A few props in this template are a VISUAL / AESTHETIC element of the Japanese design, NOT translatable body copy. They must **always be written in Japanese (kanji/kana), regardless of the video's content language.** The "match the content language only" instruction does **NOT** apply to these fields — override it for them.

These fields are: `kanjiTitle` (sakura_intro), `chapterKanji` (sakura_section), `quote` + `quoteRoman` (sakura_quote), and `leftKanji` + `rightKanji` (sakura_two_column_detail).

Rules for these fields:
- Write **authentic Japanese**, never English words spelled in Latin letters and never a random/decorative glyph.
- The Japanese must be a **faithful translation of the English/Roman text paired with it** — its MEANING must match the line rendered directly beneath it (so a Japanese reader and an English reader see the same idea).
- Translate the **whole concept**, not word-by-word. Do **not** pick a single kanji that is merely a literal noun for one English word, and do **not** emit a lone kanji fragment of a compound word (e.g. 映 by itself for "video" is broken — the word is 映像). If one character can't carry the meaning cleanly, use the closest authentic **2-character word**. A correct real word always beats a shorter but misleading glyph.
- The paired Latin-script field (`romanTitle`, `chapterLabel`, `quoteTranslation`) is the **English MEANING (translation)** of its kanji and stays in the content language (English by default). Despite its name, `romanTitle` is **NOT rōmaji** — never spell out the Japanese sound in Latin letters (桜 → "Cherry Blossom", never "Sakura"). The ONLY field that carries a rōmaji reading is `quoteRoman` (sakura_quote), which is paired with a separate `quoteTranslation` for the meaning.

Field pairings (Japanese ⇄ its paired line):
- **sakura_intro** — `kanjiTitle` = the scene title translated into Japanese (keep it SHORT, 2–6 characters, so it doesn't overflow); `romanTitle` = the **English MEANING (translation) of that kanji**, NOT its rōmaji reading (e.g. 桜 → "Cherry Blossom", never "Sakura"; 春 → "Spring", never "Haru"). It stays in the content language.
- **sakura_section** — `chapterKanji` = a short Japanese label corresponding to `chapterLabel` (e.g. `chapterLabel` "Chapter One" → `chapterKanji` "第一章"); `chapterLabel` = the **English MEANING (translation) of `chapterKanji`**, NOT its rōmaji reading (e.g. 第一章 → "Chapter One", never "Dai Isshō"). It stays in the content language.
- **sakura_quote** — `quote` (Japanese phrase), `quoteRoman` (its Rōmaji reading), and `quoteTranslation` (its English meaning) are the **same phrase expressed three ways** and must stay consistent with each other.
- **sakura_two_column_detail** — `leftKanji` = the **EXACT Japanese translation of `leftHeadline`**, `rightKanji` = the **EXACT Japanese translation of `rightHeadline`**. Translate the headline itself into authentic Japanese — do not invent a loosely-related "marker" glyph. The headlines and bodies stay in the content language; only these two fields become Japanese. Keep each SHORT (it renders as a giant vertical tategaki word, ~2–4 characters ideal, 6 max) — so translate to the concise Japanese word/phrase for the headline, dropping filler like "Your"/"The". Examples: "Your Website" → ウェブサイト (or 網站), "Your Video" → 映像 (or 動画), "The Bloom" → 開花, "The Fall" → 落下. Never a lone kanji fragment of a compound word (映 alone for "video" is broken → 映像), never a literal word-by-word transliteration, never Latin letters. The two translations should contrast the way the headlines contrast.

---

# Layout Catalog

---

## sakura_intro
**Visual:** A full-bleed dark Japanese intro screen with a lacquer-to-void radial gradient background, subtle seigaiha (overlapping scales) pattern at near-invisible opacity, and a faint gold kamon (family crest) circle watermark centered on screen. Blush and mist petal clusters decorate all four corners, while animated cherry blossom petals rain continuously across the full scene.

**Props:**
  - `kanjiTitle` (string) — Large kanji characters (~160px Noto Serif JP 700, washi color) centered at ~38% vertical height; springs in from scale 0.6 on entry. **ALWAYS Japanese** (see "Japanese-Script Fields" above): a short 2–6 character Japanese translation of the scene title / `romanTitle`, regardless of content language.
  - `romanTitle` (string) — Subtitle (~36px Shippori Mincho 400, mist color, wide letter-spacing) that fades and slides up beneath the kanji. This is the **English MEANING (translation) of `kanjiTitle`**, NOT its rōmaji reading — e.g. `kanjiTitle` 桜 → `romanTitle` "Cherry Blossom" (never "Sakura"). It stays in the content language.
  - `tagline` (string) — Short tagline (~24px Shippori Mincho 400, gold color) that fades in below an animated crimson brush-stroke SVG line
  - `imageUrl` (imageUrl) — Optional hero background image. Rendered FULL-BLEED behind everything (kamon rings, petals, title), heavily dimmed/desaturated and tinted toward the accent color, under a plum→void vignette — so it reads as atmospheric background, never a foreground photo, and the wordmark stays legible. Omit for the pure typographic title screen.

**When to Use:** Use `sakura_intro` for cinematic Japanese-themed title cards, brand intros, or chapter openers where a ceremonial, high-contrast aesthetic with animated petal rain is desired. An optional `imageUrl` sits blended into the background.

**Avoid When:** The title needs a bright, sharp, or foreground-prominent photo — the hero image is always dimmed and tinted into the dark backdrop; use `sakura_section` for a crisp side-by-side image instead.

**Notes:**
- `imageUrl` is optional and always rendered as a dim, accent-tinted full-bleed backdrop behind the title — never a sharp foreground image
- Long `kanjiTitle` strings may overflow at the default ~160px size; keep to 2–4 characters for best results
- All text layers animate sequentially on entry (kanji → subtitle → brush line → tagline) and the entire scene fades out over the last 18 frames

---

## sakura_section
**Visual:** A two-column editorial layout on a warm washi-to-parchment gradient background with a subtle seigaiha (overlapping scales) pattern overlay. The left column features a vertical Japanese chapter eyebrow in crimson beside a Roman subtitle, a large ink-colored headline, a petal SVG divider, and body text; the right column displays either a provided image or a hand-drawn SVG cherry blossom tree illustration, with animated falling petals drifting across the full scene.

**Props:**
  - `chapterKanji` (string) — Vertical Japanese text (e.g. 第一章) rendered in writing-mode vertical-rl at ~22px crimson, forming the eyebrow label. **ALWAYS Japanese** (see "Japanese-Script Fields" above): a short Japanese label corresponding to `chapterLabel`, regardless of content language.
  - `chapterLabel` (string) — Chapter subtitle displayed beside the kanji eyebrow in ~18px deep-pink Shippori Mincho. This is the **English MEANING (translation) of `chapterKanji`**, NOT its rōmaji reading — e.g. `chapterKanji` 第一章 → `chapterLabel` "Chapter One" (never "Dai Isshō"). It stays in the content language.
  - `headline` (string) — Primary section heading rendered at ~56px bold Noto Serif JP in ink color; animates in with a spring scale effect
  - `body` (text) — Body paragraph at ~26px Shippori Mincho, line-height 1.75; each newline-separated line fades in with a staggered delay
  - `imageUrl` (imageUrl) — If provided, fills the right column (360×460px) with the image; if omitted, a decorative SVG cherry blossom tree is shown instead

**When to Use:** Use `sakura_section` for chapter-opening or editorial story sections that need a Japanese aesthetic with structured typographic hierarchy. It suits cultural, travel, literary, or brand content requiring both text depth and decorative visual interest.

**Avoid When:** Avoid when the content requires more than two columns, dense data/lists, or when the Japanese typographic framing would feel tonally mismatched with the brand.

**Notes:**
- Body text is split on `\n`; single-paragraph strings render as one block with no stagger benefit — use line breaks to leverage the per-line fade-in animation
- The right column is fixed at 360×460px regardless of aspect ratio; portrait mode reduces headline to ~48px and body to ~22px
- The decorative tree SVG is purely illustrative and non-configurable; supply `imageUrl` to replace it with branded or photographic content

---

## sakura_quote
**Visual:** A full-bleed deep-plum tsukimi (moon-viewing) scene. A large pale-gold harvest moon rises low behind the quote, with drifting kasumi mist bands crossing it. The quote itself is framed like a mounted tanzaku poetry card / kakejiku hanging scroll — a tall narrow washi panel with a faint asanoha lattice ground and thin gold mounting rails top and bottom that draw on as the panel unrolls. Inside, the single large Japanese quote is brushed in one glyph at a time as sumi-e calligraphy (Noto Serif JP 700, washi color), with the romanized reading in decorative 《 angle brackets 》 below it, a calligraphic brush underline, and an italic English translation stacked beneath, closed by a vermillion hanko seal. Oversized 「 」 kagi-kakko brackets frame the composition and staggered soft-petal strips drift across the top and bottom edges.

**Props:**
  - `quote` (string) — The Japanese phrase displayed large and centered at heavy weight (keep concise — a short aphorism or phrase, not a paragraph). **ALWAYS Japanese** (see "Japanese-Script Fields" above) — the same phrase as `quoteTranslation`, expressed in Japanese, regardless of content language.
  - `quoteRoman` (string) — Romanized reading shown in 《 angle brackets 》 below the quote (Shippori Mincho, gold, wide letter-spacing). This is the **Rōmaji reading of `quote`** — it must match the Japanese exactly.
  - `quoteTranslation` (string) — English translation rendered in italic washi beneath the romanized line. `quote`, `quoteRoman`, and `quoteTranslation` are the **same phrase expressed three ways (Japanese ⇄ Rōmaji ⇄ English)** and must stay consistent.

**When to Use:** Use `sakura_quote` for cinematic, contemplative moments where a single Japanese aphorism, poem, or phrase is the sole focus of the scene.

**Avoid When:** The content requires multiple quotes, dense body text, or imagery that would compete with the typographic centerpiece.

**Notes:**
- Keep the `quote` string short (a phrase, ideally under ~12 characters) so it reads cleanly at large size
- PetalRain, the tsukimi moon, the tanzaku scroll mount, and the petal strips are purely decorative and cannot be disabled via props
- No image prop is supported; the visual atmosphere relies entirely on pattern overlays and animation

---

## sakura_two_column_detail
**Visual:** A washi-textured background with a subtle seigaiha (wave scale) pattern hosts two facing columns split by a central 対 (tsui) medallion in a kamon ring with a gold "VS" beneath it. Each column displays a large vertical kanji marker, a serif headline, an animated petal divider, and body text. This layout is text-only — it has no image support.

**Props:**
  - `leftHeadline` (string) — Headline rendered in Noto Serif JP 700 (~44px, ink color) at the top of the left column. **MAX 2 WORDS** — a tight label that names/summarizes `leftBody` below it (e.g. "The Bloom", "Old Kyoto", "Website"). Never a phrase or sentence.
  - `leftBody` (text) — Body copy in Shippori Mincho 400 (~24px) beneath the left column's petal divider.
  - `rightHeadline` (string) — Headline for the right column, styled identically to `leftHeadline`. **MAX 2 WORDS** — a tight label summarizing `rightBody`. Never a phrase or sentence.
  - `rightBody` (text) — Body copy for the right column.
  - `leftKanji` (string) — **REQUIRED. ALWAYS Japanese** (see "Japanese-Script Fields" above). The **EXACT Japanese translation of `leftHeadline`** — translate the headline itself into an authentic, concise Japanese word/phrase, NOT a loosely-related decorative glyph. Keep it SHORT (~2–4 chars ideal, 6 max) since it renders large and vertical (tategaki) above the headline; drop filler like "Your"/"The". E.g. "Your Website" → ウェブサイト or 網站; "The Bloom" → 開花; "Tradition" → 伝統.
  - `rightKanji` (string) — **REQUIRED. ALWAYS Japanese.** The **EXACT Japanese translation of `rightHeadline`**, same rules — an authentic concise Japanese rendering of the right headline (e.g. "Your Video" → 映像 or 動画; "The Fall" → 落下; "Change" → 変化), NOT a bare kanji fragment (映 alone for "video" is broken → 映像). Vertical, above the right headline. It should contrast/pair with `leftKanji` the way the two headlines contrast.

**When to Use:** Use `sakura_two_column_detail` for scenes that need to present two parallel pieces of TEXT content—such as a comparison or a concept paired with its counterpoint—within a refined Japanese aesthetic.

**Avoid When:** Avoid when content requires more than two columns, a single unified narrative flow, or a supporting image (this layout is text-only — use `sakura_section` for text-with-image).

**Notes:**
- `leftHeadline` and `rightHeadline` are each **MAX 2 WORDS** — tight labels for the body copy beneath them, never phrases or sentences. The detail goes in `leftBody` / `rightBody`.
- Both columns are text-only; there is no image support in this layout.
- Long body text in either column is not truncated by the layout, so overly lengthy copy may overflow the column bounds at standard font sizes.
- PetalRain (18 petals, intensity 0.6) and all entrance animations (column slides, divider draw, KamonCircle fade) are fixed and not configurable via props.
- `leftKanji` / `rightKanji` are the **EXACT Japanese translations of `leftHeadline` / `rightHeadline`** — always emit both as authentic Japanese, translating the actual headline (not a loosely-related marker glyph). Keep each short (~2–4 chars, 6 max) so it fits the giant vertical tategaki slot; drop filler words like "Your"/"The". Never leave them to the default, never write them in Latin letters, never transliterate word-by-word, and never emit a lone kanji fragment of a compound word (映 alone for "video" is wrong → 映像).

---

## sakura_stat_highlight
**Visual:** An ASYMMETRIC spotlight scene on a dark plum backdrop with an off-center radial spotlight. The large blush numeral (with count-up animation) sits on the LEFT, haloed by a scaling-in gold kamon ring circled by slowly orbiting soft petals; on the RIGHT, an animated gold brush underline, a gold label, and an italic washi context sentence are stacked. Enters with a bloom (scale-from-center) motion.

**Props:**
  - `stat` (string) — The large metric displayed in crimson at ~180px; numeric strings trigger a count-up animation on entry
  - `statLabel` (string) — Short descriptor rendered below the gold underline in washi color at ~32px
  - `context` (string) — Supporting sentence in mist color at ~22px, max-width 720px, centered beneath the label
  - `imageUrl` (imageUrl) — Optional supporting image, shown as a soft CIRCULAR vignette centered BEHIND the number (feathered into the plum backdrop at low opacity, with a plum scrim over it so the digits stay legible). Omit for the pure-typographic look.

**When to Use:** Use `sakura_stat_highlight` when a single powerful number or metric needs to be the undisputed focal point of a scene, especially in Japanese-aesthetic or premium brand contexts.

**Avoid When:** Avoid when the stat string is long or multi-line, as the oversized font and fixed layout will overflow or crowd the decorative underline.

**Notes:**
- `imageUrl` is optional — when provided it becomes a dim circular vignette behind the number, never a foreground element; the number always stays the hero. With no image the scene is purely typographic and SVG-driven.
- Numeric stat strings (e.g. `"1,200"` or `"47%"`) animate with a count-up effect over the first 20 frames; non-numeric strings appear statically
- The gold underline draws in via a stroke-dashoffset animation starting at frame 14; very short scene durations may clip this reveal

---

## sakura_list_scene
**Visual:** A LEFT-RAIL composition on a light washi backdrop with an ink-wash bleeding from the right corner and a large kamon breathing on the right. The list occupies the left ~60%: a bold serif headline with an animated crimson underline-and-blossom, then up to 6 vertically stacked items. Each bullet is a soft five-petal blossom (alternating blush / deep-blush) whose petals bloom in sequentially, then the item text slides in from the left; a thin crimson connector line draws down through the bullet column. The scene rises up into place on entry.

**Props:**
  - `headline` (string) — Section title rendered in Noto Serif JP 700 at ~52px in ink color, top-left, sliding in on entry
  - `items` (string_array) — **REQUIRED: emit 3–6 concise list item strings.GIVE ATLEAST 3 AND AT MOST 6** distilled from the scene's narration (each a short phrase, not a full paragraph). This layout is a bullet list — a single item leaves it looking empty, so always break the narration's key points into separate entries. Displayed in Shippori Mincho 500 at ~28px; each item's bullet springs in then text fades up with staggered timing.
  - `imageUrl` (imageUrl) — Optional supporting image, feathered into the RIGHT side of the scene (the list keeps the left rail). When provided it takes the right area the blossom canopy otherwise fills, and the list rail narrows to clear it. In portrait the image drops to a band along the bottom. Omit to keep the decorative blossom-canopy right side.

**When to Use:** Use `sakura_list_scene` when presenting a structured enumeration — features, steps, or key points — within a Japanese-aesthetic video where elegant staggered reveals and decorative petal motifs reinforce the content's tone. An optional `imageUrl` sits on the right beside the list.

**Avoid When:** Avoid when items exceed 6 or contain long multi-line text, as vertical spacing is fixed and overflow is not handled.

**Notes:**
- Items array is capped at 6; any entries beyond index 5 are silently ignored
- `imageUrl` is optional — when set it renders as a feathered panel on the right (bottom band in portrait) and suppresses the right-side blossom canopy so the two don't clash
- The crimson accent color drives both the seigaiha pattern stroke, petal bullets, and divider line; passing a custom `accentColor` recolors all three consistently

---

## sakura_text_narration
**Visual:** An OFF-CENTER, left-anchored narration on a light washi radial backdrop, with a large faint kamon breathing on the right. Left-aligned content: an optional gold eyebrow label, a large bold headline, an animated crimson brush underline, and a body paragraph. The block rises up into place on entry (distinct from the centered intro/quote).

**Props:**
  - `eyebrow` (string) — Optional uppercase label in crimson above the headline; hidden entirely when empty
  - `headline` (string) — Primary large text rendered in Noto Serif JP Bold (~64px), max-width 1200px, spring-animated on entry
  - `body` (text) — Supporting narration paragraph in Shippori Mincho (~28px, line-height 1.8), max-width 960px, fades and rises in after the divider draws
  - `imageUrl` (imageUrl) — Optional supporting image. When provided, the scene becomes text-left / image-right (image below the copy in portrait), feathered into the washi backdrop; when omitted, the copy keeps its full-width left-anchored composition.

**When to Use:** Use `sakura_text_narration` for contemplative, text-forward narration scenes that need a refined Japanese aesthetic — title cards, chapter breaks, or poetic voiceover moments. A supporting `imageUrl` is optional and appears beside the copy.

**Avoid When:** The scene needs a large full-bleed photo or multiple images — this layout only hosts a single supporting side panel; use `sakura_section` for image-forward sections.

**Notes:**
- Staggered entrance animation: eyebrow (0–8f) → headline (6–20f) → divider draw (16–28f) → body (22–42f); scene fades out over the last 18 frames
- Long headlines wrap within 1200px (landscape) or 88% of frame width (portrait); very long body text will extend the content block and may push the kamon ornament off-screen
- The kamon footer ornament is purely decorative at 6% opacity and cannot be configured via props

---

## ending_socials
**Visual:** A full-bleed deep-plum-to-void background overlaid with a subtle Seigaiha scale pattern, faint kamon watermark rings, and two concentric rings of soft petals slowly counter-rotating around center. Brand name, a letter-spaced tagline, a five-petal divider row, a blush-bordered CTA box with crimson sakura-blossom corner ornaments, a gold monospace website URL, and social icons are stacked vertically, while blush/mist petals rain continuously and 16 petals burst outward from center on entry.

**Props:**
  - `brandName` (string) — Large serif heading (~80px Noto Serif JP 700, washi white) centered at ~36% height, spring-scales in on entry
  - `tagline` (string) — Smaller subtitle (~28px Shippori Mincho, mist color) fading in just below the brand name
  - `ctaText` (string) — Text inside the animated crimson-bordered box (~30px Shippori Mincho 500, washi) centered at ~58% height
  - `websiteUrl` (string) — Gold URL (~22px, letter-spacing 0.15em) revealed at ~76% height with expanding letter-spacing animation
  - `socialHandles` (string[]) — Optional social handles rendered in small type below the URL (when structured `socials` data is available, the shared branded social-icon row is rendered instead)

**When to Use:** Use `ending_socials` as a closing card for brand videos, social campaigns, or Japanese-aesthetic content where you need a dramatic, ceremonial sign-off with CTA and contact details.

**Avoid When:** Avoid when the brand identity is light or minimalist — the heavy dark lacquer background and dense layered effects will overpower subtle or pastel-forward visual systems.

**Notes:**
- The CTA box border is drawn edge-by-edge via SVG stroke-dashoffset animation (four staggered edges, frames 18–32); box dimensions adjust for portrait vs. landscape (`480px` vs. `560px` wide)
- PetalRain uses seeded pseudo-random values — petal positions and timing are deterministic per render, so output is consistent across exports
- Long `brandName` or `ctaText` strings may overflow their containers; no automatic text wrapping or font scaling is applied

## sakura_data_visualization
**Visual:** A washi-paper scene with a chart panel bordered by a crimson top rule and soft petal chrome. Renders a line, bar, or histogram chart (chosen by `chartType`) with animated draw-in, alongside a short summary read. Blossom corner accents and continuous petal rain frame the panel.

**Props:**
  - `chartType` (select: `auto` / `line` / `bar` / `histogram`) — Chart style. line = trend over time, bar = comparison across named categories, histogram = distribution across bins/ranges.
  - `chartTable` ({ headers, rows }) — The chart data. Col 1 = X labels; cols 2–4 = up to 3 numeric series (max 20 rows).
  - `yAxisLabel` (string) — Y-axis caption (overrides chart header).
  - `subtitle` (string) — X-axis / category caption (overrides first column header).
  - `chartYAxisTicks` (string[]) — Optional Y-axis tick labels (top → bottom; 2–4 values).
  - `chartSummary` (string) — Short read shown beside the chart.
 

**When to Use:** Use ONLY for a scene bound to a chartable table (preferred_layout=sakura_data_visualization). Never invent figures. The `chartType` field controls line/bar/histogram — do not pick a `_bar`/`_histogram` variant layout id; they do not exist.

## sakura_ticker
**Visual:** A washi-paper data table with a crimson top rule, uppercase serif headers, alternating row tints, and optional gain/loss coloring on a highlighted column. Petal chrome and rain frame the table. A title, sub-headline, and footnote bracket the rows.

**Props:**
  - `tickerTable` ({ headers, rows }) — The table data. Col 1 = row labels; cols 2–6 = numeric or text values. Max 20 rows, max 6 columns.
  - `tickerTitle` (string) — Sub-headline under the scene title.
  - `tickerHighlightCol` (number) — 0-based column index colored green/red by sign (e.g. 5 for the 6th column). -1 disables.
  - `tickerFootnote` (string) — Footnote / source attribution.

**When to Use:** Use ONLY for a scene bound to a data table (preferred_layout=sakura_ticker). Never invent rows.
