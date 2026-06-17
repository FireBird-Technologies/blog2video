"""
Depth tier — credit / billing money-math (Part A1–A4).

These assert what the billing code *computes*, not just that endpoints respond.
A bug here silently over-charges users or hands out free videos, so this is the
highest-value depth coverage. All pure / DB-level — no Stripe, no LLM, no render.
"""
from datetime import datetime, timedelta

import pytest

from app.models.subscription import (
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
)
from app.models.user import PlanTier, User
from app.routers.billing import (
    _count_active_per_video_credits,
    _recalculate_video_limit_bonus,
)
from app.routers.projects import _refund_video_credit

pytestmark = pytest.mark.depth


def _per_video_plan_id(db) -> int:
    return db.query(SubscriptionPlan).filter_by(slug="per_video").first().id


def _add_credits(db, user, qty, *, expired=False, status=SubscriptionStatus.COMPLETED):
    """Add a per-video credit purchase row (a slider pack of `qty` credits)."""
    end = (
        datetime.utcnow() - timedelta(days=1)
        if expired
        else datetime.utcnow() + timedelta(days=30)
    )
    db.add(Subscription(
        user_id=user.id, plan_id=_per_video_plan_id(db),
        status=status, quantity=qty, current_period_end=end,
    ))
    db.commit()


# ─── A1. The absorption engine — _recalculate_video_limit_bonus ─────────────
# Reproduces the worked Examples A/B/C from the function's docstring, then adds
# edge cases. Absorption order: base(3) -> free_grants -> referral -> paid.

def _run_recalc(db, user, *, old_bonus, referral, used, paid):
    if paid:
        _add_credits(db, user, paid)
    user.video_limit_bonus = old_bonus
    user.referral_video_bonus = referral
    user.videos_used_this_period = used
    db.commit()
    _recalculate_video_limit_bonus(user, db)
    db.commit()
    db.refresh(user)


def test_recalc_example_a__free_then_referral_absorption(db_session, paid_user):
    # old_bonus=4 (free_grants=2 + paid=2), referral=6, used=8
    _run_recalc(db_session, paid_user, old_bonus=4, referral=6, used=8, paid=2)
    assert paid_user.video_limit_bonus == 2       # paid credits carry over
    assert paid_user.referral_video_bonus == 6    # referral persists
    assert paid_user.videos_used_this_period == 3  # 3 referral consumed, 0 paid


def test_recalc_example_b__referral_fully_consumed(db_session, paid_user):
    _run_recalc(db_session, paid_user, old_bonus=4, referral=6, used=11, paid=2)
    assert paid_user.videos_used_this_period == 6
    assert paid_user.referral_video_bonus == 6


def test_recalc_example_c__paid_consumed_no_referral(db_session, paid_user):
    _run_recalc(db_session, paid_user, old_bonus=4, referral=0, used=6, paid=2)
    assert paid_user.videos_used_this_period == 1
    assert paid_user.referral_video_bonus == 0
    assert paid_user.video_limit_bonus == 2


def test_recalc__zero_usage__nothing_consumed(db_session, paid_user):
    _run_recalc(db_session, paid_user, old_bonus=2, referral=3, used=0, paid=2)
    assert paid_user.videos_used_this_period == 0
    assert paid_user.referral_video_bonus == 3
    assert paid_user.video_limit_bonus == 2


def test_recalc__usage_beyond_free_carries_forward_in_full(db_session, paid_user):
    # Only base(3)+free(0) usage is forgiven on upgrade; everything above carries
    # forward. paid_consumed is NOT capped at owned credits — it reflects real
    # videos the user already consumed.
    _run_recalc(db_session, paid_user, old_bonus=2, referral=3, used=50, paid=2)
    # free_grants=0; absorbed=min(50,3)=3; remaining=47; ref_consumed=3; paid_consumed=44
    assert paid_user.videos_used_this_period == 47  # 50 used minus 3 base absorbed


# ─── A2. Credit counting — _count_active_per_video_credits ──────────────────

def test_count_credits__sums_quantity_across_rows(db_session, paid_user):
    _add_credits(db_session, paid_user, 2)
    _add_credits(db_session, paid_user, 3)
    assert _count_active_per_video_credits(paid_user.id, db_session) == 5


def test_count_credits__excludes_expired(db_session, paid_user):
    _add_credits(db_session, paid_user, 4, expired=True)
    assert _count_active_per_video_credits(paid_user.id, db_session) == 0


def test_count_credits__null_expiry_counts(db_session, paid_user):
    db_session.add(Subscription(
        user_id=paid_user.id, plan_id=_per_video_plan_id(db_session),
        status=SubscriptionStatus.COMPLETED, quantity=2, current_period_end=None,
    ))
    db_session.commit()
    assert _count_active_per_video_credits(paid_user.id, db_session) == 2


def test_count_credits__excludes_non_completed(db_session, paid_user):
    _add_credits(db_session, paid_user, 5, status=SubscriptionStatus.ACTIVE)
    assert _count_active_per_video_credits(paid_user.id, db_session) == 0


# ─── A3. Limit / gate properties — User ─────────────────────────────────────

@pytest.mark.parametrize("plan,base", [
    (PlanTier.FREE, 3), (PlanTier.STANDARD, 30), (PlanTier.PRO, 100),
])
def test_video_limit__base_per_tier(db_session, plan, base):
    user = User(email=f"{plan.value}@t.local", name="U", google_id=f"g-{plan.value}",
                plan=plan, video_limit_bonus=5, referral_video_bonus=2)
    db_session.add(user)
    db_session.commit()
    assert user.video_limit == base + 5 + 2


def test_can_create_video__boundary(db_session, free_user):
    free_user.videos_used_this_period = free_user.video_limit - 1
    assert free_user.can_create_video is True
    free_user.videos_used_this_period = free_user.video_limit
    assert free_user.can_create_video is False


def test_sync_video_limit_bonus__drops_expired_credits(db_session, paid_user):
    # 2 active + 3 expired purchased; bonus reflects the original 5.
    _add_credits(db_session, paid_user, 2)
    _add_credits(db_session, paid_user, 3, expired=True)
    paid_user.video_limit_bonus = 5
    db_session.commit()

    paid_user.sync_video_limit_bonus(db_session)
    db_session.commit()
    db_session.refresh(paid_user)
    assert paid_user.video_limit_bonus == 2  # 3 expired dropped


# ─── A4. Deduct / refund symmetry — the money-safety invariant ──────────────

def test_refund__decrements_exactly_one(db_session, paid_user):
    paid_user.videos_used_this_period = 2
    db_session.commit()
    _refund_video_credit(db_session, paid_user.id)
    db_session.commit()
    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == 1


def test_refund__never_goes_below_zero(db_session, paid_user):
    paid_user.videos_used_this_period = 0
    db_session.commit()
    _refund_video_credit(db_session, paid_user.id)
    db_session.commit()
    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == 0


def test_deduct_then_refund__nets_to_zero(db_session, paid_user):
    # Symmetry: one deduction (as a create does) + one refund (as a failure does)
    # returns to the starting count.
    start = paid_user.videos_used_this_period
    paid_user.videos_used_this_period += 1          # deduct (create / re-render)
    db_session.commit()
    _refund_video_credit(db_session, paid_user.id)  # refund (failed generation)
    db_session.commit()
    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == start
