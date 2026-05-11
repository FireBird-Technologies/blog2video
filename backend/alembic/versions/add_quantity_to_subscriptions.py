"""add quantity column to subscriptions

Revision ID: add_qty_to_subs
Revises: add_update_emails
Create Date: 2026-04-22

Per-video slider lets users buy N credits in one checkout. Previously we
inserted one row per purchase regardless of N, so credit counts were wrong
for any pack > 1. This adds `quantity` so one row can represent N credits.

Backfill: existing rows are all 1-credit purchases (pre-slider), so
server_default='1' gives them the correct value.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_qty_to_subs"
down_revision: Union[str, None] = "add_update_emails"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "quantity")
