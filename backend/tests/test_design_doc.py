"""Validation + repair for the design-doc stage.

These cover the rules that must hold no matter what the model returns, because
this stage runs at temperature 1.0 with no vocabulary to constrain it — the
schema is the only thing between a creative sample and a broken template.

No LLM is called: every test drives validate_design_docs() directly.
"""
from __future__ import annotations

import json
import re

import pytest

from app.dspy_modules.design_doc import (
    IMAGE_MODES,
    REQUIRED_CONTENT_TYPES,
    _fill_missing_types,
    _missing_required_types,
    MIN_ON_SCREEN_PX,
    _rescale_doc_type,
    MAX_SCENES,
    MIN_SCENES,
    fallback_design_docs,
    validate_design_docs,
)

GENERAL = "g" * 200
DOC = "d" * 120

# Any test that just needs a VALID doc set uses this, so the fixtures cannot
# drift below the floor when the range is retuned.
OK = MIN_SCENES


# Cycled so any _scenes(n>=6) covers all four REQUIRED_CONTENT_TYPES. Tests that
# are not ABOUT coverage should not have to think about it; the ones that are use
# _typed() to state the types explicitly.
_FILLER_TYPES = ("metrics", "timeline", "comparison", "steps", "quote", "bullets")


def _scenes(n: int, overrides: dict[int, dict] | None = None) -> list[dict]:
    overrides = overrides or {}
    out = []
    for i in range(n):
        scene = {
            "id": f"s{i}",
            "role": "content",
            "doc": DOC,
            "content_type": _FILLER_TYPES[i % len(_FILLER_TYPES)],
            "supports_image": False,
            "image_mode": None,
            "image_side": None,
        }
        scene.update(overrides.get(i, {}))
        out.append(scene)
    return out


def _validate(scenes, general=GENERAL, hints="{}"):
    return validate_design_docs(general, json.dumps(scenes), hints)


def _validate_no_types(scenes, general=GENERAL, hints="{}"):
    """As _validate, but with the required-type check off — the last-attempt path."""
    return validate_design_docs(
        general, json.dumps(scenes), hints, require_content_types=False
    )


# ─── Bookends are structural ─────────────────────────────────────────────────


def test_roles_are_assigned_by_position() -> None:
    docs, _ = _validate(_scenes(OK))
    roles = [s["role"] for s in docs["scenes"]]
    assert roles[0] == "intro"
    assert roles[-1] == "outro"
    assert set(roles[1:-1]) == {"content"}


def test_mislabelled_roles_are_corrected() -> None:
    """A model that forgets to mark its ending must still produce one.

    The pipeline keys off these roles for CTA placement, so position wins over
    whatever the model called them.
    """
    scenes = _scenes(OK)
    for s in scenes:
        s["role"] = "content"
    docs, repairs = _validate(scenes)
    assert docs["scenes"][0]["role"] == "intro"
    assert docs["scenes"][-1]["role"] == "outro"
    assert any("by position" in r for r in repairs)


# ─── Scene count is the model's call, within limits ──────────────────────────


def test_scene_count_is_clamped_but_keeps_the_ending() -> None:
    docs, _ = _validate(_scenes(MAX_SCENES + 9))
    assert len(docs["scenes"]) == MAX_SCENES
    assert docs["scenes"][-1]["role"] == "outro"


def test_too_few_scenes_is_unusable() -> None:
    docs, _ = _validate(_scenes(MIN_SCENES - 1))
    assert docs is None


def test_a_label_is_not_a_design() -> None:
    """A one-line "doc" makes the scene fall back to the model's house style."""
    # One extra so dropping the bad scene still clears the floor. The victim is a
    # NON-required type, so this stays a test about doc length rather than
    # accidentally becoming one about content coverage.
    scenes = _scenes(OK + 1)
    victim = next(
        i for i, sc in enumerate(scenes)
        if sc["content_type"] not in REQUIRED_CONTENT_TYPES and 0 < i < len(scenes) - 1
    )
    scenes[victim]["doc"] = "a metrics scene"
    docs, repairs = _validate(scenes)
    assert len(docs["scenes"]) == OK
    assert any("too short" in r for r in repairs)


def test_a_missing_general_doc_is_unusable() -> None:
    """Without it the scenes share nothing, which is the opposite failure."""
    docs, _ = validate_design_docs("too short", json.dumps(_scenes(OK)), "{}")
    assert docs is None


