"""Reversible encryption of stored API keys, so owners can copy a key again.

Authentication never depends on this: keys are always checked by their SHA-256
hash (services/public_api_auth.py). The ciphertext only serves the "Copy" button
on the API keys page, via a session-authenticated endpoint that API keys
themselves cannot call.

Fernet (authenticated AES) with its own key, ``API_KEY_ENC_KEY``. When that is
unset, a key is derived from ``JWT_SECRET`` with a purpose label, so deployments
need nothing new. Once ``API_KEY_ENC_KEY`` is set, new copies are encrypted with
it while copies made earlier with the derived key still decrypt. Losing the key
that encrypted a copy only makes that key un-revealable (it keeps working; the
owner rotates to get a copyable one).
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.config import settings

_PURPOSE = b"blog2video/api-key-encryption/v1:"


def _derived() -> Fernet:
    derived = hashlib.sha256(_PURPOSE + settings.JWT_SECRET.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def _fernet() -> Fernet | MultiFernet:
    raw = (settings.API_KEY_ENC_KEY or "").strip()
    if raw:
        # Encrypts with the first key; decrypts with either.
        return MultiFernet([Fernet(raw.encode()), _derived()])
    return _derived()


def encrypt_key(raw: str) -> str:
    return _fernet().encrypt(raw.encode("utf-8")).decode("ascii")


def decrypt_key(token: str | None) -> str | None:
    """The plaintext key, or None if there is no copy or it can't be decrypted."""
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None
