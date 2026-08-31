"""Validator correctness and type-scale bounds.

These cover the three defects seen on template 133 (Britannica):

  * Scenes churned through every repair attempt, ping-ponging between contracts:
    "missing logoUrl" -> fixed, but 0 animations -> fixed, but missing logoUrl
    again, shrinking 279 -> 279 -> 154 lines and never converging.
  * Body copy rendered tiny while headlines overflowed their container, breaking
    a title mid-word as "The Britan/nica/Experi".
"""
from __future__ import annotations

import pytest

from app.services.code_generator import (
    _TYPE_CEILING,
    _TYPE_FLOOR,
    _bp_type_directive,
    _type_bands,
)
from app.services.code_validator import validate_component_code

PAD = "x" * 600  # pushes past the 500-char minimum


def _scene(body: str = "", *, logo: str = "{props.logoUrl && <Img src={props.logoUrl}/>}") -> str:
    return (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        f"{logo}"
        "<FitText fontSize={props.titleFontSize ?? 72} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>"
        "<KenBurnsImage src={props.imageUrl}/>"
        "<SignatureArtifact motion='drift'/>"
        f"{body}{PAD}</div>; }};"
    )


# ─── Multi-error reporting ───────────────────────────────────────────────────


def test_collect_all_reports_every_broken_contract() -> None:
    """One error at a time is what made repairs trade one contract for another."""
    broken = "const SceneComponent = (props) => { return <div>" + PAD + "</div>; };"

    _, first_only = validate_component_code(broken)
    _, everything = validate_component_code(broken, collect_all=True)

    # First-only names exactly one problem; collect_all names several.
    assert "problems must ALL be fixed" not in (first_only or "")
    assert "problems must ALL be fixed" in everything
    for contract in ("animations", "overflow", "logoUrl", "imageUrl"):
        assert contract in everything, f"{contract} missing from the collected report"


def test_collect_all_still_returns_a_bare_message_for_a_single_error() -> None:
    """A lone failure should not be dressed up as a numbered list."""
    code = _scene(logo="")  # only the logo conditional is missing
    ok, err = validate_component_code(code, collect_all=True)
    assert ok is False
    assert "logoUrl" in err
    assert "problems must ALL be fixed" not in err


def test_syntax_errors_still_short_circuit() -> None:
    """A scene that does not parse must report ONE root cause, not derived noise."""
    ok, err = validate_component_code("const SceneComponent = (props) => { <div/>", collect_all=True)
    assert ok is False
    assert "problems must ALL be fixed" not in err


# ─── Logo conditional: forms that were wrongly rejected ──────────────────────


@pytest.mark.parametrize(
    "logo",
    [
        "{props.logoUrl && <Img src={props.logoUrl}/>}",
        "{props.logoUrl ? <Img src={props.logoUrl}/> : null}",
        "{!!props.logoUrl && <Img src={props.logoUrl}/>}",
        "{Boolean(props.logoUrl) && <Img src={props.logoUrl}/>}",
        "{hasLogo && <Img src={props.logoUrl}/>}",
        "{hasLogoAsset && <Img src={props.logoUrl}/>}",
    ],
)
def test_logo_conditional_accepts_every_reasonable_form(logo: str) -> None:
    """The old regex rejected valid code, so the model 'fixed' a non-bug.

    Being told to add a conditional that is already there, the model restructured
    the scene — and lost a different contract in the process.
    """
    ok, err = validate_component_code(_scene(logo=logo))
    assert ok is True, f"rejected a valid logo conditional: {err}"


def test_logo_conditional_accepts_an_aliased_local() -> None:
    code = (
        "const SceneComponent = (props) => {"
        "const logo = props.logoUrl;"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        "{logo && <Img src={logo}/>}"
        "<FitText fontSize={props.titleFontSize ?? 72} style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText><KenBurnsImage src={props.imageUrl}/>"
        "<SignatureArtifact motion='drift'/>"
        f"{PAD}</div>; }};"
    )
    ok, err = validate_component_code(code)
    assert ok is True, err


def test_logo_conditional_still_rejects_an_unguarded_render() -> None:
    """Widening must not accept a logo rendered with no guard at all."""
    ok, err = validate_component_code(_scene(logo="<Img src={props.logoUrl}/>"))
    assert ok is False
    assert "logoUrl" in err


# ─── Animation gate ──────────────────────────────────────────────────────────


