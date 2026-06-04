"""Phase 10: Add project_regenerate_script_jobs table

Revision ID: regenerate_script_jobs
Revises: phase12_free_templates_download
Create Date: 2026-06-03
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "regenerate_script_jobs"
down_revision: str = "phase12_free_templates_download"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_regenerate_script_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("total_scenes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_scenes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("scene_snapshot", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_regenerate_script_jobs_project_id", "project_regenerate_script_jobs", ["project_id"])
    op.create_index("ix_project_regenerate_script_jobs_user_id", "project_regenerate_script_jobs", ["user_id"])
    op.create_index("ix_project_regenerate_script_jobs_status", "project_regenerate_script_jobs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_project_regenerate_script_jobs_status", table_name="project_regenerate_script_jobs")
    op.drop_index("ix_project_regenerate_script_jobs_user_id", table_name="project_regenerate_script_jobs")
    op.drop_index("ix_project_regenerate_script_jobs_project_id", table_name="project_regenerate_script_jobs")
    op.drop_table("project_regenerate_script_jobs")
