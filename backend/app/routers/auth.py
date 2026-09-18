"""
Authentication router.

Social (Google): the frontend sends the provider's ID token, the backend
verifies it and returns a JWT.

Built-in email + password: registration proves mailbox control with a one-time
code BEFORE any account exists, then every later sign-in is password-only. Both
providers share ``_finalize_login`` and the identity rules in
``app.services.auth_identity``, so one-account-per-email holds across them.
"""
import os
import re
import shutil
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.config import settings
from app.database import get_db
from app.models.user import User, AuthProvider, PlanTier, PAID_TIERS, FREE_TIER_INCLUDED_VIDEOS, FREE_TIER_CUSTOM_TEMPLATES, FREE_AI_EDIT_CREDITS
from app.services.auth_identity import (
    assert_email_available_for_password,
    create_password_user,
    resolve_or_create_user,
    resolve_password_user,
    _handle_soft_deleted,
)
from app.models.email_verification import EmailVerificationCode, VerificationPurpose
from app.services.email import email_service, EmailServiceError
from app.services import email_verification as verification
from app.services.password import (
    hash_password,
    needs_rehash,
    validate_password,
    verify_password,
)
from app.services import rate_limit
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


# ─── Email + password request models ─────────────────────────────────────────
# Addresses are validated with a deliberately permissive regex rather than
# pydantic's EmailStr: EmailStr needs the `email-validator` package, and a
# missing optional dependency there is an import-time crash of the entire API.
# Real validation is the one-time code — an address that cannot receive mail
# never becomes an account, whatever its shape.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Passwords are accepted at min_length=1 here and checked by validate_password()
# in the handler, so a too-short password returns our `password_too_short` code
# rather than pydantic's 422 envelope, which the frontend's error parser can't read.
_PasswordField = Field(min_length=1, max_length=512)
_CodeField = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class _EmailBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("invalid_email")
        return v


class EmailLoginRequest(_EmailBody):
    password: str = _PasswordField


class EmailRegisterStartRequest(_EmailBody):
    password: str = _PasswordField
    name: str | None = Field(default=None, max_length=255)


class EmailCodeRequest(_EmailBody):
    code: str = _CodeField


class EmailResendRequest(_EmailBody):
    pass


class ForgotPasswordStartRequest(_EmailBody):
    pass


class ForgotPasswordCompleteRequest(_EmailBody):
    code: str = _CodeField
    new_password: str = _PasswordField


class CodeSentResponse(BaseModel):
    """Acknowledges that a code was issued. Carries no account information."""
    status: str = "code_sent"
    expires_in: int = verification.CODE_TTL_SECONDS
    resend_in: int = verification.RESEND_COOLDOWN_SECONDS


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

    return AuthResponse(
        access_token=create_access_token(user.id, user.token_version or 0),
        user=_serialize_user(user),
    )


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
    If the email belongs to an email/password account, returns 409 wrong_auth_provider.
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


# ─── Built-in email + password ───────────────────────────────────────────────


def _send_code_or_502(send, to_email: str, code: str, *, kind: str) -> None:
    """Deliver a one-time code, converting provider failure into 502.

    The caller must have COMMITTED the code row first: if the send fails we want
    a durable, resendable code rather than a rolled-back one, so the user can
    simply press "Resend" instead of starting over.
    """
    try:
        send(to_email, code)
    except EmailServiceError as e:
        logger.error("[AUTH] Failed to send %s code to %s: %s", kind, to_email, e)
        raise HTTPException(status_code=502, detail="email_send_failed")


