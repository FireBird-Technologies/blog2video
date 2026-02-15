# Blog2Video — Template Specifications

> **Purpose:** Creative and technical spec for all 4 video templates.
> **Audience:** Engineer building the Remotion components, writing prompt.md files, and populating meta.json.

---

## Template Overview

| ID | Name | Visual Identity | Colors |
|----|------|----------------|--------|
| `default` | Geometric Explainer | Flat shapes, terminals, counters, arrows | Accent `#7C3AED` / Bg `#FFFFFF` / Text `#000000` |
| `nightfall` | Nightfall | Frosted glass on dark space, neon glow, cinematic pacing, kinetic title moments | Accent `#818CF8` / Bg `#0A0A1A` / Text `#E2E8F0` |
| `gridcraft` | Gridcraft | Bento grids, editorial typography, data cells, accent-pop cells | Accent `#F97316` / Bg `#FAFAFA` / Text `#171717` |
| `spotlight` | Spotlight | Oversized kinetic text on dark stage, spring animations, glass data panels | Accent `#EF4444` / Bg `#000000` / Text `#FFFFFF` |

---

---

## Template 1: `default` — Geometric Explainer

### Status: EXISTING (no new components — restructure only)

This is the current working template. The 10 layout components already exist. The only work is moving files into the new directory structure (`src/templates/default/`) and renaming `ExplainerVideo.tsx` to `DefaultVideo.tsx`.

### meta.json

```
id:              "default"
name:            "Geometric Explainer"
description:     "Modern tech-explainer with code blocks, animated metrics, flow diagrams,
                  and bullet lists. Clean geometric aesthetic ideal for technical content."
preview_colors:  { accent: "#7C3AED", bg: "#FFFFFF", text: "#000000" }
composition_id:  "DefaultVideo"
hero_layout:     "hero_image"
fallback_layout: "text_narration"
valid_layouts:   ["hero_image", "text_narration", "code_block", "bullet_list",
                  "flow_diagram", "comparison", "metric", "quote_callout",
                  "image_caption", "timeline"]
```

### Layouts (existing — for reference only)

| Layout ID | Visual | Animation |
|-----------|--------|-----------|
| `hero_image` | Full-bleed image with title overlay and gradient scrim | Fade + scale in |
| `text_narration` | Centered text with floating geometric shapes behind | Staggered fade |
| `code_block` | Dark terminal card with syntax-highlighted code and line numbers | Line-by-line typewriter |
| `bullet_list` | Numbered pills with text, staggered vertically | Slide in from left |
| `flow_diagram` | Rounded boxes connected by animated arrows, horizontal | Sequential box + arrow reveal |
| `metric` | Giant number with counter roll-up, progress bar below | Count-up + bar fill |
| `comparison` | Split screen with vertical divider, left/right content cards | Slide in from opposite sides |
| `quote_callout` | Left accent bar + italic quote text + subtle glow | Fade + bar slide in |
| `image_caption` | Image card on left, caption text on right | Parallel slide-in |
| `timeline` | Vertical line with dots, text items alternating left/right | Dot-then-text cascade |

### prompt.md

For default, extract the existing content from `backend/app/dspy_modules/scene_gen.py`:
- The `LAYOUT_DESCRIPTIONS` string (lines 10–47) becomes the Layout Catalog section
- The `SceneToDescriptor` class docstring (lines 53–123) becomes the Design Philosophy, Scene Flow, Content Extraction, and Variety sections
- Reformat into the five-section Markdown structure

---

---

## Template 2: `nightfall` — Dark Cinematic Glass

### The Vibe
A premium product keynote at midnight. Apple WWDC meets a Bloomberg terminal meets Blade Runner. Everything floats on dark space. Content lives on frosted glass panels. Key moments break free of the glass — giant text slams onto the screen raw. Data glows.

### meta.json

```
id:              "nightfall"
name:            "Nightfall"
description:     "Dark cinematic glass — frosted panels over gradient mesh, neon-glow data,
                  and dramatic kinetic title reveals. Premium tech keynote feel."
preview_colors:  { accent: "#818CF8", bg: "#0A0A1A", text: "#E2E8F0" }
composition_id:  "NightfallVideo"
hero_layout:     "cinematic_title"
fallback_layout: "glass_narrative"
valid_layouts:   ["cinematic_title", "glass_narrative", "glow_metric", "glass_code",
                  "kinetic_insight", "glass_stack", "split_glass", "chapter_break",
                  "glass_image"]
```

