"""Is the code-generation pipeline actually fully armed in THIS environment?

Every quality gate around generated scenes fails OPEN — a missing toolchain
returns "passed" rather than blocking generation. That is the right default (a
tooling hiccup must not take generation down) but it has a bad failure mode:
the gates go quiet instead of loud, so an environment missing a dependency
produces measurably worse templates with nothing in the logs to say why.

That is not hypothetical. The deployed image never copied `frontend/`, so:

  * `_babel_path()` found no @babel/standalone -> Level-2 runtime validation,
    the gate that actually RUNS each scene, was disabled for every generation
    in production while passing in every dev checkout.
  * `_kit_names()` read the kit manifest only from `frontend/` -> production
    injected ZERO kit names.

Both are fixed, but the class of bug is structural: the gates are silent when
absent, and no one can tell a fully-armed pipeline from a defanged one by
looking at its output. This module makes that difference inspectable.

Call `preflight_report()` at startup, or run it directly:

    python -m app.services.codegen_preflight
"""
from __future__ import annotations

import os
import shutil


def _check_esbuild() -> tuple[bool, str]:
    """The syntax gate (_parse_check) — catches corruption that would blank a scene."""
    from app.services.code_validator import _find_esbuild

    p = _find_esbuild()
    return (bool(p), p or "NOT FOUND — syntax gate disabled (fails open)")


def _check_babel() -> tuple[bool, str]:
    """Powers BOTH Level-2 runtime validation and the undefined-identifier gate."""
    from app.services.scene_runtime_check import _babel_path

    p = _babel_path()
    return (bool(p), p or "NOT FOUND — runtime + scope gates disabled (fail open)")


def _check_kit_manifest() -> tuple[bool, str]:
    """The injected-name list. Empty means every scene is judged against nothing."""
    from app.services.scene_runtime_check import _kit_names

    names = _kit_names()
    if not names:
        return False, "EMPTY — scenes validated against zero injected kit names"
    return True, f"{len(names)} names"


def _check_node() -> tuple[bool, str]:
    p = shutil.which("node")
    return (bool(p), p or "NOT FOUND — every node-backed gate disabled")


def _check_scope_script() -> tuple[bool, str]:
    from app.services.code_validator import _SCOPE_SCRIPT

    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), _SCOPE_SCRIPT)
    return (os.path.exists(p), p if os.path.exists(p) else f"{p} MISSING")


def _check_runtime_gate_live() -> tuple[bool, str]:
    """End-to-end: does the runtime harness actually reject a scene that throws?

    The strongest signal available, because it exercises node, babel, the
    harness and the kit manifest together rather than probing for files.
    """
    from app.services.scene_runtime_check import runtime_check_scene

    crasher = (
        "const SceneComponent = (props) => {"
        "  const o = definitelyNotDefined;"
        "  return <AbsoluteFill>{o}</AbsoluteFill>;"
        "};"
    )
    ok, _ = runtime_check_scene(crasher, role="content", aspect_ratio="landscape")
    # ok=True means the harness did NOT catch a scene that cannot possibly run.
    return (not ok, "rejects a crashing scene" if not ok else "PASSED a crashing scene — gate is not live")


def _check_scope_gate_live() -> tuple[bool, str]:
    """End-to-end: does the static scope gate actually find an undefined name?"""
    from app.services.code_validator import _undefined_identifiers

    found = _undefined_identifiers(
        "const SceneComponent = (props) => { const o = zzProbeUndefined; return null; };"
    )
    return (bool(found), "finds undefined identifiers" if found else "found nothing — gate is not live")


CHECKS = [
    ("node", _check_node),
    ("esbuild (syntax gate)", _check_esbuild),
    ("@babel/standalone", _check_babel),
    ("kit export manifest", _check_kit_manifest),
    ("scope-check script", _check_scope_script),
    ("scope gate LIVE", _check_scope_gate_live),
    ("runtime gate LIVE", _check_runtime_gate_live),
]


def preflight_report() -> tuple[bool, list[str]]:
    """(all_armed, lines). Never raises — a broken probe reports as a failure."""
    lines: list[str] = []
    all_ok = True
    for label, fn in CHECKS:
        try:
            ok, detail = fn()
        except Exception as e:  # noqa: BLE001
            ok, detail = False, f"probe raised: {e}"
        all_ok = all_ok and ok
        lines.append(f"  [{'OK ' if ok else 'DOWN'}] {label}: {detail}")
    return all_ok, lines


def log_preflight() -> bool:
    """Print the report. Call at startup so a defanged pipeline is visible."""
    all_ok, lines = preflight_report()
    header = (
        "[F7-DEBUG] [CODEGEN-PREFLIGHT] all quality gates armed"
        if all_ok
        else "[F7-DEBUG] [CODEGEN-PREFLIGHT] *** SOME GATES ARE DOWN — generated "
        "templates will be measurably worse here, with no other symptom ***"
    )
    print(header)
    for line in lines:
        print(f"[F7-DEBUG] [CODEGEN-PREFLIGHT] {line}")
    return all_ok


if __name__ == "__main__":
    import sys

    sys.exit(0 if log_preflight() else 1)
