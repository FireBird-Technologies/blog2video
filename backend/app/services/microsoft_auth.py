"""Verify "Sign in with Microsoft" ID tokens (Microsoft Entra ID / Azure AD).

Mirrors ``app.services.apple_auth``: fetch Microsoft's public JWKS, pick the key
named by the token header's ``kid``, and verify the RS256 signature plus the
audience, issuer and expiry claims.

We verify the *ID token* the browser receives from MSAL, rather than exchanging
an authorization code, so no client secret has to live in the deployment.
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

# The "common" endpoint accepts both personal Microsoft accounts (outlook.com,
# hotmail.com, live.com) and any organization's Microsoft 365 tenant.
MICROSOFT_JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys"

# Microsoft rotates signing keys, so the fetched set is cached only briefly.
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


class MicrosoftAuthError(ValueError):
    """Raised when a Microsoft ID token cannot be trusted."""


class MicrosoftNoEmailError(MicrosoftAuthError):
    """The token was valid but carried no usable email address.

    Distinct from the general error because it is a fixable account-settings
    problem rather than an untrusted token, so the router answers 400 (with
    specific UI copy) instead of 401.
    """


@dataclass(frozen=True)
class MicrosoftIdentity:
    """The claims we care about from a verified Microsoft ID token."""

    microsoft_id: str      # stable per-user object id ("oid")
    email: str
    name: str | None
    tenant_id: str | None


def _get_jwks(force_refresh: bool = False) -> PyJWKSet:
    """Return Microsoft's signing-key set, refetching when stale or on demand."""
    global _jwks_cache, _jwks_fetched_at
    with _jwks_lock:
        expired = (time.time() - _jwks_fetched_at) > _JWKS_TTL_SECONDS
        if _jwks_cache is None or expired or force_refresh:
            resp = requests.get(MICROSOFT_JWKS_URL, timeout=_JWKS_TIMEOUT_SECONDS)
            resp.raise_for_status()
            _jwks_cache = PyJWKSet.from_dict(resp.json())
            _jwks_fetched_at = time.time()
        return _jwks_cache


def _signing_key_for(id_token: str, force_refresh: bool = False):
    """Select the JWK named by the token header's ``kid``."""
    kid = jwt.get_unverified_header(id_token).get("kid")
    if not kid:
        raise MicrosoftAuthError("Microsoft token header has no key id")
    for key in _get_jwks(force_refresh).keys:
        if key.key_id == kid:
            return key
    raise KeyError(f"no Microsoft signing key for kid {kid!r}")


def _email_from_claims(claims: dict) -> str:
    """Pick the account's email address, or raise if there isn't a usable one.

    Without an email we cannot enforce one-account-per-email, so a token that
    carries none is rejected rather than being keyed on something else.
    ``preferred_username`` is the normal source for both personal and org
    accounts, but it is a UPN and is only trusted when actually email-shaped.
    """
    email = (claims.get("email") or "").strip().lower()
    if email:
        return email

    upn = (claims.get("preferred_username") or "").strip().lower()
    if "@" in upn:
        return upn

    raise MicrosoftNoEmailError("Email not provided by Microsoft")


def verify_microsoft_id_token(id_token: str) -> MicrosoftIdentity:
    """Verify a Microsoft ID token and return its identity claims.

    Raises MicrosoftAuthError on any failure — an unfetchable JWKS, an unknown
    key, a bad signature, a wrong audience/issuer, an expired token, or a
    missing email claim. Callers map this to a 401.
    """
    if not settings.MICROSOFT_CLIENT_ID:
        # Misconfiguration, not a bad token; surface it distinctly in the logs.
        logger.error("[MICROSOFT AUTH] MICROSOFT_CLIENT_ID is not configured")
        raise MicrosoftAuthError("Microsoft sign-in is not configured")

    # A key rotated in after our cache was built shows up as an unknown kid, so
    # retry exactly once against a freshly fetched JWKS before giving up.
    last_error: Exception | None = None
    signing_key = None
    for force_refresh in (False, True):
        try:
            signing_key = _signing_key_for(id_token, force_refresh)
            break
        except (KeyError, jwt.PyJWKError, requests.RequestException, ValueError) as e:
            last_error = e
    if signing_key is None:
        logger.error("[MICROSOFT AUTH] Could not resolve signing key: %s", last_error)
        raise MicrosoftAuthError(f"Could not verify Microsoft token: {last_error}")

    try:
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.MICROSOFT_CLIENT_ID,
            # The issuer is per-tenant under the "common" endpoint, so it cannot
            # be matched against one constant — it is checked against the
            # token's own `tid` below instead.
            options={"verify_iss": False, "require": ["exp", "iss", "aud"]},
        )
    except jwt.InvalidTokenError as e:
        logger.warning("[MICROSOFT AUTH] ID token rejected: %s", e)
        raise MicrosoftAuthError(f"Invalid Microsoft token: {e}")

    # Bind the issuer to the tenant that minted the token. Hard-coding a single
    # issuer would reject every organizational account; skipping the check would
    # accept a well-formed token from an unrelated tenant.
    tenant_id = claims.get("tid")
    issuer = claims.get("iss")
    if not tenant_id or issuer != f"https://login.microsoftonline.com/{tenant_id}/v2.0":
        logger.warning("[MICROSOFT AUTH] Issuer/tenant mismatch: iss=%r tid=%r", issuer, tenant_id)
        raise MicrosoftAuthError("Invalid Microsoft token issuer")

    # `oid` is the durable per-user object id. `sub` is pairwise per application
    # and changes if the app registration is recreated, which would strand every
    # existing account — so prefer `oid` and only fall back when it is absent.
    microsoft_id = claims.get("oid") or claims.get("sub")
    if not microsoft_id:
        raise MicrosoftAuthError("Microsoft token has no subject")

    return MicrosoftIdentity(
        microsoft_id=microsoft_id,
        email=_email_from_claims(claims),
        name=(claims.get("name") or "").strip() or None,
        tenant_id=tenant_id,
    )
