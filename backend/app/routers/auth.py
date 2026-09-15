"""
Social authentication router (Google and Apple).
Frontend sends the provider's ID token, backend verifies it and returns a JWT.
"""
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.config import settings
from app.database import get_db
from app.models.user import User, AuthProvider, PlanTier, PAID_TIERS, FREE_TIER_INCLUDED_VIDEOS, FREE_TIER_CUSTOM_TEMPLATES, FREE_AI_EDIT_CREDITS
from app.services.auth_identity import resolve_or_create_user
from app.services.apple_auth import (
    APPLE_PRIVATE_RELAY_DOMAIN,
    AppleAuthError,
    full_name_from_apple_payload,
    verify_apple_identity_token,
)
from app.services.microsoft_auth import (
    MicrosoftAuthError,
    MicrosoftNoEmailError,
    verify_microsoft_id_token,
)
from app.models.project import Project
from app.models.subscription import Subscription
from app.auth import create_access_token, get_current_user
from app.services.voice_seed import ensure_free_voices_for_user
from app.models.referral import Referral, ReferralSignup, REFERRAL_BONUS_VIDEOS, REFERRAL_MAX_SIGNUPS
from app.services import r2_storage
from app.services.remotion import safe_remove_workspace, get_workspace_dir
from app.observability.logging import get_logger

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = get_logger(__name__)


class GoogleLoginRequest(BaseModel):
    credential: str  # Google ID token from frontend


class AppleLoginRequest(BaseModel):
    identity_token: str  # Apple identity token (JWT) from frontend
    # Apple returns the user's name ONLY on the very first authorization, in a
    # payload beside the token rather than inside it. The frontend forwards it
    # when present; every subsequent sign-in has nothing here.
    user: dict | None = None


class MicrosoftLoginRequest(BaseModel):
    id_token: str  # Microsoft ID token (JWT) from MSAL


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    picture: str | None
    plan: str
    videos_used_this_period: int
    video_limit: int
    can_create_video: bool
    ai_edit_credits: int = 0
    ai_edit_allowance_remaining: int = 0
    custom_templates_created: int = 0
    custom_template_limit: int = 0
    can_create_custom_template: bool = True
    preferred_voice_emotion: str | None = None
    survey_submitted: bool = False
    auth_provider: str = AuthProvider.GOOGLE.value

    class Config:
        from_attributes = True


# Fix forward ref
AuthResponse.model_rebuild()


def _bind_pending_collab_invites(user: User, db: Session) -> None:
    """Link collaboration invites addressed to this user's email to their account.

    Invites can be created before the invitee has an account (invite-by-email).
    On login we attach the ``user_id`` to any unbound pending rows for that email
    so they surface in the invitee's pending-invites list. Acceptance is still an
    explicit action; this only binds identity.
    """
    try:
        from app.models.project_member import ProjectMember, MemberStatus

        rows = (
            db.query(ProjectMember)
            .filter(
                ProjectMember.invited_email == user.email,
                ProjectMember.user_id.is_(None),
                ProjectMember.status == MemberStatus.PENDING,
            )
            .all()
        )
        changed = False
        for row in rows:
            row.user_id = user.id
            changed = True
        if changed:
            db.commit()
    except Exception as e:
        logger.warning("[COLLAB] Failed to bind pending invites for %s: %s", user.email, e)
        db.rollback()


def _apply_referral_bonus(ref_code: str, new_user: User, db: Session) -> None:
    try:
        referral = db.query(Referral).filter_by(code=ref_code, is_active=True).first()
        if not referral or referral.referrer_id == new_user.id:
            return

        # Prevent double-grant if this user already has a signup row (retry safety)
        existing = db.query(ReferralSignup).filter_by(new_user_id=new_user.id).first()
        if existing:
            return

        referrer = db.query(User).filter_by(id=referral.referrer_id).first()

        # Write to referral_video_bonus (permanent) — separate from expiring purchase credits
        new_user.referral_video_bonus = (new_user.referral_video_bonus or 0) + REFERRAL_BONUS_VIDEOS

        if referrer and (referrer.referrals_given or 0) < REFERRAL_MAX_SIGNUPS:
            referrer.referral_video_bonus = (referrer.referral_video_bonus or 0) + REFERRAL_BONUS_VIDEOS
            referrer.referrals_given = (referrer.referrals_given or 0) + 1

        db.add(ReferralSignup(referral_id=referral.id, new_user_id=new_user.id))
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        logger.error("[REFERRAL] Failed to apply bonus for user %s, code %r: %s", new_user.id, ref_code, e)


