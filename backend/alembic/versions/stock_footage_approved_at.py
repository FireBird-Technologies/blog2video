"""Add projects.stock_footage_approved_at (stops the review gate from re-parking)

The pipeline gate fires on ``status == SCRIPTED and stock_footage_enabled``.
Approving puts the project back to SCRIPTED with the flag still enabled, so
without a marker the gate re-parks it — approve -> SCRIPTED -> re-park, forever.
This column records the approval so the gate runs exactly once per project.

Revision ID: stock_footage_approved_at
Revises: stock_footage_generation_gate
Create Date: 2026-07-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "stock_footage_approved_at"
down_revision: str = "stock_footage_generation_gate"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("projects")}
    if "stock_footage_approved_at" not in existing:
        op.add_column(
            "projects", sa.Column("stock_footage_approved_at", sa.DateTime(), nullable=True)
        )


def downgrade() -> None:
    op.drop_column("projects", "stock_footage_approved_at")
