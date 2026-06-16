import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

REFERRAL_BONUS_VIDEOS = 5
REFERRAL_MAX_SIGNUPS = 10


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    referrer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(
        String(36), unique=True, nullable=False, index=True,
        default=lambda: str(uuid.uuid4()),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    signups = relationship("ReferralSignup", back_populates="referral", cascade="all, delete-orphan")
    invites = relationship("ReferralInvite", back_populates="referral", cascade="all, delete-orphan")


class ReferralSignup(Base):
    __tablename__ = "referral_signups"
    __table_args__ = (UniqueConstraint("new_user_id", name="uq_referral_signups_new_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    referral_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    new_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    referral = relationship("Referral", back_populates="signups")


class ReferralInvite(Base):
    __tablename__ = "referral_invites"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    referral_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invited_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    referral = relationship("Referral", back_populates="invites")
