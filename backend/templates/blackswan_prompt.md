# Design Philosophy

Blackswan is darkness made electric. The canvas is pure black (#000000) — absolute, total, unbroken. The only color that exists is blue neon: a cold electric spectrum from deep cobalt (#0040FF) through vivid cyan-blue (#00AAFF) to searing ice (#00E5FF). No whites, no grays, no other hues — just black and blue light. Every element is rendered as neon tubing, light strips, or glowing plasma edges. The template's mascot is a swan drawn entirely in blue neon strokes — elegant SVG paths that glow like a bent neon sign — which flies through the composition on every scene. Its wings sweep in from off-screen, arc gracefully through the frame, and disappear leaving a fading light trail.

The animations are cinematic and physical. Springs, not linears. Nothing is instant; everything illuminates — like a neon sign flicking on, buzzing, then holding steady at full glow. Text reveals letter-by-letter with a blue ignite effect (dim → full saturation with a brightness flare). Numbers glow as neon tube digits. Layout cards are not panels — they are light-frames: pure black interiors bordered by neon blue lines that draw themselves around the content.

**Visual Rules (apply to EVERY component):**
- **Background:** Pure black (#000000) on every scene. No gradients, no vignettes, no ambient glow on the background itself.
- **Blue neon palette:** Three tiers of blue light used purposefully:
  - **Arc blue** (#00E5FF) — brightest, used for primary headings, active borders, swan body
  - **Beam blue** (#00AAFF) — mid-range, used for body text, secondary elements, chart lines
  - **Deep blue** (#0040FF) — darkest neon, used for background glows, inactive states, shadow halos
- **Glow model:** All glowing elements use layered CSS `filter: drop-shadow` or `box-shadow` in two rings: a tight bright ring (0 0 4px #00E5FF) and a wide soft bloom (0 0 20px #00AAFF, 0 0 60px #0040FF33). Never a single shadow — always the bloom pair.
- **Text rendering:** Monospace (JetBrains Mono or Fira Code) for data/code; clean geometric sans-serif (Inter, weight 600–800) for titles and narrative. Text color is #00E5FF for titles, #00AAFF for body. No white text anywhere.
- **Borders and frames:** 1px solid neon blue lines that animate using SVG `stroke-dashoffset` — the border draws itself clockwise around a card over 15–20 frames.
- **The Swan:** Present on every scene. An SVG silhouette of a swan in flight (outstretched wings, long neck extended forward). All strokes are #00E5FF at 2px with full glow bloom. It enters from the left, arcs across the upper third of the frame, and exits right — a 40-60 frame animation using `interpolate` with spring easing. On `swan_title`, it expands to fill the frame dramatically before condensing into the header. Wing flap is a subtle sinusoidal rotation on the wing paths (±12° alternating every 8 frames).
- **Transitions:** Content fades in with a blue ignite pulse — opacity 0 → 1 over 10 frames combined with a `brightness(0.2) → brightness(1.4) → brightness(1.0)` flare that peaks at frame 6. Stagger child elements by 6–8 frames.
- **No rectangles with fill.** Cards have transparent interiors. All depth comes from glowing borders and neon text, not filled shapes.

---

# Layout Catalog

## swan_title
**Visual:** The swan enters from the left at large scale — wing span nearly 60% of frame width — its neon outline buzzing to life as it sweeps through. As it crosses center, the title text ignites letter-by-letter below its flight path (each letter fires in the direction the swan traveled). The swan shrinks and exits top-right, leaving a fading arc trail (SVG path with decreasing opacity). Subtitle appears after swan exits, fading in word by word. A thin horizontal neon line pulses under the title like an underline slowly charging.

**Best for:** Always scene 0. The opening hero moment.

**Props:**
- (none — uses scene `title` and `narration` directly)

**Content Requirements:**
- `title`: Main headline (2-6 words) — ignited letter by letter
- `narration`: Optional subtitle (5-15 words) — fades in after title

**Example Extraction:**
```
Narration: "Why AI is replacing traditional content workflows in 2025"

 CORRECT:
  title: "The Signal Shift"
  (narration used as subtitle automatically)

 WRONG:
  title: "Why AI is replacing traditional content workflows in 2025"
  (too long — letter ignite animation will drag)
```

**When to Use:**
- Scene 0 ONLY

**When NOT to Use:**
- Any scene after scene 0

---

## neon_narrative
**Visual:** A single light-frame card — black interior, neon blue border that draws itself clockwise from the top-left corner over 18 frames. Inside: title (32–44px, arc blue, weight 700) ignites top-to-bottom. Body paragraph (20–24px, beam blue, weight 400) fades in below with comfortable line height. A thin neon line separator sits between title and body. The swan does a small pass in the background at 10% opacity — barely visible, a ghosted silhouette suggesting presence. Subtle neon flicker on the border at random intervals (opacity 0.85 → 1.0 → 0.85, 2-frame blip, like real neon).

**Best for:** Main explanations, narrative body, general content. Baseline layout — max 2 per video.

**Props:**
- (none — uses scene `title` and `narration` directly)

**Content Requirements:**
- `title`: Section heading (3-8 words)
- `narration`: Body text (20-100 words), 1-3 sentences

**Example Extraction:**
```
Narration: "Content repurposing is no longer optional for brands that want to stay visible across platforms. The brands winning in 2025 treat every blog post as a content multiplier."

 CORRECT:
  title: "The Repurposing Imperative"
  narration: "Content repurposing is no longer optional for brands that want to stay visible across platforms. The brands winning in 2025 treat every blog post as a content multiplier."

 WRONG:
  title: "Content repurposing is no longer optional for brands"
  (too long, will wrap awkwardly in neon frame)
```

**When to Use:**
- Explaining concepts
- Setting context
- Background/introductory information
- Max 2 per video

**When NOT to Use:**
- When numbers are the focus (use pulse_metric)
- When showing code (use reactor_code)
- For dramatic one-liners (use dive_insight)

---

## pulse_metric
**Visual:** 1–3 large neon tube numerals dominate the screen (80–120px). Each digit is rendered as a neon sign — thick stroke paths in arc blue with maximum bloom glow. Numbers count up from zero through a "charge" sequence: digits cycle scrambled (flashing random digits at 4fps) before locking to the real value with a brightness flare. A circular neon ring (deep blue) rotates slowly behind the primary metric. Label text sits below each metric (18px, beam blue). If 3 metrics, they sit in a horizontal row with vertical neon dividers between them. The swan passes through the background at a diagonal, wing tips occasionally grazing the light of a numeral (opacity interaction — the swan path brightens as it overlaps digits).

**Best for:** Statistics, KPIs, performance numbers — any scene where 1–3 numbers are the main point.

**Props:**
- `metrics`: array of objects, max 3 items
  - `value` (string): the number as string ("97", "10000", "3.2")
  - `label` (string): what it measures (2-4 words)
  - `suffix` (string, optional): unit ("%", "x", "+", "ms", "k")

**Prop Structure:**
```typescript
{
  metrics: [
    { value: "94", label: "Publish Rate", suffix: "%" },
    { value: "3.2", label: "Engagement Lift", suffix: "x" },
    { value: "8", label: "Hours Saved", suffix: "/wk" }
  ]
}
```

**Content Requirements:**
- **value**: Pure number string — not mixed text ("94" not "94%")
- **label**: 2-4 word description
- **suffix**: Unit appended after the number
- Extract REAL numbers from narration only — never fabricate

**Example Extraction:**
```
Narration: "Teams using our platform save 8 hours per week on average and see a 3.2x lift in social engagement."

 CORRECT:
  metrics: [
    { value: "8", label: "Hours Saved", suffix: "/wk" },
    { value: "3.2", label: "Engagement Lift", suffix: "x" }
  ]

 WRONG:
  metrics: [{ value: "8 hours per week on average", label: "Time" }]
  (mixed text in value field)
```

**When to Use:**
- Performance benchmarks
- Growth statistics
- Key numbers or percentages

**When NOT to Use:**
- When no real numbers exist in narration
- For text-heavy content

---

## wing_stack
**Visual:** 2–3 neon-framed cards arranged in a swept-wing formation — the top card slightly offset left, the bottom card offset right, creating a diagonal cascade like wing feathers layering over each other. Each card's border draws in sequentially (card 1 draws, then card 2, then card 3 — staggered by 10 frames). Inside each card: a bold neon label (20px, weight 700, arc blue) and a description line (16px, beam blue). Connecting neon lines join the cards along their offset edges, creating the "vane" of a feather. The swan passes over the stack on entry, as if landing briefly — its wings fold (pathLength decreasing to 0.6) then re-extend as it exits.

**Best for:** Feature lists, 2–3 related points, benefits, parallel steps.

**Props:**
- `items`: array of 2–3 objects
  - `label` (string): bold feature name, 2-4 words
  - `description` (string): supporting detail, 6-15 words

**Prop Structure:**
```typescript
{
  items: [
    { label: "Zero Setup", description: "Paste a URL. Video starts generating immediately." },
    { label: "Any Format", description: "Blog posts, PDFs, newsletters — all supported." },
    { label: "Full Control", description: "Edit scenes, swap templates, adjust pacing." }
  ]
}
```

**Content Requirements:**
- **items**: 2-3 objects, parallel structure preferred
- **label**: 2-4 words, punchy
- **description**: 6-15 words, one clear idea per item

**Example Extraction:**
```
Narration: "The platform handles everything automatically: content analysis, scene generation, and final rendering — all without manual intervention."

 CORRECT:
  items: [
    { label: "Content Analysis", description: "AI extracts key ideas from any written source." },
    { label: "Scene Generation", description: "Each idea becomes a timed visual scene." },
    { label: "Auto Rendering", description: "Final video exports without manual intervention." }
  ]

 WRONG:
  items: [{ label: "The platform handles everything automatically" }]
  (label too long, only 1 item extracted)
```

**When to Use:**
- Listing 2-3 features or benefits
- Parallel structure items

**When NOT to Use:**
- For 4+ items (use arc_features)
- For comparisons (use signal_split)

---

## signal_split
**Visual:** Two neon-bordered cards side by side, separated by a vertical blue plasma arc — a crackling, animated SVG path that oscillates ±3px horizontally at 12fps like a lightning discharge. Each card's border draws in from the divider outward (left card right-to-left, right card left-to-right) so the cards appear to be born from the arc. Left card label appears in deep blue; right card label appears in arc blue. The swan crosses directly through the plasma arc at the midpoint of the scene — its path cuts through the crackling line creating a brief disruption flash.

**Best for:** Comparisons, before/after, problem/solution, old vs new.

**Props:**
- `leftLabel` (string): left panel label (1-3 words)
- `rightLabel` (string): right panel label (1-3 words)
- `leftDescription` (string): left content (1-2 sentences)
- `rightDescription` (string): right content (1-2 sentences)

**Content Requirements:**
- **leftLabel / rightLabel**: 1-3 words, contrasting pair
- **leftDescription / rightDescription**: 1-2 sentences each, roughly equal length

**Example Extraction:**
```
Narration: "Manual video production takes days, requires editors, and costs thousands per piece. With Blog2Video, the same output takes minutes with zero headcount."

 CORRECT:
  leftLabel: "Manual",
  rightLabel: "Blog2Video",
  leftDescription: "Takes days, requires professional editors, costs thousands per piece.",
  rightDescription: "Same output in minutes. Zero headcount required."

 WRONG:
  leftLabel: "Manual video production takes days requires editors"
  (label is a sentence, not 1-3 words)
```

**When to Use:**
- Before/after demonstrations
- Problem vs solution
- Two contrasting approaches

**When NOT to Use:**
- For non-contrasting content
- For 3+ items (use wing_stack or arc_features)

---

## arc_features
**Visual:** A 2×2 or 2×3 grid of neon-bordered cells. Each cell's border draws in one at a time in reading order (staggered by 8 frames). Inside each cell: a neon-blue icon glyph at top-left (Unicode symbol rendered at 28px in arc blue), a bold label (15px, weight 700, arc blue), and a description (13px, beam blue). One cell — the most important — pulses at 0.8× → 1.0× breathing rhythm while others are static. The swan enters low and weaves between the cells horizontally at mid-frame before exiting, as if threading through a flock formation.

**Best for:** Feature grids, capability lists, benefit sets — 4-6 items.

**Props:**
- `features`: array of 4–6 objects
  - `icon` (string): single Unicode character, e.g. "◈", "⟁", "⬡", "↯"
  - `label` (string): 2-4 word feature name
  - `description` (string): 6-12 word one-liner
- `highlightIndex` (number, optional): which cell pulses. Default: 0.

**Prop Structure:**
```typescript
{
  features: [
    { icon: "◈", label: "Auto Scene AI", description: "Scenes generated from article structure automatically" },
    { icon: "↯", label: "Live Editing", description: "Modify any scene before final render" },
    { icon: "⬡", label: "Template Engine", description: "Switch visual styles without re-generating" },
    { icon: "⟁", label: "Batch Export", description: "Render multiple videos simultaneously" }
  ],
  highlightIndex: 0
}
```

**Content Requirements:**
- **features**: 4-6 items (not fewer — use wing_stack for <4)
- **icon**: Single Unicode character
- **label**: 2-4 words
- **description**: 6-12 word one-liner

**Example Extraction:**
```
Narration: "The platform offers four core capabilities: AI scene generation, real-time editing, multi-template support, and batch video rendering."

 CORRECT:
  features: [
    { icon: "◈", label: "AI Scene Gen", description: "Automatic scene creation from any written content" },
    { icon: "↯", label: "Real-time Editing", description: "Modify scenes live before final export" },
    { icon: "⬡", label: "Multi-Template", description: "Switch visual themes without regenerating content" },
    { icon: "⟁", label: "Batch Rendering", description: "Export multiple videos at the same time" }
  ],
  highlightIndex: 0

 WRONG:
  features: [{ icon: "◈", label: "The platform offers four core AI capabilities" }]
  (only 1 item, label too long)
```

**When to Use:**
- Listing 4-6 features or benefits

**When NOT to Use:**
- Fewer than 4 items (use wing_stack)
- Code (use reactor_code)
- Numeric stats (use pulse_metric)

---

## reactor_code
**Visual:** A single large neon-bordered card fills most of the frame. Header bar contains a neon blue terminal prompt glyph (`>_`) and the language badge. Code lines typewrite in one per frame from top to bottom — each character appears with a micro-flare (brightness spike for 1 frame). Line numbers in deep blue sit to the left. Syntax highlighting uses beam blue for keywords, arc blue for strings/values, deep blue for comments. A slow-blinking neon cursor sits at the end of the last typed line. The swan is faint in this scene — a ghosted 8% opacity silhouette drifting across the background, not distracting from the code.

**Best for:** Code snippets, CLI commands, API examples, configuration blocks.

**Props:**
- `codeLines` (string[]): 3–8 lines of actual code
- `codeLanguage` (string): lowercase language identifier

**Content Requirements:**
- **codeLines**: 3-8 actual code lines (not pseudocode), one string per line
- **codeLanguage**: Lowercase ("javascript", "python", "bash", "typescript", "json")

**Example Extraction:**
```
Narration: "To start, install the package and call the generate function with your article URL."

 CORRECT:
  codeLines: [
    "npm install blog2video",
    "",
    "import { generate } from 'blog2video';",
    "",
    "const video = await generate({",
    "  url: 'https://yourblog.com/post-slug',",
    "  template: 'blackswan'",
    "});"
  ],
  codeLanguage: "javascript"

 WRONG:
  codeLines: ["Install the package then call generate with the URL"]
  (not actual code, it's prose)
```

**When to Use:**
- Actual code snippets
- Installation commands
- API usage examples

**When NOT to Use:**
- Pseudocode or descriptions
- More than 8 lines

---

## dive_insight
**Visual:** NO card frame. Pure black. The swan dives from the top-center of the screen — starting small and distant, growing rapidly as it dives toward the viewer (scale 0.15 → 1.8 over 20 frames using spring with high stiffness). At peak scale (frame 20), it flashes to arc blue maximum brightness then dissolves — its path becomes the underline for the impact text. The quote text explodes word-by-word from the dive point outward (each word springs from center-frame with radial displacement). The key word receives a neon sign treatment — double-bordered in arc blue with the outer bloom at 100px radius. A ring of neon particles expands from center post-dive (8 particles, fading on a 30-frame arc).

**Best for:** Key insight, most impactful takeaway, mic-drop moment. Max 1–2 per video.

**Props:**
- `quote` (string, optional): the powerful line (uses narration if not provided)
- `highlightWord` (string, optional): one word from the quote to neon-sign treat

**Content Requirements:**
- **quote**: 5-15 words, one sentence, high impact
- **highlightWord**: Single word from quote (must appear verbatim)

**Example Extraction:**
```
Narration: "The brands that will survive the next decade are not creating more content — they are creating smarter content."

 CORRECT:
  quote: "Survival belongs to the brands creating smarter content",
  highlightWord: "smarter"

 WRONG:
  quote: "The brands that will survive the next decade are not creating more content — they are creating smarter content."
  (two clauses, too long, loses punch)
```

**When to Use:**
- The single most memorable line
- Pivotal reveal or climactic statement
- Maximum 1-2 per video

**When NOT to Use:**
- For explanatory content
- For multiple points
- More than twice per video

---

## flight_path
**Visual:** A glowing neon path animates across the screen — an SVG polyline in arc blue with bloom glow that draws from left to right over 30 frames, like a runway lighting up. Along the path, 3–5 waypoint nodes ignite (small neon circles, arc blue) at regular intervals. Each node connects to a small neon-bordered label box above or below (alternating). Step number glows inside the circle. Labels typewrite in as each node lights up. The swan follows the path exactly — flying along the drawn line with wings at cruise position — arriving at each node slightly before the label appears, as if delivering the information.

**Best for:** Step-by-step processes, workflows, ordered phases.

**Props:**
- `steps`: array of 3–5 objects
  - `label` (string): 2-5 word step name
  - `description` (string, optional): 5-12 word detail

**Content Requirements:**
- **steps**: 3-5 sequential items
- **label**: 2-5 word step name, verb-forward preferred
- **description**: Optional short supporting detail

**Example Extraction:**
```
Narration: "The workflow has four stages: paste your article URL, AI analyzes the structure, scenes are generated, and the final video is exported."

 CORRECT:
  steps: [
    { label: "Paste Article URL", description: "Works with any public blog URL" },
    { label: "AI Analysis", description: "Structure and key ideas extracted automatically" },
    { label: "Scene Generation", description: "Each idea mapped to a timed visual scene" },
    { label: "Video Export", description: "Final video ready in minutes" }
  ]

 WRONG:
  steps: [{ label: "The workflow has four stages starting with pasting your article URL" }]
  (only 1 step, label is a sentence)
```

**When to Use:**
- Step-by-step workflows
- Process breakdowns
- Getting started guides

**When NOT to Use:**
- Unordered features (use arc_features)
- Fewer than 3 steps

---

## frequency_chart
**Visual:** A neon data visualization card. Bar charts render as glowing vertical light columns — each bar is a gradient from deep blue at base to arc blue at peak, with a bloom glow that intensifies at the top. Line charts use arc blue curves with small neon-dot data points that pulse when they first appear. Chart axes are thin beam blue lines. Axis labels 11px beam blue. Title above in 20px arc blue. Bars animate upward from zero using spring physics (high stiffness, slight overshoot). The swan flies through the chart horizontally, passing behind the bars — visible through the spacing between columns.

**Best for:** Trends, analytics data — when a chart communicates better than raw numbers.

**Props:**
- `barChart`: `{ labels: string[], values: number[] }`
- `lineChart`: `{ labels: string[], datasets: Array<{ label: string, values: number[], color?: string }> }`
- Provide only ONE chart type per scene

**Prop Structure:**
```typescript
// Bar chart
{
  barChart: {
    labels: ["Q1", "Q2", "Q3", "Q4"],
    values: [42, 67, 58, 89]
  }
}

// Line chart
{
  lineChart: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May"],
    datasets: [
      { label: "Organic", values: [1200, 1450, 1380, 1700, 2100], color: "#00E5FF" },
      { label: "Paid", values: [800, 820, 790, 860, 900], color: "#00AAFF" }
    ]
  }
}
```

**Content Requirements:**
- 2-8 data points, real numbers from narration only — never fabricate

**Example Extraction:**
```
Narration: "Traffic grew quarter over quarter: 42K in Q1, 67K in Q2, 58K in Q3, and 89K in Q4."

 CORRECT:
  barChart: { labels: ["Q1", "Q2", "Q3", "Q4"], values: [42, 67, 58, 89] }

 WRONG:
  barChart: { labels: ["Q1", "Q2", "Q3", "Q4"], values: [100, 200, 300, 400] }
  (fabricated values)
```

**When to Use:**
- Multiple data points showing a trend or comparison
- When a chart communicates better than individual metrics

**When NOT to Use:**
- For 1-3 standalone numbers (use pulse_metric)
- When no chart-worthy data exists in narration

---

# Scene Flow Rules

- **Scene 0:** ALWAYS `swan_title` (non-negotiable)
- **Opening (scenes 1–2):** `neon_narrative` OR `arc_features` for setup
- **Middle (scenes 3–N-1):** Rotate between data layouts (`pulse_metric`, `frequency_chart`), list layouts (`wing_stack`, `arc_features`, `flight_path`), contrast (`signal_split`), code (`reactor_code`), impact (`dive_insight` max 2 total), narrative (`neon_narrative` max 2 total)
- **Closing (scene N):** `dive_insight`, `pulse_metric`, or `neon_narrative` for strong finish

**Variety Requirements:**
- NEVER use the same layout 2 times in a row
- A 7-scene video should use 5-7 DIFFERENT layouts
- A 10-scene video should use 7-9 DIFFERENT layouts
- Max usage limits: `neon_narrative` ≤ 2, `dive_insight` ≤ 2

**Recommended Patterns:**
- Pattern A: `swan_title` → `neon_narrative` → `arc_features` → `pulse_metric` → `signal_split` → `dive_insight` → `wing_stack`
- Pattern B: `swan_title` → `arc_features` → `neon_narrative` → `reactor_code` → `pulse_metric` → `flight_path` → `dive_insight`
- Pattern C: `swan_title` → `neon_narrative` → `pulse_metric` → `wing_stack` → `signal_split` → `frequency_chart` → `dive_insight`
- Pattern D: `swan_title` → `arc_features` → `signal_split` → `pulse_metric` → `flight_path` → `reactor_code` → `neon_narrative` → `dive_insight`

---

# Content Extraction Rules

1. **Extract REAL content from narration** — never fabricate
2. **Use exact prop names** as specified in each layout (case-sensitive)
3. **Match layout to content type** — numbers → `pulse_metric`, code → `reactor_code`, comparison → `signal_split`, steps → `flight_path`, 2-3 items → `wing_stack`, 4-6 items → `arc_features`
4. **Be concise** — titles ≤ 6 words, descriptions ≤ 15 words

### pulse_metric
- `value`: Number as string only ("94", "3.2" — not "94%"), `label`: 2-4 words, `suffix`: unit. Max 3 metrics.

### wing_stack
- `items`: 2-3 objects with `label` (2-4 words) and `description` (6-15 words). Parallel structure preferred.

### arc_features
- 4-6 objects: `icon` (single Unicode char), `label` (2-4 words), `description` (6-12 words), `highlightIndex` (0-based).

### signal_split
- `leftLabel` / `rightLabel`: 1-3 words each. `leftDescription` / `rightDescription`: 1-2 sentences each. Must present genuine contrast.

### flight_path
- `steps`: 3-5 objects with `label` (2-5 words) and optional `description` (5-12 words). Must be sequential content.

### reactor_code
- `codeLines`: 3-8 actual code strings. `codeLanguage`: lowercase.

### dive_insight
- `quote`: 5-15 word single sentence. `highlightWord`: one verbatim word from the quote.

### frequency_chart
- ONE chart type: `barChart` `{ labels, values }` or `lineChart` `{ labels, datasets }`. Real numbers only.

---

# Variety Rules

1. **NEVER repeat layouts consecutively**
2. **Use the full catalog** — don't default to `neon_narrative` when richer layouts fit
3. **Respect max usage limits**: `neon_narrative` ≤ 2, `dive_insight` ≤ 2

---

# Quality Checklist

- [ ] `swan_title` is scene 0
- [ ] Layout matches content type
- [ ] Props extracted from narration (not invented)
- [ ] Variety score ≥ 0.6
- [ ] No consecutive identical layouts
- [ ] Usage limits respected (`neon_narrative` ≤ 2, `dive_insight` ≤ 2)
- [ ] Exact prop field names used
- [ ] Text lengths appropriate (titles ≤ 6 words, descriptions ≤ 15 words)
- [ ] `frequency_chart` only used when real chart-worthy data exists
- [ ] `reactor_code` only used when actual code exists in narration
