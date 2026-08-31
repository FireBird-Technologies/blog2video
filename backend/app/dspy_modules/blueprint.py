"""Design Blueprint — per-brand template design, authored before any scene code.

WHY THIS EXISTS
---------------
Custom templates all looked alike because every brand walked the same decision
tree, not because the model was incapable of variety:

  * `_COMPOSITIONS` offered five fixed geometries ("centered focal",
    "asymmetric split", ...). The brand-seeded shuffle permuted their ORDER, so
    two brands differed by sequence while sharing one vocabulary.
  * Intro/outro were harder-coded still: a mandated <IntroStage> scaffold, a
    reward penalty for not using RevealText, and artifacts picked by fixed index
    (`artifact_set[0]` for intro, `[-1]` for outro).
  * A ~370-line prompt handed every brand the same recipes — 50/50 splits, a
    6-8% safe area, a content-type -> kit-component table.

This module moves authorship UP one level. An LLM designs the template's own
layouts, structure, type system and safe-area policy; the scene generator then
EXECUTES that blueprint rather than a house style.

SAFETY
------
The stage can never make generation fail. Output is schema-validated and
REPAIRED (unknown vocabulary snaps to real kit values, numbers clamp to safe
ranges). If the LLM fails twice, `fallback_blueprint()` synthesises one from the
existing deterministic signature engine — i.e. today's behaviour.
"""
from __future__ import annotations

import contextvars
import hashlib
import json
import re
import time
from typing import Any

import dspy

from app.dspy_modules import ensure_dspy_configured, get_blueprint_lm
from app.services.kit_vocabulary import (
    CONTENT_TYPE_VARIANTS,
    layout_variants_for_brand,
    variants_for,
    ARTIFACT_MOTIONS,
    CLOSING_MOVES,
    DECOR_SYSTEMS,
    DEFAULT_TRANSITION_FAMILY,
    EDGE_POLICIES,
    ERAS,
    FONT_IDS,
    IMAGE_TREATMENTS,
    MOTION_ENERGIES,
    OPENING_MOVES,
    SCENE_ROLES,
    STRUCTURAL_ELEMENTS,
    SURFACE_VARIANTS,
    TITLE_REVEALS,
    TRANSITION_FAMILIES,
    TYPE_TREATMENTS,
    describe_kit_capabilities,
    fonts_for_era,
)

# The content-type taxonomy the classifier emits. A blueprint layout's
# `best_for` MUST use these values or content-aware scene matching silently
# degrades to round-robin — a coupling that was previously unenforced.
from app.services.content_classifier import CONTENT_TYPES

BLUEPRINT_VERSION = 1

MIN_GEOMETRY_CHARS = 60
MAX_GEOMETRY_CHARS = 600
MIN_CONTENT_LAYOUTS = 4
MAX_LAYOUTS = 10

# Most blog scenes carry an image. If a blueprint marks nearly everything
# image-incapable the pipeline has nowhere to put the images it selected, so we
# force a floor.
MIN_IMAGE_CAPABLE_FRACTION = 0.6


# ─── DSPy signature ──────────────────────────────────────────────────────────


class GenerateDesignBlueprint(dspy.Signature):
    """Design a COMPLETE, ORIGINAL video template for one specific brand.

    You are the art director. Everything about how this brand's videos look is
    yours to decide — the layouts, the chrome, the type system, how far content
    sits from the frame edge. Two different brands must produce visibly
    different templates, not the same template recoloured.

    Design FROM THE EVIDENCE in brand_context: its palette, fonts, card
    treatment, spacing density, decorative elements and category. A dense
    fintech dashboard and a warm food blog should not converge.

    LAYOUTS (the core of the design)
    - REQUIRED COUNT: exactly ONE layout with role "intro", exactly ONE with
      role "outro", and EXACTLY the number of content layouts named in the
      design constraints below — that count is chosen for THIS brand and is not
      negotiable. Do not round it toward the smallest allowed number: a template
      that always ships the minimum is a template that made no decision about
      its own length. Count them before you answer.
    - The layouts go in a top-level JSON array named exactly "layouts". Each
      entry is an OBJECT, and each needs its own `id`: a short semantic slug
      naming what THIS layout is for, in your own words — not a positional
      label. An entry without an id is auto-numbered "layout_0", "layout_1",
      which tells the scene generator nothing about the layout's purpose.
      Name it after the design you actually made, not after a category.
    - Each also needs a `variant`: HOW this layout draws its content type,
      chosen from the layout-variant menu in kit_capabilities. Two templates
      may both need a metrics layout; the variant is what stops them being the
      same layout. Your assigned variants are in the design constraints below —
      design each layout AROUND its variant.
    - Each needs a `geometry`: a concrete, specific description of where things
      sit, in your own words. Not "a split layout" — say which side, what
      proportion, what separates them, where the eyebrow and the focal element
      go. This is the instruction a developer will build from, so vague geometry
      produces a vague scene. Anything under 60 characters is discarded.
    - `geometry_portrait` says how it RE-COMPOSES for a tall 1080x1920 frame.
      A landscape side-by-side reused verbatim in portrait becomes an unreadable
      strip, so genuinely re-think it (usually stacking, fewer items, larger type).
    - Every layout COMPOSES OUTWARD FROM ITS CENTRE. The item count is not known
      when you design it — the same layout renders two metrics and five — so say
      where the group sits as a whole and let it grow symmetrically from there.
      A geometry that only works at its maximum item count leaves a lopsided
      frame at every smaller one. An asymmetric layout is still centred as a
      composition: the RAIL sits on an edge, the content group does not.
    - Give the content layouts DIFFERENT geometry from one another. Two layouts
      may share a `best_for` (two "bullets" scenes is fine) as long as they are
      genuinely composed differently — a bullet list in a ruled sidebar is not
      the same scene as one over a full-bleed image.
    - `best_for` says WHAT KIND OF CONTENT each layout is built to hold, and it
      must come from the content-type list in kit_capabilities. Any other value
      is discarded and the layout silently falls back to "plain", which makes
      every scene interchangeable and every preview render the same placeholder
      copy. Match it to the content the layout actually holds — statistics are
      ["metrics"], a testimonial is ["quote"], an ordered list is ["steps"].
      ACROSS the content layouts, cover at least THREE different
      content types — a template whose layouts are all "plain" cannot match
      content to a layout and will reuse the same scene shape throughout.
    - `supports_image`: true if the layout has a place for a content image.
      Most content layouts should. Set false for layouts built around text,
      numbers or a full-bleed colour field. The OUTRO is always false.

    ERA + TYPEFACE (what makes two templates read as different DESIGNS rather
    than one design recoloured — decide this first, it drives everything else)
    - `identity.era` is one of: vintage, editorial, modern, technical,
      expressive, brutalist, humanist, luxe, zine. Choose from the brand's actual
      character, not its industry: a heritage publisher is vintage, a broadsheet
      is editorial, a developer tool is technical, a streetwear label is
      expressive, an architecture studio is brutalist, a craft/wellness brand is
      humanist, a jeweller is luxe, an indie music label is zine. "modern" is the
      right answer when the evidence genuinely says so — never the safe default.
    - The era selects this template's TYPEFACE, which is what a viewer reads as
      period before any layout or colour registers. Vintage gets letterpress and
      inscriptional faces; technical gets monospace and tight grotesques.
    - You may name `identity.heading_font` / `identity.body_font` explicitly, but
      ONLY from the bundled typefaces listed in kit_capabilities. Any other name
      cannot be loaded and renders as the system default — so an invented font
      name silently makes your template look like every other one. Leave them out
      to take the era's own pick.

    TYPE SYSTEM (`type_system` — the sizes every scene is built from. These keys
    were being parsed but never described, so they fell through to defaults and
    every template shipped the same scale.)
    - `base_body_px_landscape` / `base_body_px_portrait`: the BODY size in px,
      28-72. Everything else is derived from it, including the supporting copy in
      cards and lists, so this single number sets the density of the whole
      template. Portrait is a 1080-wide frame — its base is normally a little
      SMALLER than landscape, never larger.
    - `scale_ratio`: 1.1-1.7. The step between body and headline. A tight
      editorial scale is ~1.2; an expressive brand with a huge display headline
      is ~1.5+. The headline is body x ratio^3, then clamped to what the frame
      can hold.
    - `heading_case`: sentence | upper | title. `label_case`: upper | small-caps.
    - `heading_tracking_em` (-0.05 to 0.2) and `label_tracking_em` (0 to 0.3):
      letter-spacing. Display type usually tightens; small caps labels open up.
    - `type_treatment`: one of the treatments in kit_capabilities.
    - `numeral_style`: tabular | proportional.

    STRUCTURE (what repeats across every scene — this is what makes it a
    TEMPLATE rather than nine unrelated cards)
    - Decide whether this brand has persistent chrome (a masthead), section
      dividers, panel numbering, drop caps.
    - `safe_area` is YOUR choice per orientation, in percent. An editorial brand
      might inset 9% at the sides; a bold brand might go 3% and let things bleed.

    BOOKENDS
    - The intro and outro are designed on their OWN terms. Do not default to a
      loud opening and a quiet close — that arc suits some brands and not
      others. A measured open and an emphatic close is equally valid.
    - The intro and outro must not use the same artifact motion.
    - `opening_move` and `closing_move` are a BRAND DECISION, and they are the
      first and last thing a viewer sees. "logo_settle" and "recap_card" are the
      two most overused answers in the vocabulary — reach for them only when the
      brand genuinely calls for them, and pick from the full list otherwise: a
      cold open on a statement, type setting itself, a rule drawing across, a
      photo push, a full-bleed sign-off, a wordmark lockup. Two templates that
      open and close the same way read as the same template.

    Ground every vocabulary choice in kit_capabilities. A value outside those
    lists cannot be rendered and will be replaced.

    Honour user_brief when non-empty: it is the user telling you what they want,
    and it outranks your own inference from the brand evidence.

    Output ONLY the JSON object, no prose or code fences.
    """

    brand_context: str = dspy.InputField(
        desc="Brand evidence: name, palette, fonts, style, visual patterns, category, personality."
    )
    user_brief: str = dspy.InputField(
        desc="The user's own description of the template they want (may be empty). Honour it over inference."
    )
    kit_capabilities: str = dspy.InputField(
        desc="The exact vocabulary values that can be rendered. Choosing outside these is an error."
    )
    design_constraints: str = dspy.InputField(
        desc=(
            "Hard design requirements for THIS brand (may be empty). They are chosen to push "
            "this template off the generic default, so satisfy them even where your instinct "
            "says a more conventional choice would be safer — conventional is the failure mode "
            "here. They rank below user_brief and above your own inference."
        ),
        default="",
    )
    design_note: str = dspy.OutputField(
        desc=(
            "AT MOST 3 SHORT LINES naming the design decisions you are about to make: the "
            "brand's character, the structural idea that carries it, and how the layouts "
            "differ from one another. Then STOP and write blueprint_json. This replaces "
            "free-form chain-of-thought deliberately — an unbounded rationale consumed the "
            "output budget before the JSON was ever written. Do not restate the schema, do "
            "not enumerate the layouts here, do not think out loud."
        )
    )
    blueprint_json: str = dspy.OutputField(
        desc="The complete blueprint as a single JSON object matching the documented schema."
    )


