# Design Philosophy

Gridcraft is a Vercel feature page or Stripe product announcement that animates. Content is arranged spatially in bento grid cells — multiple pieces of information coexist on screen, organized in a "bento box." It feels structured, intentional, and info-dense without being cluttered. One cell per scene gets an accent pop (#F97316 background with white text). Non-grid layouts (editorial_body, pull_quote) intentionally break the grid pattern for rhythm contrast.

**Visual Rules (apply to EVERY component):**
- **Grid fundamentals:** Layouts use CSS Grid. Cells have border-radius 20px, gap 12px. White (#FFFFFF) cell backgrounds with subtle box-shadow (0 1px 3px rgba(0,0,0,0.06)). Frame background is near-white (#FAFAFA).
- **Accent pop cell:** In every grid layout, exactly ONE cell gets the accent background color (#F97316) with white text inside. Choose which cell gets accent based on content importance.
- **Typography:** Clean sans-serif throughout. Strong weight hierarchy: titles 600–700, body 400, labels 300 or small caps. Numbers displayed large (48–64px) with tabular-nums.
- **No gradients, no blur, no glow.** Visual interest comes from grid arrangement and accent pop, not effects.
- **Transitions:** Cells pop in with staggered timing (each delayed by 4–6 frames). Scale from 0.92 to 1.0 with opacity 0 to 1. Snappy easing — crisp, not floaty.
- **Non-grid layouts** (editorial_body, pull_quote): Intentionally single-column, centered, generous whitespace. Contrast in rhythm keeps the video from feeling monotonous.

---

# Layout Catalog

## bento_hero
**Visual:** A grid with one large 2×2 cell and 2 small 1×1 cells. The large cell has the accent background (#F97316) and contains the title text (big, bold, springs in with white text). One small cell has a category tag or emoji. The other small cell has the subtitle or a date/byline. Cells pop in staggered — large cell first, smalls follow. The grid fills ~85% of the frame with the near-white background behind it.

**Best for:** Always scene 0. The opening card.

**Props:**
- (none — uses scene `title` and `narration` directly. The component decides which cell gets what.)

**Content Requirements:**
- `title`: Main headline (2-6 words) — displayed large in accent cell
- `narration`: Subtitle/tagline (5-15 words) — displayed in smaller cell

**Example Extraction:**
```
Narration: "Introducing our new API platform for developers"

 CORRECT:
  title: "New API Platform"
  (narration used for subtitle cell automatically)

 WRONG:
  title: "Introducing our new API platform for developers worldwide"
  (too long for the hero cell)
```

**When to Use:**
- Scene 0 ONLY (hero/opening)
- Product launches, feature announcements, introductions

**When NOT to Use:**
- Any scene after scene 0
- Explanatory content

---

## bento_features
**Visual:** A 2×3 or 3×2 grid of equal-sized cells. Each cell contains: an emoji or small icon at top-left, a bold label (16–18px), and a one-line description (13px, muted). One cell (the most important feature) has the accent background with white text. The rest are white with dark text. Cells appear one at a time in reading order (left-to-right, top-to-bottom), each delayed by 4 frames.

**Best for:** Feature lists, benefits, capabilities — when you have 4–6 items.

**Props:**
- `features`: array of objects, max 6 items
  - `icon` (string): emoji, e.g. "⚡", "🔒", "📊"
  - `label` (string): bold feature name, 2–4 words
  - `description` (string): one-liner, 6–12 words
- `highlightIndex` (number, optional): which feature gets the accent cell (0-based). Default: 0.

**Prop Structure:**
```typescript
{
  features: [
    { icon: "⚡", label: "Lightning Fast", description: "Process requests in under 50ms" },
    { icon: "🔒", label: "Secure by Default", description: "End-to-end encryption for all data" },
    { icon: "📊", label: "Analytics Built-in", description: "Real-time dashboards and reporting" },
    { icon: "🔌", label: "Easy Integration", description: "Works with your existing tech stack" }
  ],
  highlightIndex: 0
}
```

**Content Requirements:**
- **features**: 4-6 objects with icon, label, description
  - `icon`: Single emoji representing the feature
  - `label`: 2-4 word feature name
  - `description`: 6-12 word one-liner
- **highlightIndex**: 0-based index of the most important feature

**Example Extraction:**
```
Narration: "The platform offers four key capabilities: blazing fast performance with sub-50ms response times, enterprise-grade security with end-to-end encryption, built-in analytics for real-time insights, and seamless integration with existing tools."

 CORRECT:
  features: [
    { icon: "⚡", label: "Blazing Fast", description: "Sub-50ms response times for all requests" },
    { icon: "🔒", label: "Enterprise Security", description: "End-to-end encryption for every transaction" },
    { icon: "📊", label: "Built-in Analytics", description: "Real-time insights and reporting dashboards" },
    { icon: "🔌", label: "Seamless Integration", description: "Works with your existing tech stack" }
  ],
  highlightIndex: 0

 WRONG:
  features: [
    { icon: "⚡", label: "The platform offers blazing fast performance" }
  ]
  // Only 1 feature extracted (should be 4), label too long, missing description
```

**When to Use:**
- Listing 4-6 features, benefits, or capabilities
- Product feature comparison
- Service offerings

**When NOT to Use:**
- For fewer than 4 items (use bento_highlight or editorial_body)
- For single topics
- For comparison of two options (use bento_compare)

---

## bento_highlight
**Visual:** One large 2×1 cell on top spanning full width, containing the main point. This cell has a very subtle tinted background (accent color at ~5% opacity) for emphasis. Below it: 2 small 1×1 cells side by side with supporting facts or secondary points. Large cell enters first (fade + scale), small cells follow staggered.

**Best for:** When one main idea needs emphasis with 2 supporting details. Feature spotlights, key announcements.

**Props:**
- `mainPoint` (string): the primary statement, 1–2 sentences
- `supportingFacts`: array of 2 strings, each a short fact or detail

**Content Requirements:**
- **mainPoint**: 1-2 sentences describing the main idea
- **supportingFacts**: Exactly 2 short strings (5-15 words each)

**Example Extraction:**
```
Narration: "Our new engine is 3x faster than the previous version. It reduces build times from 30 minutes to under 10. Memory usage is cut by 40% as well."

 CORRECT:
  mainPoint: "Our new engine is 3x faster than the previous version",
  supportingFacts: [
    "Build times reduced from 30 min to under 10",
    "Memory usage cut by 40%"
  ]

 WRONG:
  mainPoint: "Our new engine is 3x faster than the previous version. It reduces build times from 30 minutes to under 10. Memory usage is cut by 40% as well."
  // Everything crammed into mainPoint, no supporting facts extracted
```

**When to Use:**
- Emphasizing one key point with supporting evidence
- Feature spotlights
- Key announcements with details
- Stats-backed statements

**When NOT to Use:**
- For equal-weight items (use bento_features)
- For comparisons (use bento_compare)
- For narratives (use editorial_body)

---

## editorial_body
**Visual:** NOT a grid — intentionally single-column for rhythm contrast. Centered content area (~60% width). Large semi-bold title (32px) at top. A thin accent-colored horizontal rule below the title (2px, ~40% width). Body paragraph below in regular weight (18px) with comfortable line height. Generous padding all around. Feels like a clean presentation slide or a book page.

**Best for:** General explanations, narrative paragraphs, introductions. Baseline/fallback layout. Maximum 2 per video.

**Props:**
- (none — uses scene `title` and `narration` directly)

**Content Requirements:**
- `title`: Section heading (3-8 words)
- `narration`: Body text (20-100 words) — 1-3 sentences

**Example Extraction:**
```
Narration: "Before diving into the features, let's understand the problem. Most content teams spend hours manually creating videos from blog posts, resulting in inconsistent quality and massive time investment."

 CORRECT:
  title: "The Problem"
  narration: "Most content teams spend hours manually creating videos from blog posts, resulting in inconsistent quality and massive time investment."

 WRONG:
  title: "Before diving into the features let's understand the problem"
  // Too long for a title (should be 3-8 words)
```

**When to Use:**
- General explanations
- Setting context
- Introducing new sections
- Background information
- Maximum 2 per video

**When NOT to Use:**
- When content has numbers (use kpi_grid)
- When content has list items (use bento_features)
- When content has code (use bento_code)

---

## kpi_grid
**Visual:** 3 equal cells in a horizontal row, each roughly square. Each cell contains: one large bold number (48–56px) at center, a small trend arrow below it (green ▲ for up, red ▼ for down, gray ● for neutral), and a label (13px, muted) at the bottom. Numbers animate with counter roll-up, staggered per cell (each starts 6 frames after the previous). One cell (the most impressive metric) gets the accent background.

**Best for:** Statistics, KPIs, metrics, benchmarks — any scene with 2–3 key numbers.

**Props:**
- `dataPoints`: array of objects, max 3 items
  - `label` (string): what the number represents
  - `value` (string): the display value, e.g. "97%", "3.2x", "50ms"
  - `trend` (string, optional): "up", "down", or "neutral"
- `highlightIndex` (number, optional): which cell gets accent bg. Default: 0.

**Prop Structure:**
```typescript
{
  dataPoints: [
    { label: "Conversion Rate", value: "97%", trend: "up" },
    { label: "Load Time", value: "50ms", trend: "down" },
    { label: "Uptime", value: "99.9%", trend: "neutral" }
  ],
  highlightIndex: 0
}
```

**Content Requirements:**
- **dataPoints**: 2-3 objects with label, value, and optional trend
  - `label`: What the number measures (2-4 words)
  - `value`: String representation including unit (e.g. "97%", "3.2x")
  - `trend`: Direction indicator — "up" (positive), "down" (negative improvement like latency), "neutral"
- Extract REAL numbers from narration (never fabricate)

**Example Extraction:**
```
Narration: "Our platform has achieved a 97% conversion rate, cut load times to 50ms, and maintains 99.9% uptime across all regions."

 CORRECT:
  dataPoints: [
    { label: "Conversion Rate", value: "97%", trend: "up" },
    { label: "Load Time", value: "50ms", trend: "down" },
    { label: "Uptime", value: "99.9%", trend: "up" }
  ],
  highlightIndex: 0

 WRONG:
  dataPoints: [
    { label: "Our platform has achieved great results", value: "Good" }
  ]
  // Not actual numbers, text instead of metrics
```

**When to Use:**
- Performance metrics
- Key statistics
- Growth numbers
- Benchmarks or comparisons

**When NOT to Use:**
- When numbers aren't the focus
- For text-heavy content
- When no real numbers exist in narration

---

## bento_compare
**Visual:** 2 large cells side by side (equal width) at the top of the grid. Below them: 1 accent-colored cell spanning full width with the verdict or conclusion. Each side cell has a label (bold, 18px) at top and description below. Side cells slide in from opposite edges. The verdict cell pops in last from below. The accent cell draws the eye to the conclusion.

**Best for:** Comparisons, A vs B, pros/cons, before/after, two approaches.

**Props:**
- `leftLabel` (string): label for option A (1-3 words)
- `rightLabel` (string): label for option B (1-3 words)
- `leftDescription` (string): 1–3 sentences for A
- `rightDescription` (string): 1–3 sentences for B
- `verdict` (string): the conclusion or winner, 1 sentence

**Content Requirements:**
- **leftLabel / rightLabel**: 1-3 words each (contrasting)
- **leftDescription / rightDescription**: 1-3 sentences each, roughly equal length
- **verdict**: 1 clear sentence summarizing the comparison outcome

**Example Extraction:**
```
Narration: "Traditional CMS platforms require manual updates and are prone to security vulnerabilities. Headless CMS solutions offer API-first content delivery with automatic scaling. The clear winner for modern teams is the headless approach."

 CORRECT:
  leftLabel: "Traditional CMS",
  rightLabel: "Headless CMS",
  leftDescription: "Requires manual updates and is prone to security vulnerabilities",
  rightDescription: "API-first content delivery with automatic scaling",
  verdict: "The clear winner for modern teams is the headless approach"

 WRONG:
  leftLabel: "Traditional CMS platforms that require manual updates",
  // Label too long, should be 1-3 words
```

**When to Use:**
- Before/after scenarios
- Technology comparisons
- Pros and cons
- Decision analysis

**When NOT to Use:**
- For non-contrasting content
- When you have 3+ items (use bento_features)
- For single concepts

---

## bento_code
**Visual:** A grid with one large cell (2×1) with a dark background containing syntax-highlighted code (monospace font). One small cell to the right with a language/framework badge (e.g. "Python", "React") in the accent color. Another small cell below the badge with a short description of what the code does. The dark code cell contrasts sharply with the surrounding white cells.

**Best for:** Code examples, terminal commands, API snippets — when code needs context alongside it.

**Props:**
- `codeLines` (string[]): actual code, 3–8 lines
- `codeLanguage` (string): language identifier (e.g. "python", "javascript", "bash")
- `description` (string): short explanation of the code, 1–2 sentences

**Content Requirements:**
- **codeLines**: 3-8 lines of ACTUAL code (not pseudocode)
  - Preserve exact spacing/indentation
  - One line = one array item
- **codeLanguage**: Lowercase language name
- **description**: 1-2 sentence explanation of what the code does

**Example Extraction:**
```
Narration: "Getting started is simple. Install the SDK with npm, then initialize it with your API key to start making requests."

 CORRECT:
  codeLines: [
    "npm install @platform/sdk",
    "",
    "import { Client } from '@platform/sdk';",
    "",
    "const client = new Client({",
    "  apiKey: process.env.API_KEY",
    "});",
    "",
    "const result = await client.generate();"
  ],
  codeLanguage: "javascript",
  description: "Install the SDK and initialize with your API key to start making requests"

 WRONG:
  codeLines: ["Install the SDK and use your API key"]
  // Not actual code, it's a description
```

**When to Use:**
- Showing actual code snippets
- Terminal/CLI commands
- API usage examples
- Configuration examples

**When NOT to Use:**
- For pseudocode or descriptions
- When code isn't mentioned in narration
- For very long code (>8 lines)

---

## pull_quote
**Visual:** NOT a grid — full-width, centered. Oversized decorative quotation marks (accent colored, 100–120px) at top-left. The quote text is centered, 28–36px, in a semi-bold font for editorial feel. Below the quote: a small attribution or topic label (14px, muted). The quote text fades in word by word (each word delayed by 2 frames). The key phrase within the quote gets the accent color.

**Best for:** Key insights, memorable statements, definitions, "pull quote" moments. Maximum 2 per video.

**Props:**
- `quote` (string): the statement, 1–2 sentences
- `attribution` (string): source, topic, or speaker label
- `highlightPhrase` (string, optional): phrase within the quote to accent-color

**Content Requirements:**
- **quote**: 1-2 impactful sentences (10-30 words)
- **attribution**: Source or topic label (1-4 words)
- **highlightPhrase**: Key phrase from the quote to highlight (must appear in quote exactly)

**Example Extraction:**
```
Narration: "As the CEO noted, 'The future of content is automated.' This philosophy drives everything we build."

 CORRECT:
  quote: "The future of content is automated",
  attribution: "CEO",
  highlightPhrase: "automated"

 WRONG:
  quote: "As the CEO noted, the future of content is automated. This philosophy drives everything we build."
  // Too long, includes framing text, not just the quote
```

**When to Use:**
- Key insights or "aha" moments
- Memorable one-liners
- Expert quotes
- Maximum 2 per video

**When NOT to Use:**
- For explanations
- For multiple points
- More than twice per video

---

## bento_steps
**Visual:** Numbered cells arranged in a staircase or zigzag grid pattern. Cell 1 at top-left, cell 2 at center, cell 3 at top-right (spatial arrangement depending on count). Each cell has: a large bold step number (36px, accent color), a label below (16px, bold), and an optional one-line description (13px). Thin connecting lines or arrows between cells. Cells illuminate sequentially — each cell starts faded, then activates in order.

**Best for:** Step-by-step processes, workflows, implementation phases, ordered milestones.

**Props:**
- `steps`: array of objects, max 5 items
  - `label` (string): step name, 2–5 words
  - `description` (string, optional): one-liner explanation

**Content Requirements:**
- **steps**: 3-5 objects with label and optional description
  - `label`: 2-5 word step name
  - `description`: Optional 5-12 word explanation
- Steps should be sequential/ordered

**Example Extraction:**
```
Narration: "The process is simple: first, paste your blog URL. Then our AI analyzes the content and generates a script. Next, visual scenes are designed automatically. Finally, high-quality video is rendered and delivered."

 CORRECT:
  steps: [
    { label: "Paste Blog URL", description: "Enter the URL of your blog post" },
    { label: "AI Analysis", description: "Content is analyzed and script generated" },
    { label: "Scene Design", description: "Visual scenes created automatically" },
    { label: "Video Delivery", description: "High-quality video rendered and delivered" }
  ]

 WRONG:
  steps: [
    { label: "The first step is to paste your blog URL into the system" }
  ]
  // Only 1 step extracted, label is a sentence not a short name
```

**When to Use:**
- Step-by-step processes
- Workflows
- Implementation guides
- Getting started flows

**When NOT to Use:**
- For unordered items (use bento_features)
- For comparisons (use bento_compare)
- For single actions

---

# Scene Flow Rules

- **Scene 0:** ALWAYS `bento_hero` (non-negotiable)
- **Opening (scenes 1–2):** `editorial_body` or `bento_features` for setup
- **Middle (scenes 3–N-1):** Alternate between:
  - Grid layouts: `bento_features`, `bento_highlight`, `kpi_grid`, `bento_compare`, `bento_code`, `bento_steps`
  - Non-grid breaks: `editorial_body`, `pull_quote`
- **Closing (scene N):** `pull_quote`, `editorial_body`, or `kpi_grid` for strong finish

**Variety Requirements:**
- NEVER use same layout 2 times in a row
- A 7-scene video should use 5-7 DIFFERENT layouts
- A 10-scene video should use 7-9 DIFFERENT layouts
- Max usage limits:
  - `editorial_body`: Max 2 per video (it's the fallback)
  - `pull_quote`: Max 2 per video (loses impact if overused)

**Recommended Patterns:**
- Pattern A: `bento_hero` → `editorial_body` → `bento_features` → `kpi_grid` → `bento_compare` → `pull_quote` → `bento_steps`
- Pattern B: `bento_hero` → `bento_features` → `editorial_body` → `bento_code` → `kpi_grid` → `bento_highlight` → `pull_quote`
- Pattern C: `bento_hero` → `editorial_body` → `bento_highlight` → `bento_features` → `kpi_grid` → `bento_steps` → `pull_quote`

---

# Content Extraction Rules

## Critical Extraction Guidelines

1. **Extract REAL content from narration** — never fabricate or invent
2. **Use exact prop names** as specified in each layout (case-sensitive)
3. **Match layout to content type** — don't force editorial_body when kpi_grid fits better
4. **Preserve structure** — if narration lists 4 features, extract all 4
5. **Be concise** — titles short, items punchy, descriptions efficient

## Layout-Specific Extraction

### bento_features
- Extract ALL features/items mentioned (4-6)
- `icon`: Choose relevant emoji
- `label`: 2-4 word name
- `description`: 6-12 word one-liner
- `highlightIndex`: Most important feature (0-based)

### bento_highlight
- `mainPoint`: The primary statement (1-2 sentences)
- `supportingFacts`: Exactly 2 supporting details

### kpi_grid
- Extract REAL numbers from narration
- `value`: String with unit (e.g. "97%")
- `label`: What it measures (2-4 words)
- `trend`: "up", "down", or "neutral"

### bento_compare
- Extract contrasting sides
- `leftLabel` / `rightLabel`: 1-3 words each
- `leftDescription` / `rightDescription`: 1-3 sentences each
- `verdict`: 1 clear conclusion sentence

### bento_code
- Extract ACTUAL code (not descriptions)
- `codeLines`: 3-8 lines, preserve indentation
- `codeLanguage`: Lowercase identifier
- `description`: 1-2 sentence explanation

### pull_quote
- Extract the SINGLE most impactful statement
- `quote`: 10-30 words, 1-2 sentences
- `attribution`: Source or topic label
- `highlightPhrase`: Key phrase to accent

### bento_steps
- Extract sequential process steps
- `label`: 2-5 word step name
- `description`: Optional 5-12 word explanation
- 3-5 steps maximum

---

# Variety Rules

## Golden Rules
1. **NEVER repeat layouts consecutively**
2. **Prioritize variety** — use full layout catalog
3. **Balance grid layouts with non-grid breaks** — don't use 5 grids in a row
4. **Respect max usage limits**:
   - `editorial_body`: ≤ 2 per video
   - `pull_quote`: ≤ 2 per video

## Variety Scoring
A good video should have:
- **Variety score ≥ 0.6** (unique layouts / total scenes)
- **No consecutive repeats**
- **Balanced rhythm** (grid → non-grid → grid)

## Example Good vs Bad Variety

###  GOOD (7 scenes, 6 unique layouts, variety = 0.86)
```
1. bento_hero
2. editorial_body
3. bento_features
4. kpi_grid
5. bento_compare
6. pull_quote
7. bento_steps
```

###  BAD (7 scenes, 3 unique layouts, variety = 0.43)
```
1. bento_hero
2. editorial_body
3. editorial_body  ← Consecutive repeat
4. editorial_body  ← Third in a row
5. bento_features
6. editorial_body  ← Fourth (over limit)
7. editorial_body  ← Fifth
```

---

# Quality Checklist

Before finalizing layout selection, verify:

- [ ] Layout matches content type (numbers → kpi_grid, code → bento_code, features → bento_features)
- [ ] Props extracted from narration (not invented)
- [ ] Variety score will be ≥ 0.6
- [ ] No consecutive identical layouts
- [ ] Usage limits respected (editorial_body ≤2, pull_quote ≤2)
- [ ] Props use exact field names from layout catalog
- [ ] Text lengths appropriate (titles short, items concise)
- [ ] If images available, bento_highlight considered
- [ ] Grid vs non-grid rhythm is balanced
