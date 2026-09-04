"""Render-correctness registries for generated templates.

WHAT THIS IS — AND WHAT IT DELIBERATELY IS NOT
----------------------------------------------
This module holds the four value sets that a generated template MUST stay
inside for the render to work at all:

    FONT_IDS          -> the typefaces actually bundled and loadable
    TRANSITION_FAMILIES -> generatedTransitions.ts presentations
    DECOR_SYSTEMS     -> kit/Decor.tsx      DecorSystem
    SURFACE_VARIANTS  -> kit/cards.tsx      SurfaceVariant

A value outside these sets does not raise — it silently falls through to a
default. A font name outside FONT_IDS resolves to null in resolveFontFamily(),
the raw string is used as a CSS family nothing loaded, and the video renders in
the system sans. That failure mode is why brands with very different identities
all came out looking typographically identical.

THIS FILE IS NEVER RENDERED INTO A PROMPT.
------------------------------------------
Its predecessor (`kit_vocabulary.describe_kit_capabilities`) was, with the
header "AVAILABLE KIT VOCABULARY — you MUST choose from these exact values", and
that is precisely what made every template converge: brands differed by which
cell of a fixed grid they landed in, which is a permutation, not a design.

The design doc now writes fonts, decor and surface FREELY, in prose. This module
only runs afterwards, snapping anything unrenderable back to a real value. It is
a rear-guard, not a menu. Do not add a `describe_*()` helper here, and do not
pass these sets to an LLM.
"""
from __future__ import annotations

import json
from typing import Any

# ─── Bundled typefaces ───────────────────────────────────────────────────────
# Mirrors the font registry the renderer can actually resolve. Anything else
# renders as the system default.
FONT_IDS: frozenset[str] = frozenset({
    "inter", "roboto_slab", "patrick_hand", "arimo", "archivo_black",
    "poppins", "montserrat", "merriweather", "playfair_display", "oswald",
    "lora", "fira_code", "righteous",
    "im_fell_english", "pirata_one", "cinzel_decorative", "dm_sans",
    "source_sans_3", "source_serif_4", "shippori_mincho",
})

DEFAULT_HEADING_FONT = "dm_sans"
DEFAULT_BODY_FONT = "inter"

# ─── Scene-to-scene transitions ──────────────────────────────────────────────
# Mirrors generatedTransitions.ts.
TRANSITION_FAMILIES: frozenset[str] = frozenset({
    "fade",
    "accent_wash",
    "rule_sweep",
    "ink_wash",
    "whip_blur",
    "push_slide",
    "cover_wipe",
    "page_flip",
    "clock_sweep",
    "parallax_push",
    "whip_pan",
    "accent_bar",
    "page_fold",
    "ink_bleed",
})

# A varied default, mirroring DEFAULT_FAMILY in generatedTransitions.ts. Used
# when the design doc supplies too few legal names to give the video variety.
DEFAULT_TRANSITION_FAMILY: tuple[str, ...] = (
    "parallax_push",
    "accent_bar",
    "page_fold",
    "rule_sweep",
    "ink_bleed",
    "clock_sweep",
    "whip_pan",
    "page_flip",
    "fade",
)

# ─── Kit variant pins ────────────────────────────────────────────────────────
# Read at render time (remotion.py) to pin the kit's card surface and data-viz
# backdrop, so the chart/table scenes match the template instead of hardcoding
# "panel" and "grid". Mirrors kit/Decor.tsx and kit/cards.tsx.
#
# NARROW SCOPE — these do NOT style generated scenes. They travel through the
# ambient KitVariantProvider and are read only via useKit(), which a generated
# scene cannot call: scenes draw their own panels and atmosphere from
# props.brandColors. The only remaining readers are DataChartScene /
# DataTableScene, which the pipeline substitutes wholesale.
#
# This is why snapping them is not a return to the old convergence: two
# templates that land on the same decor system share a data-viz backdrop tint,
# not a layout, a type scale or a composition. A scene that wants concentric
# arcs behind its headline simply draws them — there is no <Decor system="..."/>
# to be snapped, because the value never reaches the scene.
DECOR_SYSTEMS: frozenset[str] = frozenset({
    "none",
    "dots",
    "grid",
    "orbs",
    "starfield",
    "rules",
    "vignette",
    "hairlines",
    "mesh",
    "ticker",
    "concentric",
    "wash",
    "halftone",
    "topography",
    "scanlines",
    "weave",
    "noise",
    "columnRules",
    "arcs",
})

