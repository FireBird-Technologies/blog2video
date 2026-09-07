"""A scene must survive having NO image, because that state really happens.

`props.imageUrl` is absent in two ordinary situations:

  * stock footage — a clip is painted behind the scene, and the render path
    must not hand a video URL to <Img> (it cancelRender()s), so imageUrl is
    null and hasVideo is true;
  * the template editor's own preview, which has no project imagery at all.

The runtime gate always passed a populated imageUrl, so a scene that read
THROUGH the URL — `props.imageUrl.split('.')`, `.endsWith(...)`, `new URL(...)`
— rendered perfectly here and threw a TypeError in the browser the moment it
met the state the contract requires it to survive. That is how a "Stage Image"
scene crashed the editor's Remotion player with the component-stack ending at
`SceneComponent`, leaving a blank pane and a warning triangle.

These run the real harness, so they are skipped without @babel/standalone —
the gate fails open there and would prove nothing. Same convention as
test_scene_runtime_check.py.
"""
from __future__ import annotations

import pytest

from app.services.scene_runtime_check import (
    _babel_path,
    _sample_props,
    runtime_check_scene,
)

pytestmark = pytest.mark.skipif(
    _babel_path() is None,
    reason="no @babel/standalone in frontend/node_modules — runtime check fails open",
)


def _scene(body: str) -> str:
    """A scene whose only interesting property is how it treats imageUrl."""
    return (
        "const SceneComponent = (props) => {\n"
        "  const { width, height } = useVideoConfig();\n"
        f"  {body}\n"
        "  return (\n"
        "    <AbsoluteFill style={{backgroundColor: props.brandColors.background}}>\n"
        "      <div data-content-img=\"1\" style={{width: width*0.5, height: height*0.5}} />\n"
        "      <div style={{fontSize: props.titleFontSize}}>{props.sceneTitle}</div>\n"
        "      <div style={{fontSize: props.descriptionFontSize}}>{props.displayText}</div>\n"
        "    </AbsoluteFill>\n"
        "  );\n"
        "};"
    )


# ─── the props themselves ────────────────────────────────────────────────────


def test_the_no_image_state_is_internally_consistent():
    """The flags must agree with the data, or the state tests nothing: a scene
    that branches on hasImage would take the with-image path and never reach
    the dereference this state exists to catch."""
    p = _sample_props(with_image=False)
    assert p["imageUrl"] is None
    assert p["hasImage"] is False
    assert p["hasVideo"] is True


def test_the_with_image_state_still_supplies_a_url():
    p = _sample_props(with_image=True)
    assert isinstance(p["imageUrl"], str) and p["imageUrl"]
    assert p["hasImage"] is True
    assert p["hasVideo"] is False


# ─── the gate ────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "body",
    [
        "const ext = props.imageUrl.split('.').pop();",
        "const isPng = props.imageUrl.endsWith('.png');",
        "const host = new URL(props.imageUrl).hostname;",
        "const n = props.imageUrl.length;",
    ],
)
def test_reading_through_imageurl_unguarded_is_rejected(body: str):
    """The reported crash, in each shape the prompt now names."""
    ok, err = runtime_check_scene(_scene(body), content_type="plain")
    assert not ok
    assert "NO IMAGE" in (err or ""), err


def test_the_rejection_explains_the_state_and_the_fix():
    """A repair prompt that does not say WHICH state failed sends the model
    rewriting the branch that already worked."""
    ok, err = runtime_check_scene(
        _scene("const ext = props.imageUrl.split('.').pop();"), content_type="plain"
    )
    assert not ok
    assert "props.imageUrl is null" in err
    assert "hasVideo" in err
    assert "data-content-img" in err


@pytest.mark.parametrize(
    "body",
    [
        "const ext = props.imageUrl ? props.imageUrl.split('.').pop() : '';",
        "const ext = (props.imageUrl ?? '').split('.').pop();",
        "const ext = props.imageUrl?.split('.')?.pop();",
        "const ext = '';",
    ],
)
def test_a_guarded_read_is_accepted(body: str):
    """The gate must not simply ban the prop — guarded access is the fix, so it
    has to pass, or the model has no way to satisfy the rule."""
    ok, err = runtime_check_scene(_scene(body), content_type="plain")
    assert ok, err


def test_a_scene_that_never_touches_imageurl_is_unaffected():
    ok, err = runtime_check_scene(_scene("const unused = 1;"), content_type="plain")
    assert ok, err


def test_an_image_only_scene_still_passes_both_states():
    """The normal shape: render the <Img> when there is one, leave the slot
    empty for the clip when there is not."""
    code = (
        "const SceneComponent = (props) => {\n"
        "  const { width, height } = useVideoConfig();\n"
        "  return (\n"
        "    <AbsoluteFill style={{backgroundColor: props.brandColors.background}}>\n"
        "      <div data-content-img=\"1\" style={{width: width*0.5, height: height*0.5}}>\n"
        "        {props.imageUrl ? <Img src={props.imageUrl} /> : null}\n"
        "      </div>\n"
        "      <div style={{fontSize: props.titleFontSize}}>{props.sceneTitle}</div>\n"
        "      <div style={{fontSize: props.descriptionFontSize}}>{props.displayText}</div>\n"
        "    </AbsoluteFill>\n"
        "  );\n"
        "};"
    )
    ok, err = runtime_check_scene(code, content_type="plain")
    assert ok, err


# ─── the prompt states the rule it is gated on ───────────────────────────────


def test_the_prompt_warns_against_the_unguarded_read():
    """A contract the model is rejected for but never told about is the
    unsatisfiable-gate bug this codebase has hit before."""
    import inspect

    from app.services.code_generator import GenerateSceneCode

    doc = inspect.cleandoc(GenerateSceneCode.__doc__ or "")
    assert "THROUGH it" in doc
    assert "imageUrl" in doc