# ─── Exactly two image forms ─────────────────────────────────────────────────


def test_image_modes_are_normalised() -> None:
    scenes = _scenes(
        OK,
        {
            1: {"supports_image": True, "image_mode": "inset", "image_side": None},
            2: {"supports_image": True, "image_mode": "background", "image_side": "left"},
            3: {"supports_image": True, "image_mode": "half", "image_side": "diagonal"},
        },
    )
    docs, _ = _validate(scenes)
    got = docs["scenes"]
    # An illegal mode becomes "half": it cannot hide the copy the way an
    # unscrimmed background can.
    assert got[1]["image_mode"] == "half"
    # A background covers the frame, so it has no side.
    assert got[2]["image_mode"] == "background"
    assert got[2]["image_side"] is None
    # An illegal side falls back to a real one.
    assert got[3]["image_side"] == "left"
    # A scene that declined images keeps no image fields.
    assert got[0]["image_mode"] is None
    assert got[0]["image_side"] is None


def test_image_capable_scenes_always_have_a_legal_mode() -> None:
    scenes = _scenes(OK, {1: {"supports_image": True}})
    docs, _ = _validate(scenes)
    for s in docs["scenes"]:
        if s["supports_image"]:
            assert s["image_mode"] in IMAGE_MODES


# ─── Tolerating real model output ────────────────────────────────────────────


def test_markdown_fences_are_stripped() -> None:
    docs, _ = validate_design_docs(
        GENERAL, "```json\n" + json.dumps(_scenes(OK)) + "\n```", "{}"
    )
    assert docs is not None


def test_duplicate_ids_are_made_unique() -> None:
    """Ids become layout ids, where a collision silently merges two scenes'
    prop schemas and image capability."""
    scenes = [dict(s, id="same") for s in _scenes(OK)]
    docs, _ = _validate(scenes)
    ids = [s["id"] for s in docs["scenes"]]
    assert len(set(ids)) == len(ids)


@pytest.mark.parametrize("bad", [None, "", "not json", "{}", "[]", 123])
def test_unusable_output_is_rejected_not_crashed(bad) -> None:
    docs, _ = validate_design_docs(GENERAL, bad, "{}")
    assert docs is None


def test_render_hints_are_snapped() -> None:
    docs, _ = _validate(
        _scenes(OK), hints='{"heading_font": "Cormorant Garamond", "body_font": "lora"}'
    )
    # An unbundled font would render as system sans, so it is replaced.
    assert docs["identity"]["heading_font"] != "Cormorant Garamond"
    assert docs["identity"]["body_font"] == "lora"


# ─── The fallback must always be usable ──────────────────────────────────────


def test_fallback_is_always_valid() -> None:
    docs = fallback_design_docs(
        {"style": "editorial", "category": "news", "fonts": {"heading": "lora"}}, "Acme"
    )
    assert len(docs["scenes"]) >= MIN_SCENES
    assert docs["scenes"][0]["role"] == "intro"
    assert docs["scenes"][-1]["role"] == "outro"
    assert docs["identity"]["heading_font"] == "lora"
    for s in docs["scenes"]:
        assert s["image_mode"] in IMAGE_MODES or s["image_mode"] is None


def test_fallback_survives_an_empty_theme() -> None:
    docs = fallback_design_docs(None, "")
    assert len(docs["scenes"]) >= MIN_SCENES
    assert docs["identity"]["heading_font"]


def test_the_fallback_would_pass_its_own_validation() -> None:
    """The floor and the fallback must be raised together.

    The fallback exists to keep a generation alive when the model fails, so a
    fallback that is itself too short to be a legal template is worse than
    useless — it turns a recoverable failure into a broken one. This caught the
    5-scene fallback when the floor moved to 8.
    """
    docs = fallback_design_docs({"style": "editorial"}, "Acme")
    assert MIN_SCENES <= len(docs["scenes"]) <= MAX_SCENES

    revalidated, _ = validate_design_docs(
        docs["general_doc"], json.dumps(docs["scenes"]), "{}"
    )
    assert revalidated is not None, "the fallback does not survive validation"
    assert len(revalidated["scenes"]) == len(docs["scenes"])


