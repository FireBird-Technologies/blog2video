"""The DSPy code critic — and above all, its safety contract.

This runs inside the scene-generation hot path, so the one property that
matters more than any critique it produces is that it can never take a
generation down with it. It returns None for "no defect" AND for every failure
mode; that conflation is deliberate, because a quality gate that can raise is a
quality gate that can fail a generation.
"""
from __future__ import annotations

import pytest

from app.services import scene_code_critic as critic

CODE = "const SceneComponent = (props) => { return <div/>; };" + ("x" * 400)


# ── the safety contract ──────────────────────────────────────────────────────


def test_the_critic_always_runs() -> None:
    """It used to ship dark behind SCENE_CODE_CRITIC_ENABLED. That flag is gone.

    Pins the removal: a reintroduced flag defaulting off would silently disable
    every check below, and every one of them would still pass.
    """
    import inspect

    src = inspect.getsource(critic)
    assert "SCENE_CODE_CRITIC_ENABLED" not in src


def test_an_lm_failure_is_swallowed(monkeypatch) -> None:
    """A quality gate that can raise is a gate that can fail a generation."""
    import dspy

    def _explode(*a, **k):
        raise RuntimeError("provider is down")

    monkeypatch.setattr(dspy, "Predict", _explode)
    assert critic.critique_scene_code(CODE, scene_doc="a side rail") is None


def test_short_or_empty_code_is_skipped() -> None:
    """A stub or a truncation has nothing to critique; the model would invent."""
    assert critic.critique_scene_code("", scene_doc="a side rail") is None
    assert critic.critique_scene_code("const x = 1;", scene_doc="a side rail") is None


def test_no_layout_and_no_direction_is_skipped() -> None:
    """Without a layout to compare against, the only check worth paying for
    cannot be answered — and the rest are already the validator's job."""
    assert critic.critique_scene_code(CODE) is None


# ── verdict parsing ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("raw", ["PASS", "pass", "  PASS  ", "PASS\nlooks good"])
def test_pass_verdicts_yield_no_critique(raw: str) -> None:
    assert critic._parse_verdict(raw, scene_type="content") is None


@pytest.mark.parametrize("raw", ["", None, "   "])
def test_empty_output_yields_no_critique(raw) -> None:
    assert critic._parse_verdict(raw, scene_type="content") is None


def test_unparseable_output_yields_no_critique() -> None:
    """Regenerating on an answer we cannot read is worse than not checking."""
    assert critic._parse_verdict("I think it looks fine, mostly", scene_type="content") is None


def test_bare_fail_with_no_defects_yields_no_critique() -> None:
    """A repair prompt with no instruction in it cannot converge."""
    assert critic._parse_verdict("FAIL", scene_type="content") is None
    assert critic._parse_verdict("FAIL\n\n  \n", scene_type="content") is None


def test_fail_returns_the_defect_lines() -> None:
    got = critic._parse_verdict(
        "FAIL\nthe scene centers everything but a side rail was specified\nno masthead",
        scene_type="content",
    )
    assert got is not None
    assert "side rail" in got
    assert "masthead" in got


# ── the prompt itself ────────────────────────────────────────────────────────


def test_the_prompt_defaults_to_pass_and_closes_the_question_set() -> None:
    """A model asked to 'review this code' always finds something, and every
    finding costs a full regeneration."""
    p = critic._CODE_CRITIQUE_PROMPT
    assert "Answer PASS unless" in p
    assert "Do NOT comment on code style" in p
    assert "Do NOT suggest refactors" in p
    # The check that justifies the whole stage.
    assert "LAYOUT FIDELITY" in p


def test_the_repair_instruction_asks_for_an_edit_not_a_rewrite() -> None:
    """A rewrite is the documented non-convergence mode."""
    from app.services.code_generator import _format_code_critique

    out = _format_code_critique("the scene centers everything")
    assert "EDITING your previous code" in out
    assert "Do NOT redesign" in out
