"""Add GENERATING to projectstatus enum.

Revision ID: add_generating_to_project_status
Revises: add_project_template_change_jobs
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op


revision: str = "add_generating_to_project_status"
down_revision: Union[str, None] = "add_project_template_change_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'GENERATING'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely in-place.
    pass