def test_the_fallback_layouts_are_distinct() -> None:
    """Its scenes must not all be the same shape, or a fallback template is the
    exact repetition this refactor exists to remove."""
    docs = fallback_design_docs({"style": "editorial"}, "Acme")
    ids = [s["id"] for s in docs["scenes"]]
    assert len(set(ids)) == len(ids)
    # A mix of image treatments, not one repeated.
    modes = {s["image_mode"] for s in docs["scenes"]}
    assert len(modes) >= 2, f"every fallback scene uses the same image mode: {modes}"


# ─── Video-scale type floor ──────────────────────────────────────────────────
#
# The design stage is TOLD the canvas is 1920x1080, but when it ignores that and
# writes "12px" the scene builder faithfully renders 12px — measured on template
# 174, where 34 of its 75 px values were undersized type. These cover the
# deterministic backstop.


def test_undersized_type_is_scaled_to_the_floor() -> None:
    doc = "Header 'TELEMETRY' at 12px, a label at 14px, and a value at 56px."
    out, factor = _rescale_doc_type(doc)
    assert factor > 1.0
    sizes = [int(m) for m in re.findall(r"(\d+)\s*px", out)]
    assert min(sizes) >= MIN_ON_SCREEN_PX


def test_rescaling_preserves_the_hierarchy() -> None:
    """Scaling only the offending values would flatten the design.

    A label that was a quarter of the headline must still be a quarter of it.
    """
    doc = "label 12px, body 24px, headline 96px."
    out, _ = _rescale_doc_type(doc)
    lo, mid, hi = [int(m) for m in re.findall(r"(\d+)\s*px", out)]
    assert round(hi / lo) == 8      # was 96/12
    assert round(mid / lo) == 2     # was 24/12


def test_hairlines_and_gaps_are_not_type() -> None:
    """Rescaling these would thicken every rule in the design."""
    doc = "A 1px hairline, a 4px gap, and a label at 12px."
    out, _ = _rescale_doc_type(doc)
    assert "1px hairline" in out
    assert "4px gap" in out


def test_ranges_scale_at_both_ends() -> None:
    """"56-64px" carries the unit only on the second number.

    A px-only rewrite scales the top and leaves the bottom, inverting the range
    into something like "56-117px".
    """
    doc = "label 12px, value 56-64px."
    out, _ = _rescale_doc_type(doc)
    lo, hi = [int(m) for m in re.findall(r"(\d+)\s*(?:-|px)", out)][1:3]
    assert lo < hi, f"range inverted: {out}"


def test_a_correct_doc_is_left_alone() -> None:
    doc = "body copy 30px, headline 90px, hero numeral 180px."
    out, factor = _rescale_doc_type(doc)
    assert factor == 1.0
    assert out == doc


def test_a_doc_written_at_ui_scale_is_rejected() -> None:
    """Beyond the rescale ceiling the doc was written for a different medium;
    patching it would blow up its headlines, so the caller re-rolls."""
    # 9px would only need x2.44 and is repairable; 6px needs x3.67, which would
    # also turn a 72px headline into 264px — past the point where patching is
    # honest.
    scenes = _scenes(OK)
    scenes[2]["doc"] = "A tiny label at 6px above a headline at 72px. " + DOC
    docs, repairs = _validate(scenes)
    assert docs is None
    assert any("UI scale" in r for r in repairs)


def test_rescaling_is_reported_as_a_repair() -> None:
    scenes = _scenes(OK)
    scenes[1]["doc"] = "A label at 14px above a headline at 70px. " + DOC
    docs, repairs = _validate(scenes)
    assert docs is not None
    assert any("scaled" in r for r in repairs)
    sizes = [int(m) for m in re.findall(r"(\d+)\s*px", docs["scenes"][1]["doc"])]
    assert all(s >= MIN_ON_SCREEN_PX for s in sizes if s > 8)


@pytest.mark.parametrize(
    "doc,expect_scaled",
    [
        # A rule/hairline is not type, even when a typographic noun precedes it.
        # This exact phrasing rejected a whole usable doc at x22.
        ("Below the heading, a 1px full-width rule spans the frame.", False),
        # A decorative dot is not type either, even beside a label size.
        ("A label 'SYSTEMS' at 12px, with a red dot (6px diameter).", True),
        # Shape nouns in general.
        ("A 2px border, a 4px gap, and a 6px radius.", False),
    ],
)
def test_small_values_are_type_only_when_they_describe_type(doc, expect_scaled) -> None:
    """The number's NOUN decides, not words merely near it.

    A false positive is far worse than a missed rescale: it discards the whole
    design, whereas a miss leaves one small label.
    """
    out, factor = _rescale_doc_type(doc)
    assert (factor != 1.0) is expect_scaled, f"factor={factor} for {doc!r}"
    if not expect_scaled:
        assert out == doc