def test_kit_helpers_count_as_animation() -> None:
    """A scene animated entirely through the kit has zero raw interpolate calls.

    Counting only `interpolate(`/`spring(` substrings failed such scenes, and the
    repair that followed stripped working code to satisfy a substring count.
    """
    ok, err = validate_component_code(_scene())
    assert ok is True, err


def test_static_scene_still_fails_the_animation_gate() -> None:
    code = (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        f"<span>{{props.displayText}}</span>{PAD}</div>; }};"
    )
    ok, err = validate_component_code(code)
    assert ok is False
    assert "animations" in err


# ─── scene_type is finally honoured ──────────────────────────────────────────


def test_outro_does_not_require_an_image_conditional() -> None:
    """The outro's own prompt says it takes NO content image.

    The validator required one anyway (scene_type was accepted and never read),
    so the outro could not satisfy prompt and validator at once — guaranteed churn.
    """
    outro = (
        "const SceneComponent = (props) => {"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        f"<FitText fontSize={{props.titleFontSize ?? 72}} style={{{{fontFamily: props.headingFont || 'inherit'}}}}>{{props.displayText}}</FitText><SignatureArtifact motion='drift'/>"
        f"<KenBurnsImage src={{props.imageUrl}}/>{PAD}</div>; }};"
    )
    ok, err = validate_component_code(outro, scene_type="outro")
    assert ok is True, err


def test_content_still_requires_an_image_conditional() -> None:
    content = (
        "const SceneComponent = (props) => {"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        f"<FitText fontSize={{props.titleFontSize ?? 72}} style={{{{fontFamily: props.headingFont || 'inherit'}}}}>{{props.displayText}}</FitText><SignatureArtifact motion='drift'/>"
        f"<KenBurnsImage src={{props.imageUrl}}/>{PAD}</div>; }};"
    )
    ok, err = validate_component_code(content, scene_type="content")
    assert ok is False
    assert "imageUrl" in err


# ─── Type bands ──────────────────────────────────────────────────────────────


def _bands(ratio: float, body_l: int, body_p: int) -> dict:
    return _type_bands(
        {
            "type_system": {
                "scale_ratio": ratio,
                "base_body_px_landscape": body_l,
                "base_body_px_portrait": body_p,
            }
        }
    )


@pytest.mark.parametrize(
    "ratio,body_l,body_p",
    [(1.25, 36, 34), (1.7, 72, 72), (1.1, 28, 28), (1.5, 48, 42), (1.15, 32, 30)],
)
def test_bands_are_never_inverted(ratio: float, body_l: int, body_p: int) -> None:
    """min must never exceed max, at any point in the blueprint's legal range."""
    for key, (lo, hi) in _bands(ratio, body_l, body_p).items():
        assert lo <= hi, f"{key} inverted: {lo}-{hi}"


@pytest.mark.parametrize(
    "ratio,body_l,body_p",
    [(1.25, 36, 34), (1.7, 72, 72), (1.1, 28, 28), (1.5, 48, 42)],
)
def test_bands_respect_the_ceiling(ratio: float, body_l: int, body_p: int) -> None:
    """The whole point: an unbounded scale_ratio could imply a 350px headline."""
    for key, (lo, hi) in _bands(ratio, body_l, body_p).items():
        assert hi <= _TYPE_CEILING[key], f"{key} exceeded ceiling: {hi}"
        assert lo >= _TYPE_FLOOR[key], f"{key} below floor: {lo}"


@pytest.mark.parametrize(
    "ratio,body_l,body_p",
    [(1.25, 36, 34), (1.7, 72, 72), (1.1, 28, 28), (1.5, 48, 42)],
)
def test_portrait_is_never_larger_than_landscape(ratio: float, body_l: int, body_p: int) -> None:
    """Portrait is a 1080px-wide canvas; larger type there is backwards."""
    b = _bands(ratio, body_l, body_p)
    assert b["headline_portrait"][1] <= b["headline_landscape"][1]
    assert b["body_portrait"][1] <= b["body_landscape"][1]


def test_directive_states_a_max_not_just_a_floor() -> None:
    """A floor alone reads as the target — that is why body copy came out tiny."""
    out = _bp_type_directive(
        {
            "type_system": {
                "scale_ratio": 1.25,
                "base_body_px_landscape": 36,
                "base_body_px_portrait": 34,
                "heading_case": "sentence",
                "label_case": "upper",
            }
        }
    )
    assert "never smaller" not in out, "still phrased as a floor"
    assert "ACTUAL sizes" in out
    assert "NEVER exceed the top of a range" in out
    assert "FitText" in out
    # Ranges, not single numbers.
    b = _bands(1.25, 36, 34)
    lo, hi = b["headline_landscape"]
    assert f"{lo}-{hi}px landscape" in out


