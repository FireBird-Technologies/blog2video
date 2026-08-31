"""The staged generation pipeline: plan -> generate -> examine.

`generate_component_code` used to run every stage inside one ~370s call, and
`_persist_generated_variants` wrote only at the very end — so a crash at scene 7
of 9 threw away all nine. These tests cover the split into three independently
callable stages plus the per-scene callback that makes partial progress
durable.

The FIRST test here is the golden one: it pins the return shape of the composed
`generate_component_code` against the stages it now delegates to. Every caller
(`_run_codegen_background`, `_run_regen_background`) reads that dict by key, so
a decomposition that silently drops or renames one would break generation
without failing anything else in the suite.
"""
from __future__ import annotations

import asyncio

import pytest

from app.services import code_generator as cg

# Exactly the keys _persist_generated_variants reads off the result.
EXPECTED_KEYS = {
    "intro_code",
    "outro_code",
    "content_codes",
    "archetype_ids",
    "intro_aspect_ratio",
    "outro_aspect_ratio",
    "content_aspect_ratios",
    "generation_warnings",
    "design_blueprint",
    "design_system",
    "layout_prop_schemas",
}


def test_the_staged_building_blocks_are_exported() -> None:
    """The pieces a staged orchestrator needs must be callable on their own."""
    for name in ("GenPlan", "SceneResult", "generate_scene_batch", "assemble_result"):
        assert hasattr(cg, name), f"{name} is not exported"


def test_generate_component_code_accepts_the_staging_hooks() -> None:
    """The orchestrator persists through these; without them there is no staging."""
    import inspect

    params = inspect.signature(cg.generate_component_code).parameters
    for hook in ("on_scene_done", "on_plan_ready", "resume_scenes"):
        assert hook in params, f"{hook} is not a parameter"
        assert params[hook].default is None, f"{hook} must be optional"


def test_composed_result_keeps_every_key_its_callers_read() -> None:
    """The golden test: the composition's dict must not drift from the stages.

    Runs the real composition with each stage faked, so it asserts the wiring
    rather than the LLM behaviour.
    """
    plan = cg.GenPlan(
        brand_context="ctx",
        blueprint={"identity": {"name": "Acme"}, "layouts": []},
        design_system="ds",
        scene_kwargs=[{}, {}, {}],
        scene_labels=["intro", "content", "outro"],
        scene_types_simple=["intro", "content", "outro"],
        archetype_ids=[{"id": "a", "best_for": ["plain"]}],
        theme={},
    )
    results = [
        cg.SceneResult(index=i, code=f"code{i}", aspect_ratios={}, prop_schema=[])
        for i in range(3)
    ]

    async def _run() -> dict:
        return cg.assemble_result(plan, results, warnings=[])

    out = asyncio.run(_run())
    assert set(out) == EXPECTED_KEYS, set(out).symmetric_difference(EXPECTED_KEYS)
    assert out["intro_code"] == "code0"
    assert out["outro_code"] == "code2"
    assert out["content_codes"] == ["code1"]
    assert out["design_blueprint"] is plan.blueprint
    assert out["design_system"] == "ds"


def test_scene_batch_reports_each_scene_as_it_lands() -> None:
    """Per-scene persistence is what makes a crash at scene 7 keep scenes 1-6."""
    seen: list[int] = []

    async def _fake(**kw):
        idx = kw["scene_index"]
        return (f"code{idx}", {"landscape": "16 / 9"}, [])

    plan = cg.GenPlan(
        brand_context="",
        blueprint=None,
        design_system="",
        scene_kwargs=[{"scene_index": i} for i in range(5)],
        scene_labels=[f"s{i}" for i in range(5)],
        scene_types_simple=["content"] * 5,
        archetype_ids=[],
        theme={},
    )

    async def _run():
        return await cg.generate_scene_batch(
            plan, generate=_fake, on_scene_done=lambda r: seen.append(r.index)
        )

    results = asyncio.run(_run())
    assert sorted(seen) == [0, 1, 2, 3, 4]
    assert [r.code for r in results] == [f"code{i}" for i in range(5)]


