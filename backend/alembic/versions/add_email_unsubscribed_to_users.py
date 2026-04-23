"""Add email_unsubscribed to users

Revision ID: add_email_unsubscribed_to_users
Revises: template_change_jobs_cascade
Create Date: 2026-04-21

"""
from alembic import op
import sqlalchemy as sa

revision = "add_email_unsubscribed_to_users"
down_revision = "phase11_blast_campaigns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("email_unsubscribed", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("users", "email_unsubscribed")
