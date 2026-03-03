"""Custom voice creation records: prompt/response and form fields. Separate from saved_voices (user's list for projects)."""

from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class CustomVoice(Base):
    """One row per custom voice creation (design-from-prompt or design-from-preset). Stores prompt, response, form fields, and generated name."""

    __tablename__ = "custom_voices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)  # "Generated 1", "Generated 2", ...
    voice_id: Mapped[str] = mapped_column(String(100), nullable=False)  # ElevenLabs voice ID from response
    source: Mapped[str] = mapped_column(String(20), nullable=False)  # "prompt" | "form"
    prompt_text: Mapped[str | None] = mapped_column(Text, nullable=True)  # for source=prompt
    response_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # full API response
    # Form fields when source=form
    form_gender: Mapped[str | None] = mapped_column(String(50), nullable=True)
    form_age: Mapped[str | None] = mapped_column(String(50), nullable=True)
    form_persona: Mapped[str | None] = mapped_column(String(100), nullable=True)
    form_speed: Mapped[str | None] = mapped_column(String(50), nullable=True)
    form_accent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    preview_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    audio_base64: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="custom_voices")
    saved_voices = relationship("SavedVoice", back_populates="custom_voice")