def test_directive_is_empty_without_a_type_system() -> None:
    assert _bp_type_directive({}) == ""


# ─── Ambient motion must not trip the interpolate guard ──────────────────────


@pytest.mark.parametrize(
    "arg",
    [
        "Math.sin(frame * 0.06)",   # the sine breather the art direction asks for
        "Math.cos(frame / fps) * 8",
        "Math.min(frame, 30)",
        "frame * 0.5 + 1.25",       # any float literal
        "frame - i * 12",
        "frame",
    ],
)
def test_valid_interpolate_first_args_are_accepted(arg: str) -> None:
    """A decimal literal is not a property read.

    The guard matched `\\w+\\.\\w+`, and `\\w` includes digits — so `0.06` in
    `Math.sin(frame * 0.06)` looked like `object.property`. That rejected the
    ambient-motion code the art direction now asks every scene to write, with a
    "reads a property off an object" error that sent the repair loop after
    perfectly correct code.
    """
    code = (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        f"<div style={{{{opacity: interpolate({arg}, [0, 30], [0, 1])}}}}/>"
        "<FitText fontSize={props.titleFontSize ?? 72} style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText><SignatureArtifact motion='drift'/>"
        + PAD
        + "</div>; };"
    )
    ok, err = validate_component_code(code)
    assert ok is True, f"rejected valid ambient motion: {err}"


@pytest.mark.parametrize("arg", ["item.delay", "entry.offset", "frame - item.delay"])
def test_property_reads_are_still_rejected(arg: str) -> None:
    """The real crash — a field read off a free-form props array item."""
    code = (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        f"<div style={{{{opacity: interpolate({arg}, [0, 30], [0, 1])}}}}/>"
        "<FitText fontSize={props.titleFontSize ?? 72} style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText><SignatureArtifact motion='drift'/>"
        + PAD
        + "</div>; };"
    )
    ok, err = validate_component_code(code)
    assert ok is False
    assert "property off an object" in err


# ─── The headline must be auto-fitted, not a fixed guess ─────────────────────


def test_headline_must_be_wrapped_in_fittext() -> None:
    """A fixed fontSize cannot fit text whose length the scene does not control.

    This was a -0.15 score nudge, so scenes shipped at 0.70-0.85 with a bare
    fontSize on the headline — and that is exactly the text that came out too
    small on a short title and overflowing on a long one. Three rounds of
    prompt-and-score did not fix it; a hard gate does.
    """
    code = (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "<div style={{fontSize: 68}}>{props.displayText}</div>"
        "<KenBurnsImage src={props.imageUrl}/><SignatureArtifact motion='drift'/>"
        + PAD
        + "</div>; };"
    )
    ok, err = validate_component_code(code)
    assert ok is False
    assert "FitText" in err


def test_a_scene_without_a_headline_is_unaffected() -> None:
    """The gate keys on props.displayText — a chart-only scene is exempt."""
    code = (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "<KenBurnsImage src={props.imageUrl}/><SignatureArtifact motion='drift'/>"
        + PAD
        + "</div>; };"
    )
    ok, err = validate_component_code(code)
    assert ok is True, err


def test_generated_stub_satisfies_the_headline_gate() -> None:
    """The fallback stub must obey the contract it is a fallback for.

    It used a fixed fontSize, so a stubbed scene had the same too-small/overflow
    problem as the generated ones it replaces.
    """
    from app.services.code_generator import _build_stub_scene_code

    for scene_type in ("intro", "content", "outro"):
        code = _build_stub_scene_code(scene_type)
        assert "<FitText" in code, f"{scene_type} stub still uses a fixed headline size"
        ok, err = validate_component_code(code, scene_type=scene_type)
        assert ok is True, f"{scene_type} stub failed validation: {err}"


# ─── Contrast: invisible text ────────────────────────────────────────────────


