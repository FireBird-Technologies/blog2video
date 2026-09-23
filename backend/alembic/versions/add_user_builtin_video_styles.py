"""Add per-user overrides for concrete built-in video styles.

Revision ID: add_user_builtin_video_styles
Revises: add_user_managed_video_styles
"""
from alembic import op
import sqlalchemy as sa


revision = "add_user_builtin_video_styles"
down_revision = "add_user_managed_video_styles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_builtin_video_styles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("builtin_key", sa.String(30), nullable=False),
        sa.Column("guidance", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "builtin_key IN ('explainer', 'storytelling', 'promotional')",
            name="ck_user_builtin_video_style_key",
        ),
        sa.UniqueConstraint("user_id", "builtin_key", name="uq_user_builtin_video_style"),
    )
    op.create_index(
        "ix_user_builtin_video_styles_user_id",
        "user_builtin_video_styles",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_builtin_video_styles_user_id",
        table_name="user_builtin_video_styles",
    )
    op.drop_table("user_builtin_video_styles")
