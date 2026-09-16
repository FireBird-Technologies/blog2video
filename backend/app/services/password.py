"""Password hashing and policy for built-in email/password sign-in.

Argon2id via argon2-cffi. Chosen over bcrypt because bcrypt silently truncates
its input at 72 bytes — ``"a" * 72 + "X"`` and ``"a" * 72 + "Y"`` are the same
password to it — and the usual SHA-256 pre-hash workaround bakes an encoding
decision into every stored hash that can never be changed afterwards. Argon2id
has no input length limit and carries its parameters inside the encoded hash, so
the cost can be raised later and existing hashes upgraded on next login via
``needs_rehash``.

Policy is a length minimum plus two composition rules (one capital, one special
character). Note that composition rules are a product decision rather than a
security win — NIST SP 800-63B advises against them, because they push users
toward predictable substitutions ("Password1!") without adding much real entropy.
Length is what actually helps, which is why the minimum stays and is checked
first.
"""
from __future__ import annotations

import re

from fastapi import HTTPException

from argon2 import PasswordHasher
from argon2.exceptions import (
    HashingError,
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)

MIN_PASSWORD_LENGTH = 8
# Not a security limit — an upper bound on KDF input so a huge body can't be used
# to burn CPU. We reject rather than truncate: silently ignoring the tail is the
# exact bcrypt failure mode this module exists to avoid.
MAX_PASSWORD_LENGTH = 256

_UPPERCASE_RE = re.compile(r"[A-Z]")
# Anything that is not a letter or digit counts, including spaces and non-ASCII
# punctuation. Deliberately broad: the rule exists to widen the character space,
# and a narrow allowlist would reject a non-English speaker's perfectly good
# password for using the "wrong" symbol.
_SPECIAL_RE = re.compile(r"[^A-Za-z0-9]")

# Defaults are Argon2id with ~64 MiB per verify. That memory cost is per
# concurrent verification, so if the API runs on a small instance lower it to the
# OWASP 19 MiB profile (memory_cost=19456) rather than weakening time_cost.
_hasher = PasswordHasher()

# Precomputed hash of a value nobody can supply, used to equalize response time
# when an email has no account at all. Without it, "no such user" returns
# measurably faster than "wrong password" and the login endpoint becomes an
# account-existence oracle. Module-level so the cost is paid once at import.
_DUMMY_HASH = _hasher.hash("blog2video-nonexistent-account-timing-equalizer")


def validate_password(password: str) -> None:
    """Enforce the password policy, raising the API's error codes.

    Authoritative: the frontend mirrors these rules for instant feedback, but the
    browser is not a security boundary — anyone can POST straight to the API — so
    every path that SETS a password calls this.

    Critically, it is never called on the login path. The policy governs
    passwords being set, never ones being used: re-validating at sign-in would
    lock every existing user out of their own account the moment a rule is added.
    ``verify_password`` must stay free of policy for exactly that reason.

    Each failure has its own code so the UI can say precisely what is missing
    rather than restating the whole policy.
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=422, detail="password_too_short")
    if len(password) > MAX_PASSWORD_LENGTH:
        raise HTTPException(status_code=422, detail="password_too_long")
    if not _UPPERCASE_RE.search(password):
        raise HTTPException(status_code=422, detail="password_needs_uppercase")
    if not _SPECIAL_RE.search(password):
        raise HTTPException(status_code=422, detail="password_needs_special")


def hash_password(password: str) -> str:
    """Return an Argon2id encoded hash (algorithm, params and salt included)."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Check a password against a stored hash, returning False rather than raising.

    ``password_hash`` is None for every social account, which must read as "does
    not match" — never as an error the caller might mishandle into a successful
    login. A corrupt or unparseable hash is treated the same way. The dummy verify
    on the None path keeps the timing indistinguishable from a real mismatch.
    """
    if not password_hash:
        verify_password_dummy()
        return False
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False


def verify_password_dummy() -> None:
    """Burn one verification's worth of time against a throwaway hash.

    Called on paths that reject before a real hash is available (no such account),
    so response time doesn't reveal whether the email exists.
    """
    try:
        _hasher.verify(_DUMMY_HASH, "")
    except (VerifyMismatchError, InvalidHashError, VerificationError, HashingError):
        pass


def needs_rehash(password_hash: str | None) -> bool:
    """True when a stored hash predates the current Argon2 parameters.

    Callers re-hash on successful login, so raising the cost factor migrates
    accounts as their owners sign in, with no bulk job and no forced reset.
    """
    if not password_hash:
        return False
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return False
