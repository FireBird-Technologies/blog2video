# Design Philosophy

Mosaic is a handcrafted tessera style that blends cool blue tile fields, warm sunset stones, and elegant gold guide lines. It should feel composed, artisanal, and deliberate. Scenes are built from modular tile systems, not smooth gradients. Typography is serif-first and editorial, with strong hierarchy and clean spacing.

Use the aesthetic language from stone mosaic work:
- Visible tile structure and grout rhythm
- Slight color variation within repeated tiles
- Fine metallic dividers and accents (golden lines)
- High readability over texture

Core rules:
- Keep backgrounds dark or richly colored; avoid flat white scenes.
- Use subtle motion (fade, stagger, reveal) over aggressive effects.
- Gold accents are thin linework/highlights, never full-screen fills.
- Prefer balanced compositions with clear focal hierarchy.

---

# Palette & Styling Rules

Use this palette direction across layouts:

- **Deep navy / night grout:** `#0F1E2D`
- **Cobalt tessera:** `#1D4E89`
- **Aqua tessera:** `#3EA3C7`
- **Sky tessera:** `#7CCAE3`
- **Warm mosaic orange:** `#C6763D`
- **Stone cream:** `#E6D9C4`
- **Primary text:** `#E6EEF7`
- **Secondary text:** `#BFD3E8`
- **Golden line accent:** `#D4AF37`

Practical visual constraints:
- Gold lines: 1-2px separators, underlines, panel strokes.
- Avoid heavy shadows; depth comes from tile variance and layering.
- Keep body text clear and contrast-safe.
- Tile motifs can be used as borders, corners, side rails, or light overlays.

---

# Layout Catalog

## mosaic_title
**Visual:** Hero title over a rich blue mosaic field with curved tile bands and thin golden guide lines. Title reveals cleanly, subtitle follows.

**Best for:** Scene 0 opener.

**Props:** Uses `title` and `narration`.

---

## mosaic_text
**Visual:** Framed editorial text panel over tiled background. A short heading, readable body, and one highlighted phrase with golden emphasis.

**Best for:** Core explanation scenes.

**Props:**
- `highlightPhrase` (string, optional): phrase to accent in gold-toned style.

---

## mosaic_punch
**Visual:** One impactful word or short phrase in oversized serif typography, surrounded by sparse tile shards and golden cross-lines.

**Best for:** Maximum-impact beat (use sparingly).

**Props:**
- `word` (string): 1-3 words.

---

## mosaic_stream
**Visual:** Ordered item stream with tile markers, staggered reveal, and subtle active state in gold.

**Best for:** Lists, process steps, grouped ideas.

**Props:**
- `items` (string[]): 3-8 concise lines.

---

## mosaic_metric
**Visual:** Dominant metric card with tiled radial motifs and fine golden circular/axis lines.

**Best for:** KPI/stat-focused scene.

**Props:**
- `metrics` (array): up to 3 metric objects `{ value, label, suffix? }`.

---

## mosaic_phrases
**Visual:** Rotating phrase stage with framed tile border and tiny indicator marks.

**Best for:** Rapid insights / memorable lines.

**Props:**
- `phrases` (string[]): 3-8 phrases.

---

## mosaic_close
**Visual:** Closing statement with gentle resolve animation, golden underline on a key phrase, and optional CTA line.

**Best for:** Final thematic scene before socials.

**Props:**
- `highlightPhrase` (string, optional)
- `cta` (string, optional)

---

## ending_socials
**Visual:** Final brand/social follow scene consistent with template palette and mosaic framing.

**Best for:** Final scene only.

**Props:** Standard `ending_socials` schema (`socials`, `websiteLink`, `showWebsiteButton`, etc.).

---

# Scene Flow Rules

- Scene 0 should be `mosaic_title`.
- Prefer `mosaic_text` for explanatory core scenes.
- Use `mosaic_metric` when numbers are central.
- Use `mosaic_punch` at most once.
- Use `mosaic_phrases` at most once.
- End with `mosaic_close` or `ending_socials` depending on project ending strategy.

Suggested flow:
`mosaic_title -> mosaic_text -> mosaic_stream -> mosaic_metric -> mosaic_punch -> mosaic_close -> ending_socials`

---

# Content Extraction Rules

- `title`: clear scene heading, usually 2-8 words.
- `narration`: concise sentence(s) suitable for voiceover.
- Keep list props parallel in structure.
- For `metrics`, isolate numeric values from descriptive text.
- For `highlightPhrase`, choose exact phrase present in narration when possible.

---

# Variety Rules

- Do not repeat the same layout more than 2 consecutive scenes.
- Keep visual rhythm: alternate dense panel scenes with open emphasis scenes.
- Limit high-intensity layouts (`mosaic_punch`, `mosaic_phrases`) to preserve impact.
