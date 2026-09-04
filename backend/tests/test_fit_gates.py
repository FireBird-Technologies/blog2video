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


def _scene(body: str, *, headline: bool = True, orientation_aware: bool = True) -> str:
    """A scene that satisfies every contract EXCEPT the one under test.

    `orientation_aware=False` drops the isPortrait declaration and everything
    derived from it, for the two tests that are specifically about a scene which
    ignores orientation. It is a parameter rather than a string replace on the
    result because the font defaults now reference isPortrait too, and stripping
    only the declaration would leave the fixture referencing an undeclared name.
    """
    # The font defaults are orientation-aware and in-band because this scene
    # declares isPortrait, and the typography gate requires both of a scene that
    # knows about orientation. Not what these tests are about — but a fixture
    # that trips an unrelated gate tests nothing.
    _title = "props.titleFontSize ?? (isPortrait ? 52 : 76)" if orientation_aware else "props.titleFontSize ?? 76"
    _body = (
        "const bodySize = props.descriptionFontSize ?? (isPortrait ? 30 : 34);"
        if orientation_aware
        else "const bodySize = props.descriptionFontSize ?? 34;"
    )
    # containerWidth/maxHeight are required of every FitText — see
    # _fit_geometry_defects. Not what most of these tests are about, but a
    # fixture that trips an unrelated gate tests nothing.
    _geom = "containerWidth={colW} maxHeight={boxH}"
    head = (
        f"<FitText fontSize={{{_title}}} {_geom}>" "{props.displayText}</FitText>"
        if headline
        else ""
    )
    return (
        "const SceneComponent = (props) => {"
        "const f = useCurrentFrame();"
        "const { width, height } = useVideoConfig();"
        "const colW = width * 0.44; const boxH = height * 0.34;"
        "const o = interpolate(f, [0, 20], [0, 1]);"
        "const sp = spring({ frame: f, fps: 30 });"
        + ("const isPortrait = props.aspectRatio === 'portrait';" if orientation_aware else "")
        # Binds the body-size slider. Every fixture here renders body copy of
        # some kind (a quote, metrics, bullets), and the typography gate requires
        # that such a scene read props.descriptionFontSize — otherwise the
        # editor's body slider moves nothing. Not the subject of these tests,
        # but required for them to reach the gate they are actually about.
        + _body + "\n" + _PAD + "\n"
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
        "<FitText maxLines={4} maxHeight={420} containerWidth={colW}>{props.quote}</FitText>",
        # Hoisted into a local first — the natural way to write the fallback
        # the contract asks for.
        "<FitText maxLines={4} containerWidth={colW} maxHeight={boxH}>{props.quote || props.displayText}</FitText>",
    ],
)
def test_a_fitted_quote_passes(body: str) -> None:
    """FitText is the only fitter left; RevealText went with the rest of the
    kit, so it is no longer an accepted way to satisfy this gate."""
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


def test_metrics_fitted_inside_the_map_passes() -> None:
    """The shape a metrics scene must actually write, now that the kit is gone.

    StatGrid/MetricRow used to satisfy this gate, and the error message named
    them as the fix — but they are in _FORBIDDEN_KIT_RE, so a scene that used
    one was rejected by the kit-scope gate instead. Every possible answer
    failed, and metrics scenes burned all three attempts and stubbed. The
    numerals are hand-rolled now, each wrapped in its own <FitText>.
    """
    body = (
        "{(props.metrics ?? []).slice(0, isPortrait ? 3 : 4).map((m, i) => ("
        "<FitText key={i} fontSize={props.titleFontSize ?? (isPortrait ? 52 : 76)} maxLines={1} containerWidth={colW}>"
        "{m.value}</FitText>))}"
    )
    ok, err = validate_component_code(_scene(body), scene_type="content", collect_all=True)
    assert ok, err


