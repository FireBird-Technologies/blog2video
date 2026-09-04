"""A scene must read the structured prop its own content_type fills.

GeneratedVideo.tsx passes exactly ONE structured prop per scene, chosen by that
scene's content_type. A scene that reads a different one gets `undefined`, falls
through to its own empty-array branch, and renders a blank frame — while passing
every other check, because the code is perfectly valid JS.

That is not hypothetical. Template 179's `steps` scene read props.bullets and
shipped 7,782 characters of valid, compiling, fully-validated code that drew
NOTHING. Its `metrics` scene had the same defect. Six sibling scenes on the same
template read their prop correctly, which is why the false-positive direction is
pinned here too: this gate runs on the generation path and a spurious rejection
burns a scene's repair budget.
"""
from __future__ import annotations

from app.services.code_generator import _format_scene_doc
from app.services.code_validator import _design_doc_defects

_EMPTY_FRAME = "EMPTY FRAME"


def _doc(content_type: str) -> str:
    return _format_scene_doc(
        {
            "id": "scene",
            "doc": "A design.",
            "content_type": content_type,
            "supports_image": False,
        }
    )


def _gated(code: str, content_type: str) -> bool:
    msgs = _design_doc_defects(code, "content", _doc(content_type))
    return any(_EMPTY_FRAME in m for m in msgs)


# ── the true positives ───────────────────────────────────────────────────────


def test_a_steps_scene_reading_bullets_is_rejected() -> None:
    """The exact shipped defect: content_type `steps`, but the code reads
    props.bullets, so the render path leaves it undefined and the frame is
    blank."""
    assert _gated("const items = (props.bullets ?? []).slice(0, 4);", "steps")


def test_a_metrics_scene_reading_bullets_is_rejected() -> None:
    """Template 179's other broken scene."""
    assert _gated("const items = (props.bullets ?? []).slice(0, 3);", "metrics")


def test_a_scene_reading_no_structured_prop_at_all_is_rejected() -> None:
    """Splitting displayText is the fallback, never the only source — the
    structured prop is where the real content lives."""
    assert _gated("const items = props.displayText.split('. ');", "timeline")


# ── the false-positive direction ─────────────────────────────────────────────


def test_each_content_type_accepts_its_own_prop() -> None:
    for ctype, prop in (
        ("bullets", "bullets"),
        ("steps", "steps"),
        ("metrics", "metrics"),
        ("timeline", "timelineItems"),
        ("quote", "quote"),
        ("code", "codeLines"),
    ):
        assert not _gated(f"const v = props.{prop};", ctype), ctype


def test_a_comparison_scene_reading_the_left_side_passes() -> None:
    """comparison fills a PAIR; naming the left side is enough to prove the
    scene is wired to the right data."""
    assert not _gated(
        "const l = props.comparisonLeft; const r = props.comparisonRight;",
        "comparison",
    )


def test_a_plain_scene_is_never_gated() -> None:
    """`plain` fills no structured prop, so there is nothing to require — the
    bookend scenes (intro/outro) are all plain."""
    assert not _gated("const t = props.displayText;", "plain")


# ── object-shaped props must be read by FIELD ────────────────────────────────


def _obj_gated(code: str, content_type: str) -> bool:
    msgs = _design_doc_defects(code, "content", _doc(content_type))
    return any("object Object" in m for m in msgs)


_PAD = "\n".join(f"const p{i} = interpolate(frame,[{i},{i+20}],[0,1]);" for i in range(6))


def _metrics_scene(body: str) -> str:
    """The alias chain template 181 actually used: props.metrics -> metricsRaw
    -> metrics -> items -> .map(item). A gate anchored on `props.metrics` sees
    none of it."""
    return (
        "const SceneComponent = (props) => {"
        "const frame = useCurrentFrame();"
        "const isPortrait = props.aspectRatio === 'portrait';"
        "const metricsRaw = props.metrics ?? [];"
        "const metrics = metricsRaw.slice(0, isPortrait ? 3 : 4);"
        "const items = metrics.length > 0 ? metrics : [];\n" + _PAD + "\n"
        "return (<AbsoluteFill>" + body + "</AbsoluteFill>); };"
    )


def test_rendering_a_metrics_item_whole_is_rejected() -> None:
    """The shipped defect: template 181's Figures scene wrote `{String(item)}`
    over props.metrics and painted "[object Object]" four times across the
    frame. It passed every other check — String(obj) neither throws nor yields
    an empty tree, the only two things the runtime check can see."""
    assert _obj_gated(
        _metrics_scene("{items.map((item, i) => (<div key={i}>{String(item)}</div>))}"),
        "metrics",
    )


def test_a_bare_item_render_is_rejected() -> None:
    assert _obj_gated(
        _metrics_scene("{items.map((item, i) => (<div key={i}>{item}</div>))}"),
        "metrics",
    )


def test_string_methods_on_the_item_are_rejected() -> None:
    """`item.split(...)` on an object is the same mistake one step later."""
    assert _obj_gated(
        _metrics_scene(
            "{items.map((item, i) => (<div key={i}>{item.split(' ')[0]}</div>))}"
        ),
        "metrics",
    )


def test_reading_a_field_passes() -> None:
    """The correct shape must NOT trip — a gate that fails valid code burns the
    scene's whole repair budget."""
    assert not _obj_gated(
        _metrics_scene(
            "{items.map((item, i) => (<div key={i}>{item.value}{item.label}</div>))}"
        ),
        "metrics",
    )


def test_string_arrays_are_never_object_gated() -> None:
    """bullets/steps ARE string[] — rendering the item whole is correct there."""
    for ctype, prop in (("bullets", "bullets"), ("steps", "steps")):
        code = (
            "const SceneComponent = (props) => {"
            "const frame = useCurrentFrame();"
            f"const items = (props.{prop} ?? []).slice(0, 4);\n" + _PAD + "\n"
            "return (<AbsoluteFill>"
            "{items.map((item, i) => (<div key={i}>{item}</div>))}"
            "</AbsoluteFill>); };"
        )
        assert not _obj_gated(code, ctype), ctype
