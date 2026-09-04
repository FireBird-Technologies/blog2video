"""Validator correctness and type-scale bounds.

These cover the three defects seen on template 133 (Britannica):

  * Scenes churned through every repair attempt, ping-ponging between contracts:
    "missing logoUrl" -> fixed, but 0 animations -> fixed, but missing logoUrl
    again, shrinking 279 -> 279 -> 154 lines and never converging.
  * Body copy rendered tiny while headlines overflowed their container, breaking
    a title mid-word as "The Britan/nica/Experi".
"""
from __future__ import annotations

import json

import pytest

from app.services.code_generator import _TYPE_CEILING, _TYPE_FLOOR
from app.services.code_validator import validate_component_code

PAD = "x" * 600  # pushes past the 500-char minimum


def _scene(body: str = "", *, logo: str = "{props.logoUrl && <Img src={props.logoUrl}/>}") -> str:
    return (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        f"{logo}"
        "<FitText fontSize={props.titleFontSize ?? 68} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.sceneTitle}</FitText>"
        "<FitText fontSize={props.descriptionFontSize ?? 34} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.bodyFont || 'inherit'}}>{props.displayText}</FitText>"
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
        "<FitText fontSize={props.titleFontSize ?? 68} style={{fontFamily: props.headingFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.sceneTitle}</FitText>"
        "<FitText fontSize={props.descriptionFontSize ?? 34} style={{fontFamily: props.bodyFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.displayText}</FitText><KenBurnsImage src={props.imageUrl}/>"
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
        f"<FitText fontSize={{props.titleFontSize ?? 68}} style={{{{fontFamily: props.headingFont || 'inherit'}}}} containerWidth={{800}} maxHeight={{300}}>{{props.sceneTitle}}</FitText>"
        f"<FitText fontSize={{props.descriptionFontSize ?? 34}} style={{{{fontFamily: props.bodyFont || 'inherit'}}}} containerWidth={{800}} maxHeight={{300}}>{{props.displayText}}</FitText><SignatureArtifact motion='drift'/>"
        f"<KenBurnsImage src={{props.imageUrl}}/>{PAD}</div>; }};"
    )
    ok, err = validate_component_code(outro, scene_type="outro")
    assert ok is True, err


def test_content_still_requires_an_image_conditional() -> None:
    content = (
        "const SceneComponent = (props) => {"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        f"<FitText fontSize={{props.titleFontSize ?? 68}} style={{{{fontFamily: props.headingFont || 'inherit'}}}} containerWidth={{800}} maxHeight={{300}}>{{props.sceneTitle}}</FitText>"
        f"<FitText fontSize={{props.descriptionFontSize ?? 34}} style={{{{fontFamily: props.bodyFont || 'inherit'}}}} containerWidth={{800}} maxHeight={{300}}>{{props.displayText}}</FitText><SignatureArtifact motion='drift'/>"
        f"<KenBurnsImage src={{props.imageUrl}}/>{PAD}</div>; }};"
    )
    ok, err = validate_component_code(content, scene_type="content")
    assert ok is False
    assert "imageUrl" in err


# ─── Type-scale bounds ───────────────────────────────────────────────────────
#
# The per-template type BANDS are gone with the blueprint that derived them: the
# design docs describe typography in prose, so there is no scale_ratio to clamp.
# What remains is the absolute sanity range used by the scorer.


def test_type_bounds_are_sane() -> None:
    """Floors below ceilings, and portrait never larger than landscape.

    Portrait is a 1080px-wide canvas; larger type there is backwards.
    """
    for key, ceil in _TYPE_CEILING.items():
        assert _TYPE_FLOOR[key] < ceil, f"{key}: floor {_TYPE_FLOOR[key]} >= ceiling {ceil}"
    for role in ("headline", "body", "prop", "micro"):
        assert _TYPE_CEILING[f"{role}_portrait"] <= _TYPE_CEILING[f"{role}_landscape"]



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
        "<FitText fontSize={props.titleFontSize ?? 68} style={{fontFamily: props.headingFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.sceneTitle}</FitText>"
        "<FitText fontSize={props.descriptionFontSize ?? 34} style={{fontFamily: props.bodyFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.displayText}</FitText><SignatureArtifact motion='drift'/>"
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
        "<FitText fontSize={props.titleFontSize ?? 68} style={{fontFamily: props.headingFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.sceneTitle}</FitText>"
        "<FitText fontSize={props.descriptionFontSize ?? 34} style={{fontFamily: props.bodyFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.displayText}</FitText><SignatureArtifact motion='drift'/>"
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