def _rich_scene(extra: str = "", head: str = "<FitText fontSize={70} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>") -> str:
    """A scene that scores 1.00, so a single defect is isolated in the delta."""
    return (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "const isPortrait = props.aspectRatio === 'portrait';"
        "return <div style={{overflow:'hidden', minWidth:0}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        # Binding the template's typeface is a contract now, so the
        # scores-1.00 baseline has to satisfy it like any other.
        "<p style={{fontFamily: props.headingFont || 'inherit'}}>{props.sceneTitle}</p>"
        f"{head}<KenBurnsImage src={{props.imageUrl}}/>"
        "{isPortrait ? <span/> : <span/>}<div data-content-img='1'/>"
        "<AbsoluteFill style={{...cameraStage(1600)}}/><Decor system='rules'/>"
        + extra
        + PAD
        + "</div>; };"
    )


def _score(code: str) -> float:
    import contextlib
    import io

    from app.services.code_generator import _score_valid_scene

    with contextlib.redirect_stdout(io.StringIO()):
        return _score_valid_scene(code, {"scene_type": "content"})


def test_palette_text_on_palette_text_is_penalised() -> None:
    """The exact defect the prompt used to cause.

    `code_generator.py` handed the model an inverted-panel fragment that set
    `background: palette.text` and supplied NO foreground — "behind light text"
    was prose, not code. Pasting it while still colouring type `palette.text`
    renders the text invisible, and nothing in the pipeline checked colour.
    """
    bad = _rich_scene(
        "<AbsoluteFill style={{background: palette.text}}/>"
        "<div style={{color: palette.text}}>invisible</div>"
    )
    assert _score(bad) < _score(_rich_scene())


def test_readable_on_is_not_penalised() -> None:
    """The CORRECT pattern must score clean — a false positive costs a rollout.

    The inverted fill is a PANEL (a sized region), not an AbsoluteFill: a
    full-frame inversion is now its own defect, because it makes this scene's
    canvas disagree with every other scene in the template. See
    test_a_full_frame_inversion_is_penalised below.
    """
    good = _rich_scene(
        "const fg = readableOn(palette.text);"
        "<div style={{background: palette.text, width: '54%', height: '68%'}}/>"
        "<div style={{color: fg}}>visible</div>"
    )
    assert _score(good) == _score(_rich_scene())


@pytest.mark.parametrize(
    "style",
    [
        # Computed / non-literal values must never be guessed at.
        "{{background: withAlpha(palette.accent, 0.9), color: palette.text}}",
        "{{background: 'linear-gradient(0deg,#111,#222)', color: '#FFFFFF'}}",
        "{{background: 'var(--panel)', color: '#FFFFFF'}}",
        # High contrast is fine.
        "{{background: '#000000', color: '#FFFFFF'}}",
    ],
)
def test_contrast_check_has_no_false_positives(style: str) -> None:
    assert _score(_rich_scene(f"<div style={style}>x</div>")) == _score(_rich_scene())


def test_same_literal_hex_is_penalised() -> None:
    bad = _rich_scene("<div style={{background: '#111111', color: '#111111'}}>x</div>")
    assert _score(bad) < _score(_rich_scene())


def test_declarations_in_separate_objects_are_not_paired() -> None:
    """Scoping to one style object stops unrelated declarations colliding."""
    ok = _rich_scene(
        "<div style={{background: '#111111'}}/><div style={{color: '#111111'}}/>"
    )
    assert _score(ok) == _score(_rich_scene())


# ─── The 12-47px band ────────────────────────────────────────────────────────


def test_two_small_sizes_are_free() -> None:
    """An eyebrow plus a caption is a correct typographic pattern.

    The art direction asks for 18-22px eyebrows, so scoring them would punish the
    model for following its own instructions — the mistake that made the old 20px
    floor fire on nearly every scene.
    """
    ok = _rich_scene(
        "<span style={{fontSize: 18}}>A</span><span style={{fontSize: 22}}>B</span>"
    )
    assert _score(ok) == _score(_rich_scene())


def test_many_undersized_values_are_penalised() -> None:
    """A pile of small type is a scene with no hierarchy — the reported defect."""
    bad = _rich_scene(
        "<span style={{fontSize: 14}}>A</span><span style={{fontSize: 18}}>B</span>"
        "<span style={{fontSize: 22}}>C</span><span style={{fontSize: 26}}>D</span>"
    )
    assert _score(bad) < _score(_rich_scene())


def test_scene_with_no_headline_scale_is_penalised() -> None:
    bad = _rich_scene("<span style={{fontSize: 30}}>body only</span>", head="")
    assert _score(bad) < _score(_rich_scene())


