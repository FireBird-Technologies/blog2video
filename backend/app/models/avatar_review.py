from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AvatarReview(Base):
    """Per-user 5-star rating + message for a project's avatar overlays.

    Deliberately separate from the ``reviews`` table rather than a new ``source``
    value on it: ``reviews`` is UNIQUE(user_id, project_id), so reusing it would
    mean a user could not leave both a video review and an avatar review on the
    same project. Shaped like ``template_ratings`` — a plain upserted row, no
    project_sequence / plan snapshot and no low-rating alert email.
    """

    __tablename__ = "avatar_reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "project_id", name="uq_avatar_reviews_user_project"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1..5
    suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    user = relationship("User", back_populates="avatar_reviews")
    project = relationship("Project", back_populates="avatar_reviews")
