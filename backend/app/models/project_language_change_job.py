from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProjectLanguageChangeJob(Base):
    """Tracks a background language-change (translate + voiceover regeneration) run.

    Mirrors ProjectVoiceChangeJob / ProjectTemplateChangeJob so the same stall-recovery
    machinery applies. ``updated_at`` is the heartbeat: every per-scene progress write
    bumps it (via ``onupdate``), and a stale value while still active means the run is
    stuck and should be reaped + reverted.

    ``user_id`` is the PAYER (the project owner), not the acting collaborator — the
    upfront credit reservation and the refund on failure both key off this column.
    """

    __tablename__ = "project_language_change_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    # Progress is counted across BOTH phases (translate, then TTS), so total_scenes is
    # 2 * len(scenes) — otherwise the bar would sit at 50% for the whole audio pass.
    total_scenes: Mapped[int] = mapped_column(Integer, default=0)
    processed_scenes: Mapped[int] = mapped_column(Integer, default=0)
    audio_backed_up: Mapped[bool] = mapped_column(Boolean, default=False)
    target_language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # JSON snapshot of the project's prior content_language and every scene's prior
    # title / display_text / narration_text / remotion_code, captured before the change,
    # so a reaped/failed run can restore the original copy and descriptors.
    content_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project = relationship("Project", back_populates="language_change_jobs")
    user = relationship("User", back_populates="language_change_jobs")
