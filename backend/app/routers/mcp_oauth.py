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
from app.models.user import AuthProvider, User
from app.routers import mcp_auth_ui
from app.services.auth_identity import resolve_or_create_user
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
async def google_start(
    code: str = Query(..., description="Pending mcp_oauth_code"),
    error: str | None = Query(None),
    email: str = Query(""),
):
    """Sign-in page of the MCP OAuth bridge: Google button + email/password form.

    The `code` here is the pending mcp_oauth_codes.code (NOT the Google credential).
    Google runs as a full-redirect OAuth flow that returns to /mcp/google-oauth-callback.
    """
    if (gone := _guard(code)) is not None:
        return gone

    google_client_id = settings.GOOGLE_CLIENT_ID
    if not google_client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID is not configured")

    backend = settings.BACKEND_URL.rstrip("/")
    return HTMLResponse(mcp_auth_ui.login_page(
        code=code, backend=backend, google_url=_google_auth_url(code),
        site_url=settings.FRONTEND_URL, error=error, email=email,
    ))


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

        # Find or create the user through the shared identity rules, so MCP can
        # never mint an account the web app would reject. allow_reactivation is
        # off because Claude cannot drive a reactivation confirmation prompt.
        user, _created = resolve_or_create_user(
            db,
            provider=AuthProvider.GOOGLE,
            provider_user_id=google_id,
            email=email,
            name=name,
            picture=picture,
            allow_reactivation=False,
        )

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


