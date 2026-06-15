"""Add VOICE_REGENERATING to projectstatus enum.

Revision ID: add_voice_regenerating_status
Revises: add_voice_emotion
Create Date: 2026-06-15
"""
from typing import Sequence, Union

from alembic import op


revision: str = "add_voice_regenerating_status"
down_revision: Union[str, None] = "add_voice_emotion"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'VOICE_REGENERATING'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely in-place.
    pass