@pytest.mark.parametrize(
    "head",
    [
        "<FitText fontSize={70} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>",  # JSX prop form
        "<FitText fontSize={props.titleFontSize ?? 72} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>",  # implicit, resolves from the kit scale
    ],
)
def test_fittext_headline_counts_as_headline_scale(head: str) -> None:
    """The headline check must understand the form the art direction mandates.

    `_sizes` only captures `fontSize: N` style objects. A headline sized through
    the JSX prop (`<FitText fontSize={70}>`) — which is exactly what the art
    direction tells the model to write — would otherwise look like "no headline"
    and false-positive on every correctly built scene.
    """
    assert _score(_rich_scene(head=head)) == 1.0


# ─── Runtime crashes that pass every other check ─────────────────────────────


def _valid_scene(body: str = "") -> str:
    return (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>{props.logoUrl && <Img src={props.logoUrl}/>}"
        "<FitText fontSize={props.titleFontSize ?? 72} style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText><KenBurnsImage src={props.imageUrl}/>"
        "<SignatureArtifact motion='drift'/>" + body + PAD + "</div>; };"
    )


def test_spring_with_object_from_to_is_rejected() -> None:
    """`spring({from: {opacity: 0, scale: 0.9}})` blanks the entire scene.

    Remotion interpolates from/to directly, so an object throws "outputRange must
    contain only numbers" at RENDER time — behind an error boundary, so the scene
    shows a bare warning triangle. Observed in production on a scene that passed
    every other check and scored 0.72.
    """
    bad = _valid_scene(
        "<div style={{opacity: spring({frame, fps, "
        "from: {opacity: 0, scale: 0.92, y: 30}, to: {opacity: 1, scale: 1, y: 0}})}}/>"
    )
    ok, err = validate_component_code(bad)
    assert ok is False
    assert "NUMBERS" in err


def test_numeric_spring_is_accepted() -> None:
    """One spring per property is the correct shape and must keep working."""
    good = _valid_scene(
        "<div style={{opacity: spring({frame, fps, config:{damping:18}, from: 0, to: 1})}}/>"
    )
    ok, err = validate_component_code(good)
    assert ok is True, err


# ─── contentType is routing metadata, never copy ─────────────────────────────


@pytest.mark.parametrize(
    "body",
    [
        "<div>{props.contentType}</div>",
        "<div>{props.contentType ? props.contentType.toUpperCase() : 'OVERVIEW'}</div>",
    ],
)
def test_rendering_contenttype_is_rejected(body: str) -> None:
    """Rendering it stamps the literal word "PLAIN" on the video.

    A -0.2 score nudge was not enough — scenes shipped at 0.80 with it visible on
    screen, and the prompt had said "NEVER render contentType" for a long time.
    It is always wrong, so it is a gate.
    """
    ok, err = validate_component_code(_valid_scene(body))
    assert ok is False
    assert "contentType" in err


@pytest.mark.parametrize(
    "body",
    [
        # Branching on it is the whole point of the prop.
        "<div>{props.contentType === 'metrics' ? <span>a</span> : <span>b</span>}</div>",
        "<div>{props.contentType !== 'code' ? <span>a</span> : <span>b</span>}</div>",
    ],
)
def test_branching_on_contenttype_is_allowed(body: str) -> None:
    ok, err = validate_component_code(_valid_scene(body))
    assert ok is True, err


# ─── The no-image branch must reclaim the space it reserved ──────────────────


def test_partial_width_reclaim_is_penalised() -> None:
    """Widening only part-way leaves a bare strip — the "empty space" defect.

    Measured on a real scene that scored a perfect 1.00: it reserved 35% for an
    image and widened to only 70% without one, so a third of the frame rendered
    empty. Every other check passed it — it has a hasImage branch, has the image
    slot, and uses the right props.
    """
    bad = _rich_scene("<div style={{width: showVisualSlot ? '35%' : '70%'}}/>")
    assert _score(bad) < _score(_rich_scene())


@pytest.mark.parametrize("no_img", ["100", "95", "90"])
def test_full_width_reclaim_is_not_penalised(no_img: str) -> None:
    ok = _rich_scene(f"<div style={{{{width: showVisualSlot ? '35%' : '{no_img}%'}}}}/>")
    assert _score(ok) == _score(_rich_scene())


def test_narrowing_branch_is_not_flagged() -> None:
    """Only a WIDENING that stops short is the defect; other ternaries are fine."""
    ok = _rich_scene("<div style={{width: showVisualSlot ? '70%' : '35%'}}/>")
    assert _score(ok) == _score(_rich_scene())


