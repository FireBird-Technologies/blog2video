"""Add style pinning: custom style versioning, per-user pin, and job target.

Revision ID: add_pinned_learning_target
Revises: remove_auto_video_style_slot
"""
from alembic import op
import sqlalchemy as sa


revision = "add_pinned_learning_target"
down_revision = "remove_auto_video_style_slot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_video_styles",
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
    )
    op.add_column(
        "user_video_style_settings",
        sa.Column("pinned_learning_target", sa.String(30), nullable=True),
    )
    op.add_column(
        "script_preference_learning_jobs",
        sa.Column("target_ref", sa.String(30), server_default="your_style", nullable=False),
    )
    op.alter_column(
        "script_preference_learning_jobs",
        "profile_version_at_enqueue",
        new_column_name="target_version_at_enqueue",
    )


def downgrade() -> None:
    op.alter_column(
        "script_preference_learning_jobs",
        "target_version_at_enqueue",
        new_column_name="profile_version_at_enqueue",
    )
    op.drop_column("script_preference_learning_jobs", "target_ref")
    op.drop_column("user_video_style_settings", "pinned_learning_target")
    op.drop_column("custom_video_styles", "version")
