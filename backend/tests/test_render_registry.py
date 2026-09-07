"""Keep render_registry.py in sync with what the renderer can actually draw.

These are the parity assertions ported from the deleted test_kit_vocabulary.py.
They are the whole reason render_registry exists: a value that drifts out of
sync does not raise, it silently falls through to a default at render time with
nothing in the logs — the design doc asked for a distinct typeface/motif and the
video quietly shipped the generic one.

Note what is NOT tested here any more: there is no "the prompt lists every
vocabulary value" test, because no prompt lists them. That test existed to prove
the model was being handed the full menu, and the menu is exactly what this
refactor removed.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.render_registry import (
    DECOR_SYSTEMS,
    DEFAULT_TRANSITION_FAMILY,
    FONT_IDS,
    SURFACE_VARIANTS,
    TRANSITION_FAMILIES,
    snap,
    snap_transition_family,
    validate_render_hints,
)

REPO = Path(__file__).resolve().parents[2]
KIT = REPO / "remotion-video/src/templates/generated/kit"

pytestmark = pytest.mark.skipif(
    not KIT.exists(), reason="remotion-video sources not present"
)


def _union_members(path: Path, type_name: str) -> set[str]:
    """Extract the string-literal members of `export type <name> = "a" | "b";`.

    Comments are stripped BEFORE the union is located. These unions are heavily
    commented, and a quoted phrase inside a `//` comment would otherwise parse
    as a member; worse, a SEMICOLON inside a comment terminates the non-greedy
    match early and silently truncates the union.
    """
    src = path.read_text(encoding="utf-8")
    src = re.sub(r"//[^\n]*", "", src)
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    m = re.search(rf"export type {type_name}\s*=(.*?);", src, re.S)
    assert m, f"{type_name} not found in {path.name}"
    return set(re.findall(r'"([^"]+)"', m.group(1)))


# ─── Parity with the renderer ────────────────────────────────────────────────


def test_decor_systems_match() -> None:
    assert DECOR_SYSTEMS == _union_members(KIT / "Decor.tsx", "DecorSystem")


def test_surface_variants_match() -> None:
    assert SURFACE_VARIANTS == _union_members(KIT / "cards.tsx", "SurfaceVariant")


def test_transition_families_match_the_renderer() -> None:
    ts = KIT.parent / "generatedTransitions.ts"
    assert ts.exists(), f"{ts} not found"
    assert _union_members(ts, "GeneratedTransitionFamily") == set(TRANSITION_FAMILIES)


def test_font_ids_match_the_font_registry() -> None:
    """FONT_IDS must equal the FontId union the renderer can resolve.

    A name outside it returns null from resolveFontFamily(), the raw string is
    used as a CSS family nothing loaded, and the scene renders in system sans.
    """
    registry = REPO / "remotion-video/src/fonts/registry.ts"
    assert registry.exists(), f"{registry} not found"
    assert _union_members(registry, "FontId") == set(FONT_IDS)


def test_default_transition_family_is_renderable() -> None:
    assert set(DEFAULT_TRANSITION_FAMILY) <= set(TRANSITION_FAMILIES)


# ─── Snapping behaviour ──────────────────────────────────────────────────────


def test_snap_accepts_exact_members() -> None:
    assert snap("inter", FONT_IDS, "dm_sans") == "inter"


def test_snap_normalises_prose_spellings() -> None:
    """The doc writes prose, so near-misses are expected and worth recovering."""
    assert snap("DM Sans", FONT_IDS, "inter") == "dm_sans"
    assert snap("Playfair Display", FONT_IDS, "inter") == "playfair_display"
    assert snap("flat hairline", SURFACE_VARIANTS, "panel") == "flat-hairline"


def test_snap_falls_back_on_unrenderable_values() -> None:
    """The exact bug this module exists to prevent."""
    assert snap("Cormorant Garamond", FONT_IDS, "dm_sans") == "dm_sans"
    assert snap("brutalist", DECOR_SYSTEMS, "none") == "none"
    assert snap(None, FONT_IDS, "inter") == "inter"
    assert snap("", FONT_IDS, "inter") == "inter"
    assert snap(123, FONT_IDS, "inter") == "inter"


def test_snap_transition_family_filters_and_tops_up() -> None:
    out = snap_transition_family(["fade", "not_a_real_transition"])
    assert set(out) <= set(TRANSITION_FAMILIES)
    # One legal name means every cut is the same transition; top up instead.
    assert len(out) >= 2


def test_snap_transition_family_survives_garbage() -> None:
    assert snap_transition_family(None) == list(DEFAULT_TRANSITION_FAMILY)
    assert set(snap_transition_family("fade")) <= set(TRANSITION_FAMILIES)


# ─── The v1-compatible output shape ──────────────────────────────────────────


def test_validate_render_hints_keeps_the_v1_identity_shape() -> None:
    """The render path reads identity.* and transition_family directly.

    remotion.py pins kitVariant from identity.surface_default/decor_system, and
    apply_blueprint_to_theme folds in identity fonts + transition_family. Keeping
    this shape is what lets v1 and v2 templates share one render path.
    """
    out = validate_render_hints(
        {
            "heading_font": "Playfair Display",
            "body_font": "lora",
            "surface_default": "ledger",
            "decor_system": "hairlines",
            "transition_family": ["ink_wash", "page_fold"],
        }
    )
    assert out["identity"]["heading_font"] == "playfair_display"
    assert out["identity"]["body_font"] == "lora"
    assert out["identity"]["surface_default"] == "ledger"
    assert out["identity"]["decor_system"] == "hairlines"
    assert out["transition_family"] == ["ink_wash", "page_fold"]


def test_validate_render_hints_never_raises() -> None:
    """A mangled design doc must still yield a renderable template."""
    for bad in (None, "", "not json", "[]", {}, {"heading_font": 5}, 42):
        out = validate_render_hints(bad)
        assert out["identity"]["heading_font"] in FONT_IDS
        assert out["identity"]["body_font"] in FONT_IDS
        assert out["identity"]["surface_default"] in SURFACE_VARIANTS
        assert out["identity"]["decor_system"] in DECOR_SYSTEMS
        assert set(out["transition_family"]) <= set(TRANSITION_FAMILIES)


def test_validate_render_hints_parses_a_json_string() -> None:
    out = validate_render_hints('{"heading_font": "oswald", "body_font": "arimo"}')
    assert out["identity"]["heading_font"] == "oswald"
    assert out["identity"]["body_font"] == "arimo"
