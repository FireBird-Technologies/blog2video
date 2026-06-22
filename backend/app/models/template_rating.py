from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TemplateRating(Base):
    """Per-user 5-star rating for a custom template.

    Mirrors the per-user ``reviews`` table (one row per user+template, upserted on
    change) but is simpler — no project_sequence / plan snapshot.
    """

    __tablename__ = "template_ratings"
    __table_args__ = (
        UniqueConstraint("user_id", "custom_template_id", name="uq_template_ratings_user_template"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    custom_template_id: Mapped[int] = mapped_column(
        ForeignKey("custom_templates.id"), nullable=False, index=True
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1..5
    suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    user = relationship("User", back_populates="template_ratings")
    custom_template = relationship("CustomTemplate", back_populates="ratings")
