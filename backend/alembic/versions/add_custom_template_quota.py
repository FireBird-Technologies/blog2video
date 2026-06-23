"""add custom-template quota columns to users

Adds custom_template_bonus (+1 slot per $5 purchase) and custom_templates_created
(lifetime counter, never decrements). Both default to 0 for existing AND new users
(grandfathering: pre-launch users are not penalized for templates already made —
the limit applies only to templates created after launch).

Revision ID: add_custom_template_quota
Revises: add_template_ratings
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_custom_template_quota"
down_revision: Union[str, None] = "add_template_ratings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("custom_template_bonus", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("custom_templates_created", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "custom_templates_created")
    op.drop_column("users", "custom_template_bonus")