def _alias_chain_scene(numeral: str) -> str:
    """A metrics scene whose numerals sit THREE alias hops from props.metrics.

    Built directly rather than through `_scene`, whose `body` is injected inside
    the JSX tree — these declarations have to live in the component body.
    """
    return (
        "const SceneComponent = (props) => {"
        "const f = useCurrentFrame();"
        "const { width, height } = useVideoConfig();"
        "const colW = width * 0.44; const boxH = height * 0.34;"
        "const isPortrait = props.aspectRatio === 'portrait';"
        "const bodySize = props.descriptionFontSize ?? (isPortrait ? 30 : 34);"
        "const o = interpolate(f, [0, 20], [0, 1]);"
        "const sp = spring({ frame: f, fps: 30 });"
        # The two hops the content contract's empty-state instruction creates.
        "const items = (props.metrics ?? []).slice(0, isPortrait ? 3 : 4);"
        "const fallback = items.length === 0"
        " ? (props.displayText || '').split('. ').filter(Boolean)"
        " : items;"
        + "\n" + _PAD + "\n"
        "return (<AbsoluteFill style={{ overflow: 'hidden', background: palette.bg,"
        " overflowWrap: 'break-word', minWidth: 0,"
        " fontFamily: props.bodyFont || 'inherit' }}>"
        "<span style={{ fontFamily: props.headingFont || 'inherit' }}>{props.sceneTitle}</span>"
        "{props.logoUrl && <Img src={props.logoUrl} />}"
        "{props.imageUrl && <div data-content-img><Img src={props.imageUrl} /></div>}"
        "<FitText fontSize={props.titleFontSize ?? (isPortrait ? 52 : 76)} containerWidth={colW} maxHeight={boxH}>"
        "{props.displayText}</FitText>"
        "{fallback.map((m, i) => (" + numeral + "))}"
        "</AbsoluteFill>); };"
    )


def test_metrics_fitted_through_an_empty_state_alias_passes() -> None:
    """The alias chain the content contract itself produces.

    That contract tells a scene to stay presentable when its array is empty
    ("fall back to props.displayText rather than rendering nothing"), and every
    metrics scene writes it the same way — which puts THREE hops between the
    prop and the callback parameter the numeral is actually read from:

        const items    = (props.metrics ?? []).slice(0, 4);
        const fallback = items.length === 0 ? <sentences> : items;
        {fallback.map((m, i) => <FitText>{m.value}</FitText>)}

    The alias walk ran a fixed two hops, so `m` was never bound and a scene
    that HAD wrapped its numerals was told to wrap them — identically, on every
    repair, until the rollouts ran out. Template 199 scene 1 burned all three
    that way. Unsatisfiable gates are the most expensive defect in this
    pipeline, which is why each one that surfaces gets pinned here.
    """
    code = _alias_chain_scene(
        "<FitText key={i} fontSize={bodySize * 1.8} maxLines={1} containerWidth={colW} maxHeight={boxH}>"
        "{m.value}</FitText>"
    )
    ok, err = validate_component_code(code, scene_type="content", collect_all=True)
    assert ok, err


def test_an_unfitted_numeral_behind_the_same_alias_chain_still_fails() -> None:
    """The counterpart — widening the alias walk must not blind the gate."""
    code = _alias_chain_scene('<div key={i} style={{ fontSize: 96 }}>{m.value}</div>')
    ok, _err = validate_component_code(code, scene_type="content", collect_all=True)
    assert not ok


@pytest.mark.parametrize("body", [
    '<StatGrid items={props.metrics} arrangement="ledger" />',
    "<MetricRow items={props.metrics} />",
])
def test_kit_components_are_rejected(body: str) -> None:
    """The counterpart: the kit is no longer available to generated scenes, so
    delegating to it must FAIL rather than silently score as fitted.

    The message is deliberately not asserted — several gates legitimately fire
    on such a scene (it is also unfitted and unbranched), and pinning one
    wording would break on any reordering. What matters is that it does not
    pass.
    """
    ok, _err = validate_component_code(_scene(body), scene_type="content", collect_all=True)
    assert not ok


# ── orientation ──────────────────────────────────────────────────────────────


