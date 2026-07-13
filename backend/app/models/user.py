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


def _add_one_month(dt: datetime) -> datetime:
    """Return ``dt`` advanced by exactly one calendar month.

    Months vary in length, so we step by calendar month (same day-of-month,
    same time-of-day) rather than a flat 30 days — this keeps the billing
    anniversary stable and avoids the ~5-day/year drift a 30-day step causes.
    When the next month is shorter than the anchor's day (e.g. Jan 31 → Feb),
    the day is clamped to that month's last day. relativedelta handles both.
    """
    from dateutil.relativedelta import relativedelta

    return dt + relativedelta(months=1)


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
    language_change_jobs = relationship("ProjectLanguageChangeJob", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
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

    def ensure_purchased_credit_usable(self, qty: int) -> None:
        """After granting `qty` per-video credits, guarantee they are net-positive
        headroom even if pre-existing usage was at/over the (possibly lowered) limit.

        Because ``video_limit`` is blended (base + bonus + referral), a purchase that
        only bumps ``video_limit_bonus`` can be fully swallowed when ``videos_used_this_period``
        was already >= the limit (e.g. after the FREE base was lowered). This clamps
        ``videos_used_this_period`` so the just-purchased ``qty`` always yields ``qty``
        usable videos. Only ever lowers videos_used — the ``>`` guard makes it a no-op
        for users who aren't maxed, so it is safe for all plans. Call AFTER
        ``video_limit_bonus`` has been incremented so ``self.video_limit`` is current.
        """
        if self.videos_used_this_period > self.video_limit - qty:
            self.videos_used_this_period = max(0, self.video_limit - qty)

    def _needs_lazy_monthly_reset(self, db: Session) -> bool:
        """True if this user's monthly allotment must be reset in-app rather than
        by Stripe's ``invoice.paid`` webhook.

        Stripe re-invoices MONTHLY subscribers every month, so their reset is
        webhook-driven and must NOT be double-handled here. Two cases never get a
        monthly Stripe invoice and so depend on the in-app reset:

          • **Lifetime** buyers — one-time payment, no recurring subscription, so
            Stripe never re-invoices them at all (no ``stripe_subscription_id``).
            Their allotment (30 Standard / 100 Pro) refreshes every month forever.
          • **Annual** subscribers — Stripe issues ``invoice.paid`` only once a
            YEAR, so without this the allotment would reset annually not monthly.
        """
        if self.plan not in (PlanTier.STANDARD, PlanTier.PRO):
            return False

        # Lifetime buyers have no recurring Stripe subscription → always in-app.
        if not self.stripe_subscription_id:
            return True

        from app.models.subscription import (
            Subscription,
            SubscriptionStatus,
            BillingInterval,
        )

        # Prefer the ACTIVE row, but fall back to the most recent matching row so a
        # transient status blip (PAST_DUE→ACTIVE on an SCA/retry) can't silently
        # freeze the reset forever. We only care about the plan's billing interval.
        sub = (
            db.query(Subscription)
            .filter(
                Subscription.stripe_subscription_id == self.stripe_subscription_id,
                Subscription.status == SubscriptionStatus.ACTIVE,
            )
            .first()
        )
        if sub is None:
            sub = (
                db.query(Subscription)
                .filter(
                    Subscription.stripe_subscription_id == self.stripe_subscription_id,
                )
                .order_by(Subscription.created_at.desc())
                .first()
            )
        return bool(
            sub and sub.plan and sub.plan.billing_interval == BillingInterval.ANNUAL
        )

    def reset_billing_period(self, db: Session, new_period_start: datetime) -> None:
        """Roll the monthly allotment for one billing cycle.

        Mirrors the reset performed by ``_handle_invoice_paid`` for monthly
        subscribers so annual and lifetime users get an identical monthly
        rollover: usage cleared, expired per-video credits dropped, referral
        bonus reset.
        Does NOT commit — the caller controls the transaction (so a multi-cycle
        catch-up commits once).
        """
        # Imported lazily to avoid a circular import (billing imports User).
        from app.routers.billing import _count_active_per_video_credits

        self.videos_used_this_period = 0
        self.period_start = new_period_start
        # Recount non-expired per-video credits so expired ones fall off, exactly
        # as invoice.paid does. Usage is already 0 so no delta adjustment needed.
        self.video_limit_bonus = _count_active_per_video_credits(self.id, db)
        # Referral bonus is earned once per billing cycle.
        self.referral_video_bonus = 0

    def roll_video_period_if_due(self, db: Session) -> bool:
        """Lazily reset the monthly video counter when Stripe won't.

        Opportunistic fallback called at limit read/gate points. The authoritative
        driver is the hourly scheduled task (see main.py); this ensures a user who
        acts before that task runs still sees a fresh allotment.

        Uses **calendar-month** cycles anchored on ``period_start`` (not a flat
        30 days) so the reset lands on the same day-of-month each month and never
        drifts as month lengths vary. Catches up every whole cycle that has
        elapsed, so a user who was idle for several months is rolled to the
        current cycle in one pass. Returns True if any reset occurred.
        """
        if not self._needs_lazy_monthly_reset(db):
            return False

        now = datetime.utcnow()

        # No anchor yet (e.g. comp account, or a checkout path that didn't set it):
        # start the clock now so future cycles are well-defined. Nothing to reset.
        if not self.period_start:
            self.period_start = now
            db.commit()
            return False

        rolled = False
        # Advance one calendar month at a time until the next boundary is in the
        # future. Guard the loop count so a bad clock/anchor can't spin forever.
        for _ in range(120):
            next_start = _add_one_month(self.period_start)
            if next_start > now:
                break
            self.reset_billing_period(db, next_start)
            rolled = True

        if rolled:
            db.commit()
        return rolled

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
