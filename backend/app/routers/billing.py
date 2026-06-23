"""
Stripe billing router: checkout sessions, customer portal, webhooks.
Supports both Pro subscription ($60/mo) and per-video purchase ($3).
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
import stripe

from app.config import settings
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User, PlanTier, FREE_TIER_INCLUDED_VIDEOS
from app.models.project import Project
from app.models.subscription import (
    Subscription, SubscriptionStatus, SubscriptionPlan,
)
from app.observability.logging import get_logger
from app.services.per_video_pricing import (
    per_unit_cents as per_video_unit_cents,
    MIN_QUANTITY as PER_VIDEO_MIN_QTY,
    MAX_QUANTITY as PER_VIDEO_MAX_QTY,
)

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/api/billing", tags=["billing"])
logger = get_logger(__name__)
MAX_RETENTION_OFFER_SHOWS = 2


class CheckoutResponse(BaseModel):
    checkout_url: str


class PerVideoCheckoutRequest(BaseModel):
    project_id: int | None = None  # Optional: if None, buys a video credit
    quantity: int = 1  # Number of video credits to purchase (ignored when project_id set)


class PortalResponse(BaseModel):
    portal_url: str


class BillingStatusOut(BaseModel):
    plan: str
    videos_used: int
    video_limit: int
    can_create_video: bool
    stripe_subscription_id: str | None = None
    is_active: bool


# ─── Plans (public) ───────────────────────────────────────

class PlanOut(BaseModel):
    id: int
    slug: str
    name: str
    description: str | None
    price_cents: int
    currency: str
    billing_interval: str
    video_limit: int
    includes_studio: bool
    includes_chat_editor: bool
    includes_priority_support: bool
    sort_order: int

    class Config:
        from_attributes = True


@router.get("/plans", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db)):
    """Return all active subscription plans (public, no auth needed)."""
    plans = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_active == True)
        .order_by(SubscriptionPlan.sort_order)
        .all()
    )
    return plans


# ─── Helpers ──────────────────────────────────────────────

def _count_active_per_video_credits(user_id: int, db: Session) -> int:
    """
    Sum per-video credits for a user from Subscription rows that are COMPLETED
    and not yet expired (current_period_end is in the future or not set).

    Sums Subscription.quantity rather than counting rows, because a single
    slider purchase of N credits is stored as one row with quantity=N.

    These are the only credits that should contribute to video_limit_bonus.
    Free grants given manually (directly setting video_limit_bonus in the DB)
    are NOT represented here, so they are excluded by this sum.
    """
    now = datetime.utcnow()
    per_video_plan = db.query(SubscriptionPlan).filter_by(slug="per_video").first()
    if not per_video_plan:
        return 0

    total = (
        db.query(func.coalesce(func.sum(Subscription.quantity), 0))
        .filter(
            Subscription.user_id == user_id,
            Subscription.plan_id == per_video_plan.id,
            Subscription.status == SubscriptionStatus.COMPLETED,
            # Credit is valid if expiry hasn't been set yet OR hasn't passed
            (
                (Subscription.current_period_end == None) |
                (Subscription.current_period_end > now)
            ),
        )
        .scalar()
    )
    return int(total or 0)


def _recalculate_video_limit_bonus(user: User, db: Session) -> None:
    """
    Called when a user subscribes to a Pro/Standard plan, or when a plan renews.

    Absorption order: base(2) → free_grants → referral_video_bonus → paid_credits.
    Base and free-grant usage disappears on upgrade. Referral and paid usage carries
    into the new period's videos_used_this_period so the user doesn't get phantom headroom.
    referral_video_bonus persists (reduced by what was consumed) — it is NOT wiped on upgrade.
    """
    old_bonus      = getattr(user, "video_limit_bonus", 0) or 0
    referral_bonus = getattr(user, "referral_video_bonus", 0) or 0
    videos_used    = user.videos_used_this_period or 0
    paid_credits   = _count_active_per_video_credits(user.id, db)

    # Usage absorption order: base(2) → free_grants → referral → paid
    #
    # free_grants: portion of old video_limit_bonus that came from free promo grants
    #   (total old_bonus minus the paid per-video credits within it)
    # absorbed: usage explained by base + free_grants (these disappear on upgrade)
    # remaining: usage that survived the free absorption — must come from referral or paid
    # referral_consumed: how many of the remaining were charged against referral bonus
    # paid_consumed: what's left, charged against paid credits (carries into new period)
    # new_videos_used: referral_consumed + paid_consumed (base/free usage disappears)
    #
    # Example A — free user: base=2, referral=6, free_grants=2, paid=2, used=8
    #   free_grants  = old_bonus(4) - paid_credits(2) = 2
    #   absorbed     = min(8, 2+2) = 4       (2 base + 2 free grants absorbed)
    #   remaining    = 8 - 4 = 4
    #   ref_consumed = min(6, 4) = 4         (4 of the 6 referral videos consumed)
    #   paid_consumed= max(0, 4-4) = 0
    #   new_used     = 4+0 = 4,  referral_video_bonus = 6
    #   → new limit = plan + 2 paid + 6 referral = plan+8, used=4, remaining=plan+4
    #
    # Example B — base=2, referral=6, free_grants=2, paid=2, used=11
    #   absorbed=4, remaining=7, ref_consumed=min(6,7)=6, paid_consumed=1
    #   new_used=7, referral_video_bonus=6
    #
    # Example C — base=2, referral=0, free_grants=2, paid=2, used=6
    #   absorbed=4, remaining=2, ref_consumed=0, paid_consumed=2
    #   new_used=2, referral_video_bonus=0
    free_grants      = max(0, old_bonus - paid_credits)
    absorbed         = min(videos_used, FREE_TIER_INCLUDED_VIDEOS + free_grants)
    remaining        = max(0, videos_used - absorbed)
    referral_consumed = min(referral_bonus, remaining)
    paid_consumed    = max(0, remaining - referral_consumed)
    new_videos_used  = referral_consumed + paid_consumed

    user.video_limit_bonus       = paid_credits
    user.referral_video_bonus    = referral_bonus
    user.videos_used_this_period = new_videos_used

    print(
        f"[BILLING] Recalculated for user {user.id}: "
        f"old_bonus={old_bonus} (free_grants={free_grants}, paid={paid_credits}), "
        f"referral={referral_bonus} → consumed={referral_consumed}, "
        f"videos_used {videos_used} → {new_videos_used}"
    )


# ─── Pro / Standard Subscription Checkout ─────────────────

class CheckoutRequest(BaseModel):
    plan: str = "pro"  # "pro" or "standard"
    billing_cycle: str = "monthly"  # "monthly", "annual", or "lifetime"
    apply_third_video_offer: bool = False  # Out-of-videos offer (15% monthly / 25% annual Standard)


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_session(
    body: CheckoutRequest = CheckoutRequest(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for Pro or Standard plan."""
    # Lifetime is a one-time payment (mode="payment"), not a recurring subscription.
    # Allowed even for users with an active recurring subscription — we don't auto-cancel
    # the recurring plan here.
    is_lifetime = body.billing_cycle == "lifetime"

    if body.plan == "standard":
        if is_lifetime:
            price_id = settings.STANDARD_PLAN_LIFETIME_DEAL
            if not price_id:
                raise HTTPException(status_code=400, detail="Standard lifetime deal not configured yet")
            subscription_type = "standard_lifetime"
        else:
            if user.plan in (PlanTier.STANDARD):
                raise HTTPException(status_code=400, detail="Already on Standard plan")
            if body.billing_cycle == "annual":
                price_id = settings.STRIPE_STANDARD_ANNUAL_PRICE_ID
                if not price_id:
                    raise HTTPException(status_code=400, detail="Standard annual plan not configured yet")
            else:
                price_id = settings.STRIPE_STANDARD_PRICE_ID
                if not price_id:
                    raise HTTPException(status_code=400, detail="Standard plan not configured yet")
            subscription_type = "standard_subscription"
        billing_cycle = body.billing_cycle
    else:
        if is_lifetime:
            price_id = settings.PRO_PLAN_LIFETIME_DEAL
            if not price_id:
                raise HTTPException(status_code=400, detail="Pro lifetime deal not configured yet")
            subscription_type = "pro_lifetime"
        else:
            if user.plan == PlanTier.PRO:
                raise HTTPException(status_code=400, detail="Already on Pro plan")
            if body.billing_cycle == "annual":
                price_id = settings.STRIPE_PRO_ANNUAL_PRICE_ID
                if not price_id:
                    raise HTTPException(status_code=400, detail="Annual plan not configured yet")
            else:
                price_id = settings.STRIPE_PRO_PRICE_ID
                if not price_id:
                    raise HTTPException(status_code=400, detail="Monthly plan not configured yet")
            subscription_type = "pro_subscription"
        billing_cycle = body.billing_cycle

    # Ensure the user has a Stripe customer
    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={"user_id": str(user.id)},
        )
        user.stripe_customer_id = customer.id
        db.commit()

    # Out-of-videos limited-time offer: server-side eligibility gate, then attach coupon.
    # Eligibility is derived from existing fields — no new DB columns. Stripe's
    # max_redemptions_per_customer: 1 on the coupons is the real abuse barrier.
    discounts = None
    if body.apply_third_video_offer:
        if is_lifetime:
            raise HTTPException(status_code=400, detail="Offer does not apply to lifetime deals")
        if user.plan != PlanTier.FREE:
            raise HTTPException(status_code=409, detail="Offer only available to free-plan users")
        if user.can_create_video:
            raise HTTPException(status_code=409, detail="Offer only available when you have no remaining videos")
        if body.plan != "standard":
            raise HTTPException(status_code=400, detail="Offer only applies to Standard plan")
        coupon_id = (
            settings.STRIPE_STANDARD_ANNUAL_COUPON_ID if body.billing_cycle == "annual"
            else settings.STRIPE_STANDARD_MONTHLY_COUPON_ID
        )
        if not coupon_id:
            raise HTTPException(status_code=400, detail="Offer coupon is not configured")
        discounts = [{"coupon": coupon_id}]

    session_kwargs = dict(
        customer=user.stripe_customer_id,
        mode="payment" if is_lifetime else "subscription",
        line_items=[
            {
                "price": price_id,
                "quantity": 1,
            }
        ],
        success_url=f"{settings.FRONTEND_URL}/dashboard?upgraded=true&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/pricing",
        metadata={
            "user_id": str(user.id),
            "type": subscription_type,
            "plan": body.plan,
            "billing_cycle": billing_cycle,
            **({"third_video_offer": "true"} if discounts else {}),
        },
    )
    # Stripe disallows allow_promotion_codes together with discounts.
    if discounts:
        session_kwargs["discounts"] = discounts
    else:
        session_kwargs["allow_promotion_codes"] = True

    session = stripe.checkout.Session.create(**session_kwargs)

    return CheckoutResponse(checkout_url=session.url)


