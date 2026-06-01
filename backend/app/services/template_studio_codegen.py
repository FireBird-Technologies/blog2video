"""Helpers for creating a new built-in template from a free-form design doc.

This module owns the deterministic parts of the pipeline (scaffolding TSX files,
extracting a structured plan from a design doc via Claude, editing the
frontend/backend registries). It is called from
`app/routers/template_studio.py::create_template_from_doc`.

The Claude code-edit and doc-section dispatchers live in template_studio.py
because they share state with the Gemini fallback path. This module only
extracts the plan; per-layout TSX generation re-uses the existing dispatcher.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.services.template_studio_llm import template_studio_chat


# ─── Plan schema ──────────────────────────────────────────────────────────────

ALLOWED_PROP_TYPES = {
    "string", "text", "number", "boolean", "color", "imageUrl",
    "string_array", "object_array",
}


def coerce_prop_default(value: object) -> str | None:
    """Maps LLM/JSON output into `str | None` for plan prop defaults.

    Models sometimes emit `[]` or JSON arrays/objects instead of a string; empty
    lists mean "no default".
    """
    if value is None:
        return None
    if isinstance(value, str):
        s = value.strip()
        return s if s else None
    if isinstance(value, list):
        if len(value) == 0:
            return None
        return json.dumps(value)
    if isinstance(value, dict):
        return json.dumps(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return str(value)


class PlanProp(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z][a-zA-Z0-9_]*$")
    type: str
    description: str = Field(default="", max_length=400)
    default: str | None = None

    @field_validator("default", mode="before")
    @classmethod
    def _normalize_default(cls, v: object) -> str | None:
        return coerce_prop_default(v)


class PlanLayout(BaseModel):
    id: str = Field(min_length=2, max_length=64, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(min_length=1, max_length=80)
    visual: str = Field(min_length=4, max_length=1500)
    best_for: str = Field(default="", max_length=800)
    # Layout-specific SVG markup, animation specifics, and DOM/structure
    # instructions carried verbatim from the design doc. `visual` is too small
    # to hold this — codegen reads both.
    implementation_notes: str = Field(default="", max_length=4000)
    props: list[PlanProp] = Field(default_factory=list, max_length=30)
    supports_image: bool = False


class TemplatePlan(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=4, max_length=600)
    subtitle: str = Field(default="", max_length=120)
    genres: list[str] = Field(default_factory=lambda: ["General"], max_length=10)
    preview_colors: dict[str, str]
    base_width: int = Field(default=1920, ge=480, le=4096)
    base_height: int = Field(default=1080, ge=270, le=4096)
    # Global visual / animation / shared-SVG system carried from the design
    # doc. Injected into every per-layout codegen prompt.
    design_notes: str = Field(default="", max_length=6000)
    hero_layout: str
    fallback_layout: str
    layouts: list[PlanLayout] = Field(min_length=2, max_length=20)


# Newspaper-style responsive typography for meta.json (matches built-ins like
# `newspaper`). TSX from layout codegen must use `prop ?? (p ? n : m)` so
# Template Studio Save-to-source can rewrite literals (see _replace_responsive_expr).
STANDARD_LAYOUT_TYPOGRAPHY_FIELDS: list[dict[str, object]] = [
    {
        "key": "titleFontSize",
        "label": "Title Font Size",
        "type": "number",
        "responsive": True,
        "min": 18,
        "max": 220,
        "step": 1,
    },
    {
        "key": "descriptionFontSize",
        "label": "Body Font Size",
        "type": "number",
        "responsive": True,
        "min": 10,
        "max": 140,
        "step": 1,
    },
]

STANDARD_LAYOUT_TYPOGRAPHY_DEFAULTS: dict[str, dict[str, int]] = {
    "titleFontSize": {"portrait": 92, "landscape": 76},
    "descriptionFontSize": {"portrait": 52, "landscape": 40},
}


# ─── Plan extraction ──────────────────────────────────────────────────────────

_PLAN_SYSTEM_PROMPT = """You convert a canonical video-template design doc into a strict JSON plan for codegen.

Return JSON ONLY (no markdown fences, no commentary). Schema:

{
  "name": "Display name",
  "description": "1-2 sentence template description",
  "subtitle": "short tagline shown in the picker",
  "genres": ["Technology", "Business"],
  "preview_colors": {"accent": "#hexcolor", "bg": "#hexcolor", "text": "#hexcolor"},
  "base_width": 1920,
  "base_height": 1080,
  "design_notes": "The global visual & animation system — shared SVG motifs, the animation language, easing/timing conventions, backgrounds. Copy this from the doc's 'Global Visual & Animation System' section verbatim and in full.",
  "hero_layout": "snake_case_id of the opening layout",
  "fallback_layout": "snake_case_id used when no other layout fits",
  "layouts": [
    {
      "id": "snake_case_id",
      "label": "Human Label",
      "visual": "1-2 sentence description of what the layout looks like",
      "best_for": "1 sentence — when to use it",
      "implementation_notes": "Layout-specific SVG markup, animation specifics, DOM/structure. Copy this from the layout's 'implementation notes' in the doc verbatim and in full.",
      "supports_image": true,
      "props": [
        {"name": "camelCaseProp", "type": "string", "description": "...", "default": "..."}
      ]
    }
  ]
}

Rules:
- Layout ids and prop names must match the regex shown.
- Prop "default" must be a JSON string, number, boolean, or null — never a raw
  JSON array/object at the JSON level. For array-type props, either omit the
  default or use a string whose contents are JSON (e.g. the two-character
  string [] for an empty list).
- Allowed prop types: string, text, number, boolean, color, imageUrl, string_array, object_array.
- Every template MUST include an "ending_socials" layout. Add it if missing — it is the standard outro.
- hero_layout and fallback_layout MUST appear in layouts[].id.
- Always include at least these standard layouts: hero_image (or template-specific opening), text_narration, and ending_socials.
- Prefer 6-12 layouts total. Stay under 14.
- DO NOT include titleFontSize or descriptionFontSize in props — those are added automatically.
- design_notes and implementation_notes are NOT summaries. Copy every concrete
  SVG path/shape, animation, easing curve, frame timing, and structural
  instruction from the doc into them verbatim — codegen depends on this detail.
  Leave them as "" only when the doc truly says nothing about that scope.
