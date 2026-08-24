"""Failure-resilience tests for custom-template scene generation (§R).

These cover the layers that keep one bad scene from becoming a user-visible
failure. The stub test in particular is load-bearing: the stub is the last line
of defence, so an invalid stub would make the whole fallback path worthless —
and unlike LLM output, its correctness is entirely in our control.

No network: everything here is pure string/validation logic.
"""
from __future__ import annotations

import pytest

from app.services.code_generator import _build_stub_scene_code, _format_scene_failure
from app.services.code_validator import (
    validate_component_code,
    validate_wrapped_component_code,
)

SCENE_TYPES = ("intro", "content", "outro")


# ─── §R Layer 3: the deterministic stub ──────────────────────────────────────


@pytest.mark.parametrize("scene_type", SCENE_TYPES)
def test_stub_scene_validates(scene_type: str) -> None:
    """The fallback scene must pass the SAME gate real generated scenes do.

    If this ever fails, the stub substitution in generate_component_code would
    store code that cannot render — turning a degraded scene into a broken
    video, which is strictly worse than the RuntimeError it replaced.
    """
    code = _build_stub_scene_code(scene_type, None)
    valid, err = validate_component_code(code, scene_type=scene_type)
    assert valid, f"stub for {scene_type!r} failed validation: {err}"


@pytest.mark.parametrize("scene_type", SCENE_TYPES)
def test_stub_scene_survives_wrapping(scene_type: str) -> None:
    """The stub must also be safe once wrapped with the kit/remotion imports."""
    code = _build_stub_scene_code(scene_type, None)
    valid, err = validate_wrapped_component_code(code)
    assert valid, f"wrapped stub for {scene_type!r} failed: {err}"


def test_stub_uses_theme_colors_when_available() -> None:
    """The stub should read as the brand, not as a generic error card."""
    theme = {"colors": {"bg": "#123456", "text": "#ABCDEF", "accent": "#FF0099"}}
    code = _build_stub_scene_code("content", theme)
    for value in ("#123456", "#ABCDEF", "#FF0099"):
        assert value in code, f"theme colour {value} missing from stub"


def test_stub_honors_stock_clip_contract() -> None:
    """data-content-img must sit on the CONTAINER and not be gated behind an
    <Img>, or ClipSlotOverlay cannot align a stock clip to the slot and the
    clip falls back to covering the whole frame."""
    code = _build_stub_scene_code("content", None)
    assert 'data-content-img="1"' in code
    marker = code.index('data-content-img="1"')
    # The marker must appear before the <Img> it wraps, i.e. on the div.
    assert "<Img" not in code[:marker].rsplit("<div", 1)[-1]
    # The outer fill must be transparent when a clip is playing behind it.
    assert "hasVideo ? 'transparent'" in code


# ─── §R Layer 1: real diagnostics reach the retry ────────────────────────────


def test_format_scene_failure_includes_real_error() -> None:
    """The retry used to send a hardcoded 'syntax error' hint that was wrong for
    almost every validator failure. The real message must survive."""
    out = _format_scene_failure("const SceneComponent = () => null;", "Missing conditional logoUrl rendering")
    assert "Missing conditional logoUrl rendering" in out


def test_format_scene_failure_annotates_source_position() -> None:
    """esbuild errors carry <stdin>:LINE:COL — the offending line should be
    shown so the model can see what it actually wrote."""
    code = "\n".join(f"line{i}" for i in range(1, 11))
    out = _format_scene_failure(code, "Syntax error (esbuild): <stdin>:5:3: ERROR: Unexpected token")
    assert ">>>" in out
    assert "line5" in out


def test_truncated_response_salvages_the_scene_code() -> None:
    """A missing trailing field must not throw away a complete scene.

    The four image_box_* fractions are emitted AFTER `code`, so a response
    truncated past the code block loses them — and DSPy's JSONAdapter compares
    parsed keys to the signature with strict equality, ignoring the field
    defaults, so it raises. Template 139 failed generation outright this way with
    a valid scene sitting in the response. Those fractions are cropper metadata;
    nothing about the render depends on them.
    """
    import json

    from dspy.adapters.json_adapter import JSONAdapter

    from app.services.code_generator import (
        GenerateSceneCode,
        _salvage_scene_from_parse_error,
    )

    scene = (
        "const SceneComponent = (props) => {\n"
        "  const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');\n"
        "  return <div style={{overflow:'hidden'}}>"
        "<FitText fontSize={props.titleFontSize ?? 72}>{props.displayText}</FitText>"
        "<div style={{background: `radial-gradient(circle, red, blue)`}}/>"
        + "x" * 300
        + "</div>;\n};"
    )
    truncated = json.dumps({"reasoning": "r", "code": scene})

    with pytest.raises(Exception) as caught:  # noqa: PT011 — DSPy's own error type
        JSONAdapter().parse(GenerateSceneCode, truncated)

    salvaged = _salvage_scene_from_parse_error(caught.value)
    assert salvaged is not None, "usable code was discarded"
    assert salvaged.code == scene, "salvage must not corrupt the code"
    assert "`radial-gradient" in salvaged.code, "template literals must survive"
    assert salvaged.image_box_width_fraction_landscape == 1.0


