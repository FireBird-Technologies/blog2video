"""
OAuth 2.1 Authorization Server provider for the hosted MCP server.

Implements `mcp.server.auth.provider.OAuthAuthorizationServerProvider` against
the existing Blog2Video Postgres DB. Plugs into the MCP SDK's built-in
authorization endpoints (handled by `mcp.server.auth.routes.create_auth_routes`).

Flow:
  1. claude.ai calls /mcp/register (DCR) → register_client() stores a row in
     mcp_oauth_clients.
  2. claude.ai redirects user to /mcp/authorize → authorize() inserts a
     pending mcp_oauth_codes row (user_id=NULL) and returns a redirect URL
     pointing at our /mcp/google-start page.
  3. The Google login bridge (in app/routers/mcp_oauth.py) resolves the user
     and updates the row's user_id, then redirects the browser back to
     claude.ai's redirect_uri with code + state.
  4. claude.ai POSTs to /mcp/token with the code → exchange_authorization_code()
     marks the code used and mints a JWT pair.
  5. Subsequent requests carry the access JWT in the Authorization header;
     load_access_token() decodes it back to the user.
"""
import secrets
import time
from datetime import datetime, timedelta, timezone

from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    OAuthAuthorizationServerProvider,
    OAuthToken,
    RefreshToken,
    construct_redirect_uri,
)
from mcp.shared.auth import OAuthClientInformationFull
from pydantic import AnyUrl

from app.auth import (
    REFRESH_TOKEN_EXPIRATION_DAYS,
    create_access_token,
    create_refresh_token,
    decode_token_full,
)
from app.config import settings
from app.database import SessionLocal
from app.models.mcp_oauth import MCPAuthCode, MCPClient


AUTH_CODE_TTL_SECONDS = 600  # 10 minutes


