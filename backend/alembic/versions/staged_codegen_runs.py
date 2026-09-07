"""Staged codegen: custom_template_gen_runs + custom_templates.active_gen_run_id

Generation ran as one ~370s call whose output was persisted only at the end, so
a crash at scene 7 of 9 discarded all nine — including the 60-90s blueprint
call that had already succeeded. A run row records each stage boundary and every
individual scene, so a resumed run regenerates only what is missing.

Chained from add_design_system, the custom-template lineage. The repo has
several independent heads; this deliberately does NOT merge them.

Revision ID: staged_codegen_runs
Revises: add_design_system
Create Date: 2026-08-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "staged_codegen_runs"
down_revision: str = "add_design_system"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "custom_template_gen_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="initial"),
        sa.Column("stage", sa.String(length=32), nullable=False, server_default="blueprint"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="running"),
        sa.Column("blueprint_json", sa.Text(), nullable=True),
        sa.Column("design_system", sa.Text(), nullable=True),
        sa.Column("scene_plan", sa.Text(), nullable=True),
        sa.Column("scene_results", sa.Text(), nullable=True),
        sa.Column("warnings", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["template_id"], ["custom_templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_custom_template_gen_runs_template_id",
        "custom_template_gen_runs",
        ["template_id"],
    )
    op.create_index(
        "ix_custom_template_gen_runs_user_id",
        "custom_template_gen_runs",
        ["user_id"],
    )
    op.add_column(
        "custom_templates",
        sa.Column("active_gen_run_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("custom_templates", "active_gen_run_id")
    op.drop_index("ix_custom_template_gen_runs_user_id", table_name="custom_template_gen_runs")
    op.drop_index("ix_custom_template_gen_runs_template_id", table_name="custom_template_gen_runs")
    op.drop_table("custom_template_gen_runs")
