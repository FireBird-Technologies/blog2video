"""The per-content-type prop schema, and the drift it exists to prevent.

WHY THIS EXISTS

A comparison scene shipped with

    {"contentType": "comparison",
     "left":  {"label": "Order food in", "description": "..."},
     "right": {"label": "Dine out",      "description": "..."}}

while GeneratedSceneProps declares `comparisonLeft` / `comparisonRight`. The
component read the contract keys, found nothing, and drew an empty frame.

Nobody was wrong in isolation. The scene code followed the contract; the
classifier followed its prompt, which described the fields in prose ("comparison:
left and right sides") and never named them. And no layer in between renames
keys — sanitizeSceneProps coerces SHAPES and skips anything it does not
recognise, so `left` travelled all the way to the component untouched.

The template sample-copy path had a correct per-type key map all along. The
project-content path did not. These tests pin the shared schema that closes that
asymmetry, and the aliasing that repairs rows already in the database.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.content_classifier import CONTENT_TYPES
from app.services.scene_content_schema import (
    ALIASES,
    ALL_FIELDS,
    FIELDS_BY_TYPE,
    coerce_field,
    normalise_fields,
)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_TYPES_TS = _REPO_ROOT / "remotion-video/src/templates/generated/types.ts"


# ─── The reported bug ────────────────────────────────────────────────────────


def test_left_right_become_the_contract_keys() -> None:
    """The exact payload that rendered an empty frame."""
    out = normalise_fields(
        {
            "contentType": "comparison",
            "left": {"label": "Order food in", "description": "Courier brings your meal"},
            "right": {"label": "Dine out", "description": "Exclusive DineOut deals"},
        },
        "comparison",
    )
    assert out == {
        "comparisonLeft": {"label": "Order food in", "description": "Courier brings your meal"},
        "comparisonRight": {"label": "Dine out", "description": "Exclusive DineOut deals"},
    }


def test_a_correctly_named_emission_is_untouched() -> None:
    """An alias must never displace the real key."""
    payload = {
        "comparisonLeft": {"label": "A", "description": "a"},
        "comparisonRight": {"label": "B", "description": "b"},
        # Both present: the contract key wins, the alias is dropped.
        "left": {"label": "WRONG", "description": "wrong"},
    }
    out = normalise_fields(payload, "comparison")
    assert out["comparisonLeft"] == {"label": "A", "description": "a"}


@pytest.mark.parametrize(
    "content_type,payload,expected_key",
    [
        ("quote", {"quote": "It works.", "author": "Ayesha"}, "quoteAuthor"),
        ("timeline", {"items": [{"label": "2019", "description": "Founded"}]}, "timelineItems"),
        ("code", {"lines": ["const x = 1;"]}, "codeLines"),
        ("code", {"codeLines": ["x"], "language": "typescript"}, "codeLanguage"),
    ],
)
def test_the_other_unnamed_keys_are_aliased_too(content_type, payload, expected_key) -> None:
    """comparison was broken; these were one bad guess away from the same fate.

    The prompt named none of them, and `codeLanguage` it never mentioned at all.
    """
    out = normalise_fields(payload, content_type)
    assert expected_key in out, out


# ─── Keys the render path discards ───────────────────────────────────────────


def test_keys_the_type_does_not_carry_are_dropped() -> None:
    """`title` and `text` are stored, serialised, and thrown away.

    Both render paths use an explicit allowlist off structuredContent — there is
    no spread — so these never reach a component. Dropping them here keeps the
    stored descriptor honest about what the scene will show.
    """
    out = normalise_fields(
        {"contentType": "bullets", "title": "Ignored", "text": "Ignored", "bullets": ["A", "B"]},
        "bullets",
    )
    assert out == {"bullets": ["A", "B"]}


def test_plain_carries_no_structured_fields_at_all() -> None:
    assert normalise_fields({"text": "Some prose", "bullets": ["X"]}, "plain") == {}


# ─── Shapes ──────────────────────────────────────────────────────────────────


def test_shapes_are_coerced_not_just_renamed() -> None:
    """A renamed key still has to arrive in the declared shape.

    `_pair` salvages the obvious aliases inside the object too — a real model
    wrote {"title": ..., "detail": ...} where {label, description} was declared.
    """
    out = normalise_fields(
        {"left": {"title": "Before", "detail": "Manual work"}}, "comparison"
    )
    assert out["comparisonLeft"] == {"label": "Before", "description": "Manual work"}


def test_an_unsalvageable_value_is_dropped_rather_than_stored() -> None:
    """A dropped field renders as absent; a malformed one crashes the scene."""
    assert normalise_fields({"comparisonLeft": "not an object"}, "comparison") == {}


# ─── Anti-drift: the schema must match types.ts ──────────────────────────────


def test_every_content_type_has_an_entry() -> None:
    """A type with no entry silently loses every prop it carries."""
    assert set(FIELDS_BY_TYPE) == set(CONTENT_TYPES), (
        set(CONTENT_TYPES) ^ set(FIELDS_BY_TYPE)
    )


@pytest.mark.skipif(not _TYPES_TS.exists(), reason="remotion-video not in this checkout")
def test_every_schema_key_is_declared_in_types_ts() -> None:
    """The seam this bug crossed.

    GeneratedSceneProps is the contract; this map decides what is written into
    it. A key here that types.ts does not declare is a prop no component can
    read — which is exactly what `left` was.
    """
    declared = set(re.findall(r"^\s*(\w+)\??:", _TYPES_TS.read_text(), re.MULTILINE))
    missing = sorted(k for k in ALL_FIELDS if k not in declared)
    assert not missing, f"not declared in types.ts: {missing}"


def test_no_alias_shadows_a_real_contract_key() -> None:
    """An alias that IS a contract key would rename a valid field away."""
    clashes = sorted(a for a in ALIASES if a in ALL_FIELDS)
    assert not clashes, clashes


def test_every_alias_targets_a_real_key() -> None:
    unknown = sorted({v for v in ALIASES.values() if v not in ALL_FIELDS})
    assert not unknown, unknown


# ─── The sample-copy path still behaves identically ──────────────────────────


def test_the_sample_path_kept_its_behaviour_through_the_move() -> None:
    """code_generator now imports the schema; its filtering must not change."""
    from app.services.code_generator import _parse_sample_content

    parsed = _parse_sample_content(
        '{"sceneTitle":"A Real Title Here Now","displayText":"Copy.",'
        '"bullets":["one","two"],"metrics":[{"value":"3x","label":"Growth"}]}',
        "bullets",
    )
    assert parsed["bullets"] == ["one", "two"]
    # metrics is not a bullets field — dropped, exactly as before.
    assert "metrics" not in parsed


def test_coerce_field_is_the_shared_function() -> None:
    from app.services import code_generator as cg

    assert cg._coerce_sample_field is coerce_field
    assert cg._SAMPLE_FIELDS_BY_TYPE is FIELDS_BY_TYPE


# ─── The prompt names the keys ───────────────────────────────────────────────


def test_the_extractor_prompt_names_every_contract_key() -> None:
    """Prose was the root cause: "left and right sides" is not a key name.

    Normalising repairs stored rows, but the model should be told the truth in
    the first place — otherwise every new key it invents needs a new alias.
    """
    from app.services.content_classifier import BatchContentExtractor

    doc = BatchContentExtractor.__doc__ or ""
    for key in sorted(ALL_FIELDS):
        assert key in doc, f"{key} is never named in the extractor prompt"
    assert "USE THESE EXACT FIELD NAMES" in doc


def test_the_ending_contract_asks_for_the_link_to_be_drawn() -> None:
    """A video has no clickable surface.

    The outro rendered `ctaButtonText` correctly and treated `websiteLink` as a
    destination — so the frame showed a button reading "Get started" over
    nothing, telling the viewer nowhere to go.
    """
    from app.services.code_generator import _format_scene_doc

    doc = _format_scene_doc(
        {"id": "outro_scene", "role": "outro", "doc": "A closing card.",
         "content_type": "plain", "supports_image": False}
    )
    assert "RENDER BOTH FIELDS" in doc, doc
    assert "no clickable surface" in doc


# ─── The field defs the editor renders from ──────────────────────────────────


def test_field_defs_cover_every_content_type() -> None:
    from app.services.scene_content_schema import FIELD_DEFS_BY_TYPE

    assert set(FIELD_DEFS_BY_TYPE) == set(CONTENT_TYPES)


def test_field_defs_and_key_names_cannot_disagree() -> None:
    """FIELDS_BY_TYPE is derived from FIELD_DEFS_BY_TYPE, not maintained beside it.

    They were separate before — key names here, labels and types hardcoded in
    SceneEditModal — and they drifted into the "[object Object]" bug.
    """
    from app.services.scene_content_schema import FIELD_DEFS_BY_TYPE, _keys_of

    for ctype, defs in FIELD_DEFS_BY_TYPE.items():
        assert FIELDS_BY_TYPE[ctype] == _keys_of(defs), ctype


def test_every_field_def_is_renderable_by_the_editor() -> None:
    """The editor maps a fixed set of types; anything else silently renders nothing."""
    from app.services.scene_content_schema import FIELD_DEFS_BY_TYPE

    renderable = {"string", "text", "color", "number", "select",
                  "string_array", "object_array"}
    for ctype, defs in FIELD_DEFS_BY_TYPE.items():
        for f in defs:
            assert f.get("key"), (ctype, f)
            assert f.get("label"), (ctype, f)
            assert f.get("type") in renderable, (ctype, f)
            if f["type"] == "object_array":
                assert f.get("subFields"), f"{ctype}.{f['key']} needs subFields"


def test_the_prompt_reference_is_generated_from_the_schema() -> None:
    """Naming a new key in the schema must not leave the instructions stale."""
    from app.services.scene_content_schema import prompt_field_reference

    ref = prompt_field_reference()
    for key in sorted(ALL_FIELDS):
        assert key in ref, f"{key} missing from the generated prompt reference"


def test_the_served_schema_matches_the_backend_definition() -> None:
    """meta.content_prop_schema is what the editor renders from."""
    from app.services.custom_prompt_builder import FIELD_DEFS_BY_TYPE as served

    from app.services.scene_content_schema import FIELD_DEFS_BY_TYPE

    assert served is FIELD_DEFS_BY_TYPE


# ─── Declared prop values ────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "value,ftype,expected",
    [
        ("  Key points  ", "string", "Key points"),
        ("", "string", None),
        (7, "number", 7),
        ("12", "number", 12.0),
        (True, "number", None),
        (["a", "b"], "string_array", ["a", "b"]),
        ("not a list", "string_array", None),
        ([{"k": "v"}], "object_array", [{"k": "v"}]),
        ({"k": "v"}, "object_array", None),
    ],
)
def test_declared_prop_values_are_coerced_to_their_type(value, ftype, expected) -> None:
    """An unsalvageable value is dropped so the designer's default stands."""
    from app.services.content_classifier import _coerce_layout_prop

    assert _coerce_layout_prop(value, ftype) == expected