@router.post("/email/register/start", response_model=CodeSentResponse)
def email_register_start(
    body: EmailRegisterStartRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Begin email/password registration by emailing a one-time code.

    No account is created here. The password is hashed and parked on the code row
    until the address is verified, so an unverified email never puts a credential
    in the users table and never squats a unique email address.

    Errors, all raised BEFORE any code is issued or sent, and in this order —
    the address outranks the password, so someone who already has an account is
    told so rather than being asked to fix a password they will never use:
      409 wrong_auth_provider    — the address belongs to a social account.
      409 email_already_registered — the address is already an email/password
          account, whether live OR soft-deleted.
      422 password_too_short / password_too_long /
          password_needs_uppercase / password_needs_special — policy violation,
          raised only once the address is known to be free.

    A soft-deleted account deliberately answers the SAME 409 as a live one and
    never 403 account_deleted. Reactivation is a decision about an account you
    are signing in to, so it belongs to the login and password-reset flows, which
    authenticate first; offering it here would put a "Reactivate your account?"
    prompt on a form that says "Create your account" and hand it to anyone who
    guessed the address. Collapsing the two also stops this endpoint from
    reporting, unauthenticated, whether a known address is deleted or live.
    """
    rate_limit.register_limiter.check(rate_limit.client_key(request))

    email = body.email

    # The address is checked BEFORE the password policy, deliberately. These two
    # orderings answer different questions, and for an address that already has
    # an account the policy answer is noise: the user is being told to fix a
    # password they are not going to use, on a form they should not be on. The
    # only useful reply is "this account exists — sign in", whatever they typed.
    existing = assert_email_available_for_password(db, email)
    if existing is not None:
        # Identical response for live and soft-deleted; see the docstring. The
        # frontend routes both to the sign-in form, where a deleted account then
        # gets the reactivation prompt once the password is proven.
        rate_limit.register_limiter.record_failure(rate_limit.client_key(request))
        raise HTTPException(status_code=409, detail={"code": "email_already_registered"})

    # Only now does the password matter — this address is actually going to
    # become an account.
    validate_password(body.password)

    _row, code = verification.issue_code(
        db,
        email=email,
        purpose=VerificationPurpose.SIGNUP,
        pending_password_hash=hash_password(body.password),
        pending_name=(body.name or "").strip() or email.split("@")[0],
    )
    db.commit()

    _send_code_or_502(
        email_service.send_verification_code_email, email, code, kind="signup"
    )
    return CodeSentResponse()


@router.post("/email/register/verify", response_model=AuthResponse)
def email_register_verify(
    body: EmailCodeRequest,
    request: Request,
    ref_code: str | None = Query(None, description="Referral code from an invite link"),
    db: Session = Depends(get_db),
):
    """Verify the signup code and create the account.

    The provider check is repeated here, not just at start: a Google signup for
    the same address can land in the window between the two calls, and that must
    lose to the account that already exists rather than 500 on the unique index.
    """
    rate_limit.verify_limiter.check(rate_limit.client_key(request))

    email = body.email
    row = verification.consume_code(
        db, email=email, purpose=VerificationPurpose.SIGNUP, code=body.code
    )

    existing = assert_email_available_for_password(db, email)
    if existing is not None:
        raise HTTPException(status_code=409, detail={"code": "email_already_registered"})

    user, created = create_password_user(
        db,
        email=email,
        name=row.pending_name or email.split("@")[0],
        password_hash=row.pending_password_hash,
    )
    db.delete(row)

    rate_limit.verify_limiter.clear(rate_limit.client_key(request))
    return _finalize_login(db, user, created_new_user=created, ref_code=ref_code)


@router.post("/email/register/resend", response_model=CodeSentResponse)
def email_register_resend(
    body: EmailResendRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Re-send the signup code, reusing the password already captured at start.

    Returns 429 resend_too_soon (with Retry-After) inside the 60s cooldown, and
    400 no_pending_registration when there is nothing to resend.
    """
    rate_limit.resend_limiter.check(rate_limit.email_key(body.email))

    email = body.email
    pending = (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == VerificationPurpose.SIGNUP.value,
            EmailVerificationCode.used.is_(False),
        )
        .order_by(EmailVerificationCode.created_at.desc(), EmailVerificationCode.id.desc())
        .first()
    )
    if pending is None:
        rate_limit.resend_limiter.record_failure(rate_limit.email_key(body.email))
        raise HTTPException(status_code=400, detail="no_pending_registration")

    # Never re-ask for the password: reuse what start() hashed.
    _row, code = verification.issue_code(
        db,
        email=email,
        purpose=VerificationPurpose.SIGNUP,
        pending_password_hash=pending.pending_password_hash,
        pending_name=pending.pending_name,
    )
    db.commit()

    _send_code_or_502(
        email_service.send_verification_code_email, email, code, kind="signup"
    )
    return CodeSentResponse()


