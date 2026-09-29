"""Add Ghost / Beehiiv content-source integration columns

- social_connections.site_url: the API host a key is valid against (Ghost).
- projects.source_platform / source_post_id: which connected post a project
  was imported from, so publish-back can default to it.
- social_publish_jobs.target_post_id / target_mode: where a Ghost publish
  inserts the video; delivery: "video" (upload the MP4) or "embed" (an HTML
  card with the embed player, for Ghost plans whose upload cap is too small).

All nullable, all additive; guarded so a re-run or drifted DB doesn't fail.

Revision ID: add_content_source_integrations
Revises: extension_current_project
Create Date: 2026-09-23

"""
from alembic import op
import sqlalchemy as sa

revision = "add_content_source_integrations"
down_revision = "extension_current_project"
branch_labels = None
depends_on = None


_COLUMNS = (
    ("social_connections", sa.Column("site_url", sa.Text(), nullable=True)),
    ("projects", sa.Column("source_platform", sa.String(length=20), nullable=True)),
    ("projects", sa.Column("source_post_id", sa.String(length=64), nullable=True)),
    ("social_publish_jobs", sa.Column("target_post_id", sa.String(length=64), nullable=True)),
    ("social_publish_jobs", sa.Column("target_mode", sa.String(length=16), nullable=True)),
    ("social_publish_jobs", sa.Column("delivery", sa.String(length=16), nullable=True)),
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
