"""Design Blueprint validation and image-capability wiring (P2).

The blueprint is what replaces the fixed five-composition vocabulary that made
every custom template share a structural rhythm. Two properties matter most and
are pinned here:

  1. It can never break generation. Bad model output is REPAIRED, not rejected;
     only a structurally hopeless blueprint raises (so the caller retries, then
     falls back to the deterministic path).
  2. It does not smuggle in a new house style. In particular the bookends are
     designed per brand — the old code forced a loud intro and a quiet outro on
     everyone, and picked their artifacts by fixed index.
"""
from __future__ import annotations

import pytest

from app.dspy_modules.blueprint import (
    _extract_json_object,
    fallback_blueprint,
    layout_for_scene,
    validate_blueprint,
)
from app.services.content_classifier import CONTENT_TYPES
from app.services.custom_prompt_builder import build_custom_meta
from app.services.kit_vocabulary import ARTIFACT_MOTIONS, DECOR_SYSTEMS, SURFACE_VARIANTS

GEOM = (
    "A generous, specific geometry description that comfortably exceeds the "
    "minimum length required for a layout to be considered authored."
)


def _blueprint(**over) -> dict:
    shapes = [("bullets", "split"), ("metrics", "inset_card"), ("quote", "masked"), ("steps", "full_bleed")]
    d = {
        "identity": {
            "name": "Ledger",
            "decor_system": "columnRules",
            "surface_default": "paper",
            "artifact_set": ["typeset", "trace"],
            "motion_energy": "calm",
        },
        "layouts": (
            [{"id": "open", "role": "intro", "geometry": GEOM, "geometry_portrait": GEOM}]
            + [
                {
                    "id": f"c{i}",
                    "role": "content",
                    "geometry": GEOM,
                    "geometry_portrait": GEOM,
                    "best_for": [b],
                    "image_treatment": t,
                }
                for i, (b, t) in enumerate(shapes)
            ]
            + [{"id": "close", "role": "outro", "geometry": GEOM, "geometry_portrait": GEOM}]
        ),
    }
    d.update(over)
    return d


# ─── Repair, never reject ────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "structure",
    [
        # The exact shape that crashed template 135: the model wrote a bare
        # `true` where the schema expects an object, which is a natural shorthand
        # for "yes, this template has chrome".
        {"chrome": True, "section_dividers": False, "panel_numbering": True,
         "drop_caps": False, "safe_area": True},
        True,          # the whole section as a bool
        "minimal",     # ...as a string
        [1, 2],        # ...as a list
        None,
    ],
)
def test_non_dict_sections_are_repaired_not_raised(structure) -> None:
    """`x or {}` guards None and {} but NOT a truthy non-dict.

    A bare `true` sailed past that guard and `.get()` blew up with
    "'bool' object has no attribute 'get'", failing the ENTIRE generation. This
    stage repairs bad input by contract; it must never raise on a shape the model
    can plausibly emit.
    """
    bp, _ = validate_blueprint(_blueprint(structure=structure), seed="s")
    assert isinstance(bp["structure"]["chrome"], dict)
    assert isinstance(bp["structure"]["safe_area"]["landscape"], dict)


def test_bare_true_is_read_as_enabled() -> None:
    """`"chrome": true` means the brand HAS chrome — don't silently drop it."""
    bp, _ = validate_blueprint(_blueprint(structure={"chrome": True}), seed="s")
    assert bp["structure"]["chrome"]["enabled"] is True


@pytest.mark.parametrize("section", ["identity", "type_system", "bookends"])
def test_other_raw_sections_tolerate_non_dicts(section: str) -> None:
    """identity / type_system / bookends read raw model output too."""
    bp, _ = validate_blueprint(_blueprint(**{section: True}), seed="s")
    assert bp["identity"]["name"]
    assert isinstance(bp["type_system"], dict)
    assert isinstance(bp["bookends"]["intro"], dict)


