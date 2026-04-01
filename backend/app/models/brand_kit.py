from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class BrandKit(Base):
    __tablename__ = "brand_kits"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    brand_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # JSON text fields for flexible schema evolution
    colors: Mapped[str | None] = mapped_column(Text, nullable=True)      # {"primary","secondary","accent","background","text","surface","muted"}
    fonts: Mapped[str | None] = mapped_column(Text, nullable=True)       # {"heading","body","mono"}
    design_language: Mapped[str | None] = mapped_column(Text, nullable=True)  # {"style","animationPreset","borderRadius","category","patterns":{...}}
    logos: Mapped[str | None] = mapped_column(Text, nullable=True)       # [{"url","type","placement","width"}]
    images: Mapped[str | None] = mapped_column(Text, nullable=True)      # [{"url","alt","context"}]

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="brand_kits")
    custom_templates = relationship("CustomTemplate", back_populates="brand_kit")