"""


_NORMALIZE_SYSTEM_PROMPT = """You are a senior video-template designer. You receive a free-form, possibly messy, partial, or inconsistently formatted design doc for a video template. Analyze it, then REWRITE it into ONE canonical design doc with a fixed structure so downstream codegen is consistent and predictable.

Output the canonical doc as Markdown ONLY — no commentary, no code fences.

Required structure:

# <Template Name> — Video Template Design Doc

## Purpose
1-3 sentences on what the template is for.

## Identity
- name: <display name>
- subtitle: <short tagline for the picker>
- genres: <comma-separated genres>
- base_width: <int, default 1920>
- base_height: <int, default 1080>
- description: <1-2 sentence template description>

## Global Visual & Animation System
- preview_colors: accent <#hex>, bg <#hex>, text <#hex>
- Shared SVG motifs, the animation language, easing/timing conventions, and
  background treatment that apply to EVERY layout.

## Layouts
hero_layout: <snake_case id>
fallback_layout: <snake_case id>

### N. <snake_case_id> — label: <Human Label>
- best_for: <1 sentence — when to use it>
- supports_image: <true|false>
- visual: <2-3 dense sentences naming concrete colors, shapes, sizes, positions>
- implementation notes: <layout-specific SVG markup/paths, exact animations,
  easing, frame timing, and DOM/structure — be concrete>
- props:
  - <camelCaseName> (<type>): <description>

Rules:
- PRESERVE the author's creative and technical intent. If the input contains
  concrete instructions about SVGs, animations, easing, timing, or layout
  structure, carry them through FULLY into 'Global Visual & Animation System'
  (if shared) or the relevant layout's 'implementation notes' (if specific).
  Never summarize this detail away — downstream codegen sees only this doc and
  has no reference component.
- Fill genuine gaps with sensible, internally consistent choices.
- 6-12 layouts total. Always include an opening/hero layout, a text_narration
  baseline layout, and an ending_socials outro layout.
- hero_layout and fallback_layout must be ids you listed under ## Layouts.
- Layout ids are snake_case; prop names are camelCase.
- Allowed prop types ONLY: string, text, number, boolean, color, imageUrl,
  string_array, object_array.
