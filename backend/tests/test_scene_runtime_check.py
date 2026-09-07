"""Level-2 runtime gate: the two crashes it used to wave through.

Both defects below reached the browser on template 186 and blanked the custom
preview, despite passing every static contract AND this runtime check — because
the harness was permissive in exactly the two places that mattered:

  * `spring` was stubbed `() => 1`, ignoring its argument, so a scene that never
    destructured `fps` from useVideoConfig() passed here and then threw
    Remotion's `"fps" must be a number` on its first frame.
  * `ctaProps` was never stubbed at all, so on the ending scene
    `(props.ctaProps?.socials ?? []).map(...)` hit the `?? []` fallback and drew
    fine — hiding that `socials` is an object MAP until a real project supplied
    its handles and the scene threw "socials.map is not a function".

These tests fail OPEN the same way the module does: without a node/babel
toolchain `runtime_check_scene` returns (True, None), so they skip rather than
report a false failure.
"""
from __future__ import annotations

import pytest

from app.services.code_validator import _design_doc_defects
from app.services.scene_runtime_check import _babel_path, runtime_check_scene

pytestmark = pytest.mark.skipif(
    _babel_path() is None,
    reason="no @babel/standalone in frontend/node_modules — runtime check fails open",
)


def _scene(body: str) -> str:
    """A minimal scene that draws something, so failures are the body's fault."""
    return (
        "const SceneComponent = (props) => {"
        "const frame = useCurrentFrame();"
        f"{body}"
        "return <AbsoluteFill style={{backgroundColor: props.brandColors.background}}>"
        "<div style={{fontSize: 90, color: props.brandColors.text}}>{props.displayText}</div>"
        "{extra}</AbsoluteFill>; };"
    )


# ─── spring() argument validation ────────────────────────────────────────────


def test_spring_with_undefined_fps_is_caught() -> None:
    """`fps` in scope but undefined — the exact template 186 crash.

    A bare `fps` would be a ReferenceError any stub catches. This is the harder
    case the `() => 1` stub could not see: the name resolves, to undefined.
    """
    code = _scene(
        "const { fps } = props;"
        "const s = spring({ frame, fps });"
        "const extra = <div style={{opacity: s}}>x</div>;"
    )
    ok, err = runtime_check_scene(code, role="content")
    assert ok is False
    assert "fps" in err
    # The message must name the fix, not merely the symptom.
    assert "useVideoConfig" in err


def test_spring_with_real_fps_passes() -> None:
    code = _scene(
        "const { fps } = useVideoConfig();"
        "const s = spring({ frame, fps });"
        "const extra = <div style={{opacity: s}}>x</div>;"
    )
    assert runtime_check_scene(code, role="content") == (True, None)


# ─── ctaProps / socials shape ────────────────────────────────────────────────


_SOCIALS_AS_ARRAY = (
    "const socials = props.ctaProps?.socials;"
    "const extra = <div>{(socials ?? []).map((s, i) => <span key={i}>{s.label}</span>)}</div>;"
)


def test_socials_mapped_as_array_is_caught_on_outro() -> None:
    ok, err = runtime_check_scene(_scene(_SOCIALS_AS_ARRAY), role="outro")
    assert ok is False
    assert "map is not a function" in err


def test_socials_bug_needs_the_cta_stub_to_surface() -> None:
    """Guards the stub itself: with no ctaProps the `?? []` fallback hides it.

    If this ever starts failing because the content role also stubs ctaProps,
    that is fine — but the outro test above must keep passing either way.
    """
    assert runtime_check_scene(_scene(_SOCIALS_AS_ARRAY), role="content") == (True, None)


def test_outro_must_render_without_any_cta() -> None:
    """Previews and CTA-less projects pass no ctaProps; the scene must still draw."""
    code = "const SceneComponent = (props) => { if (!props.ctaProps) return null; " \
           "return <AbsoluteFill><div style={{fontSize: 90}}>{props.displayText}</div></AbsoluteFill>; };"
    ok, err = runtime_check_scene(code, role="outro")
    assert ok is False
    assert "NO CTA configured" in err


# ─── Sub-components defined by the scene ─────────────────────────────────────


_HELPER_USING_OUTER_PROPS = """
const BulletRow = ({ text }) => {
  return <div style={{ color: props.brandColors.text, fontSize: 34 }}>{text}</div>;
};
const SceneComponent = (props) => {
  const items = (props.bullets ?? []).slice(0, 4);
  return <AbsoluteFill style={{backgroundColor: props.brandColors.background}}>
    <div style={{fontSize: 90, color: props.brandColors.text}}>{props.displayText}</div>
    <div>{items.map((b, i) => <BulletRow key={i} text={b} />)}</div>
  </AbsoluteFill>;
};
"""


