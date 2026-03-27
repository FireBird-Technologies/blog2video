"""
Custom Prompt Builder — Generates prompt.md and meta.json equivalents
for custom templates using the universal layout engine.
"""

from typing import Any


# Valid arrangements for the universal layout engine
CUSTOM_ARRANGEMENTS = [
    "full-center",
    "split-left",
    "split-right",
    "top-bottom",
    "grid-2x2",
    "grid-3",
    "asymmetric-left",
    "asymmetric-right",
    "stacked",
]

HERO_ARRANGEMENT = "full-center"
FALLBACK_ARRANGEMENT = "top-bottom"

# Mapping: theme layout direction → preferred arrangements
_DIRECTION_TO_ARRANGEMENTS = {
    "centered": ["full-center", "top-bottom", "stacked", "grid-2x2"],
    "left-aligned": ["split-left", "asymmetric-left", "top-bottom", "stacked"],
    "asymmetric": ["asymmetric-left", "asymmetric-right", "split-left", "split-right"],
}


def build_custom_prompt(theme: dict, name: str) -> str:
    """
    Generate a prompt.md equivalent for a custom template.
    Describes the universal layout config schema, element types, and
    visual rules parameterized by the theme's style, colors, fonts,
    patterns, and category.
    """
    colors = theme.get("colors", {})
    fonts = theme.get("fonts", {})
    style = theme.get("style", "minimal")
    animation = theme.get("animationPreset", "fade")
    category = theme.get("category", "blog")
    radius = theme.get("borderRadius", 12)
    patterns = theme.get("patterns", {})

    # Pattern values with defaults
    cards = patterns.get("cards", {})
    spacing = patterns.get("spacing", {})
    images = patterns.get("images", {})
    layout_pat = patterns.get("layout", {})

    card_corners = cards.get("corners", "rounded")
    shadow_depth = cards.get("shadowDepth", "subtle")
    border_style = cards.get("borderStyle", "thin")
    density = spacing.get("density", "balanced")
    grid_gap = spacing.get("gridGap", 20)
    img_treatment = images.get("treatment", "rounded")
    img_overlay = images.get("overlay", "none")
    caption_style = images.get("captionStyle", "below")
    layout_dir = layout_pat.get("direction", "centered")
    decorative = layout_pat.get("decorativeElements", ["none"])

    style_desc = f'A "{style}" visual style — interpret this aesthetic and apply it consistently across all scenes.'
    anim_desc = f'A "{animation}" animation approach — interpret this motion energy and timing.'
    density_desc = f'A "{density}" spacing density — interpret this layout density for padding and gaps.'

    decorative_str = ", ".join(decorative) if decorative else "none"
    preferred_arrangements = _DIRECTION_TO_ARRANGEMENTS.get(layout_dir, CUSTOM_ARRANGEMENTS[:4])
    preferred_str = ", ".join(preferred_arrangements)

    return f"""# Design Philosophy

"{name}" is a custom template with a **{style}** visual style optimized for **{category}** content.

**Color Palette:**
- Accent: {colors.get('accent', '#7C3AED')} (buttons, highlights, key elements)
- Background: {colors.get('bg', '#FFFFFF')} (main canvas)
- Text: {colors.get('text', '#1A1A2E')} (primary text)
- Surface: {colors.get('surface', '#F5F5F5')} (cards, panels, secondary backgrounds)
- Muted: {colors.get('muted', '#9CA3AF')} (subtle text, disabled states)

**Typography:**
- Headings: {fonts.get('heading', 'Poppins')} (bold, 600-800 weight)
- Body: {fonts.get('body', 'Inter')} (regular, 400 weight)
- Monospace: {fonts.get('mono', 'JetBrains Mono')} (code blocks, terminal text)

**Visual Style:** {style_desc}
**Border Radius:** {radius}px on all containers, cards, and panels.
**Animation:** {anim_desc}

**Visual Patterns (from source website):**
- Card Style: {card_corners} corners, {shadow_depth} shadows, {border_style} borders
- Spacing: {density_desc} ({grid_gap}px grid gaps)
- Image Treatment: {img_treatment} images with {img_overlay} overlay, captions {caption_style}
- Layout Direction: {layout_dir} alignment → prefer arrangements: {preferred_str}
- Decorative Elements: {decorative_str}

---

# Universal Layout Config Schema

Each scene is defined as a JSON object with this structure:

```json
{{
  "arrangement": "<arrangement_id>",
  "elements": [
    {{
      "type": "<element_type>",
      "content": {{ ... }},
      "size": "small|medium|large|full",
      "emphasis": "primary|secondary|subtle"
    }}
  ],
  "background": {{
    "type": "solid|gradient|image",
    "imageUrl": "<optional>",
    "gradientAngle": <optional number>
  }},
  "decorations": ["<decoration_id>", ...]
}}
```

---

## Arrangements (9 options)

Choose arrangements that match the template's layout direction ({layout_dir}).
**Preferred for this template:** {preferred_str}

| ID | Structure | Best For |
|----|-----------|----------|
| `full-center` | Centered column, max-width 70% | Hero scenes, statements, single-focus content |
| `split-left` | 55%/45% grid, content left, visual right | Feature + image, explanation + code |
| `split-right` | 45%/55% grid, visual left, content right | Image-first, demo + explanation |
| `top-bottom` | Stacked: title top 30%, content bottom 70% | Lists, cards, general content |
| `grid-2x2` | 2×2 equal grid cells | 4 items, comparisons, feature grids |
| `grid-3` | 3-column grid | 3 items, triple features |
| `asymmetric-left` | 60%/35% with offset, content-heavy left | Detailed explanation + sidebar |
| `asymmetric-right` | 35%/60% with offset, content-heavy right | Visual sidebar + main content |
| `stacked` | Full-width stacked sections | Sequential info, timelines, steps |

---

## Element Types (10 options)

| Type | Content Props | Usage |
|------|--------------|-------|
| `heading` | `text` | Scene title, large display text |
| `body-text` | `text` | Paragraph text, descriptions, narration |
| `card-grid` | `items[]` (text, icon?, description?, imageUrl?) | Feature lists, benefits, key points |
| `code-block` | `codeLines[]`, `codeLanguage?` | Code examples, terminal commands |
| `metric-row` | `items[]` (value, label/text) | Statistics, KPIs, numbers |
| `image` | `imageUrl`, `caption?` | Photos, screenshots, diagrams |
| `quote` | `quote`, `author?`, `highlightPhrase?` | Testimonials, key statements |
| `timeline` | `items[]` (label/text, description?) | Chronological events, milestones |
| `steps` | `items[]` (text, description?) | Processes, how-to, numbered sequences |
| `comparison` | `items[]` (label, description) — exactly 2 items | Before/after, pros/cons, old way/new way |
| `icon-text` | `items[]` (text, icon) | Simple lists with emoji icons |

---

## Decorations

Choose decorations that match the template's decorative elements ({decorative_str}).

| ID | Visual |
|----|--------|
| `accent-bar-top` | Horizontal accent bar at top edge |
| `accent-bar-left` | Vertical accent bar on left edge |
| `accent-bar-bottom` | Horizontal accent bar at bottom edge |
| `corner-accent` | Accent corner bracket at top-right |
| `gradient-orb` | Large gradient circle in background |
| `dot-grid` | Dot grid pattern in corner |
| `diagonal-lines` | Subtle diagonal accent lines |
| `none` | No decorations |

**Mapping from template decorative elements:**
- "gradients" → use `gradient-orb`
- "accent-lines" → use `diagonal-lines` + `accent-bar-top` or `accent-bar-left`
- "background-shapes" → use `corner-accent`
- "dots" → use `dot-grid`
- "none" → use `none` or at most `accent-bar-bottom`

---

## Background Options

- `"solid"`: Default, uses theme bg color
- `"gradient"`: Gradient using theme bg + surface colors. Set `gradientAngle` (0-360).
- `"image"`: Use scene image as background. Set `imageUrl`. The renderer applies image overlay from theme patterns ({img_overlay}).

---

# Scene Construction Rules

1. **Scene 0 = Hero**: Use `full-center` arrangement with `heading` (emphasis: primary) + optional `body-text` (emphasis: subtle). If image available, use `background.type: "image"`. Add decorations matching template style.

2. **Content-heavy scenes**: Use `top-bottom`, `split-left`, or `stacked`. Include `heading` + `card-grid` or `icon-text` for lists.

3. **Code/technical scenes**: Use `split-left` (code left, explanation right) or `stacked` (heading + code-block). Always include `code-block` element.

4. **Data/metrics scenes**: Use `grid-2x2`, `grid-3`, or `top-bottom`. Include `heading` + `metric-row`.

5. **Image-focused scenes**: Use `split-right` (image right, text left) or `full-center` with `background.type: "image"`. Include `image` element.

6. **Quote/statement scenes**: Use `full-center` or `asymmetric-left`. Include `quote` element with emphasis: primary.

7. **Timeline/process scenes**: Use `stacked` or `top-bottom`. Include `heading` + `timeline` or `steps` element.

8. **VARIETY**: Avoid repeating the same arrangement in consecutive scenes. Use the full range of arrangements.

9. **EXTRACT EVERYTHING**: Extract ALL mentioned items from narration — if narration lists 5 features, include all 5 in `items[]`.

10. **DON'T INVENT**: Only extract content from the narration. Never make up text, numbers, or items.

---

# Example Configs

## Hero scene (scene 0):
```json
{{
  "arrangement": "full-center",
  "elements": [
    {{"type": "heading", "content": {{"text": "Building the Future"}}, "emphasis": "primary"}},
    {{"type": "body-text", "content": {{"text": "A journey through modern architecture"}}, "emphasis": "subtle"}}
  ],
  "background": {{"type": "gradient", "gradientAngle": 135}},
  "decorations": ["gradient-orb", "accent-bar-bottom"]
}}
```

## Feature list scene:
```json
{{
  "arrangement": "split-left",
  "elements": [
    {{"type": "heading", "content": {{"text": "Key Features"}}}},
    {{"type": "card-grid", "content": {{"items": [
      {{"text": "AI-powered generation", "icon": "🤖"}},
      {{"text": "Real-time collaboration", "icon": "👥"}},
      {{"text": "Cloud deployment", "icon": "☁️"}}
    ]}}}}
  ],
  "decorations": ["accent-bar-left"]
}}
```

## Metrics scene:
```json
{{
  "arrangement": "grid-3",
  "elements": [
    {{"type": "heading", "content": {{"text": "Impact"}}, "size": "full"}},
    {{"type": "metric-row", "content": {{"items": [
      {{"value": "50K+", "label": "Users"}},
      {{"value": "99.9%", "label": "Uptime"}},
      {{"value": "4.8★", "label": "Rating"}}
    ]}}}}
  ],
  "decorations": ["corner-accent"]
}}
```

## Code scene:
```json
{{
  "arrangement": "split-left",
  "elements": [
    {{"type": "code-block", "content": {{"codeLines": ["npm install my-lib", "import {{ init }} from 'my-lib'", "init()"], "codeLanguage": "bash"}}}},
    {{"type": "body-text", "content": {{"text": "Getting started is easy — just three lines of code."}}}}
  ],
  "decorations": ["accent-bar-top"]
}}
```
"""


