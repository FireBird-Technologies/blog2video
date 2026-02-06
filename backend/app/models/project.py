import enum
from datetime import datetime
from sqlalchemy import String, Text, Enum, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ProjectStatus(str, enum.Enum):
    CREATED = "created"
    SCRAPED = "scraped"
    SCRIPTED = "scripted"
    GENERATED = "generated"
    RENDERING = "rendering"
    DONE = "done"
    ERROR = "error"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    blog_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    blog_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.CREATED
    )
    voice_gender: Mapped[str] = mapped_column(String(10), default="female")
    voice_accent: Mapped[str] = mapped_column(String(10), default="american")
    accent_color: Mapped[str] = mapped_column(String(20), default="#7C3AED")
    bg_color: Mapped[str] = mapped_column(String(20), default="#0A0A0A")
    text_color: Mapped[str] = mapped_column(String(20), default="#FFFFFF")
    animation_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    studio_port: Mapped[int | None] = mapped_column(nullable=True)
    player_port: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user = relationship("User", back_populates="projects")
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan", order_by="Scene.order")
    assets = relationship("Asset", back_populates="project", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="project", cascade="all, delete-orphan", order_by="ChatMessage.created_at")
