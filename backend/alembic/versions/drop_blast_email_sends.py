"""Drop blast_email_sends table

Revision ID: drop_blast_email_sends
Revises: add_email_unsubscribed_to_users
Create Date: 2026-04-21
"""

from alembic import op

revision = "drop_blast_email_sends"
down_revision = "add_email_unsubscribed_to_users"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("blast_email_sends")


def downgrade():
    import sqlalchemy as sa
    op.create_table(
        "blast_email_sends",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("blast_campaigns.id"), nullable=False, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("error_message", sa.String(500), nullable=True),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
    )
