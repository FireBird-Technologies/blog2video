"""Collaboration: invite/accept/list/revoke project members (co-editing ACL).

Sharing is available on all plans: any project owner may invite. Invited
collaborators can be on any plan and edit the owner's video, consuming the
owner's quota (see app/services/access.py::project_owner).
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
import re as _re

from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.config import settings
from app.models.user import User
from app.models.project import Project
from app.models.project_member import (
    ProjectMember,
    MemberRole,
    MemberStatus,
)
from app.services.access import get_accessible_project, is_owner
from app.services.email import email_service, EmailServiceError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}/members", tags=["collaboration"])


# ─── Schemas ─────────────────────────────────────────────────────────

_EMAIL_RE = _re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class InviteRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        v = (v or "").strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address.")
        return v


class MemberOut(BaseModel):
    id: int
    email: str
    role: str
    status: str
    user_id: Optional[int] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    created_at: datetime
    is_you: bool = False


class InviteOut(BaseModel):
    """A pending invite as seen by the invitee (project-level, cross-listing)."""
    project_id: int
    project_name: str
    invited_by: Optional[str] = None
    invite_token: str


# ─── Helpers ─────────────────────────────────────────────────────────

def _member_to_out(m: ProjectMember, acting_user_id: int, db: Session) -> MemberOut:
    u = m.user if m.user_id else None
    if u is None and m.user_id:
        u = db.query(User).filter(User.id == m.user_id).first()
    return MemberOut(
        id=m.id,
        email=m.invited_email,
        role=m.role.value,
        status=m.status.value,
        user_id=m.user_id,
        name=u.name if u else None,
        picture=u.picture if u else None,
        created_at=m.created_at,
        is_you=(m.user_id == acting_user_id),
    )


# ─── Endpoints ───────────────────────────────────────────────────────

@router.get("", response_model=list[MemberOut])
def list_members(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List members of a project. Any member (owner or collaborator) may view."""
    get_accessible_project(project_id, user, db)  # 404 if no access
    members = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.status != MemberStatus.REVOKED,
        )
        .order_by(ProjectMember.created_at.asc())
        .all()
    )
    return [_member_to_out(m, user.id, db) for m in members]


@router.post("", response_model=MemberOut, status_code=201)
def invite_member(
    project_id: int,
    body: InviteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Invite a collaborator by email. Owner-only; available on all plans."""
    # Owner-only action.
    project = get_accessible_project(project_id, user, db, required_role="owner")

    email = body.email.lower().strip()
    if email == user.email.lower():
        raise HTTPException(status_code=400, detail="You already own this project.")

    # Idempotent on (project_id, invited_email): re-inviting a revoked/existing
    # member reuses the row.
    existing = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.invited_email == email,
        )
        .first()
    )
    if existing:
        if existing.status == MemberStatus.ACCEPTED:
            raise HTTPException(status_code=409, detail="This user is already a collaborator.")
        # Re-open a revoked/pending invite.
        existing.status = MemberStatus.PENDING
        existing.role = MemberRole.EDITOR
        existing.error_message = None
        member = existing
    else:
        # Bind user_id now if an account with this email already exists.
        invitee = db.query(User).filter(User.email == email).first()
        member = ProjectMember(
            project_id=project_id,
            user_id=invitee.id if invitee else None,
            invited_email=email,
            role=MemberRole.EDITOR,
            status=MemberStatus.PENDING,
            invited_by_id=user.id,
        )
        db.add(member)

    db.commit()
    db.refresh(member)

    # Send the invite email (best-effort; record failure but keep the invite).
    accept_link = f"{settings.FRONTEND_URL.rstrip('/')}/invite/{member.invite_token}"
    try:
        email_service.send_collab_invite_email(
            to_email=email,
            inviter_name=user.name,
            project_name=project.name,
            accept_link=accept_link,
        )
    except EmailServiceError as e:
        member.error_message = str(e)[:500]
        db.commit()
        logger.warning("[COLLAB] Invite email failed for %s on project %s: %s", email, project_id, e)

    return _member_to_out(member, user.id, db)


@router.delete("/{member_id}", status_code=204)
def revoke_member(
    project_id: int,
    member_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke a collaborator (owner-only). Their access is cut immediately."""
    get_accessible_project(project_id, user, db, required_role="owner")

    member = (
        db.query(ProjectMember)
        .filter(ProjectMember.id == member_id, ProjectMember.project_id == project_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == MemberRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot revoke the project owner.")

    member.status = MemberStatus.REVOKED
    db.commit()

    # Disconnect any live collaboration sockets this user has on the project.
    try:
        from app.routers.collab_ws import collab_manager
        if member.user_id is not None:
            collab_manager.kick_user(project_id, member.user_id)
    except Exception as e:
        logger.warning("[COLLAB] Failed to kick revoked user %s: %s", member.user_id, e)

    return None


# ─── Invitee-side accept (project-agnostic, keyed by token) ──────────

accept_router = APIRouter(prefix="/api/collab", tags=["collaboration"])


@accept_router.get("/invites", response_model=list[InviteOut])
def my_pending_invites(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List collaboration invites addressed to the current user, still pending."""
    rows = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.status == MemberStatus.PENDING,
            (ProjectMember.user_id == user.id) | (ProjectMember.invited_email == user.email.lower()),
        )
        .all()
    )
    out: list[InviteOut] = []
    for m in rows:
        project = db.query(Project).filter(Project.id == m.project_id, Project.is_active == True).first()  # noqa: E712
        if not project:
            continue
        inviter = db.query(User).filter(User.id == m.invited_by_id).first() if m.invited_by_id else None
        out.append(
            InviteOut(
                project_id=m.project_id,
                project_name=project.name,
                invited_by=inviter.name if inviter else None,
                invite_token=m.invite_token,
            )
        )
    return out


@accept_router.post("/invites/{token}/accept")
def accept_invite(
    token: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept a collaboration invite. The logged-in email must match the invite."""
    member = db.query(ProjectMember).filter(ProjectMember.invite_token == token).first()
    if not member:
        raise HTTPException(status_code=404, detail="Invite not found")

    if member.status == MemberStatus.REVOKED:
        raise HTTPException(status_code=410, detail="This invite has been revoked.")

    if member.invited_email.lower() != user.email.lower():
        raise HTTPException(
            status_code=403,
            detail="This invite was sent to a different email address.",
        )

    project = db.query(Project).filter(Project.id == member.project_id, Project.is_active == True).first()  # noqa: E712
    if not project:
        raise HTTPException(status_code=404, detail="Project no longer exists.")

    member.user_id = user.id
    member.status = MemberStatus.ACCEPTED
    member.accepted_at = datetime.utcnow()
    db.commit()

    return {"project_id": member.project_id, "status": "accepted"}