# ─── Hardcoded sample data: real copy only ───────────────────────────────────


def test_invented_copy_is_penalised() -> None:
    bad = _rich_scene(
        "const items=[{label:'Fast delivery',icon:'x'},{label:'Great support'}];"
    )
    assert _score(bad) < _score(_rich_scene())


@pytest.mark.parametrize(
    "snippet",
    [
        # Layout coordinates that merely mention a flagged key nearby.
        "const nodePositions=[18,38,58,78]; const labelSize=16;",
        # Fallbacks built FROM props, with empty labels — not invented copy.
        "const fb=[]; for(let i=0;i<4;i++){fb.push({value: segs[i] || props.displayText, label: ''});}",
    ],
)
def test_hardcoded_data_check_has_no_false_positives(snippet: str) -> None:
    """A -0.3 on correct code sends the repair loop after a non-bug.

    Both of these were measured as false positives on real generated scenes: the
    old pattern matched the KEY NAME without requiring an actual quoted string,
    so `labelSize: 16` and `label: ''` both tripped it.
    """
    assert _score(_rich_scene(snippet)) == _score(_rich_scene())


# ─── Small print is a typographic tool, not a defect ─────────────────────────


def test_eyebrow_sized_text_is_not_penalised() -> None:
    """The art direction asks for 18-22px eyebrows; scoring must not fight it.

    The floor was 20px, so nearly every scene lost 0.15 for following its own
    instructions and the repair loop was pointed at correct code.
    """
    import contextlib
    import io

    from app.services.code_generator import _score_valid_scene

    def _scene(size: int) -> str:
        return (
            "const SceneComponent = (props) => {"
            "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
            "const isPortrait = props.aspectRatio === 'portrait';"
            "return <div style={{overflow:'hidden', minWidth:0}}>"
            "{props.logoUrl && <Img src={props.logoUrl}/>}"
            "<FitText fontSize={props.titleFontSize ?? 72} style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText><KenBurnsImage src={props.imageUrl}/>"
        "<SignatureArtifact motion='drift'/>"
            "{isPortrait ? <span/> : <span/>}<div data-content-img='1'/>"
            "<AbsoluteFill style={{...cameraStage(1600)}}/><Decor system='rules'/>"
            f"<span style={{{{fontSize: {size}}}}}>LABEL</span>" + PAD + "</div>; };"
        )

    def _log(code: str) -> str:
        with contextlib.redirect_stdout(io.StringIO()) as buf:
            _score_valid_scene(code, {"scene_type": "content"})
        return buf.getvalue()

    assert "fontSize below" not in _log(_scene(18)), "penalised a legitimate eyebrow"
    assert "fontSize below" not in _log(_scene(14)), "penalised a legitimate caption"
    assert "fontSize below" in _log(_scene(9)), "genuinely illegible text must still score"


# ─── FitText must be allowed to wrap ─────────────────────────────────────────


def test_fittext_rejects_nowrap() -> None:
    """`whiteSpace: 'nowrap'` inside <FitText> makes maxLines a no-op.

    Observed on template 142 (NASA): the headline was correctly wrapped in
    <FitText maxLines={2}> but styled `whiteSpace: 'nowrap'` with a container
    bleeding past the frame (`marginRight: '-4%'`). Forced onto one line and
    unable to shrink below minFontSize, the headline ran straight off the
    canvas while empty space sat beside it — the exact defect FitText exists
    to prevent. 22 of 295 stored scenes carried this combination.
    """
    ok, err = validate_component_code(
        _scene(
            body="<FitText maxLines={2} style={{whiteSpace: 'nowrap'}}>"
            "{props.displayText}</FitText>"
        )
    )
    assert ok is False
    assert "nowrap" in (err or "")


def test_fittext_allows_other_whitespace_styles() -> None:
    """Only 'nowrap' is forbidden — the gate must not flag ordinary styling."""
    ok, err = validate_component_code(
        _scene(
            body="<FitText maxLines={2} style={{whiteSpace: 'normal', fontWeight: 700}}>"
            "{props.displayText}</FitText>"
        )
    )
    assert ok is True, f"rejected a legitimate FitText style: {err}"


# ─── narrationText is the voiceover, never on-screen copy ────────────────────