def _rich_scene(extra: str = "", head: str = "<FitText fontSize={props.titleFontSize ?? (isPortrait ? 48 : 68)} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.sceneTitle}</FitText>") -> str:
    """A scene that scores 1.00, so a single defect is isolated in the delta."""
    return (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        # A scene that gates its visual slot on hasImage must also read
        # props.hasVideo, or a stock clip has nowhere to render — so the
        # scores-1.00 baseline satisfies that contract like any other.
        "const hasVideo = !!props.hasVideo;"
        "const isPortrait = props.aspectRatio === 'portrait';"
        "return <div style={{overflow:'hidden', minWidth:0}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        # Binding the template's typeface is a contract now, so the
        # scores-1.00 baseline has to satisfy it like any other. `head` is the
        # TITLE (props.sceneTitle at props.titleFontSize, the frame's focal
        # type); this is the display text, which under the two-tier contract is
        # body copy and takes props.descriptionFontSize and props.bodyFont.
        "<p style={{fontFamily: props.bodyFont || 'inherit', "
        "fontSize: props.descriptionFontSize ?? (isPortrait ? 30 : 34)}}>{props.displayText}</p>"
        f"{head}<KenBurnsImage src={{props.imageUrl}}/>"
        "{isPortrait ? <span/> : <span/>}<div data-content-img='1'/>"
        # Tonal depth, via the one helper still in scope. This used to be
        # `cameraStage(1600)` + `<Decor system='rules'/>` — both FORBIDDEN
        # identifiers, kept here only because the scorer charged an unwinnable
        # -0.2/-0.1 for their absence. The fixture encoded the bug.
        "<div style={{background: withAlpha(props.brandColors.accent, 0.08), "
        "opacity: interpolate(frame, [0, 20], [0, 1])}}/>"
        # An editable prop, because the scores-1.00 baseline has to satisfy that
        # contract like every other: a content scene declaring none is nudged,
        # since every string it invents would otherwise be frozen forever.
        "<span>{props.layoutProps?.kicker ?? 'KEY POINTS'}</span>"
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
        "<FitText fontSize={70} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.sceneTitle}</FitText>",  # JSX prop form
        "<FitText fontSize={props.titleFontSize ?? 72} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.sceneTitle}</FitText>",  # implicit, resolves from the kit scale
    ],
)
def test_fittext_title_counts_as_headline_scale(head: str) -> None:
    """The focal-type check must understand the form the art direction mandates.

    `_sizes` only captures `fontSize: N` style objects. A title sized through
    the JSX prop (`<FitText fontSize={70} containerWidth={800} maxHeight={300}>`) — which is exactly what the art
    direction tells the model to write — would otherwise look like "no focal
    type" and false-positive on every correctly built scene.
    """
    assert _score(_rich_scene(head=head)) == 1.0


# ─── Runtime crashes that pass every other check ─────────────────────────────