# ─── Required content scenes ─────────────────────────────────────────────────
#
# A blog post routinely carries metrics, a timeline, a comparison and a process,
# and each needs a layout built for it. Before this, a template could ship with
# none of them — template 175 came out as title/half/quote/grid/stat/split/
# narrative/closing.


def _typed(n: int, types: list[str]) -> list[dict]:
    out = []
    for i in range(n):
        out.append({
            "id": f"s{i}", "role": "content", "doc": DOC,
            "content_type": types[i] if i < len(types) else "plain",
            "supports_image": False, "image_mode": None, "image_side": None,
        })
    return out


def test_a_doc_set_missing_required_types_is_rejected() -> None:
    docs, repairs = _validate(_typed(OK, ["plain"] * OK))
    assert docs is None
    assert any("required scene types" in r for r in repairs)


def test_a_covering_doc_set_is_accepted() -> None:
    types = ["plain", "metrics", "timeline", "comparison", "steps", "quote", "bullets", "plain"]
    docs, _ = _validate(_typed(OK, types))
    assert docs is not None
    assert not _missing_required_types(docs["scenes"])


def test_the_last_attempt_accepts_and_grafts_instead_of_losing_the_run() -> None:
    """Re-rolling forever over one absent scene type is the worse trade.

    A grafted scene is generic — it comes from the deterministic fallback rather
    than this brand's director — so it is the last resort, not the first.
    """
    docs, _ = _validate_no_types(_typed(OK, ["plain"] * OK))
    assert docs is not None, "should be accepted when types are not required"

    notes = _fill_missing_types(docs, {"style": "editorial"}, "Acme")
    assert len(notes) == len(REQUIRED_CONTENT_TYPES)
    assert not _missing_required_types(docs["scenes"])
    # The graft must not push past the ceiling or disturb the bookends.
    assert len(docs["scenes"]) <= MAX_SCENES
    assert docs["scenes"][0]["role"] == "intro"
    assert docs["scenes"][-1]["role"] == "outro"


def test_bookends_are_never_content_routed() -> None:
    """The intro carries the title and the outro the CTA. Labelling either
    otherwise would let an article's metrics land on the title card."""
    types = ["metrics", "metrics", "timeline", "comparison", "steps", "quote", "bullets", "timeline"]
    docs, _ = _validate(_typed(OK, types))
    assert docs["scenes"][0]["content_type"] == "plain"
    assert docs["scenes"][-1]["content_type"] == "plain"


def test_an_unknown_content_type_falls_back_rather_than_dropping_the_scene() -> None:
    types = ["plain", "metrics", "timeline", "comparison", "steps", "nonsense", "bullets", "plain"]
    docs, _ = _validate(_typed(OK, types))
    assert docs is not None
    assert docs["scenes"][5]["content_type"] == "plain"


def test_content_types_come_from_the_shared_taxonomy() -> None:
    """Not a restated list — a duplicate would drift and break routing."""
    from app.services.content_classifier import CONTENT_TYPES

    assert set(REQUIRED_CONTENT_TYPES) <= set(CONTENT_TYPES)


def test_the_fallback_can_donate_every_required_type() -> None:
    """If it cannot, grafting has no donor and the guarantee is empty."""
    docs = fallback_design_docs({"style": "editorial"}, "Acme")
    assert not _missing_required_types(docs["scenes"])
    assert MIN_SCENES <= len(docs["scenes"]) <= MAX_SCENES


# ── truncation resilience ────────────────────────────────────────────────────


