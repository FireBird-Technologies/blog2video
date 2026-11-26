"""Snowy Christmas built-in template: font-size contract + Template Studio wiring.

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

_META = Path(__file__).resolve().parents[1] / "templates" / "christmas" / "meta.json"
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
    assert "christmas" in registry
    assert META["hero_layout"] in LAYOUTS and META["fallback_layout"] in LAYOUTS
    assert len(LAYOUTS) == 10


@pytest.mark.parametrize("layout_id", LAYOUTS)
def test_studio_save_source_matches_both_copies(layout_id):
    for path in _resolve_target_files("christmas", layout_id):
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
    frontend, remotion = _resolve_target_files("christmas", layout_id)
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
    _REPO / "frontend/src/components/remotion/christmas/layouts",
    _REPO / "remotion-video/src/templates/christmas/layouts",
    _REPO / "frontend-pdf2video/src/components/remotion/christmas/layouts",
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


# ── Christmas-specific wiring ───────────────────────────────────────────────


def test_composition_registered_in_root():
    root = (_REPO / "remotion-video/src/Root.tsx").read_text()
    assert f'id="{META["composition_id"]}"' in root


def test_chart_layout_bound_without_ticker():
    from app.services.template_service import CHART_TICKER_TEMPLATE_LAYOUTS, _NO_TICKER_SENTINEL

    assert CHART_TICKER_TEMPLATE_LAYOUTS["christmas"] == ("data_visualisation", _NO_TICKER_SENTINEL)


def test_layout_registry_matches_meta():
    index = (_REPO / "remotion-video/src/templates/christmas/layouts/index.ts").read_text()
    registered = set(re.findall(r"^\s+([a-z_]+):\s+[A-Z]\w+,$", index, re.MULTILINE))
    assert registered == set(LAYOUTS)


def test_shared_template_trees_identical():
    """Everything except the per-tree entry file is byte-identical in all three trees."""
    trees = [
        _REPO / "remotion-video/src/templates/christmas",
        _REPO / "frontend/src/components/remotion/christmas",
        _REPO / "frontend-pdf2video/src/components/remotion/christmas",
    ]
    entry_files = {"ChristmasVideo.tsx", "ChristmasPreviewComposition.tsx"}

    def files(root: Path) -> dict[str, str]:
        return {
            str(p.relative_to(root)): p.read_text()
            for p in sorted(root.rglob("*"))
            if p.is_file() and p.name not in entry_files
        }

    reference = files(trees[0])
    for tree in trees[1:]:
        assert files(tree) == reference, f"{tree} drifted from the render tree"


# ── Layout policy: filled comparisons + varied layouts ──────────────────────

import asyncio  # noqa: E402
import copy  # noqa: E402
from types import SimpleNamespace  # noqa: E402

from app.dspy_modules import template_scene_gen as tsg  # noqa: E402
from app.routers.pipeline import _sanitize_script_layouts  # noqa: E402
from app.services.layout_policy import (  # noqa: E402
    TABLE_HINT_MARKER,
    get_layout_policy,
    is_eligible,
    layout_cap,
    normalize_and_check,
    numbers_grounded,
    relevant_passages,
)

POLICY = META["layout_policy"]


def _compare(left: int, right: int) -> dict:
    return {
        "leftLabel": "Solstice",
        "leftPoints": [f"left {i}" for i in range(left)],
        "rightLabel": "March 25",
        "rightPoints": [f"right {i}" for i in range(right)],
    }


def test_policy_names_real_layouts_and_props():
    for key in ("required", "item_required", "paired_lists", "needs", "limits"):
        assert set(POLICY[key]) <= set(LAYOUTS)
    for key in ("repairable", "always_fill", "auto_pick", "text_layouts"):
        assert set(POLICY[key]) <= set(LAYOUTS)
    for layout, props in POLICY["required"].items():
        fields = {f["key"] for f in META["layout_prop_schema"][layout]["fields"]}
        assert set(props) <= fields
    assert "snow_compare" not in POLICY["auto_pick"]
    # Only Christmas opts in; every other template keeps its current behaviour.
    assert get_layout_policy("crumpled") is None and get_layout_policy("custom_1") is None


@pytest.mark.parametrize("left,right,expected", [(3, 3, 3), (4, 4, 4), (5, 4, 4), (4, 3, 3)])
def test_compare_points_are_paired_and_bounded(left, right, expected):
    props, problems = normalize_and_check("christmas", "snow_compare", _compare(left, right))
    assert problems == []
    assert len(props["leftPoints"]) == len(props["rightPoints"]) == expected


@pytest.mark.parametrize("props", [{}, {"hideImage": True}, _compare(2, 2), _compare(4, 2)])
def test_thin_compare_is_rejected(props):
    assert normalize_and_check("christmas", "snow_compare", props)[1]


def test_object_points_become_strings():
    raw = {**_compare(3, 3), "leftPoints": [{"value": "a"}, {"text": "b"}, " ", "c", "C"]}
    props, problems = normalize_and_check("christmas", "snow_compare", raw)
    assert props["leftPoints"] == ["a", "b", "c"] and problems == []


def _generator(descriptor, fills, monkeypatch):
    """A generator whose two model calls are stubbed. `fills` are the fill answers."""
    monkeypatch.setattr(tsg, "ensure_dspy_configured", lambda: None)
    gen = tsg.TemplateSceneGenerator("christmas", source_text="The article text.")
    calls = []

    async def describe(**kwargs):
        if isinstance(descriptor, Exception):
            raise descriptor
        return SimpleNamespace(layout=descriptor[0], layout_props_json=json.dumps(descriptor[1]))

    async def fill(**kwargs):
        calls.append(kwargs)
        answer = fills[min(len(calls), len(fills)) - 1]
        if isinstance(answer, Exception):
            raise answer
        return SimpleNamespace(layout_props_json=json.dumps(answer))

    gen.builtin_descriptor = gen.builtin_regenerate_descriptor = describe
    gen.fill_props = fill
    return gen, calls


def _run(gen, layout="snow_compare"):
    return asyncio.run(
        gen.generate_scene_descriptor(
            scene_title="Two Theories on the Date",
            narration="Two theories explain the date.",
            visual_description="Split screen, warm golden light.",
            scene_index=3,
            total_scenes=8,
            preferred_layout=layout,
        )
    )


def _assert_full(descriptor):
    assert descriptor["layout"] == "snow_compare"
    props = descriptor["layoutProps"]
    assert props["leftLabel"] and props["rightLabel"]
    assert 3 <= len(props["leftPoints"]) == len(props["rightPoints"]) <= 4


def test_empty_compare_is_filled_even_when_model_answers_another_layout(monkeypatch):
    # What happened on the "Two Theories on the Date" scene.
    gen, calls = _generator(("snowy_narration", {}), [_compare(4, 4)], monkeypatch)
    _assert_full(_run(gen))
    # The picture description never reaches the fill step.
    assert len(calls) == 1 and "golden" not in json.dumps(calls[0])


def test_thin_fill_is_retried(monkeypatch):
    gen, calls = _generator(("snow_compare", {}), [_compare(2, 2), _compare(3, 4)], monkeypatch)
    _assert_full(_run(gen))
    assert len(calls) == 2 and "leftPoints" in calls[1]["problems"]


def test_compare_filled_when_descriptor_call_fails(monkeypatch):
    gen, _ = _generator(RuntimeError("model down"), [_compare(3, 3)], monkeypatch)
    _assert_full(_run(gen))


def test_good_model_props_survive_a_failed_refill(monkeypatch):
    gen, _ = _generator(("snow_compare", _compare(3, 3)), [RuntimeError("down")], monkeypatch)
    _assert_full(_run(gen))


def test_unfillable_compare_becomes_a_text_scene(monkeypatch):
    gen, calls = _generator(("snow_compare", {}), [{}], monkeypatch)
    gen.set_planned_layouts(
        ["santa_hero", "tree_list", "snowy_narration", "snow_compare", "tree_list"]
    )
    out = _run(gen)
    # Not empty, and not a repeat of the scene before it.
    assert out["layout"] == "frosted_window" and len(calls) == 2


def test_regenerate_keeps_existing_points_when_refill_fails(monkeypatch):
    gen, _ = _generator(("snow_compare", {}), [RuntimeError("down")], monkeypatch)
    out = asyncio.run(
        gen.generate_regenerate_descriptor(
            scene_title="t",
            narration="n",
            visual_description="v",
            scene_index=3,
            total_scenes=8,
            other_scenes_layouts="",
            preferred_layout="snow_compare",
            current_descriptor={"layout": "snow_compare", "layoutProps": _compare(4, 4)},
        )
    )
    _assert_full(out)


def test_refilled_stats_must_come_from_the_source():
    assert numbers_grounded([{"value": "1,200"}], "about 1200 people")
    assert not numbers_grounded([{"value": "98%"}], "about 1200 people")


def test_passages_found_deep_in_a_long_article():
    filler = "\n\n".join(f"Unrelated paragraph number {i} about carols and markets." for i in range(700))
    target = "The [Roman solstice](https://x.test/y) festival is one theory for the December date."
    text = relevant_passages(filler + "\n\n" + target, "Two Theories on the Date", "Roman solstice festival")
    assert "The Roman solstice festival is one theory" in text and "x.test" not in text


def _scenes(layouts):
    return [
        {"preferred_layout": l, "title": f"Scene {i}", "narration": "Plain narration."}
        for i, l in enumerate(layouts)
    ]


def _balanced(layouts):
    out = _sanitize_script_layouts("christmas", _scenes(layouts), include_ending_socials=True)
    return [s["preferred_layout"] for s in out]


def _assert_varied(result):
    assert result[0] == "santa_hero" and result[-1] == "ending_socials"
    assert all(l in LAYOUTS for l in result)
    body = result[1:-1]
    assert "santa_hero" not in body and "ending_socials" not in body
    assert all(a != b for a, b in zip(result, result[1:])), result
    narration = body.count("snowy_narration")
    assert narration <= max(layout_cap(POLICY, "snowy_narration", len(body)), 1), result


@pytest.mark.parametrize("count", [5, 12, 15])
@pytest.mark.parametrize(
    "pattern",
    [
        ["snowy_narration"],
        ["snowy_narration", "tree_list"],
        ["snow_compare"],
        ["data_visualisation"],
        ["letter_quote"],
        ["santa_hero"],
        ["ending_socials"],
        ["not_a_layout"],
        [""],
    ],
)
def test_repetitive_plans_are_balanced(pattern, count):
    _assert_varied(_balanced([pattern[i % len(pattern)] for i in range(count)]))


def test_long_video_has_no_neighbouring_repeats():
    result = _balanced(["snowy_narration"] * 30)
    assert all(a != b for a, b in zip(result, result[1:]))
    assert max(result.count(l) for l in set(result)) <= 10


def test_project_1274_plan_is_varied():
    result = _balanced(
        ["santa_hero", "snowy_narration", "frosted_window", "snowy_narration", "snowy_narration",
         "snow_compare", "snowball_steps", "snow_compare", "snowball_steps", "tree_list",
         "snowy_narration", "frosted_window", "tree_list", "snow_compare", "ending_socials"]
    )
    _assert_varied(result)
    assert result[1:-1].count("snowy_narration") <= 2
    # Comparisons the model asked for stay comparisons.
    assert [result[i] for i in (5, 7, 13)] == ["snow_compare"] * 3


def test_chart_needs_a_table():
    plan = ["santa_hero", "tree_list", "data_visualisation", "snowball_steps", "ending_socials"]
    assert "data_visualisation" not in _balanced(plan)
    for extra in ({"data_table_index": 0}, {"visual_description": f"x {TABLE_HINT_MARKER}: []"}):
        scenes = _scenes(plan)
        scenes[2].update(extra)
        out = _sanitize_script_layouts("christmas", scenes, include_ending_socials=True)
        assert out[2]["preferred_layout"] == "data_visualisation"


def test_quote_and_number_layouts_need_their_content():
    assert is_eligible(POLICY, "letter_quote", {"narration": 'She said, "Peace on earth to all of you."'})
    assert not is_eligible(POLICY, "letter_quote", {"narration": 'The word "Yule" is old.'})
    assert is_eligible(POLICY, "gift_stat", {"narration": "Seventy-three percent shop online; 12 million wait."})
    assert not is_eligible(POLICY, "gift_stat", {"narration": "Many people shop online."})


def test_templates_without_a_policy_are_untouched(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("balance_layouts must not run")

    monkeypatch.setattr("app.routers.pipeline.balance_layouts", boom)
    scenes = [{"preferred_layout": "bullet_list"} for _ in range(6)]
    out = _sanitize_script_layouts("default", copy.deepcopy(scenes), include_ending_socials=True)
    assert out[0]["preferred_layout"] == "hero_image" and out[-1]["preferred_layout"] == "ending_socials"
