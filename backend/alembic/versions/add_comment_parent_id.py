"""Add parent_id to scene_comments for threaded replies.

Nullable self-reference: null = root comment, else the comment being replied to.
Deleting a comment cascades to its replies.

Revision ID: add_comment_parent_id
Revises: add_history_revertable
Create Date: 2026-07-06
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_comment_parent_id"
down_revision: Union[str, None] = "add_history_revertable"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scene_comments",
        sa.Column("parent_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_scene_comments_parent_id", "scene_comments", ["parent_id"]
    )
    op.create_foreign_key(
        "fk_scene_comments_parent_id",
        "scene_comments",
        "scene_comments",
        ["parent_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_scene_comments_parent_id", "scene_comments", type_="foreignkey"
    )
    op.drop_index("ix_scene_comments_parent_id", table_name="scene_comments")
    op.drop_column("scene_comments", "parent_id")
