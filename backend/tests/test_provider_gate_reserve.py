"""
The provider budget is split so batch work cannot starve an interactive edit.

A semaphore has no notion of priority, and a template generation always has more
calls queued than there are permits — so before the split, a scene edit started
during a generation waited behind the whole batch and the editor's poll gave up
while the backend was still working.

These pin the two properties that make the reserve real:
  1. batch work can never hold more than _PROVIDER_BATCH_INFLIGHT permits, and
  2. an interactive call gets through while batch traffic is saturating the gate.
"""
import asyncio
import threading
import time

import pytest

from app.dspy_modules import (
    _PROVIDER_BATCH_INFLIGHT,
    _PROVIDER_INTERACTIVE_RESERVE,
    _PROVIDER_MAX_INFLIGHT,
    _aprovider_slot,
    _provider_slot,
    get_scene_edit_lm,
)

pytestmark = pytest.mark.depth


def test_budget_arithmetic():
    """The reserve is what the total does not lend to batch."""
    assert _PROVIDER_BATCH_INFLIGHT + _PROVIDER_INTERACTIVE_RESERVE == _PROVIDER_MAX_INFLIGHT
    assert _PROVIDER_INTERACTIVE_RESERVE >= 1, "no reserve means no protection"
    assert _PROVIDER_BATCH_INFLIGHT >= 1, "batch must still make progress"


def test_scene_edit_lm_is_marked_interactive():
    """The one LM a person waits on must be able to reach the reserve.

    If this flag is ever dropped, the split silently stops protecting anything —
    every call becomes batch and the reserve just lowers total throughput.
    """
    assert getattr(get_scene_edit_lm(), "_interactive", False) is True


def test_batch_never_exceeds_its_cap_and_interactive_gets_through():
    """Flood the gate with batch work, then let an interactive call in."""
    inflight = {"batch": 0}
    peak = {"batch": 0}
    lock = threading.Lock()

    def hold(interactive: bool, dur: float):
        with _provider_slot(interactive):
            if not interactive:
                with lock:
                    inflight["batch"] += 1
                    peak["batch"] = max(peak["batch"], inflight["batch"])
            time.sleep(dur)
            if not interactive:
                with lock:
                    inflight["batch"] -= 1

    # Far more batch calls than permits, each long enough to keep the gate full.
    threads = [
        threading.Thread(target=hold, args=(False, 0.25), daemon=True)
        for _ in range(_PROVIDER_MAX_INFLIGHT * 4)
    ]
    for t in threads:
        t.start()
    time.sleep(0.1)  # let batch saturate

    started = time.time()
    hold(True, 0.01)
    waited = time.time() - started

    for t in threads:
        t.join()

    assert peak["batch"] <= _PROVIDER_BATCH_INFLIGHT, (
        f"batch held {peak['batch']} permits, cap is {_PROVIDER_BATCH_INFLIGHT} — "
        "the reserve is reachable by batch work"
    )
    # Generous bound: the point is that it did not queue behind the batch, which
    # would have taken multiple 0.25s rounds.
    assert waited < 0.2, f"interactive call waited {waited:.2f}s behind batch work"


def test_async_path_reserves_too():
    """aforward() uses its own semaphores — the same guarantee must hold there."""
    state = {"batch": 0, "peak": 0}

    async def hold(interactive: bool, dur: float):
        async with _aprovider_slot(interactive):
            if not interactive:
                state["batch"] += 1
                state["peak"] = max(state["peak"], state["batch"])
            await asyncio.sleep(dur)
            if not interactive:
                state["batch"] -= 1

    async def main():
        tasks = [
            asyncio.create_task(hold(False, 0.2))
            for _ in range(_PROVIDER_MAX_INFLIGHT * 4)
        ]
        await asyncio.sleep(0.05)
        started = asyncio.get_event_loop().time()
        await hold(True, 0.01)
        waited = asyncio.get_event_loop().time() - started
        await asyncio.gather(*tasks)
        return waited

    waited = asyncio.run(main())
    assert state["peak"] <= _PROVIDER_BATCH_INFLIGHT
    assert waited < 0.15, f"async interactive call waited {waited:.2f}s"


def test_slots_release_on_exception():
    """A failing call must not leak its permit.

    Permits are held across a network call that can raise; a leak would shrink
    the budget silently until the service stopped making any calls at all.
    BoundedSemaphore would also raise on an over-release, so this covers both.
    """
    for interactive in (True, False):
        for _ in range(_PROVIDER_MAX_INFLIGHT + 2):
            with pytest.raises(RuntimeError):
                with _provider_slot(interactive):
                    raise RuntimeError("boom")

    # Still fully available: acquire every permit without blocking.
    acquired = []
    try:
        for _ in range(_PROVIDER_MAX_INFLIGHT):
            cm = _provider_slot(True)
            cm.__enter__()
            acquired.append(cm)
    finally:
        for cm in acquired:
            cm.__exit__(None, None, None)
    assert len(acquired) == _PROVIDER_MAX_INFLIGHT
