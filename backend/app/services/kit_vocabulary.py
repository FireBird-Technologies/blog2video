"""The craft kit's renderable vocabulary, as Python constants.

This is the GROUNDING for blueprint generation. Without it the model happily
invents `decorSystem: "brutalist"` or `artifactMotion: "kaleidoscope"`, which
silently falls through to a default at render time — the brand asked for a
distinct motif and got the generic one, with nothing in the logs to say so.

Every value here MUST exist as a branch in the corresponding TypeScript union:

    DECOR_SYSTEMS     -> kit/Decor.tsx      DecorSystem
    SURFACE_VARIANTS  -> kit/cards.tsx      SurfaceVariant
    ARTIFACT_MOTIONS  -> kit/Artifacts.tsx  ArtifactMotion + SignatureArtifact cases
    STRUCTURAL_ELEMENTS -> kit/Structure.tsx exported components

test_kit_vocabulary.py parses those files and asserts the sets match, so this
cannot drift from what the kit can actually draw.
"""
from __future__ import annotations

# ─── Decor systems (background atmosphere) ───────────────────────────────────
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
    # P1 additions
    "halftone",
    "topography",
    "scanlines",
    "weave",
    "noise",
    "columnRules",
    "arcs",
})

# ─── Surface variants (panel treatments) ─────────────────────────────────────
SURFACE_VARIANTS: frozenset[str] = frozenset({
    "panel",
    "glass",
    "outline",
    "flat-hairline",
    "embossed",
    "soft",
    "flat",
    # P1 additions
    "paper",
    "inkwell",
    "tape",
    "ledger",
    "chip",
    "cutout",
})

# ─── Signature artifact motions (the brand's recurring animated motif) ───────
ARTIFACT_MOTIONS: frozenset[str] = frozenset({
    "sweep",
    "streak",
    "draw-in",
    "tick",
    "drift",
    "bloom",
    "float",
    "slam",
    "pulse",
    "build",
    "rule-slide",
    "shards",
    "halftone",
    "spin",
    "stamp",
    "dust",
    "orbit",
    # P1 additions
    "unfold",
    "typeset",
    "scanline",
    "ripple",
    "shatter-in",
    "stack",
    "trace",
    "marquee",
})

# ─── Structural elements (chrome / editorial framing) ────────────────────────
# Blueprint layouts name these in `structural_elements`; the scene generator is
# told to render the matching component.
STRUCTURAL_ELEMENTS: frozenset[str] = frozenset({
    "masthead",
    "section_divider",
    "drop_cap",
    "panel_number",
    "editorial_rule",
    "kicker",
})

# Blueprint element name -> kit component, for prompt rendering and for the
# reward function's blueprint-adherence check.
STRUCTURAL_COMPONENT: dict[str, str] = {
    "masthead": "Masthead",
    "section_divider": "SectionDivider",
    "drop_cap": "DropCap",
    "panel_number": "PanelNumber",
    "editorial_rule": "EditorialRule",
    "kicker": "Kicker",
}

# ─── Type treatments ─────────────────────────────────────────────────────────
# Keys of the _type_hint map in code_generator._build_brand_context.
TYPE_TREATMENTS: frozenset[str] = frozenset({
    "tight-sans",
    "editorial-serif",
    "display-serif",
    "rounded-sans",
    "display-bold",
    "clean-sans",
})

# ─── Typefaces ───────────────────────────────────────────────────────────────
# Every id here MUST exist in remotion-video/src/fonts/registry.ts. Anything else
# is unrenderable: resolveFontFamily() returns null, GeneratedVideo falls back to
# the raw string as a bare CSS family, that family was never loaded, and the
# video silently renders in the system sans. That failure mode is why brands with
# wildly different identities all came out looking the same — the theme extractor
# was free to invent names like "Cormorant Garamond" that were never bundled.
#
# test_font_vocabulary parses registry.ts and asserts these sets match, so they
# cannot drift.
FONT_IDS: frozenset[str] = frozenset({
    "inter", "roboto_slab", "patrick_hand", "arimo", "archivo_black",
    "poppins", "montserrat", "merriweather", "playfair_display", "oswald",
    "lora", "fira_code", "righteous",
    "im_fell_english", "pirata_one", "cinzel_decorative", "dm_sans",
    "source_sans_3", "source_serif_4", "shippori_mincho",
})

# ─── Eras ────────────────────────────────────────────────────────────────────
# The visual period a template belongs to. This is the axis that makes two
# templates read as genuinely different designs rather than one design recoloured
# — it drives the TYPEFACE above all, because type is what the eye reads as
# "vintage" or "modern" long before decor or layout register.
#
# Each era names heading candidates (the expressive slot) and body candidates
# (the readable slot). Heading lists are ordered: index 0 is the safest choice.
ERAS: frozenset[str] = frozenset({
    "vintage", "editorial", "modern", "technical", "expressive",
})

ERA_FONTS: dict[str, dict[str, tuple[str, ...]]] = {
    # Pre-war print: letterpress serifs, inscriptional caps, blackletter.
    "vintage": {
        "heading": ("im_fell_english", "cinzel_decorative", "pirata_one"),
        "body": ("lora", "source_serif_4", "merriweather"),
    },
    # Broadsheet / magazine: high-contrast display serifs over a text serif.
    "editorial": {
        "heading": ("playfair_display", "merriweather", "roboto_slab"),
        "body": ("source_serif_4", "lora", "arimo"),
    },
    # Contemporary product/marketing: geometric and neo-grotesque sans.
    "modern": {
        "heading": ("dm_sans", "poppins", "montserrat"),
        "body": ("inter", "source_sans_3", "dm_sans"),
    },
    # Engineering / data: monospace and tight grotesques.
    "technical": {
        "heading": ("fira_code", "archivo_black", "oswald"),
        "body": ("source_sans_3", "inter", "arimo"),
    },
    # Loud, characterful, poster-like.
    "expressive": {
        "heading": ("righteous", "archivo_black", "oswald"),
        "body": ("poppins", "dm_sans", "inter"),
    },
}


