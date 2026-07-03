# app/models/scene_comment.py

from datetime import datetime
from sqlalchemy import (
    ForeignKey,
    Text,
    DateTime,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SceneComment(Base):
    """A collaborator's comment on a single scene.

    Comments are only meaningful on shared projects — the frontend surfaces the
    comment affordance only when a project has ≥1 member. Attribution (``user_id``)
    is nullable so a comment survives the author deleting their account (rendered as
    "former collaborator").
    """

    __tablename__ = "scene_comments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    scene_id: Mapped[int] = mapped_column(
        ForeignKey("scenes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    body: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )

    user = relationship("User")


Index("ix_scene_comment_project_scene", SceneComment.project_id, SceneComment.scene_id)
