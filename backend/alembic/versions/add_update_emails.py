"""Add update_emails and update_email_sends tables

Revision ID: add_update_emails
Revises: drop_blast_email_sends
Create Date: 2026-04-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "add_update_emails"
down_revision: str = "phase10_image_box_aspect_ratios"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "update_emails",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("user_filter", sa.String(20), nullable=False, server_default="all"),
        sa.Column("batch_size", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("send_hour", sa.Integer(), nullable=False, server_default="-1"),
        sa.Column("total_users", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "update_email_sends",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("update_email_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="sent"),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["update_email_id"], ["update_emails.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("update_email_id", "user_id", name="uq_update_email_sends_email_user"),
    )
    op.create_index("ix_update_email_sends_update_email_id", "update_email_sends", ["update_email_id"])
    op.create_index("ix_update_email_sends_user_id", "update_email_sends", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_update_email_sends_user_id", table_name="update_email_sends")
    op.drop_index("ix_update_email_sends_update_email_id", table_name="update_email_sends")
    op.drop_table("update_email_sends")
    op.drop_table("update_emails")