SURFACE_VARIANTS: frozenset[str] = frozenset({
    "panel",
    "glass",
    "outline",
    "flat-hairline",
    "embossed",
    "soft",
    "flat",
    "paper",
    "inkwell",
    "tape",
    "ledger",
    "chip",
    "cutout",
})

DEFAULT_DECOR_SYSTEM = "none"
DEFAULT_SURFACE_VARIANT = "panel"


def snap(value: Any, allowed: frozenset[str], fallback: str) -> str:
    """Return `value` if it is a renderable member of `allowed`, else `fallback`.

    Normalises loosely so a doc writing "DM Sans" or "flat hairline" still lands
    on the real id rather than being thrown away — the model is writing prose,
    not picking from a list, so near-misses are expected and worth recovering.
    """
    if not isinstance(value, str):
        return fallback
    raw = value.strip()
    if not raw:
        return fallback
    if raw in allowed:
        return raw
    norm = raw.lower().replace(" ", "_").replace("-", "_")
    if norm in allowed:
        return norm
    # Match against the same normalisation of each allowed value, so
    # "flat-hairline" <-> "flat hairline" <-> "flat_hairline" all resolve.
    for candidate in allowed:
        if candidate.lower().replace("-", "_") == norm:
            return candidate
    return fallback


def snap_transition_family(value: Any) -> list[str]:
    """Filter a transition list down to renderable names.

    Returns the default family when nothing survives — an empty list would make
    every cut fall back to a single hard fade.
    """
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return list(DEFAULT_TRANSITION_FAMILY)
    kept: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        norm = snap(item, TRANSITION_FAMILIES, "")
        if norm and norm not in kept:
            kept.append(norm)
    # A single legal name means every cut in the video is the same transition;
    # top up from the default family rather than shipping that.
    if len(kept) < 2:
        for item in DEFAULT_TRANSITION_FAMILY:
            if item not in kept:
                kept.append(item)
            if len(kept) >= 3:
                break
    return kept


def validate_render_hints(raw: Any) -> dict:
    """Coerce the design doc's `render_hints` into a renderable identity block.

    Returns a dict shaped EXACTLY like the v1 blueprint's `identity` plus
    `transition_family`, because the render path already reads those keys
    (remotion.py pins kitVariant from identity.surface_default/decor_system, and
    template_service.apply_blueprint_to_theme folds in the fonts and
    transitions). Keeping the shape is what lets v1 and v2 templates share one
    render path with no migration.

    Never raises: a design doc that omitted or mangled this must still yield a
    renderable template.
    """
    data: Any = raw
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except (ValueError, TypeError):
            data = {}
    if not isinstance(data, dict):
        data = {}

    return {
        "identity": {
            "heading_font": snap(
                data.get("heading_font"), FONT_IDS, DEFAULT_HEADING_FONT
            ),
            "body_font": snap(data.get("body_font"), FONT_IDS, DEFAULT_BODY_FONT),
            "surface_default": snap(
                data.get("surface_default"), SURFACE_VARIANTS, DEFAULT_SURFACE_VARIANT
            ),
            "decor_system": snap(
                data.get("decor_system"), DECOR_SYSTEMS, DEFAULT_DECOR_SYSTEM
            ),
        },
        "transition_family": snap_transition_family(data.get("transition_family")),
    }
