"""Manage a user's public-API keys from the web app (JWT-authenticated).

Keys authenticate by their SHA-256 hash. An encrypted copy is also kept so the
owner can copy the full key again from the API keys page (``/reveal``); API
keys themselves can never call these routes (services/api_route_policy.py).
Keys require a paid plan, and a downgraded user's keys stop working at request
time (see services/public_api_auth.py) without being revoked.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.public_api import ApiKey
from app.models.user import User
from app.services.api_key_crypto import decrypt_key, encrypt_key
from app.services.public_api_auth import generate_key, hash_key, user_has_api_access

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])

MAX_ACTIVE_KEYS = 10


class ApiKeyCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ApiKeyOut(BaseModel):
    id: int
    name: str
    prefix: str
    last4: str
    created_at: datetime
    last_used_at: datetime | None = None
    # False for keys whose stored copy is missing or can't be decrypted: the
    # owner can still use them but must rotate to get a copyable one.
    can_reveal: bool = False

    class Config:
        from_attributes = True


class ApiKeyRevealOut(BaseModel):
    key: str


def _out(key: ApiKey) -> ApiKeyOut:
    return ApiKeyOut(
        id=key.id,
        name=key.name,
        prefix=key.prefix,
        last4=key.last4,
        created_at=key.created_at,
        last_used_at=key.last_used_at,
        can_reveal=decrypt_key(key.key_encrypted) is not None,
    )


class ApiKeyCreatedOut(ApiKeyOut):
    key: str


@router.get("", response_model=list[ApiKeyOut])
def list_keys(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    keys = (
        db.query(ApiKey)
        .filter(ApiKey.user_id == user.id, ApiKey.revoked_at.is_(None))
        .order_by(ApiKey.id.desc())
        .all()
    )
    return [_out(k) for k in keys]


@router.post("", response_model=ApiKeyCreatedOut, status_code=201)
def create_key(data: ApiKeyCreateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user_has_api_access(user):
        raise HTTPException(status_code=403, detail="API access requires a paid plan")
    active = db.query(ApiKey).filter(ApiKey.user_id == user.id, ApiKey.revoked_at.is_(None)).count()
    if active >= MAX_ACTIVE_KEYS:
        raise HTTPException(status_code=409, detail=f"You can have at most {MAX_ACTIVE_KEYS} active API keys")
    key, raw = _issue(user, data.name.strip())
    db.add(key)
    db.commit()
    db.refresh(key)
    return ApiKeyCreatedOut(**_out(key).model_dump(), key=raw)


def _issue(user: User, name: str) -> tuple[ApiKey, str]:
    raw = generate_key()
    key = ApiKey(
        user_id=user.id,
        name=name,
        prefix=raw[:12],
        last4=raw[-4:],
        key_hash=hash_key(raw),
        key_encrypted=encrypt_key(raw),
    )
    return key, raw


def _active_key(key_id: int, user: User, db: Session) -> ApiKey:
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id, ApiKey.revoked_at.is_(None)).first()
    if key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    return key


@router.post("/{key_id}/rotate", response_model=ApiKeyCreatedOut, status_code=201)
def rotate_key(key_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Replace a key: the old one stops working now and a new one (same name) is returned once.

    One commit, so a failure never leaves the user with neither key. Videos made
    with the old key stay reachable with the new one, since both belong to the
    same account.
    """
    if not user_has_api_access(user):
        raise HTTPException(status_code=403, detail="API access requires a paid plan")
    old = _active_key(key_id, user, db)
    old.revoked_at = datetime.utcnow()
    new, raw = _issue(user, old.name)
    db.add(new)
    db.commit()
    db.refresh(new)
    return ApiKeyCreatedOut(**_out(new).model_dump(), key=raw)


@router.get("/{key_id}/reveal", response_model=ApiKeyRevealOut)
def reveal_key(key_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The full key, for the Copy button. Owner's session only; never an API key."""
    if not user_has_api_access(user):
        raise HTTPException(status_code=403, detail="API access requires a paid plan")
    raw = decrypt_key(_active_key(key_id, user, db).key_encrypted)
    if raw is None:
        raise HTTPException(status_code=409, detail="This key can't be shown again. Rotate it to get a new one.")
    return ApiKeyRevealOut(key=raw)


@router.delete("/{key_id}", status_code=204)
def revoke_key(key_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    key = _active_key(key_id, user, db)
    key.revoked_at = datetime.utcnow()
    db.commit()
