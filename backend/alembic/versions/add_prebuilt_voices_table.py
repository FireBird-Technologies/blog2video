"""add prebuilt_voices table

Revision ID: add_prebuilt_voices
Revises: add_custom_voices
Create Date: 2026-03-04

Stores ElevenLabs premade voices with plan (free/paid). Seeded at app startup.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_prebuilt_voices"
down_revision: Union[str, None] = "add_custom_voices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prebuilt_voices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("voice_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("preview_url", sa.String(length=2048), nullable=True),
        sa.Column("labels", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("plan", sa.String(length=20), nullable=False, server_default="paid"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("voice_id", name="uq_prebuilt_voices_voice_id"),
        sa.CheckConstraint("plan IN ('free', 'paid')", name="prebuilt_voice_plan_check"),
    )
    op.create_index(op.f("ix_prebuilt_voices_voice_id"), "prebuilt_voices", ["voice_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_prebuilt_voices_voice_id"), table_name="prebuilt_voices")
    op.drop_table("prebuilt_voices")
