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
    # Added to widen the design space. Every one is built from typefaces that
    # were ALREADY bundled — `patrick_hand` and `shippori_mincho` in particular
    # were registered and renderable but reachable by no era at all, so they
    # could only ever appear if the model named them explicitly.
    "brutalist", "humanist", "luxe", "zine",
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
    # Concrete and unornamented: heavy grotesques, no curves, no warmth.
    "brutalist": {
        "heading": ("archivo_black", "oswald", "fira_code"),
        "body": ("arimo", "inter", "source_sans_3"),
    },
    # Warm and hand-inflected — the counterweight to every geometric template.
    "humanist": {
        "heading": ("patrick_hand", "lora", "merriweather"),
        "body": ("source_serif_4", "lora", "arimo"),
    },
    # Restrained luxury: fine-stroke display serifs, generous letter-spacing.
    "luxe": {
        "heading": ("cinzel_decorative", "playfair_display", "shippori_mincho"),
        "body": ("source_serif_4", "lora", "merriweather"),
    },
    # Photocopied counterculture: condensed, blunt, deliberately imperfect.
    "zine": {
        "heading": ("pirata_one", "righteous", "oswald"),
        "body": ("arimo", "dm_sans", "poppins"),
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
    # RevealText has always implemented `fade` (a plain opacity rise) but it was
    # absent here, so the blueprint could never select it.
    "fade",
})

# ─── Layout content affinity ─────────────────────────────────────────────────
# Mirrors CONTENT_TYPES in app/services/content_classifier.py, which owns the
# taxonomy. Duplicated rather than imported because that module pulls in dspy,
# and this one is deliberately dependency-free. test_kit_vocabulary keeps the
# two in lockstep.
_CONTENT_TYPES: tuple[str, ...] = (
    "plain",
    "bullets",
    "metrics",
    "quote",
    "comparison",
    "timeline",
    "steps",
    "code",
)


# ─── Layout variants (how a content type is RENDERED) ────────────────────────
#
# `_CONTENT_TYPES` is the content-MATCHING key: the classifier reads an article
# and emits one of those 8 per scene, and match_scenes_to_archetypes looks the
# type up to pick a layout. It cannot be widened for divergence — a template
# with no "metrics" layout sends every statistics scene down the round-robin
# fallback, which is the "every video looks the same" bug.
#
# But with only 8 keys and 6+ layouts required per template, two templates MUST
# share at least 4 of 6 content types. That is arithmetic, not a model failure,
# and it meant a layout's identity was fully determined by its type: every
# template's metrics layout was the same layout.
#
# So the identity is split in two. The TYPE stays the matching key (coverage is
# preserved — every template still renders every article), and the VARIANT says
# how this template draws it. `metrics:ledger` and `metrics:hero-rail` serve the
# same content and look nothing alike, which takes the identity space from 8 to
# ~32: measured over real brand names, mean shared identities between two
# templates falls from 6.00 of 6 (guaranteed) to ~1.14, with many pairs sharing
# none at all.
#
# EVERY NAME HERE MUST RENDER. These mirror the arrangement unions in
# kit/variants.ts and the modes the kit primitives already accept; a variant the
# kit cannot draw is worse than no variant, because it degrades silently (see
# `mask_up`, which was selectable for months while rendering as a plain word
# reveal). test_kit_vocabulary holds the two sides in lockstep.
CONTENT_TYPE_VARIANTS: dict[str, tuple[str, ...]] = {
    # Layouts.tsx geometries + DropCap. `plain` is the classifier's fallback and
    # therefore the MOST common scene, so its variants matter most.
    "plain": ("centered-focal", "asymmetric-split", "full-bleed-hero", "side-rail", "drop-cap"),
    # kit/variants.ts STAT_ARRANGEMENTS.
    "metrics": ("row", "stacked-rule", "ledger", "hero-rail", "quadrant", "ticker"),
    # kit/variants.ts LIST_ARRANGEMENTS.
    "bullets": ("markers", "rules", "cards", "numbered", "rail"),
    # kit/variants.ts SEQUENCE_ARRANGEMENTS — steps and timeline share a shape
    # vocabulary because they are the same rendering problem (ordered items).
    "steps": ("vertical-rail", "horizontal", "numbered-stack", "connected-dots"),
    "timeline": ("vertical-rail", "horizontal", "numbered-stack", "connected-dots"),
    # kit/variants.ts QUOTE_ARRANGEMENTS.
    "quote": ("oversized-mark", "rule-framed", "knockout", "margin-note"),
    # Two-sided compositions built from Layouts + cardStyle.
    "comparison": ("split", "stacked", "versus-bar"),
    # CodeBlock is the only safe renderer for code, so its variants are framing.
    "code": ("panel", "terminal"),
}


