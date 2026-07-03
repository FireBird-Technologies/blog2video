# Design Philosophy

A deeply characterful Japanese-aesthetic template featuring washi paper textures, Seigaiha wave patterns, Kamon crests, and falling cherry blossom petals. Ideal for converting written content into narrated, branded videos.

Each layout has its OWN background geometry (deep-plum radial, warm washi radial, a vertical crimson band, an asymmetric ink-corner wash, an off-center spotlight, or a celebration ring field), its OWN composition (centered, left-column+panel, two-column, asymmetric big-number, left-rail list, off-center block, full-bleed image), and its OWN entrance motion — so no two scenes read alike. Scene boundaries use a VARIED transition vocabulary chosen automatically per boundary (petal vortex/swarm/scatter, bloom-unfurl, shoji sliding panels, iris circle wipe, sumi ink-bleed, brush swipe, diagonal panel, vertical shutter, rack-focus bloom), with no two adjacent boundaries repeating. These are all automatic and not author-configurable.

---

# Layout Catalog

---

## sakura_intro
**Visual:** A full-bleed dark Japanese intro screen with a lacquer-to-void radial gradient background, subtle seigaiha (overlapping scales) pattern at near-invisible opacity, and a faint gold kamon (family crest) circle watermark centered on screen. Blush and mist petal clusters decorate all four corners, while animated cherry blossom petals rain continuously across the full scene.

**Props:**
  - `kanjiTitle` (string) — Large kanji characters (~160px Noto Serif JP 700, washi color) centered at ~38% vertical height; springs in from scale 0.6 on entry
  - `romanTitle` (string) — Romanized subtitle (~36px Shippori Mincho 400, mist color, wide letter-spacing) fades and slides up beneath the kanji
  - `tagline` (string) — Short tagline (~24px Shippori Mincho 400, gold color) that fades in below an animated crimson brush-stroke SVG line

**When to Use:** Use `sakura_intro` for cinematic Japanese-themed title cards, brand intros, or chapter openers where a ceremonial, high-contrast aesthetic with animated petal rain is desired.

**Avoid When:** Content requires bright or light backgrounds, dense body text, or imagery — this layout has no image support and is designed purely as a typographic title screen.

**Notes:**
- No `imageUrl` support; the layout is entirely SVG/text-based with no image layer rendered
- Long `kanjiTitle` strings may overflow at the default ~160px size; keep to 2–4 characters for best results
- All text layers animate sequentially on entry (kanji → subtitle → brush line → tagline) and the entire scene fades out over the last 18 frames

---

## sakura_section
**Visual:** A two-column editorial layout on a warm washi-to-parchment gradient background with a subtle seigaiha (overlapping scales) pattern overlay. The left column features a vertical Japanese chapter eyebrow in crimson beside a Roman subtitle, a large ink-colored headline, a petal SVG divider, and body text; the right column displays either a provided image or a hand-drawn SVG cherry blossom tree illustration, with animated falling petals drifting across the full scene.

**Props:**
  - `chapterKanji` (string) — Vertical Japanese text (e.g. 第一章) rendered in writing-mode vertical-rl at ~22px crimson, forming the eyebrow label
  - `chapterLabel` (string) — Roman chapter subtitle displayed beside the kanji eyebrow in ~18px deep-pink Shippori Mincho
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
**Visual:** A full-bleed deep-plum background layout centered on a single large Japanese quote (Noto Serif JP 700, blush color, with a soft blush glow), the romanized reading in decorative angle brackets below it, a line—blossom—line divider, and an italic English translation stacked beneath. Three concentric rings expand outward from center with an easing bloom, a giant ghost 桜 sits faintly behind, and staggered soft-petal strips drift across the top and bottom edges over a subtle Seigaiha pattern.

**Props:**
  - `quote` (string) — The Japanese phrase displayed large and centered at heavy weight (keep concise — a short aphorism or phrase, not a paragraph)
  - `quoteRoman` (string) — Romanized reading shown in 《 angle brackets 》 below the quote (Shippori Mincho, gold, wide letter-spacing)
  - `quoteTranslation` (string) — English translation rendered in italic washi beneath the romanized line

