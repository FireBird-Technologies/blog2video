"""Add WordPress content-source columns to social_connections

- auth_kind: how a WordPress connection authenticates — "app_password"
  (self-hosted, Basic auth with an application password) or "wpcom_oauth"
  (WordPress.com, bearer token from the OAuth popup).
- api_root: the REST base URL the connection talks to (a discovered
  /wp-json/ or ?rest_route= root, or the WordPress.com site proxy).

Both nullable and additive; guarded so a re-run or drifted DB doesn't fail.

Revision ID: add_wordpress_source_columns
Revises: add_content_source_integrations
Create Date: 2026-09-25

"""
from alembic import op
import sqlalchemy as sa

revision = "add_wordpress_source_columns"
down_revision = "add_content_source_integrations"
branch_labels = None
depends_on = None


_COLUMNS = (
    ("social_connections", sa.Column("auth_kind", sa.String(length=16), nullable=True)),
    ("social_connections", sa.Column("api_root", sa.Text(), nullable=True)),
)


def _column_names(conn, table: str) -> set[str]:
    insp = sa.inspect(conn)
    if table not in insp.get_table_names():
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    for table, column in _COLUMNS:
        existing = _column_names(conn, table)
        if existing and column.name not in existing:
            op.add_column(table, column)


def downgrade() -> None:
    conn = op.get_bind()
    for table, column in reversed(_COLUMNS):
        if column.name in _column_names(conn, table):
            op.drop_column(table, column.name)
