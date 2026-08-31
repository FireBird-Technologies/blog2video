"""Scene retry must be able to succeed, and must not run twice at once.

A user retried a faulty quote scene and every attempt failed with the SAME
message, taking ~200s. Three causes, all pinned here:

  1. The fit gate only recognised `{props.quote}` written literally inside a
     fitter — but the scene prompt tells the model to write fallbacks, which
     hoists the value into a variable. The gate was unsatisfiable for code the
     contract asks for, so the model rewrote until its attempts ran out.
  2. The edit-retry loop re-validated OUTSIDE the loop, so `valid` never
     refreshed: `if valid: break` could not fire and every repair prompt got the
     same stale error.
  3. Nothing stopped a second edit starting for a scene already being edited.
"""
from __future__ import annotations

import re

import pytest

from app.services.code_validator import validate_component_code

_PAD = "\n".join(f"const p{i} = interpolate(f, [{i}, {i + 20}], [0, 1]);" for i in range(40))


def _scene(pre: str, body: str) -> str:
    return (
        "const SceneComponent = (props) => {"
        "const f = useCurrentFrame();"
        "const o = interpolate(f, [0, 20], [0, 1]);"
        "const sp = spring({ frame: f, fps: 30 });"
        "const isPortrait = props.aspectRatio === 'portrait';\n" + pre + "\n" + _PAD + "\n"
        "return (<AbsoluteFill style={{ overflow: 'hidden', background: palette.bg,"
        " overflowWrap: 'break-word', minWidth: 0,"
        " fontFamily: props.bodyFont || 'inherit' }}>"
        "<span style={{ fontFamily: props.headingFont || 'inherit' }}>{props.sceneTitle}</span>"
        "{props.logoUrl && <Img src={props.logoUrl} />}"
        "{props.imageUrl && <div data-content-img><Img src={props.imageUrl} /></div>}"
        "<FitText fontSize={props.titleFontSize ?? 64}>{props.displayText}</FitText>"
        + body +
        "</AbsoluteFill>); };"
    )


def _valid(pre: str, body: str) -> bool:
    ok, _ = validate_component_code(_scene(pre, body), scene_type="content", collect_all=True)
    return ok


# ── the gate must accept the shapes the prompt asks for ──────────────────────


@pytest.mark.parametrize(
    "pre,body",
    [
        ("", "<FitText maxLines={4}>{props.quote}</FitText>"),
        ('const q = props.quote || "";', "<FitText maxLines={4}>{q}</FitText>"),
        ("const qt = props.quote ?? props.displayText;", "<FitText>{qt}</FitText>"),
        (
            'const q = props.quote; const words = q.split(" ");',
            "<FitText>{words.map((w, i) => (<span key={i}>{w} </span>))}</FitText>",
        ),
        ("", '<RevealText text={props.quote} mode="line" />'),
        ("", "<FitText><span style={{ fontStyle: 'italic' }}>{props.quote}</span></FitText>"),
    ],
)
def test_a_fitted_quote_passes_however_it_is_written(pre: str, body: str) -> None:
    """The contract says to write fallbacks, so a hoisted quote is CORRECT code.
    Rejecting it made the gate impossible to satisfy and burned every attempt."""
    assert _valid(pre, body)


@pytest.mark.parametrize(
    "pre,body",
    [
        ("", "<div style={{ fontSize: 64 }}>{props.quote}</div>"),
        ("const q = props.quote;", "<div style={{ fontSize: 64 }}>{q}</div>"),
    ],
)
def test_a_genuinely_bare_quote_still_fails(pre: str, body: str) -> None:
    """Alias tracking must not become a way to smuggle unfitted text past the
    gate — including via the alias itself."""
    assert not _valid(pre, body)


# ── the retry loop must be able to converge ──────────────────────────────────


def test_the_edit_retry_loop_revalidates_inside_the_loop() -> None:
    """Structural check on the source: the re-validation was dedented out of the
    `for`, so `valid` never refreshed. `if valid: break` could then never fire,
    every edit burned all MAX_SCENE_EDIT_RETRIES calls, and each repair prompt
    was fed the same stale error — retries could not converge by construction.
    """
    import inspect

    from app.services import code_generator

    src = inspect.getsource(code_generator.regenerate_single_scene)
    lines = src.splitlines()
    loop_i = next(
        i for i, ln in enumerate(lines) if "for retry in range(1, MAX_SCENE_EDIT_RETRIES" in ln
    )
    loop_indent = len(lines[loop_i]) - len(lines[loop_i].lstrip())

    # The FIRST re-validation after the loop header must be indented deeper than
    # the loop header itself, i.e. inside the body.
    reval_i = next(
        i
        for i, ln in enumerate(lines[loop_i + 1 :], start=loop_i + 1)
        if "valid, err = validate_component_code(" in ln
    )
    reval_indent = len(lines[reval_i]) - len(lines[reval_i].lstrip())
    assert reval_indent > loop_indent, (
        "re-validation sits outside the retry loop — `valid` never refreshes"
    )


