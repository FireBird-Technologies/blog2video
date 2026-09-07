"""
The provider budget is split by WORKLOAD so template generation cannot starve
video generation or scene edits.

Custom-template generation is the one workload that saturates the gate on its
own — SCENE_CONCURRENCY (8) scenes, each issuing more than one call — and a
semaphore has no notion of priority, so before the cap anything arriving during
a generation waited behind the whole batch.

These pin the three properties that make the split real:
  1. capped (template) work never exceeds _PROVIDER_TEMPLATE_INFLIGHT,
  2. uncapped work gets through while template work saturates its cap, and
  3. uncapped work ALONE can still reach the full _PROVIDER_MAX_INFLIGHT —
     "if nothing else is running, take everything".
"""
import asyncio
import threading
import time

import pytest

from app.dspy_modules import (
    _PROVIDER_MAX_INFLIGHT,
    _PROVIDER_TEMPLATE_INFLIGHT,
    _aprovider_slot,
    _provider_slot,
    get_brand_extraction_lm,
    get_custom_lm,
    get_custom_lm_fallback,
    get_design_doc_lm,
    get_scene_edit_lm,
    get_scene_lm,
    get_scene_type_lm,
    get_theme_lm,
)

pytestmark = pytest.mark.depth


def test_budget_arithmetic():
    """The cap must leave a real remainder for everything else."""
    assert _PROVIDER_TEMPLATE_INFLIGHT >= 1, "template work must make progress"
    assert _PROVIDER_TEMPLATE_INFLIGHT < _PROVIDER_MAX_INFLIGHT, (
        "a cap equal to the total is no cap at all — template work could hold "
        "every permit and starve video/edit work"
    )


def test_template_generation_lms_are_capped():
    """Every LM custom-template generation reaches must be capped.

    If one is missed, generation escapes its ceiling through that path and the
    guarantee quietly stops holding — which is invisible until something else is
    starved, so it is asserted rather than assumed.
    """
    for name, getter in [
        ("custom", get_custom_lm),
        ("custom_fallback", get_custom_lm_fallback),
        ("design_doc", get_design_doc_lm),
        ("brand_extraction", get_brand_extraction_lm),
        # Shared with the scene critic / content_classifier; counted as template
        # work so the cap holds on every path.
        ("scene_type", get_scene_type_lm),
        ("theme", get_theme_lm),
    ]:
        assert getattr(getter(), "_capped", False) is True, f"{name} is not capped"


def test_video_and_edit_lms_are_uncapped():
    """Scene edits and video work must be free to use the whole gate."""
    for name, getter in [("scene_edit", get_scene_edit_lm), ("scene", get_scene_lm)]:
        assert getattr(getter(), "_capped", True) is False, f"{name} is capped"


def _flood(capped: bool, n: int, dur: float, counter: dict, lock: threading.Lock):
    def hold():
        with _provider_slot(capped):
            with lock:
                counter["n"] += 1
                counter["peak"] = max(counter["peak"], counter["n"])
            time.sleep(dur)
            with lock:
                counter["n"] -= 1

    threads = [threading.Thread(target=hold, daemon=True) for _ in range(n)]
    for t in threads:
        t.start()
    return threads


def test_template_work_never_exceeds_its_cap_and_others_get_through():
    counter = {"n": 0, "peak": 0}
    lock = threading.Lock()
    threads = _flood(True, _PROVIDER_MAX_INFLIGHT * 4, 0.25, counter, lock)
    time.sleep(0.1)  # let template work saturate its cap

    started = time.time()
    with _provider_slot(False):
        time.sleep(0.01)
    waited = time.time() - started

    for t in threads:
        t.join()

    assert counter["peak"] <= _PROVIDER_TEMPLATE_INFLIGHT, (
        f"template work held {counter['peak']} permits, cap is "
        f"{_PROVIDER_TEMPLATE_INFLIGHT}"
    )
    # It did not queue behind the batch, which would have cost several 0.25s rounds.
    assert waited < 0.2, f"uncapped call waited {waited:.2f}s behind template work"


def test_uncapped_work_alone_can_use_the_whole_gate():
    """With no template generation running, video/edit work gets all the permits.

    This is the half of the split that a cap alone does not give you: the
    remainder is a FLOOR for uncapped work, not a ceiling.
    """
    counter = {"n": 0, "peak": 0}
    lock = threading.Lock()
    threads = _flood(False, _PROVIDER_MAX_INFLIGHT * 3, 0.2, counter, lock)
    for t in threads:
        t.join()
    assert counter["peak"] == _PROVIDER_MAX_INFLIGHT, (
        f"uncapped work peaked at {counter['peak']}, expected the full "
        f"{_PROVIDER_MAX_INFLIGHT}"
    )


def test_async_path_caps_too():
    """aforward() uses its own semaphores — the same guarantees must hold."""
    state = {"n": 0, "peak": 0}

    async def hold(capped: bool, dur: float):
        async with _aprovider_slot(capped):
            if capped:
                state["n"] += 1
                state["peak"] = max(state["peak"], state["n"])
            await asyncio.sleep(dur)
            if capped:
                state["n"] -= 1

    async def main():
        tasks = [
            asyncio.create_task(hold(True, 0.2))
            for _ in range(_PROVIDER_MAX_INFLIGHT * 4)
        ]
        await asyncio.sleep(0.05)
        started = asyncio.get_event_loop().time()
        await hold(False, 0.01)
        waited = asyncio.get_event_loop().time() - started
        await asyncio.gather(*tasks)
        return waited

    waited = asyncio.run(main())
    assert state["peak"] <= _PROVIDER_TEMPLATE_INFLIGHT
    assert waited < 0.15, f"async uncapped call waited {waited:.2f}s"


def test_slots_release_on_exception():
    """A failing call must not leak its permit.

    Permits are held across a network call that can raise; a leak would shrink
    the budget silently until the service stopped making any calls at all.
    BoundedSemaphore also raises on over-release, so this covers both directions.
    """
    for capped in (True, False):
        for _ in range(_PROVIDER_MAX_INFLIGHT + 2):
            with pytest.raises(RuntimeError):
                with _provider_slot(capped):
                    raise RuntimeError("boom")

    # Still fully available: take every permit without blocking.
    acquired = []
    try:
        for _ in range(_PROVIDER_MAX_INFLIGHT):
            cm = _provider_slot(False)
            cm.__enter__()
            acquired.append(cm)
    finally:
        for cm in acquired:
            cm.__exit__(None, None, None)
    assert len(acquired) == _PROVIDER_MAX_INFLIGHT
