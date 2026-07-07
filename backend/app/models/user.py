import enum
from datetime import datetime, timedelta
from sqlalchemy import String, Enum, DateTime, Integer, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, Session
from app.database import Base


class PlanTier(str, enum.Enum):
    FREE = "free"
    STANDARD = "standard"
    PRO = "pro"


# Included videos for plan FREE (before video_limit_bonus). Used for limits and delete-account capping.
FREE_TIER_INCLUDED_VIDEOS = 2


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    picture: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    google_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    # Subscription
    plan: Mapped[PlanTier] = mapped_column(Enum(PlanTier), default=PlanTier.FREE)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    videos_used_this_period: Mapped[int] = mapped_column(Integer, default=0)
    video_limit_bonus: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # per-video credits purchased
    custom_template_bonus: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # +1 custom-template slot per $5 purchase
    custom_templates_created: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # lifetime counter, never decrements
    retention_offer_shown_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    retention_offer_suppressed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    period_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    email_unsubscribed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    # Last time we sent a post-checkout win-back coupon email; used to dedup
    # the abandoned-checkout email when a user spawns several Stripe sessions.
    last_coupon_email_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Lifetime referral counter — never reset on delete/reactivate so the cap cannot be bypassed
    referrals_given: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Permanent referral bonus videos (separate from expiring per-video purchase credits)
    referral_video_bonus: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    free_templates_downloaded: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Remembered narration emotion/tone default, auto-selected in the create form next time.
    preferred_voice_emotion: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")
    custom_templates = relationship("CustomTemplate", back_populates="user", cascade="all, delete-orphan")
    saved_voices = relationship("SavedVoice", back_populates="user", cascade="all, delete-orphan")
    custom_voices = relationship("CustomVoice", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    template_ratings = relationship("TemplateRating", back_populates="user", cascade="all, delete-orphan")
    brand_kits = relationship("BrandKit", back_populates="user", cascade="all, delete-orphan")
    crafted_template_entitlements = relationship("CraftedTemplateEntitlement", back_populates="user", cascade="all, delete-orphan")
    template_change_jobs = relationship("ProjectTemplateChangeJob", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    regenerate_script_jobs = relationship("ProjectRegenerateScriptJob", back_populates="user", foreign_keys="ProjectRegenerateScriptJob.user_id", cascade="all, delete-orphan", passive_deletes=True)
    voice_change_jobs = relationship("ProjectVoiceChangeJob", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    referrals = relationship("Referral", foreign_keys="Referral.referrer_id", cascade="all, delete-orphan", passive_deletes=True)
    survey_response = relationship("SurveyResponse", uselist=False, cascade="all, delete-orphan", passive_deletes=True)

    @property
    def survey_submitted(self) -> bool:
        return self.survey_response is not None

    @property
    def video_limit(self) -> int:
        """Max videos allowed in the current billing period."""
        if self.plan == PlanTier.FREE:
            base = FREE_TIER_INCLUDED_VIDEOS
        elif self.plan == PlanTier.STANDARD:
            base = 30
        else:
            base = 100  # Pro
        return base + (self.video_limit_bonus or 0) + (self.referral_video_bonus or 0)

    @property
    def can_create_video(self) -> bool:
        return self.videos_used_this_period < self.video_limit

    def roll_video_period_if_due(self, db: Session) -> bool:
        """Lazily reset the monthly video counter when Stripe won't.

        The monthly video allotment (30 Standard / 100 Pro) is reset by Stripe's
        ``invoice.paid`` webhook each billing period. That works for MONTHLY
        subscribers, but two cases never get a monthly Stripe invoice and would
        otherwise be stuck once they hit the cap:

          • **Lifetime** buyers — one-time payment, no recurring subscription, so
            Stripe never re-invoices them at all.
          • **Annual** subscribers — Stripe issues ``invoice.paid`` only once a
            YEAR, so the allotment would reset annually instead of monthly.

        This opportunistic check (called at limit read/gate points) resets the
        counter once 30 days have elapsed since ``period_start`` for exactly those
        two cases. Monthly subscribers are left untouched so their Stripe-driven
        reset is never double-handled. Returns True if a reset occurred.
        """
        if self.plan not in (PlanTier.STANDARD, PlanTier.PRO):
            return False
        if not self.period_start:
            return False
        # Cheap time gate first — a reset is only ever due once ~30 days pass.
        if datetime.utcnow() - self.period_start < timedelta(days=30):
            return False

        # A recurring subscriber only needs the lazy reset if they're ANNUAL
        # (monthly subscribers reset via Stripe's monthly invoice). Lifetime
        # buyers have no stripe_subscription_id and always need it.
        if self.stripe_subscription_id:
            from app.models.subscription import (
                Subscription,
                SubscriptionStatus,
                BillingInterval,
            )

            sub = (
                db.query(Subscription)
                .filter(
                    Subscription.stripe_subscription_id == self.stripe_subscription_id,
                    Subscription.status == SubscriptionStatus.ACTIVE,
                )
                .first()
            )
            is_annual = bool(
                sub and sub.plan and sub.plan.billing_interval == BillingInterval.ANNUAL
            )
            if not is_annual:
                return False

        self.videos_used_this_period = 0
        self.period_start = datetime.utcnow()
        db.commit()
        return True

    @property
    def custom_template_limit(self) -> int:
        """Max custom templates this user may create (plan base + purchased slots)."""
        base = {PlanTier.FREE: 1, PlanTier.STANDARD: 5}.get(self.plan, 20)  # Pro = 20
        return base + (self.custom_template_bonus or 0)

    @property
    def can_create_custom_template(self) -> bool:
        return (self.custom_templates_created or 0) < self.custom_template_limit


    def sync_video_limit_bonus(self, db: Session) -> bool:
    
        from app.models.subscription import Subscription, SubscriptionStatus, SubscriptionPlan

        now = datetime.utcnow()
        per_video_plan = db.query(SubscriptionPlan).filter_by(slug="per_video").first()
        if not per_video_plan:
            return False

        # Sum Subscription.quantity so slider packs (N credits in one row)
        # are counted correctly.
        active_credits = int(
            db.query(func.coalesce(func.sum(Subscription.quantity), 0))
            .filter(
                Subscription.user_id == self.id,
                Subscription.plan_id == per_video_plan.id,
                Subscription.status == SubscriptionStatus.COMPLETED,
                (
                    (Subscription.current_period_end == None) |
                    (Subscription.current_period_end > now)
                ),
            )
            .scalar() or 0
        )

        current_bonus = self.video_limit_bonus or 0

        total_purchased_credits = int(
            db.query(func.coalesce(func.sum(Subscription.quantity), 0))
            .filter(
                Subscription.user_id == self.id,
                Subscription.plan_id == per_video_plan.id,
                Subscription.status == SubscriptionStatus.COMPLETED,
            )
            .scalar() or 0
        )

        expired_credits = total_purchased_credits - active_credits

        # Only reduce expired portion
        if expired_credits > 0 and self.plan != PlanTier.FREE:
            new_bonus = max(0, current_bonus - expired_credits)

            print(
                f"[USER] sync_video_limit_bonus: user {self.id} "
                f"expired {expired_credits}, bonus {current_bonus} → {new_bonus}"
            )

            self.video_limit_bonus = new_bonus
            db.commit()
            return True

        return False
