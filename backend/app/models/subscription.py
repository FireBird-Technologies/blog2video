"""
Subscription plan & subscriber models.

SubscriptionPlan  — defines the available plans (Free, Per-Video, Pro Monthly, Pro Annual)
Subscription      — tracks a user's active/past subscriptions and per-video purchases
"""
import enum
from datetime import datetime
from sqlalchemy import (
    String, Text, Enum, DateTime, ForeignKey,
    Integer, Boolean, Float, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


# ─── Plan Definitions ──────────────────────────────────────

class BillingInterval(str, enum.Enum):
    ONE_TIME = "one_time"
    MONTHLY = "monthly"
    ANNUAL = "annual"


class SubscriptionPlan(Base):
    """
    Canonical source of truth for every purchasable plan.
    Seeded on app startup — never deleted, only soft-updated.
    """
    __tablename__ = "subscription_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pricing
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g. 5_00 = $5
    currency: Mapped[str] = mapped_column(String(3), default="usd")
    billing_interval: Mapped[BillingInterval] = mapped_column(
        Enum(BillingInterval), nullable=False
    )

    # Limits & features
    video_limit: Mapped[int] = mapped_column(Integer, default=0)
    # -1 means "per-purchase" (1 video unlocked per payment)
    # 0  means "no videos included" (shouldn't happen)
    # N  means "N videos per period"

    includes_studio: Mapped[bool] = mapped_column(Boolean, default=False)
    includes_chat_editor: Mapped[bool] = mapped_column(Boolean, default=False)
    includes_priority_support: Mapped[bool] = mapped_column(Boolean, default=False)

    # Stripe mapping
    stripe_price_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)

    # Display
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="plan", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<SubscriptionPlan {self.slug} ${self.price_cents / 100:.2f}/{self.billing_interval.value}>"


# ─── Subscriptions / Purchases ─────────────────────────────

class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    EXPIRED = "expired"
    COMPLETED = "completed"  # one-time purchases that are fulfilled


class Subscription(Base):
    """
    Tracks every purchase or subscription a user makes.
    - One-time ($5 per-video): status goes straight to COMPLETED after payment.
    - Recurring (Pro monthly/annual): status tracks the Stripe subscription lifecycle.
    """
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("subscription_plans.id"), nullable=False, index=True)

    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE
    )

    # Stripe references
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # For per-video purchases — links to the specific project
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)

    # Billing period (for recurring)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Usage tracking (for recurring plans with video limits)
    videos_used: Mapped[int] = mapped_column(Integer, default=0)

    # Payment
    amount_paid_cents: Mapped[int] = mapped_column(Integer, default=0)

    canceled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="subscriptions")
    plan: Mapped["SubscriptionPlan"] = relationship("SubscriptionPlan", back_populates="subscriptions")

    def __repr__(self) -> str:
        return f"<Subscription #{self.id} user={self.user_id} plan={self.plan_id} status={self.status.value}>"


# ─── Seed data ─────────────────────────────────────────────

SEED_PLANS = [
    {
        "slug": "free",
        "name": "Free",
        "description": "Get started with 1 free video",
        "price_cents": 0,
        "billing_interval": BillingInterval.ONE_TIME,
        "video_limit": 1,
        "includes_studio": False,
        "includes_chat_editor": False,
        "includes_priority_support": False,
        "stripe_price_id": None,
        "sort_order": 0,
    },
    {
        "slug": "per_video",
        "name": "Per Video",
        "description": "Pay $5 per video — includes Studio access",
        "price_cents": 500,
        "billing_interval": BillingInterval.ONE_TIME,
        "video_limit": -1,  # 1 video per purchase
        "includes_studio": True,
        "includes_chat_editor": False,
        "includes_priority_support": False,
        "stripe_price_id": None,  # Set from STRIPE_PER_VIDEO_PRICE_ID
        "sort_order": 1,
    },
    {
        "slug": "pro_monthly",
        "name": "Pro Monthly",
        "description": "100 videos/month with all features",
        "price_cents": 5000,
        "billing_interval": BillingInterval.MONTHLY,
        "video_limit": 100,
        "includes_studio": True,
        "includes_chat_editor": True,
        "includes_priority_support": True,
        "stripe_price_id": None,  # Set from STRIPE_PRO_PRICE_ID
        "sort_order": 2,
    },
    {
        "slug": "pro_annual",
        "name": "Pro Annual",
        "description": "100 videos/month — save 20% with annual billing",
        "price_cents": 4000,  # $40/mo effective
        "billing_interval": BillingInterval.ANNUAL,
        "video_limit": 100,
        "includes_studio": True,
        "includes_chat_editor": True,
        "includes_priority_support": True,
        "stripe_price_id": None,  # Set from STRIPE_PRO_ANNUAL_PRICE_ID if added
        "sort_order": 3,
    },
]


def seed_plans(db_session) -> None:
    """Insert or update seed plans. Safe to call on every startup."""
    from app.config import settings

    # Map config price IDs to plan slugs
    _stripe_ids = {
        "per_video": settings.STRIPE_PER_VIDEO_PRICE_ID or None,
        "pro_monthly": settings.STRIPE_PRO_PRICE_ID or None,
    }

    for plan_data in SEED_PLANS:
        slug = plan_data["slug"]
        existing = db_session.query(SubscriptionPlan).filter_by(slug=slug).first()

        # Override stripe_price_id from config if available
        if slug in _stripe_ids and _stripe_ids[slug]:
            plan_data["stripe_price_id"] = _stripe_ids[slug]

        if existing:
            # Update mutable fields (price, features, stripe id)
            for key in ("price_cents", "stripe_price_id", "includes_studio",
                        "includes_chat_editor", "includes_priority_support",
                        "video_limit", "description", "name", "sort_order"):
                setattr(existing, key, plan_data[key])
        else:
            db_session.add(SubscriptionPlan(**plan_data))

    db_session.commit()
