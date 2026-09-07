"""Custom-template scene resolution, image capability, and routing.

Covers four defects reported together on the custom-template flow:

  1. IMAGES AND CLIPS WERE ASSIGNED, THEN STRIPPED. On a project's first run the
     pipeline writes descriptors carrying only structuredContent and an EMPTY
     layoutConfig — no scene type, no variant index. `_custom_layout_id` cannot
     resolve those, and the old fallback handed EVERY scene the template's
     fallback layout (`content_0`). Whenever that one layout happened to be
     image-free, the whole video was treated as image-free: every assignedVideo
     dropped, every assignedImage popped, and `hideImage: True` persisted so it
     could never heal. `_resolve_custom_scene_types` is the fix, and it must run
     before the image cascade.

  2. THE TEMPLATE'S OWN OUTRO WAS OVERWRITTEN. A v2 outro composes the CTA
     itself and renders as its own scene, so it may legitimately carry an image.
     Two places forced it image-free regardless.

  3. PROPS WENT TO THE WRONG SCENE. Prop defaults were indexed by POSITION while
     the component that renders a scene is chosen by contentVariantIndex.

  4. CONTENT ROUTING IGNORED SECONDARY MATCHES, and naively widening `best_for`
     would have made it worse — a secondary tag on an early archetype could
     claim a type before a later archetype's PRIMARY was considered.
"""
from __future__ import annotations

import json

import pytest

from app.services.content_classifier import match_scenes_to_archetypes
from app.services.custom_prompt_builder import build_custom_meta
from app.services.remotion import (
    _custom_scene_layout_id,
    _resolve_custom_scene_types,
)


class _Scene:
    """Minimal stand-in for a Scene row."""

    def __init__(self, remotion_code=None, scene_type=None):
        self.remotion_code = remotion_code
        self.scene_type = scene_type


def _first_run_scene(content_type: str = "plain") -> _Scene:
    """A descriptor exactly as _generate_scenes writes it on the FIRST run."""
    return _Scene(
        remotion_code=json.dumps(
            {"structuredContent": {"contentType": content_type}, "layoutConfig": {}}
        )
    )


def _custom_data(num_variants: int = 3, archetypes=None) -> dict:
    return {
        "content_codes": ["code"] * num_variants,
        "content_archetype_ids": archetypes
        if archetypes is not None
        else [
            {"id": f"content_{i}", "best_for": ["plain"]} for i in range(num_variants)
        ],
    }


# ─── 1. First-run resolution (the image-stripping bug) ────────────────────


def test_first_run_descriptors_resolve_to_distinct_layouts():
    """The regression test for the stripped-images bug.

    Every scene used to collapse onto the fallback layout because the descriptor
    named no scene type. Bookends must resolve by POSITION, and content scenes
    must land on real content_N layouts.
    """
    scenes = [_first_run_scene() for _ in range(5)]
    resolved = _resolve_custom_scene_types("custom_1", scenes, _custom_data())

    assert [r["sceneType"] for r in resolved] == [
        "intro",
        "content",
        "content",
        "content",
        "outro",
    ]

    layouts = [_custom_scene_layout_id(r) for r in resolved]
    assert layouts[0] == "intro"
    assert layouts[-1] == "outro"
    # The middle scenes must be real content layouts, NOT all the same one —
    # collapsing onto a single layout is precisely what caused the bug.
    assert all(l is not None and l.startswith("content_") for l in layouts[1:-1])


def test_image_free_first_content_layout_does_not_blank_other_scenes():
    """The exact reported symptom.

    When the FIRST content scene's design declines an image, `content_0` lands
    in layouts_without_image. Because every scene used to resolve to content_0,
    that single flag blanked the whole video. Scenes must now resolve to their
    own layouts, so only the genuinely image-free one is affected.
    """
    blueprint = {
        "version": 2,
        "scenes": [
            {"role": "intro", "supports_image": True, "content_type": "plain"},
            # The first CONTENT scene declines an image.
            {"role": "content", "supports_image": False, "content_type": "plain"},
            {"role": "content", "supports_image": True, "content_type": "metrics"},
            {"role": "content", "supports_image": True, "content_type": "steps"},
            {"role": "outro", "supports_image": True, "content_type": "plain"},
        ],
    }
    meta = build_custom_meta(
        {"colors": {"accent": "#000", "bg": "#FFF", "text": "#111"}, "fonts": {}},
        "Acme",
        content_codes_count=3,
        design_blueprint=blueprint,
    )
    no_image = set(meta["layouts_without_image"])

    assert "content_0" in no_image
    # The other content layouts keep their image capability — this is what was
    # broken when every scene shared one layout id.
    assert "content_1" not in no_image
    assert "content_2" not in no_image
    assert "intro" not in no_image