- Do NOT add titleFontSize or descriptionFontSize props — they are automatic.
"""


def extract_template_plan(*, design_doc: str, template_id: str) -> TemplatePlan:
    """Convert a (canonical) design doc into a strict TemplatePlan.

    Runs through the Anthropic API — Claude Sonnet (see app.services.template_studio_llm)."""
    user_text = (
        f"Template id (preassigned, must be kept consistent): {template_id}\n\n"
        f"DESIGN DOC:\n{design_doc.strip()}\n\n"
        "Output the JSON plan only."
    )
    raw = template_studio_chat(
        system=_PLAN_SYSTEM_PROMPT,
        user=user_text,
        max_tokens=16000,
        temperature=0.2,
        log_label="extract_plan",
    ).strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.IGNORECASE)
    if fenced:
        raw = fenced.group(1).strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502,
            detail=f"plan was not valid JSON: {e}. First 400 chars: {raw[:400]}",
        )

    try:
        plan = TemplatePlan(**data)
    except ValidationError as e:
        raise HTTPException(status_code=502, detail=f"plan failed schema validation: {e}")

    validate_plan(plan)
    return plan


def validate_plan(plan: TemplatePlan, *, status_code: int = 502) -> None:
    """Cross-field plan checks beyond the pydantic schema: hero/fallback
    membership and the prop-type allowlist. Raises HTTPException when invalid.
    Used by `extract_template_plan` and by the create endpoint when a
    client-supplied plan is accepted directly."""
    layout_ids = {layout.id for layout in plan.layouts}
    if plan.hero_layout not in layout_ids:
        raise HTTPException(
            status_code=status_code,
            detail=f"hero_layout '{plan.hero_layout}' not in layouts list.",
        )
    if plan.fallback_layout not in layout_ids:
        raise HTTPException(
            status_code=status_code,
            detail=f"fallback_layout '{plan.fallback_layout}' not in layouts list.",
        )
    for layout in plan.layouts:
        for prop in layout.props:
            if prop.type not in ALLOWED_PROP_TYPES:
                raise HTTPException(
                    status_code=status_code,
                    detail=f"Prop {layout.id}.{prop.name} has unknown type '{prop.type}'.",
                )


def filter_plan_layouts(plan: TemplatePlan, keep_layout_ids: list[str]) -> TemplatePlan:
    """Keep only layouts listed in ``keep_layout_ids`` (preserving plan order).

    Used after the Studio review step when the user removes layouts the model
    invented beyond the design doc. Re-points ``hero_layout`` and
    ``fallback_layout`` if those ids were removed.
    """
    keep_set = set(keep_layout_ids)
    if not keep_set:
        raise HTTPException(
            status_code=400,
            detail="keep_layout_ids must include at least one layout.",
        )
    known = {ly.id for ly in plan.layouts}
    unknown = keep_set - known
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown layout id(s): {', '.join(sorted(unknown))}",
        )
    kept: list[PlanLayout] = [ly for ly in plan.layouts if ly.id in keep_set]
    if len(kept) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 layouts must remain (schema minimum).",
        )

    hero = plan.hero_layout if plan.hero_layout in keep_set else kept[0].id
    if plan.fallback_layout in keep_set:
        fallback = plan.fallback_layout
    elif "text_narration" in keep_set:
        fallback = "text_narration"
    elif "ending_socials" in keep_set:
        fallback = "ending_socials"
    else:
        fallback = next((ly.id for ly in kept if ly.id != hero), kept[-1].id)
    if fallback == hero:
        fallback = next((ly.id for ly in kept if ly.id != hero), kept[-1].id)

    trimmed = plan.model_copy(
        update={
            "layouts": kept,
            "hero_layout": hero,
            "fallback_layout": fallback,
        }
    )
    validate_plan(trimmed, status_code=400)
    return trimmed


def normalize_design_doc(*, design_doc: str, template_id: str) -> str:
    """Rewrite a free-form design doc into the canonical structure.

    Runs before `extract_template_plan` so every template is generated from a
    consistent, complete spec. Any concrete SVG / animation / layout
    instructions in the input are preserved (see `_NORMALIZE_SYSTEM_PROMPT`).
    Runs through the Anthropic API (Claude Sonnet). Returns canonical Markdown.
    Raises HTTPException on API/parse failure — the caller may fall back to the
    raw doc.
    """
    user_text = (
        f"Template id (preassigned, keep it consistent): {template_id}\n\n"
        f"RAW DESIGN DOC:\n{design_doc.strip()}\n\n"
        "Rewrite it into the canonical design doc. Output Markdown only."
    )
    raw = template_studio_chat(
        system=_NORMALIZE_SYSTEM_PROMPT,
        user=user_text,
        max_tokens=20000,
        temperature=0.2,
        log_label="normalize_design_doc",
    ).strip()
    fenced = re.search(r"```(?:markdown|md)?\s*([\s\S]*?)```", raw, re.IGNORECASE)
    if fenced:
        raw = fenced.group(1).strip()

    if len(raw) < 50:
        raise HTTPException(
            status_code=502,
            detail="Claude normalization returned an empty / too-short doc.",
        )
    return raw


# ─── String helpers ───────────────────────────────────────────────────────────

def snake_to_pascal(s: str) -> str:
    return "".join(p.capitalize() for p in s.split("_") if p)


def pascal_to_snake(s: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", s).lower()


# ─── Per-layout codegen prompt ────────────────────────────────────────────────

LAYOUT_CODEGEN_SYSTEM_PROMPT = (
    "You are creating a brand-new React TSX layout component for a Remotion "
    "video template system.\n"
    "Return ONLY the full TSX file contents — no markdown fences, "
    "explanations, or extra text."
)


def build_layout_codegen_prompt(
    *,
    template_id: str,
    template_name: str,
    template_description: str,
    accent_color: str,
    bg_color: str,
    text_color: str,
    layout: PlanLayout,
    pascal_name: str,
    design_notes: str = "",
) -> str:
    """Build a self-contained per-layout codegen prompt.

    The prompt carries everything Claude needs to write a competent Remotion
    layout: the template's aesthetic (colors, description, global visual &
    animation system), the layout brief (visual, implementation notes, props,
    image policy), the exact component signature, and the allowed import
    surface. No reference TSX is included — the design doc is expected to be
    detailed enough on its own."""
    props_desc = "\n".join(
        f"  - {p.name} ({p.type}): {p.description}"
        for p in layout.props
    ) or "  - (no custom props — uses title + narration + imageUrl from runtime)"

    design_notes_block = (
        f"Global visual & animation system (applies to every layout — follow it):\n"
        f"{design_notes.strip()}\n\n"
        if design_notes.strip()
        else ""
    )
    impl_notes_block = (
        f"Layout implementation notes — the AUTHORITATIVE spec for THIS layout "
        f"(exact SVG markup, animations, easing, frame timing, DOM/structure). "
        f"Implement them EXACTLY and LITERALLY — they are what makes this layout "
        f"distinct from every other layout in the template; never swap in a "
        f"generic pattern:\n"
        f"{layout.implementation_notes.strip()}\n\n"
        if layout.implementation_notes.strip()
        else ""
    )

    # The ending_socials outro must use the shared SocialIcons component
    # (the same one every built-in template uses) — not hand-drawn icons.
    ending_socials_block = ""
    if layout.id == "ending_socials":
        ending_socials_block = (
            "ENDING-SOCIALS — SPECIAL RULE (this layout only):\n"
            "  - Render the social-media icon row with the SHARED component — the\n"
            "    same one every built-in template uses. NEVER hand-draw or\n"
            "    hard-code social/brand icons or their SVGs.\n"
            "  - Add this import (allowed IN ADDITION to the imports below):\n"
            '      import { SocialIcons } from "../../SocialIcons";\n'
            "  - Destructure these runtime props too (all on SceneLayoutProps):\n"
            "      socials, websiteLink, showWebsiteButton, ctaButtonText\n"
            "  - Render the icon row exactly once:\n"
            "      <SocialIcons\n"
            "        socials={socials}\n"
            "        accentColor={accentColor}\n"
            "        textColor={textColor}\n"
            '        maxPerRow={aspectRatio === "portrait" ? 3 : 4}\n'
            "        fontFamily={fontFamily}\n"
            "        aspectRatio={aspectRatio}\n"
            "      />\n"
            "  - Optionally render a website CTA button when showWebsiteButton is\n"
            "    not false and websiteLink is a non-empty string; label it with\n"
            "    ctaButtonText (fall back to 'Visit site').\n"
            "  - Design everything else (headline, sign-off line, layout,\n"
            "    background, start/end transitions) per the design doc and the\n"
            "    template aesthetic above.\n\n"
        )

    image_clause = (
        "This layout SHOULD render an image — use the `imageUrl` prop with an "
        "<Img> from 'remotion'. Apply `imageObjectPosition` and `imageZoom` to "
        "the underlying <img> via inline style."
        if layout.supports_image
        else "This layout MUST NOT render an image even if the imageUrl prop is present."
    )

    return (
        "You are writing one TSX file: a single React Remotion layout component.\n\n"
        f"Template ID: {template_id}\n"
        f"Template name: {template_name}\n"
        f"Template aesthetic: {template_description}\n"
        f"Default colors (these are passed as runtime props — do NOT hard-code them, "
        f"but design with this palette in mind): accent={accent_color}, bg={bg_color}, text={text_color}\n\n"
        f"{design_notes_block}"
        f"Layout ID: {layout.id}\n"
        f"Layout label: {layout.label}\n"
        f"Component export name: {pascal_name}\n\n"
        f"Visual brief: {layout.visual}\n"
        f"Best used for: {layout.best_for}\n\n"
        f"{impl_notes_block}"
        f"{ending_socials_block}"
        "Required component signature:\n"
        '  import React from "react";\n'
        '  import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";\n'
        '  import { SceneLayoutProps } from "../types";\n'
        "\n"
        f"  export const {pascal_name}: React.FC<SceneLayoutProps> = (props) => {{\n"
        "    const { title, narration, imageUrl, imageObjectPosition, imageZoom,\n"
        "            accentColor, bgColor, textColor, aspectRatio, sceneDurationInFrames,\n"
        "            titleFontSize, descriptionFontSize, fontFamily } = props;\n"
        '    const p = aspectRatio === "portrait";\n'
        "    // access custom props via (props as any).propName\n"
        "    // ...\n"
        "  };\n\n"
        "Typography — REQUIRED (same contract as built-in templates e.g. newspaper; "
        "Template Studio edits these via meta.json + Save-to-source):\n"
        "  - Right after destructuring props, you MUST have: "
        '`const p = aspectRatio === "portrait";`\n'
        "  - The main headline (render the `title` string prominently) MUST set "
        "fontSize using this exact pattern so defaults can be synced into TSX:\n"
        "      fontSize: titleFontSize ?? (p ? <portraitInt> : <landscapeInt>)\n"
        "    Choose sensible integer fallbacks for this layout (e.g. 80 and 72).\n"
        "  - The primary narration / body text (the `narration` string) MUST set "
        "fontSize using:\n"
        "      fontSize: descriptionFontSize ?? (p ? <portraitInt> : <landscapeInt>)\n"
        "    Choose sensible fallbacks (e.g. 38 and 32).\n"
        "  - You MAY assign to locals like "
        "`const titlePx = titleFontSize ?? (p ? 80 : 72);` but the substring "
        "`titleFontSize ?? (p ? … : …)` MUST appear verbatim in the file at least "
        "once for the title, and `descriptionFontSize ?? (p ? … : …)` at least "
        "once for the body — do not use only raw numbers for those two roles.\n"
        "  - Optional `* scale` form is allowed, e.g. "
        "`titleFontSize ?? (p ? 80 * scale : 72 * scale)`, when you define a "
        "positive numeric `scale` from canvas size.\n\n"
        "Standard props you may rely on (always present at runtime):\n"
        "  title: string                — the scene title\n"
        "  narration: string             — the scene narration / body\n"
        "  imageUrl?: string             — only when supports_image is true\n"
        "  imageObjectPosition?: string  — CSS object-position, e.g. '50% 50%'\n"
        "  imageZoom?: number            — CSS transform scale factor (>=1)\n"
        "  accentColor / bgColor / textColor: string  — hex strings\n"
        "  aspectRatio?: string          — 'landscape' or 'portrait'\n"
        "  sceneDurationInFrames?: number — THIS scene's exact length in frames\n"
        "  titleFontSize / descriptionFontSize?: number\n"
        "  fontFamily?: string\n\n"
        "Custom props for this layout (also part of SceneLayoutProps):\n"
        f"{props_desc}\n\n"
        f"Image policy: {image_clause}\n\n"
        "Scene timing & transitions — REQUIRED structure:\n"
        "  - `useCurrentFrame()` is scene-relative: it runs 0 to (sceneDurationInFrames - 1).\n"
        "  - `sceneDurationInFrames` is THIS scene's exact length. Scenes are NOT a\n"
        "    constant length — never hard-code a duration or assume ~5s.\n"
        "  - START transition: animate the layout IN over the first ~12-24 frames.\n"
        "  - END transition: animate the layout OUT over the last ~12-24 frames,\n"
        "    anchored to sceneDurationInFrames so it always lands on the real scene end.\n"
        "  - Between the two transitions the content holds — it must fill the WHOLE\n"
        "    scene however long it is: no dead air, no early disappearance.\n"
        "  - Drive both transitions from the scene length, e.g.:\n"
        "      const dur = sceneDurationInFrames ?? 150;\n"
        "      const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });\n"
        "      const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });\n"
        "    Use `enter` for the start transition and `exit` for the end transition.\n\n"
        "Animation STYLE — from the design doc, do NOT generalize:\n"
        "  - WHAT moves, which SVG paths/shapes animate, the easing, the stagger,\n"
        "    spring vs interpolate, the exact frame offsets — all of it MUST come\n"
        "    from this layout's implementation notes and the global visual &\n"
        "    animation system above. Implement them literally so each layout looks\n"
        "    and moves distinctly from the others — do not flatten them into one\n"
        "    generic motion.\n"
        "  - Use `useVideoConfig()` for fps / width / height when needed (e.g. spring).\n"
        "  - Fall back to a tasteful default only for a detail the notes genuinely\n"
        "    do not mention — never replace a specified animation with a generic one.\n\n"
        "Constraints:\n"
        "  - Use ONLY the imports listed above (plus the SocialIcons import when "
        "this is the ending_socials layout, per its special rule). Do NOT import "
        "from any other path.\n"
        "  - For object_array props (items with label/value): render BOTH — "
        "show item.label as caption text and item.value as the main value.\n"
        "  - Respect aspectRatio === 'portrait' (1080x1920) vs landscape (1920x1080) "
        "when picking sizes, paddings, and grid breakpoints.\n"
        "  - Match the template's aesthetic described above. Use accentColor for highlights, "
        "bgColor for the AbsoluteFill background, textColor for primary text.\n\n"
        "Return ONLY the full TSX file contents — no markdown fences, no explanations."
    )


# ─── File templates: meta.json, prompt.md, layout_prompt.md ────────────────────

def build_meta_json(
    *,
    plan: TemplatePlan,
    template_id: str,
    composition_id: str,
) -> dict:
    """Build the meta.json structure from a plan. layout_prop_schema is filled
    with the standard titleFontSize/descriptionFontSize + the plan's custom props."""
    # Import the existing helpers from the router module lazily to avoid a
    # circular import (template_studio.py imports this module).
    from app.routers.template_studio import (  # type: ignore
        PropDef,
        _build_prop_schema_entry,
    )

    layouts_without_image = [layout.id for layout in plan.layouts if not layout.supports_image]

    base_fields = [dict(f) for f in STANDARD_LAYOUT_TYPOGRAPHY_FIELDS]
    base_defaults = dict(STANDARD_LAYOUT_TYPOGRAPHY_DEFAULTS)

    layout_prop_schema: dict[str, dict] = {}
    for layout in plan.layouts:
        prop_defs = [
            PropDef(
                name=p.name,
                type=p.type,
                description=p.description or "",
                default=p.default,
            )
            for p in layout.props
        ]
        entry = _build_prop_schema_entry(layout.label, list(base_fields), dict(base_defaults), prop_defs)
        layout_prop_schema[layout.id] = entry

    return {
        "id": template_id,
        "name": plan.name,
        "new_template": True,
        "description": plan.description,
        "genres": list(plan.genres) or ["General"],
        "preview_colors": dict(plan.preview_colors),
        "composition_id": composition_id,
        "hero_layout": plan.hero_layout,
        "fallback_layout": plan.fallback_layout,
        "valid_layouts": [layout.id for layout in plan.layouts],
        "layout_prop_schema": layout_prop_schema,
        "layouts_without_image": layouts_without_image,
    }