def _delete_project_storage(project: Project) -> None:
    """Delete all storage (local + R2) for a project."""
    if r2_storage.is_r2_configured():
        try:
            r2_storage.delete_project_files(project.user_id, project.id)
        except Exception as e:
            logger.error(
                "[DELETE_ACCOUNT] R2 deletion failed for project %s: %s",
                project.id,
                e,
                extra={"project_id": project.id, "user_id": project.user_id},
            )
    project_media = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}")
    if os.path.exists(project_media):
        safe_remove_workspace(get_workspace_dir(project.id))
        shutil.rmtree(project_media, ignore_errors=True)


def _serialize_user(user: User) -> UserOut:
    """Build the user payload returned by login and /me."""
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        plan=user.plan.value,
        videos_used_this_period=user.videos_used_this_period,
        video_limit=user.video_limit,
        can_create_video=user.can_create_video,
        ai_edit_credits=user.ai_edit_credits or 0,
        ai_edit_allowance_remaining=user.ai_edit_allowance_remaining,
        custom_templates_created=user.custom_templates_created,
        custom_template_limit=user.custom_template_limit,
        can_create_custom_template=user.can_create_custom_template,
        preferred_voice_emotion=user.preferred_voice_emotion,
        survey_submitted=user.survey_submitted,
        auth_provider=user.auth_provider.value,
    )


def _finalize_login(
    db: Session, user: User, *, created_new_user: bool, ref_code: str | None
) -> AuthResponse:
    """Shared tail of every social login: commit, grant bonuses, issue a JWT."""
    # Local testing: override plan if DEFAULT_PLAN is set in .env
    if settings.DEFAULT_PLAN and user.is_active:
        override = settings.DEFAULT_PLAN.upper()
        try:
            user.plan = PlanTier(override.lower())
        except ValueError:
            pass  # ignore invalid values

    db.commit()
    db.refresh(user)

    # Grant referral bonuses for brand-new users only
    if created_new_user and ref_code:
        _apply_referral_bonus(ref_code, user, db)

    # Bind any collaboration invites addressed to this email to the user account,
    # so pending invites created before the user existed show up for them to accept.
    _bind_pending_collab_invites(user, db)

    ensure_free_voices_for_user(db, user.id)

    return AuthResponse(access_token=create_access_token(user.id), user=_serialize_user(user))


