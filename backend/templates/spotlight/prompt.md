# Design Philosophy

Spotlight is a TED talk meets a motion graphics reel meets a viral social video. Text IS the design — words fill the entire frame, slam in, bounce, stack, swap, and pulse. No decorative elements, no cards, no borders. Just powerful typography on a dark stage. When data appears, a single clean glass panel emerges. The pacing is fast and punchy — built for content that grabs in the first 2 seconds.

**Key Visual Rules:**
- **Text is the primary visual.** Font sizes range from 48px to 200px. No decorative graphics. Typography does all the visual work.
- **Font weight is heavy.** 700–900 weight exclusively. No thin or light weights except for small labels (14px).
- **Backgrounds are solid.** Black (#000000) or white (#FFFFFF). No gradients, no textures.
- **Accent color is surgical.** Red (#EF4444) on exactly ONE element per scene — a highlighted word, a divider, a number. Never on backgrounds or large text blocks.
- **Animations use spring().** High stiffness (180–220), moderate damping for punchy overshoot. Things SLAM into place.
- **Individual word/line animation.** Every word/line animated independently with staggered delays.
- **No border-radius, no shadows, no blur** (except stat_stage's single glass card). Raw, direct, graphic.
- **Universal image support:** Most layouts can display images alongside content when available.

---

# Layout Catalog

## impact_title
**Visual:** Pure black screen. Title text at 140–160px, weight 900, centered. Text springs in from scaled-down — overshoots to ~105%, settles to 100%. Optional subtitle in thin weight (300, 28px, muted gray) fades in below with delay. This is the opening punch.

**Best for:** Always scene 0. The video title / opening hook.

**Props:**
- (none — uses scene `title` and `narration` directly)

**Content Requirements:**
- `title`: Main headline (2-6 words) — will be displayed at 80-140px, uppercase
- `narration`: Optional subtitle/tagline (5-15 words) — displayed small with muted color

**Example Extraction:**
```
Narration: "Introducing the next generation of content automation"
 CORRECT:
  title: "The Future Is Now"
  narration: "Introducing the next generation of content automation"

 WRONG:
  title: "Introducing the next generation of content automation that will change everything"
  (too long, will look cramped)
```

**When to Use:**
- Scene 0 ONLY (hero/opening)
- Product launches, major announcements, video introductions

**When NOT to Use:**
- Any scene after scene 0
- Explanatory content, lists, or multiple points

---

## statement
**Visual:** A single sentence split across 2–3 lines. Each line drops in from above with spring bounce — staggered by 6–8 frames. White text on black, 44–60px, weight 800. One key word rendered in accent color at ~1.15x size. Deliberate, punchy. **When image is available:** Image displays alongside text (side-by-side in landscape, stacked in portrait).

**Best for:** Key explanations, important points, thesis statements. This is the baseline/fallback layout.

**Props:**
- `highlightWord` (string, optional): which word to render in accent color

**Content Requirements:**
- `title`: Section heading (used as fallback if narration is empty)
- `narration`: The statement text (20-60 words) — will be split across lines
- `highlightWord`: A single key word from the narration to emphasize

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
- Explaining concepts, describing features, general narrative content
- This is the fallback layout — use when nothing more specific fits

**When NOT to Use:**
- When showing metrics/numbers (use stat_stage)
- For dramatic one-word moments (use word_punch)
- For comparisons (use versus)

---

## word_punch
**Visual:** ONE word or short phrase fills the entire frame. 120–180px, weight 900, accent colored (#EF4444). Black background. Springs from 0% to ~110% (overshoot) then settles to 100%. No other elements. Maximum 1 per video.

**Best for:** The single most impactful word or number. The "mic drop."

**Props:**
- `word` (string): the single word or short phrase (1–3 words max)

**Content Requirements:**
- **word**: 1-3 words, all caps feel ("WHY?", "FAST.", "3X", "FREE.", "NOW.")
- This word should be the single most impactful moment in the video

**Example Extraction:**
```
Narration: "Performance is 3X faster than any competitor."

 CORRECT:
  word: "3X"

 WRONG:
  word: "Performance is 3X faster"
  // Too long — should be the single punch word/number
```

**When to Use:**
- The single most impactful moment
- Maximum 1 per video (loses impact if overused)

**When NOT to Use:**
- For explanations or descriptions
- More than once per video
- For anything longer than 3 words

---

## cascade_list
**Visual:** Items appear one at a time, stacking vertically. Each item: bold number in accent color + white text. Items slide in from right, staggered. Previous items dim to 30% opacity as new ones appear. No cards — raw text on black. **When image is available:** Image displays alongside list (side-by-side in landscape, stacked in portrait).

**Best for:** Feature lists, benefits, steps, takeaways — any ordered list of 3–6 items.

**Props:**
- `items` (string[]): max 6 items, each 3–8 words

**Content Requirements:**
- **items**: Array of 3-6 short phrases (3-8 words each)
- Parallel structure preferred ("Lightning fast performance", "Zero config setup", "Built-in analytics")

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
- Ordered content that builds

**When NOT to Use:**
- For single items (use statement)
- For comparisons (use versus)
- For 2 items only (use versus or statement)

---

## stat_stage
**Visual:** Giant number (100–160px, weight 900, white) centered on black. Counter roll-up animation. After the number lands, a small frosted glass card (the ONLY glass element in Spotlight) fades in below with label and context. **When image is available:** Image displays alongside the metric (side-by-side in landscape, stacked in portrait).

**Best for:** Statistics, key metrics, benchmarks — when a single number deserves the entire frame.

**Props:**
- `metrics` — array of objects, max 2 items (1 preferred)
  - `value` (string): the number, e.g. "97"
  - `label` (string): what it represents
  - `suffix` (string, optional): unit, e.g. "%"

**Prop Structure:**
```typescript
{
  metrics: [
    { value: "97", label: "Customer Satisfaction", suffix: "%" }
  ]
}
```

**Content Requirements:**
- **value**: The number as string (will be counted up from 0 if numeric)
- **label**: What the number represents (2-5 words)
- **suffix**: Optional unit (%, x, +, k, M, /7, etc.)
- First metric is the hero (giant number), second (if any) appears in context card

**Example Extraction:**
```
Narration: "We've achieved 97% customer satisfaction based on 12,000+ reviews."

 CORRECT:
  metrics: [
    { value: "97", label: "Customer Satisfaction", suffix: "%" }
  ]

 WRONG:
  metrics: [
    { value: "97% customer satisfaction" }
  ]
  // Mixed text and number
```

**When to Use:**
- Key statistics, growth numbers, benchmarks, achievement milestones

**When NOT to Use:**
- When numbers aren't the main focus
- For text-heavy content

---

## versus
**Visual:** Screen splits vertically. Left half: white background, black text. Right half: black background, white text. Thin accent neon divider. Both sides slide in from opposite edges. Color inversion creates instant visual tension.

**Best for:** Before/after, old vs new, two contrasting approaches.

**Props:**
- `leftLabel` (string): label for left side (1–4 words)
- `rightLabel` (string): label for right side (1–4 words)
- `leftDescription` (string, optional): 1 sentence context for left
- `rightDescription` (string, optional): 1 sentence context for right

**Content Requirements:**
- **leftLabel / rightLabel**: 1-4 words each, contrasting
- **leftDescription / rightDescription**: 1-2 sentences each, roughly similar length

**Example Extraction:**
```
Narration: "Traditional video takes hours of manual work. Our solution automates it in 30 seconds."

 CORRECT:
  leftLabel: "Before"
  rightLabel: "After"
  leftDescription: "Slow. Error-prone. Expensive."
  rightDescription: "Instant. Accurate. Free."

 WRONG:
  leftLabel: "The Traditional Way of Manual Video Production"
  // Too long — 1-4 words max
```

**When to Use:**
- Before/after scenarios, problem/solution, old vs new, pros/cons

**When NOT to Use:**
- For non-contrasting content
- For 3+ items (use cascade_list)

---

## spotlight_image
**Visual:** Image starts invisible (black screen). A circular spotlight/vignette reveals the image from center outward. Slow Ken Burns push-in zoom. Frosted glass caption strip at bottom with title and description. Cinematic and dramatic.

**Best for:** Blog images, screenshots, diagrams — when the image should be showcased dramatically.

**Props:**
- (none — uses scene `title`, `narration`, and `imageUrl` from scene data)

**Content Requirements:**
- `title`: Image caption (3-8 words)
- `narration`: Optional description (10-20 words)
- `imageUrl`: Must be provided in scene data (automatically assigned)

**Example Extraction:**
```
Narration: "Our dashboard provides real-time analytics and insights."

 CORRECT:
  title: "Real-Time Analytics Dashboard"
  narration: "Track video performance with live insights"

 WRONG:
  title: "Dashboard"
  // Too vague
```

**When to Use:**
- When an image is available and relevant
- Screenshots, diagrams, visual demonstrations

**When NOT to Use:**
- When no image is available
- For text-heavy content

---

## rapid_points
**Visual:** 3–5 short phrases displayed sequentially, each taking the entire screen. Each phrase: centered, 40–64px, weight 800. Hard cuts between phrases (no transitions). Rapid and energetic pacing.

**Best for:** Quick summaries, rapid-fire takeaways, teaser/trailer moments.

**Props:**
- `phrases` (string[]): 3–5 short phrases, each 3–8 words

**Content Requirements:**
- **phrases**: 3-5 short, complete thoughts (3-8 words each)
- Each phrase should stand alone and be impactful
- Numbers or key words automatically get accent color

**Example Extraction:**
```
Narration: "No setup required. Works out of the box. Ships in 60 seconds. Scales automatically."

 CORRECT:
  phrases: [
    "No setup required",
    "Works out of the box",
    "Ships in 60 seconds",
    "Scales automatically"
  ]

 WRONG:
  phrases: [
    "No setup required, works out of the box, ships in 60 seconds and scales automatically"
  ]
  // Should be separate phrases, not one long sentence
```

**When to Use:**
- Quick summaries of multiple points
- High-energy moments
- Teaser/trailer feel

**When NOT to Use:**
- For detailed explanations
- When each point needs context (use cascade_list instead)

---

## closer
**Visual:** Takeaway text (34–52px, weight 700) fades in from gaussian blur (starts blurry, sharpens over ~20 frames). Once sharp, an accent underline draws beneath the key phrase (left to right). Small CTA text fades in below with delay. Clean, final, memorable.

**Best for:** Always the last scene. Key takeaway, final thought, or call to action.

**Props:**
- `highlightPhrase` (string, optional): which phrase gets the accent underline
- `cta` (string, optional): small call-to-action text, e.g. "Read the full post →"

**Content Requirements:**
- `narration`: The closing statement (10-30 words)
- `highlightPhrase`: A key phrase from narration to underline with accent (2-5 words)
- `cta`: Short call-to-action (3-8 words)

**Example Extraction:**
```
Narration: "The best time to start was yesterday. The second best time is right now."

 CORRECT:
  highlightPhrase: "right now"
  cta: "Read the full article →"

 WRONG:
  highlightPhrase: "The best time to start was yesterday. The second best time is right now."
  // Too long — should be just the key phrase (2-5 words)
```

**When to Use:**
- Last scene ONLY
- Key takeaway, memorable closing, call to action

**When NOT to Use:**
- Any scene other than the last
- For explanations or lists

---

# Scene Flow Rules

- **Scene 0:** ALWAYS `impact_title` (non-negotiable)
- **Opening (scenes 1–2):** `statement` for setup
- **Middle (scenes 3–N-1):** Alternate between:
  - Text layouts: `statement`, `cascade_list`, `rapid_points`
  - Data moments: `stat_stage` (glass card)
  - Contrast: `versus`
  - Image: `spotlight_image` (when images available)
  - Impact: `word_punch` (max 1 total)
- **Closing (scene N):** ALWAYS `closer`

**Variety Requirements:**
- NEVER use same layout 2 times in a row
- A 7-scene video should use 5-7 DIFFERENT layouts
- A 10-scene video should use 7-9 DIFFERENT layouts
- Max usage limits:
  - `statement`: Max 2 per video (it's the fallback)
  - `word_punch`: Max 1 per video (loses impact if overused)
  - `rapid_points`: Max 1 per video

**Recommended Patterns:**
- Pattern A: `impact_title` → `statement` → `stat_stage` → `cascade_list` → `word_punch` → `versus` → `closer`
- Pattern B: `impact_title` → `cascade_list` → `stat_stage` → `statement` → `spotlight_image` → `rapid_points` → `closer`
- Pattern C: `impact_title` → `statement` → `versus` → `cascade_list` → `stat_stage` → `word_punch` → `rapid_points` → `closer`
- Pattern D: `impact_title` → `spotlight_image` → `statement` → `stat_stage` → `cascade_list` → `versus` → `closer`

---

# Content Extraction Rules

## Critical Extraction Guidelines

1. **Extract REAL content from narration** — never fabricate or invent
2. **Use exact prop names** as specified in each layout (case-sensitive)
3. **Match layout to content type** — don't force statement when stat_stage fits better
4. **Preserve structure** — if narration lists 3 items, extract all 3
5. **Be concise** — titles short, props essential

## Layout-Specific Extraction

### stat_stage
- Extract REAL numbers from narration
- `value`: String representation ("97", "10000", "10x")
- `label`: What it measures (2-5 words)
- `suffix`: Units (%, x, +, k, M, /7, etc.)
- Max 2 metrics (first is hero)

### cascade_list
- Extract ordered items/features/benefits
- `items`: Array of 3-8 word phrases
- Maintain parallel structure

### versus
- Extract contrasting sides
- `leftLabel` / `rightLabel`: 1-4 words each
- `leftDescription` / `rightDescription`: 1-2 sentences each
- Ensure actual contrast/comparison

### word_punch
- Extract the SINGLE most impactful word/number
- `word`: 1-3 words, punchy and bold

### rapid_points
- Extract 3-5 short, standalone phrases
- `phrases`: Array of 3-8 word phrases
- Each should be a complete thought

### closer
- `highlightPhrase`: The key phrase to underline (2-5 words from narration)
- `cta`: Short call-to-action

---

# Variety Rules

## Golden Rules
1. **NEVER repeat layouts consecutively**
2. **Prioritize variety** — use full layout catalog
3. **Respect max usage limits**:
   - `statement`: ≤ 2 per video
   - `word_punch`: ≤ 1 per video
   - `rapid_points`: ≤ 1 per video

## Variety Scoring
A good video should have:
- **Variety score ≥ 0.6** (unique layouts / total scenes)
- **No consecutive repeats**
- **Balanced rhythm** (text → data → contrast → text)

## Example Good vs Bad Variety

### GOOD (7 scenes, 7 unique layouts, variety = 1.0)
```
1. impact_title
2. statement
3. stat_stage
4. cascade_list
5. versus
6. word_punch
7. closer
```

### BAD (7 scenes, 3 unique layouts, variety = 0.43)
```
1. impact_title
2. statement
3. statement  ← Consecutive repeat
4. statement  ← Third in a row, over limit
5. stat_stage
6. statement  ← Fourth statement
7. closer
```

---

# Quality Checklist

Before finalizing layout selection, verify:

- [ ] Layout matches content type (numbers → stat_stage, lists → cascade_list, etc.)
- [ ] Props extracted from narration (not invented)
- [ ] Variety score will be ≥ 0.6
- [ ] No consecutive identical layouts
- [ ] Usage limits respected (statement ≤2, word_punch ≤1, rapid_points ≤1)
- [ ] Props use exact field names from layout catalog
- [ ] Text lengths appropriate (titles short, items concise)
- [ ] If images available, spotlight_image considered
- [ ] Scene 0 is always impact_title
- [ ] Last scene is always closer
