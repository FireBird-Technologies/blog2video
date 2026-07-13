"""Add project language change jobs table.

Persists language-change runs (translate every scene's copy, then regenerate every
voiceover) so the stall-recovery machinery (status-API reap + boot sweep) can detect a
stuck/dead run via the updated_at heartbeat and revert + refund the owner's credit.

Mirrors project_voice_change_jobs, swapping voice_snapshot for content_snapshot (the
prior content_language plus every scene's title / display_text / narration_text /
remotion_code) and adding target_language.

Revision ID: add_project_language_change_jobs
Revises: add_is_active_to_scenes
Create Date: 2026-07-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_project_language_change_jobs"
down_revision: Union[str, None] = "add_is_active_to_scenes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_language_change_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("total_scenes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_scenes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("audio_backed_up", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("target_language", sa.String(length=10), nullable=True),
        sa.Column("content_snapshot", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_project_language_change_jobs_project_id",
        "project_language_change_jobs",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_language_change_jobs_user_id",
        "project_language_change_jobs",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_language_change_jobs_status",
        "project_language_change_jobs",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_project_language_change_jobs_status", table_name="project_language_change_jobs")
    op.drop_index("ix_project_language_change_jobs_user_id", table_name="project_language_change_jobs")
    op.drop_index("ix_project_language_change_jobs_project_id", table_name="project_language_change_jobs")
    op.drop_table("project_language_change_jobs")
