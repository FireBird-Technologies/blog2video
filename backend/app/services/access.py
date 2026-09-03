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
from sqlalchemy import case, update
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


def can_use_ai_edit(payer: User, project: Project, cost: int = 1) -> bool:
    """Whether an AI-assisted edit costing ``cost`` credits is permitted.

    Charged to the paying ``payer`` (the project owner on shared projects), drawn
    from two pools: the plan's monthly allowance (``ai_edit_allowance_remaining``,
    0 on FREE) plus the non-expirable purchased pool (``ai_edit_credits`` — starts
    at ``FREE_AI_EDIT_CREDITS``, +``AI_EDIT_CREDITS_PER_VIDEO`` per purchased
    video). The edit is allowed only if the combined balance covers ``cost``.

    ``project`` is retained for signature stability but no longer gates.
    """
    return payer.ai_edit_credits_available >= cost


def consume_ai_edit(payer: User, project: Project, cost: int = 1) -> None:
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


def refund_ai_edit(payer: User, project: Project, cost: int = 1) -> None:
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


# Avatar generation is priced per SCENE, and much higher than a text edit: each
# scene is a real lip-sync render on a dedicated GPU, not an LLM call.
AVATAR_CREDIT_COST_PER_SCENE = 10

# Bounds on one batch. The floor exists so a batch is worth its fixed overhead;
# the ceiling caps what a single authorization can spend. The floor is waived
# when the project simply does not HAVE five eligible scenes — see
# avatar_batch_min_scenes.
AVATAR_BATCH_MAX_SCENES = 10
AVATAR_BATCH_MIN_SCENES = 5


def avatar_batch_min_scenes(eligible_count: int) -> int:
    """Smallest batch this project can authorize.

    Normally AVATAR_BATCH_MIN_SCENES, but a project with fewer eligible scenes
    than that could otherwise never use avatars at all — and neither could a
    project down to its last few scenes without one (the "generate the
    remaining scenes" path). In both cases the floor becomes what is available.

    Defined here rather than in the endpoint so the UI and the server derive the
    same number from the same rule.
    """
    return min(AVATAR_BATCH_MIN_SCENES, max(0, eligible_count))


def can_afford_avatars(payer: User, scene_count: int) -> bool:
    """Whether ``payer``'s PLAN ALLOWANCE covers avatars for ``scene_count`` scenes.

    Charged strictly against the monthly plan allowance
    (``ai_edit_allowance_remaining`` = PLAN_AI_EDIT_ALLOWANCE[plan] −
    ai_edits_used_this_period). The purchased ``ai_edit_credits`` pool is
    deliberately NOT consulted, which is what makes avatars a subscription
    entitlement rather than something buyable a video at a time: a FREE user has
    allowance 0 and can never afford one (the UI asks them to upgrade), while a
    paid subscriber who exhausts the period is asked to contact support.

    Do NOT add an ``ai_edit_credits`` fallback here to match can_use_ai_edit a
    few lines up — that would silently re-open the free tier, since every user
    starts with FREE_AI_EDIT_CREDITS in that pool.
    """
    return payer.ai_edit_allowance_remaining >= scene_count * AVATAR_CREDIT_COST_PER_SCENE


def consume_avatar_credits(payer: User, scene_count: int) -> None:
    """Spend the plan allowance for a batch of ``scene_count`` avatars.

    Charged for every plan that HAS an allowance (see can_afford_avatars).
    Advances the period counter only — the purchased ``ai_edit_credits`` pool is
    never touched by the avatar path. Mutates the ORM object in place; the caller
    owns the commit. No upper clamp is needed because can_afford_avatars gates
    the call; non-atomic read-modify-write matches consume_ai_edit, which is
    pre-existing accepted behaviour here rather than something introduced.
    """
    payer.ai_edits_used_this_period = (
        (payer.ai_edits_used_this_period or 0)
        + scene_count * AVATAR_CREDIT_COST_PER_SCENE
    )


def refund_avatar_credits(db: Session, payer_user_id: int, scene_count: int) -> int:
    """Give back the allowance for ``scene_count`` avatars that will never render.

    The inverse of consume_avatar_credits, with two deliberate differences.

    ALLOWANCE ONLY, exactly inverting consume_avatar_credits: the refund
    SUBTRACTS from ``ai_edits_used_this_period``, giving the user back the
    expenditure they were charged. ``ai_edit_credits`` is a different-purpose
    pool and is NEVER credited here — doing so would mint permanent purchased
    credits out of allowance-funded spend. Do not reuse refund_ai_edit, which
    does exactly that once the period counter runs out.

    ATOMIC, unlike the charge. consume_avatar_credits mutates the ORM object and
    is documented-accepted non-atomic, but this runs from a WORKER THREAD on its
    own session: a read-modify-write here would race a concurrent
    authorize_avatar_batch from the same owner and write back a stale counter,
    silently swallowing a charge. A guarded UPDATE cannot.

    ONLY ``ai_edits_used_this_period``. Do NOT reuse refund_ai_edit, which sits a
    few lines up and looks like the obvious helper: it credits the monthly
    allowance first and only spills over into the PURCHASED pool. Avatars are
    charged purely against the allowance (see consume_avatar_credits), so
    routing a refund through that split would mint purchased credits the user
    never bought.

    FLOORED AT ZERO, unlike a credit balance that only ever goes up. This gives
    back a usage COUNTER, and reset_ai_edit_period() zeroes that counter at a
    billing rollover — so a batch charged just before a reset and refunded just
    after would drive it negative, silently handing the user free allowance for
    the new period. The floor is what stops that.

    Does not commit — the caller owns the transaction, so the counter change and
    the credits_refunded flags land together or not at all.

    Returns the credits nominally refunded (0 if scene_count <= 0).
    """
    if scene_count <= 0:
        return 0
    amount = scene_count * AVATAR_CREDIT_COST_PER_SCENE
    # DIAGNOSTIC: name the caller. Refunds have been firing for scenes that were
    # still rendering, and the two paths that should be responsible (the boot
    # reaper and the batch-settled sweep) both logged nothing for those events —
    # so the actual origin is still unidentified. A stack snippet here cannot be
    # bypassed by whichever path it turns out to be.
    import logging, traceback
    logging.getLogger(__name__).warning(
        "[AVATAR_REFUND] refund_avatar_credits(user=%s, scenes=%s, amount=%s) "
        "called from:\n%s",
        payer_user_id, scene_count, amount,
        "".join(traceback.format_stack(limit=12)[:-1]),
    )
    used = User.ai_edits_used_this_period
    # CASE rather than func.max/greatest: portable across SQLite (dev) and
    # Postgres, which disagree on the name and arity of the scalar max.
    # min(amount, used) — never drive the counter below zero.
    give_back = case((used < amount, used), else_=amount)
    db.execute(
        update(User)
        .where(User.id == payer_user_id)
        .values(
            ai_edits_used_this_period=case(
                (User.ai_edits_used_this_period < amount, 0),
                else_=User.ai_edits_used_this_period - amount,
            )
        )
    )
    return amount


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
