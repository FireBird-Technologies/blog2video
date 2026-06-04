"""add regeneration instructions and current step to jobs

Revision ID: add_user_instr_to_regen_jobs
Revises: add_script_regenerating_status
Create Date: 2026-06-04

Adds columns to persist the user's regeneration instructions and expose the
current background phase to the frontend progress indicator.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "add_user_instr_to_regen_jobs"
down_revision: Union[str, None] = "add_script_regenerating_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "project_regenerate_script_jobs",
        sa.Column(
            "current_step",
            sa.String(length=40),
            nullable=False,
            server_default="analyzing_instruction",
        ),
    )
    op.add_column(
        "project_regenerate_script_jobs",
        sa.Column("user_instruction", sa.Text(), nullable=True),
    )
    op.alter_column(
        "project_regenerate_script_jobs",
        "current_step",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("project_regenerate_script_jobs", "user_instruction")
    op.drop_column("project_regenerate_script_jobs", "current_step")