@router.post("/google", response_model=AuthResponse)
def google_login(
    body: GoogleLoginRequest,
    reactivate: bool = Query(False, description="Confirm reactivation of a previously deleted account"),
    ref_code: str | None = Query(None, description="Referral code from an invite link"),
    db: Session = Depends(get_db),
):
    """
    Verify Google ID token and create/login user.
    Returns a JWT access token.
    If the email belongs to an Apple account, returns 409 wrong_auth_provider.
    If user was soft-deleted (is_active=False), returns 403 with account_deleted
    unless reactivate=true, in which case the account is reactivated as a free user.
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        logger.error("[AUTH ERROR] Google token verification failed: %s", e)
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    email = idinfo.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    user, created_new_user = resolve_or_create_user(
        db,
        provider=AuthProvider.GOOGLE,
        provider_user_id=idinfo["sub"],
        email=email,
        name=idinfo.get("name") or email.split("@")[0],
        picture=idinfo.get("picture"),
        reactivate=reactivate,
    )

    return _finalize_login(db, user, created_new_user=created_new_user, ref_code=ref_code)


@router.post("/apple", response_model=AuthResponse)
def apple_login(
    body: AppleLoginRequest,
    reactivate: bool = Query(False, description="Confirm reactivation of a previously deleted account"),
    ref_code: str | None = Query(None, description="Referral code from an invite link"),
    db: Session = Depends(get_db),
):
    """
    Verify an Apple identity token and create/login user.
    Mirrors the Google endpoint's contract exactly.

    Rejects "Hide My Email" relay addresses with 400 apple_private_email: a relay
    address is a different mailbox from the user's real one, so accepting it
    would create a second account for the same person.
    """
    try:
        identity = verify_apple_identity_token(body.identity_token)
    except AppleAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))

    if identity.is_private_email:
        raise HTTPException(status_code=400, detail="apple_private_email")

    apple_name = full_name_from_apple_payload(body.user)

    user, created_new_user = resolve_or_create_user(
        db,
        provider=AuthProvider.APPLE,
        provider_user_id=identity.apple_id,
        email=identity.email,
        name=apple_name or identity.email.split("@")[0],
        picture=None,  # Apple provides no profile picture
        # Only overwrite an existing account's name when Apple actually sent one
        # (first authorization only) — never with the email-derived fallback.
        refresh_name=apple_name is not None,
        reactivate=reactivate,
    )

    return _finalize_login(db, user, created_new_user=created_new_user, ref_code=ref_code)


@router.post("/microsoft", response_model=AuthResponse)
def microsoft_login(
    body: MicrosoftLoginRequest,
    reactivate: bool = Query(False, description="Confirm reactivation of a previously deleted account"),
    ref_code: str | None = Query(None, description="Referral code from an invite link"),
    db: Session = Depends(get_db),
):
    """
    Verify a Microsoft ID token and create/login user.
    Mirrors the Google endpoint's contract exactly. Accepts both personal
    Microsoft accounts (outlook.com/hotmail.com/live.com) and work/school
    accounts from any Microsoft 365 tenant.

    Returns 400 microsoft_no_email when the account shares no usable email
    address — without one we cannot enforce one-account-per-email.
    """
    try:
        identity = verify_microsoft_id_token(body.id_token)
    except MicrosoftNoEmailError:
        # Valid token, but the account shares no email — a fixable settings
        # problem rather than an untrusted token, so 400 with specific copy.
        raise HTTPException(status_code=400, detail="microsoft_no_email")
    except MicrosoftAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))

    user, created_new_user = resolve_or_create_user(
        db,
        provider=AuthProvider.MICROSOFT,
        provider_user_id=identity.microsoft_id,
        email=identity.email,
        # Unlike Apple, Microsoft sends `name` on every sign-in, so the stored
        # name can be refreshed normally.
        name=identity.name or identity.email.split("@")[0],
        picture=None,  # Graph photo needs a separate authenticated call
        reactivate=reactivate,
    )

    return _finalize_login(db, user, created_new_user=created_new_user, ref_code=ref_code)


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    """Get the current authenticated user."""
    return _serialize_user(user)


@router.post("/logout")
def logout_cleanup(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Handle logout. Data is NOT deleted here — the periodic cleanup task
    handles deletion after 24 hours for free-tier users.
    """
    return {"detail": "Logged out"}


