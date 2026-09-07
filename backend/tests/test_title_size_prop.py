"""The scene title must read the prop the editor's Title slider writes.

`props.titleFontSize` sizes `props.sceneTitle` — the scene's main label and the
largest type on the frame — and nothing else. `props.descriptionFontSize` sizes
everything else: the display text, every content prop, and every label or
caption. There are exactly two type tiers and no third.

This file used to assert the opposite. Under the previous contract
`titleFontSize` sized `props.displayText` (a paragraph) and the title was
demoted to a small eyebrow driven by a third prop, `props.sceneTitleFontSize`.
That prop is gone: a scene reading it gets a size no slider can move, which is a
dead control by construction.

Two of the three checks here are scored SOFT on purpose. The comment above
`_renders_headline` in code_validator.py records what a premature HARD gate cost
when the same idea was applied to the headline: template 177, five of nine
scenes stubbed, ~1400s spent on a rule the model could not satisfy. Promote only
after real generations show compliant scenes clearing it.

The regression that matters is the last test: `props.sceneTitle` used as a DATA
FALLBACK is not a rendered title, and must not be penalised.
"""
from __future__ import annotations

from app.services.code_generator import _score_valid_scene

_ARGS = {"scene_type": "content"}


def _score(code: str) -> float:
    return _score_valid_scene(code, _ARGS)


# A complete-enough scene body that the unrelated nudges in the scorer stay
# quiet; only the title handling differs between these fixtures.
_HEAD = (
    "const SceneComponent = (props) => {\n"
    "  const isPortrait = props.aspectRatio === 'portrait';\n"
    "  const titleSize = props.titleFontSize ?? (isPortrait ? 48 : 68);\n"
    "  const bodySize = props.descriptionFontSize ?? (isPortrait ? 30 : 34);\n"
)
# The title is the focal type; the display text and the small label are both
# ratios of bodySize, which is what "no third tier" means in practice.
_TAIL = (
    "  return (<div>\n"
    "    <FitText fontSize={titleSize} minFontSize={24} maxLines={2}>"
    "{props.sceneTitle}</FitText>\n"
    "    <div style={{fontSize: labelSize}}>{props.displayText}</div>\n"
    "  </div>);\n"
    "};\n"
)


def test_reading_the_removed_eyebrow_prop_is_penalised() -> None:
    """props.sceneTitleFontSize is not passed to a scene any more.

    A scene reading it sizes something off a value no slider writes, so the
    control the user is offered drives nothing.
    """
    reads_removed_prop = (
        _HEAD
        + "  const labelSize = props.sceneTitleFontSize ?? (bodySize * 0.8);\n"
        + _TAIL
    )
    compliant = _HEAD + "  const labelSize = bodySize * 0.8;\n" + _TAIL
    assert _score(reads_removed_prop) < _score(compliant), (
        "a scene reading the removed props.sceneTitleFontSize should score lower "
        "than the identical scene that derives its label from bodySize"
    )


def test_a_scene_with_no_title_is_penalised() -> None:
    """Every scene renders its title — it is what titleFontSize drives.

    A scene that paints only its display text leaves the Title slider with
    nothing on the frame responding to it.
    """
    no_title = _HEAD + "  const labelSize = bodySize * 0.8;\n" + (
        "  return (<div>\n"
        "    <FitText fontSize={titleSize} minFontSize={24} maxLines={2}>"
        "{props.displayText}</FitText>\n"
        "  </div>);\n"
        "};\n"
    )
    compliant = _HEAD + "  const labelSize = bodySize * 0.8;\n" + _TAIL
    assert _score(no_title) < _score(compliant), (
        "a scene that never renders props.sceneTitle should score lower than one "
        "that does"
    )


def test_the_compliant_form_is_not_penalised() -> None:
    """Deriving every secondary size from bodySize is exactly what rule 7 asks."""
    compliant = _HEAD + "  const labelSize = bodySize * 0.8;\n" + _TAIL
    without_label = _HEAD + (
        "  return (<div>\n"
        "    <FitText fontSize={titleSize} minFontSize={24} maxLines={2}>"
        "{props.sceneTitle}</FitText>\n"
        "    <div style={{fontSize: bodySize}}>{props.displayText}</div>\n"
        "  </div>);\n"
        "};\n"
    )
    # A ratio-derived label must cost nothing relative to not having one.
    assert _score(compliant) >= _score(without_label)


