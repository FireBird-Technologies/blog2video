# app/services/access.py
"""Membership-aware project access resolution for collaboration.

Central choke point that replaces the old scattered ``Project.user_id == user.id``
ownership filters. A user may access a project if they are the owner OR an accepted
collaborator with a sufficient role. Non-members get a 404 (never 403) so the
existence of a project is not disclosed — preserving the codebase's prior behaviour.

Usage:
    project = get_accessible_project(project_id, user, db)                    # editor+
    project = get_accessible_project(project_id, user, db, required_role="owner")
"""

from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.user import User
from app.models.project_member import (
    ProjectMember,
    MemberRole,
    MemberStatus,
    ROLE_RANK,
)


def _required_rank(required_role) -> int:
    if isinstance(required_role, str):
        required_role = MemberRole(required_role)
    return ROLE_RANK[required_role]


def get_member(project_id: int, user_id: int, db: Session) -> Optional[ProjectMember]:
    """Return the accepted membership row for this user on this project, if any."""
    return (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.status == MemberStatus.ACCEPTED,
        )
        .first()
    )


def get_accessible_project(
    project_id: int,
    user: User,
    db: Session,
    *,
    required_role: str = "editor",
) -> Project:
    """Return an active project the user may access at ``required_role``, else 404.

    Backwards-compatible with the legacy owner-only behaviour: the project owner
    (``Project.user_id``) always passes, even before the OWNER member row is
    backfilled, so nothing breaks mid-migration.
    """
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.is_active == True)  # noqa: E712
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    need = _required_rank(required_role)

    # Legacy/primary owner always satisfies any role requirement.
    if project.user_id == user.id:
        return project

    member = get_member(project_id, user.id, db)
    if member is not None and ROLE_RANK.get(member.role, 0) >= need:
        return project

    # Not a member (or insufficient role) — hide existence.
    raise HTTPException(status_code=404, detail="Project not found")


def project_owner(project: Project, db: Session) -> User:
    """Return the paying owner of a project.

    Quota/plan gates on a *shared* project must charge the OWNER, not the acting
    collaborator (a FREE collaborator editing a PRO owner's video consumes the
    owner's plan/quota). Falls back to ``Project.user_id`` which is always the owner.
    """
    owner = db.query(User).filter(User.id == project.user_id).first()
    if owner is None:
        # Should never happen (FK enforced) — fail loudly rather than silently
        # gating on the wrong user.
        raise HTTPException(status_code=404, detail="Project owner not found")
    return owner


def can_use_ai_edit(payer: User, project: Project) -> bool:
    """Whether an AI-assisted edit is permitted, charged to the paying ``payer``.

    Consumption hierarchy:
      1. Paid plan (PRO/STANDARD) → unlimited, consumes nothing.
      2. Free per-project allowance (``ai_assisted_editing_count`` < 3).
      3. The payer's per-user purchased AI-edit credit pool (``ai_edit_credits``).
    """
    from app.models.user import PlanTier

    if payer.plan in (PlanTier.PRO, PlanTier.STANDARD):
        return True
    if (project.ai_assisted_editing_count or 0) < 3:
        return True
    return (payer.ai_edit_credits or 0) > 0


def consume_ai_edit(payer: User, project: Project) -> None:
    """Spend one AI-assisted edit for a non-paid ``payer`` after an edit occurred.

    Mirrors ``can_use_ai_edit``'s hierarchy: fill the free per-project allowance
    first, then draw from the per-user purchased credit pool. Never called for
    PRO/STANDARD payers (their edits are unlimited and cost nothing). Mutates the
    ORM objects in place; the caller owns the commit.
    """
    if (project.ai_assisted_editing_count or 0) < 3:
        project.ai_assisted_editing_count = (project.ai_assisted_editing_count or 0) + 1
    else:
        payer.ai_edit_credits = max(0, (payer.ai_edit_credits or 0) - 1)


def is_owner(project: Project, user: User) -> bool:
    return project.user_id == user.id


def feature_owner_gate_message(payer: User, acting_user: User, feature: str) -> str:
    """Paid-feature 403 text that names whose plan is blocking.

    On a shared project the OWNER pays, so a collaborator blocked by a FREE owner
    cannot fix it by upgrading their own plan — tell them to ask the owner instead.
    ``feature`` is a short noun phrase like "AI image generation".
    """
    if payer.id == acting_user.id:
        return (
            f"{feature[0].upper()}{feature[1:]} is available on the Pro or Standard plan. "
            "Upgrade to unlock."
        )
    return (
        f"The project owner is on the Free plan, so {feature} isn't available here. "
        "Ask the owner to upgrade."
    )


def video_limit_message(payer: User, acting_user: User, action: str) -> str:
    """Limit-reached message that names whose quota is exhausted.

    On a shared project the OWNER pays, so a collaborator who hits the wall needs to
    know it's the *owner's* limit (they can't fix it by upgrading their own plan).
    ``action`` is a short phrase like "re-render" or "regenerate".
    """
    if payer.id == acting_user.id:
        return (
            f"Video limit reached ({payer.video_limit}). "
            f"Upgrade your plan or buy more credits to {action}."
        )
    return (
        f"The project owner's video limit ({payer.video_limit}) has been reached, "
        f"so you can't {action} right now. Ask the owner to upgrade or add credits."
    )
