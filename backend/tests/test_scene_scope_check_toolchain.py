"""The scope check must load a toolchain that EXISTS in production.

Separate from test_scene_undefined_identifiers.py on purpose. That module skips
itself when node/@babel are absent — correct for tests that execute the gate,
but it would have disarmed this one exactly where it matters most. The backend
CI job installs no npm dependencies at all, so it is the one environment
guaranteed to skip every toolchain-dependent test, and therefore the one that
must still run this check.

These assertions read the source file. They need no node, no babel, no install.
"""
from __future__ import annotations

import pathlib

_SRC = (
    pathlib.Path(__file__).resolve().parents[1]
    / "app" / "services" / "scene_scope_check.mjs"
)


def test_the_script_exists() -> None:
    assert _SRC.is_file()


def test_it_does_not_depend_on_dev_only_packages() -> None:
    """It must load @babel/standalone, not remotion-video's parser+traverse.

    The image installs remotion-video with `npm ci --omit=dev`, which keeps
    @babel/parser (a runtime transitive) but DROPS @babel/traverse (dev-only).
    An earlier version of this check imported both from there, so it loaded
    fine locally and failed open in production — reproducing the exact class of
    bug the gate exists to prevent.
    """
    body = _SRC.read_text(encoding="utf-8")
    assert "babelPath" in body, "must be handed @babel/standalone's path"
    assert "@babel/traverse/lib" not in body
    assert "@babel/parser/lib" not in body


def test_the_dockerfile_installs_the_toolchain_the_probe_looks_for() -> None:
    """The bug was a path mismatch: the checks probed frontend/node_modules and
    the image never created it. Pin the two halves together.

    Skipped rather than failed when the Dockerfile is not readable — the
    backend test suite must stay runnable from a checkout of `backend/` alone,
    and an unreadable sibling file is not evidence of a regression.
    """
    import pytest

    root = pathlib.Path(__file__).resolve().parents[2]
    try:
        dockerfile = (root / "Dockerfile").read_text(encoding="utf-8")
    except OSError as e:
        pytest.skip(f"Dockerfile not readable from here: {e}")
    assert "@babel/standalone" in dockerfile, (
        "the image must install @babel/standalone, or the runtime and scope "
        "gates silently fail open in production"
    )
    # _babel_path() probes <repo>/frontend/node_modules first; the image must
    # create exactly that.
    assert "/app/frontend" in dockerfile
