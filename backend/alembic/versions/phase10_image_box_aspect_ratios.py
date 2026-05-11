"""Phase 10: Add image_box_aspect_ratios column to custom_templates

Revision ID: phase10_image_box_aspect_ratios
Revises: phase9_generation_failed
Create Date: 2026-04-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "phase10_image_box_aspect_ratios"
down_revision: str = "add_embed_token_to_projects"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_templates",
        sa.Column("image_box_aspect_ratios", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("custom_templates", "image_box_aspect_ratios")
