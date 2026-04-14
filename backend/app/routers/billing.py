"""
Stripe billing router: checkout sessions, customer portal, webhooks.
Supports both Pro subscription ($50/mo) and per-video purchase ($3).
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
import stripe

from app.config import settings
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User, PlanTier
from app.models.project import Project
from app.models.subscription import (
    Subscription, SubscriptionStatus, SubscriptionPlan,
)
from app.observability.logging import get_logger

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/api/billing", tags=["billing"])
logger = get_logger(__name__)
MAX_RETENTION_OFFER_SHOWS = 2


class CheckoutResponse(BaseModel):
    checkout_url: str


class PerVideoCheckoutRequest(BaseModel):
    project_id: int | None = None  # Optional: if None, buys a video credit


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
    Count per-video Subscription records for a user that are COMPLETED and
    not yet expired (current_period_end is in the future or not set).

    These are the only credits that should contribute to video_limit_bonus.
    Free grants given manually (directly setting video_limit_bonus in the DB)
    are NOT represented here, so they are excluded by this count.
    """
    now = datetime.utcnow()
    per_video_plan = db.query(SubscriptionPlan).filter_by(slug="per_video").first()
    if not per_video_plan:
        return 0

    return (
        db.query(Subscription)
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
        .count()
    )


def _recalculate_video_limit_bonus(user: User, db: Session) -> None:
    """
    Called when a user subscribes to a Pro/Standard plan, or when a plan renews.

    Free grants are consumed first in the usage hierarchy. When a user upgrades
    to a paid plan, free grants are stripped from video_limit_bonus, and any
    videos already used are charged against those grants first — so usage that
    came from free grants disappears along with the grants themselves.

    Formula
    -------
        paid_credits      = count of non-expired per-video Subscription rows
        free_grants       = old_bonus - paid_credits          (≥ 0)
        usage_from_grants = min(videos_used_this_period, free_grants)
        new_videos_used   = max(0, videos_used_this_period - usage_from_grants)
        new_bonus         = paid_credits

    Example
    -------
        video_limit_bonus = 4  (2 free grants + 2 paid credits)
        videos_used_this_period = 2
        Subscribes to Standard (30 videos/month).

        free_grants       = 4 - 2 = 2
        usage_from_grants = min(2, 2) = 2   ← both used videos came from grants
        new_videos_used   = max(0, 2 - 2) = 0
        new_bonus         = 2

        Result: 30 (plan) + 2 (paid credits) = 32 total, 0 used.

    Another example
    ---------------
        video_limit_bonus = 4  (2 free grants + 2 paid credits)
        videos_used_this_period = 3   ← 2 from grants, 1 from paid credit
        Subscribes to Standard (30 videos/month).

        free_grants       = 2
        usage_from_grants = min(3, 2) = 2
        new_videos_used   = max(0, 3 - 2) = 1
        new_bonus         = 2

        Result: 30 + 2 = 32 total, 1 used (the 1 video charged against paid credit).
    """
    old_bonus = getattr(user, "video_limit_bonus", 0) or 0
    videos_used = user.videos_used_this_period or 0
    paid_credits = _count_active_per_video_credits(user.id, db)

    free_grants = max(0, old_bonus - paid_credits)
    usage_from_grants = min(videos_used, free_grants)
    new_videos_used = max(0, videos_used - usage_from_grants)

    user.video_limit_bonus = paid_credits
    user.videos_used_this_period = new_videos_used

    print(
        f"[BILLING] Recalculated video_limit_bonus for user {user.id}: "
        f"old_bonus={old_bonus} (free_grants={free_grants}, paid_credits={paid_credits}), "
        f"videos_used {videos_used} → {new_videos_used} "
        f"({usage_from_grants} absorbed by free grants), "
        f"new video_limit_bonus={paid_credits}"
    )


# ─── Pro / Standard Subscription Checkout ─────────────────

class CheckoutRequest(BaseModel):
    plan: str = "pro"  # "pro" or "standard"
    billing_cycle: str = "monthly"  # "monthly" or "annual"


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_session(
    body: CheckoutRequest = CheckoutRequest(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for Pro or Standard plan."""
    if body.plan == "standard":
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

    session = stripe.checkout.Session.create(
        customer=user.stripe_customer_id,
        mode="subscription",
        line_items=[
            {
                "price": price_id,
                "quantity": 1,
            }
        ],
        allow_promotion_codes=True,
        success_url=f"{settings.FRONTEND_URL}/dashboard?upgraded=true&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/pricing",
        metadata={
            "user_id": str(user.id),
            "type": subscription_type,
            "plan": body.plan,
            "billing_cycle": billing_cycle,
        },
    )

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
    meta = {
        "user_id": str(user.id),
        "type": "per_video",
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

    session = stripe.checkout.Session.create(
        customer=user.stripe_customer_id,
        mode="payment",
        line_items=[
            {
                "price": settings.STRIPE_PER_VIDEO_PRICE_ID,
                "quantity": 1,
            }
        ],
        allow_promotion_codes=True,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=meta,
    )

    return CheckoutResponse(checkout_url=session.url)


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
def get_billing_status(user: User = Depends(get_current_user)):
    """Get the current user's billing/usage status."""
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
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user.video_limit_bonus = getattr(user, "video_limit_bonus", 0) + 1

                if plan:
                    sub = Subscription(
                        user_id=int(user_id),
                        plan_id=plan.id,
                        status=SubscriptionStatus.COMPLETED,
                        stripe_checkout_session_id=session_id,
                        amount_paid_cents=plan.price_cents,
                        videos_used=0,
                        current_period_start=now,
                        current_period_end=credit_expiry,
                    )
                    db.add(sub)

                db.commit()
                logger.info(
                    "[BILLING] Per-video credit purchased for user %s, expires %s, new video_limit_bonus=%s",
                    user_id,
                    credit_expiry.date(),
                    user.video_limit_bonus,
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

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        if status in ("canceled", "unpaid", "past_due"):
            user.plan = PlanTier.FREE
        # For active/trialing, set plan from existing Subscription record so we don't overwrite Standard with Pro

        # Update the Subscription record
        sub = db.query(Subscription).filter_by(
            stripe_subscription_id=stripe_sub_id
        ).first()
        if sub:
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
        user.plan = PlanTier.FREE
        user.stripe_subscription_id = None

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

    # Downgrade to free plan during dispute
    free_plan = db.query(SubscriptionPlan).filter_by(name="free").first()
    if free_plan:
        user.plan = "free"
        user.video_limit = free_plan.video_limit
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
