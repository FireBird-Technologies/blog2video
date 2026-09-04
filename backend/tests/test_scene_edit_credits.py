"""
Credit rules for template scene AI-editing.

Two rules decide whether a scene edit costs anything, and both are easy to break
silently — a wrong index maps the waiver onto the wrong scene, and a missed
refund path bills the user for a failure:

  1. A FALLBACK scene (generation gave up and shipped a stub) is FREE.
  2. Any other scene costs SCENE_AI_EDIT_CREDIT_COST, refunded if the edit fails.

Pure / DB-level — no LLM, no threads. The fallback predicate is exercised
directly because it is the piece the charge decision hangs on.
"""
import json

import pytest

from app.models.custom_template import CustomTemplate
from app.models.user import User
from app.routers.custom_templates import (
    SCENE_AI_EDIT_CREDIT_COST,
    _scene_is_fallback,
    _scene_warning_index,
)
from app.services.access import can_use_ai_edit, consume_ai_edit, refund_ai_edit

pytestmark = pytest.mark.depth


def _tpl(num_content: int, warnings: list[str] | None) -> CustomTemplate:
    t = CustomTemplate()
    t.content_codes = json.dumps(["code"] * num_content)
    t.generation_warnings = json.dumps(warnings) if warnings is not None else None
    return t


def _stub_warning(idx: int, label: str = "Scene") -> str:
    return (
        f"Scene {idx} ({label}) could not be generated after 3 attempts and uses "
        f"a simplified fallback design. Last error: boom"
    )


# ─── The scene_key -> warning index convention ──────────────────────────────
# Warnings are authored by position in the GENERATED BATCH: intro is 0, content
# scenes are 1..N, the outro is last. Getting this wrong waives the charge on
# the wrong scene, which is why it is asserted rather than assumed.

def test_warning_index__intro_content_outro():
    t = _tpl(3, [])
    assert _scene_warning_index(t, "intro") == 0
    assert _scene_warning_index(t, "content_0") == 1
    assert _scene_warning_index(t, "content_2") == 3
    # Outro sits after every content scene, so its index depends on the count.
    assert _scene_warning_index(t, "outro") == 4


def test_warning_index__outro_tracks_content_count():
    assert _scene_warning_index(_tpl(0, []), "outro") == 1
    assert _scene_warning_index(_tpl(7, []), "outro") == 8


def test_warning_index__unparseable_key_is_none():
    t = _tpl(2, [])
    assert _scene_warning_index(t, "bogus") is None
    assert _scene_warning_index(t, "") is None


# ─── Rule 1: a fallback scene is free ───────────────────────────────────────

def test_fallback__only_the_warned_scene_is_free():
    # 3 content scenes; only content_1 (index 2) shipped a stub.
    t = _tpl(3, [_stub_warning(2, "Delivery Timeline")])
    assert _scene_is_fallback(t, "content_1") is True
    # Every other scene generated fine and still costs a credit.
    for key in ("intro", "content_0", "content_2", "outro"):
        assert _scene_is_fallback(t, key) is False, key


def test_fallback__outro_stub_detected():
    t = _tpl(3, [_stub_warning(4, "Outro")])
    assert _scene_is_fallback(t, "outro") is True
    assert _scene_is_fallback(t, "content_2") is False


def test_fallback__absent_or_malformed_warnings_charge():
    """Fail SAFE: if we cannot prove a scene is a stub, the edit is billable.

    The opposite default would hand out free edits on any parse slip.
    """
    assert _scene_is_fallback(_tpl(2, None), "intro") is False
    assert _scene_is_fallback(_tpl(2, []), "intro") is False

    broken = _tpl(2, [])
    broken.generation_warnings = "{not json"
    assert _scene_is_fallback(broken, "intro") is False


def test_fallback__unrelated_warning_does_not_waive():
    """A warning that names a DIFFERENT scene must not make this one free."""
    t = _tpl(3, [_stub_warning(1), "some unattributed warning"])
    assert _scene_is_fallback(t, "content_1") is False
    assert _scene_is_fallback(t, "content_0") is True


# ─── Rule 2: charge, and refund on failure ──────────────────────────────────

def _user(purchased: int) -> User:
    u = User()
    u.ai_edit_credits = purchased
    u.ai_edits_used_this_period = 0
    return u


def test_charge__consume_then_refund_restores_balance():
    """A failed edit must leave the user exactly where they started."""
    u = _user(5)
    before = u.ai_edit_credits_available
    consume_ai_edit(u, None, cost=SCENE_AI_EDIT_CREDIT_COST)
    assert u.ai_edit_credits_available == before - SCENE_AI_EDIT_CREDIT_COST
    refund_ai_edit(u, None, cost=SCENE_AI_EDIT_CREDIT_COST)
    assert u.ai_edit_credits_available == before


def test_charge__gate_blocks_at_zero():
    assert can_use_ai_edit(_user(0), None, cost=SCENE_AI_EDIT_CREDIT_COST) is False
    assert can_use_ai_edit(_user(1), None, cost=SCENE_AI_EDIT_CREDIT_COST) is True


def test_charge__credit_helpers_accept_no_project():
    """A custom template has no Project, so the helpers must take None.

    They ignore the argument, but the signature has to allow it — this is the
    only caller in the codebase that passes None.
    """
    u = _user(3)
    assert can_use_ai_edit(u, None, cost=1) is True
    consume_ai_edit(u, None, cost=1)
    refund_ai_edit(u, None, cost=1)
    assert u.ai_edit_credits_available == 3
