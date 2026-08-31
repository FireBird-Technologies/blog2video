"""Visual verification of generated scenes.

Static analysis reads source code; it cannot see that text is the same colour as
the panel behind it, that a headline is clipped, or that most of the frame is
empty. This renders a scene and asks a vision model.

Two properties matter above all and are pinned here:

  1. IT CAN NEVER BREAK GENERATION. Every failure mode — disabled, unconfigured,
     no browser, timeout, API error, garbage response — returns None, which the
     caller reads as "no opinion" and ships the scene unverified.
  2. IT MUST STAY CHEAP. The gate fires only for scenes in a narrow score band,
     never for a clean scene, never below the retry threshold, and never on the
     final attempt where no rollout is left to consume the critique.
"""
from __future__ import annotations

import contextlib
import sys
from unittest.mock import MagicMock, patch

import pytest

from app.services import scene_visual_check as svc

SCENE = (
    "const SceneComponent = (props) => {"
    "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
    "return <div style={{overflow:'hidden'}}>"
    "<FitText fontSize={props.titleFontSize ?? 72}>{props.displayText}</FitText>" + ("x" * 400) + "</div>; };"
)


def _enabled(**over):
    """Patch settings so the check is fully configured."""
    base = {
        "SCENE_VISUAL_CHECK_ENABLED": True,
        "CAPTURE_SECRET": "s3cret",
        "SCENE_SHOT_SERVER_URL": "http://127.0.0.1:7861",
        "ZAI_API_KEY": "key",
        "SCENE_VISION_MODEL": "glm-4.6v",
    }
    base.update(over)
    return patch.multiple(svc.settings, **base)


@contextlib.contextmanager
def _mock_gemini(text: str):
    """Stand in for the OpenAI-compatible client the vision call constructs.

    The check runs GLM through Z.AI's OpenAI-compatible endpoint (reusing
    ZAI_API_KEY), so the response shape is chat.completions, not Gemini's.
    `from openai import OpenAI` happens INSIDE the function, so the fake module
    must be injected into sys.modules to be reached.
    """
    resp = MagicMock()
    resp.choices = [MagicMock(message=MagicMock(content=text))]
    client = MagicMock()
    client.chat.completions.create.return_value = resp
    openai_mod = MagicMock(OpenAI=MagicMock(return_value=client))
    with patch.dict(sys.modules, {"openai": openai_mod}):
        yield


def _check() -> str | None:
    return svc.visual_check_scene(
        SCENE, scene_type="content", scene_index=1, total_scenes=9
    )


# ─── Contract: never raises, always degrades to None ─────────────────────────


def test_disabled_returns_none_without_touching_anything() -> None:
    """Flag off must cost nothing at all — no job stored, no HTTP, no browser."""
    with _enabled(SCENE_VISUAL_CHECK_ENABLED=False), patch.object(
        svc, "_render_scene_png"
    ) as shot:
        assert _check() is None
        shot.assert_not_called()


@pytest.mark.parametrize("missing", ["CAPTURE_SECRET", "SCENE_SHOT_SERVER_URL"])
def test_unconfigured_returns_none(missing: str) -> None:
    with _enabled(**{missing: ""}), patch.object(svc, "_render_scene_png") as shot:
        assert _check() is None
        shot.assert_not_called()


@pytest.mark.parametrize(
    "boom",
    [
        ConnectionRefusedError("shot server down"),
        TimeoutError("shot timed out"),
        RuntimeError("something else entirely"),
    ],
)
def test_shot_failures_return_none(boom: Exception) -> None:
    """A missing or broken renderer disables the feature; it never fails a scene."""
    with _enabled(), patch.object(svc, "_render_scene_png", side_effect=boom):
        assert _check() is None


def test_shot_returning_nothing_returns_none() -> None:
    with _enabled(), patch.object(svc, "_render_scene_png", return_value=None):
        assert _check() is None