def test_a_truncated_trailing_field_does_not_discard_the_whole_stage() -> None:
    """One missing output field must not cost a complete design.

    DSPy's JSONAdapter compares the parsed keys to the signature with STRICT
    equality (`fields.keys() != signature.output_fields.keys()`), so a response
    truncated anywhere past the last essential field raises AdapterParseError
    and the entire stage is thrown away.

    Measured on template 181: the model returned a full, high-quality doc set —
    general_doc plus all eight scene docs — and lost it because `render_hints`,
    the final field, was cut off. It exhausted its attempts and fell back to the
    deterministic docs.

    The fix is a default on the fields that are advisory rather than essential,
    which makes them optional when the adapter fills a truncated response. This
    pins the split: the two fields that ARE the design stay required.

    Asserted against the SIGNATURE rather than by calling the adapter helper
    that fills the defaults. That helper is a DSPy internal and it moved: this
    test used to import `dspy.adapters.utils.apply_output_field_defaults`, which
    does not exist in the pinned dspy==3.1.3 and made the test fail on a correct
    codebase. The guarantee worth pinning is which fields are optional and what
    they default to — that is ours, it is what actually prevents the template-181
    failure, and it does not depend on where DSPy keeps its filling logic.
    """
    from app.dspy_modules.design_doc import GenerateTemplateDesignDocs as Sig

    required = {n for n, f in Sig.output_fields.items() if f.is_required()}
    assert required == {"general_doc", "scenes_json"}, required

    # Template 181's exact response shape: everything but render_hints. The two
    # fields that survived truncation are exactly the required set, so the
    # adapter has every field it must have and can default the rest.
    parsed = {"reasoning": "…", "general_doc": "the identity", "scenes_json": "[]"}
    assert required <= parsed.keys()

    # render_hints is advisory: it must be optional AND carry a default the
    # consumer tolerates (see test_render_hints_survives_being_absent).
    _hints = Sig.output_fields["render_hints"]
    assert not _hints.is_required()
    assert _hints.default == ""


def test_render_hints_survives_being_absent() -> None:
    """The default is only safe because the consumer already tolerates it."""
    from app.services.render_registry import validate_render_hints

    hints = validate_render_hints("")
    assert hints["identity"]["heading_font"]
    assert hints["transition_family"]


def test_only_essential_theme_fields_are_required() -> None:
    """Same fragility, larger blast radius: the theme signatures had SEVEN
    required fields. The three with existing consumer-side fallbacks are now
    optional, so a truncated tail no longer discards a whole extraction."""
    from app.dspy_modules.theme_extractor import (
        ExtractThemeFromBrief,
        ExtractThemeFromContent,
    )

    for sig in (ExtractThemeFromContent, ExtractThemeFromBrief):
        optional = {n for n, f in sig.output_fields.items() if not f.is_required()}
        assert optional == {"patterns_json", "template_name", "brand_description"}, (
            sig.__name__,
            optional,
        )
        # theme_json IS the extraction — it must never become optional.
        assert sig.output_fields["theme_json"].is_required()


# ── font names must be storable AND loadable ─────────────────────────────────


def test_theme_font_names_are_snapped_to_real_faces() -> None:
    """The preview builds a Google Fonts URL from the stored theme font.

    Google Fonts is case-sensitive and rejects snake_case: `family=merriweather`
    returns HTTP 400 (verified live), `family=Merriweather` returns 200. The
    extractor stored whatever the model wrote, so 4 of the 12 most recent
    templates carried a name that 400s — the stylesheet never loaded and every
    scene silently fell back to the system sans.

    snap() normalises case and separators onto a real registry id, and a face
    the app does not ship falls back to the default rather than being stored as
    an unrenderable string.
    """
    from app.services.render_registry import (
        DEFAULT_HEADING_FONT,
        FONT_IDS,
        snap,
    )

    # The exact values found stored on templates 181/175/171/168.
    for stored in ("merriweather", "oswald", "playfair_display", "dm_sans"):
        assert snap(stored, FONT_IDS, DEFAULT_HEADING_FONT) == stored

    # Case and separator variants land on the same id.
    assert snap("Playfair Display", FONT_IDS, DEFAULT_HEADING_FONT) == "playfair_display"
    assert snap("Merriweather", FONT_IDS, DEFAULT_HEADING_FONT) == "merriweather"

    # A face nothing ships must NOT be stored verbatim — template 181's theme
    # named "Geist Mono", which resolves to null everywhere and loaded nothing.
    for phantom in ("Geist Mono", "Space Grotesk", "Satoshi"):
        assert snap(phantom, FONT_IDS, DEFAULT_HEADING_FONT) == DEFAULT_HEADING_FONT