def test_a_list_scene_must_adapt_to_the_aspect_ratio() -> None:
    """A landscape scene showed two stats stacked vertically — the portrait
    shape used in the wrong orientation. This was a -0.15 score nudge a scene
    could buy back, so it shipped."""
    body = (
        "<FitText containerWidth={colW} maxHeight={boxH}>{props.bullets.join(' ')}</FitText>"
        "<div>{props.bullets.map((b, i) => (<p key={i}>{b}</p>))}</div>"
    )
    assert _fails_on(_scene(body, orientation_aware=False), "isPortrait")


def test_branching_on_isPortrait_satisfies_it() -> None:
    body = (
        "<FitText containerWidth={colW} maxHeight={boxH}>{props.bullets.join(' ')}</FitText>"
        "<div style={{ flexDirection: isPortrait ? 'column' : 'row' }}>"
        "{props.bullets.map((b, i) => (<p key={i}>{b}</p>))}</div>"
    )
    ok, err = validate_component_code(_scene(body), scene_type="content", collect_all=True)
    assert ok, err


def test_a_scene_with_no_list_is_not_forced_to_branch() -> None:
    """A centred headline reads the same in both orientations. Forcing it to
    branch would be a gate failing correct code."""
    code = _scene(
        "<p style={{ fontSize: bodySize }}>{props.displayText}</p>",
        orientation_aware=False,
    )
    ok, err = validate_component_code(code, scene_type="content", collect_all=True)
    assert ok, err


# ── font-size DEFAULTS ───────────────────────────────────────────────────────
#
# The gates above prove the size PROPS are read. These pin the value a scene
# falls back to when the user has not touched a slider — which is what every
# preview and every render actually shows, because the sliders start unset.

from app.services.code_validator import _font_default_defects  # noqa: E402


def _defect_text(code: str) -> str:
    return " ".join(_font_default_defects(code)).lower()


def test_the_headline_default_must_beat_the_body_default() -> None:
    """An inverted hierarchy renders the paragraph as loud as the headline."""
    # Every value is inside its own band, so the ONLY thing wrong here is the
    # ordering — which is what makes this a test of the hierarchy rule rather
    # than of the band rule.
    code = (
        "const isPortrait = 1;"
        "const t = props.titleFontSize ?? (isPortrait ? 36 : 48);"
        "const b = props.descriptionFontSize ?? (isPortrait ? 38 : 44);"
    )
    text = _defect_text(code)
    assert "not larger than" in text
    # Portrait (36 <= 38) is the inverted one; landscape (48 > 44) is fine and
    # must NOT be reported, or the error sends the model chasing a non-defect.
    assert "in portrait the headline default" in text
    assert "in landscape the headline default" not in text


def test_a_correct_hierarchy_is_not_reported() -> None:
    code = (
        "const isPortrait = 1;"
        "const t = props.titleFontSize ?? (isPortrait ? 52 : 76);"
        "const b = props.descriptionFontSize ?? (isPortrait ? 30 : 34);"
    )
    assert _font_default_defects(code) == []


def test_the_defaults_the_prompt_used_to_ask_for_are_rejected() -> None:
    """The prompt told the model to write `?? (isPortrait ? 84 : 96)`.

    Both numbers are above the headline ceiling (60 portrait / 88 landscape), so
    the model was being penalised for following its own instructions. This pins
    the band that the prompt now agrees with.
    """
    code = (
        "const isPortrait = 1;"
        "const t = props.titleFontSize ?? (isPortrait ? 84 : 96);"
        "const b = props.descriptionFontSize ?? (isPortrait ? 30 : 34);"
    )
    text = _defect_text(code)
    assert "outside the" in text and "84px" in text and "96px" in text


def test_type_below_the_floor_is_rejected() -> None:
    code = (
        "const isPortrait = 1;"
        "const t = props.titleFontSize ?? (isPortrait ? 52 : 76);"
        "const b = props.descriptionFontSize ?? (isPortrait ? 12 : 14);"
    )
    assert "unreadable" in _defect_text(code)