@pytest.mark.parametrize(
    "boom",
    [ImportError("no google.genai"), RuntimeError("vision 500"), ValueError("bad key")],
)
def test_vision_failures_return_none(boom: Exception) -> None:
    with _enabled(), patch.object(svc, "_render_scene_png", return_value=b"img"), patch.object(
        svc, "_critique_image", side_effect=boom
    ):
        assert _check() is None


def test_job_store_failure_returns_none() -> None:
    """Even a bug in our own job plumbing must not surface as a generation error."""
    with _enabled(), patch(
        "app.routers.custom_templates.put_scene_capture_job",
        side_effect=RuntimeError("store exploded"),
    ):
        assert _check() is None


# ─── Verdict parsing — fail OPEN ─────────────────────────────────────────────


@pytest.mark.parametrize(
    "text",
    [
        "PASS",
        "pass",
        "  PASS  \nlooks good",
        "",
        "I think this scene is quite nice actually",  # unparseable → treat as pass
        "The scene looks fine.\nFAIL",  # FAIL not on the first line → not a verdict
    ],
)
def test_non_fail_verdicts_return_none(text: str) -> None:
    """Anything that is not an unambiguous FAIL ships the scene.

    A false FAIL costs a whole LLM rollout, so ambiguity resolves to pass.
    """
    with _enabled(), _mock_gemini(text):
        assert svc._critique_image(b"img", "") is None


def test_fail_verdict_returns_the_critique() -> None:
    verdict = "FAIL\nLEGIBILITY: the headline is the same colour as the panel behind it."
    with _enabled(), _mock_gemini(verdict):
        out = svc._critique_image(b"img", "")
    assert out is not None
    assert "LEGIBILITY" in out
    assert "FAIL" not in out.split("\n")[0], "the verdict token should be stripped"


# ─── The critique prompt must be a defect detector, not a design critic ──────


def test_prompt_forbids_style_and_motion_commentary() -> None:
    """A model asked to critique will always find something, and every finding
    costs a rollout. The prompt must close the question set."""
    p = svc._CRITIQUE_PROMPT
    assert "PASS unless" in p, "the prompt must still bias toward PASS"
    assert "FROZEN FRAME" in p
    assert "colour taste" in p
    for defect in ("LEGIBILITY", "OVERFLOW", "SCALE", "EMPTINESS", "RENDER FAILURE"):
        assert defect in p


# ─── The gate: only ever fires where it earns its cost ───────────────────────


def test_visual_check_threshold_sits_above_the_retry_threshold() -> None:
    from app.services.code_generator import REFINE_THRESHOLD, VISUAL_CHECK_THRESHOLD

    assert REFINE_THRESHOLD < VISUAL_CHECK_THRESHOLD < 1.0


class _Pred:
    def __init__(self, code: str) -> None:
        self.code = code


def _drive_retry(score: float, *, calls: list):
    """Run _informed_retry with a stubbed module and a pinned score."""
    from app.services import code_generator as cg

    def _fake_check(code, **kw):
        calls.append(kw.get("scene_index"))
        return None  # pass, so the loop is not perturbed

    module = lambda previous_failure="", **kw: _Pred(SCENE)  # noqa: E731
    with patch.object(cg, "validate_component_code", return_value=(True, None)), patch.object(
        cg, "_score_valid_scene", return_value=score
    ), patch.object(cg, "visual_check_scene", side_effect=_fake_check), patch.object(
        # The code critic runs unconditionally now and shares this gate, so it
        # is stubbed to "no defect" to keep these tests about the VISUAL path.
        cg, "critique_scene_code", return_value=None
    ):
        cg._informed_retry(
            module,
            {"scene_index": 1, "total_scenes": 9, "art_direction": ""},
            "",
            "content",
        )


