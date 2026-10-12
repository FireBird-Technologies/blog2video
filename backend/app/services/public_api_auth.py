"""Authentication for the public video API (/api/v1).

One credential, sent as ``Authorization: Bearer b2v_live_...``: a blog2video
user's API key. The principal owns its videos and pays with its normal
blog2video plan; keys require a paid plan. An app serving its own users calls
with its owner's key from its backend and tags each video with that end user's
id (``external_user_id``).
"""
from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.public_api import ApiKey
from app.models.user import PlanTier, User

API_KEY_PREFIX = "b2v_live_"
_LAST_USED_RESOLUTION = timedelta(minutes=1)

optional_bearer = HTTPBearer(auto_error=False)


@dataclass
class ApiPrincipal:
    owner: User
    api_key: ApiKey


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def generate_key() -> str:
    return API_KEY_PREFIX + secrets.token_urlsafe(32)


def user_has_api_access(user: User) -> bool:
    return user.plan != PlanTier.FREE


def resolve_api_key(raw: str, db: Session) -> tuple[ApiKey, User]:
    """The active key and its owner, or 401 (unknown/revoked) / 403 (not paid).

    Shared by /api/v1 and get_current_user, so a key is judged the same way on
    every endpoint. The plan is re-checked on every request: a downgraded
    owner's keys stop working without being revoked.
    """
    key = db.query(ApiKey).filter(ApiKey.key_hash == hash_key(raw), ApiKey.revoked_at.is_(None)).first()
    if key is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    user = db.query(User).filter(User.id == key.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    if not user_has_api_access(user):
        raise HTTPException(status_code=403, detail="API access requires a paid plan")
    now = datetime.utcnow()
    if key.last_used_at is None or now - key.last_used_at > _LAST_USED_RESOLUTION:
        key.last_used_at = now
        db.commit()
    return key, user


def _api_key_principal(raw: str, db: Session) -> ApiPrincipal:
    key, user = resolve_api_key(raw, db)
    return ApiPrincipal(owner=user, api_key=key)


def get_api_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
    db: Session = Depends(get_db),
) -> ApiPrincipal:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Missing credentials")
    raw = credentials.credentials.strip()
    if not raw.startswith(API_KEY_PREFIX):
        raise HTTPException(status_code=401, detail="Invalid API key")
    return _api_key_principal(raw, db)