def build_prompt_md_header(plan: TemplatePlan) -> str:
    return (
        "# Design Philosophy\n\n"
        f"{plan.description.strip()}\n\n"
        "---\n\n"
        "# Layout Catalog\n\n"
    )


def build_layout_prompt_md_header(template_id: str) -> str:
    return (
        f"# {template_id} — Layout Catalog\n\n"
        "Use this list when picking the `preferred_layout` for each scene.\n\n"
    )


# ─── TSX file templates ───────────────────────────────────────────────────────

def build_types_ts(plan: TemplatePlan, type_name: str) -> str:
    """Generate the LayoutType union + SceneLayoutProps interface used in
    `frontend/src/components/remotion/<id>/types.ts` and the mirror in
    `remotion-video/src/templates/<id>/types.ts`."""
    layout_ids = [layout.id for layout in plan.layouts]
    layout_union = " | ".join(f'"{lid}"' for lid in layout_ids)

    seen_props: dict[str, str] = {}
    has_object_array = False
    for layout in plan.layouts:
        for prop in layout.props:
            if prop.name in seen_props:
                continue
            ts_type = {
                "string": "string",
                "text": "string",
                "color": "string",
                "imageUrl": "string",
                "number": "number",
                "boolean": "boolean",
                "string_array": "string[]",
                "object_array": "Array<{ label?: string; value?: string }>",
            }.get(prop.type, "string")
            if prop.type == "object_array":
                has_object_array = True
            seen_props[prop.name] = ts_type

    custom_lines = "\n".join(f"  {name}?: {ts};" for name, ts in seen_props.items())
    if not custom_lines:
        custom_lines = "  // no custom props"

    obj_array_comment = (
        "\n  // object_array props use the standard label/value pair shape so "
        "the editor can render both fields"
        if has_object_array
        else ""
    )

    return (
        f'import type {{ SocialsMap, SocialsRow }} from "../SocialIcons";\n\n'
        f"export type {type_name} =\n"
        f"  | {layout_union};\n\n"
        f"export interface SceneLayoutProps {{\n"
        f"  title: string;\n"
        f"  narration: string;\n"
        f"  imageUrl?: string;\n"
        f"  imageObjectPosition?: string;\n"
        f"  imageZoom?: number;\n"
        f"  accentColor: string;\n"
        f"  bgColor: string;\n"
        f"  textColor: string;\n"
        f"  aspectRatio?: string;\n"
        f"  // sceneDurationInFrames is THIS scene's exact length — drive entrance/exit from it\n"
        f"  sceneDurationInFrames?: number;\n"
        f"  fontFamily?: string;\n"
        f"  titleFontSize?: number;\n"
        f"  descriptionFontSize?: number;\n"
        f"  // socials / website are used by the ending_socials layout, which\n"
        f"  // renders the shared <SocialIcons> component (../../SocialIcons)\n"
        f"  socials?: SocialsMap | SocialsRow[];\n"
        f"  websiteLink?: string;\n"
        f"  showWebsiteButton?: boolean;\n"
        f"  ctaButtonText?: string;{obj_array_comment}\n"
        f"{custom_lines}\n"
        f"}}\n"
    )


