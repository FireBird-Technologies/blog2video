from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserVideoStyleSlot(Base):
    """One ordered style shown in Step 2 of project creation."""

    __tablename__ = "user_video_style_slots"
    __table_args__ = (
        CheckConstraint("position >= 0 AND position < 9", name="ck_video_style_slot_position"),
        CheckConstraint(
            "(builtin_key IS NOT NULL AND custom_style_id IS NULL) OR "
            "(builtin_key IS NULL AND custom_style_id IS NOT NULL)",
            name="ck_video_style_slot_one_reference",
        ),
        UniqueConstraint("user_id", "position", name="uq_video_style_slot_position"),
        UniqueConstraint("user_id", "builtin_key", name="uq_video_style_slot_builtin"),
        UniqueConstraint("user_id", "custom_style_id", name="uq_video_style_slot_custom"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    builtin_key: Mapped[str | None] = mapped_column(String(30), nullable=True)
    custom_style_id: Mapped[int | None] = mapped_column(
        ForeignKey("custom_video_styles.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="video_style_slots")
    custom_style = relationship("CustomVideoStyle", back_populates="slots")


class UserVideoStyleSettings(Base):
    """Per-user behavior that cannot be inferred from the current slot rows."""

    __tablename__ = "user_video_style_settings"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    learned_style_dismissed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )
    # The active target for background preference-learning merges: "your_style",
    # an editable builtin key, or "custom:N". NULL only means this user has never
    # interacted with pinning yet — every read resolves NULL to "your_style"
    # (see resolve_pinned_target in script_preferences.py). There is no separate
    # "unpinned" state a user can set explicitly; re-pinning to "your_style" is
    # how a user goes back to the default.
    pinned_learning_target: Mapped[str | None] = mapped_column(String(30), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user = relationship("User", back_populates="video_style_settings")


class UserBuiltinVideoStyle(Base):
    """A user's override of one concrete built-in writing-style preset."""

    __tablename__ = "user_builtin_video_styles"
    __table_args__ = (
        CheckConstraint(
            "builtin_key IN ('explainer', 'storytelling', 'promotional')",
            name="ck_user_builtin_video_style_key",
        ),
        UniqueConstraint("user_id", "builtin_key", name="uq_user_builtin_video_style"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    builtin_key: Mapped[str] = mapped_column(String(30), nullable=False)
    guidance: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user = relationship("User", back_populates="builtin_video_styles")