class BlogVideoOAuthProvider(
    OAuthAuthorizationServerProvider[AuthorizationCode, RefreshToken, AccessToken]
):
    """OAuth provider backed by Blog2Video's Postgres DB + JWT module."""

    # ---- Client registration (DCR) ----

    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        db = SessionLocal()
        try:
            row = db.query(MCPClient).filter(MCPClient.client_id == client_id).first()
            if not row:
                return None
            return _client_row_to_info(row)
        finally:
            db.close()

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        db = SessionLocal()
        try:
            client_id = client_info.client_id or secrets.token_urlsafe(24)
            client_info.client_id = client_id
            client_info.client_id_issued_at = int(time.time())

            row = MCPClient(
                client_id=client_id,
                client_name=client_info.client_name or "MCP Client",
                redirect_uris=[str(u) for u in (client_info.redirect_uris or [])],
                grant_types=list(client_info.grant_types or []),
                response_types=list(client_info.response_types or ["code"]),
                scopes=(client_info.scope.split(" ") if client_info.scope else []),
                token_endpoint_auth_method=client_info.token_endpoint_auth_method or "none",
            )
            db.add(row)
            db.commit()
        finally:
            db.close()

    # ---- Authorization code flow ----

    async def authorize(
        self,
        client: OAuthClientInformationFull,
        params: AuthorizationParams,
    ) -> str:
        """Insert a pending auth code, return URL of our Google login bridge."""
        code = secrets.token_urlsafe(32)
        db = SessionLocal()
        try:
            row = MCPAuthCode(
                code=code,
                client_id=client.client_id,
                user_id=None,  # filled in after Google login
                redirect_uri=str(params.redirect_uri),
                code_challenge=params.code_challenge,
                scopes=list(params.scopes or []),
                state=params.state,
                expires_at=datetime.utcnow() + timedelta(seconds=AUTH_CODE_TTL_SECONDS),
                used=False,
            )
            db.add(row)
            db.commit()
        finally:
            db.close()

        # Redirect the browser to our Google login bridge. After Google login,
        # the bridge updates the code row with user_id and then redirects back
        # to params.redirect_uri with the code + state.
        backend = settings.BACKEND_URL.rstrip("/")
        return f"{backend}/mcp/google-start?code={code}"

    async def load_authorization_code(
        self,
        client: OAuthClientInformationFull,
        authorization_code: str,
    ) -> AuthorizationCode | None:
        db = SessionLocal()
        try:
            row = (
                db.query(MCPAuthCode)
                .filter(
                    MCPAuthCode.code == authorization_code,
                    MCPAuthCode.client_id == client.client_id,
                    MCPAuthCode.used == False,  # noqa: E712
                )
                .first()
            )
            if not row:
                return None
            if row.expires_at < datetime.utcnow():
                return None
            if row.user_id is None:
                # Google login hasn't completed yet
                return None
            # row.expires_at is a naive UTC datetime; tell .timestamp() that
            # by attaching tzinfo=utc, otherwise it treats the value as local
            # time and the SDK's `expires_at < time.time()` check fails.
            expires_utc = row.expires_at.replace(tzinfo=timezone.utc)
            return AuthorizationCode(
                code=row.code,
                scopes=row.scopes or [],
                expires_at=expires_utc.timestamp(),
                client_id=row.client_id,
                code_challenge=row.code_challenge or "",
                redirect_uri=AnyUrl(row.redirect_uri),
                redirect_uri_provided_explicitly=True,
            )
        finally:
            db.close()

    async def exchange_authorization_code(
        self,
        client: OAuthClientInformationFull,
        authorization_code: AuthorizationCode,
    ) -> OAuthToken:
        db = SessionLocal()
        try:
            row = (
                db.query(MCPAuthCode)
                .filter(MCPAuthCode.code == authorization_code.code)
                .first()
            )
            if not row or row.used or row.user_id is None:
                raise ValueError("Authorization code invalid or already used")
            row.used = True
            db.commit()

            access_token = create_access_token(row.user_id)
            refresh_token = create_refresh_token(row.user_id)
            return OAuthToken(
                access_token=access_token,
                token_type="Bearer",
                expires_in=settings.JWT_EXPIRATION_HOURS * 3600,
                scope=" ".join(row.scopes) if row.scopes else None,
                refresh_token=refresh_token,
            )
        finally:
            db.close()

    # ---- Refresh tokens ----

    async def load_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: str,
    ) -> RefreshToken | None:
        payload = decode_token_full(refresh_token)
        if not payload or payload.get("typ") != "refresh":
            return None
        return RefreshToken(
            token=refresh_token,
            client_id=client.client_id,
            scopes=[],
            expires_at=int(payload.get("exp", 0)),
        )

    async def exchange_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: RefreshToken,
        scopes: list[str],
    ) -> OAuthToken:
        payload = decode_token_full(refresh_token.token)
        if not payload or payload.get("typ") != "refresh":
            raise ValueError("Invalid refresh token")
        user_id = int(payload["sub"])
        new_access = create_access_token(user_id)
        new_refresh = create_refresh_token(user_id)
        return OAuthToken(
            access_token=new_access,
            token_type="Bearer",
            expires_in=settings.JWT_EXPIRATION_HOURS * 3600,
            scope=" ".join(scopes) if scopes else None,
            refresh_token=new_refresh,
        )

    # ---- Access tokens ----

    async def load_access_token(self, token: str) -> AccessToken | None:
        payload = decode_token_full(token)
        if not payload:
            return None
        # Accept both access tokens and the legacy untyped tokens our old auth
        # flow minted before the typ claim was added. Refresh tokens are not
        # valid here.
        if payload.get("typ") == "refresh":
            return None
        try:
            int(payload["sub"])
        except (KeyError, ValueError, TypeError):
            return None
        return AccessToken(
            token=token,
            client_id="",  # JWT doesn't bind to client; that's fine for our usage
            scopes=[],
            expires_at=int(payload.get("exp", 0)),
        )

    async def revoke_token(self, token) -> None:
        # No-op for v1 — JWTs aren't tracked in DB, so they expire naturally.
        # Phase 2: maintain a revoked_jti table here.
        return None


# ---- Helpers ----

def _client_row_to_info(row: MCPClient) -> OAuthClientInformationFull:
    return OAuthClientInformationFull(
        client_id=row.client_id,
        client_secret=None,
        client_id_issued_at=int(row.created_at.timestamp()) if row.created_at else None,
        client_secret_expires_at=None,
        redirect_uris=[AnyUrl(u) for u in (row.redirect_uris or [])],
        token_endpoint_auth_method=row.token_endpoint_auth_method or "none",
        grant_types=row.grant_types or ["authorization_code", "refresh_token"],
        response_types=row.response_types or ["code"],
        scope=" ".join(row.scopes) if row.scopes else None,
        client_name=row.client_name,
    )
