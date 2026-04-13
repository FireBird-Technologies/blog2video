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

## ending_socials

**Visual:** DropletIntro-style cinematic frame (star field, swan silhouette, animated droplet fall, NeonWater ripple band). Instead of a title, a neon pill-shaped CTA button is centred on stage. Below the button: an optional website URL in muted accent text, a neon divider line, the narration paragraph in body text, and a row of social-platform icons at the bottom.

**Best for:** Final outro scenes that convert — “follow us”, “try it free”, “visit the site”. Always the last scene when the video has CTA or social data.

**Props:**
- `ctaButtonText` — **string**, short imperative phrase shown inside the neon pill button (e.g. `”Get Started”`, `”Try Free”`, `”Learn More”`, `”Subscribe Now”`). Keep it under **4 words**.
- `websiteLink` — **string**, the URL or domain to display beneath the button (e.g. `”www.example.com”`). If empty or absent, the URL line is hidden.
- `showWebsiteButton` — **boolean**, set `false` to hide both the CTA button and the URL entirely. Defaults to `true`.
- `socials` — **object**, key-value map of social platform names to their handles or URLs. Supported keys (use exactly): `instagram`, `twitter`, `linkedin`, `youtube`, `facebook`, `tiktok`, `github`, `website`. Example:
  ```json
  {
    “instagram”: “@mybrand”,
    “linkedin”: “linkedin.com/company/mybrand”,
    “youtube”: “youtube.com/@mybrand”
  }
  ```
  Omit platforms that were not mentioned in the source. If no social data is available, omit `socials` entirely.
- `narration` (global) — shown as the body paragraph below the divider. Write it as a warm closing line (e.g. “Follow us for weekly insights on AI, design, and growth.”).
- `title` (global) — not displayed visually in this layout; still required by the schema but its value is ignored in the render. Set it to a short internal label like `”Closing”` or leave it as the video brand name.

**When to Use:** Always the **last scene** of a video when CTA or social data exists. Do not use this layout mid-video.

---

# Scene Flow Rules

- Scene **0** must use **`droplet_intro`** (hero).
- **Middle:** alternate **`neon_narrative`** (prose) with structured layouts (`arc_features`, `flight_path`, `pulse_metric`, `signal_split`, `dive_insight`, `reactor_code`) as the content demands.
- **Closing:** use **`ending_socials`** as the final scene when CTA or social data is available; otherwise close with `dive_insight` (quote), `pulse_metric`, or a strong `neon_narrative`.
- For **6+** total scenes, include **at least one** data-forward layout: **`pulse_metric`** (unless the source material has no numbers at all).
- Balance **structure** (lists, path, code) with **breathing room** (`neon_narrative`, `dive_insight`).

---

# Content Extraction Rules

**Global fields (every scene):**
- `title`: **3–10 words** when possible—scene headline, not the full article title unless this scene is purely titling.
- `narration`: **about 12–20 words** per scene for voiceover; slightly longer only when the layout is prose-first (`neon_narrative`). Keep sentences speakable in one breath.

**Per layout (structured props):**
- **`arc_features`:** Split enumeration from the narration into parallel bullets; avoid duplicating the full `narration` sentence inside every item.
- **`pulse_metric`:** Pull numbers and units from the text; map each to `value` + `suffix` + human `label`. If the source gives fewer than three metrics, output only what is justified.
- **`signal_split`:** Extract two **contrasting** labels and two descriptions; left/right must disagree in meaning (not two ways to say the same thing).
- **`dive_insight`:** `quote` must be a tight extract or paraphrase of the thesis; `highlightWord` must be a substring of `quote`.
- **`reactor_code`:** Lines should reflect the **meaning** of the source (API names, flags, types) even if abbreviated; do not paste long unrelated files.
- **`flight_path`:** Preserve the **order** of steps in the narration; one phrase per step.
- **`ending_socials`:** `ctaButtonText` must be an imperative verb phrase (≤4 words). `socials` keys must use only the supported platform names listed in the layout catalog. `narration` should be a warm closing sentence, not a content summary.

**Grounding:** If the source does not support a layout (e.g. no numbers for metrics), choose a different layout or keep `narration` factual without inventing figures.

---

# Variety Rules

- Do **not** repeat the **same** layout more than **3** consecutive scenes.
- Do **not** use **`droplet_intro`** after scene 0.
- **Limit** `swan_title` to early scenes (typically scene 1); avoid stacking multiple title-only layouts back-to-back.
- Across the **whole** video, prefer **at least 4 distinct** layout IDs when `total_scenes` ≥ 6.
- **`neon_narrative`** is the default fallback for prose; **do not** let it dominate more than 50% of scenes in long videos—interleave structured layouts.
- End with a **memorable** layout when possible (`ending_socials`, `dive_insight`, `pulse_metric`, or a strong `neon_narrative`).
