"""
MCP OAuth router — mounts the MCP SDK's OAuth 2.1 routes under /mcp/ and
adds a Google-login bridge that fills in MCPAuthCode.user_id once the user
has authenticated.

Routes exposed:
  GET  /mcp/.well-known/oauth-authorization-server  (SDK)
  POST /mcp/register                                 (SDK, DCR)
  GET  /mcp/authorize                                (SDK; delegates to BlogVideoOAuthProvider.authorize → /mcp/google-start)
  POST /mcp/token                                    (SDK)

  GET  /mcp/google-start?code=...                   (this file; renders the Google JS SDK page)
  POST /mcp/google-callback                         (this file; verifies the Google credential and finalizes the auth code)
"""
import logging
from datetime import datetime

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import AnyHttpUrl, BaseModel
from sqlalchemy.orm import Session
from starlette.applications import Starlette
from starlette.routing import Route

from app.config import settings
from app.database import SessionLocal
from app.models.mcp_oauth import MCPAuthCode
from app.models.user import PlanTier, User
from app.services.mcp_provider import BlogVideoOAuthProvider
from mcp.server.auth.routes import create_auth_routes
from mcp.server.auth.settings import ClientRegistrationOptions, RevocationOptions

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Build the SDK routes and adapt them onto a FastAPI APIRouter mounted at /mcp
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/mcp", tags=["mcp-oauth"])

_provider = BlogVideoOAuthProvider()


def get_provider() -> BlogVideoOAuthProvider:
    return _provider


def _issuer_url() -> str:
    """Public base URL used as the OAuth issuer."""
    return settings.BACKEND_URL.rstrip("/") + "/mcp"


def build_sdk_starlette_app(extra_routes: list | None = None) -> Starlette:
    """Build a sub-Starlette app mounted at /mcp.

    Includes:
      - The SDK's OAuth routes (/authorize, /token, /register)
      - Any extra Starlette routes the caller passes in (currently the SSE
        transport's /sse and /messages/ handlers from mcp_transport.py)

    Why not add these to a FastAPI APIRouter? FastAPI's APIRouter `prefix`
    only applies to routes added via add_api_route / decorators — not to raw
    Starlette Route objects. And the MCP SDK's SSE/messages handlers must be
    ASGI-native because they write their own responses; FastAPI would write
    a second one on top.
    """
    sdk_routes: list[Route] = create_auth_routes(
        provider=_provider,
        issuer_url=AnyHttpUrl(_issuer_url()),
        client_registration_options=ClientRegistrationOptions(
            enabled=True,
            valid_scopes=None,
            default_scopes=None,
        ),
        revocation_options=RevocationOptions(enabled=False),
    )
    # Filter out the SDK's metadata route — we serve our own mirror in this
    # router at /mcp/.well-known/oauth-authorization-server so the path
    # appears in the OpenAPI schema and is easy to reason about.
    sdk_routes = [r for r in sdk_routes if not r.path.startswith("/.well-known")]
    all_routes = sdk_routes + list(extra_routes or [])
    return Starlette(routes=all_routes)


# ---------------------------------------------------------------------------
# OAuth Authorization Server Metadata at the issuer's path
# ---------------------------------------------------------------------------
# Per RFC 8414 §3, the metadata document lives at `<issuer>/.well-known/
# oauth-authorization-server`. Since our issuer is `<backend>/mcp`, claude.ai
# will look for it at /mcp/.well-known/oauth-authorization-server. The SDK
# only mounts the route at the bare /.well-known/... path on the app root,
# so we add a mirror here.

def _oauth_metadata() -> dict:
    backend = settings.BACKEND_URL.rstrip("/")
    return {
        "issuer": f"{backend}/mcp",
        "authorization_endpoint": f"{backend}/mcp/authorize",
        "token_endpoint": f"{backend}/mcp/token",
        "registration_endpoint": f"{backend}/mcp/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post", "client_secret_basic"],
        "code_challenge_methods_supported": ["S256"],
    }


