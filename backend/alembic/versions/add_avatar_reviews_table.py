"""add avatar_reviews table

Per-user 5-star rating + message for a project's avatar overlays. Separate from
``reviews`` (which is UNIQUE(user_id, project_id)) so a user can leave both a
video review and an avatar review on the same project.

Revision ID: add_avatar_reviews
Revises: avatar_credits_refunded
Create Date: 2026-08-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_avatar_reviews"
down_revision: Union[str, None] = "avatar_credits_refunded"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "avatar_reviews",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("suggestion", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "project_id", name="uq_avatar_reviews_user_project"
        ),
    )
    op.create_index(
        op.f("ix_avatar_reviews_user_id"), "avatar_reviews", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_avatar_reviews_project_id"),
        "avatar_reviews",
        ["project_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_avatar_reviews_project_id"), table_name="avatar_reviews")
    op.drop_index(op.f("ix_avatar_reviews_user_id"), table_name="avatar_reviews")
    op.drop_table("avatar_reviews")
