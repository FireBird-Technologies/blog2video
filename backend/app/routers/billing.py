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

    if checkout_type == "per_video":
        # One-time per-video payment — unlock studio for the specific project
        project_id = metadata.get("project_id")
        user_id = metadata.get("user_id")
        if project_id:
            project = db.query(Project).filter(Project.id == int(project_id)).first()
            if project:
                project.studio_unlocked = True
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
            db.commit()


def _handle_subscription_updated(subscription: dict, db: Session):
    """Handle plan changes."""
    customer_id = subscription.get("customer")
    status = subscription.get("status")

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        if status in ("active", "trialing"):
            user.plan = PlanTier.PRO
        elif status in ("canceled", "unpaid", "past_due"):
            user.plan = PlanTier.FREE
        db.commit()


def _handle_subscription_deleted(subscription: dict, db: Session):
    """Downgrade to free when subscription is canceled."""
    customer_id = subscription.get("customer")

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.plan = PlanTier.FREE
        user.stripe_subscription_id = None
        db.commit()


def _handle_invoice_paid(invoice: dict, db: Session):
    """Reset usage counter on new billing period."""
    customer_id = invoice.get("customer")

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.videos_used_this_period = 0
        user.period_start = datetime.utcnow()
        db.commit()