# ─── Parsing helpers ─────────────────────────────────────────────────────────


def _extract_json_object(raw: str) -> dict:
    """Parse a JSON object from LLM output, tolerating fences and stray prose.

    Mirrors _extract_json_array in code_generator.py: strip a leading fence,
    then if a plain parse fails, slice from the first '{' to its matching '}'
    (brace-depth aware, skipping braces inside strings).
    """
    s = (raw or "").strip()
    if s.startswith("```"):
        nl = s.find("\n")
        if nl != -1:
            s = s[nl + 1 :]
        if s.rstrip().endswith("```"):
            s = s.rstrip()[:-3]
    s = s.strip()

    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass

    start = s.find("{")
    if start == -1:
        raise json.JSONDecodeError("no JSON object found", s, 0)
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(s)):
        ch = s[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(s[start : i + 1])
    raise json.JSONDecodeError("unterminated JSON object", s, start)


def _pick(value: Any, allowed: frozenset[str], fallback: str, repairs: list[str], field: str) -> str:
    """Coerce a value into an allowed vocabulary, recording genuine repairs.

    An OMITTED optional field quietly takes the fallback — that is normal and
    not worth reporting. Only a value the model actually supplied and got wrong
    is recorded, so the repair list stays a real signal about hallucinated
    vocabulary rather than a list of defaults.
    """
    v = str(value or "").strip()
    if v in allowed:
        return v
    if v:
        repairs.append(f"{field}={v!r} not renderable -> {fallback!r}")
    return fallback


def _clamp(value: Any, lo: float, hi: float, default: float) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


# Words that reliably identify a content type in a layout's own id or geometry.
# Ordered most-specific first so "stat_spotlight" reads as metrics, not plain.
_BEST_FOR_HINTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("metrics", ("metric", "stat", "number", "kpi", "figure", "percent", "counter")),
    ("quote", ("quote", "testimonial", "pull_quote", "pullquote", "voices", "said")),
    ("timeline", ("timeline", "journey", "milestone", "roadmap", "history", "chronolog")),
    ("steps", ("step", "how_it_works", "howitworks", "process", "workflow", "stage")),
    ("comparison", ("compare", "comparison", "versus", "_vs_", "before_after", "tier")),
    ("bullets", ("bullet", "list", "feature", "checklist", "points", "benefits")),
    ("code", ("code", "snippet", "terminal", "console", "api")),
)


def _infer_best_for(layout_id: str, geometry: str) -> list[str]:
    """Guess a layout's content affinity from how it describes itself.

    Used only when the model supplied no renderable `best_for`. The id is far
    more reliable than the geometry prose, so it is checked first and alone
    where it matches — geometry mentions "numbers" in passing all the time.
    Returns [] when nothing matches, leaving the caller's "plain" default.
    """

    def _hit(haystack: str, needle: str) -> bool:
        # The needle must be a WHOLE WORD (allowing a plural/verb suffix), not a
        # bare substring: "stat" otherwise fires inside "station_steps" and
        # labels a how-it-works layout as metrics.
        return (
            re.search(rf"(?:^|[^a-z]){re.escape(needle)}(?:s|es|ing|ed)?(?:[^a-z]|$)", haystack)
            is not None
        )

    hay_id = (layout_id or "").lower()
    for content_type, needles in _BEST_FOR_HINTS:
        if any(_hit(hay_id, n) for n in needles):
            return [content_type]
    hay_geo = (geometry or "").lower()
    for content_type, needles in _BEST_FOR_HINTS:
        if any(_hit(hay_geo, n) for n in needles):
            return [content_type]
    return []


def _slug(value: Any, fallback: str) -> str:
    s = re.sub(r"[^a-z0-9_]+", "_", str(value or "").strip().lower()).strip("_")
    return s or fallback


# ─── Validation / repair ─────────────────────────────────────────────────────