def test_the_bookend_contracts_own_idiom_counts_as_rendering_the_title() -> None:
    """The prompt must not penalise the code it asks for.

    _INTRO_CONTRACT and the ending contract both prescribe this exact shape, so
    that a scene whose two text props carry the same string paints it once:

        const title = (props.sceneTitle || '').trim();
        ...
        <FitText fontSize={titleSize}>{title}</FitText>

    The alias matcher required props.sceneTitle IMMEDIATELY after the `=`, so
    the leading paren hid it and every compliant bookend was charged -0.3 for
    "never renders props.sceneTitle" — a scene following the contract exactly,
    burning rollouts on a rule it had already satisfied.
    """
    compliant = _HEAD + (
        "  const title = (props.sceneTitle || '').trim();\n"
        "  const sub = (props.displayText || '').trim();\n"
        "  const labelSize = bodySize * 0.8;\n"
        "  return (<div>\n"
        "    <FitText fontSize={titleSize} minFontSize={24} maxLines={2}>{title}</FitText>\n"
        "    <div style={{fontSize: labelSize}}>{sub}</div>\n"
        "  </div>);\n"
        "};\n"
    )
    direct = _HEAD + "  const labelSize = bodySize * 0.8;\n" + _TAIL
    assert _score(compliant) == _score(direct), (
        "aliasing the title through the contract's own guard must score the same "
        "as interpolating props.sceneTitle directly"
    )


def test_scene_title_used_only_as_a_data_fallback_is_not_penalised() -> None:
    """The regression that matters.

    `props.sceneTitle` is also a legitimate DATA fallback. Detecting the title
    by "props.sceneTitle appears anywhere" would fire here, where the title is
    never painted as its own element — the same false-positive that made the
    headline gate unsatisfiable.
    """
    fallback_only = _HEAD + (
        "  const heading = props.displayText || props.sceneTitle || '';\n"
        "  return (<div>\n"
        "    <FitText fontSize={titleSize} minFontSize={24} maxLines={2}>{heading}</FitText>\n"
        "  </div>);\n"
        "};\n"
    )
    no_mention = _HEAD + (
        "  const heading = props.displayText || '';\n"
        "  return (<div>\n"
        "    <FitText fontSize={titleSize} minFontSize={24} maxLines={2}>{heading}</FitText>\n"
        "  </div>);\n"
        "};\n"
    )
    assert _score(fallback_only) == _score(no_mention), (
        "a data-fallback mention of props.sceneTitle is not a rendered title"
    )


# ─── Stock clip has nowhere to render ────────────────────────────────────────


def test_a_scene_that_ignores_has_video_is_penalised() -> None:
    """The template-196 defect: a clip is assigned, and nothing shows.

    props.imageUrl is undefined in the clip state (the render path must never
    hand a video URL to <Img>), so a slot gated on `hasImage` alone collapses
    and the scene takes its no-image branch — typically an opaque full-bleed
    gradient that covers the clip completely.
    """
    ignores = (
        "const SceneComponent = (props) => {\n"
        "  const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');\n"
        "  return (<div>{hasImage && <div data-content-img='1'/>}"
        "{!hasImage && <div style={{background:'linear-gradient(x)'}}/>}</div>);\n"
        "};\n"
    )
    reads_it = ignores.replace(
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');\n",
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');\n"
        "  const hasVideo = !!props.hasVideo;\n",
    )
    assert _score(ignores) < _score(reads_it)


# ─── Sample content must match the declared prop shapes ──────────────────────


def test_object_shaped_sample_fields_are_coerced_or_dropped() -> None:
    """Template 196 shipped two crashes because the filter checked KEY NAMES only.

    GeneratedSceneProps declares `quoteAuthor: string` and `bullets: string[]`.
    The model emitted an object and a list of objects; both were stored verbatim
    and crashed correct scene code at render:

        (author || 'Y').trim() is not a function
        Objects are not valid as a React child (found: {lead, detail})
    """
    import json

    from app.services.code_generator import _parse_sample_content

    quote = _parse_sample_content(
        json.dumps(
            {
                "sceneTitle": "What riders say about Yango",
                "displayText": "A rider story",
                "quote": "Yango gets me to work on time.",
                "quoteAuthor": {"name": "Ayesha Raza", "role": "Daily commuter"},
            }
        ),
        "quote",
    )
    assert isinstance(quote["quoteAuthor"], str), quote
    assert quote["quoteAuthor"] == "Ayesha Raza"

    bullets = _parse_sample_content(
        json.dumps(
            {
                "sceneTitle": "Why riders keep choosing Yango",
                "displayText": "Why riders choose Yango",
                "bullets": [
                    {"lead": "Upfront fares", "detail": "see the exact price"},
                    {"lead": "Cars in minutes", "detail": "under six minutes"},
                ],
            }
        ),
        "bullets",
    )
    assert all(isinstance(b, str) for b in bullets["bullets"]), bullets
    # The detail is folded in rather than thrown away.
    assert "Upfront fares" in bullets["bullets"][0]
    assert "exact price" in bullets["bullets"][0]


