"""Phase 10: Add ON DELETE CASCADE to project_template_change_jobs foreign keys

Revision ID: template_change_jobs_cascade
Revises: phase9_generation_failed
Create Date: 2026-04-16
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "template_change_jobs_cascade"
down_revision: str = "add_is_active_to_projects"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing FK constraints and recreate with ON DELETE CASCADE
    op.drop_constraint(
        "project_template_change_jobs_project_id_fkey",
        "project_template_change_jobs",
        type_="foreignkey",
    )
    op.drop_constraint(
        "project_template_change_jobs_user_id_fkey",
        "project_template_change_jobs",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "project_template_change_jobs_project_id_fkey",
        "project_template_change_jobs",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "project_template_change_jobs_user_id_fkey",
        "project_template_change_jobs",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "project_template_change_jobs_project_id_fkey",
        "project_template_change_jobs",
        type_="foreignkey",
    )
    op.drop_constraint(
        "project_template_change_jobs_user_id_fkey",
        "project_template_change_jobs",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "project_template_change_jobs_project_id_fkey",
        "project_template_change_jobs",
        "projects",
        ["project_id"],
        ["id"],
    )
    op.create_foreign_key(
        "project_template_change_jobs_user_id_fkey",
        "project_template_change_jobs",
        "users",
        ["user_id"],
        ["id"],
    )
