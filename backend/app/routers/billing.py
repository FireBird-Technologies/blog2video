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


# ─── Pro Subscription Checkout ────────────────────────────

class CheckoutRequest(BaseModel):
    billing_cycle: str = "monthly"  # "monthly" or "annual"


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_session(
    body: CheckoutRequest = CheckoutRequest(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for the Pro plan (monthly or annual)."""
    if user.plan == PlanTier.PRO:
        raise HTTPException(status_code=400, detail="Already on Pro plan")

    # Pick the right price ID based on billing cycle
    if body.billing_cycle == "annual":
        price_id = settings.STRIPE_PRO_ANNUAL_PRICE_ID
        if not price_id:
            raise HTTPException(status_code=400, detail="Annual plan not configured yet")
    else:
        price_id = settings.STRIPE_PRO_PRICE_ID
        if not price_id:
            raise HTTPException(status_code=400, detail="Monthly plan not configured yet")

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
        success_url=f"{settings.FRONTEND_URL}/dashboard?upgraded=true",
        cancel_url=f"{settings.FRONTEND_URL}/pricing",
        metadata={
            "user_id": str(user.id),
            "type": "pro_subscription",
            "billing_cycle": body.billing_cycle,
        },
    )

    return CheckoutResponse(checkout_url=session.url)


# ─── Per-Video Checkout ($5) ──────────────────────────────

@router.post("/checkout-per-video", response_model=CheckoutResponse)
def create_per_video_checkout(
    body: PerVideoCheckoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Checkout session for a single video ($5).
    If project_id is provided, unlocks that specific project.
    If project_id is omitted (e.g. from Pricing page), buys a video credit.
    """
    meta = {
        "user_id": str(user.id),
        "type": "per_video",
    }
    success_url = f"{settings.FRONTEND_URL}/dashboard?purchased=true"
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
        success_url = f"{settings.FRONTEND_URL}/project/{project.id}?purchased=true"
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
    created_at: str

    class Config:
        from_attributes = True


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
        print(f"[BILLING] Failed to fetch invoices: {e}")
        return []


# ─── Cancel Subscription ──────────────────────────────────

@router.post("/cancel")
def cancel_subscription(
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
        print(f"[BILLING] Unhandled webhook event: {event_type}")

    return {"status": "ok"}


# ─── Webhook handlers ─────────────────────────────────────

def _handle_checkout_completed(session: dict, db: Session):
    """Handle successful checkout — either Pro subscription or per-video purchase."""
    customer_id = session.get("customer")
    metadata = session.get("metadata", {})
    checkout_type = metadata.get("type", "pro_subscription")
    session_id = session.get("id")

    if checkout_type == "per_video":
        # One-time per-video payment
        project_id = metadata.get("project_id")
        user_id = metadata.get("user_id")
        plan = db.query(SubscriptionPlan).filter_by(slug="per_video").first()

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
                    )
                    db.add(sub)

                db.commit()
                print(f"[BILLING] Per-video purchase: unlocked studio for project {project_id}")
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
                    )
                    db.add(sub)

                db.commit()
                print(f"[BILLING] Per-video credit purchased for user {user_id}")
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