def test_helper_component_reading_outer_props_is_caught() -> None:
    """A sub-component referencing the scene's `props` — template 191's crash.

    `props` is not in the helper's scope, so this throws "props is not defined"
    on the first frame. The harness only saw it once createElement began CALLING
    function-typed children: before that the helper was constructed, never run.
    """
    ok, err = runtime_check_scene(
        _HELPER_USING_OUTER_PROPS, content_type="bullets", role="content"
    )
    assert ok is False
    assert "props is not defined" in err


def test_helper_component_taking_real_params_passes() -> None:
    """The corrected form — values threaded in as params — must still pass."""
    code = (
        _HELPER_USING_OUTER_PROPS.replace("({ text }) => {", "({ text, colors }) => {")
        .replace("props.brandColors.text, fontSize: 34", "colors.text, fontSize: 34")
        .replace(
            "<BulletRow key={i} text={b} />",
            "<BulletRow key={i} text={b} colors={props.brandColors} />",
        )
    )
    assert runtime_check_scene(code, content_type="bullets", role="content") == (True, None)


def test_recursive_helper_terminates() -> None:
    """The depth guard must stop a self-rendering helper cleanly.

    Without it the recursive descent blows the stack, turning any defect in such
    a scene into an unreadable RangeError (or a harness timeout).
    """
    code = (
        "const Row = ({ n }) => <div><Row n={n+1} /></div>;"
        "const SceneComponent = (props) => ("
        "<AbsoluteFill style={{backgroundColor: props.brandColors.background}}>"
        "<div style={{fontSize:90}}>{props.displayText}</div><Row n={0} /></AbsoluteFill>);"
    )
    ok, err = runtime_check_scene(code, role="content")
    # The tree is legal, so this passes — the point is that it RETURNS at all.
    assert ok is True, err


# ─── Static gate (cheaper than a harness round-trip) ─────────────────────────


def test_static_gate_rejects_array_ops_on_socials() -> None:
    code = (
        "const SceneComponent = (props) => {"
        "const socials = props.ctaProps?.socials;"
        "return <AbsoluteFill><SocialIcons socials={props.ctaProps?.socials}/>"
        "<div>{(socials ?? []).map(s => <span>{s.label}</span>)}</div>"
        "<div>{(props.ctaProps?.ctas ?? []).map(c => <b>{c.ctaButtonText}</b>)}</div>"
        "</AbsoluteFill>; };"
    )
    defects = _design_doc_defects(code, "outro", "THIS SCENE")
    assert any("OBJECT map keyed by platform" in d for d in defects)


def test_static_gate_allows_mapping_ctas() -> None:
    """`ctas` genuinely IS an array — the gate must not overreach onto it."""
    code = (
        "const SceneComponent = (props) => {"
        "return <AbsoluteFill><SocialIcons socials={props.ctaProps?.socials}/>"
        "<div>{(props.ctaProps?.ctas ?? []).map(c => <b>{c.ctaButtonText}</b>)}</div>"
        "</AbsoluteFill>; };"
    )
    assert _design_doc_defects(code, "outro", "THIS SCENE") == []


# ─── Geometry pass ───────────────────────────────────────────────────────────
#
# The harness proved a scene RUNS; it did not prove the result FITS, and "text
# still overflows sometimes" was the standing report. There is no DOM here, so
# the pass is deliberately narrow: it fires only on explicit absolute numbers
# the scene itself wrote into its style object, never on anything that depends
# on flow layout. Measured against 411 stored scenes it produced zero findings,
# which is the property that matters — a false positive sends a healthy scene
# into a repair loop that can only make it worse.


def _geo_scene(body: str) -> str:
    return (
        "const SceneComponent = (props) => {"
        "const frame = useCurrentFrame();"
        "const { width, height } = useVideoConfig();"
        "const enter = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp'});"
        "const y = spring({frame, fps: 30});"
        "return <AbsoluteFill style={{backgroundColor: props.brandColors.background, "
        "overflow: 'hidden'}}>"
        "<div style={{fontSize: 90, color: props.brandColors.text}}>{props.displayText}</div>"
        f"{body}"
        "</AbsoluteFill>; };"
    )


def test_an_absolute_box_past_the_right_edge_is_reported() -> None:
    code = _geo_scene(
        "<div style={{position: 'absolute', left: 1700, top: 100, "
        "width: 600, height: 200}}>off frame</div>"
    )
    ok, err = runtime_check_scene(code, aspect_ratio="landscape")
    assert ok is False
    assert "past the 1920px frame edge" in err


