"""Add caption_font_family and caption_font_size columns to projects

Revision ID: add_caption_font_columns
Revises: add_captions_to_projects
Create Date: 2026-06-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "add_caption_font_columns"
down_revision: str = "add_captions_to_projects"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("caption_font_family", sa.String(length=50), nullable=False, server_default="inter"))
    op.add_column("projects", sa.Column("caption_font_size", sa.String(length=10), nullable=False, server_default="20"))


def downgrade() -> None:
    op.drop_column("projects", "caption_font_size")
    op.drop_column("projects", "caption_font_family")
