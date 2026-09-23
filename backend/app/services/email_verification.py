"""Issue and consume the one-time codes that gate email/password auth.

Two rules here are deliberately stored in the database rather than in the
in-process rate limiter (services/rate_limit.py): the 60-second resend cooldown
and the 5-attempt burn. Those two MUST hold across workers and restarts — an
attacker who can reset a counter by waiting for a redeploy has no attempt limit
at all — whereas the per-IP limits are only a speed bump in front of Argon2.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.email_verification import EmailVerificationCode, VerificationPurpose
from app.observability.logging import get_logger

logger = get_logger(__name__)

CODE_LENGTH = 6
CODE_TTL_SECONDS = 10 * 60
MAX_CODE_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60

# Rows older than this are dead weight; swept opportunistically on issue.
_PURGE_AFTER = timedelta(days=1)


def generate_code() -> str:
    """A cryptographically random 6-digit code, zero-padded.

    ``secrets``, not ``random`` — the latter's Mersenne Twister state is
    recoverable from observed output. Returned as a STRING and kept one all the
    way to the client: ``039123`` is a valid code and an int would eat the zero.
    """
    return f"{secrets.randbelow(10 ** CODE_LENGTH):0{CODE_LENGTH}d}"


def hash_code(code: str) -> str:
    """sha256 hex of a code. See the model docstring for why this isn't a KDF."""
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _active_code(
    db: Session, email: str, purpose: VerificationPurpose
) -> EmailVerificationCode | None:
    """The newest unused code for this (email, purpose), if any."""
    return (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == purpose.value,
            EmailVerificationCode.used.is_(False),
        )
        .order_by(EmailVerificationCode.created_at.desc(), EmailVerificationCode.id.desc())
        .first()
    )


def purge_expired(db: Session) -> int:
    """Delete long-dead code rows. Cheap and indexed; called on issue."""
    cutoff = datetime.utcnow() - _PURGE_AFTER
    deleted = (
        db.query(EmailVerificationCode)
        .filter(EmailVerificationCode.expires_at < cutoff)
        .delete(synchronize_session=False)
    )
    return deleted or 0


def issue_code(
    db: Session,
    *,
    email: str,
    purpose: VerificationPurpose,
    pending_password_hash: str | None = None,
    pending_name: str | None = None,
) -> tuple[EmailVerificationCode, str]:
    """Create a fresh code, returning ``(row, plaintext_code)`` for the caller to send.

    Enforces the resend cooldown. Any previous code for this (email, purpose) is
    deleted, so exactly one is live at a time and an old code stops working the
    moment a new one is sent.

    Raises 429 ``resend_too_soon`` (with ``Retry-After``) inside the cooldown.
    The caller must commit — the code must be durable before the email goes out,
    or a send that succeeds against a rolled-back row hands the user a dead code.
    """
    now = datetime.utcnow()
    purge_expired(db)

    existing = _active_code(db, email, purpose)
    if existing is not None:
        elapsed = (now - existing.last_sent_at).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            retry_in = max(1, int(RESEND_COOLDOWN_SECONDS - elapsed))
            raise HTTPException(
                status_code=429,
                detail="resend_too_soon",
                headers={"Retry-After": str(retry_in)},
            )

    db.query(EmailVerificationCode).filter(
        EmailVerificationCode.email == email,
        EmailVerificationCode.purpose == purpose.value,
    ).delete(synchronize_session=False)

    code = generate_code()
    row = EmailVerificationCode(
        email=email,
        purpose=purpose.value,
        code_hash=hash_code(code),
        pending_password_hash=pending_password_hash,
        pending_name=pending_name,
        attempts=0,
        expires_at=now + timedelta(seconds=CODE_TTL_SECONDS),
        used=False,
        last_sent_at=now,
        created_at=now,
    )
    db.add(row)
    db.flush()
    return row, code


def consume_code(
    db: Session, *, email: str, purpose: VerificationPurpose, code: str
) -> EmailVerificationCode:
    """Verify a code and mark it used, or raise.

    Failure paths COMMIT the incremented attempt counter before raising. If they
    didn't, the router's rollback on the HTTPException would undo the increment
    and the 5-attempt cap would silently never trigger — the code could be
    brute-forced at whatever rate the per-IP limiter allows.

    Raises:
      400 ``code_invalid``  — no live code, or the wrong digits (with
                              ``attempts_remaining`` so the UI can warn).
      400 ``code_expired``  — past the 10-minute window.
      429 ``code_attempts_exceeded`` — 5th wrong try; the code is burned.
    """
    row = _active_code(db, email, purpose)
    if row is None:
        raise HTTPException(status_code=400, detail="code_invalid")

    if row.expires_at <= datetime.utcnow():
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=400, detail="code_expired")

    if not hmac.compare_digest(hash_code(code), row.code_hash):
        row.attempts = (row.attempts or 0) + 1
        if row.attempts >= MAX_CODE_ATTEMPTS:
            # Burn it: a code that has survived five guesses has leaked enough
            # signal that reissuing is the only safe move.
            db.delete(row)
            db.commit()
            logger.info("[AUTH] Burned %s code for %s after %d attempts",
                        purpose.value, email, MAX_CODE_ATTEMPTS)
            raise HTTPException(status_code=429, detail="code_attempts_exceeded")
        remaining = MAX_CODE_ATTEMPTS - row.attempts
        db.commit()
        raise HTTPException(
            status_code=400,
            detail={"code": "code_invalid", "attempts_remaining": remaining},
        )

    row.used = True
    db.flush()
    return row


def check_code(
    db: Session, *, email: str, purpose: VerificationPurpose, code: str
) -> None:
    """Validate a code WITHOUT spending it. Raises exactly as consume_code does.

    The reset flow needs this because the code authorizes the password change at
    the very end — consuming it at the "enter your code" step would leave nothing
    to submit the new password with. So this runs the same expiry / mismatch /
    burn logic and leaves ``used`` alone, letting the UI reject a wrong code up
    front while the real consumption still happens in forgot/complete.

    The attempt counter IS incremented and committed on a mismatch, same as
    consume_code — otherwise this endpoint would be a free, unlimited oracle for
    brute-forcing the code that consume_code carefully rate-limits.
    """
    row = _active_code(db, email, purpose)
    if row is None:
        raise HTTPException(status_code=400, detail="code_invalid")

    if row.expires_at <= datetime.utcnow():
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=400, detail="code_expired")

    if not hmac.compare_digest(hash_code(code), row.code_hash):
        row.attempts = (row.attempts or 0) + 1
        if row.attempts >= MAX_CODE_ATTEMPTS:
            db.delete(row)
            db.commit()
            logger.info("[AUTH] Burned %s code for %s after %d attempts",
                        purpose.value, email, MAX_CODE_ATTEMPTS)
            raise HTTPException(status_code=429, detail="code_attempts_exceeded")
        remaining = MAX_CODE_ATTEMPTS - row.attempts
        db.commit()
        raise HTTPException(
            status_code=400,
            detail={"code": "code_invalid", "attempts_remaining": remaining},
        )
    # Valid: deliberately no `used = True` — forgot/complete still consumes it.


def clear_codes(db: Session, *, email: str) -> None:
    """Drop every code for an email, whatever its purpose.

    Called after a password reset: an in-flight signup code for the same address
    must not remain replayable once the account's credential has changed.
    """
    db.query(EmailVerificationCode).filter(
        EmailVerificationCode.email == email
    ).delete(synchronize_session=False)