def test_a_flat_default_is_rejected_only_when_the_scene_knows_about_orientation() -> None:
    """Portrait is 1080 wide against landscape's 1920 — one size cannot serve
    both. But a scene with no isPortrait at all is the orientation gate's
    business, and reporting both would send two errors for one cause."""
    aware = "const isPortrait = 1; const t = props.titleFontSize ?? 76;"
    assert "flat default" in _defect_text(aware)

    unaware = "const t = props.titleFontSize ?? 76;"
    assert _font_default_defects(unaware) == []


def test_a_negated_ternary_is_read_in_the_right_order() -> None:
    """`!isPortrait ? A : B` puts landscape first. Reading it backwards would
    turn a correct scene into a reported defect."""
    code = (
        "const isPortrait = 1;"
        "const t = props.titleFontSize ?? (!isPortrait ? 76 : 52);"
        "const b = props.descriptionFontSize ?? (isPortrait ? 30 : 34);"
    )
    assert _font_default_defects(code) == []


def test_a_computed_default_is_left_alone() -> None:
    """Guessing at an expression would reject correct scenes, and a false
    positive costs a full LLM rollout."""
    code = (
        "const isPortrait = 1;"
        "const t = props.titleFontSize ?? Math.min(76, width * 0.05);"
    )
    assert _font_default_defects(code) == []


def test_body_copy_must_bind_the_body_slider_even_with_one_size() -> None:
    """The gate used to need 2+ distinct hardcoded sizes before firing, so a
    scene that sized all its body copy with ONE literal shipped with a dead
    slider — the user drags it and nothing moves."""
    body = "<p style={{ fontSize: 32 }}>{(props.bullets ?? [])[0]}</p>"
    code = _scene(body).replace(
        "const bodySize = props.descriptionFontSize ?? (isPortrait ? 30 : 34);", ""
    )
    assert _fails_on(code, "descriptionFontSize")


# ── Easing ───────────────────────────────────────────────────────────────────
#
# Not a fit gate, but the same class of defect: a scene that looks fine to every
# static check and then destroys the preview at runtime. `Easing.inOutCubic` has
# no such member in Remotion — it reads as `undefined`, Remotion CALLS it, and
# the "easing is not a function" throw unwinds into Remotion's own
# ErrorBoundary, which remounts the tree and re-runs the crash. One bad scene
# froze the whole templates page (measured on template 182, scene content3).

from app.services.code_validator import _easing_defects, _suggest_easing  # noqa: E402


@pytest.mark.parametrize("member", [
    "inOutCubic",
    "easeInOut",
    "inOutQuad",
    "easeOutBack",
    "quint",        # plausible, and the old runtime stub even vouched for it
])
def test_invented_easing_members_are_rejected(member: str) -> None:
    defects = _easing_defects(f"easing: Easing.{member}")
    assert defects, f"Easing.{member} does not exist but was accepted"
    assert "does not exist" in defects[0]


def test_an_invented_curve_inside_a_combinator_is_rejected() -> None:
    """`Easing.out(Easing.quint)` — the form that actually shipped, in 6 of 9
    scenes of template 184.

    This is the DANGEROUS shape, and it is why the preview guard cannot simply
    type-check the easing. `quint` does not exist, so the argument is
    `undefined` — but the combinator still returns a closure
    (`(t) => 1 - easing(1 - t)`), which IS a function. A type check waves it
    through and the TypeError only lands when Remotion invokes it mid-render.
    A bare `Easing.inOutCubic` is by contrast harmless: interpolate defaults it
    via `options?.easing ?? ((num) => num)`.
    """
    defects = _easing_defects("easing: Easing.out(Easing.quint)")
    assert defects and "quint" in defects[0]


@pytest.mark.parametrize("usage", [
    "easing: Easing.inOut(Easing.cubic)",
    "easing: Easing.out(Easing.quad)",
    "easing: Easing.in(Easing.exp)",
    "easing: Easing.bezier(0.25, 0.1, 0.25, 1)",
    "easing: Easing.linear",
    "easing: Easing.cubic",
    "easing: Easing.elastic(1)",
])
def test_real_easing_usage_passes(usage: str) -> None:
    """A false positive here costs a full LLM rollout, so the legal forms —
    including a bare curve passed as an argument — must all survive."""
    assert _easing_defects(usage) == []


