"""FitText's sizing rules, policed from Python.

WHY THIS LIVES HERE

There is no test runner in `frontend/` — no vitest, no jest, no
testing-library — so a TypeScript unit test would need a whole toolchain before
it could assert anything. `test_type_band_parity.py` already set the precedent
for the alternative: parse the TS source and assert the invariants that matter.

What matters here is not the arithmetic (a browser does that) but the SHAPE of
the solve, because two production defects came from that shape:

  * The requested `fontSize` was discarded — `desired` is computed and then
    never used as an output, so the width fill-solve
    (`containerWidth * maxLines / textLength`) decided the size. A six-word
    title saturated at ~117px and a ten-word title at ~61px wherever the slider
    went. That is the "grows to a limit, then refuses" report.
  * Each element solves against its OWN box, so a title in a tighter box lands
    below the body and the hierarchy inverts, invisibly to every existing gate.

Both fixes are structural and both are checked below. A Python port of the
solve then pins the numbers, so a change to the TS that reintroduces either
failure has to break a test rather than a customer's video.
"""
from __future__ import annotations

import math
import re
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[2]
_FIT_TEXT = _REPO_ROOT / "remotion-video/src/templates/generated/kit/FitText.tsx"
_TYPE_TIER = _REPO_ROOT / "remotion-video/src/templates/generated/kit/typeTier.tsx"

pytestmark = pytest.mark.skipif(
    not _FIT_TEXT.exists(), reason="kit not present in this checkout"
)


# ─── The structure of the solve ──────────────────────────────────────────────


def test_exact_bypasses_the_width_fill_solve() -> None:
    """`estimateFitSize` is the fill-solve, and it must not run under `exact`.

    This is the whole fix for the saturating slider: the seed becomes the
    requested size instead of a function of how many characters the copy has.
    """
    src = _FIT_TEXT.read_text()
    m = re.search(r"const seed = (\w+)\s*\n?\s*\?", src)
    assert m, "the seed is no longer a conditional — has `exact` been removed?"
    assert m.group(1) == "resolvedExact", m.group(1)
    seed_block = src[src.index("const seed ="): src.index("const ref =")]
    assert "estimateFitSize" in seed_block, "the auto path must still fill-solve"
    exact_arm = seed_block.split("?", 1)[1].split(":", 1)[0]
    assert "estimateFitSize" not in exact_arm, (
        "the exact arm still calls the fill-solve, so text length still decides "
        "the size and the slider still saturates"
    )


def test_exact_collapses_the_growth_and_canvas_ceilings() -> None:
    """Both ceilings describe drift an auto-fitted GUESS may have.

    A size the user chose has no drift to allow, and leaving either cap in place
    is what stopped the title growing past ~117px (the fill-solve) and ~194px
    (`canvasHeight * 0.18`).
    """
    src = _FIT_TEXT.read_text()
    block = src[src.index("const ceiling ="): src.index("const boxWidth")]
    assert "resolvedExact" in block
    assert "? desired" in block, "the exact ceiling must be the requested size"
    assert "0.18" in block, "the auto path must keep the canvas cap"


def test_the_floor_never_exceeds_an_explicit_size() -> None:
    """A caller's minFontSize must not drag a deliberately small size back up.

    Otherwise the BOTTOM of the slider goes dead the way the top did: a title
    set to 18 with `minFontSize={24}` would render 24.
    """
    src = _FIT_TEXT.read_text()
    assert "const effFloor = resolvedExact ? Math.min(floor, desired) : floor;" in src
    # And the measured pass must search from that floor, not the raw one.
    assert "let lo = effFloor;" in src
    assert "next = Math.max(effFloor, Math.min(ceiling, next));" in src


def test_the_fit_key_includes_the_new_inputs() -> None:
    """The memo key decides when a re-fit happens.

    `exact` and the tier both change the answer, so a key without them would
    serve a stale size after the user moves a slider — the defect being fixed,
    reintroduced through the cache.
    """
    src = _FIT_TEXT.read_text()
    key = re.search(r"const fitKey = `([^`]*)`", src)
    assert key, "fitKey is no longer a template literal"
    assert "resolvedExact" in key.group(1), key.group(1)
    assert "resolvedTier" in key.group(1), key.group(1)
    assert "effFloor" in key.group(1), key.group(1)


