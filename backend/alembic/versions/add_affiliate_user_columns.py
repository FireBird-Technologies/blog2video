"""Add affiliate columns to users table.

Adds:
  - referrals_given      : lifetime count of successful referral grants; never reset
                           on delete/reactivate so the 10-signup cap cannot be bypassed.
  - referral_video_bonus : current permanent referral bonus videos; wiped on
                           account deletion/reactivation (unlike referrals_given).

Revision ID: add_affiliate_user_columns
Revises: add_referral_tables
Create Date: 2026-04-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_affiliate_user_columns"
down_revision: Union[str, None] = "add_referral_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_cols = {col["name"] for col in inspector.get_columns("users")}

    if "referrals_given" not in user_cols:
        op.add_column(
            "users",
            sa.Column("referrals_given", sa.Integer(), nullable=False, server_default="0"),
        )

    if "referral_video_bonus" not in user_cols:
        op.add_column(
            "users",
            sa.Column("referral_video_bonus", sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_cols = {col["name"] for col in inspector.get_columns("users")}

    if "referral_video_bonus" in user_cols:
        op.drop_column("users", "referral_video_bonus")

    if "referrals_given" in user_cols:
        op.drop_column("users", "referrals_given")
