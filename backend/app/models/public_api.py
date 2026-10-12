"""Public video API: user API keys and the links that scope projects to callers.

A blog2video user's own API key (``ApiKey``) reaches the ``/api/v1`` router
(see routers/public_api.py). Videos are owned by that user and count against
their normal plan limits. An app serving its own users calls with one key and
tags each video with its end user's id (``ApiProjectLink.external_user_id``).
"""

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Display-only fragments. The key itself is never stored — only its hash.
    prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    last4: Mapped[str] = mapped_column(String(4), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    # Fernet ciphertext of the full key, so its owner can copy it again from the
    # API keys page (services/api_key_crypto.py). Authentication never reads it;
    # it only ever uses key_hash.
    key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ApiProjectLink(Base):
    """Which API caller created a project, and therefore who may reach it.

    ``project_id`` deliberately has no foreign key: a failed generation deletes
    its project row, and the link must outlive that, still carrying the id the
    caller knows, so status polls can report "failed".
    """

    __tablename__ = "api_project_links"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_api_project_links_owner_idem"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)
    # Owner of the project: the key holder.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    api_key_id: Mapped[int | None] = mapped_column(
        ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # The caller's own end-user id: a caller-supplied tag for filtering.
    external_user_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    project = relationship("Project", primaryjoin="foreign(ApiProjectLink.project_id) == Project.id", viewonly=True)
