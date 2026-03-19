"""add content_language to projects

Revision ID: add_content_lang
Revises: a1b2c3d4e5f6
Create Date: 2026-03-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_content_lang"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("content_language", sa.String(length=10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "content_language")
