"""
PDF → Audio narration is capped at one synthesis per account, on every plan.

Unlike the other /tools allowances this one does not widen on upgrade and does
not refresh with the billing period, so the tests below pin both halves of that:
the gate itself, and the reset path that must leave the counter alone.

  POST /api/free-tools/pdf-narration   1st -> 200; 2nd -> 403 (FREE and PAID)
  User.reset_tool_usage_period()       must NOT clear pdf_narrations_used
"""
import pytest

from app.models.user import LIFETIME_TOOLS, TOOL_QUOTAS, PlanTier

pytestmark = pytest.mark.gates

_NARRATION_TEXT = "This is a document excerpt long enough to clear the minimum length validator."


@pytest.fixture()
def _fake_synth(monkeypatch):
    """Stub ElevenLabs so the quota gate, not the network, is under test."""
    import app.services.voiceover as voiceover

    monkeypatch.setattr(
        voiceover, "synthesize_voice_preview",
        lambda **kw: b"ID3-fake-mp3-bytes", raising=True,
    )


def _narrate(client, user, auth):
    return client.post(
        "/api/free-tools/pdf-narration", headers=auth(user),
        json={"text": _NARRATION_TEXT, "voice_gender": "female"},
    )


# ─── The cap ────────────────────────────────────────────────────────────────

def test_narration__free_user_first_call__200(client, free_user, auth, _fake_synth):
    resp = _narrate(client, free_user, auth)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("audio/mpeg")
    assert resp.headers["x-tool-used"] == "1"
    assert resp.headers["x-tool-limit"] == "1"


def test_narration__free_user_second_call__403(client, free_user, auth, _fake_synth):
    assert _narrate(client, free_user, auth).status_code == 200
    resp = _narrate(client, free_user, auth)
    assert resp.status_code == 403
    # The copy must not promise that upgrading lifts this cap, because it does not.
    assert "upgrade" not in resp.json()["detail"].lower()


def test_narration__paid_user_also_capped_at_one(client, paid_user, auth, _fake_synth):
    """A paid plan buys a larger allowance for every other tool, but not this one."""
    assert _narrate(client, paid_user, auth).status_code == 200
    assert _narrate(client, paid_user, auth).status_code == 403


def test_narration__failed_synthesis__does_not_consume_the_single_use(
    client, free_user, auth, monkeypatch
):
    import app.services.voiceover as voiceover

    monkeypatch.setattr(
        voiceover, "synthesize_voice_preview",
        lambda **kw: (_ for _ in ()).throw(RuntimeError("provider down")), raising=True,
    )
    assert _narrate(client, free_user, auth).status_code == 502

    # The one allowed narration must survive a provider failure.
    monkeypatch.setattr(
        voiceover, "synthesize_voice_preview",
        lambda **kw: b"ID3-fake-mp3-bytes", raising=True,
    )
    assert _narrate(client, free_user, auth).status_code == 200


def test_narration__without_token__returns_401(client):
    resp = client.post(
        "/api/free-tools/pdf-narration",
        json={"text": _NARRATION_TEXT, "voice_gender": "female"},
    )
    assert resp.status_code == 401


# ─── The reset path ─────────────────────────────────────────────────────────

def test_period_reset__does_not_refresh_narration_for_paid_user(db_session, paid_user):
    """The crux of a per-account cap: a new billing period must not grant another go."""
    paid_user.pdf_narrations_used = 1
    paid_user.video_scripts_used = 5
    db_session.commit()

    paid_user.reset_tool_usage_period()

    assert paid_user.pdf_narrations_used == 1, "narration allowance must be lifetime"
    assert paid_user.video_scripts_used == 0, "ordinary tool allowances must still refresh"


def test_period_reset__free_user_keeps_all_counters(db_session, free_user):
    free_user.pdf_narrations_used = 1
    db_session.commit()

    free_user.reset_tool_usage_period()

    assert free_user.pdf_narrations_used == 1


def test_quota_endpoint__reports_narration(client, free_user, auth):
    resp = client.get("/api/free-tools/quota", headers=auth(free_user))
    assert resp.status_code == 200
    assert resp.json()["quotas"]["pdf_narration"] == {"used": 0, "limit": 1}


# ─── The gate, exercised directly ───────────────────────────────────────────
# The HTTP tests above are the real contract, but Starlette's TestClient cannot
# start its portal on this platform, so these call the gate helpers straight to
# keep the enforcement itself covered by a test that runs everywhere.

def _check(user, db):
    from app.routers.free_tools import _check_quota

    return _check_quota(user, "pdf_narration", db)


def _spend(user, db):
    from app.routers.free_tools import _charge

    return _charge(user, "pdf_narration", db)


@pytest.mark.parametrize("fixture_name", ["free_user", "paid_user"])
def test_gate__allows_first_then_blocks_second(fixture_name, request, db_session):
    from fastapi import HTTPException

    user = request.getfixturevalue(fixture_name)

    used, limit = _check(user, db_session)
    assert (used, limit) == (0, 1)
    assert _spend(user, db_session) == 1

    with pytest.raises(HTTPException) as excinfo:
        _check(user, db_session)
    assert excinfo.value.status_code == 403
    assert "upgrade" not in str(excinfo.value.detail).lower()


def test_gate__blocks_paid_user_again_after_a_period_reset(db_session, paid_user):
    """End-to-end on the model: spend it, roll the period, still blocked."""
    from fastapi import HTTPException

    _check(paid_user, db_session)
    _spend(paid_user, db_session)

    paid_user.reset_tool_usage_period()
    db_session.commit()

    with pytest.raises(HTTPException) as excinfo:
        _check(paid_user, db_session)
    assert excinfo.value.status_code == 403


# ─── Configuration invariants ───────────────────────────────────────────────

def test_narration_quota_is_one_on_every_plan():
    _attr, free_limit, paid_limit = TOOL_QUOTAS["pdf_narration"]
    assert free_limit == paid_limit == 1


def test_narration_is_registered_as_a_lifetime_tool():
    assert "pdf_narration" in LIFETIME_TOOLS


def test_lifetime_tools_are_all_real_quota_keys():
    """Guards against a typo silently disabling the reset exemption."""
    assert LIFETIME_TOOLS <= set(TOOL_QUOTAS)


def test_tool_limit_returns_one_for_both_plans(free_user, paid_user):
    assert free_user.plan == PlanTier.FREE
    assert free_user.tool_limit("pdf_narration") == 1
    assert paid_user.tool_limit("pdf_narration") == 1