def build_custom_meta(
    theme: dict,
    name: str,
    supported_video_style: str = "explainer",
    content_codes_count: int = 0,
) -> dict[str, Any]:
    """
    Generate a meta.json equivalent for a custom template.
    Returns the same shape as filesystem-based meta.json files.
    All custom templates use the GeneratedVideo composition.

    When content_codes_count > 0 (AI-generated code exists), valid_layouts
    exposes variant IDs (intro, content_0, ..., outro) instead of arrangement
    IDs so the layout picker shows scene-type variants.

    NOTE: build_custom_prompt() above is still used by the DSPy scene generation
    pipeline for narration/visual hints. This meta dict is for pipeline routing
    (composition selection, layout dropdown in SceneEditModal).
    """
    colors = theme.get("colors", {})

    style = (supported_video_style or "explainer").strip().lower()
    if style not in {"explainer", "promotional", "storytelling"}:
        style = "explainer"

    # When generated code exists, expose variant-based layouts instead of arrangements
    if content_codes_count > 0:
        variant_layouts = ["intro"]
        layout_names = {"intro": "Intro Scene"}
        for i in range(content_codes_count):
            key = f"content_{i}"
            variant_layouts.append(key)
            layout_names[key] = f"Content Style {i + 1}"
        variant_layouts.append("outro")
        layout_names["outro"] = "Outro Scene"

        valid_layouts = variant_layouts
        no_image_layouts: list[str] = []
    else:
        valid_layouts = list(CUSTOM_ARRANGEMENTS)
        layout_names = {}
        no_image_layouts = ["full-center", "stacked"]

    meta: dict[str, Any] = {
        "id": "custom",
        "name": name,
        "description": f"Custom template: {name}",
        "styles": [style],
        "preview_colors": {
            "accent": colors.get("accent", "#7C3AED"),
            "bg": colors.get("bg", "#FFFFFF"),
            "text": colors.get("text", "#1A1A2E"),
        },
        "composition_id": "GeneratedVideo",
        "hero_layout": HERO_ARRANGEMENT,
        "fallback_layout": FALLBACK_ARRANGEMENT,
        # valid_layouts is used by SceneEditModal's layout dropdown
        "valid_layouts": valid_layouts,
        "layouts_without_image": no_image_layouts,
    }
    if layout_names:
        meta["layout_names"] = layout_names
    return meta
