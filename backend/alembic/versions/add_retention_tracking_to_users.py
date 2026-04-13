"""Add retention tracking fields to users.

Revision ID: add_retention_tracking_to_users
Revises: phase9_generation_failed
Create Date: 2026-04-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_retention_tracking_to_users"
down_revision: Union[str, None] = "phase9_generation_failed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("retention_offer_shown_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("retention_offer_suppressed", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "retention_offer_suppressed")
    op.drop_column("users", "retention_offer_shown_count")
