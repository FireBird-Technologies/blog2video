"""
Depth tier — deterministic pipeline glue (Part B).

Pure input->output functions: pricing, the CTA encoder, social-signal detection,
generated-code validation, layout-id sanitizing, language normalisation. These are
where most pipeline logic bugs live, and they need no LLM, DB, or render.
"""
import pytest

from app.routers.pipeline import _is_laduc_or_fj, _normalize_layout_id
from app.scene_cta import prepend_b2v_cta_to_visual, strip_b2v_cta_from_visual
from app.services.code_validator import clean_code, validate_component_code
from app.services.language_detection import normalize_preferred_language_code
from app.services.per_video_pricing import per_unit_cents, total_cents
from app.services.social_content_signals import detect_social_platforms_in_text

pytestmark = pytest.mark.depth


# ─── per_video_pricing — tier boundaries + clamping ─────────────────────────

@pytest.mark.parametrize("qty,cents", [
    (1, 400), (9, 400),      # casual zone
    (10, 300), (30, 300),    # pack zone
    (31, 280), (200, 280),   # bulk zone
])
def test_per_unit_cents__tier_boundaries(qty, cents):
    assert per_unit_cents(qty) == cents


def test_per_unit_cents__clamps_out_of_range():
    assert per_unit_cents(0) == 400      # clamps up to MIN=1 (casual)
    assert per_unit_cents(99999) == 280  # clamps down to MAX=200 (bulk)


def test_total_cents__multiplies_unit_by_qty():
    assert total_cents(10) == 300 * 10   # pack pricing
    assert total_cents(1) == 400


# ─── scene_cta — round-trip encoder ─────────────────────────────────────────

def test_cta_round_trip():
    encoded = prepend_b2v_cta_to_visual("Subscribe on Substack", "A hero shot")
    cta, rest = strip_b2v_cta_from_visual(encoded)
    assert cta == "Subscribe on Substack"
    assert rest == "A hero shot"


def test_strip_cta__no_prefix_returns_none_and_original():
    cta, rest = strip_b2v_cta_from_visual("just a visual")
    assert cta is None
    assert rest == "just a visual"


def test_prepend_cta__empty_cta_is_noop():
    assert prepend_b2v_cta_to_visual("", "visual") == "visual"


# ─── social_content_signals ─────────────────────────────────────────────────

def test_detect_social__finds_referenced_platforms():
    flags = detect_social_platforms_in_text("Follow us on YouTube and Instagram!")
    assert flags["youtube"] is True
    assert flags["instagram"] is True
    assert flags["facebook"] is False


def test_detect_social__empty_text_all_false():
    flags = detect_social_platforms_in_text("")
    assert all(v is False for v in flags.values())


# ─── code_validator ─────────────────────────────────────────────────────────

def test_clean_code__strips_fences_and_imports_exports():
    raw = "```tsx\nimport x from 'y';\nexport default const SceneComponent = 1;\n```"
    out = clean_code(raw)
    assert "```" not in out
    assert "import" not in out
    assert not out.startswith("export")


def test_validate__empty_code_invalid():
    ok, err = validate_component_code("")
    assert ok is False and err == "Code is empty"


def test_validate__unbalanced_braces_invalid():
    ok, err = validate_component_code("const SceneComponent = () => { <div/> ")
    assert ok is False and "Unbalanced braces" in err


def test_validate__missing_scene_component_invalid():
    ok, err = validate_component_code("const Other = () => <div/>;")
    assert ok is False and "SceneComponent" in err


# ─── pipeline layout-id sanitizers ──────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("Hero Split", "hero_split"),
    ("hero-split", "hero_split"),
    ("  HERO  ", "hero"),
    (None, ""),
])
def test_normalize_layout_id(raw, expected):
    assert _normalize_layout_id(raw) == expected


@pytest.mark.parametrize("tid,expected", [
    ("laduc", True), ("laduc_dark", True), ("fj_research", True),
    ("default", False), ("economist", False), ("", False),
])
def test_is_laduc_or_fj(tid, expected):
    assert _is_laduc_or_fj(tid) is expected


# ─── language normalisation ─────────────────────────────────────────────────

def test_normalize_language__empty_returns_none():
    assert normalize_preferred_language_code("") is None
    assert normalize_preferred_language_code("   ") is None


def test_normalize_language__unknown_value_lowercased_passthrough():
    assert normalize_preferred_language_code("ZZ") == "zz"