@router.post("/email/login", response_model=AuthResponse)
def email_login(
    body: EmailLoginRequest,
    request: Request,
    reactivate: bool = Query(False, description="Confirm reactivation of a previously deleted account"),
    db: Session = Depends(get_db),
):
    """Sign in with email and password. No code is sent — verification happened at signup.

    Ordering is deliberate and load-bearing:
      1. resolve_password_user  -> 409 wrong_auth_provider / 401 invalid_credentials
      2. verify_password        -> 401 invalid_credentials
      3. only THEN reactivation
    Checking the password before step 3 is what stops a wrong password plus
    ?reactivate=true from resurrecting a soft-deleted account on a failed login.
    """
    ip_key = rate_limit.client_key(request)
    mail_key = rate_limit.email_key(body.email)
    rate_limit.login_ip_limiter.check(ip_key)
    rate_limit.login_email_limiter.check(mail_key)

    def _reject() -> HTTPException:
        rate_limit.login_ip_limiter.record_failure(ip_key)
        rate_limit.login_email_limiter.record_failure(mail_key)
        return HTTPException(status_code=401, detail="invalid_credentials")

    # A 409 here is a correct answer for a legitimate user, so it must not count
    # as a failed attempt — otherwise someone who forgot they used Google gets
    # locked out for 15 minutes for asking.
    user = resolve_password_user(db, email=body.email)

    if not verify_password(body.password, user.password_hash):
        raise _reject()

    if not user.is_active:
        # Password is already proven; safe to run the reactivation gate, which
        # raises 403 account_deleted unless the client confirmed.
        _handle_soft_deleted(user, reactivate=reactivate, allow_reactivation=True)

    # Opportunistically migrate hashes to current Argon2 parameters while we
    # hold the plaintext. _finalize_login commits.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)

    rate_limit.login_ip_limiter.clear(ip_key)
    rate_limit.login_email_limiter.clear(mail_key)
    # ref_code is inert on login (no new user), passed as None to say so.
    return _finalize_login(db, user, created_new_user=False, ref_code=None)


@router.post("/password/forgot/start", response_model=CodeSentResponse)
def forgot_password_start(
    body: ForgotPasswordStartRequest,
    request: Request,
    reactivate: bool = Query(False, description="Confirm reactivation of a previously deleted account"),
    db: Session = Depends(get_db),
):
    """Email a password-reset code.

    Enumeration behaviour differs from registration on purpose. A social-owned
    address still returns 409 naming the provider, because the user needs to know
    there is no password to reset. But an address with NO account returns a
    normal 200 and sends nothing: there is no recovery path to offer, so naming
    it would turn this into a bulk address-harvesting endpoint for free.

    A soft-deleted account returns 403 account_deleted, and ``?reactivate=true``
    is the confirmation that revives it. This is the ONLY recovery path for
    someone who deleted their account and has also forgotten the password — the
    login route needs the old password, which by definition they don't have.

    Reactivation here deliberately issues no token: it restores the account and
    then emails the reset code exactly as for a live account, so the user still
    has to prove mailbox control and set a new password before
    ``forgot/complete`` signs them in. Reviving on an unauthenticated request is
    safe precisely because it grants no access — the mailbox, not this call, is
    what unlocks the account.
    """
    rate_limit.forgot_ip_limiter.check(rate_limit.client_key(request))
    rate_limit.forgot_email_limiter.check(rate_limit.email_key(body.email))

    email = body.email
    user = assert_email_available_for_password(db, email)

    if user is None:
        rate_limit.forgot_ip_limiter.record_failure(rate_limit.client_key(request))
        return CodeSentResponse()

    if not user.is_active:
        # Raises 403 account_deleted unless the client confirmed; on confirm it
        # restores the row in the session, committed below alongside the code.
        _handle_soft_deleted(user, reactivate=reactivate, allow_reactivation=True)
        logger.info("[AUTH] Reactivated account %s via password reset", user.id)

    _row, code = verification.issue_code(
        db, email=email, purpose=VerificationPurpose.PASSWORD_RESET
    )
    db.commit()

    _send_code_or_502(
        email_service.send_password_reset_code_email, email, code, kind="password reset"
    )
    return CodeSentResponse()


