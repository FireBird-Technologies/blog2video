"""Drop crafted_templates.cached_meta_json column.

The summary metadata previously stored in this column is now persisted on
R2 as ``{r2_prefix}/summary.json``. The list endpoint reads from R2 with
an in-process cache that the frontend can bypass via ``Cache-Control:
no-cache`` on hard refresh, removing the need to keep the column in sync.

Revision ID: drop_crafted_cached_meta
Revises: add_crafted_templates
Create Date: 2026-05-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "drop_crafted_cached_meta"
down_revision: Union[str, None] = "add_crafted_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "crafted_templates" not in table_names:
        return
    cols = {c["name"] for c in inspector.get_columns("crafted_templates")}
    if "cached_meta_json" in cols:
        op.drop_column("crafted_templates", "cached_meta_json")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "crafted_templates" not in table_names:
        return
    cols = {c["name"] for c in inspector.get_columns("crafted_templates")}
    if "cached_meta_json" not in cols:
        op.add_column(
            "crafted_templates",
            sa.Column("cached_meta_json", sa.Text(), nullable=True),
        )
