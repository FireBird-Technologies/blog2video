# app/models/project_edit_history.py

from datetime import datetime
from sqlalchemy import (
    Integer,
    ForeignKey,
    Text,
    Boolean,
    DateTime,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ProjectEditHistory(Base):
    __tablename__ = "project_edit_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Attribution — which user made this edit (nullable so history survives account deletion).
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Groups all field-rows from a single user action so they revert atomically.
    change_set_id: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)

    # DRAFT (collaboration overlay) vs PUBLISHED (live renderable rows).
    target: Mapped[str] = mapped_column(Text, nullable=False, default="published", server_default="published")

    reverted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    revert_of_change_set_id: Mapped[str | None] = mapped_column(Text, nullable=True)

    # False for bulk operations (script regen, template change, audio regen) that
    # are logged for visibility but cannot be reverted via a field diff.
    revertable: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

    field_name: Mapped[str | None] = mapped_column(Text, nullable=True)

    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_ai_assisted: Mapped[bool] = mapped_column(Boolean, default=False)

    edited_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True,
    )

    project = relationship("Project", back_populates="project_edit_history")
    user = relationship("User")


Index("ix_project_edit_project", ProjectEditHistory.project_id)