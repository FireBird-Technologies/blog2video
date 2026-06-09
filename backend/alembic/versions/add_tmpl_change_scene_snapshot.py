"""Add scene_snapshot to project_template_change_jobs.

Stores a JSON snapshot of scene remotion_code/preferred_layout (+ prior template)
taken before the in-place relayout, so a reaped/failed template change can be
fully reverted.

Revision ID: add_tmpl_change_scene_snapshot
Revises: drop_mcp_oauth_unused_cols
Create Date: 2026-06-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_tmpl_change_scene_snapshot"
down_revision: Union[str, None] = "drop_mcp_oauth_unused_cols"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "project_template_change_jobs",
        sa.Column("scene_snapshot", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("project_template_change_jobs", "scene_snapshot")
