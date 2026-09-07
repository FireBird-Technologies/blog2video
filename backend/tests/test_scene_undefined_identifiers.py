"""The undefined-identifier gate: the crash that reached production.

A generated scene shipped

    const frame = useCurrentFrame();
    const o = interpolate(frame0, [0, 30], [0, 1]);   // frame0 never declared

and threw `frame0 is not defined` in the browser on its first frame, blanking
the scene in the preview and the export alike.

Nothing static caught it. It is valid JavaScript, so the esbuild parse gate
accepted it; esbuild's bundler accepts it too (an unresolved identifier is
assumed to be a runtime global); and no regex contract was looking for it. The
Level-2 runtime harness DOES catch it, but it runs last — only once every other
gate has passed — and it fails open when its toolchain is missing, which is
exactly what happened in the deployed image.

These tests fail OPEN the same way the module does: with no node/@babel in
remotion-video/node_modules the check returns [] and they skip.
"""
from __future__ import annotations

import pytest

from app.services.code_validator import _undefined_identifiers, validate_component_code

_PROBE = "const SceneComponent = (props) => { const o = zzUndefinedProbe; return null; };"

pytestmark = pytest.mark.skipif(
    not _undefined_identifiers(_PROBE),
    reason="no node/@babel toolchain — the scope check fails open",
)


def _scene(body: str) -> str:
    """A scene shaped like the real thing: a component that closes over props."""
    return (
        "const SceneComponent = (props) => {"
        "  const frame = useCurrentFrame();"
        "  const { fps } = useVideoConfig();"
        f" {body}"
        "  return <AbsoluteFill style={{overflow:'hidden'}}>"
        "<FitText maxHeight={100}>{props.sceneTitle}</FitText>"
        "</AbsoluteFill>;"
        "};"
    )


# ─── The defect ──────────────────────────────────────────────────────────────


def test_the_frame0_typo_is_caught() -> None:
    """The exact production defect: a typo for a variable that IS declared."""
    found = _undefined_identifiers(
        _scene("const o = interpolate(frame0, [0, 30], [0, 1]);")
    )
    assert [n for n, _ in found] == ["frame0"]


def test_the_error_names_the_identifier_and_its_line() -> None:
    """A repair prompt that does not say WHICH name is unfollowable."""
    ok, err = validate_component_code(
        _scene("const o = interpolate(frame0, [0, 30], [0, 1]);"),
        scene_type="content",
        collect_all=True,
        scene_doc="doc",
    )
    assert not ok
    assert "frame0" in err
    # Reported alone, not buried under contract findings from a component that
    # never renders.
    assert "Undefined identifier" in err


def test_it_fails_fast_rather_than_co_reporting() -> None:
    """A scene that throws on frame 1 draws nothing, so every other finding
    gathered from it would describe a component that never ran."""
    ok, err = validate_component_code(
        # Also missing the logo guard, overflow:hidden and the body FitText —
        # contracts that would normally all be reported together.
        "const SceneComponent = (props) => { return <div>{brokenName}</div>; };",
        scene_type="content",
        collect_all=True,
        scene_doc="doc",
    )
    assert not ok
    assert "brokenName" in err
    assert "problems must ALL be fixed" not in err


# ─── What must NOT be flagged ────────────────────────────────────────────────


def test_a_correct_scene_is_clean() -> None:
    assert _undefined_identifiers(
        _scene("const o = interpolate(frame, [0, 30], [0, 1]);")
    ) == []


def test_injected_globals_are_not_undefined() -> None:
    """The sandbox binds these as parameters — see scene_runtime_harness.mjs."""
    assert _undefined_identifiers(
        _scene(
            "const s = spring({ frame, fps });"
            "const r = random('seed');"
            "const e = Easing.out(Easing.quad);"
        )
    ) == []


def test_kit_names_are_not_undefined() -> None:
    """FitText and friends come from the shared export manifest."""
    assert _undefined_identifiers(
        _scene("const c = readableOn('#fff'); const p = derivePalette({});")
    ) == []


def test_js_builtins_are_not_undefined() -> None:
    """The harness gets these free by running in node; a scope walk must be told."""
    assert _undefined_identifiers(
        _scene(
            "const a = Math.round(1.5);"
            "const b = Object.keys({});"
            "const c = JSON.stringify({});"
            "const d = new Date();"
            "const e = Number.parseFloat('1');"
        )
    ) == []


@pytest.mark.parametrize(
    "body",
    [
        # Every binding form Babel's scope analysis understands and a regex
        # would not.
        "const { a, b } = props.thing ?? {}; const x = a + b;",
        "const [first, ...rest] = props.bullets ?? []; const x = first + rest.length;",
        "for (let i = 0; i < 3; i++) { const y = i; }",
        "const f = (arg) => arg * 2; const x = f(1);",
        "function helper(n) { return n + 1; } const x = helper(1);",
        "try { throw new Error('x'); } catch (err) { const m = err.message; }",
        "const items = (props.bullets ?? []).map((b, i) => b + i);",
        "const x = props.metrics?.reduce((acc, m) => acc + m.value, 0);",
        "class Shape { area() { return 1; } } const s = new Shape();",
        "const fn = function named(v) { return named(v); };",
    ],
)
def test_binding_forms_are_understood(body: str) -> None:
    """Hoisting, destructuring, params, catch clauses and block scope."""
    assert _undefined_identifiers(_scene(body)) == []


def test_a_stored_scene_is_never_retroactively_failed() -> None:
    """Generation path only. Re-validating a template already live in production
    must not start failing it — same rule as the Level-2 gate."""
    broken = _scene("const o = interpolate(frame0, [0, 30], [0, 1]);")
    _, err = validate_component_code(broken, scene_type="content", collect_all=True)
    assert "Undefined identifier" not in (err or "")
