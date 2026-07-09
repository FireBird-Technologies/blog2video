"""Collaboration: invite/accept/list/revoke project members (co-editing ACL).

Sharing is available on all plans: any project owner may invite. Invited
collaborators can be on any plan and edit the owner's video, consuming the
owner's quota (see app/services/access.py::project_owner).
"""

import logging
import uuid
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
from app.services.access import get_accessible_project, is_owner, project_owner
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
    invited_email: str
    invite_token: str
    status: str


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
    """List members of a project, owner first. Any member may view."""
    project = get_accessible_project(project_id, user, db)  # 404 if no access
    owner = project_owner(project, db)

    members = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.status.in_([MemberStatus.PENDING, MemberStatus.ACCEPTED]),
            # Exclude any owner row (OWNER role, or a member row for the owner's
            # user/email) — the owner is synthesized below, so keep it out here to
            # avoid a duplicate.
            ProjectMember.role != MemberRole.OWNER,
            (ProjectMember.user_id != owner.id) | (ProjectMember.user_id.is_(None)),
            ProjectMember.invited_email != owner.email.lower(),
        )
        .order_by(ProjectMember.created_at.asc())
        .all()
    )

    # The owner isn't (reliably) a ProjectMember row — synthesize one so they always
    # appear once. id=0 marks a non-actionable synthetic row (owners can't be revoked).
    owner_out = MemberOut(
        id=0,
        email=owner.email,
        role=MemberRole.OWNER.value,
        status=MemberStatus.ACCEPTED.value,
        user_id=owner.id,
        name=owner.name,
        picture=owner.picture,
        created_at=project.created_at,
        is_you=(owner.id == user.id),
    )
    return [owner_out] + [_member_to_out(m, user.id, db) for m in members]


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

    # Cap collaborators at 5. The owner isn't a ProjectMember row, so the count is
    # just the pending + accepted members (rejected/revoked don't occupy a slot).
    active_count = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.status.in_([MemberStatus.PENDING, MemberStatus.ACCEPTED]),
        )
        .count()
    )

    # Idempotent on (project_id, invited_email): re-inviting an existing row reuses it.
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
        # Reopening a rejected/revoked invite adds an active slot, so it must respect
        # the cap; re-sending a still-pending invite doesn't change the count.
        if existing.status != MemberStatus.PENDING and active_count >= 5:
            raise HTTPException(status_code=409, detail="Maximum of 5 collaborators reached.")
        # Rotate the token when reopening a revoked/rejected invite so the resent
        # link is a brand-new URL. Otherwise the invitee's browser could still be
        # sitting on the old (canceled) invite page — same URL, no remount — and
        # would keep showing the stale "canceled" error for a now-valid invite.
        if existing.status != MemberStatus.PENDING:
            existing.invite_token = uuid.uuid4().hex
        existing.status = MemberStatus.PENDING
        existing.role = MemberRole.EDITOR
        existing.error_message = None
        member = existing
    else:
        if active_count >= 5:
            raise HTTPException(status_code=409, detail="Maximum of 5 collaborators reached.")

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

    # Notify any live collaboration sockets this user has, then disconnect them.
    try:
        from app.routers.collab_ws import collab_manager
        if member.user_id is not None:
            collab_manager.notify_and_kick_user_from_sync(
                project_id,
                member.user_id,
                {
                    "type": "access_revoked",
                    "message": "Oops, your access has been revoked, you cannot access the project.",
                },
            )
    except Exception as e:
        logger.warning("[COLLAB] Failed to notify/kick revoked user %s: %s", member.user_id, e)

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
                invited_email=m.invited_email,
                invite_token=m.invite_token,
                status=m.status.value,
            )
        )
    return out


@accept_router.get("/invites/by-token/{token}", response_model=InviteOut)
def invite_by_token(
    token: str,
    db: Session = Depends(get_db),
):
    """Look up a single invite by its token — public (no auth).

    Lets the invite page show which project/email the link is for even before the
    user signs in, or when signed in with a different account. Does not reveal
    anything past the invited email + project name.
    """
    member = db.query(ProjectMember).filter(ProjectMember.invite_token == token).first()
    if not member:
        raise HTTPException(status_code=404, detail="Invite not found")
    if member.status == MemberStatus.REVOKED:
        raise HTTPException(status_code=410, detail="Your invite was canceled. Contact the project owner to get another invite.")

    project = db.query(Project).filter(Project.id == member.project_id, Project.is_active == True).first()  # noqa: E712
    if not project:
        raise HTTPException(status_code=404, detail="Project no longer exists.")

    inviter = db.query(User).filter(User.id == member.invited_by_id).first() if member.invited_by_id else None
    return InviteOut(
        project_id=member.project_id,
        project_name=project.name,
        invited_by=inviter.name if inviter else None,
        invited_email=member.invited_email,
        invite_token=member.invite_token,
        status=member.status.value,
    )


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
        raise HTTPException(status_code=410, detail="Your invite was canceled. Contact the project owner to get another invite.")

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


@accept_router.post("/invites/{token}/reject")
def reject_invite(
    token: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Decline a collaboration invite. The logged-in email must match the invite.

    Rejected invites don't count toward the collaborator cap and can be re-sent
    later by the owner (the re-invite reopens the row as PENDING).
    """
    member = db.query(ProjectMember).filter(ProjectMember.invite_token == token).first()
    if not member:
        raise HTTPException(status_code=404, detail="Invite not found")

    if member.status == MemberStatus.REVOKED:
        raise HTTPException(status_code=410, detail="Your invite was canceled. Contact the project owner to get another invite.")

    if member.invited_email.lower() != user.email.lower():
        raise HTTPException(
            status_code=403,
            detail="This invite was sent to a different email address.",
        )

    member.user_id = user.id
    member.status = MemberStatus.REJECTED
    db.commit()

    return {"project_id": member.project_id, "status": "rejected"}
