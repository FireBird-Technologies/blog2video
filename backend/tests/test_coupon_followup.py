"""
Post-checkout win-back coupon follow-up (_send_coupon_if_not_subscribed).

~10 min after a user reaches checkout, they get a SUB25 email *unless* they
ended up on a paid subscription:
  - abandoned (bought nothing)      → Email 1 (send_abandoned_checkout_coupon_email)
  - bought a single per-video credit → Email 2 (send_per_video_upsell_coupon_email)

The follow-up runs in a one-shot daemon Timer; here we call it directly (no
delay). It opens its own SessionLocal and sends via email_service — both patched.
"""
from datetime import datetime, timedelta

import pytest

from app.models.subscription import Subscription, SubscriptionPlan, SubscriptionStatus
from app.models.user import PlanTier
from app.routers import billing as billing_router

pytestmark = pytest.mark.depth


def _run_followup(db_session, monkeypatch, user_id, scheduled_at=None):
    """Run the one-shot follow-up against the test session, capturing which email fired."""
    sent: dict[str, list] = {"abandoned": [], "per_video": []}
    monkeypatch.setattr(billing_router, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)  # don't close the fixture
    monkeypatch.setattr(
        billing_router.email_service, "send_abandoned_checkout_coupon_email",
        lambda **kw: sent["abandoned"].append(kw),
    )
    monkeypatch.setattr(
        billing_router.email_service, "send_per_video_upsell_coupon_email",
        lambda **kw: sent["per_video"].append(kw),
    )
    billing_router._send_coupon_if_not_subscribed(
        user_id, scheduled_at or datetime.utcnow() - timedelta(minutes=1)
    )
    return sent


def _add_per_video_purchase(db, user_id, created_at):
    plan = db.query(SubscriptionPlan).filter_by(slug="per_video").first()
    sub = Subscription(
        user_id=user_id, plan_id=plan.id, status=SubscriptionStatus.COMPLETED,
        quantity=1, created_at=created_at,
    )
    db.add(sub)
    db.commit()


def test_followup__abandoned_free_user__sends_email_1(db_session, monkeypatch, free_user):
    sent = _run_followup(db_session, monkeypatch, free_user.id)
    assert len(sent["abandoned"]) == 1
    assert sent["abandoned"][0]["coupon_code"] == "SUB25"
    assert sent["per_video"] == []


def test_followup__per_video_buyer__sends_email_2(db_session, monkeypatch, free_user):
    scheduled_at = datetime.utcnow() - timedelta(minutes=5)
    # Purchase landed *after* the visit started → counts as this checkout's buy.
    _add_per_video_purchase(db_session, free_user.id, created_at=datetime.utcnow())
    sent = _run_followup(db_session, monkeypatch, free_user.id, scheduled_at=scheduled_at)
    assert len(sent["per_video"]) == 1
    assert sent["abandoned"] == []


def test_followup__old_per_video_purchase__still_email_1(db_session, monkeypatch, free_user):
    # A per-video buy from before this visit must NOT switch to the upsell email.
    scheduled_at = datetime.utcnow() - timedelta(minutes=5)
    _add_per_video_purchase(
        db_session, free_user.id, created_at=datetime.utcnow() - timedelta(days=2)
    )
    sent = _run_followup(db_session, monkeypatch, free_user.id, scheduled_at=scheduled_at)
    assert len(sent["abandoned"]) == 1
    assert sent["per_video"] == []


def test_followup__paid_subscriber__no_email(db_session, monkeypatch, paid_user):
    assert paid_user.plan == PlanTier.PRO
    sent = _run_followup(db_session, monkeypatch, paid_user.id)
    assert sent["abandoned"] == [] and sent["per_video"] == []


def test_followup__unsubscribed_user__no_email(db_session, monkeypatch, free_user):
    free_user.email_unsubscribed = True
    db_session.commit()
    sent = _run_followup(db_session, monkeypatch, free_user.id)
    assert sent["abandoned"] == [] and sent["per_video"] == []
