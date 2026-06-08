"""
OAuth 2.1 storage models for the hosted MCP server.

- MCPClient: a registered OAuth client (claude.ai instances register here via DCR)
- MCPAuthCode: short-lived authorization codes pending exchange for tokens.
  When created, user_id is NULL — the user hasn't logged in yet. After the
  Google login bridge resolves a user, user_id is filled and the code becomes
  exchangeable at /mcp/token.

Refresh + access tokens are JWTs (see app/auth.py) and are NOT stored here.
"""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MCPClient(Base):
    """An OAuth client (one per claude.ai install / per Custom Connector setup)."""
    __tablename__ = "mcp_oauth_clients"

    client_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    client_secret_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False, default="MCP Client")
    redirect_uris: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    grant_types: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    response_types: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    scopes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    token_endpoint_auth_method: Mapped[str] = mapped_column(String(64), nullable=False, default="none")
    client_uri: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    logo_uri: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    contacts: Mapped[list | None] = mapped_column(JSON, nullable=True)
    tos_uri: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    policy_uri: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    jwks_uri: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    software_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    software_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class MCPAuthCode(Base):
    """A short-lived authorization code pending exchange for an access token.

    user_id is NULL until the Google login bridge resolves which Blog2Video
    user is consenting. Once user_id is set and the code hasn't expired or
    been used, /mcp/token will exchange it for a JWT pair.
    """
    __tablename__ = "mcp_oauth_codes"

    code: Mapped[str] = mapped_column(String(128), primary_key=True)
    client_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("mcp_oauth_clients.client_id"), nullable=False, index=True
    )
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )
    redirect_uri: Mapped[str] = mapped_column(String(2048), nullable=False)
    code_challenge: Mapped[str | None] = mapped_column(String(255), nullable=True)
    code_challenge_method: Mapped[str | None] = mapped_column(String(16), nullable=True)
    scopes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    state: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