def _protected_resource_metadata(resource_url: str) -> dict:
    """RFC 9728 — OAuth 2.0 Protected Resource Metadata.

    `resource` MUST equal the exact URL claude.ai uses as the MCP server URL
    (e.g. https://<host>/mcp/sse), otherwise claude.ai rejects the metadata.
    `authorization_servers` points at our AS so claude.ai then fetches
    `<as>/.well-known/oauth-authorization-server` to discover /authorize,
    /token, /register.
    """
    backend = settings.BACKEND_URL.rstrip("/")
    return {
        "resource": resource_url,
        "authorization_servers": [f"{backend}/mcp"],
        "bearer_methods_supported": ["header"],
        "scopes_supported": [],
    }


@router.get("/.well-known/oauth-authorization-server")
async def oauth_metadata_mirror_mcp_path():
    """RFC 8414 path relative to the issuer (issuer = <backend>/mcp).

    This is the AUTHORITATIVE metadata endpoint. claude.ai discovers it via
    the protected-resource metadata's `authorization_servers` field below.
    """
    return _oauth_metadata()


# Root-level router for paths claude.ai probes at the app root, NOT under /mcp.
# RFC 8414 §3.1 specifies that when the issuer has a path component (ours is
# `<host>/mcp`), the metadata document lives at
# `<host>/.well-known/oauth-authorization-server/<issuer_path>` — i.e.
# `.well-known/...` is inserted BETWEEN the host and the issuer's path.
# Claude.ai correctly follows the RFC; we previously had the metadata at the
# wrong location.
root_router = APIRouter(tags=["mcp-oauth-discovery"])


@root_router.get("/.well-known/oauth-authorization-server")
async def oauth_metadata_root():
    """Bare root path — probed by GPT/OpenAI and other clients that don't
    append the issuer path segment."""
    return _oauth_metadata()


@root_router.get("/.well-known/oauth-authorization-server/mcp")
async def oauth_metadata_rfc8414():
    """RFC 8414 §3.1: AS metadata path for issuer `<host>/mcp`.

    This is the path claude.ai actually probes. Both this and the
    /mcp/.well-known/oauth-authorization-server mirror return the same JSON
    so any client (or future spec interpretation) works.
    """
    return _oauth_metadata()




@root_router.get("/.well-known/oauth-protected-resource/mcp/sse")
async def protected_resource_metadata_for_sse():
    """RFC 9728: claude.ai builds this path by inserting `.well-known/
    oauth-protected-resource` between the host and the resource path.

    The resource path here is `/mcp/sse` (where claude.ai connects), so the
    full discovery URL is `<host>/.well-known/oauth-protected-resource/mcp/sse`.
    """
    backend = settings.BACKEND_URL.rstrip("/")
    return _protected_resource_metadata(f"{backend}/mcp/sse")


@root_router.get("/.well-known/oauth-protected-resource")
async def protected_resource_metadata_root():
    """Fallback for clients that probe the bare path."""
    backend = settings.BACKEND_URL.rstrip("/")
    return _protected_resource_metadata(f"{backend}/mcp/sse")


# Root-level aliases for MCP Inspector / other clients that strip the issuer
# path when building OAuth endpoint URLs. They POST/GET to /token, /authorize,
# /register at the host root instead of /mcp/token etc., so we 307-redirect
# preserving the HTTP method.
@root_router.post("/token")
async def token_root_alias():
    return RedirectResponse(url="/mcp/token", status_code=307)


@root_router.get("/authorize")
async def authorize_root_alias(request: Request):
    qs = request.url.query
    return RedirectResponse(url=f"/mcp/authorize{('?' + qs) if qs else ''}", status_code=307)


@root_router.post("/register")
async def register_root_alias():
    return RedirectResponse(url="/mcp/register", status_code=307)


# ---------------------------------------------------------------------------
# Google login bridge
# ---------------------------------------------------------------------------

