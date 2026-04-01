"""Expand custom_templates.category from VARCHAR(50) to VARCHAR(255)

Revision ID: expand_category_varchar
Revises: phase7_content_codes
Create Date: 2026-03-25
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "expand_category_varchar"
down_revision: Union[str, None] = "phase7_content_codes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "custom_templates",
        "category",
        existing_type=sa.String(50),
        type_=sa.String(255),
        existing_nullable=False,
        existing_server_default="blog",
    )


def downgrade() -> None:
    op.alter_column(
        "custom_templates",
        "category",
        existing_type=sa.String(255),
        type_=sa.String(50),
        existing_nullable=False,
        existing_server_default="blog",
    )
