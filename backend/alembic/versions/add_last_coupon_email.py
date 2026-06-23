"""Add last_coupon_email_at to users

Tracks when the most recent post-checkout win-back coupon email was sent, so the
abandoned-checkout email (driven by Stripe's checkout.session.expired webhook) can
be throttled to at most once per rolling 24h per user.

Revision ID: add_last_coupon_email
Revises: add_custom_template_quota
Create Date: 2026-06-23

"""
from alembic import op
import sqlalchemy as sa

revision = "add_last_coupon_email"
down_revision = "add_custom_template_quota"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_coupon_email_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_coupon_email_at")
