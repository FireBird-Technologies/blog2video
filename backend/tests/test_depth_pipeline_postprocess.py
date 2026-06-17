"""
Depth tier — pipeline post-processing on (replayed) LLM output (Part C).

The LLM is non-deterministic, so we never call it here. Instead:
  - a synthetic "LLM output" exercises the real layout-binding post-processing
    (_sanitize_script_layouts) — green now, no recordings needed;
  - the replay fixture proves we can feed recorded output through the pipeline;
  - recorded real captures (if present) are run through the same post-processing
    and asserted to produce only template-valid layouts. These SKIP until you run
    tests/recordings/capture_llm_fixtures.py with real API keys.

Assertions are contract-level (structure / valid layout set), not exact text —
so they survive model drift.
"""
import asyncio

import pytest

from app.routers.pipeline import _sanitize_script_layouts
from app.services.template_service import get_valid_layouts

from tests.conftest import available_recordings, load_recording

pytestmark = pytest.mark.depth


# ─── Real post-processing against synthetic LLM scenes (green now) ──────────

def test_sanitize_layouts__binds_messy_scenes_to_valid_set():
    # Simulate what the LLM returns: a mix of valid, invalid, and reserved layouts.
    scenes = [
        {"preferred_layout": "totally_made_up"},   # invalid -> replaced
        {"preferred_layout": "bullet_list"},        # valid -> kept (or diversified)
        {"preferred_layout": "ending_socials"},     # reserved -> only allowed on last
        {"preferred_layout": "GARBAGE-123"},        # invalid -> replaced
    ]
    out = _sanitize_script_layouts("default", scenes, include_ending_socials=True)
    valid = get_valid_layouts("default")

    # Every scene ends up with a template-valid layout — no hallucinated layout
    # can reach the renderer.
    assert all(s["preferred_layout"] in valid for s in out)
    # Hero is forced first; ending_socials reserved for the final scene.
    assert out[0]["preferred_layout"] == "hero_image"
    assert out[-1]["preferred_layout"] == "ending_socials"


def test_sanitize_layouts__custom_template_passthrough():
    scenes = [{"preferred_layout": "anything"}]
    out = _sanitize_script_layouts("custom_123", scenes, include_ending_socials=False)
    assert out[0]["preferred_layout"] == "anything"  # custom templates are not sanitized


# ─── The replay fixture itself works ────────────────────────────────────────

def test_replay_script__returns_recorded_output(replay_script):
    recording = {
        "title": "Recorded Title",
        "scenes": [{"narration_text": "hi", "preferred_layout": "bullet_list"}],
    }
    replay_script(recording)

    from app.dspy_modules.script_gen import ScriptGenerator
    out = asyncio.run(ScriptGenerator().generate(blog_content="", blog_images=[]))
    assert out == recording  # no live model call happened


# ─── Recorded real captures, run through the real post-processing ───────────
# Skips until you capture (tests/recordings/capture_llm_fixtures.py).

_RECORDINGS = available_recordings()


@pytest.mark.skipif(
    not _RECORDINGS,
    reason="no LLM recordings yet — run tests/recordings/capture_llm_fixtures.py "
    "with real API keys to capture, then these activate",
)
@pytest.mark.parametrize("name", _RECORDINGS)
def test_recorded_script__sanitizes_to_valid_layouts(name):
    recording = load_recording(name)
    scenes = recording.get("scenes", [])
    assert scenes, f"recording {name!r} has no scenes"
    # Every scene must carry the fields the pipeline depends on.
    for s in scenes:
        assert "narration_text" in s

    out = _sanitize_script_layouts("default", scenes, include_ending_socials=False)
    valid = get_valid_layouts("default")
    assert all(s.get("preferred_layout") in valid for s in out)
