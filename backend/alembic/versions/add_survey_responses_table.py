"""Add survey_responses table

Revision ID: add_survey_responses
Revises: add_voice_regenerating_status
Create Date: 2026-06-16
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "add_survey_responses"
down_revision: str = "add_voice_regenerating_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "survey_responses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("heard_from", sa.String(length=500), nullable=True),
        sa.Column("improvements", sa.String(length=2000), nullable=True),
        sa.Column("main_reason", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_survey_responses_user_id"),
    )
    op.create_index(
        op.f("ix_survey_responses_user_id"), "survey_responses", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_survey_responses_user_id"), table_name="survey_responses")
    op.drop_table("survey_responses")