def test_the_suggestion_names_the_correct_composition() -> None:
    """The error is only actionable if it says what to write instead."""
    assert _suggest_easing("inOutCubic") == "Easing.inOut(Easing.cubic)"
    assert _suggest_easing("outBack") == "Easing.out(Easing.back)"
    # Remotion spells it `sin`, not `sine` — a likely invention, worth mapping.
    assert _suggest_easing("inOutSine") == "Easing.inOut(Easing.sin)"
    # Unrecognisable: fall back to the safe default rather than inventing one.
    assert _suggest_easing("wobble") == "Easing.inOut(Easing.cubic)"


def test_a_bad_easing_fails_the_whole_validator() -> None:
    """The helper is wired into validate_component_code, not just callable."""
    code = _scene(
        "<p style={{ fontSize: bodySize }}>"
        "{interpolate(f, [0, 20], [0, 1], { easing: Easing.inOutCubic })}</p>"
    )
    assert _fails_on(code, "does not exist")


# ── FitText must be told its box ─────────────────────────────────────────────
#
# The auto-fit was a NO-OP on every generated scene. Measured on stored
# template 184: not one of its 9 scenes passed `containerWidth`, and 8 of 9
# passed no `maxHeight`. Without containerWidth, FitText sizes against 86% of
# the FULL canvas instead of the column the text is in — roughly a 2x
# overestimate — so a designed 76px headline rendered at 95-122px and then
# broke mid-word. Where a scene DID bound its box, the inflated seed drove the
# fitter to its floor instead. Both reported symptoms, one cause.

from app.services.code_validator import _fit_geometry_defects  # noqa: E402


def test_a_fittext_without_containerwidth_is_rejected() -> None:
    code = "<FitText fontSize={titleSize} maxLines={3}>{props.displayText}</FitText>"
    defects = _fit_geometry_defects(code)
    assert any("containerWidth" in d for d in defects)


def test_a_missing_maxheight_is_a_nudge_not_a_rejection() -> None:
    """maxHeight is scored, not gated — a deliberate asymmetry.

    containerWidth is what fixes the reported bug (the ~2x width overestimate),
    and the kit cannot recover from its absence because it cannot know the
    column width. A missing maxHeight now degrades to a canvas-relative budget
    instead of disabling the fit, so rejecting over it would burn repair rounds
    on a refinement rather than a defect.
    """
    from app.services.code_validator import _missing_fit_max_height

    wrappable = (
        "<FitText fontSize={titleSize} maxLines={3} containerWidth={colW}>"
        "{props.displayText}</FitText>"
    )
    # Not a hard defect...
    assert _fit_geometry_defects(wrappable) == []
    # ...but it IS detected, so the scorer can nudge toward it.
    assert _missing_fit_max_height(wrappable) is True

    # A single-line fitter cannot overflow downward and is not nudged.
    assert _missing_fit_max_height(
        "<FitText maxLines={1} containerWidth={cellW}>{m.value}</FitText>"
    ) is False


def test_a_single_line_fittext_does_not_need_maxheight() -> None:
    """A numeral or label pinned to one line cannot overflow downward, and
    demanding a height budget there would reject correct code."""
    code = (
        "<FitText fontSize={numeralSize} maxLines={1} containerWidth={cellW}>"
        "{m.value}</FitText>"
    )
    assert _fit_geometry_defects(code) == []


def test_a_fully_specified_fittext_passes() -> None:
    code = (
        "<FitText fontSize={titleSize} minFontSize={34} maxLines={3} "
        "containerWidth={colW} maxHeight={height * 0.34}>"
        "{props.displayText}</FitText>"
    )
    assert _fit_geometry_defects(code) == []


def test_a_fittext_written_in_a_COMMENT_is_not_a_real_element() -> None:
    """Scenes carry comments explaining the contract, and the stub's own comment
    mentions <FitText>. Matching prose as an attribute-less element made the
    stub fail its own gate."""
    code = (
        "// wrap the headline in <FitText> so it fits its box\n"
        "/* see <FitText> above */\n"
        "<FitText fontSize={t} maxLines={3} containerWidth={w} maxHeight={h}>x</FitText>"
    )
    assert _fit_geometry_defects(code) == []


