"""Add referral_invites table for tracking who was invited.

Revision ID: add_referral_invites
Revises: drop_crafted_cached_meta
Create Date: 2026-05-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_referral_invites"
down_revision: Union[str, None] = "drop_crafted_cached_meta"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "referral_invites" not in existing_tables:
        op.create_table(
            "referral_invites",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("referral_id", sa.Integer(), sa.ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False),
            sa.Column("invited_email", sa.String(255), nullable=False),
            sa.Column("status", sa.String(16), nullable=False),
            sa.Column("error_message", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_referral_invites_referral_id", "referral_invites", ["referral_id"])
        op.create_index("ix_referral_invites_invited_email", "referral_invites", ["invited_email"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "referral_invites" in existing_tables:
        op.drop_table("referral_invites")
