"""Track per-tool /tools generation usage on users table

Adds counters for the three text generators alongside the existing
``free_book_covers_used``. On FREE these are lifetime totals; on paid plans they
reset each billing period (see User.reset_tool_usage_period).

Revision ID: tool_usage_counters
Revises: free_book_covers_used
Create Date: 2026-07-23
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "tool_usage_counters"
down_revision: Union[str, Sequence[str]] = "free_book_covers_used"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = (
    "video_scripts_used",
    "youtube_descriptions_used",
    "thumbnail_texts_used",
)


def upgrade() -> None:
    for name in _COLUMNS:
        op.add_column(
            "users",
            sa.Column(name, sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    for name in reversed(_COLUMNS):
        op.drop_column("users", name)
