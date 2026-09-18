"""OAuth plumbing shared by the social publishing platforms.

Holds the pieces that are about the *flow* rather than about YouTube or X
specifically: per-platform client configuration, the signed CSRF state, and the
HTML the popup renders on its way back.
"""
import base64
import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode, urlparse

import jwt

from app.config import settings
from app.models.social_connection import PLATFORM_X, PLATFORM_YOUTUBE
from app.services import token_crypto

logger = logging.getLogger(__name__)

SUPPORTED_PLATFORMS = (PLATFORM_YOUTUBE, PLATFORM_X)

# Short: the state only has to survive one consent screen. A leaked authorize URL
# (browser history, a shoulder-surfed address bar, a referrer header) stops being
# replayable quickly.
STATE_TTL_MINUTES = 10
_STATE_TYP = "social_oauth_state"

YOUTUBE_SCOPES = (
    "https://www.googleapis.com/auth/youtube.upload "
    "https://www.googleapis.com/auth/youtube.readonly"
)
# offline.access is what makes X return a refresh token at all.
X_SCOPES = "tweet.read tweet.write users.read media.write offline.access"

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"

X_AUTH_URL = "https://x.com/i/oauth2/authorize"
X_TOKEN_URL = "https://api.x.com/2/oauth2/token"
X_REVOKE_URL = "https://api.x.com/2/oauth2/revoke"


class OAuthConfigError(Exception):
    """The platform is not configured on this server (missing client id/secret/key)."""


class OAuthStateError(Exception):
    """The state parameter is missing, tampered with, expired, or not ours."""


# ─── Platform configuration ──────────────────────────────────────────────────


def youtube_client_id() -> str:
    """The upload client id, falling back to the sign-in client for dev setups.

    Production should set YOUTUBE_CLIENT_ID to a distinct client — see the note
    in config.py about keeping the restricted upload scope away from sign-in.
    """
    return settings.YOUTUBE_CLIENT_ID or settings.GOOGLE_CLIENT_ID


def youtube_client_secret() -> str:
    return settings.YOUTUBE_CLIENT_SECRET or settings.GOOGLE_CLIENT_SECRET


def platform_enabled(platform: str) -> bool:
    """Whether this platform can be offered to users right now.

    Tokens are useless if they cannot be encrypted, so the encryption key gates
    every platform alongside that platform's own client credentials.
    """
    if not token_crypto.is_configured():
        return False
    if platform == PLATFORM_YOUTUBE:
        return bool(youtube_client_id() and youtube_client_secret())
    if platform == PLATFORM_X:
        return bool(settings.X_CLIENT_ID)
    return False


def assert_platform_enabled(platform: str) -> None:
    if platform not in SUPPORTED_PLATFORMS:
        raise OAuthConfigError(f"Unknown platform '{platform}'")
    if not token_crypto.is_configured():
        raise OAuthConfigError(
            "Social publishing is not configured on this server "
            "(SOCIAL_TOKEN_ENC_KEY is unset)."
        )
    if not platform_enabled(platform):
        raise OAuthConfigError(
            f"{platform} publishing is not configured on this server."
        )


def backend_base() -> str:
    return settings.BACKEND_URL.rstrip("/")


def frontend_origin() -> str:
    """Exact origin of the SPA, for postMessage targeting.

    Never a wildcard: the message carries the connected account's identity, and
    "*" would hand it to any page that managed to open the popup.
    """
    parsed = urlparse(settings.FRONTEND_URL or "")
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    # No usable FRONTEND_URL: "null" matches no origin, so the message is simply
    # not delivered. The connection itself is already saved by that point, so the
    # popup's own "you can close this" copy is what the user sees.
    return "null"


def redirect_uri(platform: str) -> str:
    return f"{backend_base()}/api/integrations/{platform}/callback"


# ─── Signed state ────────────────────────────────────────────────────────────


