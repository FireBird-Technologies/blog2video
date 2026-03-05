"""add plan column to saved_voices

Revision ID: add_saved_voices_plan
Revises: drop_prebuilt_category
Create Date: 2026-03-04

Stores ElevenLabs plan (free/paid) for prebuilt voices so step 3 can show Premium badge.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_saved_voices_plan"
down_revision: Union[str, None] = "drop_prebuilt_category"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("saved_voices", sa.Column("plan", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("saved_voices", "plan")