def _valid_scene(body: str = "") -> str:
    return (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>{props.logoUrl && <Img src={props.logoUrl}/>}"
        "<FitText fontSize={props.titleFontSize ?? 68} style={{fontFamily: props.headingFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.sceneTitle}</FitText>"
        "<FitText fontSize={props.descriptionFontSize ?? 34} style={{fontFamily: props.bodyFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.displayText}</FitText><KenBurnsImage src={props.imageUrl}/>"
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
            "<FitText fontSize={props.titleFontSize ?? 68} style={{fontFamily: props.headingFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.sceneTitle}</FitText>"
        "<FitText fontSize={props.descriptionFontSize ?? 34} style={{fontFamily: props.bodyFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.displayText}</FitText><KenBurnsImage src={props.imageUrl}/>"
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
    """`whiteSpace: 'nowrap'` inside <FitText containerWidth={800} maxHeight={300}> makes maxLines a no-op.

    Observed on template 142 (NASA): the headline was correctly wrapped in
    <FitText maxLines={2} containerWidth={800} maxHeight={300}> but styled `whiteSpace: 'nowrap'` with a container
    bleeding past the frame (`marginRight: '-4%'`). Forced onto one line and
    unable to shrink below minFontSize, the headline ran straight off the
    canvas while empty space sat beside it — the exact defect FitText exists
    to prevent. 22 of 295 stored scenes carried this combination.
    """
    ok, err = validate_component_code(
        _scene(
            body="<FitText maxLines={2} style={{whiteSpace: 'nowrap'}} containerWidth={800} maxHeight={300}>"
            "{props.displayText}</FitText>"
        )
    )
    assert ok is False
    assert "nowrap" in (err or "")


def test_fittext_allows_other_whitespace_styles() -> None:
    """Only 'nowrap' is forbidden — the gate must not flag ordinary styling."""
    ok, err = validate_component_code(
        _scene(
            body="<FitText maxLines={2} style={{whiteSpace: 'normal', fontWeight: 700}} containerWidth={800} maxHeight={300}>"
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


def test_title_must_read_title_font_size() -> None:
    """`layoutConfig.titleFontSize` is written by the editor's Title slider and
    passed into the component by both the player and the export. A scene that
    hardcodes its TITLE size ignores it, so the slider silently does nothing.
    105 of 389 stored scenes had this.

    The gate keys on props.sceneTitle, not props.displayText: titleFontSize
    sizes the scene's title. It sized the display text under the previous
    contract, which is the naming trap the two-tier contract removed.
    """
    hardcoded = (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "<FitText fontSize={72} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.sceneTitle}</FitText>"
        "<FitText fontSize={props.descriptionFontSize ?? 34} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.bodyFont || 'inherit'}}>{props.displayText}</FitText>"
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
        "<FitText fontSize={70} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>",
        "<FitText fontSize={props.titleFontSize ?? 70} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>",
        "<FitText fontSize={props.titleFontSize ?? (isPortrait ? 52 : 70)} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>",
        "<FitText fontSize={props.titleFontSize} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.displayText}</FitText>",
    ):
        assert "no type at headline scale" not in _log(headline), (
            f"penalised a headline-scale scene: {headline}"
        )

    # A scene whose largest type really is tiny must still be caught.
    assert "no type at headline scale" in _log(
        "<FitText fontSize={14} containerWidth={800} maxHeight={300} "
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


def test_the_templates_typeface_is_carried_on_the_docs() -> None:
    """The font rule only lands if the template knows WHICH face it is.

    Scene code binds props.headingFont/bodyFont; those props are resolved at
    render time from design_blueprint.identity, so the identity must survive
    validation with renderable ids.
    """
    from app.dspy_modules.design_doc import MIN_SCENES, validate_design_docs

    docs, _ = validate_design_docs(
        "g" * 200,
        json.dumps(
            [
                {
                    "id": f"s{i}",
                    "role": "content",
                    # Cycled so the set covers REQUIRED_CONTENT_TYPES; this test
                    # is about fonts, not content coverage.
                    "content_type": ("metrics", "timeline", "comparison",
                                     "steps", "quote", "bullets")[i % 6],
                    "doc": "d" * 120,
                    "supports_image": False,
                    "image_mode": None,
                    "image_side": None,
                }
                for i in range(MIN_SCENES)
            ]
        ),
        '{"heading_font": "archivo_black", "body_font": "source_sans_3"}',
    )
    assert docs["identity"]["heading_font"] == "archivo_black"
    assert docs["identity"]["body_font"] == "source_sans_3"


# ─── Full-bleed backdrop vs. cover ───────────────────────────────────────────


def _bg_scene(*, slot_first: bool) -> str:
    """A background-image scene, with the slot before or after the content."""
    slot = (
        "<div data-content-img=\"1\" style={{position:'absolute', inset:0, "
        "width:'100%', height:'100%', zIndex:0}}>"
        "{hasImage && <Img src={props.imageUrl} style={{objectFit:'cover'}}/>}</div>"
    )
    scrim = "<div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.6)'}}/>"
    content = (
        "<div style={{position:'relative', zIndex:1}}>"
        "<FitText fontSize={props.titleFontSize ?? 80} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.sceneTitle}</FitText>"
        "<p style={{fontFamily: props.bodyFont || 'inherit', "
        "fontSize: props.descriptionFontSize ?? 30}}>{headline}</p>"
        "</div>"
    )
    body = f"{slot}{scrim}{content}" if slot_first else f"{content}{slot}"
    return (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        # The alias is the point: the scene renders `headline`, never
        # `props.displayText` directly inside the JSX.
        "const headline = props.displayText || '';"
        "const o = interpolate(frame,[0,30],[0,1]);"
        "const s = spring({frame, fps});"
        "return <div style={{overflow:'hidden', opacity:o, transform:`scale(${s})`}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        f"{body}{PAD}</div>; }};"
    )


def test_a_full_bleed_backdrop_rendered_first_is_allowed() -> None:
    """The image-mode contract asks for exactly this shape, so it must pass.

    Regression: the DOM-order check located "content" with a bare `displayText`
    match, which also hit the variable declaration at the top of the file. A
    scene that aliased displayText therefore had its last "content layer" at
    line ~15, every backdrop looked like it came after the content, and correct
    scenes were rejected — measured on template 173.
    """
    ok, err = validate_component_code(_bg_scene(slot_first=True), collect_all=True)
    assert ok is True, f"rejected a correct full-bleed backdrop: {err}"


def test_a_full_bleed_slot_after_the_content_is_still_rejected() -> None:
    """The real bug the check exists for: the photo paints over the layout."""
    ok, err = validate_component_code(_bg_scene(slot_first=False), collect_all=True)
    assert ok is False
    assert "full-bleed" in (err or "")


# ─── The scorer must not demand what the validator forbids ───────────────────


def test_scorer_has_no_unwinnable_penalties() -> None:
    """A penalty keyed on a FORBIDDEN identifier can never be satisfied.

    This is the class of bug, not just one instance: the scorer docked 0.2 from
    every scene that did not call cameraStage / cameraPush / parallaxLayer —
    helpers the kit-narrowing refactor removed from the AI's scope and the
    validator now rejects. Every scene lost 0.2 it could not win back, which
    dragged 17 of 35 stored scenes below CODE_CRITIC_THRESHOLD and bought each an
    extra LLM call. That was the largest single contributor to ~690s runs.

    Any future penalty referencing a kit name must use one of the allowed five.
    """
    import inspect
    import re as _re

    from app.services import code_generator as cg
    from app.services.code_validator import ALLOWED_KIT_NAMES, _RESERVED_KIT_NAME_RE

    body = inspect.getsource(cg._score_valid_scene)

    offenders = set()
    for pattern in _re.findall(r"re\.search\(\s*r?['\"](.+?)['\"]", body):
        for name in _re.findall(r"[A-Za-z][A-Za-z0-9_]{3,}", pattern):
            if name in ALLOWED_KIT_NAMES:
                continue
            if _RESERVED_KIT_NAME_RE.fullmatch(name):
                offenders.add(name)

    assert not offenders, (
        f"_score_valid_scene scores on identifiers the validator forbids: "
        f"{sorted(offenders)}. A scene can never satisfy these, so the penalty is "
        f"charged unconditionally. Use one of {sorted(ALLOWED_KIT_NAMES)} or drop it."
    )


# ─── Gates must be SATISFIABLE ───────────────────────────────────────────────
#
# A gate a scene cannot possibly satisfy burns all three repair attempts and then
# stubs the scene. Measured on template 177: five of nine scenes were stubbed
# after ~1400s on exactly this, and every one of them was correct code.


def _data_only_scene(usage: str) -> str:
    """A valid scene that READS props.displayText but never renders it."""
    return (
        "const SceneComponent = (props) => {"
        # frame/fps must be DECLARED: the validator now also runs the component
        # (Level 2), and a fixture that reads an undeclared binding throws
        # "frame is not defined" — a fixture bug, not the contract under test.
        # Real generated scenes always declare these.
        "const frame = useCurrentFrame(); const { fps } = useVideoConfig();"
        "const isPortrait = props.aspectRatio === 'portrait';"
        f"{usage}"
        "const o = interpolate(frame,[0,30],[0,1]); const s = spring({frame, fps});"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden', opacity:o}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "{hasImage && <div data-content-img='1'><Img src={props.imageUrl}/></div>}"
        "<span style={{fontFamily: props.headingFont || 'inherit', "
        "fontSize: props.titleFontSize ?? (isPortrait ? 48 : 68)}}>"
        "{props.sceneTitle}</span>"
        # isPortrait branch + a fitted render, so this fixture trips no gate
        # OTHER than the one under test.
        "{isPortrait ? <span/> : <span/>}"
        # Orientation-aware and in-band: this fixture declares isPortrait, and
        # the typography gate requires an orientation-aware default of any scene
        # that does. Not the contract under test, but a fixture that trips
        # another gate tests nothing.
        "<FitText fontSize={props.descriptionFontSize ?? (isPortrait ? 30 : 34)} maxLines={4} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.bodyFont || 'inherit'}}>{items[0]}</FitText>"
        f"{PAD}</div>; }};"
    )


@pytest.mark.parametrize(
    "usage",
    [
        # displayText as a QUOTE fallback — the scene has no headline. (The
        # quote itself is fitted below, which its own gate requires.)
        "const items = [props.quote || props.displayText || ''];",
        # displayText as a STEPS fallback.
        "const items = (props.steps && props.steps.length) ? props.steps : [props.displayText];",
        # displayText split into words for a staggered reveal — a real technique,
        # and one that cannot be wrapped in <FitText containerWidth={800} maxHeight={300}>.
        "const items = (props.displayText || '').split(/\\s+/);",
    ],
)
def test_reading_displaytext_as_data_does_not_demand_fittext(usage: str) -> None:
    """The gate fires on a RENDERED headline, not on the string appearing.

    displayText is also the standard data fallback. A scene that never renders it
    as a headline cannot wrap it in FitText, so demanding that is unsatisfiable —
    the model cannot add a headline its design does not have.
    """
    ok, err = validate_component_code(_data_only_scene(usage), collect_all=True)
    assert ok is True, f"rejected a scene with no headline to fit: {err}"


def test_a_rendered_headline_still_requires_fittext() -> None:
    """The real defect the gate exists for must still be caught."""
    code = (
        "const SceneComponent = (props) => {"
        "const o = interpolate(frame,[0,30],[0,1]); const s = spring({frame, fps});"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "{hasImage && <div data-content-img='1'><Img src={props.imageUrl}/></div>}"
        "<h1 style={{fontFamily: props.headingFont || 'inherit', fontSize: 90}}>"
        "{props.displayText}</h1>"
        f"{PAD}</div>; }};"
    )
    ok, err = validate_component_code(code, collect_all=True)
    assert ok is False
    assert "FitText" in (err or "")


def test_an_image_less_scene_is_not_asked_for_an_image() -> None:
    """The doc says "render no image"; the validator must not say the opposite.

    Two scenes of template 177 were stubbed on exactly this contradiction.
    """
    code = _data_only_scene("const items = [props.sceneTitle || ''];").replace(
        "{hasImage && <div data-content-img='1'><Img src={props.imageUrl}/></div>}", ""
    ).replace(
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');", ""
    )
    ok, err = validate_component_code(
        code, scene_type="content", collect_all=True, scene_doc="IMAGE — NONE\n"
    )
    assert ok is True, f"an image-less scene was told to add an image: {err}"

    # Without the doc the gate still applies — a scene that MIGHT carry an image
    # must handle one.
    ok2, err2 = validate_component_code(code, scene_type="content", collect_all=True)
    assert ok2 is False
    assert "imageUrl" in (err2 or "")


# ─── Micro-text and uncapped lists ───────────────────────────────────────────


def test_micro_text_is_rejected() -> None:
    """13px on a 1920px canvas is ~1.2% of frame height — invisible after H.264.

    Measured across 108 real generated scenes: 140 literals at or below 20px in
    52 of them, against 8 above 96px.
    """
    from app.services.code_validator import _design_doc_defects

    defects = _design_doc_defects(
        "style={{fontSize: 18}} style={{fontSize: 16}}", "content", "IMAGE — NONE\n"
    )
    assert any("does not survive" in d for d in defects)
    assert any("18" in d and "16" in d for d in defects), "the message must name the literals"


def test_video_scale_sizes_pass() -> None:
    from app.services.code_validator import _design_doc_defects

    defects = _design_doc_defects(
        "style={{fontSize: 30}} style={{fontSize: 96}}", "content", "IMAGE — NONE\n"
    )
    assert not any("does not survive" in d for d in defects)


def test_an_uncapped_list_is_rejected() -> None:
    from app.services.code_validator import _design_doc_defects

    defects = _design_doc_defects(
        "{props.bullets.map((b,i)=><div key={i}>{b}</div>)}", "content", "IMAGE — NONE\n"
    )
    assert any("without a cap" in d for d in defects)


def test_a_capped_list_passes() -> None:
    from app.services.code_validator import _design_doc_defects

    defects = _design_doc_defects(
        "{(props.bullets ?? []).slice(0,4).map((b,i)=><div key={i}>{b}</div>)}",
        "content",
        "IMAGE — NONE\n",
    )
    assert not any("without a cap" in d for d in defects)


def test_the_px_floor_agrees_across_stages() -> None:
    """The doc stage and the code stage must enforce the SAME floor.

    If they drift, one tells the model 22px while the other accepts 13px, and a
    scene can satisfy its brief and still be rejected.
    """
    from app.dspy_modules.design_doc import MIN_ON_SCREEN_PX as doc_px
    from app.services.code_validator import MIN_ON_SCREEN_PX as code_px

    assert doc_px == code_px


# ── interpolate takes POSITIONAL ranges, not a config object ─────────────────


def test_the_react_native_interpolate_form_is_rejected() -> None:
    """The defect that blanked template 181's intro.

    Remotion's signature is interpolate(frame, inputRange, outputRange, opts).
    A scene writing the React-Native/Framer form passes an object where an array
    belongs; the preview's safeInterpolate wrapper then calls .map() on it and
    throws "inputRange.map is not a function" DURING RENDER. That error unwinds
    past the scene into the Player, so the whole preview goes blank — not just
    the one element.

    Invisible to every other check: the code parses, wraps and type-checks.
    """
    # The statement must sit in the COMPONENT BODY, not inside the returned JSX
    # (where it would be a syntax error and short-circuit before this gate).
    code = _scene().replace(
        "const SceneComponent = (props) => {",
        "const SceneComponent = (props) => {"
        "const frame = useCurrentFrame();"
        "const p = interpolate(frame, { inputRange: [15, 45], outputRange: [0, 1] });",
        1,
    )
    ok, err = validate_component_code(code, collect_all=True)
    assert not ok
    assert "CONFIG OBJECT" in (err or "")


@pytest.mark.parametrize("call", [
    "interpolate(frame, [0, 12], [0, 1])",
    "interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })",
    "interpolate(frame - 10, [0, 30], [0, 1], { easing: Easing.out(Easing.quad) })",
    "interpolate(Math.sin(frame / 30 * Math.PI), [-1, 1], [0.5, 1])",
])
def test_positional_interpolate_still_passes(call: str) -> None:
    """A gate that rejects the correct form would burn every scene's repair
    budget — the options object as the FOURTH argument is right and common."""
    code = _scene().replace(
        "const SceneComponent = (props) => {",
        "const SceneComponent = (props) => {"
        "const frame = useCurrentFrame();"
        f"const p = {call};",
        1,
    )
    ok, err = validate_component_code(code, collect_all=True)
    assert ok, err


# ─── interpolate outputRange must be an ARRAY ────────────────────────────────


def _interp_scene(call: str) -> str:
    """A minimal valid scene whose only variable is one interpolate call."""
    return (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        f"const v = {call};"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "<div style={{opacity: v}}/>"
        "<FitText fontSize={props.titleFontSize ?? (isPortrait ? 48 : 68)} style={{fontFamily: props.headingFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.sceneTitle}</FitText>"
        "<FitText fontSize={props.descriptionFontSize ?? (isPortrait ? 30 : 34)} style={{fontFamily: props.bodyFont || 'inherit'}} containerWidth={800} maxHeight={300}>{props.displayText}</FitText><SignatureArtifact motion='drift'/>"
        + PAD
        + "</div>; };"
    )


@pytest.mark.parametrize(
    "call",
    [
        # The exact shape that shipped in template 193's split-comparison scene.
        "interpolate(leftIn, [0, 1], isPortrait ? 0 : -120, { easing: Easing.linear })",
        "interpolate(rightIn, [0, 1], isPortrait ? 100 : 0)",
    ],
)
def test_scalar_output_range_is_rejected(call: str) -> None:
    """A ternary yielding NUMBERS where an array belongs.

    Remotion throws "inputRange (2) and outputRange (undefined) must have the
    same length" at RENDER, and that unwinds past the scene into the Player —
    so one bad call blanks the entire preview, not just its own scene.

    The literal length check cannot see this: it only fires when BOTH ranges are
    bracketed literals, so a scalar third argument never reaches it.
    """
    ok, err = validate_component_code(_interp_scene(call))
    assert ok is False
    assert "outputRange" in (err or "")


@pytest.mark.parametrize(
    "call",
    [
        # The CORRECT way to vary an output range by orientation.
        "interpolate(t, [0, 1], isPortrait ? [0, 0] : [0, -120], { easing: Easing.linear })",
        # Plain literals, and a variable holding a range — both legitimate.
        "interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp' })",
        "interpolate(frame, [0, 30], outRange)",
    ],
)
def test_valid_output_ranges_are_accepted(call: str) -> None:
    """The fix the error message asks for must itself pass.

    A gate that rejects the repair it recommends sends the retry loop in a
    circle, so this is the half worth pinning.
    """
    ok, err = validate_component_code(_interp_scene(call))
    assert ok is True, f"rejected valid interpolate: {err}"


# ─── The write-time render guard must judge by the same contract ─────────────


def test_the_render_guard_passes_the_scene_doc() -> None:
    """An image-less scene must not be stubbed on its way to the workspace.

    `_safe_scene_code` re-validates stored code before writing it into a render
    workspace. It called validate_component_code WITHOUT scene_doc, so
    `_image_less_by_design` was False for every scene and each one whose design
    says "IMAGE — NONE" failed the image gate it was legitimately exempt from.

    The guard then substituted the deterministic stub. Observed on template 201:
    the database held eight correct content scenes, generation reported zero
    warnings (nothing failed AT generation), and SIX of the eight arrived in the
    workspace as the identical stub — rendering only a title and display text.
    """
    import inspect

    from app.services import remotion

    src = inspect.getsource(remotion._safe_scene_code)
    assert "scene_doc=scene_doc" in src, (
        "the guard validates without the scene's design doc, so every "
        "conditional contract is judged wrongly"
    )
    # And every call site supplies it.
    writer = inspect.getsource(remotion._write_generated_scene_files)
    assert writer.count("_safe_scene_code(") == 3, writer
    assert '_docs.get("intro"' in writer
    assert '_docs.get("outro"' in writer
    assert '_docs.get(f"content_{i}"' in writer


def test_an_image_less_scene_survives_the_write_time_guard() -> None:
    """End to end: doc says IMAGE — NONE, code renders none, guard keeps it."""
    from app.services.remotion import _safe_scene_code

    code = (
        "const SceneComponent = (props) => {"
        "const { width, height, fps } = useVideoConfig();const frame = useCurrentFrame();"
        "const isPortrait = props.aspectRatio === 'portrait';"
        "const titleSize = props.titleFontSize ?? (isPortrait ? 48 : 68);"
        "const bodySize = props.descriptionFontSize ?? (isPortrait ? 30 : 34);"
        "const o = interpolate(frame,[0,30],[0,1]); const s = spring({frame, fps});"
        "return <div style={{overflow:'hidden'}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "{isPortrait ? <span/> : <span/>}"
        "<FitText fontSize={titleSize} maxLines={2} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.headingFont || 'inherit'}}>{props.sceneTitle}</FitText>"
        "<FitText fontSize={bodySize} maxLines={4} containerWidth={800} maxHeight={300} "
        "style={{fontFamily: props.bodyFont || 'inherit'}}>{props.displayText}</FitText>"
        + PAD + "</div>; };"
    )
    doc = "THIS SCENE'S DESIGN (x):\nA text-only card.\nIMAGE — NONE. This scene takes no image."

    assert _safe_scene_code(code, "content", "SceneContent0", doc) == code, (
        "an image-less scene was replaced by the stub"
    )
    # Without the doc it is (wrongly) stubbed — which is the bug this pins.
    assert _safe_scene_code(code, "content", "SceneContent0", "") != code
