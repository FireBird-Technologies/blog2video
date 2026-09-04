"""TS/Python parity for the type bands.

`_TYPE_FLOOR` / `_TYPE_CEILING` in code_generator clamp what the MODEL is told;
`TYPE_BOUNDS` in the kit's theme.ts clamps what the RENDERER computes. When
those two disagree a scene renders at a size the prompt calls illegal — which is
exactly the portrait-headline bug this guard was written for (the kit defaulted
portrait titles to ~88px against a 60px ceiling).

This is the ONLY mechanical check that the two stay in step, which is why it is
kept after the rest of the original file was dropped: the tiers it also covered
were asserted through `_type_bands` and `_bp_type_directive`, both of which were
removed with the blueprint path. Their bands survive as the constants below, so
parity is still both checkable and worth checking.

A third source has to agree with these by eye rather than by test: the design
stage's own ladder in dspy_modules/design_doc.py, which tells the art director
what sizes to write into a scene doc. It listed `headline 68-100px` against an
enforced landscape ceiling of 88 — so any doc written above 88 was silently
clamped at the code stage and lost the hierarchy the designer asked for.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.code_generator import _TYPE_CEILING, _TYPE_FLOOR

KIT_THEME = (
    Path(__file__).resolve().parents[2]
    / "remotion-video/src/templates/generated/kit/theme.ts"
)
DESIGN_DOC = Path(__file__).resolve().parents[1] / "app/dspy_modules/design_doc.py"


def _ts_type_bounds() -> dict[str, dict[str, tuple[int, int]]]:
    """Parse `TYPE_BOUNDS` out of the kit's theme.ts."""
    src = KIT_THEME.read_text()
    block = re.search(r"const TYPE_BOUNDS = \{(.*?)\n\} as const;", src, re.S)
    assert block, "TYPE_BOUNDS not found in theme.ts"
    out: dict[str, dict[str, tuple[int, int]]] = {}
    for role, body in re.findall(r"(\w+):\s*\{([^}]*\])\s*,?\s*\}", block.group(1)):
        entry: dict[str, tuple[int, int]] = {}
        for orient, lo, hi in re.findall(
            r"(landscape|portrait):\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]", body
        ):
            entry[orient] = (int(lo), int(hi))
        if entry:
            out[role] = entry
    return out


@pytest.mark.skipif(not KIT_THEME.exists(), reason="remotion-video sources not present")
@pytest.mark.parametrize("role", ["title", "body", "prop", "micro"])
def test_ts_bounds_match_python_bounds(role):
    """The renderer's clamp and the prompt's clamp must be the same numbers."""
    ts = _ts_type_bounds()
    assert role in ts, f"{role} missing from TYPE_BOUNDS in theme.ts"
    # `title` is `headline` on the Python side; the rest share a name.
    py_key = "headline" if role == "title" else role
    for orient in ("landscape", "portrait"):
        lo, hi = ts[role][orient]
        assert lo == _TYPE_FLOOR[f"{py_key}_{orient}"], (
            f"{role}/{orient} floor: theme.ts says {lo}, "
            f"code_generator says {_TYPE_FLOOR[f'{py_key}_{orient}']}"
        )
        assert hi == _TYPE_CEILING[f"{py_key}_{orient}"], (
            f"{role}/{orient} ceiling: theme.ts says {hi}, "
            f"code_generator says {_TYPE_CEILING[f'{py_key}_{orient}']}"
        )


def test_portrait_is_never_larger_than_landscape():
    """Portrait is 1080 wide against landscape's 1920, so the same point size
    eats nearly twice the line. Every band has to reflect that, and the prompt
    calls this out as the single most common reason a scene is rejected."""
    for tier in ("headline", "body"):
        assert _TYPE_CEILING[f"{tier}_portrait"] <= _TYPE_CEILING[f"{tier}_landscape"]
        assert _TYPE_FLOOR[f"{tier}_portrait"] <= _TYPE_FLOOR[f"{tier}_landscape"]


def test_the_design_stage_headline_range_fits_the_enforced_ceiling():
    """The design doc's ladder must not promise sizes the code stage rejects.

    The art director writes prose naming pixel sizes, and the scene builder then
    clamps to _TYPE_CEILING. A ladder offering a larger headline than the ceiling
    allows produces docs that are silently cut down — the designer asks for 100px
    of hierarchy and the frame renders 88.
    """
    ladder = re.search(r"headline\s+(\d+)-(\d+)px", DESIGN_DOC.read_text())
    assert ladder, "the design-doc type ladder no longer names a headline range"
    lo, hi = int(ladder.group(1)), int(ladder.group(2))
    assert hi <= _TYPE_CEILING["headline_landscape"], (
        f"design_doc offers headlines to {hi}px but the enforced landscape ceiling "
        f"is {_TYPE_CEILING['headline_landscape']}px — docs above it get clamped"
    )
    assert lo >= _TYPE_FLOOR["headline_landscape"]
