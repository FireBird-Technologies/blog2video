"""Resolve a verified identity to a Blog2Video user account.

This is the single enforcement point for our identity rules, shared by the web
login endpoints and the MCP OAuth bridge so the two can never disagree about
which accounts may exist:

1. One account per email, forever. A second provider presenting an email that
   already exists is rejected — never linked, never duplicated.
2. An account is bound to the provider that created it, for life.
3. The wrong-provider error outranks the soft-delete/reactivation prompt, so a
   deleted account is told which provider reactivates it.

Two entry points apply those rules to two shapes of identity:

- ``resolve_or_create_user`` — social providers, which supply an external subject
  id. Callers pass an already-verified identity; token verification lives in the
  provider-specific modules (google via the google-auth lib). Google is currently
  the only one, but the path stays provider-agnostic: it is driven by
  ``_PROVIDER_ID_COLUMN``, so adding one back is an entry there plus a column.
- ``assert_email_available_for_password`` / ``resolve_password_user`` /
  ``create_password_user`` — our built-in email+password provider, which has no
  external subject id at all. They share ``wrong_provider_error``,
  ``_lookup_by_email`` and ``_handle_soft_deleted`` with the social path, so
  rules 1-3 hold identically across both.

Password auth is deliberately a parallel path rather than an extra entry in
``_PROVIDER_ID_COLUMN``: that map drives a lookup, a subject-id rebind and an
insert kwarg, all three of which are meaningless without a subject id. Mapping
EMAIL to None would need a guard at each site and would break the map's
fail-loudly property. The split has a second benefit — the MCP OAuth bridge calls
``resolve_or_create_user``, so password accounts structurally cannot reach it.
"""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import (
    AuthProvider,
    FREE_AI_EDIT_CREDITS,
    PlanTier,
    User,
)
from app.observability.logging import get_logger
from app.services.password import verify_password_dummy

logger = get_logger(__name__)

# The column holding each provider's stable user id. Adding a SOCIAL provider is
# an entry here plus the matching column — the resolution rules below are
# deliberately provider-agnostic.
#
# AuthProvider.EMAIL is intentionally absent: our built-in provider has no
# external subject id (the credential is users.password_hash). Its absence is
# load-bearing — _lookup_by_provider_id raising KeyError for EMAIL is what
# guarantees the social path can never be entered with a password account.
_PROVIDER_ID_COLUMN: dict[AuthProvider, str] = {
    AuthProvider.GOOGLE: "google_id",
}


def wrong_provider_error(user: User) -> HTTPException:
    """409 telling the client which provider owns this email.

    The body is machine-readable so the login modal can offer a one-click
    switch to the correct provider, and ``deleted`` lets it use reactivation
    wording without a second round-trip.
    """
    provider: AuthProvider = user.auth_provider
    return HTTPException(
        status_code=409,
        detail={
            "code": "wrong_auth_provider",
            "provider": provider.value,
            "provider_label": provider.label,
            "deleted": not user.is_active,
        },
    )


def _lookup_by_provider_id(
    db: Session, provider: AuthProvider, provider_user_id: str
) -> User | None:
    column = getattr(User, _PROVIDER_ID_COLUMN[provider])
    return db.query(User).filter(column == provider_user_id).first()


def _lookup_by_email(db: Session, email: str) -> User | None:
    # Existing rows predate email normalization and may be mixed-case, so
    # compare case-insensitively rather than on the raw string.
    return db.query(User).filter(func.lower(User.email) == email).first()


def resolve_or_create_user(
    db: Session,
    *,
    provider: AuthProvider,
    provider_user_id: str,
    email: str,
    name: str,
    picture: str | None = None,
    reactivate: bool = False,
    allow_reactivation: bool = True,
) -> tuple[User, bool]:
    """Return ``(user, created)`` for a verified identity.

    Raises HTTPException:
      - 409 ``wrong_auth_provider`` — the email belongs to another provider.
      - 403 ``account_deleted``     — same-provider account is soft-deleted and
                                      ``reactivate`` was not requested.
      - 403 ``Account is deactivated`` — soft-deleted where reactivation is not
                                      available (``allow_reactivation=False``,
                                      used by the MCP bridge, which cannot
                                      drive a confirmation prompt).
    """
    email = email.strip().lower()

    user = _lookup_by_provider_id(db, provider, provider_user_id)
    created = False

    if not user:
        # The email may already belong to an account — from this provider under
        # a new subject id, or (the case that matters) from the other provider.
        existing = _lookup_by_email(db, email)
        if existing:
            if existing.auth_provider is not provider:
                raise wrong_provider_error(existing)
            # Same provider, new subject id. Google subject ids are stable
            # and never reused, so this is a re-issue rather than a new person;
            # adopt the new id instead of stranding the account.
            logger.info(
                "[AUTH] Rebinding %s id for user %s (subject changed)",
                provider.value,
                existing.id,
            )
            setattr(existing, _PROVIDER_ID_COLUMN[provider], provider_user_id)
            user = existing
        else:
            user, created = _create_user(
                db,
                provider=provider,
                provider_user_id=provider_user_id,
                email=email,
                name=name,
                picture=picture,
            )

    if not created and not user.is_active:
        _handle_soft_deleted(user, reactivate=reactivate, allow_reactivation=allow_reactivation)
    elif not created:
        # Normal login: refresh profile fields from the provider, which is
        # authoritative for them and sends both on every sign-in.
        user.name = name
        user.picture = picture or user.picture

    return user, created


