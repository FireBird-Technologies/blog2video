from datetime import datetime
from sqlalchemy import String, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CraftedTemplate(Base):
    __tablename__ = "crafted_templates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    template_key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    public_template_id: Mapped[str] = mapped_column(String(140), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(255), default="blog")
    supported_video_style: Mapped[str] = mapped_column(String(30), default="explainer")
    r2_prefix: Mapped[str] = mapped_column(String(1024), nullable=False)
    manifest_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    created_by_admin_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Optional denormalized payload for quick listing without R2 read
    cached_meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    entitlements = relationship("CraftedTemplateEntitlement", back_populates="crafted_template", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="crafted_template")
    created_by_admin = relationship("User", foreign_keys=[created_by_admin_id])
