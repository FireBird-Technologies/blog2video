"""Add referral and referral_signups tables for affiliate program.

Revision ID: add_referral_tables
Revises: add_qty_to_subs
Create Date: 2026-04-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_referral_tables"
down_revision: Union[str, None] = "add_qty_to_subs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "referrals" not in existing_tables:
        op.create_table(
            "referrals",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("referrer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("code", sa.String(36), nullable=False, unique=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        )
        op.create_index("ix_referrals_referrer_id", "referrals", ["referrer_id"])
        op.create_index("ix_referrals_code", "referrals", ["code"], unique=True)

    if "referral_signups" not in existing_tables:
        op.create_table(
            "referral_signups",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("referral_id", sa.Integer(), sa.ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False),
            sa.Column("new_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("new_user_id", name="uq_referral_signups_new_user_id"),
        )
        op.create_index("ix_referral_signups_referral_id", "referral_signups", ["referral_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "referral_signups" in existing_tables:
        op.drop_table("referral_signups")

    if "referrals" in existing_tables:
        op.drop_table("referrals")

    # Note: user column drops are handled in add_affiliate_user_columns downgrade
