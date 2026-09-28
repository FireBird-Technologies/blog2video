"""Add browser-extension connections and project links.

Revision ID: add_extension_integration
Revises: add_wordpress_integration
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "add_extension_integration"
down_revision: Union[str, None] = "add_wordpress_integration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "extension_connections",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("browser_label", sa.String(length=255), nullable=False, server_default="Chrome extension"),
        sa.Column("device_code_hash", sa.String(length=64), nullable=False),
        sa.Column("user_code", sa.String(length=16), nullable=False),
        sa.Column("access_token_hash", sa.String(length=64), nullable=True),
        sa.Column("pending_access_token", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("device_code_hash"),
        sa.UniqueConstraint("user_code"),
        sa.UniqueConstraint("access_token_hash"),
    )
    op.create_index("ix_extension_connections_user_id", "extension_connections", ["user_id"])
    op.create_index("ix_extension_connections_status", "extension_connections", ["status"])

    op.create_table(
        "extension_project_links",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "connection_id", sa.Integer(),
            sa.ForeignKey("extension_connections.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "project_id", sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("source_url", sa.String(length=2048), nullable=False),
        sa.Column("content_hash", sa.String(length=80), nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("project_id"),
        sa.UniqueConstraint("idempotency_key"),
        sa.UniqueConstraint(
            "connection_id", "source_url", "content_hash",
            name="uq_ext_project_revision",
        ),
    )
    op.create_index("ix_extension_project_links_connection_id", "extension_project_links", ["connection_id"])
    op.create_index("ix_extension_project_links_project_id", "extension_project_links", ["project_id"])


def downgrade() -> None:
    op.drop_table("extension_project_links")
    op.drop_table("extension_connections")