@pytest.mark.parametrize(
    "score,should_fire",
    [
        (1.00, False),  # clean scene — never touches a browser
        (0.90, False),  # above the bar
        (0.80, True),   # the suspect band: this is what the check is for
        (0.65, True),
        (0.40, False),  # already failing — a textual diagnostic is queued
    ],
)
def test_gate_fires_only_in_the_suspect_band(score: float, should_fire: bool) -> None:
    """The gate is the entire speed story.

    A clean scene must cost ZERO — no job, no browser, no vision call. An
    already-failing scene must not pay for a screenshot that would only confirm
    what the scorer already said.
    """
    calls: list = []
    _drive_retry(score, calls=calls)
    assert bool(calls) is should_fire


def test_gate_never_fires_on_the_final_attempt() -> None:
    """No rollout left to consume a critique means the render is pure waste."""
    from app.services import code_generator as cg

    calls: list = []

    def _fake_check(code, **kw):
        calls.append(kw)
        return "FAIL: something"  # always fail, to force the loop to exhaust

    module = lambda previous_failure="", **kw: _Pred(SCENE)  # noqa: E731
    with patch.object(cg, "validate_component_code", return_value=(True, None)), patch.object(
        cg, "_score_valid_scene", return_value=0.70
    ), patch.object(cg, "visual_check_scene", side_effect=_fake_check), patch.object(
        cg, "critique_scene_code", return_value=None
    ):
        cg._informed_retry(module, {"scene_index": 0, "total_scenes": 9}, "", "content")

    # REFINE_N + 1 attempts exist, but the last one must not be checked.
    assert len(calls) == cg.REFINE_N, f"expected {cg.REFINE_N} checks, got {len(calls)}"


def test_critique_reaches_the_next_attempt() -> None:
    """A visual failure must arrive as `previous_failure` on the retry."""
    from app.services import code_generator as cg

    seen: list[str] = []

    def module(previous_failure: str = "", **kw):
        seen.append(previous_failure)
        return _Pred(SCENE)

    with patch.object(cg, "validate_component_code", return_value=(True, None)), patch.object(
        cg, "_score_valid_scene", return_value=0.70
    ), patch.object(
        cg, "visual_check_scene", return_value="LEGIBILITY: headline invisible on its panel."
    ), patch.object(cg, "critique_scene_code", return_value=None):
        cg._informed_retry(module, {"scene_index": 0, "total_scenes": 9}, "", "content")

    assert len(seen) >= 2
    assert "LEGIBILITY: headline invisible" in seen[1]
    assert "SCREENSHOT" in seen[1]


def test_format_visual_failure_reuses_the_repair_checklist() -> None:
    """The critique must arrive in the shape the model already knows."""
    from app.services.code_generator import REPAIR_CHECKLIST, _format_visual_failure

    out = _format_visual_failure("LEGIBILITY: headline invisible on its panel.")
    assert "LEGIBILITY: headline invisible" in out
    assert REPAIR_CHECKLIST in out
    # It must not send the model rewriting structure that already validates.
    assert "structurally correct" in out
    assert "readableOn" in out


# ── the thinking-budget parameter, which differs by model family ─────────────


def test_thinking_params_match_what_each_model_family_accepts() -> None:
    """Not interchangeable, and getting it wrong FAILS OPEN — the call errors,
    the check returns None, and verification silently never runs.

    Measured against the live z.ai API: glm-5.3-flash answers correctly with
    `reasoning_effort: low` and returns error 1210 ("always engages in thinking
    and cannot be disabled") for the `thinking: disabled` glm-4.6v requires.
    """
    from app.services.scene_visual_check import _thinking_params

    assert _thinking_params("glm-5.3-flash") == {"reasoning_effort": "low"}
    assert _thinking_params("glm-4.6v") == {"thinking": {"type": "disabled"}}


def test_the_configured_vision_model_reads_images() -> None:
    """The codegen model rejects image content outright, so pointing this at
    glm-5.2 would disable verification without any error surfacing."""
    from app.config import settings

    assert settings.SCENE_VISION_MODEL != "glm-5.2"
    assert settings.SCENE_VISION_MODEL.startswith("glm-")
