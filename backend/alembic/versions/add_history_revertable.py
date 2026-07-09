"""Add revertable flag to edit-history tables.

Bulk operations (script regen, template change, audio regen) are logged for
visibility but cannot be reverted via a field diff — ``revertable=False`` marks
them so the API/UI hide the revert action.

Revision ID: add_history_revertable
Revises: add_scene_comments
Create Date: 2026-07-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_history_revertable"
down_revision: Union[str, Sequence[str], None] = "add_scene_comments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(inspector, table):
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for tbl in ("scene_edit_history", "project_edit_history"):
        if tbl not in inspector.get_table_names():
            continue
        if "revertable" not in _cols(inspector, tbl):
            op.add_column(
                tbl,
                sa.Column("revertable", sa.Boolean(), nullable=False, server_default=sa.true()),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for tbl in ("scene_edit_history", "project_edit_history"):
        if tbl not in inspector.get_table_names():
            continue
        if "revertable" in _cols(inspector, tbl):
            op.drop_column(tbl, "revertable")
