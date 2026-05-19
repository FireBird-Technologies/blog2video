"""Identity resolution for support endpoints.

Returns (user_id | None, session_id). user_id is set when a valid JWT is present;
session_id is required (provided by frontend in `X-Support-Session` header).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status

from app.auth import decode_access_token

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class SupportIdentity:
    user_id: Optional[int]
    session_id: str


def _extract_jwt_user(request: Request) -> Optional[int]:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        return None
    parts = auth.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return decode_access_token(parts[1])


def get_support_identity(
    request: Request,
    x_support_session: str = Header(..., alias="X-Support-Session"),
) -> SupportIdentity:
    if not _UUID_RE.match(x_support_session):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Support-Session must be a UUIDv4",
        )
    user_id = _extract_jwt_user(request)
    return SupportIdentity(user_id=user_id, session_id=x_support_session.lower())
