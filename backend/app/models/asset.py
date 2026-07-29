import enum
from datetime import datetime
from sqlalchemy import String, Enum, ForeignKey, DateTime, Boolean, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AssetType(str, enum.Enum):
    IMAGE = "image"
    AUDIO = "audio"
    # Stock footage clips. Always stored normalised to CFR 30 fps (see
    # app/services/stock_footage.py) so Remotion's frame sampling lands exactly
    # on source frames — anything else judders.
    VIDEO = "video"


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    asset_type: Mapped[AssetType] = mapped_column(Enum(AssetType), nullable=False)
    original_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    local_path: Mapped[str] = mapped_column(String(512), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    r2_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    r2_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    excluded: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    # ─── VIDEO assets only (stock footage) ───────────────────────────
    # duration_seconds is load-bearing, not informational: the renderer converts
    # it to frames for Remotion's <Loop durationInFrames={...}>. A wrong value
    # produces a visible jump at the loop point, so it is probed with ffprobe
    # from the NORMALISED file (never trusted from the provider's metadata).
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Provider attribution — required by both the Pexels and Pixabay licences.
    source_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_page_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    # Sibling file carrying the AAC audio track, when the source had one. The
    # main file is always silent so the common (muted) path never decodes audio.
    audio_variant_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationships
    project = relationship("Project", back_populates="assets")
