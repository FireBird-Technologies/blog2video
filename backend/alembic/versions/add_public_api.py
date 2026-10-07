"""Public video API: api_keys, api_project_links

API keys for paid users, and the links that scope API-created projects to the
key holder that created them (tagged with the caller's own end-user id).

Guarded so a re-run or drifted DB doesn't fail.

Revision ID: add_public_api
Revises: mcp_oauth_codes_state_text
Create Date: 2026-09-29

"""
from alembic import op
import sqlalchemy as sa

revision = "add_public_api"
down_revision = "mcp_oauth_codes_state_text"
branch_labels = None
depends_on = None


def _tables(conn) -> set[str]:
    return set(sa.inspect(conn).get_table_names())


def upgrade() -> None:
    conn = op.get_bind()
    tables = _tables(conn)

    if "api_keys" not in tables:
        op.create_table(
            "api_keys",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("prefix", sa.String(length=16), nullable=False),
            sa.Column("last4", sa.String(length=4), nullable=False),
            sa.Column("key_hash", sa.String(length=64), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("last_used_at", sa.DateTime(), nullable=True),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])
        op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"], unique=True)

    if "api_project_links" not in tables:
        op.create_table(
            "api_project_links",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            # No FK on purpose: the link outlives a failed project's deleted row.
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("api_key_id", sa.Integer(), sa.ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True),
            sa.Column("external_user_id", sa.String(length=255), nullable=True),
            sa.Column("metadata", sa.JSON(), nullable=True),
            sa.Column("idempotency_key", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "idempotency_key", name="uq_api_project_links_owner_idem"),
        )
        op.create_index("ix_api_project_links_project_id", "api_project_links", ["project_id"], unique=True)
        op.create_index("ix_api_project_links_user_id", "api_project_links", ["user_id"])
        op.create_index("ix_api_project_links_api_key_id", "api_project_links", ["api_key_id"])
        op.create_index("ix_api_project_links_external_user_id", "api_project_links", ["external_user_id"])
        op.create_index("ix_api_project_links_created_at", "api_project_links", ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    tables = _tables(conn)
    if "api_project_links" in tables:
        op.drop_table("api_project_links")
    if "api_keys" in tables:
        op.drop_table("api_keys")
