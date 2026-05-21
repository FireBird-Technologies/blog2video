"""Phase 12: Track free template downloads on users table

Revision ID: phase12_free_templates_download
Revises: phase10_support_conversations
Create Date: 2026-05-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "phase12_free_templates_download"
down_revision: Union[str, Sequence[str]] = "phase10_support_conversations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("free_templates_downloaded", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "free_templates_downloaded")
