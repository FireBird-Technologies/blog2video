# app/models/scene_edit_history.py

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


class SceneEditHistory(Base):
    __tablename__ = "scene_edit_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"),
        nullable=False,
        index=True,
    )

    scene_id: Mapped[int] = mapped_column(
        ForeignKey("scenes.id"),
        nullable=False,
        index=True,
    )

    field_name: Mapped[str | None] = mapped_column(Text, nullable=True)

    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Only used for AI-assisted edits
    user_instruction: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_ai_assisted: Mapped[bool] = mapped_column(Boolean, default=False)

    edited_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True,
    )

    project = relationship("Project")
    scene = relationship("Scene")


Index("ix_scene_edit_project_scene", SceneEditHistory.project_id, SceneEditHistory.scene_id)