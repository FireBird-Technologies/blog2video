"""Add voice_snapshot to project_voice_change_jobs.

Stores the project's prior voice settings (gender/accent/custom_voice_id) so a
reaped/failed voice change can restore them alongside the audio.

Revision ID: add_vcj_voice_snapshot
Revises: add_project_voice_change_jobs
Create Date: 2026-06-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_vcj_voice_snapshot"
down_revision: Union[str, None] = "add_project_voice_change_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "project_voice_change_jobs",
        sa.Column("voice_snapshot", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("project_voice_change_jobs", "voice_snapshot")
