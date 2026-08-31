"""One theme per template, and a scene set that actually differs per brand.

Two failures reported from a real generated template:

  * its scenes each had a DIFFERENT background, so one template read as several
    themes. That was not carelessness — the scene prompt literally instructed it
    ("VARY it scene-to-scene. Some scenes SHOULD go DARK / INVERTED"), and
    nothing anywhere required a scene to use the brand canvas.
  * its typography varied between layouts, because the font gate only understood
    `fontFamily:` with a literal value and several other forms slipped past.

And a third, structural one: templates kept shipping the same SCENE SET even
when their blueprints differed, because every divergence mechanism moved the
template's skin (chrome, decor, era, bookends) and none moved the layouts.

The cross-scene checks here are the first in the pipeline that can see more than
one scene at once — `validate_component_code` and `_score_valid_scene` both take
a single `code: str`, which is why "these scenes disagree with each other" was
previously unrepresentable.
"""
from __future__ import annotations

import pytest

from app.services.code_generator import (
    CODE_CRITIC_THRESHOLD,
    detect_canvas_drift,
    detect_font_drift,
    scene_canvas_token,
)
from app.services.code_validator import validate_component_code

PAD = "{/*" + ("pad " * 260) + "*/}"


def _scene(root_style: str = "", body: str = "") -> str:
    """A scene that clears every OTHER gate, so a failure is attributable."""
    return (
        "const SceneComponent = (props) => {"
        "const f = useCurrentFrame();"
        "const o = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });"
        "const y = interpolate(f, [0, 20], [20, 0], { extrapolateRight: 'clamp' });"
        f"return <AbsoluteFill style={{{{overflow:'hidden'{root_style}}}}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "{props.imageUrl && <Img src={props.imageUrl} data-content-img/>}"
        "<FitText fontSize={props.titleFontSize ?? 72} "
        "style={{fontFamily: props.headingFont}}>{props.displayText}</FitText>"
        f"{body}{PAD}</AbsoluteFill>; }};"
    )


# ── the canvas ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "root_style,expected",
    [
        (", background: palette.bg", "palette.bg"),
        (", background: backgroundCss(palette)", "palette.bg"),
        ("", "palette.bg"),  # no root fill: inherits the wrapper's canvas
        (", background: palette.text", "palette.text"),  # fully inverted frame
        (", background: palette.accent", "palette.accent"),
        (", background: '#101820'", "#101820"),
    ],
)
def test_canvas_token_resolves_the_root_fill(root_style: str, expected: str) -> None:
    assert scene_canvas_token(_scene(root_style)) == expected


def test_an_inner_panel_is_not_mistaken_for_the_canvas() -> None:
    """The whole point of the change is that panels MAY be inverted.

    An earlier version of the detector matched any `<div ... background:` and
    read a sized inner panel as the frame, which would have rejected exactly the
    pattern the prompt now recommends.
    """
    code = _scene(
        "",
        "<div style={{background: palette.text, width: '54%', height: '68%'}}/>",
    )
    assert scene_canvas_token(code) == "palette.bg"


def test_an_unresolvable_canvas_is_skipped_not_guessed() -> None:
    """A false positive costs a full LLM rollout."""
    assert scene_canvas_token(_scene(", background: pickBg(props, f)")) is None


def test_a_scene_repainting_the_frame_is_penalised() -> None:
    """The per-scene half: visible on the FIRST attempt, not only cross-scene."""
    from app.services.code_generator import _score_valid_scene

    on_brand = _score_valid_scene(_scene(", background: palette.bg"), {})
    inverted = _score_valid_scene(_scene(", background: palette.text"), {})
    assert inverted == pytest.approx(on_brand - 0.2)


# ── cross-scene drift ────────────────────────────────────────────────────────


def _bg(token: str) -> str:
    return _scene(f", background: {token}")


def test_a_consistent_template_reports_no_drift() -> None:
    assert detect_canvas_drift([_bg("palette.bg")] * 6) == []


def test_the_minority_canvas_is_flagged_not_the_majority() -> None:
    """The majority IS the template's intent; the outliers are repaired to it."""
    codes = [_bg("palette.bg"), _bg("palette.bg"), _bg("palette.text"), _bg("palette.bg")]
    assert detect_canvas_drift(codes) == [2]


def test_a_fully_fractured_template_is_repaired_toward_the_brand_canvas() -> None:
    """No majority is the WORST case, not a reason to give up.

    This used to return [] when no canvas held a strict majority, so a template
    with a black, a cream and a red scene produced ZERO outliers — the exact
    failure the detector exists for. There is still a correct answer when the
    scenes do not agree on one: palette.bg.
    """
    # 3-3 split: every off-brand scene is flagged, the on-brand ones are not.
    codes = [_bg("palette.bg")] * 3 + [_bg("palette.text")] * 3
    assert detect_canvas_drift(codes) == [3, 4, 5]

    # The reported case: three scenes, three different canvases, no majority.
    reported = [_bg("'#0A0A0A'"), _bg("palette.bg"), _bg("'#B3121B'")]
    assert detect_canvas_drift(reported) == [0, 2]


