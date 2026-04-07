"""Add project template change jobs table.

Revision ID: add_project_template_change_jobs
Revises: add_retention_tracking_to_users
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_project_template_change_jobs"
down_revision: Union[str, None] = "add_retention_tracking_to_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_template_change_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target_template", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("total_scenes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_scenes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_project_template_change_jobs_project_id",
        "project_template_change_jobs",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_template_change_jobs_user_id",
        "project_template_change_jobs",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_template_change_jobs_status",
        "project_template_change_jobs",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_project_template_change_jobs_status", table_name="project_template_change_jobs")
    op.drop_index("ix_project_template_change_jobs_user_id", table_name="project_template_change_jobs")
    op.drop_index("ix_project_template_change_jobs_project_id", table_name="project_template_change_jobs")
    op.drop_table("project_template_change_jobs")
