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
        ForeignKey("projects.id"),
        nullable=False,
        index=True,
    )

    field_name: Mapped[str | None] = mapped_column(Text, nullable=True)

    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_ai_assisted: Mapped[bool] = mapped_column(Boolean, default=False)

    edited_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True,
    )

    project = relationship("Project")


Index("ix_project_edit_project", ProjectEditHistory.project_id)