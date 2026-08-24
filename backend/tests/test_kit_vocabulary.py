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
    STRUCTURAL_COMPONENT,
    STRUCTURAL_ELEMENTS,
    SURFACE_VARIANTS,
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

    Comments are stripped first: these unions are heavily commented, and a
    quoted phrase inside a `//` comment would otherwise be parsed as a member.
    (That is not hypothetical — it happened while adding the P1 surfaces.)
    """
    src = path.read_text(encoding="utf-8")
    m = re.search(rf"export type {type_name}\s*=(.*?);", src, re.S)
    assert m, f"{type_name} not found in {path.name}"
    body = re.sub(r"//[^\n]*", "", m.group(1))
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
    return set(re.findall(r'"([^"]+)"', body))


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
