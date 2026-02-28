# Design Philosophy

Matrix is a hacker's terminal come alive. The screen is a black void (#000000) with columns of falling green characters — the iconic digital rain. All text is monospace (Fira Code), rendered in neon green (#00FF41). Content reveals itself through character decode animations — random symbols cycle rapidly before resolving into actual text. Numbers count up through cipher noise. Data streams in like intercepted transmissions. The only non-green color appears in the fork_choice layout (red #EF4444 vs blue #3B82F6 — a nod to the red pill / blue pill). The pacing is fast and cryptic — built for tech content that feels classified.

**Key Visual Rules:**
- **Digital rain background** on every scene — columns of falling katakana/latin glyphs at varying speeds
- **Monospace font exclusively.** Fira Code, 400-700 weight. No sans-serif, no serif.
- **Neon green (#00FF41) for ALL text.** White (#FFFFFF) only for secondary/muted elements.
- **Black (#000000) background.** Pure black, no gradients, no textures (except the rain).
- **Character decode reveals:** Text appears by cycling through random characters before settling on the real text.
- **Terminal aesthetic:** `>` prompts, blinking cursors, scanline overlays on images.
- **No border-radius, no shadows, no blur** (except awakening's blur-to-sharp effect). Raw, terminal, digital.
- **Universal image support:** All layouts can display images alongside content when available.

---

# Layout Catalog

## matrix_title
**Visual:** Black screen with dense digital rain background. Title text (100-140px, monospace, weight 700, green) decodes from random characters — each character cycles through 5-8 random symbols before settling. Subtitle fades in below after decode completes. The rain continues falling behind the text throughout.

**Best for:** Always scene 0. The opening/hero moment.

**Props:**
- (none — uses scene `title` and `narration` directly)

**Content Requirements:**
- `title`: Main headline (2-6 words) — will decode character-by-character
- `narration`: Optional subtitle/tagline (5-15 words) — fades in after title decodes

**Example Extraction:**
```
Narration: "Introducing the next generation of content automation"
 CORRECT:
  title: "System Online"
  narration: "Introducing the next generation of content automation"

 WRONG:
  title: "Introducing the next generation of content automation that will change everything"
  (too long, decode animation will take too long)
```

**When to Use:**
- Scene 0 ONLY (hero/opening)
- Product launches, major announcements

**When NOT to Use:**
- Any scene after scene 0
- Explanatory content

---

## terminal_text
**Visual:** Digital rain background. Green monospace text types in character-by-character with a blinking green cursor. Text is prefixed with `> ` prompt. One key word rendered in brighter green with glow effect. **When image is available:** Image displays alongside text (side-by-side in landscape, stacked in portrait) with scanline overlay.

**Best for:** Key explanations, important points, thesis statements. Baseline/fallback layout.

**Props:**
- `highlightWord` (string, optional): which word to render with glow accent

**Content Requirements:**
- `title`: Section heading
- `narration`: The text (20-60 words) — will type in character by character
- `highlightWord`: A single key word from narration to glow-highlight

**Example Extraction:**
```
Narration: "This changes everything you thought you knew about video creation."

 CORRECT:
  narration: "This changes everything you thought you knew about video creation."
  highlightWord: "everything"

 WRONG:
  highlightWord: "This changes"
  // Must be a single word, not a phrase
```

**When to Use:**
- Explaining concepts, describing features, general narrative
- Fallback when nothing more specific fits

**When NOT to Use:**
- When showing metrics/numbers (use cipher_metric)
- For dramatic one-word moments (use glitch_punch)
- For comparisons (use fork_choice)

---

## glitch_punch
**Visual:** ONE word or short phrase fills the frame. 120-180px, monospace, weight 700, neon green with strong glow. The word glitch-scrambles — characters rapidly cycle through random symbols, then slam into place. Pulsing glow effect on settle. Maximum 1 per video.

**Best for:** The single most impactful word or number. The "glitch moment."

**Props:**
- `word` (string): the single word or short phrase (1–3 words max)

**Content Requirements:**
- **word**: 1-3 words ("WHY?", "FAST.", "3X", "FREE.", "NOW.")
- Should be the single most impactful moment

**Example Extraction:**
```
Narration: "Performance is 3X faster than any competitor."

 CORRECT:
  word: "3X"

 WRONG:
  word: "Performance is 3X faster"
  // Too long — should be the single punch word
```

**When to Use:**
- Maximum 1 per video
- The single most impactful moment

**When NOT to Use:**
- For explanations or descriptions
- More than once per video

---

## data_stream
**Visual:** Digital rain background. Items appear one at a time, stacking vertically. Each item prefixed with green `> ` terminal prompt + index number. Items slide in from right like incoming data packets. Previous items dim to 30% opacity. **When image is available:** Image displays alongside list.

**Best for:** Feature lists, benefits, steps, takeaways — any ordered list of 3–6 items.

**Props:**
- `items` (string[]): max 6 items, each 3–8 words

**Content Requirements:**
- **items**: Array of 3-6 short phrases (3-8 words each)
- Parallel structure preferred

**Example Extraction:**
```
Narration: "Three key benefits: lightning fast performance, zero config setup, and built-in analytics."

 CORRECT:
  items: [
    "Lightning fast performance",
    "Zero config setup required",
    "Built-in analytics dashboard"
  ]

 WRONG:
  items: [
    "The first key benefit is that it has lightning fast performance which is great"
  ]
  // Too wordy, only extracted 1 of 3
```

**When to Use:**
- Listing 3-6 features, benefits, or steps

**When NOT to Use:**
- For single items (use terminal_text)
- For comparisons (use fork_choice)

---

## cipher_metric
**Visual:** Giant number (100-160px, monospace, weight 700, green) centered on black with digital rain behind. Number decodes from random characters — cipher noise resolves into the actual value with counter roll-up. A small terminal-style card (green border, no fill) fades in below with label. **When image is available:** Image alongside metric.

**Best for:** Statistics, key metrics, benchmarks — when a single number deserves the frame.

**Props:**
- `metrics` — array of objects, max 2 items (1 preferred)
  - `value` (string): the number
  - `label` (string): what it represents
  - `suffix` (string, optional): unit

**Prop Structure:**
```typescript
{
  metrics: [
    { value: "97", label: "System Uptime", suffix: "%" }
  ]
}
```

**Content Requirements:**
- **value**: The number as string (will decode from cipher noise)
- **label**: What the number represents (2-5 words)
- **suffix**: Optional unit (%, x, +, k, M, etc.)

**Example Extraction:**
```
Narration: "We've achieved 97% system uptime based on 12,000+ requests."

 CORRECT:
  metrics: [
    { value: "97", label: "System Uptime", suffix: "%" }
  ]

 WRONG:
  metrics: [
    { value: "97% system uptime" }
  ]
  // Mixed text and number
```

**When to Use:**
- Key statistics, growth numbers, benchmarks

**When NOT to Use:**
- When numbers aren't the focus
- For text-heavy content

---

## fork_choice
**Visual:** Screen splits vertically. Left half: red-tinted (#EF4444 muted bg) with white text. Right half: blue-tinted (#3B82F6 muted bg) with white text. Green neon divider in center. Both sides slide in from opposite edges. Color split creates instant "red pill / blue pill" tension.

**Best for:** Before/after, old vs new, two contrasting approaches.

**Props:**
- `leftLabel` (string): label for left side (1–4 words)
- `rightLabel` (string): label for right side (1–4 words)
- `leftDescription` (string, optional): 1 sentence context
- `rightDescription` (string, optional): 1 sentence context

**Content Requirements:**
- **leftLabel / rightLabel**: 1-4 words each, contrasting
- **leftDescription / rightDescription**: 1-2 sentences each

**Example Extraction:**
```
Narration: "Traditional video takes hours. Our solution automates it in seconds."

 CORRECT:
  leftLabel: "Red Pill"
  rightLabel: "Blue Pill"
  leftDescription: "Hours of manual work. Error-prone."
  rightDescription: "Automated in seconds. Flawless."

 WRONG:
  leftLabel: "The Traditional Way of Manual Video Production"
  // Too long — 1-4 words max
```

**When to Use:**
- Before/after, problem/solution, old vs new, pros/cons

**When NOT to Use:**
- For non-contrasting content
- For 3+ items (use data_stream)

---

## matrix_image
**Visual:** Image revealed through an expanding "window" — starts as a thin horizontal slit at center that grows vertically, revealing the image behind. Digital rain scanline overlay on top of the image. Green-tinted frosted caption bar slides up from bottom with title + description.

**Best for:** Blog images, screenshots, diagrams — cinematic image reveal.

**Props:**
- (none — uses scene `title`, `narration`, and `imageUrl`)

**Content Requirements:**
- `title`: Image caption (3-8 words)
- `narration`: Optional description (10-20 words)

**Example Extraction:**
```
Narration: "Our dashboard provides real-time analytics."

 CORRECT:
  title: "System Dashboard"
  narration: "Real-time analytics and monitoring"

 WRONG:
  title: "Dashboard"
  // Too vague
```

**When to Use:**
- When an image is available and relevant
- Screenshots, diagrams, visual demos

**When NOT to Use:**
- When no image is available
- For text-heavy content

---

## transmission
**Visual:** Digital rain background. 3-5 short phrases displayed sequentially like intercepted transmissions. Each phrase: centered, monospace, 40-64px, green. Hard cuts between phrases. `[SIGNAL]` prefix in dimmer green.

**Best for:** Quick summaries, rapid-fire takeaways, teaser moments.

**Props:**
- `phrases` (string[]): 3–5 short phrases, each 3–8 words

**Content Requirements:**
- **phrases**: 3-5 short, complete thoughts (3-8 words each)
- Each phrase should stand alone

**Example Extraction:**
```
Narration: "No setup required. Works out of the box. Ships in 60 seconds."

 CORRECT:
  phrases: [
    "No setup required",
    "Works out of the box",
    "Ships in 60 seconds"
  ]

 WRONG:
  phrases: [
    "No setup required, works out of the box, ships in 60 seconds"
  ]
  // Should be separate phrases
```

**When to Use:**
- Quick summaries
- High-energy moments

**When NOT to Use:**
- For detailed explanations
- When each point needs context (use data_stream)

---

## awakening
**Visual:** Text sharpens from gaussian blur (starts blurry, resolves over ~20 frames) — like "waking up" from the Matrix. Green monospace. Once sharp, a green underline draws beneath the key phrase. Small system-style CTA fades in below (e.g. `[EXECUTE] Read the full post`).

**Best for:** Always the last scene. Key takeaway, final thought, CTA.

**Props:**
- `highlightPhrase` (string, optional): which phrase gets the green underline
- `cta` (string, optional): call-to-action text

**Content Requirements:**
- `narration`: The closing statement (10-30 words)
- `highlightPhrase`: Key phrase from narration to underline (2-5 words)
- `cta`: Short call-to-action (3-8 words)

**Example Extraction:**
```
Narration: "The best time to start was yesterday. The second best time is now."

 CORRECT:
  highlightPhrase: "is now"
  cta: "Read the full article"

 WRONG:
  highlightPhrase: "The best time to start was yesterday."
  // Too long — 2-5 words
```

**When to Use:**
- Last scene ONLY
- Key takeaway, memorable closing

**When NOT to Use:**
- Any scene other than the last

---

# Scene Flow Rules

- **Scene 0:** ALWAYS `matrix_title` (non-negotiable)
- **Opening (scenes 1–2):** `terminal_text` for setup
- **Middle (scenes 3–N-1):** Alternate between:
  - Text layouts: `terminal_text`, `data_stream`, `transmission`
  - Data moments: `cipher_metric`
  - Contrast: `fork_choice`
  - Image: `matrix_image` (when images available)
  - Impact: `glitch_punch` (max 1 total)
- **Closing (scene N):** ALWAYS `awakening`

**Variety Requirements:**
- NEVER use same layout 2 times in a row
- A 7-scene video should use 5-7 DIFFERENT layouts
- A 10-scene video should use 7-9 DIFFERENT layouts
- Max usage limits:
  - `terminal_text`: Max 2 per video (fallback)
  - `glitch_punch`: Max 1 per video
  - `transmission`: Max 1 per video

**Recommended Patterns:**
- Pattern A: `matrix_title` → `terminal_text` → `cipher_metric` → `data_stream` → `glitch_punch` → `fork_choice` → `awakening`
- Pattern B: `matrix_title` → `data_stream` → `cipher_metric` → `terminal_text` → `matrix_image` → `transmission` → `awakening`
- Pattern C: `matrix_title` → `terminal_text` → `fork_choice` → `data_stream` → `cipher_metric` → `glitch_punch` → `transmission` → `awakening`

---

# Content Extraction Rules

## Critical Extraction Guidelines

1. **Extract REAL content from narration** — never fabricate or invent
2. **Use exact prop names** as specified in each layout (case-sensitive)
3. **Match layout to content type** — don't force terminal_text when cipher_metric fits better
4. **Preserve structure** — if narration lists 3 items, extract all 3
5. **Be concise** — titles short, props essential

## Layout-Specific Extraction

### cipher_metric
- Extract REAL numbers from narration
- `value`: String representation ("97", "10000", "10x")
- `label`: What it measures (2-5 words)
- `suffix`: Units (%, x, +, k, M, /7, etc.)
- Max 2 metrics (first is hero)

### data_stream
- Extract ordered items/features/benefits
- `items`: Array of 3-8 word phrases
- Maintain parallel structure

### fork_choice
- Extract contrasting sides
- `leftLabel` / `rightLabel`: 1-4 words each
- `leftDescription` / `rightDescription`: 1-2 sentences each
- Ensure actual contrast/comparison

### glitch_punch
- Extract the SINGLE most impactful word/number
- `word`: 1-3 words, punchy and bold

### transmission
- Extract 3-5 short, standalone phrases
- `phrases`: Array of 3-8 word phrases
- Each should be a complete thought

### awakening
- `highlightPhrase`: The key phrase to underline (2-5 words from narration)
- `cta`: Short call-to-action

---

# Variety Rules

## Golden Rules
1. **NEVER repeat layouts consecutively**
2. **Prioritize variety** — use full layout catalog
3. **Respect max usage limits**:
   - `terminal_text`: ≤ 2 per video
   - `glitch_punch`: ≤ 1 per video
   - `transmission`: ≤ 1 per video

## Variety Scoring
A good video should have:
- **Variety score ≥ 0.6** (unique layouts / total scenes)
- **No consecutive repeats**
- **Balanced rhythm** (text → data → contrast → text)

## Example Good vs Bad Variety

### GOOD (7 scenes, 7 unique layouts, variety = 1.0)
```
1. matrix_title
2. terminal_text
3. cipher_metric
4. data_stream
5. fork_choice
6. glitch_punch
7. awakening
```

### BAD (7 scenes, 3 unique layouts, variety = 0.43)
```
1. matrix_title
2. terminal_text
3. terminal_text  ← Consecutive repeat
4. terminal_text  ← Third, over limit
5. cipher_metric
6. terminal_text  ← Fourth
7. awakening
```

---

# Quality Checklist

Before finalizing layout selection, verify:

- [ ] Layout matches content type (numbers → cipher_metric, lists → data_stream, etc.)
- [ ] Props extracted from narration (not invented)
- [ ] Variety score will be ≥ 0.6
- [ ] No consecutive identical layouts
- [ ] Usage limits respected (terminal_text ≤2, glitch_punch ≤1, transmission ≤1)
- [ ] Props use exact field names from layout catalog
- [ ] Text lengths appropriate (titles short, items concise)
- [ ] If images available, matrix_image considered
- [ ] Scene 0 is always matrix_title
- [ ] Last scene is always awakening