# ─── Per-Video Checkout ($3) ──────────────────────────────

@router.post("/checkout-per-video", response_model=CheckoutResponse)
def create_per_video_checkout(
    body: PerVideoCheckoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Checkout session for a single video ($3).
    If project_id is provided, unlocks that specific project.
    If project_id is omitted (e.g. from Pricing page), buys a video credit.
    """
    # Project-specific unlock is always qty=1 by design
    if body.project_id and body.quantity != 1:
        raise HTTPException(
            status_code=400,
            detail="Project-specific unlock only supports quantity=1",
        )

    qty = max(PER_VIDEO_MIN_QTY, min(body.quantity, PER_VIDEO_MAX_QTY))
    unit_amount = per_video_unit_cents(qty)

    meta = {
        "user_id": str(user.id),
        "type": "per_video",
        "qty": str(qty),
    }
    success_url = f"{settings.FRONTEND_URL}/dashboard?purchased=true&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{settings.FRONTEND_URL}/pricing"

    if body.project_id:
        project = (
            db.query(Project)
            .filter(Project.id == body.project_id, Project.user_id == user.id)
            .first()
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if project.studio_unlocked:
            raise HTTPException(status_code=400, detail="This video is already unlocked")
        meta["project_id"] = str(project.id)
        success_url = f"{settings.FRONTEND_URL}/project/{project.id}?purchased=true&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{settings.FRONTEND_URL}/project/{project.id}"

    # Ensure the user has a Stripe customer
    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={"user_id": str(user.id)},
        )
        user.stripe_customer_id = customer.id
        db.commit()

    product_name = (
        "blog2video — 1 video credit"
        if qty == 1
        else f"blog2video — {qty} video pack"
    )

    session = stripe.checkout.Session.create(
        customer=user.stripe_customer_id,
        mode="payment",
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": product_name},
                    "unit_amount": unit_amount,
                },
                "quantity": qty,
            }
        ],
        allow_promotion_codes=True,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=meta,
    )

    return CheckoutResponse(checkout_url=session.url)


# ─── Bulk 500-video credit pack ($300, never expires) ─────

BULK_500_CREDITS = 500

@router.post("/checkout-bulk-credits", response_model=CheckoutResponse)
def create_bulk_credits_checkout(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for the 500-video credit pack ($300).

    One-time payment (mode="payment") using the LIFETIME_DEAL_500 price. The
    credits never expire — they are consumed only as the user makes videos.
    """
    price_id = settings.LIFETIME_DEAL_500
    if not price_id:
        raise HTTPException(status_code=400, detail="500-video deal not configured yet")

    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={"user_id": str(user.id)},
        )
        user.stripe_customer_id = customer.id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=user.stripe_customer_id,
        mode="payment",
        line_items=[{"price": price_id, "quantity": 1}],
        allow_promotion_codes=True,
        success_url=f"{settings.FRONTEND_URL}/dashboard?purchased=true&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/pricing",
        metadata={
            "user_id": str(user.id),
            "type": "bulk_500",
            "qty": str(BULK_500_CREDITS),
        },
    )
    return CheckoutResponse(checkout_url=session.url)


