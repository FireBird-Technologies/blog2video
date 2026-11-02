"""Separate hosted MCP credential revocation from website sessions.

Existing MCP refresh tokens carry the user's historical ``token_version`` as
their ``tv`` claim. Backfilling the new counter from that column preserves all
currently valid grants; future website logouts can then advance only
``token_version`` without disconnecting ChatGPT or Claude.

Revision ID: separate_mcp_token_version
Revises: drop_partner_app
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa


revision = "separate_mcp_token_version"
down_revision = "drop_partner_app"
branch_labels = None
depends_on = None


def _columns() -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}


def upgrade() -> None:
    if "mcp_token_version" not in _columns():
        op.add_column(
            "users",
            sa.Column(
                "mcp_token_version", sa.Integer(), nullable=False, server_default="0"
            ),
        )
    # Also handles environments where init_db's compatibility migration added
    # the column before Alembic ran.
    op.execute(
        sa.text("UPDATE users SET mcp_token_version = COALESCE(token_version, 0)")
    )


def downgrade() -> None:
    if "mcp_token_version" in _columns():
        op.drop_column("users", "mcp_token_version")
