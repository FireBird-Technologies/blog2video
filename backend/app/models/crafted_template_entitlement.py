from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CraftedTemplateEntitlement(Base):
    __tablename__ = "crafted_template_entitlements"
    __table_args__ = (
        UniqueConstraint("user_id", "crafted_template_id", name="uq_user_crafted_template"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    crafted_template_id: Mapped[int] = mapped_column(Integer, ForeignKey("crafted_templates.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="crafted_template_entitlements")
    crafted_template = relationship("CraftedTemplate", back_populates="entitlements")
