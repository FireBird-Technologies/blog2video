"""Clearing a scene's generation warning once that scene is rewritten.

A template that fell back to a stub for one scene carries a warning like
`Scene 2 (stat_block) could not be generated ...`. Applying an AI edit rewrote
the scene's CODE but left `generation_warnings` untouched, so the editor kept
reporting a "simplified fallback design" for a scene the user had already fixed
— permanently, with no way to clear it.

The batch index in that prefix is the only link back to a scene: index 0 is the
intro, 1..N the content scenes, and the last is the outro (see `scene_labels` in
code_generator). These tests pin that mapping, because getting it wrong clears
the WRONG scene's warning and leaves the real one flagged.
"""
from __future__ import annotations

import json
from types import SimpleNamespace

from app.routers.custom_templates import _clear_scene_warning


def _tpl(warnings: list[str], n_content: int = 3):
    return SimpleNamespace(
        generation_warnings=json.dumps(warnings),
        content_codes=json.dumps(["code"] * n_content),
    )


WARNINGS = [
    "Scene 0 (hero_intro) could not be generated after 3 attempts and uses a simplified fallback design.",
    "Scene 2 (stat_block) could not be generated after 3 attempts and uses a simplified fallback design.",
    "Scene 4 (cta_outro) conflicted with the render wrapper and uses a simplified fallback design.",
]


def _remaining(tpl) -> list[str]:
    return json.loads(tpl.generation_warnings) if tpl.generation_warnings else []


def test_intro_is_batch_index_zero() -> None:
    tpl = _tpl(WARNINGS)
    _clear_scene_warning(tpl, "intro")
    assert not any(w.startswith("Scene 0 (") for w in _remaining(tpl))
    assert len(_remaining(tpl)) == 2


def test_content_index_is_offset_by_the_intro() -> None:
    """content_1 is batch index 2 — the intro occupies 0. An off-by-one here
    silently clears a neighbouring scene's warning."""
    tpl = _tpl(WARNINGS)
    _clear_scene_warning(tpl, "content_1")
    remaining = _remaining(tpl)
    assert not any(w.startswith("Scene 2 (") for w in remaining)
    assert any(w.startswith("Scene 0 (") for w in remaining)
    assert any(w.startswith("Scene 4 (") for w in remaining)


def test_outro_is_the_last_batch_index() -> None:
    tpl = _tpl(WARNINGS)
    _clear_scene_warning(tpl, "outro")
    assert not any(w.startswith("Scene 4 (") for w in _remaining(tpl))


def test_only_the_edited_scene_is_cleared() -> None:
    """A template with two bad scenes must still warn about the other one."""
    tpl = _tpl(WARNINGS)
    _clear_scene_warning(tpl, "content_1")
    assert len(_remaining(tpl)) == 2


def test_editing_an_unwarned_scene_changes_nothing() -> None:
    tpl = _tpl(WARNINGS)
    _clear_scene_warning(tpl, "content_0")
    assert _remaining(tpl) == WARNINGS


def test_fixing_every_warned_scene_clears_the_banner_entirely() -> None:
    """Stored as NULL rather than "[]", so the card/editor treat it as absent."""
    tpl = _tpl(WARNINGS)
    for key in ("intro", "content_1", "outro"):
        _clear_scene_warning(tpl, key)
    assert tpl.generation_warnings is None


def test_a_single_digit_index_does_not_match_a_double_digit_one() -> None:
    """"Scene 1" is a prefix of "Scene 10". The trailing " (" disambiguates —
    without it, editing content_0 would wipe scenes 10-19 as well."""
    warnings = [
        "Scene 1 (a) uses a simplified fallback design.",
        "Scene 10 (b) uses a simplified fallback design.",
        "Scene 11 (c) uses a simplified fallback design.",
    ]
    tpl = _tpl(warnings, n_content=12)
    _clear_scene_warning(tpl, "content_0")  # batch index 1
    remaining = _remaining(tpl)
    assert len(remaining) == 2
    assert all("Scene 1 (" not in w for w in remaining)


def test_unparseable_state_is_left_alone() -> None:
    """Never destroy warnings we cannot interpret — losing a real warning is
    worse than showing a stale one."""
    tpl = SimpleNamespace(generation_warnings="not json", content_codes=json.dumps([]))
    _clear_scene_warning(tpl, "intro")
    assert tpl.generation_warnings == "not json"

    empty = SimpleNamespace(generation_warnings=None, content_codes=None)
    _clear_scene_warning(empty, "intro")
    assert empty.generation_warnings is None


# ── rebuilding a stubbed scene from its blueprint ────────────────────────────


def test_a_blueprint_rebuild_may_omit_the_prompt() -> None:
    """The regenerate control on a fallback scene sends no instruction — it
    re-derives the scene from the stored blueprint instead of editing code."""
    from app.routers.custom_templates import SceneAiEditRequest

    req = SceneAiEditRequest(from_blueprint=True)
    assert req.prompt == ""
    assert req.from_blueprint is True


def test_an_ordinary_edit_still_requires_a_prompt() -> None:
    """Relaxing the length rule for rebuilds must not relax it for edits — an
    empty instruction would send the model nothing to act on."""
    import pytest as _pytest
    from pydantic import ValidationError

    from app.routers.custom_templates import SceneAiEditRequest

    for bad in ("", "  ", "ab"):
        with _pytest.raises(ValidationError):
            SceneAiEditRequest(prompt=bad)


def test_a_normal_edit_is_unchanged() -> None:
    from app.routers.custom_templates import SceneAiEditRequest

    req = SceneAiEditRequest(prompt="make the headline bigger", keep_geometry=True)
    assert req.from_blueprint is False
    assert req.keep_geometry is True