@router.post("/checkout-custom-template", response_model=CheckoutResponse)
def create_custom_template_checkout(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for one extra custom-template slot ($5).

    Grants +1 to ``user.custom_template_bonus`` on payment (lifetime, no expiry).
    """
    # Ensure the user has a Stripe customer
    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={"user_id": str(user.id)},
        )
        user.stripe_customer_id = customer.id
        db.commit()

    success_url = f"{settings.FRONTEND_URL}/custom-templates?purchased=true&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{settings.FRONTEND_URL}/custom-templates"

    session = stripe.checkout.Session.create(
        customer=user.stripe_customer_id,
        mode="payment",
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": "blog2video — 1 custom template slot"},
                    "unit_amount": 500,
                },
                "quantity": 1,
            }
        ],
        allow_promotion_codes=True,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": str(user.id), "type": "custom_template"},
    )

    return CheckoutResponse(checkout_url=session.url)


# ─── Change Plan (Upgrade / Downgrade for existing paid users) ────

# Lexicographic rank — tier dominates cycle. Higher rank = more expensive commitment.
_PLAN_RANK: dict[str, tuple[int, int]] = {
    "standard_monthly": (1, 1),
    "standard_annual":  (1, 2),
    "pro_monthly":      (2, 1),
    "pro_annual":       (2, 2),
}


def _target_slug(plan: str, billing_cycle: str) -> str:
    return f"{plan}_{billing_cycle}"


def _classify_direction(current_slug: str, target_slug: str) -> str:
    """Return 'upgrade' or 'downgrade'. Raises 400 if same or unknown."""
    if current_slug == target_slug:
        raise HTTPException(status_code=400, detail="Already on this plan")
    if current_slug not in _PLAN_RANK or target_slug not in _PLAN_RANK:
        raise HTTPException(status_code=400, detail="Unsupported plan slug")
    return "upgrade" if _PLAN_RANK[target_slug] > _PLAN_RANK[current_slug] else "downgrade"


class ChangePlanRequest(BaseModel):
    plan: str           # "standard" | "pro"
    billing_cycle: str  # "monthly" | "annual"


class ChangePlanPreviewOut(BaseModel):
    direction: str
    current_plan_slug: str
    target_plan_slug: str
    amount_due_today_cents: int          # 0 for downgrade
    proration_credit_cents: int          # for upgrade only; 0 for downgrade
    credit_to_balance_cents: int = 0     # surplus proration credit parked on the customer balance
    target_plan_price_cents: int         # full price of the target plan
    new_period_start_iso: str            # today for upgrade; current_period_end for downgrade
    new_period_end_iso: str | None
    effective_date_iso: str
    currency: str = "usd"


class ChangePlanOut(BaseModel):
    status: str
    direction: str
    target_plan_slug: str
    effective_date_iso: str
    amount_due_today_cents: int


def _get_active_subscription(user: User, db: Session) -> Subscription:
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_([
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
                SubscriptionStatus.REQUIRES_ACTION,
            ]),
            Subscription.stripe_subscription_id.isnot(None),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if not sub or not user.stripe_subscription_id:
        raise HTTPException(
            status_code=400,
            detail="No active subscription — use /checkout to subscribe",
        )
    return sub


def _validate_change_plan_request(body: ChangePlanRequest) -> str:
    if body.plan not in ("standard", "pro"):
        raise HTTPException(status_code=400, detail="plan must be 'standard' or 'pro'")
    if body.billing_cycle not in ("monthly", "annual"):
        raise HTTPException(status_code=400, detail="billing_cycle must be 'monthly' or 'annual'")
    return _target_slug(body.plan, body.billing_cycle)


def _release_existing_schedule(sub: Subscription) -> None:
    """Release any in-flight SubscriptionSchedule so we can either upgrade now
    or set a fresh schedule. Silently tolerates a stale id."""
    if not sub.stripe_schedule_id:
        return
    try:
        stripe.SubscriptionSchedule.release(sub.stripe_schedule_id)
    except stripe.error.InvalidRequestError as e:
        logger.warning(
            "[BILLING] Could not release schedule %s: %s",
            sub.stripe_schedule_id, e,
        )
    sub.stripe_schedule_id = None
    sub.scheduled_plan_id = None
    sub.scheduled_change_at = None


@router.post("/change-plan-preview", response_model=ChangePlanPreviewOut)
def preview_change_plan(
    body: ChangePlanRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the dollar amount and effective date for a proposed plan switch."""
    target_slug = _validate_change_plan_request(body)
    sub = _get_active_subscription(user, db)
    current_slug = sub.plan.slug if sub.plan else ""
    direction = _classify_direction(current_slug, target_slug)

    target_plan = db.query(SubscriptionPlan).filter_by(slug=target_slug).first()
    if not target_plan or not target_plan.stripe_price_id:
        raise HTTPException(status_code=400, detail=f"Target plan {target_slug} is not configured")

    now = datetime.utcnow()

    if direction == "downgrade":
        # Scheduled at period end — no charge today.
        effective_date = sub.current_period_end or now
        return ChangePlanPreviewOut(
            direction="downgrade",
            current_plan_slug=current_slug,
            target_plan_slug=target_slug,
            amount_due_today_cents=0,
            proration_credit_cents=0,
            target_plan_price_cents=target_plan.price_cents,
            new_period_start_iso=effective_date.isoformat(),
            new_period_end_iso=None,
            effective_date_iso=effective_date.isoformat(),
        )

    # Upgrade: ask Stripe to preview the invoice with proration + cycle reset.
    try:
        stripe_sub = stripe.Subscription.retrieve(user.stripe_subscription_id)
        item_id = stripe_sub["items"]["data"][0]["id"]

        if hasattr(stripe.Invoice, "create_preview"):
            upcoming = stripe.Invoice.create_preview(
                customer=user.stripe_customer_id,
                subscription=user.stripe_subscription_id,
                subscription_details={
                    "items": [{"id": item_id, "price": target_plan.stripe_price_id}],
                    "proration_behavior": "always_invoice",
                    "billing_cycle_anchor": "now",
                },
            )
        else:
            upcoming = stripe.Invoice.upcoming(
                customer=user.stripe_customer_id,
                subscription=user.stripe_subscription_id,
                subscription_items=[{"id": item_id, "price": target_plan.stripe_price_id}],
                subscription_proration_behavior="always_invoice",
                subscription_billing_cycle_anchor="now",
            )
    except stripe.error.StripeError as e:
        logger.exception("[BILLING] Failed to preview upgrade for user=%s", user.id)
        raise HTTPException(status_code=400, detail=str(e))

    # `total` is the net of the invoice and can be negative when the proration
    # credit for unused time exceeds the new plan's prorated charge. Stripe never
    # bills a negative amount — it parks the surplus on the customer's credit
    # balance and applies it to future invoices. We surface both numbers.
    total_cents = int(getattr(upcoming, "total", 0) or 0)
    amount_due = int(getattr(upcoming, "amount_due", 0) or 0)
    if not amount_due:
        amount_due = total_cents

    # Sum negative line items to surface the credit applied for unused time.
    credit_cents = 0
    lines = getattr(upcoming, "lines", None)
    line_items = getattr(lines, "data", []) if lines is not None else []
    for line in line_items:
        amt = getattr(line, "amount", None)
        if isinstance(line, dict):
            amt = line.get("amount")
        if isinstance(amt, int) and amt < 0:
            credit_cents += -amt

    return ChangePlanPreviewOut(
        direction="upgrade",
        current_plan_slug=current_slug,
        target_plan_slug=target_slug,
        amount_due_today_cents=max(0, amount_due),
        proration_credit_cents=credit_cents,
        credit_to_balance_cents=max(0, -total_cents),
        target_plan_price_cents=target_plan.price_cents,
        new_period_start_iso=now.isoformat(),
        new_period_end_iso=None,
        effective_date_iso=now.isoformat(),
    )


@router.post("/change-plan", response_model=ChangePlanOut)
def change_plan(
    body: ChangePlanRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Switch an existing paid user to a different paid plan.

    Upgrade  → immediate switch via Subscription.modify with proration.
    Downgrade → scheduled at period end via SubscriptionSchedule.
    """
    target_slug = _validate_change_plan_request(body)
    sub = _get_active_subscription(user, db)
    current_slug = sub.plan.slug if sub.plan else ""

    # Block plan changes when payment is in trouble — user must resolve first.
    if sub.status in (SubscriptionStatus.PAST_DUE, SubscriptionStatus.REQUIRES_ACTION):
        raise HTTPException(
            status_code=409,
            detail="Resolve your payment issue in the billing portal before changing plans",
        )

    direction = _classify_direction(current_slug, target_slug)

    target_plan = db.query(SubscriptionPlan).filter_by(slug=target_slug).first()
    if not target_plan or not target_plan.stripe_price_id:
        raise HTTPException(status_code=400, detail=f"Target plan {target_slug} is not configured")

    try:
        stripe_sub = stripe.Subscription.retrieve(user.stripe_subscription_id)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    item_id = stripe_sub["items"]["data"][0]["id"]
    now = datetime.utcnow()

    if direction == "upgrade":
        # Wipe any pending downgrade first — upgrading supersedes it.
        _release_existing_schedule(sub)

        try:
            updated = stripe.Subscription.modify(
                user.stripe_subscription_id,
                items=[{"id": item_id, "price": target_plan.stripe_price_id}],
                proration_behavior="always_invoice",
                billing_cycle_anchor="now",
                cancel_at_period_end=False,
                payment_behavior="error_if_incomplete",
                metadata={
                    "plan": body.plan,
                    "billing_cycle": body.billing_cycle,
                    "switch_reason": "upgrade",
                },
            )
        except stripe.error.CardError as e:
            raise HTTPException(status_code=402, detail=str(e))
        except stripe.error.StripeError as e:
            logger.exception("[BILLING] Stripe error on upgrade for user=%s", user.id)
            raise HTTPException(status_code=400, detail=str(e))

        # The proration invoice (always_invoice) is what the user actually paid
        # today — not the full recurring price. Read it back so amount_paid_cents
        # reflects reality. Fall back to the plan price if the invoice is missing.
        charged_cents = target_plan.price_cents
        latest_invoice_id = (
            updated.get("latest_invoice") if isinstance(updated, dict)
            else getattr(updated, "latest_invoice", None)
        )
        if isinstance(latest_invoice_id, dict):
            latest_invoice_id = latest_invoice_id.get("id")
        elif hasattr(latest_invoice_id, "id"):
            latest_invoice_id = latest_invoice_id.id
        if latest_invoice_id:
            try:
                inv = stripe.Invoice.retrieve(latest_invoice_id)
                charged_cents = (
                    int(getattr(inv, "amount_paid", 0) or 0)
                    or int(getattr(inv, "amount_due", 0) or 0)
                )
            except stripe.error.StripeError:
                logger.warning(
                    "[BILLING] Could not read proration invoice %s for user=%s; "
                    "falling back to plan price",
                    latest_invoice_id, user.id,
                )

        # Sync DB synchronously — webhook is a safety net.
        sub.plan_id = target_plan.id
        sub.status = SubscriptionStatus.ACTIVE
        sub.amount_paid_cents = charged_cents
        sub.canceled_at = None
        period_start = (
            updated.get("current_period_start") if isinstance(updated, dict)
            else getattr(updated, "current_period_start", None)
        )
        period_end = (
            updated.get("current_period_end") if isinstance(updated, dict)
            else getattr(updated, "current_period_end", None)
        )
        sub.current_period_start = datetime.utcfromtimestamp(period_start) if period_start else now
        if period_end:
            sub.current_period_end = datetime.utcfromtimestamp(period_end)

        # Update user-level state for the new cycle.
        if target_slug.startswith("pro"):
            user.plan = PlanTier.PRO
        else:
            user.plan = PlanTier.STANDARD
        user.videos_used_this_period = 0
        user.period_start = now
        _recalculate_video_limit_bonus(user, db)

        db.commit()
        return ChangePlanOut(
            status="ok",
            direction="upgrade",
            target_plan_slug=target_slug,
            effective_date_iso=now.isoformat(),
            amount_due_today_cents=charged_cents,
        )

    # ── downgrade: schedule at period end ────────────────────────────────────
    current_price_id = sub.plan.stripe_price_id if sub.plan else None
    if not current_price_id:
        raise HTTPException(status_code=400, detail="Current plan has no Stripe price configured")

    effective_date = sub.current_period_end
    if not effective_date:
        raise HTTPException(
            status_code=400,
            detail="Current subscription has no period end; cannot schedule downgrade",
        )

    try:
        # Reuse an existing schedule if Stripe already attached one; otherwise create.
        schedule_id = (
            stripe_sub.get("schedule") if isinstance(stripe_sub, dict)
            else getattr(stripe_sub, "schedule", None)
        )
        if isinstance(schedule_id, dict):
            schedule_id = schedule_id.get("id")
        elif hasattr(schedule_id, "id"):
            schedule_id = schedule_id.id

        if not schedule_id:
            schedule = stripe.SubscriptionSchedule.create(
                from_subscription=user.stripe_subscription_id,
            )
            schedule_id = schedule["id"] if isinstance(schedule, dict) else schedule.id
        else:
            schedule = stripe.SubscriptionSchedule.retrieve(schedule_id)

        phases = schedule["phases"] if isinstance(schedule, dict) else schedule.phases
        current_phase = phases[0]
        current_phase_start = (
            current_phase["start_date"] if isinstance(current_phase, dict)
            else current_phase.start_date
        )
        current_phase_end = (
            current_phase["end_date"] if isinstance(current_phase, dict)
            else current_phase.end_date
        )

        stripe.SubscriptionSchedule.update(
            schedule_id,
            end_behavior="release",
            phases=[
                {
                    "items": [{"price": current_price_id, "quantity": 1}],
                    "start_date": current_phase_start,
                    "end_date": current_phase_end,
                    "proration_behavior": "none",
                },
                {
                    "items": [{"price": target_plan.stripe_price_id, "quantity": 1}],
                    "iterations": 1,
                    "proration_behavior": "none",
                },
            ],
            metadata={
                "plan": body.plan,
                "billing_cycle": body.billing_cycle,
                "switch_reason": "downgrade",
            },
        )
    except stripe.error.StripeError as e:
        logger.exception("[BILLING] Stripe error scheduling downgrade for user=%s", user.id)
        raise HTTPException(status_code=400, detail=str(e))

    sub.scheduled_plan_id = target_plan.id
    sub.scheduled_change_at = effective_date
    sub.stripe_schedule_id = schedule_id
    db.commit()

    return ChangePlanOut(
        status="ok",
        direction="downgrade",
        target_plan_slug=target_slug,
        effective_date_iso=effective_date.isoformat(),
        amount_due_today_cents=0,
    )


@router.post("/cancel-scheduled-change")
def cancel_scheduled_change(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Release a pending scheduled downgrade — subscription continues on current plan."""
    sub = _get_active_subscription(user, db)
    if not sub.scheduled_plan_id or not sub.stripe_schedule_id:
        raise HTTPException(status_code=400, detail="No scheduled plan change to cancel")

    try:
        stripe.SubscriptionSchedule.release(sub.stripe_schedule_id)
    except stripe.error.InvalidRequestError as e:
        logger.warning(
            "[BILLING] SubscriptionSchedule.release failed for schedule=%s: %s",
            sub.stripe_schedule_id, e,
        )

    sub.scheduled_plan_id = None
    sub.scheduled_change_at = None
    sub.stripe_schedule_id = None
    db.commit()

    return {"status": "ok", "message": "Scheduled plan change cancelled"}


# ─── Customer Portal ──────────────────────────────────────

@router.post("/portal", response_model=PortalResponse)
def create_portal_session(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Customer Portal session for managing subscription."""
    if not user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")

    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{settings.FRONTEND_URL}/subscription",
    )

    return PortalResponse(portal_url=session.url)


# ─── Billing Status ───────────────────────────────────────

@router.get("/status", response_model=BillingStatusOut)
def get_billing_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's billing/usage status."""
    # Refresh lifetime users' monthly allotment if their window has rolled over.
    user.roll_video_period_if_due(db)
    return BillingStatusOut(
        plan=user.plan.value,
        videos_used=user.videos_used_this_period,
        video_limit=user.video_limit,
        can_create_video=user.can_create_video,
        stripe_subscription_id=user.stripe_subscription_id,
        is_active=user.is_active,
    )


# ─── Subscription Detail ──────────────────────────────────

class SubscriptionDetailOut(BaseModel):
    id: int
    plan_name: str
    plan_slug: str
    status: str
    stripe_subscription_id: str | None = None
    current_period_start: str | None = None
    current_period_end: str | None = None
    videos_used: int
    amount_paid_cents: int
    canceled_at: str | None = None
    retention_offer_eligible: bool = False
    scheduled_plan_slug: str | None = None
    scheduled_plan_name: str | None = None
    scheduled_change_at: str | None = None
    created_at: str

    class Config:
        from_attributes = True


class RetentionOfferImpressionOut(BaseModel):
    recorded: bool
    shown_count: int
    eligible: bool


class RetentionOfferAcceptOut(BaseModel):
    """status: applied = coupon attached this request; already_applied = idempotent no-op."""

    status: str  # "applied" | "already_applied"
    message: str


class CancelSubscriptionRequest(BaseModel):
    declined_retention_offer: bool = False


def _coupon_id_from_stripe_object(coupon: object) -> str | None:
    if coupon is None:
        return None
    if isinstance(coupon, str):
        # Sometimes Stripe returns only the coupon id string.
        return coupon
    if isinstance(coupon, dict):
        return coupon.get("id")
    return getattr(coupon, "id", None)


def _stripe_get(obj: object, key: str, default: object = None) -> object:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _subscription_has_retention_coupon(stripe_sub: object, retention_coupon_id: str) -> bool:
    """True if subscription already has this coupon (Stripe discount list or legacy single discount)."""
    logger.info(
        "[RETENTION] Checking subscription-level discounts for coupon %s",
        retention_coupon_id,
    )

    def _coupon_id_from_discount(discount_obj: object) -> str | None:
        if discount_obj is None:
            return None
        if isinstance(discount_obj, str):
            # Sometimes only discount id is present (non-expanded object)
            try:
                retrieved_discount = stripe.Discount.retrieve(discount_obj)
                return _coupon_id_from_stripe_object(_stripe_get(retrieved_discount, "coupon"))
            except Exception:
                logger.warning(
                    "[RETENTION] Could not expand discount id=%s while checking subscription",
                    discount_obj,
                )
                return None
        if isinstance(discount_obj, dict):
            coupon = discount_obj.get("coupon")
        else:
            coupon = getattr(discount_obj, "coupon", None)
        # Newer shapes may nest coupon under source.coupon
        if coupon is None:
            source = _stripe_get(discount_obj, "source")
            coupon = _stripe_get(source, "coupon")
        return _coupon_id_from_stripe_object(coupon)

    discounts = getattr(stripe_sub, "discounts", None)
    logger.info(
        "[RETENTION] subscription.discounts present=%s type=%s",
        discounts is not None,
        type(discounts).__name__ if discounts is not None else None,
    )
    if discounts is not None:
        items = getattr(discounts, "data", None)
        if items is None and isinstance(discounts, list):
            items = discounts
        logger.info(
            "[RETENTION] subscription.discounts items_count=%s",
            len(items) if isinstance(items, list) else 0,
        )
        if items:
            for d in items:
                if _coupon_id_from_discount(d) == retention_coupon_id:
                    logger.info("[RETENTION] Matched coupon on subscription.discounts")
                    return True

    discount = getattr(stripe_sub, "discount", None)
    if discount is None and isinstance(stripe_sub, dict):
        discount = stripe_sub.get("discount")
    logger.info(
        "[RETENTION] subscription.discount present=%s type=%s",
        discount is not None,
        type(discount).__name__ if discount is not None else None,
    )
    if _coupon_id_from_discount(discount) == retention_coupon_id:
        logger.info("[RETENTION] Matched coupon on legacy subscription.discount")
        return True

    logger.info("[RETENTION] No subscription-level coupon match")
    return False


def _upcoming_invoice_has_retention_coupon(
    user: User, retention_coupon_id: str
) -> bool:
    """
    For duration='once' coupons, Stripe may reflect the discount only on the upcoming invoice
    preview (not on subscription.discount(s)). This checks the invoice preview API.
    """
    if not user.stripe_customer_id or not user.stripe_subscription_id:
        return False
    try:
        try:
            if hasattr(stripe.Invoice, "upcoming"):
                upcoming = stripe.Invoice.upcoming(
                    customer=user.stripe_customer_id,
                    subscription=user.stripe_subscription_id,
                    expand=[
                        "discount",
                        "discount.coupon",
                        "discounts",
                        "total_discount_amounts.discount",
                        "total_discount_amounts.discount.coupon",
                    ],
                )
            else:
                # Stripe SDK v13+ removed Invoice.upcoming in favor of create_preview.
                upcoming = stripe.Invoice.create_preview(
                    customer=user.stripe_customer_id,
                    subscription=user.stripe_subscription_id,
                    expand=[
                        "discount",
                        "discount.coupon",
                        "discounts",
                        "total_discount_amounts.discount",
                        "total_discount_amounts.discount.coupon",
                    ],
                )
        except stripe.error.InvalidRequestError:
            # Some Stripe API versions reject one or more expand paths.
            if hasattr(stripe.Invoice, "upcoming"):
                upcoming = stripe.Invoice.upcoming(
                    customer=user.stripe_customer_id,
                    subscription=user.stripe_subscription_id,
                )
            else:
                upcoming = stripe.Invoice.create_preview(
                    customer=user.stripe_customer_id,
                    subscription=user.stripe_subscription_id,
                )
        logger.info(
            "[RETENTION] Loaded upcoming invoice preview for user=%s sub=%s",
            user.id,
            user.stripe_subscription_id,
        )
    except Exception:
        # If preview fails, don't block applying the coupon.
        logger.exception(
            "[RETENTION] Failed to load upcoming invoice preview for user=%s sub=%s",
            user.id,
            user.stripe_subscription_id,
        )
        return False

    discounts = _stripe_get(upcoming, "discounts")
    logger.info(
        "[RETENTION] upcoming.discounts present=%s type=%s",
        discounts is not None,
        type(discounts).__name__ if discounts is not None else None,
    )
    if discounts is not None:
        items = _stripe_get(discounts, "data")
        if items is None and isinstance(discounts, list):
            items = discounts
        logger.info(
            "[RETENTION] upcoming.discounts items_count=%s",
            len(items) if isinstance(items, list) else 0,
        )
        if items:
            for d in items:
                coupon = _stripe_get(d, "coupon")
                coupon_id = _coupon_id_from_stripe_object(coupon)
                logger.info("[RETENTION] upcoming.discounts coupon_id=%s", coupon_id)
                if coupon_id == retention_coupon_id:
                    logger.info("[RETENTION] Matched coupon on upcoming.discounts")
                    return True

    # Legacy single discount field
    discount = _stripe_get(upcoming, "discount")
    logger.info(
        "[RETENTION] upcoming.discount present=%s type=%s",
        discount is not None,
        type(discount).__name__ if discount is not None else None,
    )
    if discount is not None:
        coupon = _stripe_get(discount, "coupon")
        coupon_id = _coupon_id_from_stripe_object(coupon)
        logger.info("[RETENTION] upcoming.discount coupon_id=%s", coupon_id)
        if coupon_id == retention_coupon_id:
            logger.info("[RETENTION] Matched coupon on legacy upcoming.discount")
            return True

    # Some invoice previews expose discount amounts with expanded discount/coupon refs.
    total_discount_amounts = _stripe_get(upcoming, "total_discount_amounts")
    logger.info(
        "[RETENTION] upcoming.total_discount_amounts type=%s count=%s",
        type(total_discount_amounts).__name__ if total_discount_amounts is not None else None,
        len(total_discount_amounts) if isinstance(total_discount_amounts, list) else 0,
    )
    if isinstance(total_discount_amounts, list):
        for item in total_discount_amounts:
            discount_obj = _stripe_get(item, "discount")
            if discount_obj is None:
                continue
            coupon = _stripe_get(discount_obj, "coupon")
            coupon_id = _coupon_id_from_stripe_object(coupon)
            logger.info("[RETENTION] upcoming.total_discount_amounts coupon_id=%s", coupon_id)
            if coupon_id == retention_coupon_id:
                logger.info("[RETENTION] Matched coupon on total_discount_amounts")
                return True

    logger.info("[RETENTION] No upcoming-invoice coupon match")
    return False


def _is_retention_offer_eligible(user: User) -> bool:
    return bool(
        settings.STRIPE_RETENTION_COUPON_ID
        and user.stripe_subscription_id
        and not (user.retention_offer_suppressed or False)
        and (user.retention_offer_shown_count or 0) < MAX_RETENTION_OFFER_SHOWS
    )


@router.get("/subscription", response_model=SubscriptionDetailOut | None)
def get_subscription_detail(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the user's active subscription detail (if any)."""
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(["active", "past_due", "requires_action"]),
            Subscription.stripe_subscription_id.isnot(None),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if not sub:
        return None

    return SubscriptionDetailOut(
        id=sub.id,
        plan_name=sub.plan.name if sub.plan else "Pro",
        plan_slug=sub.plan.slug if sub.plan else "pro_monthly",
        status=sub.status.value if hasattr(sub.status, "value") else sub.status,
        stripe_subscription_id=sub.stripe_subscription_id,
        current_period_start=sub.current_period_start.isoformat() if sub.current_period_start else None,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
        videos_used=sub.videos_used,
        amount_paid_cents=sub.amount_paid_cents,
        canceled_at=sub.canceled_at.isoformat() if sub.canceled_at else None,
        retention_offer_eligible=_is_retention_offer_eligible(user),
        scheduled_plan_slug=sub.scheduled_plan.slug if sub.scheduled_plan else None,
        scheduled_plan_name=sub.scheduled_plan.name if sub.scheduled_plan else None,
        scheduled_change_at=sub.scheduled_change_at.isoformat() if sub.scheduled_change_at else None,
        created_at=sub.created_at.isoformat(),
    )


# ─── Invoices ─────────────────────────────────────────────

class InvoiceOut(BaseModel):
    id: str
    number: str | None = None
    status: str | None = None
    amount_due: int
    amount_paid: int
    currency: str
    created: str
    hosted_invoice_url: str | None = None
    invoice_pdf: str | None = None


@router.get("/invoices", response_model=list[InvoiceOut])
def list_invoices(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch the user's recent Stripe invoices."""
    if not user.stripe_customer_id:
        return []

    try:
        invoices = stripe.Invoice.list(
            customer=user.stripe_customer_id,
            limit=20,
        )
        result = []
        for inv in invoices.data:
            result.append(InvoiceOut(
                id=inv.id,
                number=inv.number,
                status=inv.status,
                amount_due=inv.amount_due,
                amount_paid=inv.amount_paid,
                currency=inv.currency,
                created=datetime.utcfromtimestamp(inv.created).isoformat(),
                hosted_invoice_url=inv.hosted_invoice_url,
                invoice_pdf=inv.invoice_pdf,
            ))
        return result
    except Exception as e:
        logger.error(
            "[BILLING] Failed to fetch invoices for user %s: %s",
            user.id,
            e,
            extra={"user_id": user.id},
        )
        return []


# ─── Cancel Subscription ──────────────────────────────────

@router.post("/retention-offer/impression", response_model=RetentionOfferImpressionOut)
def record_retention_offer_impression(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Impression tracking endpoint intentionally does not increment counters.
    # Retention count increases only when the user accepts the discount.
    return RetentionOfferImpressionOut(
        recorded=False,
        shown_count=user.retention_offer_shown_count or 0,
        eligible=_is_retention_offer_eligible(user),
    )


@router.post("/retention-offer/accept", response_model=RetentionOfferAcceptOut)
def accept_retention_offer(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _is_retention_offer_eligible(user):
        raise HTTPException(status_code=409, detail="Retention offer is no longer available")
    retention_coupon_id = settings.STRIPE_RETENTION_COUPON_ID
    if not retention_coupon_id:
        raise HTTPException(status_code=400, detail="Retention coupon is not configured")

    try:
        logger.info(
            "[RETENTION] accept_retention_offer user=%s sub=%s shown_count=%s suppressed=%s coupon=%s",
            user.id,
            user.stripe_subscription_id,
            user.retention_offer_shown_count,
            user.retention_offer_suppressed,
            retention_coupon_id,
        )
        try:
            stripe_sub = stripe.Subscription.retrieve(
                user.stripe_subscription_id,
                expand=[
                    "discount",
                    "discount.coupon",
                    "discounts",
                ],
            )
        except stripe.error.InvalidRequestError:
            # Fall back for Stripe API versions that reject expand paths.
            stripe_sub = stripe.Subscription.retrieve(user.stripe_subscription_id)
        logger.info("[RETENTION] Retrieved subscription from Stripe")

        if _subscription_has_retention_coupon(stripe_sub, retention_coupon_id) or _upcoming_invoice_has_retention_coupon(
            user, retention_coupon_id
        ):
            logger.info("[RETENTION] Coupon already applied; returning already_applied")
            return RetentionOfferAcceptOut(
                status="already_applied",
                message="This discount is already applied to your next month billing invoice.",
            )

        existing_discounts_payload: list[dict[str, str]] = []
        discounts = getattr(stripe_sub, "discounts", None)
        discount_items = getattr(discounts, "data", []) if discounts is not None else []
        if not discount_items:
            legacy = getattr(stripe_sub, "discount", None)
            if legacy is None and isinstance(stripe_sub, dict):
                legacy = stripe_sub.get("discount")
            if legacy:
                discount_items = [legacy]

        for discount in discount_items:
            coupon = getattr(discount, "coupon", None)
            promotion_code = getattr(discount, "promotion_code", None)

            coupon_id = getattr(coupon, "id", None) if coupon is not None else None
            if not coupon_id and isinstance(coupon, dict):
                coupon_id = coupon.get("id")

            if coupon_id:
                existing_discounts_payload.append({"coupon": coupon_id})
                continue

            promotion_code_id = (
                getattr(promotion_code, "id", None) if promotion_code is not None else None
            )
            if not promotion_code_id and isinstance(promotion_code, dict):
                promotion_code_id = promotion_code.get("id")
            if promotion_code_id:
                existing_discounts_payload.append({"promotion_code": promotion_code_id})

        stripe.Subscription.modify(
            user.stripe_subscription_id,
            discounts=[*existing_discounts_payload, {"coupon": retention_coupon_id}],
        )
        logger.info("[RETENTION] Applied coupon on Stripe subscription.modify")
        user.retention_offer_shown_count = min(
            MAX_RETENTION_OFFER_SHOWS,
            (user.retention_offer_shown_count or 0) + 1,
        )
        db.commit()
        logger.info(
            "[RETENTION] Incremented shown_count to %s after apply",
            user.retention_offer_shown_count,
        )

        return RetentionOfferAcceptOut(
            status="applied",
            message="30% discount applied to your next invoice",
        )
    except stripe.error.InvalidRequestError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancel")
def cancel_subscription(
    body: CancelSubscriptionRequest = CancelSubscriptionRequest(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel the user's active subscription at the end of the billing period."""
    if not user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")

    try:
        # Cancel at period end (user keeps access until then)
        stripe.Subscription.modify(
            user.stripe_subscription_id,
            cancel_at_period_end=True,
        )

        if body.declined_retention_offer:
            user.retention_offer_suppressed = True
            db.commit()

        return {"status": "ok", "message": "Subscription will cancel at the end of the billing period"}
    except stripe.error.InvalidRequestError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Resume Subscription (undo cancel) ────────────────────

@router.post("/resume")
def resume_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resume a subscription that was set to cancel at period end."""
    if not user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No subscription to resume")

    try:
        stripe.Subscription.modify(
            user.stripe_subscription_id,
            cancel_at_period_end=False,
        )
        return {"status": "ok", "message": "Subscription resumed"}
    except stripe.error.InvalidRequestError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Data Export ───────────────────────────────────────────

class DataSummaryOut(BaseModel):
    total_projects: int
    total_videos_rendered: int
    total_assets: int
    account_created: str
    plan: str


@router.get("/data-summary", response_model=DataSummaryOut)
def get_data_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a summary of the user's data for the subscription page."""
    from app.models.asset import Asset

    total_projects = db.query(Project).filter(Project.user_id == user.id).count()
    total_videos_rendered = (
        db.query(Project)
        .filter(Project.user_id == user.id, Project.r2_video_url.isnot(None))
        .count()
    )
    total_assets = (
        db.query(Asset)
        .join(Project, Asset.project_id == Project.id)
        .filter(Project.user_id == user.id)
        .count()
    )

    return DataSummaryOut(
        total_projects=total_projects,
        total_videos_rendered=total_videos_rendered,
        total_assets=total_assets,
        account_created=user.created_at.isoformat(),
        plan=user.plan.value,
    )


# ─── Stripe Webhook ───────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Handle Stripe webhook events for subscription lifecycle.
    This endpoint is NOT authenticated -- Stripe signs the payload.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]
    # Fix for Stripe SDK v3+: convert StripeObject to plain dict so .get() works
    if hasattr(data, "to_dict"):
        data = data.to_dict()

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data, db)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data, db)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data, db)
    elif event_type == "invoice.paid":
        _handle_invoice_paid(data, db)
    elif event_type == "invoice.payment_failed":
        _handle_invoice_payment_failed(data, db)
    elif event_type == "invoice.payment_action_required":
        _handle_payment_action_required(data, db)
    elif event_type == "payment_intent.payment_failed":
        _handle_payment_intent_failed(data, db)
    elif event_type == "charge.dispute.created":
        _handle_dispute_created(data, db)
    elif event_type == "charge.refunded":
        _handle_charge_refunded(data, db)
    else:
        logger.warning("[BILLING] Unhandled webhook event: %s", event_type)

    return {"status": "ok"}


# ─── Webhook handlers ─────────────────────────────────────

def _handle_checkout_completed(session: dict, db: Session):
    customer_id = session.get("customer")
    metadata = session.get("metadata", {})
    checkout_type = metadata.get("type", "pro_subscription")
    session_id = session.get("id")

    # Idempotency: Stripe delivers webhooks at-least-once. If we've already created a
    # Subscription row for this checkout session, this is a redelivery — do not re-grant.
    if session_id:
        already = db.query(Subscription).filter_by(
            stripe_checkout_session_id=session_id
        ).first()
        if already:
            logger.info("[BILLING] Duplicate checkout webhook for session %s — skipping", session_id)
            return

    if checkout_type == "per_video":
        # One-time per-video payment
        project_id = metadata.get("project_id")
        user_id = metadata.get("user_id")
        plan = db.query(SubscriptionPlan).filter_by(slug="per_video").first()

        # Per-video credits expire 1 month from purchase
        now = datetime.utcnow()
        credit_expiry = now + timedelta(days=30)

        if project_id:
            # Unlock studio for the specific project
            project = db.query(Project).filter(Project.id == int(project_id)).first()
            if project:
                project.studio_unlocked = True

                if plan and user_id:
                    sub = Subscription(
                        user_id=int(user_id),
                        plan_id=plan.id,
                        status=SubscriptionStatus.COMPLETED,
                        stripe_checkout_session_id=session_id,
                        project_id=int(project_id),
                        amount_paid_cents=plan.price_cents,
                        videos_used=1,
                        current_period_start=now,
                        current_period_end=credit_expiry,
                    )
                    db.add(sub)

                db.commit()
                logger.info(
                    "[BILLING] Per-video purchase: unlocked studio for project %s, credit expires %s",
                    project_id,
                    credit_expiry.date(),
                    extra={"project_id": int(project_id), "user_id": int(user_id) if user_id else None},
                )
        elif user_id:
            # No project — this is a video credit purchase (from Pricing page)
            try:
                qty = max(1, int(metadata.get("qty", "1")))
            except (TypeError, ValueError):
                qty = 1
            amount_total = session.get("amount_total")  # cents paid, incl. discounts
            amount_paid_cents = (
                int(amount_total)
                if amount_total is not None
                else (plan.price_cents * qty if plan else 0)
            )

            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user.video_limit_bonus = getattr(user, "video_limit_bonus", 0) + qty

                if plan:
                    sub = Subscription(
                        user_id=int(user_id),
                        plan_id=plan.id,
                        status=SubscriptionStatus.COMPLETED,
                        stripe_checkout_session_id=session_id,
                        amount_paid_cents=amount_paid_cents,
                        quantity=qty,
                        videos_used=0,
                        current_period_start=now,
                        current_period_end=credit_expiry,
                    )
                    db.add(sub)

                db.commit()
                logger.info(
                    "[BILLING] Per-video credits purchased: user=%s qty=%s expires=%s new_bonus=%s",
                    user_id,
                    qty,
                    credit_expiry.date(),
                    user.video_limit_bonus,
                    extra={"user_id": int(user_id), "qty": qty},
                )
    elif checkout_type == "bulk_500":
        # One-time $300 purchase → +500 video credits that NEVER expire.
        # Recorded as a per_video Subscription row with current_period_end=None,
        # so _count_active_per_video_credits keeps counting them until consumed.
        user_id = metadata.get("user_id")
        try:
            qty = max(1, int(metadata.get("qty", str(BULK_500_CREDITS))))
        except (TypeError, ValueError):
            qty = BULK_500_CREDITS
        plan = db.query(SubscriptionPlan).filter_by(slug="per_video").first()
        now = datetime.utcnow()
        user = db.query(User).filter(User.id == int(user_id)).first() if user_id else None
        if user:
            user.video_limit_bonus = getattr(user, "video_limit_bonus", 0) + qty
            if plan:
                sub = Subscription(
                    user_id=user.id,
                    plan_id=plan.id,
                    status=SubscriptionStatus.COMPLETED,
                    stripe_checkout_session_id=session_id,
                    amount_paid_cents=session.get("amount_total") or 0,
                    quantity=qty,
                    videos_used=0,
                    current_period_start=now,
                    current_period_end=None,  # never expires — consumed as videos are made
                )
                db.add(sub)
            db.commit()
            logger.info(
                "[BILLING] Bulk 500-credit pack purchased: user=%s qty=%s new_bonus=%s",
                user_id,
                qty,
                user.video_limit_bonus,
                extra={"user_id": int(user_id), "qty": qty},
            )
    elif checkout_type == "custom_template":
        # One-time $5 purchase → +1 lifetime custom-template slot (never expires).
        user_id = metadata.get("user_id")
        plan = db.query(SubscriptionPlan).filter_by(slug="custom_template").first()
        now = datetime.utcnow()
        user = db.query(User).filter(User.id == int(user_id)).first() if user_id else None
        if user:
            user.custom_template_bonus = (user.custom_template_bonus or 0) + 1
            if plan:
                sub = Subscription(
                    user_id=user.id,
                    plan_id=plan.id,
                    status=SubscriptionStatus.COMPLETED,
                    stripe_checkout_session_id=session_id,
                    amount_paid_cents=session.get("amount_total") or plan.price_cents,
                    quantity=1,
                    videos_used=0,
                    current_period_start=now,
                    current_period_end=None,  # lifetime — slot never expires
                )
                db.add(sub)
            db.commit()
            logger.info(
                "[BILLING] Custom-template slot purchased: user=%s new_bonus=%s",
                user_id,
                user.custom_template_bonus,
                extra={"user_id": int(user_id)},
            )
    elif checkout_type in ("standard_lifetime", "pro_lifetime"):
        # One-time lifetime payment (mode="payment", no recurring subscription).
        # Grants the tier permanently — monthly allotment refreshes via the lazy
        # reset in User.roll_video_period_if_due (no Stripe invoice to reset it).
        user_id = metadata.get("user_id")
        user = db.query(User).filter(User.id == int(user_id)).first() if user_id else None
        now = datetime.utcnow()
        if user:
            if checkout_type == "standard_lifetime":
                plan_slug = "standard_lifetime"
                user.plan = PlanTier.STANDARD
            else:
                plan_slug = "pro_lifetime"
                user.plan = PlanTier.PRO
            # Lifetime has no recurring Stripe subscription.
            user.stripe_subscription_id = None
            user.videos_used_this_period = 0
            user.period_start = now

            # Drop any free grants, keep paid per-video credits — same as the
            # recurring-subscription path.
            _recalculate_video_limit_bonus(user, db)

            plan = db.query(SubscriptionPlan).filter_by(slug=plan_slug).first()
            if plan:
                # Supersede any existing active recurring Subscription row so the
                # in-app "current plan" reflects lifetime. The user's recurring
                # Stripe subscription itself is NOT auto-cancelled here.
                db.query(Subscription).filter(
                    Subscription.user_id == user.id,
                    Subscription.status == SubscriptionStatus.ACTIVE,
                ).update({"status": SubscriptionStatus.CANCELED, "canceled_at": now})

                sub = Subscription(
                    user_id=user.id,
                    plan_id=plan.id,
                    status=SubscriptionStatus.COMPLETED,
                    stripe_subscription_id=None,
                    stripe_checkout_session_id=session_id,
                    amount_paid_cents=session.get("amount_total") or plan.price_cents,
                    current_period_start=now,
                    current_period_end=None,  # lifetime — never expires
                )
                db.add(sub)

            db.commit()
            logger.info(
                "[BILLING] Lifetime purchase: user=%s plan=%s",
                user_id,
                plan_slug,
                extra={"user_id": int(user_id)},
            )
    else:
        # ── Pro or Standard subscription checkout ───────────────────────────
        subscription_id = session.get("subscription")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            billing_cycle = metadata.get("billing_cycle", "monthly")
            if checkout_type == "standard_subscription":
                plan_slug = "standard_annual" if billing_cycle == "annual" else "standard_monthly"
                user.plan = PlanTier.STANDARD
            else:
                plan_slug = "pro_annual" if billing_cycle == "annual" else "pro_monthly"
                user.plan = PlanTier.PRO
            user.stripe_subscription_id = subscription_id
            user.videos_used_this_period = 0
            user.period_start = datetime.utcnow()

            # Strip free grants from video_limit_bonus — only keep paid per-video
            # credits that haven't expired. Adjust videos_used_this_period to
            # account for any removed free grants so the user doesn't gain
            # phantom headroom from credits they didn't pay for.
            _recalculate_video_limit_bonus(user, db)

            plan = db.query(SubscriptionPlan).filter_by(slug=plan_slug).first()
            if plan:
                db.query(Subscription).filter(
                    Subscription.user_id == user.id,
                    Subscription.status == SubscriptionStatus.ACTIVE,
                ).update({"status": SubscriptionStatus.CANCELED, "canceled_at": datetime.utcnow()})

                sub = Subscription(
                    user_id=user.id,
                    plan_id=plan.id,
                    status=SubscriptionStatus.ACTIVE,
                    stripe_subscription_id=subscription_id,
                    stripe_checkout_session_id=session_id,
                    current_period_start=datetime.utcnow(),
                    amount_paid_cents=plan.price_cents,
                )
                db.add(sub)

            db.commit()


def _handle_subscription_updated(subscription_data: dict, db: Session):
    """Handle plan changes."""
    customer_id = subscription_data.get("customer")
    status = subscription_data.get("status")
    stripe_sub_id = subscription_data.get("id")
    cancel_at_period_end = bool(subscription_data.get("cancel_at_period_end"))
    cancel_at_ts = subscription_data.get("cancel_at")  # Unix timestamp when it will cancel, if set

    # Extract the price id of the current subscription item (used to detect plan switches).
    incoming_price_id: str | None = None
    try:
        items = subscription_data.get("items") or {}
        item_data = items.get("data") if isinstance(items, dict) else None
        if item_data:
            price_obj = item_data[0].get("price") if isinstance(item_data[0], dict) else None
            if isinstance(price_obj, dict):
                incoming_price_id = price_obj.get("id")
            elif price_obj is not None:
                incoming_price_id = getattr(price_obj, "id", None)
    except Exception:
        incoming_price_id = None

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        if status in ("canceled", "unpaid", "past_due"):
            was_paid = user.plan in (PlanTier.STANDARD, PlanTier.PRO)
            user.plan = PlanTier.FREE
            # Downgrading a paid user to FREE must not hand them fresh free quota they
            # already consumed pre-upgrade. Cap usage at the included free count so the
            # free tier shows 0 remaining (mirrors the delete-account flow in auth.py).
            if was_paid and (user.videos_used_this_period or 0) < FREE_TIER_INCLUDED_VIDEOS:
                user.videos_used_this_period = FREE_TIER_INCLUDED_VIDEOS
        # For active/trialing, set plan from existing Subscription record so we don't overwrite Standard with Pro

        # Update the Subscription record
        sub = db.query(Subscription).filter_by(
            stripe_subscription_id=stripe_sub_id
        ).first()
        if sub:
            # Detect a price-id change (e.g. a scheduled downgrade firing on renewal,
            # or a portal-initiated plan switch). Reconcile sub.plan_id from the new price.
            if (
                incoming_price_id
                and sub.plan
                and incoming_price_id != sub.plan.stripe_price_id
            ):
                new_plan = (
                    db.query(SubscriptionPlan)
                    .filter_by(stripe_price_id=incoming_price_id)
                    .first()
                )
                if new_plan:
                    was_scheduled_downgrade = (
                        sub.scheduled_plan_id is not None
                        and sub.scheduled_plan_id == new_plan.id
                    )
                    sub.plan_id = new_plan.id
                    sub.scheduled_plan_id = None
                    sub.scheduled_change_at = None
                    sub.stripe_schedule_id = None
                    if was_scheduled_downgrade:
                        user.videos_used_this_period = 0
                        user.period_start = datetime.utcnow()

            if status in ("active", "trialing") and sub.plan and sub.plan.slug.startswith("standard"):
                user.plan = PlanTier.STANDARD
            elif status in ("active", "trialing") and sub.plan and sub.plan.slug.startswith("pro"):
                user.plan = PlanTier.PRO
            if status in ("active", "trialing"):
                sub.status = SubscriptionStatus.ACTIVE
            elif status == "past_due":
                sub.status = SubscriptionStatus.PAST_DUE
            elif status in ("canceled", "unpaid"):
                sub.status = SubscriptionStatus.CANCELED
                sub.canceled_at = datetime.utcnow()

            # Update period from Stripe data
            period_start = subscription_data.get("current_period_start")
            period_end = subscription_data.get("current_period_end")
            if period_start:
                sub.current_period_start = datetime.utcfromtimestamp(period_start)
            if period_end:
                sub.current_period_end = datetime.utcfromtimestamp(period_end)

            if status in ("active", "trialing"):
                if cancel_at_period_end:
                    
                    if cancel_at_ts:
                        sub.canceled_at = datetime.utcfromtimestamp(cancel_at_ts)
                    elif sub.current_period_end:
                        sub.canceled_at = sub.current_period_end
                else:
                    
                    sub.canceled_at = None

        db.commit()


def _handle_subscription_deleted(subscription_data: dict, db: Session):
    """Downgrade to free when subscription is canceled."""
    customer_id = subscription_data.get("customer")
    stripe_sub_id = subscription_data.get("id")

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        was_paid = user.plan in (PlanTier.STANDARD, PlanTier.PRO)
        user.plan = PlanTier.FREE
        user.stripe_subscription_id = None
        # Don't let a downgraded paid user regain already-consumed free quota; cap usage
        # at the included free count (mirrors the delete-account flow in auth.py).
        if was_paid and (user.videos_used_this_period or 0) < FREE_TIER_INCLUDED_VIDEOS:
            user.videos_used_this_period = FREE_TIER_INCLUDED_VIDEOS

        # Mark the Subscription record as canceled
        sub = db.query(Subscription).filter_by(
            stripe_subscription_id=stripe_sub_id
        ).first()
        if sub:
            sub.status = SubscriptionStatus.CANCELED
            sub.canceled_at = datetime.utcnow()

        db.commit()


def _handle_invoice_paid(invoice: dict, db: Session):
    """Reset usage counter on new billing period.
    Also recalculates video_limit_bonus so that any per-video credits that
    have since expired are dropped from the bonus count.
    """
    customer_id = invoice.get("customer")
    stripe_sub_id = invoice.get("subscription")

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.videos_used_this_period = 0
        user.period_start = datetime.utcnow()

        # Recount non-expired per-video credits so expired ones fall off naturally.
        # We do a clean recalc here rather than just stripping — the period reset
        # means videos_used is already 0, so no delta adjustment is needed.
        new_bonus = _count_active_per_video_credits(user.id, db)
        if user.video_limit_bonus != new_bonus:
            print(
                f"[BILLING] invoice.paid: recalculated video_limit_bonus for user {user.id}: "
                f"{user.video_limit_bonus} → {new_bonus} (expired credits dropped)"
            )
        user.video_limit_bonus = new_bonus

        # Referral bonus resets each billing period — users earn it once per cycle.
        if user.referral_video_bonus:
            print(
                f"[BILLING] invoice.paid: referral_video_bonus reset for user {user.id}: "
                f"{user.referral_video_bonus} → 0"
            )
        user.referral_video_bonus = 0

        # Reset usage on the Subscription record too
        if stripe_sub_id:
            sub = db.query(Subscription).filter_by(
                stripe_subscription_id=stripe_sub_id
            ).first()
            if sub:
                sub.videos_used = 0
                period_start = invoice.get("period_start")
                period_end = invoice.get("period_end")
                if period_start:
                    sub.current_period_start = datetime.utcfromtimestamp(period_start)
                if period_end:
                    sub.current_period_end = datetime.utcfromtimestamp(period_end)

        db.commit()


def _handle_invoice_payment_failed(invoice: dict, db: Session):
    """
    Handle failed recurring payment (card declined, insufficient funds, etc).
    Mark the subscription as past_due so the frontend can prompt the user.
    """
    customer_id = invoice.get("customer")
    stripe_sub_id = invoice.get("subscription")
    print(f"[BILLING] Invoice payment failed for customer={customer_id}, sub={stripe_sub_id}")

    if not stripe_sub_id:
        return

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user:
        return

    sub = db.query(Subscription).filter_by(stripe_subscription_id=stripe_sub_id).first()
    if sub:
        sub.status = SubscriptionStatus.PAST_DUE
        db.commit()
        print(f"[BILLING] Subscription {stripe_sub_id} marked past_due for user {user.id}")


def _handle_payment_action_required(invoice: dict, db: Session):
    """
    Handle 3D Secure / SCA authentication required (common for Indian cards).
    The hosted_invoice_url lets the user complete authentication.
    We mark the subscription as requires_action so the frontend can show a prompt.
    """
    customer_id = invoice.get("customer")
    stripe_sub_id = invoice.get("subscription")
    hosted_url = invoice.get("hosted_invoice_url")
    print(f"[BILLING] Payment action required for customer={customer_id}, url={hosted_url}")

    if not stripe_sub_id:
        return

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user:
        return

    sub = db.query(Subscription).filter_by(stripe_subscription_id=stripe_sub_id).first()
    if sub:
        sub.status = SubscriptionStatus.REQUIRES_ACTION
        db.commit()
        print(f"[BILLING] Subscription {stripe_sub_id} requires_action for user {user.id}")


def _handle_payment_intent_failed(payment_intent: dict, db: Session):
    """
    Handle a PaymentIntent failure (one-time or subscription payment failed at intent level).
    Log it for debugging — the invoice.payment_failed handler covers subscription failures.
    """
    pi_id = payment_intent.get("id")
    customer_id = payment_intent.get("customer")
    last_error = payment_intent.get("last_payment_error", {})
    decline_code = last_error.get("decline_code", "unknown")
    message = last_error.get("message", "No message")
    print(f"[BILLING] PaymentIntent {pi_id} failed for customer={customer_id}: {decline_code} - {message}")


def _handle_dispute_created(dispute: dict, db: Session):
    """
    Handle a chargeback / dispute. Immediately downgrade the user to free
    to prevent abuse while the dispute is being resolved.
    """
    charge_id = dispute.get("charge")
    reason = dispute.get("reason", "unknown")
    print(f"[BILLING] Dispute created for charge={charge_id}, reason={reason}")

    # Try to find the customer from the charge
    try:
        charge = stripe.Charge.retrieve(charge_id)
        customer_id = charge.get("customer")
    except Exception as e:
        print(f"[BILLING] Could not retrieve charge {charge_id}: {e}")
        return

    if not customer_id:
        return

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user:
        return

    # Downgrade to free plan during dispute. video_limit derives from plan via a
    # read-only property, so we only need to set the plan tier.
    user.plan = PlanTier.FREE
    db.commit()
    print(f"[BILLING] User {user.id} downgraded to free due to dispute")


def _handle_charge_refunded(charge: dict, db: Session):
    """
    Handle a refund. If it's a full refund on a subscription payment,
    log it. Partial refunds are just logged.
    """
    charge_id = charge.get("id")
    customer_id = charge.get("customer")
    amount_refunded = charge.get("amount_refunded", 0)
    amount = charge.get("amount", 0)
    is_full_refund = amount_refunded >= amount

    print(f"[BILLING] Charge {charge_id} refunded: {amount_refunded}/{amount} ({'full' if is_full_refund else 'partial'}) for customer={customer_id}")