def test_hallucinated_vocabulary_is_repaired() -> None:
    """An invented decor system must snap to a real one rather than silently
    falling through to a default at render time."""
    bad = _blueprint()
    bad["identity"]["decor_system"] = "brutalist"
    bad["identity"]["surface_default"] = "neumorphic"

    bp, repairs = validate_blueprint(bad, seed="x")

    assert bp["identity"]["decor_system"] in DECOR_SYSTEMS
    assert bp["identity"]["surface_default"] in SURFACE_VARIANTS
    assert any("brutalist" in r for r in repairs)


def test_numeric_ranges_are_clamped() -> None:
    """The readability floors the prompt used to state in prose survive as data:
    body text cannot go below 28px and the safe area stays inside 2-14%."""
    bad = _blueprint()
    bad["structure"] = {"safe_area": {"landscape": {"top": 40, "right": -5, "bottom": 6, "left": 8}}}
    bad["type_system"] = {"base_body_px_landscape": 9, "scale_ratio": 9}

    bp, _ = validate_blueprint(bad, seed="x")

    land = bp["structure"]["safe_area"]["landscape"]
    assert land["top"] == 14.0 and land["right"] == 2.0
    assert bp["type_system"]["base_body_px_landscape"] == 28
    assert bp["type_system"]["scale_ratio"] == 1.7


def test_best_for_is_restricted_to_classifier_taxonomy() -> None:
    """best_for must use the classifier's vocabulary or scene->variant matching
    silently degrades to round-robin."""
    bad = _blueprint()
    bad["layouts"][1]["best_for"] = ["dataviz", "nonsense"]

    bp, _ = validate_blueprint(bad, seed="x")

    for layout in bp["layouts"]:
        assert set(layout["best_for"]) <= CONTENT_TYPES


def test_vague_geometry_is_dropped() -> None:
    """A one-word geometry is the model punting; the layout is not usable."""
    bad = _blueprint()
    bad["layouts"].append(
        {"id": "extra", "role": "content", "geometry": "split", "best_for": ["code"]}
    )
    bp, repairs = validate_blueprint(bad, seed="x")

    assert "extra" not in [l["id"] for l in bp["layouts"]]
    assert any("vague" in r for r in repairs)


def test_duplicate_content_shapes_are_deduped() -> None:
    """Two content layouts with the same content shape AND image treatment
    produce two scenes that look the same."""
    bad = _blueprint()
    bad["layouts"].append(
        {
            "id": "dupe",
            "role": "content",
            "geometry": GEOM,
            "geometry_portrait": GEOM,
            "best_for": ["bullets"],
            "image_treatment": "split",
        }
    )
    bp, repairs = validate_blueprint(bad, seed="x")

    assert "dupe" not in [l["id"] for l in bp["layouts"]]
    assert any("duplicates" in r for r in repairs)


def test_second_intro_is_demoted_not_rejected() -> None:
    bad = _blueprint()
    bad["layouts"][1]["role"] = "intro"

    bp, _ = validate_blueprint(bad, seed="x")

    assert len([l for l in bp["layouts"] if l["role"] == "intro"]) == 1
    assert len([l for l in bp["layouts"] if l["role"] == "outro"]) == 1


def test_too_few_content_layouts_raises() -> None:
    """Raising here is correct: it triggers a retry, then the fallback."""
    thin = _blueprint()
    thin["layouts"] = thin["layouts"][:3]
    with pytest.raises(ValueError):
        validate_blueprint(thin, seed="x")


# ─── Bookends are per brand, not a house style ───────────────────────────────


def test_bookend_energy_is_not_forced_into_an_arc() -> None:
    """The old prompt hardcoded 'the intro is loud, the outro is calm'. A quiet
    open and an emphatic close must survive validation untouched."""
    d = _blueprint(bookends={
        "intro": {"opening_move": "type_set", "energy": "quiet"},
        "outro": {"closing_move": "rule_close", "energy": "loud"},
    })
    bp, _ = validate_blueprint(d, seed="x")

    assert bp["bookends"]["intro"]["energy"] == "quiet"
    assert bp["bookends"]["outro"]["energy"] == "loud"


def test_bookend_artifacts_differ() -> None:
    """Previously guaranteed by fixed indices (artifact_set[0] / [-1]); now a
    rule, so it holds however the model assigns them."""
    d = _blueprint()
    d["layouts"][0]["artifact"] = "typeset"
    d["layouts"][-1]["artifact"] = "typeset"

    bp, _ = validate_blueprint(d, seed="x")

    intro = next(l for l in bp["layouts"] if l["role"] == "intro")
    outro = next(l for l in bp["layouts"] if l["role"] == "outro")
    assert intro["artifact"] != outro["artifact"]


