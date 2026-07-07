import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SupportMessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


class SupportConversation(Base):
    __tablename__ = "support_conversations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    # Stored as a string for SQLite portability; UUID format enforced in app layer.
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    session_state: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    messages = relationship(
        "SupportMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="SupportMessage.created_at",
    )

    __table_args__ = (
        Index("ix_support_conv_user_updated", "user_id", "updated_at"),
        Index("ix_support_conv_session_updated", "session_id", "updated_at"),
    )


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("support_conversations.id"), nullable=False, index=True
    )
    role: Mapped[SupportMessageRole] = mapped_column(
        Enum(SupportMessageRole, native_enum=False),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    cited_docs: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    ui_guidance: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )

    conversation = relationship("SupportConversation", back_populates="messages")


def new_session_id() -> str:
    return str(uuid.uuid4())
