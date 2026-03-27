# app/models/template_version.py

from datetime import datetime
from sqlalchemy import Integer, ForeignKey, Text, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    template_id: Mapped[int] = mapped_column(
        ForeignKey("custom_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Snapshot of all code variants at this version
    component_code: Mapped[str | None] = mapped_column(Text, nullable=True)  # legacy single content variant
    intro_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    outro_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_codes: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list of code strings

    # Human-readable label: "Initial generation", "Regenerated", "After edits", etc.
    label: Mapped[str] = mapped_column(String(255), default="Generated")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )

    template = relationship("CustomTemplate", back_populates="versions")
