from datetime import datetime
from sqlalchemy import String, Text, DateTime, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class PrebuiltVoice(Base):
    """ElevenLabs premade voices stored in DB. Seeded at startup; served for GET /api/voices when premade_only=True."""

    __tablename__ = "prebuilt_voices"
    __table_args__ = (CheckConstraint("plan IN ('free', 'paid')", name="prebuilt_voice_plan_check"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voice_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    preview_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    labels: Mapped[str] = mapped_column(Text, nullable=False, default="{}")  # JSON object as string
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="paid")  # "free" | "paid"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
