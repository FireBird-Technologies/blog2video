"""Text must FIT the frame — the gates that guarantee it.

Two scenes shipped with text running off the canvas: a stat value that collided
with its own suffix ("3.2M+12" with "%" wrapped below), and a quote clipped
mid-sentence. Neither tripped anything, because the only hard fit gate was
scoped to `props.displayText` and neither scene reads it.

These pin the three gates added in response. The false-positive direction
matters as much as the true-positive one: a gate that rejects correct code burns
the scene's repair budget, which is what the contrast gate did before it was
narrowed.
"""
from __future__ import annotations

import re

import pytest

from app.services.code_validator import validate_component_code

# Long enough to clear the "code too short" heuristic, so these tests exercise
# the gate under test rather than a length check.
_PAD = "\n".join(f"const pad{i} = interpolate(f, [{i}, {i + 20}], [0, 1]);" for i in range(40))


def _scene(body: str, *, headline: bool = True) -> str:
    head = (
        "<FitText fontSize={props.titleFontSize ?? 64}>{props.displayText}</FitText>"
        if headline
        else ""
    )
    return (
        "const SceneComponent = (props) => {"
        "const f = useCurrentFrame();"
        "const o = interpolate(f, [0, 20], [0, 1]);"
        "const sp = spring({ frame: f, fps: 30 });"
        "const isPortrait = props.aspectRatio === 'portrait';\n" + _PAD + "\n"
        # headingFont/bodyFont satisfy the font-binding gates, and sceneTitle
        # gives a non-narration text node — none of which is what these tests
        # are about, but all of which the validator (correctly) requires.
        "return (<AbsoluteFill style={{ overflow: 'hidden', background: palette.bg,"
        " overflowWrap: 'break-word', minWidth: 0,"
        " fontFamily: props.bodyFont || 'inherit' }}>"
        "<span style={{ fontFamily: props.headingFont || 'inherit' }}>{props.sceneTitle}</span>"
        "{props.logoUrl && <Img src={props.logoUrl} />}"
        "{props.imageUrl && <div data-content-img><Img src={props.imageUrl} /></div>}"
        + head + body +
        "</AbsoluteFill>); };"
    )


def _fails_on(code: str, needle: str) -> bool:
    ok, err = validate_component_code(code, scene_type="content", collect_all=True)
    return not ok and needle.lower() in (err or "").lower()


# ── props.quote ──────────────────────────────────────────────────────────────


def test_a_bare_quote_is_rejected() -> None:
    """The shipped defect: a quote at a literal fontSize cannot shrink, so long
    copy runs past the frame and is clipped by the root's overflow:hidden."""
    assert _fails_on(
        _scene("<div style={{ fontSize: 64, fontStyle: 'italic' }}>{props.quote}</div>"),
        "props.quote",
    )


def test_a_bare_quote_is_rejected_even_beside_a_FITTED_headline() -> None:
    """The realistic shape, and why the check is by PROXIMITY not file-wide: a
    correct <FitText> headline would otherwise satisfy a file-wide search and
    let the bare quote through."""
    assert _fails_on(
        _scene("<p style={{ fontSize: 72 }}>{props.quote}</p>", headline=True),
        "props.quote",
    )


@pytest.mark.parametrize(
    "body",
    [
        "<FitText maxLines={4} maxHeight={420}>{props.quote}</FitText>",
        '<RevealText text={props.quote} mode="line" />',
    ],
)
def test_a_fitted_quote_passes(body: str) -> None:
    ok, err = validate_component_code(_scene(body), scene_type="content", collect_all=True)
    assert ok, err


# ── props.metrics ────────────────────────────────────────────────────────────


def test_hand_rolled_numerals_are_rejected() -> None:
    assert _fails_on(
        _scene(
            "{isPortrait ? null : null}"
            "<div>{props.metrics.slice(0, 4).map((m, i) => ("
            "<span key={i} style={{ fontSize: 96 }}>{m.value}</span>))}</div>"
        ),
        "props.metrics",
    )


@pytest.mark.parametrize(
    "body",
    [
        '<StatGrid items={props.metrics} arrangement="ledger" />',
        "<MetricRow items={props.metrics} />",
    ],
)
def test_metrics_through_the_kit_pass(body: str) -> None:
    """StatGrid/MetricRow size each numeral to its own cell and branch on
    orientation internally, so they satisfy both the fit and the arrangement
    gate at once."""
    ok, err = validate_component_code(_scene(body), scene_type="content", collect_all=True)
    assert ok, err


# ── orientation ──────────────────────────────────────────────────────────────


def test_a_list_scene_must_adapt_to_the_aspect_ratio() -> None:
    """A landscape scene showed two stats stacked vertically — the portrait
    shape used in the wrong orientation. This was a -0.15 score nudge a scene
    could buy back, so it shipped."""
    body = (
        "<FitText>{props.bullets.join(' ')}</FitText>"
        "<div>{props.bullets.map((b, i) => (<p key={i}>{b}</p>))}</div>"
    )
    code = _scene(body).replace("const isPortrait = props.aspectRatio === 'portrait';", "")
    assert _fails_on(code, "isPortrait")


def test_branching_on_isPortrait_satisfies_it() -> None:
    body = (
        "<FitText>{props.bullets.join(' ')}</FitText>"
        "<div style={{ flexDirection: isPortrait ? 'column' : 'row' }}>"
        "{props.bullets.map((b, i) => (<p key={i}>{b}</p>))}</div>"
    )
    ok, err = validate_component_code(_scene(body), scene_type="content", collect_all=True)
    assert ok, err


def test_a_scene_with_no_list_is_not_forced_to_branch() -> None:
    """A centred headline reads the same in both orientations. Forcing it to
    branch would be a gate failing correct code."""
    code = _scene("<p style={{ fontSize: 32 }}>{props.displayText}</p>").replace(
        "const isPortrait = props.aspectRatio === 'portrait';", ""
    )
    ok, err = validate_component_code(code, scene_type="content", collect_all=True)
    assert ok, err