def test_the_stub_satisfies_the_geometry_gate() -> None:
    """The stub is the floor a scene falls back to. If it cannot clear the
    gates, the floor is not a floor."""
    from app.services.code_generator import _build_stub_scene_code

    theme = {"colors": {"bg": "#0B0B0B", "text": "#FFFFFF", "accent": "#76B900"}}
    for scene_type in ("intro", "content", "outro"):
        code = _build_stub_scene_code(scene_type, theme)
        assert _fit_geometry_defects(code) == [], scene_type
        ok, err = validate_component_code(
            code, scene_type=scene_type, collect_all=True, theme=theme
        )
        assert ok, f"{scene_type}: {err}"


# ── unsatisfiable-gate regressions ───────────────────────────────────────────
#
# Every entry here is a gate that once demanded something its own regex then
# rejected. That class is the most expensive defect in this pipeline: an
# ordinary rejection costs one rollout, an unsatisfiable one costs all eight and
# then ships the deterministic stub.


def test_container_width_via_a_spread_is_accepted() -> None:
    """Hoisting shared FitText props into one object is correct code.

    The gate read only the literal attribute text inside each `<FitText …>` tag,
    so `<FitText {...fitProps}>` reported "does not pass containerWidth" no
    matter what `fitProps` contained. Rule 2 actively encourages deriving the
    width once from useVideoConfig(), and a `.map()` over several items is
    exactly where a model hoists — so the repair that a reasonable model reaches
    for made the error permanent.
    """
    from app.services.code_validator import _fit_geometry_defects

    code = (
        "const fitProps = { containerWidth: colW, maxHeight: boxH };"
        "<FitText {...fitProps} fontSize={titleSize}>{props.sceneTitle}</FitText>"
    )
    assert _fit_geometry_defects(code) == []


def test_a_spread_without_container_width_is_still_reported() -> None:
    """Accepting a spread must not accept an EMPTY one."""
    from app.services.code_validator import _fit_geometry_defects

    code = (
        "const other = { maxHeight: boxH };"
        "<FitText {...other} fontSize={titleSize}>{props.sceneTitle}</FitText>"
    )
    assert _fit_geometry_defects(code)


def test_every_unfitted_tag_is_counted_not_just_the_first() -> None:
    """The gate used to `break` after one, so N bad tags needed N attempts.

    With three repairs available, a scene with four unfitted FitTexts could not
    converge however correctly it responded each time.
    """
    from app.services.code_validator import _fit_geometry_defects

    code = (
        "<FitText fontSize={a}>A</FitText>"
        "<FitText fontSize={b}>B</FitText>"
        "<FitText fontSize={c}>C</FitText>"
    )
    defects = _fit_geometry_defects(code)
    assert len(defects) == 1, "still one message, not a wall of identical text"
    assert "3 <FitText>" in defects[0], defects


def test_a_local_style_object_is_not_a_forbidden_kit_component() -> None:
    """`cardStyle` is what anyone names a style object.

    Matched with a bare word boundary, `const cardStyle = {...}` was reported as
    "uses pre-built component(s) that are not available to it: cardStyle. Build
    these elements yourself with plain JSX and inline styles" — which that line
    already does. The only fix is a rename, and the message never said so.
    Observed in production.
    """
    from app.services.code_validator import _forbidden_kit_names

    assert _forbidden_kit_names("const cardStyle = { padding: 40 };") == []
    assert _forbidden_kit_names("const typeScale = bodySize * 1.2;") == []
    assert _forbidden_kit_names("<div style={cardStyle}>x</div>") == []


def test_a_real_kit_usage_is_still_forbidden() -> None:
    """The counterpart: relaxing the match must not blind the gate."""
    from app.services.code_validator import _forbidden_kit_names

    assert _forbidden_kit_names("<StatGrid items={props.metrics} />") == ["StatGrid"]
    assert _forbidden_kit_names("const s = cardStyle({ tone: 'panel' });") == ["cardStyle"]
    assert _forbidden_kit_names("const s = kit.typeScale;") == ["typeScale"]


