"""Add escalation_count to support_conversations

Rate-limits the support-bot "talk to a human" form so a single conversation
can't be used to flood the internal alert inbox.

NOT YET APPLIED. Run `alembic upgrade head` before (or with) deploying the
support-escalation code — app/models/support_conversation.py declares this
column, so SQLAlchemy will SELECT it on every conversation load and the chat
will error until the column exists.

Revision ID: support_escalation_count
Revises: clamp_stranded_free_video_v2
Create Date: 2026-08-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "support_escalation_count"
down_revision: Union[str, Sequence[str]] = "clamp_stranded_free_video_v2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default="0" backfills existing rows, so this is safe to run on a
    # live table without a separate data migration.
    op.add_column(
        "support_conversations",
        sa.Column(
            "escalation_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("support_conversations", "escalation_count")
