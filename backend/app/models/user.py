import enum
from datetime import datetime
from sqlalchemy import String, Enum, DateTime, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship, Session
from app.database import Base


class PlanTier(str, enum.Enum):
    FREE = "free"
    STANDARD = "standard"
    PRO = "pro"


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
    period_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")
    custom_templates = relationship("CustomTemplate", back_populates="user", cascade="all, delete-orphan")
    saved_voices = relationship("SavedVoice", back_populates="user", cascade="all, delete-orphan")
    custom_voices = relationship("CustomVoice", back_populates="user", cascade="all, delete-orphan")

    @property
    def video_limit(self) -> int:
        """Max videos allowed in the current billing period."""
        if self.plan == PlanTier.FREE:
            base = 1
        elif self.plan == PlanTier.STANDARD:
            base = 30
        else:
            base = 100  # Pro
        return base + (self.video_limit_bonus or 0)

    @property
    def can_create_video(self) -> bool:
        return self.videos_used_this_period < self.video_limit


    def sync_video_limit_bonus(self, db: Session) -> bool:
    
        from app.models.subscription import Subscription, SubscriptionStatus, SubscriptionPlan

        now = datetime.utcnow()
        per_video_plan = db.query(SubscriptionPlan).filter_by(slug="per_video").first()
        if not per_video_plan:
            return False

        active_credits = (
            db.query(Subscription)
            .filter(
                Subscription.user_id == self.id,
                Subscription.plan_id == per_video_plan.id,
                Subscription.status == SubscriptionStatus.COMPLETED,
                (
                    (Subscription.current_period_end == None) |
                    (Subscription.current_period_end > now)
                ),
            )
            .count()
        )

        current_bonus = self.video_limit_bonus or 0

        if self.plan != PlanTier.FREE and current_bonus > active_credits:
            print(
                f"[USER] sync_video_limit_bonus: user {self.id} "
                f"video_limit_bonus {current_bonus} → {active_credits} "
                f"(expired credits dropped)"
            )
            self.video_limit_bonus = active_credits
            db.commit()
            return True

        return False