"""Add projects.source_site

The site/publication an imported post came from (host + path for Ghost and
WordPress, the publication id for Beehiiv). Post ids are only unique per site —
WordPress's are small integers — so "the post this was made from" must only be
matched while that same site is connected.

Nullable and additive; guarded so a re-run or drifted DB doesn't fail.

Revision ID: add_project_source_site
Revises: add_wordpress_source_columns
Create Date: 2026-09-25

"""
from alembic import op
import sqlalchemy as sa

revision = "add_project_source_site"
down_revision = "add_wordpress_source_columns"
branch_labels = None
depends_on = None


_COLUMNS = (
    ("projects", sa.Column("source_site", sa.String(length=255), nullable=True)),
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
