"""
Group 4 — Authenticated create/mutation endpoints.

Each test sends a valid request and asserts the success status + that the row
was actually persisted, plus a 401 without a token. External boundaries are
mocked (Google token verification, email). Deep side-effects (exact credit
accounting, referral math) are NOT asserted here — that's the depth tier; here
we only prove the create path works and writes.

Routes verified by reading each handler:
  POST /api/auth/google           (mock google id_token.verify_oauth2_token)
  POST /api/projects              (creates a Project, increments usage)
  POST /api/voices/saved          (creates a SavedVoice)
  POST /api/affiliate/survey      (creates a SurveyResponse; 2nd submit -> 400)
  POST /api/affiliate/invite      (records ReferralInvite rows; email mocked)
"""
import pytest

from app.models.project import Project
from app.models.saved_voice import SavedVoice
from app.models.survey import SurveyResponse
from app.models.user import User

pytestmark = pytest.mark.smoke


# ─── POST /api/auth/google (login / signup — the front door) ─────────────────

def _fake_idinfo(sub="google-new-123", email="newuser@test.local", name="New User"):
    return {"sub": sub, "email": email, "name": name, "picture": None}


def test_post_auth_google__new_user__creates_user_and_returns_token(
    client, db_session, monkeypatch
):
    # Mock Google's token verification to accept our fake credential.
    import app.routers.auth as auth_router
    monkeypatch.setattr(
        auth_router.id_token, "verify_oauth2_token",
        lambda *a, **k: _fake_idinfo(), raising=True,
    )

    resp = client.post("/api/auth/google", json={"credential": "fake-google-jwt"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["user"]["email"] == "newuser@test.local"
    # The user was actually persisted.
    assert db_session.query(User).filter_by(email="newuser@test.local").count() == 1


def test_post_auth_google__invalid_token__returns_401(client, monkeypatch):
    import app.routers.auth as auth_router

    def _raise(*a, **k):
        raise ValueError("bad token")

    monkeypatch.setattr(auth_router.id_token, "verify_oauth2_token", _raise, raising=True)

    resp = client.post("/api/auth/google", json={"credential": "garbage"})
    assert resp.status_code == 401


def test_post_auth_google__existing_user__no_duplicate(client, db_session, monkeypatch):
    import app.routers.auth as auth_router
    monkeypatch.setattr(
        auth_router.id_token, "verify_oauth2_token",
        lambda *a, **k: _fake_idinfo(sub="dup-sub", email="dup@test.local"),
        raising=True,
    )
    first = client.post("/api/auth/google", json={"credential": "x"})
    second = client.post("/api/auth/google", json={"credential": "x"})
    assert first.status_code == 200 and second.status_code == 200
    assert db_session.query(User).filter_by(email="dup@test.local").count() == 1


# ─── POST /api/projects ──────────────────────────────────────────────────────

def test_post_projects__valid__creates_project_and_increments_usage(
    client, db_session, free_user, auth
):
    assert free_user.videos_used_this_period == 0
    resp = client.post(
        "/api/projects",
        headers=auth(free_user),
        json={"blog_url": "https://example.com/post", "template": "default"},
    )
    assert resp.status_code == 200
    project_id = resp.json()["id"]
    # Persisted and owned by the caller.
    row = db_session.query(Project).filter_by(id=project_id).first()
    assert row is not None and row.user_id == free_user.id
    # Usage counter advanced by exactly one.
    db_session.refresh(free_user)
    assert free_user.videos_used_this_period == 1


def test_post_projects__missing_blog_url__returns_400(client, free_user, auth):
    resp = client.post("/api/projects", headers=auth(free_user), json={})
    assert resp.status_code == 400


def test_post_projects__without_token__returns_401(client):
    resp = client.post("/api/projects", json={"blog_url": "https://x.test"})
    assert resp.status_code == 401


# ─── POST /api/voices/saved ──────────────────────────────────────────────────

def test_post_saved_voice__valid__creates_row(client, db_session, free_user, auth):
    resp = client.post(
        "/api/voices/saved",
        headers=auth(free_user),
        json={"voice_id": "voice-abc", "name": "My Voice", "source": "prebuilt"},
    )
    assert resp.status_code == 200
    assert db_session.query(SavedVoice).filter_by(
        user_id=free_user.id, voice_id="voice-abc"
    ).count() == 1


def test_post_saved_voice__without_token__returns_401(client):
    resp = client.post("/api/voices/saved", json={"voice_id": "v", "name": "n"})
    assert resp.status_code == 401


# ─── POST /api/affiliate/survey ──────────────────────────────────────────────

def test_post_survey__valid__creates_response(client, db_session, free_user, auth):
    resp = client.post(
        "/api/affiliate/survey",
        headers=auth(free_user),
        json={"rating": "5", "use_case": "marketing"},
    )
    assert resp.status_code == 200
    assert resp.json()["submitted"] is True
    assert db_session.query(SurveyResponse).filter_by(user_id=free_user.id).count() == 1


def test_post_survey__second_submit__returns_400(client, free_user, auth):
    payload = {"rating": "5"}
    first = client.post("/api/affiliate/survey", headers=auth(free_user), json=payload)
    second = client.post("/api/affiliate/survey", headers=auth(free_user), json=payload)
    assert first.status_code == 200
    assert second.status_code == 400


# ─── POST /api/affiliate/invite ──────────────────────────────────────────────

def test_post_invite__valid__records_sent(client, free_user, auth):
    # Email send is stubbed by the kill-switch, so all invites count as "sent".
    resp = client.post(
        "/api/affiliate/invite",
        headers=auth(free_user),
        json={"emails": ["a@friend.test", "b@friend.test"]},
    )
    assert resp.status_code == 200
    assert resp.json()["sent"] == 2


def test_post_invite__empty_list__returns_400(client, free_user, auth):
    resp = client.post("/api/affiliate/invite", headers=auth(free_user), json={"emails": []})
    assert resp.status_code == 400