def validate_blueprint(raw: dict, *, seed: str = "") -> tuple[dict, list[str]]:
    """Coerce an LLM blueprint into a renderable one.

    Repairs rather than raises: an unusable value is replaced and recorded. Only
    a structurally hopeless blueprint (no usable layouts) raises ValueError, so
    the caller can retry.
    """
    repairs: list[str] = []
    bp: dict[str, Any] = {"version": BLUEPRINT_VERSION}
    # This brand's assigned layout variants — the fallback when the model omits
    # or invents a `variant`. Seeded, so an omission still lands on THIS
    # template's rendering rather than a shared default.
    _brand_variants = layout_variants_for_brand(seed) if seed else {}

    # A model that skips the wrapper object and returns the layouts array bare
    # has still done the design work. Wrap it rather than discarding the answer.
    if isinstance(raw, list):
        raw = {"layouts": raw}
        repairs.append("top-level array wrapped as {'layouts': [...]}")
    if not isinstance(raw, dict):
        raw = {}

    # `x or {}` guards None and {} but NOT a truthy non-dict. A model that writes
    # `"chrome": true` (a natural shorthand for "yes, this template has chrome")
    # sailed past that guard and crashed the whole generation with
    # "'bool' object has no attribute 'get'" — observed on template 135. This
    # stage repairs bad input by contract; it must never raise on it.
    #
    # A bare `true` is read as "enabled", which is what the model meant.
    def _node(value: Any) -> dict:
        if isinstance(value, dict):
            return value
        if value is True:
            return {"enabled": True}
        return {}

    # ── identity ──
    ident = _node(raw.get("identity"))
    artifacts_in = [a for a in (ident.get("artifact_set") or []) if isinstance(a, str)]
    artifact_set = [a for a in artifacts_in if a in ARTIFACT_MOTIONS]
    if not artifact_set:
        # Deterministic per-brand pick so the fallback still differs by brand.
        ordered = sorted(ARTIFACT_MOTIONS)
        h = int(hashlib.md5((seed or "brand").encode()).hexdigest(), 16)
        artifact_set = [ordered[h % len(ordered)]]
        repairs.append("identity.artifact_set had no renderable motions -> brand-seeded pick")
    # The era drives the TYPEFACE, which is what the eye reads as "vintage" or
    # "modern" long before decor or layout register. Brand-seeded so two brands in
    # the same era still get different faces.
    era = _pick(ident.get("era"), ERAS, "modern", repairs, "identity.era")
    heading_font, body_font = fonts_for_era(era, seed or str(ident.get("name") or ""))
    # An explicitly named font is honoured ONLY if it is actually bundled.
    # Unbundled names are the core sameness bug: resolveFontFamily() returns null,
    # the raw string is used as a CSS family, nothing loaded it, and the render
    # silently falls back to the system sans — so every brand looked alike.
    for _slot, _default in (("heading_font", heading_font), ("body_font", body_font)):
        _asked = ident.get(_slot)
        if isinstance(_asked, str) and _asked.strip():
            _norm = _asked.strip().lower().replace(" ", "_").replace("-", "_")
            if _norm in FONT_IDS:
                if _slot == "heading_font":
                    heading_font = _norm
                else:
                    body_font = _norm
            else:
                repairs.append(
                    f"identity.{_slot}={_asked!r} is not a bundled typeface -> "
                    f"{_default!r} (an unbundled font renders as the system default)"
                )

    bp["identity"] = {
        "name": str(ident.get("name") or "Custom Template")[:80],
        "thesis": str(ident.get("thesis") or "")[:400],
        "era": era,
        "heading_font": heading_font,
        "body_font": body_font,
        "decor_system": _pick(ident.get("decor_system"), DECOR_SYSTEMS, "rules", repairs, "identity.decor_system"),
        "surface_default": _pick(ident.get("surface_default"), SURFACE_VARIANTS, "panel", repairs, "identity.surface_default"),
        "artifact_set": artifact_set[:4],
        "motion_energy": _pick(ident.get("motion_energy"), MOTION_ENERGIES, "smooth", repairs, "identity.motion_energy"),
    }

    # ── structure ──
    st = _node(raw.get("structure"))
    chrome = _node(st.get("chrome"))
    dividers = _node(st.get("section_dividers"))
    numbering = _node(st.get("panel_numbering"))
    dropcaps = _node(st.get("drop_caps"))
    safe = _node(st.get("safe_area"))

    def _inset(node: Any, default: dict[str, float]) -> dict[str, float]:
        node = node if isinstance(node, dict) else {}
        return {
            side: _clamp(node.get(side), 2.0, 14.0, default[side])
            for side in ("top", "right", "bottom", "left")
        }

    bp["structure"] = {
        "chrome": {
            "enabled": bool(chrome.get("enabled", False)),
            "position": "bottom" if str(chrome.get("position")) == "bottom" else "top",
            "left": str(chrome.get("left") or "brandName"),
            "right": str(chrome.get("right") or "none"),
            "rule": str(chrome.get("rule")) if str(chrome.get("rule")) in ("hairline", "solid", "none") else "hairline",
        },
        "section_dividers": {
            "enabled": bool(dividers.get("enabled", False)),
            "variant": str(dividers.get("variant")) if str(dividers.get("variant")) in ("rule", "numeral", "wordmark", "wipe") else "rule",
        },
        "panel_numbering": {
            "enabled": bool(numbering.get("enabled", False)),
            "style": str(numbering.get("style")) if str(numbering.get("style")) in ("roman", "padded", "plain") else "padded",
            "corner": str(numbering.get("corner")) if str(numbering.get("corner")) in ("tl", "tr", "bl", "br") else "tr",
        },
        "drop_caps": {
            "enabled": bool(dropcaps.get("enabled", False)),
            "applies_to": [str(x) for x in (dropcaps.get("applies_to") or []) if isinstance(x, str)][:10],
        },
        "edge_policy": _pick(st.get("edge_policy"), EDGE_POLICIES, "inset", repairs, "structure.edge_policy"),
        "safe_area": {
            "landscape": _inset(safe.get("landscape"), {"top": 6.0, "right": 8.0, "bottom": 6.0, "left": 8.0}),
            "portrait": _inset(safe.get("portrait"), {"top": 8.0, "right": 6.0, "bottom": 8.0, "left": 6.0}),
        },
    }

    # ── type system ──
    ts = _node(raw.get("type_system"))
    bp["type_system"] = {
        "scale_ratio": _clamp(ts.get("scale_ratio"), 1.1, 1.7, 1.25),
        "heading_case": str(ts.get("heading_case")) if str(ts.get("heading_case")) in ("sentence", "upper", "title") else "sentence",
        "heading_tracking_em": _clamp(ts.get("heading_tracking_em"), -0.05, 0.2, -0.01),
        "label_case": str(ts.get("label_case")) if str(ts.get("label_case")) in ("upper", "small-caps") else "upper",
        "label_tracking_em": _clamp(ts.get("label_tracking_em"), 0.0, 0.3, 0.12),
        # Floor of 28 preserves the old "at least 30-36px" mandate as DATA
        # rather than prose, so the readability floor survives prompt surgery.
        "base_body_px_landscape": int(_clamp(ts.get("base_body_px_landscape"), 28, 72, 36)),
        "base_body_px_portrait": int(_clamp(ts.get("base_body_px_portrait"), 28, 72, 34)),
        "type_treatment": _pick(ts.get("type_treatment"), TYPE_TREATMENTS, "clean-sans", repairs, "type_system.type_treatment"),
        "numeral_style": "proportional" if str(ts.get("numeral_style")) == "proportional" else "tabular",
    }

    # ── layouts ──
    #
    # The key name is resolved by ALIAS, not just by exact match. The prompt
    # specifies the schema in prose, and a model that lands on "scenes" or
    # returns the array bare has designed a perfectly good template that would
    # otherwise be thrown away for naming it wrong — measured as a failed first
    # attempt that then burned a second 60-90s call. Idempotent: after the first
    # pass `raw` is already normalised, so the re-validation inside
    # enforce_brand_constraints resolves the canonical key and adds no repair.
    layouts_in = raw.get("layouts")
    if not isinstance(layouts_in, list) or not layouts_in:
        _alias = None
        for _k in ("scenes", "layout", "scene_layouts", "template_layouts"):
            _v = raw.get(_k)
            if isinstance(_v, list) and _v:
                layouts_in, _alias = _v, _k
                break
        if _alias:
            repairs.append(f'top-level {_alias!r} read as "layouts"')
    if not isinstance(layouts_in, list) or not layouts_in:
        raise ValueError("blueprint has no layouts")

    layouts: list[dict] = []
    seen_ids: set[str] = set()
    _non_dict = 0
    for i, entry in enumerate(layouts_in):
        # A stringified entry is recoverable — models sometimes JSON-encode the
        # elements of an array they were asked to fill with objects.
        if isinstance(entry, str):
            try:
                _decoded = json.loads(entry)
            except (ValueError, TypeError):
                _decoded = None
            if isinstance(_decoded, dict):
                entry = _decoded
        if not isinstance(entry, dict):
            # Silently dropping these made the downstream "model returned too
            # few" message a lie: a model returning twelve strings looked
            # identical to one returning nothing.
            _non_dict += 1
            repairs.append(f"layout[{i}] was a {type(entry).__name__}, not an object — dropped")
            continue
        geometry = str(entry.get("geometry") or "").strip()
        if len(geometry) < MIN_GEOMETRY_CHARS:
            repairs.append(f"layout[{i}] geometry too vague ({len(geometry)} chars) — dropped")
            continue

        lid = _slug(entry.get("id"), f"layout_{i}")
        while lid in seen_ids:
            lid = f"{lid}_x"
        seen_ids.add(lid)

        role = _pick(entry.get("role"), SCENE_ROLES, "content", repairs, f"layout[{lid}].role")
        best_for = [b for b in (entry.get("best_for") or []) if isinstance(b, str) and b in CONTENT_TYPES]
        if not best_for and role == "content":
            # Infer from what the layout calls itself before giving up on
            # "plain". A model that omits best_for still names its layouts
            # honestly — metrics_row_4up, quote_center_red, bullets_sidebar_left
            # — and defaulting all of them to "plain" threw that away: measured
            # on every blueprint-era template, which then had NO content
            # affinity at all, so scene matching fell back to round-robin and
            # every preview scene rendered the same placeholder copy.
            best_for = _infer_best_for(lid, geometry)
            if best_for:
                repairs.append(f"layout[{lid}] best_for inferred as {best_for} from its own name")
            else:
                best_for = ["plain"]

        geometry_portrait = str(entry.get("geometry_portrait") or "").strip()
        if len(geometry_portrait) < MIN_GEOMETRY_CHARS:
            # Not fatal — the scene generator still branches on isPortrait, it
            # just loses the authored portrait recomposition.
            geometry_portrait = ""
            repairs.append(f"layout[{lid}] missing geometry_portrait")

        image_treatment = _pick(
            entry.get("image_treatment"), IMAGE_TREATMENTS, "split", repairs, f"layout[{lid}].image_treatment"
        )
        supports_image = bool(entry.get("supports_image", image_treatment != "none"))
        # Keep the two consistent in both directions.
        if not supports_image:
            image_treatment = "none"
        elif image_treatment == "none":
            supports_image = False

        layouts.append({
            "id": lid,
            "label": str(entry.get("label") or lid.replace("_", " ").title())[:60],
            "role": role,
            "geometry": geometry[:MAX_GEOMETRY_CHARS],
            "geometry_portrait": geometry_portrait[:MAX_GEOMETRY_CHARS],
            "best_for": best_for,
            "surface": _pick(entry.get("surface"), SURFACE_VARIANTS, bp["identity"]["surface_default"], repairs, f"layout[{lid}].surface"),
            "artifact": _pick(entry.get("artifact"), ARTIFACT_MOTIONS, bp["identity"]["artifact_set"][0], repairs, f"layout[{lid}].artifact"),
            "artifact_intensity": _clamp(entry.get("artifact_intensity"), 0.0, 1.0, 0.45),
            "structural_elements": [
                e for e in (entry.get("structural_elements") or [])
                if isinstance(e, str) and e in STRUCTURAL_ELEMENTS
            ],
            "supports_image": supports_image,
            "image_treatment": image_treatment,
            # HOW this layout draws its content type. Coerced against the menu
            # the kit can actually render, and defaulted to this BRAND's assigned
            # variant rather than a global default — a global default would put
            # every template's metrics layout back on the same rendering, which
            # is the collapse this field exists to break.
            # A BOOKEND draws from the bookend vocabulary, not the content one.
            #
            # Bookends carry `best_for: []`, so this fell through to "plain" and
            # handed the intro a content arrangement ('drop-cap', 'side-rail')
            # that says nothing about a brand opening — which is why every
            # template opened with the same centred wordmark.
            "variant": _pick(
                entry.get("variant"),
                frozenset(variants_for(role if role in ("intro", "outro")
                                       else (best_for[0] if best_for else "plain")) or ()),
                (_brand_variants or {}).get(
                    role if role in ("intro", "outro")
                    else (best_for[0] if best_for else "plain"), ""
                ),
                repairs,
                f"layout[{lid}].variant",
            ),
            "motion_beat": str(entry.get("motion_beat") or "")[:200],
        })

    # Dedup only TRUE duplicates.
    #
    # An earlier version keyed on (best_for, image_treatment) alone, which was far
    # too coarse: image_treatment has 5 values and best_for 8, so two layouts with
    # genuinely different authored geometry were discarded merely for sharing a
    # content type and image style. That routinely pushed usable blueprints under
    # MIN_CONTENT_LAYOUTS and forced a retry.
    #
    # Geometry is what actually distinguishes two scenes, so it joins the key.
    # The WHOLE normalised string is compared, not a prefix: descriptions often
    # share an opening clause ("Body copy fills a wide left column...") and
    # diverge later, so a prefix would collapse genuinely different layouts.
    deduped: list[dict] = []
    seen_sig: set[tuple] = set()
    for lay in layouts:
        if lay["role"] != "content":
            deduped.append(lay)
            continue
        geom_key = re.sub(r"[^a-z0-9 ]+", "", lay["geometry"].lower())
        geom_key = " ".join(geom_key.split())
        sig = (tuple(sorted(lay["best_for"])), lay["image_treatment"], geom_key)
        if sig in seen_sig:
            repairs.append(f"layout[{lay['id']}] duplicates an existing content shape — dropped")
            continue
        seen_sig.add(sig)
        deduped.append(lay)
    layouts = deduped

    # Exactly one intro and one outro.
    intros = [l for l in layouts if l["role"] == "intro"]
    outros = [l for l in layouts if l["role"] == "outro"]
    for extra in intros[1:]:
        extra["role"] = "content"
        repairs.append(f"layout[{extra['id']}] was a second intro -> content")
    for extra in outros[1:]:
        extra["role"] = "content"
        repairs.append(f"layout[{extra['id']}] was a second outro -> content")
    if not intros:
        layouts.insert(
            0, _synthetic_layout("intro", bp, "opening", (_brand_variants or {}).get("intro", ""))
        )
        repairs.append("no intro layout -> synthesised")
    if not outros:
        layouts.append(
            _synthetic_layout("outro", bp, "closing", (_brand_variants or {}).get("outro", ""))
        )
        repairs.append("no outro layout -> synthesised")

    content = [l for l in layouts if l["role"] == "content"]
    if len(content) < MIN_CONTENT_LAYOUTS:
        # Say WHY they were lost. "only 3 usable content layouts" alone gives no
        # signal about whether the model wrote vague geometry or repeated the
        # same content shape, which are very different problems.
        dropped = [r for r in repairs if "dropped" in r]
        if _non_dict:
            detail = (
                f" — {_non_dict} of {len(layouts_in)} entries were not objects"
                f"; dropped: {dropped}"
            )
        elif dropped:
            detail = f" — dropped: {dropped}"
        else:
            detail = " (model returned too few)"
        raise ValueError(
            f"only {len(content)} usable content layouts (need {MIN_CONTENT_LAYOUTS})"
            f"{detail}"
        )

    # Cap total, always keeping the bookends.
    if len(layouts) > MAX_LAYOUTS:
        keep = [l for l in layouts if l["role"] in ("intro", "outro")]
        rest = [l for l in layouts if l["role"] not in ("intro", "outro")]
        layouts = keep[:1] + rest[: MAX_LAYOUTS - 2] + keep[1:]
        repairs.append(f"trimmed to {MAX_LAYOUTS} layouts")

    # The outro is always an ending/CTA scene and never takes an image: the CTA
    # overlay replaces the scene visual at render time, and built-ins likewise
    # list ending_socials in layouts_without_image.
    for lay in layouts:
        if lay["role"] == "outro" and lay["supports_image"]:
            lay["supports_image"] = False
            lay["image_treatment"] = "none"
            repairs.append("outro forced image-incapable (CTA scene)")

    # Image-capability floor: the pipeline needs somewhere to put images.
    content = [l for l in layouts if l["role"] == "content"]
    capable = [l for l in content if l["supports_image"]]
    need = int(len(content) * MIN_IMAGE_CAPABLE_FRACTION + 0.999)
    if content and len(capable) < need:
        for lay in content:
            if len(capable) >= need:
                break
            if not lay["supports_image"]:
                lay["supports_image"] = True
                lay["image_treatment"] = "split"
                capable.append(lay)
                repairs.append(f"layout[{lay['id']}] forced image-capable (below {MIN_IMAGE_CAPABLE_FRACTION:.0%} floor)")

    bp["layouts"] = layouts

    # ── bookends ──
    be = _node(raw.get("bookends"))
    intro_be = _node(be.get("intro"))
    outro_be = _node(be.get("outro"))
    intro_layout = next(l for l in layouts if l["role"] == "intro")
    outro_layout = next(l for l in layouts if l["role"] == "outro")

    # Intro and outro must not share an artifact when the brand has options.
    pool = bp["identity"]["artifact_set"]
    if len(pool) > 1 and outro_layout["artifact"] == intro_layout["artifact"]:
        alt = next((a for a in pool if a != intro_layout["artifact"]), None)
        if alt:
            outro_layout["artifact"] = alt
            repairs.append("outro artifact matched intro -> switched")

    bp["bookends"] = {
        "intro": {
            "opening_move": _pick(intro_be.get("opening_move"), OPENING_MOVES, "logo_settle", repairs, "bookends.intro.opening_move"),
            "logo_treatment": str(intro_be.get("logo_treatment")) if str(intro_be.get("logo_treatment")) in ("hero", "corner", "lockup_with_title", "none") else "lockup_with_title",
            "title_reveal": _pick(intro_be.get("title_reveal"), TITLE_REVEALS, "word", repairs, "bookends.intro.title_reveal"),
            # Energy is deliberately NOT constrained to loud: forcing a
            # loud-open/quiet-close arc on every brand is a house style.
            "energy": str(intro_be.get("energy")) if str(intro_be.get("energy")) in ("loud", "measured", "quiet") else "measured",
        },
        "outro": {
            "closing_move": _pick(outro_be.get("closing_move"), CLOSING_MOVES, "recap_card", repairs, "bookends.outro.closing_move"),
            "energy": str(outro_be.get("energy")) if str(outro_be.get("energy")) in ("loud", "measured", "quiet") else "quiet",
            "echoes_intro": bool(outro_be.get("echoes_intro", False)),
        },
    }

    # ── transitions ──
    #
    # Validated against the renderable set, unlike before. This filtered only on
    # `isinstance(t, str)`, so a hallucinated name ("smooth_dissolve") survived,
    # fell through generatedTransitions.ts's `default:` arm, and rendered a plain
    # fade on EVERY cut — the "all scenes use the same transition" symptom.
    #
    # A single legal name would also make every cut identical (the renderer
    # rotates with `index % pool.length`), so top up to at least three from the
    # default rotation. Order is preserved: the model's own picks come first.
    #
    # The top-up is ROTATED by a brand hash rather than read from the front of
    # DEFAULT_TRANSITION_FAMILY. Reading it in fixed order meant every template
    # that supplied no legal names — the common case once the validator above
    # started (correctly) dropping hallucinations — got byte-identical
    # ["parallax_push", "accent_bar", "page_fold", "rule_sweep"]. Each template
    # then varied its transitions across its OWN cuts while being indistinguishable
    # from every other template, which is the "none of them show their own
    # transitions" symptom in the gallery. Seeding keeps a given brand's result
    # reproducible (the renderer's whole selection contract) while making two
    # brands diverge.
    tf_in = [t for t in (raw.get("transition_family") or []) if isinstance(t, str)]
    tf = [t for t in dict.fromkeys(tf_in) if t in TRANSITION_FAMILIES]
    dropped = [t for t in tf_in if t not in TRANSITION_FAMILIES]
    if dropped:
        repairs.append(f"transition_family dropped unrenderable {dropped}")
    if len(tf) < 3:
        pool = [t for t in DEFAULT_TRANSITION_FAMILY if t not in tf]
        # SHUFFLE, not rotate. A rotation has only len(pool) distinct outcomes —
        # 9 — so roughly one brand pair in nine drew the identical four moves.
        # Observed: Yango and LaDucTrading, whose seeds share nothing, both hit
        # offset 5 and got clock_sweep/whip_pan/page_flip/fade. Sorting by a
        # per-item hash gives permutations instead of rotations, so a collision
        # needs the same seed rather than the same seed MODULO nine.
        topped = sorted(
            pool,
            key=lambda t: hashlib.md5(f"{seed or 'brand'}|tf|{t}".encode()).hexdigest(),
        )
        tf = (tf + topped)[:4]
        repairs.append(
            "transition_family had fewer than 3 renderable entries -> topped up "
            "brand-seeded (a short pool repeats the same transition on every cut, "
            "and an unseeded top-up gives every brand the same pool)"
        )
    bp["transition_family"] = tf[:4]

    return bp, repairs


