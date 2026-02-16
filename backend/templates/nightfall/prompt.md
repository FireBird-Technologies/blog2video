# Design Philosophy

Nightfall is a premium product keynote at midnight. Apple WWDC meets Bloomberg terminal meets Blade Runner. Everything floats on dark space (#0A0A1A). Content lives on frosted glass panels — translucent white at low opacity, backdrop-filter blur, thin semi-transparent borders, generous border radius. Key moments break free of the glass: giant text slams onto the screen raw. Data glows with neon accent-colored arcs and rings. The typography is clean sans-serif; titles can go large (48–120px). Transitions are smooth and cinematic: fade in, scale from ~0.95 to 1.0, gentle vertical float-up. Stagger child elements by 5–8 frames. Nothing snaps or bounces — this template is about elegance.

**ENHANCED VERSION IMPROVEMENTS:**
- Spring-based physics for organic motion (not linear)
- Multi-layer depth effects (shadows, glows, overlays)
- Staggered reveals for better pacing
- Professional visual polish (gradients, particles, decorative elements)
- Improved readability and hierarchy

---

# Layout Catalog

## cinematic_title
**Visual:** Full dark screen with slow-drifting gradient mesh background. Title text (120px+, weight 800) springs in with slight overshoot. Particle accent elements fade in around the title. A horizontal glowing strip with center indicator fades in. Subtitle (300 weight) fades in below with delay. Feels like a premium film title card.

**Best for:** Always scene 0. The opening/hero moment.

**Props:** 
- (none — uses scene `title` and `narration` directly)

**Content Requirements:**
- `title`: Main headline (2-6 words) — will be displayed at 88-140px
- `narration`: Optional subtitle/tagline (5-15 words) — will be displayed at 24-32px

**Example Extraction:**
```
Narration: "Introducing Presscut — The next generation of content automation"
 CORRECT:
  title: "Introducing Presscut"
  (narration used for subtitle automatically)

 WRONG:
  title: "Introducing Presscut — The next generation of content automation"
  (too long, will look cramped)
```

**When to Use:**
- Scene 0 ONLY (hero/opening)
- Product launches
- Major announcements
- Video introductions

**When NOT to Use:**
- Any scene after scene 0
- Explanatory content
- Lists or multiple points

---

## glass_narrative
**Visual:** Single frosted glass card, centered, 65-70% width. Title (32-40px, weight 700) at top. Body paragraph below (20-26px). Card floats up with spring physics. Ambient glow behind card for depth. Subtle floating animation continues throughout.

**Best for:** Main explanations, narrative body, general content. Baseline layout — max 2 per video.

**Props:** 
- (none — uses scene `title` and `narration` directly)

**Content Requirements:**
- `title`: Section heading (3-8 words) — clear, descriptive
- `narration`: Body text (20-100 words) — 1-3 sentences
- Can handle multi-paragraph content (separated by \n)

**Example Extraction:**
```
Narration: "Our platform uses advanced AI to automatically generate video content from your blog posts. Simply paste your URL and our system handles the rest, creating engaging videos in minutes."

 CORRECT:
  title: "How It Works"
  narration: "Our platform uses advanced AI to automatically generate video content from your blog posts. Simply paste your URL and our system handles the rest, creating engaging videos in minutes."

 WRONG:
  title: "How Our Platform Uses Advanced AI"
  (too long for title, wastes space)
```

**When to Use:**
- Explaining concepts
- Describing features
- Background information
- Process descriptions
- General narrative content

**When NOT to Use:**
- When showing metrics/numbers (use glow_metric)
- When showing code (use glass_code)
- For dramatic one-liners (use kinetic_insight)
- For comparisons (use split_glass)

---

## glow_metric
**Visual:** Frosted glass card centered on dark. 1-3 large numbers (72-96px, weight 800) with dual counter-rotating rings behind them. Numbers animate from 0 to target with smooth counting. Pulsing glow effect. Secondary metrics (if any) appear below in smaller format. Ambient card glow. Numbers formatted with commas (10,000 not 10000).

**Best for:** Statistics, percentages, KPIs, benchmarks — any scene where 1–3 numbers are the main point.

**Props:** 
- `metrics`: array of objects with `value`, `label`, and optional `suffix`
- Maximum 3 items (first is primary with rings, others are secondary)

**Prop Structure:**
```typescript
{
  metrics: [
    { value: "10000", label: "Active Users", suffix: "+" },
    { value: "99", label: "Uptime", suffix: "%" },
    { value: "24", label: "Support", suffix: "/7" }
  ]
}
```

**Content Requirements:**
- **value**: The number as string (will be formatted)
  - Can include letters for non-numeric displays ("10x", "A+")
  - Pure numbers will be counted up from 0
- **label**: What the number represents (2-4 words)
- **suffix**: Optional unit (%, x, +, k, M, etc.)

**Example Extraction:**
```
Narration: "We've grown to over 10,000 active users with 99% uptime and 24/7 support."

 CORRECT:
  metrics: [
    { value: "10000", label: "Active Users", suffix: "+" },
    { value: "99", label: "Uptime", suffix: "%" },
    { value: "24", label: "Support", suffix: "/7" }
  ]

 WRONG:
  metrics: [
    { value: "10,000+ active users" }  // Mixed text and number
  ]
```

**When to Use:**
- Showing performance metrics
- Key statistics
- Growth numbers
- Benchmarks
- Achievement milestones

**When NOT to Use:**
- When numbers aren't the main focus
- For text-heavy content
- For code or technical snippets

---

## glass_code
**Visual:** Frosted glass card with professional terminal chrome. macOS-style traffic light buttons (red, yellow, green). Language badge in header. Code lines (14-18px monospace) typewrite in one-by-one with blinking cursor. Line numbers in accent color. Syntax highlighting (keywords, strings, numbers, comments).

**Best for:** Code snippets, terminal commands, API examples, config files.

**Props:** 
- `codeLines`: array of strings (each string is one line of code)
- `codeLanguage`: string (e.g., "javascript", "python", "bash", "typescript")

**Content Requirements:**
- **codeLines**: 3-8 lines of ACTUAL code (not pseudocode)
  - Preserve exact spacing/indentation
  - One line = one array item
- **codeLanguage**: Lowercase language name
  - Common: javascript, python, bash, typescript, sql, json, yaml

**Example Extraction:**
```
Narration: "Here's how you initialize the SDK. First, import the library, then create a new instance with your API key, and finally call the start method."

 CORRECT:
  codeLines: [
    "import Presscut from 'presscut-sdk';",
    "",
    "const client = new Presscut({",
    "  apiKey: process.env.API_KEY",
    "});",
    "",
    "client.start();"
  ],
  codeLanguage: "javascript"

 WRONG:
  codeLines: [
    "First import the library, then create instance, then call start"
  ]
  // This is NOT code, it's prose
```

**When to Use:**
- Showing actual code snippets
- Terminal commands
- Configuration examples
- API usage examples
- Installation instructions (bash commands)

**When NOT to Use:**
- For pseudocode or descriptions
- When code isn't mentioned in narration
- For very long code (>8 lines)

---

## kinetic_insight
**Visual:** NO glass card. Raw dark background with subtle accent gradients. One powerful sentence (52-72px) with words appearing one-by-one using spring animations. Highlight word gets accent color, 1.15x scale, and underline. Opening/closing quote marks if it's a quote. Dramatic, cinematic pause.

**Best for:** Key insights, single most important takeaway, pivotal definition, "mic drop" moment. Maximum 1–2 per video.

**Props:** 
- `quote`: The powerful sentence (optional, uses narration if not provided)
- `highlightWord`: The word to emphasize with color/scale (optional)

**Content Requirements:**
- **quote**: 5-15 words — ONE sentence only
  - Should be impactful, memorable
  - No technical jargon unless it's the key term
- **highlightWord**: 1 word from the quote to highlight
  - Usually the most important concept
  - Must appear in the quote exactly

**Example Extraction:**
```
Narration: "Content creation shouldn't take hours. With Presscut, it takes minutes. This is the future of automated video production."

 CORRECT:
  quote: "Content creation shouldn't take hours",
  highlightWord: "hours"

OR:
  quote: "This is the future of automated video",
  highlightWord: "future"

 WRONG:
  quote: "Content creation shouldn't take hours. With Presscut, it takes minutes."
  // Two sentences — too long, loses impact

 WRONG:
  quote: "Our platform uses advanced AI algorithms to automatically generate engaging video content from blog posts"
  // Too technical, too long, not memorable
```

**When to Use:**
- Pivotal moment in the video
- Key insight or "aha" moment
- Memorable one-liner
- Dramatic conclusion
- Maximum 1-2 per video (loses impact if overused)

**When NOT to Use:**
- For explanations or descriptions
- For multiple points
- For technical content
- More than twice per video

---

## glass_stack
**Visual:** 2-3 frosted glass cards stacked vertically with parallax offset (deeper cards shifted right). Each card has a numbered badge (1, 2, 3) and contains text (20-26px). Cards cascade in from below with staggered spring animations. Connecting lines between cards. Depth-based shadows.

**Best for:** Feature lists, multiple related points, benefits, steps — 2–3 items simultaneously.

**Props:** 
- `items`: array of strings — 2-3 concise descriptions (5-12 words each)

**Content Requirements:**
- **items**: 2-3 short phrases
  - Each should be 5-12 words
  - Parallel structure preferred ("Automatically X", "Instantly Y", "Easily Z")
  - Concise, punchy
- Minimum 2 items, maximum 3 (more than 3 gets crowded)

**Example Extraction:**
```
Narration: "Presscut offers three key benefits: automatic video generation from blog posts, instant social media optimization, and seamless integration with your existing workflow."

 CORRECT:
  items: [
    "Automatic video generation from blog posts",
    "Instant social media optimization",
    "Seamless integration with existing workflow"
  ]

 WRONG:
  items: [
    "Presscut offers automatic video generation from blog posts which uses AI",
    "It also does instant social media optimization for platforms",
    "Plus seamless integration"
  ]
  // First two are too long, inconsistent structure

 WRONG:
  items: [
    "Video generation",
    "Social media",
    "Integration",
    "Analytics",
    "Support"
  ]
  // Too many items (max 3), too vague
```

**When to Use:**
- Listing 2-3 features
- Showing benefits
- Outlining steps/process
- Comparing multiple options

**When NOT to Use:**
- For single items (use glass_narrative)
- For 4+ items (too crowded)
- For comparisons (use split_glass)

---

## split_glass
**Visual:** Two frosted glass cards side-by-side (or stacked vertically on portrait). Animated glowing center divider grows from center. Cards slide in from opposite edges. Left and right panels each have label (uppercase, small) and description. Color-coded indicators (dots).

**Best for:** Comparisons, pros/cons, before/after, old vs new, two contrasting approaches.

**Props:** 
- `leftLabel`: Short label (1-2 words, e.g., "Before", "Problem", "Old Way")
- `rightLabel`: Short label (1-2 words, e.g., "After", "Solution", "New Way")
- `leftDescription`: Content for left panel (1-2 sentences)
- `rightDescription`: Content for right panel (1-2 sentences)

**Content Requirements:**
- **leftLabel / rightLabel**: 1-2 words each
  - Should be contrasting (Before/After, Problem/Solution)
  - Uppercase styling applied automatically
- **leftDescription / rightDescription**: 1-2 sentences each
  - Roughly similar length preferred
  - Should present contrasting ideas

**Example Extraction:**
```
Narration: "Traditional video production requires expensive equipment, professional editors, and takes days to complete. With Presscut, you simply paste a URL and get professional videos in minutes."

 CORRECT:
  leftLabel: "Traditional",
  rightLabel: "Presscut",
  leftDescription: "Requires expensive equipment, professional editors, and days to complete",
  rightDescription: "Simply paste a URL and get professional videos in minutes"

OR:
  leftLabel: "Before",
  rightLabel: "After",
  leftDescription: "Traditional video production requires expensive equipment and takes days",
  rightDescription: "Paste a URL and get videos in minutes"

 WRONG:
  leftLabel: "The Traditional Way of Making Videos",
  rightLabel: "Presscut"
  // Left label is way too long (should be 1-2 words)

 WRONG:
  leftDescription: "Traditional",
  rightDescription: "Requires expensive equipment, editors, takes days. Presscut just needs a URL and creates videos in minutes."
  // Mixing both sides in right panel, not actually contrasting
```

**When to Use:**
- Before/after scenarios
- Problem/solution presentations
- Old vs new comparisons
- Pros and cons
- Contrasting two approaches

**When NOT to Use:**
- For non-contrasting content
- When you have 3+ items (use glass_stack)
- For single concepts

---

## chapter_break
**Visual:** Minimal, elegant transition. Giant chapter number (160-240px, weight 200, low opacity) at center with gradient overlay. Ornamental corner frames. "CHAPTER" label text. Decorative horizontal lines with glowing center dot. Title/subtitle below number. No glass cards — pure breathing room.

**Best for:** Transitions between major topics, section introductions, pacing breaks. Maximum 2 per video.

**Props:** 
- `chapterNumber`: number (1, 2, 3, ...)
- `subtitle`: string — brief section description (4-8 words)

**Content Requirements:**
- **chapterNumber**: Sequential integer (1, 2, 3...)
  - Tracks major sections
  - Reset for each new video
- **subtitle**: 4-8 words
  - Brief description of what's coming
  - Not a full sentence, just a phrase

**Example Extraction:**
```
Narration: "Now let's look at how the automation works under the hood."

 CORRECT:
  chapterNumber: 2,
  subtitle: "How Automation Works"

OR:
  subtitle: "Under the Hood"

 WRONG:
  subtitle: "Now let's look at how the automation works under the hood"
  // Too long (should be 4-8 words)

 WRONG:
  chapterNumber: "Two"
  // Must be a number, not string
```

**When to Use:**
- Transitioning between major sections
- Starting a new topic
- Creating pacing breaks
- Maximum 2 per video (too many breaks the flow)

**When NOT to Use:**
- Within a section
- For minor topic shifts
- More than twice per video

---

## glass_image
**Visual:** Image fills background with professional Ken Burns effect (slow zoom + pan). Multi-layer gradient overlays (vignette, bottom gradient, accent wash). Frosted glass caption card slides up from bottom with parallax effect. Caption has title (28-36px) and narration (18-22px).

**Best for:** Showcasing images, screenshots, diagrams — image dominates, text supports.

**Props:** 
- (none — uses scene `title`, `narration`, and `imageUrl` from scene data)

**Content Requirements:**
- `title`: Image caption (3-8 words)
- `narration`: Optional description (10-20 words)
- `imageUrl`: Must be provided in scene data (automatically assigned)

**Example Extraction:**
```
Narration: "Our dashboard provides real-time analytics and insights into your video performance."

 CORRECT:
  title: "Real-Time Analytics Dashboard"
  narration: "Track video performance with live insights"

 WRONG:
  title: "Dashboard"
  // Too vague

 WRONG:
  title: "Our dashboard provides real-time analytics and comprehensive insights into your video performance across all platforms"
  // Way too long
```

**When to Use:**
- When an image is available and relevant
- Screenshots of product
- Diagrams or infographics
- Visual demonstrations
- Blog post images

**When NOT to Use:**
- When no image is available
- For text-heavy content
- When image isn't the focus

---

# Scene Flow Rules

- **Scene 0:** ALWAYS `cinematic_title` (non-negotiable)
- **Opening (scenes 1–2):** `glass_narrative` OR `chapter_break` for setup
- **Middle (scenes 3–N-1):** Alternate between:
  - Glass cards: `glass_narrative`, `glow_metric`, `glass_code`, `glass_stack`, `split_glass`, `glass_image`
  - Impact moments: `kinetic_insight` (max 1-2 total)
  - Transitions: `chapter_break` (max 2 total)
- **Closing (scene N):** `glass_narrative`, `kinetic_insight`, or `glow_metric` for strong finish

**Variety Requirements:**
- NEVER use same layout 2 times in a row (except if absolutely required by content)
- A 7-scene video should use 5-7 DIFFERENT layouts
- A 10-scene video should use 7-9 DIFFERENT layouts
- Max usage limits:
  - `glass_narrative`: Max 2 per video (it's the fallback)
  - `kinetic_insight`: Max 2 per video (loses impact if overused)
  - `chapter_break`: Max 2 per video (too many breaks flow)

**Recommended Patterns:**
- Pattern A: `cinematic_title` → `glass_narrative` → `glow_metric` → `glass_stack` → `kinetic_insight` → `split_glass` → `glass_narrative`
- Pattern B: `cinematic_title` → `chapter_break` → `glass_narrative` → `glass_code` → `glow_metric` → `glass_stack` → `kinetic_insight`
- Pattern C: `cinematic_title` → `glass_image` → `glass_narrative` → `split_glass` → `glow_metric` → `chapter_break` → `glass_stack` → `kinetic_insight`

---

# Content Extraction Rules

## Critical Extraction Guidelines

1. **Extract REAL content from narration** — never fabricate or invent
2. **Use exact prop names** as specified in each layout (case-sensitive)
3. **Match layout to content type** — don't force glass_narrative when glow_metric fits better
4. **Preserve structure** — if narration lists 3 items, extract all 3 (not just 1-2)
5. **Be concise** — titles should be short, props should be essential

## Layout-Specific Extraction

### glow_metric
- Extract REAL numbers from narration
- `value`: String representation ("97", "10000", "10x")
- `label`: What it measures (2-4 words)
- `suffix`: Units (%, x, +, k, M, /7, etc.)
- Max 3 metrics (first is primary with rings)

### glass_code
- Extract ACTUAL code lines (not descriptions)
- `codeLines`: Array of code strings (3-8 lines)
- Preserve spacing and indentation
- `codeLanguage`: Lowercase ("javascript", "python", "bash")

### kinetic_insight
- Extract the SINGLE most powerful sentence
- `quote`: 5-15 words, one sentence only
- `highlightWord`: The key term (optional, defaults to middle word)

### glass_stack
- Extract 2-3 parallel items
- `items`: Array of 5-12 word phrases
- Maintain parallel structure

### split_glass
- Extract contrasting sides
- `leftLabel` / `rightLabel`: 1-2 words each
- `leftDescription` / `rightDescription`: 1-2 sentences each
- Ensure actual contrast/comparison

### chapter_break
- `chapterNumber`: Sequential integer (1, 2, 3)
- `subtitle`: 4-8 word section description

---

# Variety Rules

## Golden Rules
1. **NEVER repeat layouts consecutively** unless content absolutely demands it
2. **Prioritize variety** — use full layout catalog
3. **Balance glass cards with impact moments** — don't use 5 glass cards in a row
4. **Respect max usage limits**:
   - `glass_narrative`: ≤ 2 per video
   - `kinetic_insight`: ≤ 2 per video
   - `chapter_break`: ≤ 2 per video

## Variety Scoring
A good video should have:
- **Variety score ≥ 0.6** (unique layouts / total scenes)
- **No consecutive repeats** (same layout 2x in a row)
- **Balanced rhythm** (glass card → impact → glass card)

## Example Good vs Bad Variety

###  GOOD (7 scenes, 6 unique layouts, variety = 0.86)
```
1. cinematic_title
2. glass_narrative
3. glow_metric
4. glass_stack
5. split_glass
6. kinetic_insight
7. glass_narrative
```

###  BAD (7 scenes, 3 unique layouts, variety = 0.43)
```
1. cinematic_title
2. glass_narrative
3. glass_narrative  ← Consecutive repeat
4. glass_narrative  ← Third in a row
5. glow_metric
6. glass_narrative  ← Fourth glass_narrative (over limit)
7. glass_narrative  ← Fifth glass_narrative
```

---

# Example Scene Generation Workflow

## Input Scene Data
```
Scene 3/10
Title: "Lightning Fast Performance"
Narration: "Our platform processes blog posts in under 60 seconds and generates professional videos 10x faster than traditional methods."
Visual: Performance metrics
```

## Decision Process

1. **Analyze content type**: Contains numbers (60 seconds, 10x faster)
2. **Best layout**: `glow_metric` (numbers are the focus)
3. **Check variety**: Previous was `glass_narrative`, so `glow_metric` adds variety 
4. **Extract props**:
```json
{
  "layout": "glow_metric",
  "layoutProps": {
    "metrics": [
      { "value": "60", "label": "Seconds", "suffix": "s" },
      { "value": "10", "label": "Faster", "suffix": "x" }
    ]
  }
}
```

## Reasoning
- Content focuses on speed metrics → `glow_metric` is perfect fit
- Extracted both numbers (60s and 10x)
- Provides variety (previous was `glass_narrative`)
- Uses under 3 metrics (within limit)

---

# Common Mistakes to Avoid

##  Mistake 1: Wrong Layout Choice
```
Narration: "We achieved 99% uptime and 10,000 active users."
Bad: glass_narrative (ignores the numbers)
Good: glow_metric (numbers are the focus)
```

##  Mistake 2: Incomplete Extraction
```
Narration: "Three key features: automation, optimization, and integration."
Bad: { items: ["automation"] }  // Only extracted 1 of 3
Good: { items: ["automation", "optimization", "integration"] }
```

##  Mistake 3: Too-Long Props
```
Narration: "Our platform uses advanced AI"
Bad: title: "Our platform uses advanced AI algorithms and machine learning"
Good: title: "Advanced AI Platform"
```

## Mistake 4: Over-using Fallback
```
Bad sequence:
1. cinematic_title
2. glass_narrative
3. glass_narrative  ← Could be glow_metric if has numbers
4. glass_narrative  ← Could be glass_stack if has list
5. glass_narrative  ← Over usage limit
```

## Mistake 5: Fabricating Content
```
Narration: "Our platform is fast and reliable."
Bad: { metrics: [{ value: "99", label: "Uptime", suffix: "%" }] }
     // No "99%" mentioned in narration!
Good: glass_narrative (no specific numbers = no glow_metric)
```

---

# Quality Checklist

Before finalizing layout selection, verify:

- [ ] Layout matches content type (numbers → glow_metric, code → glass_code, etc.)
- [ ] Props extracted from narration (not invented)
- [ ] Variety score will be ≥ 0.6
- [ ] No consecutive identical layouts
- [ ] Usage limits respected (narrative ≤2, insight ≤2, chapter ≤2)
- [ ] Props use exact field names from layout catalog
- [ ] Text lengths appropriate (titles short, items concise)
- [ ] If images available, glass_image considered

---

# Success Metrics

A well-generated video should achieve:
- **Variety**: 60-80% of available layouts used
- **No consecutive repeats**: 0 instances of same layout 2x in a row
- **Balanced rhythm**: Glass cards alternating with impact moments
- **Accurate extraction**: All props match narration content
- **Professional polish**: Proper use of enhanced animations and effects