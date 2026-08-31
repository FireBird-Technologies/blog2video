"""The supporting-copy type tier, and the body-size slider contract.

Two things are asserted here.

1. THE TIERS EXIST AND ARE BOUNDED. `prop` (card body, bullet body, captions)
   and `micro` (masthead, panel numbers, rule labels) had no band at all on the
   blueprint path, so the model was given no size instruction for them and
   picked whatever it liked — usually a bare literal, which is what made the
   editor's body slider a no-op on everything but one paragraph.

2. THE PYTHON AND TYPESCRIPT BOUNDS AGREE. `_TYPE_FLOOR` / `_TYPE_CEILING` here
   clamp what the MODEL is told; `TYPE_BOUNDS` in the kit's theme.ts clamps what
   the RENDERER computes. When those two disagree a scene renders at a size the
   prompt calls illegal, which is exactly the portrait-headline bug this work
   fixed (the kit defaulted portrait titles to ~88px against a 60px ceiling).
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.code_generator import (
    _TYPE_CEILING,
    _TYPE_FLOOR,
    _bp_type_directive,
    _type_bands,
)
from app.services.code_validator import validate_component_code

KIT_THEME = (
    Path(__file__).resolve().parents[2]
    / "remotion-video/src/templates/generated/kit/theme.ts"
)


def _bp(**type_system) -> dict:
    """A blueprint carrying only what `_type_bands` reads: its type_system.

    Empty means every field falls through to its own default, which is the
    common case in production — the blueprint's type_system keys were undocumented
    in the signature until recently, so most stored blueprints have none of them.
    """
    return {"type_system": type_system}


# ── 1. bands ────────────────────────────────────────────────────────────────


def test_type_bands_include_prop_and_micro_tiers():
    bands = _type_bands(_bp())
    for key in (
        "prop_landscape",
        "prop_portrait",
        "micro_landscape",
        "micro_portrait",
    ):
        assert key in bands, f"{key} missing — the tier has no size instruction"


@pytest.mark.parametrize(
    "key",
    [
        "headline_landscape",
        "headline_portrait",
        "body_landscape",
        "body_portrait",
        "prop_landscape",
        "prop_portrait",
        "micro_landscape",
        "micro_portrait",
    ],
)
def test_every_band_sits_inside_its_floor_and_ceiling(key):
    lo, hi = _type_bands(_bp())[key]
    assert lo <= hi, f"{key} band is inverted: ({lo}, {hi})"
    assert _TYPE_FLOOR[key] <= lo, f"{key} low end {lo} is below its floor"
    assert hi <= _TYPE_CEILING[key], f"{key} high end {hi} is above its ceiling"


def test_portrait_is_never_larger_than_landscape():
    """Portrait is a 1080-wide frame. Larger type there is the inverted scale."""
    bands = _type_bands(_bp())
    for role in ("headline", "body", "prop", "micro"):
        _, land_hi = bands[f"{role}_landscape"]
        _, port_hi = bands[f"{role}_portrait"]
        assert port_hi <= land_hi, (
            f"{role}: portrait max {port_hi} exceeds landscape max {land_hi}"
        )


def test_prop_tier_tracks_the_body_size():
    """A template with bigger body copy gets bigger supporting copy."""
    small = _bp(base_body_px_landscape=30)
    large = _bp(base_body_px_landscape=44)
    assert _type_bands(small)["prop_landscape"][1] < _type_bands(large)["prop_landscape"][1]


def test_directive_names_the_supporting_tier_and_the_prop_to_bind():
    # _bp_type_directive early-returns on an empty type_system, so give it one.
    directive = _bp_type_directive(_bp(base_body_px_landscape=36, scale_ratio=1.25))
    assert "SUPPORTING COPY" in directive
    assert "props.descriptionFontSize" in directive
    # The whole point is that it must be a FRACTION, not a fixed number.
    assert "* 0.9" in directive


# ── 2. TS / Python parity ───────────────────────────────────────────────────


def _ts_type_bounds() -> dict[str, dict[str, tuple[int, int]]]:
    """Parse `TYPE_BOUNDS` out of the kit's theme.ts."""
    src = KIT_THEME.read_text()
    block = re.search(r"const TYPE_BOUNDS = \{(.*?)\n\} as const;", src, re.S)
    assert block, "TYPE_BOUNDS not found in theme.ts"
    out: dict[str, dict[str, tuple[int, int]]] = {}
    for role, body in re.findall(r"(\w+):\s*\{([^}]*\])\s*,?\s*\}", block.group(1)):
        entry: dict[str, tuple[int, int]] = {}
        for orient, lo, hi in re.findall(
            r"(landscape|portrait):\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]", body
        ):
            entry[orient] = (int(lo), int(hi))
        if entry:
            out[role] = entry
    return out


