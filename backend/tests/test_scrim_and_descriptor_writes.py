"""Image-mode threading, and the redundant-descriptor-write fix.

Two defects reported together:

  * BACKGROUND IMAGES WERE FULLY OPAQUE. Scenes whose design puts the image
    behind the type rendered it at full strength with no scrim, so headlines sat
    unreadable on a busy photograph. The scrim is now laid by the render wrapper
    (so it reaches templates that already exist), which means the renderer has to
    know each scene's `image_mode` — data that previously never left the design
    stage. `_image_modes_by_layout` is what carries it out.

  * SCENE DESCRIPTORS WERE REWRITTEN ON EVERY RENDER. write_remotion_data's
    second pass assigned `remotion_code` unconditionally, so SQLAlchemy issued an
    UPDATE per scene even when the serialised bytes were identical — and that
    pass runs at least twice per generate->render.
"""
from __future__ import annotations

import json

import pytest

from app.routers.custom_templates import _image_modes_by_layout


class _Tpl:
    def __init__(self, design_blueprint=None):
        self.design_blueprint = design_blueprint


def _bp(scenes: list[dict]) -> str:
    return json.dumps({"version": 2, "scenes": scenes})


# ─── image_mode -> per-layout map ─────────────────────────────────────────


def test_image_modes_keyed_by_role_and_content_position():
    """Keyed the way every other per-scene array is, so a variant lookup lands.

    Indexing the blueprint positionally would mislabel every scene the moment a
    template has no intro or no outro.
    """
    modes = _image_modes_by_layout(
        _Tpl(
            _bp([
                {"role": "intro", "image_mode": "background"},
                {"role": "content", "image_mode": "half"},
                {"role": "content", "image_mode": "background"},
                {"role": "content", "image_mode": None},
                {"role": "outro", "image_mode": "half"},
            ])
        )
    )
    assert modes == {
        "intro": "background",
        "content_0": "half",
        "content_1": "background",
        "content_2": None,
        "outro": "half",
    }


def test_content_indices_ignore_the_bookends():
    """content_0 is the FIRST CONTENT scene, not the first array element."""
    modes = _image_modes_by_layout(
        _Tpl(
            _bp([
                {"role": "intro", "image_mode": None},
                {"role": "content", "image_mode": "background"},
            ])
        )
    )
    assert modes["content_0"] == "background"


@pytest.mark.parametrize("mode", ["hero", "inset", "", 42, None])
def test_unrenderable_image_mode_becomes_none(mode):
    """Only the two forms the render path knows survive.

    Anything else must read as "no special treatment" rather than being passed
    through — a scrim keyed off an unknown mode would never fire, but a mode the
    renderer half-recognises could dim a scene that should not be dimmed.
    """
    modes = _image_modes_by_layout(
        _Tpl(_bp([{"role": "content", "image_mode": mode}]))
    )
    assert modes["content_0"] is None


@pytest.mark.parametrize(
    "blueprint",
    [None, "", "not json", "[1,2,3]", '{"version": 2}', '{"scenes": "nope"}'],
)
def test_missing_or_malformed_blueprint_yields_no_modes(blueprint):
    """No modes means no scrim — the behaviour before this existed.

    A template generated before image_mode was threaded through must render
    exactly as it does today rather than being dimmed on a guess.
    """
    assert _image_modes_by_layout(_Tpl(blueprint)) == {}


def test_non_dict_scene_entries_are_skipped_without_shifting_indices():
    """A malformed entry must not silently renumber the scenes after it."""
    modes = _image_modes_by_layout(
        _Tpl(
            _bp([
                {"role": "intro", "image_mode": None},
                {"role": "content", "image_mode": "background"},
                {"role": "content", "image_mode": "half"},
            ])
        )
    )
    assert modes["content_0"] == "background"
    assert modes["content_1"] == "half"


def test_scene_without_an_image_mode_key_reads_as_none():
    modes = _image_modes_by_layout(_Tpl(_bp([{"role": "content"}])))
    assert modes["content_0"] is None
