"""
Depth tier — LLM stock search query generation.

The LLM is always mocked here: these lock in the sanitising and the fallback
paths, which are what stand between a model hiccup and a video with no footage.
Query *quality* is not assertable and is verified by hand against live providers.
"""
from types import SimpleNamespace

import pytest

from app.dspy_modules import stock_query_gen
from app.dspy_modules.stock_query_gen import _sanitise, generate_stock_queries

pytestmark = pytest.mark.depth


def _scene(scene_id: int = 1, **kw) -> dict:
    return {
        "scene_id": scene_id,
        "title": kw.get("title", "A Title"),
        "display_text": kw.get("display_text", ""),
        "narration": kw.get("narration", "Some narration."),
        "visual_description": kw.get("visual_description", ""),
    }


def _fake_predictor(monkeypatch, answers):
    """Patch dspy.Predict so no network call happens. ``answers`` maps scene
    title -> the raw string the model 'returns', or an Exception to raise."""

    class _Fake:
        def __init__(self, _sig):
            pass

        def __call__(self, **kwargs):
            answer = answers.get(kwargs.get("scene_title"), "generic footage")
            if isinstance(answer, BaseException):
                raise answer
            return SimpleNamespace(search_query=answer)

    monkeypatch.setattr(stock_query_gen.dspy, "Predict", _Fake)
    # asyncify would spin up a thread pool; wrap the sync callable instead.
    monkeypatch.setattr(
        stock_query_gen.dspy, "asyncify",
        lambda fn: (lambda **kw: _as_coro(fn, **kw)),
    )
    monkeypatch.setattr(stock_query_gen, "ensure_dspy_configured", lambda: None)
    monkeypatch.setattr(stock_query_gen, "get_scene_lm", lambda: None)

    class _Ctx:
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(stock_query_gen.dspy, "context", lambda **kw: _Ctx())


async def _as_coro(fn, **kw):
    return fn(**kw)


# ─── Sanitising ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("business handshake office", "business handshake office"),
        ('  "person sleeping bedroom"  ', "person sleeping bedroom"),
        ("factory smokestack sky.", "factory smokestack sky"),
        ("one two three four five six", "one two three four"),   # capped at 4
        ("", ""),
        ("   ", ""),
        ("!!!", ""),
    ],
)
def test_sanitise__strips_model_formatting(raw, expected):
    assert _sanitise(raw) == expected


def test_sanitise__respects_char_cap():
    assert len(_sanitise("supercalifragilistic " * 10)) <= 80


# ─── Generation + fallbacks ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate__returns_a_query_per_scene(monkeypatch):
    _fake_predictor(monkeypatch, {"Sleep": "person sleeping bedroom", "Solar": "solar panel roof"})

    out = await generate_stock_queries(
        [_scene(1, title="Sleep"), _scene(2, title="Solar")], video_topic="health"
    )

    assert out == {1: "person sleeping bedroom", 2: "solar panel roof"}


@pytest.mark.asyncio
async def test_generate__omits_scenes_whose_call_failed(monkeypatch):
    """A per-scene failure must not lose the other scenes' queries."""
    _fake_predictor(monkeypatch, {"Good": "city street night", "Bad": RuntimeError("boom")})

    out = await generate_stock_queries([_scene(1, title="Good"), _scene(2, title="Bad")])

    assert out == {1: "city street night"}      # scene 2 falls back to keywords


@pytest.mark.asyncio
async def test_generate__omits_scenes_with_empty_output(monkeypatch):
    _fake_predictor(monkeypatch, {"Empty": "   "})

    assert await generate_stock_queries([_scene(1, title="Empty")]) == {}


@pytest.mark.asyncio
async def test_generate__empty_input_makes_no_llm_call(monkeypatch):
    called = []
    monkeypatch.setattr(
        stock_query_gen, "ensure_dspy_configured", lambda: called.append(1)
    )

    assert await generate_stock_queries([]) == {}
    assert not called


@pytest.mark.asyncio
async def test_generate__total_failure_returns_empty_not_raises(monkeypatch):
    """Stock footage is best-effort; it must never fail scene generation."""
    _fake_predictor(monkeypatch, {"A": RuntimeError("x"), "B": RuntimeError("y")})

    assert await generate_stock_queries([_scene(1, title="A"), _scene(2, title="B")]) == {}


@pytest.mark.asyncio
async def test_generate__truncates_long_narration(monkeypatch):
    """Long narration costs tokens without changing the visual subject."""
    seen: dict = {}

    class _Fake:
        def __init__(self, _sig):
            pass

        def __call__(self, **kwargs):
            seen.update(kwargs)
            return SimpleNamespace(search_query="ok query")

    monkeypatch.setattr(stock_query_gen.dspy, "Predict", _Fake)
    monkeypatch.setattr(
        stock_query_gen.dspy, "asyncify",
        lambda fn: (lambda **kw: _as_coro(fn, **kw)),
    )
    monkeypatch.setattr(stock_query_gen, "ensure_dspy_configured", lambda: None)
    monkeypatch.setattr(stock_query_gen, "get_scene_lm", lambda: None)

    class _Ctx:
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(stock_query_gen.dspy, "context", lambda **kw: _Ctx())

    await generate_stock_queries([_scene(1, narration="word " * 500)])

    assert len(seen["narration"]) <= stock_query_gen._MAX_NARRATION_CHARS
