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


def test_all_gates_are_armed_in_this_checkout() -> None:
    """A dev checkout has the full toolchain, so anything DOWN here is a real
    regression in the probes themselves."""
    ok, lines = codegen_preflight.preflight_report()
    assert ok, "gates down in a dev checkout:\n" + "\n".join(lines)
