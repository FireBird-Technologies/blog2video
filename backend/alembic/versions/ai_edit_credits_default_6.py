"""grant every user a free AI-edit pool (default 6)

Replaces the old per-project free allowance (Project.ai_assisted_editing_count < 3)
with a single per-user pool shared across all projects. Raises the ai_edit_credits
server default from 0 to 6 for new users, and grants the free pool to existing users
by ADDING 6 to their current balance (users at 0/NULL become 6; users who already
have credits get 6 on top, e.g. 20 → 26). Video purchases still add +20 each to the
same pool. The now-dead ai_assisted_editing_count column on projects is left in place.

Alembic tracks that this revision ran, so the additive backfill applies exactly once.

Revision ID: ai_edit_credits_default_6
Revises: add_ai_edit_credits_to_users
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ai_edit_credits_default_6"
down_revision: Union[str, None] = "add_ai_edit_credits_to_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FREE_AI_EDIT_CREDITS = 6


def upgrade() -> None:
    # New users start with the free pool.
    op.alter_column(
        "users",
        "ai_edit_credits",
        server_default=str(FREE_AI_EDIT_CREDITS),
    )
    # Grant the free pool by adding it to each user's current balance: users at
    # 0/NULL become the grant, users with existing credits get it added on top.
    op.execute(
        sa.text(
            "UPDATE users SET ai_edit_credits = "
            "COALESCE(ai_edit_credits, 0) + :grant"
        ).bindparams(grant=FREE_AI_EDIT_CREDITS)
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "ai_edit_credits",
        server_default="0",
    )