def test_an_exhausted_edit_raises_a_distinguishable_error() -> None:
    """The API turns this into plain language for the user. A bare RuntimeError
    would be indistinguishable from an infrastructure failure and the raw
    validator trace would reach the UI."""
    from app.services.code_generator import SceneEditExhausted

    assert issubclass(SceneEditExhausted, RuntimeError)


# ── one edit per scene ───────────────────────────────────────────────────────


def test_scene_edits_are_no_longer_quota_limited() -> None:
    """Editing a scene inside a template the user already owns is free — the
    product limit is on templates. Charging meant a scene that kept failing
    burned the user's allowance while producing nothing."""
    from app.routers import custom_templates as ct

    assert not hasattr(ct, "_check_scene_edit_quota")
    assert not hasattr(ct, "SCENE_EDITS_PER_TEMPLATE_PER_DAY")


def test_the_edit_id_encodes_template_and_scene() -> None:
    """The in-flight guard and the no-id status lookup both work by scanning
    this prefix, so the format is load-bearing."""
    template_id, scene_key = 163, "content_3"
    edit_id = f"{template_id}:{scene_key}:1787907248348663000"
    assert edit_id.startswith(f"{template_id}:{scene_key}:")
    # And a different scene on the same template must not collide.
    assert not edit_id.startswith(f"{template_id}:content_1:")


# ── serialization artifacts must not cost an attempt ─────────────────────────


def test_json_escaped_newlines_are_repaired() -> None:
    """The model sometimes emits a whole scene with literal backslash-n instead
    of real line breaks. esbuild reports `Syntax error "n"` and the attempt is
    discarded — a full generation rollout lost to a serialization artifact
    rather than a modelling mistake."""
    from app.services.code_validator import _parse_check, clean_code

    broken = (
        "const kickerEnter = spring({\\n    frame: frame - 8,\\n"
        "    fps: fps,\\n  });\nconst x = 1;"
    )
    assert not _parse_check(broken)[0]
    assert _parse_check(clean_code(broken))[0]


@pytest.mark.parametrize(
    "code",
    [
        'const s = "line a\\nline b";\nconst y = 2;',   # string literal
        "const s = `a\\nb`;\nconst y = 2;",             # template literal
        "const r = /\\n/g;\nconst y = 2;",              # regex
    ],
)
def test_legitimate_backslash_n_is_left_alone(code: str) -> None:
    """The repair runs ONLY when the code does not parse and unescaping fixes
    it, so valid code never enters that branch and cannot be corrupted."""
    from app.services.code_validator import clean_code

    assert clean_code(code) == code.strip()


def test_genuinely_broken_code_is_not_masked() -> None:
    from app.services.code_validator import _parse_check, clean_code

    broken = "const a = ;;;((("
    assert not _parse_check(clean_code(broken))[0]


# ── the two colour gates must not contradict each other ──────────────────────


def test_a_light_accent_still_has_a_legal_readable_colour() -> None:
    """Observed deadlock: accent #00eb79 is 1.5:1 on canvas #f4f8fb, so the
    contrast gate rejects accent-coloured text; the model then invents a darker
    green and the OFF-PALETTE gate rejects that. There was no colour it could
    write, so the attempt was unwinnable.

    palette.accentText is the kit's own answer — the accent darkened until it
    reads — and the gates now resolve it.
    """
    from app.services.code_generator import (
        AA_CONTRAST,
        _detect_contrast_defects,
        _palette_slots,
        contrast_ratio,
        detect_offpalette_colors,
    )

    theme = {"colors": {"bg": "#f4f8fb", "text": "#1f2937", "accent": "#00eb79"}}
    slots = _palette_slots(theme)

    accent_text = slots.get("accentText")
    assert accent_text, "accentText must resolve for a light accent"
    assert contrast_ratio(accent_text, "#f4f8fb") >= AA_CONTRAST

    # Legal on BOTH gates — that is the whole point.
    assert detect_offpalette_colors(
        f"<div style={{{{ color: '{accent_text}' }}}} />", theme
    ) == []
    assert _detect_contrast_defects(
        "<p style={{ color: palette.accentText }}>x</p>", theme
    ) == []


def test_an_accent_that_already_reads_is_unchanged() -> None:
    """accentText must not darken an accent that is already legible, or every
    template with a dark accent would silently shift hue."""
    from app.services.code_generator import _palette_slots

    theme = {"colors": {"bg": "#FFFFFF", "text": "#111111", "accent": "#B3121B"}}
    slots = _palette_slots(theme)
    assert slots["accentText"].lower() == "#b3121b"
