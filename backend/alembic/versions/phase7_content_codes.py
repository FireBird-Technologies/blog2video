"""Phase 7: Add content_codes column for multiple unique scene variants

Revision ID: phase7_content_codes
Revises: phase5_template_versions
Create Date: 2026-03-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "phase7_content_codes"
down_revision: Union[str, None] = "phase5_template_versions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add content_codes (JSON text) to custom_templates
    op.add_column(
        "custom_templates",
        sa.Column("content_codes", sa.Text(), nullable=True),
    )

    # Add content_codes (JSON text) to template_versions
    op.add_column(
        "template_versions",
        sa.Column("content_codes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("template_versions", "content_codes")
    op.drop_column("custom_templates", "content_codes")
