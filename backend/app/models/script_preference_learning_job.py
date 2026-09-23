from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ScriptPreferenceLearningJob(Base):
    """Durable evidence captured when an initial script review is approved."""

    __tablename__ = "script_preference_learning_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    # JSON containing only changed titles/display text, accepted AI instructions,
    # and narration context. Source documents and visual/layout data are excluded.
    evidence_json: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Which style this merge writes into: "your_style", an editable builtin key,
    # or "custom:N". Captured at enqueue time so a job always merges into
    # whatever was pinned when the edit was accepted, even if the user re-pins
    # before the job runs.
    target_ref: Mapped[str] = mapped_column(String(30), nullable=False, default="your_style", server_default="your_style")
    # The target's version at enqueue time — optimistic-concurrency base for
    # the eventual write (was profile_version_at_enqueue, generalized beyond
    # User.script_preferences_version to whichever row target_ref resolves to).
    target_version_at_enqueue: Mapped[int] = mapped_column(Integer, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user = relationship("User", back_populates="script_preference_learning_jobs")
    project = relationship("Project", back_populates="script_preference_learning_jobs")
