"""add template_ratings table

Revision ID: add_template_ratings
Revises: survey_promo_questions
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_template_ratings"
down_revision: Union[str, None] = "survey_promo_questions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "template_ratings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("custom_template_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("suggestion", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["custom_template_id"], ["custom_templates.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "custom_template_id", name="uq_template_ratings_user_template"
        ),
    )
    op.create_index(
        op.f("ix_template_ratings_user_id"), "template_ratings", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_template_ratings_custom_template_id"),
        "template_ratings",
        ["custom_template_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_template_ratings_custom_template_id"), table_name="template_ratings")
    op.drop_index(op.f("ix_template_ratings_user_id"), table_name="template_ratings")
    op.drop_table("template_ratings")
