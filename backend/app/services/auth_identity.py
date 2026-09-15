"""Resolve a verified social identity to a Blog2Video user account.

This is the single enforcement point for our identity rules, shared by the web
login endpoints and the MCP OAuth bridge so the two can never disagree about
which accounts may exist:

1. One account per email, forever. A second provider presenting an email that
   already exists is rejected — never linked, never duplicated.
2. An account is bound to the provider that created it, for life.
3. The wrong-provider error outranks the soft-delete/reactivation prompt, so a
   deleted account is told which provider reactivates it.

Callers pass an already-verified identity; token verification lives in the
provider-specific modules (google via the google-auth lib, apple via
``app.services.apple_auth``).
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

logger = get_logger(__name__)

# The column holding each provider's stable user id. Adding a provider is an
# entry here plus the matching column — the resolution rules below are
# deliberately provider-agnostic.
_PROVIDER_ID_COLUMN: dict[AuthProvider, str] = {
    AuthProvider.GOOGLE: "google_id",
    AuthProvider.APPLE: "apple_id",
    AuthProvider.MICROSOFT: "microsoft_id",
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
    refresh_name: bool = True,
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
            # Same provider, new subject id. Apple/Google subject ids are stable
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
        # Normal login: refresh profile fields from the provider. Apple sends a
        # name only on first authorization, so it passes refresh_name=False to
        # avoid clobbering the stored name with an email-derived placeholder.
        if refresh_name:
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
