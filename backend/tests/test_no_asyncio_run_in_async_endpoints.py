"""`asyncio.run()` inside an `async def` is unconditionally broken.

FastAPI runs an `async def` endpoint ON the event loop, so `asyncio.run()` there
raises `RuntimeError: asyncio.run() cannot be called from a running event loop`
— synchronously, before the coroutine body executes at all.

That is not theoretical. `regenerate_scene` refilled a scene's structured content
through `asyncio.run(refill_structured_content_for_layout(...))` wrapped in a bare
`except Exception`. The RuntimeError fired on every layout switch, the except
swallowed it, and every OTHER statement in the block still ran — so
`contentVariantIndex`, `preferred_layout` and `layoutProps` all moved to the new
layout while `structuredContent` silently kept the old layout's shape. The new
layout then rendered empty (project 1212: a "versus" scene showing bare SIDE A /
SIDE B panels with `contentType: "steps"` underneath).

The existing coverage could not catch it: `test_layout_content_routing.py` greps
the source for the call, and calls the coroutine directly from sync test context
where `asyncio.run` works fine. This checks the thing that actually breaks —
where the call sits — via the AST, so it holds for any future endpoint too.
"""
from __future__ import annotations

import ast
from pathlib import Path

import pytest

_ROUTERS = sorted((Path(__file__).resolve().parents[1] / "app" / "routers").glob("*.py"))


def _asyncio_run_calls_in_async_defs(tree: ast.AST) -> list[tuple[str, int]]:
    """Every `asyncio.run(...)` lexically inside an `async def`.

    Walks nested scopes so a sync helper defined inside an async function — where
    `asyncio.run` would be legitimate — is not flagged.
    """
    found: list[tuple[str, int]] = []

    def walk(node: ast.AST, in_async: str | None) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, ast.AsyncFunctionDef):
                walk(child, child.name)
                continue
            if isinstance(child, ast.FunctionDef):
                # A plain `def` re-enters sync context: asyncio.run is fine there.
                walk(child, None)
                continue
            if (
                in_async
                and isinstance(child, ast.Call)
                and isinstance(child.func, ast.Attribute)
                and child.func.attr == "run"
                and isinstance(child.func.value, ast.Name)
                and child.func.value.id == "asyncio"
            ):
                found.append((in_async, child.lineno))
            walk(child, in_async)

    walk(tree, None)
    return found


@pytest.mark.parametrize("path", _ROUTERS, ids=lambda p: p.name)
def test_no_asyncio_run_inside_an_async_endpoint(path: Path) -> None:
    offenders = _asyncio_run_calls_in_async_defs(ast.parse(path.read_text()))
    assert not offenders, (
        f"{path.name}: asyncio.run() inside an async def at "
        + ", ".join(f"{fn}() line {ln}" for fn, ln in offenders)
        + ". This raises RuntimeError at runtime before the coroutine runs — "
        "use `await` instead. If the call is in a sync background job, move it "
        "into a plain `def`."
    )


def test_the_detector_flags_the_shape_it_is_meant_to_catch() -> None:
    """Guards the guard: a checker that silently matches nothing is worthless."""
    bad = ast.parse(
        "import asyncio\n"
        "async def endpoint():\n"
        "    return asyncio.run(thing())\n"
    )
    assert _asyncio_run_calls_in_async_defs(bad) == [("endpoint", 3)]

    # A sync function nested in an async one is a legitimate place for it.
    ok = ast.parse(
        "import asyncio\n"
        "async def endpoint():\n"
        "    def worker():\n"
        "        return asyncio.run(thing())\n"
        "    return worker\n"
    )
    assert _asyncio_run_calls_in_async_defs(ok) == []

    # Top-level sync background jobs are the common, correct case.
    ok2 = ast.parse("import asyncio\ndef job():\n    return asyncio.run(thing())\n")
    assert _asyncio_run_calls_in_async_defs(ok2) == []
