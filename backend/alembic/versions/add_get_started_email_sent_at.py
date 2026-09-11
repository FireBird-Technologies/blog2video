"""Add get_started_email_sent_at to users

Tracks whether a user has already received the weekly "get started" onboarding
email (sent to new free-plan users who created 0 videos in their signup week),
so the recurring Friday job never sends it more than once per user.

Revision ID: add_get_started_email_sent_at
Revises: avatar_shadow
Create Date: 2026-09-11

"""
from alembic import op
import sqlalchemy as sa

revision = "add_get_started_email_sent_at"
down_revision = "avatar_shadow"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("get_started_email_sent_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "get_started_email_sent_at")