**When to Use:** Use `sakura_quote` for cinematic, contemplative moments where a single Japanese aphorism, poem, or phrase is the sole focus of the scene.

**Avoid When:** The content requires multiple quotes, dense body text, or imagery that would compete with the typographic centerpiece.

**Notes:**
- Keep the `quote` string short (a phrase, ideally under ~12 characters) so it reads cleanly at large size
- PetalRain, the expanding rings, and the petal strips are purely decorative and cannot be disabled via props
- No image prop is supported; the visual atmosphere relies entirely on pattern overlays and animation

---

## sakura_two_column_detail
**Visual:** A washi-textured background with a subtle seigaiha (wave scale) pattern hosts two equal columns of content separated by a thin 1px crimson vertical line (60% of canvas height) that draws outward from its center, with a small KamonCircle motif (48px diameter) fading in at its midpoint. Each column displays a serif headline, an animated petal divider, and body text; the right column optionally swaps its body text for a framed image with a crimson border.

**Props:**
  - `leftHeadline` (string) — Headline text rendered in Noto Serif JP 700 (~44px, ink color) at the top of the left column.
  - `leftBody` (text) — Body copy in Shippori Mincho 400 (~24px) beneath the left column's petal divider.
  - `rightHeadline` (string) — Headline text for the right column, styled identically to `leftHeadline`.
  - `rightBody` (text) — Body copy for the right column; only shown when `imageUrl` is not provided.
  - `imageUrl` (imageUrl) — When supplied, replaces the right column's body text with an 840×500px image enclosed in a crimson border frame.

**When to Use:** Use `sakura_two_column_detail` for scenes that need to present two parallel pieces of content—such as a comparison, a concept paired with supporting detail, or text alongside a key visual—within a refined Japanese aesthetic.

**Avoid When:** Avoid when content requires more than two columns or when a single unified narrative flow is preferred over a split layout.

**Notes:**
- The right column is either text-only or image-only; mixing both is not supported—`imageUrl` fully replaces `rightBody`.
- Long body text in either column is not truncated by the layout, so overly lengthy copy may overflow the column bounds at standard font sizes.
- PetalRain (18 petals, intensity 0.6) and all entrance animations (column slides, divider draw, KamonCircle fade) are fixed and not configurable via props.

---

## sakura_stat_highlight
**Visual:** An ASYMMETRIC spotlight scene on a dark plum backdrop with an off-center radial spotlight. The large blush numeral (with count-up animation) sits on the LEFT, haloed by a scaling-in gold kamon ring circled by slowly orbiting soft petals; on the RIGHT, an animated gold brush underline, a gold label, and an italic washi context sentence are stacked. Enters with a bloom (scale-from-center) motion.

**Props:**
  - `stat` (string) — The large metric displayed in crimson at ~180px; numeric strings trigger a count-up animation on entry
  - `statLabel` (string) — Short descriptor rendered below the gold underline in washi color at ~32px
  - `context` (string) — Supporting sentence in mist color at ~22px, max-width 720px, centered beneath the label

**When to Use:** Use `sakura_stat_highlight` when a single powerful number or metric needs to be the undisputed focal point of a scene, especially in Japanese-aesthetic or premium brand contexts.

**Avoid When:** Avoid when the stat string is long or multi-line, as the oversized font and fixed layout will overflow or crowd the decorative underline.

**Notes:**
- No image support — `imageUrl` is ignored; the layout is purely typographic and SVG-driven
- Numeric stat strings (e.g. `"1,200"` or `"47%"`) animate with a count-up effect over the first 20 frames; non-numeric strings appear statically
- The gold underline draws in via a stroke-dashoffset animation starting at frame 14; very short scene durations may clip this reveal

---

## sakura_list_scene
**Visual:** A LEFT-RAIL composition on a light washi backdrop with an ink-wash bleeding from the right corner and a large kamon breathing on the right. The list occupies the left ~60%: a bold serif headline with an animated crimson underline-and-blossom, then up to 6 vertically stacked items. Each bullet is a soft five-petal blossom (alternating blush / deep-blush) whose petals bloom in sequentially, then the item text slides in from the left; a thin crimson connector line draws down through the bullet column. The scene rises up into place on entry.