def test_the_kit_error_tells_the_model_to_rename() -> None:
    """Naming the fix is what makes the error satisfiable at all."""

    # The kit-scope message is a DESIGN-DOC defect (a scored signal), not one of
    # validate_component_code's hard gates, so it is read from there directly.
    from app.services.code_validator import _design_doc_defects

    defects = _design_doc_defects("<Decor system='rules'/>", "content", "")
    joined = " ".join(defects)
    assert "Decor" in joined, defects
    assert "RENAME" in joined, defects


# ── string[] props read as if their items were objects ───────────────────────


def _array_prop_scene(prop: str, item_expr: str) -> str:
    """A scene that maps a string[] prop and renders `item_expr` per entry."""
    return (
        "const SceneComponent = (props) => {"
        "const f = useCurrentFrame();"
        "const { width, height } = useVideoConfig();"
        "const colW = width * 0.44; const boxH = height * 0.34;"
        "const isPortrait = props.aspectRatio === 'portrait';"
        "const bodySize = props.descriptionFontSize ?? (isPortrait ? 30 : 34);"
        "const o = interpolate(f, [0, 20], [0, 1]);"
        "const sp = spring({ frame: f, fps: 30 });"
        f"const items = (props.{prop} ?? []).slice(0, isPortrait ? 3 : 4);"
        + "\n" + _PAD + "\n"
        "return (<AbsoluteFill style={{ overflow: 'hidden', background: palette.bg,"
        " overflowWrap: 'break-word', minWidth: 0,"
        " fontFamily: props.bodyFont || 'inherit' }}>"
        "<span style={{ fontFamily: props.headingFont || 'inherit' }}>{props.sceneTitle}</span>"
        "{props.logoUrl && <Img src={props.logoUrl} />}"
        "{props.imageUrl && <div data-content-img><Img src={props.imageUrl} /></div>}"
        "<FitText fontSize={props.titleFontSize ?? (isPortrait ? 52 : 76)} containerWidth={colW} maxHeight={boxH}>"
        "{props.displayText}</FitText>"
        "{items.map((item, i) => ("
        f"<FitText key={{i}} fontSize={{bodySize}} maxLines={{1}} containerWidth={{colW}} maxHeight={{boxH}}>{item_expr}</FitText>"
        "))}"
        "</AbsoluteFill>); };"
    )


@pytest.mark.parametrize("prop", ["bullets", "steps", "codeLines"])
def test_reading_a_field_off_a_string_item_is_rejected(prop: str) -> None:
    """The production defect, in a form no gate previously saw.

    `bullets`, `steps` and `codeLines` are declared `string[]`. A real generated
    scene mapped props.steps and rendered `{step.description}` — undefined on a
    string, so every row drew blank. The contract's example showed `{item}` but
    never said the item has no fields, and nothing checked how an array prop was
    consumed.
    """
    ok, err = validate_component_code(
        _array_prop_scene(prop, "{item.description}"), scene_type="content"
    )
    assert not ok
    assert f"props.{prop} is a list of PLAIN STRINGS" in (err or ""), err


def test_rendering_the_item_itself_passes() -> None:
    """The fix the error message asks for must itself pass."""
    ok, err = validate_component_code(
        _array_prop_scene("steps", "{item}"), scene_type="content"
    )
    assert ok, err


@pytest.mark.parametrize("prop,field", [("timelineItems", "label"), ("metrics", "value")])
def test_object_props_may_still_be_read_by_field(prop: str, field: str) -> None:
    """The counterpart: these ARE object arrays in the contract.

    Both shapes sit in the same taxonomy, so a gate that could not tell them
    apart would reject correct code — the unsatisfiable-rule failure this
    pipeline has paid for twice.
    """
    ok, err = validate_component_code(
        _array_prop_scene(prop, "{item.%s}" % field), scene_type="content"
    )
    assert ok, err
