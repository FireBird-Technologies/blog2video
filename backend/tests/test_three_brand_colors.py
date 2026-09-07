"""A custom template has exactly three colours, and the template's win.

Two reported problems:

  1. The creator showed FIVE extracted colours (accent, bg, text, surface,
     muted). Only three ever reached the renderer — `derivePalette` takes
     `{accent, bg, bg2, text}` and derives panel/header/border/muted/grid from
     them — so the extra two were an invitation to off-brand hues.

  2. A Careem template rendered in the app's purple (#7C3AED). Cause:
     `get_preview_colors()` could not read a custom template (it never received
     a DB session), so the project stored the app default as its accent — and
     because `project.accent_color` is a NON-NULLABLE column, the expression
     `project.accent_color or theme_accent` was always truthy and the template's
     real colour was discarded on every render.
"""
from __future__ import annotations

import inspect

import pytest

from app.services.remotion import _APP_DEFAULT_COLORS, _project_color


# ── the purple ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize("slot", ["accent", "bg", "text"])
def test_a_defaulted_project_colour_does_not_override_the_template(slot: str) -> None:
    """The columns are non-nullable, so they ALWAYS hold a value. Treating that
    value as a user choice is what discarded the brand's colours."""
    assert _project_color(_APP_DEFAULT_COLORS[slot], slot) is None


def test_a_real_user_override_still_wins() -> None:
    """Settings > Colors must keep working — a fix that silently disabled it
    would trade one bug for another."""
    assert _project_color("#FF0000", "accent") == "#FF0000"


def test_the_default_check_is_case_insensitive() -> None:
    """The column is free text; a lowercase copy is the same default."""
    assert _project_color("#7c3aed", "accent") is None


def test_an_empty_value_is_not_an_override() -> None:
    assert _project_color("", "accent") is None
    assert _project_color(None, "accent") is None


def test_get_preview_colors_can_reach_the_database() -> None:
    """A custom template's meta is built from the DB, so without a session the
    lookup returned None for every custom template and the caller fell back to
    the app default."""
    from app.services.template_service import get_preview_colors

    params = inspect.signature(get_preview_colors).parameters
    assert "db" in params and "user_id" in params


# ── three colours ────────────────────────────────────────────────────────────


def test_the_extractor_requires_only_three_colours() -> None:
    """The guard returns None — discarding the ENTIRE extraction — so requiring
    keys the prompt no longer asks for would fail every extraction."""
    src = inspect.getsource(
        __import__("app.dspy_modules.theme_extractor", fromlist=["x"])
    )
    assert 'for key in ("accent", "bg", "text"):' in src
    assert '"surface", "muted"' not in src.split("Validate required fields")[1][:400]


def test_the_llm_is_told_only_three_brand_colours() -> None:
    """`secondary` (theme.colors.surface) used to be listed in the brand context,
    telling the model a fourth colour was available to draw with — while nothing
    rendered it and the off-palette gate would reject it."""
    from app.services.code_generator import _build_brand_context

    ctx = _build_brand_context(
        {"colors": {"accent": "#00eb79", "bg": "#f4f8fb", "text": "#1f2937",
                    "surface": "#e8eef4", "muted": "#8a9099"}},
        None, "Careem",
    )
    assert "#e8eef4" not in ctx.lower()
    assert "#8a9099" not in ctx.lower()
    assert "#00eb79" in ctx.lower()


def test_derived_slots_need_only_the_three_stored_colours() -> None:
    """derivePalette's Python mirror must resolve the same set whether or not a
    legacy theme still carries surface/muted — that is what makes dropping them
    a zero-pixel change."""
    from app.services.code_generator import _palette_slots

    three = {"colors": {"bg": "#f4f8fb", "text": "#1f2937", "accent": "#00eb79"}}
    five = {"colors": {**three["colors"], "surface": "#e8eef4", "muted": "#8a9099"}}
    assert _palette_slots(three) == _palette_slots(five)


# ── the design system must not invent colours ────────────────────────────────