**Props:**
  - `headline` (string) — Section title rendered in Noto Serif JP 700 at ~52px in ink color, top-left, sliding in on entry
  - `items` (string_array) — Up to 6 list item strings displayed in Shippori Mincho 500 at ~28px; each item's bullet springs in then text fades up with staggered timing (10 frames apart)

**When to Use:** Use `sakura_list_scene` when presenting a structured enumeration — features, steps, or key points — within a Japanese-aesthetic video where elegant staggered reveals and decorative petal motifs reinforce the content's tone.

**Avoid When:** Avoid when items exceed 6 or contain long multi-line text, as vertical spacing is fixed and overflow is not handled.

**Notes:**
- Items array is capped at 6; any entries beyond index 5 are silently ignored
- No image support — `imageUrl` is accepted via props but unused in this layout
- The crimson accent color drives both the seigaiha pattern stroke, petal bullets, and divider line; passing a custom `accentColor` recolors all three consistently

---

## sakura_text_narration
**Visual:** An OFF-CENTER, left-anchored narration on a light washi radial backdrop, with a large faint kamon breathing on the right. Left-aligned content: an optional gold eyebrow label, a large bold headline, an animated crimson brush underline, and a body paragraph. The block rises up into place on entry (distinct from the centered intro/quote).

**Props:**
  - `eyebrow` (string) — Optional uppercase label in crimson above the headline; hidden entirely when empty
  - `headline` (string) — Primary large text rendered in Noto Serif JP Bold (~64px), max-width 1200px, spring-animated on entry
  - `body` (text) — Supporting narration paragraph in Shippori Mincho (~28px, line-height 1.8), max-width 960px, fades and rises in after the divider draws

**When to Use:** Use `sakura_text_narration` for contemplative, text-forward narration scenes that need a refined Japanese aesthetic — title cards, chapter breaks, or poetic voiceover moments where imagery would distract.

**Avoid When:** The scene requires a prominent photo or illustration, as no image rendering is implemented in this layout.

**Notes:**
- Staggered entrance animation: eyebrow (0–8f) → headline (6–20f) → divider draw (16–28f) → body (22–42f); scene fades out over the last 18 frames
- Long headlines wrap within 1200px (landscape) or 88% of frame width (portrait); very long body text will extend the content block and may push the kamon ornament off-screen
- The kamon footer ornament is purely decorative at 6% opacity and cannot be configured via props

---

## sakura_image_focus
**Visual:** A washi-textured background with a faint seigaiha (overlapping scales) pattern hosts a large centered hero image (1120×630px landscape / 630×354px portrait) with a crimson SVG border that draws itself clockwise on entry and petal ornaments blooming at each corner. Below the image, a primary caption and optional italic sub-caption fade up into view while sakura petals drift across the entire scene.

**Props:**
  - `imageUrl` (imageUrl) — The hero image displayed in the central slot; shows a blush-to-mist gradient placeholder when absent
  - `caption` (string) — Primary label beneath the image in Shippori Mincho 400 ~22px ink color, centered, max-width 900px
  - `subCaption` (string) — Optional secondary line rendered italic in deep rose (~18px), fades in slightly after the caption
  - `accentColor` (string) — Controls the crimson border frame and corner petal ornament color (default `#C0143C`)
  - `bgColor` (string) — Sets the washi background base color (default `#FDF6F0`)
  - `textColor` (string) — Ink color applied to the primary caption (default `#2A0A12`)

**When to Use:** Use `sakura_image_focus` when a single photograph or illustration should be the undisputed focal point of a scene, framed with a ceremonial Japanese aesthetic. Ideal for product reveals, artwork showcases, or cinematic title cards within a sakura-themed video.

**Avoid When:** The scene requires multiple images or dense text content, as the layout is designed around one full-bleed image slot with minimal supporting copy.

