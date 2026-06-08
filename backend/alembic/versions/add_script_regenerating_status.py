"""Add SCRIPT_REGENERATING to projectstatus enum.

Revision ID: add_script_regenerating_status
Revises: regenerate_script_jobs
Create Date: 2026-06-03
"""
from typing import Sequence, Union

from alembic import op


revision: str = "add_script_regenerating_status"
down_revision: Union[str, None] = "regenerate_script_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'SCRIPT_REGENERATING'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely in-place.
    pass