def test_unusable_parse_errors_are_not_salvaged() -> None:
    """Salvage must not invent a scene out of a genuinely broken response."""
    from app.services.code_generator import _salvage_scene_from_parse_error

    assert _salvage_scene_from_parse_error(ValueError("total garbage")) is None
    # Present but far too short to be a real scene.
    assert _salvage_scene_from_parse_error(ValueError('{"code": "const x = 1;"}')) is None


def test_format_scene_failure_handles_empty_code() -> None:
    """An empty code field means the response was TRUNCATED, and the prompt says so.

    This previously asserted the literal "(empty string)". That wording was
    replaced deliberately: telling the model its output "was empty" gives it
    nothing to act on and burns identical retries, whereas naming the real cause
    (it ran out of output budget) and asking for a more compact scene does.
    """
    out = _format_scene_failure("", "Code is empty")
    assert "Code is empty" in out
    assert "empty" in out
    assert "cut off" in out or "ran out of output budget" in out


# ─── §R Layer 5: injected-import collisions ──────────────────────────────────


@pytest.mark.parametrize("name", ["Decor", "React", "interpolate", "AbsoluteFill"])
def test_wrapped_validation_rejects_import_collision(name: str) -> None:
    """A top-level redeclaration of an injected name is a module-evaluation
    SyntaxError. The module never evaluates, so SceneErrorBoundary cannot catch
    it and the WHOLE video blanks. esbuild does not flag this (verified), hence
    the dedicated static check."""
    code = f"const {name} = 1;\nconst SceneComponent = (props) => null;"
    valid, err = validate_wrapped_component_code(code)
    assert not valid, f"collision on {name!r} was not detected"
    assert name in (err or "")


def test_wrapped_validation_allows_nested_shadowing() -> None:
    """Shadowing inside a function body is legal JS and must not be flagged."""
    code = (
        "const SceneComponent = (props) => {\n"
        "  const Decor = 1;\n"
        "  return null;\n"
        "};"
    )
    valid, err = validate_wrapped_component_code(code)
    assert valid, f"legal nested shadowing was rejected: {err}"


# ─── The scene-type stage must never fail a whole template ───────────────────


def test_truncated_scene_types_fall_back_instead_of_raising() -> None:
    """A cut-off response must not kill generation.

    Template 143 (SpaceX) failed outright this way: DecideBrandSceneTypes ran
    under dspy.ChainOfThought, whose unbounded `reasoning` field is emitted
    BEFORE the JSON array, so GLM wrote prose until the budget ran out and
    returned a bare unterminated "[". Both attempts, on two consecutive
    generations, 13-24s each — then a RuntimeError that failed the template.

    This stage only decides the SHAPE of the scene set, and the blueprint
    supersedes its layouts when enabled, so a generic-but-valid set is a far
    better outcome than no template.
    """
    from unittest.mock import MagicMock, patch

    import app.services.code_generator as cg

    class _Res:
        plan_note = "x"
        scene_types_json = "["  # truncated exactly as observed

    briefs: list[str] = []

    class _Mod:
        def __call__(self, **kw):
            briefs.append(kw.get("user_brief", ""))
            return _Res()

    with patch.object(cg.dspy, "Predict", return_value=_Mod()), patch.object(
        cg, "get_scene_type_lm", return_value=MagicMock(cache=False)
    ), patch.object(cg.dspy, "context"):
        out = cg._decide_brand_scene_types("SpaceX, aerospace", "")

    assert len(out) >= 6
    assert any(s["scene_type"] == "intro" for s in out)
    assert any(s["scene_type"] == "outro" for s in out)
    # The fallback must span content types, or downstream matching has nowhere
    # to route a bullets/metrics/quote scene.
    assert len({b for s in out for b in s["best_for"]}) >= 4
    # And the retry must ADAPT rather than re-roll into the same truncation.
    assert len(briefs) == 2
    assert "CUT OFF" in briefs[1]


def test_scene_types_uses_predict_not_chain_of_thought() -> None:
    """Guard the swap: ChainOfThought reintroduces the unbounded reasoning field."""
    import inspect

    import dspy

    import app.services.code_generator as cg
    from app.services.code_generator import DecideBrandSceneTypes

    assert "reasoning" not in dspy.Predict(DecideBrandSceneTypes).signature.output_fields
    assert "reasoning" in dspy.ChainOfThought(DecideBrandSceneTypes).predict.signature.output_fields

    src = inspect.getsource(cg._decide_brand_scene_types)
    assert "dspy.Predict(DecideBrandSceneTypes)" in src
    assert "dspy.ChainOfThought(DecideBrandSceneTypes)" not in src
    # The bounded plan note must come BEFORE the JSON, so the model still commits
    # to a shape without being able to spend the response on prose.
    assert list(DecideBrandSceneTypes.output_fields) == ["plan_note", "scene_types_json"]
