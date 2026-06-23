"""
Post-checkout win-back coupon emails (_send_winback_coupon + webhook handlers).

The follow-up is driven entirely by Stripe webhooks — there is no internal timer:

  - checkout.session.expired  → _handle_checkout_expired
        user reached checkout but bought nothing
        → Email 1 (send_abandoned_checkout_coupon_email), carries SUB25 + recovery URL
  - checkout.session.completed (type=per_video) → _handle_checkout_completed
        user bought a single per-video credit
        → Email 2 (send_per_video_upsell_coupon_email), SUB25 upsell nudge

Eligibility/dedup (shared via _send_winback_coupon):
  - skip if no user / no email / email_unsubscribed
  - skip if already PRO or STANDARD (no win-back to existing subscribers)
  - throttle to at most one coupon email per rolling 24h (last_coupon_email_at)

The handlers take the test `db` directly, so we drive them straight (no SessionLocal
patch). Only email_service is patched, to capture which email fired.
"""
from datetime import datetime, timedelta

import pytest

from app.models.subscription import SubscriptionPlan
from app.models.user import PlanTier
from app.routers import billing as billing_router

pytestmark = pytest.mark.depth


@pytest.fixture()
def captured_emails(monkeypatch):
    """Patch the two coupon senders; return the dict capturing their kwargs."""
    sent: dict[str, list] = {"abandoned": [], "per_video": []}
    monkeypatch.setattr(
        billing_router.email_service, "send_abandoned_checkout_coupon_email",
        lambda **kw: sent["abandoned"].append(kw),
    )
    monkeypatch.setattr(
        billing_router.email_service, "send_per_video_upsell_coupon_email",
        lambda **kw: sent["per_video"].append(kw),
    )
    return sent


def _expired_session(user_id, recovery_url="https://stripe.test/resume"):
    """A minimal checkout.session.expired payload as the handler reads it."""
    return {
        "id": "cs_test_expired",
        "metadata": {"user_id": str(user_id)} if user_id is not None else {},
        "after_expiration": {"recovery": {"url": recovery_url}},
    }


def _per_video_completed_session(user_id, project_id=None):
    """A minimal per-video checkout.session.completed payload."""
    return {
        "id": "cs_test_completed",
        "customer": "cus_test",
        "amount_total": 900,
        "metadata": {
            "user_id": str(user_id),
            "type": "per_video",
            **({"project_id": str(project_id)} if project_id else {"qty": "1"}),
        },
    }


# ─── Email 1: abandoned checkout (session expired) ──────────────────────────

def test_expired__free_user__sends_abandoned_email(db_session, captured_emails, free_user):
    billing_router._handle_checkout_expired(_expired_session(free_user.id), db_session)
    assert len(captured_emails["abandoned"]) == 1
    kw = captured_emails["abandoned"][0]
    assert kw["coupon_code"] == "SUB25"
    assert kw["recovery_url"] == "https://stripe.test/resume"
    assert captured_emails["per_video"] == []
    # Throttle stamp is written so a redelivered webhook won't re-email.
    db_session.refresh(free_user)
    assert free_user.last_coupon_email_at is not None


def test_expired__paid_subscriber__no_email(db_session, captured_emails, paid_user):
    assert paid_user.plan == PlanTier.PRO
    billing_router._handle_checkout_expired(_expired_session(paid_user.id), db_session)
    assert captured_emails["abandoned"] == [] and captured_emails["per_video"] == []


def test_expired__unsubscribed_user__no_email(db_session, captured_emails, free_user):
    free_user.email_unsubscribed = True
    db_session.commit()
    billing_router._handle_checkout_expired(_expired_session(free_user.id), db_session)
    assert captured_emails["abandoned"] == []


def test_expired__no_user_id_metadata__no_email(db_session, captured_emails):
    billing_router._handle_checkout_expired(_expired_session(None), db_session)
    assert captured_emails["abandoned"] == []


def test_expired__within_24h_of_last_email__throttled(db_session, captured_emails, free_user):
    free_user.last_coupon_email_at = datetime.utcnow() - timedelta(hours=1)
    db_session.commit()
    billing_router._handle_checkout_expired(_expired_session(free_user.id), db_session)
    assert captured_emails["abandoned"] == []


def test_expired__more_than_24h_since_last_email__sends_again(db_session, captured_emails, free_user):
    free_user.last_coupon_email_at = datetime.utcnow() - timedelta(hours=25)
    db_session.commit()
    billing_router._handle_checkout_expired(_expired_session(free_user.id), db_session)
    assert len(captured_emails["abandoned"]) == 1


# ─── Email 2: per-video upsell (purchase completed) ─────────────────────────

def test_completed_per_video__free_buyer__sends_upsell_email(db_session, captured_emails, free_user):
    billing_router._handle_checkout_completed(
        _per_video_completed_session(free_user.id), db_session
    )
    assert len(captured_emails["per_video"]) == 1
    assert captured_emails["per_video"][0]["coupon_code"] == "SUB25"
    assert captured_emails["abandoned"] == []


def test_completed_per_video__paid_buyer__no_upsell_email(db_session, captured_emails, paid_user):
    # A PRO user buying a one-off video is not a win-back target.
    billing_router._handle_checkout_completed(
        _per_video_completed_session(paid_user.id), db_session
    )
    assert captured_emails["per_video"] == []


# ─── Sanity: the per_video plan the completed-handler needs is seeded ───────

def test_per_video_plan_is_seeded(db_session):
    assert db_session.query(SubscriptionPlan).filter_by(slug="per_video").first() is not None
