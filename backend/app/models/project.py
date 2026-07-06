import enum
from datetime import datetime
from sqlalchemy import String, Text, Enum, DateTime, ForeignKey, Integer, Boolean, Float
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
    GENERATING = "regenerating"
    # Dedicated state for the "regenerate script" job (keep narration/voiceover, refresh
    # titles/layouts). Distinct from SCRIPTED so a reload mid-job doesn't auto-start the
    # full generation pipeline.
    SCRIPT_REGENERATING = "script_regenerating"
    # Dedicated state for the voice change job. Distinct from GENERATING so the
    # voice-change-status endpoint doesn't need to guess whether GENERATING belongs
    # to a voice change or a template relayout.
    VOICE_REGENERATING = "voice_regenerating"


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
    # Optional project-level font family override (font ID, e.g. 'roboto_slab').
    # When null, templates use their own defaults.
    font_family: Mapped[str | None] = mapped_column(String(64), nullable=True)
    animation_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    studio_unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    studio_port: Mapped[int | None] = mapped_column(nullable=True)
    player_port: Mapped[int | None] = mapped_column(nullable=True)
    r2_video_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    r2_video_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    embed_token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)

    # Logo overlay
    logo_r2_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    logo_r2_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    logo_position: Mapped[str] = mapped_column(String(20), default="bottom_right")
    logo_opacity: Mapped[float] = mapped_column(default=0.9)
    logo_size: Mapped[float] = mapped_column(Float, default=70.0)  # percentage, e.g. 70 = 70%, REAL for smooth slider

    # Captions (subtitles) — text is the scene's narration_text. Always bottom-anchored;
    # caption_offset shifts it vertically within the bottom region (-100..+100, 0 = default,
    # positive = up, negative = down).
    captions_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    caption_position: Mapped[str] = mapped_column(String(20), default="bottom_center")
    caption_font_family: Mapped[str] = mapped_column(String(50), default="inter")
    caption_font_size: Mapped[str] = mapped_column(String(10), default="36")
    caption_offset: Mapped[int] = mapped_column(Integer, default=0)

    # Voiceover
    custom_voice_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Optional user voice tuning, stored as a JSON string array ["<stability>","<speed>","<emotion>"]
    # feeding the v3 voice_settings + emotion tag. Null = per-video-style defaults. See
    # _parse_voice_tuning in services/voiceover.py. (Column name kept as voice_emotion for migration
    # continuity.)
    voice_emotion: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)

    # Template (determines layout system + DSPy prompt)
    template: Mapped[str] = mapped_column(String(50), default="default")
    crafted_template_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("crafted_templates.id"), nullable=True, index=True)

    # Video style: explainer (default), promotional, storytelling — drives script & voiceover tone
    video_style: Mapped[str] = mapped_column(String(30), default="explainer")

    # Video length selection controls how many scenes are generated.
    # Values: auto, short (4-5), medium (12-15), detailed (23-30), mdetailed (35-40)
    video_length: Mapped[str] = mapped_column(String(20), default="auto")
    playback_speed: Mapped[float] = mapped_column(Float, default=1.0)

    # Background music
    bgm_track_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bgm_volume: Mapped[float] = mapped_column(Float, default=0.10)

    # Content language: ISO 639-1 code (e.g. 'en', 'es'). Defaults to scraped content language.
    # All generated content (script, display text, voiceover) is produced in this language.
    # Null = auto-detect from blog_content when needed. Later: user choice / translate option.
    content_language: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Aspect ratio
    aspect_ratio: Mapped[str] = mapped_column(String(20), default="landscape")
    
    # AI-assisted editing usage tracking
    ai_assisted_editing_count: Mapped[int] = mapped_column(Integer, default=0)

    # Soft-delete flag — False means the project has been deactivated (files purged)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user = relationship("User", back_populates="projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    crafted_template = relationship("CraftedTemplate", back_populates="projects")
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan", order_by="Scene.order")
    assets = relationship("Asset", back_populates="project", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="project", cascade="all, delete-orphan", order_by="ChatMessage.created_at")
    project_edit_history = relationship("ProjectEditHistory", back_populates="project", cascade="all, delete-orphan", passive_deletes=True,)
    scene_edit_history = relationship("SceneEditHistory", back_populates="project", cascade="all, delete-orphan", passive_deletes=True,)
    scene_comments = relationship("SceneComment", back_populates="project", cascade="all, delete-orphan", passive_deletes=True,)
    reviews = relationship("Review", back_populates="project", cascade="all, delete-orphan")
    template_change_jobs = relationship("ProjectTemplateChangeJob", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    regenerate_script_jobs = relationship("ProjectRegenerateScriptJob", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    voice_change_jobs = relationship("ProjectVoiceChangeJob", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
