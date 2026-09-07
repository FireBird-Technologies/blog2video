"""Per-scene AI editing: key routing, prop schemas, draft safety (P3/P4).

The dangerous operation here is APPLY: it writes one scene into a live template.
The tests below pin the routing that makes that safe — a bad scene key must be
rejected before anything is written, and a single-scene draft must never be
usable as a whole-template rollback target (it holds one scene's code, so
restoring it wholesale would blank the others).
"""
from __future__ import annotations

import pytest

from app.services.code_generator import (
    _parse_prop_schema,
    build_layout_prop_schema,
    parse_scene_key,
)


# ─── Scene key routing ───────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("key", "expected"),
    [("intro", ("intro", -1)), ("outro", ("outro", -1)), ("content_0", ("content", 0)), ("content_3", ("content", 3))],
)
def test_valid_scene_keys(key: str, expected: tuple[str, int]) -> None:
    assert parse_scene_key(key, num_content=4) == expected


@pytest.mark.parametrize(
    "key",
    ["", "bogus", "content", "content_", "content_x", "content_-1", "intro_0", "CONTENT_0"],
)
def test_malformed_scene_keys_rejected(key: str) -> None:
    with pytest.raises(ValueError):
        parse_scene_key(key, num_content=4)


def test_out_of_range_content_index_rejected() -> None:
    """Guards apply_scene_draft from writing past the end of content_codes."""
    with pytest.raises(ValueError):
        parse_scene_key("content_9", num_content=4)


# ─── Prop schema parsing ─────────────────────────────────────────────────────

READS = (
    "const a = props.layoutProps?.chapterNumber ?? '01';"
    "const b = props.layoutProps?.sourceNote ?? '';"
)


def test_declared_and_read_props_are_kept() -> None:
    fields = _parse_prop_schema(
        '[{"key":"chapterNumber","label":"Chapter","type":"string","default":"01"}]', READS
    )
    assert [f["key"] for f in fields] == ["chapterNumber"]


def test_prop_declared_but_never_read_is_dropped() -> None:
    """Otherwise the editor shows a field that changes nothing."""
    assert _parse_prop_schema('[{"key":"ghost","label":"G","type":"string"}]', READS) == []


def test_reserved_keys_are_rejected() -> None:
    """A layout prop shadowing a standard prop would create two editor fields
    writing to different places."""
    code = "props.layoutProps?.displayText"
    assert _parse_prop_schema('[{"key":"displayText","label":"D","type":"string"}]', code) == []


@pytest.mark.parametrize(
    "entry",
    [
        '{"key":"chapterNumber","label":"C","type":"range"}',        # unmapped type
        '{"key":"chapterNumber","label":"C","type":"select"}',        # select without options
        '{"key":"chapterNumber","label":"C","type":"object_array"}',  # no subFields
        '{"key":"bad key!","type":"string"}',                         # malformed key
    ],
)
def test_unusable_field_definitions_are_dropped(entry: str) -> None:
    assert _parse_prop_schema(f"[{entry}]", READS) == []


def test_malformed_json_is_tolerated() -> None:
    """A bad schema must never fail a scene that otherwise renders."""
    assert _parse_prop_schema("not json at all", READS) == []
    assert _parse_prop_schema("", READS) == []


def test_prop_count_is_capped() -> None:
    entries = ",".join(
        f'{{"key":"k{i}","label":"L","type":"string"}}' for i in range(20)
    )
    code = " ".join(f"props.layoutProps?.k{i}" for i in range(20))
    assert len(_parse_prop_schema(f"[{entries}]", code)) == 12


def test_schema_entry_matches_editor_contract() -> None:
    """Shape consumed by SceneEditModal.layoutPropSchemaToFieldDefs. `default`
    is lifted out of the field and into `defaults`, matching built-in meta."""
    entry = build_layout_prop_schema(
        [{"key": "chapterNumber", "label": "Chapter", "type": "string", "default": "01"}],
        "Ledger Split",
    )
    assert entry["label"] == "Ledger Split"
    assert entry["defaults"] == {"chapterNumber": "01"}
    assert entry["fields"] == [{"key": "chapterNumber", "label": "Chapter", "type": "string"}]
    assert "default" not in entry["fields"][0]


def test_schema_entry_omits_defaults_when_none() -> None:
    entry = build_layout_prop_schema(
        [{"key": "sourceNote", "label": "Source", "type": "text"}], "Plain"
    )
    assert "defaults" not in entry