def _synthetic_layout(role: str, bp: dict, kind: str, variant: str = "") -> dict:
    """A minimal but valid layout, used when the model omits a bookend.

    Carries its own `variant`: these are inserted AFTER the validation loop that
    fills the field, so a synthesised bookend would otherwise ship without one
    and land back on the default centred composition.
    """
    return {
        "id": f"{kind}_{role}",
        "label": f"{kind.title()} Scene",
        "role": role,
        "geometry": (
            "Single centred focal column inside the safe area: the brand mark sits above "
            "a short accent rule, with the headline directly beneath it and generous "
            "space on all sides."
        ),
        "geometry_portrait": (
            "The same composition as landscape, stacked tighter with a smaller headline so "
            "it fits the narrow frame without crowding the edges."
        ),
        "best_for": [],
        "variant": variant,
        "surface": bp["identity"]["surface_default"],
        "artifact": bp["identity"]["artifact_set"][0],
        "artifact_intensity": 0.5,
        "structural_elements": [],
        "supports_image": role != "outro",
        "image_treatment": "none" if role == "outro" else "full_bleed",
        "motion_beat": "One entrance beat on the headline; everything else settles quietly.",
    }


# ─── Deterministic fallback ──────────────────────────────────────────────────


def fallback_blueprint(theme: dict, archetypes: list[dict], name: str = "") -> dict:
    """Build a blueprint from the existing signature engine + scene archetypes.

    This is today's behaviour expressed in the new shape, so a blueprint failure
    degrades to the current output rather than blocking generation. Geometry
    strings come from the five legacy compositions.
    """
    sig = (theme.get("signature") or {}) if isinstance(theme, dict) else {}
    artifact_set = [a for a in (sig.get("artifactSet") or []) if a in ARTIFACT_MOTIONS] or ["drift"]

    legacy_geometry = [
        ("centered_focal", "One dominant focal block centred in the frame with generous negative space on every side and a single accent rule beneath the headline."),
        ("asymmetric_split", "Two columns weighted roughly 60/40: the focal copy on one side, a supporting block on the other, divided by a thin accent rule."),
        ("full_bleed_hero", "A full-bleed image fills the frame edge to edge with the text overlaid low behind a gradient scrim for legibility."),
        ("offset_card_stack", "Stacked rows weighted toward one side, with a small eyebrow and a vertical accent rule running along the opposite edge."),
        ("side_rail", "A thin vertical accent rail with a rotated eyebrow along one edge, and the content column set beside it."),
    ]

    # Map the signature's type treatment onto an era so a FALLBACK template still
    # has a typographic identity. Without this every fallback validates to the
    # default era and they all look alike — the exact failure the era axis exists
    # to prevent, and fallbacks are common enough to matter.
    _treatment = sig.get("typeTreatment") or "clean-sans"
    _era = {
        "editorial-serif": "editorial",
        "display-serif": "vintage",
        "display-bold": "expressive",
        "tight-sans": "technical",
        "rounded-sans": "modern",
        "clean-sans": "modern",
    }.get(_treatment, "modern")

    _fb_variants = layout_variants_for_brand(name or "")
    bp_seed = {
        "identity": {
            "name": name or "Custom Template",
            "thesis": "Deterministic fallback derived from the brand signature.",
            "era": _era,
            "decor_system": sig.get("decorSystem") or "rules",
            "surface_default": sig.get("surfaceStyle") or "panel",
            "artifact_set": artifact_set,
            "motion_energy": sig.get("motionEnergy") or "smooth",
        },
        "structure": {},
        "type_system": {"type_treatment": sig.get("typeTreatment") or "clean-sans"},
        "layouts": [],
        "bookends": {},
        "transition_family": list(sig.get("transitionFamily") or []),
    }

    layouts: list[dict] = [{
        "id": "intro",
        "label": "Opening",
        "role": "intro",
        "geometry": legacy_geometry[0][1],
        "geometry_portrait": "The same composition, stacked vertically with a smaller headline for the narrow frame.",
        "best_for": [],
        # Seeded, so the deterministic fallback diverges by brand too. Without
        # this every fallback template opened identically — and the fallback is
        # what ships whenever the blueprint model is unavailable.
        "variant": _fb_variants.get("intro", ""),
        "surface": bp_seed["identity"]["surface_default"],
        "artifact": artifact_set[0],
        "artifact_intensity": 0.7,
        "structural_elements": [],
        "supports_image": True,
        "image_treatment": "full_bleed",
        "motion_beat": "A single bold title entrance.",
    }]

    for i, arch in enumerate(archetypes or []):
        gid, geom = legacy_geometry[(i + 1) % len(legacy_geometry)]
        # Vary the treatments across layouts. Every content layout used to get the
        # SAME surface and image_treatment ("split"), so a template that fell back
        # here rendered six visually identical scenes — the exact repetition the
        # blueprint stage exists to prevent. The fallback cannot design, but it can
        # at least rotate through the legal vocabulary deterministically.
        _surfaces = [bp_seed["identity"]["surface_default"], "outline", "flat-hairline", "soft"]
        _treatments = ["split", "full_bleed", "inset_card", "masked"]
        layouts.append({
            "id": _slug(arch.get("id"), f"content_{i}"),
            "label": str(arch.get("id") or f"Content {i + 1}").replace("_", " ").title(),
            "role": "content",
            "geometry": geom,
            "geometry_portrait": "Stacked vertically: the visual above, the text beneath, with fewer items and larger type.",
            "best_for": [b for b in (arch.get("best_for") or []) if b in CONTENT_TYPES],
            "surface": _surfaces[i % len(_surfaces)],
            "artifact": artifact_set[i % len(artifact_set)],
            # Alternate loud/quiet so neighbouring scenes don't read identically.
            "artifact_intensity": 0.55 if i % 2 == 0 else 0.35,
            "structural_elements": [],
            "supports_image": True,
            "image_treatment": _treatments[i % len(_treatments)],
            "motion_beat": "Staggered entrance on the content rows.",
        })

    layouts.append({
        "id": "outro",
        "label": "Closing",
        "role": "outro",
        "geometry": "A calm closing recap: the brand mark and a short takeaway set low in the frame, leaving the upper area clear for the CTA overlay.",
        "geometry_portrait": "The recap stacked, sitting below the area the CTA overlay occupies.",
        "best_for": [],
        "variant": _fb_variants.get("outro", ""),
        "surface": bp_seed["identity"]["surface_default"],
        "artifact": artifact_set[-1],
        "artifact_intensity": 0.35,
        "structural_elements": [],
        "supports_image": False,
        "image_treatment": "none",
        "motion_beat": "A gentle settle and fade.",
    })

    bp_seed["layouts"] = layouts
    # Run it through the validator so the fallback obeys the same invariants.
    validated, _ = validate_blueprint(bp_seed, seed=name)
    return validated


