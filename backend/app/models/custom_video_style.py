from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CustomVideoStyle(Base):
    """A reusable, user-authored writing style for video scripts."""

    __tablename__ = "custom_video_styles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    guidance: Mapped[str] = mapped_column(Text, nullable=False)
    creation_method: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    source_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optimistic concurrency, matching UserBuiltinVideoStyle.version — lets a
    # background preference-learning merge write into a pinned custom style
    # without silently racing a manual dashboard edit.
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user = relationship("User", back_populates="custom_video_styles")
    slots = relationship(
        "UserVideoStyleSlot", back_populates="custom_style", passive_deletes=True
    )