def test_the_design_system_cannot_smuggle_in_a_fourth_colour() -> None:
    """The design system is handed to EVERY scene as authoritative CSS, so a
    colour invented there propagates into scene after scene — each of which the
    palette gate then rejects.

    Observed on a real run (template 164): the design system declared
    `--color-text-muted: #6B7280` and `--color-bg-end: #c7dbea`, the model used
    both as instructed, and two scenes were stubbed after burning three repair
    attempts each.
    """
    from app.services.code_generator import _build_brand_context, _strip_offpalette_css

    ctx = _build_brand_context(
        {"colors": {"accent": "#00EB79", "bg": "#F4F8FB", "text": "#111827"}},
        None,
        "Careem",
    )
    css = (
        ":root {\n"
        "  --color-primary: #00EB79;\n"
        "  --color-bg-base: #F4F8FB;\n"
        "  --color-bg-end: #c7dbea;\n"
        "  --color-text: #111827;\n"
        "  --color-text-muted: #6B7280;\n"
        "}\n"
        ".hero { background: linear-gradient(135deg, #F4F8FB 0%, #c7dbea 100%); }"
    )
    out = _strip_offpalette_css(css, ctx)

    # The two colours that actually stubbed scenes are gone.
    assert "#c7dbea" not in out.lower()
    assert "#6b7280" not in out.lower()
    # The brand's own three survive untouched.
    for keep in ("#00EB79", "#F4F8FB", "#111827"):
        assert keep in out, keep
    # And what replaced them names a slot, which is a standing instruction.
    assert "var(--palette-" in out


def test_the_filter_leaves_a_clean_design_system_alone() -> None:
    """A gate that rewrites correct input is how the last two incidents started."""
    from app.services.code_generator import _build_brand_context, _strip_offpalette_css

    ctx = _build_brand_context(
        {"colors": {"accent": "#00EB79", "bg": "#F4F8FB", "text": "#111827"}},
        None,
        "Careem",
    )
    css = ":root { --a: #00EB79; --b: #F4F8FB; --c: #111827; --hair: #E5E7EB; }"
    assert _strip_offpalette_css(css, ctx) == css


def test_the_filter_is_inert_without_a_resolvable_theme() -> None:
    from app.services.code_generator import _strip_offpalette_css

    css = ":root { --x: #c7dbea; }"
    assert _strip_offpalette_css(css, "no colours here") == css


# ─── Gradient: solid by default, accent-tinted, never touches text ───────────


def test_gradient_is_not_the_default() -> None:
    """Nine of twelve templates were getting a gradient nobody asked for.

    The old rule fired on `"gradients" in decorativeElements`, which the
    extractor lists for almost any modern site. A gradient is now something the
    user turns on in the editor, not something inferred from a weak signal.
    """
    from app.dspy_modules.theme_extractor import _decide_gradient

    for decorative in (["gradients"], ["gradients", "dots"], [], ["accent-lines"]):
        assert (
            _decide_gradient({"patterns": {"layout": {"decorativeElements": decorative}}})
            is False
        )


@pytest.mark.parametrize(
    "bg,accent",
    [
        ("#0B0B0B", "#76B900"),  # NVIDIA — dark bg, light accent
        ("#FFFFFF", "#635BFF"),  # Stripe — light bg, dark accent
        ("#FFFFFF", "#00EB79"),  # same-pole case
        ("#FAFAFA", "#E4002B"),
        ("#0A0A0A", "#7DEE4F"),
    ],
)
def test_bg2_is_accent_tinted_and_keeps_the_text_pole(bg: str, accent: str) -> None:
    """The gradient must read as the brand's accent AND stay legible.

    Four of five real brands have an accent on the opposite side of the
    light/dark divide from their bg, and a gradient spanning that divide has no
    text colour that works on both ends. So the stop walks toward the accent and
    stops at the last tint that keeps bg's pole.
    """
    from app.dspy_modules.theme_extractor import _compute_bg2, _readable_pole

    bg2 = _compute_bg2(bg, accent)
    assert bg2.lower() != bg.lower(), "bg2 is not distinguishable from bg"
    assert _readable_pole(bg2) == _readable_pole(bg), (
        f"bg2 {bg2} crosses the light/dark divide from bg {bg} — no single text "
        f"colour reads on both ends of that gradient"
    )


def test_bg2_falls_back_when_no_accent_is_given() -> None:
    from app.dspy_modules.theme_extractor import _compute_bg2

    assert _compute_bg2("#FFFFFF").lower() != "#ffffff"