def test_too_few_resolvable_scenes_is_not_enough_evidence() -> None:
    unknown = _bg("pickBg(props)")
    assert detect_canvas_drift([unknown, unknown, _bg("palette.bg")]) == []


# ── fonts ────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "escape",
    [
        # Hyphenated CSS inside a style string — `fontFamily` never appears.
        "<style>{`.h{font-family: Playfair Display;}`}</style>",
        # A ternary: the value does not START with a quote, so the literal
        # branch never matched it.
        "<p style={{fontFamily: big ? 'Playfair Display' : 'Inter'}}>x</p>",
        # An array join.
        "<p style={{fontFamily: ['Playfair Display','serif'].join(',')}}>x</p>",
        # The worst one: KitProvider applies this face to the WHOLE subtree.
        "<SceneFrame fonts={{heading: 'Playfair Display'}}><p>x</p></SceneFrame>",
    ],
)
def test_hardcoded_font_escapes_are_closed(escape: str) -> None:
    ok, err = validate_component_code(_scene("", escape), collect_all=True)
    assert not ok
    assert "font" in (err or "").lower()


@pytest.mark.parametrize(
    "legit",
    [
        "<p style={{fontFamily: props.bodyFont}}>x</p>",
        "<pre style={{fontFamily: 'monospace'}}>x</pre>",
        "<style>{`.h{font-family: ${props.headingFont};}`}</style>",
        "<SceneFrame fonts={{heading: props.headingFont, body: props.bodyFont}}><p>x</p></SceneFrame>",
        "const hf = props.headingFont; <p style={{fontFamily: hf}}>x</p>",
    ],
)
def test_correctly_bound_fonts_still_pass(legit: str) -> None:
    """Tightening a regex is only safe if it does not start rejecting good code."""
    ok, err = validate_component_code(_scene("", legit), collect_all=True)
    assert ok, err


def test_font_drift_flags_the_scene_that_disagrees() -> None:
    bound = _scene("", "<p style={{fontFamily: props.bodyFont}}>x</p>")
    override = _scene("", "<SceneFrame fonts={{heading: 'Playfair'}}><p>x</p></SceneFrame>")
    assert detect_font_drift([bound, bound, override, bound]) == [2]


def test_font_drift_ignores_a_scene_with_no_headline() -> None:
    """A chart-only scene has no heading to bind — not an outlier."""
    assert detect_font_drift(["const S = () => <CustomChart/>;"]) == []


# ── the critic band ──────────────────────────────────────────────────────────


def test_the_critic_band_covers_blueprint_misses_but_not_trivia() -> None:
    """Every blueprint-adherence miss is worth exactly -0.15, landing at 0.85.

    The band was `< 0.85` (so those were never reviewed — the boundary hole),
    then `< 1.0` (which reviewed scenes whose only flaw was a -0.1 and cost too
    many rollouts). 0.9 is the middle: adherence in, trivia out.
    """
    assert CODE_CRITIC_THRESHOLD == 0.9
    assert 0.85 < CODE_CRITIC_THRESHOLD, "a blueprint miss must still be reviewed"
    assert CODE_CRITIC_THRESHOLD <= 0.9, "a -0.1-only scene must not cost a rollout"


# ── the fail-open bugs that let a broken template ship ───────────────────────


@pytest.mark.parametrize(
    "root",
    [
        # A fill set through a variable: the regex cannot read it.
        "const rootStyle = {background:'#B3121B'};\nreturn (<AbsoluteFill style={rootStyle}><p/></AbsoluteFill>);",
        # A spread: same problem.
        "return (<AbsoluteFill style={{...bgStyle, padding:20}}><p/></AbsoluteFill>);",
    ],
)
def test_an_unreadable_root_style_is_unknown_not_assumed_on_brand(root: str) -> None:
    """This is the bug that let the reported template through.

    `scene_canvas_token` returned "palette.bg" whenever it found no `background:`
    in the root tag, on the theory that the scene inherits. That is only true
    when the root sets NO style — a fill behind a variable or a spread IS set,
    the regex just cannot see it. Three scenes painting three different colours
    that way all resolved to palette.bg, so the drift detector saw unanimous
    agreement on a template that had none.
    """
    assert scene_canvas_token(f"const S = (p) => {{{root}}};") is None


def test_a_root_with_genuinely_no_style_still_inherits() -> None:
    """The fix must not turn every styleless scene into an unknown."""
    assert scene_canvas_token("const S = (p) => { return (<AbsoluteFill><p/></AbsoluteFill>); };") == "palette.bg"


