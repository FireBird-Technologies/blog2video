from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class CustomTemplate(Base):
    __tablename__ = "custom_templates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    category: Mapped[str] = mapped_column(String(255), default="blog")
    supported_video_style: Mapped[str] = mapped_column(String(30), default="explainer")
    theme: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string of CustomTheme
    generated_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    preview_image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # AI-generated component code
    component_code: Mapped[str | None] = mapped_column(Text, nullable=True)  # legacy single content variant
    intro_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    outro_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Multiple unique content scene variants (JSON array of code strings)
    # Claude decides how many to generate (typically 4-8). Scenes cycle through them.
    content_codes: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list of code strings

    # Link to BrandKit (optional — existing templates have no brand kit)
    brand_kit_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("brand_kits.id"), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Active version pointer (nullable — NULL means no versioning yet / use current code fields)
    current_version_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    user = relationship("User", back_populates="custom_templates")
    brand_kit = relationship("BrandKit", back_populates="custom_templates")
    versions = relationship("TemplateVersion", back_populates="template", cascade="all, delete-orphan", order_by="TemplateVersion.created_at.desc()")
