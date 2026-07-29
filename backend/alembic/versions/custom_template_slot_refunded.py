"""Add slot_refunded column to custom_templates

Revision ID: custom_template_slot_refunded
Revises: custom_template_is_regenerating
Create Date: 2026-07-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "custom_template_slot_refunded"
down_revision: str = "custom_template_is_regenerating"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_templates",
        sa.Column("slot_refunded", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("custom_templates", "slot_refunded")