@router.post("/password/forgot/check")
def forgot_password_check(
    body: EmailCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Validate a reset code without spending it.

    Lets the UI reject a wrong code at the "enter your code" step instead of
    walking the user to the new-password screen and only failing on submit. The
    code is NOT consumed here — forgot/complete still does that, because it is
    what authorizes the actual password change.

    Same error codes as forgot/complete's consume step, including the shared
    attempt counter, so this cannot be used to brute-force the code for free.
    """
    rate_limit.verify_limiter.check(rate_limit.client_key(request))

    verification.check_code(
        db, email=body.email, purpose=VerificationPurpose.PASSWORD_RESET, code=body.code
    )
    return {"status": "code_valid"}


@router.post("/password/forgot/complete", response_model=AuthResponse)
def forgot_password_complete(
    body: ForgotPasswordCompleteRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Verify the reset code, set the new password, and sign the user in.

    The code is consumed here and nowhere earlier — verifying it in a separate
    round trip would spend it and leave nothing to authorize the actual change.
    """
    rate_limit.verify_limiter.check(rate_limit.client_key(request))

    email = body.email
    validate_password(body.new_password)

    verification.consume_code(
        db, email=email, purpose=VerificationPurpose.PASSWORD_RESET, code=body.code
    )

    user = resolve_password_user(db, email=email)
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="account_deleted",
            headers={"X-Account-Deleted": "true"},
        )

    user.password_hash = hash_password(body.new_password)
    # Revoke every token issued under the OLD password. This is the point of a
    # password reset when the account is already compromised: without it the
    # attacker's session survives the reset that was meant to evict them, for up
    # to 72 hours (30 days for an MCP refresh token). _finalize_login below reads
    # the bumped value, so the user's own new token is minted against it and they
    # stay signed in on this device.
    user.token_version = (user.token_version or 0) + 1
    # Drop every code for this address, both purposes: an in-flight signup code
    # must not stay replayable now that the credential has changed.
    verification.clear_codes(db, email=email)

    rate_limit.login_email_limiter.clear(rate_limit.email_key(email))
    return _finalize_login(db, user, created_new_user=False, ref_code=None)


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

    Bumps token_version so the JWT just used stops working immediately. Our
    tokens are stateless, so without this signing out would only clear the
    browser's copy and leave the credential valid for the rest of its 72 hours —
    which matters most on a shared or public machine, exactly where people press
    "log out" deliberately.

    Note this signs the account out everywhere, not just this browser: with one
    counter per user there is no way to revoke a single token. That is the
    conservative direction for a security control, and it is what "log out"
    already implies to most people.
    """
    user.token_version = (user.token_version or 0) + 1
    db.commit()
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
        # NOTE: password_hash is deliberately NOT cleared here. For an email
        # account it is the only credential, and reactivation authenticates with
        # it (POST /email/login?reactivate=true) — clearing it would make a
        # deleted email account uniquely unrecoverable, unlike every social one.
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