# ─── Image capability ────────────────────────────────────────────────────────


def test_outro_is_always_image_incapable() -> None:
    """The CTA overlay REPLACES the outro visual at render time, and built-ins
    likewise list ending_socials in layouts_without_image."""
    d = _blueprint()
    d["layouts"][-1]["supports_image"] = True
    d["layouts"][-1]["image_treatment"] = "split"

    bp, repairs = validate_blueprint(d, seed="x")

    outro = next(l for l in bp["layouts"] if l["role"] == "outro")
    assert outro["supports_image"] is False
    assert outro["image_treatment"] == "none"
    assert any("outro forced" in r for r in repairs)


def test_image_capable_floor_is_enforced() -> None:
    """Most blog scenes carry an image; a blueprint where nothing takes one
    would strand the pipeline's image assignments."""
    d = _blueprint()
    for layout in d["layouts"]:
        if layout["role"] == "content":
            layout["supports_image"] = False
            layout["image_treatment"] = "none"

    bp, _ = validate_blueprint(d, seed="x")

    content = [l for l in bp["layouts"] if l["role"] == "content"]
    capable = [l for l in content if l["supports_image"]]
    assert len(capable) >= int(len(content) * 0.6)


def test_supports_image_and_treatment_stay_consistent() -> None:
    d = _blueprint()
    d["layouts"][1]["supports_image"] = False
    d["layouts"][1]["image_treatment"] = "split"

    bp, _ = validate_blueprint(d, seed="x")

    for layout in bp["layouts"]:
        if not layout["supports_image"]:
            assert layout["image_treatment"] == "none"


def test_meta_marks_image_incapable_layouts() -> None:
    """The payoff: layouts_without_image is the one mechanism the whole product
    already reads — image generation, stock clips, the pipeline, and all three
    SceneEditModal surfaces — so driving it from the blueprint gives custom
    templates built-in parity with no new plumbing."""
    bp = {
        "layouts": [
            {"id": "open", "role": "intro", "supports_image": True},
            {"id": "a", "role": "content", "supports_image": True},
            {"id": "b", "role": "content", "supports_image": False},
            {"id": "close", "role": "outro", "supports_image": False},
        ]
    }
    meta = build_custom_meta(
        {"colors": {"accent": "#f50", "bg": "#fff", "text": "#111"}},
        "T",
        content_codes_count=2,
        content_archetype_ids=[{"id": "a"}, {"id": "b"}],
        design_blueprint=bp,
    )

    without = set(meta["layouts_without_image"])
    assert "content_1" in without
    assert "content_0" not in without
    assert "outro" in without
    assert {"custom_chart", "custom_table"} <= without


def test_meta_without_blueprint_keeps_legacy_behaviour() -> None:
    """Templates generated before the blueprint existed must not change."""
    meta = build_custom_meta(
        {"colors": {"accent": "#f50", "bg": "#fff", "text": "#111"}},
        "T",
        content_codes_count=2,
        content_archetype_ids=[{"id": "a"}, {"id": "b"}],
    )
    without = set(meta["layouts_without_image"])
    assert {"custom_chart", "custom_table"} <= without
    assert not any(k.startswith("content_") for k in without)


# ─── Fallback + helpers ──────────────────────────────────────────────────────


def test_fallback_preserves_brand_signature() -> None:
    """A blueprint failure must degrade to today's behaviour, not to a generic
    default that would look the same for every brand."""
    theme = {
        "signature": {
            "decorSystem": "hairlines",
            "surfaceStyle": "flat-hairline",
            "artifactSet": ["draw-in", "orbit"],
            "typeTreatment": "editorial-serif",
        }
    }
    archetypes = [
        {"id": "bullets_list", "best_for": ["bullets"]},
        {"id": "stat_wall", "best_for": ["metrics"]},
        {"id": "quote_card", "best_for": ["quote"]},
        {"id": "steps_flow", "best_for": ["steps"]},
    ]

    bp = fallback_blueprint(theme, archetypes, name="Fallback")

    assert bp["identity"]["decor_system"] == "hairlines"
    assert bp["identity"]["surface_default"] == "flat-hairline"
    assert bp["identity"]["artifact_set"][0] in ARTIFACT_MOTIONS
    assert [l["role"] for l in bp["layouts"]][0] == "intro"
    assert [l["role"] for l in bp["layouts"]][-1] == "outro"