# ─── Entry point ─────────────────────────────────────────────────────────────


# ─── Divergence enforcement ──────────────────────────────────────────────────
#
# A high temperature makes the model's WORDING vary; it does not make its DESIGN
# vary. Asked to "design a video template", an LLM has a strong prior — a centred
# hero intro, a 60/40 split, a full-bleed image scene, a quiet sign-off — and it
# returns to that attractor for a fintech dashboard and a food blog alike. So the
# blueprint stage can be working perfectly (valid JSON, zero repairs) and still
# hand every brand the same design, which is the original bug one level up.
#
# Three mechanisms, in order of how much they do:
#
#   1. A brand-seeded DESIGN CONSTRAINT deterministically derived from the brand.
#      Not a hint — a hard requirement that rules out the default answer, forcing
#      the model off its prior in a direction that is stable per brand (the same
#      brand regenerates to the same character) but differs across brands.
#   2. A structural FINGERPRINT of the returned design, so convergence is
#      measurable rather than a thing someone notices in a review.
#   3. A HOUSE-STYLE CHECK that rejects and retries a blueprint which came back
#      as the generic prior anyway.

# The design axes a brand-seeded constraint can push on.
#
# Each constraint is a PROMPT string plus an APPLY function, and the apply
# function is what actually makes it true. Asking was measurably not enough:
# GLM 5.2 was handed "enable panel_numbering" and "do not centre the intro" as
# NON-NEGOTIABLE and returned num=False / open=logo_settle on two consecutive
# attempts, with an identical fingerprint both times — telling it exactly which
# choices were generic did not move it at all. A weak or low-effort model simply
# returns its prior for an open-ended design task.
#
# So the prompt string is now a HINT that lets the model design coherently around
# the constraint, and `apply` is the guarantee. The template diverges whether or
# not the model cooperates.
_ConstraintFn = "Callable[[dict], list[str]]"


# The brand seed for the constraint run in progress. A ContextVar rather than a
# parameter so all 13 constraints keep the same one-argument signature.
_CONSTRAINT_SEED: contextvars.ContextVar[str] = contextvars.ContextVar(
    "blueprint_constraint_seed", default=""
)


#: Content-layout count band. The prompt no longer names a range — it defers to
#: this brand's number — so the band lives in one place and both the prompt and
#: the enforcement read it. Floor is 6 (below that a video visibly reuses
#: layouts); ceiling is bounded by MAX_LAYOUTS once the two bookends are added.
CONTENT_LAYOUT_MIN = 6
CONTENT_LAYOUT_MAX = 8


def content_layout_target(seed: str) -> int:
    """How many content layouts THIS brand's template should have.

    Seeded rather than fixed because the count is itself a design decision, and
    a prompt that names a range gets the bottom of that range almost every time:
    every template shipped exactly the minimum six, so two templates always had
    the same length as well as the same shapes.

    Read by _brand_constraint (to tell the model) and by _c_layout_count (to
    enforce it), so the instruction and the enforcement cannot disagree.
    """
    span = CONTENT_LAYOUT_MAX - CONTENT_LAYOUT_MIN + 1
    h = int(hashlib.md5(f"{seed}|layout_count".encode()).hexdigest(), 16)
    return CONTENT_LAYOUT_MIN + (h % span)


def _brand_hash(bp: dict, salt: str = "") -> int:
    """A stable per-brand number for a deterministic constraint pick.

    Keyed on the RUN'S seed (category|style|name), never on identity.name — the
    extractor leaves that as the literal "Custom Template" on most blueprints,
    so hashing it gave every brand the same "brand-seeded" answer.
    """
    seed = _CONSTRAINT_SEED.get() or str((bp.get("identity") or {}).get("name") or "brand")
    return int(hashlib.md5(f"{seed}|{salt}".encode()).hexdigest(), 16)


def _c_offcentre_intro(bp: dict) -> list[str]:
    be = (bp.get("bookends") or {}).get("intro") or {}
    if be.get("opening_move") in ("logo_settle", "cover_reveal"):
        # Both centre a mark and settle it. Anything else enters from an edge.
        be["opening_move"] = "wordmark_wipe"
        be["logo_treatment"] = "corner"
        return ["intro forced off-centre (opening_move -> wordmark_wipe, logo -> corner)"]
    return []


def _c_chrome(bp: dict) -> list[str]:
    ch = (bp.get("structure") or {}).setdefault("chrome", {})
    if not ch.get("enabled"):
        ch["enabled"] = True
        ch.setdefault("position", "top")
        ch.setdefault("left", "brandName")
        ch.setdefault("rule", "hairline")
        return ["persistent masthead forced on"]
    return []


def _c_text_layouts(bp: dict) -> list[str]:
    """Force some content layouts to be image-free.

    Capped so this cannot fight MIN_IMAGE_CAPABLE_FRACTION, which runs after it.
    """
    content = [l for l in (bp.get("layouts") or []) if l.get("role") == "content"]
    max_textual = len(content) - int(len(content) * MIN_IMAGE_CAPABLE_FRACTION + 0.999)
    want = min(2, max_textual)
    textual = [l for l in content if not l.get("supports_image")]
    out: list[str] = []
    for lay in reversed(content):
        if len(textual) >= want:
            break
        if lay.get("supports_image"):
            lay["supports_image"] = False
            lay["image_treatment"] = "none"
            textual.append(lay)
            out.append(f"layout[{lay.get('id')}] forced text-only")
    return out


def _c_edge_to_edge(bp: dict) -> list[str]:
    st = bp.get("structure") or {}
    if st.get("edge_policy") != "edge_to_edge":
        st["edge_policy"] = "edge_to_edge"
        sa = st.setdefault("safe_area", {})
        for orient, default in (("landscape", 3.0), ("portrait", 4.0)):
            node = sa.setdefault(orient, {})
            for side in ("top", "right", "bottom", "left"):
                node[side] = min(float(node.get(side, default) or default), default)
        return ["edge policy forced to edge_to_edge with a tight safe area"]
    return []


def _c_tight(bp: dict) -> list[str]:
    sa = (bp.get("structure") or {}).setdefault("safe_area", {})
    changed = False
    for orient, cap in (("landscape", 4.5), ("portrait", 4.5)):
        node = sa.setdefault(orient, {})
        for side in ("top", "right", "bottom", "left"):
            if float(node.get(side, 6) or 6) > cap:
                node[side] = cap
                changed = True
    return ["safe area tightened below 5%"] if changed else []


def _c_airy(bp: dict) -> list[str]:
    sa = (bp.get("structure") or {}).setdefault("safe_area", {})
    changed = False
    for orient in ("landscape", "portrait"):
        node = sa.setdefault(orient, {})
        for side in ("top", "right", "bottom", "left"):
            if float(node.get(side, 6) or 6) < 9.5:
                node[side] = 9.5
                changed = True
    return ["safe area widened above 9%"] if changed else []


def _c_numbering(bp: dict) -> list[str]:
    num = (bp.get("structure") or {}).setdefault("panel_numbering", {})
    if not num.get("enabled"):
        num["enabled"] = True
        num.setdefault("style", "padded")
        num.setdefault("corner", "tl")
        return ["panel numbering forced on"]
    return []


def _c_inverted_arc(bp: dict) -> list[str]:
    be = bp.setdefault("bookends", {})
    intro = be.setdefault("intro", {})
    outro = be.setdefault("outro", {})
    out: list[str] = []
    if intro.get("energy") != "quiet":
        intro["energy"] = "quiet"
        out.append("intro energy forced quiet")
    if outro.get("energy") != "loud":
        outro["energy"] = "loud"
        out.append("outro energy forced loud")
    return out


def _c_full_bleed(bp: dict) -> list[str]:
    """Push image layouts off the default 'split' treatment."""
    content = [
        l
        for l in (bp.get("layouts") or [])
        if l.get("role") == "content" and l.get("supports_image")
    ]
    out: list[str] = []
    for i, lay in enumerate(content):
        if lay.get("image_treatment") in ("split", None):
            lay["image_treatment"] = "full_bleed" if i % 2 == 0 else "masked"
            out.append(f"layout[{lay.get('id')}] image treatment -> {lay['image_treatment']}")
    return out


