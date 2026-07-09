from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProjectRegenerateScriptJob(Base):
    __tablename__ = "project_regenerate_script_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    # Payer = project owner (charge/refund key off this).
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # The collaborator who actually initiated this regeneration. Distinct from user_id
    # (the owner/payer) on shared projects. Only this user may approve/regenerate the
    # review. Nullable for legacy rows created before this column existed.
    initiated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    current_step: Mapped[str] = mapped_column(String(40), default="analyzing_instruction")
    total_scenes: Mapped[int] = mapped_column(Integer, default=0)
    processed_scenes: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    scene_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_instruction: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project = relationship("Project", back_populates="regenerate_script_jobs")
    # Pin to user_id: there are two FKs to users (user_id + initiated_by_user_id), so
    # the join is ambiguous without this. initiated_by_user_id has no relationship —
    # it's read directly as a column.
    user = relationship("User", back_populates="regenerate_script_jobs", foreign_keys=[user_id])
