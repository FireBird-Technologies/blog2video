"""Drop project draft columns.

Collaboration edits now apply directly to the live Scene/Project rows, so the
draft overlay (``draft_state`` / ``draft_updated_at``) is no longer used.

Revision ID: drop_project_draft_columns
Revises: add_collaboration
Create Date: 2026-07-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "drop_project_draft_columns"
down_revision: Union[str, Sequence[str], None] = "add_collaboration"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(inspector, table):
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    proj_cols = _cols(inspector, "projects")
    for col in ("draft_updated_at", "draft_state"):
        if col in proj_cols:
            op.drop_column("projects", col)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    proj_cols = _cols(inspector, "projects")
    if "draft_state" not in proj_cols:
        op.add_column("projects", sa.Column("draft_state", sa.Text(), nullable=True))
    if "draft_updated_at" not in proj_cols:
        op.add_column("projects", sa.Column("draft_updated_at", sa.DateTime(), nullable=True))
