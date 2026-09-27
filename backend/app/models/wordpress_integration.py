"""WordPress site connections and their idempotent project links."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WordPressConnection(Base):
    __tablename__ = "wordpress_connections"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    site_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    site_name: Mapped[str] = mapped_column(String(255), nullable=False, default="WordPress site")
    device_code_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    user_code: Mapped[str] = mapped_column(String(16), nullable=False, unique=True, index=True)
    access_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    # Returned exactly once to the plugin and then cleared. The durable token is
    # represented only by access_token_hash.
    pending_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    projects = relationship(
        "WordPressProjectLink",
        back_populates="connection",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class WordPressProjectLink(Base):
    __tablename__ = "wordpress_project_links"
    __table_args__ = (
        UniqueConstraint(
            "connection_id", "external_post_id", "content_hash",
            name="uq_wp_project_revision",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    connection_id: Mapped[int] = mapped_column(
        ForeignKey("wordpress_connections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    external_post_id: Mapped[str] = mapped_column(String(100), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(80), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    connection = relationship("WordPressConnection", back_populates="projects")
    project = relationship("Project")
