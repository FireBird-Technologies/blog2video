"""Guard the craft-kit injection seam (P0).

The set of kit names injected into AI-generated scene code has to be identical
in two places: the backend render wrapper (_wrap_generated_code) and the
frontend preview compiler (compileComponent.ts). Both now read the generated
manifest, but these tests make the invariant explicit so a regression fails in
CI rather than at render time.

This is not hypothetical. Before the manifest existed, both lists were
maintained by hand and had drifted: `CustomTable` was injected in the preview
but MISSING from the backend, so a scene using it previewed correctly and then
failed the real render. test_manifest_contains_custom_table pins that case.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.remotion import (
    _kit_export_names,
    _kit_import_block,
    _wrap_generated_code,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST = (
    REPO_ROOT
    / "remotion-video/src/templates/generated/kit/exportManifest.generated.ts"
)
FRONTEND_MANIFEST = (
    REPO_ROOT
    / "frontend/src/components/remotion/generated/kit/exportManifest.generated.ts"
)


def _names_in(path: Path) -> set[str]:
    return set(re.findall(r'"([A-Za-z_$][\w$]*)"', path.read_text(encoding="utf-8")))


@pytest.mark.skipif(not MANIFEST.exists(), reason="remotion-video sources not present")
def test_backend_uses_manifest_names() -> None:
    """The wrapper's import list must be exactly the manifest."""
    assert set(_kit_export_names()) == _names_in(MANIFEST)


@pytest.mark.skipif(
    not (MANIFEST.exists() and FRONTEND_MANIFEST.exists()),
    reason="both trees required",
)
def test_frontend_manifest_matches_canonical() -> None:
    """The synced copy must not drift from the canonical one.

    If this fails, run: node scripts/sync-generated-kit.mjs
    """
    assert _names_in(FRONTEND_MANIFEST) == _names_in(MANIFEST)


@pytest.mark.skipif(not MANIFEST.exists(), reason="remotion-video sources not present")
def test_every_manifest_name_is_injected() -> None:
    """Every manifest name must actually appear in the emitted import block —
    the specific failure mode that produced the CustomTable bug."""
    block = _kit_import_block()
    missing = [n for n in _kit_export_names() if not re.search(rf"\b{re.escape(n)}\b", block)]
    assert not missing, f"names in manifest but not injected: {missing}"


@pytest.mark.skipif(not MANIFEST.exists(), reason="remotion-video sources not present")
def test_manifest_contains_custom_table() -> None:
    """Regression pin for the real drift this machinery was built to prevent."""
    assert "CustomTable" in _kit_export_names()


@pytest.mark.skipif(not MANIFEST.exists(), reason="remotion-video sources not present")
def test_composition_scenes_are_not_injected() -> None:
    """DataChartScene/DataTableScene are rendered by GeneratedVideo itself and
    must never be injected into a scene component, or a scene could nest one
    inside itself. KitProvider is plumbing SceneFrame owns."""
    names = set(_kit_export_names())
    for excluded in ("DataChartScene", "DataTableScene", "KitProvider"):
        assert excluded not in names, f"{excluded} must not be injected"


def test_wrapped_output_is_a_complete_module() -> None:
    """The wrapper must emit a compilable module with no unrendered
    placeholders — a leftover format token would break every render."""
    wrapped = _wrap_generated_code("const SceneComponent = (props) => null;")
    assert "{kit_imports}" not in wrapped
    assert 'from "./kit"' in wrapped
    assert "export default SceneComponent;" in wrapped
