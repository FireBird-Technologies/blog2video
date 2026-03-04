from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SavedVoice(Base):
    """User-saved ElevenLabs voice (custom or prebuilt). Tracks which user created/added it."""

    __tablename__ = "saved_voices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    voice_id: Mapped[str] = mapped_column(String(100), nullable=False)  # ElevenLabs voice ID
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    preview_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    audio_base64: Mapped[str | None] = mapped_column(Text, nullable=True)  # optional inline preview
    source: Mapped[str] = mapped_column(String(20), default="custom")  # "custom" | "prebuilt"
    plan: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "free" | "paid" for prebuilt (ElevenLabs)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    accent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    custom_voice_id: Mapped[int | None] = mapped_column(ForeignKey("custom_voices.id"), nullable=True, index=True)

    user = relationship("User", back_populates="saved_voices")
    custom_voice = relationship("CustomVoice", back_populates="saved_voices", foreign_keys=[custom_voice_id])