def _create_user(
    db: Session,
    *,
    provider: AuthProvider,
    provider_user_id: str,
    email: str,
    name: str,
    picture: str | None,
) -> tuple[User, bool]:
    """Insert a new account, tolerating a concurrent first-login for the same email."""
    user = User(
        email=email,
        name=name,
        picture=picture,
        auth_provider=provider,
        plan=PlanTier.FREE,
        videos_used_this_period=0,
        video_limit_bonus=0,
        is_active=True,
        **{_PROVIDER_ID_COLUMN[provider]: provider_user_id},
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        # Two first-logins raced on the unique email/provider-id index. Roll back
        # and re-resolve against the row the winner committed, so the loser gets
        # a normal login (or the correct 409) instead of a raw 500.
        db.rollback()
        logger.info("[AUTH] Concurrent signup for %s; re-resolving", email)
        winner = _lookup_by_provider_id(db, provider, provider_user_id) or _lookup_by_email(
            db, email
        )
        if winner is None:
            raise
        if winner.auth_provider is not provider:
            raise wrong_provider_error(winner)
        return winner, False
    return user, True


# ─── Built-in email + password provider ─────────────────────────────────────


def assert_email_available_for_password(db: Session, email: str) -> User | None:
    """Gate an email address for password signup/reset. Returns the existing row, if any.

    Raises 409 ``wrong_auth_provider`` when the address belongs to a social
    account. Callers MUST run this before hashing a password, before issuing a
    one-time code, and before sending any email — so someone whose address is
    already a Google account is told so immediately rather than after a pointless
    round trip through their inbox.

    Enumeration, deliberately: a 409 confirms both that the address is registered
    and which provider owns it. That is the point — the login modal turns it into
    a one-click switch to the right provider, and the alternative is a user who
    cannot sign in and is told nothing about why. Do not "fix" this into a
    generic error without replacing that recovery path. Where there is no such UX
    payoff (a forgotten password for an address with no account at all) the
    routers stay quiet instead; see routers/auth.py.

    Returns None when the address is free, or the ``User`` when it is an existing
    EMAIL account — the caller decides what that means, since it is
    ``email_already_registered`` for signup but the normal case for a reset.
    """
    existing = _lookup_by_email(db, email.strip().lower())
    if existing is not None and existing.auth_provider is not AuthProvider.EMAIL:
        raise wrong_provider_error(existing)
    return existing


def resolve_password_user(db: Session, *, email: str) -> User:
    """Return the EMAIL account for ``email``, or raise the login error.

    Deliberately does NOT touch ``is_active``. A soft-deleted account must have
    its password verified before ``_handle_soft_deleted`` reactivates it —
    otherwise a wrong password plus ``?reactivate=true`` would resurrect someone
    else's account on a request that then returns 401. The router owns that
    ordering; see ``email_login``.

    Raises:
      409 ``wrong_auth_provider`` — the address belongs to a social provider.
      401 ``invalid_credentials`` — no such account (body and timing identical to
                                    a wrong password, so this is not an
                                    account-existence oracle).
    """
    user = _lookup_by_email(db, email.strip().lower())
    if user is None:
        # Burn a verification's worth of time so "no such account" is not
        # measurably faster than "wrong password".
        verify_password_dummy()
        raise HTTPException(status_code=401, detail="invalid_credentials")
    if user.auth_provider is not AuthProvider.EMAIL:
        raise wrong_provider_error(user)
    return user


def create_password_user(
    db: Session, *, email: str, name: str, password_hash: str
) -> tuple[User, bool]:
    """Insert a verified email/password account, tolerating a concurrent signup.

    Only ever called after a one-time code has proven mailbox control, which is
    what lets a row appear in ``users`` at all — see
    ``app/models/email_verification.py``.
    """
    email = email.strip().lower()
    user = User(
        email=email,
        name=name,
        picture=None,
        auth_provider=AuthProvider.EMAIL,
        password_hash=password_hash,
        plan=PlanTier.FREE,
        videos_used_this_period=0,
        video_limit_bonus=0,
        is_active=True,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        # Two signups raced on the unique email index. Mirror _create_user: roll
        # back and re-resolve against the row the winner committed, so the loser
        # gets the correct 409 instead of a raw 500.
        db.rollback()
        logger.info("[AUTH] Concurrent password signup for %s; re-resolving", email)
        winner = _lookup_by_email(db, email)
        if winner is None:
            raise
        if winner.auth_provider is not AuthProvider.EMAIL:
            raise wrong_provider_error(winner)
        # Do NOT adopt the winner's row: its password hash is a different secret
        # from the one this request just verified, so logging this caller in
        # would hand them an account whose password they may not know.
        raise HTTPException(
            status_code=409, detail={"code": "email_already_registered"}
        )
    return user, True


def _handle_soft_deleted(
    user: User, *, reactivate: bool, allow_reactivation: bool
) -> None:
    """Gate a soft-deleted account, reactivating it as a fresh FREE user on confirm."""
    if not allow_reactivation:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    if not reactivate:
        raise HTTPException(
            status_code=403,
            detail="account_deleted",
            headers={"X-Account-Deleted": "true"},
        )
    # Reactivate: free user; keep videos_used_this_period (not reset on delete)
    user.is_active = True
    user.plan = PlanTier.FREE
    user.video_limit_bonus = 0
    user.referral_video_bonus = 0
    # Reactivation = fresh FREE account: restore the free AI-edit grant. Purchased
    # credits are already dropped on delete (capped to the free grant there); this
    # also lifts any legacy account zeroed by an older delete path back to the grant.
    user.ai_edit_credits = FREE_AI_EDIT_CREDITS
    user.period_start = None
    user.stripe_customer_id = None
    user.stripe_subscription_id = None
