"""Crumpled Paper built-in template: font-size contract + Template Studio wiring.

Guards the things that silently break a built-in in Template Studio:
- "save to source" must find each layout's `titleFontSize ?? (p ? N : M)` /
  `descriptionFontSize ?? (p ? N : M)` literal in BOTH layout copies (else HTTP 400);
- those literals must equal meta.json `defaults` (render path, scene editor and
  Studio all read meta; the layout falls back to the literal);
- defaults must sit inside the scene editor's built-in slider bands;
- every layout needs `scene_defaults` so Studio previews show its own content.
"""

import json
import re
from pathlib import Path

import pytest

from app.routers.template_studio import (
    AspectValue,
    _apply_font_updates_to_content,
    _resolve_target_files,
)

_META = Path(__file__).resolve().parents[1] / "templates" / "crumpled" / "meta.json"
META = json.loads(_META.read_text())
LAYOUTS = META["valid_layouts"]

# SceneEditModal clamps built-in templates to these bands on save.
TITLE_BAND = (20, 200)
BODY_BAND = (12, 80)


def _literal(source: str, key: str) -> tuple[int, int]:
    match = re.search(rf"{key}\s*\?\?\s*\((?:p|portrait)\s*\?\s*(\d+)\s*:\s*(\d+)\)", source)
    assert match, f"no `{key} ?? (p ? N : M)` literal"
    return int(match.group(1)), int(match.group(2))


def test_registered():
    registry = json.loads((_META.parents[1] / "registry.json").read_text())
    assert "crumpled" in registry
    assert META["hero_layout"] in LAYOUTS and META["fallback_layout"] in LAYOUTS
    assert len(LAYOUTS) == 9


@pytest.mark.parametrize("layout_id", LAYOUTS)
def test_studio_save_source_matches_both_copies(layout_id):
    for path in _resolve_target_files("crumpled", layout_id):
        assert path.exists(), path
        updated, changes = _apply_font_updates_to_content(
            path.read_text(),
            layout_id,
            AspectValue(portrait=111, landscape=99),
            AspectValue(portrait=55, landscape=44),
        )
        assert changes >= 2, f"{path} — Studio save would 400"
        assert _literal(updated, "titleFontSize") == (111, 99)
        assert _literal(updated, "descriptionFontSize") == (55, 44)


@pytest.mark.parametrize("layout_id", LAYOUTS)
def test_layout_literals_match_meta_defaults(layout_id):
    defaults = META["layout_prop_schema"][layout_id]["defaults"]
    expected = {
        key: (defaults[key]["portrait"], defaults[key]["landscape"])
        for key in ("titleFontSize", "descriptionFontSize")
    }
    frontend, remotion = _resolve_target_files("crumpled", layout_id)
    assert frontend.read_text() == remotion.read_text(), "layout copies drifted"
    for key, value in expected.items():
        assert _literal(remotion.read_text(), key) == value, key


@pytest.mark.parametrize("layout_id", LAYOUTS)
def test_defaults_fit_scene_editor_bands(layout_id):
    defaults = META["layout_prop_schema"][layout_id]["defaults"]
    for orientation in ("portrait", "landscape"):
        assert TITLE_BAND[0] <= defaults["titleFontSize"][orientation] <= TITLE_BAND[1]
        assert BODY_BAND[0] <= defaults["descriptionFontSize"][orientation] <= BODY_BAND[1]


@pytest.mark.parametrize("layout_id", LAYOUTS)
def test_studio_has_scene_defaults_and_size_fields(layout_id):
    entry = META["layout_prop_schema"][layout_id]
    assert entry.get("scene_defaults", {}).get("title")
    responsive = {f["key"] for f in entry["fields"] if f.get("responsive")}
    assert {"titleFontSize", "descriptionFontSize"} <= responsive


# ── Title / display text are scene fields, never layout props ───────────────

# Keys that would duplicate the scene's own Title or Display text. The layouts read
# `props.title` (scene title) and `props.displayText` (scene display_text) instead.
_SCENE_TEXT_KEYS = {
    "title", "subtitle", "heading", "body", "narration", "displayText",
    "chartSummary", "tagline", "brandName",
}
_REPO = Path(__file__).resolve().parents[2]
_LAYOUT_TREES = (
    _REPO / "frontend/src/components/remotion/crumpled/layouts",
    _REPO / "remotion-video/src/templates/crumpled/layouts",
    _REPO / "frontend-pdf2video/src/components/remotion/crumpled/layouts",
)


@pytest.mark.parametrize("layout_id", LAYOUTS)
def test_schema_never_offers_scene_text_as_props(layout_id):
    entry = META["layout_prop_schema"][layout_id]
    fields = {f["key"] for f in entry["fields"]}
    assert not fields & _SCENE_TEXT_KEYS, fields & _SCENE_TEXT_KEYS
    assert not set(entry["sample_props"]) & _SCENE_TEXT_KEYS


def test_layouts_read_scene_title_and_display_text_only():
    pattern = re.compile(r"props\.(heading|body|subtitle|chartSummary|tagline|brandName|narration)\b")
    for tree in _LAYOUT_TREES:
        for path in sorted(tree.glob("*.tsx")):
            hits = pattern.findall(path.read_text())
            assert not hits, f"{path} reads {sorted(set(hits))}"


def test_all_layout_copies_identical():
    reference = {p.name: p.read_text() for p in _LAYOUT_TREES[1].glob("*.tsx")}
    for tree in (_LAYOUT_TREES[0], _LAYOUT_TREES[2]):
        copy = {p.name: p.read_text() for p in tree.glob("*.tsx")}
        assert copy == reference, f"{tree} drifted from the render tree"


@pytest.mark.parametrize("name", ["prompt.md", "layout_prompt.md"])
def test_prompts_forbid_scene_text_props(name):
    text = (_META.parent / name).read_text()
    assert "Title and Display text are NOT layout props" in text
    for key in ("subtitle", "heading", "body", "chartSummary", "tagline", "brandName"):
        # The only mention of each key is in the "never put these in props" rule.
        assert text.count(f"`{key}`") == 1, key
