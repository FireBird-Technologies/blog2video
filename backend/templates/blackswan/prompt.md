# Design Philosophy

BLACKSWAN is a neon-on-black cinematic explainer: pure black stage (`#000000`), neon cyan primary (`#00E5FF`), neon blue secondary (`#00AAFF`), deep blue undertone (`#0040FF`), white-core highlights (`#DFFFFF`). Content sits above elliptical “neon water” ripples and optional star-field specks; a line-art swan motif appears as atmosphere, not as a second headline. Copy is short, high-contrast, and rhythmic—think keynote clarity on a dark stage, not dense paragraphs.

Core rules:
- Favor one clear idea per scene: a title line, a supporting line, or structured data (lists, metrics, split, code, chart)—never all at once.
- Every layout must use only the prop names defined in this catalog; unknown keys are ignored downstream.
- **Do not** put `titleFontSize` or `descriptionFontSize` in `layout_props_json`. Those are UI defaults from `meta.json` and are not set by the scene generator.
- Do not invent statistics, code, or chart values that are not grounded in the source narration or scene brief; prefer paraphrase and omission over fabrication.

---

# Layout Catalog

## droplet_intro

**Visual:** Full-bleed black frame with subtle star specks, a wide neon water ripple band low on the stage, and a swan silhouette in the upper area. Small uppercase eyebrow “Droplet Intro”, large accent-colored title, body paragraph in white-core text, and a tiny monospace footer line (“BLACKSWAN • REMOTION THEME” feel).

**Best for:** The single cinematic cold open; the first impression of the video topic.

**Props:** Uses global `title` and `narration` only for content. No layout-specific keys.

**When to Use:** Scene 0 only; always the hero opener.

---

## swan_title

**Visual:** Brand-forward title card: neon water centred under the swan, eyebrow “Swan Title”, very large title, optional subtitle line from `narration`. Swan and rings read as the identity anchor.

**Best for:** Reinforcing the topic or chapter title immediately after the intro; “title card” beats.

**Props:** Uses global `title` and `narration` only for content. No layout-specific keys.

**When to Use:** Prefer scene 1 for most videos; any early scene that needs a strong title-only moment.

---

## neon_narrative

**Visual:** Two-column layout: left column has eyebrow “Neon Narrative”, large title, and a frosted neon-panel card with body copy; right column centres the swan. Water ripples sit left-biased behind the text.

**Best for:** Main narrative beats: explanation, context, story paragraphs—one idea per scene.

**Props:** Uses global `title` and `narration` only for content. No layout-specific keys.

**When to Use:** Default workhorse for middle scenes when the content is prose, not lists or numbers.

---

## arc_features

**Visual:** Right-biased neon water; eyebrow “Arc Features”, headline, then a vertical stack of numbered neon panels (each line is one feature). Swan sits on the right as a visual accent.

**Best for:** Parallel feature lists, capability bullets, “what you get” enumerations.

**Props:** `items` — string array, **3–6** items. Each item should be a short clause (about **3–10 words**), parallel grammar.

**When to Use:** Whenever the narration enumerates distinct features, benefits, or pillars.

---

## pulse_metric

**Visual:** Centred water rings; eyebrow “Pulse Metric”, title, then **1–4** large metric tiles with big numbers, short labels, and optional suffixes (%, x, etc.).

**Best for:** KPIs, scores, percentages, multipliers, counts—anything numeric that should hit hard.

**Props:** `metrics` — array of objects, each exactly:
```json
{ "value": "97", "label": "Uptime", "suffix": "%" }
```
`value` is always a **string** (digits and optional decimal). `label` is short. `suffix` is optional (e.g. `%`, `x`, `ms`).

**When to Use:** Data-led beats; “by the numbers” moments. Prefer real numbers from the source.

---

## signal_split

**Visual:** **Two** separate water sources (left and right), two-column grid of neon panels. Each column has a large accent label line and a supporting description. Swan in the corner for balance.

**Best for:** Before/after, old vs new, problem vs solution, constraint vs outcome—true contrast.

**Props:** All four strings are required for structured output:
- `leftLabel` — short column title (e.g. “Before”, “Baseline”).
- `rightLabel` — short column title (e.g. “After”, “Target”).
- `leftDescription` — one or two sentences for the left column.
- `rightDescription` — one or two sentences for the right column.

**When to Use:** When the narration explicitly contrasts two states or sides.

---

## dive_insight

**Visual:** Tight water rings, eyebrow “Dive Insight”, optional small title, then a large quoted line (insight). Optional single-word highlight inside the quote.

**Best for:** Pull quotes, thesis statements, memorable one-liners.

**Props:**
- `quote` — **string**, one strong sentence (or two very short ones). This is the visible quote.
- `highlightWord` — optional **single word** that must appear **verbatim** inside `quote` (accent emphasis).

**When to Use:** Emotional or conceptual peaks; “the takeaway” in quote form.

