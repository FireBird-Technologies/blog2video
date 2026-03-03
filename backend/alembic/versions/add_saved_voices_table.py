"""add saved_voices table

Revision ID: add_saved_voices
Revises: add_standard_plan
Create Date: 2026-03-03

Stores user-saved voices (ElevenLabs custom/prebuilt) with user_id for ownership.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_saved_voices"
down_revision: Union[str, None] = "7326b571b0a6"  # after edit-history cascade; was add_standard_plan
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_voices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("voice_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("preview_url", sa.String(length=2048), nullable=True),
        sa.Column("audio_base64", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="custom"),
        sa.Column("gender", sa.String(length=20), nullable=True),
        sa.Column("accent", sa.String(length=50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_saved_voices_user_id"), "saved_voices", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_saved_voices_user_id"), table_name="saved_voices")
    op.drop_table("saved_voices")
