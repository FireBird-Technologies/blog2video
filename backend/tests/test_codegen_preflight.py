"""The preflight report: can it tell an armed pipeline from a defanged one?

Every codegen quality gate fails OPEN, so a missing toolchain degrades output
silently. The deployed image shipped without @babel/standalone and Level-2
validation stopped running for every generation, with nothing in the logs and
no symptom except worse templates. These tests pin the report that makes that
difference visible.
"""
from __future__ import annotations

from app.services import codegen_preflight


def test_report_returns_a_line_per_check() -> None:
    ok, lines = codegen_preflight.preflight_report()
    assert len(lines) == len(codegen_preflight.CHECKS)
    assert isinstance(ok, bool)


def test_every_line_is_labelled_ok_or_down() -> None:
    _, lines = codegen_preflight.preflight_report()
    for line in lines:
        assert "[OK ]" in line or "[DOWN]" in line


def test_a_probe_that_raises_reports_down_rather_than_exploding() -> None:
    """The report runs at startup; it must never be able to take boot down."""
    def _boom() -> tuple[bool, str]:
        raise RuntimeError("toolchain on fire")

    original = codegen_preflight.CHECKS
    codegen_preflight.CHECKS = [*original, ("exploding probe", _boom)]
    try:
        ok, lines = codegen_preflight.preflight_report()
        assert ok is False
        assert any("toolchain on fire" in line and "[DOWN]" in line for line in lines)
    finally:
        codegen_preflight.CHECKS = original


def test_the_report_agrees_with_the_toolchain_it_found() -> None:
    """The report must be CONSISTENT, not green.

    Asserting `ok is True` here was wrong: it encoded "this machine has npm
    dependencies installed", which is true of a dev checkout and false of the
    backend CI job (Python only — no esbuild, no babel) and of any environment
    that legitimately runs without them. Failing open there is the designed
    behaviour, so a green report is not what this test is for.

    What must hold everywhere is that the summary matches the lines: the report
    claims all-armed only when every individual probe is armed. That catches a
    real regression in the aggregation while staying true in every environment.
    """
    ok, lines = codegen_preflight.preflight_report()
    assert ok == all("[OK ]" in line for line in lines)


def test_a_down_toolchain_takes_the_summary_down_with_it() -> None:
    """One dead gate must not be averaged away into an all-clear."""
    original = codegen_preflight.CHECKS
    codegen_preflight.CHECKS = [
        ("armed", lambda: (True, "fine")),
        ("dead", lambda: (False, "NOT FOUND")),
    ]
    try:
        ok, lines = codegen_preflight.preflight_report()
        assert ok is False
        assert any("[DOWN]" in line for line in lines)
    finally:
        codegen_preflight.CHECKS = original
