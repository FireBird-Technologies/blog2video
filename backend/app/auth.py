"""
Authentication utilities: JWT creation/verification and FastAPI dependency.
"""
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
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


def create_mcp_access_token(user_id: int, mcp_token_version: int = 0) -> str:
    """Create an access JWT for a hosted MCP OAuth connection.

    MCP credentials use their own revocation counter so ordinary website
    logout does not disconnect ChatGPT or Claude. The distinct token type lets
    API authentication select the MCP counter when a tool calls back into the
    Blog2Video API.
    """
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow()
        + timedelta(days=settings.MCP_ACCESS_TOKEN_EXPIRATION_DAYS),
        "iat": datetime.utcnow(),
        "typ": "mcp_access",
        "mtv": mcp_token_version,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: int, mcp_token_version: int = 0) -> str:
    """Create a JWT refresh token for a user (30-day TTL).

    Used by the MCP OAuth provider so MCP hosts can refresh access tokens
    without redoing the login. Carries the MCP-specific ``mtv`` claim, so a
    password reset disconnects the integration rather than leaving a 30-day
    credential alive behind a changed password. Website logout intentionally
    does not change this counter.
    """
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRATION_DAYS),
        "iat": datetime.utcnow(),
        "typ": "refresh",
        "mtv": mcp_token_version,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def token_version_is_current(payload: dict | None, user: "User") -> bool:
    """Whether a decoded token matches its credential class's counter.

    Website access tokens use ``tv``/``token_version``; MCP access tokens use
    ``mtv``/``mcp_token_version``. Tokens minted before ``tv`` existed are read
    as version 0 for backward compatibility.
    """
    if payload is None:
        return False
    if payload.get("typ") == "mcp_access":
        return int(payload.get("mtv", 0)) == int(user.mcp_token_version or 0)
    return int(payload.get("tv", 0)) == int(user.token_version or 0)


def decode_access_token(token: str) -> Optional[int]:
    """Decode and validate a JWT token. Returns user_id or None.

    Accepts website and MCP access tokens. Refresh tokens are credentials for
    the OAuth token endpoint only and must never authenticate a resource call.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("typ") == "refresh":
            return None
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
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: the calling user, from one of two credentials.

    - a blog2video session JWT: the web app; reaches every endpoint.
    - a ``b2v_live_...`` API key: the key's (paid) owner, limited to the core
      video endpoints in services/api_route_policy.py.

    ``request.state.auth_kind`` records which one it was.
    """
    raw = credentials.credentials.strip()
    if raw.startswith("b2v_live_"):
        from app.services.api_route_policy import enforce_api_key
        from app.services.public_api_auth import resolve_api_key

        key, owner = resolve_api_key(raw, db)
        enforce_api_key(request)
        request.state.auth_kind = "api_key"
        request.state.api_key_id = key.id
        return owner

    payload = decode_token_full(raw)
    # A refresh token is valid only at /mcp/token. It must never be accepted as
    # a bearer credential by the Blog2Video resource API.
    if payload and payload.get("typ") == "refresh":
        payload = None
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
    request.state.auth_kind = "jwt"
    return user
