"""Editable template typefaces, and the per-scene showcase copy.

Two features on the custom-template editor:

  * FONTS. The editor can now set the heading/body typeface. Values are
    normalised to renderer-resolvable ids, but a legacy free-form name from the
    theme extractor must NEVER be rejected — that would 422 an unrelated colour
    rename on every template generated before the picker existed.

  * SAMPLE COPY. Preview text used to be synthesised in the browser, so it was
    generic and unrelated to the template. It is now generated per scene and
    stored, with a deterministic fallback so a scene is never left blank.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.routers.custom_templates import _design_version, _validate_theme
from app.services.code_generator import (
    _fallback_sample_content,
    _parse_sample_content,
)


def _theme(**over) -> dict:
    theme = {
        "colors": {"accent": "#7C3AED", "bg": "#FFFFFF", "text": "#1A1A2E"},
        "fonts": {"heading": "inter", "body": "inter"},
    }
    theme.update(over)
    return theme


# ─── Fonts ────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("dm_sans", "dm_sans"),
        ("DM Sans", "dm_sans"),        # editor label
        ("playfair-display", "playfair_display"),  # hyphenated
        ("  Poppins  ", "poppins"),    # padded
    ],
)
def test_resolvable_font_names_are_normalised_to_registry_ids(raw, expected):
    out = _validate_theme(_theme(fonts={"heading": raw, "body": "inter"}))
    assert out["fonts"]["heading"] == expected


def test_legacy_unresolvable_font_passes_through_untouched():
    """The important one.

    Existing templates store whatever the extractor guessed. Rejecting those
    would make saving a colour change impossible on every such template.
    """
    out = _validate_theme(
        _theme(fonts={"heading": "Cormorant Garamond", "body": "inter"})
    )
    assert out["fonts"]["heading"] == "Cormorant Garamond"


def test_missing_fonts_object_is_still_rejected():
    with pytest.raises(HTTPException) as exc:
        _validate_theme({"colors": {"accent": "#000", "bg": "#FFF", "text": "#111"}})
    assert exc.value.status_code == 422


def test_non_string_font_is_left_alone_not_crashed():
    out = _validate_theme(_theme(fonts={"heading": None, "body": 42}))
    assert out["fonts"]["heading"] is None
    assert out["fonts"]["body"] == 42


# ─── Design version ───────────────────────────────────────────────────────


class _Tpl:
    def __init__(self, design_blueprint=None):
        self.design_blueprint = design_blueprint


@pytest.mark.parametrize(
    "blueprint,expected",
    [
        (None, 1),                          # never generated a design
        ('{"version": 2}', 2),
        ('{"version": 1}', 1),
        ('{}', 1),                          # blueprint without a version
        ("not json", 1),                    # unreadable -> legacy behaviour
        ('[1,2,3]', 1),                     # wrong shape
        ('{"version": "2"}', 2),            # stringified number
    ],
)
def test_design_version_defaults_to_legacy_on_anything_unreadable(blueprint, expected):
    assert _design_version(_Tpl(blueprint)) == expected


# ─── Sample copy ──────────────────────────────────────────────────────────


def test_sample_keeps_only_fields_the_content_type_renders():
    """A field the layout does not read would imply a preview it cannot show."""
    parsed = _parse_sample_content(
        '{"sceneTitle":"Impact","displayText":"By the Numbers",'
        '"narrationText":"How we measure up.",'
        '"metrics":[{"value":"3x","label":"Growth"}],'
        '"bullets":["not for a metrics layout"]}',
        "metrics",
    )
    assert parsed["metrics"] == [{"value": "3x", "label": "Growth"}]
    assert "bullets" not in parsed
    # Sample copy is TWO fields now. narrationText was write-only — nothing ever
    # read it back — and the voiceover it shared a name with is a wholly
    # separate field (Scene.narration_text). The allowlist is what drops it, so
    # a model that still emits one cannot smuggle it into the DB.
    assert "narrationText" not in parsed


def test_sample_without_a_headline_is_rejected():
    """displayText is the one field every layout renders."""
    assert _parse_sample_content('{"narrationText":"orphan copy"}', "plain") == {}


def test_fallback_copy_matches_the_two_field_shape():
    """The fallback must produce what the contract asks the model for.

    A real title of 5-7 words leading a short supporting line. The previous
    fallback wrote a 4-word kicker over a three-sentence paragraph, because
    `titleFontSize` sized the paragraph and the title was an optional eyebrow.
    Both halves moved: the title got longer and load-bearing, the copy got
    shorter.
    """
    from app.services.code_generator import _fallback_sample_content

    for content_type in (
        "plain", "metrics", "bullets", "steps",
        "quote", "comparison", "timeline", "code",
    ):
        sample = _fallback_sample_content("Acme", content_type)
        assert "narrationText" not in sample, content_type

        # A real title, not a one-word category label. The band is loose at the
        # bottom because a short brand name can pull a phrase under five words
        # ("How Acme got here"); what it rules out is "Highlights".
        title = sample.get("sceneTitle") or ""
        assert 3 <= len(title.split()) <= 8, (content_type, title)

        # Supporting copy: a sentence or so, not a paragraph. The ceiling is the
        # half that matters — it is what the old fallback broke.
        copy = sample["displayText"]
        assert 30 <= len(copy) <= 170, (content_type, copy)
        assert copy.strip().lower() != title.strip().lower(), content_type


def test_plain_fallback_still_rotates():
    """Several plain scenes in one template must not render identical copy."""
    from app.services.code_generator import _fallback_sample_content

    variants = {
        _fallback_sample_content("Acme", "plain", i)["displayText"] for i in range(4)
    }
    assert len(variants) == 4


def test_sample_drops_copy_that_repeats_the_title():
    """Otherwise the scene paints the same sentence twice.

    The TITLE is what survives. It is the scene's main label and the largest
    type on the frame, so when the two fields collide the display text is the
    one that drops. This was the other way round while displayText was the
    headline and the title an optional eyebrow.
    """
    parsed = _parse_sample_content(
        '{"sceneTitle":"Our Story","displayText":"Our Story"}', "plain"
    )
    assert parsed["sceneTitle"] == "Our Story"
    assert "displayText" not in parsed


@pytest.mark.parametrize("raw", ["", "not json at all", "{unclosed", "[]"])
def test_malformed_sample_never_raises(raw):
    assert _parse_sample_content(raw, "plain") == {}


def test_sample_survives_markdown_fences_and_surrounding_prose():
    parsed = _parse_sample_content(
        'Here you go:\n```json\n{"sceneTitle":"Built for Scale From Day One",'
        '"displayText":"Every service scales out horizontally."}\n```',
        "plain",
    )
    assert parsed["sceneTitle"] == "Built for Scale From Day One"
    assert parsed["displayText"] == "Every service scales out horizontally."


@pytest.mark.parametrize(
    "content_type,required",
    [
        ("metrics", "metrics"),
        ("bullets", "bullets"),
        ("steps", "steps"),
        ("quote", "quote"),
        ("timeline", "timelineItems"),
        ("comparison", "comparisonLeft"),
        ("code", "codeLines"),
    ],
)
def test_fallback_populates_the_fields_its_layout_renders(content_type, required):
    """Every scene gets usable copy even when the model returns nothing."""
    sample = _fallback_sample_content("Acme", content_type)
    assert sample["displayText"]
    assert sample.get(required)


def test_plain_fallback_rotates_so_scenes_do_not_repeat():
    """A template with several plain layouts must not render one slide N times."""
    headlines = {_fallback_sample_content("Acme", "plain", i)["displayText"] for i in range(4)}
    assert len(headlines) == 4


# ─── Per-scene default type sizes ─────────────────────────────────────────


def test_font_defaults_stay_inside_the_renderable_bands():
    """Rule 7d's bands are what the validator enforces on generated scenes.

    A computed default outside them would either be invisible after H.264 or
    overflow the block, and the scene builder would have rejected it.
    """
    from app.services.code_generator import _TYPE_BANDS, _compute_scene_font_defaults

    for length in (0, 30, 80, 140, 200, 280, 400, 900):
        sizes = _compute_scene_font_defaults({"displayText": "x" * length}, "plain")
        for axis in ("title", "description"):
            for orientation in ("landscape", "portrait"):
                lo, hi = _TYPE_BANDS[axis][orientation]
                assert lo <= sizes[axis][orientation] <= hi, (axis, orientation, length)


def test_portrait_type_is_never_larger_than_landscape():
    """The invariant rule 7d calls the most common reason a scene is rejected.

    The portrait canvas is 1080 wide against landscape's 1920, so the same point
    size eats nearly twice the line — portrait must be SMALLER, which is the
    opposite of the usual convention and easy to invert by accident.
    """
    from app.services.code_generator import _compute_scene_font_defaults

    for length in (0, 60, 150, 300, 600):
        sizes = _compute_scene_font_defaults({"displayText": "x" * length}, "plain")
        for axis in ("title", "description"):
            assert sizes[axis]["portrait"] <= sizes[axis]["landscape"], (axis, length)


def test_longer_copy_gets_smaller_body_type():
    """The whole point: type is sized FOR the copy the scene actually holds.

    Only the DESCRIPTION tracks displayText length. The title is sized from its
    own word count (see below) because those are the two different strings the
    two sizes drive: titleFontSize sizes props.sceneTitle, descriptionFontSize
    sizes props.displayText and every content prop.
    """
    from app.services.code_generator import _compute_scene_font_defaults

    title = {"sceneTitle": "Six well chosen words right here"}
    short = _compute_scene_font_defaults({**title, "displayText": "x" * 40}, "plain")
    long_ = _compute_scene_font_defaults({**title, "displayText": "x" * 400}, "plain")
    assert long_["description"]["landscape"] < short["description"]["landscape"]
    # The title is unmoved by body length — it is not what that size renders.
    assert long_["title"]["landscape"] == short["title"]["landscape"]


def test_a_longer_title_gets_smaller_title_type():
    """The title's own length is what sizes it, measured in words.

    A tight 5-word title sits at the top of the band; a long one eases toward
    the middle. It never drops to the floor: the title is the scene's focal
    element even when it runs long, and a title at body scale leads nothing.
    """
    from app.services.code_generator import _compute_scene_font_defaults

    body = {"displayText": "x" * 120}
    tight = _compute_scene_font_defaults({**body, "sceneTitle": "Four chosen words here"}, "plain")
    wordy = _compute_scene_font_defaults(
        {**body, "sceneTitle": "A notably longer title running on for ten words"}, "plain"
    )
    assert wordy["title"]["landscape"] < tight["title"]["landscape"]
    assert wordy["title"]["portrait"] < tight["title"]["portrait"]
    # Still comfortably above the body, in both orientations.
    for o in ("landscape", "portrait"):
        assert wordy["title"][o] > wordy["description"][o]


def test_more_props_bias_type_smaller():
    """Items on screen compete with the copy for the same block."""
    from app.services.code_generator import _compute_scene_font_defaults

    body = {"displayText": "x" * 140}
    few = _compute_scene_font_defaults({**body, "bullets": ["b"] * 3}, "bullets")
    many = _compute_scene_font_defaults({**body, "bullets": ["b"] * 8}, "bullets")
    assert many["description"]["landscape"] < few["description"]["landscape"]


def test_title_stays_larger_than_description():
    """Rule 7c — the hierarchy must survive at every copy length."""
    from app.services.code_generator import _compute_scene_font_defaults

    for length in (0, 100, 250, 500):
        sizes = _compute_scene_font_defaults({"displayText": "x" * length}, "plain")
        for orientation in ("landscape", "portrait"):
            assert sizes["title"][orientation] > sizes["description"][orientation]


def test_indexed_field_writer_pads_a_sparse_write():
    """A regenerated content_4 on a short column must not land in the wrong slot.

    The pad is what keeps every per-scene array addressable by the SAME index as
    content_codes; without it a sparse edit either raises or silently writes to
    the end.
    """
    import json as _json

    from app.routers.custom_templates import _write_scene_indexed_field

    class _T:
        scene_font_defaults = _json.dumps({"content": [{"a": 1}]})

    tpl = _T()
    _write_scene_indexed_field(tpl, "scene_font_defaults", "content", 3, {"b": 2})
    data = _json.loads(tpl.scene_font_defaults)
    assert len(data["content"]) == 4
    assert data["content"][0] == {"a": 1}   # untouched
    assert data["content"][3] == {"b": 2}   # written at the right index
    assert data["content"][1] == {}         # padded, not shifted


def test_indexed_field_writer_survives_a_malformed_column():
    """Unreadable JSON must not break a scene edit."""
    import json as _json

    from app.routers.custom_templates import _write_scene_indexed_field

    class _T:
        scene_font_defaults = "not json"

    tpl = _T()
    _write_scene_indexed_field(tpl, "scene_font_defaults", "intro", -1, {"x": 1})
    assert _json.loads(tpl.scene_font_defaults)["intro"] == {"x": 1}


# ─── The two bands are different bands ────────────────────────────────────


def test_a_user_size_above_the_generation_ceiling_survives_the_render():
    """The point of splitting the bands.

    A person dragging the title slider to 180 is not making a mistake, and the
    render must keep the number they chose. While the read-time clamp used the
    GENERATION band, it silently reset anything above 88 — so the slider looked
    dead past the ceiling the model is held to, which is the defect the split
    exists to fix.
    """
    from app.services.code_generator import _USER_BANDS

    for orientation in ("landscape", "portrait"):
        lo, hi = _USER_BANDS["title"][orientation]
        assert lo <= 180 <= hi, orientation
        assert lo <= 10 and hi >= 200, orientation
        d_lo, d_hi = _USER_BANDS["description"][orientation]
        assert d_lo <= 10 and d_hi >= 100, orientation


def test_a_generated_default_above_the_generation_ceiling_is_still_rejected():
    """Widening the USER band must not widen what the MODEL may bake in.

    A 180px default in generated code is not a considered choice — nobody looked
    at the frame — and it is what the generation bands exist to catch. The two
    bands are enforced in different places for exactly this reason.
    """
    from app.services.code_validator import _font_default_defects

    ok = "const t = props.titleFontSize ?? (isPortrait ? 52 : 76);"
    assert _font_default_defects(ok) == []

    too_big = "const t = props.titleFontSize ?? (isPortrait ? 180 : 190);"
    defects = _font_default_defects(too_big)
    assert defects, "a 180/190 generated default should be reported"
    assert any("titleFontSize" in d for d in defects), defects
