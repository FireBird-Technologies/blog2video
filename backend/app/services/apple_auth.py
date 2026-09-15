"""Verify "Sign in with Apple" identity tokens.

Apple ships no server-side helper equivalent to Google's
``id_token.verify_oauth2_token``, so we do it by hand: fetch Apple's public
JWKS, pick the key named by the token header's ``kid``, and verify the RS256
signature plus the issuer/audience/expiry claims.

We verify the *identity token* the browser receives, rather than exchanging an
authorization code. That mirrors how the Google path works here and means no
Apple private key (and no client secret JWT) has to live in the deployment.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass

import jwt
import requests
from jwt import PyJWKSet

from app.config import settings
from app.observability.logging import get_logger

logger = get_logger(__name__)

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"

# Apple's relay addresses for "Hide My Email". Such an address is a distinct
# mailbox from the user's real one, so accepting it would create a second
# account for the same human — which defeats our one-account-per-email rule.
APPLE_PRIVATE_RELAY_DOMAIN = "@privaterelay.appleid.com"

# Apple rotates signing keys, so the fetched set is cached only briefly.
_JWKS_TTL_SECONDS = 6 * 60 * 60

_jwks_lock = threading.Lock()
_jwks_cache: PyJWKSet | None = None
_jwks_fetched_at: float = 0.0

# Fetched with `requests` rather than PyJWKClient: PyJWKClient uses urllib,
# which relies on the host's OpenSSL CA store and fails with
# CERTIFICATE_VERIFY_FAILED wherever that store isn't populated (macOS with a
# python.org build, slim containers). `requests` ships certifi, so this works
# the same everywhere.
_JWKS_TIMEOUT_SECONDS = 10


class AppleAuthError(ValueError):
    """Raised when an Apple identity token cannot be trusted."""


@dataclass(frozen=True)
class AppleIdentity:
    """The claims we care about from a verified Apple identity token."""

    apple_id: str          # stable per-user id ("sub"); never reused
    email: str
    email_verified: bool
    is_private_email: bool


def _get_jwks(force_refresh: bool = False) -> PyJWKSet:
    """Return Apple's signing-key set, refetching when stale or on demand."""
    global _jwks_cache, _jwks_fetched_at
    with _jwks_lock:
        expired = (time.time() - _jwks_fetched_at) > _JWKS_TTL_SECONDS
        if _jwks_cache is None or expired or force_refresh:
            resp = requests.get(APPLE_JWKS_URL, timeout=_JWKS_TIMEOUT_SECONDS)
            resp.raise_for_status()
            _jwks_cache = PyJWKSet.from_dict(resp.json())
            _jwks_fetched_at = time.time()
        return _jwks_cache


def _signing_key_for(identity_token: str, force_refresh: bool = False):
    """Select the JWK named by the token header's ``kid``."""
    kid = jwt.get_unverified_header(identity_token).get("kid")
    if not kid:
        raise AppleAuthError("Apple token header has no key id")
    for key in _get_jwks(force_refresh).keys:
        if key.key_id == kid:
            return key
    raise KeyError(f"no Apple signing key for kid {kid!r}")


def _claim_is_true(value: object) -> bool:
    """Apple sends these booleans as either real bools or the strings "true"/"false"."""
    return value is True or value == "true"


def verify_apple_identity_token(identity_token: str) -> AppleIdentity:
    """Verify an Apple identity token and return its identity claims.

    Raises AppleAuthError on any failure — an unfetchable JWKS, an unknown key,
    a bad signature, a wrong issuer/audience, an expired token, or a missing
    email claim. Callers map this to a 401.
    """
    if not settings.APPLE_CLIENT_ID:
        # Misconfiguration, not a bad token; surface it distinctly in the logs.
        logger.error("[APPLE AUTH] APPLE_CLIENT_ID is not configured")
        raise AppleAuthError("Apple sign-in is not configured")

    # A key rotated in after our cache was built shows up as an unknown kid, so
    # retry exactly once against a freshly fetched JWKS before giving up.
    last_error: Exception | None = None
    signing_key = None
    for force_refresh in (False, True):
        try:
            signing_key = _signing_key_for(identity_token, force_refresh)
            break
        except (KeyError, jwt.PyJWKError, requests.RequestException, ValueError) as e:
            last_error = e
    if signing_key is None:
        logger.error("[APPLE AUTH] Could not resolve Apple signing key: %s", last_error)
        raise AppleAuthError(f"Could not verify Apple token: {last_error}")

    try:
        claims = jwt.decode(
            identity_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.APPLE_CLIENT_ID,
            issuer=APPLE_ISSUER,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.InvalidTokenError as e:
        logger.warning("[APPLE AUTH] Identity token rejected: %s", e)
        raise AppleAuthError(f"Invalid Apple token: {e}")

    apple_id = claims.get("sub")
    email = (claims.get("email") or "").strip().lower()
    if not apple_id:
        raise AppleAuthError("Apple token has no subject")
    if not email:
        # Happens when the user revoked email sharing; we cannot key an account.
        raise AppleAuthError("Email not provided by Apple")

    return AppleIdentity(
        apple_id=apple_id,
        email=email,
        email_verified=_claim_is_true(claims.get("email_verified")),
        is_private_email=(
            _claim_is_true(claims.get("is_private_email"))
            or email.endswith(APPLE_PRIVATE_RELAY_DOMAIN)
        ),
    )


def full_name_from_apple_payload(payload: dict | None) -> str | None:
    """Build a display name from Apple's first-authorization ``user`` payload.

    Apple sends the user's name exactly once — on the first authorization, in a
    field alongside the token, never inside the token itself. The frontend
    forwards it when present; every later sign-in has nothing here.
    """
    if not isinstance(payload, dict):
        return None
    name = payload.get("name")
    if not isinstance(name, dict):
        return None
    parts = [
        str(name.get("firstName") or "").strip(),
        str(name.get("lastName") or "").strip(),
    ]
    full = " ".join(p for p in parts if p).strip()
    return full or None
