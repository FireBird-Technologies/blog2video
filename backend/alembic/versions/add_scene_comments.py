"""Add scene_comments table for per-scene collaborator comments.

Revision ID: add_scene_comments
Revises: drop_project_draft_columns
Create Date: 2026-07-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_scene_comments"
down_revision: Union[str, Sequence[str], None] = "drop_project_draft_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "scene_comments" in inspector.get_table_names():
        return
    op.create_table(
        "scene_comments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scene_id", sa.Integer(), sa.ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_scene_comments_project_id", "scene_comments", ["project_id"])
    op.create_index("ix_scene_comments_scene_id", "scene_comments", ["scene_id"])
    op.create_index("ix_scene_comments_user_id", "scene_comments", ["user_id"])
    op.create_index("ix_scene_comments_created_at", "scene_comments", ["created_at"])
    op.create_index("ix_scene_comment_project_scene", "scene_comments", ["project_id", "scene_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "scene_comments" in inspector.get_table_names():
        op.drop_table("scene_comments")
