"""Era + typeface: what makes two templates read as different designs.

Templates looked nearly identical to each other because the TYPEFACE never
varied. Only 12 families were bundled, the theme extractor was free to invent any
name ("Cormorant Garamond" appears in its own prompt examples and was never
bundled), and an unbundled name failed SILENTLY: `resolveFontFamily` returns
null, GeneratedVideo falls back to the raw string as a bare CSS family, nothing
ever loaded it, and the video renders in the system sans.

So the brand evidence could say anything and every video came out looking the
same. These tests pin the two properties that fix it: the vocabulary cannot drift
from what is actually bundled, and an unbundled name is repaired LOUDLY.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.dspy_modules.blueprint import fallback_blueprint, validate_blueprint
from app.services.kit_vocabulary import (
    ERA_FONTS,
    ERAS,
    FONT_IDS,
    describe_kit_capabilities,
    fonts_for_era,
)

REGISTRY = (
    Path(__file__).resolve().parents[2] / "remotion-video/src/fonts/registry.ts"
)

GEOM = (
    "A generous, specific geometry description that comfortably exceeds the "
    "minimum length required for a layout to be considered authored."
)


def _blueprint(identity: dict) -> dict:
    return {
        "identity": identity,
        "layouts": (
            [{"id": "i", "role": "intro", "geometry": GEOM, "geometry_portrait": GEOM}]
            + [
                {
                    "id": f"c{i}",
                    "role": "content",
                    "best_for": ["plain"],
                    "geometry": GEOM + str(i),
                    "geometry_portrait": GEOM,
                }
                for i in range(5)
            ]
            + [{"id": "o", "role": "outro", "geometry": GEOM, "geometry_portrait": GEOM}]
        ),
    }


# ─── The vocabulary must match what is actually bundled ──────────────────────


def test_font_ids_match_the_render_registry() -> None:
    """FONT_IDS must equal the FontId union in registry.ts.

    Parsed from the TSX so the two cannot drift — an id here that the renderer
    does not know is exactly the silent-fallback bug this vocabulary prevents.
    """
    src = re.sub(r"//[^\n]*", "", REGISTRY.read_text())
    union = src.split("export type FontId =", 1)[1].split(";", 1)[0]
    names = set(re.findall(r'"([a-z0-9_]+)"', union))
    assert names == set(FONT_IDS), (
        f"drift: only in TS {names - set(FONT_IDS)}, only in Python {set(FONT_IDS) - names}"
    )


def test_every_registered_font_is_actually_imported() -> None:
    """A registry entry with no @fontsource import renders as the system default."""
    src = REGISTRY.read_text()
    imported = {
        m.replace("-", "_") for m in re.findall(r'@fontsource/([a-z0-9-]+)/', src)
    }
    missing = {f for f in FONT_IDS if f not in imported}
    assert not missing, f"registered but never imported (would not load): {missing}"


def test_every_era_font_is_renderable() -> None:
    for era, spec in ERA_FONTS.items():
        for slot in ("heading", "body"):
            for font in spec[slot]:
                assert font in FONT_IDS, f"{era}.{slot} names unbundled {font!r}"


def test_every_era_has_fonts() -> None:
    assert set(ERA_FONTS) == set(ERAS)
    for era, spec in ERA_FONTS.items():
        assert spec["heading"] and spec["body"], era


# ─── Eras must actually differ ───────────────────────────────────────────────


def test_eras_use_different_typefaces() -> None:
    """The whole point: a vintage template must not share a face with a modern one."""
    heads = {era: set(spec["heading"]) for era, spec in ERA_FONTS.items()}
    assert not (heads["vintage"] & heads["modern"]), "vintage and modern share a heading face"
    assert not (heads["vintage"] & heads["technical"])


def test_brands_in_one_era_still_vary() -> None:
    """Two brands sharing an era should not be forced onto the same typeface."""
    for era in ERAS:
        picks = {fonts_for_era(era, f"brand-{i}") for i in range(12)}
        assert len(picks) >= 3, f"{era} collapsed to {len(picks)} pair(s)"


def test_font_pick_is_deterministic() -> None:
    """A brand must regenerate to the same typeface."""
    assert fonts_for_era("vintage", "Acme") == fonts_for_era("vintage", "Acme")


def test_unknown_era_falls_back_rather_than_raising() -> None:
    heading, body = fonts_for_era("steampunk", "Acme")
    assert heading in FONT_IDS and body in FONT_IDS


# ─── Validation repairs, loudly ──────────────────────────────────────────────


def test_unbundled_font_is_repaired_with_a_repair_line() -> None:
    """An invented font name must not reach the renderer silently.

    This is the core sameness bug: the name passes through as a CSS family that
    was never loaded, so the video renders in the system default and every brand
    converges on the same look with nothing in the logs to say so.
    """
    bp, repairs = validate_blueprint(
        _blueprint({"name": "B", "era": "vintage", "heading_font": "Cormorant Garamond"}),
        seed="s",
    )
    assert bp["identity"]["heading_font"] in FONT_IDS
    assert any("not a bundled typeface" in r for r in repairs)


def test_bundled_font_choice_is_honoured() -> None:
    bp, _ = validate_blueprint(
        _blueprint({"name": "A", "era": "vintage", "heading_font": "pirata_one"}), seed="s"
    )
    assert bp["identity"]["heading_font"] == "pirata_one"


@pytest.mark.parametrize("era", sorted(ERAS))
def test_validated_identity_always_carries_renderable_fonts(era: str) -> None:
    bp, _ = validate_blueprint(_blueprint({"name": "X", "era": era}), seed=era)
    assert bp["identity"]["era"] == era
    assert bp["identity"]["heading_font"] in FONT_IDS
    assert bp["identity"]["body_font"] in FONT_IDS


def test_unknown_era_is_repaired() -> None:
    bp, repairs = validate_blueprint(_blueprint({"name": "X", "era": "steampunk"}), seed="s")
    assert bp["identity"]["era"] in ERAS
    assert any("era" in r for r in repairs)


# ─── Fallback templates keep a typographic identity ──────────────────────────


def test_fallback_derives_era_from_the_brand_signature() -> None:
    """Fallbacks are common; if they all defaulted to one era they'd all look alike."""
    seen = {}
    for name, treatment in [
        ("Heritage Press", "display-serif"),
        ("The Ledger", "editorial-serif"),
        ("DevTool", "tight-sans"),
        ("StreetCo", "display-bold"),
    ]:
        bp = fallback_blueprint(
            {"signature": {"typeTreatment": treatment, "artifactSet": ["drift"]}},
            [{"id": f"a{i}", "best_for": ["plain"]} for i in range(5)],
            name,
        )
        seen[name] = bp["identity"]["era"]
        assert bp["identity"]["heading_font"] in FONT_IDS

    assert seen["Heritage Press"] == "vintage"
    assert seen["The Ledger"] == "editorial"
    assert len(set(seen.values())) >= 3, f"fallback eras collapsed: {seen}"


