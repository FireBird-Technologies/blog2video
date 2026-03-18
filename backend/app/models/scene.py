from datetime import datetime
from sqlalchemy import String, Text, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    narration_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional on-screen display text. Falls back to narration_text when empty.
    display_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    visual_description: Mapped[str] = mapped_column(Text, nullable=False)
    remotion_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    voiceover_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    duration_seconds: Mapped[float] = mapped_column(Float, default=10.0)
    # Optional extra seconds to extend scene duration (e.g. for animations to complete).
    extra_hold_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Optional hint for template_scene_gen: layout ID or arrangement name suggested by script generator.
    preferred_layout: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationships
    project = relationship("Project", back_populates="scenes")
    edit_history = relationship("SceneEditHistory", back_populates="scene", cascade="all, delete-orphan", passive_deletes=True,)