@pytest.mark.skipif(not KIT_THEME.exists(), reason="remotion-video sources not present")
@pytest.mark.parametrize("role", ["title", "body", "prop", "micro"])
def test_ts_bounds_match_python_bounds(role):
    """The renderer's clamp and the prompt's clamp must be the same numbers."""
    ts = _ts_type_bounds()
    assert role in ts, f"{role} missing from TYPE_BOUNDS in theme.ts"
    # `title` is `headline` on the Python side; the rest share a name.
    py_key = "headline" if role == "title" else role
    for orient in ("landscape", "portrait"):
        lo, hi = ts[role][orient]
        assert lo == _TYPE_FLOOR[f"{py_key}_{orient}"], (
            f"{role}/{orient} floor: theme.ts says {lo}, "
            f"code_generator says {_TYPE_FLOOR[f'{py_key}_{orient}']}"
        )
        assert hi == _TYPE_CEILING[f"{py_key}_{orient}"], (
            f"{role}/{orient} ceiling: theme.ts says {hi}, "
            f"code_generator says {_TYPE_CEILING[f'{py_key}_{orient}']}"
        )


# ── 3. the validator gate ───────────────────────────────────────────────────

# Long enough to clear the "code too short" heuristic, and carrying the logo /
# image / font / animation contracts that every scene must satisfy — none of
# which is what these tests are about, but all of which the validator requires.
# Mirrors the fixture in test_fit_gates.py.
_PAD = "\n".join(
    f"const pad{i} = interpolate(f, [{i}, {i + 20}], [0, 1]);" for i in range(40)
)


def _scene(body: str) -> str:
    return (
        "const SceneComponent = (props) => {"
        "const f = useCurrentFrame();"
        "const o = interpolate(f, [0, 20], [0, 1]);"
        "const sp = spring({ frame: f, fps: 30 });"
        "const isPortrait = props.aspectRatio === 'portrait';\n" + _PAD + "\n"
        "return (<AbsoluteFill style={{ overflow: 'hidden',"
        " overflowWrap: 'break-word', minWidth: 0,"
        " fontFamily: props.bodyFont || 'inherit' }}>"
        "<FitText fontSize={props.titleFontSize ?? 64}>{props.displayText}</FitText>"
        "<span style={{ fontFamily: props.headingFont || 'inherit' }}>{props.sceneTitle}</span>"
        "{props.logoUrl && <Img src={props.logoUrl} />}"
        "{props.imageUrl && <div data-content-img><Img src={props.imageUrl} /></div>}"
        + body +
        "</AbsoluteFill>); };"
    )


def _check(code: str):
    return validate_component_code(code, scene_type="content", collect_all=True)


def test_hardcoded_body_sizes_without_the_prop_are_rejected():
    code = _scene(
        "{(props.bullets ?? []).slice(0, isPortrait ? 3 : 4).map((b, i) => ("
        "  <p key={i} style={{ fontSize: 32 }}>{b}</p>))}"
        "<span style={{ fontSize: 24 }}>note</span>"
    )
    ok, err = _check(code)
    assert not ok
    assert "descriptionFontSize" in err


def test_reading_the_prop_passes():
    code = _scene(
        "{(props.bullets ?? []).slice(0, isPortrait ? 3 : 4).map((b, i) => ("
        "  <p key={i} style={{ fontSize: (props.descriptionFontSize ?? 34) * 0.9 }}>{b}</p>))}"
        "<span style={{ fontSize: (props.descriptionFontSize ?? 34) * 0.7 }}>note</span>"
    )
    ok, err = _check(code)
    assert ok, err


def test_delegating_to_statgrid_passes_without_any_literal_size():
    """A scene that hands its content to the kit has no sizes of its own."""
    code = _scene(
        "<StatGrid items={props.metrics} />"
    )
    ok, err = _check(code)
    assert ok, err


def test_a_single_literal_size_is_not_enough_to_reject():
    """Deliberately narrow: one incidental literal must not fail a scene."""
    code = _scene(
        "{(props.bullets ?? []).slice(0, isPortrait ? 3 : 4).map((b, i) => ("
        "  <p key={i} style={{ fontSize: 32 }}>{b}</p>))}"
    )
    ok, err = _check(code)
    assert ok, err


def test_eyebrow_and_display_sizes_are_outside_the_gated_band():
    """18px eyebrows and 90px numerals are legitimately fixed."""
    code = _scene(
        "<span style={{ fontSize: 18 }}>LABEL</span>"
        "<span style={{ fontSize: 96 }}>12</span>"
        "{(props.bullets ?? []).slice(0, isPortrait ? 3 : 4).map((b, i) => (<p key={i}>{b}</p>))}"
    )
    ok, err = _check(code)
    assert ok, err
