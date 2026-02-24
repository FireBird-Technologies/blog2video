import enum
from datetime import datetime
from sqlalchemy import String, Text, Enum, DateTime, ForeignKey, Integer, Boolean
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
    blog_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    blog_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.CREATED
    )
    voice_gender: Mapped[str] = mapped_column(String(10), default="female")
    voice_accent: Mapped[str] = mapped_column(String(10), default="american")
    accent_color: Mapped[str] = mapped_column(String(20), default="#7C3AED")
    bg_color: Mapped[str] = mapped_column(String(20), default="#FFFFFF")
    text_color: Mapped[str] = mapped_column(String(20), default="#000000")
    animation_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    studio_unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    studio_port: Mapped[int | None] = mapped_column(nullable=True)
    player_port: Mapped[int | None] = mapped_column(nullable=True)
    r2_video_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    r2_video_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # Logo overlay
    logo_r2_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    logo_r2_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    logo_position: Mapped[str] = mapped_column(String(20), default="bottom_right")
    logo_opacity: Mapped[float] = mapped_column(default=0.9)

    # Voiceover
    custom_voice_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Template (determines layout system + DSPy prompt)
    template: Mapped[str] = mapped_column(String(50), default="default")

    # Video style: explainer (default), promotional, storytelling — drives script & voiceover tone
    video_style: Mapped[str] = mapped_column(String(30), default="explainer")

    # Aspect ratio
    aspect_ratio: Mapped[str] = mapped_column(String(20), default="landscape")
    
    # AI-assisted editing usage tracking
    ai_assisted_editing_count: Mapped[int] = mapped_column(Integer, default=0)
    
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