def test_narration_text_may_not_be_rendered() -> None:
    """`narrationText` is what the VOICE reads — painting it on screen shows the
    viewer a spoken sentence, usually duplicating the headline.

    `sceneTitle` was added to the prop contract only recently, so scenes written
    before it reached for narrationText to fill eyebrow/kicker slots. 213 of 389
    stored scene codes did this; template 141's intro was the reported case.
    """
    for body in (
        "{props.narrationText}",
        "{props.narrationText && (<span/>)}",
        "{props.narrationText ? <span/> : null}",
        "<RevealText text={props.narrationText}/>",
    ):
        ok, err = validate_component_code(_scene(body=body))
        assert ok is False, f"accepted a rendered narrationText: {body}"
        assert "narrationText" in (err or "")


def test_forwarding_narration_text_to_a_child_is_allowed() -> None:
    """Passing the prop down is not rendering it — the child is validated on its
    own terms. Without this the gate would flag correct plumbing."""
    for body in (
        "<Child narrationText={props.narrationText}/>",
        "<Foo data={props.narrationText}/>",
    ):
        ok, err = validate_component_code(_scene(body=body))
        assert ok is True, f"rejected legitimate forwarding {body}: {err}"


def test_scene_title_is_accepted_as_the_eyebrow() -> None:
    """The replacement the gate steers toward must itself pass."""
    ok, err = validate_component_code(_scene(body="{props.sceneTitle}"))
    assert ok is True, f"rejected props.sceneTitle: {err}"


# ─── the typography sliders must actually do something ──────────────────────


def test_headline_must_read_title_font_size() -> None:
    """`layoutConfig.titleFontSize` is written by the editor's Typography slider
    and passed into the component by both the player and the export. A scene
    that hardcodes its headline size ignores it, so the slider silently does
    nothing. 105 of 389 stored scenes had this.
    """
    hardcoded = (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "<FitText fontSize={72} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>"
        "<KenBurnsImage src={props.imageUrl}/><SignatureArtifact motion='drift'/>"
        + PAD
        + "</div>; };"
    )
    ok, err = validate_component_code(hardcoded)
    assert ok is False
    assert "titleFontSize" in (err or "")


def test_headline_reading_the_prop_passes() -> None:
    """The shared fixture honours the slider, so this is the positive control."""
    ok, err = validate_component_code(_scene())
    assert ok is True, f"rejected a scene that honours the slider: {err}"


def test_headline_bound_to_the_prop_is_counted_as_headline_scale() -> None:
    """The size scan must understand the form the titleFontSize gate mandates.

    `_prop_sizes` matched only `fontSize={70}`. Once the gate required
    `fontSize={props.titleFontSize ?? 70}`, the scan stopped seeing headlines
    entirely and reported "largest is 12px — no focal element", docking 0.2
    from scenes that were correctly compliant.
    """
    import contextlib
    import io

    from app.services.code_generator import _score_valid_scene

    def _log(headline: str) -> str:
        code = (
            "const SceneComponent = (props) => {"
            "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
            "const isPortrait = props.aspectRatio === 'portrait';"
            "return <div style={{overflow:'hidden', minWidth:0}}>"
            "{props.logoUrl && <Img src={props.logoUrl}/>}"
            f"{headline}"
            "<KenBurnsImage src={props.imageUrl}/><SignatureArtifact motion='drift'/>"
            "{isPortrait ? <span/> : <span/>}<div data-content-img='1'/>"
            "<AbsoluteFill style={{...cameraStage(1600)}}/><Decor system='rules'/>"
            "<span style={{fontSize: 13}}>LABEL</span>" + PAD + "</div>; };"
        )
        with contextlib.redirect_stdout(io.StringIO()) as buf:
            _score_valid_scene(code, {"scene_type": "content"})
        return buf.getvalue()

    for headline in (
        "<FitText fontSize={70} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>",
        "<FitText fontSize={props.titleFontSize ?? 70} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>",
        "<FitText fontSize={props.titleFontSize ?? (isPortrait ? 52 : 70)} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>",
        "<FitText fontSize={props.titleFontSize} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>",
    ):
        assert "no type at headline scale" not in _log(headline), (
            f"penalised a headline-scale scene: {headline}"
        )

    # A scene whose largest type really is tiny must still be caught.
    assert "no type at headline scale" in _log(
        "<FitText fontSize={14} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>"
    )


