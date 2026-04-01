"""Phase 8: Add content_archetype_ids column for brand-specific scene types

Revision ID: phase8_content_archetype_ids
Revises: phase7_content_codes
Create Date: 2026-03-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "phase8_content_archetype_ids"
down_revision: tuple = ("expand_category_varchar", "add_video_length_to_projects")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_templates",
        sa.Column("content_archetype_ids", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("custom_templates", "content_archetype_ids")
