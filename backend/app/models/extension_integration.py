"""Browser-extension connections and their idempotent project links."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExtensionConnection(Base):
    __tablename__ = "extension_connections"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    # The project the popup should restore after it has been closed. This is
    # deliberately server-side: chrome.storage is only a cache and may be
    # cleared, unavailable on another browser process, or stale after a worker
    # finishes while the popup is closed.
    current_project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    browser_label: Mapped[str] = mapped_column(String(255), nullable=False, default="Chrome extension")
    device_code_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    user_code: Mapped[str] = mapped_column(String(16), nullable=False, unique=True, index=True)
    access_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    # Returned exactly once to the extension and then cleared. The durable token is
    # represented only by access_token_hash.
    pending_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    projects = relationship(
        "ExtensionProjectLink",
        back_populates="connection",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    current_project = relationship("Project", foreign_keys=[current_project_id])


class ExtensionProjectLink(Base):
    __tablename__ = "extension_project_links"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    connection_id: Mapped[int] = mapped_column(
        ForeignKey("extension_connections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(80), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    connection = relationship("ExtensionConnection", back_populates="projects")
    project = relationship("Project")
