"""Add project voice change jobs table.

Persists voice-change (voiceover regeneration) runs so the stall-recovery
machinery (status-API reap + boot sweep) can detect a stuck/dead run via the
updated_at heartbeat and revert + refund. Replaces the previous in-memory-only
progress tracking.

Revision ID: add_project_voice_change_jobs
Revises: add_tmpl_change_scene_snapshot
Create Date: 2026-06-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_project_voice_change_jobs"
down_revision: Union[str, None] = "add_tmpl_change_scene_snapshot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_voice_change_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("total_scenes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_scenes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("audio_backed_up", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_project_voice_change_jobs_project_id",
        "project_voice_change_jobs",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_voice_change_jobs_user_id",
        "project_voice_change_jobs",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_voice_change_jobs_status",
        "project_voice_change_jobs",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_project_voice_change_jobs_status", table_name="project_voice_change_jobs")
    op.drop_index("ix_project_voice_change_jobs_user_id", table_name="project_voice_change_jobs")
    op.drop_index("ix_project_voice_change_jobs_project_id", table_name="project_voice_change_jobs")
    op.drop_table("project_voice_change_jobs")