def test_sceneframe_only_counts_at_the_ROOT() -> None:
    """The short-circuit was a file-wide substring test, so a scene that painted
    its own red root and mentioned <SceneFrame in a nested branch was declared
    on-brand without the root ever being read."""
    nested = (
        "const S = (p) => { return (<AbsoluteFill style={{background:'#B3121B'}}>"
        "<SceneFrame><p/></SceneFrame></AbsoluteFill>); };"
    )
    assert scene_canvas_token(nested) == "#b3121b"

    at_root = "const S = (p) => { return (<SceneFrame><p/></SceneFrame>); };"
    assert scene_canvas_token(at_root) == "palette.bg"


# ── the backdrop LAYER that shipped a black canvas in a cream template ───────


def _layered(layer_fill: str) -> str:
    """Root paints the brand canvas; a full-bleed layer inside repaints it."""
    return (
        "const S = (p) => { return ("
        "<AbsoluteFill style={{background: palette.background}}>"
        f"<AbsoluteFill style={{{{background: {layer_fill}}}}} />"
        "<p>{p.displayText}</p>"
        "</AbsoluteFill>); };"
    )


def test_a_backdrop_layer_repainting_the_canvas_is_read_not_the_root() -> None:
    """The shipped defect: the root was correct, so reading only the root
    returned the brand canvas and the scene passed — while a full-bleed layer
    inside it painted near-black over the whole frame."""
    assert scene_canvas_token(_layered("'#0a0a0a'")) == "#0a0a0a"


def test_a_layer_repeating_the_brand_canvas_is_not_drift() -> None:
    """Most layered scenes just restate the same colour. Flagging those would
    fail the majority of the corpus for a difference nobody can see."""
    assert scene_canvas_token(_layered("palette.background")) == "palette.bg"


def test_a_sized_panel_is_not_a_canvas() -> None:
    """A half-width accent panel is design, not drift — pinning it would flatten
    every template into a single flat colour."""
    panel = (
        "const S = (p) => { return ("
        "<AbsoluteFill style={{background: palette.bg}}>"
        "<div style={{background: palette.accent, width: '48%'}} />"
        "</AbsoluteFill>); };"
    )
    assert scene_canvas_token(panel) == "palette.bg"


def test_drift_finds_the_layered_scene_among_clean_ones() -> None:
    clean = "const S = (p) => { return (<AbsoluteFill style={{background: palette.bg}}><p/></AbsoluteFill>); };"
    assert detect_canvas_drift([clean, clean, _layered("'#0a0a0a'")]) == [2]


# ── the font fallback that shipped two typefaces in one template ─────────────


def _font_scene(decl: str) -> str:
    return (
        "const SceneComponent = (props) => {"
        "const f = useCurrentFrame();"
        "const o = interpolate(f, [0, 20], [0, 1]);"
        "const y = interpolate(f, [0, 20], [20, 0]);"
        f"{decl}"
        "return <AbsoluteFill style={{overflow:'hidden', background: palette.bg}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "{props.imageUrl && <Img src={props.imageUrl} data-content-img/>}"
        "<FitText fontSize={props.titleFontSize ?? 72} "
        "style={{fontFamily: headingFont}}>{props.displayText}</FitText>"
        f"{PAD}</AbsoluteFill>; }};"
    )


def test_a_named_family_beside_the_font_prop_is_rejected() -> None:
    """The exact line from the reported template's log.

    Every guard tested for the SUBSTRING "headingFont", which matches the
    variable's own name and the prop reference — so the literal beside it was
    never examined and two scenes could carry different named fallbacks.
    """
    ok, err = validate_component_code(
        _font_scene("const headingFont = props.headingFont || 'Playfair Display, serif';"),
        collect_all=True,
    )
    assert not ok
    assert "font" in (err or "").lower()


@pytest.mark.parametrize(
    "decl",
    [
        "const headingFont = props.headingFont || 'inherit';",
        "const headingFont = props.headingFont;",
        "const headingFont = props.headingFont || 'monospace';",
    ],
)
def test_the_inherit_contract_and_monospace_still_pass(decl: str) -> None:
    ok, err = validate_component_code(_font_scene(decl), collect_all=True)
    assert ok, err


def test_font_drift_compares_scenes_to_EACH_OTHER() -> None:
    """It used to be a per-scene predicate in a loop, so "scene 1 falls back to
    Playfair, scene 2 to Inter" was undetectable by construction — each scene
    passed on its own terms. That is the drift its own docstring named."""
    playfair = _font_scene("const headingFont = props.headingFont || 'Playfair Display, serif';")
    inter = _font_scene("const headingFont = props.headingFont || 'Inter, sans-serif';")
    assert detect_font_drift([playfair, inter]) == [0, 1]

    inherit = _font_scene("const headingFont = props.headingFont || 'inherit';")
    assert detect_font_drift([inherit, inherit, playfair, inherit]) == [2]
    assert detect_font_drift([inherit] * 4) == []
