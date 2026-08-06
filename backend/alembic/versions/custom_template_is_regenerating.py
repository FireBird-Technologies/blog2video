"""Add is_regenerating column to custom_templates

Revision ID: custom_template_is_regenerating
Revises: awaiting_footage_review_status
Create Date: 2026-07-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "custom_template_is_regenerating"
down_revision: str = "awaiting_footage_review_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_templates",
        sa.Column("is_regenerating", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("custom_templates", "is_regenerating")