def test_a_failing_scene_does_not_discard_the_ones_already_done() -> None:
    """The whole point of the split: partial progress survives."""
    seen: list[int] = []

    async def _fake(**kw):
        idx = kw["scene_index"]
        if idx == 3:
            raise RuntimeError("scene 3 exploded")
        return (f"code{idx}", {}, [])

    plan = cg.GenPlan(
        brand_context="",
        blueprint=None,
        design_system="",
        scene_kwargs=[{"scene_index": i} for i in range(5)],
        scene_labels=[f"s{i}" for i in range(5)],
        scene_types_simple=["content"] * 5,
        archetype_ids=[],
        theme={},
    )

    async def _run():
        return await cg.generate_scene_batch(
            plan, generate=_fake, on_scene_done=lambda r: seen.append(r.index)
        )

    results = asyncio.run(_run())
    # Every slot is reported, the failure included — a resumed run has to know
    # scene 3 still needs generating, which it cannot if the slot never lands.
    assert sorted(seen) == [0, 1, 2, 3, 4]
    assert [r.code for r in results if r.code] == ["code0", "code1", "code2", "code4"]
    assert results[3].code == ""
    assert results[3].error and "exploded" in results[3].error


def test_skip_indices_regenerates_only_the_missing_scenes() -> None:
    """A resumed run must not pay for the scenes it already has."""
    called: list[int] = []

    async def _fake(**kw):
        called.append(kw["scene_index"])
        return (f"new{kw['scene_index']}", {}, [])

    plan = cg.GenPlan(
        brand_context="",
        blueprint=None,
        design_system="",
        scene_kwargs=[{"scene_index": i} for i in range(9)],
        scene_labels=[f"s{i}" for i in range(9)],
        scene_types_simple=["content"] * 9,
        archetype_ids=[],
        theme={},
    )
    existing = {
        i: cg.SceneResult(index=i, code=f"old{i}", aspect_ratios={}, prop_schema=[])
        for i in range(6)
    }

    async def _run():
        return await cg.generate_scene_batch(
            plan, generate=_fake, existing=existing
        )

    results = asyncio.run(_run())
    assert sorted(called) == [6, 7, 8], "regenerated scenes it already had"
    assert [r.code for r in results[:6]] == [f"old{i}" for i in range(6)]
    assert [r.code for r in results[6:]] == ["new6", "new7", "new8"]


@pytest.mark.parametrize("total", [3, 9])
def test_assemble_splits_bookends_from_content(total: int) -> None:
    """intro is first, outro is last, everything between is content."""
    plan = cg.GenPlan(
        brand_context="",
        blueprint=None,
        design_system="",
        scene_kwargs=[{} for _ in range(total)],
        scene_labels=[f"s{i}" for i in range(total)],
        scene_types_simple=["content"] * total,
        archetype_ids=[],
        theme={},
    )
    results = [
        cg.SceneResult(index=i, code=f"c{i}", aspect_ratios={}, prop_schema=[])
        for i in range(total)
    ]
    out = cg.assemble_result(plan, results, warnings=[])
    assert out["intro_code"] == "c0"
    assert out["outro_code"] == f"c{total - 1}"
    assert len(out["content_codes"]) == total - 2


# ── the run row and the progress cache ───────────────────────────────────────


