"""Remove the partner-app integration: users.billing_source and partner link columns

The public API now has one credential, a user's API key. An app serving its own
users (the former "partner app") calls with its owner's key like any other API
customer, so the partner service account, its quota bookkeeping and the
per-partner scoping columns go.

add_public_api no longer creates these columns, but it was applied in some
environments before that change, so this revision removes them where present.

Leftover partner service accounts are deactivated rather than deleted:
projects.user_id has no ON DELETE CASCADE, so deleting them would orphan their
projects. They also move off the removed 'partner' auth provider so the row
still loads; with no password hash and no google_id they cannot sign in.

Revision ID: drop_partner_app
Revises: add_api_key_encrypted
Create Date: 2026-09-30

"""
from alembic import op
import sqlalchemy as sa

revision = "drop_partner_app"
down_revision = "add_api_key_encrypted"
branch_labels = None
depends_on = None


def _column_names(conn, table: str) -> set[str]:
    insp = sa.inspect(conn)
    if table not in insp.get_table_names():
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def _index_names(conn, table: str) -> set[str]:
    return {ix["name"] for ix in sa.inspect(conn).get_indexes(table)}


def upgrade() -> None:
    conn = op.get_bind()

    if "billing_source" in _column_names(conn, "users"):
        conn.execute(
            sa.text(
                "UPDATE users SET is_active = :inactive, auth_provider = 'email' "
                "WHERE billing_source = 'partner'"
            ),
            {"inactive": False},
        )
        with op.batch_alter_table("users") as batch:
            batch.drop_column("billing_source")

    link_cols = _column_names(conn, "api_project_links")
    if "ix_api_project_links_partner_slug" in (_index_names(conn, "api_project_links") if link_cols else set()):
        op.drop_index("ix_api_project_links_partner_slug", table_name="api_project_links")
    dropped = [c for c in ("partner_slug", "partner_quota_state") if c in link_cols]
    if dropped:
        with op.batch_alter_table("api_project_links") as batch:
            for col in dropped:
                batch.drop_column(col)


def downgrade() -> None:
    """Nothing to restore: the partner integration no longer exists in code."""