# ── fonts must come from props (Stage 1) ─────────────────────────────────────
#
# The prompt has said "NEVER hardcode fontFamily" all along, but nothing
# enforced it: code_validator had no font check at all, so a scene writing
# fontFamily: 'Playfair Display' passed every gate. The visible symptom is a
# template whose intro renders in one face and whose content scenes render in
# another, because only the components that read props.headingFont follow the
# template's typeface.


def _font_error(snippet: str, decl: str = "") -> str | None:
    """The font failure for a scene, isolated from any other contract."""
    from app.services.code_validator import validate_component_code

    code = _rich_scene(extra=decl + f"<span style={{{{{snippet}}}}}>x</span>")
    _ok, err = validate_component_code(code, scene_type="content", collect_all=True)
    if err and "Hardcoded font family" in err:
        return err
    return None


@pytest.mark.parametrize(
    "snippet",
    [
        "fontFamily: 'Inter'",
        'fontFamily: "Georgia, serif"',
        "fontFamily: 'Playfair Display', serif",
    ],
)
def test_hardcoded_font_family_is_rejected(snippet: str) -> None:
    assert _font_error(snippet) is not None


def test_css_font_shorthand_cannot_smuggle_a_family() -> None:
    """A fontFamily-only check misses `font: '700 48px Inter'`."""
    assert _font_error("font: '700 48px Inter'") is not None


@pytest.mark.parametrize(
    "snippet",
    [
        "fontFamily: props.headingFont || 'inherit'",
        "fontFamily: props.bodyFont",
        "fontFamily: 'monospace'",
        "fontFamily: 'ui-monospace, SFMono-Regular'",
    ],
)
def test_prop_bound_and_mono_families_are_accepted(snippet: str) -> None:
    """Mono is the one legitimate literal — code scenes need it, no prop ships it."""
    assert _font_error(snippet) is None


def test_a_const_assigned_from_props_is_accepted() -> None:
    assert _font_error("fontFamily: hf", decl="const hf = props.headingFont || 'inherit';") is None


def test_a_const_assigned_a_literal_is_rejected() -> None:
    """Indirection through a const must not launder a hardcoded family."""
    assert _font_error("fontFamily: bad", decl="const bad = 'Playfair Display';") is not None


def test_font_error_co_reports_with_other_failures() -> None:
    """collect_all must not collapse to one error — that regression is documented."""
    from app.services.code_validator import validate_component_code

    code = _rich_scene(extra="<span style={{fontFamily: 'Inter'}}>{props.narrationText}</span>")
    _ok, err = validate_component_code(code, scene_type="content", collect_all=True)
    assert err and "Hardcoded font family" in err
    assert "narrationText" in err, "the other contract stopped being reported"


def test_the_stub_scene_satisfies_the_font_contract() -> None:
    """A stub that failed this gate would be stubbed again — an infinite floor."""
    from app.services.code_generator import _build_stub_scene_code
    from app.services.code_validator import validate_component_code

    theme = {
        "colors": {
            "accent": "#ED1C24",
            "bg": "#FFFFFF",
            "text": "#111111",
            "surface": "#EEEEEE",
            "muted": "#888888",
        },
        "fonts": {"heading": "inter", "body": "inter"},
    }
    for scene_type in ("intro", "content", "outro"):
        code = _build_stub_scene_code(scene_type, theme)
        ok, err = validate_component_code(code, scene_type=scene_type, collect_all=True)
        assert ok, f"{scene_type} stub no longer validates: {err}"


def test_scene_ignoring_the_typeface_is_rejected() -> None:
    """Setting no family at all is consistent but still ignores the template.

    This was a -0.25 score nudge, which alone never crosses the 0.6 acceptance
    bar — so a scene rendering in the system sans shipped at 0.75. It is a HARD
    gate now: the template chose a typeface and the scene must bind it.
    """
    base = _rich_scene()
    assert _score(base) == 1.0
    stripped = base.replace("fontFamily: props.headingFont || 'inherit'", "color: 'red'")
    ok, err = validate_component_code(stripped, collect_all=True)
    assert not ok
    assert "props.headingFont" in (err or "")


def test_art_direction_names_the_templates_typeface() -> None:
    """The rule only lands if the model knows WHICH face this template is."""
    from app.services.code_generator import build_art_direction

    bp = {
        "identity": {"heading_font": "archivo_black", "body_font": "source_sans_3"},
        "type_system": {"base_body_px_landscape": 36},
        "structure": {},
        "layouts": [],
        "bookends": {},
    }
    out = build_art_direction(bp, "content", 0)
    assert "archivo_black" in out
    assert "source_sans_3" in out
