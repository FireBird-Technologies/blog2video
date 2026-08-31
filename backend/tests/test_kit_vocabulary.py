"""Keep the Python kit vocabulary in sync with the TypeScript unions (P1).

kit_vocabulary.py grounds blueprint generation: the model is told to pick decor
systems / surfaces / artifacts from these sets. If a value drifts out of sync
with the kit, the blueprint can emit a name the kit has no branch for, which
falls through to a generic default at render time with nothing in the logs —
the brand asked for a distinct motif and silently got the default one.

These tests parse the TS union literals and assert the sets match exactly.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.kit_vocabulary import (
    ARTIFACT_MOTIONS,
    DECOR_SYSTEMS,
    ERAS,
    STRUCTURAL_COMPONENT,
    STRUCTURAL_ELEMENTS,
    CONTENT_TYPE_VARIANTS,
    SURFACE_VARIANTS,
    TITLE_REVEALS,
    TRANSITION_FAMILIES,
    describe_kit_capabilities,
)

KIT = (
    Path(__file__).resolve().parents[2]
    / "remotion-video/src/templates/generated/kit"
)

pytestmark = pytest.mark.skipif(
    not KIT.exists(), reason="remotion-video sources not present"
)


def _union_members(path: Path, type_name: str) -> set[str]:
    """Extract the string-literal members of `export type <name> = "a" | "b";`.

    Comments are stripped BEFORE the union is located, not after. These unions
    are heavily commented, and a quoted phrase inside a `//` comment would
    otherwise be parsed as a member (not hypothetical — it happened while adding
    the P1 surfaces). Stripping afterwards has a subtler failure: a SEMICOLON
    inside a comment terminates the non-greedy `(.*?);` early, silently
    truncating the union. GeneratedTransitionFamily's own comment reads
    "(palette-driven; ported from ...)", which cut 5 of its 14 members and made
    this helper report a drift that did not exist.
    """
    src = path.read_text(encoding="utf-8")
    src = re.sub(r"//[^\n]*", "", src)
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    m = re.search(rf"export type {type_name}\s*=(.*?);", src, re.S)
    assert m, f"{type_name} not found in {path.name}"
    return set(re.findall(r'"([^"]+)"', m.group(1)))


def test_decor_systems_match() -> None:
    assert DECOR_SYSTEMS == _union_members(KIT / "Decor.tsx", "DecorSystem")


def test_surface_variants_match() -> None:
    assert SURFACE_VARIANTS == _union_members(KIT / "cards.tsx", "SurfaceVariant")


def test_artifact_motions_match() -> None:
    assert ARTIFACT_MOTIONS == _union_members(KIT / "Artifacts.tsx", "ArtifactMotion")


def test_every_artifact_motion_has_a_dispatcher_case() -> None:
    """A motion in the union but absent from the SignatureArtifact switch falls
    through to the default StreakField — the silent-generic-motif bug."""
    src = (KIT / "Artifacts.tsx").read_text(encoding="utf-8")
    switch = src[src.index("export const SignatureArtifact"):]
    cases = set(re.findall(r'case\s+"([^"]+)"', switch))
    # `streak`/`float`/`drift` intentionally share the default branch.
    default_backed = {"streak", "float", "drift"}
    missing = ARTIFACT_MOTIONS - cases - default_backed
    assert not missing, f"motions with no dispatcher case: {sorted(missing)}"


def test_structural_components_are_exported() -> None:
    """Every structural element the blueprint can name must be a real export."""
    index = (KIT / "index.ts").read_text(encoding="utf-8")
    for element, component in STRUCTURAL_COMPONENT.items():
        assert element in STRUCTURAL_ELEMENTS
        assert re.search(rf"\b{component}\b", index), f"{component} not exported from kit"


def test_capabilities_prompt_lists_every_vocabulary() -> None:
    """The grounding text must actually contain the values, or the model is
    choosing blind."""
    text = describe_kit_capabilities()
    for value in ("inkwell", "halftone", "masthead", "drop_cap", "full_bleed"):
        assert value in text, f"{value} missing from kit capabilities prompt"


def test_content_types_mirror_stays_in_lockstep() -> None:
    """kit_vocabulary duplicates CONTENT_TYPES to stay dependency-free.

    content_classifier owns the taxonomy but pulls in dspy, and this module is
    deliberately importable without it. A drift between the two would put a
    value in the prompt that validate_blueprint then discards.
    """
    from app.services.content_classifier import CONTENT_TYPES
    from app.services.kit_vocabulary import _CONTENT_TYPES

    assert set(_CONTENT_TYPES) == set(CONTENT_TYPES)


def test_capabilities_prompt_lists_the_best_for_values() -> None:
    """They were never listed anywhere, so the model guessed and every guess
    was filtered out — leaving all seven stored templates with best_for=plain
    on every layout, including ones named metrics_row_4up and quote_center_red."""
    from app.services.kit_vocabulary import describe_kit_capabilities

    text = describe_kit_capabilities()
    assert "best_for" in text
    for value in ("metrics", "bullets", "quote", "timeline", "steps", "comparison"):
        assert value in text, f"{value} missing from the capabilities prompt"


# ── seams that were previously unguarded ─────────────────────────────────────


def test_transition_families_match_the_renderer() -> None:
    """Drift here makes EVERY cut in a video identical.

    `pickGeneratedTransition` falls through to a plain fade for any family it
    does not implement, so a Python-only addition silently degrades the whole
    template's scene-to-scene rhythm — the exact failure the module docstring
    warns about, with nothing checking for it until now.
    """
    ts = KIT.parent / "generatedTransitions.ts"
    assert ts.exists(), f"{ts} not found"
    assert _union_members(ts, "GeneratedTransitionFamily") == set(TRANSITION_FAMILIES)


def test_the_blueprint_prompt_offers_every_era() -> None:
    """The era list is written as PROSE in the blueprint prompt, not generated.

    An era added to ERAS but not to that sentence is simply never offered to the
    model — it validates, it has fonts, it has art direction, and it can never be
    chosen. Nothing caught this before.
    """
    from pathlib import Path as _Path

    src = (
        _Path(__file__).resolve().parents[1] / "app/dspy_modules/blueprint.py"
    ).read_text(encoding="utf-8")
    sentence = src.split("`identity.era` is one of:", 1)
    assert len(sentence) == 2, "the era prose in the blueprint prompt moved"
    offered = sentence[1].split("Choose from", 1)[0]
    missing = sorted(e for e in ERAS if e not in offered)
    assert not missing, f"eras never offered to the blueprint model: {missing}"


def test_title_reveals_are_implemented_by_the_renderer() -> None:
    """A reveal the blueprint can pick but RevealText cannot render is a silent
    downgrade to the `word` default.

    `mask_up` sat in this vocabulary with no implementation in EITHER RevealText
    or IntroStage, so any template that chose it got a plain word reveal and
    nobody found out.
    """
    # RevealText declares `mode` inline on its props interface rather than as a
    # named union, so the property is read directly instead of via
    # _union_members.
    src = (KIT / "text.tsx").read_text(encoding="utf-8")
    m = re.search(r"mode\?:\s*([^;]+);", src)
    assert m, "RevealText's `mode` property not found"
    modes = set(re.findall(r'"([^"]+)"', m.group(1)))
    missing = sorted(TITLE_REVEALS - modes)
    assert not missing, f"TITLE_REVEALS the renderer cannot render: {missing}"


def test_intro_stage_accepts_every_title_reveal() -> None:
    """IntroStage forwards titleReveal straight to RevealText, so a narrower
    union there degrades the reveal for any scene built on the scaffold."""
    src = (KIT / "IntroStage.tsx").read_text(encoding="utf-8")
    m = re.search(r"titleReveal\?:\s*([^;]+);", src)
    assert m, "IntroStage's `titleReveal` property not found"
    accepted = set(re.findall(r'"([^"]+)"', m.group(1)))
    missing = sorted(TITLE_REVEALS - accepted)
    assert not missing, f"IntroStage silently downgrades: {missing}"


def test_layout_variants_match_the_kit_arrangements() -> None:
    """A variant the kit cannot draw degrades silently to a default.

    `mask_up` sat in TITLE_REVEALS with no implementation in either RevealText or
    IntroStage, so any template choosing it got a plain word reveal and nobody
    found out. These arrangement unions are the same hazard for layouts.
    """
    variants = KIT / "variants.ts"
    assert variants.exists(), f"{variants} not found"

    src = variants.read_text(encoding="utf-8")

    def _const_array(name: str) -> set[str]:
        """Members of `export const NAME = [...] as const`.

        These arrangements are declared as const arrays with the TYPE derived
        from them (`type StatArrangement = (typeof STAT_ARRANGEMENTS)[number]`),
        so _union_members — which reads `export type X = "a" | "b"` — finds
        nothing here.
        """
        m = re.search(rf"export const {name}\s*=\s*\[(.*?)\]", src, re.S)
        assert m, f"{name} not found in variants.ts"
        body = re.sub(r"//[^\n]*", "", m.group(1))
        return set(re.findall(r'"([^"]+)"', body))

    for py_type, ts_const in (
        ("metrics", "STAT_ARRANGEMENTS"),
        ("bullets", "LIST_ARRANGEMENTS"),
        ("steps", "SEQUENCE_ARRANGEMENTS"),
        ("quote", "QUOTE_ARRANGEMENTS"),
        # Content types the render kit could not previously vary at all, even
        # though kit_vocabulary already listed arrangements for them.
        ("plain", "PLAIN_ARRANGEMENTS"),
        ("comparison", "COMPARISON_ARRANGEMENTS"),
        ("code", "CODE_ARRANGEMENTS"),
    ):
        ts = _const_array(ts_const)
        py = set(CONTENT_TYPE_VARIANTS[py_type])
        assert py <= ts, (
            f"{py_type} variants the kit cannot render: {sorted(py - ts)} "
            f"(kit offers {sorted(ts)})"
        )

    # Bookends. Same hazard, and the one that shipped: an intro arrangement the
    # kit cannot draw falls back to the centred lockup, which is exactly the
    # collapse this vocabulary exists to break.
    from app.services.kit_vocabulary import BOOKEND_ARRANGEMENTS

    ts_bookend = _const_array("BOOKEND_ARRANGEMENTS")
    for role in ("intro", "outro"):
        py = set(BOOKEND_ARRANGEMENTS[role])
        assert py <= ts_bookend, (
            f"{role} arrangements the kit cannot render: {sorted(py - ts_bookend)} "
            f"(kit offers {sorted(ts_bookend)})"
        )


def test_the_capabilities_prompt_lists_the_variant_menu() -> None:
    """The blueprint can only choose a variant it has been shown."""
    text = describe_kit_capabilities()
    assert "layout variant" in text
    for ctype, variants in CONTENT_TYPE_VARIANTS.items():
        for v in variants:
            assert v in text, f"{ctype} variant {v!r} missing from the capabilities prompt"
