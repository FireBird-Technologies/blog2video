# app/models/project_member.py

import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    String,
    Enum,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class MemberRole(str, enum.Enum):
    OWNER = "owner"
    EDITOR = "editor"
    # VIEWER reserved for a future read-only tier; the access resolver already
    # understands role ordering so adding it later needs no schema change.
    VIEWER = "viewer"


# Role privilege ordering — higher number = more privilege. Used by the access
# resolver to answer "does this member have >= required_role".
ROLE_RANK = {
    MemberRole.VIEWER: 1,
    MemberRole.EDITOR: 2,
    MemberRole.OWNER: 3,
}


class MemberStatus(str, enum.Enum):
    PENDING = "pending"      # invited by email, not yet accepted
    ACCEPTED = "accepted"    # active collaborator
    REVOKED = "revoked"      # access removed by owner
    REJECTED = "rejected"    # invite declined by the invitee


class ProjectMember(Base):
    """A user's membership in a project (collaboration ACL).

    The project OWNER always has one row (role=OWNER, status=ACCEPTED),
    backfilled for every existing project. Additional collaborators are added
    as PENDING invites (by email, ``user_id`` null) and bound to a user on
    accept. ``user_id`` is intentionally nullable so a collaborator can be
    invited before they have an account, and so that history/attribution
    survives if that user later deletes their account.
    """

    __tablename__ = "project_members"
    __table_args__ = (
        # One invite/membership per email per project — makes re-invites idempotent.
        UniqueConstraint("project_id", "invited_email", name="uq_project_member_email"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Null until the invite is accepted (or if the user later deletes their account).
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    invited_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)

    # values_callable makes SQLAlchemy persist the enum *value* ("owner") rather
    # than the member name ("OWNER"), matching the raw-SQL backfill and the
    # SQLite string-column defaults ('editor'/'pending').
    role: Mapped[MemberRole] = mapped_column(
        Enum(MemberRole, values_callable=lambda e: [m.value for m in e]),
        nullable=False, default=MemberRole.EDITOR,
    )
    status: Mapped[MemberStatus] = mapped_column(
        Enum(MemberStatus, values_callable=lambda e: [m.value for m in e]),
        nullable=False, default=MemberStatus.PENDING,
    )

    invited_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Opaque token embedded in the invite email accept link.
    invite_token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=lambda: uuid.uuid4().hex
    )

    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project = relationship("Project", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])
    invited_by = relationship("User", foreign_keys=[invited_by_id])