def build_state(user_id: int, platform: str, code_verifier: str | None = None) -> str:
    """Sign an opaque state carrying who started the flow, and X's PKCE verifier.

    The user id goes in ``uid``, deliberately NOT in ``sub``: ``get_current_user``
    authenticates any JWT signed with JWT_SECRET that carries a ``sub``, without
    inspecting ``typ``. A state token is exposed in URLs, browser history and
    referrer headers, so putting the id in ``sub`` would turn every one of those
    into a usable API credential. With ``uid`` the token cannot authenticate
    anything even though it shares the signing key.

    Carrying the PKCE verifier here (rather than in a server-side session) keeps
    the callback stateless, which matters because the callback arrives with no
    cookie and no Authorization header.
    """
    payload = {
        "uid": int(user_id),
        "platform": platform,
        "typ": _STATE_TYP,
        "nonce": secrets.token_urlsafe(8),
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=STATE_TTL_MINUTES),
    }
    if code_verifier:
        payload["cv"] = code_verifier
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def parse_state(state: str | None, expected_platform: str) -> dict:
    """Verify a state token and return its payload, or raise OAuthStateError."""
    if not state:
        raise OAuthStateError("Missing state parameter")
    try:
        payload = jwt.decode(
            state, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError as exc:
        raise OAuthStateError(
            "This connection link expired. Please try connecting again."
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise OAuthStateError("Invalid state parameter") from exc

    if payload.get("typ") != _STATE_TYP:
        raise OAuthStateError("State token is not an OAuth state")
    if payload.get("platform") != expected_platform:
        # A state minted for one platform must not complete another's callback.
        raise OAuthStateError("State token platform mismatch")
    if not payload.get("uid"):
        raise OAuthStateError("State token is missing its user")
    return payload


# ─── PKCE (X) ────────────────────────────────────────────────────────────────


def make_pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) for S256 PKCE."""
    verifier = base64.urlsafe_b64encode(os.urandom(48)).decode("ascii").rstrip("=")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


# ─── Authorize URLs ──────────────────────────────────────────────────────────


def build_authorize_url(platform: str, user_id: int) -> str:
    assert_platform_enabled(platform)

    if platform == PLATFORM_YOUTUBE:
        state = build_state(user_id, platform)
        return f"{GOOGLE_AUTH_URL}?" + urlencode(
            {
                "client_id": youtube_client_id(),
                "redirect_uri": redirect_uri(platform),
                "response_type": "code",
                "scope": YOUTUBE_SCOPES,
                "state": state,
                # offline + consent together are what actually yield a refresh
                # token. Without prompt=consent Google issues one only on the
                # user's first-ever grant, so anyone who disconnects and
                # reconnects would get an access token that dies in an hour with
                # no way to renew it — and nothing would report an error until
                # their next upload failed.
                "access_type": "offline",
                "prompt": "consent",
                "include_granted_scopes": "true",
            }
        )

    verifier, challenge = make_pkce_pair()
    state = build_state(user_id, platform, code_verifier=verifier)
    return f"{X_AUTH_URL}?" + urlencode(
        {
            "client_id": settings.X_CLIENT_ID,
            "redirect_uri": redirect_uri(platform),
            "response_type": "code",
            "scope": X_SCOPES,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )


# ─── Popup result page ───────────────────────────────────────────────────────


def _escape_js(value: str) -> str:
    """Escape a string for embedding in a single-quoted JS literal."""
    return (
        value.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\n", " ")
        .replace("\r", " ")
    )


def popup_result_html(
    platform: str,
    ok: bool,
    account_name: str | None = None,
    error: str | None = None,
) -> str:
    """The page the OAuth popup lands on: tell the opener, then close.

    Posts to the SPA's exact origin. The visible copy is a real fallback, not
    decoration — if window.close() is blocked, or the popup was opened from
    somewhere the opener reference is gone, this text is all the user sees.
    """
    origin = frontend_origin()
    heading = "Connected" if ok else "Connection failed"
    body = (
        f"You're connected{f' as {account_name}' if account_name else ''}. "
        "You can close this window."
        if ok
        else (error or "Something went wrong. Please close this window and try again.")
    )
    payload_bits = [
        "source: 'b2v-social-oauth'",
        f"platform: '{_escape_js(platform)}'",
        f"ok: {'true' if ok else 'false'}",
    ]
    if account_name:
        payload_bits.append(f"account_name: '{_escape_js(account_name)}'")
    if error:
        payload_bits.append(f"error: '{_escape_js(error)}'")
    payload_js = "{" + ", ".join(payload_bits) + "}"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{heading}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #faf9fc; color: #1f2937; }}
    .card {{ text-align: center; padding: 2rem; max-width: 22rem; }}
    h1 {{ font-size: 1.05rem; margin: 0 0 .5rem; }}
    p {{ font-size: .875rem; color: #6b7280; margin: 0; line-height: 1.5; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>{heading}</h1>
    <p>{body}</p>
  </div>
  <script>
    (function () {{
      try {{
        if (window.opener) {{
          window.opener.postMessage({payload_js}, '{origin}');
        }}
      }} catch (e) {{}}
      setTimeout(function () {{ try {{ window.close(); }} catch (e) {{}} }}, 400);
    }})();
  </script>
</body>
</html>"""
