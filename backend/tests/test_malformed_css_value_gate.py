"""A stray comma inside a CSS string value is valid JavaScript and invalid CSS.

Template custom_203's "versus" scene shipped:

    minHeight: 0, position: 'relative,',

The comma is INSIDE the quotes. `_parse_check` passes it — it is a perfectly
legal JS string — but `'relative,'` is not a valid CSS value, so the browser
discards the entire declaration (CSS Cascade §4.1). The flex container fell back
to `position: static`, its content area collapsed, and the scene rendered its
SIDE A / SIDE B headings and VERSUS divider over empty space — identically in the
project preview, the template preview and the exported MP4, because all three
execute the same stored component code.

No existing gate could catch it: the defect is legal in the host language and
only wrong in the embedded one.

The fixture is a REAL generated scene rather than a hand-written stub, so it
satisfies every other hard gate by construction and these assertions isolate the
CSS rule instead of drifting whenever an unrelated contract changes.
"""
from __future__ import annotations

import re

import pytest

from app.services.code_validator import validate_component_code

_DOC = "IMAGE — NONE\n"

# A minimal scene that passes today's gates: reads both type sizes, binds both
# fonts, wraps its headline in FitText, animates, clips, and renders the logo.
_GOOD = """const SceneComponent = (props) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const o = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const s = spring({ frame, fps: 30, from: 0, to: 1 });
  const titleSize = props.titleFontSize ?? 68;
  const bodySize = props.descriptionFontSize ?? 34;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: props.brandColors.background }}>
      <div style={{ flex: 1, display: 'flex', minHeight: 0, __STYLE__ }}>
        <FitText fontSize={titleSize} minFontSize={24} maxLines={2}
          containerWidth={width * 0.8} maxHeight={height * 0.3}
          style={{ fontFamily: props.headingFont || 'inherit', opacity: o }}>
          {props.sceneTitle}
        </FitText>
        <div style={{ fontFamily: props.bodyFont || 'inherit', fontSize: bodySize, opacity: s }}>
          {props.displayText}
        </div>
      </div>
      {props.logoUrl && typeof props.logoUrl === 'string' && (
        <Img src={props.logoUrl} data-logo="1" style={{ width: 190 }} />
      )}
    </AbsoluteFill>
  );
};
"""


def _scene(style: str) -> str:
    return _GOOD.replace("__STYLE__", style)


def test_the_fixture_itself_is_valid() -> None:
    """Guards the guard: if the baseline failed some unrelated gate, every
    assertion below would pass for the wrong reason."""
    ok, err = validate_component_code(_scene("position: 'relative'"), scene_type="content", scene_doc=_DOC)
    assert ok, err


def test_a_trailing_comma_inside_a_css_value_is_rejected() -> None:
    ok, err = validate_component_code(
        _scene("position: 'relative,'"), scene_type="content", scene_doc=_DOC
    )
    assert not ok
    assert "Malformed CSS value" in (err or "")
    assert "position" in (err or "")


@pytest.mark.parametrize("prop,bad", [
    ("display", "'flex,'"),
    ("textAlign", "'center,'"),
    ("overflow", "'hidden;'"),
    ("alignItems", "'center,'"),
])
def test_it_catches_the_class_not_just_position(prop: str, bad: str) -> None:
    ok, err = validate_component_code(
        _scene(f"{prop}: {bad}"), scene_type="content", scene_doc=_DOC
    )
    assert not ok, f"{prop}: {bad} should be rejected"
    assert "Malformed CSS value" in (err or "")


@pytest.mark.parametrize("style", [
    "boxShadow: '0 1px 2px rgba(0,0,0,0.2)'",
    "transition: 'opacity 0.3s, transform 0.3s'",
    "position: 'relative'",
    "display: 'flex'",
])
def test_legitimate_css_is_not_flagged(style: str) -> None:
    """Commas are normal INSIDE font stacks and transitions — the rule must fire
    only on a value that ENDS with one."""
    ok, err = validate_component_code(_scene(style), scene_type="content", scene_doc=_DOC)
    assert ok, f"{style} was wrongly rejected: {err}"


# ── Self-closing <FitText /> ────────────────────────────────────────────────
#
# The same "versus" scene also shipped `<FitText ... />` with no children for
# BOTH of its text slots. FitText paints its children and has no text prop, so
# each was a correctly-sized, correctly-styled, permanently EMPTY box — the
# label and description were passed into the render helper and never rendered.
# It parses, it has geometry, it binds its fonts, so every existing gate passed
# it, and the scene drew its kickers and divider over blank space in all three
# surfaces at once.


def test_a_self_closing_fittext_is_rejected() -> None:
    code = _GOOD.replace("__STYLE__", "position: 'relative'").replace(
        ">\n          {props.sceneTitle}\n        </FitText>", " />"
    )
    # The replacement must actually have produced the self-closing form,
    # otherwise this would assert nothing.
    assert re.search(r"<FitText[^>]*/>", code), "fixture did not become self-closing"
    ok, err = validate_component_code(code, scene_type="content", scene_doc=_DOC)
    assert not ok
    assert "self-closing" in (err or "")


def test_a_fittext_with_children_passes() -> None:
    ok, err = validate_component_code(
        _scene("position: 'relative'"), scene_type="content", scene_doc=_DOC
    )
    assert ok, err