### Visual Rules (apply to EVERY component in this template)

- **Backgrounds:** Dark base color (#0A0A1A). Layer 2–3 large radial gradients in muted purple, blue, and teal, positioned off-center. These gradient blobs should be blurred (filter blur ~80–120px) and sit behind all content. Optional: slow positional drift using useCurrentFrame for a living-background feel.

- **Glass cards:** Every content panel uses these properties together:
  - Translucent white background at very low opacity (~0.06–0.10)
  - Backdrop-filter blur (~16–24px)
  - Thin border in semi-transparent white (~0.10–0.15 opacity)
  - Generous border radius (~16–24px)
  - Depth shadow: dark, large spread, low opacity

- **Typography:** Clean sans-serif. Titles can go large (48–120px). Body text in the light text color. The accent color is used for highlighted keywords, glowing elements, and decorative lines — never for large text blocks.

- **Glow effects:** Use box-shadow with the accent color at low opacity (~0.3–0.5) and large spread (~20–40px) to create neon glow behind metrics and accent elements.

- **Transitions:** Smooth and cinematic. Fade in, scale from ~0.95 to 1.0, gentle vertical float-up. Stagger child elements by 5–8 frames. Nothing should snap or bounce — this template is about elegance.

### Layouts

---

#### `cinematic_title` — Opening Title Card

**What the viewer sees:** Full dark screen with the slow-drifting gradient mesh background. The title text (120px+, weight 700) springs in from slightly scaled up. It settles into position, then a horizontal frosted glass strip (thin, spanning ~60% width) fades in behind or below the title. A subtitle in thin weight (300) fades in below with a 0.5s delay. Feels like a film title card.

**Best for:** Always scene 0. The opening/hero moment.

**Props:** (none — uses scene title and narration directly)

---

#### `glass_narrative` — Glass Story Panel

**What the viewer sees:** A single frosted glass card, centered on screen, roughly 65–70% of the frame width. Inside: a title (28–36px, semi-bold) at top, body paragraph below in regular weight. Optional: a decorative drop-cap on the first letter of the body text in the accent color. The gradient mesh background continues behind the card. The card floats up into position from below.

**Best for:** Main explanations, narrative body, general content. This is the "baseline" layout — use when nothing more specific fits, but limit to max 2 per video.

**Props:** (none — uses title + narration directly)

---

#### `glow_metric` — Luminous Data Card

**What the viewer sees:** A frosted glass card centered on the dark background. Inside: 1–3 large numbers (64–80px, bold). Behind each number sits a luminous accent-colored arc or ring (SVG or border trick) that draws on clockwise over ~20 frames. The numbers animate with a counter roll-up effect. Small label text (14px, muted) below each number. The glow makes the data feel alive and energetic.

**Best for:** Statistics, percentages, KPIs, benchmarks, performance numbers — any scene where 1–3 numbers are the main point.

**Props:**
- `metrics` — array of objects, max 3 items
  - `value` (string): the number to display, e.g. "97"
  - `label` (string): what the number represents, e.g. "Accuracy"
  - `suffix` (string, optional): unit, e.g. "%", "x", "ms"

---

#### `glass_code` — Terminal on Glass

**What the viewer sees:** A slightly more opaque frosted glass card (background opacity ~0.12 for better code readability). A frosted header bar at the top of the card showing a filename and/or language badge (small pill with language name). Below: code lines with syntax coloring against the translucent dark. Lines typewrite in one by one with a blinking cursor at the end. Terminal aesthetic — monospace font, line numbers optional.

**Best for:** Code snippets, terminal commands, API examples, config files, anything with actual code.

**Props:**
- `codeLines` (string[]): the actual code lines, 3–8 lines
- `codeLanguage` (string): language identifier, e.g. "python", "javascript", "bash"

---

#### `kinetic_insight` — Full-Screen Text Moment

**What the viewer sees:** NO glass card. NO container. Just the raw dark background. One powerful sentence displayed at 56–72px. Words appear one at a time with spring animation (opacity + translateY). The single most important word in the sentence gets the accent color and is slightly larger (~1.15x). This is a dramatic pause — pure kinetic typography. Maximum 1–2 per video.

**Best for:** Key insights, the single most important takeaway, a pivotal definition, a "mic drop" moment.

**Props:**
- `quote` (string): the statement to display
- `highlightWord` (string, optional): which word to accent-color

---

#### `glass_stack` — Layered Feature Cards

**What the viewer sees:** 2–3 frosted glass cards arranged vertically with a slight horizontal offset between them (each card shifted ~15–20px right from the one above, creating a layered depth/stack effect). Each card contains one feature point or key idea — a short bold title and 1-line description. Cards cascade in from below with staggered timing (each delayed by ~8 frames).

**Best for:** Feature lists, multiple related points, benefits, steps — when you have 2–3 items to show simultaneously.

**Props:**
- `items` (string[]): 2–3 concise feature descriptions, each 5–12 words

---

#### `split_glass` — Glass Comparison

**What the viewer sees:** Two frosted glass cards placed side by side with a thin luminous accent-colored line between them (vertical divider, glowing softly). Left card contains one concept, right card contains the contrasting concept. Each card has a small label at top (14px, muted) and body text below. Cards slide in from opposite edges — left card from left, right card from right. The divider line draws from top to bottom.

**Best for:** Comparisons, pros/cons, before/after, old vs new, two contrasting approaches.

**Props:**
- `leftLabel` (string): label for left side, e.g. "Before"
- `rightLabel` (string): label for right side, e.g. "After"
- `leftDescription` (string): 1–2 sentences for left
- `rightDescription` (string): 1–2 sentences for right

---

#### `chapter_break` — Section Divider

**What the viewer sees:** Minimal. A large chapter number (180–220px, very thin weight 200, low opacity ~0.15) fades in at center. Title text (36–44px, medium weight) appears below it with a slight delay. No glass cards, no decorations. Just number + title on the dark mesh. This is breathing room and structure — signals a topic shift. Maximum 2 per video.

**Best for:** Transitions between major topics, section introductions, pacing breaks.

**Props:**
- `chapterNumber` (number): sequential chapter number, e.g. 1, 2, 3
- `subtitle` (string): brief section description, 4–8 words

---

#### `glass_image` — Cinematic Image Reveal

**What the viewer sees:** A blog image fills the background with a dark gradient overlay (darker at top and bottom, slightly transparent in the middle). The image does a slow Ken Burns effect (gentle zoom or pan over the scene duration). A frosted glass caption strip sits at the bottom third of the frame — thin, spanning full width, containing the title and a short description. The image fades in from black, the glass strip slides up into position.

**Best for:** Showcasing blog images, screenshots, diagrams, architecture visuals — any scene where an image should dominate.

**Props:** (none — uses title + narration + imageUrl from the scene data)

---

---

## Template 3: `gridcraft` — Bento Editorial

### The Vibe
A Vercel feature page or Stripe product announcement that animates. Content is arranged spatially in bento grid cells — multiple pieces of information coexist on screen, organized in a "bento box." It feels structured, intentional, and info-dense without being cluttered. One cell per scene gets an accent pop. Quotes get editorial serif treatment. Data gets clean cells with numbers and trend arrows.

### meta.json

```
id:              "gridcraft"
name:            "Gridcraft"
description:     "Bento grid layouts with editorial typography and data clarity. Spatial
                  content arrangement with accent-pop cells. SaaS landing page in motion."
preview_colors:  { accent: "#F97316", bg: "#FAFAFA", text: "#171717" }
composition_id:  "GridcraftVideo"
hero_layout:     "bento_hero"
fallback_layout: "editorial_body"
valid_layouts:   ["bento_hero", "bento_features", "bento_highlight", "editorial_body",
                  "kpi_grid", "bento_compare", "bento_code", "pull_quote", "bento_steps"]
```

### Visual Rules (apply to EVERY component in this template)

- **Grid fundamentals:** Layouts use CSS Grid. Cells have border-radius 20px, gap of 12px. Cells have white (#FFFFFF) backgrounds with subtle box-shadow (0 1px 3px rgba(0,0,0,0.06)). The overall frame background is near-white (#FAFAFA).

- **Accent pop cell:** In every grid layout, exactly ONE cell gets the accent background color (#F97316) with white text inside. This creates a clear visual anchor and draws the eye to the most important piece of information. Choose which cell gets the accent based on content importance.

- **Typography:** Clean sans-serif throughout. Strong weight hierarchy: titles at 600–700 weight, body at 400, labels at 300 or small caps. Numbers displayed large (48–64px) with tabular-nums for clean alignment.

- **No gradients, no blur, no glow.** This template is about spatial clarity and clean edges. The visual interest comes from the grid arrangement and the accent pop, not from effects.

- **Transitions:** Cells pop in with staggered timing (each delayed by 4–6 frames). Scale from 0.92 to 1.0 with opacity 0 to 1. Snappy easing — not as aggressive as spring, but crisp.

- **Non-grid layouts** (editorial_body, pull_quote): These intentionally break the grid pattern. They're single-column, centered, with generous whitespace. This contrast in rhythm keeps the video from feeling monotonous.

### Layouts

---

#### `bento_hero` — Grid Title Card

**What the viewer sees:** A grid with one large 2×2 cell and 2 small 1×1 cells. The large cell has the accent background and contains the title text (big, bold, springs in). One small cell has a category tag or emoji. The other small cell has the subtitle or a date/byline. Cells pop in staggered — large cell first, smalls follow. The grid fills ~85% of the frame with the near-white background behind it.

**Best for:** Always scene 0. The opening card.

**Props:** (none — uses title + narration directly. The component decides which cell gets what.)

---

#### `bento_features` — Feature Grid

**What the viewer sees:** A 2×3 or 3×2 grid of equal-sized cells. Each cell contains: an emoji or small icon at top-left, a bold label (16–18px), and a one-line description (13px, muted). One cell (the most important feature) has the accent background with white text. The rest are white with dark text. Cells appear one at a time in reading order (left-to-right, top-to-bottom), each delayed by 4 frames.

**Best for:** Feature lists, benefits, capabilities — when you have 4–6 items to show.

**Props:**
- `features` — array of objects, max 6 items
  - `icon` (string): emoji, e.g. "⚡", "🔒", "📊"
  - `label` (string): bold feature name, 2–4 words
  - `description` (string): one-liner, 6–12 words
- `highlightIndex` (number, optional): which feature gets the accent cell (0-based). Default: 0.

---

#### `bento_highlight` — Focus + Supporting Facts

**What the viewer sees:** One large 2×1 cell on top spanning full width, containing the main point. This cell has a very subtle tinted background (accent color at ~5% opacity) for emphasis. Below it: 2 small 1×1 cells side by side with supporting facts or secondary points. Large cell enters first (fade + scale), small cells follow staggered.

**Best for:** When one main idea needs emphasis with 2 supporting details. Feature spotlights, key announcements.

**Props:**
- `mainPoint` (string): the primary statement, 1–2 sentences
- `supportingFacts` — array of 2 strings, each a short fact or detail

---

#### `editorial_body` — Clean Text Slide

**What the viewer sees:** NOT a grid — intentionally single-column for rhythm contrast. Centered content area (~60% width). Large semi-bold title (32px) at top. A thin accent-colored horizontal rule below the title (2px, ~40% width). Body paragraph below in regular weight (18px) with comfortable line height. Generous padding all around. Feels like a clean presentation slide or a book page.

**Best for:** General explanations, narrative paragraphs, introductions. This is the baseline/fallback layout. Maximum 2 per video.

**Props:** (none — uses title + narration directly)

---

#### `kpi_grid` — Data Cells

**What the viewer sees:** 3 equal cells in a horizontal row, each roughly square. Each cell contains: one large bold number (48–56px) at center, a small trend arrow below it (green ▲ for up, red ▼ for down, gray ● for neutral), and a label (13px, muted) at the bottom. Numbers animate with counter roll-up, staggered per cell (each starts 6 frames after the previous). One cell (the most impressive metric) gets the accent background.

**Best for:** Statistics, KPIs, metrics, benchmarks — any scene with 2–3 key numbers.

**Props:**
- `dataPoints` — array of objects, max 3 items
  - `label` (string): what the number represents
  - `value` (string): the display value, e.g. "97%", "3.2x", "50ms"
  - `trend` (string, optional): "up", "down", or "neutral"
- `highlightIndex` (number, optional): which cell gets accent bg. Default: 0.

---

#### `bento_compare` — Side-by-Side Grid

**What the viewer sees:** 2 large cells side by side (roughly equal width) at the top of the grid. Below them: 1 accent-colored cell spanning full width with the verdict or conclusion. Each side cell has a label (bold, 18px) at top and description below. Side cells slide in from opposite edges. The verdict cell pops in last from below. The accent cell draws the eye to the conclusion.

**Best for:** Comparisons, A vs B, pros/cons, before/after, two approaches.

**Props:**
- `leftLabel` (string): label for option A
- `rightLabel` (string): label for option B
- `leftDescription` (string): 1–3 sentences for A
- `rightDescription` (string): 1–3 sentences for B
- `verdict` (string): the conclusion or winner, 1 sentence

---

#### `bento_code` — Code Cell Grid

**What the viewer sees:** A grid with one large cell (2×1) with a dark background containing syntax-highlighted code (monospace font). One small cell to the right with a language/framework badge (e.g. "Python", "React") in the accent color. Another small cell below the badge with a short description of what the code does. The dark code cell contrasts sharply with the surrounding white cells.

**Best for:** Code examples, terminal commands, API snippets — when code needs context alongside it.

**Props:**
- `codeLines` (string[]): actual code, 3–8 lines
- `codeLanguage` (string): language identifier
- `description` (string): short explanation of the code, 1–2 sentences

---

#### `pull_quote` — Editorial Quote

**What the viewer sees:** NOT a grid — full-width, centered. Oversized decorative quotation marks (accent colored, 100–120px) at top-left. The quote text is centered, 28–36px, in a serif or semi-bold font for editorial feel. Below the quote: a small attribution or topic label (14px, muted). The quote text fades in word by word (each word delayed by 2 frames). The key phrase within the quote gets the accent color.

**Best for:** Key insights, memorable statements, definitions, "pull quote" moments. Maximum 2 per video.

**Props:**
- `quote` (string): the statement, 1–2 sentences
- `attribution` (string): source, topic, or speaker label
- `highlightPhrase` (string, optional): phrase within the quote to accent-color

---

#### `bento_steps` — Process Grid

**What the viewer sees:** Numbered cells arranged in a staircase or zigzag grid pattern. Cell 1 at top-left, cell 2 at center, cell 3 at top-right (or similar spatial arrangement depending on count). Each cell has: a large bold step number (36px, accent color), a label below (16px, bold), and an optional one-line description (13px). Thin connecting lines or arrows between cells. Cells illuminate sequentially — each cell starts faded, then activates (full opacity + scale) in order, with the connecting line drawing between them.

**Best for:** Step-by-step processes, workflows, implementation phases, ordered milestones.

**Props:**
- `steps` — array of objects, max 5 items
  - `label` (string): step name, 2–5 words
  - `description` (string, optional): one-liner explanation

---

---

## Template 4: `spotlight` — Bold Stage

### The Vibe
A TED talk meets a motion graphics reel meets a viral social video. Text IS the design — words fill the entire frame, slam in, bounce, stack, swap, and pulse. No decorative elements, no cards, no borders. Just powerful typography on a dark (or occasionally inverted) stage. When data appears, a single clean glass panel emerges. The pacing is fast and punchy — built for content that grabs in the first 2 seconds.

### meta.json

```
id:              "spotlight"
name:            "Spotlight"
description:     "Bold kinetic typography on a dark stage. Words fill the frame, slam in, and
                  cascade. Glass panels for data moments. High contrast, fast-paced, social-first."
preview_colors:  { accent: "#EF4444", bg: "#000000", text: "#FFFFFF" }
composition_id:  "SpotlightVideo"
hero_layout:     "impact_title"
fallback_layout: "statement"
valid_layouts:   ["impact_title", "statement", "word_punch", "cascade_list", "stat_stage",
                  "versus", "spotlight_image", "rapid_points", "closer"]
```

### Visual Rules (apply to EVERY component in this template)

- **Text is the primary visual.** Font sizes range from 48px to 200px. No decorative graphics, no geometric shapes, no patterns. The typography does all the visual work.

- **Font weight is heavy.** 700–900 weight exclusively. No thin, light, or regular weights except for small labels (14px) below main content.

- **Backgrounds are solid.** Black (#000000) or white (#FFFFFF). Some scenes flip to white-on-black for contrast rhythm (this creates a visual "blink" effect between scenes). No gradients, no textures, no images in backgrounds (except spotlight_image).

- **Accent color is surgical.** Red (#EF4444) is used on exactly one element per scene — a single highlighted word, a divider line, a CTA element, a number. Never on backgrounds, never on large text blocks. The accent is the "spotlight" that draws the eye.

- **Animations use spring().** Remotion's spring() with high stiffness (180–220) and moderate damping for punchy overshoot. Things SLAM into place, overshoot slightly, then settle. The feel is energetic and confident, not floaty.

- **Individual word/line animation.** Every word or line of text should be wrapped separately so it can be animated independently. Stagger delays of 3–5 frames between words/lines. This creates the kinetic typography feel.

- **No border-radius, no shadows, no blur** (except stat_stage's single glass card). Raw, direct, graphic.

### Layouts

---

#### `impact_title` — Slam-In Title

**What the viewer sees:** Pure black screen. Title text at 140–160px, weight 900, centered. The text springs in from 200% scale — overshoots to about 105%, then settles to 100%. Holds for a beat. Then an optional subtitle in thin weight (300, 24px, muted gray) fades in below with 0.5s delay. This is the opening punch — it should feel like the title is being thrown at the viewer.

**Best for:** Always scene 0. The video title / opening hook.

**Props:** (none — uses scene title directly. Subtitle from narration if short enough.)

---

#### `statement` — Sentence Drop

**What the viewer sees:** A single sentence split across 2–3 lines (manually or by word count). Each line drops in from above with spring bounce — staggered by 6–8 frames. White text on black, 48–60px, weight 800. One key word in the sentence is rendered in the accent color and is ~1.15x the size of surrounding words. The overall feel is deliberate and punchy — each line landing with impact.

**Best for:** Key explanations, important points, thesis statements, setups. This is the baseline/fallback layout.

**Props:**
- `highlightWord` (string, optional): which word to render in accent color

---

#### `word_punch` — Single Word Impact

**What the viewer sees:** ONE word fills the entire frame. 180–200px, weight 900, accent colored (#EF4444). Black background. The word scales from 0% to ~110% (overshoot) then settles to 100% using spring(). Holds for 1.5–2 seconds. No other elements on screen. Used for maximum emphasis — "WHY?", "FAST.", "3X", "FREE.", "NOW." Maximum 1 per video.

**Best for:** The single most impactful word or number in the entire video. The "mic drop."

**Props:**
- `word` (string): the single word or short phrase (1–3 words max)

---

#### `cascade_list` — Stacking Items

**What the viewer sees:** Items appear one at a time, stacking vertically from the top of the screen. Each item is: a bold number in accent color (32px) on the left + white text (40–48px, weight 700) on the right. Items slide in from the right edge, staggered by ~12 frames. As each new item appears, all previous items dim to 35–40% opacity. The current item stays at full brightness. No cards, no backgrounds — raw text on black.

**Best for:** Feature lists, benefits, steps, takeaways — any ordered list of 3–6 items that should feel punchy.

**Props:**
- `items` (string[]): max 6 items, each 3–8 words. Extract the ACTUAL points from narration.

---

#### `stat_stage` — Number Spotlight

**What the viewer sees:** A giant number (100–120px, weight 900, white) centered on pure black screen. The number does a counter roll-up animation over ~25 frames. After the number lands and holds for ~10 frames, a small frosted glass card (the ONLY glass element in this entire template) fades in below it with the label and brief context text. This is the template's one concession to a container — a single, small, elegant panel for context beneath the raw number.

**Best for:** Statistics, key metrics, benchmark results — when a single number deserves the entire frame.

**Props:**
- `metrics` — array of objects, max 2 items (1 preferred)
  - `value` (string): the number, e.g. "97"
  - `label` (string): what it represents
  - `suffix` (string, optional): unit, e.g. "%"

---

#### `versus` — Contrast Split

**What the viewer sees:** The screen splits vertically down the middle. Left half: white background, black text. Right half: black background, white text. Each side has a bold label (36–44px, weight 800) vertically centered. A thin accent-colored neon line (2–3px, with subtle glow via box-shadow) divides them. Both sides slide in simultaneously from opposite edges — left content from the left, right content from the right. The color inversion creates instant visual tension.

**Best for:** Before/after, old vs new, two contrasting approaches, "X vs Y" moments.

**Props:**
- `leftLabel` (string): label for left side (white bg side), 1–4 words
- `rightLabel` (string): label for right side (black bg side), 1–4 words
- `leftDescription` (string, optional): 1 sentence context for left
- `rightDescription` (string, optional): 1 sentence context for right

---

#### `spotlight_image` — Image From Darkness

**What the viewer sees:** The image starts invisible (pure black screen). A circular or soft-edged spotlight/vignette effect reveals the image from the center outward over ~15 frames — the edges stay dark, the center illuminates. A thin frosted glass caption strip (full width, ~60px tall) sits at the very bottom with the title and a short description. The image does a very slow push-in zoom (from scale 1.0 to 1.02 over the scene duration). Cinematic and dramatic.

**Best for:** Blog images, screenshots, diagrams — when the image should be showcased dramatically.

**Props:** (none — uses title + narration + imageUrl from scene data)

---

#### `rapid_points` — Fast-Cut Phrases

**What the viewer sees:** 3–5 short phrases displayed sequentially, each taking over the entire screen. Each phrase: centered, 52–64px, weight 800, white on black. Each holds for ~1.2–1.5 seconds, then HARD CUTS to the next (no transition — instant swap for maximum pacing). No animation within each phrase — it simply appears and is replaced. The pace is rapid and energetic, like flipping through bold headlines.

**Best for:** Quick summaries, rapid-fire takeaways, teaser/trailer moments, when you want to convey energy and speed.

**Props:**
- `phrases` (string[]): 3–5 short phrases, each 3–8 words. Each should be a complete thought.

---

#### `closer` — Final Takeaway

**What the viewer sees:** The closing scene. Takeaway text (44–56px, weight 700) fades in from a gaussian blur effect (starts blurry, sharpens over ~20 frames). Once sharp, a thin accent-colored underline draws beneath the key phrase (from left to right, over ~15 frames). Below: small CTA or attribution text (14–16px, weight 300, muted gray) fades in with a slight delay. Clean, final, memorable.

**Best for:** Always the last scene. The key takeaway, final thought, or call to action.

**Props:**
- `highlightPhrase` (string, optional): which phrase gets the accent underline
- `cta` (string, optional): small call-to-action text below, e.g. "Read the full post →"

---

---

## Appendix: Template Comparison Matrix

| Aspect | default | nightfall | gridcraft | spotlight |
|--------|---------|-----------|-----------|-----------|
| Background | White, flat | Dark gradient mesh | Near-white, flat | Pure black (some white flips) |
| Content containers | Geometric shapes, cards | Frosted glass panels | Bento grid cells | None (raw text) |
| Typography | Regular sans-serif | Clean sans-serif | Sans-serif, editorial hierarchy | Extra-bold, oversized |
| Data viz | Progress bars, counters | Glowing arcs, neon counters | Grid cells with trend arrows | Giant single numbers |
| Code display | Dark terminal card | Glass terminal | Dark cell in bento grid | N/A (use statement) |
| Comparison | Split screen, divider | Two glass cards, glow divider | Two grid cells + verdict cell | Color-inverted split |
| Quotes | Accent bar + italic | Full-screen kinetic text | Editorial serif + quotation marks | Statement layout (big text) |
| Images | Side-by-side with caption | Full-bleed with glass caption | Large cell in grid | Spotlight reveal from darkness |
| Animation feel | Smooth, professional | Cinematic, elegant float | Snappy, spatial pop-in | Punchy, spring slam |
| Special effects | Floating shapes | Backdrop blur, glow | Accent cell pop | Spring overshoot, hard cuts |
| Mood | Clean and educational | Premium and moody | Structured and modern | Bold and energetic |
| Best content | Technical tutorials | Deep dives, opinion pieces | Product/feature content | Marketing, social, listicles |