def test_the_title_is_floored_against_the_rendered_body() -> None:
    """The hierarchy repair, and the cap that keeps it safe.

    The floor must be bounded by the height budget: a floor that pushes text off
    the frame is a worse defect than the inversion it fixes.
    """
    src = _FIT_TEXT.read_text()
    assert "TITLE_BODY_MIN_RATIO" in src
    block = src[src.index("const renderedBody ="): src.index("usePublishBodySize(")]
    assert "isTitle" in block
    assert "maxHeight" in block and "lineHeight" in block, (
        "the floor is not clamped to the height budget"
    )


def test_the_body_registry_takes_the_max_not_the_last_write() -> None:
    """A scene has several body-tier elements; the title clears the biggest."""
    src = _TYPE_TIER.read_text()
    block = src[src.index("publish(px)"): src.index("return store;")]
    assert "if (px <= store.px) return;" in block, block


def test_tier_inference_refuses_to_guess_on_a_tie() -> None:
    """Equal sizes mean no hierarchy to enforce and no way to tell them apart.

    Guessing would floor a body element against itself.
    """
    src = _TYPE_TIER.read_text()
    block = src[src.index("export function inferTier"): src.index("return null;\n}")]
    assert "titleSize === descriptionSize" in block, block


# ─── The numbers ─────────────────────────────────────────────────────────────


_RATIO = 0.5  # AVG_CHAR_WIDTH_RATIO


def _solve(text, box_w, desired, min_font, max_lines, max_h, canvas_h=1080,
           lh=1.15, exact=False):
    """A port of FitText's solve, for pinning the two behaviours numerically."""
    floor = min_font if min_font else max(16, round(desired * 0.4))
    eff_floor = min(floor, desired) if exact else floor
    ceiling = (
        desired if exact
        else max(floor, min(round(desired * 1.25), round(canvas_h * 0.18)))
    )
    ln = len(text.strip())
    if exact:
        size = max(eff_floor, desired)
    else:
        size = min(ceiling, (box_w * max_lines) / max(1, ln * _RATIO))
        longest = max((len(w) for w in text.split()), default=0)
        if longest:
            size = min(size, box_w / (longest * _RATIO))
    budget = max_h if max_h else canvas_h * 0.30
    lines_at = lambda s: max(1, math.ceil(ln / max(1, box_w / (s * _RATIO))))
    while size > eff_floor and lines_at(size) * size * lh > budget + 2:
        size -= 1
    return round(max(eff_floor, min(ceiling, size)))


_W, _H = 1920, 1080
_COL = _W * 0.44
_TITLE = "Rides That Show Up In Minutes"


def test_an_explicit_size_tracks_the_slider_where_auto_saturates() -> None:
    """The reported defect, pinned as numbers.

    Auto stops moving above ~88 because the fill-solve caps it; exact follows
    the request until the height budget genuinely binds.
    """
    auto = [_solve(_TITLE, _COL, s, 24, 2, _H * 0.40) for s in (120, 160, 200)]
    assert len(set(auto)) == 1, f"auto is expected to saturate, got {auto}"

    exact = [_solve(_TITLE, _COL, s, 24, 2, _H * 0.40, exact=True) for s in (48, 68, 88)]
    assert exact == [48, 68, 88], exact


def test_the_taller_box_is_what_lets_a_large_title_render() -> None:
    """Rule 1's geometry, and why it was changed.

    The title carries the larger type, so budgeting it BELOW the body is a box
    it cannot fill — FitText shrinks to the budget and the smaller box wins.
    """
    starved = _solve(_TITLE, _COL, 160, 24, 2, _H * 0.26, exact=True)
    roomy = _solve(_TITLE, _COL, 160, 24, 2, _H * 0.40, exact=True)
    assert roomy > starved, (starved, roomy)
