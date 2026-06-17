"""
Group 5 — Gating: paywall, quota, and rate-limit enforcement.

These routes have just enough logic that the GATE itself is the thing under
test: an ineligible caller must be blocked, an eligible one must pass.

  POST /api/voice/preview        FREE -> 403; PRO -> 200; rapid 2nd call -> 429
  POST /api/projects (quota)     at video limit -> 403
  GET  /api/crafted-templates/{id} (entitlement) disabled -> 404
"""
import pytest

from app.routers import voice as voice_router

pytestmark = pytest.mark.gates


@pytest.fixture(autouse=True)
def _reset_voice_rate_limit():
    """The voice preview rate limiter keeps per-user state in module-level dicts.
    Because rolled-back test users reuse the same ids, that state would leak
    across tests (a later first-call seeing a previous cooldown). Reset it around
    every test so the rate-limit assertions are deterministic.
    """
    voice_router._last_call.clear()
    voice_router._daily_counts.clear()
    yield
    voice_router._last_call.clear()
    voice_router._daily_counts.clear()


# ─── POST /api/voice/preview — paywall + rate limit ─────────────────────────

def test_voice_preview__free_user__blocked_403(client, free_user, auth):
    resp = client.post(
        "/api/voice/preview", headers=auth(free_user),
        json={"voice_gender": "female", "voice_accent": "american"},
    )
    assert resp.status_code == 403


def test_voice_preview__paid_user__200(client, paid_user, auth, monkeypatch):
    # Synthesis hits ElevenLabs — mock it to fixed bytes so the gate, not the
    # network, is what we exercise.
    monkeypatch.setattr(
        voice_router, "synthesize_voice_preview",
        lambda **kw: b"ID3-fake-mp3-bytes", raising=True,
    )
    resp = client.post(
        "/api/voice/preview", headers=auth(paid_user),
        json={"voice_gender": "female", "voice_accent": "american"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("audio/mpeg")


def test_voice_preview__rapid_second_call__rate_limited_429(client, paid_user, auth, monkeypatch):
    monkeypatch.setattr(
        voice_router, "synthesize_voice_preview",
        lambda **kw: b"bytes", raising=True,
    )
    body = {"voice_gender": "female", "voice_accent": "american"}
    first = client.post("/api/voice/preview", headers=auth(paid_user), json=body)
    second = client.post("/api/voice/preview", headers=auth(paid_user), json=body)
    assert first.status_code == 200
    assert second.status_code == 429  # cooldown window


def test_voice_preview__gender_none__returns_400(client, paid_user, auth):
    resp = client.post(
        "/api/voice/preview", headers=auth(paid_user),
        json={"voice_gender": "none"},
    )
    assert resp.status_code == 400


def test_voice_preview__without_token__returns_401(client):
    resp = client.post("/api/voice/preview", json={"voice_gender": "female"})
    assert resp.status_code == 401


# ─── POST /api/projects — quota gate ────────────────────────────────────────

def test_create_project__at_video_limit__returns_403(client, db_session, free_user, auth):
    # Max out the free quota (video_limit == 3 for FREE).
    free_user.videos_used_this_period = free_user.video_limit
    db_session.commit()

    resp = client.post(
        "/api/projects", headers=auth(free_user),
        json={"blog_url": "https://example.com/post"},
    )
    assert resp.status_code == 403


# ─── GET /api/crafted-templates/{id} — entitlement / disabled gate ──────────

def test_crafted_template_detail__disabled__returns_404(client, free_user, auth):
    # CRAFTED_TEMPLATES_ENABLED is False in tests -> the feature is gated off.
    resp = client.get("/api/crafted-templates/some-id", headers=auth(free_user))
    assert resp.status_code == 404
