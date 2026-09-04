"""
Custom Prompt Builder — Generates prompt.md and meta.json equivalents
for custom templates using the universal layout engine.
"""

import re
from typing import Any

from app.services.scene_content_schema import FIELD_DEFS_BY_TYPE


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
    content_codes_count: int = 0,
    content_archetype_ids: list | None = None,
    design_blueprint: dict | None = None,
    layout_prop_schemas: dict | None = None,
    scene_font_defaults: dict | None = None,
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

    # When generated code exists, expose variant-based layouts instead of arrangements
    # Per-layout "what this scene is for", surfaced in the editor's layout
    # dropdown. Sourced from the design docs, so it describes the template's own
    # scenes rather than a generic label.
    layout_descriptions: dict[str, str] = {}
    # layout id -> the SENTENCE describing what content belongs here.
    layout_best_for: dict[str, str] = {}
    # layout id -> the taxonomy key, for the machine-readable routing fallback.
    layout_content_types: dict[str, str] = {}

    if content_codes_count > 0:
        variant_layouts = ["intro"]
        layout_names = {"intro": "Intro Scene"}
        for i in range(content_codes_count):
            key = f"content_{i}"
            variant_layouts.append(key)
            # Prefer the real archetype name (e.g. "coca_cola_bullets" -> "Coca Cola
            # Bullets") so the layout dropdown shows which scene the user is editing,
            # falling back to a generic label only when no archetype id is available.
            label = None
            if content_archetype_ids and i < len(content_archetype_ids):
                raw = content_archetype_ids[i]
                arch_id = raw.get("id") if isinstance(raw, dict) else raw
                if isinstance(arch_id, str) and arch_id.strip():
                    label = arch_id.replace("_", " ").title()
                # What this layout is FOR, in the designer's own words. Built-in
                # templates describe each layout's best fit; custom ones showed
                # only an index, so the layout dropdown gave no way to tell one
                # content style from another.
                if isinstance(raw, dict):
                    desc = raw.get("description")
                    if isinstance(desc, str) and desc.strip():
                        layout_descriptions[key] = desc.strip()
                    # `best_for` is now a SENTENCE saying what article content
                    # belongs in this layout — the same voice a built-in
                    # template's layout_prompt.md uses ("Best for: Ordered or
                    # grouped lists."). It reads as prose for whoever assigns
                    # content, and is what distinguishes three layouts that all
                    # happen to hold lists.
                    #
                    # Older templates stored a ranked taxonomy LIST here
                    # instead; those still work — the list is joined so the
                    # picker sees something, and `content_type` carries the
                    # machine-readable key either way.
                    _bf = raw.get("best_for")
                    if isinstance(_bf, str) and _bf.strip():
                        layout_best_for[key] = _bf.strip()
                    elif isinstance(_bf, list):
                        _kinds = [k for k in _bf if isinstance(k, str)]
                        if _kinds:
                            layout_best_for[key] = ", ".join(_kinds)
                    _ct = raw.get("content_type")
                    if isinstance(_ct, str) and _ct.strip():
                        layout_content_types[key] = _ct.strip()
            layout_names[key] = label or f"Content Style {i + 1}"
        # Data-viz scenes are always injected into custom videos by the pipeline; expose
        # them as selectable, named layouts so the user can switch a scene to a
        # chart/table. Layout ids match SceneEditModal's convention (custom_chart /
        # custom_table — see currentLayoutId derivation). They never take an image.
        variant_layouts.append("custom_chart")
        layout_names["custom_chart"] = "Data Chart"
        variant_layouts.append("custom_table")
        layout_names["custom_table"] = "Data Table"
        variant_layouts.append("outro")
        layout_names["outro"] = "Outro Scene"

        valid_layouts = variant_layouts
        # Per-layout image capability (P2).
        #
        # This list is the SINGLE mechanism the whole product already uses to
        # express "this layout takes no image": get_layouts_without_image() feeds
        # image generation, stock-clip assignment, the pipeline's image
        # selection, render data, and the three SceneEditModal surfaces (image
        # controls, the layout dropdown note, and the expanded scene row). It was
        # hardcoded to the data-viz scenes; driving it from the blueprint gives
        # custom templates the same behaviour built-in and crafted templates have.
        no_image_layouts: list[str] = ["custom_chart", "custom_table"]
        if design_blueprint:
            # v2 stores per-scene design docs under `scenes`; v1 (blueprint-era)
            # templates store `layouts`. Both carry `supports_image` per scene
            # with the same meaning, so read whichever is present.
            _layouts = (
                design_blueprint.get("scenes")
                or design_blueprint.get("layouts")
                or []
            )
            _content = [l for l in _layouts if l.get("role") not in ("intro", "outro")]
            for _i, _lay in enumerate(_content):
                if _i < content_codes_count and not _lay.get("supports_image", True):
                    no_image_layouts.append(f"content_{_i}")
            for _role in ("intro", "outro"):
                _lay = next((l for l in _layouts if l.get("role") == _role), None)
                if _lay is not None and not _lay.get("supports_image", True):
                    no_image_layouts.append(_role)

            # Bookend descriptions. The bookends carry no archetype entry —
            # content_archetype_ids is strictly parallel to content_codes, and
            # adding to it would corrupt variant indexing — so their "what this
            # is for" comes straight from their design doc.
            for _role in ("intro", "outro"):
                _lay = next((l for l in _layouts if l.get("role") == _role), None)
                _doc = (_lay or {}).get("doc")
                if isinstance(_doc, str) and _doc.strip():
                    layout_descriptions[_role] = re.split(
                        r"(?<=[.!?])\s", _doc.strip()
                    )[0].strip()[:200]

        # THE OUTRO NEVER TAKES AN IMAGE, in any custom template.
        #
        # A v1 outro is replaced by GeneratedCtaOverlay at render, so anything it
        # drew was discarded anyway. A v2 outro renders its own layout, and for a
        # while its capability was allowed to follow its design doc — but an
        # ending is a call to action, not a picture: a still or a clip behind the
        # CTA and the socials competes with exactly the elements the scene exists
        # to present, and it made custom videos spend a stock clip on the one
        # scene a built-in template never gives one to.
        #
        # Forcing it here is what makes the whole downstream chain agree:
        # get_layouts_without_image feeds the image cascade, the stock-clip
        # coverage arithmetic, and the image controls in both scene editors.
        if "outro" not in no_image_layouts:
            no_image_layouts.append("outro")
    else:
        valid_layouts = list(CUSTOM_ARRANGEMENTS)
        layout_names = {}
        no_image_layouts = ["full-center", "stacked"]

    meta: dict[str, Any] = {
        "id": "custom",
        "name": name,
        "description": f"Custom template: {name}",
        "new_template": False,
        "preview_colors": {
            "accent": colors.get("accent", "#7C3AED"),
            "bg": colors.get("bg", "#FFFFFF"),
            "text": colors.get("text", "#1A1A2E"),
        },
        "composition_id": "GeneratedVideo",
        # Hero/fallback must be MEMBERS of this meta's own valid_layouts.
        #
        # They were hardcoded to the arrangement constants ("full-center" /
        # "top-bottom") even in the generated branch, where valid_layouts is
        # intro / content_0..N / outro. Callers that clamp against valid_layouts
        # (notably _sanitize_script_layouts' `hero_layout in valid` check) then
        # silently skipped the hero rule, so scene 0 was never pinned to `intro`.
        "hero_layout": "intro" if content_codes_count > 0 else HERO_ARRANGEMENT,
        "fallback_layout": (
            "content_0" if content_codes_count > 0 else FALLBACK_ARRANGEMENT
        ),
        # valid_layouts is used by SceneEditModal's layout dropdown
        "valid_layouts": valid_layouts,
        "layouts_without_image": no_image_layouts,
    }
    if layout_names:
        meta["layout_names"] = layout_names
    if layout_descriptions:
        meta["layout_descriptions"] = layout_descriptions
    if layout_best_for:
        meta["layout_best_for"] = layout_best_for
    if layout_content_types:
        meta["layout_content_types"] = layout_content_types

    # Per-layout editable props (P3).
    #
    # SceneEditModal already has a complete generic renderer for this shape and
    # reads it for built-in and crafted templates; it was never populated for
    # custom templates because build_custom_meta simply did not emit the key.
    # Emitting it here makes custom-template scenes editable with no frontend
    # change. Omitted entirely when there are no schemas, so templates generated
    # before P3 fall through to the existing structured-content fields exactly
    # as they do today.
    schema: dict[str, Any] = {}
    if layout_prop_schemas and content_codes_count > 0:
        from app.services.code_generator import build_layout_prop_schema

        intro_fields = layout_prop_schemas.get("intro") or []
        if intro_fields:
            schema["intro"] = build_layout_prop_schema(
                intro_fields, layout_names.get("intro", "Intro Scene")
            )
        outro_fields = layout_prop_schemas.get("outro") or []
        if outro_fields:
            schema["outro"] = build_layout_prop_schema(
                outro_fields, layout_names.get("outro", "Outro Scene")
            )
        for i, fields in enumerate(layout_prop_schemas.get("content") or []):
            if not fields or i >= content_codes_count:
                continue
            key = f"content_{i}"
            schema[key] = build_layout_prop_schema(
                fields, layout_names.get(key, f"Content Style {i + 1}")
            )

    # Per-scene DEFAULT type sizes, folded into the SAME `defaults` slot the
    # editors already resolve from.
    #
    # `getDefaultFontSizesFromSchema` on the frontend and the render's per-scene
    # merge both read `layout_prop_schema[layout].defaults.titleFontSize`, and
    # both already understand the {landscape, portrait} shape — so routing the
    # stored sizes here makes every slider start from the right number with no
    # new resolution code anywhere.
    #
    # Deliberately OUTSIDE the block above: a scene can have no editable layout
    # props at all and still need its type sized, so gating this on
    # `layout_prop_schemas` would leave most templates on the hardcoded pair.
    if scene_font_defaults and content_codes_count > 0:
        def _defaults_for(entry: Any) -> dict | None:
            if not isinstance(entry, dict):
                return None
            out: dict[str, Any] = {}
            for prop, key in (("title", "titleFontSize"), ("description", "descriptionFontSize")):
                sizes = entry.get(prop)
                if isinstance(sizes, dict) and (sizes.get("landscape") or sizes.get("portrait")):
                    out[key] = {
                        "landscape": sizes.get("landscape"),
                        "portrait": sizes.get("portrait"),
                    }
            return out or None

        _by_key: dict[str, Any] = {
            "intro": scene_font_defaults.get("intro"),
            "outro": scene_font_defaults.get("outro"),
        }
        for i, entry in enumerate(scene_font_defaults.get("content") or []):
            if i < content_codes_count:
                _by_key[f"content_{i}"] = entry

        for key, entry in _by_key.items():
            fonts = _defaults_for(entry)
            if not fonts:
                continue
            slot = schema.setdefault(
                key, {"label": layout_names.get(key, key), "fields": []}
            )
            # Font defaults go UNDER anything the layout declared itself, so a
            # scene that named its own default keeps it.
            slot["defaults"] = {**fonts, **(slot.get("defaults") or {})}

    if schema:
        meta["layout_prop_schema"] = schema

    # The per-CONTENT-TYPE field definitions (bullets, steps, metrics, …).
    #
    # Served so the scene editor renders these from the SAME definition the
    # extractor writes against. SceneEditModal had its own hardcoded copy
    # (CUSTOM_CONTENT_FIELDS) that drifted from it: the frontend declared
    # `steps` a flat string_array while a scene rendered objects, so every row
    # printed "[object Object]". One definition, no drift.
    meta["content_prop_schema"] = {
        ctype: [dict(f) for f in defs]
        for ctype, defs in FIELD_DEFS_BY_TYPE.items()
    }

    return meta
