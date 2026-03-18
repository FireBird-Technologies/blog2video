"""add extra_hold_seconds to scenes

Revision ID: a1b2c3d4e5f6
Revises: 0f4a6d0df9b1
Create Date: 2026-03-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "0f4a6d0df9b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scenes",
        sa.Column("extra_hold_seconds", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scenes", "extra_hold_seconds")
