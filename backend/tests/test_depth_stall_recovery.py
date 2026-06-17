"""
Depth tier — stall-recovery cancellation registry.

The cooperative-cancel coordination a stalled background job polls: arm -> the
worker watches the Event, request_cancel sets it, clear drops it. (The heavier
reaper/refund that reverts a stuck job lives in the routers and is exercised via
the failure-refund tests.)
"""
import pytest

from app.services import stall_recovery

pytestmark = pytest.mark.depth


def test_registry__arm_then_cancel_then_clear():
    kind, job_id = "voice", 90001
    try:
        ev = stall_recovery.arm(kind, job_id)
        assert ev is not None
        assert stall_recovery.is_cancel_requested(kind, job_id) is False

        stall_recovery.request_cancel(kind, job_id)
        assert stall_recovery.is_cancel_requested(kind, job_id) is True
        assert ev.is_set() is True  # the worker's Event is signalled

        stall_recovery.clear(kind, job_id)
        assert stall_recovery.is_cancel_requested(kind, job_id) is False
    finally:
        stall_recovery.clear(kind, job_id)


def test_registry__unknown_job_not_cancelled():
    assert stall_recovery.is_cancel_requested("voice", 99999999) is False


def test_registry__request_cancel_unknown_is_safe():
    # No registered job — must not raise.
    stall_recovery.request_cancel("script", 88888888)