---

## wing_stack

**Visual:** Far-left water band; eyebrow “Wing Stack”, title, stacked list of short neon lines (minimal list). Lighter than arc_features—more “talking points” than “feature grid”.

**Best for:** Tight stacks of points, principles, or reminders (3–6 lines).

**Props:** `items` — string array, **3–6** items. Each line **short** (≤ ~12 words).

**When to Use:** When you need a compact list without the “numbered feature” weight of `arc_features`.

---

## reactor_code

**Visual:** Terminal-like block: eyebrow “Reactor Code”, title, monospace code panel with a language label, 3–10 lines of code.

**Best for:** Snippets, API examples, config, pseudo-code that mirrors the article.

**Props:**
- `codeLanguage` — string (e.g. `typescript`, `python`, `bash`, `json`).
- `codeLines` — string array, **3–10** lines; each line is one logical row of code.

**When to Use:** Technical deep dives; when the source actually contains code or command-like content.

---

## flight_path

**Visual:** Workflow strip: eyebrow “Flight Path”, title, ordered sequence of short step labels (path). Nodes read left-to-right.

**Best for:** Pipelines, steps, user journeys, ordered processes.

**Props:** `phrases` — string array, **3–8** items, **strict order** (step 1 → step N). Each phrase **2–6 words** when possible.

**When to Use:** “How it works”, onboarding flows, or chronological procedure.

---

## frequency_chart

**Visual:** Wide low water rings; eyebrow “Frequency Chart”, title, horizontal bar chart built from categorical rows (labels + numeric values).

**Best for:** Comparisons across categories, periods, quarters, buckets—anything that fits bars.

**Props:** `barChartRows` — array of objects, each exactly:
```json
{ "label": "Q1", "value": "24" }
```
`value` must be a **numeric string** (digits only, or decimal with optional leading minus). **3–7** rows typical.

**When to Use:** When the narration implies comparable magnitudes across named categories.

---

# Scene Flow Rules

- Scene **0** must use **`droplet_intro`** (hero).
- Scene **1** should usually be **`swan_title`** to lock the topic or brand beat.
- **Middle:** alternate **`neon_narrative`** (prose) with structured layouts (`arc_features`, `wing_stack`, `flight_path`, `pulse_metric`, `frequency_chart`, `signal_split`, `dive_insight`, `reactor_code`) as the content demands.
- **Closing:** prefer a strong non-generic beat—`dive_insight` (quote), `pulse_metric` or `frequency_chart` (numbers), or `neon_narrative` (summary)—not another `droplet_intro`.
- For **6+** total scenes, include **at least one** data-forward layout: **`pulse_metric`** or **`frequency_chart`** (unless the source material has no numbers at all).
- Balance **structure** (lists, path, code) with **breathing room** (`neon_narrative`, `dive_insight`).

---

# Content Extraction Rules

**Global fields (every scene):**
- `title`: **3–10 words** when possible—scene headline, not the full article title unless this scene is purely titling.
- `narration`: **about 12–20 words** per scene for voiceover; slightly longer only when the layout is prose-first (`neon_narrative`). Keep sentences speakable in one breath.

**Per layout (structured props):**
- **`arc_features` / `wing_stack`:** Split enumeration from the narration into parallel bullets; avoid duplicating the full `narration` sentence inside every item.
- **`pulse_metric`:** Pull numbers and units from the text; map each to `value` + `suffix` + human `label`. If the source gives fewer than three metrics, output only what is justified.
- **`signal_split`:** Extract two **contrasting** labels and two descriptions; left/right must disagree in meaning (not two ways to say the same thing).
- **`dive_insight`:** `quote` must be a tight extract or paraphrase of the thesis; `highlightWord` must be a substring of `quote`.
- **`reactor_code`:** Lines should reflect the **meaning** of the source (API names, flags, types) even if abbreviated; do not paste long unrelated files.
- **`flight_path`:** Preserve the **order** of steps in the narration; one phrase per step.
- **`frequency_chart`:** Labels are category names (time ranges, segments, options); values must match stated or clearly implied quantities in the source.

**Grounding:** If the source does not support a layout (e.g. no numbers for metrics), choose a different layout or keep `narration` factual without inventing figures.

---

# Variety Rules

- Do **not** repeat the **same** layout more than **3** consecutive scenes.
- Do **not** use **`droplet_intro`** after scene 0.
- **Limit** `swan_title` to early scenes (typically scene 1); avoid stacking multiple title-only layouts back-to-back.
- Across the **whole** video, prefer **at least 4 distinct** layout IDs when `total_scenes` ≥ 6.
- **`neon_narrative`** is the default fallback for prose; **do not** let it dominate more than 50% of scenes in long videos—interleave structured layouts.
- End with a **memorable** layout when possible (`dive_insight`, `pulse_metric`, `frequency_chart`, or a strong `neon_narrative`), not a redundant `swan_title`.