**Notes:**
- The crimson border animates as four edges drawing clockwise (top → right → bottom → left), each offset by 4 frames; corner ornaments spring in staggered at frames 8–28.
- Long caption text wraps within a 900px max-width but does not resize automatically — keep captions concise (one line preferred).
- `imageZoom` and `imageObjectPosition` are respected for fine-tuning crop; without `imageUrl` a blush gradient placeholder is shown instead of an error.

---

## sakura_chapter_transition
**Visual:** A dramatic dark chapter card with a WIDE crimson→deep-blush VERTICAL BAND down the left edge. A giant blush kanji chapter numeral sits on the left; beside it, a short accent rule, a gold "Chapter N" eyebrow, and a large serif Roman chapter title are stacked. A kamon watermark is pushed off to the right and a horizontal current of soft petals streams across. Enters with a bloom (scale-from-center) motion.

**Props:**
  - `chapterNumber` (string) — Kanji or numeral displayed in large gold type (~96px) above the crimson divider line (e.g. `"二"` or `"03"`)
  - `chapterTitle` (string) — Roman-script chapter title displayed in washi-white (~48px) below the divider line; falls back to `title` if not provided
  - `titleFontSize` (number) — Overrides the chapter number font size (default 96px landscape, 80px portrait)
  - `descriptionFontSize` (number) — Overrides the chapter title font size (default 48px landscape, 38px portrait)
  - `aspectRatio` (string) — Controls layout scaling; `"portrait"` reduces stroke length, kamon diameter, and font sizes proportionally

**When to Use:** Use `sakura_chapter_transition` as a cinematic interstitial between major narrative chapters or acts in Japanese-themed video productions, where a ceremonial pause with strong typographic hierarchy is needed.

**Avoid When:** Avoid when the scene requires imagery, dialogue-heavy content, or continuous action — this layout is a pure transition card with no image support.

**Notes:**
- `imageUrl` is accepted by the component signature but has no effect; this layout renders no background image
- Long `chapterTitle` strings wrap within a capped `maxWidth` (1200px landscape / 800px portrait) but may crowd the space below the divider if exceeding two lines
- All animation is frame-driven with a built-in exit fade starting 18 frames before `sceneDurationInFrames`; petal count and intensity are hardcoded at 30 and 1.2 respectively and cannot be overridden via props

---

## sakura_ending_socials
**Visual:** A full-bleed deep-plum-to-void background overlaid with a subtle Seigaiha scale pattern, faint kamon watermark rings, and two concentric rings of soft petals slowly counter-rotating around center. Brand name, a letter-spaced tagline, a five-petal divider row, a blush-bordered CTA box with crimson sakura-blossom corner ornaments, a gold monospace website URL, and social icons are stacked vertically, while blush/mist petals rain continuously and 16 petals burst outward from center on entry.

**Props:**
  - `brandName` (string) — Large serif heading (~80px Noto Serif JP 700, washi white) centered at ~36% height, spring-scales in on entry
  - `tagline` (string) — Smaller subtitle (~28px Shippori Mincho, mist color) fading in just below the brand name
  - `ctaText` (string) — Text inside the animated crimson-bordered box (~30px Shippori Mincho 500, washi) centered at ~58% height
  - `websiteUrl` (string) — Gold URL (~22px, letter-spacing 0.15em) revealed at ~76% height with expanding letter-spacing animation
  - `socialHandles` (string[]) — Optional social handles rendered in small type below the URL (when structured `socials` data is available, the shared branded social-icon row is rendered instead)

**When to Use:** Use `sakura_ending_socials` as a closing card for brand videos, social campaigns, or Japanese-aesthetic content where you need a dramatic, ceremonial sign-off with CTA and contact details.

**Avoid When:** Avoid when the brand identity is light or minimalist — the heavy dark lacquer background and dense layered effects will overpower subtle or pastel-forward visual systems.

**Notes:**
- The CTA box border is drawn edge-by-edge via SVG stroke-dashoffset animation (four staggered edges, frames 18–32); box dimensions adjust for portrait vs. landscape (`480px` vs. `560px` wide)
- PetalRain uses seeded pseudo-random values — petal positions and timing are deterministic per render, so output is consistent across exports
- Long `brandName` or `ctaText` strings may overflow their containers; no automatic text wrapping or font scaling is applied
