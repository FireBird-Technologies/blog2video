"""Replace survey free-text columns with the 5 new question columns

Revision ID: survey_promo_questions
Revises: add_survey_responses
Create Date: 2026-06-16
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "survey_promo_questions"
down_revision: str = "add_survey_responses"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("survey_responses", sa.Column("rating", sa.String(length=50), nullable=True))
    op.add_column("survey_responses", sa.Column("use_case", sa.String(length=2000), nullable=True))
    op.add_column("survey_responses", sa.Column("target_audience", sa.String(length=2000), nullable=True))
    op.add_column("survey_responses", sa.Column("desired_feature", sa.String(length=2000), nullable=True))
    # heard_from is retained (Q5). Drop the two columns no longer used.
    op.drop_column("survey_responses", "improvements")
    op.drop_column("survey_responses", "main_reason")


def downgrade() -> None:
    op.add_column("survey_responses", sa.Column("main_reason", sa.String(length=2000), nullable=True))
    op.add_column("survey_responses", sa.Column("improvements", sa.String(length=2000), nullable=True))
    op.drop_column("survey_responses", "desired_feature")
    op.drop_column("survey_responses", "target_audience")
    op.drop_column("survey_responses", "use_case")
    op.drop_column("survey_responses", "rating")
