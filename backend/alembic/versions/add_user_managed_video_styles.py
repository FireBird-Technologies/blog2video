"""Add user-managed video style library and Step 2 slots.

Revision ID: add_user_managed_video_styles
Revises: add_script_style_preferences
"""
from alembic import op
import sqlalchemy as sa


revision = "add_user_managed_video_styles"
down_revision = "add_script_style_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "custom_video_styles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("guidance", sa.Text(), nullable=False),
        sa.Column("creation_method", sa.String(20), server_default="manual", nullable=False),
        sa.Column("source_prompt", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_custom_video_styles_user_id", "custom_video_styles", ["user_id"])
    op.create_table(
        "user_video_style_slots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("builtin_key", sa.String(30), nullable=True),
        sa.Column("custom_style_id", sa.Integer(), sa.ForeignKey("custom_video_styles.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("position >= 0 AND position < 9", name="ck_video_style_slot_position"),
        sa.CheckConstraint(
            "(builtin_key IS NOT NULL AND custom_style_id IS NULL) OR "
            "(builtin_key IS NULL AND custom_style_id IS NOT NULL)",
            name="ck_video_style_slot_one_reference",
        ),
        sa.UniqueConstraint("user_id", "position", name="uq_video_style_slot_position"),
        sa.UniqueConstraint("user_id", "builtin_key", name="uq_video_style_slot_builtin"),
        sa.UniqueConstraint("user_id", "custom_style_id", name="uq_video_style_slot_custom"),
    )
    op.create_index("ix_user_video_style_slots_user_id", "user_video_style_slots", ["user_id"])
    op.create_index("ix_user_video_style_slots_custom_style_id", "user_video_style_slots", ["custom_style_id"])
    op.create_table(
        "user_video_style_settings",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("learned_style_dismissed", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("user_video_style_settings")
    op.drop_index("ix_user_video_style_slots_custom_style_id", table_name="user_video_style_slots")
    op.drop_index("ix_user_video_style_slots_user_id", table_name="user_video_style_slots")
    op.drop_table("user_video_style_slots")
    op.drop_index("ix_custom_video_styles_user_id", table_name="custom_video_styles")
    op.drop_table("custom_video_styles")