@router.post("/email-login")
async def email_login(request: Request):
    """Email/password sign-in for the MCP bridge page (same rules as web /auth/email/login)."""
    from urllib.parse import urlencode
    from app.services import rate_limit
    from app.services.auth_identity import resolve_password_user
    from app.services.password import verify_password

    form = await request.form()
    code = form.get("code")
    email = (form.get("email") or "").strip()
    password = form.get("password") or ""
    if not code or not email or not password:
        raise HTTPException(status_code=400, detail="Missing code, email or password")

    def _back(msg: str) -> RedirectResponse:
        return RedirectResponse(
            url=f"/mcp/google-start?{urlencode({'code': code, 'error': msg, 'email': email})}", status_code=303
        )

    ip_key = rate_limit.client_key(request)
    mail_key = rate_limit.email_key(email)
    try:
        rate_limit.login_ip_limiter.check(ip_key)
        rate_limit.login_email_limiter.check(mail_key)
    except HTTPException:
        return _back("Too many attempts. Try again later.")

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

        try:
            user = resolve_password_user(db, email=email)
        except HTTPException as e:
            if e.status_code == 409:
                return _back("This email uses a different sign-in method (e.g. Google).")
            user = None
        if user is None or not verify_password(password, user.password_hash):
            rate_limit.login_ip_limiter.record_failure(ip_key)
            rate_limit.login_email_limiter.record_failure(mail_key)
            return _back("Invalid email or password.")
        if not user.is_active:
            return _back("This account is deactivated. Reactivate it on the Blog2Video website.")

        rate_limit.login_ip_limiter.clear(ip_key)
        rate_limit.login_email_limiter.clear(mail_key)
        row.user_id = user.id
        db.commit()

        params = {"code": code}
        if row.state:
            params["state"] = row.state
        sep = "&" if "?" in row.redirect_uri else "?"
        return RedirectResponse(url=f"{row.redirect_uri}{sep}{urlencode(params)}", status_code=303)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Email sign-up inside the MCP flow (mirrors /api/auth/email/register/*)
# ---------------------------------------------------------------------------

_SIGNUP_ERRORS = {
    "email_already_registered": "An account with this email already exists. Go back and sign in instead.",
    "password_too_short": "Password is too short.",
    "password_too_long": "Password is too long.",
    "password_needs_uppercase": "Password needs an uppercase letter.",
    "password_needs_special": "Password needs a special character.",
    "code_invalid": "That code is incorrect.",
    "code_expired": "That code has expired. Request a new one.",
    "code_attempts_exceeded": "Too many wrong attempts. Request a new code.",
    "resend_too_soon": "Please wait a moment before requesting another code.",
    "email_send_failed": "We couldn't send the email. Try again shortly.",
    "no_pending_registration": "No pending sign-up for this email. Start again.",
}


def _signup_error_text(e: HTTPException) -> str:
    d = e.detail
    if isinstance(d, dict):
        code = d.get("code", "")
        if code == "wrong_auth_provider":
            label = d.get("provider_label") or "another sign-in method"
            return f"This email is already registered with {label}. Go back and sign in with that instead."
        msg = _SIGNUP_ERRORS.get(code, "Something went wrong.")
        if code == "code_invalid" and d.get("attempts_remaining") is not None:
            msg += f" {d['attempts_remaining']} attempt(s) left."
        return msg
    return _SIGNUP_ERRORS.get(str(d), "Something went wrong. Please try again.")


def _google_auth_url(code: str) -> str:
    import urllib.parse
    backend = settings.BACKEND_URL.rstrip("/")
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": f"{backend}/mcp/google-oauth-callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": code,
        "access_type": "online",
        "prompt": "select_account",
    })


def _guard(code: str):
    """None while the pending sign-in is usable, else a friendly HTML 'expired' page.

    These are browser pages, so an expired or already-used link must read as a
    human message, not a raw JSON error.
    """
    db = SessionLocal()
    try:
        row = db.query(MCPAuthCode).filter(MCPAuthCode.code == code, MCPAuthCode.used == False).first()  # noqa: E712
        if row is None or row.expires_at < datetime.utcnow():
            return HTMLResponse(mcp_auth_ui.expired_page(site_url=settings.FRONTEND_URL), status_code=410)
    finally:
        db.close()
    return None


def _signup_redirect(path: str, **params) -> RedirectResponse:
    from urllib.parse import urlencode
    return RedirectResponse(url=f"/mcp/{path}?{urlencode({k: v for k, v in params.items() if v})}", status_code=303)


@router.get("/signup")
async def signup_page(code: str = Query(...), error: str | None = Query(None),
                      email: str = Query(""), name: str = Query("")):
    if (gone := _guard(code)) is not None:
        return gone
    return HTMLResponse(mcp_auth_ui.signup_page(
        code=code, backend=settings.BACKEND_URL.rstrip("/"), google_url=_google_auth_url(code),
        site_url=settings.FRONTEND_URL, error=error, email=email, name=name,
    ))


@router.post("/signup-start")
async def signup_start(request: Request):
    from app.models.email_verification import VerificationPurpose
    from app.services import email_verification as verification, rate_limit
    from app.services.auth_identity import assert_email_available_for_password
    from app.services.email import email_service, EmailServiceError
    from app.services.password import hash_password, validate_password
    from app.routers.auth import _EMAIL_RE

    form = await request.form()
    code = form.get("code") or ""
    email = (form.get("email") or "").strip().lower()
    password = form.get("password") or ""
    name = (form.get("name") or "").strip()[:255]
    if (gone := _guard(code)) is not None:
        return gone
    if not _EMAIL_RE.match(email):
        return _signup_redirect("signup", code=code, error="Enter a valid email address.", email=email)

    key = rate_limit.client_key(request)
    db = SessionLocal()
    try:
        rate_limit.register_limiter.check(key)
        if assert_email_available_for_password(db, email) is not None:
            rate_limit.register_limiter.record_failure(key)
            raise HTTPException(status_code=409, detail={"code": "email_already_registered"})
        validate_password(password)
        _row, otp = verification.issue_code(
            db, email=email, purpose=VerificationPurpose.SIGNUP,
            pending_password_hash=hash_password(password),
            pending_name=name or email.split("@")[0],
        )
        db.commit()
        try:
            email_service.send_verification_code_email(email, otp)
        except EmailServiceError:
            raise HTTPException(status_code=502, detail="email_send_failed")
    except HTTPException as e:
        if e.detail == "resend_too_soon":
            # Double-submit / back-button: a code was just sent, so go to the
            # verify page rather than bouncing back to the form with an error.
            return _signup_redirect("signup-verify", code=code, email=email,
                                    info="A code was already sent. Check your inbox.", wait=60)
        return _signup_redirect("signup", code=code, email=email, error=_signup_error_text(e))
    finally:
        db.close()
    return _signup_redirect("signup-verify", code=code, email=email, info="Code sent!", wait=60)


@router.get("/signup-verify")
async def signup_verify_page(code: str = Query(...), email: str = Query(...),
                             error: str | None = Query(None), info: str | None = Query(None),
                             wait: int = Query(0)):
    if (gone := _guard(code)) is not None:
        return gone
    return HTMLResponse(mcp_auth_ui.verify_page(
        code=code, backend=settings.BACKEND_URL.rstrip("/"), site_url=settings.FRONTEND_URL,
        email=email, error=error, info=info, wait=max(0, min(wait, 120)),
    ))


@router.post("/signup-resend")
async def signup_resend(request: Request):
    from app.models.email_verification import EmailVerificationCode, VerificationPurpose
    from app.services import email_verification as verification, rate_limit
    from app.services.email import email_service, EmailServiceError

    form = await request.form()
    code = form.get("code") or ""
    email = (form.get("email") or "").strip().lower()
    if (gone := _guard(code)) is not None:
        return gone
    db = SessionLocal()
    try:
        rate_limit.resend_limiter.check(rate_limit.email_key(email))
        pending = (
            db.query(EmailVerificationCode)
            .filter(EmailVerificationCode.email == email,
                    EmailVerificationCode.purpose == VerificationPurpose.SIGNUP.value,
                    EmailVerificationCode.used.is_(False))
            .order_by(EmailVerificationCode.created_at.desc(), EmailVerificationCode.id.desc())
            .first()
        )
        if pending is None:
            raise HTTPException(status_code=400, detail="no_pending_registration")
        _row, otp = verification.issue_code(
            db, email=email, purpose=VerificationPurpose.SIGNUP,
            pending_password_hash=pending.pending_password_hash, pending_name=pending.pending_name,
        )
        db.commit()
        try:
            email_service.send_verification_code_email(email, otp)
        except EmailServiceError:
            raise HTTPException(status_code=502, detail="email_send_failed")
    except HTTPException as e:
        return _signup_redirect("signup-verify", code=code, email=email, error=_signup_error_text(e))
    finally:
        db.close()
    return _signup_redirect("signup-verify", code=code, email=email, info="A new code is on its way.", wait=60)


@router.post("/signup-verify")
async def signup_verify(request: Request):
    from urllib.parse import urlencode
    from app.models.email_verification import VerificationPurpose
    from app.services import email_verification as verification, rate_limit
    from app.services.auth_identity import assert_email_available_for_password, create_password_user
    from app.routers.auth import _bind_pending_collab_invites
    from app.services.voice_seed import ensure_free_voices_for_user

    form = await request.form()
    code = form.get("code") or ""
    email = (form.get("email") or "").strip().lower()
    otp = (form.get("otp") or "").strip()
    if (gone := _guard(code)) is not None:
        return gone

    key = rate_limit.client_key(request)
    db = SessionLocal()
    try:
        try:
            rate_limit.verify_limiter.check(key)
            row = verification.consume_code(db, email=email, purpose=VerificationPurpose.SIGNUP, code=otp)
            if assert_email_available_for_password(db, email) is not None:
                raise HTTPException(status_code=409, detail={"code": "email_already_registered"})
            user, _created = create_password_user(
                db, email=email, name=row.pending_name or email.split("@")[0],
                password_hash=row.pending_password_hash,
            )
            db.delete(row)
            rate_limit.verify_limiter.clear(key)
        except HTTPException as e:
            return _signup_redirect("signup-verify", code=code, email=email, error=_signup_error_text(e))

        if settings.DEFAULT_PLAN:
            from app.models.user import PlanTier
            try:
                user.plan = PlanTier(settings.DEFAULT_PLAN.lower())
            except ValueError:
                pass
        db.commit()
        db.refresh(user)
        _bind_pending_collab_invites(user, db)
        ensure_free_voices_for_user(db, user.id)

        mcp_row = db.query(MCPAuthCode).filter(MCPAuthCode.code == code, MCPAuthCode.used == False).first()  # noqa: E712
        mcp_row.user_id = user.id
        db.commit()
        params = {"code": code}
        if mcp_row.state:
            params["state"] = mcp_row.state
        sep = "&" if "?" in mcp_row.redirect_uri else "?"
        return RedirectResponse(url=f"{mcp_row.redirect_uri}{sep}{urlencode(params)}", status_code=303)
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

        # Find or create the Blog2Video user under the shared identity rules.
        user, _created = resolve_or_create_user(
            db,
            provider=AuthProvider.GOOGLE,
            provider_user_id=google_id,
            email=email,
            name=name,
            picture=picture,
            allow_reactivation=False,
        )

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
