from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProjectVoiceChangeJob(Base):
    """Tracks a background voice-change (voiceover regeneration) run.

    Mirrors ProjectTemplateChangeJob / ProjectRegenerateScriptJob so the same
    stall-recovery machinery applies. ``updated_at`` is the heartbeat: every
    per-scene progress write bumps it (via ``onupdate``), and a stale value while
    still active means the run is stuck and should be reaped + reverted.
    """

    __tablename__ = "project_voice_change_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    total_scenes: Mapped[int] = mapped_column(Integer, default=0)
    processed_scenes: Mapped[int] = mapped_column(Integer, default=0)
    audio_backed_up: Mapped[bool] = mapped_column(Boolean, default=False)
    # JSON snapshot of the project's prior voice settings (voice_gender, voice_accent,
    # custom_voice_id) captured before the change, so a reaped/failed run can restore them.
    voice_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project = relationship("Project", back_populates="voice_change_jobs")
    user = relationship("User", back_populates="voice_change_jobs")
