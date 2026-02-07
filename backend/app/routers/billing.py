"""
Stripe billing router: checkout sessions, customer portal, webhooks.
Supports both Pro subscription ($50/mo) and per-video purchase ($5).
"""
from datetime import datetime
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

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/api/billing", tags=["billing"])


class CheckoutResponse(BaseModel):
    checkout_url: str


class PerVideoCheckoutRequest(BaseModel):
    project_id: int


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


# ─── Pro Subscription Checkout ────────────────────────────

@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_session(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for the Pro plan."""
    if user.plan == PlanTier.PRO:
        raise HTTPException(status_code=400, detail="Already on Pro plan")

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
                "price": settings.STRIPE_PRO_PRICE_ID,
                "quantity": 1,
            }
        ],
        success_url=f"{settings.FRONTEND_URL}/dashboard?upgraded=true",
        cancel_url=f"{settings.FRONTEND_URL}/pricing",
        metadata={"user_id": str(user.id), "type": "pro_subscription"},
    )

    return CheckoutResponse(checkout_url=session.url)


# ─── Per-Video Checkout ($5) ──────────────────────────────

@router.post("/checkout-per-video", response_model=CheckoutResponse)
def create_per_video_checkout(
    body: PerVideoCheckoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for a single video ($5)."""
    project = (
        db.query(Project)
        .filter(Project.id == body.project_id, Project.user_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.studio_unlocked:
        raise HTTPException(status_code=400, detail="This video is already unlocked")

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
        mode="payment",  # One-time payment
        line_items=[
            {
                "price": settings.STRIPE_PER_VIDEO_PRICE_ID,
                "quantity": 1,
            }
        ],
        success_url=f"{settings.FRONTEND_URL}/project/{project.id}?purchased=true",
        cancel_url=f"{settings.FRONTEND_URL}/project/{project.id}",
        metadata={
            "user_id": str(user.id),
            "project_id": str(project.id),
            "type": "per_video",
        },
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
        return_url=f"{settings.FRONTEND_URL}/dashboard",
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

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data, db)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data, db)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data, db)
    elif event_type == "invoice.paid":
        _handle_invoice_paid(data, db)

    return {"status": "ok"}


# ─── Webhook handlers ─────────────────────────────────────

def _handle_checkout_completed(session: dict, db: Session):
    """Handle successful checkout — either Pro subscription or per-video purchase."""
    customer_id = session.get("customer")
    metadata = session.get("metadata", {})
    checkout_type = metadata.get("type", "pro_subscription")
    session_id = session.get("id")

    if checkout_type == "per_video":
        # One-time per-video payment — unlock studio for the specific project
        project_id = metadata.get("project_id")
        user_id = metadata.get("user_id")
        if project_id:
            project = db.query(Project).filter(Project.id == int(project_id)).first()
            if project:
                project.studio_unlocked = True

                # Record the subscription/purchase
                plan = db.query(SubscriptionPlan).filter_by(slug="per_video").first()
                if plan and user_id:
                    sub = Subscription(
                        user_id=int(user_id),
                        plan_id=plan.id,
                        status=SubscriptionStatus.COMPLETED,
                        stripe_checkout_session_id=session_id,
                        project_id=int(project_id),
                        amount_paid_cents=plan.price_cents,
                        videos_used=1,
                    )
                    db.add(sub)

                db.commit()
                print(f"[BILLING] Per-video purchase: unlocked studio for project {project_id}")
    else:
        # Pro subscription checkout
        subscription_id = session.get("subscription")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.plan = PlanTier.PRO
            user.stripe_subscription_id = subscription_id
            user.videos_used_this_period = 0
            user.period_start = datetime.utcnow()

            # Record the subscription
            plan = db.query(SubscriptionPlan).filter_by(slug="pro_monthly").first()
            if plan:
                # Deactivate any previous active subscription for this user
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

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        if status in ("active", "trialing"):
            user.plan = PlanTier.PRO
        elif status in ("canceled", "unpaid", "past_due"):
            user.plan = PlanTier.FREE

        # Update the Subscription record
        sub = db.query(Subscription).filter_by(
            stripe_subscription_id=stripe_sub_id
        ).first()
        if sub:
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
    """Reset usage counter on new billing period."""
    customer_id = invoice.get("customer")
    stripe_sub_id = invoice.get("subscription")

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.videos_used_this_period = 0
        user.period_start = datetime.utcnow()

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
