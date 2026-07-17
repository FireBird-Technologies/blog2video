"""add ai_edit_credits column to users

Adds ai_edit_credits: a per-user, non-expirable pool of AI-assisted edits granted
at +20 per purchased video (regardless of plan). Spent only after a project's free
per-project allowance (ai_assisted_editing_count < 3) is exhausted, and only while
the owner is on the FREE plan (paid plans get unlimited edits). Defaults to 0 for
existing and new users.

Revision ID: add_ai_edit_credits_to_users
Revises: add_language_regenerating_status
Create Date: 2026-07-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_ai_edit_credits_to_users"
down_revision: Union[str, None] = "add_language_regenerating_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("ai_edit_credits", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "ai_edit_credits")
