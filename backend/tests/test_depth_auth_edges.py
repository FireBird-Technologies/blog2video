"""
Depth tier — auth edge cases: referral bonus grant + account reactivation.
"""
import pytest

import app.routers.auth as auth_router
from app.models.referral import (
    REFERRAL_BONUS_VIDEOS,
    Referral,
    ReferralSignup,
)
from app.models.user import PlanTier, User
from app.routers.auth import _apply_referral_bonus

pytestmark = pytest.mark.depth


def _referrer_with_code(db, code="REF123"):
    referrer = User(email="ref@test.local", name="Referrer", google_id="g-ref", plan=PlanTier.FREE)
    db.add(referrer)
    db.commit()
    db.refresh(referrer)
    db.add(Referral(referrer_id=referrer.id, code=code, is_active=True))
    db.commit()
    return referrer


# ─── _apply_referral_bonus ──────────────────────────────────────────────────

def test_referral_bonus__grants_both_parties_and_records_signup(db_session, free_user):
    referrer = _referrer_with_code(db_session)
    _apply_referral_bonus("REF123", free_user, db_session)

    db_session.refresh(free_user)
    db_session.refresh(referrer)
    assert free_user.referral_video_bonus == REFERRAL_BONUS_VIDEOS
    assert referrer.referral_video_bonus == REFERRAL_BONUS_VIDEOS
    assert referrer.referrals_given == 1
    assert db_session.query(ReferralSignup).filter_by(new_user_id=free_user.id).count() == 1


def test_referral_bonus__double_grant_guarded(db_session, free_user):
    _referrer_with_code(db_session)
    _apply_referral_bonus("REF123", free_user, db_session)
    _apply_referral_bonus("REF123", free_user, db_session)  # retry / duplicate
    db_session.refresh(free_user)
    assert free_user.referral_video_bonus == REFERRAL_BONUS_VIDEOS  # not doubled
    assert db_session.query(ReferralSignup).filter_by(new_user_id=free_user.id).count() == 1


def test_referral_bonus__self_referral_ignored(db_session):
    referrer = _referrer_with_code(db_session, code="SELF1")
    _apply_referral_bonus("SELF1", referrer, db_session)  # referrer uses own code
    db_session.refresh(referrer)
    assert referrer.referral_video_bonus == 0


def test_referral_bonus__unknown_code_noop(db_session, free_user):
    _apply_referral_bonus("DOES-NOT-EXIST", free_user, db_session)
    db_session.refresh(free_user)
    assert free_user.referral_video_bonus == 0


# ─── Account reactivation via POST /api/auth/google ─────────────────────────

def _deleted_user(db):
    user = User(email="dead@test.local", name="Dead", google_id="g-dead",
                plan=PlanTier.PRO, is_active=False)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _mock_google(monkeypatch, *, sub="g-dead", email="dead@test.local"):
    monkeypatch.setattr(
        auth_router.id_token, "verify_oauth2_token",
        lambda *a, **k: {"sub": sub, "email": email, "name": "Dead", "picture": None},
        raising=True,
    )


def test_login__deleted_account_without_reactivate__returns_403(client, db_session, monkeypatch):
    _deleted_user(db_session)
    _mock_google(monkeypatch)
    resp = client.post("/api/auth/google", json={"credential": "x"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "account_deleted"


def test_login__deleted_account_with_reactivate__reactivates_as_free(client, db_session, monkeypatch):
    user = _deleted_user(db_session)
    _mock_google(monkeypatch)
    resp = client.post("/api/auth/google?reactivate=true", json={"credential": "x"})
    assert resp.status_code == 200
    db_session.refresh(user)
    assert user.is_active is True
    assert user.plan == PlanTier.FREE