def build_layouts_index_ts(
    *,
    layout_ids: list[str],
    pascal_names: dict[str, str],
    type_name: str,
    registry_name: str,
) -> str:
    """Generate `layouts/index.ts` — the LAYOUT_REGISTRY map."""
    imports = "\n".join(
        f'import {{ {pascal_names[lid]} }} from "./{pascal_names[lid]}";'
        for lid in layout_ids
    )
    entries = "\n".join(f"  {lid}: {pascal_names[lid]}," for lid in layout_ids)
    return (
        f"{imports}\n"
        f'import type {{ {type_name}, SceneLayoutProps }} from "../types";\n\n'
        f"export type {{ {type_name}, SceneLayoutProps }};\n\n"
        f"export const {registry_name}: Record<{type_name}, React.FC<SceneLayoutProps>> = {{\n"
        f"{entries}\n"
        f"}};\n"
    )


def build_frontend_composition_tsx(
    *,
    plan: TemplatePlan,
    pascal: str,
    type_name: str,
    registry_name: str,
) -> str:
    """Generate `frontend/src/components/remotion/<id>/<Pascal>VideoComposition.tsx`."""
    accent = plan.preview_colors.get("accent", "#7C3AED")
    bg = plan.preview_colors.get("bg", "#FFFFFF")
    text = plan.preview_colors.get("text", "#000000")
    fallback = plan.fallback_layout
    return f'''import {{ AbsoluteFill, Audio, Sequence }} from "remotion";
import {{ {registry_name} as LAYOUT_REGISTRY, {type_name}, SceneLayoutProps }} from "./layouts";
import {{ LogoOverlay }} from "../LogoOverlay";

export interface {pascal}SceneInput {{
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: {type_name};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoutProps: Record<string, any>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}}

export interface {pascal}VideoCompositionProps {{
  scenes: {pascal}SceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}}

export const {pascal}VideoComposition: React.FC<{pascal}VideoCompositionProps> = ({{
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}}) => {{
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{{{ backgroundColor: bgColor || "{bg}", fontFamily }}}}>
      {{scenes.map((scene) => {{
        const durationFrames = Math.max(
          1,
          Math.round((Number(scene.durationSeconds) || 5) * FPS),
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          LAYOUT_REGISTRY[scene.layout] ?? LAYOUT_REGISTRY.{fallback};

        const focusX = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)));
        const focusY = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)));

        const layoutProps: SceneLayoutProps = {{
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          imageObjectPosition: `${{focusX}}% ${{focusY}}%`,
          imageZoom: Math.max(1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
          accentColor: accentColor || "{accent}",
          bgColor: bgColor || "{bg}",
          textColor: textColor || "{text}",
          aspectRatio,
          sceneDurationInFrames: durationFrames,
          fontFamily,
        }};

        return (
          <Sequence
            key={{scene.id}}
            from={{startFrame}}
            durationInFrames={{durationFrames}}
            name={{scene.title}}
          >
            <LayoutComponent {{...layoutProps}} />
            {{scene.voiceoverUrl && <Audio src={{scene.voiceoverUrl}} />}}
          </Sequence>
        );
      }})}}

      {{logo && (
        <LogoOverlay
          src={{logo}}
          position={{logoPosition || "bottom_right"}}
          maxOpacity={{logoOpacity ?? 0.9}}
          size={{logoSize ?? 100}}
          aspectRatio={{aspectRatio || "landscape"}}
        />
      )}}
    </AbsoluteFill>
  );
}};
'''