def _c_surface_variety(bp: dict) -> list[str]:
    """Break a single-surface template into at least two treatments."""
    content = [l for l in (bp.get("layouts") or []) if l.get("role") == "content"]
    surfaces = {str(l.get("surface")) for l in content}
    if len(surfaces) > 1 or len(content) < 2:
        return []
    base = str(content[0].get("surface") or "panel")
    alt = next(
        (s for s in ("outline", "flat-hairline", "paper", "soft", "glass") if s != base),
        "outline",
    )
    for lay in content[len(content) // 2 :]:
        lay["surface"] = alt
    return [f"surface variety forced ({base} + {alt})"]


def _c_decor(bp: dict) -> list[str]:
    """Move off the safe/default decor systems.

    Brand-seeded inside validate_blueprint via the caller, so two brands landing
    on this constraint do not both get the same replacement.
    """
    ident = bp.get("identity") or {}
    if str(ident.get("decor_system")) in ("rules", "none", "grid", "dots"):
        pool = sorted(DECOR_SYSTEMS - {"rules", "none", "grid", "dots"})
        h = _brand_hash(bp, "decor")
        ident["decor_system"] = pool[h % len(pool)]
        return [f"decor system -> {ident['decor_system']!r} (was a safe default)"]
    return []


def _c_bookend_moves(bp: dict) -> list[str]:
    """Move off the default opening/closing moves.

    Same shape as _c_decor: brand-seeded so two brands landing on this
    constraint do not both get the same replacement. Only fires when the moves
    are still at their _pick() defaults — a model that deliberately chose
    something else keeps its choice.
    """
    be = bp.get("bookends") or {}
    ident = bp.get("identity") or {}
    intro = be.get("intro") or {}
    outro = be.get("outro") or {}
    changed: list[str] = []
    h = _brand_hash(bp, "bookends")
    if intro.get("opening_move") == "logo_settle":
        pool = sorted(OPENING_MOVES - {"logo_settle"})
        intro["opening_move"] = pool[h % len(pool)]
        changed.append(f"opening_move -> {intro['opening_move']!r} (was the default)")
    if outro.get("closing_move") == "recap_card":
        pool = sorted(CLOSING_MOVES - {"recap_card"})
        # Decorrelated from the opening pick so a brand does not get the same
        # index in both pools (mirrors fonts_for_era's //7 on the body slot).
        outro["closing_move"] = pool[(h // 11) % len(pool)]
        changed.append(f"closing_move -> {outro['closing_move']!r} (was the default)")
    return changed


def _c_era(bp: dict) -> list[str]:
    """Move off a defaulted era, which drags the typeface with it.

    era selects the font pair via fonts_for_era(), so an era that collapses
    collapses typography too — measured at 4 of 7 brands on 'technical', which
    put fira_code on three unrelated brands. Deliberately a NUDGE: only fires on
    the 'modern' _pick() default, so a model that genuinely judged a brand
    technical or editorial keeps that judgement.
    """
    ident = bp.get("identity") or {}
    if str(ident.get("era")) != "modern":
        return []
    pool = sorted(ERAS - {"modern"})
    h = _brand_hash(bp, "era")
    ident["era"] = pool[h % len(pool)]
    # Re-derive the typeface for the new era. validate_blueprint already ran, so
    # the fonts on the dict were picked for the OLD era and would otherwise stay.
    heading, body = fonts_for_era(ident["era"], str(ident.get("name", "")))
    ident["heading_font"] = heading
    ident["body_font"] = body
    return [f"era -> {ident['era']!r} (was the default; typeface re-derived)"]


# (prompt text, enforcement function)
def _c_layout_count(bp: dict) -> list[str]:
    """Vary how MANY content layouts a template has.

    Every existing constraint moves chrome, decor, safe area, bookends or era —
    the template's SKIN. None touches the scene set, so every brand landed on
    whatever count the model's prior returns, and two templates with visibly
    different blueprints still shipped the same number of scenes in the same
    shapes.

    Trimming rather than inventing: a layout the model authored has real
    geometry, whereas one synthesised here would not. Templates seeded to a
    smaller count drop their least distinctive layouts (the plain ones first).
    """
    # Every NON-BOOKEND layout, not just role="content". _c_role_composition
    # retags one layout to a punctuation role (statement / chapter_card / ...),
    # which leaves the template the same LENGTH while dropping the content count
    # by one — counting only "content" would then read that as a size decision
    # the model never made, and trim a layout to compensate.
    content = [
        l for l in (bp.get("layouts") or [])
        if str(l.get("role")) not in ("intro", "outro")
    ]
    if not content:
        return []
    # The SAME target the prompt named, so the instruction and the enforcement
    # cannot disagree. _CONSTRAINT_SEED is the run's seed; _brand_hash's fallback
    # covers a direct call with no seed set.
    seed = _CONSTRAINT_SEED.get() or str((bp.get("identity") or {}).get("name") or "brand")
    target = content_layout_target(seed)
    if len(content) == target:
        return []
    if len(content) < target:
        # UNDER target. Trimming was the only direction before, so a model that
        # returned the minimum every time was never corrected — which is exactly
        # what it did, and why every template had the same length. Nothing here
        # can invent a layout with real geometry, so this is reported rather than
        # silently accepted: the retry sees it and the count is asked for again.
        return [
            f"content layout count {len(content)} is under this brand's target {target} "
            "(the model returned fewer layouts than the design called for)"
        ]
    # Drop the most generic first: "plain"-only layouts carry the least identity.
    ranked = sorted(
        content,
        key=lambda l: (list(l.get("best_for") or []) == ["plain"], -len(str(l.get("geometry") or ""))),
    )
    keep = {id(l) for l in ranked[:target]}
    before = len(content)
    # Filter on BOOKEND-ness, not on role == "content": _c_role_composition may
    # already have retagged one body layout to a punctuation role, and a
    # role-based filter would let that one through uncounted — the template then
    # shipped target+1 layouts while the repair line claimed it had trimmed to
    # target.
    bp["layouts"] = [
        l
        for l in bp["layouts"]
        if str(l.get("role")) in ("intro", "outro") or id(l) in keep
    ]
    return [f"content layout count {before} -> {target} (brand-seeded)"]


def _c_geometry_distinct(bp: dict) -> list[str]:
    """Reject near-duplicate geometry between two layouts of one template.

    The prompt asks for distinct geometry ("Give the content layouts DIFFERENT
    geometry from one another") and nothing checked it, so a template could ship
    six layouts describing the same split in different words.
    """
    content = [l for l in (bp.get("layouts") or []) if l.get("role") == "content"]
    if len(content) < 2:
        return []

    def _shape(text: str) -> frozenset[str]:
        """The geometry's structural words, ignoring prose."""
        words = re.findall(r"[a-z]{4,}", (text or "").lower())
        return frozenset(w for w in words if w not in _GEOMETRY_STOPWORDS)

    notes: list[str] = []
    seen: list[tuple[frozenset[str], dict]] = []
    for lay in content:
        shape = _shape(str(lay.get("geometry") or ""))
        if not shape:
            continue
        for prev, prev_lay in seen:
            overlap = len(shape & prev) / max(1, len(shape | prev))
            if overlap >= 0.7:
                notes.append(
                    f"layout[{lay.get('id')}] geometry duplicates "
                    f"layout[{prev_lay.get('id')}] ({overlap:.0%} shared)"
                )
                break
        seen.append((shape, lay))
    return notes


def _c_role_composition(bp: dict) -> list[str]:
    """Give some templates a non-content role.

    SCENE_ROLES has 7 members and 4 were never used by any blueprint:
    section_divider, chapter_card, statement, data_spotlight. They need no new
    runtime plumbing — code_generator treats every non-intro/outro role as a
    content variant carrying a role tag — so they are free structural variety.
    """
    content = [l for l in (bp.get("layouts") or []) if l.get("role") == "content"]
    if len(content) < 4:
        return []
    pool = ("statement", "chapter_card", "section_divider", "data_spotlight")
    role = pool[_brand_hash(bp, "role_mix") % len(pool)]
    # Retag the least image-dependent layout, so a visual layout is never lost.
    target = next(
        (l for l in content if not l.get("supports_image")),
        content[-1],
    )
    if target.get("role") == role:
        return []
    target["role"] = role
    return [f"layout[{target.get('id')}] role -> {role!r} (structural variety)"]


# Prose words that carry no structural meaning, so two geometries are not judged
# similar merely for sharing them.
_GEOMETRY_STOPWORDS = frozenset({
    "with", "that", "this", "from", "into", "over", "under", "them", "they",
    "which", "where", "while", "then", "than", "also", "sits", "sit", "goes",
    "placed", "place", "using", "used", "give", "gives", "make", "makes",
    "scene", "layout", "frame", "element", "elements", "content", "text",
})


_DESIGN_CONSTRAINTS: list[tuple[str, object]] = [
    (
        "This template must NOT centre its intro. The opening composition is anchored to one "
        "edge or corner of the frame, and the eye enters from there.",
        _c_offcentre_intro,
    ),
    (
        "This template uses persistent chrome: enable structure.chrome so a masthead repeats on "
        "every scene, and design the layouts around the space it occupies.",
        _c_chrome,
    ),
    (
        "At least two content layouts must be built WITHOUT a content image — around type, "
        "numbers, or a flat colour field. Set supports_image false on those.",
        _c_text_layouts,
    ),
    (
        "This template runs edge to edge: set structure.edge_policy to 'edge_to_edge' and design "
        "layouts where elements deliberately bleed past the frame edge.",
        _c_edge_to_edge,
    ),
    (
        "This template is densely gridded: give it a tight safe area (under 5% on the sides) and "
        "layouts that divide the frame into multiple distinct compartments.",
        _c_tight,
    ),
    (
        "This template is generously airy: give it a wide safe area (9% or more) and layouts with "
        "one focal element surrounded by deliberate emptiness.",
        _c_airy,
    ),
    (
        "This template numbers its scenes: enable structure.panel_numbering and design at least "
        "two layouts that treat the numeral as a large visual element, not a small corner tag.",
        _c_numbering,
    ),
    (
        "This template's intro must be QUIET and its outro EMPHATIC — invert the usual arc. Set "
        "bookends.intro.energy to 'quiet' and bookends.outro.energy to 'loud'.",
        _c_inverted_arc,
    ),
    (
        "This template favours full-bleed imagery: most image-capable layouts use 'full_bleed' or "
        "'masked' treatments rather than a neat side-by-side split.",
        _c_full_bleed,
    ),
    (
        "This template varies its surfaces: content layouts must not all share one panel "
        "treatment — alternate between at least two.",
        _c_surface_variety,
    ),
    (
        "This template's decor must not be a safe default: choose an atmospheric decor system "
        "with real character rather than plain rules, dots or a grid.",
        _c_decor,
    ),
    (
        "This template must NOT open on a settling logo or close on a recap card — those are the "
        "stock bookends. Choose an opening_move and closing_move that suit THIS brand: a cold "
        "open on a statement, type setting itself, a rule drawing across, a full-bleed sign-off.",
        _c_bookend_moves,
    ),
    (
        "This template's era must be a deliberate choice, not the modern default — pick the era "
        "whose typography actually matches the brand's voice, and design the type around it.",
        _c_era,
    ),
    # ── Scene-set divergence ─────────────────────────────────────────────────
    # Everything above moves the template's SKIN. These three move the scene set
    # itself, which is where two templates were still coming out the same: the
    # best_for vocabulary is only 8 values and the prompt demands 6+ layouts, so
    # any two templates must share at least 4 of 6 content types. That overlap
    # cannot be prompted away — divergence has to come from HOW MANY layouts, how
    # they are composed, and how differently they are built.
    (
        "Do not settle on the usual six content layouts. Decide how many this brand actually "
        "needs and justify it in the geometry — a brand with one thing to say earns fewer, "
        "richer layouts; a catalogue brand earns more.",
        _c_layout_count,
    ),
    (
        "Every content layout must be built DIFFERENTLY from the others — not the same split "
        "described in different words. If two layouts would look alike in a still frame, "
        "redesign one of them around a different structural idea.",
        _c_geometry_distinct,
    ),
    (
        "This template punctuates: give at least one layout a non-content role (a statement "
        "card, a chapter break, a section divider or a data spotlight) so the video has a "
        "change of pace rather than nine equal-weight scenes.",
        _c_role_composition,
    ),
]


def _constraint_indices(seed: str) -> tuple[int, int]:
    """Two distinct constraint indices, deterministic per brand."""
    h = int(hashlib.md5(seed.encode("utf-8")).hexdigest(), 16)
    n = len(_DESIGN_CONSTRAINTS)
    first = h % n
    second = (first + 1 + (h // n) % (n - 1)) % n
    return first, second


def _brand_constraint(seed: str) -> str:
    """The prompt text for this brand's two constraints.

    A hint, not the guarantee — see enforce_brand_constraints(). Stating them
    still helps: a model that designs WITH the constraint produces a coherent
    template, where enforcement alone produces a compliant but bolted-on one.
    """
    if not seed:
        return ""
    first, second = _constraint_indices(seed)
    # This brand's layout variants. The content TYPE cannot diverge between
    # templates without losing coverage (a template with no metrics layout sends
    # every statistics scene to the round-robin fallback), so identity divergence
    # lives on the variant instead: two templates may both hold "metrics" and
    # still share no layout.
    _variants = layout_variants_for_brand(seed)
    _variant_lines = "".join(
        f"    {ct} -> {v}\n" for ct, v in _variants.items()
    )
    _count = content_layout_target(seed)
    return (
        "NON-NEGOTIABLE DESIGN CONSTRAINTS for this brand — these override your instincts "
        "about what a video template usually looks like:\n"
        f"  1. {_DESIGN_CONSTRAINTS[first][0]}\n"
        f"  2. {_DESIGN_CONSTRAINTS[second][0]}\n"
        f"  3. THIS TEMPLATE HAS EXACTLY {_count} CONTENT LAYOUTS (plus the intro and the\n"
        f"     outro, so {_count + 2} layouts in total). Not fewer, not more. The count is part\n"
        "     of the design: a brand with one thing to say earns fewer, richer layouts; a\n"
        "     catalogue brand earns more. Every template shipping the same number is the\n"
        "     same failure as every template shipping the same shapes.\n"
        "  4. THIS BRAND'S LAYOUT VARIANTS. When you build a layout for one of these content\n"
        "     types, it MUST use the variant named here — set it as the layout's `variant`\n"
        "     field and design the geometry around it. These differ per brand on purpose:\n"
        "     they are what stops two templates' layouts being the same object.\n"
        f"{_variant_lines}"
        "Design the whole template so these read as deliberate character, not as bolted-on "
        "exceptions to an otherwise conventional design. They will be enforced on the output "
        "either way, so a design that ignores them will simply be overridden."
    )


def enforce_brand_constraints(bp: dict, seed: str) -> list[str]:
    """Make this brand's two constraints TRUE, whatever the model returned.

    This is the guarantee behind _brand_constraint(). Mutates `bp` in place and
    returns what it changed. Runs after validate_blueprint() so it operates on
    coerced values, and its own edits stay inside the validated vocabulary.
    """
    if not seed or not bp:
        return []
    applied: list[str] = []

    # Give the brand-seeded constraints the REAL seed for this run.
    #
    # They used to hash identity.name, which is not the brand: the extractor
    # leaves it as the literal "Custom Template" on most blueprints, so every
    # brand hashed to the same value and every "brand-seeded" pick returned the
    # same answer. That is how _c_decor put 'rules' on five of seven templates
    # while looking, in the code, like it was diversifying them.
    _seed_token = _CONSTRAINT_SEED.set(seed)
    try:
        return _enforce(bp, seed, applied)
    finally:
        # Reset even if something above escaped, so a seed can never leak into
        # the next brand's constraint run.
        _CONSTRAINT_SEED.reset(_seed_token)


def _enforce(bp: dict, seed: str, applied: list[str]) -> list[str]:
    """The constraint passes themselves, with _CONSTRAINT_SEED already set."""

    def _apply(idx: int) -> None:
        _text, fn = _DESIGN_CONSTRAINTS[idx]
        try:
            applied.extend(fn(bp))
        except Exception as e:  # noqa: BLE001
            # A constraint must never be able to break generation.
            print(f"[F7-DEBUG] [BLUEPRINT] constraint {idx} failed to apply: {e}")

    first, second = _constraint_indices(seed)
    _apply(first)
    _apply(second)

    # The bookend moves are applied UNCONDITIONALLY, not left to the two-of-N
    # draw above. Every other axis is one of many a viewer might notice; the
    # opening and closing moves are the first and last thing they see, and they
    # were measured at a 100% collapse (logo_settle / recap_card on 7 of 7
    # stored blueprints). Leaving them to the lottery still left ~60% of brands
    # on the default close, because the score-driven loop below stops as soon as
    # the design clears the threshold and often never reaches this constraint.
    # _c_bookend_moves is a no-op when the model already chose something else,
    # so this only ever replaces a default.
    for _idx, (_text, _fn) in enumerate(_DESIGN_CONSTRAINTS):
        if _fn is _c_bookend_moves and _idx not in (first, second):
            _apply(_idx)
            break

    # The layout COUNT is applied unconditionally for the same reason, and one
    # more: the prompt now names an exact number for EVERY brand, so leaving
    # enforcement to the two-of-16 draw meant the instruction was checked on only
    # ~25% of templates and silently ignored on the rest. An instruction that is
    # usually unenforced is worse than no instruction — the model learns nothing
    # from it and the count drifts back to the minimum.
    for _idx, (_text, _fn) in enumerate(_DESIGN_CONSTRAINTS):
        if _fn is _c_layout_count and _idx not in (first, second):
            _apply(_idx)
            break

    # Two constraints move a design but do not always pull a fully generic one
    # under the threshold — measured at 3 of 8 brands still scoring >= 6 when the
    # model returns the pure prior. Keep applying further brand-seeded
    # constraints until the design is genuinely off the house style. Ordered by
    # the seed so which ones get added still differs per brand.
    n = len(_DESIGN_CONSTRAINTS)
    h = int(hashlib.md5(f"{seed}|extra".encode()).hexdigest(), 16)
    order = [(h + i) % n for i in range(n)]
    for idx in order:
        if _house_style_score(bp)[0] < HOUSE_STYLE_REJECT_AT:
            break
        if idx in (first, second):
            continue
        _apply(idx)

    return applied


def blueprint_fingerprint(bp: dict) -> str:
    """A short structural signature of a design, for comparing two blueprints.

    Deliberately built from DESIGN DECISIONS (edge policy, chrome, safe area
    band, image posture, energy arc, layout shapes) and not from prose, so two
    blueprints that describe the same design in different words collide — which
    is exactly the collision worth detecting.
    """
    st = bp.get("structure") or {}
    ident = bp.get("identity") or {}
    be = bp.get("bookends") or {}
    sa = (st.get("safe_area") or {}).get("landscape") or {}
    # Band the inset so 6% and 6.5% are the same decision.
    _avg = (
        sum(float(sa.get(k, 6) or 6) for k in ("top", "right", "bottom", "left")) / 4.0
        if sa
        else 6.0
    )
    band = "tight" if _avg < 5 else ("wide" if _avg >= 9 else "mid")
    content = [l for l in (bp.get("layouts") or []) if l.get("role") == "content"]
    img = sum(1 for l in content if l.get("supports_image"))
    parts = [
        f"edge={st.get('edge_policy')}",
        f"chrome={bool((st.get('chrome') or {}).get('enabled'))}",
        f"num={bool((st.get('panel_numbering') or {}).get('enabled'))}",
        f"band={band}",
        f"decor={ident.get('decor_system')}",
        # The surfaces actually IN USE, not identity.surface_default — a template
        # whose layouts were given varied surfaces would otherwise still report
        # the single default and read as unchanged.
        "surface=" + ",".join(sorted({str(l.get("surface")) for l in content}) or ["-"]),
        f"img={img}/{len(content)}",
        f"open={(be.get('intro') or {}).get('opening_move')}",
        f"close={(be.get('outro') or {}).get('closing_move')}",
        f"arc={(be.get('intro') or {}).get('energy')}>{(be.get('outro') or {}).get('energy')}",
        "treat=" + ",".join(sorted({str(l.get("image_treatment")) for l in content})),
        # ── The SCENE SET ────────────────────────────────────────────────────
        # Every axis above describes the template's skin. Two templates with
        # completely different skins could still ship an identical set of scenes,
        # and the fingerprint would call them distinct — which is exactly how a
        # scene-level collapse stayed invisible while the divergence tests passed.
        f"n={len(content)}",
        "bf=" + ",".join(sorted(x for l in content for x in (l.get("best_for") or []))),
        "roles=" + ",".join(
            sorted({str(l.get("role")) for l in (bp.get("layouts") or [])})
        ),
    ]
    return "|".join(parts)


# The generic prior, expressed as the fingerprint traits it exhibits. A blueprint
# hitting most of these did not design for the brand — it returned the default
# answer that made every template look alike in the first place.
def _house_style_score(bp: dict) -> tuple[int, list[str]]:
    """How closely a blueprint matches the generic default. Higher = more generic."""
    st = bp.get("structure") or {}
    ident = bp.get("identity") or {}
    be = bp.get("bookends") or {}
    sa = (st.get("safe_area") or {}).get("landscape") or {}
    content = [l for l in (bp.get("layouts") or []) if l.get("role") == "content"]

    hits: list[str] = []
    if (st.get("edge_policy") or "inset") == "inset":
        hits.append("edge_policy=inset (the default)")
    if not (st.get("chrome") or {}).get("enabled"):
        hits.append("no persistent chrome")
    if not (st.get("panel_numbering") or {}).get("enabled"):
        hits.append("no panel numbering")
    if sa:
        _avg = sum(float(sa.get(k, 6) or 6) for k in ("top", "right", "bottom", "left")) / 4.0
        if 5.0 <= _avg < 9.0:
            hits.append(f"safe area {_avg:.1f}% (the conventional band)")
    if content and all(l.get("supports_image") for l in content):
        hits.append("every content layout takes an image")
    treatments = {str(l.get("image_treatment")) for l in content if l.get("supports_image")}
    if treatments and treatments <= {"split"}:
        hits.append("every image layout is a plain split")
    if (be.get("intro") or {}).get("energy") == "loud" and (be.get("outro") or {}).get(
        "energy"
    ) == "quiet":
        hits.append("loud-open/quiet-close (the stock arc)")
    # The bookend MOVES, not just the energy arc. Measured across every stored
    # blueprint: 7 of 7 used opening_move=logo_settle and closing_move=recap_card
    # — a 100% collapse on the two seconds of a video a viewer registers first
    # and last. It went unnoticed because this scorer only counted the energy
    # arc above, so enforce_brand_constraints never fired on this axis. These
    # are the _pick() defaults at the intro/outro coercion, so a model that
    # simply omits them lands here every time.
    if (be.get("intro") or {}).get("opening_move") == "logo_settle":
        hits.append("opening_move=logo_settle (the default)")
    if (be.get("outro") or {}).get("closing_move") == "recap_card":
        hits.append("closing_move=recap_card (the default)")
    if (ident.get("decor_system") or "") in ("rules", "none", "grid", "dots"):
        hits.append(f"safe decor system {ident.get('decor_system')!r}")
    if len({str(l.get("surface")) for l in content}) <= 1:
        hits.append("one surface treatment across every content layout")

    # ── Scene-set genericness ────────────────────────────────────────────────
    # The 11 traits above are all skin. A blueprint could score ZERO on them and
    # still ship the default scene set, which is what made the collapse the user
    # reported invisible to this scorer.
    if content:
        # Count every non-bookend layout, not just role="content": a template
        # that turned one scene into a statement card still has the same NUMBER
        # of scenes, so counting only content layouts would score it as having
        # made a size decision it did not make.
        _body = [
            l for l in (bp.get("layouts") or [])
            if str(l.get("role")) not in ("intro", "outro")
        ]
        if len(_body) == 6:
            # 6 is the prompt's stated floor, so it is also the model's default
            # answer — landing there is a non-decision far more often than it is
            # a design.
            hits.append("exactly the minimum six content layouts (the default count)")
        _bf = [tuple(sorted(l.get("best_for") or [])) for l in content]
        if len({b for b in _bf if b}) <= max(2, len(content) // 3):
            hits.append("content layouts collapse onto very few best_for signatures")
        if all(str(l.get("role")) == "content" for l in (bp.get("layouts") or [])
               if str(l.get("role")) not in ("intro", "outro")):
            hits.append("every non-bookend layout is a plain content scene (no punctuation)")

    return len(hits), hits


# A blueprint scoring at or above this many generic traits is treated as the
# house style rather than a design and is regenerated. Tuned deliberately high:
# a false positive costs one extra LLM call, but rejecting real designs that
# happen to be conventional would be worse than the bug being fixed.
#
# Raised 6 -> 7 when the three SCENE-SET traits were added. The pool went from 11
# traits to 14, so holding the threshold at 6 would have quietly made the gate
# stricter — a blueprint with an unremarkable scene set now picks up hits it
# could not have scored before. 7 keeps roughly the same proportion of the pool
# (6/11 ~= 7/14) so the change measures the new axis without also retuning the
# old one.
HOUSE_STYLE_REJECT_AT = 7


def generate_blueprint(
    brand_context: str,
    user_brief: str = "",
    *,
    seed: str = "",
) -> tuple[dict | None, list[str]]:
    """Run the blueprint stage. Returns (blueprint | None, repairs).

    None means both attempts failed; the caller falls back. This function never
    raises for a model failure — blueprint generation must not be able to break
    template creation.
    """
    ensure_dspy_configured()
    # dspy.Predict, NOT ChainOfThought.
    #
    # ChainOfThought prepends a free-form `reasoning` field that the model fills
    # before it reaches `blueprint_json`. At temperature 0.9 (deliberately high,
    # so two brands diverge) a low-reasoning-effort model rambles there, and on
    # template 134 BOTH attempts spent the whole budget on the rationale and were
    # cut off before emitting any JSON — the template silently fell back to the
    # deterministic blueprint and lost the entire design stage.
    #
    # The planning is not lost: the signature declares a `design_note` output
    # capped at three lines, so the model still commits to a design before
    # writing it, but cannot spend the response deliberating.
    module = dspy.Predict(GenerateDesignBlueprint)
    lm = get_blueprint_lm()
    capabilities = describe_kit_capabilities()
    constraints = _brand_constraint(seed)
    if constraints:
        print(f"[F7-DEBUG] [BLUEPRINT] brand constraints:\n{constraints}")

    last_error: Exception | None = None
    # A blueprint that validates but reads as the generic house style is kept as
    # a fallback rather than discarded: a too-conventional design still beats no
    # design, so it is only replaced if a later attempt does better.
    generic_bp: dict | None = None
    generic_repairs: list[str] = []
    generic_score = 99
    # Set when an attempt ran out of output budget mid-JSON, so the retry can ask
    # for a shorter design instead of re-rolling into the same truncation.
    truncated = False

    # Two attempts, not three. Retrying was measured to be near-worthless for
    # this: GLM 5.2 returned an identical fingerprint and an identical score of 7
    # on two consecutive attempts even when told exactly which choices were
    # generic. At 56-90s per attempt that is a minute of latency for no change.
    # enforce_brand_constraints() now guarantees divergence, so the retry only
    # has to cover a genuinely malformed response.
    for attempt in range(2):
        t0 = time.time()
        result = None
        try:
            prev_cache = getattr(lm, "cache", None)
            if attempt and prev_cache is not None:
                try:
                    lm.cache = False
                except Exception:  # noqa: BLE001
                    pass
            try:
                _extra = constraints
                if attempt and truncated:
                    # The previous attempt ran out of output budget before it
                    # finished the JSON. Re-rolling identically just truncates
                    # again (observed: both attempts on template 134), so ask for
                    # a more compact answer instead of a different design.
                    _extra = (
                        f"{constraints}\n\n"
                        "YOUR PREVIOUS ATTEMPT WAS CUT OFF before the JSON was complete. "
                        "Be COMPACT: keep your reasoning to two or three short lines and "
                        "write the JSON immediately. Use SIX content layouts rather than "
                        "eight, and keep each geometry description to one or two sentences. "
                        "A complete six-layout blueprint is worth far more than a truncated "
                        "eight-layout one, which is discarded entirely."
                    )
                elif attempt and generic_bp is not None:
                    # The previous attempt came back generic. Say so explicitly —
                    # resampling at the same temperature lands on the same prior,
                    # so the retry must be told what to avoid.
                    _, _hits = _house_style_score(generic_bp)
                    _extra = (
                        f"{constraints}\n\n"
                        "YOUR PREVIOUS ATTEMPT WAS REJECTED as a generic template — it made "
                        "these default choices instead of designing for this brand:\n"
                        + "\n".join(f"  - {h}" for h in _hits)
                        + "\nProduce a genuinely different design. Change the structural "
                        "decisions above, not just the wording of the geometry."
                    )
                with dspy.context(lm=lm):
                    result = module(
                        brand_context=brand_context,
                        user_brief=user_brief or "",
                        kit_capabilities=capabilities,
                        design_constraints=_extra,
                    )
            finally:
                if attempt and prev_cache is not None:
                    try:
                        lm.cache = prev_cache
                    except Exception:  # noqa: BLE001
                        pass

            raw = _extract_json_object(result.blueprint_json or "")
            bp, repairs = validate_blueprint(raw, seed=seed)
            # Make the brand's constraints true regardless of whether the model
            # honoured them. Runs BEFORE scoring so the score reflects the design
            # that will actually be used, not the one the model proposed.
            enforced = enforce_brand_constraints(bp, seed)
            if enforced:
                # Re-validate: an enforcement edit can violate an invariant it
                # does not know about (e.g. _c_text_layouts vs the image floor).
                bp, _revalidate_repairs = validate_blueprint(bp, seed=seed)
                repairs.extend(_revalidate_repairs)
            elapsed = time.time() - t0
            score, hits = _house_style_score(bp)
            fp = blueprint_fingerprint(bp)
            print(
                f"[F7-DEBUG] [BLUEPRINT] '{bp['identity']['name']}' in {elapsed:.1f}s — "
                f"{len(bp['layouts'])} layouts, decor={bp['identity']['decor_system']}, "
                f"surface={bp['identity']['surface_default']}, "
                f"chrome={bp['structure']['chrome']['enabled']}, "
                f"edge={bp['structure']['edge_policy']}, "
                f"open={bp['bookends']['intro']['opening_move']}, "
                f"close={bp['bookends']['outro']['closing_move']}, "
                f"{len(repairs)} repair(s)"
            )
            # The fingerprint is the line to grep when two brands look alike:
            # identical fingerprints across brands means the stage converged,
            # which is a different problem from a scene generator ignoring it.
            print(f"[F7-DEBUG] [BLUEPRINT] fingerprint: {fp}")
            # The model's own statement of intent — the quickest read on whether
            # it designed for THIS brand or reached for the generic template.
            _note = (getattr(result, "design_note", "") or "").strip()
            if _note:
                for _line in _note.splitlines()[:3]:
                    if _line.strip():
                        print(f"[F7-DEBUG] [BLUEPRINT]   note: {_line.strip()[:160]}")
            print(f"[F7-DEBUG] [BLUEPRINT] house-style score: {score}/{HOUSE_STYLE_REJECT_AT}")
            for e in enforced:
                print(f"[F7-DEBUG] [BLUEPRINT]   enforced: {e}")
            for h in hits:
                print(f"[F7-DEBUG] [BLUEPRINT]   generic: {h}")
            for r in repairs:
                print(f"[F7-DEBUG] [BLUEPRINT]   repair: {r}")

            if score < HOUSE_STYLE_REJECT_AT:
                return bp, repairs

            if score < generic_score:
                generic_bp, generic_repairs, generic_score = bp, repairs, score
            print(
                f"[F7-DEBUG] [BLUEPRINT] attempt {attempt + 1} too generic "
                f"(score {score}) — regenerating"
            )

        # Broad by design. A narrow tuple (JSONDecodeError/ValueError/KeyError/
        # StopIteration) let an AttributeError from a malformed section escape and
        # fail the whole template — see template 135. Anything the model can
        # provoke must cost at most a retry, then the deterministic fallback.
        except Exception as e:  # noqa: BLE001
            last_error = e
            # An empty or unterminated JSON object means the response was CUT OFF,
            # not that the model wrote something malformed. Distinguish the two so
            # the retry can ask for a shorter answer and the log says what actually
            # happened ("unterminated JSON object at char 0" reads like a parser
            # bug rather than a budget problem).
            _raw = (getattr(result, "blueprint_json", "") or "") if result is not None else ""
            truncated = isinstance(e, json.JSONDecodeError) and (
                not _raw.strip() or "unterminated" in str(e).lower()
            )
            print(
                f"[F7-DEBUG] [BLUEPRINT] attempt {attempt + 1} failed in "
                f"{time.time() - t0:.1f}s: {type(e).__name__}: {e}"
                + (" — response TRUNCATED (out of output budget)" if truncated else "")
            )

    if generic_bp is not None:
        print(
            f"[F7-DEBUG] [BLUEPRINT] every attempt read as house style; keeping the least "
            f"generic (score {generic_score}). This brand's template may resemble others."
        )
        return generic_bp, generic_repairs + [
            f"blueprint stayed generic across retries (house-style score {generic_score})"
        ]

    print(f"[F7-DEBUG] [BLUEPRINT] FALLBACK — every attempt failed: {last_error}")
    return None, [f"blueprint generation failed: {last_error}"]


def layout_for_scene(blueprint: dict, role: str, index: int = 0) -> dict | None:
    """Pick the blueprint layout driving a given scene."""
    if not blueprint:
        return None
    layouts = blueprint.get("layouts") or []
    if role in ("intro", "outro"):
        return next((l for l in layouts if l.get("role") == role), None)
    content = [l for l in layouts if l.get("role") not in ("intro", "outro")]
    if not content:
        return None
    return content[index % len(content)]
