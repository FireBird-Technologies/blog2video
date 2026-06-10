"""add voice_emotion to projects and preferred_voice_emotion to users
Revision ID: add_voice_emotion
Revises: add_scheduled_plan_change
Create Date: 2026-06-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_voice_emotion"
down_revision: Union[str, None] = "add_scheduled_plan_change"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("voice_emotion", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("preferred_voice_emotion", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "preferred_voice_emotion")
    op.drop_column("projects", "voice_emotion")
