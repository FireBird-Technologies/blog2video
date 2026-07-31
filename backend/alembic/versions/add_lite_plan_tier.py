"""add lite plan tier + ai_edits_used_this_period column

Revision ID: add_lite_plan_tier
Revises: custom_template_slot_refunded
Create Date: 2026-07-31

Adds LITE to the plantier enum so users.plan can be 'lite', and adds the
ai_edits_used_this_period counter backing the new monthly AI-edit allowance
(Lite/Standard/Pro all meter AI edits now instead of Standard/Pro being
unlimited).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_lite_plan_tier"
down_revision: Union[str, None] = "custom_template_slot_refunded"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    dialect_name = conn.dialect.name
    if dialect_name == "postgresql":
        # Add LITE to the existing enum type. Postgres stores enum member NAMES
        # (uppercase), not the Python str value — mirrors add_standard_plan_tier.
        # ADD VALUE cannot run inside a transaction block on older Postgres;
        # AUTOCOMMIT isolation avoids "ALTER TYPE ... cannot run inside a
        # transaction block".
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE plantier ADD VALUE IF NOT EXISTS 'LITE'")
    # SQLite: no native enum; plan column is VARCHAR. App accepts 'lite'. No change needed.

    op.add_column(
        "users",
        sa.Column(
            "ai_edits_used_this_period",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # One-time backfill: every existing paid user gets their full monthly AI-edit
    # allowance rather than starting metered at 0 remaining. Standard/Pro were
    # previously unlimited, so ai_edits_used_this_period (just added, defaulted
    # to 0 above) already reads as "full allowance available" — this only needs
    # to anchor period_start for any paid user missing it, so the monthly
    # rollover has a well-defined cycle. Safe to run once per deploy; a fresh
    # install has no paid users yet so this is a no-op.
    op.execute(
        "UPDATE users SET period_start = COALESCE(period_start, CURRENT_TIMESTAMP) "
        "WHERE plan IN ('LITE', 'STANDARD', 'PRO')"
    )


def downgrade() -> None:
    op.drop_column("users", "ai_edits_used_this_period")
    # Removing an enum value in PostgreSQL requires recreating the type; skip for simplicity.
