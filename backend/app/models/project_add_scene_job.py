from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProjectAddSceneJob(Base):
    """Background job for generating and inserting a single new scene.

    Generation (LLM narration/visuals + descriptor + voiceover) runs off-request in
    a threadpool runner with up to 3 attempts. Credits are reserved on enqueue and
    refunded if all attempts fail. Status is surfaced to the frontend via polling.
    """

    __tablename__ = "project_add_scene_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Payer = project owner (charge/refund key off this).
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The collaborator who actually initiated the add (distinct from the owner/payer
    # on shared projects). Nullable for safety / legacy rows.
    initiated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    current_step: Mapped[str] = mapped_column(String(40), default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    # 1-indexed insert position among active scenes; NULL = append at the end.
    position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # The AI-edit credits reserved for this job, so the refund returns the exact cost.
    cost: Mapped[int] = mapped_column(Integer, default=0)
    # Set on success so the frontend can locate the new row.
    new_scene_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # One-directional (no back_populates) to avoid touching User/Project models.
    project = relationship("Project", foreign_keys=[project_id])
