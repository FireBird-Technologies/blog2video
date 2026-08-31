"""Intro and outro must vary by brand, like every other scene type.

Two templates for different brands (Careem, Dawn) opened identically: a centred
wordmark with a small eyebrow above. Content scenes already diverged — metrics,
timelines and quotes each get a brand-seeded arrangement — but the bookends had
no arrangement axis at all.

Worse, bookend layouts carry `best_for: []`, so the blueprint's variant pick
fell through to "plain" and told the intro it was drawing "'plain' content as
'drop-cap'" — an oversized initial letter, which describes nothing about a brand
opening. The instruction was meaningless, so the model discarded it and reached
for the default centred reveal.
"""
from __future__ import annotations

import pytest

from app.services.kit_vocabulary import (
    BOOKEND_ARRANGEMENTS,
    layout_variants_for_brand,
    variants_for,
)

_BRANDS = [
    "Careem", "Dawn", "Acme Corp", "Northwind", "Brightline",
    "Vertex", "Lumen", "Kestrel", "Orbit", "Pico",
]


def test_the_two_reported_brands_get_different_openings() -> None:
    """The actual report: these two templates opened the same way."""
    careem = layout_variants_for_brand("Careem")
    dawn = layout_variants_for_brand("Dawn")
    assert careem["intro"] != dawn["intro"]


def test_bookends_are_assigned_for_every_brand() -> None:
    """Unconditional, like the content types. The previous mechanism only
    reassigned a bookend when the model had left it at the literal default, so
    a model converging on one non-default opening was never corrected."""
    for brand in _BRANDS:
        v = layout_variants_for_brand(brand)
        assert v["intro"] in BOOKEND_ARRANGEMENTS["intro"]
        assert v["outro"] in BOOKEND_ARRANGEMENTS["outro"]


def test_openings_are_spread_across_the_vocabulary() -> None:
    """The number that says whether this worked. Before: 4 distinct openings
    across 10 brands in the best case, 1 when the model converged."""
    intros = {layout_variants_for_brand(b)["intro"] for b in _BRANDS}
    assert len(intros) >= 4, f"openings collapsed to {sorted(intros)}"

    # And every arrangement must be reachable, or a name is dead weight.
    wide = {layout_variants_for_brand(f"brand{n}")["intro"] for n in range(200)}
    assert wide == set(BOOKEND_ARRANGEMENTS["intro"])


def test_intro_and_outro_are_independent() -> None:
    """They are drawn from separately salted hashes rather than successive
    powers of one base: both lists have six entries and 7 = 1 (mod 6), so
    consecutive `h // 7**i` slices made intro track outro — measured at 5 of 10
    brands landing on the same pair."""
    n = 400
    same = sum(
        1
        for i in range(n)
        if (v := layout_variants_for_brand(f"brand{i}"))["intro"] == v["outro"]
    )
    # 1/6 expected for independent picks; a wide band, since the point is to
    # catch lockstep (~100%), not to assert a precise rate.
    assert 0.08 < same / n < 0.28, f"intro/outro correlated: {same}/{n} identical"


def test_the_same_brand_always_resolves_the_same_way() -> None:
    """Preview and export derive this independently; drift would render one
    thing in the editor and another in the video."""
    for brand in _BRANDS:
        assert layout_variants_for_brand(brand) == layout_variants_for_brand(brand)


def test_variants_for_answers_for_bookends_too() -> None:
    """So a caller resolving a layout's variant needs no special case for
    whether it holds a bookend or a content scene."""
    assert variants_for("intro") == BOOKEND_ARRANGEMENTS["intro"]
    assert variants_for("outro") == BOOKEND_ARRANGEMENTS["outro"]
    assert variants_for("metrics")  # content types still work
    assert variants_for("nonsense") == ()


def test_centred_lockup_is_still_reachable() -> None:
    """The historical look is one option among six, not banned. Always
    avoiding it would be as arbitrary as always choosing it."""
    assert "centred-lockup" in BOOKEND_ARRANGEMENTS["intro"]
    wide = {layout_variants_for_brand(f"brand{n}")["intro"] for n in range(200)}
    assert "centred-lockup" in wide


# ── the prompt must describe the arrangement, not just name it ───────────────


@pytest.mark.parametrize("arrangement", sorted(set(BOOKEND_ARRANGEMENTS["intro"])))
def test_every_bookend_arrangement_has_prompt_direction(arrangement: str) -> None:
    """A bare name means nothing to the model — that is why `_VARIANT_DIRECTION`
    exists for content variants. Without a concrete sentence the model falls
    back to the only opening it knows how to draw."""
    from app.services.code_generator import _VARIANT_DIRECTION

    text = _VARIANT_DIRECTION.get(arrangement, "")
    assert len(text) > 40, f"{arrangement} has no usable direction: {text!r}"


def test_a_bookend_is_not_described_as_content() -> None:
    """The mislabelling that shipped: an intro was told "this template draws
    'plain' content as 'drop-cap'"."""
    from app.services.code_generator import build_art_direction

    blueprint = {
        "layouts": [
            {
                "id": "intro",
                "role": "intro",
                "geometry": "An opening.",
                "best_for": [],
                "variant": "corner-mark",
                "surface": "panel",
                "artifact": "none",
            }
        ],
        "bookends": {"intro": {"opening_move": "wordmark_wipe", "energy": "calm"}},
        "identity": {},
    }
    text = build_art_direction(blueprint, "intro", 0)
    assert "corner-mark" in text
    assert "'plain' content" not in text