def test_explicit_overrides_outrank_position():
    """A variant switched by hand in the editor must survive re-resolution."""
    scenes = [
        _first_run_scene(),
        _Scene(
            remotion_code=json.dumps(
                {
                    "structuredContent": {},
                    "sceneTypeOverride": "content",
                    "contentVariantIndex": 2,
                }
            )
        ),
        _first_run_scene(),
    ]
    resolved = _resolve_custom_scene_types("custom_1", scenes, _custom_data())
    assert resolved[1]["contentVariantIndex"] == 2


def test_dataviz_scene_type_survives_and_maps_to_kit_layout():
    """An injected chart/table scene must not be relabelled as plain content."""
    scenes = [
        _first_run_scene(),
        _Scene(remotion_code=json.dumps({"structuredContent": {}, "layoutConfig": {}}),
               scene_type="dataviz_chart"),
        _first_run_scene(),
    ]
    resolved = _resolve_custom_scene_types("custom_1", scenes, _custom_data())
    assert resolved[1]["sceneType"] == "dataviz_chart"
    assert _custom_scene_layout_id(resolved[1]) == "custom_chart"


def test_non_custom_template_gets_no_opinion():
    """Built-in templates must be untouched by any of this."""
    assert _resolve_custom_scene_types("default", [_first_run_scene()], {}) == []


def test_resolution_is_stable_across_runs():
    """Run 2 (descriptors now stamped) must agree with run 1.

    If the two disagreed, a re-render would move scenes onto different layouts
    and the assets assigned on run 1 would land on the wrong scenes.
    """
    data = _custom_data()
    first = _resolve_custom_scene_types(
        "custom_1", [_first_run_scene() for _ in range(5)], data
    )
    # Simulate what write_remotion_data persists after run 1.
    stamped = [
        _Scene(
            remotion_code=json.dumps(
                {
                    "structuredContent": {},
                    "sceneTypeOverride": r["sceneType"],
                    **(
                        {"contentVariantIndex": r["contentVariantIndex"]}
                        if r["contentVariantIndex"] is not None
                        else {}
                    ),
                }
            )
        )
        for r in first
    ]
    second = _resolve_custom_scene_types("custom_1", stamped, data)
    assert [r["sceneType"] for r in second] == [r["sceneType"] for r in first]
    assert [r["contentVariantIndex"] for r in second] == [
        r["contentVariantIndex"] for r in first
    ]


def test_stored_content_on_a_bookend_is_overruled_by_position():
    """The project-1207 regression.

    A run whose scene-type resolution came back empty stamped EVERY scene
    "content" — including the last. Because a stored override outranked the
    positional rule, that wrong value then masked the rule on every subsequent
    render: the ending was never an outro again, so no consumer saw one and the
    built-in CTA overlay replaced the template's own ending forever.

    Nothing legitimate writes "content" onto a bookend, so position wins there
    and such a project repairs itself on the next render.
    """
    poisoned = [
        _Scene(
            remotion_code=json.dumps(
                {"structuredContent": {}, "sceneTypeOverride": "content"}
            )
        )
        for _ in range(5)
    ]
    resolved = _resolve_custom_scene_types("custom_1", poisoned, _custom_data())
    assert resolved[0]["sceneType"] == "intro"
    assert resolved[-1]["sceneType"] == "outro"
    # The middle scenes legitimately ARE content, and stay so.
    assert [r["sceneType"] for r in resolved[1:-1]] == ["content"] * 3


def test_stored_content_on_a_middle_scene_is_still_honoured():
    """The override ladder is only relaxed for the two bookend positions."""
    scenes = [
        _first_run_scene(),
        _Scene(remotion_code=json.dumps({"sceneTypeOverride": "content"})),
        _first_run_scene(),
    ]
    assert _resolve_custom_scene_types("custom_1", scenes, _custom_data())[1][
        "sceneType"
    ] == "content"


