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
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    scene_id: Mapped[int] = mapped_column(
        ForeignKey("scenes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Attribution — which user made this edit. Nullable so history survives if the
    # user later deletes their account (shown as "former collaborator").
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Groups all field-rows from a single user action (e.g. an AI regen that touches
    # many fields) so they preview and revert as one atomic change-set.
    change_set_id: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)

    # DRAFT = edit on the collaboration draft overlay; PUBLISHED = edit applied to the
    # live renderable rows (e.g. a finalise). Distinguishes the two for preview/revert.
    target: Mapped[str] = mapped_column(Text, nullable=False, default="published", server_default="published")

    # A revert is itself a recorded change-set; these let us walk revert/redo chains.
    reverted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    revert_of_change_set_id: Mapped[str | None] = mapped_column(Text, nullable=True)

    # False for bulk operations (script regen, audio regen) logged for visibility
    # but not revertable via a field diff.
    revertable: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

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

    scene = relationship("Scene", back_populates="edit_history")
    project = relationship("Project", back_populates="scene_edit_history")
    user = relationship("User")


Index("ix_scene_edit_project_scene", SceneEditHistory.project_id, SceneEditHistory.scene_id)