"""Add project add-scene jobs table.

Persists background add-scene generation runs so the frontend can poll status and the
credits reserved on enqueue can be refunded if all retry attempts fail.

Revision ID: add_project_add_scene_jobs
Revises: ai_edit_credits_default_6
Create Date: 2026-07-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_project_add_scene_jobs"
down_revision: Union[str, None] = "ai_edit_credits_default_6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_add_scene_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiated_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("current_step", sa.String(length=40), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.Column("cost", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("new_scene_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_project_add_scene_jobs_project_id", "project_add_scene_jobs", ["project_id"], unique=False)
    op.create_index("ix_project_add_scene_jobs_user_id", "project_add_scene_jobs", ["user_id"], unique=False)
    op.create_index("ix_project_add_scene_jobs_initiated_by_user_id", "project_add_scene_jobs", ["initiated_by_user_id"], unique=False)
    op.create_index("ix_project_add_scene_jobs_status", "project_add_scene_jobs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_project_add_scene_jobs_status", table_name="project_add_scene_jobs")
    op.drop_index("ix_project_add_scene_jobs_initiated_by_user_id", table_name="project_add_scene_jobs")
    op.drop_index("ix_project_add_scene_jobs_user_id", table_name="project_add_scene_jobs")
    op.drop_index("ix_project_add_scene_jobs_project_id", table_name="project_add_scene_jobs")
    op.drop_table("project_add_scene_jobs")
