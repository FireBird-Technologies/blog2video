"""Add initiated_by_user_id to project_regenerate_script_jobs

Records the collaborator who actually initiated a script regeneration (distinct from
user_id, the owner/payer) so only that user may approve/regenerate the review step.

Revision ID: regen_script_initiated_by
Revises: add_comment_parent_id
Create Date: 2026-07-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "regen_script_initiated_by"
down_revision: Union[str, None] = "add_comment_parent_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "project_regenerate_script_jobs",
        sa.Column("initiated_by_user_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_project_regenerate_script_jobs_initiated_by_user_id"),
        "project_regenerate_script_jobs",
        ["initiated_by_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_regen_script_jobs_initiated_by_user_id",
        "project_regenerate_script_jobs",
        "users",
        ["initiated_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_regen_script_jobs_initiated_by_user_id",
        "project_regenerate_script_jobs",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_project_regenerate_script_jobs_initiated_by_user_id"),
        table_name="project_regenerate_script_jobs",
    )
    op.drop_column("project_regenerate_script_jobs", "initiated_by_user_id")