def test_well_formed_sample_content_is_untouched() -> None:
    import json

    from app.services.code_generator import _parse_sample_content

    out = _parse_sample_content(
        json.dumps(
            {
                "sceneTitle": "A well formed sample title",
                "displayText": "Plain copy",
                "bullets": ["One", "Two"],
            }
        ),
        "bullets",
    )
    assert out["bullets"] == ["One", "Two"]
    assert out["displayText"] == "Plain copy"


def test_unsalvageable_field_is_dropped_not_stored() -> None:
    """A field that cannot be coerced must vanish, so the deterministic fallback
    fills in — storing junk would just move the crash downstream."""
    import json

    from app.services.code_generator import _parse_sample_content

    out = _parse_sample_content(
        json.dumps({"displayText": "Copy", "bullets": [[1, 2], {"nope": True}]}),
        "bullets",
    )
    assert "bullets" not in out, out


# ─── Editable props (SOFT) ───────────────────────────────────────────────────


def test_a_content_scene_declaring_no_editable_props_is_penalised() -> None:
    """A scene that hardcodes every string leaves the user nothing to edit.

    In a real 9-scene template, 8 scenes had ZERO `props.layoutProps` reads and
    the whole template offered exactly one editable field. The contract asked
    for "2-5 per scene" in one line of the props list and nothing enforced it,
    so hardcoding passed at full score.

    SOFT, and content-only: a bookend legitimately has nothing beyond its title
    and CTA, and a hard gate there is the unsatisfiable-rule failure mode
    recorded in code_validator above _renders_headline.
    """
    bare = _HEAD + "  const labelSize = bodySize * 0.8;\n" + _TAIL
    declares = _HEAD + "  const labelSize = bodySize * 0.8;\n" + (
        "  const kicker = props.layoutProps?.kicker ?? 'KEY POINTS';\n"
        "  return (<div>\n"
        "    <span>{kicker}</span>\n"
        "    <FitText fontSize={titleSize} minFontSize={24} maxLines={2}>"
        "{props.sceneTitle}</FitText>\n"
        "    <div style={{fontSize: labelSize}}>{props.displayText}</div>\n"
        "  </div>);\n"
        "};\n"
    )
    assert _score(bare) < _score(declares), (
        "declaring editable props must score better than hardcoding every string"
    )


def test_a_bookend_is_exempt() -> None:
    """The intro carries a title and the outro a CTA — neither may have more.

    Asserted on whether the nudge FIRES rather than on the total, because an
    outro is scored by its own CTA/socials rules too and those dominate the
    number.
    """
    import contextlib
    import io

    bare = _HEAD + "  const labelSize = bodySize * 0.8;\n" + _TAIL
    fired = {}
    for role in ("content", "outro", "intro"):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            _score_valid_scene(bare, {"scene_type": role})
        fired[role] = "declares no editable props" in buf.getvalue()
    assert fired == {"content": True, "outro": False, "intro": False}, fired


# ─── The title must be SIZED by titleFontSize, not merely rendered ───────────


def _eyebrow_scene(title_size_expr: str, *, alias: bool = False) -> str:
    """A scene rendering props.sceneTitle at `title_size_expr`."""
    decl = "  const kicker = props.sceneTitle || '';\n" if alias else ""
    node = "{kicker}" if alias else "{props.sceneTitle}"
    return (
        "const SceneComponent = (props) => {\n"
        "  const { width, height } = useVideoConfig();\n"
        "  const frame = useCurrentFrame();\n"
        "  const isPortrait = props.aspectRatio === 'portrait';\n"
        "  const titleSize = props.titleFontSize ?? (isPortrait ? 48 : 68);\n"
        "  const bodySize = props.descriptionFontSize ?? (isPortrait ? 30 : 34);\n"
        "  const chromeSize = bodySize * 0.55;\n"
        "  const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');\n"
        "  const o = interpolate(frame,[0,30],[0,1]);\n"
        "  const s = spring({frame, fps});\n"
        + decl +
        "  return (<div style={{overflow:'hidden'}}>\n"
        "    {props.logoUrl && <Img src={props.logoUrl}/>}\n"
        "    {hasImage && <div data-content-img='1'><Img src={props.imageUrl}/></div>}\n"
        "    {isPortrait ? <span/> : <span/>}\n"
        f"    <div style={{{{fontSize: {title_size_expr}, fontFamily: props.headingFont || 'inherit'}}}}>{node}</div>\n"
        "    <FitText fontSize={bodySize} maxLines={4} containerWidth={900} maxHeight={400}"
        " style={{fontFamily: props.bodyFont || 'inherit'}}>{props.displayText}</FitText>\n"
        + "    " + ("x" * 600) + "\n"
        "  </div>);\n"
        "};\n"
    )


