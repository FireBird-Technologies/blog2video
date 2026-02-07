import enum
from datetime import datetime
from sqlalchemy import String, Enum, DateTime, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PlanTier(str, enum.Enum):
    FREE = "free"
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
    period_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")

    @property
    def video_limit(self) -> int:
        """Max videos allowed in the current billing period."""
        if self.plan == PlanTier.FREE:
            return 1  # 1st video free
        return 100  # Pro: 100/month

    @property
    def can_create_video(self) -> bool:
        return self.videos_used_this_period < self.video_limit