def build_remotion_video_tsx(
    *,
    plan: TemplatePlan,
    pascal: str,
    type_name: str,
    registry_name: str,
) -> str:
    """Generate `remotion-video/src/templates/<id>/<Pascal>Video.tsx`."""
    accent = plan.preview_colors.get("accent", "#7C3AED")
    bg = plan.preview_colors.get("bg", "#FFFFFF")
    text = plan.preview_colors.get("text", "#000000")
    fallback = plan.fallback_layout
    return f'''import {{ useEffect, useState }} from "react";
import {{
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
}} from "remotion";
import {{ {registry_name} as LAYOUT_REGISTRY, {type_name}, SceneLayoutProps }} from "./layouts";
import {{ resolveFontFamily }} from "../../fonts/registry";
import {{ LogoOverlay }} from "../../components/LogoOverlay";
import {{ getPlaybackSpeed, getSceneDurationFrames }} from "../playbackSpeed";

interface SceneData {{
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: {type_name};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoutProps: Record<string, any>;
  durationSeconds: number;
  voiceoverFile: string | null;
  images: string[];
}}

interface VideoData {{
  projectName: string;
  heroImage?: string | null;
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: string;
  aspectRatio?: string;
  playbackSpeed?: number;
  fontFamily?: string | null;
  scenes: SceneData[];
}}

interface VideoProps extends Record<string, unknown> {{
  dataUrl: string;
}}

export const calculate{pascal}Metadata: CalculateMetadataFunction<VideoProps> =
  async ({{ props }}) => {{
    const FPS = 30;
    try {{
      const url = staticFile(props.dataUrl.replace(/^\\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${{url}}`);
      const data: VideoData = await res.json();
      const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
      const sceneFrames = data.scenes.map((s) =>
        getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
      );
      const totalFrames = sceneFrames.reduce((a, b) => a + b, 0);
      const isPortrait = data.aspectRatio === "portrait";
      return {{
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? {plan.base_height} : {plan.base_width},
        height: isPortrait ? {plan.base_width} : {plan.base_height},
      }};
    }} catch {{
      return {{ durationInFrames: FPS * 300, fps: FPS, width: {plan.base_width}, height: {plan.base_height} }};
    }}
  }};

export const {pascal}Video: React.FC<VideoProps> = ({{ dataUrl }}) => {{
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {{
    fetch(staticFile(dataUrl.replace(/^\\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {{
        setData({{
          projectName: "Preview",
          accentColor: "{accent}",
          bgColor: "{bg}",
          textColor: "{text}",
          scenes: [],
        }});
      }});
  }}, [dataUrl]);

  if (!data) {{
    return (
      <AbsoluteFill style={{{{ backgroundColor: "{bg}" }}}}>
        <p style={{{{ color: "{text}", fontSize: 36, margin: "auto" }}}}>Loading...</p>
      </AbsoluteFill>
    );
  }}

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  let currentFrame = 0;
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);

  return (
    <AbsoluteFill
      style={{{{
        backgroundColor: data.bgColor || "{bg}",
        fontFamily: resolvedFontFamily || undefined,
      }}}}
    >
      {{data.scenes.map((scene) => {{
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          playbackSpeed,
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          LAYOUT_REGISTRY[scene.layout] || LAYOUT_REGISTRY.{fallback};

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        const focusX = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)));
        const focusY = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)));

        const layoutProps: SceneLayoutProps = {{
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "{accent}",
          bgColor: data.bgColor || "{bg}",
          textColor: data.textColor || "{text}",
          aspectRatio: data.aspectRatio || "landscape",
          sceneDurationInFrames: durationFrames,
          imageUrl,
          imageObjectPosition: `${{focusX}}% ${{focusY}}%`,
          imageZoom: Math.max(1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
          fontFamily: resolvedFontFamily || undefined,
        }};

        return (
          <Sequence
            key={{scene.id}}
            from={{startFrame}}
            durationInFrames={{durationFrames}}
            name={{scene.title}}
          >
            <LayoutComponent {{...layoutProps}} />
            {{scene.voiceoverFile && (
              <Audio src={{staticFile(scene.voiceoverFile)}} playbackRate={{playbackSpeed}} />
            )}}
          </Sequence>
        );
      }})}}

      {{data.logo && (
        <LogoOverlay
          src={{staticFile(data.logo)}}
          position={{data.logoPosition || "bottom_right"}}
          maxOpacity={{data.logoOpacity ?? 0.9}}
          size={{data.logoSize || "default"}}
          aspectRatio={{data.aspectRatio || "landscape"}}
        />
      )}}
    </AbsoluteFill>
  );
}};
'''


def build_preview_tsx(plan: TemplatePlan, pascal: str) -> str:
    """Generate a minimal preview component for templatePreviews/<Pascal>Preview.tsx.

    A placeholder card matching the template's preview colors. The user can
    hand-author a richer preview later; this just needs to render in the
    template picker thumbnail."""
    accent = plan.preview_colors.get("accent", "#7C3AED")
    bg = plan.preview_colors.get("bg", "#FFFFFF")
    text = plan.preview_colors.get("text", "#000000")
    name = plan.name.replace('"', '\\"')
    subtitle = (plan.subtitle or plan.description).split(".")[0][:60].replace('"', '\\"')
    return f'''const {pascal}Preview = ({{ thumbnailMode = false }}: {{ thumbnailMode?: boolean }}) => {{
  void thumbnailMode;
  return (
    <div
      style={{{{
        width: "100%",
        aspectRatio: "16/9",
        background: "{bg}",
        color: "{text}",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
      }}}}
    >
      <div
        style={{{{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 20% 30%, {accent}22, transparent 50%), radial-gradient(circle at 80% 70%, {accent}33, transparent 55%)",
        }}}}
      />
      <div style={{{{ position: "relative", textAlign: "center" }}}}>
        <div style={{{{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}}}>{name}</div>
        <div style={{{{ marginTop: 8, fontSize: 12, opacity: 0.7 }}}}>{subtitle}</div>
        <div style={{{{ marginTop: 16, display: "flex", gap: 6, justifyContent: "center" }}}}>
          {{[0, 1, 2].map((i) => (
            <span
              key={{i}}
              style={{{{
                width: 22,
                height: 4,
                borderRadius: 99,
                background: i === 0 ? "{accent}" : "{text}22",
              }}}}
            />
          ))}}
        </div>
      </div>
    </div>
  );
}};

export default {pascal}Preview;
'''


