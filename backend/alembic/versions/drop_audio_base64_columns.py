"""drop audio_base64 from saved_voices and custom_voices

Revision ID: drop_audio_base64
Revises: add_saved_voices_plan
Create Date: 2026-03-05

Use preview_url only for voice previews; remove inline base64 columns.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "drop_audio_base64"
down_revision: Union[str, None] = "add_saved_voices_plan"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("saved_voices", "audio_base64")
    op.drop_column("custom_voices", "audio_base64")


def downgrade() -> None:
    op.add_column("saved_voices", sa.Column("audio_base64", sa.Text(), nullable=True))
    op.add_column("custom_voices", sa.Column("audio_base64", sa.Text(), nullable=True))