@router.get("/google-start", response_class=HTMLResponse)
async def google_start(code: str = Query(..., description="Pending mcp_oauth_code")) -> str:
    """Render a minimal page that runs Google's JS SDK and posts the credential
    to /mcp/google-callback. Once the credential is verified, the page is
    redirected back to claude.ai's redirect_uri with the OAuth code + state.

    The `code` here is the pending mcp_oauth_codes.code (NOT the Google credential).
    """
    db = SessionLocal()
    try:
        row = db.query(MCPAuthCode).filter(MCPAuthCode.code == code, MCPAuthCode.used == False).first()  # noqa: E712
        if not row:
            raise HTTPException(status_code=400, detail="Unknown or already-used authorization code")
        if row.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Authorization code expired")
    finally:
        db.close()

    google_client_id = settings.GOOGLE_CLIENT_ID
    if not google_client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID is not configured")

    backend = settings.BACKEND_URL.rstrip("/")
    # Standard Google OAuth2 authorization URL — full redirect flow with no
    # popup. This avoids the "popup-within-a-popup" problem (origin_mismatch
    # from Google JS SDK) and the One Tap redirect_uri_mismatch issues.
    # After the user signs in on accounts.google.com, Google redirects back to
    # /mcp/google-oauth-callback?code=...&state=<pending_mcp_code>.
    import urllib.parse
    google_auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": google_client_id,
        "redirect_uri": f"{backend}/mcp/google-oauth-callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": code,
        "access_type": "online",
        "prompt": "select_account",
    })

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Connect Blog2Video to Claude</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }}
    .card {{
      background: white;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 2px 24px rgba(0, 0, 0, 0.06);
      max-width: 380px;
      text-align: center;
    }}
    h1 {{ font-size: 20px; margin: 0 0 8px; color: #111; }}
    p  {{ color: #555; margin: 0 0 24px; }}
    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: white;
      border: 1px solid #dadce0;
      border-radius: 4px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 500;
      color: #3c4043;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s;
    }}
    .btn:hover {{ background: #f8f9fa; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Connect Blog2Video</h1>
    <p>Sign in with Google to let Claude access your Blog2Video account.</p>
    <a href="{google_auth_url}" class="btn">
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
        <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.84v2.07A8 8 0 0 0 8.98 17z"/>
        <path fill="#FBBC05" d="M4.51 10.53A4.8 4.8 0 0 1 4.26 9c0-.53.09-1.04.25-1.53V5.4H1.84A8 8 0 0 0 .98 9c0 1.29.31 2.51.86 3.6l2.67-2.07z"/>
        <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.14 4.4l2.67 2.07c.63-1.89 2.39-3.29 4.47-3.29z"/>
      </svg>
      Sign in with Google
    </a>
  </div>
</body>
</html>"""


@router.post("/google-callback-redirect")
async def google_callback_redirect(request: Request):
    """Google One Tap redirect-mode POST — same logic as /google-callback.

    When ux_mode='redirect', Google POSTs the credential to `login_uri`
    as a form field named 'credential'. We reuse the same logic as the
    popup callback but route to this dedicated path so both modes can
    coexist during testing.
    """
    return await google_callback(request)


@router.post("/google-callback")
async def google_callback(request: Request):
    """Receive the Google credential + pending MCP code from the bridge page,
    verify the credential, resolve to a Blog2Video user, then redirect the
    browser back to the OAuth client's redirect_uri with code + state.
    """
    form = await request.form()
    code = form.get("code")
    credential = form.get("credential")
    if not code or not credential:
        raise HTTPException(status_code=400, detail="Missing code or credential")

    # Verify the Google ID token
    try:
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")
    name = idinfo.get("name", email.split("@")[0] if email else "User")
    picture = idinfo.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="Google did not provide an email address")

    db: Session = SessionLocal()
    try:
        row = db.query(MCPAuthCode).filter(
            MCPAuthCode.code == code,
            MCPAuthCode.used == False,  # noqa: E712
        ).first()
        if not row:
            raise HTTPException(status_code=400, detail="Unknown or already-used authorization code")
        if row.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Authorization code expired")

        # Find or create the user (same logic as POST /api/auth/google, minus the
        # response payload and account-deleted reactivation flow which Claude
        # cannot drive)
        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            user = db.query(User).filter(User.email == email).first()
            if user:
                user.google_id = google_id
                user.picture = picture or user.picture
            else:
                user = User(
                    email=email,
                    name=name,
                    picture=picture,
                    google_id=google_id,
                    plan=PlanTier.FREE,
                    videos_used_this_period=0,
                    video_limit_bonus=0,
                    is_active=True,
                )
                db.add(user)
                db.flush()

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")

        # Bind the auth code to this user
        row.user_id = user.id
        db.commit()

        # Build the redirect URI claude.ai is waiting on
        from urllib.parse import urlencode
        params = {"code": code}
        if row.state:
            params["state"] = row.state
        sep = "&" if "?" in row.redirect_uri else "?"
        final_redirect = f"{row.redirect_uri}{sep}{urlencode(params)}"

        return RedirectResponse(url=final_redirect, status_code=303)
    finally:
        db.close()


@router.get("/google-oauth-callback")
async def google_oauth_callback(
    request: Request,
    code: str = None,
    state: str = None,
    error: str = None,
):
    """Standard OAuth2 authorization-code callback from Google.

    This is the redirect_uri for the standard OAuth flow started in
    /mcp/google-start. Google redirects here with ?code=<auth_code>&state=<mcp_code>
    after the user approves. We exchange the Google auth code for user info
    via the token endpoint, then bind user_id to the MCP auth code row.
    """
    if error:
        raise HTTPException(status_code=400, detail=f"Google OAuth error: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state from Google")

    backend = settings.BACKEND_URL.rstrip("/")
    redirect_uri = f"{backend}/mcp/google-oauth-callback"

    # Exchange Google auth code for tokens
    import httpx as _httpx
    token_resp = None
    try:
        async with _httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
        token_resp.raise_for_status()
        token_data = token_resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Google token exchange failed: {e}")

    # Verify the returned ID token
    raw_id_token = token_data.get("id_token")
    if not raw_id_token:
        raise HTTPException(status_code=502, detail="Google did not return an id_token")

    try:
        idinfo = id_token.verify_oauth2_token(
            raw_id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")
    name = idinfo.get("name", email.split("@")[0] if email else "User")
    picture = idinfo.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="Google did not provide an email address")

    # state = the pending MCP auth code
    mcp_code = state
    db: Session = SessionLocal()
    try:
        row = db.query(MCPAuthCode).filter(
            MCPAuthCode.code == mcp_code,
            MCPAuthCode.used == False,  # noqa: E712
        ).first()
        if not row:
            raise HTTPException(status_code=400, detail="Unknown or already-used MCP authorization code")
        if row.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="MCP authorization code expired")

        # Find or create the Blog2Video user
        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            user = db.query(User).filter(User.email == email).first()
            if user:
                user.google_id = google_id
                user.picture = picture or user.picture
            else:
                user = User(
                    email=email,
                    name=name,
                    picture=picture,
                    google_id=google_id,
                    plan=PlanTier.FREE,
                    videos_used_this_period=0,
                    video_limit_bonus=0,
                    is_active=True,
                )
                db.add(user)
                db.flush()

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")

        row.user_id = user.id
        db.commit()

        # Redirect back to claude.ai with the MCP code + state
        from urllib.parse import urlencode
        params = {"code": mcp_code}
        if row.state:
            params["state"] = row.state
        sep = "&" if "?" in row.redirect_uri else "?"
        final_redirect = f"{row.redirect_uri}{sep}{urlencode(params)}"
        return RedirectResponse(url=final_redirect, status_code=303)
    finally:
        db.close()