@pytest.mark.parametrize("stored", ["intro", "outro", "dataviz_chart", "dataviz_table"])
def test_a_real_stored_override_on_a_bookend_still_wins(stored):
    """Only a bare "content" is distrusted — every real choice is authoritative.

    A data-viz scene can legitimately sit last, and its type comes from
    Scene.scene_type rather than from a defaulted write.
    """
    scenes = [
        _first_run_scene(),
        _first_run_scene(),
        _Scene(remotion_code=json.dumps({"sceneTypeOverride": stored})),
    ]
    resolved = _resolve_custom_scene_types("custom_1", scenes, _custom_data())
    assert resolved[-1]["sceneType"] == stored


def test_single_scene_project_is_an_intro_not_an_outro():
    """`total > 1` guards the outro rule; a lone scene must stay the intro."""
    resolved = _resolve_custom_scene_types(
        "custom_1",
        [_Scene(remotion_code=json.dumps({"sceneTypeOverride": "content"}))],
        _custom_data(),
    )
    assert resolved[0]["sceneType"] == "intro"


# ─── 2. The outro NEVER takes an image ────────────────────────────────────


@pytest.mark.parametrize("version", [1, 2])
@pytest.mark.parametrize("outro_supports_image", [True, False])
def test_outro_is_always_image_free(version, outro_supports_image):
    """Regardless of design version OR of what the design doc asked for.

    A v2 outro was briefly allowed to carry a visual, on the reasoning that it
    renders its own layout rather than being replaced by the CTA overlay. That
    made custom videos diverge from built-in ones — an extra clip fetched every
    time, and the guaranteed clip landing on the ENDING instead of the last
    content scene. An ending is a call to action, so it is image-free by
    construction now, and this is the flag the whole downstream chain reads.
    """
    blueprint = {
        "version": version,
        "scenes": [
            {"role": "intro", "supports_image": True, "content_type": "plain"},
            {"role": "content", "supports_image": True, "content_type": "plain"},
            {"role": "outro", "supports_image": outro_supports_image, "content_type": "plain"},
        ],
    }
    meta = build_custom_meta(
        {"colors": {"accent": "#000", "bg": "#FFF", "text": "#111"}, "fonts": {}},
        "Acme",
        content_codes_count=1,
        design_blueprint=blueprint,
    )
    assert "outro" in set(meta["layouts_without_image"])


def test_outro_is_image_free_even_without_a_blueprint():
    """A template with no design docs must not leak an image onto its ending."""
    meta = build_custom_meta(
        {"colors": {"accent": "#000", "bg": "#FFF", "text": "#111"}, "fonts": {}},
        "Acme",
        content_codes_count=2,
    )
    assert "outro" in set(meta["layouts_without_image"])


def test_content_scenes_keep_their_declared_capability():
    """Forcing the outro must not blanket-disable the rest of the template."""
    blueprint = {
        "version": 2,
        "scenes": [
            {"role": "intro", "supports_image": True, "content_type": "plain"},
            {"role": "content", "supports_image": True, "content_type": "plain"},
            {"role": "content", "supports_image": False, "content_type": "plain"},
            {"role": "outro", "supports_image": True, "content_type": "plain"},
        ],
    }
    meta = build_custom_meta(
        {"colors": {"accent": "#000", "bg": "#FFF", "text": "#111"}, "fonts": {}},
        "Acme",
        content_codes_count=2,
        design_blueprint=blueprint,
    )
    no_image = set(meta["layouts_without_image"])
    assert "content_0" not in no_image
    assert "content_1" in no_image
    assert "intro" not in no_image
    assert "outro" in no_image


# ─── 4. Ranked content routing ────────────────────────────────────────────


def test_primary_best_for_beats_an_earlier_secondary():
    """The two-pass map build.

    Archetype 0 lists `metrics` only as a SECOND choice; archetype 1 was built
    for it. A single first-wins pass over the flat list would hand metrics
    content to archetype 0 — which is why widening best_for without splitting
    the passes makes routing worse rather than better.
    """
    archetypes = [
        {"id": "comparison_layout", "best_for": ["comparison", "metrics"]},
        {"id": "metrics_layout", "best_for": ["metrics", "comparison"]},
    ]
    assignments = match_scenes_to_archetypes([{"contentType": "metrics"}], archetypes)
    assert assignments[0] == 1


def test_secondary_best_for_still_fills_otherwise_unused_layouts():
    """Secondaries are what stop everything piling onto one layout."""
    archetypes = [
        {"id": "steps_layout", "best_for": ["steps", "timeline"]},
        {"id": "quote_layout", "best_for": ["quote", "plain"]},
    ]
    # No archetype was BUILT for timeline, but the steps layout hosts it.
    assert match_scenes_to_archetypes([{"contentType": "timeline"}], archetypes)[0] == 0


