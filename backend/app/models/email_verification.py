"""Short-lived email verification codes for built-in email/password auth.

Two purposes share one table:

- SIGNUP — issued by ``/api/auth/email/register/start``. Holds the password the
  user typed, ALREADY HASHED, until the code is verified. This is why a pending
  registration lives here and not as an inactive ``users`` row: ``is_active=False``
  already means "soft-deleted, offer reactivation", and ``users.email`` is UNIQUE,
  so an abandoned signup parked there would squat the address forever and would be
  reported to other providers as a deleted account. The invariant this preserves is
  worth stating plainly: **a row in ``users`` always means a real, verified account.**
- PASSWORD_RESET — issued by ``/api/auth/password/forgot/start`` against an account
  that already exists, so it carries no pending password.

Modelled on ``MCPAuthCode`` (app/models/mcp_oauth.py): a code row with an expiry and
a used flag, deleted once spent.
"""
import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VerificationPurpose(str, enum.Enum):
    """What a code authorizes. Codes are scoped to one purpose so a signup code
    can never be replayed as a password reset (or vice versa)."""

    SIGNUP = "signup"
    PASSWORD_RESET = "password_reset"


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Not a foreign key: for SIGNUP no user exists yet, by design.
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)

    # sha256 hex of the 6-digit code — NOT a password hash. A 6-digit code has
    # only 10^6 possible values, so a slow KDF would cost real CPU on every
    # verify while an attacker holding the table brute-forces it offline
    # regardless. The defences that actually matter are the 5-attempt burn and
    # the 10-minute expiry below.
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # SIGNUP only: what becomes User.password_hash / User.name on verification.
    pending_password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pending_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    # Drives the resend cooldown. Stored here rather than in the in-process rate
    # limiter because this one must hold across workers and restarts.
    last_sent_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Deliberately NOT unique: issuing a code deletes prior rows for the same
    # (email, purpose) and inserts a fresh one, so at most one is live anyway.
    # A unique constraint would turn a benign double-submit into a 500.
    __table_args__ = (
        Index("ix_email_verification_codes_email_purpose", "email", "purpose"),
    )
