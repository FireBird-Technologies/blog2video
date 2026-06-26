"""
Post-checkout win-back coupon (_send_winback_coupon).

The win-back is now driven by Stripe's official abandoned-checkout signal:
``checkout.session.expired`` → ``_handle_checkout_expired`` → ``_send_winback_coupon``
(the old ~10-min daemon Timer / module-level ``SessionLocal`` design is gone).
``_send_winback_coupon`` applies the eligibility + dedup rules and picks the email:
  - abandoned (bought nothing)       → Email 1 (send_abandoned_checkout_coupon_email)
  - bought a single per-video credit → Email 2 (send_per_video_upsell_coupon_email)

Handlers are called directly; the DB is the test DB and email_service is patched.
"""
from datetime import datetime, timedelta

import pytest

from app.models.user import PlanTier
from app.routers import billing as billing_router

pytestmark = pytest.mark.depth


def _run_winback(db_session, monkeypatch, user, *, abandoned=True, recovery_url="https://stripe/recover"):
    """Call _send_winback_coupon against the test session, capturing which email fired."""
    sent: dict[str, list] = {"abandoned": [], "per_video": []}
    monkeypatch.setattr(
        billing_router.email_service, "send_abandoned_checkout_coupon_email",
        lambda **kw: sent["abandoned"].append(kw),
    )
    monkeypatch.setattr(
        billing_router.email_service, "send_per_video_upsell_coupon_email",
        lambda **kw: sent["per_video"].append(kw),
    )
    outcome = billing_router._send_winback_coupon(
        db_session, user, abandoned=abandoned, recovery_url=recovery_url
    )
    return sent, outcome


def test_winback__abandoned_free_user__sends_email_1(db_session, monkeypatch, free_user):
    sent, _ = _run_winback(db_session, monkeypatch, free_user, abandoned=True)
    assert len(sent["abandoned"]) == 1
    assert sent["abandoned"][0]["coupon_code"] == "SUB25"
    assert sent["per_video"] == []


def test_winback__per_video_buyer__sends_email_2(db_session, monkeypatch, free_user):
    sent, _ = _run_winback(db_session, monkeypatch, free_user, abandoned=False)
    assert len(sent["per_video"]) == 1
    assert sent["abandoned"] == []


def test_winback__paid_subscriber__no_email(db_session, monkeypatch, paid_user):
    assert paid_user.plan == PlanTier.PRO
    sent, _ = _run_winback(db_session, monkeypatch, paid_user, abandoned=True)
    assert sent["abandoned"] == [] and sent["per_video"] == []


def test_winback__unsubscribed_user__no_email(db_session, monkeypatch, free_user):
    free_user.email_unsubscribed = True
    db_session.commit()
    sent, _ = _run_winback(db_session, monkeypatch, free_user, abandoned=True)
    assert sent["abandoned"] == [] and sent["per_video"] == []


def test_winback__throttled_within_24h__no_email(db_session, monkeypatch, free_user):
    # A win-back sent in the last 24h suppresses the next one (Stripe redelivers
    # webhooks and a user can expire several checkout sessions in a day).
    free_user.last_coupon_email_at = datetime.utcnow() - timedelta(hours=1)
    db_session.commit()
    sent, _ = _run_winback(db_session, monkeypatch, free_user, abandoned=True)
    assert sent["abandoned"] == [] and sent["per_video"] == []


def test_handle_checkout_expired__routes_to_winback(db_session, monkeypatch, free_user):
    # The expired-session handler resolves the user from metadata["user_id"] and
    # forwards the Stripe recovery URL to the abandoned-checkout win-back.
    sent: dict = {}
    monkeypatch.setattr(
        billing_router, "_send_winback_coupon",
        lambda db, user, *, abandoned, recovery_url=None: sent.update(
            user_id=user.id, abandoned=abandoned, recovery_url=recovery_url
        ) or "ok",
    )
    session = {
        "id": "cs_exp_1",
        "metadata": {"user_id": str(free_user.id)},
        "after_expiration": {"recovery": {"url": "https://stripe/recover"}},
    }
    billing_router._handle_checkout_expired(session, db_session)
    assert sent["user_id"] == free_user.id
    assert sent["abandoned"] is True
    assert sent["recovery_url"] == "https://stripe/recover"