def test_legacy_single_entry_best_for_is_unchanged():
    """Templates generated before ranked best_for must route exactly as before."""
    archetypes = [
        {"id": "a", "best_for": ["bullets"]},
        {"id": "b", "best_for": ["metrics"]},
    ]
    assert match_scenes_to_archetypes([{"contentType": "metrics"}], archetypes)[0] == 1


# ─── 5. The design stage never asks for an image-capable ending ───────────


def test_normalise_scenes_forces_the_ending_image_free():
    """Closed at DESIGN time, not just at render time.

    The render path declines to fill the outro's image slot either way, but a
    doc that still ASKS for one produces scene code built around that slot — a
    layout with a permanent hole in it. Stamping it here means the geometry the
    scene builder designs is the geometry that ships.
    """
    from app.dspy_modules.design_doc import MIN_SCENES, _normalise_scenes

    # MIN_SCENES is a floor below which the whole doc set is rejected, so the
    # fixture has to clear it for the outro rule to be reachable at all.
    middle = [
        {
            "id": f"body{i}",
            "role": "content",
            "doc": f"Body {i} " + "B" * 200,
            "content_type": "metrics",
            "supports_image": True,
            "image_mode": "half",
            "image_side": "left",
        }
        for i in range(MIN_SCENES - 2)
    ]
    repairs: list[str] = []
    scenes = _normalise_scenes(
        [
            {"id": "open", "role": "intro", "doc": "A" * 200, "content_type": "plain",
             "supports_image": True, "image_mode": "background"},
            *middle,
            # The model asked for a picture behind the ending.
            {"id": "close", "role": "outro", "doc": "C" * 200, "content_type": "plain",
             "supports_image": True, "image_mode": "background"},
        ],
        repairs,
    )
    assert scenes is not None
    assert scenes[-1]["role"] == "outro"
    assert scenes[-1]["supports_image"] is False
    assert scenes[-1]["image_mode"] is None
    assert scenes[-1]["image_side"] is None
    # The other scenes keep exactly what they declared.
    assert scenes[0]["supports_image"] is True
    assert scenes[1]["image_mode"] == "half"


# ─── 6. Resolved layouts are exposed to the frontend ──────────────────────


def test_resolved_layouts_cover_every_scene_including_null_variants():
    """What the project payload hands the UI.

    The frontend cannot derive a content scene's layout when the stored
    `contentVariantIndex` is null — the variant comes from archetype matching,
    which only the backend runs. Those scenes resolved to null client-side, so
    the expanded row showed "Default layout" AND, because an unknown layout read
    as image-capable, offered an image picker on a text-only scene.

    Every scene must therefore come back with a real layout id.
    """
    scenes = [
        _Scene(
            remotion_code=json.dumps(
                {"structuredContent": {}, "sceneTypeOverride": "content"}
            )
        )
        for _ in range(5)
    ]
    resolved = _resolve_custom_scene_types("custom_1", scenes, _custom_data())
    layouts = [_custom_scene_layout_id(r) for r in resolved]

    assert all(l is not None for l in layouts), layouts
    assert layouts[0] == "intro"
    assert layouts[-1] == "outro"
    assert all(l.startswith("content_") for l in layouts[1:-1]), layouts


def test_intro_keeps_its_image_capability_when_the_outro_is_forced():
    """Forcing the outro image-free must not catch the intro with it.

    A regression: after the outro was made unconditionally image-free, the
    expanded scene row hid the image section on the INTRO too. The intro follows
    its own design doc like any other scene, and a template whose intro carries
    the hero image must keep offering one.
    """
    blueprint = {
        "version": 2,
        "scenes": [
            {"role": "intro", "supports_image": True, "content_type": "plain"},
            *[
                {"role": "content", "supports_image": False, "content_type": "plain"}
                for _ in range(7)
            ],
            {"role": "outro", "supports_image": True, "content_type": "plain"},
        ],
    }
    meta = build_custom_meta(
        {"colors": {"accent": "#000", "bg": "#FFF", "text": "#111"}, "fonts": {}},
        "Acme",
        content_codes_count=7,
        design_blueprint=blueprint,
    )
    no_image = set(meta["layouts_without_image"])

    # The ending is forced, every content scene declined one itself...
    assert "outro" in no_image
    assert all(f"content_{i}" in no_image for i in range(7))
    # ...but the intro asked for an image and must still get one.
    assert "intro" not in no_image