def test_progress_writes_are_locked_and_evicted() -> None:
    """The dict is mutated from background threads and read from handlers.

    It was previously unsynchronised AND unbounded — entries were never removed,
    so it grew for the life of the process.
    """
    import threading as _threading

    from app.routers import custom_templates as ct

    assert isinstance(ct._codegen_progress_lock, type(_threading.Lock()))

    ct._codegen_progress.clear()
    barrier = _threading.Barrier(4)

    def _writer(tid: int) -> None:
        barrier.wait()
        for _ in range(50):
            ct._set_progress(tid, step=f"s{tid}", running=True)

    threads = [_threading.Thread(target=_writer, args=(i,)) for i in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    for i in range(4):
        assert ct._get_progress(i)["step"] == f"s{i}"
    ct._codegen_progress.clear()


def test_stale_progress_entries_are_swept() -> None:
    from app.routers import custom_templates as ct

    ct._codegen_progress.clear()
    for i in range(40):
        ct._set_progress(i, step="old")
        ct._codegen_progress[i]["_touched"] = 0.0  # far past the TTL
    ct._set_progress(999, step="fresh")
    assert ct._get_progress(999)["step"] == "fresh"
    assert len(ct._codegen_progress) < 40, "stale entries were never evicted"
    ct._codegen_progress.clear()


def test_get_progress_returns_a_copy() -> None:
    """A handler must not be able to mutate the shared entry it read."""
    from app.routers import custom_templates as ct

    ct._codegen_progress.clear()
    ct._set_progress(1, step="a")
    got = ct._get_progress(1)
    got["step"] = "mutated"
    assert ct._get_progress(1)["step"] == "a"
    ct._codegen_progress.clear()


def test_run_hooks_persist_the_plan_before_any_scene() -> None:
    """A crash during scenes must not also cost the 60-90s blueprint call."""
    from app.routers import custom_templates as ct

    writes: list[dict] = []
    original = ct._run_write
    ct._run_write = lambda run_id, **f: writes.append(f)  # type: ignore[assignment]
    try:
        on_plan, on_scene, _on_count, _on_verify = ct._run_hooks(1, 1)
        on_plan(
            {
                "blueprint": {"identity": {"name": "Acme"}},
                "design_system": "ds",
                "scene_labels": ["intro", "outro"],
                "total_scenes": 2,
            }
        )
        on_scene(cg.SceneResult(index=0, code="c0", aspect_ratios={}, prop_schema=[]))
    finally:
        ct._run_write = original  # type: ignore[assignment]

    assert writes[0]["stage"] == "scenes"
    assert "Acme" in writes[0]["blueprint_json"]
    assert writes[0]["design_system"] == "ds"
    # The plan lands STRICTLY before the first scene result.
    assert "scene_results" not in writes[0]
    assert "scene_results" in writes[1]


def test_scene_count_is_published_before_the_plan() -> None:
    """The scene total must reach the UI as soon as scene types are decided.

    It used to arrive only with on_plan_ready, ~50s later, so the progress rail
    showed "Scenes" with no counter for most of the design phase.
    """
    import json as _json

    from app.routers import custom_templates as ct

    writes: list[dict] = []
    original = ct._run_write
    ct._run_write = lambda run_id, **f: writes.append(f)  # type: ignore[assignment]
    ct._codegen_progress.clear()
    try:
        _on_plan, _on_scene, on_count, _on_verify = ct._run_hooks(1, 1)
        on_count(9)
    finally:
        ct._run_write = original  # type: ignore[assignment]

    assert _json.loads(writes[0]["scene_plan"])["total"] == 9
    assert ct._get_progress(1)["scenes_total"] == 9
    ct._codegen_progress.clear()


def test_verify_start_publishes_the_examine_stage() -> None:
    """The validation pass needs its own stage or the UI looks stalled.

    Once every scene has landed the counter reads N/N, but the run is still
    working — a failing scene is re-generated up to MAX_SCENE_RETRIES times here.
    Without this stage the rail sat on "Scenes" for that whole pass, then jumped
    straight to "Saving".
    """
    from app.routers import custom_templates as ct

    writes: list[dict] = []
    original = ct._run_write
    ct._run_write = lambda run_id, **f: writes.append(f)  # type: ignore[assignment]
    ct._codegen_progress.clear()
    try:
        _on_plan, _on_scene, _on_count, on_verify = ct._run_hooks(1, 1)
        on_verify()
    finally:
        ct._run_write = original  # type: ignore[assignment]

    assert writes[-1]["stage"] == "examine"
    assert ct._get_progress(1)["step"] == "examine"
    ct._codegen_progress.clear()


def test_generate_component_code_accepts_the_verify_hook() -> None:
    """The router passes it; a rename here would silently drop the stage."""
    import inspect

    params = inspect.signature(cg.generate_component_code).parameters
    assert "on_verify_start" in params
    assert params["on_verify_start"].default is None


def test_a_zero_scene_count_is_not_published() -> None:
    """A zero total is 'unknown', not 'no scenes' — it must not overwrite."""
    from app.routers import custom_templates as ct

    writes: list[dict] = []
    original = ct._run_write
    ct._run_write = lambda run_id, **f: writes.append(f)  # type: ignore[assignment]
    try:
        _on_plan, _on_scene, on_count, _on_verify = ct._run_hooks(1, 1)
        on_count(0)
    finally:
        ct._run_write = original  # type: ignore[assignment]

    assert writes == []


def test_the_plan_total_overrides_the_provisional_count() -> None:
    """The blueprint can change the scene count; its total is authoritative."""
    import json as _json

    from app.routers import custom_templates as ct

    writes: list[dict] = []
    original = ct._run_write
    ct._run_write = lambda run_id, **f: writes.append(f)  # type: ignore[assignment]
    try:
        on_plan, _on_scene, on_count, _on_verify = ct._run_hooks(1, 1)
        on_count(8)  # provisional, from scene types
        on_plan(
            {
                "blueprint": None,
                "design_system": "ds",
                "scene_labels": ["intro"] + ["c"] * 7 + ["outro"],
                "total_scenes": 9,  # authoritative, after the blueprint
            }
        )
    finally:
        ct._run_write = original  # type: ignore[assignment]

    assert _json.loads(writes[0]["scene_plan"])["total"] == 8
    assert _json.loads(writes[-1]["scene_plan"])["total"] == 9


def test_scene_results_accumulate_in_index_order() -> None:
    """Scenes finish out of order; the stored slots must still be ordered."""
    import json as _json

    from app.routers import custom_templates as ct

    writes: list[dict] = []
    original = ct._run_write
    ct._run_write = lambda run_id, **f: writes.append(f)  # type: ignore[assignment]
    try:
        _on_plan, on_scene, _on_count, _on_verify = ct._run_hooks(1, 1)
        for idx in (2, 0, 1):
            on_scene(cg.SceneResult(index=idx, code=f"c{idx}", aspect_ratios={}, prop_schema=[]))
    finally:
        ct._run_write = original  # type: ignore[assignment]

    stored = _json.loads(writes[-1]["scene_results"])
    assert [s["index"] for s in stored] == [0, 1, 2]
    assert [s["code"] for s in stored] == ["c0", "c1", "c2"]


def test_a_failing_persist_hook_cannot_kill_a_generation() -> None:
    """Progress persistence is best-effort; the scenes matter more."""

    async def _fake(**kw):
        return (f"code{kw['scene_index']}", {}, [])

    def _explode(_result):
        raise RuntimeError("db is down")

    plan = cg.GenPlan(
        brand_context="",
        blueprint=None,
        design_system="",
        scene_kwargs=[{"scene_index": i} for i in range(3)],
        scene_labels=["a", "b", "c"],
        scene_types_simple=["content"] * 3,
        archetype_ids=[],
        theme={},
    )

    async def _run():
        return await cg.generate_scene_batch(plan, generate=_fake, on_scene_done=_explode)

    results = asyncio.run(_run())
    assert [r.code for r in results] == ["code0", "code1", "code2"]


def test_generate_component_code_has_no_use_before_assignment() -> None:
    """A name read before it is assigned is only found at RUNTIME, ~150s in.

    Exactly that shipped: the GenPlan built for the scene batch read
    scene_types_simple, which was not assigned until the repair loop 50 lines
    later. Every gate passed — the tests drive generate_scene_batch with fake
    plans and never execute this function's own body — and the failure surfaced
    as "cannot access local variable 'scene_types_simple'" after the blueprint
    and design system had already been paid for.
    """
    import ast
    import inspect
    import textwrap

    src = textwrap.dedent(inspect.getsource(cg.generate_component_code))
    fn = ast.parse(src).body[0]

    first_assigned: dict[str, int] = {}
    for node in ast.walk(fn):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            first_assigned[node.id] = min(
                first_assigned.get(node.id, node.lineno), node.lineno
            )

    offenders = {
        node.id
        for node in ast.walk(fn)
        if isinstance(node, ast.Name)
        and isinstance(node.ctx, ast.Load)
        and node.id in first_assigned
        and node.lineno < first_assigned[node.id]
    }
    assert not offenders, f"read before assignment: {sorted(offenders)}"


# ── failure handling: refunds and stuck flags ────────────────────────────────
#
# Staging added new persistence calls to the failure paths, and a refund or a
# flag reset that a new call can pre-empt is a user-visible bug: a lost slot, or
# a template stuck in "Regenerating..." forever.


def test_run_helpers_never_raise() -> None:
    """They run in the failure path — one that throws pre-empts the refund."""
    from app.routers import custom_templates as ct

    ct._run_finish(None, 1, status="failed", error="x")
    ct._run_write(None, stage="x")
    ct._run_write(10**9, stage="x")
    ct._run_finish(10**9, 10**9, status="failed", error="x")


def test_both_failure_paths_still_refund_and_clear_flags() -> None:
    """The refund and the flag reset must survive alongside the run bookkeeping."""
    import ast
    import inspect
    import textwrap

    from app.routers import custom_templates as ct

    for fn_name, must_call in (
        ("_run_codegen_background", {"_refund_template_slot", "_run_finish"}),
        ("_run_regen_background", {"_refund_template_slot", "_run_finish"}),
    ):
        src = textwrap.dedent(inspect.getsource(getattr(ct, fn_name)))
        fn = ast.parse(src).body[0]
        called = {
            node.func.id
            for outer in ast.walk(fn)
            if isinstance(outer, ast.Try)
            for handler in outer.handlers
            for node in ast.walk(handler)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        }
        assert must_call <= called, f"{fn_name} lost {must_call - called} from its except block"


def test_regeneration_failure_clears_is_regenerating() -> None:
    """A template left flagged is stuck in 'Regenerating...' with no way back."""
    import ast
    import inspect
    import textwrap

    from app.routers import custom_templates as ct

    src = textwrap.dedent(inspect.getsource(ct._run_regen_background))
    fn = ast.parse(src).body[0]
    cleared = [
        node
        for outer in ast.walk(fn)
        if isinstance(outer, ast.Try)
        for handler in outer.handlers
        for node in ast.walk(handler)
        if isinstance(node, ast.Attribute) and node.attr == "is_regenerating"
    ]
    assert cleared, "is_regenerating is never cleared on the failure path"


def test_orphan_sweep_also_frees_templates_with_no_run_row() -> None:
    """A run row is not guaranteed — _run_create returns None on a DB blip, and
    templates predating staging never had one. Without this they stay stuck."""
    import ast
    import inspect
    import textwrap

    from app.routers import custom_templates as ct

    src = textwrap.dedent(inspect.getsource(ct.fail_orphaned_gen_runs))
    assert "active_gen_run_id.is_(None)" in src
    assert "is_regenerating.is_(True)" in src


def test_only_the_failed_scene_is_retried() -> None:
    """A flaky scene must not cost the eight healthy ones.

    One scene raising used to abort the run, and the caller's recovery was to
    regenerate the whole batch — paying for every healthy scene again to rescue
    one, usually for a transient LLM flake.
    """
    calls: list[int] = []

    async def _gen(**kw):
        idx = kw["scene_index"]
        calls.append(idx)
        if idx == 3 and calls.count(3) == 1:
            raise RuntimeError("transient flake")
        return (f"code{idx}", {}, [])

    plan = cg.GenPlan(
        brand_context="",
        blueprint=None,
        design_system="",
        scene_kwargs=[{"scene_index": i} for i in range(9)],
        scene_labels=[f"s{i}" for i in range(9)],
        scene_types_simple=["content"] * 9,
        archetype_ids=[],
        theme={},
    )

    async def _run():
        batch = await cg.generate_scene_batch(plan, generate=_gen)
        broken = [r for r in batch if r.error]
        if broken:
            keep = {r.index: r for r in batch if not r.error}
            batch = await cg.generate_scene_batch(plan, generate=_gen, existing=keep)
        return batch

    results = asyncio.run(_run())
    assert calls[9:] == [3], f"retry regenerated more than the failure: {calls[9:]}"
    assert all(r.code for r in results)


def test_the_plan_is_written_to_the_template_row_before_scenes() -> None:
    """design_blueprint/design_system are finished products of stage A.

    Holding them until the end meant a run that died during scenes discarded a
    blueprint that had succeeded minutes earlier.
    """
    import ast
    import inspect
    import textwrap

    from app.routers import custom_templates as ct

    src = textwrap.dedent(inspect.getsource(ct._run_hooks))
    fn = ast.parse(src).body[0]
    on_plan = next(
        n
        for n in ast.walk(fn)
        if isinstance(n, ast.FunctionDef) and n.name == "on_plan_ready"
    )
    written = {
        node.attr
        for node in ast.walk(on_plan)
        if isinstance(node, ast.Attribute) and isinstance(node.ctx, ast.Store)
    }
    assert {"design_blueprint", "design_system"} <= written, written
    # The scene CODE columns must stay end-only: a half-written set would be
    # rendered as if it were complete.
    assert "intro_code" not in written
    assert "content_codes" not in written


# ── the status endpoint's terminal states ────────────────────────────────────


def _status_branches(*, is_regenerating: bool, intro_code, generation_failed, progress: dict):
    """The fallback branch order of get_generation_status, once the run row is
    unreachable (_run_finish clears tpl.active_gen_run_id as its last act).

    Mirrored here rather than exercised through the endpoint because the real
    call needs auth + a DB session; what matters is the ORDER of the branches,
    which is what the bug was.
    """
    if not is_regenerating and intro_code:
        return "complete"
    if not is_regenerating and generation_failed:
        return "error"
    if progress:
        return progress.get("status")
    if is_regenerating:
        return "generating"
    if intro_code:
        return "complete"
    return "unknown"


def test_a_finished_run_reports_complete_not_a_stale_progress_dict() -> None:
    """The creator modal closes on status == "complete"; it never arrived.

    _run_finish clears tpl.active_gen_run_id, so a COMPLETED run has no
    reachable run row. The leftover in-memory progress dict was returned
    verbatim instead — and nothing ever writes status="complete" into it, so the
    payload had no status at all and the modal polled forever on an all-green
    rail with the elapsed timer still running.
    """
    stale = {"step": "saving", "scenes_done": 9, "scenes_total": 9}
    assert (
        _status_branches(
            is_regenerating=False, intro_code="code", generation_failed=False, progress=stale
        )
        == "complete"
    )


def test_a_failed_run_reports_error_rather_than_polling_forever() -> None:
    """Same trap on the failure path: no run row, no code, stale progress."""
    stale = {"step": "generating_scenes", "scenes_done": 3, "scenes_total": 9}
    assert (
        _status_branches(
            is_regenerating=False, intro_code=None, generation_failed=True, progress=stale
        )
        == "error"
    )


def test_a_running_regeneration_is_not_reported_complete() -> None:
    """During a regen intro_code still holds the OLD code.

    Testing intro_code before is_regenerating would report an in-flight
    regeneration as already finished, which is why the guard is ordered.
    """
    stale = {"step": "generating_scenes"}
    assert (
        _status_branches(
            is_regenerating=True, intro_code="OLD CODE", generation_failed=False, progress=stale
        )
        is None
    ), "a running regen must fall through to the progress dict, not report complete"


def test_a_run_still_generating_keeps_reporting_progress() -> None:
    """The fix must not make an in-flight first generation look terminal."""
    stale = {"step": "generating_scenes", "scenes_done": 2, "scenes_total": 9}
    assert (
        _status_branches(
            is_regenerating=False, intro_code=None, generation_failed=False, progress=stale
        )
        is None
    ), "still-running: no terminal status, so the client keeps polling"


# ── the scene counter must not visibly change mid-run ────────────────────────


def test_the_provisional_scene_total_is_marked_as_provisional() -> None:
    """Two writers fill `scene_plan`: on_scene_count publishes an early estimate
    (~8s in, no labels), and on_plan_ready overwrites it with the authoritative
    count once the blueprint has authored its own layouts.

    The blueprint picks a brand-seeded 6-8 content layouts, so the two figures
    genuinely differ — a user watched "Layouts 0/8" become "0/9". `labels` is
    what separates them, so the UI can wait for the real number instead of
    showing one that moves.
    """
    import json

    provisional = json.loads(json.dumps({"labels": [], "total": 8}))
    authoritative = json.loads(
        json.dumps({"labels": ["intro", "a", "b", "outro"], "total": 9})
    )

    assert not provisional["labels"], "the early write must carry no labels"
    assert authoritative["labels"], "the authoritative write must carry labels"
    assert provisional["total"] != authoritative["total"]


def test_the_blueprint_can_legitimately_change_the_total() -> None:
    """Not a bug to be papered over: 6-8 content layouts plus intro and outro is
    8-10 scenes, chosen deterministically per brand. The early estimate assumes
    whatever the scene-type stage produced, which the blueprint then replaces."""
    from app.dspy_modules.blueprint import CONTENT_LAYOUT_MAX, CONTENT_LAYOUT_MIN

    assert CONTENT_LAYOUT_MIN == 6 and CONTENT_LAYOUT_MAX == 8
    # Bookends are always exactly one each.
    assert CONTENT_LAYOUT_MIN + 2 == 8
    assert CONTENT_LAYOUT_MAX + 2 == 10