# ─── The blueprint LLM is told the vocabulary ────────────────────────────────


# ─── The era must reach the SCENE prompt, not just the blueprint ─────────────


@pytest.mark.parametrize("era", sorted(ERAS))
def test_era_reaches_the_art_direction(era: str) -> None:
    """`art_direction` is what the model treats as law — the era must be IN it.

    The era was picking a typeface and stopping there: it never appeared in the
    scene prompt, so a "vintage" template was a modern template in an old face.
    The camera helpers had the same problem — advertised in the generic docstring
    (capability) but never in the per-template brief (instruction).
    """
    from app.services.code_generator import build_art_direction

    bp, _ = validate_blueprint(_blueprint({"name": "X", "era": era}), seed=era)
    out = build_art_direction(bp, "content", 0)

    assert f"ERA — '{era}'" in out
    for section in ("Look:", "Depth / gradient:", "Camera:", "Motion:"):
        assert section in out, f"{era} art direction missing {section}"
    # The kit helpers must be named concretely enough to copy.
    assert "cameraStage(" in out and "cameraPush(" in out and "parallaxLayer(" in out


def test_eras_give_visibly_different_direction() -> None:
    """Two eras must not produce interchangeable briefs."""
    from app.services.code_generator import build_art_direction

    briefs = {}
    for era in ERAS:
        bp, _ = validate_blueprint(_blueprint({"name": "X", "era": era}), seed=era)
        briefs[era] = build_art_direction(bp, "content", 0).split("SAFE AREA")[0]
    assert len(set(briefs.values())) == len(ERAS)
    # Spot-check the extremes read as genuinely different periods.
    assert "Letterpress" in briefs["vintage"]
    assert "gradients belong" in briefs["modern"]
    assert "vintage" not in briefs["modern"].lower().replace("era — 'modern'", "")


def test_scoring_requires_depth_but_overflow_still_wins() -> None:
    """Camera/depth is scored, but must never rescue an unsafe scene.

    A bonus for richness would let an oversized headline buy its way back over
    the threshold. Depth is therefore a PENALTY-only signal, and the oversize
    penalty is decisive on its own.
    """
    import contextlib
    import io

    from app.services.code_generator import REFINE_THRESHOLD, _score_valid_scene

    pad = "x" * 600
    base = (
        "const SceneComponent = (props) => {"
        "const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');"
        "const isPortrait = props.aspectRatio === 'portrait';"
        "return <div style={{overflow:'hidden', minWidth:0}}>"
        "{props.logoUrl && <Img src={props.logoUrl}/>}"
        "<FitText fontSize={props.titleFontSize ?? 72}>{props.displayText}</FitText><KenBurnsImage src={props.imageUrl}/>"
        "{isPortrait ? <span/> : <span/>}<div data-content-img='1'/>"
    )
    rich_tail = (
        "<AbsoluteFill style={{...cameraStage(1600)}}/>"
        "<div style={{transform:cameraPush(frame,150,0.5).transform}}/>"
        "<Decor system='rules'/>"
    )

    def score(code: str) -> float:
        with contextlib.redirect_stdout(io.StringIO()):
            return _score_valid_scene(code, {"scene_type": "content"})

    flat = score(base + pad + "</div>; };")
    rich = score(base + rich_tail + pad + "</div>; };")
    unsafe = score(
        (base + rich_tail + pad + "</div>; };").replace(
            "<FitText fontSize={props.titleFontSize ?? 72}>{props.displayText}</FitText>",
            "<div style={{fontSize: 240}}>{props.displayText}</div>",
        )
    )

    assert flat < REFINE_THRESHOLD, "a flat 2D scene must be retried"
    assert rich >= REFINE_THRESHOLD, "the target shape must pass"
    assert unsafe < REFINE_THRESHOLD, "richness must not rescue an overflowing headline"


def test_capabilities_prompt_lists_eras_and_typefaces() -> None:
    out = describe_kit_capabilities()
    for era in ERAS:
        assert era in out
    for font in FONT_IDS:
        assert font in out, f"{font} not advertised — the model cannot choose it"
    assert "renders as the system default" in out