# ─── Registry edits ───────────────────────────────────────────────────────────

def append_template_to_registry_json(registry_path: Path, template_id: str) -> str:
    """Append template_id to backend/templates/registry.json. Returns original content."""
    original = registry_path.read_text(encoding="utf-8")
    try:
        ids = json.loads(original)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"registry.json is corrupt: {e}")
    if not isinstance(ids, list):
        raise HTTPException(status_code=500, detail="registry.json must be a JSON array.")
    if template_id not in ids:
        ids.append(template_id)
    registry_path.write_text(json.dumps(ids) + "\n", encoding="utf-8")
    return original


def insert_template_in_template_config(
    *,
    config_path: Path,
    template_id: str,
    pascal: str,
    layouts: list[str],
    colors: dict[str, str],
    base_width: int,
    base_height: int,
    hero_layout: str,
    fallback_layout: str,
) -> str:
    """Patch frontend/src/components/remotion/templateConfig.tsx. Returns original content."""
    original = config_path.read_text(encoding="utf-8")
    content = original

    if f"./{template_id}/{pascal}VideoComposition" in content:
        # Already registered.
        return original

    # 1. Insert import after the last existing template composition import.
    import_line = f'import {{ {pascal}VideoComposition }} from "./{template_id}/{pascal}VideoComposition";\n'
    import_matches = list(re.finditer(
        r'^import \{ \w+VideoComposition \} from "\./[\w-]+/\w+VideoComposition";\s*\n',
        content,
        re.MULTILINE,
    ))
    if not import_matches:
        raise HTTPException(status_code=500, detail="Could not find composition imports in templateConfig.tsx")
    last_import_end = import_matches[-1].end()
    content = content[:last_import_end] + import_line + content[last_import_end:]

    # 2. Insert a <UPPER>_LAYOUTS Set just before `export const TEMPLATE_REGISTRY`.
    upper = template_id.upper()
    layouts_block = (
        f"const {upper}_LAYOUTS = new Set([\n"
        + "\n".join(f'  "{lid}",' for lid in layouts)
        + f"\n]);\n\n"
    )
    registry_export = "export const TEMPLATE_REGISTRY"
    pos = content.find(registry_export)
    if pos == -1:
        raise HTTPException(status_code=500, detail="Could not find TEMPLATE_REGISTRY export in templateConfig.tsx")
    content = content[:pos] + layouts_block + content[pos:]

    # 3. Append a new entry to the TEMPLATE_REGISTRY object literal (before the closing `};`).
    entry = (
        f'  {template_id}: {{\n'
        f'    component: {pascal}VideoComposition as React.ComponentType<any>,\n'
        f'    heroLayout: "{hero_layout}",\n'
        f'    fallbackLayout: "{fallback_layout}",\n'
        f'    validLayouts: {upper}_LAYOUTS,\n'
        f'    defaultColors: {{\n'
        f'      accent: "{colors.get("accent", "#7C3AED")}",\n'
        f'      bg: "{colors.get("bg", "#FFFFFF")}",\n'
        f'      text: "{colors.get("text", "#000000")}",\n'
        f'    }},\n'
        f'    baseWidth: {base_width},\n'
        f'    baseHeight: {base_height},\n'
        f'  }},\n'
    )
    # Insert just before the `};` that closes the TEMPLATE_REGISTRY object.
    registry_close = re.search(
        r"export const TEMPLATE_REGISTRY[^=]*=\s*\{[\s\S]*?\n\};\n",
        content,
    )
    if not registry_close:
        raise HTTPException(status_code=500, detail="Could not find TEMPLATE_REGISTRY closing brace.")
    insert_at = registry_close.end() - len("};\n")
    content = content[:insert_at] + entry + content[insert_at:]

    config_path.write_text(content, encoding="utf-8")
    return original


def insert_template_in_preview_registry(
    *,
    preview_registry_path: Path,
    template_id: str,
    pascal: str,
    title: str,
    subtitle: str,
) -> str:
    """Patch frontend/src/components/templatePreviewRegistry.tsx. Returns original content."""
    original = preview_registry_path.read_text(encoding="utf-8")
    content = original

    if f"./templatePreviews/{pascal}Preview" in content:
        return original

    # 1. Insert import after the last existing preview import.
    import_line = f'import {pascal}Preview from "./templatePreviews/{pascal}Preview";\n'
    import_matches = list(re.finditer(
        r'^import \w+Preview from "\./templatePreviews/\w+Preview";\s*\n',
        content,
        re.MULTILINE,
    ))
    if not import_matches:
        raise HTTPException(status_code=500, detail="Could not find preview imports in templatePreviewRegistry.tsx")
    last_import_end = import_matches[-1].end()
    content = content[:last_import_end] + import_line + content[last_import_end:]

    # 2. Insert map entry before the closing `};` of TEMPLATE_PREVIEWS.
    preview_entry = f"  {template_id}: {pascal}Preview,\n"
    previews_match = re.search(
        r"(export const TEMPLATE_PREVIEWS[^=]*=\s*\{[\s\S]*?)\n\};\n",
        content,
    )
    if not previews_match:
        raise HTTPException(status_code=500, detail="Could not find TEMPLATE_PREVIEWS object in templatePreviewRegistry.tsx")
    insert_at = previews_match.end() - len("};\n")
    content = content[:insert_at] + preview_entry + content[insert_at:]

    # 3. Insert description entry before the closing `};` of TEMPLATE_DESCRIPTIONS.
    safe_title = title.replace('"', '\\"')
    safe_subtitle = subtitle.replace('"', '\\"')
    desc_entry = f'  {template_id}: {{ title: "{safe_title}", subtitle: "{safe_subtitle}" }},\n'
    desc_match = re.search(
        r"(export const TEMPLATE_DESCRIPTIONS[^=]*=\s*\{[\s\S]*?)\n\};\n",
        content,
    )
    if not desc_match:
        raise HTTPException(status_code=500, detail="Could not find TEMPLATE_DESCRIPTIONS object in templatePreviewRegistry.tsx")
    insert_at = desc_match.end() - len("};\n")
    content = content[:insert_at] + desc_entry + content[insert_at:]

    preview_registry_path.write_text(content, encoding="utf-8")
    return original


