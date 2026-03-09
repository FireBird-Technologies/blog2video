"""add custom_voices table and saved_voices.custom_voice_id

Revision ID: add_custom_voices
Revises: add_saved_voices
Create Date: 2026-03-03

Custom voices: creation records (prompt, response, form fields, Generated N name).
Saved voices: optional FK to custom_voice when user saves a custom voice.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_custom_voices"
down_revision: Union[str, None] = "add_saved_voices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "custom_voices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("voice_id", sa.String(length=100), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=True),
        sa.Column("response_json", sa.Text(), nullable=True),
        sa.Column("form_gender", sa.String(length=50), nullable=True),
        sa.Column("form_age", sa.String(length=50), nullable=True),
        sa.Column("form_persona", sa.String(length=100), nullable=True),
        sa.Column("form_speed", sa.String(length=50), nullable=True),
        sa.Column("form_accent", sa.String(length=100), nullable=True),
        sa.Column("preview_url", sa.String(length=2048), nullable=True),
        sa.Column("audio_base64", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_custom_voices_user_id"), "custom_voices", ["user_id"], unique=False)

    op.add_column("saved_voices", sa.Column("custom_voice_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_saved_voices_custom_voice_id", "saved_voices", "custom_voices", ["custom_voice_id"], ["id"], ondelete="SET NULL")
    op.create_index(op.f("ix_saved_voices_custom_voice_id"), "saved_voices", ["custom_voice_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_saved_voices_custom_voice_id"), table_name="saved_voices")
    op.drop_constraint("fk_saved_voices_custom_voice_id", "saved_voices", type_="foreignkey")
    op.drop_column("saved_voices", "custom_voice_id")
    op.drop_index(op.f("ix_custom_voices_user_id"), table_name="custom_voices")
    op.drop_table("custom_voices")