def test_a_title_sized_off_the_body_is_rejected() -> None:
    """The defect a real template shipped, which every other gate passed.

    SceneContent2 computed `chromeSize = bodySize * 0.55`, aliased sceneTitle to
    `kicker`, and rendered the kicker at chromeSize — while binding
    props.titleFontSize to the QUOTE. The read gate was satisfied (titleFontSize
    IS read somewhere), so nothing complained; the user dragged Title to 95 and
    the heading stayed at ~36, moving only with the OTHER slider.
    """
    from app.services.code_validator import validate_component_code

    for expr, alias in (("chromeSize", True), ("chromeSize", False), ("bodySize * 0.6", False)):
        ok, err = validate_component_code(_eyebrow_scene(expr, alias=alias), scene_type="content")
        assert not ok, f"{expr} (alias={alias}) should be rejected"
        assert "not an eyebrow" in (err or "").lower() or "derives from" in (err or ""), err


def test_a_title_sized_by_title_font_size_passes() -> None:
    """The fix the error asks for must itself pass — both forms."""
    from app.services.code_validator import validate_component_code

    for alias in (False, True):
        ok, err = validate_component_code(_eyebrow_scene("titleSize", alias=alias), scene_type="content")
        assert ok, err


def test_a_layout_props_kicker_beside_a_correct_title_passes() -> None:
    """The false positive this must not have.

    A legitimate small kicker from props.layoutProps sits immediately before the
    title. Scanning back a fixed window found the KICKER's fontSize and reported
    a correct scene, so the scan is bounded to the element's own tag.
    """
    from app.services.code_validator import validate_component_code

    code = (
        "const SceneComponent = (props) => {\n"
        "  const { width, height } = useVideoConfig();\n"
        "  const frame = useCurrentFrame();\n"
        "  const isPortrait = props.aspectRatio === 'portrait';\n"
        "  const titleSize = props.titleFontSize ?? (isPortrait ? 48 : 68);\n"
        "  const bodySize = props.descriptionFontSize ?? (isPortrait ? 30 : 34);\n"
        "  const labelSize = bodySize * 0.6;\n"
        "  const kicker = props.layoutProps?.kicker ?? 'KEY POINTS';\n"
        "  const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');\n"
        "  const o = interpolate(frame,[0,30],[0,1]);\n"
        "  const s = spring({frame, fps});\n"
        "  return (<div style={{overflow:'hidden'}}>\n"
        "    {props.logoUrl && <Img src={props.logoUrl}/>}\n"
        "    {hasImage && <div data-content-img='1'><Img src={props.imageUrl}/></div>}\n"
        "    {isPortrait ? <span/> : <span/>}\n"
        "    <div style={{fontSize: labelSize, fontFamily: props.bodyFont || 'inherit'}}>{kicker}</div>\n"
        "    <div style={{fontSize: titleSize, fontFamily: props.headingFont || 'inherit'}}>{props.sceneTitle}</div>\n"
        "    <FitText fontSize={bodySize} maxLines={4} containerWidth={900} maxHeight={400}"
        " style={{fontFamily: props.bodyFont || 'inherit'}}>{props.displayText}</FitText>\n"
        + "    " + ("x" * 600) + "\n"
        "  </div>);\n"
        "};\n"
    )
    ok, err = validate_component_code(code, scene_type="content")
    assert ok, err


def test_the_contract_states_the_ownership_rule() -> None:
    from app.services.code_generator import GenerateSceneCode

    doc = GenerateSceneCode.__doc__ or ""
    assert "props.sceneTitle IS NOT AN EYEBROW" in doc
    assert "titleSize sizes props.sceneTitle and NOTHING ELSE" in doc