def test_layout_for_scene_routing() -> None:
    bp, _ = validate_blueprint(_blueprint(), seed="x")

    assert layout_for_scene(bp, "intro")["role"] == "intro"
    assert layout_for_scene(bp, "outro")["role"] == "outro"
    assert layout_for_scene(bp, "content", 0)["role"] == "content"
    # Index wraps rather than raising.
    assert layout_for_scene(bp, "content", 99) is not None
    assert layout_for_scene({}, "intro") is None


@pytest.mark.parametrize(
    "raw",
    [
        '{"a":1}',
        '```json\n{"a":1}\n```',
        'Here is the blueprint:\n{"a":1}',
        '{"a":1}\nHope that helps!',
    ],
)
def test_json_extraction_tolerates_llm_slop(raw: str) -> None:
    assert _extract_json_object(raw) == {"a": 1}


# ── best_for inference (layout content affinity) ─────────────────────────────
#
# Measured on all seven stored blueprint-era templates: EVERY content layout
# had best_for=["plain"], including ones the model itself named metrics_row_4up,
# quote_center_red and bullets_sidebar_left. The prompt named the field but its
# legal values appeared nowhere, so every guess was filtered out and the default
# took over. Downstream that collapses content matching to round-robin and makes
# every preview scene render the same placeholder copy.


@pytest.mark.parametrize(
    "layout_id,expected",
    [
        ("metrics_row_4up", "metrics"),
        ("stat_spotlight_large", "metrics"),
        ("quote_center_red", "quote"),
        ("rider_voices", "quote"),
        ("bullets_sidebar_left", "bullets"),
        ("feature_list_stack", "bullets"),
        ("milestone_timeline", "timeline"),
        ("journey_horizontal", "timeline"),
        ("station_steps", "steps"),
        ("how_it_works_3up", "steps"),
        ("service_tiers", "comparison"),
        ("code_snippet_dark", "code"),
    ],
)
def test_best_for_is_inferred_from_the_layouts_own_name(layout_id, expected) -> None:
    from app.dspy_modules.blueprint import _infer_best_for

    assert _infer_best_for(layout_id, "") == [expected]


def test_best_for_inference_falls_back_to_geometry_then_gives_up() -> None:
    from app.dspy_modules.blueprint import _infer_best_for

    assert _infer_best_for("layout_2", "Four large metric figures across the top") == ["metrics"]
    # Nothing to go on — the caller's "plain" default is correct here.
    assert _infer_best_for("layout_2", "A calm split with copy on the left") == []


def test_a_blueprint_with_no_best_for_still_gets_varied_affinity() -> None:
    """The end-to-end shape of the bug: named layouts, no best_for supplied."""
    raw = _blueprint(
        layouts=[
            {
                "id": "intro",
                "role": "intro",
                "geometry": "A centred brand lockup with the mark above the headline and space around it.",
            },
            *[
                {
                    "id": lid,
                    "role": "content",
                    "geometry": f"A distinct composition for {lid} filling the frame with its own structure.",
                }
                for lid in (
                    "metrics_row_4up",
                    "quote_center_red",
                    "bullets_sidebar_left",
                    "milestone_timeline",
                    "split_image_left",
                )
            ],
            {
                "id": "outro",
                "role": "outro",
                "geometry": "A calm sign-off with the brand mark low in the frame and room for a CTA.",
            },
        ]
    )
    bp, _ = validate_blueprint(raw, seed="cat|style|Brand")
    tags = {
        l["best_for"][0] for l in bp["layouts"] if l["role"] == "content" and l.get("best_for")
    }
    assert len(tags) >= 3, f"content affinity collapsed: {tags}"
    assert "metrics" in tags and "quote" in tags
