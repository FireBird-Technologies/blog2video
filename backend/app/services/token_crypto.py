"""Symmetric encryption for stored third-party OAuth tokens.

The only consumer is SocialConnection (YouTube / X publishing grants). A stored
refresh token for ``youtube.upload`` is a standing capability to publish to
someone's channel, so it never touches the database in plaintext.

Fernet (AES-128-CBC + HMAC-SHA256, from ``cryptography``, already a dependency)
rather than anything hand-rolled: it is authenticated, so a tampered ciphertext
fails loudly instead of decrypting to garbage that would then be sent to Google
as a bearer token.

DEGRADING WITHOUT THE KEY
-------------------------
``SOCIAL_TOKEN_ENC_KEY`` is expected to be absent in plenty of legitimate
environments — local checkouts, CI, any deploy that has not turned publishing on.
Importing this module therefore NEVER raises, and neither does ``is_configured``.
Callers check ``is_configured()`` and disable the feature; the connect routes
return 503 and the capability endpoint reports the platform as unavailable, so
the UI simply never offers it.

What deliberately does NOT happen is a plaintext fallback. Storing the token
unencrypted "just for now" would silently downgrade every future user's
security, and nothing in the schema would record that it happened.

KEY ROTATION
------------
Changing the key does not migrate existing rows — they become undecryptable, and
``decrypt`` raises ``TokenCryptoError``. The caller's job is to mark that
connection ``error`` so the user is asked to reconnect. Rotating the key
therefore forces every connected user through OAuth again; that is the accepted
cost, and the reason to treat this key as long-lived.

Generate one with:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
import logging

from app.config import settings

logger = logging.getLogger(__name__)

# Sentinel distinguishing "never looked" from "looked, found nothing usable", so
# a missing/invalid key is diagnosed once rather than on every call.
_UNSET = object()
_fernet_cache: object = _UNSET


class TokenCryptoError(Exception):
    """Raised when a value cannot be encrypted or decrypted.

    Covers both "no usable key configured" and "this ciphertext does not belong
    to the current key" (the rotation case). Callers treat either as: this
    connection is unusable, ask the user to reconnect.
    """


def _fernet():
    """Return a cached Fernet, or None when no usable key is configured.

    Never raises: a malformed key is a configuration problem that must not take
    down an app that is not using this feature at all.
    """
    global _fernet_cache
    if _fernet_cache is not _UNSET:
        return _fernet_cache

    raw = (settings.SOCIAL_TOKEN_ENC_KEY or "").strip()
    if not raw:
        logger.warning(
            "[TOKEN_CRYPTO] SOCIAL_TOKEN_ENC_KEY is not set — social publishing "
            "(YouTube/X) is disabled. Generate a key with: python -c "
            '"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
        _fernet_cache = None
        return None

    try:
        from cryptography.fernet import Fernet

        _fernet_cache = Fernet(raw.encode("utf-8"))
    except Exception as exc:
        # A wrong-length or non-base64 key. Same outcome as absent: feature off.
        logger.error(
            "[TOKEN_CRYPTO] SOCIAL_TOKEN_ENC_KEY is present but invalid (%s) — "
            "social publishing is disabled. It must be a urlsafe-base64 32-byte "
            "Fernet key.",
            exc,
        )
        _fernet_cache = None
    return _fernet_cache


def is_configured() -> bool:
    """True when tokens can actually be encrypted and decrypted."""
    return _fernet() is not None


def reset_cache() -> None:
    """Drop the cached Fernet so the next call re-reads settings.

    For tests that monkeypatch ``SOCIAL_TOKEN_ENC_KEY``; the key does not change
    under a running server.
    """
    global _fernet_cache
    _fernet_cache = _UNSET


def encrypt(plaintext: str | None) -> str | None:
    """Encrypt a token. ``None``/empty passes through so optional tokens stay NULL."""
    if plaintext is None or plaintext == "":
        return None
    f = _fernet()
    if f is None:
        raise TokenCryptoError(
            "SOCIAL_TOKEN_ENC_KEY is not configured; refusing to store a token."
        )
    return f.encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(ciphertext: str | None) -> str | None:
    """Decrypt a stored token. ``None``/empty passes through.

    Raises TokenCryptoError if the key is missing or the ciphertext does not
    belong to it — never returns a partially-trusted value.
    """
    if ciphertext is None or ciphertext == "":
        return None
    f = _fernet()
    if f is None:
        raise TokenCryptoError(
            "SOCIAL_TOKEN_ENC_KEY is not configured; cannot decrypt a stored token."
        )
    try:
        return f.decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except Exception as exc:
        # InvalidToken, or a non-ascii/garbled column value. The usual cause is a
        # rotated key; the token is simply gone as far as we are concerned.
        raise TokenCryptoError(
            "Stored token could not be decrypted (the encryption key may have "
            "been rotated). The account must be reconnected."
        ) from exc
