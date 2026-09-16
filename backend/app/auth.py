"""
Authentication utilities: JWT creation/verification and FastAPI dependency.
"""
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

security = HTTPBearer()


REFRESH_TOKEN_EXPIRATION_DAYS = 30


def create_access_token(user_id: int, token_version: int = 0) -> str:
    """Create a JWT access token for a user.

    ``token_version`` stamps the account's current revocation counter into the
    token; see ``token_version_is_current``. It defaults to 0 so callers that
    only hold a user id still mint a working token for an account that has never
    revoked anything — but any path that CAN pass the real value should, or a
    later bump will not invalidate the token it issued.
    """
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow(),
        "typ": "access",
        "tv": token_version,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: int, token_version: int = 0) -> str:
    """Create a JWT refresh token for a user (30-day TTL).

    Used by the MCP OAuth provider so claude.ai can refresh access tokens
    without redoing the Google login. Carries the same ``tv`` claim, so a
    password reset disconnects the integration rather than leaving a 30-day
    credential alive behind a changed password.
    """
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRATION_DAYS),
        "iat": datetime.utcnow(),
        "typ": "refresh",
        "tv": token_version,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def token_version_is_current(payload: dict | None, user: "User") -> bool:
    """Whether a decoded token is still valid for ``user``'s revocation counter.

    Tokens minted before the ``tv`` claim existed are treated as version 0, which
    is every account's starting value — so deploying this does not sign anyone
    out. Once an account revokes for the first time its counter moves to 1 and
    those legacy tokens stop validating along with everything else.
    """
    if payload is None:
        return False
    return int(payload.get("tv", 0)) == int(user.token_version or 0)


def decode_access_token(token: str) -> Optional[int]:
    """Decode and validate a JWT token. Returns user_id or None.

    Accepts both access and refresh tokens — callers that need to distinguish
    should use decode_token_full() instead.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = int(payload.get("sub", 0))
        return user_id if user_id else None
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError):
        return None


def decode_token_full(token: str) -> Optional[dict]:
    """Decode a JWT and return the full payload, or None if invalid.

    Use this when you need to check the `typ` claim (access vs. refresh).
    """
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError):
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: extract and validate the current user from JWT."""
    payload = decode_token_full(credentials.credentials)
    try:
        user_id = int(payload["sub"]) if payload else 0
    except (KeyError, TypeError, ValueError):
        user_id = 0
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    # Revoked: the account's counter has moved on since this token was issued.
    # Same 401 as an expired token, because to the client it means the same
    # thing — sign in again — and distinguishing them tells an attacker holding
    # a stale token that the account exists and was deliberately cut off.
    if not token_version_is_current(payload, user):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return user