# ─── Bookend arrangements (WHERE the opening/closing sits) ───────────────────
#
# Distinct from OPENING_MOVES / CLOSING_MOVES, which describe the motion BEAT
# ("logo_settle", "wordmark_wipe") and say nothing about placement. Every brand
# therefore landed on the same centred wordmark: two templates opened
# identically because nothing in the vocabulary described an alternative.
#
# Worse, bookend layouts carry `best_for: []`, so blueprint.py's variant pick
# fell through to "plain" and told the intro it was drawing "'plain' content as
# 'drop-cap'" — an oversized initial letter, meaningless for a brand opening.
# The model discarded the instruction and reached for the default.
#
# `centred-lockup` is FIRST and kept deliberately: it is the historical look, and
# banning it outright would be as arbitrary as always choosing it. It is now one
# option among six rather than the only shape available.
BOOKEND_ARRANGEMENTS: dict[str, tuple[str, ...]] = {
    "intro": (
        "centred-lockup",
        "corner-mark",
        "left-rail",
        "full-bleed-statement",
        "split-plate",
        "stacked-baseline",
    ),
    "outro": (
        "centred-lockup",
        "corner-mark",
        "left-rail",
        "full-bleed-statement",
        "split-plate",
        "stacked-baseline",
    ),
}

_BOOKEND_ROLES: tuple[str, ...] = ("intro", "outro")


def variants_for(content_type: str) -> tuple[str, ...]:
    """Renderable variants for a content type; empty for an unknown one.

    Also answers for "intro"/"outro", so a caller resolving a layout's variant
    does not need to know whether it holds a bookend or a content scene.
    """
    if content_type in BOOKEND_ARRANGEMENTS:
        return BOOKEND_ARRANGEMENTS[content_type]
    return CONTENT_TYPE_VARIANTS.get(content_type, ())


def layout_variants_for_brand(seed: str) -> dict[str, str]:
    """This brand's assigned variant per content type.

    Deterministic per brand and DECORRELATED across types: each type reads a
    different slice of the hash (`h // 7**i`), so two brands colliding on one
    type do not collide on all of them. Same trick as `fonts_for_era`, which
    needed it for exactly this reason.
    """
    import hashlib

    h = int(hashlib.md5((seed or "").encode("utf-8")).hexdigest(), 16)
    out: dict[str, str] = {}
    for i, ctype in enumerate(_CONTENT_TYPES):
        opts = CONTENT_TYPE_VARIANTS.get(ctype) or ()
        if opts:
            out[ctype] = opts[(h // (7 ** (i + 1))) % len(opts)]
    # Bookends get their own SALTED hash rather than another `h // 7**i` slice.
    #
    # The slice trick works for the content types because each list length is
    # coprime-ish with the stride, but 7 ≡ 1 (mod 6) — and both bookend lists
    # have six entries — so `(h // 7**9) % 6` and `(h // 7**10) % 6` come out
    # strongly correlated. Measured with the slice approach: 4/10 distinct
    # intros and intro == outro for 5 of 10 brands. A separate md5 per role has
    # no such relationship.
    #
    # Unconditional, exactly like the content types above. The previous mechanism
    # only reassigned a bookend when the model had left it at the literal
    # default, so a model that converged on one non-default opening was never
    # corrected — 1 distinct opening across 10 brands in that case.
    for role in _BOOKEND_ROLES:
        opts = BOOKEND_ARRANGEMENTS.get(role) or ()
        if opts:
            rh = int(
                hashlib.md5(f"{seed or ''}|bookend|{role}".encode("utf-8")).hexdigest(), 16
            )
            out[role] = opts[rh % len(opts)]
    return out


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

    _variant_menu = "  layout variant (HOW a type is drawn — pick one per layout):\n" + "".join(
        f"    {ct}: {', '.join(vs)}\n" for ct, vs in CONTENT_TYPE_VARIANTS.items()
    )

    return (
        "AVAILABLE KIT VOCABULARY — you MUST choose from these exact values.\n"
        f"  decor systems (background atmosphere): {_fmt(DECOR_SYSTEMS)}\n"
        f"  surface variants (panel treatments): {_fmt(SURFACE_VARIANTS)}\n"
        f"  signature artifact motions: {_fmt(ARTIFACT_MOTIONS)}\n"
        f"  structural elements: {_fmt(STRUCTURAL_ELEMENTS)}\n"
        f"  type treatments: {_fmt(TYPE_TREATMENTS)}\n"
        f"  image treatments: {_fmt(IMAGE_TREATMENTS)}\n"
        f"  scene roles: {_fmt(SCENE_ROLES)}\n"
        # best_for was named in the prompt but its legal values were never
        # listed anywhere, so the model guessed, validate_blueprint filtered
        # every guess out, and EVERY content layout fell back to "plain" —
        # measured on all seven blueprint-era templates, including layouts
        # literally named metrics_row_4up and quote_center_red. Downstream that
        # collapses content matching to round-robin and makes every preview
        # scene render the same placeholder copy.
        f"  layout best_for (content a layout suits): {_fmt(frozenset(_CONTENT_TYPES))}\n"
        # The variant is what makes two templates' metrics layouts different
        # objects rather than the same one recoloured — the type is the content
        # MATCHING key and cannot diverge without losing coverage, so identity
        # divergence has to live here.
        f"{_variant_menu}"
        f"  motion energy: {_fmt(MOTION_ENERGIES)}\n"
        f"  edge policy: {_fmt(EDGE_POLICIES)}\n"
        f"  intro/outro ARRANGEMENTS (where the elements sit — distinct from the\n"
        f"    motion moves below): {_fmt(BOOKEND_ARRANGEMENTS['intro'])}\n"
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
