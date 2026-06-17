"""
Depth tier — Stripe webhook handler behaviour (all handlers, in one place).

Tier A proved the webhook routes events to the right handler. This asserts the
handlers actually do the right thing to the user's credits / plan / subscription
status — including the duplicate-delivery (idempotency) and dispute paths, which
surfaced real bugs (see README §8.2, §8.3). Handlers are called directly (no HTTP
/ signature needed); the DB is the test DB; Stripe SDK calls are mocked.
"""
import pytest

from app.models.subscription import Subscription, SubscriptionPlan, SubscriptionStatus
from app.models.user import PlanTier, User
from app.routers import billing as billing_router
from app.routers.billing import (
    _handle_checkout_completed,
    _handle_dispute_created,
    _handle_invoice_paid,
    _handle_invoice_payment_failed,
    _handle_payment_action_required,
    _handle_subscription_deleted,
    _handle_subscription_updated,
)

pytestmark = pytest.mark.depth


# ═══ checkout.session.completed ═════════════════════════════════════════════

def _credit_session(user, qty, session_id="cs_test_credits_1"):
    return {
        "id": session_id,
        "customer": user.stripe_customer_id or "cus_test",
        "amount_total": 300 * qty,
        "metadata": {"type": "per_video", "user_id": str(user.id), "qty": str(qty)},
    }


def test_checkout_completed__grants_per_video_credits(db_session, free_user):
    assert free_user.video_limit_bonus == 0
    _handle_checkout_completed(_credit_session(free_user, qty=3), db_session)
    db_session.refresh(free_user)
    assert free_user.video_limit_bonus == 3
    rows = db_session.query(Subscription).filter_by(
        user_id=free_user.id, status=SubscriptionStatus.COMPLETED,
    ).all()
    assert len(rows) == 1
    assert rows[0].quantity == 3


@pytest.mark.xfail(
    strict=True,
    reason="KNOWN BUG: _handle_checkout_completed is not idempotent — a duplicate "
    "checkout.session.completed (same session id) grants credits twice. Add a guard "
    "on stripe_checkout_session_id (or the Stripe event id) before granting.",
)
def test_checkout_completed__duplicate_delivery__grants_once(db_session, free_user):
    session = _credit_session(free_user, qty=2, session_id="cs_dup_1")
    _handle_checkout_completed(session, db_session)
    _handle_checkout_completed(session, db_session)  # Stripe re-delivers the SAME event
    db_session.refresh(free_user)
    assert free_user.video_limit_bonus == 2  # not 4


def test_checkout_completed__pro_subscription__upgrades_plan(db_session, free_user):
    free_user.stripe_customer_id = "cus_pro_1"
    db_session.commit()
    session = {
        "id": "cs_sub_1", "customer": "cus_pro_1", "subscription": "sub_123",
        "metadata": {"type": "pro_subscription", "billing_cycle": "monthly"},
    }
    _handle_checkout_completed(session, db_session)
    db_session.refresh(free_user)
    assert free_user.plan == PlanTier.PRO
    assert free_user.stripe_subscription_id == "sub_123"


# ═══ subscription lifecycle ═════════════════════════════════════════════════

def _user_with_sub(db, *, slug="pro_monthly", plan=PlanTier.PRO, status=SubscriptionStatus.ACTIVE,
                   customer="cus_1", sub_id="sub_1", used=0):
    user = User(
        email="sub@test.local", name="Sub", google_id="g-sub", plan=plan,
        stripe_customer_id=customer, stripe_subscription_id=sub_id,
        videos_used_this_period=used,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    plan_row = db.query(SubscriptionPlan).filter_by(slug=slug).first()
    sub = Subscription(user_id=user.id, plan_id=plan_row.id, status=status,
                       stripe_subscription_id=sub_id)
    db.add(sub)
    db.commit()
    return user, sub


def test_subscription_deleted__downgrades_to_free_and_cancels(db_session):
    user, sub = _user_with_sub(db_session)
    _handle_subscription_deleted({"customer": "cus_1", "id": "sub_1"}, db_session)
    db_session.refresh(user)
    db_session.refresh(sub)
    assert user.plan == PlanTier.FREE
    assert user.stripe_subscription_id is None
    assert sub.status == SubscriptionStatus.CANCELED
    assert sub.canceled_at is not None


def test_subscription_updated__active_pro__sets_pro_active(db_session):
    user, sub = _user_with_sub(db_session, status=SubscriptionStatus.PAST_DUE, plan=PlanTier.FREE)
    _handle_subscription_updated({"customer": "cus_1", "id": "sub_1", "status": "active"}, db_session)
    db_session.refresh(user)
    db_session.refresh(sub)
    assert user.plan == PlanTier.PRO
    assert sub.status == SubscriptionStatus.ACTIVE


def test_subscription_updated__canceled__downgrades_free(db_session):
    user, sub = _user_with_sub(db_session)
    _handle_subscription_updated({"customer": "cus_1", "id": "sub_1", "status": "canceled"}, db_session)
    db_session.refresh(user)
    db_session.refresh(sub)
    assert user.plan == PlanTier.FREE
    assert sub.status == SubscriptionStatus.CANCELED


# ═══ invoice events ═════════════════════════════════════════════════════════

def test_invoice_paid__resets_usage_and_referral(db_session):
    user, sub = _user_with_sub(db_session, used=7)
    user.referral_video_bonus = 4
    db_session.commit()
    _handle_invoice_paid({"customer": "cus_1", "subscription": "sub_1"}, db_session)
    db_session.refresh(user)
    assert user.videos_used_this_period == 0
    assert user.referral_video_bonus == 0
    assert user.period_start is not None


def test_invoice_payment_failed__marks_past_due(db_session):
    user, sub = _user_with_sub(db_session)
    _handle_invoice_payment_failed({"customer": "cus_1", "subscription": "sub_1"}, db_session)
    db_session.refresh(sub)
    assert sub.status == SubscriptionStatus.PAST_DUE


def test_payment_action_required__marks_requires_action(db_session):
    user, sub = _user_with_sub(db_session)
    _handle_payment_action_required(
        {"customer": "cus_1", "subscription": "sub_1", "hosted_invoice_url": "https://x"}, db_session
    )
    db_session.refresh(sub)
    assert sub.status == SubscriptionStatus.REQUIRES_ACTION


# ═══ dispute (chargeback) — SHOULD downgrade (known bug) ════════════════════

@pytest.mark.xfail(
    strict=True,
    reason="KNOWN BUG: _handle_dispute_created looks up the free plan by name='free' "
    "but the seeded name is 'Free' (returns None), so the downgrade block never runs "
    "— a chargeback does NOT downgrade the user. (It also assigns to User.video_limit, "
    "a read-only property.)",
)
def test_dispute_created__downgrades_user_to_free(db_session, monkeypatch):
    user, sub = _user_with_sub(db_session)
    monkeypatch.setattr(
        billing_router.stripe.Charge, "retrieve",
        lambda *a, **k: {"customer": "cus_1"}, raising=True,
    )
    _handle_dispute_created({"charge": "ch_1", "reason": "fraudulent"}, db_session)
    db_session.refresh(user)
    assert user.plan == PlanTier.FREE
