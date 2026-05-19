"""Drop blast_campaigns table

Revision ID: drop_blast_campaigns
Revises: drop_supported_video_style
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa


revision = "drop_blast_campaigns"
down_revision = "drop_supported_video_style"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("blast_campaigns")


def downgrade():
    op.create_table(
        "blast_campaigns",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("total_users", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
