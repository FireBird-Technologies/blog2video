"""The type bands exist in Python AND in TypeScript. They must agree.

The bands are enforced in Python at generation time, but the RENDER clamps
stored sizes in TypeScript — and the Remotion CLI render has no API access, so
the numbers cannot be served at runtime. A compile-time copy is unavoidable.

That leaves exactly two authorities, and nothing in either language can see the
other. This test is the seam: it parses the TS file and asserts the numbers
match. If someone widens a band on one side only, this fails rather than the two
silently disagreeing — which is how a scene ends up rendering a size the
generator would have rejected.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.code_generator import _TYPE_BANDS, _USER_BANDS

# All three copies of the kit carry this file and must stay identical.
_TS_COPIES = [
    "frontend/src/components/remotion/generated/kit/typeBands.ts",
    "frontend-pdf2video/src/components/remotion/generated/kit/typeBands.ts",
    "remotion-video/src/templates/generated/kit/typeBands.ts",
]

# The Python tier names and the TS ones differ: `title` is the HEADLINE tier
# because props.titleFontSize sizes props.displayText. Mapping it here rather
# than renaming either side keeps the historical prop names intact.
_TIER_MAP = {"headline": "title", "body": "description", "eyebrow": "eyebrow"}

_REPO_ROOT = Path(__file__).resolve().parents[2]


def _parse_ts_bands(
    text: str, name: str = "TYPE_BANDS"
) -> dict[str, dict[str, tuple[int, int]]]:
    """Pull one band map out of the TS source without a JS engine."""
    block = re.search(
        rf"export const {name}[^=]*=\s*\{{(.*?)\n\}};", text, re.S
    )
    assert block, f"{name} not found — did the declaration change shape?"
    out: dict[str, dict[str, tuple[int, int]]] = {}
    for tier, body in re.findall(r"(\w+):\s*\{([^}]*)\}", block.group(1)):
        entry: dict[str, tuple[int, int]] = {}
        for orientation, lo, hi in re.findall(
            r"(landscape|portrait):\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]", body
        ):
            entry[orientation] = (int(lo), int(hi))
        if entry:
            out[tier] = entry
    return out


@pytest.mark.parametrize("rel", _TS_COPIES)
def test_ts_bands_match_python(rel: str) -> None:
    path = _REPO_ROOT / rel
    if not path.exists():
        pytest.skip(f"{rel} not present in this checkout")

    ts = _parse_ts_bands(path.read_text())
    assert ts, f"parsed no bands out of {rel}"

    for ts_tier, py_tier in _TIER_MAP.items():
        assert ts_tier in ts, f"{rel} is missing the {ts_tier} tier"
        for orientation in ("landscape", "portrait"):
            assert ts[ts_tier][orientation] == tuple(_TYPE_BANDS[py_tier][orientation]), (
                f"{rel}: {ts_tier}.{orientation} is {ts[ts_tier][orientation]} but "
                f"Python _TYPE_BANDS['{py_tier}']['{orientation}'] is "
                f"{tuple(_TYPE_BANDS[py_tier][orientation])}"
            )


@pytest.mark.parametrize("rel", _TS_COPIES)
def test_ts_user_bands_match_python(rel: str) -> None:
    """The USER bands are a second authority pair and drift the same way.

    These are what the editor's sliders offer and the only clamp applied to a
    size a PERSON stored. If TS clamps to 200 and Python to 88, a title the user
    set renders one way in the preview and another in the exported MP4 — which
    is exactly the class of bug the generation-band test above exists to stop.
    """
    path = _REPO_ROOT / rel
    if not path.exists():
        pytest.skip(f"{rel} not present in this checkout")

    ts = _parse_ts_bands(path.read_text(), "USER_BANDS")
    assert ts, f"parsed no USER_BANDS out of {rel}"

    for tier in ("title", "description"):
        assert tier in ts, f"{rel} is missing the {tier} user band"
        for orientation in ("landscape", "portrait"):
            assert ts[tier][orientation] == tuple(_USER_BANDS[tier][orientation]), (
                f"{rel}: USER_BANDS.{tier}.{orientation} is {ts[tier][orientation]} "
                f"but Python _USER_BANDS['{tier}']['{orientation}'] is "
                f"{tuple(_USER_BANDS[tier][orientation])}"
            )


def test_user_bands_contain_generation_bands() -> None:
    """A generated default must always be a value the sliders can express.

    The generation bands bound what the model may bake in; the user bands bound
    what the editor may store and what the render will keep. If a generated
    default fell outside the user band, the read-time clamp would move it — the
    scene would render at a size the generator never chose and the slider would
    open somewhere other than where the template actually sits.
    """
    for gen_tier, user_tier in (("title", "title"), ("description", "description")):
        for orientation in ("landscape", "portrait"):
            g_lo, g_hi = _TYPE_BANDS[gen_tier][orientation]
            u_lo, u_hi = _USER_BANDS[user_tier][orientation]
            assert u_lo <= g_lo, f"{gen_tier}.{orientation}: user floor {u_lo} > generation floor {g_lo}"
            assert u_hi >= g_hi, f"{gen_tier}.{orientation}: user ceiling {u_hi} < generation ceiling {g_hi}"


def test_all_ts_copies_are_identical() -> None:
    """The three kit copies are mirrors; a fix applied to one must reach all."""
    bodies = {}
    for rel in _TS_COPIES:
        path = _REPO_ROOT / rel
        if path.exists():
            bodies[rel] = path.read_text()
    if len(bodies) < 2:
        pytest.skip("fewer than two copies present")
    first_rel, first = next(iter(bodies.items()))
    for rel, body in bodies.items():
        assert body == first, f"{rel} has diverged from {first_rel}"


def test_portrait_is_smaller_than_landscape() -> None:
    """The invariant the scene contract calls the most common rejection cause."""
    for tier, bands in _TYPE_BANDS.items():
        lo_l, hi_l = bands["landscape"]
        lo_p, hi_p = bands["portrait"]
        assert lo_p <= lo_l, tier
        assert hi_p <= hi_l, tier