@router.post("/delete-account")
def delete_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft-delete the user account. Permanently deletes all user data
    (projects, scenes, subscriptions, custom templates, voices) and marks
    the user as inactive. Login with reactivate=true will restore as free user.
    videos_used_this_period: free-only accounts keep usage (capped at the included free count if
    higher). Standard/Pro accounts are set to the included free count on delete so reactivation
    cannot regain the free grant after a paid subscription.
    """
    from app.models.subscription import Subscription
    from app.models.custom_template import CustomTemplate
    from app.models.saved_voice import SavedVoice
    from app.models.custom_voice import CustomVoice

    try:
        # 1. Cancel Stripe subscription immediately
        if user.stripe_subscription_id:
            try:
                import stripe
                stripe.api_key = settings.STRIPE_SECRET_KEY
                stripe.Subscription.delete(user.stripe_subscription_id)
            except Exception as e:
                logger.error(
                    "[DELETE_ACCOUNT] Stripe cancel failed for user %s: %s",
                    user.id,
                    e,
                    extra={"user_id": user.id},
                )

        # 2. Delete subscriptions (unlink project_id first to avoid FK issues)
        subs = db.query(Subscription).filter(Subscription.user_id == user.id).all()
        for sub in subs:
            sub.project_id = None
        db.flush()
        db.query(Subscription).filter(Subscription.user_id == user.id).delete()

        # 3. Delete project storage and projects
        projects = db.query(Project).filter(Project.user_id == user.id).all()
        for proj in projects:
            _delete_project_storage(proj)
            db.delete(proj)

        # 4. Remove this user's collaborator memberships on OTHER people's projects
        #    (their own projects were deleted above, cascading those member rows).
        #    Match by bound user_id or by the invited email for still-pending invites,
        #    so no ghost collaborator entry is left behind.
        from app.models.project_member import ProjectMember
        db.query(ProjectMember).filter(
            (ProjectMember.user_id == user.id)
            | (ProjectMember.invited_email == (user.email or "").lower())
        ).delete(synchronize_session=False)

        # 5. Delete saved voices, custom voices, custom templates
        db.query(SavedVoice).filter(SavedVoice.user_id == user.id).delete()
        db.query(CustomVoice).filter(CustomVoice.user_id == user.id).delete()
        db.query(CustomTemplate).filter(CustomTemplate.user_id == user.id).delete()

        # 6. Soft-delete user — normalize usage before plan becomes FREE (read plan first)
        was_paid = user.plan in PAID_TIERS
        if was_paid:
            # Paid users already had (or could have had) the free grant; do not let a low
            # post-upgrade counter (e.g. 1) become fresh free quota on reactivate.
            user.videos_used_this_period = FREE_TIER_INCLUDED_VIDEOS
        else:
            used = user.videos_used_this_period or 0
            if used > FREE_TIER_INCLUDED_VIDEOS:
                user.videos_used_this_period = FREE_TIER_INCLUDED_VIDEOS
        user.is_active = False
        user.stripe_customer_id = None
        user.stripe_subscription_id = None
        user.plan = PlanTier.FREE
        user.video_limit_bonus = 0
        user.referral_video_bonus = 0
        # Normalize the AI-edit pool to the free grant, mirroring videos/custom-templates:
        # cap it at FREE_AI_EDIT_CREDITS so purchased credits don't survive teardown, but
        # leave a user already below the free grant untouched.
        if (user.ai_edit_credits or 0) > FREE_AI_EDIT_CREDITS:
            user.ai_edit_credits = FREE_AI_EDIT_CREDITS
        user.period_start = None
        # Normalize the custom-template counter exactly like videos: cap it at the FREE
        # base so a reactivated user who had created ≥1 template stays at the limit
        # (can't create another), while a user at 0 stays at 0 (can create one). Drop
        # purchased slots (bonus), mirroring video_limit_bonus = 0.
        if was_paid:
            user.custom_templates_created = FREE_TIER_CUSTOM_TEMPLATES
        elif (user.custom_templates_created or 0) > FREE_TIER_CUSTOM_TEMPLATES:
            user.custom_templates_created = FREE_TIER_CUSTOM_TEMPLATES
        user.custom_template_bonus = 0
        # Normalize the /tools counters by the same rule: a paid user (or a free user
        # already at/over the cap) comes back at the FREE limit so reactivation cannot
        # refill quota, while a free user below it keeps their partial usage.
        user.cap_tool_usage_to_free(was_paid)

        db.commit()
        return {"detail": "Account deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(
            "[DELETE_ACCOUNT] Error for user %s: %s",
            user.id,
            e,
            extra={"user_id": user.id},
        )
        raise HTTPException(status_code=500, detail="Failed to delete account")
