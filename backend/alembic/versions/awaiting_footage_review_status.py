"""Add AWAITING_STOCK_FOOTAGE_REVIEW project status (post-generation review gate)

The stock-footage review gate moves from mid-pipeline (paused after script
generation, AWAITING_FOOTAGE) to post-generation (after scenes + parallel
clip fetch complete). AWAITING_FOOTAGE is kept in the Python enum and DB type
for backward compat with any project already parked there when this ships;
new pipeline runs use AWAITING_STOCK_FOOTAGE_REVIEW instead.

Revision ID: awaiting_footage_review_status
Revises: project_is_bulk
Create Date: 2026-07-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "awaiting_footage_review_status"
down_revision: str = "project_is_bulk"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute(
                "ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'AWAITING_STOCK_FOOTAGE_REVIEW'"
            )


def downgrade() -> None:
    # No DROP VALUE in Postgres; harmless if unused, same rationale as
    # stock_footage_generation_gate.py's downgrade.
    pass