def fonts_for_era(era: str, seed: str = "") -> tuple[str, str]:
    """(heading, body) font ids for an era, varied deterministically by brand.

    Two brands sharing an era should not be forced onto the same typeface, so the
    pick rotates on a hash of the seed. Falls back to `modern` for an unknown era
    rather than raising — this feeds template generation, which must not break.
    """
    import hashlib

    spec = ERA_FONTS.get(era) or ERA_FONTS["modern"]
    if not seed:
        return spec["heading"][0], spec["body"][0]
    h = int(hashlib.md5(seed.encode("utf-8")).hexdigest(), 16)
    heads, bodies = spec["heading"], spec["body"]
    return heads[h % len(heads)], bodies[(h // 7) % len(bodies)]

# ─── Layout-level enums ──────────────────────────────────────────────────────
IMAGE_TREATMENTS: frozenset[str] = frozenset({
    "split",
    "full_bleed",
    "inset_card",
    "masked",
    "none",
})

# Scene roles a blueprint layout may declare. intro/content/outro map to the
# existing sceneType values; the rest ride as content variants carrying a role
# tag (see the plan's §H) so they need no new runtime plumbing.
SCENE_ROLES: frozenset[str] = frozenset({
    "intro",
    "content",
    "outro",
    "section_divider",
    "chapter_card",
    "statement",
    "data_spotlight",
})

MOTION_ENERGIES: frozenset[str] = frozenset({"calm", "smooth", "energetic"})

EDGE_POLICIES: frozenset[str] = frozenset({"inset", "edge_to_edge", "mixed"})

OPENING_MOVES: frozenset[str] = frozenset({
    "logo_settle",
    "wordmark_wipe",
    "type_set",
    "cover_reveal",
    "rule_draw",
    "photo_push",
    "cold_open_statement",
})

CLOSING_MOVES: frozenset[str] = frozenset({
    "recap_card",
    "wordmark_lockup",
    "statement_hold",
    "rule_close",
    "fade_to_mark",
    "full_bleed_sign_off",
})

TITLE_REVEALS: frozenset[str] = frozenset({
    "blur",
    "word",
    "line",
    "char",
    "typewriter",
    "mask_up",
})

# ─── Scene-to-scene transitions ──────────────────────────────────────────────
# Must match the GeneratedTransitionFamily union in
# remotion-video/src/templates/generated/generatedTransitions.ts. A name outside
# this set falls through that module's `default:` arm and renders a plain fade —
# so an unvalidated hallucination makes EVERY cut in the video identical, which
# is exactly what "all my scenes use the same transition" looks like.
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
    # richer palette-driven presentations
    "parallax_push",
    "whip_pan",
    "accent_bar",
    "page_fold",
    "ink_bleed",
})

# A varied default, mirroring DEFAULT_FAMILY in generatedTransitions.ts. Used
# when a blueprint supplies too few legal names to give the video variety.
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


def describe_kit_capabilities() -> str:
    """Render the vocabulary as prompt text.

    Fed to the blueprint stage so the model designs against what the kit can
    actually draw instead of inventing unrenderable names.
    """
    def _fmt(values: frozenset[str]) -> str:
        return ", ".join(sorted(values))

    return (
        "AVAILABLE KIT VOCABULARY — you MUST choose from these exact values.\n"
        f"  decor systems (background atmosphere): {_fmt(DECOR_SYSTEMS)}\n"
        f"  surface variants (panel treatments): {_fmt(SURFACE_VARIANTS)}\n"
        f"  signature artifact motions: {_fmt(ARTIFACT_MOTIONS)}\n"
        f"  structural elements: {_fmt(STRUCTURAL_ELEMENTS)}\n"
        f"  type treatments: {_fmt(TYPE_TREATMENTS)}\n"
        f"  image treatments: {_fmt(IMAGE_TREATMENTS)}\n"
        f"  scene roles: {_fmt(SCENE_ROLES)}\n"
        f"  motion energy: {_fmt(MOTION_ENERGIES)}\n"
        f"  edge policy: {_fmt(EDGE_POLICIES)}\n"
        f"  intro opening moves: {_fmt(OPENING_MOVES)}\n"
        f"  outro closing moves: {_fmt(CLOSING_MOVES)}\n"
        f"  title reveals: {_fmt(TITLE_REVEALS)}\n"
        f"  transition families (scene-to-scene): {_fmt(TRANSITION_FAMILIES)}\n"
        f"  eras: {_fmt(ERAS)}\n"
        "  bundled typefaces (identity.heading_font / identity.body_font) — any\n"
        "  other name cannot be loaded and renders as the system default:\n"
        f"    {_fmt(FONT_IDS)}\n"
        + "  each era's own typefaces:\n"
        + "".join(
            f"    {era}: heading {', '.join(spec['heading'])} | body {', '.join(spec['body'])}\n"
            for era, spec in sorted(ERA_FONTS.items())
        )
    )
