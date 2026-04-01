"""Phase 9: Add generation_failed column to custom_templates

Revision ID: phase9_generation_failed
Revises: phase8_content_archetype_ids
Create Date: 2026-03-31
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "phase9_generation_failed"
down_revision: str = "phase8_content_archetype_ids"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_templates",
        sa.Column("generation_failed", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("custom_templates", "generation_failed")