def test_an_absolute_box_past_the_bottom_is_reported() -> None:
    code = _geo_scene(
        "<div style={{position: 'absolute', left: 40, top: 900, "
        "width: 300, height: 400}}>below frame</div>"
    )
    ok, err = runtime_check_scene(code, aspect_ratio="landscape")
    assert ok is False
    assert "past the 1080px frame bottom" in err


def test_nowrap_copy_too_wide_for_its_fixed_box_is_reported() -> None:
    """The "breaks mid-word" defect: a fixed box that cannot hold its own copy."""
    code = _geo_scene(
        "<div style={{width: 300, fontSize: 64, whiteSpace: 'nowrap'}}>"
        "{props.displayText}</div>"
    )
    ok, err = runtime_check_scene(code, aspect_ratio="landscape")
    assert ok is False
    assert "breaks mid-word" in err


def test_a_box_inside_the_frame_is_not_reported() -> None:
    code = _geo_scene(
        "<div style={{position: 'absolute', left: 100, top: 100, "
        "width: 600, height: 200}}>in frame</div>"
    )
    ok, err = runtime_check_scene(code, aspect_ratio="landscape")
    assert ok is True, err


def test_percentage_geometry_is_left_alone() -> None:
    """Percentages are flow layout, which this pass cannot and must not judge."""
    code = _geo_scene(
        "<div style={{position: 'absolute', left: '80%', top: '10%', "
        "width: '40%', height: '30%'}}>fluid</div>"
    )
    ok, err = runtime_check_scene(code, aspect_ratio="landscape")
    assert ok is True, err


def test_long_copy_inside_a_fittext_is_left_alone() -> None:
    """Inside a FitText the size is negotiable by design — that is the whole
    point of the component, so flagging it would invert the contract."""
    code = _geo_scene(
        "<FitText fontSize={200} containerWidth={300} maxHeight={200} "
        "style={{whiteSpace: 'nowrap'}}>{props.displayText}</FitText>"
    )
    ok, err = runtime_check_scene(code, aspect_ratio="landscape")
    assert ok is True, err


def test_wrapping_copy_is_left_alone() -> None:
    """Without nowrap the text wraps, so a narrow box is not a defect."""
    code = _geo_scene(
        "<div style={{width: 300, fontSize: 64}}>{props.displayText}</div>"
    )
    ok, err = runtime_check_scene(code, aspect_ratio="landscape")
    assert ok is True, err


# ─── geometry: a transform moves the box ─────────────────────────────────────


def test_a_transform_shifted_box_is_not_reported_off_canvas() -> None:
    """`left + width` is not where a transformed box actually lands.

    The geometry pass has no DOM and cannot evaluate a transform, so it read
    `left:1400 + width:764` and reported "runs to 2164px, past the 1920px frame
    edge" — while `translateX(-100%)` means the box truly ends at 1400px. Both
    canonical idioms hit this: right-anchoring as above, and centring with
    `left:'50%'` + `translateX(-50%)`.

    Observed in production on template 198. This file's own header records why
    the miss is the cheaper error: a false positive sends a healthy scene into a
    repair loop that can only make it worse.
    """
    code = (
        "const SceneComponent = (props) => {"
        "const frame = useCurrentFrame();"
        "return <AbsoluteFill style={{backgroundColor: props.brandColors.background}}>"
        "<div style={{position: 'absolute', left: 1400, width: 764, height: 200,"
        " transform: 'translateX(-100%)'}}>"
        "<span style={{fontSize: 40, color: props.brandColors.text}}>{props.displayText}</span>"
        "</div>"
        "</AbsoluteFill>; };"
    )
    ok, err = runtime_check_scene(code, role="content")
    assert ok, err


def test_an_untransformed_box_off_canvas_is_still_reported() -> None:
    """The counterpart — skipping transformed boxes must not blind the check."""
    code = (
        "const SceneComponent = (props) => {"
        "const frame = useCurrentFrame();"
        "return <AbsoluteFill style={{backgroundColor: props.brandColors.background}}>"
        "<div style={{position: 'absolute', left: 1400, width: 764, height: 200}}>"
        "<span style={{fontSize: 40, color: props.brandColors.text}}>{props.displayText}</span>"
        "</div>"
        "</AbsoluteFill>; };"
    )
    ok, err = runtime_check_scene(code, role="content")
    assert not ok
    assert "frame edge" in (err or ""), err