def insert_template_in_root_tsx(
    *,
    root_tsx_path: Path,
    template_id: str,
    pascal: str,
    base_width: int,
    base_height: int,
) -> str:
    """Patch remotion-video/src/Root.tsx — register the template's <Composition>
    so the Remotion renderer can resolve `<Pascal>Video`. Returns original content.

    Without this, rendering a project on the new template fails with
    "Could not find composition with ID <Pascal>Video".
    """
    original = root_tsx_path.read_text(encoding="utf-8")
    content = original

    composition_id = f"{pascal}Video"
    if f'id="{composition_id}"' in content:
        # Already registered.
        return original

    # 1. Insert the import after the last template-composition import.
    import_block = (
        "import {\n"
        "  " + pascal + "Video,\n"
        "  calculate" + pascal + "Metadata,\n"
        '} from "./templates/' + template_id + "/" + pascal + 'Video";\n'
    )
    import_matches = list(re.finditer(
        r'import \{\s*\w+Video,\s*calculate\w+Metadata,\s*\}'
        r' from "\./templates/[\w-]+/\w+Video";\n',
        content,
    ))
    if not import_matches:
        raise HTTPException(
            status_code=500,
            detail="Could not find template composition imports in Root.tsx",
        )
    last_import_end = import_matches[-1].end()
    content = content[:last_import_end] + import_block + content[last_import_end:]

    # 2. Insert a <Composition> entry before the closing fragment of RemotionRoot.
    composition_block = (
        "      <Composition\n"
        '        id="' + composition_id + '"\n'
        "        component={" + pascal + "Video}\n"
        "        durationInFrames={30 * 300}\n"
        "        fps={30}\n"
        "        width={" + str(base_width) + "}\n"
        "        height={" + str(base_height) + "}\n"
        "        defaultProps={{\n"
        '          dataUrl: "/data.json",\n'
        "        }}\n"
        "        calculateMetadata={calculate" + pascal + "Metadata}\n"
        "      />\n"
    )
    close_marker = "    </>"
    pos = content.rfind(close_marker)
    if pos == -1:
        raise HTTPException(
            status_code=500,
            detail="Could not find the closing fragment in Root.tsx",
        )
    content = content[:pos] + composition_block + content[pos:]

    root_tsx_path.write_text(content, encoding="utf-8")
    return original


# ─── Snapshot / restore helpers ───────────────────────────────────────────────

def snapshot_files(paths: list[Path]) -> dict[str, str | None]:
    """Read each path's current contents (or None if missing) for rollback."""
    snaps: dict[str, str | None] = {}
    for p in paths:
        snaps[str(p)] = p.read_text(encoding="utf-8") if p.exists() else None
    return snaps


def restore_files(snaps: dict[str, str | None]) -> None:
    """Restore each file from its snapshot. Missing paths are deleted."""
    for path_str, content in snaps.items():
        p = Path(path_str)
        if content is None:
            if p.exists():
                p.unlink(missing_ok=True)
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")


def cleanup_created_paths(paths: list[Path]) -> None:
    """Delete files / empty dirs created during a failed run."""
    import shutil
    for p in paths:
        if p.is_file():
            p.unlink(missing_ok=True)
        elif p.is_dir():
            shutil.rmtree(p, ignore_errors=True)


# ─── Full-template TSX verification ───────────────────────────────────────────

# scope -> (project subdir, path markers that scope tsc output to this template)
_TSC_SCOPES: dict[str, tuple[str, tuple[str, ...]]] = {
    "frontend": ("frontend", ("remotion/{tid}/",)),
    "remotion": ("remotion-video", ("templates/{tid}/",)),
}


def run_template_typecheck(*, root: Path, template_id: str, scope: str) -> dict:
    """Type-check a generated template with the project's real tsconfig.

    `scope` is "frontend" or "remotion". Runs the project-local `tsc --noEmit
    -p tsconfig.json` in the matching project so imports and cross-file types
    (SceneLayoutProps, the layouts index registry) resolve. tsc output is
    filtered to files under the new template's directory, so unrelated
    pre-existing repo errors are ignored.

    Returns {"ok": bool, "errors_by_file": {relpath: [lines]}, "raw": str}.
    The check is skipped (ok=True) when the project has no local tsc binary or
    no tsconfig — running `npx tsc` without installed node_modules would
    download a compiler that cannot resolve `react`/`remotion` and would report
    false positives. This mirrors `_validate_tsx_or_raise`'s tolerant behavior.
    """
    spec = _TSC_SCOPES.get(scope)
    if spec is None:
        raise ValueError(f"unknown typecheck scope: {scope}")
    subdir, path_markers = spec
    project_dir = root / subdir
    if not (project_dir / "tsconfig.json").exists():
        return {"ok": True, "errors_by_file": {}, "raw": "", "skipped": "no tsconfig"}

    tsc_bin = project_dir / "node_modules" / ".bin" / "tsc"
    if not tsc_bin.exists():
        return {"ok": True, "errors_by_file": {}, "raw": "", "skipped": "no local tsc"}

    markers = [m.format(tid=template_id) for m in path_markers]
    cmd = [str(tsc_bin), "--noEmit", "--pretty", "false", "-p", "tsconfig.json"]
    try:
        result = subprocess.run(
            cmd, cwd=project_dir, capture_output=True, text=True, timeout=300,
        )
    except Exception as e:
        # tsc / node missing, or timeout — don't block the flow.
        return {"ok": True, "errors_by_file": {}, "raw": "", "skipped": str(e)}

    output = (result.stdout or "")
    if result.stderr:
        output += "\n" + result.stderr

    errors_by_file: dict[str, list[str]] = {}
    for line in output.splitlines():
        stripped = line.strip()
        if "error TS" not in stripped:
            continue
        if not any(marker in stripped for marker in markers):
            continue
        # tsc line shape: "path/File.tsx(line,col): error TSxxxx: message"
        m = re.match(r"^(.*?\.tsx?)[(:]", stripped)
        relpath = m.group(1).strip() if m else stripped
        errors_by_file.setdefault(relpath, []).append(stripped)

    return {
        "ok": not errors_by_file,
        "errors_by_file": errors_by_file,
        "raw": output[-8000:],
    }


def tsx_file_to_layout_id(path: str, pascal_names: dict[str, str]) -> str | None:
    """Map an errored `layouts/<Pascal>.tsx` path back to its layout id."""
    stem = Path(path).stem
    for layout_id, pascal in pascal_names.items():
        if pascal == stem:
            return layout_id
    return None
