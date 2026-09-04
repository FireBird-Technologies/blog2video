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


def can_use_ai_edit(payer: User, project: Optional[Project], cost: int = 1) -> bool:
    """Whether an AI-assisted edit costing ``cost`` credits is permitted.

    Charged to the paying ``payer`` (the project owner on shared projects), drawn
    from two pools: the plan's monthly allowance (``ai_edit_allowance_remaining``,
    0 on FREE) plus the non-expirable purchased pool (``ai_edit_credits`` — starts
    at ``FREE_AI_EDIT_CREDITS``, +``AI_EDIT_CREDITS_PER_VIDEO`` per purchased
    video). The edit is allowed only if the combined balance covers ``cost``.

    ``project`` is retained for signature stability but no longer gates, so it
    may be None for a credit spend that has no project at all (editing a scene
    of a custom template).
    """
    return payer.ai_edit_credits_available >= cost


def consume_ai_edit(payer: User, project: Optional[Project], cost: int = 1) -> None:
    """Spend ``cost`` AI-assisted-edit credits for ``payer``.

    Draws from the monthly plan allowance first, then the non-expirable
    purchased pool for any remainder (floored at zero). Mutates the ORM object
    in place; the caller owns the commit. ``project`` is unused (kept for
    signature stability with ``can_use_ai_edit``).
    """
    from_allowance = min(cost, payer.ai_edit_allowance_remaining)
    payer.ai_edits_used_this_period = (payer.ai_edits_used_this_period or 0) + from_allowance
    remainder = cost - from_allowance
    if remainder:
        payer.ai_edit_credits = max(0, (payer.ai_edit_credits or 0) - remainder)


def refund_ai_edit(payer: User, project: Optional[Project], cost: int = 1) -> None:
    """Return ``cost`` AI-edit credits to ``payer`` after a failed background edit.

    The inverse of :func:`consume_ai_edit`: reverses the same split, crediting
    the monthly allowance first (bounded by what's actually used this period)
    and any excess to the purchased pool. If the billing period rolled over
    between reserve and refund, ``ai_edits_used_this_period`` is already 0 and
    the whole amount lands in the purchased pool — the payer is never
    short-changed. Mutates in place; the caller owns the commit. ``project`` is
    unused (signature parity).
    """
    to_allowance = min(cost, payer.ai_edits_used_this_period or 0)
    payer.ai_edits_used_this_period = (payer.ai_edits_used_this_period or 0) - to_allowance
    remainder = cost - to_allowance
    if remainder:
        payer.ai_edit_credits = (payer.ai_edit_credits or 0) + remainder


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
            f"{feature[0].upper()}{feature[1:]} is available on the Lite, Standard, or Pro plan. "
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
